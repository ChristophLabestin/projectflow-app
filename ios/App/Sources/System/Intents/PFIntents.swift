import AppIntents
import Foundation
import PFData
import PFModel
import PFSnapshot
import WidgetKit

// Intents for Siri, Shortcuts, Spotlight and Action Button. They run in the app process (no UI) and talk to the
// model through `AppIntentBridge`. Copy comes from `L10n` (app language), titles from the string catalog.

@MainActor
private enum IntentReply {
    static func dialog(_ text: String) -> IntentDialog { IntentDialog(stringLiteral: text) }

    /// Why nothing could be done: signed out or still loading.
    static var unavailable: IntentDialog {
        if let model = AppIntentBridge.model, case .signedOut = model.auth.phase { return dialog(L10n.t("intent.notSignedIn")) }
        return dialog(L10n.t("intent.notReady"))
    }
}

// MARK: - Tasks

struct CompleteTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Aufgabe erledigen"
    static let description = IntentDescription("Hakt eine Aufgabe als erledigt ab.")
    static var parameterSummary: some ParameterSummary { Summary("\(\.$task) erledigen") }

    @Parameter(title: "Aufgabe") var task: TaskEntity

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let reference = task.reference else { return .result(dialog: IntentReply.dialog(L10n.t("intent.taskNotFound"))) }
        SnapshotStore.update { $0.removingStop(id: reference.taskId) }
        WidgetCenter.shared.reloadAllTimelines()
        let done = await AppIntentBridge.shared.completeTask(tenantId: reference.tenantId, projectId: reference.projectId,
                                                              taskId: reference.taskId, isPersonal: reference.isPersonal)
        guard done else { return .result(dialog: IntentReply.unavailable) }
        return .result(dialog: IntentReply.dialog(L10n.t("intent.taskDone", ["title": task.title])))
    }
}

// MARK: - Focus

struct StartFocusIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Fokus starten"
    static let description = IntentDescription("Startet den Fokus auf einer Aufgabe.")
    static var parameterSummary: some ParameterSummary { Summary("Fokus auf \(\.$task) starten") }

    @Parameter(title: "Aufgabe") var task: TaskEntity

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let model = await AppIntentBridge.shared.readyModel(.workspace), let workspace = model.workspace else {
            return .result(dialog: IntentReply.unavailable)
        }
        guard let reference = task.reference else { return .result(dialog: IntentReply.dialog(L10n.t("intent.taskNotFound"))) }
        let controller = FocusController(model: model)
        if let projectId = reference.projectId, let found = workspace.task(reference.taskId), found.projectId == projectId {
            await controller.start(task: found)
        } else if reference.isPersonal, let personal = workspace.personalTasks.first(where: { $0.id == reference.taskId }) {
            await controller.start(personal: personal)
        } else {
            return .result(dialog: IntentReply.dialog(L10n.t("intent.taskNotFound")))
        }
        SnapshotPublisher.publish(model: model)
        return .result(dialog: IntentReply.dialog(L10n.t("intent.focusStarted", ["title": task.title])))
    }
}

struct CompleteFocusIntent: AppIntent {
    static let title: LocalizedStringResource = "Fokus erledigen"
    static let description = IntentDescription("Schließt die Aufgabe ab, an der du gerade im Fokus arbeitest.")

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let model = await AppIntentBridge.shared.readyModel(.profile) else { return .result(dialog: IntentReply.unavailable) }
        guard let focus = model.profile?.focus else { return .result(dialog: IntentReply.dialog(L10n.t("intent.noFocus"))) }
        SnapshotStore.update { $0.removingStop(id: focus.itemId).clearingFocus }
        WidgetCenter.shared.reloadAllTimelines()
        _ = await AppIntentBridge.shared.completeFocus()
        return .result(dialog: IntentReply.dialog(L10n.t("intent.focusDone", ["title": focus.title])))
    }
}

struct PauseFocusIntent: AppIntent {
    static let title: LocalizedStringResource = "Fokus pausieren"
    static let description = IntentDescription("Pausiert deinen Fokus für eine Stunde.")

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let model = await AppIntentBridge.shared.readyModel(.profile) else { return .result(dialog: IntentReply.unavailable) }
        guard model.profile?.focus != nil else { return .result(dialog: IntentReply.dialog(L10n.t("intent.noFocus"))) }
        SnapshotStore.update { $0.settingFocusPause(until: .now.addingTimeInterval(3600)) }
        WidgetCenter.shared.reloadAllTimelines()
        _ = await AppIntentBridge.shared.pauseFocus()
        return .result(dialog: IntentReply.dialog(L10n.t("intent.focusPaused")))
    }
}

struct ResumeFocusIntent: AppIntent {
    static let title: LocalizedStringResource = "Fokus fortsetzen"
    static let description = IntentDescription("Setzt deinen pausierten Fokus fort.")

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let model = await AppIntentBridge.shared.readyModel(.profile) else { return .result(dialog: IntentReply.unavailable) }
        guard model.profile?.focus != nil else { return .result(dialog: IntentReply.dialog(L10n.t("intent.noFocus"))) }
        SnapshotStore.update { $0.settingFocusPause(until: nil) }
        WidgetCenter.shared.reloadAllTimelines()
        _ = await AppIntentBridge.shared.resumeFocus()
        return .result(dialog: IntentReply.dialog(L10n.t("intent.focusResumed")))
    }
}

// MARK: - Capture

