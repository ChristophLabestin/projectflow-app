import SwiftUI
import FirebaseAuth

struct NotificationsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var store = NotificationStore()

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text("Notifications")
                    .font(.largeTitle)
                    .foregroundStyle(colors.textMain)

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
                            NotificationRow(notification: notification)
                                .onTapGesture {
                                    store.markAsRead(notification)
                                }
                        }
                    }
                }
            }
            .padding(PFSpacing.lg)
        }
        .background(colors.surfaceBg.ignoresSafeArea())
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
}

private struct NotificationRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let notification: AppNotification

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            HStack(alignment: .top, spacing: PFSpacing.md) {
                Circle()
                    .fill(notification.read ? colors.surfaceBorder : colors.primary)
                    .frame(width: 8, height: 8)
                    .padding(.top, PFSpacing.xs)

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
