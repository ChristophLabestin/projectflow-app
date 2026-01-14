import SwiftUI
import FirebaseAuth
import FirebaseCore

struct DashboardView: View {
    @Binding var selectedTab: MainTab
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var store = DashboardStore()
    @StateObject private var pinnedProjectStore = PinnedProjectStore()
    @StateObject private var pinnedTasksStore = PinnedTasksStore()
    @State private var showPinnedTasks = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("EEE, MMM d")
        return formatter
    }()

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()

                ScrollView(showsIndicators: false) {
                    content
                }
            }

            .toolbar { dashboardToolbar }
            .sheet(isPresented: $showPinnedTasks) {
                PinnedTasksSheet()
            }
        }
        .onAppear {
            store.start()
            pinnedTasksStore.start()
            if let user = Auth.auth().currentUser,
               let tenantId = TenantResolver.resolveTenantId(for: user) {
                pinnedProjectStore.start(tenantId: tenantId)
            }
        }
        .onDisappear {
            store.stop()
            pinnedProjectStore.stop()
            pinnedTasksStore.stop()
        }
    }

    @ToolbarContentBuilder
    private var dashboardToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button {
                showPinnedTasks = true
            } label: {
                Image(systemName: "pin.circle")
                    .foregroundStyle(colors.textMain)
            }
        }


        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button("Go to Projects") { selectedTab = .projects }
                Button("Go to Tasks") { selectedTab = .tasks }
                Button("Go to Issues") { selectedTab = .issues }
                Button("Go to Flows") { selectedTab = .flows }
            } label: {
                Image(systemName: "plus.circle")
                    .foregroundStyle(colors.textMain)
            }
        }

        ToolbarItem(placement: .topBarTrailing) {
            Button {
                selectedTab = .notifications
            } label: {
                Image(systemName: "bell")
                    .foregroundStyle(colors.textMain)
            }
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: PFSpacing.lg) {
            heroCard
            quickActions
            quickStatsSection
            focusSection
            chartsSection
            pinnedSection
            highlightsSection
            recentSection
        }
        .padding(PFSpacing.lg)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text(Self.dateFormatter.string(from: Date()).uppercased())
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(colors.textMuted)
            
            VStack(alignment: .leading, spacing: 0) {
                Text("\(greeting),")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(colors.textMain)
                
                Text(greetingName)
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(colors.textMain)
            }
            
            if store.dueTodayTaskCount > 0 {
                Text("You have \(store.dueTodayTaskCount) tasks due today.")
                    .font(.body)
                    .foregroundStyle(colors.textSubtle)
            } else {
                Text("You're all clear for today!")
                    .font(.body)
                    .foregroundStyle(colors.textSubtle)
            }
        }
        .padding(.vertical, PFSpacing.sm)
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            Text("Quick Actions")
                .font(.headline)
                .foregroundStyle(colors.textMain)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: PFSpacing.sm) {
                    DashboardActionButton(
                        title: "Projects",
                        icon: "square.stack.3d.down.forward",
                        tint: colors.primary
                    ) {
                        selectedTab = .projects
                    }

                    DashboardActionButton(
                        title: "Tasks",
                        icon: "checklist",
                        tint: colors.warning
                    ) {
                        selectedTab = .tasks
                    }

                    DashboardActionButton(
                        title: "Issues",
                        icon: "exclamationmark.bubble",
                        tint: colors.error
                    ) {
                        selectedTab = .issues
                    }

                    DashboardActionButton(
                        title: "Flows",
                        icon: "sparkles",
                        tint: colors.primaryLight
                    ) {
                        selectedTab = .flows
                    }

                    DashboardActionButton(
                        title: "Notifications",
                        icon: "bell",
                        tint: colors.primaryDark
                    ) {
                        selectedTab = .notifications
                    }
                }
            }
        }
    }

    private var quickStatsSection: some View {
        LazyVGrid(columns: columns, spacing: PFSpacing.md) {
            ForEach(quickStats) { stat in
                DashboardStatCard(stat: stat)
            }
        }
    }

    private var focusSection: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionHeader(title: "Focus Snapshot")

                LazyVGrid(columns: columns, spacing: PFSpacing.sm) {
                    DashboardFocusCard(
                        title: "Tasks Done",
                        value: "\(completedTaskCount)",
                        detail: "\(store.taskCount) total",
                        icon: "checkmark.circle",
                        tint: colors.success
                    )

                    DashboardFocusCard(
                        title: "Open Tasks",
                        value: "\(store.openTaskCount)",
                        detail: "Active",
                        icon: "checklist",
                        tint: colors.warning
                    )

                    DashboardFocusCard(
                        title: "Open Issues",
                        value: "\(store.openIssueCount)",
                        detail: "\(store.issueCount) total",
                        icon: "exclamationmark.bubble",
                        tint: colors.error
                    )

                    DashboardFocusCard(
                        title: "Flows",
                        value: "\(store.flowCount)",
                        detail: "In pipeline",
                        icon: "sparkles",
                        tint: colors.primaryLight
                    )
                }
            }
        }
    }

    private var chartsSection: some View {
        VStack(spacing: PFSpacing.md) {
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.sm) {
                    PFSectionHeader(title: "Task Completion")

                    ProgressView(value: taskCompletionRatio)
                        .tint(colors.primary)

                    HStack {
                        Text("\(completedTaskCount) completed")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                        Spacer()
                        Text("\(store.openTaskCount) open")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                    }
                }
            }

            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.sm) {
                    PFSectionHeader(title: "Issue Load")

                    HStack(spacing: PFSpacing.md) {
                        DashboardHeroMetric(title: "Open", value: "\(store.openIssueCount)", tint: colors.error)
                        DashboardHeroMetric(title: "Total", value: "\(store.issueCount)", tint: colors.surfaceHover)
                        DashboardHeroMetric(title: "Flows", value: "\(store.flowCount)", tint: colors.primaryLight)
                    }
                }
            }
        }
    }

    private var pinnedSection: some View { EmptyView() }

    private var highlightsSection: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionHeader(title: "Latest Highlights")

                if highlightItems.isEmpty {
                    Text("No highlights yet.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                } else {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        ForEach(highlightItems) { item in
                            DashboardHighlightRow(item: item)
                        }
                    }
                }
            }
        }
    }

    private var recentSection: some View {
        VStack(spacing: PFSpacing.md) {
            // Enhanced Tasks Card
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.sm) {
                    HStack {
                        PFSectionHeader(title: "Recent Tasks")
                        Spacer()
                        if !store.recentTasks.isEmpty {
                            Button {
                                selectedTab = .tasks
                            } label: {
                                Text("See All")
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(colors.primary)
                            }
                        }
                    }

                    if store.recentTasks.isEmpty {
                        Text("No tasks yet.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                    } else {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            ForEach(store.recentTasks) { task in
                                DashboardTaskRow(task: task)
                            }
                        }
                    }
                }
            }

            recentCard(
                title: "Recent Issues",
                emptyMessage: "No issues yet.",
                rows: store.recentIssues.map { issue in
                    DashboardRow(title: issue.title, detail: issue.status)
                }
            )

            recentCard(
                title: "Recent Flows",
                emptyMessage: "No flows yet.",
                rows: store.recentFlows.map { flow in
                    DashboardRow(title: flow.title, detail: flow.stage)
                }
            )
        }
    }
    
    // Pinned Cards Removed

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12:
            return "Good morning"
        case 12..<17:
            return "Good afternoon"
        case 17..<22:
            return "Good evening"
        default:
            return "Welcome"
        }
    }

    private var greetingName: String {
        if let name = session.user?.displayName, !name.isEmpty {
            return name
        }
        if let email = session.user?.email,
           let prefix = email.split(separator: "@").first {
            return String(prefix)
        }
        return "there"
    }

    private var quickStats: [DashboardStat] {
        [
            DashboardStat(
                title: "Projects",
                value: "\(store.projectCount)",
                detail: "Tracked",
                icon: "square.stack.3d.down.forward",
                tint: colors.primary
            ),
            DashboardStat(
                title: "Open Tasks",
                value: "\(store.openTaskCount)",
                detail: "\(store.taskCount) total",
                icon: "checklist",
                tint: colors.warning
            ),
            DashboardStat(
                title: "Open Issues",
                value: "\(store.openIssueCount)",
                detail: "\(store.issueCount) total",
                icon: "exclamationmark.bubble",
                tint: colors.error
            ),
            DashboardStat(
                title: "Flows",
                value: "\(store.flowCount)",
                detail: "In pipeline",
                icon: "sparkles",
                tint: colors.primaryLight
            )
        ]
    }

    private var completedTaskCount: Int {
        max(store.taskCount - store.openTaskCount, 0)
    }

    private var taskCompletionRatio: Double {
        guard store.taskCount > 0 else { return 0 }
        return Double(completedTaskCount) / Double(store.taskCount)
    }

    private var highlightItems: [DashboardHighlight] {
        let taskItems = store.recentTasks.map { task in
            DashboardHighlight(
                id: "task-\(task.id)",
                title: task.title,
                detail: task.status.isEmpty ? "Open" : task.status,
                typeLabel: "Task",
                icon: "checklist",
                timestamp: task.createdAt?.dateValue()
            )
        }

        let issueItems = store.recentIssues.map { issue in
            DashboardHighlight(
                id: "issue-\(issue.id)",
                title: issue.title,
                detail: issue.status,
                typeLabel: "Issue",
                icon: "exclamationmark.bubble",
                timestamp: issue.createdAt?.dateValue()
            )
        }

        let flowItems = store.recentFlows.map { flow in
            DashboardHighlight(
                id: "flow-\(flow.id)",
                title: flow.title,
                detail: flow.stage,
                typeLabel: "Flow",
                icon: "sparkles",
                timestamp: flow.createdAt?.dateValue()
            )
        }

        let combined = taskItems + issueItems + flowItems
        return combined.sorted { left, right in
            let leftDate = left.timestamp ?? Date.distantPast
            let rightDate = right.timestamp ?? Date.distantPast
            return leftDate > rightDate
        }.prefix(6).map { $0 }
    }
}

