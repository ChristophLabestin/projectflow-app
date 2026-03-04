import SwiftUI

struct AppShellView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var networkMonitor = NetworkMonitor()

    var body: some View {
        VStack(spacing: 0) {
            if networkMonitor.isOffline {
                OfflineBanner()
            }

            Group {
                if session.isLoading {
                    ProgressView()
                } else if let _ = session.user {
                    if session.userProfile == nil {
                        OnboardingWizardView()
                    } else {
                        MainTabView()
                    }
                } else {
                    LoginView()
                }
            }
        }
    }
}

enum MainTab: Hashable {
    case dashboard
    case projects
    case tasks
    case flows
    case issues
    case notifications
    case settings
}

struct MainTabView: View {
    @State private var selection: MainTab = .dashboard

    init() {
        UITabBar.appearance().isHidden = true
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selection) {
                DashboardView(selectedTab: $selection)
                    .tabItem { Label("Dashboard", systemImage: "rectangle.grid.2x2") }
                    .tag(MainTab.dashboard)

                ProjectsView()
                    .tabItem { Label("Projects", systemImage: "square.stack.3d.down.forward") }
                    .tag(MainTab.projects)

                TasksView()
                    .tabItem { Label("Tasks", systemImage: "checklist") }
                    .tag(MainTab.tasks)

                FlowsView()
                    .tabItem { Label("Flows", systemImage: "sparkles") }
                    .tag(MainTab.flows)

                IssuesView()
                    .tabItem { Label("Issues", systemImage: "exclamationmark.bubble") }
                    .tag(MainTab.issues)

                NotificationsView()
                    .tabItem { Label("Notifications", systemImage: "bell") }
                    .tag(MainTab.notifications)

                SettingsView()
                    .tabItem { Label("Settings", systemImage: "gearshape") }
                    .tag(MainTab.settings)
            }
            .toolbar(.hidden, for: .tabBar)
            .padding(.bottom, 100)

            CustomTabBar(selection: $selection)
        }
        .ignoresSafeArea(edges: .bottom)
    }
}

private struct OfflineBanner: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            Image(systemName: "wifi.slash")
            Text("You're offline. Some data may be stale.")
                .font(.footnote.weight(.semibold))
        }
        .foregroundStyle(colors.textOnDark)
        .padding(.vertical, PFSpacing.xs)
        .frame(maxWidth: .infinity)
        .background(colors.warning)
    }
}
