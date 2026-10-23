import Foundation
import MachO
import MetricKit
import os

/// ProjectFlow's own crash reporting (backend: `crashIngest`, admin platform /admin/crashes). Runs only while the user
/// has opted in (`FirstRunState.crashReportsEnabled`, first-install flow and Account → Data); the setter applies a change
/// immediately.
///
/// Captured: fatal signals (SIGSEGV, SIGABRT, Swift traps …) and uncaught Objective-C exceptions are written to disk at
/// crash time and sent on the next launch; on devices MetricKit also delivers its crash diagnostics. Sent per report:
/// a random install id, app version/build, iOS version, device model, locale and the stack as image + offset (no
/// symbol names; `scripts/crash-symbolicate.mjs` resolves them with the archived dSYMs). No user id, name, email or
/// project content. Switching off removes the handlers and deletes everything stored (including the install id).
nonisolated enum CrashReporter {
    private static let state = OSAllocatedUnfairLock(initialState: State())

    private struct State {
        var endpoint: URL?
        var running = false
        var originalExceptionHandler: (@convention(c) (NSException) -> Void)?
        var metricKit: MetricKitSubscriber?
    }

    /// Where reports go; set once at launch before `applyConsent()`.
    static func configure(endpoint: URL) {
        state.withLock { $0.endpoint = endpoint }
    }

    /// Call at launch and whenever the opt-in changes.
    static func applyConsent() {
        if FirstRunState.crashReportsEnabled { start() } else { stop() }
    }

    // MARK: Start / stop

    private static func start() {
        let shouldStart = state.withLock { s -> Bool in
            guard !s.running, s.endpoint != nil else { return false }
            s.running = true
            s.originalExceptionHandler = NSGetUncaughtExceptionHandler()
            return true
        }
        guard shouldStart else { return }
        Store.prepare()
        // Crash files from the previous run belong to that run's image list, so collect them before writing the new one.
        Store.collectPreviousCrash()
        Store.writeImages(Images.loaded())
        SignalCapture.install(fd: Store.openSignalFile())
        NSSetUncaughtExceptionHandler(handleException)
        let subscriber = MetricKitSubscriber()
        MXMetricManager.shared.add(subscriber)
        state.withLock { $0.metricKit = subscriber }
        Task.detached(priority: .utility) { await send() }
    }

    private static func stop() {
        let (wasRunning, handler, subscriber) = state.withLock { s in
            defer { s.running = false; s.metricKit = nil }
            return (s.running, s.originalExceptionHandler, s.metricKit)
        }
        if wasRunning {
            SignalCapture.uninstall()
            NSSetUncaughtExceptionHandler(handler)
            if let subscriber { MXMetricManager.shared.remove(subscriber) }
        }
        Store.deleteAll()
    }

    // MARK: Uncaught Objective-C exceptions

    private static let handleException: @convention(c) (NSException) -> Void = { exception in
        SignalCapture.exceptionRecorded = true   // the SIGABRT that follows needs no second report
        let addresses = exception.callStackReturnAddresses.prefix(Report.maxFrames).map(\.uintValue)
        Store.writeException(name: exception.name.rawValue, reason: exception.reason ?? "", addresses: Array(addresses))
        CrashReporter.state.withLock { $0.originalExceptionHandler }?(exception)
    }

    // MARK: Sending

    static func send() async {
        guard FirstRunState.crashReportsEnabled, let endpoint = state.withLock({ $0.endpoint }) else { return }
        for file in Store.pendingReports() {
            guard let body = try? Data(contentsOf: file) else { Store.remove(file); continue }
            var request = URLRequest(url: endpoint, timeoutInterval: 20)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            request.httpBody = body
            guard let (_, response) = try? await URLSession.shared.data(for: request) else { return }   // offline: retry next launch
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status == 429 || status >= 500 { return }
            Store.remove(file)   // stored, or rejected for good (4xx)
        }
    }

    static func enqueue(_ report: Report) {
        guard state.withLock({ $0.running }) else { return }
        Store.writeReport(report)
        Task.detached(priority: .utility) { await send() }
    }

    #if DEBUG
    /// Launch arguments for testing: `-PFCrashTest` raises an Objective-C exception, `-PFCrashTestSignal` traps
    /// (Swift `fatalError` → SIGTRAP). The report is sent on the next launch, only with the opt-in on.
    static func crashIfRequested() {
        let args = ProcessInfo.processInfo.arguments
        guard args.contains("-PFCrashTest") || args.contains("-PFCrashTestSignal") else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if args.contains("-PFCrashTestSignal") { fatalError("ProjectFlow crash test") }
            NSException(name: .internalInconsistencyException, reason: "ProjectFlow crash test", userInfo: nil).raise()
        }
    }
    #endif
}