private struct DashboardHeroMetric: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: String
    let tint: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(colors.textMuted)

            Text(value)
                .font(.title3.weight(.semibold))
                .foregroundStyle(colors.textMain)
        }
        .padding(.vertical, PFSpacing.sm)
        .padding(.horizontal, PFSpacing.md)
        .background(tint.opacity(colorScheme == .dark ? 0.15 : 0.1))
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
    }
}

private struct DashboardActionButton: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let icon: String
    let tint: Color
    let action: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: action) {
            HStack(spacing: PFSpacing.sm) {
                Circle()
                    .fill(tint.opacity(colorScheme == .dark ? 0.2 : 0.15))
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: icon)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(tint)
                    )

                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(colors.textMain)
            }
            .padding(.horizontal, PFSpacing.md)
            .padding(.vertical, PFSpacing.sm)
            .background(colors.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
            .shadow(color: colors.shadowSm, radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }
}

private struct DashboardStat: Identifiable {
    let id = UUID()
    let title: String
    let value: String
    let detail: String
    let icon: String
    let tint: Color
}

private struct DashboardHighlight: Identifiable {
    let id: String
    let title: String
    let detail: String
    let typeLabel: String
    let icon: String
    let timestamp: Date?
}

private struct DashboardStatCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let stat: DashboardStat

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: PFSpacing.xs) {
                        Text(stat.title.uppercased())
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(colors.textMuted)
                        Text(stat.value)
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                    }

                    Spacer()

                    Circle()
                        .fill(stat.tint.opacity(0.2))
                        .frame(width: 36, height: 36)
                        .overlay(
                            Image(systemName: stat.icon)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(stat.tint)
                        )
                }

                Text(stat.detail)
                    .font(.caption)
                    .foregroundStyle(colors.textSubtle)
            }
        }
    }
}

