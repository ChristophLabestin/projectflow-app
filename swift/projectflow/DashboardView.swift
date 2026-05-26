import SwiftUI
import FirebaseAuth
import FirebaseCore
import Charts

struct DashboardView: View {
    @Binding var selectedTab: MainTab
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var store = DashboardStore()
    @StateObject private var projectsStore = ProjectsStore()
    @StateObject private var pinnedProjectStore = PinnedProjectStore()
    @StateObject private var pinnedTasksStore = PinnedTasksStore()
    @StateObject private var tenantStore = TenantStore()
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
            tenantStore.update(for: session.user)
            if let user = Auth.auth().currentUser,
               let tenantId = TenantResolver.resolveTenantId(for: user) {
                pinnedProjectStore.start(tenantId: tenantId)
                projectsStore.start(tenantId: tenantId)
            }
        }
        .onDisappear {
            store.stop()
            projectsStore.stop()
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
            activeProjectsCarousel
            quickActions
            quickStatsSection
            focusSection
            calendarSection
            chartsSection
            pinnedSection
            highlightsSection
            recentSection
        }
        .pfScreenPadding()
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

    private var activeProjectsCarousel: some View {
        let active = projectsStore.projects.filter { $0.status == "Active" }
        return VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionHeader(title: "Active Projects", subtitle: "Jump back into your work")

            if active.isEmpty && !projectsStore.isLoading {
                PFCard {
                    Text("No active projects found.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                }
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: PFSpacing.md) {
                        ForEach(active) { project in
                            NavigationLink(destination: ProjectOverviewView(
                                project: project,
                                tenantId: tenantStore.activeTenantId ?? ""
                            )) {
                                DashboardProjectCard(project: project)
                                    .frame(width: UIScreen.main.bounds.width * 0.65)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 4) // Slight padding for shadows
                }
            }
        }
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
                Button {
                    handleStatTap(stat)
                } label: {
                    DashboardStatCard(stat: stat)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var focusSection: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionHeader(title: "Focus Snapshot")

                if let focusItem = pinnedTasksStore.focusItem {
                    currentFocusCard(focusItem)
                }

                LazyVGrid(columns: columns, spacing: PFSpacing.sm) {
                    DashboardFocusCard(
                        title: "Tasks Done",
                        value: "\(completedTaskCount)",
                        detail: "\(store.taskCount) total",
                        icon: "checkmark.circle",
                        tint: colors.success
                    )
                    .onTapGesture { selectedTab = .tasks }

                    DashboardFocusCard(
                        title: "Open Tasks",
                        value: "\(store.openTaskCount)",
                        detail: "Active",
                        icon: "checklist",
                        tint: colors.warning
                    )
                    .onTapGesture { selectedTab = .tasks }

                    DashboardFocusCard(
                        title: "Open Issues",
                        value: "\(store.openIssueCount)",
                        detail: "\(store.issueCount) total",
                        icon: "exclamationmark.bubble",
                        tint: colors.error
                    )
                    .onTapGesture { selectedTab = .issues }

                    DashboardFocusCard(
                        title: "Flows",
                        value: "\(store.flowCount)",
                        detail: "In pipeline",
                        icon: "sparkles",
                        tint: colors.primaryLight
                    )
                    .onTapGesture { selectedTab = .flows }
                }
            }
        }
    }

    private var currentFocusStatus: String {
        pinnedTasksStore.focusState?.status ?? "active"
    }

    private var currentFocusIcon: String {
        switch currentFocusStatus {
        case "blocked":
            return "xmark.octagon.fill"
        case "snoozed":
            return "zzz"
        default:
            return "scope"
        }
    }

    private var currentFocusTint: Color {
        switch currentFocusStatus {
        case "blocked":
            return colors.error
        case "snoozed":
            return colors.textMuted
        default:
            return colors.primary
        }
    }

    private var currentFocusLabel: String {
        switch currentFocusStatus {
        case "blocked":
            return "Blocked Focus"
        case "snoozed":
            return "Snoozed Focus"
        default:
            return "Current Focus"
        }
    }

    private func currentFocusCard(_ item: PinnedItem) -> some View {
        Button {
            showPinnedTasks = true
        } label: {
            HStack(spacing: PFSpacing.md) {
                Image(systemName: currentFocusIcon)
                    .font(.headline)
                    .foregroundStyle(currentFocusTint)
                    .frame(width: 34, height: 34)
                    .background(currentFocusTint.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.sm))

                VStack(alignment: .leading, spacing: 2) {
                    Text(currentFocusLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(currentFocusTint)

                    Text(item.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(colors.textMain)
                        .lineLimit(1)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textMuted)
            }
            .padding(PFSpacing.md)
            .background(colors.surfaceHover.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md))
        }
        .buttonStyle(.plain)
    }

    private var chartsSection: some View {
        VStack(spacing: PFSpacing.md) {
            // Trend Chart
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.md) {
                    HStack {
                        PFSectionHeader(title: "Activity Trends")
                        Spacer()
                        Image(systemName: "arrow.right")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                    }
                    .onTapGesture { selectedTab = .tasks }

                    if store.trendData.isEmpty {
                        Text("No activity data available yet.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                            .frame(height: 150)
                            .frame(maxWidth: .infinity)
                    } else {
                        Chart {
                            ForEach(store.trendData) { item in
                                AreaMark(
                                    x: .value("Date", item.date, unit: .day),
                                    y: .value("Count", item.value)
                                )
                                .foregroundStyle(by: .value("Type", item.type))
                                .opacity(0.1)
                                .interpolationMethod(.catmullRom)

                                LineMark(
                                    x: .value("Date", item.date, unit: .day),
                                    y: .value("Count", item.value)
                                )
                                .foregroundStyle(by: .value("Type", item.type))
                                .lineStyle(StrokeStyle(lineWidth: 2))
                                .interpolationMethod(.catmullRom)
                            }
                        }
                        .chartForegroundStyleScale([
                            "Tasks": colors.warning,
                            "Issues": colors.error,
                            "Flows": colors.primary
                        ])
                        .chartXAxis {
                            AxisMarks(values: .stride(by: .day)) { value in
                                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5)).foregroundStyle(colors.surfaceBorder)
                                AxisValueLabel(format: .dateTime.weekday(.abbreviated), centered: true)
                                    .foregroundStyle(colors.textMuted)
                            }
                        }
                        .chartYAxis {
                            AxisMarks { value in
                                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [2, 4])).foregroundStyle(colors.surfaceBorder)
                                AxisValueLabel().foregroundStyle(colors.textMuted)
                            }
                        }
                        .frame(height: 200)
                    }
                }
            }
            .onTapGesture { selectedTab = .tasks }

            // Project Status Donut
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.md) {
                    HStack {
                        PFSectionHeader(title: "Project Status")
                        Spacer()
                        Image(systemName: "arrow.right")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                    }
                    .onTapGesture { selectedTab = .projects }

                    if store.projectStatusDistribution.isEmpty {
                        Text("No projects available.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                            .frame(height: 150)
                            .frame(maxWidth: .infinity)
                    } else {
                        HStack {
                            Chart(store.projectStatusDistribution) { item in
                                SectorMark(
                                    angle: .value("Count", item.value),
                                    innerRadius: .ratio(0.6),
                                    angularInset: 1.5
                                )
                                .cornerRadius(4)
                                .foregroundStyle(item.color)
                            }
                            .frame(height: 150)

                            Spacer()

                            VStack(alignment: .leading, spacing: 8) {
                                ForEach(store.projectStatusDistribution) { item in
                                    HStack {
                                        Circle()
                                            .fill(item.color)
                                            .frame(width: 8, height: 8)
                                        Text(item.label)
                                            .font(.caption)
                                            .foregroundStyle(colors.textMain)
                                        Spacer()
                                        Text("\(item.value)")
                                            .font(.caption.weight(.bold))
                                            .foregroundStyle(colors.textMain)
                                    }
                                }
                            }
                            .frame(width: 120)
                        }
                    }
                }
            }
            .onTapGesture { selectedTab = .projects }
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

    private var calendarSection: some View {
        VStack(spacing: PFSpacing.md) {
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.md) {
                    PFSectionHeader(title: "Calendar", subtitle: "Your schedule")
                    CalendarWidget()
                }
            }

            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.md) {
                    PFSectionHeader(title: "Scheduled", subtitle: "Upcoming deadlines")
                    ScheduledTasksCard(
                        scheduledTasks: store.scheduledTasks,
                        tenantStore: tenantStore
                    )
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
                                NavigationLink(destination: ProjectTaskDetailView(
                                    task: task,
                                    tenantId: tenantStore.activeTenantId ?? "",
                                    permissions: tenantStore.permissionContext()
                                )) {
                                    DashboardTaskRow(task: task)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }

            recentCard(
                title: "Recent Issues",
                emptyMessage: "No issues yet.",
                rows: store.recentIssues.map { issue in
                    DashboardRow(
                        id: issue.id,
                        title: issue.title,
                        detail: issue.status,
                        destination: AnyView(ProjectIssueDetailView(
                            issue: issue,
                            tenantId: tenantStore.activeTenantId ?? "",
                            permissions: tenantStore.permissionContext()
                        ))
                    )
                }
            )

            recentCard(
                title: "Recent Flows",
                emptyMessage: "No flows yet.",
                rows: store.recentFlows.map { flow in
                    DashboardRow(
                        id: flow.id,
                        title: flow.title,
                        detail: flow.stage,
                        destination: AnyView(FlowDetailView(
                            flow: flow,
                            tenantId: tenantStore.activeTenantId ?? "",
                            permissions: tenantStore.permissionContext()
                        ))
                    )
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

    private func handleStatTap(_ stat: DashboardStat) {
        switch stat.title {
        case "Projects": selectedTab = .projects
        case "Open Tasks": selectedTab = .tasks
        case "Open Issues": selectedTab = .issues
        case "Flows": selectedTab = .flows
        default: break
        }
    }
}

private struct DashboardProjectCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let project: Project
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            ZStack(alignment: .topTrailing) {
                RoundedRectangle(cornerRadius: PFRadius.lg)
                    .fill(colors.primary.opacity(0.1))
                    .frame(height: 100)

                Text(project.status)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(colors.primary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(colors.surfaceCard)
                    .clipShape(Capsule())
                    .padding(8)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(project.title)
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)

                Text(project.description.isEmpty ? "No description" : project.description)
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
                    .lineLimit(2)
            }

            ProgressView(value: project.progress, total: 100)
                .tint(colors.primary)

            HStack {
                Text("\(Int(project.progress))%")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(colors.textMain)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(colors.textSubtle)
            }
        }
        .padding(PFSpacing.md)
        .background(colors.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
        .shadow(color: colors.shadowSm, radius: 4, x: 0, y: 2)
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

private struct DashboardHighlight: Identifiable {
    let id: String
    let title: String
    let detail: String
    let typeLabel: String
    let icon: String
    let timestamp: Date?
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

struct CalendarWidget: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let calendar = Calendar.current
    private let days = ["M", "T", "W", "T", "F", "S", "S"]

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                ForEach(days, id: \.self) { day in
                    Text(day)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(colors.textMuted)
                        .frame(maxWidth: .infinity)
                }
            }

            let today = calendar.startOfDay(for: Date())
            let week = currentWeek(for: today)

            HStack {
                ForEach(week, id: \.self) { date in
                    VStack(spacing: 4) {
                        Text("\(calendar.component(.day, from: date))")
                            .font(.subheadline.weight(calendar.isDateInToday(date) ? .bold : .medium))
                            .foregroundStyle(calendar.isDateInToday(date) ? .white : colors.textMain)
                            .frame(width: 32, height: 32)
                            .background(calendar.isDateInToday(date) ? colors.primary : Color.clear)
                            .clipShape(Circle())
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.vertical, 8)
    }

    private func currentWeek(for date: Date) -> [Date] {
        var days: [Date] = []
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        guard let monday = calendar.date(from: components) else { return [] }

        for i in 0..<7 {
            if let day = calendar.date(byAdding: .day, value: i, to: monday) {
                days.append(day)
            }
        }
        return days
    }
}

struct ScheduledTasksCard: View {
    let scheduledTasks: [Date: [ProjectTask]]
    @ObservedObject var tenantStore: TenantStore
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var upcomingDays: [Date] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: today) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            let filteredDays = upcomingDays.filter { day in
                !(scheduledTasks[day]?.isEmpty ?? true)
            }

            if filteredDays.isEmpty {
                Text("No tasks scheduled for this week.")
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else {
                ForEach(filteredDays, id: \.self) { day in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(dayTitle(for: day))
                            .font(.caption.weight(.bold))
                            .foregroundStyle(colors.primary)

                        ForEach(scheduledTasks[day] ?? []) { task in
                            NavigationLink(destination: ProjectTaskDetailView(
                                task: task,
                                tenantId: tenantStore.activeTenantId ?? "",
                                permissions: tenantStore.permissionContext()
                            )) {
                                HStack {
                                    Circle()
                                        .fill(task.isCompleted ? colors.success : colors.warning)
                                        .frame(width: 8, height: 8)
                                    Text(task.title)
                                        .font(.subheadline)
                                        .foregroundStyle(colors.textMain)
                                        .lineLimit(1)
                                    Spacer()
                                    if !task.priority.isEmpty {
                                        Text(task.priority)
                                            .font(.caption2)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(colors.surfaceHover)
                                            .cornerRadius(4)
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private func dayTitle(for date: Date) -> String {
        if Calendar.current.isDateInToday(date) { return "TODAY" }
        if Calendar.current.isDateInTomorrow(date) { return "TOMORROW" }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE"
        return formatter.string(from: date).uppercased()
    }
}

private struct DashboardRow: Identifiable {
    let id: String
    let title: String
    let detail: String
    let destination: AnyView
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
                            NavigationLink(destination: row.destination) {
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
                                .padding(.vertical, 4)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }
}
