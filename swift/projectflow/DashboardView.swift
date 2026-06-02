import SwiftUI
import FirebaseAuth
import FirebaseCore
import Charts

struct DashboardView: View {
    @Binding var selectedTab: MainTab
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appSession: AppSession
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

                if appSession.isLoadingTenant && appSession.activeTenantId == nil {
                    VStack(spacing: PFSpacing.md) {
                        ProgressView()
                        Text("Loading workspace…")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                    }
                } else if store.isLoading && store.projectCount == 0 {
                    VStack(spacing: PFSpacing.md) {
                        ProgressView()
                        Text("Loading dashboard…")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                    }
                } else {
                    ScrollView(showsIndicators: false) {
                        content
                    }
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
            syncDashboardStores()
        }
        .onChange(of: appSession.activeTenantId) { _, _ in
            tenantStore.update(for: session.user)
            syncDashboardStores()
        }
        .onDisappear {
            store.stop()
            projectsStore.stop()
            pinnedProjectStore.stop()
            pinnedTasksStore.stop()
        }
    }

    private func syncDashboardStores() {
        let tenantId = appSession.activeTenantId ?? tenantStore.activeTenantId
        if let tenantId {
            pinnedProjectStore.start(tenantId: tenantId)
            projectsStore.start(tenantId: tenantId)
        } else {
            projectsStore.stop()
            pinnedProjectStore.stop()
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
                Button("Go to Work") { selectedTab = .work }
                Button("Go to Focus") { selectedTab = .focus }
            } label: {
                Image(systemName: "plus.circle")
                    .foregroundStyle(colors.textMain)
            }
        }

        ToolbarItem(placement: .topBarTrailing) {
            NavigationLink {
                SettingsView()
            } label: {
                Image(systemName: "gearshape")
                    .foregroundStyle(colors.textMain)
            }
        }

        ToolbarItem(placement: .topBarTrailing) {
            Button {
                selectedTab = .inbox
            } label: {
                Image(systemName: "bell")
                    .foregroundStyle(colors.textMain)
            }
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 14) {
            companionHeader
            whatMattersNowSection
            todayWorkSection
            activeProjectsCarousel
            compactQuickActions
            compactStatsSection
            recentWorkSection
        }
        .pfScreenPadding(vertical: PFSpacing.md)
    }

    private var companionHeader: some View {
        HStack(alignment: .center, spacing: PFSpacing.md) {
            VStack(alignment: .leading, spacing: 3) {
                Text(Self.dateFormatter.string(from: Date()).uppercased())
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMuted)

                Text("\(greeting), \(shortGreetingName)")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)

                Text(attentionSubtitle)
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)
                    .lineLimit(2)
            }

            Spacer(minLength: 0)

            UserAvatar(
                name: session.user?.displayName ?? session.user?.email,
                url: URL(string: session.user?.photoURL?.absoluteString ?? ""),
                size: 42
            )
        }
    }

    private var whatMattersNowSection: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    Image(systemName: attentionIcon)
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(attentionTint)
                        .frame(width: 40, height: 40)
                        .background(attentionTint.opacity(colorScheme == .dark ? 0.18 : 0.1))
                        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))

                    VStack(alignment: .leading, spacing: 3) {
                        Text("WHAT'S IMPORTANT NOW")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(colors.textMuted)

                        Text(attentionHeadline)
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                            .lineLimit(2)

                        Text(attentionDetail)
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 0)
                }

                HStack(spacing: PFSpacing.sm) {
                    DashboardAttentionChip(title: "Overdue", value: store.overdueTaskCount, tint: colors.error)
                    DashboardAttentionChip(title: "Today", value: store.dueTodayTaskCount, tint: colors.warning)
                    DashboardAttentionChip(title: "Blocked", value: store.blockedTaskCount, tint: colors.error)
                }

                if let focusItem = pinnedTasksStore.focusItem {
                    currentFocusCard(focusItem)
                }

                Button(action: openPrimaryAttention) {
                    HStack {
                        Text(primaryAttentionActionTitle)
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Image(systemName: "arrow.right")
                            .font(.caption.weight(.bold))
                    }
                    .foregroundStyle(colors.primaryText)
                    .padding(.vertical, PFSpacing.sm)
                    .padding(.horizontal, PFSpacing.md)
                    .background(colors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var todayWorkSection: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                HStack {
                    PFSectionHeader(title: "Due next", subtitle: "The next few things worth seeing")
                    Spacer()
                    Button {
                        selectedTab = .work
                    } label: {
                        Text("Tasks")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(colors.primary)
                    }
                }

                let tasks = nextDueTasks
                if tasks.isEmpty {
                    Text("No scheduled work in the next seven days.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, PFSpacing.sm)
                } else {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(tasks) { task in
                            NavigationLink(destination: ProjectTaskDetailView(
                                task: task,
                                tenantId: tenantStore.activeTenantId ?? "",
                                permissions: tenantStore.permissionContext()
                            )) {
                                DashboardTaskRow(task: task)
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

    private var compactQuickActions: some View {
        LazyVGrid(columns: columns, spacing: PFSpacing.sm) {
            DashboardJumpButton(title: "Projects", icon: "square.stack.3d.down.forward", tint: colors.primary) {
                selectedTab = .projects
            }
            DashboardJumpButton(title: "Tasks", icon: "checklist", tint: colors.warning) {
                selectedTab = .work
            }
            DashboardJumpButton(title: "Focus", icon: "scope", tint: colors.primaryLight) {
                selectedTab = .focus
            }
            DashboardJumpButton(title: "Inbox", icon: "bell", tint: colors.primaryDark) {
                selectedTab = .inbox
            }
        }
    }

    private var compactStatsSection: some View {
        LazyVGrid(columns: columns, spacing: PFSpacing.sm) {
            DashboardMetricTile(title: "Projects", value: "\(store.projectCount)", icon: "square.stack.3d.down.forward", tint: colors.primary) {
                selectedTab = .projects
            }
            DashboardMetricTile(title: "Open tasks", value: "\(store.openTaskCount)", icon: "checklist", tint: colors.warning) {
                selectedTab = .work
            }
            DashboardMetricTile(title: "Due today", value: "\(store.dueTodayTaskCount)", icon: "calendar", tint: colors.warning) {
                selectedTab = .work
            }
            if !PmCoreConfig.isPmCoreOnly {
                DashboardMetricTile(title: "Issues", value: "\(store.openIssueCount)", icon: "exclamationmark.bubble", tint: colors.error) {
                    selectedTab = .work
                }
            }
        }
    }

    private var recentWorkSection: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionHeader(
                    title: "Recent work",
                    subtitle: PmCoreConfig.isPmCoreOnly ? "Latest tasks" : "Latest tasks and issues"
                )

                let tasks = Array(store.recentTasks.prefix(3))
                let issues = PmCoreConfig.isPmCoreOnly ? [] : Array(store.recentIssues.prefix(2))
                if tasks.isEmpty && issues.isEmpty {
                    Text("Recent project activity will appear here.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                        .padding(.vertical, PFSpacing.sm)
                } else {
                    VStack(spacing: 0) {
                        ForEach(tasks) { task in
                            NavigationLink(destination: ProjectTaskDetailView(
                                task: task,
                                tenantId: tenantStore.activeTenantId ?? "",
                                permissions: tenantStore.permissionContext()
                            )) {
                                DashboardRecentRow(title: task.title, detail: task.status, icon: "checklist", tint: colors.warning)
                            }
                            .buttonStyle(.plain)
                        }

                        ForEach(issues) { issue in
                            NavigationLink(destination: ProjectIssueDetailView(
                                issue: issue,
                                tenantId: tenantStore.activeTenantId ?? "",
                                permissions: tenantStore.permissionContext()
                            )) {
                                DashboardRecentRow(title: issue.title, detail: issue.status, icon: "exclamationmark.bubble", tint: colors.error)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
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
            HStack {
                PFSectionHeader(title: "Active projects", subtitle: "Companion-sized context")
                Spacer()
                Button {
                    selectedTab = .projects
                } label: {
                    Text("All")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(colors.primary)
                }
            }

            if active.isEmpty && !projectsStore.isLoading {
                PFCard {
                    Text("No active projects found.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                }
            } else {
                VStack(spacing: PFSpacing.sm) {
                    ForEach(active.prefix(4)) { project in
                        NavigationLink(destination: ProjectOverviewView(
                            project: project,
                            tenantId: tenantStore.activeTenantId ?? ""
                        )) {
                            DashboardCompactProjectRow(project: project)
                        }
                        .buttonStyle(.plain)
                    }
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
                        selectedTab = .work
                    }

                    DashboardActionButton(
                        title: "Issues",
                        icon: "exclamationmark.bubble",
                        tint: colors.error
                    ) {
                        selectedTab = .work
                    }

                    DashboardActionButton(
                        title: "Flows",
                        icon: "sparkles",
                        tint: colors.primaryLight
                    ) {
                        selectedTab = .projects
                    }

                    DashboardActionButton(
                        title: "Notifications",
                        icon: "bell",
                        tint: colors.primaryDark
                    ) {
                        selectedTab = .inbox
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
                    .onTapGesture { selectedTab = .work }

                    DashboardFocusCard(
                        title: "Open Tasks",
                        value: "\(store.openTaskCount)",
                        detail: "Active",
                        icon: "checklist",
                        tint: colors.warning
                    )
                    .onTapGesture { selectedTab = .work }

                    DashboardFocusCard(
                        title: "Open Issues",
                        value: "\(store.openIssueCount)",
                        detail: "\(store.issueCount) total",
                        icon: "exclamationmark.bubble",
                        tint: colors.error
                    )
                    .onTapGesture { selectedTab = .work }

                    DashboardFocusCard(
                        title: "Flows",
                        value: "\(store.flowCount)",
                        detail: "In pipeline",
                        icon: "sparkles",
                        tint: colors.primaryLight
                    )
                    .onTapGesture { selectedTab = .projects }
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
                    .onTapGesture { selectedTab = .work }

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
            .onTapGesture { selectedTab = .work }

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
                                selectedTab = .work
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

    private var shortGreetingName: String {
        let name = greetingName
        return name.split(separator: " ").first.map(String.init) ?? name
    }

    private var attentionSubtitle: String {
        if store.overdueTaskCount > 0 {
            return "\(store.overdueTaskCount) overdue task\(store.overdueTaskCount == 1 ? "" : "s") need attention."
        }
        if store.blockedTaskCount > 0 {
            return "\(store.blockedTaskCount) blocked task\(store.blockedTaskCount == 1 ? "" : "s") may need a decision."
        }
        if store.dueTodayTaskCount > 0 {
            return "\(store.dueTodayTaskCount) task\(store.dueTodayTaskCount == 1 ? "" : "s") due today."
        }
        return "All clear for deadlines. Keep the next focus visible."
    }

    private var attentionHeadline: String {
        if let focusItem = pinnedTasksStore.focusItem {
            return "Continue \(focusItem.title)"
        }
        if store.overdueTaskCount > 0 {
            return "Recover overdue work first"
        }
        if store.blockedTaskCount > 0 {
            return "Unblock the work queue"
        }
        if store.dueTodayTaskCount > 0 {
            return "Finish today's due work"
        }
        if store.urgentTaskCount > 0 {
            return "Review urgent work"
        }
        return "Pick a focused next move"
    }

    private var attentionDetail: String {
        if pinnedTasksStore.focusItem != nil {
            return "Your active focus is synced with ProjectFlow reminders and Live Activity support."
        }
        if store.overdueTaskCount > 0 {
            return "Start with stale work before opening broader project context."
        }
        if store.blockedTaskCount > 0 {
            return "Resolve the blockers before adding more work to the system."
        }
        if store.dueTodayTaskCount > 0 {
            return "Start with the scheduled tasks that are closest to slipping."
        }
        return "Open Focus to choose pinned work or review the next due tasks."
    }

    private var attentionIcon: String {
        if pinnedTasksStore.focusItem != nil { return "scope" }
        if store.overdueTaskCount > 0 { return "calendar.badge.exclamationmark" }
        if store.blockedTaskCount > 0 { return "xmark.octagon" }
        if store.dueTodayTaskCount > 0 { return "calendar" }
        return "sparkle.magnifyingglass"
    }

    private var attentionTint: Color {
        if store.overdueTaskCount > 0 || store.blockedTaskCount > 0 {
            return colors.error
        }
        if store.dueTodayTaskCount > 0 || store.urgentTaskCount > 0 {
            return colors.warning
        }
        return colors.primary
    }

    private var primaryAttentionActionTitle: String {
        if pinnedTasksStore.focusItem != nil {
            return "Open Focus"
        }
        if store.overdueTaskCount > 0 || store.dueTodayTaskCount > 0 || store.urgentTaskCount > 0 {
            return "Review Tasks"
        }
        if store.blockedTaskCount > 0 {
            return "Review Blockers"
        }
        return "Choose Focus"
    }

    private var nextDueTasks: [ProjectTask] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let upcomingDays = (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: today) }
        let scheduled = upcomingDays
            .flatMap { store.scheduledTasks[$0] ?? [] }
            .filter { !$0.isCompleted }
        if scheduled.isEmpty {
            return Array(store.recentTasks.filter { !$0.isCompleted }.prefix(3))
        }
        return Array(scheduled.prefix(3))
    }

    private func openPrimaryAttention() {
        if pinnedTasksStore.focusItem != nil {
            selectedTab = .focus
        } else if store.overdueTaskCount > 0 || store.dueTodayTaskCount > 0 || store.urgentTaskCount > 0 || store.blockedTaskCount > 0 {
            selectedTab = .work
        } else {
            selectedTab = .focus
        }
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
        case "Open Tasks": selectedTab = .work
        case "Open Issues": selectedTab = .work
        case "Flows": selectedTab = .projects
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

private struct DashboardCompactProjectRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let project: Project
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            HStack(alignment: .center, spacing: PFSpacing.md) {
                ZStack {
                    RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                        .fill(colors.primary.opacity(colorScheme == .dark ? 0.18 : 0.08))

                    Text(String(project.title.prefix(1)).uppercased())
                        .font(.headline.weight(.bold))
                        .foregroundStyle(colors.primary)
                }
                .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: PFSpacing.xs) {
                        Text(project.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                            .lineLimit(1)

                        Text(project.status)
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(colors.textMuted)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(colors.surfaceHover)
                            .clipShape(Capsule())
                    }

                    ProgressView(value: project.progress, total: 100)
                        .tint(colors.primary)

                    HStack(spacing: PFSpacing.sm) {
                        Text("\(Int(project.progress))%")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                        if !project.dueDate.isEmpty {
                            Text(project.dueDate)
                                .font(.caption)
                                .foregroundStyle(colors.textMuted)
                                .lineLimit(1)
                        }
                    }
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textSubtle)
            }
        }
    }
}

private struct DashboardAttentionChip: View {
    let title: String
    let value: Int
    let tint: Color
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)")
                .font(.headline.weight(.bold))
                .foregroundStyle(value > 0 ? tint : colors.textMain)
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(colors.textMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, PFSpacing.sm)
        .padding(.horizontal, PFSpacing.sm)
        .background((value > 0 ? tint : colors.surfaceHover).opacity(value > 0 ? 0.12 : 1))
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

private struct DashboardJumpButton: View {
    let title: String
    let icon: String
    let tint: Color
    let action: () -> Void

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: action) {
            HStack(spacing: PFSpacing.sm) {
                Image(systemName: icon)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 30, height: 30)
                    .background(tint.opacity(colorScheme == .dark ? 0.18 : 0.1))
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.sm, style: .continuous))

                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)

                Spacer(minLength: 0)
            }
            .padding(PFSpacing.sm)
            .background(colors.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
            .shadow(color: colors.shadowSm, radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }
}

private struct DashboardMetricTile: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color
    let action: () -> Void

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: action) {
            PFCard {
                HStack(spacing: PFSpacing.sm) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(value)
                            .font(.title2.weight(.bold))
                            .foregroundStyle(colors.textMain)
                        Text(title)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(colors.textMuted)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }

                    Spacer(minLength: 0)

                    Image(systemName: icon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(tint)
                        .frame(width: 30, height: 30)
                        .background(tint.opacity(colorScheme == .dark ? 0.18 : 0.1))
                        .clipShape(RoundedRectangle(cornerRadius: PFRadius.sm, style: .continuous))
                }
            }
        }
        .buttonStyle(.plain)
    }
}

private struct DashboardRecentRow: View {
    let title: String
    let detail: String
    let icon: String
    let tint: Color

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            Image(systemName: icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 30, height: 30)
                .background(tint.opacity(colorScheme == .dark ? 0.18 : 0.1))
                .clipShape(RoundedRectangle(cornerRadius: PFRadius.sm, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)

                Text(detail.isEmpty ? "Open" : detail)
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(colors.textSubtle)
        }
        .padding(.vertical, PFSpacing.sm)
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
