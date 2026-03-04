import SwiftUI
import FirebaseAuth

struct NotificationsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var store = NotificationStore()
    @State private var showingClearAllConfirm = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: PFSpacing.lg) {
                        if store.isLoading {
                            PFCard {
                                HStack(spacing: PFSpacing.sm) {
                                    ProgressView()
                                    Text("Loading notifications...")
                                        .foregroundStyle(colors.textMuted)
                                }
                            }
                        } else if store.items.isEmpty {
                            PFCard {
                                VStack(alignment: .leading, spacing: PFSpacing.sm) {
                                    Text("You're all caught up.")
                                        .font(.headline)
                                        .foregroundStyle(colors.textMain)
                                    Text("Project and task updates will show here.")
                                        .font(.subheadline)
                                        .foregroundStyle(colors.textMuted)
                                }
                            }
                        } else {
                            VStack(spacing: PFSpacing.md) {
                                ForEach(store.items) { notification in
                                    notificationLink(for: notification)
                                        .swipeActions(edge: .trailing) {
                                            Button(role: .destructive) {
                                                store.deleteNotification(notification)
                                            } label: {
                                                Label("Delete", systemImage: "trash")
                                            }
                                        }
                                }
                            }
                        }
                    }
                    .padding(PFSpacing.lg)
                }
            }
            .navigationTitle("Notifications")
            .toolbar {
                if !store.items.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button {
                                store.markAllAsRead()
                            } label: {
                                Label("Mark all as read", systemImage: "checkmark.circle")
                            }
                            
                            Button(role: .destructive) {
                                showingClearAllConfirm = true
                            } label: {
                                Label("Clear all", systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .foregroundStyle(colors.textMain)
                        }
                    }
                }
            }
            .confirmationDialog("Clear all notifications?", isPresented: $showingClearAllConfirm, titleVisibility: .visible) {
                Button("Clear All", role: .destructive) {
                    store.clearAll()
                }
                Button("Cancel", role: .cancel) {}
            }
        }
        .onAppear {
            if session.user != nil {
                store.start()
            }
        }
        .onDisappear {
            store.stop()
        }
        .onChange(of: session.user?.uid) { _, _ in
            store.start()
        }
    }

    @ViewBuilder
    private func notificationLink(for notification: AppNotification) -> some View {
        if let projectId = notification.projectId {
            NavigationLink(destination: ProjectDeepLinkView(tenantId: notification.tenantId, projectId: projectId)) {
                NotificationRow(notification: notification, store: store)
            }
            .buttonStyle(.plain)
            .simultaneousGesture(TapGesture().onEnded {
                store.markAsRead(notification)
            })
        } else {
            NotificationRow(notification: notification, store: store)
                .onTapGesture {
                    store.markAsRead(notification)
                }
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

                    VStack(alignment: .leading, spacing: PFSpacing.xs) {
                        HStack {
                            Text(notification.title)
                                .font(.headline)
                                .foregroundStyle(colors.textMain)
                            Spacer()
                            Text(relativeTime(notification.createdAt))
                                .font(.caption)
                                .foregroundStyle(colors.textSubtle)
                        }
                        Text(notification.message)
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                    }
                }
                
                if notification.type == "project_join_request" || notification.type == "project_invite" {
                    HStack(spacing: PFSpacing.md) {
                        Button {
                            _Concurrency.Task {
                                await store.respondToInvite(notification: notification, accept: true)
                            }
                        } label: {
                            Text("Accept")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, PFSpacing.md)
                                .padding(.vertical, 6)
                                .background(colors.primary)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        
                        Button {
                            _Concurrency.Task {
                                await store.respondToInvite(notification: notification, accept: false)
                            }
                        } label: {
                            Text("Decline")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(colors.textMuted)
                                .padding(.horizontal, PFSpacing.md)
                                .padding(.vertical, 6)
                                .background(colors.surfaceHover)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.leading, 24)
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
