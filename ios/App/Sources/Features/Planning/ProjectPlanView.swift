import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

/// The project "Plan" tab: milestones on a timeline, the sprint rhythm (active, upcoming, backlog) and
/// the initiatives with their progress. It lives inside the project's scroll view, so it has none of its own.
struct ProjectPlanView: View {
    let store: ProjectStore
    let canEdit: Bool
    /// Visible sections in display order ("milestones", "sprints", "initiatives"), from the project navigation.
    var sections = ["milestones", "sprints", "initiatives"]
    /// Opens the project's sprint board (provided by the project screen).
    var onOpenBoard: (() -> Void)?

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var expandedSprints: Set<String> = []
    @State private var showAllBacklog = false

    private var snapshot: PlanningSnapshot {
        PlanningSnapshot(tasks: store.tasks, milestones: store.milestones, sprints: store.sprints, initiatives: store.initiatives, now: .now)
    }

    var body: some View {
        let snapshot = snapshot
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            ForEach(sections, id: \.self) { section in
                switch section {
                case "milestones": milestonesSection(snapshot)
                case "sprints": sprintsSection(snapshot)
                case "initiatives": initiativesSection(snapshot)
                default: EmptyView()
                }
            }
        }
        .padding(.top, PFSpace.xs)
    }

    // MARK: Section chrome

    private func sectionHeader(_ title: String, subtitle: String?, addLabel: String, add: @escaping () -> Void) -> some View {
        HStack(alignment: .center, spacing: PFSpace.s) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).pfText(.section).foregroundStyle(PFColor.textMain).accessibilityAddTraits(.isHeader)
                if let subtitle { Text(subtitle).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1) }
            }
            Spacer(minLength: 0)
            if canEdit { PFIconButton("plus", label: addLabel, style: .raised, size: 38, action: add) }
        }
        .padding(.horizontal, PFSpace.page)
    }

    // MARK: Milestones

    private func milestonesSection(_ snapshot: PlanningSnapshot) -> some View {
        let open = snapshot.milestones.filter { snapshot.state(of: $0) != .achieved }.count
        return VStack(alignment: .leading, spacing: PFSpace.s) {
            sectionHeader(L10n.t("planning.milestones.title"),
                          subtitle: snapshot.milestones.isEmpty ? nil : L10n.t("planning.milestones.summary", ["open": open, "total": snapshot.milestones.count]),
                          addLabel: L10n.t("planning.milestone.new.title"), add: { presentMilestoneEditor(nil) })
            if snapshot.milestones.isEmpty {
                createCard(symbol: "flag", title: L10n.t("planning.milestones.empty.title"), message: L10n.t("planning.milestones.empty.message"),
                           action: L10n.t("planning.milestone.new.title")) { presentMilestoneEditor(nil) }
            } else {
                PlanningTimeline(entries: snapshot.timeline) { id in
                    if let milestone = store.milestones.first(where: { $0.id == id }) { presentMilestone(milestone) }
                }
            }
        }
    }

    private func createCard(symbol: String, title: String, message: String, action: String, perform: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            Image(systemName: symbol).font(.system(size: 18, weight: .medium)).foregroundStyle(PFColor.textMuted)
                .frame(width: 40, height: 40).background(PFColor.raised, in: .circle)
                .accessibilityHidden(true)
            Text(title).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
            Text(message).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            if canEdit { PFButton(action, systemImage: "plus", kind: .secondary, size: .small, action: perform).padding(.top, 2) }
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
        .padding(.horizontal, PFSpace.page)
    }

    private func presentMilestone(_ milestone: Milestone) {
        let store = store
        let canEdit = canEdit
        presenter.present(detents: [.fraction(0.62), .large]) {
            MilestoneDetailSheet(projectId: store.projectId, milestoneId: milestone.id, store: store, canEdit: canEdit)
        }
    }

    private func presentMilestoneEditor(_ milestone: Milestone?) {
        presenter.present(detents: [.large]) {
            MilestoneEditorSheet(projectId: store.projectId, milestone: milestone, tasks: store.tasks, initiatives: store.initiatives)
        }
    }

    // MARK: Sprints

    private func sprintsSection(_ snapshot: PlanningSnapshot) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            sectionHeader(L10n.t("planning.sprints.title"),
                          subtitle: snapshot.completedSprints.isEmpty ? nil : L10n.plural("planning.sprints.completedCount", snapshot.completedSprints.count),
                          addLabel: L10n.t("planning.sprint.new.title"), add: { presentSprintEditor(nil) })
            if snapshot.sprints.isEmpty {
                createCard(symbol: "bolt", title: L10n.t("planning.sprints.empty.title"), message: L10n.t("planning.sprints.empty.message"),
                           action: L10n.t("planning.sprint.new.title")) { presentSprintEditor(nil) }
            }
            if let active = snapshot.activeSprint { activeCard(active, snapshot) }
            ForEach(snapshot.plannedSprints) { sprint in plannedCard(sprint, snapshot) }
            if !snapshot.sprints.isEmpty || !snapshot.backlog.isEmpty { backlogCard(snapshot) }
        }
    }

    private func activeCard(_ sprint: Sprint, _ snapshot: PlanningSnapshot) -> some View {
        let progress = snapshot.progress(of: sprint)
        let fraction = progress.total == 0 ? 0 : Double(progress.done) / Double(progress.total)
        return VStack(alignment: .leading, spacing: PFSpace.s) {
            HStack(spacing: 6) {
                PFPill(L10n.t("planning.sprint.status.Active"), tone: .status(.inProgress), compact: true)
                if let countdown = snapshot.sprintCountdown(sprint) {
                    Text(countdown).pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                }
                Spacer(minLength: 0)
                if canEdit {
                    PFIconButton("pencil", label: L10n.t("common.edit"), style: .raised, size: 34) { presentSprintEditor(sprint) }
                }
            }
            Text(sprint.name).pfText(.title).foregroundStyle(PFColor.textMain).fixedSize(horizontal: false, vertical: true)
            if let goal = sprint.goal, !goal.isEmpty {
                Text(goal).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            }
            if let range = snapshot.sprintRange(sprint) { Text(range).pfText(.meta).foregroundStyle(PFColor.textMuted) }
            VStack(alignment: .leading, spacing: 6) {
                PFProgressBar(value: fraction, height: 6)
                Text(L10n.t("planning.sprint.progress", ["done": progress.done, "total": progress.total]))
                    .pfText(.caption).foregroundStyle(PFColor.textMuted)
            }
            HStack(spacing: PFSpace.xs) {
                if let onOpenBoard { PFButton(L10n.t("planning.sprint.openBoard"), systemImage: "rectangle.split.3x1", kind: .secondary, size: .small, action: onOpenBoard) }
                if canEdit { PFButton(L10n.t("planning.sprint.complete.action"), systemImage: "checkmark", kind: .primary, size: .small) { presentComplete(sprint, snapshot) } }
                if canEdit { PFButton(L10n.t("planning.sprint.assign"), systemImage: "plus.square.on.square", kind: .ghost, size: .small) { presentAssign(sprint, snapshot) } }
            }
            taskList(of: sprint, snapshot)
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
        .padding(.horizontal, PFSpace.page)
    }

    private func plannedCard(_ sprint: Sprint, _ snapshot: PlanningSnapshot) -> some View {
        let list = snapshot.tasks(in: sprint)
        let hasActive = snapshot.activeSprint != nil
        return VStack(alignment: .leading, spacing: PFSpace.s) {
            HStack(alignment: .top, spacing: PFSpace.s) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(sprint.name).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                    HStack(spacing: 6) {
                        if let range = snapshot.sprintRange(sprint) { Text(range) }
                        if snapshot.sprintRange(sprint) != nil { Text("·") }
                        Text(L10n.plural("planning.tasks.count", list.count))
                    }
                    .pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
                Spacer(minLength: 0)
                PFPill(L10n.t("planning.sprint.status.Planning"), tone: .status(.planning), compact: true)
            }
            if let goal = sprint.goal, !goal.isEmpty { Text(goal).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(2) }
            if canEdit {
                HStack(spacing: PFSpace.xs) {
                    PFButton(L10n.t("planning.sprint.start"), systemImage: "play.fill", kind: .primary, size: .small) { start(sprint, snapshot) }
                        .opacity(hasActive ? 0.5 : 1)
                    PFButton(L10n.t("planning.sprint.assign"), systemImage: "plus.square.on.square", kind: .ghost, size: .small) { presentAssign(sprint, snapshot) }
                    PFButton(L10n.t("common.edit"), systemImage: "pencil", kind: .ghost, size: .small) { presentSprintEditor(sprint) }
                }
            }
            if !list.isEmpty { taskList(of: sprint, snapshot) }
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
        .padding(.horizontal, PFSpace.page)
    }

    @ViewBuilder private func taskList(of sprint: Sprint, _ snapshot: PlanningSnapshot) -> some View {
        let list = snapshot.tasks(in: sprint).sorted { !$0.isCompleted && $1.isCompleted }
        if !list.isEmpty {
            let expanded = expandedSprints.contains(sprint.id)
            let visible = expanded ? list : Array(list.prefix(3))
            VStack(alignment: .leading, spacing: 0) {
                PFRowCard { ForEach(visible) { WorkItemRow(item: .task($0), showsProject: false) } }
                if list.count > 3 {
                    Button {
                        withAnimation(PFMotion.respecting(PFMotion.snappy)) {
                            if expanded { expandedSprints.remove(sprint.id) } else { expandedSprints.insert(sprint.id) }
                        }
                    } label: {
                        Text(expanded ? L10n.t("work.week.less") : L10n.t("work.week.more", ["count": list.count - 3]))
                            .pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                            .frame(maxWidth: .infinity, minHeight: 40)
                            .contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
        }
    }

    private func backlogCard(_ snapshot: PlanningSnapshot) -> some View {
        let backlog = snapshot.backlog
        let visible = showAllBacklog ? backlog : Array(backlog.prefix(4))
        return VStack(alignment: .leading, spacing: PFSpace.s) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(L10n.t("planning.backlog.title")).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                    Text(L10n.plural("planning.tasks.count", backlog.count)).pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
                Spacer(minLength: 0)
                if canEdit, !backlog.isEmpty, !snapshot.sprints.filter({ $0.statusRaw == "Active" || $0.statusRaw == "Planning" }).isEmpty {
                    PFButton(L10n.t("planning.backlog.toSprint"), systemImage: "arrow.right.circle", kind: .secondary, size: .small) { presentBacklogMove(snapshot) }
                }
            }
            if backlog.isEmpty {
                Text(L10n.t("planning.backlog.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            } else {
                PFRowCard { ForEach(visible) { WorkItemRow(item: .task($0), showsProject: false) } }
                if backlog.count > 4 {
                    Button {
                        withAnimation(PFMotion.respecting(PFMotion.snappy)) { showAllBacklog.toggle() }
                    } label: {
                        Text(showAllBacklog ? L10n.t("work.week.less") : L10n.t("work.week.more", ["count": backlog.count - 4]))
                            .pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                            .frame(maxWidth: .infinity, minHeight: 40)
                            .contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
        .padding(.horizontal, PFSpace.page)
    }

    // MARK: Sprint actions

    private func presentSprintEditor(_ sprint: Sprint?) {
        let taskIds = sprint.map { sprint in store.tasks.filter { $0.sprintId == sprint.id }.map(\.id) } ?? []
        presenter.present(detents: [.large]) { SprintEditorSheet(projectId: store.projectId, sprint: sprint, taskIds: taskIds) }
    }

    private func start(_ sprint: Sprint, _ snapshot: PlanningSnapshot) {
        if let active = snapshot.activeSprint {
            model.toasts.show(PFToast(L10n.t("planning.sprint.alreadyActive", ["name": active.name]), style: .warning))
            return
        }
        guard let actions = model.planning else { return }
        let sprints = store.sprints
        let projectId = store.projectId
        Task {
            let ok = await model.perform {
                try await actions.startSprint(projectId: projectId, sprint: sprint, today: FlexDate.day(of: .now, in: Formatting.timeZone), activeSprints: sprints)
            }
            if ok {
                PFHaptics.success()
                model.toasts.show(PFToast(L10n.t("planning.sprint.started", ["name": sprint.name]), style: .success))
            }
        }
    }

    private func presentComplete(_ sprint: Sprint, _ snapshot: PlanningSnapshot) {
        let unfinished = snapshot.tasks(in: sprint).filter { !$0.isCompleted }
        let next = snapshot.plannedSprints.first
        presenter.present(detents: [.fit]) {
            SprintCompleteSheet(projectId: store.projectId, sprint: sprint, unfinished: unfinished, nextSprint: next)
        }
    }

    /// Choose which open tasks belong to the sprint; the difference to the current state is written.
    private func presentAssign(_ sprint: Sprint, _ snapshot: PlanningSnapshot) {
        let current = Set(snapshot.tasks(in: sprint).map(\.id))
        let candidates = store.tasks.filter { !$0.isCompleted || current.contains($0.id) }
            .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        let options = candidates.map { task -> PlanningOption in
            let other = task.sprintId.flatMap { id in store.sprints.first { $0.id == id } }
            return PlanningOption(id: task.id, title: task.title,
                                  subtitle: other.flatMap { $0.id == sprint.id ? nil : $0.name } ?? task.status.label)
        }
        let projectId = store.projectId
        let tenantId = store.tenantId
        presenter.present(detents: [.large]) {
            PlanningMultiSheet(eyebrow: L10n.t("planning.sprint.assign"), title: sprint.name, options: options, initial: current,
                               emptyText: L10n.t("planning.tasks.empty"), searchable: true) { selected in
                applyAssignment(sprint: sprint, before: current, after: Set(selected), projectId: projectId, tenantId: tenantId)
            }
        }
    }

    private func applyAssignment(sprint: Sprint, before: Set<String>, after: Set<String>, projectId: String, tenantId: String) {
        guard let actions = model.planning else { return }
        let added = after.subtracting(before)
        let removed = before.subtracting(after)
        guard !added.isEmpty || !removed.isEmpty else { return }
        Task {
            let ok = await model.perform {
                for id in added { try await actions.setSprint(TaskRef(tenantId: tenantId, projectId: projectId, taskId: id), sprint.id) }
                for id in removed { try await actions.setSprint(TaskRef(tenantId: tenantId, projectId: projectId, taskId: id), nil) }
            }
            if ok { PFHaptics.success() }
        }
    }

    /// Backlog → sprint: pick the sprint, then the tasks.
    private func presentBacklogMove(_ snapshot: PlanningSnapshot) {
        let live = (snapshot.activeSprint.map { [$0] } ?? []) + snapshot.plannedSprints
        let backlog = snapshot.backlog
        let projectId = store.projectId
        let tenantId = store.tenantId
        presenter.present(detents: [.fit]) {
            PlanningChoiceSheet(eyebrow: L10n.t("planning.backlog.toSprint"), title: nil,
                                options: live.map { PlanningOption(id: $0.id, title: $0.name, subtitle: snapshot.sprintRange($0), symbol: $0.statusRaw == "Active" ? "bolt.fill" : "bolt") },
                                selection: nil, emptyText: L10n.t("planning.sprints.none")) { sprintId in
                guard let sprintId, let sprint = live.first(where: { $0.id == sprintId }) else { return }
                let options = backlog.map { PlanningOption(id: $0.id, title: $0.title, subtitle: $0.status.label) }
                // Opens after the choice sheet has closed itself.
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(350))
                    presenter.present(detents: [.large]) {
                        PlanningMultiSheet(eyebrow: L10n.t("planning.backlog.toSprint"), title: sprint.name, options: options, initial: [],
                                           emptyText: L10n.t("planning.backlog.empty"), searchable: true) { ids in
                            applyAssignment(sprint: sprint, before: [], after: Set(ids), projectId: projectId, tenantId: tenantId)
                        }
                    }
                }
            }
        }
    }

    // MARK: Initiatives

    private func initiativesSection(_ snapshot: PlanningSnapshot) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            sectionHeader(L10n.t("planning.initiatives.title"),
                          subtitle: snapshot.initiatives.isEmpty ? nil : L10n.plural("planning.initiatives.count", snapshot.initiatives.count),
                          addLabel: L10n.t("planning.initiative.new.title"), add: { presentInitiativeEditor() })
            if snapshot.initiatives.isEmpty {
                createCard(symbol: "target", title: L10n.t("planning.initiatives.empty.title"), message: L10n.t("planning.initiatives.empty.message"),
                           action: L10n.t("planning.initiative.new.title")) { presentInitiativeEditor() }
            } else {
                VStack(spacing: PFSpace.xs) {
                    ForEach(snapshot.initiatives.sorted { ($0.isDone ? 1 : 0, $0.title) < ($1.isDone ? 1 : 0, $1.title) }) { initiative in
                        initiativeCard(initiative, snapshot)
                    }
                }
                .padding(.horizontal, PFSpace.page)
            }
        }
    }

    private func initiativeCard(_ initiative: Initiative, _ snapshot: PlanningSnapshot) -> some View {
        let progress = snapshot.progress(of: initiative)
        let accent = PFColor.hex(initiative.color) ?? PFColor.statusBase(initiative.tone)
        return Button {
            model.router.push(.initiative(tenantId: store.tenantId, projectId: store.projectId, initiativeId: initiative.id))
        } label: {
            VStack(alignment: .leading, spacing: PFSpace.s) {
                HStack(alignment: .top, spacing: PFSpace.s) {
                    Circle().fill(accent).frame(width: 10, height: 10).padding(.top, 6).accessibilityHidden(true)
                    Text(initiative.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                        .multilineTextAlignment(.leading).lineLimit(2)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).foregroundStyle(PFColor.textSubtle).padding(.top, 5)
                }
                HStack(spacing: 6) {
                    PFPill(initiative.statusLabel, tone: .status(initiative.tone), compact: true)
                    if let health = initiative.health { PFPill(health.label, tone: health.tone, compact: true) { PFDot(health.dot, size: 6) } }
                    if let due = initiative.dueDate {
                        PFPill(Formatting.shortDate(due), tone: .severity(Formatting.severity(due: due, isDone: initiative.isDone)), compact: true)
                    }
                }
                if progress.total > 0 {
                    VStack(alignment: .leading, spacing: 5) {
                        PFProgressBar(value: Double(progress.done) / Double(progress.total), height: 5)
                        Text(L10n.t("planning.initiative.progress", ["done": progress.done, "total": progress.total]))
                            .pfText(.caption).foregroundStyle(PFColor.textMuted)
                    }
                }
            }
            .padding(PFSpace.m)
            .frame(maxWidth: .infinity, alignment: .leading)
            .pfCard()
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
    }

    private func presentInitiativeEditor() {
        let people = model.people(of: store.project)
        let projectId = store.projectId
        let tenantId = store.tenantId
        presenter.present(detents: [.large]) {
            InitiativeEditorSheet(projectId: projectId, initiative: nil, people: people) { id in
                model.router.push(.initiative(tenantId: tenantId, projectId: projectId, initiativeId: id))
            }
        }
    }
}

// MARK: - Milestone detail

/// A milestone: status, countdown, progress, description and its linked tasks; edit when allowed.
struct MilestoneDetailSheet: View {
    let projectId: String
    let milestoneId: String
    let store: ProjectStore
    let canEdit: Bool

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter

    private var milestone: Milestone? { store.milestones.first { $0.id == milestoneId } }

    var body: some View {
        if let milestone {
            let snapshot = PlanningSnapshot(tasks: store.tasks, milestones: store.milestones, sprints: store.sprints, initiatives: store.initiatives, now: .now)
            let progress = snapshot.progress(of: milestone)
            let linked = milestone.linkedTaskIds.compactMap { id in store.tasks.first { $0.id == id } }
            VStack(alignment: .leading, spacing: PFSpace.m) {
                PFSheetHeader(L10n.t("planning.milestone.eyebrow"), title: milestone.title)
                HStack(spacing: 6) {
                    PFPill(L10n.t("planning.milestone.status.\(displayStatus(milestone))"), tone: tone(snapshot.state(of: milestone)))
                    if let due = milestone.dueDate { PFPill(Formatting.shortDate(due), tone: .neutral) }
                    if let countdown = snapshot.countdown(of: milestone), snapshot.state(of: milestone) != .achieved, snapshot.state(of: milestone) != .missed {
                        Text(countdown).pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                    }
                }
                .padding(.horizontal, PFSpace.page)
                if let summary = milestone.summary, !summary.isEmpty {
                    Text(summary).pfText(.body).foregroundStyle(PFColor.textMain).padding(.horizontal, PFSpace.page)
                }
                if let initiative = store.initiatives.first(where: { $0.id == milestone.linkedInitiativeId }) {
                    HStack(spacing: 8) {
                        Image(systemName: "target").foregroundStyle(PFColor.textMuted)
                        Text(initiative.title).pfText(.metaStrong).foregroundStyle(PFColor.textMain)
                    }
                    .padding(.horizontal, PFSpace.page)
                }
                if progress.total > 0 {
                    VStack(alignment: .leading, spacing: 6) {
                        PFProgressBar(value: Double(progress.done) / Double(progress.total), height: 6)
                        Text(L10n.t("planning.milestone.progress", ["done": progress.done, "total": progress.total])).pfText(.caption).foregroundStyle(PFColor.textMuted)
                    }
                    .padding(.horizontal, PFSpace.page)
                }
                if canEdit { statusButtons(milestone) }
                if linked.isEmpty {
                    Text(L10n.t("planning.milestone.noTasks")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, PFSpace.page)
                } else {
                    PFRowCard {
                        ForEach(linked) { task in
                            WorkItemRow(item: .task(task), showsProject: false) {
                                presenter.dismiss()
                                model.router.push(.task(task.ref))
                            }
                        }
                    }
                    .padding(.horizontal, PFSpace.m)
                }
                if canEdit {
                    PFButton(L10n.t("common.edit"), systemImage: "pencil", kind: .secondary, fullWidth: true) {
                        let tasks = store.tasks
                        let initiatives = store.initiatives
                        presenter.present(detents: [.large]) {
                            MilestoneEditorSheet(projectId: projectId, milestone: milestone, tasks: tasks, initiatives: initiatives)
                        }
                    }
                    .padding(.horizontal, PFSpace.page)
                }
            }
            .padding(.bottom, PFSpace.l)
        } else {
            Color.clear.frame(height: 80).onAppear { presenter.dismiss() }
        }
    }

    private func displayStatus(_ milestone: Milestone) -> String {
        switch milestone.statusRaw {
        case "Achieved", "Completed": "Achieved"
        case "Missed": "Missed"
        default: "Pending"
        }
    }

    private func tone(_ state: PlanningTimelineEntry.State) -> PFPill.Tone {
        switch state {
        case .achieved: .status(.done)
        case .missed, .overdue: .status(.blocked)
        case .soon: .status(.review)
        case .upcoming: .neutral
        }
    }

    private func statusButtons(_ milestone: Milestone) -> some View {
        let current = displayStatus(milestone)
        return HStack(spacing: PFSpace.xs) {
            ForEach(["Pending", "Achieved", "Missed"], id: \.self) { status in
                PFChip(L10n.t("planning.milestone.status.\(status)"), isSet: current == status) { setStatus(status) }
            }
        }
        .padding(.horizontal, PFSpace.page)
    }

    private func setStatus(_ status: String) {
        guard let actions = model.planning else { return }
        Task {
            if await model.perform({ try await actions.setMilestoneStatus(projectId: projectId, id: milestoneId, status) }) { PFHaptics.success() }
        }
    }
}
