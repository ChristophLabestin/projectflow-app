import SwiftUI
import FirebaseFirestore

// MARK: - ProjectOverviewView — Companion V2 (full redesign)
//
// A clean, prioritized project detail page: a bold hero header, a module switch,
// and a glanceable overview (attention → metrics → tasks → milestones → activity
// → team → AI → resources). The dense multi-widget dashboard grid is gone; the
// data flow (ProjectOverviewStore, module embeds, report/team sheets) is intact.

struct ProjectOverviewView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appSession: AppSession
    let project: Project
    let tenantId: String?
    @StateObject private var store = ProjectOverviewStore()
    @StateObject private var tenantStore = TenantStore()
    @State private var showingTeamManagement = false
    @State private var showingReport = false
    @State private var navSelection: ProjectNavDestination = .overview
    @State private var linkedProjects: [Project] = []

    init(project: Project, tenantId: String? = nil) {
        self.project = project
        self.tenantId = tenantId
    }

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let twoColumns = [GridItem(.flexible(), spacing: PFSpacing.sm), GridItem(.flexible(), spacing: PFSpacing.sm)]

    private var resolvedTenantId: String? { tenantId ?? project.tenantId }
    private var permissionContext: PermissionContext { appSession.permissionContext(project: project) }
    private var healthSnapshot: ProjectHealthSnapshot {
        HealthService.calculateProjectHealth(
            project: project,
            tasks: store.tasks,
            milestones: store.milestones,
            sprints: store.sprints,
            activities: store.activity
        )
    }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    ProjectHeroHeader(project: project, coverImageURL: store.coverImageURL, health: healthSnapshot)
                    ProjectModuleNavBar(project: project, permissions: permissionContext, selection: $navSelection)
                    moduleDestination
                    if navSelection == .overview { overviewSections }
                }
                .pfScreenPadding(vertical: PFSpacing.md)
                .pfTabBarClearance()
            }
        }
        .navigationTitle(project.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { overviewToolbar }
        .sheet(isPresented: $showingTeamManagement) {
            if let tenantId = resolvedTenantId {
                ProjectMemberManagementView(project: project, tenantId: tenantId)
            }
        }
        .sheet(isPresented: $showingReport) {
            if let userProfile = session.userProfile {
                ProjectReportView(
                    report: store.pinnedReport,
                    isGenerating: store.isGeneratingReport,
                    onGenerate: {
                        guard let tenantId = resolvedTenantId else { return }
                        Task { await store.generateReport(tenantId: tenantId, projectId: project.id, user: userProfile) }
                    }
                )
            } else {
                VStack { ProgressView() }
            }
        }
        .onAppear {
            tenantStore.update(for: session.user)
            guard let tenantId = resolvedTenantId else { return }
            store.start(tenantId: tenantId, projectId: project.id)
            loadLinkedProjects(tenantId: tenantId)
        }
        .onChange(of: session.user) { _, user in tenantStore.update(for: user) }
        .onDisappear {
            store.stop()
            tenantStore.stop()
        }
    }

    // MARK: Module destination

    @ViewBuilder
    private var moduleDestination: some View {
        if let tenantId = resolvedTenantId {
            switch navSelection {
            case .overview:
                EmptyView()
            case .initiatives:
                InitiativesProjectListView(tenantId: tenantId, projectId: project.id, permissions: permissionContext)
            case .tasks:
                ProjectTaskListEmbed(project: project, tenantId: tenantId, tasks: store.tasks, permissions: permissionContext)
            case .sprints:
                ProjectSprintsView(tenantId: tenantId, projectId: project.id, permissions: permissionContext)
            case .milestones:
                ProjectMilestonesView(tenantId: tenantId, projectId: project.id, permissions: permissionContext)
            case .activity:
                ProjectActivityView(tenantId: tenantId, projectId: project.id)
            case .codex:
                ProjectCodexView(tenantId: tenantId, projectId: project.id)
            case .details:
                ProjectDetailsView(project: project, tenantId: tenantId, permissions: permissionContext)
            }
        }
    }

    // MARK: Overview sections

    @ViewBuilder
    private var overviewSections: some View {
        if resolvedTenantId == nil {
            PFCard {
                PFEmptyState(icon: "building.2", title: L10n.tr("company.none", fallback: "Select a workspace"))
            }
        } else if store.isLoading && store.tasks.isEmpty {
            ProgressView().frame(maxWidth: .infinity, minHeight: 160)
        } else {
            CompanyProjectOverviewSection(project: project, linkedProjects: linkedProjects)
            ProjectAttentionCard(
                health: healthSnapshot,
                openTasks: openTaskCount,
                urgentTasks: urgentTaskCount,
                milestones: store.milestones.count,
                onOpenReport: { showingReport = true }
            )
            metricsGrid
            tasksCard
            if !store.milestones.isEmpty { milestonesCard }
            activityCard
            teamCard
            aiCard
            if !resourceLinks.isEmpty { resourcesCard }
        }
    }

    private var metricsGrid: some View {
        LazyVGrid(columns: twoColumns, spacing: PFSpacing.sm) {
            PFMetricTile(value: "\(openTaskCount)", label: L10n.tr("dashboard.metrics.open", fallback: "Open tasks"), icon: "checklist", tint: colors.warning) { navSelection = .tasks }
            PFMetricTile(value: "\(completedTaskCount)", label: L10n.tr("work.completed", fallback: "Completed"), icon: "checkmark.circle", tint: colors.success) { navSelection = .tasks }
            PFMetricTile(value: "\(Int(healthSnapshot.score))", label: L10n.tr("health.score", fallback: "Health"), icon: "heart.text.square", tint: healthColor(healthSnapshot.status))
            PFMetricTile(value: "\(store.milestones.count)", label: L10n.tr("deadline.milestones", fallback: "Milestones"), icon: "flag.checkered", tint: colors.primary) { navSelection = .milestones }
        }
    }

    private var tasksCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionTitle(
                    title: L10n.tr("work.tasks", fallback: "Tasks"),
                    actionTitle: L10n.tr("common.viewAll", fallback: "View all"),
                    action: { navSelection = .tasks }
                )
                let tasks = activeTasks
                if tasks.isEmpty {
                    Text(L10n.tr("work.empty.tasks", fallback: "No active tasks."))
                        .font(PFFont.body).foregroundStyle(colors.textMuted).padding(.vertical, PFSpacing.sm)
                } else {
                    VStack(spacing: 0) {
                        ForEach(tasks) { task in
                            HStack(spacing: PFSpacing.md) {
                                Button { toggle(task) } label: {
                                    Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(task.isCompleted ? colors.success : colors.textMuted)
                                        .font(.title3)
                                }
                                .buttonStyle(.plain)
                                NavigationLink {
                                    ProjectTaskDetailView(task: task, tenantId: resolvedTenantId ?? "", permissions: permissionContext)
                                } label: {
                                    PFListRow(
                                        title: task.title,
                                        subtitle: task.dueDate.isEmpty ? nil : formatDate(task.dueDate),
                                        leadingDot: PFSemantic.priorityTint(task.priority, colors: colors)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.vertical, PFSpacing.sm)
                            if task.id != tasks.last?.id { Divider() }
                        }
                    }
                }
            }
        }
    }

    private var milestonesCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionTitle(
                    title: L10n.tr("deadline.milestones", fallback: "Milestones"),
                    actionTitle: L10n.tr("common.viewAll", fallback: "View all"),
                    action: { navSelection = .milestones }
                )
                VStack(spacing: 0) {
                    ForEach(store.milestones.prefix(4)) { milestone in
                        HStack(spacing: PFSpacing.sm) {
                            PFDot(tint: milestone.status == "Achieved" ? colors.success : colors.warning, size: 9)
                            Text(milestone.title)
                                .font(PFFont.body)
                                .foregroundStyle(colors.textMain)
                                .lineLimit(1)
                            Spacer()
                            if !milestone.dueDate.isEmpty {
                                Text(formatDate(milestone.dueDate))
                                    .font(PFFont.detail)
                                    .foregroundStyle(colors.textMuted)
                            }
                        }
                        .padding(.vertical, PFSpacing.sm)
                        if milestone.id != store.milestones.prefix(4).last?.id { Divider() }
                    }
                }
            }
        }
    }

    private var activityCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionTitle(
                    title: L10n.tr("dashboard.recent", fallback: "Latest activity"),
                    actionTitle: L10n.tr("common.viewAll", fallback: "View all"),
                    action: { navSelection = .activity }
                )
                if store.activity.isEmpty {
                    Text(L10n.tr("dashboard.recent.empty", fallback: "No recent updates."))
                        .font(PFFont.body).foregroundStyle(colors.textMuted).padding(.vertical, PFSpacing.sm)
                } else {
                    VStack(spacing: PFSpacing.md) {
                        ForEach(store.activity.prefix(5)) { item in
                            HStack(alignment: .top, spacing: PFSpacing.sm) {
                                PFIconTile(icon: activityIcon(item.type), tint: colors.textMuted, size: 30, corner: PFRadius.sm)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(item.user) \(item.action)")
                                        .font(PFFont.body)
                                        .foregroundStyle(colors.textMain)
                                        .lineLimit(2)
                                    Text(item.createdAt?.dateValue().formatted(.relative(presentation: .named)) ?? "")
                                        .font(PFFont.detail)
                                        .foregroundStyle(colors.textMuted)
                                }
                                Spacer(minLength: 0)
                            }
                        }
                    }
                }
            }
        }
    }

    private var teamCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionTitle(
                    title: L10n.tr("settings.team", fallback: "Team"),
                    actionTitle: L10n.tr("common.edit", fallback: "Manage"),
                    action: { showingTeamManagement = true }
                )
                if store.memberProfiles.isEmpty {
                    Text(L10n.tr("company.workstreams.empty", fallback: "No members listed."))
                        .font(PFFont.body).foregroundStyle(colors.textMuted)
                } else {
                    HStack(spacing: -8) {
                        ForEach(store.memberProfiles.prefix(6)) { profile in
                            UserAvatar(name: profile.displayName, url: URL(string: profile.photoURL ?? ""), size: 36)
                                .overlay(Circle().stroke(colors.surfaceCard, lineWidth: 2))
                        }
                        if store.memberProfiles.count > 6 {
                            Text("+\(store.memberProfiles.count - 6)")
                                .font(PFFont.chip)
                                .foregroundStyle(colors.textMuted)
                                .frame(width: 36, height: 36)
                                .background(colors.surfaceHover)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(colors.surfaceCard, lineWidth: 2))
                        }
                        Spacer()
                    }
                }
            }
        }
    }

    private var aiCard: some View {
        Button { showingReport = true } label: {
            PFCard {
                HStack(spacing: PFSpacing.md) {
                    PFIconTile(icon: "sparkles", tint: colors.primary, size: 42)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CORA Intelligence")
                            .font(PFFont.rowTitle)
                            .foregroundStyle(colors.textMain)
                        Text(store.pinnedReport == nil
                             ? L10n.tr("dashboard.dueNext.subtitle", fallback: "Generate project analysis")
                             : "Updated \(store.pinnedReport?.createdAt?.dateValue().formatted(.relative(presentation: .named)) ?? "recently")")
                            .font(PFFont.detail)
                            .foregroundStyle(colors.textMuted)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "arrow.right").font(.caption.weight(.bold)).foregroundStyle(colors.textSubtle)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var resourcesCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionTitle(title: L10n.tr("dashboard.quickActions", fallback: "Resources"))
                VStack(spacing: PFSpacing.sm) {
                    ForEach(resourceLinks) { link in
                        if let url = linkURL(link.url) {
                            Link(destination: url) {
                                PFListRow(title: link.title, subtitle: link.url, icon: "link", iconTint: colors.primary, showsChevron: false) {
                                    Image(systemName: "arrow.up.right").font(.caption2.weight(.bold)).foregroundStyle(colors.textMuted)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    // MARK: Toolbar

    @ToolbarContentBuilder
    private var overviewToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button { showingReport = true } label: {
                Image(systemName: "doc.text.magnifyingglass").foregroundStyle(colors.textMain)
            }
            Button { showingTeamManagement = true } label: {
                Image(systemName: "person.2").foregroundStyle(colors.textMain)
            }
        }
    }

    // MARK: Derived data + helpers

    private var openTaskCount: Int { store.tasks.filter { !$0.isCompleted && $0.status != "Done" }.count }
    private var completedTaskCount: Int { store.tasks.filter { $0.isCompleted }.count }
    private var urgentTaskCount: Int { store.tasks.filter { !$0.isCompleted && $0.priority == "Urgent" }.count }
    private var resourceLinks: [ProjectLink] { (project.links + project.externalResources).filter { !$0.title.isEmpty } }

    private var activeTasks: [ProjectTask] {
        store.tasks
            .filter { !$0.isCompleted }
            .sorted {
                let a = priorityValue($0.priority), b = priorityValue($1.priority)
                if a != b { return a > b }
                return $0.dueDate < $1.dueDate
            }
            .prefix(6)
            .map { $0 }
    }

    private func priorityValue(_ p: String) -> Int {
        switch p { case "Urgent": return 4; case "High": return 3; case "Medium": return 2; default: return 1 }
    }

    private func toggle(_ task: ProjectTask) {
        guard let tenantId = resolvedTenantId else { return }
        Task { await store.toggleTask(tenantId: tenantId, projectId: project.id, task: task, permissions: permissionContext) }
    }

    private func healthColor(_ status: HealthStatus) -> Color {
        switch status {
        case .critical: return colors.error
        case .warning: return colors.warning
        case .healthy, .excellent: return colors.success
        case .normal: return colors.primary
        case .stalemate: return colors.textSubtle
        }
    }

    private func activityIcon(_ type: String) -> String {
        switch type {
        case "task": return "checklist"
        case "comment": return "bubble.left"
        case "file": return "doc"
        case "report": return "sparkles"
        default: return "clock"
        }
    }

    private func formatDate(_ value: String) -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: value) ?? ISO8601DateFormatter().date(from: value) {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
        let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"
        if let date = df.date(from: String(value.prefix(10))) {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
        return String(value.prefix(10))
    }

    private func linkURL(_ raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        return URL(string: trimmed.contains("://") ? trimmed : "https://\(trimmed)")
    }

    private func loadLinkedProjects(tenantId: String) {
        guard project.isCompanyProject else { return }
        Firestore.firestore().collection(FirestorePath.tenants).document(tenantId)
            .collection(FirestorePath.projects)
            .whereField("companyProjectId", isEqualTo: project.id)
            .getDocuments { snapshot, _ in
                linkedProjects = snapshot?.documents.map { Project(id: $0.documentID, data: $0.data()) } ?? []
            }
    }
}

// MARK: - Hero header

private struct ProjectHeroHeader: View {
    let project: Project
    let coverImageURL: URL?
    let health: ProjectHealthSnapshot

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                if let coverImageURL {
                    AsyncImage(url: coverImageURL) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default:
                            LinearGradient(colors: [colors.surfaceHover, colors.surfacePaper], startPoint: .topLeading, endPoint: .bottomTrailing)
                        }
                    }
                    .frame(height: 120)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                }

                HStack(alignment: .top, spacing: PFSpacing.md) {
                    icon
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: PFSpacing.xs) {
                            PFStatusChip(status: project.status)
                            if !project.priority.isEmpty { PFPriorityChip(priority: project.priority) }
                        }
                        Text(project.title)
                            .font(PFFont.title)
                            .foregroundStyle(colors.textMain)
                            .lineLimit(2)
                        if !project.description.isEmpty {
                            Text(project.description)
                                .font(PFFont.body)
                                .foregroundStyle(colors.textMuted)
                                .lineLimit(2)
                        }
                    }
                    Spacer(minLength: 0)
                    PFCircularProgress(value: project.progress / 100, size: 58, label: "\(Int(project.progress))%")
                }

                HStack(spacing: PFSpacing.sm) {
                    miniMetric(title: "Start", value: project.startDate.isEmpty ? "—" : shortDate(project.startDate))
                    miniMetric(title: L10n.tr("task.due", fallback: "Due"), value: project.dueDate.isEmpty ? "—" : shortDate(project.dueDate))
                }
            }
        }
    }

    private var icon: some View {
        ZStack {
            RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                .fill(colors.primary.opacity(colorScheme == .dark ? 0.18 : 0.08))
            Text(String(project.title.prefix(1)).uppercased())
                .font(.title2.weight(.bold))
                .foregroundStyle(colors.primary)
        }
        .frame(width: 52, height: 52)
    }

    private func miniMetric(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased()).font(PFFont.eyebrow).foregroundStyle(colors.textMuted)
            Text(value).font(PFFont.chip).foregroundStyle(colors.textMain).lineLimit(1).minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(PFSpacing.sm)
        .background(colors.surfaceHover)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }

    private func shortDate(_ value: String) -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: value) ?? ISO8601DateFormatter().date(from: value) {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
        return String(value.prefix(10))
    }
}

