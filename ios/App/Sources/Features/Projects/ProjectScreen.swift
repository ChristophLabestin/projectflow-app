import SwiftUI
import PFData
import PFDesign
import PFModel

enum ProjectTab: Hashable {
    case list, board, milestones, activity, sprint
}

/// Project detail: hero, summary, initiatives, then Liste | Board | Meilensteine | Aktivität (+ Sprint).
struct ProjectScreen: View {
    let tenantId: String
    let projectId: String

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var store: ProjectStore
    @State private var tab: ProjectTab = .list
    @State private var grouping: TaskGrouping
    @State private var newTaskTitle = ""
    @State private var topInset: CGFloat = 0

    init(tenantId: String, projectId: String) {
        self.tenantId = tenantId
        self.projectId = projectId
        _store = State(initialValue: ProjectStore(tenantId: tenantId, projectId: projectId))
        let stored = UserDefaults.standard.string(forKey: "pf.project.grouping.\(projectId)").flatMap(TaskGrouping.init(rawValue:))
        _grouping = State(initialValue: stored ?? .due)
    }

    private var project: Project? { store.project }
    private var access: ProjectAccess { ProjectAccess(model: model, project: project) }
    private var health: HealthSnapshot? { model.workspace?.healthSnapshots[projectId] }
    private var summary: ProjectSummary { ProjectSummary(tasks: store.tasks) }
    private var activeSprint: Sprint? { store.sprints.first { $0.statusRaw == "Active" } }

    private var availableTabs: [(value: ProjectTab, label: String)] {
        let modules = project?.modules ?? []
        var tabs: [(ProjectTab, String)] = [(.list, L10n.t("projects.tab.list")), (.board, L10n.t("projects.tab.board"))]
        if modules.contains(.milestones) || !store.milestones.isEmpty { tabs.append((.milestones, L10n.t("projects.tab.milestones"))) }
        if modules.contains(.activity) { tabs.append((.activity, L10n.t("projects.tab.activity"))) }
        if modules.contains(.sprints) { tabs.append((.sprint, L10n.t("projects.tab.sprint"))) }
        return tabs
    }

    private var isBoardMode: Bool { tab == .board || tab == .sprint }

    var body: some View {
        ZStack(alignment: .top) {
            if let project {
                if isBoardMode { boardLayout(project) } else { scrollLayout(project) }
            } else if store.isMissing {
                PFEmptyState(systemImage: "questionmark.folder", title: L10n.t("projects.notFound.title"), message: L10n.t("projects.notFound.message"),
                             actionTitle: L10n.t("common.back")) { model.router.pop() }
                    .padding(PFSpace.page)
                    .frame(maxHeight: .infinity)
            } else {
                loading
            }
            topBar
        }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { topInset = $0 }
        .task { store.start() }
        .onDisappear { store.stop() }
        .onChange(of: store.isMissing) { _, missing in
            if missing, project == nil {
                model.router.pop()
                model.toasts.show(PFToast(L10n.t("projects.notFound.title"), style: .warning))
            }
        }
        .onChange(of: availableTabs.map(\.value)) { _, values in
            if !values.contains(tab) { tab = .list }
        }
    }

    // MARK: Chrome

    private var topBar: some View {
        PFTopBar(backLabel: L10n.t("common.back"), onBack: { model.router.pop() }) {
            if project != nil {
                PFIconButton("ellipsis", label: L10n.t("common.more"), style: .glass) { presentMenu() }
            }
        }
    }

    private func presentMenu() {
        let url = ProjectLinks.project(projectId)
        presenter.present(detents: [.fit]) {
            ActionSheet(title: project?.title, items: [
                .init(title: L10n.t("common.copyLink"), systemImage: "link") { ProjectsClipboard.copy(url, model: model) },
                .init(title: L10n.t("common.openInWeb"), systemImage: "safari") { ProjectsClipboard.open(url) },
                .init(title: L10n.t("projects.menu.settingsWeb"), systemImage: "gearshape") { ProjectsClipboard.open(ProjectLinks.projectSettings(projectId)) },
            ])
        }
    }

