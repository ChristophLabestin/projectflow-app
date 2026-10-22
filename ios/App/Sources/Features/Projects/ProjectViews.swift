import SwiftUI
import PFDesign
import PFModel

// MARK: - List

/// Grouped task list of a project or initiative. Every row is the shared `WorkItemRow`
/// (ring check, swipe grammar, peek), so the same gesture means the same thing everywhere.
struct ProjectTaskList: View {
    let tasks: [WorkTask]
    let grouping: TaskGrouping
    let initiatives: [Initiative]
    @Environment(AppModel.self) private var model
    @State private var collapsed: Set<String> = ["done"]

    var body: some View {
        let groups = TaskGrouper.groups(tasks, by: grouping, initiatives: initiatives, people: model.workspace?.people ?? [:], uid: model.uid)
        VStack(alignment: .leading, spacing: 0) {
            ForEach(groups) { group in
                let isCollapsed = collapsed.contains(group.id)
                GroupHeader(title: group.title, color: group.dot, count: group.tasks.count, collapsed: isCollapsed) {
                    withAnimation(PFMotion.respecting(PFMotion.snappy)) {
                        if isCollapsed { collapsed.remove(group.id) } else { collapsed.insert(group.id) }
                    }
                }
                .padding(.horizontal, PFSpace.page)
                if !isCollapsed {
                    VStack(spacing: 0) {
                        ForEach(Array(group.tasks.enumerated()), id: \.element.id) { index, task in
                            if index > 0 { PFRowDivider(leadingInset: 46) }
                            WorkItemRow(item: .task(task), showsProject: false)
                        }
                    }
                    .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
                    .pfCard()
                    .padding(.horizontal, PFSpace.page)
                    .transition(.opacity)
                }
            }
        }
        .animation(PFMotion.respecting(PFMotion.snappy), value: groups.map(\.id))
    }
}

// MARK: - Board

/// Status board (85 % lanes, long-press drag between lanes sets the status). Backlog and On Hold only
/// show up when they hold tasks; use the status sheet for those.
struct ProjectBoardView: View {
    let tasks: [WorkTask]
    let canMove: Bool
    let emptyText: String
    @Environment(AppModel.self) private var model

    private var statuses: [TaskStatus] {
        TaskStatus.workflow.filter { status in
            switch status {
            case .backlog, .onHold: tasks.contains { $0.status == status }
            default: true
            }
        }
    }

    var body: some View {
        let columns = statuses.map {
            PFBoardColumn(id: $0.rawValue, title: $0.label, dot: PFColor.statusBase($0.tone), tint: PFColor.statusText($0.tone))
        }
        let items = Dictionary(grouping: tasks, by: { $0.status.rawValue })
            .mapValues { $0.sorted(by: Self.order) }
        PFBoard(columns: columns, items: items, emptyText: emptyText, canMove: canMove) { task in
            BoardTaskCard(task: task)
        } onMove: { task, columnId in
            guard let status = TaskStatus(rawValue: columnId) else { return }
            move(task, to: status)
        }
    }

    /// Urgent first, then due date, then title.
    private static func order(_ a: WorkTask, _ b: WorkTask) -> Bool {
        let pa = a.priority?.rank ?? -1, pb = b.priority?.rank ?? -1
        if pa != pb { return pa > pb }
        let da = a.dueDate?.instant ?? .distantFuture, db = b.dueDate?.instant ?? .distantFuture
        if da != db { return da < db }
        return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedAscending
    }

    private func move(_ task: WorkTask, to status: TaskStatus) {
        let actions = WorkItemActions(model: model)
        let previous = task.status
        Task {
            await actions.setStatus(.task(task), status)
            model.toasts.show(PFToast(L10n.t("projects.board.moved", ["status": status.label]), actionTitle: L10n.t("common.undo")) {
                Task { await actions.setStatus(.task(task), previous) }
            })
        }
    }
}

