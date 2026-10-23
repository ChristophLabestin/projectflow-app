import SwiftUI
import PFData
import PFDesign
import PFModel

enum ProjectTab: Hashable {
    case overview, list, board, plan, team
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
    @State private var tabBarY: CGFloat = 10_000
    @State private var tabBarY0: CGFloat?
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
    private var isPinned: Bool { tabBarY < barHeight }

    private var tabOptions: [CockpitTabBar<ProjectTab>.Option] {
        [
            .init(.overview, L10n.t("projects.tab.overview")),
            .init(.list, L10n.t("projects.tab.tasks"), badge: pulse.summary.open),
            .init(.board, L10n.t("projects.tab.board")),
            .init(.plan, L10n.t("projects.tab.plan")),
            .init(.team, L10n.t("projects.tab.team")),
        ]
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
    }

    // MARK: Chrome

    private var topBar: some View {
        PFTopBar(title: isPinned && tab != .board ? project?.title : nil, backLabel: L10n.t("common.back"), onBack: { model.router.pop() }) {
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

    private func scrollLayout(_ project: Project) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header(project)
                    .padding(.bottom, PFSpace.l)
                tabBar(underline)
                    .opacity(isPinned ? 0 : 1)
                    .onGeometryChange(for: CGFloat.self) { $0.frame(in: .named("cockpit")).minY } action: {
                        tabBarY = $0
                        if tabBarY0 == nil, $0 < 9_000 { tabBarY0 = $0 }
                    }
                tabContent(project)
                    .padding(.bottom, 120)
                    .id(tab)
                    .transition(.opacity)
            }
        }
        .coordinateSpace(name: "cockpit")
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .ignoresSafeArea(.container, edges: [.top, .bottom])
        .overlay(alignment: .top) { topFade }
        .overlay(alignment: .top) { pinnedBar }
        .animation(PFMotion.respecting(PFMotion.fast), value: tab)
    }

    /// Soft canvas fade under the top bar as soon as the header starts to scroll away.
    private var topFade: some View {
        LinearGradient(colors: [PFColor.canvas, PFColor.canvas.opacity(0.94), PFColor.canvas.opacity(0)], startPoint: .top, endPoint: .bottom)
            .frame(height: barHeight + 18)
            .ignoresSafeArea(.container, edges: .top)
            .opacity(tabBarY0.map { tabBarY < $0 - 6 } ?? false ? 1 : 0)
            .allowsHitTesting(false)
            .animation(PFMotion.respecting(PFMotion.fast), value: tabBarY < (tabBarY0 ?? 0) - 6)
    }

    /// Canvas band + tab bar that takes over once the in-flow tab bar scrolled under the top bar.
    private var pinnedBar: some View {
        VStack(spacing: 0) {
            Color.clear.frame(height: barHeight)
            CockpitTabBar(tabOptions, selection: $tab, namespace: underline)
                .background(PFColor.canvas)
        }
        .background(PFColor.canvas.opacity(0.96))
        .ignoresSafeArea(.container, edges: .top)
        .opacity(isPinned ? 1 : 0)
        .allowsHitTesting(isPinned)
        .animation(PFMotion.respecting(PFMotion.fast), value: isPinned)
    }

    /// Board uses the whole screen: compact header, tab bar, lanes that scroll on their own.
    private func boardLayout(_ project: Project) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Color.clear.frame(height: topInset + 56)
            HStack(alignment: .center, spacing: PFSpace.s) {
                PFProjectGlyph(title: project.title, imageURL: project.squareIcon, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(project.title).pfText(.title).foregroundStyle(PFColor.textMain).lineLimit(1).minimumScaleFactor(0.7)
                    pulse.summary.text.pfText(.meta).lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, PFSpace.page)
            .padding(.bottom, PFSpace.xs)
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
            topInset: topInset
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
            ProjectPlanView(store: store, canEdit: access.canManage).padding(.top, PFSpace.m)
        case .team:
            ProjectTeamView(store: store, canEdit: access.canManage).padding(.top, PFSpace.m)
        }
    }

    private func selectTab(_ value: ProjectTab) {
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

    private func presentActivity() {
        let entries = store.activity
        presenter.present(detents: [.large]) {
            VStack(alignment: .leading, spacing: PFSpace.m) {
                PFSheetHeader(L10n.t("projects.overview.activity"), title: project?.title)
                ScrollView { ActivityFeedView(entries: entries).padding(.bottom, PFSpace.xl) }
                    .scrollIndicators(.hidden)
            }
        }
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
