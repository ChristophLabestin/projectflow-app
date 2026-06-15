import SwiftUI

// MARK: - FocusCompanionView — Companion V2
//
// The "one thing now" surface: active focus + quick focus controls, attention
// counts, next-due work and pinned items. Data unchanged.

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
                    VStack(alignment: .leading, spacing: PFSpacing.lg) {
                        PFScreenHeader(
                            title: L10n.tr("focus.title", fallback: "Focus"),
                            subtitle: L10n.tr("focus.subtitle", fallback: "Active focus, deadlines and pinned work in one place.")
                        )

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
                    .pfTabBarClearance()
                    .tabBarScrollShrink()
                }
            }
            .navigationTitle(L10n.tr("focus.title", fallback: "Focus"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showPinnedTasks = true } label: {
                        Image(systemName: "pin.circle").foregroundStyle(colors.textMain)
                    }
                }
            }
            .sheet(isPresented: $showPinnedTasks) { PinnedTasksSheet() }
        }
        .onAppear {
            dashboardStore.start()
            pinnedTasksStore.start()
            tenantStore.update(for: session.user)
        }
        .onChange(of: session.user) { _, user in tenantStore.update(for: user) }
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
                    PFIconTile(icon: focusIcon, tint: focusTint, size: 40)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(focusLabel)
                            .font(PFFont.chip)
                            .foregroundStyle(focusTint)
                        Text(focusItem?.title ?? L10n.tr("focus.none", fallback: "No focus set"))
                            .font(PFFont.section)
                            .foregroundStyle(colors.textMain)
                            .lineLimit(2)
                        Text(focusItem == nil
                             ? L10n.tr("focus.none.message", fallback: "Pin a task to keep one thing in view.")
                             : focusDetail)
                            .font(PFFont.detail)
                            .foregroundStyle(colors.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }

                if focusItem == nil {
                    Button(action: onOpenPinned) {
                        Label(L10n.tr("focus.choose", fallback: "Choose pinned work"), systemImage: "pin")
                            .font(PFFont.rowTitle)
                            .foregroundStyle(colors.primary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, PFSpacing.sm)
                            .background(colors.primary.opacity(colorScheme == .dark ? 0.16 : 0.08))
                            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                    }
                    .buttonStyle(.plain)
                } else {
                    HStack(spacing: PFSpacing.sm) {
                        FocusActionButton(title: L10n.tr("focus.action.pinned", fallback: "Pinned"), icon: "pin", action: onOpenPinned)
                        FocusActionButton(title: L10n.tr("focus.action.snooze", fallback: "Snooze"), icon: "moon.zzz", action: onSnooze)
                        FocusActionButton(title: L10n.tr("focus.action.block", fallback: "Block"), icon: "xmark.octagon", action: onBlock)
                        FocusActionButton(title: L10n.tr("focus.action.clear", fallback: "Clear"), icon: "checkmark", action: onClear)
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
        case "blocked": return L10n.tr("focus.blocked", fallback: "Blocked focus")
        case "snoozed": return L10n.tr("focus.snoozed", fallback: "Snoozed focus")
        default: return L10n.tr("dashboard.focus.current", fallback: "Current focus")
        }
    }
    private var focusDetail: String {
        guard let state = focusState else { return "" }
        if let updatedAt = state.updatedAt, !updatedAt.isEmpty {
            return state.lastAction ?? ""
        }
        return ""
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
                Image(systemName: icon).font(.caption.weight(.semibold))
                Text(title).font(.caption2.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.8)
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
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let columns = [GridItem(.flexible(), spacing: PFSpacing.sm), GridItem(.flexible(), spacing: PFSpacing.sm)]

    var body: some View {
        LazyVGrid(columns: columns, spacing: PFSpacing.sm) {
            PFMetricTile(value: "\(overdue)", label: L10n.tr("dashboard.attention.overdue", fallback: "Overdue"), icon: "calendar.badge.exclamationmark", tint: colors.error)
            PFMetricTile(value: "\(dueToday)", label: L10n.tr("dashboard.attention.today", fallback: "Due today"), icon: "calendar", tint: colors.warning)
            PFMetricTile(value: "\(blocked)", label: L10n.tr("dashboard.attention.blocked", fallback: "Blocked"), icon: "xmark.octagon", tint: colors.error)
            PFMetricTile(value: "\(urgent)", label: L10n.tr("focus.attention.urgent", fallback: "Urgent"), icon: "bolt.fill", tint: colors.warning)
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
                PFSectionTitle(
                    title: L10n.tr("focus.nextDue", fallback: "Next due work"),
                    actionTitle: L10n.tr("tabs.work", fallback: "Tasks"),
                    action: onOpenTasks
                )
                if tasks.isEmpty {
                    Text(L10n.tr("dashboard.dueNext.empty", fallback: "No scheduled work in the next seven days."))
                        .font(PFFont.body)
                        .foregroundStyle(colors.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, PFSpacing.sm)
                } else {
                    VStack(spacing: 0) {
                        ForEach(tasks) { task in
                            NavigationLink {
                                ProjectTaskDetailView(task: task, tenantId: tenantId, permissions: permissions)
                            } label: {
                                PFListRow(
                                    title: task.title,
                                    subtitle: task.dueDate.isEmpty ? task.priority : task.dueDate,
                                    leadingDot: PFSemantic.priorityTint(task.priority, colors: colors)
                                )
                                .padding(.vertical, PFSpacing.sm)
                            }
                            .buttonStyle(.plain)
                            if task.id != tasks.last?.id { Divider() }
                        }
                    }
                }
            }
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
                PFSectionTitle(
                    title: L10n.tr("focus.pinned", fallback: "Pinned work"),
                    subtitle: String(format: L10n.tr("focus.pinned.count", fallback: "%d saved for later"), items.count),
                    actionTitle: L10n.tr("common.viewAll", fallback: "View all"),
                    action: onOpenPinned
                )
                if items.isEmpty {
                    Text(L10n.tr("focus.pinned.empty", fallback: "No pinned work yet."))
                        .font(PFFont.body)
                        .foregroundStyle(colors.textMuted)
                        .padding(.vertical, PFSpacing.sm)
                } else {
                    VStack(spacing: PFSpacing.sm) {
                        ForEach(items.prefix(5)) { item in
                            PFListRow(
                                title: item.title,
                                subtitle: item.type.capitalized,
                                icon: pinIcon(for: item.type),
                                iconTint: colors.textMuted,
                                showsChevron: false
                            )
                        }
                    }
                }
            }
        }
    }

    private func pinIcon(for type: String) -> String {
        switch type {
        case FocusItemType.initiative.rawValue: return "flag"
        case FocusItemType.personalTask.rawValue: return "person.crop.circle"
        default: return "checklist"
        }
    }
}