// MARK: - Attention card

private struct ProjectAttentionCard: View {
    let health: ProjectHealthSnapshot
    let openTasks: Int
    let urgentTasks: Int
    let milestones: Int
    let onOpenReport: () -> Void

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var headline: String {
        if urgentTasks > 0 { return "\(urgentTasks) urgent task\(urgentTasks == 1 ? "" : "s") need the next move" }
        if openTasks > 0 { return "\(openTasks) open task\(openTasks == 1 ? "" : "s") remain" }
        return L10n.tr("dashboard.attention.allClear", fallback: "Project is clear for now")
    }

    private var tint: Color {
        if urgentTasks > 0 || health.status == .critical { return colors.error }
        if health.status == .warning { return colors.warning }
        return colors.success
    }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    PFIconTile(icon: "target", tint: tint, size: 40)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(L10n.tr("dashboard.attention.title", fallback: "What matters now").uppercased())
                            .font(PFFont.eyebrow).foregroundStyle(colors.textMuted).tracking(0.5)
                        Text(headline)
                            .font(PFFont.section).foregroundStyle(colors.textMain).lineLimit(2)
                    }
                    Spacer(minLength: 0)
                }
                Button(action: onOpenReport) {
                    HStack {
                        Label("CORA report", systemImage: "doc.text.magnifyingglass").font(PFFont.rowTitle)
                        Spacer()
                        Image(systemName: "arrow.right").font(.caption.weight(.bold))
                    }
                    .foregroundStyle(colors.primary)
                    .padding(.vertical, PFSpacing.sm)
                    .padding(.horizontal, PFSpacing.md)
                    .background(colors.primary.opacity(colorScheme == .dark ? 0.16 : 0.08))
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }
}
