import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

/// "Smart verteilen": spreads my open tasks over the next working days (port of the web scheduler).
/// The sheet shows what would move and lets me untick single tasks before anything is written.
enum SmartSchedule {
    @MainActor
    static func present(model: AppModel) {
        model.presenter.present(detents: [.large]) { SmartScheduleSheet() }
    }
}

struct SmartScheduleSheet: View {
    /// A task the scheduler may move, with what is needed to write it back.
    private struct Entry {
        let title: String
        let context: String?
        let ref: TaskRef?
        let personalId: String?
        let previous: FlexDate?
        let isTeam: Bool
    }

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var isLoading = true
    @State private var own: [SchedulerItem] = []
    @State private var team: [SchedulerItem] = []
    @State private var entries: [String: Entry] = [:]
    @State private var maxPerDay = 5
    @State private var includeWeekends = false
    @State private var excluded: Set<String> = []
    @State private var isApplying = false

    private var today: String { ZonedDate.toDay(DateLike(Date()), in: Formatting.timeZone) ?? "" }

    private var proposals: [ProposedSchedule] {
        Scheduler.distribute(items: own, teamItems: team, today: today,
                             preferences: SchedulerPreferences(maxItemsPerDay: maxPerDay, includeWeekends: includeWeekends))
    }

    var body: some View {
        let proposals = proposals
        let chosen = proposals.filter { !excluded.contains($0.taskId) }
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFSheetHeader(L10n.t("work.smart.eyebrow"), title: L10n.t("work.smart.title"))
            controls
            if isLoading {
                VStack(spacing: PFSpace.xs) {
                    ForEach(0..<4, id: \.self) { _ in PFSkeleton(height: 54, radius: PFRadius.card) }
                }
                .padding(.horizontal, PFSpace.page)
                .frame(maxHeight: .infinity, alignment: .top)
            } else if proposals.isEmpty {
                PFEmptyState(systemImage: "checkmark.seal", title: L10n.t("work.smart.optimal.title"), message: L10n.t("work.smart.optimal.message"))
                    .frame(maxHeight: .infinity)
            } else {
                Text(L10n.plural("work.smart.summary", proposals.count))
                    .pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                    .padding(.horizontal, PFSpace.page)
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(Array(proposals.enumerated()), id: \.element.id) { index, proposal in
                            if index > 0 { PFRowDivider(leadingInset: 52) }
                            row(proposal)
                        }
                    }
                    .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                    .padding(.horizontal, PFSpace.m)
                }
                .scrollIndicators(.hidden)
                PFButton(L10n.plural("work.smart.apply", chosen.count), systemImage: "wand.and.stars", fullWidth: true) { apply(chosen) }
                    .disabled(chosen.isEmpty || isApplying)
                    .opacity(chosen.isEmpty ? 0.45 : 1)
                    .padding(.horizontal, PFSpace.page)
            }
        }
        .padding(.bottom, PFSpace.l)
        .task { await load() }
        .onChange(of: maxPerDay) { _, _ in excluded = [] }
        .onChange(of: includeWeekends) { _, _ in excluded = [] }
    }

    // MARK: Controls

    private var controls: some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            PlanningField(label: L10n.t("work.smart.perDay")) {
                PFSegmented([(value: 3, label: "3"), (value: 5, label: "5"), (value: 8, label: "8")], selection: $maxPerDay)
            }
            PFSwitch(L10n.t("work.smart.weekends"), isOn: $includeWeekends)
        }
        .padding(.horizontal, PFSpace.page)
    }

    private func row(_ proposal: ProposedSchedule) -> some View {
        let entry = entries[proposal.taskId]
        let isOn = !excluded.contains(proposal.taskId)
        let from = proposal.originalDay.map { DayString.shortDate($0) } ?? L10n.t("work.smart.unplanned")
        return Button {
            PFHaptics.selection()
            if isOn { excluded.insert(proposal.taskId) } else { excluded.remove(proposal.taskId) }
        } label: {
            HStack(spacing: PFSpace.s) {
                Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(isOn ? PFColor.success : PFColor.textSubtle)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(entry?.title ?? proposal.taskId).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(2)
                    HStack(spacing: 5) {
                        Text(from)
                        Image(systemName: "arrow.right").font(.system(size: 9, weight: .bold))
                        Text(DayString.shortDate(proposal.newDay)).foregroundStyle(PFColor.textMain)
                        if let context = entry?.context { Text("· \(context)").lineLimit(1) }
                    }
                    .pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
                Spacer(minLength: 0)
                if proposal.reason == .overdue { PFPill(L10n.t("work.smart.overdue"), tone: .severity(.overdue), compact: true) }
            }
            .padding(.horizontal, PFSpace.m)
            .padding(.vertical, 10)
            .frame(minHeight: 56)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: Data

    private func load() async {
        guard let workspace = model.workspace, let planning = model.planning else { isLoading = false; return }
        let zone = Formatting.timeZone
        var items: [SchedulerItem] = []
        var map: [String: Entry] = [:]
        for task in workspace.myTasks where !task.isCompleted {
            if let project = workspace.project(task.projectId), project.status.lifecycle == .closed { continue }
            items.append(SchedulerItem(task: task, zone: zone))
            map[task.id] = Entry(title: task.title, context: workspace.project(task.projectId)?.title, ref: task.ref, personalId: nil,
                                 previous: task.scheduledDate, isTeam: false)
        }
        for task in workspace.personalTasks where !task.isCompleted {
            let scheduled = DateLike(task.scheduledDate)
            let id = "personal:\(task.id)"
            items.append(SchedulerItem(id: id, title: task.title, day: ZonedDate.toDay(scheduled.isTruthy ? scheduled : DateLike(task.dueDate), in: zone),
                                       priority: task.priority, assigneeIds: [workspace.uid]))
            map[id] = Entry(title: task.title, context: L10n.t("common.personal"), ref: nil, personalId: task.id, previous: task.scheduledDate, isTeam: false)
        }
        own = items
        entries = map
        isLoading = false

        // Co-assignees' tasks take capacity too (web: global optimisation); they arrive a moment later.
        let mine = Set(items.map(\.id))
        let coAssignees = Set(workspace.myTasks.flatMap(\.effectiveAssignees)).subtracting([workspace.uid])
        guard !coAssignees.isEmpty else { return }
        let others = await planning.teamTasks(of: Array(coAssignees)).filter { !mine.contains($0.id) }
        var teamItems: [SchedulerItem] = []
        for task in others {
            teamItems.append(SchedulerItem(task: task, zone: zone))
            let names = task.effectiveAssignees.filter { $0 != workspace.uid }.compactMap { workspace.person($0)?.displayName }.joined(separator: ", ")
            entries[task.id] = Entry(title: task.title, context: names.isEmpty ? nil : names, ref: task.ref, personalId: nil,
                                     previous: task.scheduledDate, isTeam: true)
        }
        team = teamItems
    }

    private func apply(_ chosen: [ProposedSchedule]) {
        guard let actions = model.planning, !isApplying else { return }
        isApplying = true
        var changes: [(ref: TaskRef?, personalId: String?, day: FlexDate?, assignToMe: Bool)] = []
        var undo: [(ref: TaskRef?, personalId: String?, day: FlexDate?, assignToMe: Bool)] = []
        for proposal in chosen {
            guard let entry = entries[proposal.taskId], let day = DayString.flexDate(proposal.newDay) else { continue }
            changes.append((entry.ref, entry.personalId, day, false))
            undo.append((entry.ref, entry.personalId, entry.previous, false))
        }
        let applied = changes
        let restore = undo
        Task {
            let ok = await model.perform { try await actions.applySchedule(applied) }
            isApplying = false
            guard ok else { return }
            PFHaptics.success()
            presenter.dismiss()
            model.toasts.show(PFToast(L10n.plural("work.smart.done", applied.count), style: .success, actionTitle: L10n.t("common.undo")) {
                Task { _ = await model.perform { try await actions.applySchedule(restore) } }
            })
        }
    }
}
