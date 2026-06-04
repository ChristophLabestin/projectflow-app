import SwiftUI
import FirebaseAuth

struct FocusCompanionView: View {
    @Binding var selectedTab: MainTab
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var dashboardStore = DashboardStore()
    @StateObject private var pinnedTasksStore = PinnedTasksStore()
    @StateObject private var tenantStore = TenantStore()
    @State private var showPinnedTasks = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 14) {
                        FocusCompanionHeader()
                        CurrentFocusPanel(
                            focusItem: pinnedTasksStore.focusItem,
                            focusState: pinnedTasksStore.focusState,
                            onOpenPinned: { showPinnedTasks = true },
                            onSnooze: { pinnedTasksStore.snoozeFocus() },
                            onBlock: { pinnedTasksStore.blockFocus() },
                            onClear: { pinnedTasksStore.clearFocus() }
                        )
                        AttentionGrid(
                            overdue: dashboardStore.overdueTaskCount,
                            dueToday: dashboardStore.dueTodayTaskCount,
                            blocked: dashboardStore.blockedTaskCount,
                            urgent: dashboardStore.urgentTaskCount
                        )
                        DueWorkPreview(
                            tasks: nextDueTasks,
                            tenantId: tenantStore.activeTenantId ?? "",
                            permissions: tenantStore.permissionContext(),
                            onOpenTasks: { selectedTab = .work }
                        )
                        PinnedItemsPreview(
                            items: pinnedTasksStore.pinnedItems,
                            onOpenPinned: { showPinnedTasks = true }
                        )
                    }
                    .pfScreenPadding(vertical: PFSpacing.md)
                    .padding(.bottom, PFSpacing.xl)
                }
            }
            .navigationTitle("Focus")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showPinnedTasks = true
                    } label: {
                        Image(systemName: "pin.circle")
                            .foregroundStyle(colors.textMain)
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        selectedTab = .work
                    } label: {
                        Image(systemName: "checklist")
                            .foregroundStyle(colors.textMain)
                    }
                }
            }
            .sheet(isPresented: $showPinnedTasks) {
                PinnedTasksSheet()
            }
        }
        .onAppear {
            dashboardStore.start()
            pinnedTasksStore.start()
            tenantStore.update(for: session.user)
        }
        .onChange(of: session.user) { _, user in
            tenantStore.update(for: user)
        }
        .onDisappear {
            dashboardStore.stop()
            pinnedTasksStore.stop()
            tenantStore.stop()
        }
    }

    private var nextDueTasks: [ProjectTask] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let upcomingDays = (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: today) }
        return upcomingDays
            .flatMap { dashboardStore.scheduledTasks[$0] ?? [] }
            .filter { !$0.isCompleted }
            .prefix(5)
            .map { $0 }
    }
}

private struct FocusCompanionHeader: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text("What's important now")
                .font(.title2.weight(.bold))
                .foregroundStyle(colors.textMain)

            Text("Active focus, deadlines, and pinned work in one place.")
                .font(.subheadline)
                .foregroundStyle(colors.textMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct CurrentFocusPanel: View {
    let focusItem: PinnedItem?
    let focusState: ProjectFlowFocusState?
    let onOpenPinned: () -> Void
    let onSnooze: () -> Void
    let onBlock: () -> Void
    let onClear: () -> Void

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    Image(systemName: focusItem == nil ? "scope" : focusIcon)
                        .font(.headline)
                        .foregroundStyle(focusTint)
                        .frame(width: 38, height: 38)
                        .background(focusTint.opacity(colorScheme == .dark ? 0.18 : 0.12))
                        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))

                    VStack(alignment: .leading, spacing: 3) {
                        Text(focusLabel)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(focusTint)

                        Text(focusItem?.title ?? "No active focus selected")
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                            .lineLimit(2)

                        Text(focusItem == nil ? "No pinned focus is active." : focusDetail)
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 0)
                }

                if focusItem == nil {
                    Button(action: onOpenPinned) {
                        Label("Choose pinned work", systemImage: "pin")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(colors.primary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, PFSpacing.sm)
                            .background(colors.primary.opacity(colorScheme == .dark ? 0.16 : 0.08))
                            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                } else {
                    HStack(spacing: PFSpacing.sm) {
                        FocusActionButton(title: "Pinned", icon: "pin", action: onOpenPinned)
                        FocusActionButton(title: "Snooze", icon: "moon.zzz", action: onSnooze)
                        FocusActionButton(title: "Block", icon: "xmark.octagon", action: onBlock)
                        FocusActionButton(title: "Clear", icon: "checkmark", action: onClear)
                    }
                }
            }
        }
    }

    private var focusIcon: String {
        switch focusState?.status {
        case "blocked": return "xmark.octagon.fill"
        case "snoozed": return "moon.zzz.fill"
        default: return "scope"
        }
    }

    private var focusTint: Color {
        switch focusState?.status {
        case "blocked": return colors.error
        case "snoozed": return colors.textMuted
        default: return colors.primary
        }
    }

    private var focusLabel: String {
        switch focusState?.status {
        case "blocked": return "Blocked focus"
        case "snoozed": return "Snoozed focus"
        default: return "Current focus"
        }
    }

    private var focusDetail: String {
        guard let state = focusState else { return "Ready to continue." }
        if let updatedAt = state.updatedAt, !updatedAt.isEmpty {
            return "Last action: \(state.lastAction ?? "updated")"
        }
        return "Ready to continue."
    }
}

