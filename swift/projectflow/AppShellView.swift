import SwiftUI

struct AppShellView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var appSession = AppSession.shared
    @StateObject private var networkMonitor = NetworkMonitor()

    var body: some View {
        VStack(spacing: 0) {
            if networkMonitor.isOffline {
                OfflineBanner()
            }

            Group {
                if session.isLoading {
                    ProgressView()
                } else if let user = session.user {
                    if session.userProfile == nil {
                        OnboardingWizardView()
                    } else if appSession.isLoadingTenant && appSession.activeTenantId == nil {
                        VStack(spacing: PFSpacing.md) {
                            ProgressView()
                            Text("Loading workspace…")
                                .font(.subheadline)
                                .foregroundStyle(PFColors.palette(for: colorScheme).textMuted)
                        }
                    } else {
                        MainTabView()
                            .environmentObject(appSession)
                    }
                } else {
                    LoginView()
                }
            }
        }
        .preferredColorScheme(appSession.preferredColorScheme())
        .onChange(of: session.user?.uid) { _, uid in
            if uid != nil {
                appSession.start(for: session.user)
            } else {
                appSession.stop()
            }
        }
        .onAppear {
            appSession.start(for: session.user)
        }
    }
}

struct MainTabView: View {
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var appSession: AppSession
    @State private var selection: MainTab = .home

    init() {
        UITabBar.appearance().isHidden = true
    }

    var body: some View {
        TabView(selection: $selection) {
            DashboardView(selectedTab: $selection)
                .tag(MainTab.home)

            ProjectsView()
                .tag(MainTab.projects)

            FocusCompanionView(selectedTab: $selection)
                .tag(MainTab.focus)

            WorkView()
                .tag(MainTab.work)

            NotificationsView()
                .tag(MainTab.inbox)
        }
        .toolbar(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            CustomTabBar(selection: $selection, unreadCount: appSession.notificationStore.unreadCount)
        }
        .onAppear {
            consumePendingNotificationDeepLink()
            ShareCaptureImportService.shared.importPendingCaptures()
        }
        .onReceive(NotificationCenter.default.publisher(for: .projectflowNotificationTapped)) { _ in
            consumePendingNotificationDeepLink()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                ShareCaptureImportService.shared.importPendingCaptures()
            }
        }
    }

    private func consumePendingNotificationDeepLink() {
        guard UserDefaults.standard.dictionary(forKey: NotificationDeepLinkStorage.userDefaultsKey) != nil else {
            return
        }
        selection = .inbox
        UserDefaults.standard.removeObject(forKey: NotificationDeepLinkStorage.userDefaultsKey)
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

import FirebaseAuth