    // MARK: Layouts

    private func scrollLayout(_ project: Project) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                hero(project)
                header(project)
                initiativesStrip
                tabs.padding(.top, PFSpace.l)
                tabContent(project)
                    .padding(.top, PFSpace.s)
            }
            .padding(.bottom, PFSpace.xxl)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .ignoresSafeArea(.container, edges: [.top, .bottom])
    }

    /// Board and sprint use the whole screen: a compact header, the tabs and lanes that scroll on their own.
    private func boardLayout(_ project: Project) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Color.clear.frame(height: topInset + 56)
            HStack(alignment: .center, spacing: PFSpace.s) {
                PFProjectGlyph(title: project.title, imageURL: project.squareIcon, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(project.title).pfText(.title).foregroundStyle(PFColor.textMain).lineLimit(1).minimumScaleFactor(0.7)
                    summary.text.pfText(.meta).lineLimit(1)
                }
                Spacer(minLength: 0)
                if health?.score != nil { PFHealthRing(score: health?.score, size: 40, lineWidth: 4) }
            }
            .padding(.horizontal, PFSpace.page)
            tabs.padding(.top, PFSpace.s)
            tabContent(project)
                .padding(.top, PFSpace.s)
        }
        .ignoresSafeArea(.container, edges: .top)
    }

    @ViewBuilder
    private func hero(_ project: Project) -> some View {
        if let cover = project.coverImage, !cover.isEmpty {
            PFHeroCover(coverURL: cover, height: topInset + 210)
        } else {
            Color.clear.frame(height: topInset + 56)
        }
    }

    /// Editorial header: glyph + status eyebrow, display title, description, then the project pulse card.
    private func header(_ project: Project) -> some View {
        let hasCover = !(project.coverImage ?? "").isEmpty
        return VStack(alignment: .leading, spacing: PFSpace.m) {
            HStack(alignment: .center, spacing: PFSpace.s) {
                if !hasCover { PFProjectGlyph(title: project.title, imageURL: project.squareIcon, size: 44) }
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        PFDot(PFColor.statusBase(project.status.tone), size: 7)
                        PFEyebrow(project.status.label)
                        if let priority = project.priority {
                            Text("·").pfText(.eyebrow).foregroundStyle(PFColor.textSubtle)
                            PFPrioritySignal(priority)
                            PFEyebrow(priority.label)
                        }
                    }
                    if let due = project.dueDate, project.status.lifecycle != .closed {
                        Text(L10n.t("projects.eyebrow.due", ["date": Formatting.shortDate(due)]))
                            .pfText(.metaStrong)
                            .foregroundStyle(PFColor.severityText(Formatting.severity(due: due)))
                    }
                }
            }
            Text(project.title)
                .pfText(.display)
                .foregroundStyle(PFColor.textMain)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            if !project.summary.isEmpty {
                Text(project.summary).pfText(.body).foregroundStyle(PFColor.textMuted).lineLimit(3)
            }
            pulseCard
                .padding(.top, PFSpace.xs)
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, hasCover ? -28 : PFSpace.xs)
    }

    /// Progress, health and the four signals the web shows on the project overview, in one calm card.
    private var pulseCard: some View {
        let s = summary
        return VStack(alignment: .leading, spacing: PFSpace.m) {
            HStack(alignment: .center, spacing: PFSpace.m) {
                VStack(alignment: .leading, spacing: 4) {
                    PFEyebrow(L10n.t("projects.pulse.progress"))
                    Text("\(Int((s.progress * 100).rounded())) %")
                        .pfText(.displayLarge)
                        .foregroundStyle(PFColor.textMain)
                        .contentTransition(.numericText())
                    Text(L10n.t("projects.pulse.doneOf", ["done": s.done, "total": s.total]))
                        .pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
                Spacer(minLength: 0)
                if health?.score != nil {
                    VStack(spacing: 6) {
                        PFHealthRing(score: health?.score, size: 62, lineWidth: 6)
                        HStack(spacing: 4) {
                            Text(L10n.t("projects.pulse.health")).pfText(.caption).foregroundStyle(PFColor.textMuted)
                            if let trend = PFTrend(raw: health?.trend) { PFTrendArrow(trend, size: 11) }
                        }
                    }
                }
            }
            PFProgressBar(value: s.progress, height: 6)
            HStack(spacing: 0) {
                stat(L10n.t("projects.stat.open"), s.open, PFColor.textMain)
                statDivider
                stat(L10n.t("projects.stat.overdue"), s.overdue, s.overdue > 0 ? PFColor.dangerText : PFColor.textMain)
                statDivider
                stat(L10n.t("projects.stat.blocked"), s.blocked, s.blocked > 0 ? PFColor.dangerText : PFColor.textMain)
                statDivider
                stat(L10n.t("projects.stat.soon"), s.soon, s.soon > 0 ? PFColor.warningText : PFColor.textMain)
            }
        }
        .padding(PFSpace.l)
        .pfCard(radius: PFRadius.surface)
    }

    private func stat(_ label: String, _ value: Int, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(color)
                .contentTransition(.numericText())
            Text(label).pfText(.caption).foregroundStyle(PFColor.textMuted).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    private var statDivider: some View {
        Rectangle().fill(PFColor.hairline).frame(width: 1, height: 30)
    }

    // MARK: Initiatives

    @ViewBuilder
    private var initiativesStrip: some View {
        if !store.initiatives.isEmpty {
            VStack(alignment: .leading, spacing: PFSpace.xs) {
                HStack {
                    PFEyebrow(L10n.t("projects.initiatives.title"))
                    PFCountPill(store.initiatives.count)
                }
                .padding(.horizontal, PFSpace.page)
                ScrollView(.horizontal) {
                    HStack(spacing: PFSpace.s) {
                        ForEach(store.initiatives) { initiative in
                            InitiativeCard(initiative: initiative, tasks: store.tasks.filter { $0.initiativeId == initiative.id }) {
                                model.router.push(.initiative(tenantId: tenantId, projectId: projectId, initiativeId: initiative.id))
                            }
                        }
                    }
                    .padding(.horizontal, PFSpace.page)
                    .padding(.vertical, 6)
                }
                .scrollIndicators(.hidden)
            }
            .padding(.top, PFSpace.l)
        }
    }

    // MARK: Tabs

    private var tabs: some View {
        PFTabStrip(availableTabs, selection: $tab)
    }

    @ViewBuilder
    private func tabContent(_ project: Project) -> some View {
        switch tab {
        case .list:
            listContent(project)
        case .board:
            ProjectBoardView(tasks: store.tasks, canMove: access.canEditTasks, emptyText: L10n.t("projects.board.empty"))
        case .milestones:
            MilestonesView(milestones: store.milestones, tasks: store.tasks)
        case .activity:
            ActivityFeedView(entries: store.activity)
        case .sprint:
            sprintContent
        }
    }

    private func listContent(_ project: Project) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: PFSpace.xs) {
                if access.canEditTasks {
                    PFTextField(L10n.t("projects.addTask"), text: $newTaskTitle, systemImage: "plus", onSubmit: addTask)
                } else {
                    Text(L10n.t("projects.group.by", ["group": grouping.label])).pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                    Spacer(minLength: 0)
                }
                Button { presentGrouping() } label: {
                    Image(systemName: grouping.symbol)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(PFColor.textMain)
                        .frame(width: 46, height: 46)
                        .background(PFColor.card, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
                        .overlay { RoundedRectangle(cornerRadius: PFRadius.control, style: .continuous).strokeBorder(PFColor.hairlineStrong, lineWidth: 1) }
                }
                .buttonStyle(.pfPressable)
                .accessibilityLabel(L10n.t("projects.group.by", ["group": grouping.label]))
            }
            .padding(.horizontal, PFSpace.page)
            if store.tasks.isEmpty {
                if store.isLoaded {
                    PFEmptyState(systemImage: "checklist", title: L10n.t("projects.tasks.empty"), message: L10n.t("projects.tasks.emptyHint"))
                        .padding(.horizontal, PFSpace.page)
                        .padding(.top, PFSpace.m)
                } else {
                    PFSkeleton(height: 120, radius: PFRadius.card).padding(.horizontal, PFSpace.page).padding(.top, PFSpace.m)
                }
            } else {
                ProjectTaskList(tasks: store.tasks, grouping: grouping, initiatives: store.initiatives)
            }
        }
    }

    @ViewBuilder
    private var sprintContent: some View {
        if let sprint = activeSprint {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: PFSpace.xs) {
                    Image(systemName: "bolt.fill").font(.system(size: 11, weight: .bold)).foregroundStyle(PFColor.textMuted)
                    Text(sprint.name).pfText(.metaStrong).foregroundStyle(PFColor.textMain)
                    if let end = sprint.endDate {
                        Text("· " + L10n.t("projects.sprint.until", ["date": Formatting.shortDate(end)])).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, PFSpace.page)
                .padding(.bottom, 8)
                ProjectBoardView(tasks: store.tasks.filter { $0.sprintId == sprint.id }, canMove: access.canEditTasks, emptyText: L10n.t("projects.board.empty"))
            }
        } else {
            PFEmptyState(systemImage: "bolt", title: L10n.t("projects.sprint.none"), message: L10n.t("projects.sprint.noneHint"))
                .padding(.horizontal, PFSpace.page)
                .padding(.top, PFSpace.m)
        }
    }

    // MARK: Actions

    private func presentGrouping() {
        presenter.present(detents: [.fit]) {
            OptionSheet(title: L10n.t("projects.group.title"), options: TaskGrouping.allCases.map { option in
                OptionSheet.Option(id: option.rawValue, label: option.label, isSelected: option == grouping) {
                    Image(systemName: option.symbol).font(.system(size: 15, weight: .medium)).foregroundStyle(PFColor.textMuted)
                }
            }) { id in
                guard let option = TaskGrouping(rawValue: id) else { return }
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { grouping = option }
                UserDefaults.standard.set(option.rawValue, forKey: "pf.project.grouping.\(projectId)")
            }
        }
    }

    private func addTask() {
        let title = newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, let actions = model.actions else { return }
        newTaskTitle = ""
        Task {
            await model.perform { _ = try await actions.createTask(projectId: projectId, title: title) }
            PFHaptics.success()
        }
    }

    private var loading: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            Color.clear.frame(height: 60)
            PFSkeleton(height: 56, radius: 14).frame(width: 56)
            PFSkeleton(height: 30, radius: 6).frame(width: 220)
            PFSkeleton(height: 14, radius: 4).frame(width: 160)
            PFSkeleton(height: 120, radius: PFRadius.card)
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.xl)
        .frame(maxHeight: .infinity, alignment: .top)
    }
}

