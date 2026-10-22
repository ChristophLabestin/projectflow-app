import AppIntents
import Foundation
import WidgetKit
import PFSnapshot

// Intents behind the interactive buttons of widgets, the Live Activity and controls. They are compiled into the
// app and the widget extension. They conform to `LiveActivityIntent`, so the system runs `perform()` in the
// *app* process (where Firebase and the session live). When it does not (no performer registered, app not ready),
// the action is queued in the App Group and drained the next time the app becomes active.

/// Implemented by the app (`AppIntentBridge`), registered at launch.
@MainActor
protocol IntentPerformer: AnyObject {
    func completeTask(tenantId: String, projectId: String?, taskId: String, isPersonal: Bool) async -> Bool
    func completeFocus() async -> Bool
    func pauseFocus() async -> Bool
    func resumeFocus() async -> Bool
    func openCapture() async
}

@MainActor
enum IntentRuntime {
    static weak var performer: (any IntentPerformer)?
}

/// Ring check of a "Heute" stop.
struct TaskDoneButtonIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Aufgabe erledigen"
    static let isDiscoverable = false

    @Parameter(title: "Aufgabe") var taskId: String
    @Parameter(title: "Workspace") var tenantId: String
    @Parameter(title: "Projekt") var projectId: String
    @Parameter(title: "Persönlich") var isPersonal: Bool

    init() {}

    init(taskId: String, tenantId: String, projectId: String?, isPersonal: Bool) {
        self.taskId = taskId
        self.tenantId = tenantId
        self.projectId = projectId ?? ""
        self.isPersonal = isPersonal
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        let id = taskId, tenant = tenantId, project = projectId.isEmpty ? nil : projectId, personal = isPersonal
        SnapshotStore.update { $0.removingStop(id: id) }
        WidgetCenter.shared.reloadAllTimelines()
        let done = await IntentRuntime.performer?.completeTask(tenantId: tenant, projectId: project, taskId: id, isPersonal: personal) ?? false
        if !done {
            SnapshotStore.queueIntentAction(.init(kind: .completeTask, tenantId: tenant, projectId: project, itemId: id, isPersonal: personal))
        }
        return .result()
    }
}

nonisolated struct FocusDoneButtonIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Fokus erledigen"
    static let isDiscoverable = false

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        let focusId = SnapshotStore.load()?.focus?.itemId
        SnapshotStore.update { snapshot in
            let next = focusId.map { snapshot.removingStop(id: $0) } ?? snapshot
            return next.clearingFocus
        }
        WidgetCenter.shared.reloadAllTimelines()
        let done = await IntentRuntime.performer?.completeFocus() ?? false
        if !done { SnapshotStore.queueIntentAction(.init(kind: .completeFocus)) }
        return .result()
    }
}

nonisolated struct FocusPauseButtonIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Fokus pausieren"
    static let isDiscoverable = false

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        SnapshotStore.update { $0.settingFocusPause(until: .now.addingTimeInterval(3600)) }
        WidgetCenter.shared.reloadAllTimelines()
        let done = await IntentRuntime.performer?.pauseFocus() ?? false
        if !done { SnapshotStore.queueIntentAction(.init(kind: .pauseFocus)) }
        return .result()
    }
}

nonisolated struct FocusResumeButtonIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Fokus fortsetzen"
    static let isDiscoverable = false

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        SnapshotStore.update { $0.settingFocusPause(until: nil) }
        WidgetCenter.shared.reloadAllTimelines()
        let done = await IntentRuntime.performer?.resumeFocus() ?? false
        if !done { SnapshotStore.queueIntentAction(.init(kind: .resumeFocus)) }
        return .result()
    }
}

/// Control Center toggle "Fokus ⏯": on = running, off = paused.
struct FocusToggleIntent: SetValueIntent, LiveActivityIntent {
    static let title: LocalizedStringResource = "Fokus pausieren oder fortsetzen"
    static let isDiscoverable = false

    @Parameter(title: "Läuft") var value: Bool

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        if value {
            SnapshotStore.update { $0.settingFocusPause(until: nil) }
            let done = await IntentRuntime.performer?.resumeFocus() ?? false
            if !done { SnapshotStore.queueIntentAction(.init(kind: .resumeFocus)) }
        } else {
            SnapshotStore.update { $0.settingFocusPause(until: .now.addingTimeInterval(3600)) }
            let done = await IntentRuntime.performer?.pauseFocus() ?? false
            if !done { SnapshotStore.queueIntentAction(.init(kind: .pauseFocus)) }
        }
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

/// Control Center / Lock Screen / Action Button "Erfassen": opens the app straight into the composer.
nonisolated struct OpenCaptureIntent: AppIntent {
    static let title: LocalizedStringResource = "Erfassen öffnen"
    static let description = IntentDescription("Öffnet ProjectFlow direkt im Erfassen-Composer.")
    static let openAppWhenRun = true

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        await IntentRuntime.performer?.openCapture()
        return .result()
    }
}
