import SwiftUI
import FirebaseAuth

// MARK: - Dashboard (Home) — Companion V2
//
// A condensed companion home: greeting, what-matters-now, due-next, the company
// command entry, active projects, quick actions and at-a-glance metrics. Mirrors
// the web dashboard's key information in a glanceable form. Data is unchanged —
// DashboardStore / ProjectsStore / PinnedTasksStore stay as-is.

struct DashboardView: View {
    @Binding var selectedTab: MainTab
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appSession: AppSession
    @StateObject private var store = DashboardStore()
    @StateObject private var projectsStore = ProjectsStore()
    @StateObject private var pinnedTasksStore = PinnedTasksStore()
    @StateObject private var tenantStore = TenantStore()
    @State private var showPinnedTasks = false
    @State private var showQuickCreate = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let twoColumns = [GridItem(.flexible(), spacing: PFSpacing.sm), GridItem(.flexible(), spacing: PFSpacing.sm)]

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("EEE, d MMM")
        return formatter
    }()

    private var activeTenantId: String { appSession.activeTenantId ?? tenantStore.activeTenantId ?? "" }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()

                if appSession.isLoadingTenant && appSession.activeTenantId == nil {
                    loadingState
                } else if store.isLoading && store.projectCount == 0 {
                    loadingState
                } else {
                    ScrollView(showsIndicators: false) {
                        content
                    }
                }
            }
            .toolbar { dashboardToolbar }
            .sheet(isPresented: $showPinnedTasks) { PinnedTasksSheet() }
            .sheet(isPresented: $showQuickCreate) {
                QuickCreateSheet(
                    tenantId: activeTenantId,
                    projects: projectsStore.projects,
                    defaultProjectId: companyProject?.id,
                    permissions: tenantStore.permissionContext()
                )
            }
        }
        .onAppear {
            store.start()
            pinnedTasksStore.start()
            tenantStore.update(for: session.user)
            syncStores()
        }
        .onChange(of: appSession.activeTenantId) { _, _ in
            tenantStore.update(for: session.user)
            syncStores()
        }
        .onDisappear {
            store.stop()
            projectsStore.stop()
            pinnedTasksStore.stop()
        }
    }

    private var loadingState: some View {
        VStack(spacing: PFSpacing.md) {
            ProgressView()
            Text(L10n.tr("dashboard.loading", fallback: "Loading dashboard…"))
                .font(PFFont.body)
                .foregroundStyle(colors.textMuted)
        }
    }

    private func syncStores() {
        if !activeTenantId.isEmpty {
            projectsStore.start(tenantId: activeTenantId)
        } else {
            projectsStore.stop()
        }
    }

    @ToolbarContentBuilder
    private var dashboardToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button { selectedTab = .inbox } label: {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "bell")
                        .foregroundStyle(colors.textMain)
                    if appSession.notificationStore.unreadCount > 0 {
                        Circle().fill(colors.error).frame(width: 7, height: 7).offset(x: 3, y: -2)
                    }
                }
            }
        }
        ToolbarItem(placement: .topBarTrailing) {
            NavigationLink { SettingsView() } label: {
                Image(systemName: "gearshape").foregroundStyle(colors.textMain)
            }
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: PFSpacing.lg) {
            header
            attentionCard
            if let company = companyProject { companyEntry(company) }
            metricsSection
            dueNextCard
            activeProjectsSection
        }
        .pfScreenPadding(vertical: PFSpacing.md)
        .pfTabBarClearance()
        .tabBarScrollShrink()
    }

    // MARK: Header

    private var header: some View {
        PFScreenHeader(
            title: "\(greeting), \(shortGreetingName)",
            eyebrow: Self.dateFormatter.string(from: Date())
        ) {
            HStack(spacing: PFSpacing.sm) {
                Button { showQuickCreate = true } label: {
                    Image(systemName: "plus")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(colors.primaryText)
                        .frame(width: 40, height: 40)
                        .background(colors.primary)
                        .clipShape(Circle())
                        .pfElevation(.card)
                }
                .buttonStyle(.plain)

                NavigationLink { SettingsView() } label: {
                    UserAvatar(
                        name: session.user?.displayName ?? session.user?.email,
                        url: URL(string: session.user?.photoURL?.absoluteString ?? ""),
                        size: 40
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: What matters now

    private var attentionCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    PFIconTile(icon: attentionIcon, tint: attentionTint, size: 40)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(L10n.tr("dashboard.attention.title", fallback: "What matters now").uppercased())
                            .font(PFFont.eyebrow)
                            .foregroundStyle(colors.textMuted)
                            .tracking(0.5)
                        Text(attentionHeadline)
                            .font(PFFont.section)
                            .foregroundStyle(colors.textMain)
                            .lineLimit(2)
                        if !urgencyLine.isEmpty {
                            Text(urgencyLine)
                                .font(PFFont.detail)
                                .foregroundStyle(colors.textMuted)
                        }
                    }
                    Spacer(minLength: 0)
                }

                if let focusItem = pinnedTasksStore.focusItem {
                    currentFocusCard(focusItem)
                }

                Button(action: openPrimaryAttention) {
                    HStack {
                        Text(primaryAttentionActionTitle).font(PFFont.rowTitle)
                        Spacer()
                        Image(systemName: "arrow.right").font(.caption.weight(.bold))
                    }
                    .foregroundStyle(colors.primaryText)
                    .padding(.vertical, PFSpacing.sm + 2)
                    .padding(.horizontal, PFSpacing.md)
                    .background(colors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// A single quiet line summarising what needs attention (only non-zero items).
    private var urgencyLine: String {
        var parts: [String] = []
        if store.overdueTaskCount > 0 {
            parts.append("\(store.overdueTaskCount) \(L10n.tr("dashboard.attention.overdue", fallback: "overdue"))")
        }
        if store.dueTodayTaskCount > 0 {
            parts.append("\(store.dueTodayTaskCount) \(L10n.tr("dashboard.attention.today", fallback: "today"))")
        }
        if store.blockedTaskCount > 0 {
            parts.append("\(store.blockedTaskCount) \(L10n.tr("dashboard.attention.blocked", fallback: "blocked"))")
        }
        return parts.joined(separator: " · ")
    }

    private func currentFocusCard(_ item: PinnedItem) -> some View {
        Button { showPinnedTasks = true } label: {
            HStack(spacing: PFSpacing.md) {
                PFIconTile(icon: currentFocusIcon, tint: currentFocusTint, size: 34, corner: PFRadius.sm)
                VStack(alignment: .leading, spacing: 2) {
                    Text(L10n.tr("dashboard.focus.current", fallback: "Current focus"))
                        .font(PFFont.chip)
                        .foregroundStyle(currentFocusTint)
                    Text(item.title)
                        .font(PFFont.rowTitle)
                        .foregroundStyle(colors.textMain)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(colors.textMuted)
            }
            .padding(PFSpacing.md)
            .background(colors.surfaceHover.opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md))
        }
        .buttonStyle(.plain)
    }

    // MARK: Company entry

    private func companyEntry(_ project: Project) -> some View {
        NavigationLink {
            CompanySectionView(companyProject: project, tenantId: activeTenantId)
        } label: {
            PFCard {
                HStack(spacing: PFSpacing.md) {
                    PFIconTile(icon: "building.2", tint: colors.primary, size: 42)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(L10n.tr("company.entry", fallback: "Company command"))
                            .font(PFFont.rowTitle)
                            .foregroundStyle(colors.textMain)
                        Text(project.title)
                            .font(PFFont.detail)
                            .foregroundStyle(colors.textMuted)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    if let readiness = project.startupReadiness {
                        Text("\(readiness.formationPercent)%")
                            .font(PFFont.rowTitle)
                            .foregroundStyle(colors.primary)
                    }
                    Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(colors.textSubtle)
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: Due next

    private var dueNextCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionTitle(
                    title: L10n.tr("dashboard.dueNext", fallback: "Due next"),
                    subtitle: L10n.tr("dashboard.dueNext.subtitle", fallback: "The next few things worth seeing"),
                    actionTitle: L10n.tr("common.viewAll", fallback: "View all"),
                    action: { selectedTab = .work }
                )

                let tasks = nextDueTasks
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
                                ProjectTaskDetailView(
                                    task: task,
                                    tenantId: activeTenantId,
                                    permissions: tenantStore.permissionContext()
                                )
                            } label: {
                                PFListRow(
                                    title: task.title,
                                    subtitle: taskSubtitle(task),
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

    // MARK: Metrics

    private var metricsSection: some View {
        LazyVGrid(columns: twoColumns, spacing: PFSpacing.sm) {
            PFMetricTile(value: "\(store.openTaskCount)", label: L10n.tr("dashboard.metrics.open", fallback: "Open tasks"), icon: "checklist", tint: colors.warning) { selectedTab = .work }
            PFMetricTile(value: "\(completedTaskCount)", label: L10n.tr("work.completed", fallback: "Completed"), icon: "checkmark.circle", tint: colors.success) { selectedTab = .work }
        }
    }

    // MARK: Active projects

    private var activeProjectsSection: some View {
        let active = projectsStore.projects.filter { ProjectStatus.isActive($0.status) && !$0.isCompanyProject }
        return VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionTitle(
                title: L10n.tr("dashboard.activeProjects", fallback: "Active projects"),
                actionTitle: L10n.tr("common.all", fallback: "All"),
                action: { selectedTab = .projects }
            )
            if active.isEmpty && !projectsStore.isLoading {
                PFCard {
                    Text(L10n.tr("projects.empty.message", fallback: "Create your first project to get started."))
                        .font(PFFont.body)
                        .foregroundStyle(colors.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                VStack(spacing: PFSpacing.sm) {
                    ForEach(active.prefix(4)) { project in
                        NavigationLink {
                            ProjectOverviewView(project: project, tenantId: activeTenantId)
                        } label: {
                            DashboardProjectRow(project: project)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: - Derived data

    private var companyProject: Project? {
        projectsStore.projects.first { $0.isCompanyProject }
    }

    private func taskSubtitle(_ task: ProjectTask) -> String {
        if !task.dueDate.isEmpty { return task.dueDate }
        return task.priority
    }

    private var completedTaskCount: Int { max(store.taskCount - store.openTaskCount, 0) }

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

    // MARK: Greeting & attention copy

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return L10n.tr("dashboard.greeting.morning", fallback: "Good morning")
        case 12..<17: return L10n.tr("dashboard.greeting.afternoon", fallback: "Good afternoon")
        case 17..<22: return L10n.tr("dashboard.greeting.evening", fallback: "Good evening")
        default: return L10n.tr("dashboard.greeting.default", fallback: "Welcome")
        }
    }

    private var greetingName: String {
        if let name = session.user?.displayName, !name.isEmpty { return name }
        if let email = session.user?.email, let prefix = email.split(separator: "@").first { return String(prefix) }
        return "there"
    }

    private var shortGreetingName: String {
        let name = greetingName
        return name.split(separator: " ").first.map(String.init) ?? name
    }

    private var attentionSubtitle: String {
        if store.overdueTaskCount > 0 {
            return String(format: L10n.tr("dashboard.attention.overdueDetail", fallback: "%d overdue task(s) need attention."), store.overdueTaskCount)
        }
        if store.blockedTaskCount > 0 {
            return String(format: L10n.tr("dashboard.attention.blockedDetail", fallback: "%d blocked task(s) may need a decision."), store.blockedTaskCount)
        }
        if store.dueTodayTaskCount > 0 {
            return String(format: L10n.tr("dashboard.attention.todayDetail", fallback: "%d task(s) due today."), store.dueTodayTaskCount)
        }
        return L10n.tr("dashboard.attention.allClear", fallback: "All clear for deadlines. Keep your next focus in view.")
    }

    private var attentionHeadline: String {
        if let focusItem = pinnedTasksStore.focusItem { return focusItem.title }
        if store.overdueTaskCount > 0 { return L10n.tr("dashboard.attention.overdue", fallback: "Overdue work first") }
        if store.blockedTaskCount > 0 { return L10n.tr("dashboard.attention.blocked", fallback: "Unblock the queue") }
        if store.dueTodayTaskCount > 0 { return L10n.tr("dashboard.attention.today", fallback: "Today's due work") }
        return L10n.tr("dashboard.attention.allClear", fallback: "You're on track")
    }

    private var attentionIcon: String {
        if pinnedTasksStore.focusItem != nil { return "scope" }
        if store.overdueTaskCount > 0 { return "calendar.badge.exclamationmark" }
        if store.blockedTaskCount > 0 { return "xmark.octagon" }
        if store.dueTodayTaskCount > 0 { return "calendar" }
        return "checkmark.seal"
    }

    private var attentionTint: Color {
        if store.overdueTaskCount > 0 || store.blockedTaskCount > 0 { return colors.error }
        if store.dueTodayTaskCount > 0 || store.urgentTaskCount > 0 { return colors.warning }
        return colors.success
    }

    private var primaryAttentionActionTitle: String {
        if pinnedTasksStore.focusItem != nil { return L10n.tr("dashboard.openFocus", fallback: "Open focus") }
        return L10n.tr("dashboard.review", fallback: "Review tasks")
    }

    private var currentFocusStatus: String { pinnedTasksStore.focusState?.status ?? "active" }
    private var currentFocusIcon: String {
        switch currentFocusStatus {
        case "blocked": return "xmark.octagon.fill"
        case "snoozed": return "zzz"
        default: return "scope"
        }
    }
    private var currentFocusTint: Color {
        switch currentFocusStatus {
        case "blocked": return colors.error
        case "snoozed": return colors.textMuted
        default: return colors.primary
        }
    }
}

// MARK: - Project row

private struct DashboardProjectRow: View {
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

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: PFSpacing.sm) {
                        Text(project.title)
                            .font(PFFont.rowTitle)
                            .foregroundStyle(colors.textMain)
                            .lineLimit(1)
                        PFStatusChip(status: project.status)
                    }
                    PFProgressBar(value: project.progress / 100)
                    HStack(spacing: PFSpacing.sm) {
                        Text("\(Int(project.progress))%")
                            .font(PFFont.chip)
                            .foregroundStyle(colors.textMain)
                        if !project.dueDate.isEmpty {
                            Text(project.dueDate)
                                .font(PFFont.detail)
                                .foregroundStyle(colors.textMuted)
                                .lineLimit(1)
                        }
                    }
                }

                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(colors.textSubtle)
            }
        }
    }
}
