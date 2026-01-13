import SwiftUI

struct AppShellView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            if session.isLoading {
                ProgressView()
            } else if session.user != nil {
                MainTabView()
            } else {
                LoginView()
            }
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Dashboard", systemImage: "rectangle.grid.2x2") }

            ProjectsView()
                .tabItem { Label("Projects", systemImage: "square.stack.3d.down.forward") }

            TasksView()
                .tabItem { Label("Tasks", systemImage: "checklist") }

            FlowsView()
                .tabItem { Label("Flows", systemImage: "sparkles") }

            IssuesView()
                .tabItem { Label("Issues", systemImage: "exclamationmark.bubble") }

            NotificationsView()
                .tabItem { Label("Notifications", systemImage: "bell") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}
