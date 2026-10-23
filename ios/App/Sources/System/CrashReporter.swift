import Foundation
import os
import SentinelKit

/// Anonymous crash reports through Labestin Sentinel (SentinelKit), only while the user has opted in
/// (`FirstRunState.crashReportsEnabled`, first-install flow and Account → Data).
///
/// SentinelKit 0.1.0 has no public stop, so the opt-in is enforced here:
/// - the client is started only while the opt-in is on (no MetricKit subscriber, no exception handler otherwise);
/// - every Sentinel request runs through `ConsentGate`, which fails it while the opt-in is off;
/// - switching off restores the previous exception handler and deletes Sentinel's local queue, breadcrumbs and
///   install id, so nothing collected while off is sent after switching back on.
///
/// Sent: install id (random, per install), app version/build, iOS version, device model, locale and the crash
/// stack. The app adds no breadcrumbs, user ids or captured errors — no name, email or project content.
nonisolated enum CrashReporter {
    private static let state = OSAllocatedUnfairLock(initialState: State())

    private struct State {
        var started = false
        var startedBefore = false
        var originalHandler: (@convention(c) (NSException) -> Void)?
    }

    /// Call at launch and whenever the opt-in changes.
    static func applyConsent() {
        let enabled = FirstRunState.crashReportsEnabled
        ConsentGate.isOpen.withLock { $0 = enabled }
        if enabled { start() } else { stop() }
    }

    private static func start() {
        guard let dsn else { return }
        let (begin, restart) = state.withLock { s -> (Bool, Bool) in
            guard !s.started else { return (false, false) }
            defer { s.started = true; s.startedBefore = true }
            s.originalHandler = NSGetUncaughtExceptionHandler()
            return (true, s.startedBefore)
        }
        guard begin else { return }
        // Switched back on in the same session: the earlier client may have queued a MetricKit diagnostic while off.
        if restart { purgeLocalData() }
        let options = SentinelClient.Options(session: ConsentGate.session)
        #if DEBUG
        _ = try? Sentinel.start(dsn: dsn, environment: .development, options: options)
        #else
        _ = try? Sentinel.start(dsn: dsn, options: options)
        #endif
    }

    private static func stop() {
        let handler = state.withLock { s -> (@convention(c) (NSException) -> Void)?? in
            guard s.started else { return .none }
            s.started = false
            return .some(s.originalHandler)
        }
        if let handler { NSSetUncaughtExceptionHandler(handler) }
        purgeLocalData()
    }

    /// Sentinel keeps its queue under Application Support/Sentinel/<projectId>.
    private static func purgeLocalData() {
        guard let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return }
        try? FileManager.default.removeItem(at: support.appendingPathComponent("Sentinel", isDirectory: true))
    }

    /// Public DSN from the build setting `PF_SENTINEL_DSN` (Info.plist `PFSentinelDSN`); debug builds may override it
    /// per run with the launch environment variable `PF_SENTINEL_DSN` (emulator tests). Empty → reporter off.
    private static var dsn: String? {
        #if DEBUG
        if let value = ProcessInfo.processInfo.environment["PF_SENTINEL_DSN"], !value.isEmpty { return value }
        #endif
        let value = Bundle.main.object(forInfoDictionaryKey: "PFSentinelDSN") as? String
        return value?.isEmpty == false ? value : nil
    }

    #if DEBUG
    /// Launch argument `-PFCrashTest`: raises an Objective-C exception shortly after launch. SentinelKit stores it and
    /// sends it on the next launch (only with the opt-in on).
    static func crashIfRequested() {
        guard ProcessInfo.processInfo.arguments.contains("-PFCrashTest") else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            NSException(name: .internalInconsistencyException, reason: "ProjectFlow crash test", userInfo: nil).raise()
        }
    }
    #endif
}

/// URL protocol on the Sentinel session: while the opt-in is off it takes every request and fails it, so no byte
/// leaves the device even if a SentinelKit client from earlier in the session is still alive.
nonisolated final class ConsentGate: URLProtocol {
    static let isOpen = OSAllocatedUnfairLock(initialState: false)

    static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [ConsentGate.self] + (config.protocolClasses ?? [])
        return URLSession(configuration: config)
    }()

    override class func canInit(with request: URLRequest) -> Bool { !isOpen.withLock { $0 } }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() { client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet)) }
    override func stopLoading() {}
}
