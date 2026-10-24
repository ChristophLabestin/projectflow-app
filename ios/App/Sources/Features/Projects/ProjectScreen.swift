import SwiftUI
import PFData
import PFDesign
import PFModel

enum ProjectTab: Hashable {
    case overview, list, board, plan, files, team
}

/// Project cockpit: a light, editorial header (cover or monogram, situation sentence), a tab bar that pins
/// under the top bar, and Überblick · Aufgaben · Board · Plan · Team below it.
struct ProjectScreen: View {
    let tenantId: String
    let projectId: String

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var store: ProjectStore
    @State private var tab: ProjectTab = .overview
    @State private var grouping: TaskGrouping
    @State private var newTaskTitle = ""
    @State private var topInset: CGFloat = 0
    @State private var scrolledY: CGFloat = 0
    @State private var headerHeight: CGFloat = 400
    @Namespace private var underline

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
    private var pulse: ProjectPulse { ProjectPulse(tasks: store.tasks, milestones: store.milestones) }
    private var barHeight: CGFloat { topInset + 54 }
    /// The tab bar is pinned once the header has scrolled away (native pinned section header).
    private var isPinned: Bool { scrolledY > headerHeight - 2 }

    /// The user's project navigation (hidden items, order) applied to the cockpit tabs.
    private var navLayout: ProjectNavLayout { ProjectNavLayout(prefs: store.navPrefs, modules: project?.modules ?? []) }

    private var tabOptions: [CockpitTabBar<ProjectTab>.Option] {
        let layout = navLayout
        let tasks: [CockpitTabBar<ProjectTab>.Option] = layout.showsTasks ? [
            .init(.list, L10n.t("projects.tab.tasks"), badge: pulse.summary.open),
            .init(.board, L10n.t("projects.tab.board")),
        ] : []
        let plan: [CockpitTabBar<ProjectTab>.Option] = layout.planSections.isEmpty ? [] : [.init(.plan, L10n.t("projects.tab.plan"))]
        return [.init(.overview, L10n.t("projects.tab.overview"))]
            + (layout.tasksBeforePlan ? tasks + plan : plan + tasks)
            + [.init(.files, L10n.t("files.projectTitle")), .init(.team, L10n.t("projects.tab.team"))]
    }

    var body: some View {
        ZStack(alignment: .top) {
            PFCanvas(dotted: true)
            if let project {
                if tab == .board { boardLayout(project) } else { scrollLayout(project) }
            } else if store.isMissing {
                PFEmptyState(systemImage: "questionmark.folder", title: L10n.t("projects.notFound.title"), message: L10n.t("projects.notFound.message"),
                             actionTitle: L10n.t("common.back")) { model.router.pop() }
                    .padding(PFSpace.page)
                    .frame(maxHeight: .infinity)
            } else {
                loading
            }
            if project == nil || tab == .board { topBar }
        }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { topInset = $0 }
        .task {
            store.start()
            if let uid = model.uid { store.watchNavPrefs(uid: uid) }
        }
        .onDisappear { store.stop() }
        // A tab the user just hid in the project settings falls back to the overview.
        .onChange(of: tabOptions.map(\.value)) { _, tabs in
            if !tabs.contains(tab) { tab = .overview }
        }
        .onChange(of: store.isMissing) { _, missing in
            if missing, project == nil {
                model.router.pop()
                model.toasts.show(PFToast(L10n.t("projects.notFound.title"), style: .warning))
            }
        }
    }

    // MARK: Chrome

    private var topBar: some View {
        PFTopBar(title: isPinned || tab == .board ? project?.title : nil, backLabel: L10n.t("common.back"), onBack: { model.router.pop() }) {
            if project != nil, model.showsInAppAi {
                AiSparkButton { AiAsk.present(model: model, context: AiAskContext(surface: "project", projectId: projectId, entity: .project(id: projectId))) }
            }
            if project != nil {
                PFIconButton("gearshape", label: L10n.t("projects.settings.open"), style: .glass) {
                    model.router.push(.projectSettings(tenantId: tenantId, projectId: projectId))
                }
                PFIconButton("ellipsis", label: L10n.t("common.more"), style: .glass) { presentMenu() }
            }
        }
        .animation(PFMotion.respecting(PFMotion.fast), value: isPinned)
    }

    private func presentMenu() {
        let url = ProjectLinks.project(projectId)
        presenter.present(detents: [.fit]) {
            ActionSheet(title: project?.title, items: [
                .init(title: L10n.t("common.copyLink"), systemImage: "link") { ProjectsClipboard.copy(url, model: model) },
                .init(title: L10n.t("common.openInWeb"), systemImage: "safari") { ProjectsClipboard.open(url) },
            ])
        }
    }

