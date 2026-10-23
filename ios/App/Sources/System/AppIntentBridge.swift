import Foundation
import PFData
import PFDesign
import PFModel
import PFSnapshot
import WidgetKit

/// Lets App Intents (Siri, Shortcuts, widget buttons, Live Activity buttons, controls) reach the running app
/// model. Intents run in the app process but may start it cold in the background, so every entry point waits
/// for the session before it acts.
@MainActor
final class AppIntentBridge: IntentPerformer {
    static let shared = AppIntentBridge()
    static weak var model: AppModel?

    private static var owned: AppModel?

    /// Creates the app model once (strong reference) and wires it up. Called by the app delegate right after Firebase
    /// is configured — also for background launches triggered by intents — and by `ProjectFlowApp`.
    @discardableResult
    static func bootstrap() -> AppModel {
        if let owned { return owned }
        let model = AppModel()
        owned = model
        install(model: model)
        return model
    }

    static func install(model: AppModel) {
        self.model = model
        IntentRuntime.performer = shared
        model.router.onCapture = { [weak model] context in
            guard let model else { return }
            CaptureLauncher.present(model: model, context: context)
        }
    }

    enum Readiness { case auth, profile, workspace }

    /// Resolves with the model once it reached `level`; nil when signed out or after `timeout` seconds.
    func readyModel(_ level: Readiness, timeout: TimeInterval = 10) async -> AppModel? {
        let deadline = Date.now.addingTimeInterval(timeout)
        while Date.now < deadline {
            guard let model = Self.model else {
                try? await Task.sleep(for: .milliseconds(150))
                continue
            }
            if case .signedOut = model.auth.phase { return nil }
            if model.uid != nil {
                switch level {
                case .auth: return model
                case .profile: if model.profile != nil { return model }
                case .workspace: if model.profile != nil, model.workspace?.isReady == true { return model }
                }
            }
            try? await Task.sleep(for: .milliseconds(150))
        }
        return nil
    }

    /// Runs `work`; a write that is only queued locally (offline) counts as done after `seconds`.
    func bounded(seconds: Double = 6, _ work: @escaping @MainActor () async throws -> Void) async -> Bool {
        await withCheckedContinuation { continuation in
            let once = ResumeOnce(continuation)
            Task { @MainActor in
                do { try await work(); once.finish(true) } catch { once.finish(false) }
            }
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(seconds))
                once.finish(true)
            }
        }
    }

    // MARK: IntentPerformer

    func completeTask(tenantId: String, projectId: String?, taskId: String, isPersonal: Bool) async -> Bool {
        guard let model = await readyModel(.auth), let uid = model.uid else { return false }
        let actions = WorkActions(tenantId: tenantId, uid: uid, actorName: model.profile?.displayName ?? model.auth.displayName ?? "")
        let ok = await bounded {
            if isPersonal || projectId == nil {
                try await actions.setPersonalCompleted(taskId, true)
            } else if let projectId {
                try await actions.setCompleted(TaskRef(tenantId: tenantId, projectId: projectId, taskId: taskId), true)
            }
        }
        guard ok else { return false }
        // Same rule as in the app: finishing the focused item ends the focus.
        if let focus = (await readyModel(.profile, timeout: 3))?.profile?.focus, focus.itemId == taskId {
            await FocusController(model: model).clear()
        }
        SnapshotPublisher.publish(model: model)
        return true
    }

    func completeFocus() async -> Bool {
        guard let model = await readyModel(.profile) else { return false }
        guard model.profile?.focus != nil else { return true }
        _ = await bounded { _ = await FocusController(model: model).complete() }
        SnapshotPublisher.publish(model: model)
        return true
    }

    func pauseFocus() async -> Bool {
        guard let model = await readyModel(.profile) else { return false }
        guard model.profile?.focus != nil else { return true }
        _ = await bounded { await FocusController(model: model).snooze() }
        SnapshotPublisher.publish(model: model)
        return true
    }

    func resumeFocus() async -> Bool {
        guard let model = await readyModel(.profile) else { return false }
        guard model.profile?.focus != nil else { return true }
        _ = await bounded { await FocusController(model: model).resume() }
        SnapshotPublisher.publish(model: model)
        return true
    }

    func openCapture() async {
        guard let model = await readyModel(.workspace) else { return }
        CaptureLauncher.present(model: model)
    }

    /// Opens a route from outside (Spotlight, Siri): waits for the workspace so the URL is not deferred.
    func open(url: URL) async {
        guard let model = await readyModel(.workspace) else { return }
        model.router.handle(url: url, activeTenant: model.workspace?.tenantId)
    }

    /// Runs the actions that widgets/controls queued while the app could not execute them.
    func drainQueuedActions() async {
        let queued = SnapshotStore.drainIntentActions()
        for action in queued {
            switch action.kind {
            case .completeTask:
                guard let tenant = action.tenantId, let id = action.itemId else { continue }
                _ = await completeTask(tenantId: tenant, projectId: action.projectId, taskId: id, isPersonal: action.isPersonal)
            case .completeFocus: _ = await completeFocus()
            case .pauseFocus: _ = await pauseFocus()
            case .resumeFocus: _ = await resumeFocus()
            }
        }
    }
}

@MainActor
private final class ResumeOnce {
    private var continuation: CheckedContinuation<Bool, Never>?

    init(_ continuation: CheckedContinuation<Bool, Never>) { self.continuation = continuation }

    func finish(_ value: Bool) {
        continuation?.resume(returning: value)
        continuation = nil
    }
}