/// Initiative card in the strip: title, health, status, open work.
struct InitiativeCard: View {
    let initiative: Initiative
    let tasks: [WorkTask]
    let action: () -> Void

    var body: some View {
        let open = tasks.filter { !$0.isCompleted }.count
        let done = tasks.count - open
        return Button {
            PFHaptics.soft()
            action()
        } label: {
            VStack(alignment: .leading, spacing: PFSpace.xs) {
                HStack(spacing: 6) {
                    PFDot(initiative.health?.dot ?? PFColor.textSubtle)
                    Text(initiative.health?.label ?? initiative.statusLabel).pfText(.metaStrong).foregroundStyle(PFColor.textMuted).lineLimit(1)
                }
                Text(initiative.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(2).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                if !tasks.isEmpty {
                    PFProgressBar(value: Double(done) / Double(tasks.count), height: 4)
                }
                HStack {
                    PFPill(initiative.statusLabel, tone: .status(initiative.tone), compact: true)
                    Spacer(minLength: 0)
                    if let due = initiative.dueDate {
                        Text(Formatting.shortDate(due)).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    }
                }
            }
            .padding(PFSpace.m)
            .frame(width: 208, height: 132, alignment: .topLeading)
            .pfCard(radius: PFRadius.card)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityElement(children: .combine)
    }
}
