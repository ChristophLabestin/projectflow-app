import SwiftUI
import PFDesign
import PFModel

/// Signed-in shell: one custom navigator per tab (kept alive), the floating dock, the focus bar
/// and the focus room. No system tab bar or navigation bars are used.
struct MainShell: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        @Bindable var router = model.router
        ZStack(alignment: .top) {
            ZStack {
                ForEach(AppTab.allCases, id: \.self) { tab in
                    let visible = router.tab == tab && !router.isSearchActive
                    PFNavigator(model: router.stacks[tab]!) {
                        TabRoot(tab: tab)
                    } destination: { route in
                        RouteDestination(route: route)
                    }
                    .opacity(visible ? 1 : 0)
                    .allowsHitTesting(visible)
                    .accessibilityHidden(!visible)
                }
                if router.isSearchActive {
                    PFNavigator(model: router.searchStack) {
                        SearchScreen()
                    } destination: { route in
                        RouteDestination(route: route)
                    }
                    .transition(.opacity)
                }
            }
            .background(PFCanvas())
            // Every scroll view gets extra room below its content so the last rows clear the floating bar.
            .contentMargins(.bottom, PFSpace.l, for: .scrollContent)
            .safeAreaInset(edge: .bottom, spacing: 0) { bottomChrome }

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
        .animation(PFMotion.respecting(PFMotion.snappy), value: router.isFocusRoomOpen)
        .animation(PFMotion.respecting(PFMotion.snappy), value: router.isDeep)
        .animation(PFMotion.respecting(PFMotion.normal), value: model.network.isOnline)
    }

    @ViewBuilder
    private var bottomChrome: some View {
        @Bindable var router = model.router
        VStack(spacing: 10) {
            if let focus = model.profile?.focus, !router.isFocusRoomOpen {
                PFFocusBar(
                    title: focus.title,
                    subtitle: FocusController.subtitle(for: focus),
                    completeLabel: L10n.t("focus.complete"),
                    isBlocked: focus.status == .blocked,
                    onOpen: { router.isFocusRoomOpen = true },
                    onComplete: { Task { await FocusController(model: model).complete() } }
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            if !router.isDeep {
                PFDock(
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
                    onSearch: { withAnimation(PFMotion.snappy) { router.isSearchActive.toggle() } },
                    onReselect: { router.reselect(AppTab(rawValue: $0) ?? .today) }
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        // Sit the bar lower, into the home-indicator zone; the inset height (content clearance) is unchanged.
        .offset(y: router.isDeep ? 0 : 14)
        .animation(PFMotion.respecting(PFMotion.snappy), value: model.profile?.focus)
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
        switch route {
        case .task(let ref): TaskDetailScreen(ref: ref)
        case .personalTask(let tenantId, let id): PersonalTaskScreen(tenantId: tenantId, taskId: id)
        case .project(let tenantId, let projectId): ProjectScreen(tenantId: tenantId, projectId: projectId)
        case .initiative(let tenantId, let projectId, let initiativeId):
            InitiativeScreen(tenantId: tenantId, projectId: projectId, initiativeId: initiativeId)
        case .account: AccountScreen()
        case .notificationSettings: NotificationSettingsScreen()
        case .securitySettings: SecuritySettingsScreen()
        case .appearanceSettings: AppearanceSettingsScreen()
        case .team: TeamScreen()
        case .accountPage(let page): AccountPageView(page: page)
        case .designCatalog: DesignCatalogScreen()
        }
    }
}
