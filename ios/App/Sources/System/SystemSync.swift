import Foundation
import WidgetKit
import PFData
import PFSnapshot

/// Work done whenever the app becomes active: push token refresh, Live Activity start token,
/// widget snapshot, queued share-extension captures.
@MainActor
enum SystemSync {
    static func appBecameActive(model: AppModel) {
        Task { await PushRegistrar.shared.registerIfAuthorized() }
        PushRegistrar.shared.upload()
        LiveActivityBridge.shared.observeStartToken(model: model)
        SnapshotPublisher.publish(model: model)
        CaptureInbox.drain(model: model)
    }
}

/// Writes the widget/Live Activity snapshot to the App Group and reloads widgets.
@MainActor
enum SnapshotPublisher {
    static func publish(model: AppModel) {
        guard let snapshot = TodaySnapshotBuilder.build(model: model) else { return }
        SnapshotStore.save(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func clear() {
        SnapshotStore.clear()
        WidgetCenter.shared.reloadAllTimelines()
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
                _ = try? await actions.createPersonalTask(title: capture.title, dueDate: nil, priority: nil)
            }
        }
    }
}

/// Lets App Intents (Siri, Shortcuts, widgets, controls) reach the running app model.
@MainActor
enum AppIntentBridge {
    static weak var model: AppModel?
}
