import SwiftUI
import UIKit
import PFData
import PFDesign
import PFDomain
import PFModel

// Shared helpers of the Projects and TaskDetail features: permissions, web links, grouping,
// summary line and small formatting helpers.

/// What the signed-in user may do in a project (concept §6: actions without the right do not appear).
struct ProjectAccess {
    let uid: String?
    let workspaceRole: WorkspaceRole
    let projectRole: String?
    let isOwner: Bool

    init(model: AppModel, project: Project?) {
        uid = model.uid
        workspaceRole = model.session?.role ?? .member
        if let project, let uid = model.uid {
            isOwner = project.ownerId == uid
            projectRole = project.members.first { $0.userId == uid }?.role ?? (project.ownerId == uid ? "Owner" : nil)
        } else {
            isOwner = false
            projectRole = nil
        }
    }

    var isViewer: Bool { projectRole == "Viewer" }
    var isAdmin: Bool { workspaceRole == .owner || workspaceRole == .admin }
    /// Create/edit/complete/delete tasks and subtasks. Viewers only read and comment.
    var canEditTasks: Bool { !isViewer }
    /// Create initiatives and projects, change project structure.
    var canManage: Bool { workspaceRole.isFullMember && !isViewer }
    static func canCreateProjects(_ role: WorkspaceRole) -> Bool { role.isFullMember }
}

/// Web deep links (contract C8) used by "copy link", share and "open in web".
enum ProjectLinks {
    static let base = "https://app.getprojectflow.com"

    static func project(_ id: String) -> URL { URL(string: "\(base)/project/\(id)")! }
    static func projectSettings(_ id: String) -> URL { URL(string: "\(base)/project/\(id)/details")! }
    static func task(_ ref: TaskRef) -> URL { URL(string: "\(base)/project/\(ref.projectId)/tasks/\(ref.taskId)")! }
    static func initiative(projectId: String, id: String) -> URL { URL(string: "\(base)/project/\(projectId)/initiatives/\(id)")! }
}

@MainActor
enum ProjectsClipboard {
    static func copy(_ url: URL, model: AppModel) {
        UIPasteboard.general.url = url
        PFHaptics.success()
        model.toasts.show(PFToast(L10n.t("common.linkCopied"), style: .success))
    }

    static func open(_ url: URL) {
        UIApplication.shared.open(url)
    }
}

// MARK: - Grouping

enum TaskGrouping: String, CaseIterable, Hashable {
    case due, status, priority, initiative, assignee

    var label: String { L10n.t("projects.group.\(rawValue)") }

    var symbol: String {
        switch self {
        case .due: "calendar"
        case .status: "circle.dotted"
        case .priority: "chart.bar"
        case .initiative: "flag"
        case .assignee: "person.2"
        }
    }
}

struct TaskBucket: Identifiable {
    let id: String
    let title: String
    let dot: Color
    let tasks: [WorkTask]
    var startsCollapsed = false
}