// MARK: - Report payload (contract: functions/src/crash-reports.ts)

nonisolated struct Report: Codable, Sendable {
    static let maxFrames = 80

    struct Device: Codable, Sendable { var os = "iOS"; var osVersion: String; var model: String; var locale: String }
    struct Frame: Codable, Sendable { var image: String?; var uuid: String?; var offset: UInt?; var address: String; var inApp: Bool? }
    struct Image: Codable, Sendable { var name: String; var uuid: String; var loadAddress: String; var arch: String }
    struct Event: Codable, Sendable {
        var id = UUID().uuidString
        var timestamp: Int
        var mechanism: String
        var handled = false
        var type: String
        var message: String
        var frames: [Frame]
        var images: [Image]
    }

    var platform = "ios"
    var environment: String
    var release: String
    var build: String
    var installId: String
    var device: Device
    var events: [Event]

    static func make(release: String? = nil, build: String? = nil, event: Event) -> Report {
        let info = Bundle.main.infoDictionary
        let v = ProcessInfo.processInfo.operatingSystemVersion
        #if DEBUG
        let environment = "development"
        #else
        let environment = "production"
        #endif
        return Report(environment: environment,
                      release: release ?? info?["CFBundleShortVersionString"] as? String ?? "0",
                      build: build ?? info?["CFBundleVersion"] as? String ?? "0",
                      installId: Store.installId(),
                      device: Device(osVersion: "\(v.majorVersion).\(v.minorVersion).\(v.patchVersion)", model: Images.model,
                                     locale: String(Locale.current.identifier.prefix(20))),
                      events: [event])
    }

    /// Frames from raw return addresses, resolved to image + offset with the image list of the crashed process.
    static func frames(_ addresses: [UInt], images: [Image]) -> [Frame] {
        let main = Bundle.main.executableURL?.lastPathComponent
        let ranges = images.compactMap { image in UInt(image.loadAddress.dropFirst(2), radix: 16).map { ($0, image) } }.sorted { $0.0 < $1.0 }
        return addresses.prefix(maxFrames).map { address in
            let hex = "0x" + String(address, radix: 16)
            guard let (base, image) = ranges.last(where: { $0.0 <= address }) else { return Frame(address: hex) }
            return Frame(image: image.name, uuid: image.uuid, offset: address - base, address: hex, inApp: image.name == main || image.name.hasPrefix("ProjectFlow"))
        }
    }

    /// Only the images the stack refers to travel with the report.
    static func usedImages(_ frames: [Frame], from images: [Image]) -> [Image] {
        let names = Set(frames.compactMap(\.image))
        return images.filter { names.contains($0.name) }
    }

    static func scrub(_ text: String) -> String {
        text.replacingOccurrences(of: #"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}"#, with: "<email>", options: [.regularExpression, .caseInsensitive])
    }
}

// MARK: - Loaded images (name, UUID, load address)

nonisolated enum Images {
    static func loaded() -> [Report.Image] {
        (0..<_dyld_image_count()).compactMap { index in
            guard let header = _dyld_get_image_header(index), let cName = _dyld_get_image_name(index) else { return nil }
            guard let uuid = uuid(of: header) else { return nil }
            let arch: String
            switch header.pointee.cputype {
            case CPU_TYPE_ARM64: arch = "arm64"
            case CPU_TYPE_X86_64: arch = "x86_64"
            default: arch = "unknown"
            }
            return Report.Image(name: URL(fileURLWithPath: String(cString: cName)).lastPathComponent, uuid: uuid,
                                loadAddress: "0x" + String(UInt(bitPattern: header), radix: 16), arch: arch)
        }
    }

    private static func uuid(of header: UnsafePointer<mach_header>) -> String? {
        var cursor = UnsafeRawPointer(header).advanced(by: MemoryLayout<mach_header_64>.size)
        for _ in 0..<header.pointee.ncmds {
            let command = cursor.assumingMemoryBound(to: load_command.self).pointee
            if command.cmd == LC_UUID {
                let u = cursor.assumingMemoryBound(to: uuid_command.self).pointee.uuid
                return UUID(uuid: u).uuidString
            }
            cursor = cursor.advanced(by: Int(command.cmdsize))
        }
        return nil
    }

    static var model: String {
        if let sim = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] { return sim }
        var u = utsname(); uname(&u)
        return withUnsafeBytes(of: &u.machine) { String(decoding: $0.prefix { $0 != 0 }, as: UTF8.self) }
    }
}