private struct DashboardFocusCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: String
    let detail: String
    let icon: String
    let tint: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            HStack {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMuted)
                Spacer()
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(tint)
            }

            Text(value)
                .font(.title3.weight(.semibold))
                .foregroundStyle(colors.textMain)

            Text(detail)
                .font(.caption)
                .foregroundStyle(colors.textSubtle)
        }
        .padding(PFSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(colors.surfaceHover)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

private struct DashboardHighlightRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let item: DashboardHighlight

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            Circle()
                .fill(colors.surfaceHover)
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: item.icon)
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                )

            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text(item.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)
                Text(item.detail)
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            }

            Spacer()

            Text(item.typeLabel.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(colors.textSubtle)
                .padding(.horizontal, PFSpacing.xs)
                .padding(.vertical, 2)
                .background(colors.surfaceHover)
                .clipShape(Capsule())
        }
    }
}

private struct PinnedItemRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let item: PinnedItem

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            Circle()
                .fill(colors.surfaceHover)
                .frame(width: 30, height: 30)
                .overlay(
                    Image(systemName: item.isCompleted == true ? "checkmark" : "pin.fill")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                )

            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text(item.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)

                HStack(spacing: PFSpacing.xs) {
                    Text(item.type.capitalized)
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)

                    if let priority = item.priority, !priority.isEmpty {
                        Text("• \(priority) priority")
                            .font(.caption)
                            .foregroundStyle(colors.textSubtle)
                    }
                }
            }

            Spacer()

            if item.isCompleted == true {
                Text("Done")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.success)
            }
        }
    }
}

private struct StatusPill: View {
    @Environment(\.colorScheme) private var colorScheme
    let text: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(colors.textMain)
            .padding(.horizontal, PFSpacing.sm)
            .padding(.vertical, 4)
            .background(colors.surfaceHover)
            .clipShape(Capsule())
    }
}

private struct DashboardRow: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
}

private extension DashboardView {
    func recentCard(title: String, emptyMessage: String, rows: [DashboardRow]) -> some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionHeader(title: title)

                if rows.isEmpty {
                    Text(emptyMessage)
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                } else {
                    VStack(alignment: .leading, spacing: PFSpacing.xs) {
                        ForEach(rows) { row in
                            HStack {
                                Text(row.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(colors.textMain)
                                    .lineLimit(1)

                                Spacer()

                                Text(row.detail)
                                    .font(.caption)
                                    .foregroundStyle(colors.textMuted)
                            }
                        }
                    }
                }
            }
        }
    }
}
