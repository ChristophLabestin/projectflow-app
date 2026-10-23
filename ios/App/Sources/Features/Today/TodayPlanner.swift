import Foundation
import Observation
import PFData
import PFDesign
import PFDomain
import PFModel
import PFSnapshot

/// Builds the day plan from the live workspace data and turns its keys into words.
@MainActor
enum TodayPlanner {
    static func plan(model: AppModel, otherTasks: [WorkTask] = [], now: Date = .now) -> DayPlan? {
        guard let workspace = model.workspace else { return nil }
        let input = DayPlanInput(
            now: now, timeZone: Formatting.timeZone,
            projects: workspace.projects, tasks: workspace.myTasks, personalTasks: workspace.personalTasks,
            otherTasks: otherTasks, focus: model.profile?.focus
        )
        return buildDayPlan(input)
    }

    /// The work item a plan stop stands for (nil for initiatives, which are not tasks).
    static func item(for stop: DayPlanStop, workspace: WorkspaceStore) -> WorkItem? {
        if stop.isPersonal { return workspace.personalTasks.first { $0.id == stop.taskId }.map(WorkItem.personal) }
        if stop.itemType == "initiative" { return nil }
        if let task = workspace.task(stop.taskId) { return .task(task) }
        // A focus on a task that is not assigned to me: show what the plan knows.
        guard let projectId = stop.projectId else { return nil }
        return .task(WorkTask(id: stop.taskId, projectId: projectId, tenantId: stop.tenantId ?? workspace.tenantId, title: stop.title,
                              priority: TaskPriority(raw: stop.priority)))
    }

    /// Open tasks that depend on my open tasks (feeds "löst N" and "Wartet auf dich").
    static func dependencyCandidates(model: AppModel) -> [String] {
        guard let workspace = model.workspace else { return [] }
        let active = Set(workspace.projects.filter(\.isActiveForDayPlan).map(\.id))
        let open = workspace.myTasks.filter { !$0.isCompleted && active.contains($0.projectId) }
        let sorted = open.sorted {
            ($0.dueDate?.instant ?? .distantFuture, $0.id) < ($1.dueDate?.instant ?? .distantFuture, $1.id)
        }
        return Array(sorted.prefix(40).map(\.id))
    }
}

/// Other people's tasks that hang on mine. Loaded once per set of my open tasks (and again when the
/// app returns to the foreground); the widget snapshot reuses the last result.
@Observable
@MainActor
final class TodayWaitingStore {
    static let shared = TodayWaitingStore()

    private(set) var otherTasks: [WorkTask] = []
    private var tenantId = ""
    private var lastKey = ""

    func tasks(for tenantId: String) -> [WorkTask] { self.tenantId == tenantId ? otherTasks : [] }

    func refresh(model: AppModel, force: Bool = false) async {
        guard let workspace = model.workspace else { return }
        let ids = TodayPlanner.dependencyCandidates(model: model)
        let key = workspace.tenantId + "|" + ids.sorted().joined(separator: ",")
        if key == lastKey, !force { return }
        lastKey = key
        let mine = Set(workspace.myTasks.map(\.id))
        let result = await workspace.tasksDepending(on: ids).filter { !mine.contains($0.id) }
        guard model.workspace?.tenantId == workspace.tenantId else { return }
        tenantId = workspace.tenantId
        otherTasks = result
    }
}

/// Plan keys → localised text (web wording, `dashboard.*` keys).
enum TodayText {
    /// Where the web has no singular form we add one (`today.*`).
    private static let singular: [String: String] = [
        "dashboard.band.waiting": "today.band.waiting.one",
        "dashboard.today.insight.momentum": "today.insight.momentum.one",
    ]

    static func message(_ message: DayPlanMessage) -> String {
        guard let key = message.key else { return message.text ?? "" }
        var effective = key
        if message.params["count"] == .int(1), let one = singular[key] { effective = one }
        return L10n.t(effective, message.params)
    }

    /// "Heute ist in {value} Zügen …" split around the emphasised value.
    static func statement(_ statement: DayPlanStatement) -> (before: String, value: String, after: String) {
        let template = L10n.t(statement.key)
        let value = statement.valueKey.map { L10n.t($0) } ?? statement.value ?? ""
        let parts = template.components(separatedBy: "{value}")
        guard parts.count >= 2 else { return (template, "", "") }
        return (parts[0], value, parts.dropFirst().joined(separator: value))
    }