enum TaskGrouper {
    /// Open tasks grouped by `grouping`; completed tasks always form a trailing, collapsed "Erledigt" group.
    @MainActor
    static func groups(_ tasks: [WorkTask], by grouping: TaskGrouping, initiatives: [Initiative], people: [String: Person],
                       uid: String?) -> [TaskBucket] {
        let open = tasks.filter { !$0.isCompleted }
        let done = tasks.filter(\.isCompleted)
        var groups: [TaskBucket] = []

        switch grouping {
        case .due:
            let buckets: [(id: String, title: String, dot: Color, match: (Int?) -> Bool)] = [
                ("overdue", L10n.t("projects.due.overdue"), PFColor.danger, { ($0 ?? 0) < 0 && $0 != nil }),
                ("today", L10n.t("projects.due.today"), PFColor.warning, { $0 == 0 }),
                ("week", L10n.t("projects.due.week"), PFColor.statusBase(.open), { ($0 ?? 0) >= 1 && ($0 ?? 0) <= 7 }),
                ("later", L10n.t("projects.due.later"), PFColor.textSubtle, { ($0 ?? 0) > 7 }),
                ("none", L10n.t("projects.due.none"), PFColor.hairlineStrong, { $0 == nil }),
            ]
            for bucket in buckets {
                let members = open.filter { bucket.match($0.dueDate.map { Formatting.dayOffset($0) }) }
                    .sorted { ($0.dueDate?.instant ?? .distantFuture) < ($1.dueDate?.instant ?? .distantFuture) }
                if !members.isEmpty { groups.append(TaskBucket(id: bucket.id, title: bucket.title, dot: bucket.dot, tasks: members)) }
            }
        case .status:
            for status in TaskStatus.workflow where status != .done {
                let members = open.filter { $0.status == status }
                if !members.isEmpty {
                    groups.append(TaskBucket(id: status.rawValue, title: status.label, dot: PFColor.statusBase(status.tone), tasks: members))
                }
            }
        case .priority:
            let order: [TaskPriority?] = [.urgent, .high, .medium, .low, nil]
            for priority in order {
                let members = open.filter { $0.priority == priority }
                if !members.isEmpty {
                    groups.append(TaskBucket(id: priority?.rawValue ?? "none", title: priority?.label ?? L10n.t("priority.none"),
                                            dot: priority.map(PFColor.priority) ?? PFColor.hairlineStrong, tasks: members))
                }
            }
        case .initiative:
            for initiative in initiatives {
                let members = open.filter { $0.initiativeId == initiative.id }
                if !members.isEmpty {
                    groups.append(TaskBucket(id: initiative.id, title: initiative.title, dot: PFColor.hex(initiative.color) ?? PFColor.statusBase(initiative.tone), tasks: members))
                }
            }
            let rest = open.filter { task in task.initiativeId == nil || !initiatives.contains { $0.id == task.initiativeId } }
            if !rest.isEmpty { groups.append(TaskBucket(id: "none", title: L10n.t("projects.group.noInitiative"), dot: PFColor.hairlineStrong, tasks: rest)) }
        case .assignee:
            var byPerson: [String: [WorkTask]] = [:]
            var unassigned: [WorkTask] = []
            for task in open {
                let first = task.effectiveAssignees.first
                if let first { byPerson[first, default: []].append(task) } else { unassigned.append(task) }
            }
            let ordered = byPerson.keys.sorted { lhs, rhs in
                if lhs == uid { return true }
                if rhs == uid { return false }
                return (people[lhs]?.displayName ?? lhs).localizedCaseInsensitiveCompare(people[rhs]?.displayName ?? rhs) == .orderedAscending
            }
            for id in ordered {
                let name = id == uid ? L10n.t("projects.group.me") : (people[id]?.displayName ?? "—")
                groups.append(TaskBucket(id: id, title: name, dot: PFColor.avatar(seed: id), tasks: byPerson[id] ?? []))
            }
            if !unassigned.isEmpty { groups.append(TaskBucket(id: "none", title: L10n.t("projects.group.unassigned"), dot: PFColor.hairlineStrong, tasks: unassigned)) }
        }

        if !done.isEmpty {
            let sorted = done.sorted { ($0.completedAt?.instant ?? .distantPast) > ($1.completedAt?.instant ?? .distantPast) }
            groups.append(TaskBucket(id: "done", title: L10n.t("projects.group.done"), dot: PFColor.success, tasks: sorted, startsCollapsed: true))
        }
        return groups
    }
}

// MARK: - Summary line

struct ProjectSummary {
    var open = 0
    var overdue = 0
    var soon = 0
    var blocked = 0
    var done = 0
    var total = 0

    init(tasks: [WorkTask]) {
        total = tasks.count
        for task in tasks {
            if task.isCompleted { done += 1; continue }
            open += 1
            if task.status == .blocked { blocked += 1 }
            guard let due = task.dueDate else { continue }
            let offset = Formatting.dayOffset(due)
            if offset < 0 { overdue += 1 } else if offset <= 3 { soon += 1 }
        }
    }

    var progress: Double { total == 0 ? 0 : Double(done) / Double(total) }

