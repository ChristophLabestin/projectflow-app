import SwiftUI
import PFDesign
import PFData
import PFModel

/// Signed-in shell: one custom navigator per tab (kept alive), the floating dock, the focus bar
/// and the focus room. No system tab bar or navigation bars are used.
/// Regular width (iPhone Duo opened, `brain/plans/ios-iphone-duo.md`): the dock becomes a side rail and the
/// list tabs show list and detail side by side. Paths live in the router, so folding keeps the open screen.
struct MainShell: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var safeInsets = EdgeInsets()
    @State private var bottomChromeHeight: CGFloat = 0

    private var isWide: Bool { horizontalSizeClass == .regular }
    /// iPhone Duo closed: the system keeps a side region (status bar, Dynamic Island, camera) on the trailing
    /// edge. The dock moves into it as a vertical rail — like Apple's own side controls — instead of taking
    /// height at the bottom of the short outer display. Plain iPhones have no such inset and keep the bottom dock.
    private var sideRegionWidth: CGFloat? {
        let width = PFLayout.sideRegionWidth(trailingInset: safeInsets.trailing, isCompact: !isWide)
        return width > 0 ? width : nil
    }

    var body: some View {
        @Bindable var router = model.router
        ZStack(alignment: .top) {
            HStack(spacing: 0) {
                if isWide {
                    dock(axis: .vertical, listToggle: true)
                        .padding(.leading, PFSpace.xs)
                        .transition(.move(edge: .leading).combined(with: .opacity))
                }
                // Platform announcement: a thin banner in the layout above the content column, so every tab (and its
                // floating header, which reads the window's safe area) starts below it instead of under it.
                VStack(spacing: 0) {
                announcementBanner
                ZStack {
                    ForEach(AppTab.allCases, id: \.self) { tab in
                        let visible = router.tab == tab && !router.isSearchActive
                        TabPane(stack: router.stacks[tab]!, split: isWide && tab != .today) {
                            TabRoot(tab: tab)
                        }
                        .opacity(visible ? 1 : 0)
                        .allowsHitTesting(visible)
                        .accessibilityHidden(!visible)
                        .pfHidesSideControls(!visible)
                    }
                    if router.isSearchActive {
                        TabPane(stack: router.searchStack, split: isWide) {
                            SearchScreen()
                        }
                        .transition(.opacity)
                    }
                }
                .background(PFCanvas())
                // Every scroll view gets extra room below its content so the last rows clear the floating bar.
                .contentMargins(.bottom, PFSpace.l, for: .scrollContent)
                .safeAreaInset(edge: .bottom, spacing: 0) { bottomChrome }
                // Pushed screens don't receive the inset above, so floating actions read its height here.
                .environment(\.pfBottomChromeHeight, bottomChromeHeight)
                .environment(\.pfSideRegionWidth, sideRegionWidth ?? 0)
                }
            }
            .background(PFCanvas())

            if !model.network.isOnline {
                PFStatusBanner(L10n.t("common.offline"))
                    .padding(.top, 4)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }

            if router.isFocusRoomOpen {
                FocusRoomView()
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                    .zIndex(10)
            }
        }
        .pfSideToolbar(alignment: .bottomTrailing) { rootActions in
            // Pushed pages hand the side region to their own controls (back lowest), like the dock hides on iPhone.
            if let side = sideRegionWidth, !router.isFocusRoomOpen, !router.isDeep {
                let gap = PFLayout.sideGap(side)
                VStack(spacing: 10) {
                    // The visible tab's header actions (PFRootActions) stack above the tabs.
                    if let rootActions {
                        rootActions.frame(width: PFDock.railWidth)
                    }
                    dock(axis: .vertical, listToggle: false, showsFocus: true)
                }
                .padding(.trailing, gap)
                .padding(.bottom, gap)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                .ignoresSafeArea()
                .transition(.opacity)
            }
        }
        .onGeometryChange(for: EdgeInsets.self) { $0.safeAreaInsets } action: { safeInsets = $0 }
        .environment(\.pfIsWide, isWide)
        .animation(PFMotion.respecting(PFMotion.snappy), value: router.isFocusRoomOpen)
        .animation(PFMotion.respecting(PFMotion.snappy), value: router.isDeep)
        .animation(PFMotion.respecting(PFMotion.snappy), value: router.isListColumnHidden)
        .animation(PFMotion.respecting(PFMotion.normal), value: model.network.isOnline)
        .animation(PFMotion.respecting(PFMotion.snappy), value: model.announcements.visible)
        .task { model.announcements.start() }
        // "Frag ProjectFlow" from Siri/Shortcuts (`projectflow://ask`): open the ✦ sheet about the day.
        .onChange(of: router.pendingAsk) { _, question in
            guard let question else { return }
            router.pendingAsk = nil
            guard model.showsInAppAi else { return }
            AiAsk.present(model: model, context: AiAskContext(surface: "today"), question: question.isEmpty ? nil : question)
        }
    }

    @ViewBuilder
    private var announcementBanner: some View {
        if let announcement = model.announcements.visible {
            AnnouncementBanner(announcement: announcement) {
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { model.announcements.dismiss() }
            }
            .padding(.bottom, PFSpace.xs)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    @ViewBuilder
    private var bottomChrome: some View {
        @Bindable var router = model.router
        VStack(spacing: 10) {
            if let focus = model.profile?.focus, !router.isFocusRoomOpen, sideRegionWidth == nil {
                focusBar(focus)
                    .frame(maxWidth: isWide ? 560 : nil)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            if !router.isDeep && hasBottomDock {
                dock(axis: .horizontal, listToggle: false)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { bottomChromeHeight = $0 }
        // Sit the bar lower, into the home-indicator zone; the inset height (content clearance) is unchanged.
        .offset(y: router.isDeep || !hasBottomDock ? 0 : 14)
        .animation(PFMotion.respecting(PFMotion.snappy), value: model.profile?.focus)
    }

    /// Bottom dock on iPhone, side rail when opened or in the closed Duo's side region. The rail's extra toggle folds the list column away.
    private func focusBar(_ focus: PFModel.FocusState) -> some View {
        PFFocusBar(
            title: focus.title,
            subtitle: FocusController.subtitle(for: focus),
            completeLabel: L10n.t("focus.complete"),
            isBlocked: focus.status == .blocked,
            onOpen: { model.router.isFocusRoomOpen = true },
            onComplete: { Task { await FocusController(model: model).complete() } }
        )
    }

    private var hasBottomDock: Bool { !isWide && sideRegionWidth == nil }

    private func dock(axis: Axis, listToggle: Bool, showsFocus: Bool = false) -> some View {
        @Bindable var router = model.router
        let hasListColumn = listToggle && (router.isSearchActive || router.tab != .today)
        return PFDock(
            items: [
                PFDockItem(id: AppTab.today.rawValue, title: L10n.t("tab.today"), systemImage: "sun.horizon"),
                PFDockItem(id: AppTab.work.rawValue, title: L10n.t("tab.work"), systemImage: "checklist"),
                PFDockItem(id: AppTab.projects.rawValue, title: L10n.t("tab.projects"), systemImage: "square.stack.3d.up"),
                PFDockItem(id: AppTab.inbox.rawValue, title: L10n.t("tab.inbox"), systemImage: "tray",
                           badge: model.workspace?.unreadCount ?? 0),
            ],
            selection: Binding(get: { router.tab.rawValue }, set: { router.select(AppTab(rawValue: $0) ?? .today) }),
            searchLabel: L10n.t("tab.search"),
            isSearchSelected: router.isSearchActive,
            axis: axis,
            accessory: hasListColumn
                ? PFDockAccessory(title: L10n.t("shell.list"),
                                  systemImage: "sidebar.left", isOn: !router.isListColumnHidden,
                                  action: { router.isListColumnHidden.toggle() })
                : nil,
            focus: showsFocus ? model.profile?.focus.map { focus in
                PFDockFocus(label: L10n.t("focus.room.runningNoTime"),
                            accessibilityLabel: "\(focus.title), \(FocusController.subtitle(for: focus))",
                            completeLabel: L10n.t("focus.complete"), isBlocked: focus.status == .blocked,
                            onOpen: { router.isFocusRoomOpen = true },
                            onComplete: { Task { await FocusController(model: model).complete() } })
            } : nil,
            onSearch: { withAnimation(PFMotion.snappy) { router.isSearchActive.toggle() } },
            onReselect: { router.reselect(AppTab(rawValue: $0) ?? .today) }
        )
    }
}

/// One tab's navigation. iPhone: the tab root is the navigator's root. Split (regular width): the root
/// sits in the list column and the same navigator — same path — fills the detail column.
private struct TabPane<Root: View>: View {
    @Environment(AppModel.self) private var model
    let stack: PFNavigationModel<AppRoute>
    let split: Bool
    @ViewBuilder let root: Root

    var body: some View {
        if split {
            PFSplitColumns(isLeadingHidden: model.router.isListColumnHidden) {
                root
            } trailing: {
                PFNavigator(model: stack) {
                    DetailPlaceholder()
                } destination: { route in
                    RouteDestination(route: route)
                }
            }
        } else {
            PFNavigator(model: stack) {
                root
            } destination: { route in
                RouteDestination(route: route)
            }
        }
    }
}

/// Detail column before anything is opened.
private struct DetailPlaceholder: View {
    var body: some View {
        PFEmptyState(systemImage: "rectangle.righthalf.inset.filled", title: L10n.t("shell.detail.title"),
                     message: L10n.t("shell.detail.message"))
            .frame(maxWidth: 360)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(PFCanvas())
    }
}

/// Root screen per tab.
struct TabRoot: View {
    let tab: AppTab

    var body: some View {
        switch tab {
        case .today: TodayScreen()
        case .work: WorkScreen()
        case .projects: ProjectsScreen()
        case .inbox: InboxScreen()
        }
    }
}

/// Maps a route to its feature screen.
struct RouteDestination: View {
    let route: AppRoute

    var body: some View {
        if case .project = route {
            screen
        } else {
            screen.pfReadableWidth()
        }
    }

    @ViewBuilder
    private var screen: some View {
        switch route {
        case .task(let ref): TaskDetailScreen(ref: ref)
        case .personalTask(let tenantId, let id): PersonalTaskScreen(tenantId: tenantId, taskId: id)
        case .project(let tenantId, let projectId): ProjectScreen(tenantId: tenantId, projectId: projectId)
        case .projectSettings(let tenantId, let projectId): ProjectSettingsScreen(tenantId: tenantId, projectId: projectId)
        case .initiative(let tenantId, let projectId, let initiativeId):
            InitiativeScreen(tenantId: tenantId, projectId: projectId, initiativeId: initiativeId)
        case .account: AccountScreen()
        case .notificationSettings: NotificationSettingsScreen()
        case .securitySettings: SecuritySettingsScreen()
        case .aiConnections: AiConnectionsScreen()
        case .appearanceSettings: AppearanceSettingsScreen()
        case .team: TeamScreen()
        case .accountPage(let page): AccountPageView(page: page)
        case .designCatalog: DesignCatalogScreen()
        case .activity(let tenantId, let projectId): ActivityScreen(tenantId: tenantId, projectId: projectId)
        case .insights(let tenantId): InsightsScreen(tenantId: tenantId)
        case .files(let tenantId): FilesScreen(tenantId: tenantId)
        }
    }
}
