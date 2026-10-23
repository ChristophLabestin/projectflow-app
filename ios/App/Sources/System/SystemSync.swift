import Foundation
import Observation
import WidgetKit
import PFData
import PFModel
import PFSnapshot

/// Work done whenever the app becomes active, the workspace changes or the user signs out: push token refresh,
/// Live Activity start token, widget snapshot, shared extension session, Spotlight index, queued captures/actions.
@MainActor
enum SystemSync {
    static func appBecameActive(model: AppModel) {
        Task { await PushRegistrar.shared.registerIfAuthorized() }
        #if DEBUG
        // QA: `-pfRequestPush` asks for notification permission right away (simulator push tests).
        if ProcessInfo.processInfo.arguments.contains("-pfRequestPush") { Task { await PushRegistrar.shared.requestPermissionIfNeeded() } }
        #endif
        PushRegistrar.shared.upload()
        LiveActivityBridge.shared.observeStartToken(model: model)
        SharedSession.update(model: model)
        SnapshotPublisher.publish(model: model)
        SnapshotObserver.shared.start(model: model)
        CaptureInbox.drain(model: model)
        Task { await AppIntentBridge.shared.drainQueuedActions() }
    }

    /// The active workspace was (re)bound: the shared session, snapshot and Spotlight index follow it.
    static func workspaceBound(model: AppModel) {
        SpotlightIndexer.clear()
        SharedSession.update(model: model)
        SnapshotObserver.shared.start(model: model)
        SnapshotObserver.shared.publishSoon(model: model)
    }

    /// Sign-out: nothing of the account may stay visible outside the app.
    static func signedOut() {
        SnapshotPublisher.clear()
        SharedSession.clear()
        SpotlightIndexer.clear()
        LiveActivityBridge.shared.endAll()
        SnapshotObserver.shared.stop()
    }
}

/// Writes the widget/Live Activity snapshot to the App Group and reloads widgets.
@MainActor
enum SnapshotPublisher {
    /// QA: `-pfWidgetPreview` pins `TodaySnapshot.preview` so widgets can be checked without data.
    static var isPreviewPinned: Bool { ProcessInfo.processInfo.arguments.contains("-pfWidgetPreview") }

    static func publish(model: AppModel) {
        if isPreviewPinned {
            var preview = TodaySnapshot.preview
            preview.projects = shareTargets(model: model)
            SnapshotStore.save(preview)
            WidgetCenter.shared.reloadAllTimelines()
            return
        }
        guard model.uid != nil, var snapshot = TodaySnapshotBuilder.build(model: model) else { return }
        enrich(&snapshot, model: model)
        SnapshotStore.save(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func clear() {
        SnapshotStore.clear()
        _ = SnapshotStore.drainIntentActions()
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// Projects the share extension can target: open projects of the active workspace, most recently touched first.
    private static func shareTargets(model: AppModel) -> [TodaySnapshot.ProjectRef] {
        (model.workspace?.projects ?? [])
            .filter { !$0.isPersonal && $0.status.lifecycle != .closed }
            .sorted { ($0.updatedAt?.instant ?? .distantPast) > ($1.updatedAt?.instant ?? .distantPast) }
            .prefix(20)
            .map { TodaySnapshot.ProjectRef(id: $0.id, title: $0.title, tenantId: $0.tenantId) }
    }

    /// Adds what only the app model knows: language, share targets, stop priorities and the exact focus state.
    private static func enrich(_ snapshot: inout TodaySnapshot, model: AppModel) {
        snapshot.language = L10n.language.rawValue
        let workspace = model.workspace
        snapshot.projects = shareTargets(model: model)
        snapshot.stops = snapshot.stops.map { stop in
            guard stop.priority == nil else { return stop }
            var copy = stop
            copy.priority = stop.isPersonal
                ? workspace?.personalTasks.first { $0.id == stop.id }?.priority?.rawValue
                : workspace?.task(stop.id)?.priority?.rawValue
            return copy
        }
        if let focus = model.profile?.focus {
            snapshot.focus = TodaySnapshot.Focus(
                itemId: focus.itemId, itemType: focus.itemType.rawValue, title: focus.title,
                projectName: workspace?.project(focus.projectId)?.title, nextStep: workspace?.task(focus.itemId)?.nextStep,
                status: focus.status.rawValue, startedAt: focus.startedAt?.instant,
                tenantId: focus.tenantId ?? workspace?.tenantId, projectId: focus.projectId,
                snoozedUntil: focus.snoozedUntil?.instant)
        } else {
            snapshot.focus = nil
        }
    }
}

/// Keeps the snapshot (widgets, share targets) and the Spotlight index current while the app runs, so widgets do
/// not depend on a particular screen being open. Re-publishes 1.5 s after the last change of tasks, projects or focus.
@MainActor
final class SnapshotObserver {
    static let shared = SnapshotObserver()
    private var observing: Task<Void, Never>?
    private var pending: Task<Void, Never>?

    func start(model: AppModel) {
        guard observing == nil else { return }
        observing = Task { [weak self, weak model] in
            while !Task.isCancelled {
                guard let model else { return }
                await Self.nextChange(of: model)
                self?.publishSoon(model: model)
            }
        }
    }

    func stop() {
        observing?.cancel()
        observing = nil
        pending?.cancel()
        pending = nil
    }

    func publishSoon(model: AppModel) {
        pending?.cancel()
        pending = Task { [weak model] in
            try? await Task.sleep(for: .milliseconds(1500))
            guard !Task.isCancelled, let model else { return }
            SnapshotPublisher.publish(model: model)
            SpotlightIndexer.reindex(model: model)
        }
    }

    private static func nextChange(of model: AppModel) async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            withObservationTracking {
                _ = model.workspace?.myTasks
                _ = model.workspace?.personalTasks
                _ = model.workspace?.projects
                _ = model.profile?.focus
                _ = model.workspaceGeneration
                _ = model.auth.phase
            } onChange: {
                continuation.resume()
            }
        }
    }
}

/// Imports captures that the share extension queued while it had no valid session.
@MainActor
enum CaptureInbox {
    static func drain(model: AppModel) {
        let pending = SnapshotStore.pendingCaptures()
        guard !pending.isEmpty, let actions = model.actions else { return }
        SnapshotStore.setPendingCaptures([])
        Task {
            for capture in pending {
                guard let id = try? await actions.createPersonalTask(title: capture.title, dueDate: nil, priority: nil) else { continue }
                if let note = capture.note, !note.isEmpty {
                    try? await actions.updatePersonalTask(id, ["description": SharedDescription.html(note)])
                }
            }
        }
    }
}

/// Task descriptions are HTML on the web; notes from extensions arrive as plain text with optional links.
enum SharedDescription {
    static func html(_ text: String) -> String {
        let escaped = text
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
        return escaped.split(separator: "\n", omittingEmptySubsequences: true).map { "<p>\($0)</p>" }.joined()
    }
}