private struct FocusActionButton: View {
    let title: String
    let icon: String
    let action: () -> Void
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption.weight(.semibold))
                Text(title)
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(colors.textMain)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(colors.surfaceHover)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

private struct AttentionGrid: View {
    let overdue: Int
    let dueToday: Int
    let blocked: Int
    let urgent: Int

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        LazyVGrid(columns: columns, spacing: PFSpacing.sm) {
            AttentionTile(title: "Overdue", value: overdue, icon: "calendar.badge.exclamationmark", tint: .red)
            AttentionTile(title: "Due today", value: dueToday, icon: "calendar", tint: .orange)
            AttentionTile(title: "Blocked", value: blocked, icon: "xmark.octagon", tint: .red)
            AttentionTile(title: "Urgent", value: urgent, icon: "bolt.fill", tint: .orange)
        }
    }
}

private struct AttentionTile: View {
    let title: String
    let value: Int
    let icon: String
    let tint: Color
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            HStack(spacing: PFSpacing.sm) {
                Image(systemName: icon)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(tint)
                    .frame(width: 30, height: 30)
                    .background(tint.opacity(colorScheme == .dark ? 0.18 : 0.1))
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.sm, style: .continuous))

                VStack(alignment: .leading, spacing: 2) {
                    Text("\(value)")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(colors.textMain)
                    Text(title)
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)
            }
        }
    }
}

private struct DueWorkPreview: View {
    let tasks: [ProjectTask]
    let tenantId: String
    let permissions: PermissionContext
    let onOpenTasks: () -> Void

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                HStack {
                    PFSectionHeader(title: "Next due work", subtitle: "Upcoming deadlines")
                    Spacer()
                    Button("Tasks", action: onOpenTasks)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(colors.primary)
                }

                if tasks.isEmpty {
                    Text("No scheduled tasks in the next seven days.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, PFSpacing.sm)
                } else {
                    VStack(spacing: 0) {
                        ForEach(tasks) { task in
                            NavigationLink(destination: ProjectTaskDetailView(task: task, tenantId: tenantId, permissions: permissions)) {
                                FocusTaskRow(task: task)
                            }
                            .buttonStyle(.plain)

                            if task.id != tasks.last?.id {
                                Divider()
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct FocusTaskRow: View {
    let task: ProjectTask
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            Circle()
                .fill(priorityColor)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)
                Text(task.dueDate.isEmpty ? "No due date" : task.dueDate)
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(colors.textSubtle)
        }
        .padding(.vertical, PFSpacing.sm)
    }

    private var priorityColor: Color {
        switch task.priority {
        case "Urgent": return colors.error
        case "High": return colors.warning
        case "Low": return colors.success
        default: return colors.primary
        }
    }
}

private struct PinnedItemsPreview: View {
    let items: [PinnedItem]
    let onOpenPinned: () -> Void
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                HStack {
                    PFSectionHeader(title: "Pinned work", subtitle: "\(items.count) saved for later")
                    Spacer()
                    Button(action: onOpenPinned) {
                        Image(systemName: "arrow.up.right")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(colors.textMuted)
                    }
                }

                if items.isEmpty {
                    Text("No pinned work yet.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                        .padding(.vertical, PFSpacing.sm)
                } else {
                    VStack(spacing: PFSpacing.xs) {
                        ForEach(items.prefix(4)) { item in
                            HStack(spacing: PFSpacing.sm) {
                                Image(systemName: "checklist")
                                    .font(.caption)
                                    .foregroundStyle(colors.textMuted)
                                    .frame(width: 28, height: 28)
                                    .background(colors.surfaceHover)
                                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.sm, style: .continuous))

                                Text(item.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(colors.textMain)
                                    .lineLimit(1)

                                Spacer(minLength: 0)
                            }
                        }
                    }
                }
            }
        }
    }
}