struct BoardTaskCard: View {
    let task: WorkTask
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(task.title)
                .pfText(.rowTitle)
                .foregroundStyle(task.isCompleted ? PFColor.textMuted : PFColor.textMain)
                .strikethrough(task.isCompleted, color: PFColor.textMuted)
                .multilineTextAlignment(.leading)
                .lineLimit(3)
            HStack(spacing: 8) {
                if let due = Formatting.dueText(task.dueDate) {
                    Text(due).pfText(.metaStrong).foregroundStyle(PFColor.severityText(task.isCompleted ? .neutral : Formatting.severity(due: task.dueDate))).lineLimit(1)
                }
                Spacer(minLength: 0)
                PFPrioritySignal(task.priority)
                if let workspace = model.workspace {
                    let people = task.effectiveAssignees.compactMap { workspace.person($0) }
                    if !people.isEmpty {
                        PFAvatarStack(people: people.map { ($0.id, $0.displayName, $0.photoURL) }, size: 22, limit: 2)
                    }
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard(radius: 14)
        .contentShape(.rect)
        .onTapGesture { model.router.push(.task(task.ref)) }
        .accessibilityAddTraits(.isButton)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Milestones

struct MilestonesView: View {
    let milestones: [Milestone]
    let tasks: [WorkTask]

    var body: some View {
        if milestones.isEmpty {
            PFEmptyState(systemImage: "flag", title: L10n.t("projects.milestones.empty"), message: L10n.t("projects.milestones.emptyHint"))
                .padding(.horizontal, PFSpace.page)
        } else {
            let nextId = milestones.first { !$0.isAchieved && $0.dueDate != nil }?.id
            VStack(spacing: 0) {
                ForEach(Array(milestones.enumerated()), id: \.element.id) { index, milestone in
                    if index > 0 { PFRowDivider() }
                    row(milestone, isNext: milestone.id == nextId)
                }
            }
            .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
            .pfCard()
            .padding(.horizontal, PFSpace.page)
        }
    }

    private func row(_ milestone: Milestone, isNext: Bool) -> some View {
        let linked = tasks.filter { milestone.linkedTaskIds.contains($0.id) }
        let done = linked.filter(\.isCompleted).count
        let severity = Formatting.severity(due: milestone.dueDate, isDone: milestone.isAchieved)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: PFSpace.xs) {
                Image(systemName: milestone.isAchieved ? "checkmark.circle.fill" : "flag")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(milestone.isAchieved ? PFColor.success : PFColor.textMuted)
                Text(milestone.title)
                    .pfText(.rowTitle)
                    .foregroundStyle(milestone.isAchieved ? PFColor.textMuted : PFColor.textMain)
                    .strikethrough(milestone.isAchieved, color: PFColor.textMuted)
                Spacer(minLength: 0)
                if isNext { PFPill(L10n.t("projects.milestones.next"), tone: .neutral, compact: true) }
            }
            HStack(spacing: 8) {
                if let due = milestone.dueDate {
                    Text(Formatting.dueText(due).map { milestone.isAchieved ? Formatting.shortDate(due) : $0 } ?? Formatting.shortDate(due))
                        .pfText(.metaStrong)
                        .foregroundStyle(PFColor.severityText(severity))
                }
                if let risk = milestone.riskRating, risk != "Low", !milestone.isAchieved {
                    PFPill(L10n.t("projects.milestones.risk.\(risk)"), tone: .custom(risk == "High" ? PFColor.dangerText : PFColor.warningText), compact: true)
                }
                Spacer(minLength: 0)
                if !linked.isEmpty {
                    Text("\(done)/\(linked.count)").pfText(.number).foregroundStyle(PFColor.textMuted)
                }
            }
            if !linked.isEmpty { PFProgressBar(value: Double(done) / Double(linked.count), height: 4) }
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Activity

struct ActivityFeedView: View {
    let entries: [ActivityEntry]

    var body: some View {
        if entries.isEmpty {
            PFEmptyState(systemImage: "clock.arrow.circlepath", title: L10n.t("projects.activity.empty"), message: L10n.t("projects.activity.emptyHint"))
                .padding(.horizontal, PFSpace.page)
        } else {
            VStack(spacing: 0) {
                ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                    if index > 0 { PFRowDivider(leadingInset: 56) }
                    ActivityRow(entry: entry)
                }
            }
            .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
            .pfCard()
            .padding(.horizontal, PFSpace.page)
        }
    }
}

struct ActivityRow: View {
    let entry: ActivityEntry

    var body: some View {
        HStack(alignment: .top, spacing: PFSpace.s) {
            PFAvatar(name: entry.user, imageURL: entry.userAvatar, size: 30)
            VStack(alignment: .leading, spacing: 3) {
                (Text(entry.user).foregroundStyle(PFColor.textMain).fontWeight(.semibold)
                    + Text(" " + entry.action).foregroundStyle(PFColor.textMuted)
                    + (entry.target.isEmpty ? Text("") : Text(" " + entry.target).foregroundStyle(PFColor.textMain)))
                    .pfText(.body)
                    .fixedSize(horizontal: false, vertical: true)
                if let date = entry.createdAt?.instant {
                    Text(Formatting.relative(date)).pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(PFSpace.m)
        .accessibilityElement(children: .combine)
    }
}
