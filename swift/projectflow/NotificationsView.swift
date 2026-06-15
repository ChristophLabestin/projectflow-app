import SwiftUI
import FirebaseAuth

#if os(iOS)
import UserNotifications
#endif

// MARK: - NotificationsView (Inbox) — Companion V2

struct NotificationsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var store = NotificationStore()
    @State private var showingClearAllConfirm = false
#if os(iOS)
    @State private var authorizationStatus: UNAuthorizationStatus = .notDetermined
#endif
    @State private var pushToken: String?
    @State private var lastTokenSyncDate: Date?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: PFSpacing.md) {
                        deliveryStatusCard

                        if store.isLoading && store.items.isEmpty {
                            ProgressView().frame(maxWidth: .infinity).padding(.top, PFSpacing.xl)
                        } else if store.items.isEmpty {
                            PFEmptyState(
                                icon: "bell",
                                title: L10n.tr("inbox.empty", fallback: "You're all caught up"),
                                message: L10n.tr("inbox.empty.message", fallback: "New notifications will show up here.")
                            )
                            .padding(.top, PFSpacing.lg)
                        } else {
                            VStack(spacing: PFSpacing.sm) {
                                ForEach(store.items) { notification in
                                    notificationLink(for: notification)
                                        .swipeActions(edge: .trailing) {
                                            Button(role: .destructive) {
                                                store.deleteNotification(notification)
                                            } label: {
                                                Label(L10n.tr("common.delete", fallback: "Delete"), systemImage: "trash")
                                            }
                                        }
                                }
                            }
                        }
                    }
                    .pfScreenPadding(vertical: PFSpacing.md)
                    .pfTabBarClearance()
                    .tabBarScrollShrink()
                }
            }
            .navigationTitle(L10n.tr("inbox.title", fallback: "Inbox"))
            .toolbar {
                if !store.items.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button {
                                store.markAllAsRead()
                            } label: {
                                Label(L10n.tr("inbox.markAllRead", fallback: "Mark all read"), systemImage: "checkmark.circle")
                            }
                            Button(role: .destructive) {
                                showingClearAllConfirm = true
                            } label: {
                                Label(L10n.tr("inbox.clearAll", fallback: "Clear all"), systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle").foregroundStyle(colors.textMain)
                        }
                    }
                }
            }
            .confirmationDialog(L10n.tr("inbox.clearAll.confirm", fallback: "Clear all notifications?"), isPresented: $showingClearAllConfirm, titleVisibility: .visible) {
                Button(L10n.tr("inbox.clearAll", fallback: "Clear all"), role: .destructive) { store.clearAll() }
                Button(L10n.tr("common.cancel", fallback: "Cancel"), role: .cancel) {}
            }
        }
        .onAppear {
            if session.user != nil { store.start() }
            refreshDeliveryDiagnostics()
        }
        .onDisappear { store.stop() }
        .onChange(of: session.user?.uid) { _, _ in
            store.start()
            refreshDeliveryDiagnostics()
        }
    }

    private var deliveryStatusCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    PFIconTile(icon: "bell.badge", tint: colors.primary, size: 38)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(L10n.tr("inbox.delivery", fallback: "Delivery status"))
                            .font(PFFont.rowTitle)
                            .foregroundStyle(colors.textMain)
                        Text(L10n.tr("inbox.delivery.subtitle", fallback: "Push readiness for this device."))
                            .font(PFFont.detail)
                            .foregroundStyle(colors.textMuted)
                    }
                    Spacer()
                    Button { refreshDeliveryDiagnostics() } label: {
                        Image(systemName: "arrow.clockwise").foregroundStyle(colors.textMuted)
                    }
                    .buttonStyle(.plain)
                }

                VStack(spacing: PFSpacing.sm) {
                    diagnosticRow(label: L10n.tr("inbox.permission", fallback: "Permission"), value: authorizationStatusLabel)
                    Divider()
                    diagnosticRow(label: L10n.tr("inbox.token", fallback: "FCM token"), value: pushTokenLabel)
                    Divider()
                    diagnosticRow(label: L10n.tr("inbox.lastSync", fallback: "Last sync"), value: lastTokenSyncLabel)
                }
            }
        }
    }

    private func diagnosticRow(label: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).font(PFFont.body).foregroundStyle(colors.textMuted)
            Spacer(minLength: PFSpacing.md)
            Text(value)
                .font(PFFont.body.weight(.semibold))
                .foregroundStyle(colors.textMain)
                .multilineTextAlignment(.trailing)
        }
    }

    private var authorizationStatusLabel: String {
#if os(iOS)
        switch authorizationStatus {
        case .authorized: return "Allowed"
        case .denied: return "Blocked"
        case .notDetermined: return "Not requested"
        case .provisional: return "Provisional"
        case .ephemeral: return "Ephemeral"
        @unknown default: return "Unknown"
        }
#else
        return "Unsupported"
#endif
    }

    private var pushTokenLabel: String {
        guard let pushToken, !pushToken.isEmpty else { return "Not synced" }
        return "\(pushToken.prefix(10))..."
    }

    private var lastTokenSyncLabel: String {
        guard let lastTokenSyncDate else { return "Never" }
        return lastTokenSyncDate.formatted(date: .abbreviated, time: .shortened)
    }

    private func refreshDeliveryDiagnostics() {
        pushToken = PushTokenManager.shared.currentToken
        lastTokenSyncDate = PushTokenManager.shared.lastSyncDate
#if os(iOS)
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async { authorizationStatus = settings.authorizationStatus }
        }