// MARK: - Fatal signals (async-signal-safe path: preallocated buffers, write(2) only)

nonisolated enum SignalCapture {
    static let signals: [Int32] = [SIGABRT, SIGBUS, SIGFPE, SIGILL, SIGSEGV, SIGTRAP]
    static let capacity: Int32 = 128
    nonisolated(unsafe) static var fd: Int32 = -1
    nonisolated(unsafe) static var exceptionRecorded = false
    nonisolated(unsafe) static let frames = UnsafeMutablePointer<UnsafeMutableRawPointer?>.allocate(capacity: Int(capacity))
    nonisolated(unsafe) static let header = UnsafeMutablePointer<Int32>.allocate(capacity: 4)
    nonisolated(unsafe) static let previous = UnsafeMutablePointer<sigaction>.allocate(capacity: signals.count)
    nonisolated(unsafe) static var altStack: UnsafeMutableRawPointer?
    static let magic: Int32 = 0x5046_4352   // "PFCR"

    static func install(fd newFD: Int32) {
        guard newFD >= 0 else { return }
        fd = newFD
        exceptionRecorded = false
        if altStack == nil {
            // Own stack for the handler, so stack overflows can still be recorded.
            let size = 64 * 1024
            altStack = UnsafeMutableRawPointer.allocate(byteCount: size, alignment: 16)
            var stack = stack_t(ss_sp: altStack, ss_size: size, ss_flags: 0)
            sigaltstack(&stack, nil)
        }
        for (index, sig) in signals.enumerated() {
            var action = sigaction()
            action.__sigaction_u.__sa_sigaction = handleSignal
            action.sa_flags = SA_SIGINFO | SA_ONSTACK
            sigemptyset(&action.sa_mask)
            sigaction(sig, &action, previous.advanced(by: index))
        }
    }

    static func uninstall() {
        guard fd >= 0 else { return }
        for (index, sig) in signals.enumerated() { sigaction(sig, previous.advanced(by: index), nil) }
        close(fd)
        fd = -1
    }

    /// Record: magic, signal, frame count, 0, then the return addresses (64-bit each).
    private static let handleSignal: @convention(c) (Int32, UnsafeMutablePointer<__siginfo>?, UnsafeMutableRawPointer?) -> Void = { sig, _, _ in
        if SignalCapture.fd >= 0, !SignalCapture.exceptionRecorded {
            let count = backtrace(SignalCapture.frames, SignalCapture.capacity)
            SignalCapture.header[0] = SignalCapture.magic
            SignalCapture.header[1] = sig
            SignalCapture.header[2] = count
            SignalCapture.header[3] = 0
            _ = write(SignalCapture.fd, SignalCapture.header, 16)
            _ = write(SignalCapture.fd, SignalCapture.frames, Int(count) * 8)
        }
        // Hand over to the previous handler / default action so the system still sees the crash.
        if let index = SignalCapture.signals.firstIndex(of: sig) { sigaction(sig, SignalCapture.previous.advanced(by: index), nil) }
        raise(sig)
    }

    static func name(_ sig: Int32) -> String {
        switch sig {
        case SIGABRT: "SIGABRT"
        case SIGBUS: "SIGBUS"
        case SIGFPE: "SIGFPE"
        case SIGILL: "SIGILL"
        case SIGSEGV: "SIGSEGV"
        case SIGTRAP: "SIGTRAP"
        default: "SIG\(sig)"
        }
    }
}