    private func tabBar(_ namespace: Namespace.ID) -> some View {
        CockpitTabBar(tabOptions, selection: $tab, namespace: namespace)
    }

    // MARK: Layouts

    /// The top bar is a safe-area inset, so the native pinned section header (the tab bar) docks right
    /// under it while the header scrolls away; switching tabs while pinned keeps the bar in place.
    private func scrollLayout(_ project: Project) -> some View {
        ScrollViewReader { reader in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
                    header(project)
                        .padding(.bottom, PFSpace.l)
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { headerHeight = $0 }
                    if model.entitlements.isLocked(projectId: projectId) { PlanLockedNotice().padding(.bottom, PFSpace.l) }
                    Section {
                        tabContent(project)
                            .padding(.bottom, 120)
                            .id(tab)
                    } header: {
                        tabBar(underline)
                            .background(PFColor.canvas)
                            .id("cockpit-tabs")
                    }
                }
            }
            .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y + $0.contentInsets.top } action: { _, value in
                scrolledY = value
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .top, spacing: 0) {
                topBar
                    .padding(.bottom, 6)
                    .background(alignment: .top) { topFade }
            }
            .onChange(of: tab) { _, _ in
                if isPinned {
                    var transaction = Transaction()
                    transaction.disablesAnimations = true
                    withTransaction(transaction) { reader.scrollTo("cockpit-tabs", anchor: .top) }
                }
            }
        }
    }

    /// Canvas band behind the top bar once anything has scrolled under it.
    private var topFade: some View {
        PFColor.canvas
            .ignoresSafeArea(.container, edges: .top)
            .opacity(scrolledY > 4 ? 1 : 0)
            .animation(PFMotion.respecting(PFMotion.fast), value: scrolledY > 4)
            .allowsHitTesting(false)
    }

    /// Board uses the whole screen: the title lives in the top bar, then the tab bar and the lanes.
    private func boardLayout(_ project: Project) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Color.clear.frame(height: barHeight)
            tabBar(underline)
            tabContent(project)
                .padding(.top, PFSpace.s)
        }
        .ignoresSafeArea(.container, edges: .top)
    }

    private func header(_ project: Project) -> some View {
        let p = pulse
        return CockpitHeader(
            title: project.title,
            monogram: project.monogram,
            iconURL: project.squareIcon,
            coverURL: project.coverImage,
            eyebrow: eyebrow(project),
            situation: ProjectSituation.text(pulse: p, status: project.status),
            // The top bar is a safe-area inset above the scroll content; only keep a small gap.
            topInset: -48
        )
    }

    private func eyebrow(_ project: Project) -> [CockpitEyebrowItem] {
        var items = [CockpitEyebrowItem(id: "status", text: project.status.label, dot: PFColor.statusBase(project.status.tone))]
        if let priority = project.priority { items.append(CockpitEyebrowItem(id: "priority", text: priority.label, priority: priority)) }
        if let due = project.dueDate, project.status.lifecycle != .closed {
            items.append(CockpitEyebrowItem(id: "due", text: L10n.t("projects.eyebrow.due", ["date": Formatting.shortDate(due)]),
                                            tint: PFColor.severityText(Formatting.severity(due: due))))
        }
        return items
    }

    // MARK: Tabs

    @ViewBuilder
    private func tabContent(_ project: Project) -> some View {
        switch tab {
        case .overview:
            ProjectOverviewView(store: store, pulse: pulse, health: health, onSelectTab: { selectTab($0) }, onShowActivity: presentActivity)
        case .list:
            listContent(project).padding(.top, PFSpace.m)
        case .board:
            ProjectBoardView(tasks: store.tasks, canMove: access.canEditTasks, emptyText: L10n.t("projects.board.empty"))
        case .plan:
            ProjectPlanView(store: store, canEdit: access.canManage, sections: navLayout.planSections, onOpenBoard: { selectTab(.board) }).padding(.top, PFSpace.m)
        case .files:
            FileAttachmentsCard(tenantId: tenantId,
                                parent: FileParent(kind: .project, id: projectId, projectId: projectId, title: project.title))
                .padding(.horizontal, PFSpace.page)
                .padding(.top, PFSpace.m)
        case .team:
            ProjectTeamView(store: store, canEdit: access.canManage).padding(.top, PFSpace.m)
        }
    }

    private func selectTab(_ value: ProjectTab) {
        guard tabOptions.contains(where: { $0.value == value }) else { return }
        PFHaptics.selection()
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { tab = value }
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
                    .padding(.top, PFSpace.xs)
            }
        }
    }

    // MARK: Actions

    /// Project activity from the workspace event stream (replaces the legacy `activities` list).
    private func presentActivity() {
        model.router.push(.activity(tenantId: tenantId, projectId: projectId))
    }

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