/// Creates a personal task, or a project task when a project is given. Siri asks for the title; the composer
/// itself is reachable through `OpenCaptureIntent` ("Erfassen öffnen").
struct CaptureTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Aufgabe erfassen"
    static let description = IntentDescription("Legt eine Aufgabe an: persönlich oder in einem Projekt.")
    static var parameterSummary: some ParameterSummary { Summary("Aufgabe \(\.$taskTitle) erfassen in \(\.$project)") }

    @Parameter(title: "Titel", requestValueDialog: "Wie soll die Aufgabe heißen?") var taskTitle: String
    @Parameter(title: "Projekt") var project: ProjectEntity?

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let text = taskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw $taskTitle.needsValueError("Wie soll die Aufgabe heißen?") }
        guard let model = await AppIntentBridge.shared.readyModel(.workspace), let uid = model.uid else {
            // Not ready (cold start, signed out): keep the capture for the app to create.
            if let state = AppIntentBridge.model?.auth.phase, case .signedOut = state { return .result(dialog: IntentReply.unavailable) }
            var captures = SnapshotStore.pendingCaptures()
            captures.append(SnapshotStore.PendingCapture(title: text, note: nil))
            SnapshotStore.setPendingCaptures(captures)
            return .result(dialog: IntentReply.dialog(L10n.t("intent.captured", ["title": text])))
        }
        let name = model.profile?.displayName ?? model.auth.displayName ?? ""
        let created = await AppIntentBridge.shared.bounded {
            if let project {
                let actions = WorkActions(tenantId: project.tenantId, uid: uid, actorName: name)
                try await actions.createTask(projectId: project.projectId, title: text)
            } else if let tenant = model.workspace?.tenantId {
                try await WorkActions(tenantId: tenant, uid: uid, actorName: name).createPersonalTask(title: text, dueDate: nil, priority: nil)
            }
        }
        guard created else { return .result(dialog: IntentReply.dialog(L10n.t("intent.captureFailed"))) }
        SnapshotPublisher.publish(model: model)
        if let project {
            return .result(dialog: IntentReply.dialog(L10n.t("intent.capturedIn", ["project": project.title, "title": text])))
        }
        return .result(dialog: IntentReply.dialog(L10n.t("intent.captured", ["title": text])))
    }
}

// MARK: - What's next

struct WhatsNextIntent: AppIntent {
    static let title: LocalizedStringResource = "Was steht heute an?"
    static let description = IntentDescription("Nennt dir die Headline des Tages und die nächsten Aufgaben.")

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        if let model = await AppIntentBridge.shared.readyModel(.workspace, timeout: 5) { SnapshotPublisher.publish(model: model) }
        guard let snapshot = SnapshotStore.load(), snapshot.signedIn else {
            let reply = IntentReply.unavailable
            return .result(value: L10n.t("intent.notSignedIn"), dialog: reply)
        }
        let text = Self.spokenSummary(snapshot)
        return .result(value: text, dialog: IntentReply.dialog(text))
    }

    /// "Heute ist in 4 Zügen erledigt — der erste brennt. Als Nächstes: A, B und C. Dazu noch 3 weitere."
    @MainActor static func spokenSummary(_ snapshot: TodaySnapshot) -> String {
        guard !snapshot.stops.isEmpty else {
            let headline = snapshot.headline.trimmingCharacters(in: .whitespacesAndNewlines)
            return headline.isEmpty ? L10n.t("intent.whatsNext.empty") : headline
        }
        let formatter = ListFormatter()
        formatter.locale = L10n.locale
        let list = formatter.string(from: snapshot.stops.prefix(3).map(\.title)) ?? ""
        var parts = [snapshot.headline.trimmingCharacters(in: .whitespacesAndNewlines), L10n.t("intent.whatsNext.next", ["list": list])]
        if snapshot.moreCount > 0 { parts.append(L10n.plural("intent.whatsNext.more", snapshot.moreCount)) }
        return parts.filter { !$0.isEmpty }.joined(separator: " ")
    }
}

// MARK: - Ask (in-app AI)

/// "Frag ProjectFlow": opens the app with the question in the ✦ sheet (same `aiAssist` endpoint as in the app).
struct AskProjectFlowIntent: AppIntent {
    static let title: LocalizedStringResource = "Frag ProjectFlow"
    static let description = IntentDescription("Stellt ProjectFlow eine Frage zu deinen Projekten und Aufgaben.")
    static let openAppWhenRun = true

    @Parameter(title: "Frage", requestValueDialog: "Was möchtest du wissen?") var question: String

    @MainActor
    func perform() async throws -> some IntentResult {
        var components = URLComponents(string: "projectflow://ask")!
        components.queryItems = [URLQueryItem(name: "q", value: question)]
        if let url = components.url { await AppIntentBridge.shared.open(url: url) }
        return .result()
    }
}

// MARK: - Open

struct OpenProjectIntent: OpenIntent {
    static let title: LocalizedStringResource = "Projekt öffnen"
    static let description = IntentDescription("Öffnet ein Projekt in ProjectFlow.")
    static let openAppWhenRun = true

    @Parameter(title: "Projekt") var target: ProjectEntity

    @MainActor
    func perform() async throws -> some IntentResult {
        await AppIntentBridge.shared.open(url: target.link)
        return .result()
    }
}

struct OpenTaskIntent: OpenIntent {
    static let title: LocalizedStringResource = "Aufgabe öffnen"
    static let description = IntentDescription("Öffnet eine Aufgabe in ProjectFlow.")
    static let openAppWhenRun = true

    @Parameter(title: "Aufgabe") var target: TaskEntity

    @MainActor
    func perform() async throws -> some IntentResult {
        if let link = target.link { await AppIntentBridge.shared.open(url: link) }
        return .result()
    }
}