// MARK: - MetricKit (devices only; delivered on a later launch)

nonisolated final class MetricKitSubscriber: NSObject, MXMetricManagerSubscriber, @unchecked Sendable {
    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            for diagnostic in payload.crashDiagnostics ?? [] {
                if let report = Self.report(from: diagnostic.jsonRepresentation()) { CrashReporter.enqueue(report) }
            }
        }
    }

    static func report(from json: Data) -> Report? {
        guard let root = try? JSONSerialization.jsonObject(with: json) as? [String: Any] else { return nil }
        let meta = root["diagnosticMetaData"] as? [String: Any] ?? [:]
        let tree = root["callStackTree"] as? [String: Any] ?? [:]
        let stacks = tree["callStacks"] as? [[String: Any]] ?? []
        let stack = stacks.first { $0["threadAttributed"] as? Bool == true } ?? stacks.first
        var frames: [Report.Frame] = []
        var node = (stack?["callStackRootFrames"] as? [[String: Any]])?.first
        let main = Bundle.main.executableURL?.lastPathComponent
        while let current = node, frames.count < Report.maxFrames {
            let image = current["binaryName"] as? String
            let address = (current["address"] as? NSNumber)?.uintValue ?? 0
            frames.append(Report.Frame(image: image, uuid: current["binaryUUID"] as? String,
                                       offset: (current["offsetIntoBinaryTextSegment"] as? NSNumber)?.uintValue,
                                       address: "0x" + String(address, radix: 16), inApp: image == main || image?.hasPrefix("ProjectFlow") == true))
            node = (current["subFrames"] as? [[String: Any]])?.first
        }
        let objc = meta["objectiveCexceptionReason"] as? [String: Any]
        let signal = meta["signal"] as? Int
        let type = objc?["exceptionName"] as? String ?? signal.map { SignalCapture.name(Int32($0)) } ?? "Crash"
        let message = objc?["composedMessage"] as? String ?? meta["terminationReason"] as? String ?? ""
        let event = Report.Event(timestamp: Int(Date().timeIntervalSince1970 * 1000), mechanism: "metrickit", type: type,
                                 message: Report.scrub(message), frames: frames, images: [])
        let version = (meta["appVersion"] as? String)
        let build = (meta["appBuildVersion"] as? String)
        return Report.make(release: version, build: build, event: event)
    }
}

// MARK: - Files under Application Support/CrashReports