    /// "4 offen · 1 überfällig · 1 bald fällig" with the overdue part tinted.
    @MainActor
    var text: Text {
        guard total > 0 else { return Text(L10n.t("projects.summary.empty")).foregroundStyle(PFColor.textMuted) }
        guard open > 0 else { return Text(L10n.t("projects.summary.allDone")).foregroundStyle(PFColor.successText) }
        var result = Text(L10n.plural("projects.summary.open", open)).foregroundStyle(PFColor.textMuted)
        let separator = Text(" · ").foregroundStyle(PFColor.textMuted)
        if overdue > 0 { result = result + separator + Text(L10n.plural("projects.summary.overdue", overdue)).foregroundStyle(PFColor.dangerText) }
        if blocked > 0 { result = result + separator + Text(L10n.plural("projects.summary.blocked", blocked)).foregroundStyle(PFColor.dangerText) }
        if soon > 0 { result = result + separator + Text(L10n.plural("projects.summary.soon", soon)).foregroundStyle(PFColor.warningText) }
        return result
    }
}

// MARK: - Small helpers

extension InitiativeHealth {
    var label: String { L10n.t("projects.health.\(rawValue)") }

    var tone: PFPill.Tone {
        switch self {
        case .onTrack: .status(.done)
        case .atRisk: .status(.review)
        case .offTrack: .status(.blocked)
        }
    }

    var dot: Color {
        switch self {
        case .onTrack: PFColor.success
        case .atRisk: PFColor.warning
        case .offTrack: PFColor.danger
        }
    }
}

extension Initiative {
    var statusLabel: String { statusRaw == "Planning" ? L10n.t("status.Planning") : TaskStatus(raw: statusRaw).label }
}

extension ProjectStatus {
    var label: String { L10n.t("projects.portfolio.status.\(rawValue)") }
}

extension Milestone {
    var isAchieved: Bool { statusRaw == "Achieved" || statusRaw == "Completed" }
}

enum ProjectsFormat {
    static func percent(_ value: Double) -> String { "\(Int((value * 100).rounded())) %" }

    static func person(_ id: String?, model: AppModel) -> Person? { model.workspace?.person(id) }
}

/// Native share sheet, wrapped as a custom glass circle (system integration, not a UI control).
struct ShareGlassButton: View {
    let url: URL
    let label: String

    var body: some View {
        ShareLink(item: url) {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(PFColor.textMain)
                .frame(width: 44, height: 44)
                .pfGlass(in: .circle)
                .contentShape(.circle)
        }
        .buttonStyle(.pfPressable)
        .accessibilityLabel(label)
    }
}

/// Confirmation sheet for destructive actions (concept §6: confirmation only for deleting).
struct ProjectConfirmSheet: View {
    let title: String
    let message: String
    let confirmTitle: String
    let onConfirm: () -> Void
    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title).pfText(.title).foregroundStyle(PFColor.textMain)
                Text(message).pfText(.body).foregroundStyle(PFColor.textMuted)
            }
            .padding(.horizontal, PFSpace.page)
            HStack(spacing: PFSpace.s) {
                PFButton(L10n.t("common.cancel"), kind: .ghost, fullWidth: true) { presenter.dismiss() }
                PFButton(confirmTitle, kind: .danger, fullWidth: true) {
                    presenter.dismiss()
                    onConfirm()
                }
            }
            .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
    }
}

/// Action list sheet (the `•••` menus): icon + title rows, destructive rows in red.
struct ActionSheet: View {
    struct Item: Identifiable {
        let id = UUID()
        let title: String
        let systemImage: String
        var destructive = false
        let action: () -> Void
    }

    let title: String?
    let items: [Item]
    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            if let title { PFEyebrow(title).padding(.horizontal, PFSpace.page) }
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    if index > 0 { PFRowDivider(leadingInset: 54) }
                    Button {
                        presenter.dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { item.action() }
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: item.systemImage).font(.system(size: 16, weight: .medium)).frame(width: 24)
                            Text(item.title).pfText(.rowTitle)
                            Spacer()
                        }
                        .foregroundStyle(item.destructive ? PFColor.dangerText : PFColor.textMain)
                        .padding(.horizontal, PFSpace.m)
                        .frame(minHeight: 54)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
            .background(PFColor.raisedSoft, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
    }
}