    static func headline(_ plan: DayPlan) -> String {
        let parts = statement(plan.statement)
        return parts.before + parts.value + parts.after
    }

    /// The statement up to its dash ("Heute ist in 4 Zügen erledigt") — the title the headline shrinks into.
    static func compactTitle(_ plan: DayPlan) -> String {
        headline(plan).components(separatedBy: " — ").first ?? headline(plan)
    }

    struct CaptionPart: Identifiable {
        let id: String
        let text: String
        let tone: DayPlanTone
    }

    /// "2 überfällig · 2 heute · der Rest des Tages ist frei" as coloured parts.
    static func caption(_ plan: DayPlan) -> [CaptionPart] {
        var parts = plan.band.caption.map { part in
            CaptionPart(id: part.key.rawValue, text: message(DayPlanMessage(key: "dashboard.band.\(part.key.rawValue)", params: ["count": .int(part.count)])), tone: part.tone)
        }
        parts.append(CaptionPart(id: "free", text: L10n.t(plan.band.caption.isEmpty ? "dashboard.band.allFree" : "dashboard.band.free"), tone: .neutral))
        return parts
    }

    static func summary(_ plan: DayPlan) -> String { caption(plan).map(\.text).joined(separator: " · ") }

    /// Row subtitle: reason · frees up N · project.
    static func subtitle(_ stop: DayPlanStop) -> String {
        var parts = [message(stop.reason)]
        if stop.unblocksCount > 0 { parts.append(L10n.t("today.unblocks", ["count": stop.unblocksCount])) }
        if stop.isPersonal { parts.append(L10n.t("common.personal")) } else if !stop.projectName.isEmpty { parts.append(stop.projectName) }
        return parts.joined(separator: " · ")
    }

    /// Follow-ups are shown as "Nachhaken: Titel".
    static func title(_ stop: DayPlanStop) -> String {
        stop.kind == .followUp ? L10n.t("dashboard.route.followUp", ["title": stop.title]) : stop.title
    }
}

// MARK: - Widget / Live Activity snapshot

@MainActor
enum TodaySnapshotBuilder {
    static func build(model: AppModel) -> TodaySnapshot? {
        guard let workspace = model.workspace, workspace.isReady else { return nil }
        guard let plan = TodayPlanner.plan(model: model, otherTasks: TodayWaitingStore.shared.tasks(for: workspace.tenantId)) else { return nil }

        let band = plan.band.segments.map { segment -> String in
            switch segment.type {
            case .overdue: "overdue"
            case .due: "due"
            case .waiting: "waiting"
            case .rest: "free"
            }
        }
        let stops = plan.stops.map { stop in
            TodaySnapshot.Stop(
                id: stop.taskId, title: TodayText.title(stop), subtitle: TodayText.subtitle(stop), severity: severity(stop.kind),
                tenantId: stop.tenantId ?? workspace.tenantId, projectId: stop.projectId, isPersonal: stop.isPersonal
            )
        }
        var focus: TodaySnapshot.Focus?
        if let state = model.profile?.focus {
            focus = TodaySnapshot.Focus(
                itemId: state.itemId, itemType: state.itemType.rawValue, title: state.title,
                projectName: workspace.project(state.projectId)?.title, nextStep: workspace.task(state.itemId)?.nextStep,
                status: state.status.rawValue, startedAt: state.startedAt?.instant, tenantId: state.tenantId, projectId: state.projectId
            )
        }
        return TodaySnapshot(
            workspaceName: model.session?.activeWorkspace?.name ?? "", headline: TodayText.headline(plan), summary: TodayText.summary(plan),
            band: band, overdueCount: plan.counts.overdue, dueTodayCount: plan.counts.queue - plan.counts.overdue,
            stops: stops, moreCount: plan.moreCount, focus: focus
        )
    }

    private static func severity(_ kind: DayPlanStopKind) -> String {
        switch kind {
        case .overdue: "overdue"
        case .dueToday: "due"
        case .scheduled, .focus: "scheduled"
        case .followUp: "blocked"
        case .suggestion: "suggested"
        }
    }
}