nonisolated enum Store {
    static let dir: URL = (FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        ?? FileManager.default.temporaryDirectory).appendingPathComponent("CrashReports", isDirectory: true)
    private static var images: URL { dir.appendingPathComponent("images.json") }
    private static var signal: URL { dir.appendingPathComponent("signal.bin") }
    private static var exception: URL { dir.appendingPathComponent("exception.json") }
    private static var pending: URL { dir.appendingPathComponent("pending", isDirectory: true) }

    static func prepare() {
        try? FileManager.default.createDirectory(at: pending, withIntermediateDirectories: true)
    }

    static func deleteAll() {
        try? FileManager.default.removeItem(at: dir)
    }

    static func installId() -> String {
        let file = dir.appendingPathComponent("install")
        if let id = try? String(contentsOf: file, encoding: .utf8), id.count >= 8 { return id }
        let id = UUID().uuidString
        try? id.write(to: file, atomically: true, encoding: .utf8)
        return id
    }

    static func writeImages(_ list: [Report.Image]) {
        if let data = try? JSONEncoder().encode(list) { try? data.write(to: images, options: .atomic) }
    }

    static func openSignalFile() -> Int32 {
        open(signal.path, O_WRONLY | O_CREAT | O_TRUNC, 0o600)
    }

    static func writeException(name: String, reason: String, addresses: [UInt]) {
        let body: [String: Any] = ["name": name, "reason": reason, "addresses": addresses.map { NSNumber(value: $0) },
                                   "timestamp": Int(Date().timeIntervalSince1970 * 1000)]
        if let data = try? JSONSerialization.data(withJSONObject: body) { try? data.write(to: exception, options: .atomic) }
    }

    /// Turns the previous run's crash files (exception or signal record) into a pending report.
    static func collectPreviousCrash() {
        defer {
            try? FileManager.default.removeItem(at: exception)
            try? FileManager.default.removeItem(at: signal)
        }
        let imageList = (try? Data(contentsOf: images)).flatMap { try? JSONDecoder().decode([Report.Image].self, from: $0) } ?? []
        let modified = (try? FileManager.default.attributesOfItem(atPath: signal.path)[.modificationDate] as? Date) ?? Date()
        var event: Report.Event?
        if let data = try? Data(contentsOf: exception),
           let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let frames = Report.frames((body["addresses"] as? [NSNumber] ?? []).map(\.uintValue), images: imageList)
            event = Report.Event(timestamp: body["timestamp"] as? Int ?? Int(modified.timeIntervalSince1970 * 1000), mechanism: "nsexception",
                                 type: body["name"] as? String ?? "NSException", message: Report.scrub(body["reason"] as? String ?? ""),
                                 frames: frames, images: Report.usedImages(frames, from: imageList))
        } else if let data = try? Data(contentsOf: signal), data.count >= 16 {
            let words = data.withUnsafeBytes { Array($0.bindMemory(to: Int32.self).prefix(4)) }
            if words[0] == SignalCapture.magic {
                let count = min(Int(words[2]), (data.count - 16) / 8)
                let addresses = data.dropFirst(16).withUnsafeBytes { Array($0.bindMemory(to: UInt.self).prefix(count)) }
                // Drop the handler's own frames: everything up to and including _sigtramp (libsystem_platform).
                var frames = Report.frames(addresses, images: imageList)
                if let trampoline = frames.prefix(8).lastIndex(where: { $0.image == "libsystem_platform.dylib" }) {
                    frames.removeFirst(trampoline + 1)
                } else if !frames.isEmpty {
                    frames.removeFirst()
                }
                event = Report.Event(timestamp: Int(modified.timeIntervalSince1970 * 1000), mechanism: "signal",
                                     type: SignalCapture.name(words[1]), message: "", frames: frames,
                                     images: Report.usedImages(frames, from: imageList))
            }
        }
        // A crash from the previous run carries that run's version, which is this one unless the app was updated.
        if let event { writeReport(.make(event: event)) }
    }

    static func writeReport(_ report: Report) {
        prepare()
        let file = pending.appendingPathComponent("\(report.events.first?.id ?? UUID().uuidString).json")
        if let data = try? JSONEncoder().encode(report) { try? data.write(to: file, options: .atomic) }
    }

    static func pendingReports() -> [URL] {
        (try? FileManager.default.contentsOfDirectory(at: pending, includingPropertiesForKeys: nil))?.filter { $0.pathExtension == "json" } ?? []
    }

    static func remove(_ file: URL) {
        try? FileManager.default.removeItem(at: file)
    }
}