#endif
    }

    @ViewBuilder
    private func notificationLink(for notification: AppNotification) -> some View {
        if let projectId = notification.projectId {
            NavigationLink(destination: ProjectDeepLinkView(
                tenantId: notification.tenantId,
                projectId: projectId,
                taskId: notification.taskId,
                initiativeId: notification.initiativeId
            )) {
                NotificationRow(notification: notification, store: store)
            }
            .buttonStyle(.plain)
            .simultaneousGesture(TapGesture().onEnded { store.markAsRead(notification) })
        } else {
            NotificationRow(notification: notification, store: store)
                .onTapGesture { store.markAsRead(notification) }
        }
    }
}

private struct NotificationRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let notification: AppNotification
    @ObservedObject var store: NotificationStore

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    Circle()
                        .fill(notification.read ? colors.surfaceBorder : colors.primary)
                        .frame(width: 8, height: 8)
                        .padding(.top, 6)

                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(notification.title)
                                .font(PFFont.rowTitle)
                                .foregroundStyle(colors.textMain)
                            Spacer()
                            Text(relativeTime(notification.createdAt))
                                .font(PFFont.detail)
                                .foregroundStyle(colors.textSubtle)
                        }
                        Text(notification.message)
                            .font(PFFont.body)
                            .foregroundStyle(colors.textMuted)
                    }
                }

                if notification.type == "project_join_request" || notification.type == "project_invite" {
                    HStack(spacing: PFSpacing.md) {
                        Button {
                            Task { await store.respondToInvite(notification: notification, accept: true) }
                        } label: {
                            Text(L10n.tr("common.accept", fallback: "Accept"))
                                .font(PFFont.chip)
                                .foregroundStyle(colors.primaryText)
                                .padding(.horizontal, PFSpacing.md)
                                .padding(.vertical, 6)
                                .background(colors.primary)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)

                        Button {
                            Task { await store.respondToInvite(notification: notification, accept: false) }
                        } label: {
                            Text(L10n.tr("common.decline", fallback: "Decline"))
                                .font(PFFont.chip)
                                .foregroundStyle(colors.textMuted)
                                .padding(.horizontal, PFSpacing.md)
                                .padding(.vertical, 6)
                                .background(colors.surfaceHover)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.leading, 20)
                }
            }
        }
    }

    private func relativeTime(_ date: Date?) -> String {
        guard let date else { return "Just now" }
        let seconds = Int(Date().timeIntervalSince(date))
        if seconds < 60 { return "Just now" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h ago" }
        let days = hours / 24
        return "\(days)d ago"
    }
}
