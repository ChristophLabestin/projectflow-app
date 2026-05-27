import SwiftUI
import FirebaseCore // For Timestamp
import FirebaseStorage


struct ProjectOverviewView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    let project: Project
    let tenantId: String?
    @StateObject private var store = ProjectOverviewStore()
    @StateObject private var tenantStore = TenantStore()
    @State private var showingTeamManagement = false
    @State private var showingReport = false

    init(project: Project, tenantId: String? = nil) {
        self.project = project
        self.tenantId = tenantId
    }

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let fixedCards: [ProjectOverviewCardType] = [
        .snapshot,
        .execution,
        .updates,
        .milestones,
        .aiInsights,
        .team,
        .resources,
        .planning,
        .controls
    ]
    private var resolvedTenantId: String? {
        tenantId ?? project.tenantId
    }
    private var permissionContext: PermissionContext {
        tenantStore.permissionContext(projectOwnerId: project.ownerId)
    }
    private var healthSnapshot: ProjectHealthSnapshot {
        HealthService.calculateProjectHealth(
            project: project,
            tasks: store.tasks,
            milestones: store.milestones,
            issues: store.issues,
            sprints: store.sprints,
            activities: store.activity
        )
    }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 14) {
                    ProjectDetailHeaderCard(project: project, coverImageURL: store.coverImageURL)
                    ProjectDetailAttentionCard(
                        health: healthSnapshot,
                        tasks: store.tasks,
                        issues: store.issues,
                        milestones: store.milestones,
                        onOpenReport: { showingReport = true }
                    )
                    content
                }
                .pfScreenPadding(vertical: PFSpacing.md)
                .padding(.bottom, PFSpacing.xl)
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
                        _Concurrency.Task {
                            await store.generateReport(tenantId: tenantId, projectId: project.id, user: userProfile)
                        }
                    }
                )
            } else {
                VStack {
                    ProgressView()
                    Text("Loading Profile...")
                }
            }
        }
        .onAppear {
            tenantStore.update(for: session.user)
            guard let tenantId = resolvedTenantId else { return }
            store.start(tenantId: tenantId, projectId: project.id)
        }
        .onChange(of: session.user) { _, user in
            tenantStore.update(for: user)
        }
        .onDisappear {
            store.stop()
            tenantStore.stop()
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let _ = resolvedTenantId {
                if store.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else {
                    ForEach(fixedCards, id: \.self) { card in
                        renderCard(for: card)
                    }
                }
            } else {
                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        Text("Select a workspace to view project data.")
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        Text("We could not resolve an active tenant for this session.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func renderCard(for type: ProjectOverviewCardType) -> some View {
        switch type {
        case .snapshot:
            SnapshotSection(
                health: healthSnapshot,
                history: store.healthHistory,
                tasks: store.tasks,
                activity: store.activity
            )
        case .execution:
            ExecutionSection(
                tasks: store.tasks,
                flows: store.flows,
                issues: store.issues,
                projectGroups: [],
                resolvedTenantId: resolvedTenantId,
                permissionContext: permissionContext,
                onToggleTask: { task in
                    _Concurrency.Task {
                        await store.toggleTask(
                            tenantId: resolvedTenantId ?? "",
                            projectId: project.id,
                            task: task,
                            permissions: permissionContext
                        )
                    }
                }
            )
        case .updates:
            UpdatesWidget(
                activity: store.activity,
                tasks: store.tasks,
                flows: store.flows,
                issues: store.issues,
                resolvedTenantId: resolvedTenantId,
                permissionContext: permissionContext
            )
        case .resources:
            ResourcesWidget(project: project)
        case .planning:
            PlanningWidget(project: project)
        case .milestones:
            MilestonesWidget(milestones: store.milestones)
        case .aiInsights:
            AiInsightsWidget(report: store.pinnedReport) {
                showingReport = true
            }
        case .team:
            TeamWidget(profiles: store.memberProfiles) {
                showingTeamManagement = true
            }
        case .controls:
            ControlsWidget(project: project)
        }
    }

    @ToolbarContentBuilder
    private var overviewToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                showingReport = true
            } label: {
                Image(systemName: "doc.text.magnifyingglass")
                    .foregroundStyle(colors.textMain)
            }

            Button {
                showingTeamManagement = true
            } label: {
                Image(systemName: "person.2")
                    .foregroundStyle(colors.textMain)
            }
        }
    }
}

// MARK: - Header
private struct ProjectDetailHeaderCard: View {
    let project: Project
    let coverImageURL: URL?

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    ProjectIcon(project: project, coverImageURL: coverImageURL)

                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: PFSpacing.xs) {
                            Text(project.status)
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(colors.textMain)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(colors.surfaceHover)
                                .clipShape(Capsule())

                            if !project.priority.isEmpty {
                                Text(project.priority)
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(priorityColor)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 3)
                                    .background(priorityColor.opacity(colorScheme == .dark ? 0.18 : 0.1))
                                    .clipShape(Capsule())
                            }
                        }

                        Text(project.title)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(colors.textMain)
                            .lineLimit(2)

                        Text(project.description.isEmpty ? "No description provided." : project.description)
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                            .lineLimit(3)
                    }

                    Spacer(minLength: 0)
                }

                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    HStack {
                        Text("Progress")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(colors.textMuted)
                        Spacer()
                        Text("\(Int(project.progress))%")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(colors.textMain)
                    }

                    ProgressView(value: project.progress, total: 100)
                        .tint(colors.primary)
                }

                HStack(spacing: PFSpacing.sm) {
                    ProjectDetailMiniMetric(title: "Start", value: project.startDate.isEmpty ? "Unset" : project.startDate)
                    ProjectDetailMiniMetric(title: "Due", value: project.dueDate.isEmpty ? "Unset" : project.dueDate)
                }
            }
        }
    }

    private var priorityColor: Color {
        switch project.priority.lowercased() {
        case "urgent": return colors.error
        case "high": return colors.warning
        case "low": return colors.success
        default: return colors.primary
        }
    }
}

private struct ProjectIcon: View {
    let project: Project
    let coverImageURL: URL?

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous)
                .fill(colors.surfaceHover)

            if let coverImageURL {
                AsyncImage(url: coverImageURL) { phase in
                    if case .success(let image) = phase {
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } else {
                        Text(String(project.title.prefix(1)).uppercased())
                            .font(.title2.weight(.bold))
                            .foregroundStyle(colors.primary)
                    }
                }
            } else {
                Text(String(project.title.prefix(1)).uppercased())
                    .font(.title2.weight(.bold))
                    .foregroundStyle(colors.primary)
            }
        }
        .frame(width: 58, height: 58)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
    }
}

private struct ProjectDetailMiniMetric: View {
    let title: String
    let value: String

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(colors.textMuted)
            Text(value)
                .font(.caption.weight(.semibold))
                .foregroundStyle(colors.textMain)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(PFSpacing.sm)
        .background(colors.surfaceHover)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

private struct ProjectDetailAttentionCard: View {
    let health: ProjectHealthSnapshot
    let tasks: [ProjectTask]
    let issues: [Issue]
    let milestones: [Milestone]
    let onOpenReport: () -> Void

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var openTasks: Int {
        tasks.filter { !$0.isCompleted && $0.status != "Done" }.count
    }

    private var urgentTasks: Int {
        tasks.filter { !$0.isCompleted && $0.priority == "Urgent" }.count
    }

    private var openIssues: Int {
        issues.filter { $0.status != "Resolved" && $0.status != "Closed" }.count
    }

    private var headline: String {
        if urgentTasks > 0 {
            return "\(urgentTasks) urgent task\(urgentTasks == 1 ? "" : "s") need the next move"
        }
        if openIssues > 0 {
            return "\(openIssues) open issue\(openIssues == 1 ? "" : "s") could slow delivery"
        }
        if openTasks > 0 {
            return "\(openTasks) open task\(openTasks == 1 ? "" : "s") remain"
        }
        return "Project is clear for now"
    }

    private var tint: Color {
        if urgentTasks > 0 || health.status == .critical {
            return colors.error
        }
        if openIssues > 0 || health.status == .warning {
            return colors.warning
        }
        return colors.success
    }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    Image(systemName: "target")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(tint)
                        .frame(width: 40, height: 40)
                        .background(tint.opacity(colorScheme == .dark ? 0.18 : 0.1))
                        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))

                    VStack(alignment: .leading, spacing: 3) {
                        Text("IMPORTANT NOW")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(colors.textMuted)

                        Text(headline)
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                            .lineLimit(2)

                        Text("Open work, risk, and project health at a glance.")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 0)
                }

                HStack(spacing: PFSpacing.sm) {
                    ProjectAttentionMetric(title: "Health", value: "\(Int(health.score))", tint: tint)
                    ProjectAttentionMetric(title: "Open tasks", value: "\(openTasks)", tint: colors.warning)
                    ProjectAttentionMetric(title: "Issues", value: "\(openIssues)", tint: colors.error)
                    ProjectAttentionMetric(title: "Milestones", value: "\(milestones.count)", tint: colors.primary)
                }

                Button(action: onOpenReport) {
                    Label("Open project report", systemImage: "doc.text.magnifyingglass")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(colors.primary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, PFSpacing.sm)
                        .background(colors.primary.opacity(colorScheme == .dark ? 0.16 : 0.08))
                        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct ProjectAttentionMetric: View {
    let title: String
    let value: String
    let tint: Color

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.headline.weight(.bold))
                .foregroundStyle(tint)
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(colors.textMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, PFSpacing.sm)
        .padding(.horizontal, 7)
        .background(colors.surfaceHover)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

struct CoverImageHeader: View {
    let project: Project
    let coverImageURL: URL? // Passed from store
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(spacing: 0) {
            // Cover Image Area
            GeometryReader { geo in
                ZStack {
                    // 1. Background Gradient / Image
                    if let url = coverImageURL {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .empty:
                                LinearGradient(
                                    colors: [Color.blue.opacity(0.6), Color.purple.opacity(0.6)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                            case .failure:
                                LinearGradient(
                                    colors: [Color.blue.opacity(0.6), Color.purple.opacity(0.6)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            @unknown default:
                                EmptyView()
                            }
                        }
                    } else {
                        LinearGradient(
                            colors: [Color.blue.opacity(0.6), Color.purple.opacity(0.6)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    }
                    
                    // 2. Dark Overlay for Contrast (Web style)
                    Color.black.opacity(0.2)
                    
                    // 3. Bottom Gradient for Text
                    LinearGradient(
                        colors: [.black.opacity(0), .black.opacity(0.8)],
                        startPoint: .center,
                        endPoint: .bottom
                    )
                }
            }
            .aspectRatio(16/9, contentMode: .fill) // improved aspect ratio
            .frame(maxHeight: 240)
            .clipped()
            .overlay(alignment: .bottomLeading) {
                HStack(alignment: .bottom, spacing: PFSpacing.md) {
                    // Project Icon
                    ZStack {
                        RoundedRectangle(cornerRadius: 16)
                            .fill(colors.surfaceCard)
                            .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
                        
                        // Future: Fetch icon specific asset if available
                        Text(String(project.title.prefix(1)).uppercased())
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundStyle(colors.primary)
                    }
                    .frame(width: 72, height: 72)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text(project.title)
                            .font(.system(size: 24, weight: .bold))
                            .foregroundStyle(.white)
                            .shadow(radius: 2)
                        
                        Text(project.description.isEmpty ? "No description provided" : project.description)
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(1)
                            .shadow(radius: 2)
                    }
                    .padding(.bottom, 6)
                }
                .pfScreenPadding()
                .offset(y: 32) 
            }
            .zIndex(1)
            
            // Status Bar
            HStack {
                Spacer() 
                StatusPill(text: project.status)
                    .scaleEffect(1.1)
            }
            .padding(.horizontal, PFSpacing.lg)
            .padding(.top, PFSpacing.md)
            .padding(.bottom, PFSpacing.md)
            .background(colors.surfaceCard)
        }
    }
}

// MARK: - Snapshot Section
struct SnapshotSection: View {
    let health: ProjectHealthSnapshot
    let history: [ProjectHealthSnapshotEntry]
    let tasks: [ProjectTask]
    let activity: [ActivityItem]
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    // Derived stats
    private var openTasks: Int {
        tasks.filter { !$0.isCompleted && $0.status != "Done" }.count
    }
    private var urgentTasks: Int {
        tasks.filter { !$0.isCompleted && $0.priority == "Urgent" }.count
    }
    private var inProgressTasks: Int {
        tasks.filter { !$0.isCompleted && $0.status == "In Progress" }.count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            PFSectionHeader(title: "Snapshot", subtitle: "High-level overview")
            
            // 2x2 Grid for Snapshot items
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                HealthWidget(health: health, history: history)
                WorkloadWidget(open: openTasks, urgent: urgentTasks, inProgress: inProgressTasks)
                PriorityWidget(tasks: tasks)
                ActivityWidget(activity: activity)
            }
        }
    }
}

// MARK: - Snapshot Widgets

struct HealthWidget: View {
    let health: ProjectHealthSnapshot
    let history: [ProjectHealthSnapshotEntry]
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    private var statusColor: Color {
        switch health.status {
        case .critical: return colors.error
        case .warning: return colors.warning
        case .healthy, .excellent: return colors.success
        case .normal: return colors.primary
        case .stalemate: return colors.textSubtle
        }
    }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Label("Health", systemImage: "monitor.heart") // Updated icon
                        .font(.caption.weight(.bold))
                        .foregroundStyle(colors.textMain)
                    Spacer()
                    Image(systemName: getTrendIcon(health.trend))
                        .font(.caption2)
                        .foregroundStyle(colors.textMuted)
                }
                
                Spacer()
                
                HStack(alignment: .bottom, spacing: 12) {
                    // Gauge or Chart
                    if history.count > 1 {
                        TrendChart(values: history.map { $0.score }, color: statusColor)
                            .frame(height: 40)
                    } else {
                        // Gauge (legacy fallback)
                        ZStack {
                            // Background Track
                            Circle()
                                .trim(from: 0.0, to: 0.5)
                                .stroke(colors.surfaceHover, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                                .rotationEffect(.degrees(180))
                                .frame(width: 60, height: 60)
                            
                            // Progress
                            Circle()
                                .trim(from: 0.0, to: 0.5 * min(1.0, max(0.0, Double(health.score) / 100.0)))
                                .stroke(statusColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                                .rotationEffect(.degrees(180))
                                .frame(width: 60, height: 60)
                            
                            Text("\(Int(health.score))")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(colors.textMain)
                                .offset(y: -5)
                        }
                        .frame(width: 60, height: 30)
                    }
                    
                    // Status Details
                    VStack(alignment: .leading, spacing: 2) {
                        Text(health.status.label.capitalized)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(statusColor)
                        
                        Text("/ 100")
                            .font(.caption2)
                            .foregroundStyle(colors.textMuted)
                    }
                }
                Spacer()
            }
            .padding(12)
        }
        .frame(minHeight: 120)
    }
    
    func getTrendIcon(_ trend: HealthTrend) -> String {
        switch trend {
        case .improving: return "arrow.up.right"
        case .declining: return "arrow.down.right"
        case .stable: return "minus"
        }
    }
}

struct WorkloadWidget: View {
    let open: Int
    let urgent: Int
    let inProgress: Int
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: 10) {
                Label("Workload", systemImage: "inbox")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textMain)
                
                Spacer()
                
                // Stats
                VStack(spacing: 8) {
                    WorkloadRow(label: "Open", value: "\(open)", icon: "list.bullet", color: colors.textMain)
                    WorkloadRow(label: "Urgent", value: "\(urgent)", icon: "exclamationmark.triangle.fill", color: colors.error)
                    WorkloadRow(label: "In Prog", value: "\(inProgress)", icon: "hourglass", color: colors.primary)
                }
                
                Spacer()
            }
            .padding(12)
        }
        .frame(minHeight: 120)
    }
}

struct WorkloadRow: View {
    let label: String
    let value: String
    let icon: String
    let color: Color
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    var body: some View {
         HStack {
            Image(systemName: icon)
                .font(.caption2)
                .foregroundStyle(colors.textMuted)
            Text(label)
                .font(.caption2)
                .foregroundStyle(colors.textMuted)
            Spacer()
            Text(value)
                .font(.caption.weight(.bold))
                .foregroundStyle(colors.textMain)
        }
    }
}

struct PriorityWidget: View {
    let tasks: [ProjectTask]
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private func count(_ priority: String) -> Int {
        tasks.filter { !$0.isCompleted && $0.priority == priority }.count
    }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: 10) {
                Label("Priority", systemImage: "flag")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textMain)
                
                Spacer()
                
                // Bars
                HStack(alignment: .bottom, spacing: 6) {
                    PriorityBar(label: "L", count: count("Low"), color: .gray)
                    PriorityBar(label: "M", count: count("Medium"), color: .blue)
                    PriorityBar(label: "H", count: count("High"), color: .orange)
                    PriorityBar(label: "U", count: count("Urgent"), color: colors.error)
                }
                .frame(maxHeight: 60)
                
                Spacer()
            }
            .padding(12)
        }
        .frame(minHeight: 120)
    }
}

struct PriorityBar: View {
    let label: String
    let count: Int
    let color: Color
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(spacing: 2) {
            Spacer()
            RoundedRectangle(cornerRadius: 2)
                .fill(color.opacity(0.8))
                .frame(height: max(4, CGFloat(count) * 6))
                .frame(maxHeight: 40)
            
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(colors.textMuted)
        }
        .frame(maxWidth: .infinity)
    }
}

struct ActivityWidget: View {
    let activity: [ActivityItem]
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    private var commentCount: Int {
        activity.filter { $0.action.localizedCaseInsensitiveContains("comment") }.count
    }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: 10) {
                Label("Activity", systemImage: "chart.xyaxis.line") // Updated icon
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textMain)
                
                Spacer()
                
                // Big Stats
                HStack(spacing: PFSpacing.md) {
                    VStack(alignment: .leading) {
                        Text("\(activity.count)")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(colors.textMain)
                        Text("Events")
                            .font(.caption2)
                            .foregroundStyle(colors.textMuted)
                    }
                    Spacer()
                    VStack(alignment: .leading) {
                        Text("\(commentCount)")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(colors.textMain)
                        Text("Cmts")
                            .font(.caption2)
                            .foregroundStyle(colors.textMuted)
                    }
                }
                
                Spacer()
            }
            .padding(12)
        }
        .frame(minHeight: 120)
    }
}

// MARK: - Execution Section
struct ExecutionSection: View {
    let tasks: [ProjectTask]
    let flows: [Flow]
    let issues: [Issue]
    let projectGroups: [String] // Simplified for now
    let resolvedTenantId: String?
    let permissionContext: PermissionContext
    let onToggleTask: (ProjectTask) -> Void
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            HStack {
                PFSectionHeader(title: "Execution", subtitle: "Active Items")
                Spacer()
                // Header stats if needed
            }
            
            VStack(spacing: PFSpacing.md) {
                ExecutionTaskList(
                    tasks: tasks,
                    tenantId: resolvedTenantId ?? "",
                    permissions: permissionContext,
                    onToggle: onToggleTask
                )
                
                if !flows.isEmpty {
                    NavigationLink(destination: FlowDetailView(
                        flow: flows.first!,
                        tenantId: resolvedTenantId ?? "",
                        permissions: permissionContext
                    )) {
                        FlowSpotlight(flow: flows.first!)
                    }
                    .buttonStyle(.plain)
                }
                
                if !issues.isEmpty {
                    IssueFocus(
                        issues: Array(issues.prefix(5)),
                        tenantId: resolvedTenantId ?? "",
                        permissions: permissionContext
                    )
                }
            }
        }
    }
}

struct ExecutionTaskList: View {
    let tasks: [ProjectTask]
    let tenantId: String
    let permissions: PermissionContext
    let onToggle: (ProjectTask) -> Void
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var displayTasks: [ProjectTask] {
        tasks.filter { !$0.isCompleted } // Show only open
             .sorted {
                 // Sort by Priority then Date
                 let pA = priorityValue($0.priority)
                 let pB = priorityValue($1.priority)
                 if pA != pB { return pB < pA } // Higher priority first
                 return $0.dueDate < $1.dueDate
             }
             .prefix(6)
             .map { $0 }
    }
    
    func priorityValue(_ p: String) -> Int {
        switch p {
        case "Urgent": return 4
        case "High": return 3
        case "Medium": return 2
        default: return 1
        }
    }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Label("My Tasks", systemImage: "checklist")
                        .font(.headline)
                        .foregroundStyle(colors.textMain)
                    Spacer()
                    Image(systemName: "arrow.right")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }
                .padding(PFSpacing.md)
                
                Divider()
                
                if displayTasks.isEmpty {
                    Text("No active tasks.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                        .padding(PFSpacing.lg)
                } else {
                    ForEach(displayTasks) { task in
                        NavigationLink(destination: ProjectTaskDetailView(
                            task: task,
                            tenantId: tenantId,
                            permissions: permissions
                        )) {
                            TaskRowView(task: task, onToggle: { onToggle(task) })
                        }
                        .buttonStyle(.plain)
                        
                        if task.id != displayTasks.last?.id {
                            Divider().padding(.leading, 16)
                        }
                    }
                }
            }
        }
    }
}

struct TaskRowView: View {
    let task: ProjectTask
    let onToggle: () -> Void
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    var priorityColor: Color {
        switch task.priority {
        case "Urgent": return colors.error
        case "High": return .orange
        case "Medium": return .blue
        default: return colors.textSubtle
        }
    }
    
    var priorityIcon: String {
        switch task.priority {
        case "Urgent": return "exclamationmark.triangle.fill"
        case "High": return "chevron.up.2"
        case "Medium": return "minus"
        default: return "chevron.down"
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Checkbox
            Button {
                onToggle()
            } label: {
                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(task.isCompleted ? colors.success : colors.textMuted)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
            
            VStack(alignment: .leading, spacing: 6) {
                Text(task.title)
                    .font(.subheadline)
                    .foregroundStyle(task.isCompleted ? colors.textMuted : colors.textMain)
                    .strikethrough(task.isCompleted)
                    .lineLimit(1)
                
                // Badges Row
                HStack(spacing: 8) {
                    // Priority Badge
                    HStack(spacing: 2) {
                        Image(systemName: priorityIcon)
                            .font(.caption2)
                        Text(task.priority)
                            .font(.caption2.weight(.medium))
                    }
                    .foregroundStyle(priorityColor)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(priorityColor.opacity(0.1))
                    .cornerRadius(4)
                    
                    // Due Date
                    if !task.dueDate.isEmpty {
                        let date = ISO8601DateFormatter().date(from: task.dueDate) ?? Date()
                        HStack(spacing: 2) {
                            Image(systemName: "calendar")
                                .font(.caption2)
                            Text(date.formatted(date: .abbreviated, time: .omitted))
                                .font(.caption2)
                        }
                        .foregroundStyle(colors.textSubtle)
                    }
                }
            }
            Spacer()
        }
        .padding(PFSpacing.md)
        .contentShape(Rectangle()) // Tappable area
    }
}

struct FlowSpotlight: View {
    let flow: Flow
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack {
                    Label("Flow Spotlight", systemImage: "lightbulb.fill")
                        .font(.headline)
                        .foregroundStyle(colors.textMain)
                    Spacer()
                    Image(systemName: "arrow.right")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }
                
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(flow.type.uppercased())
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(colors.primary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(colors.primary.opacity(0.1))
                            .cornerRadius(4)
                        
                        Label("AI Generated", systemImage: "sparkles")
                            .font(.caption2)
                            .foregroundStyle(.purple)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.purple.opacity(0.1))
                            .cornerRadius(4)
                        
                        Spacer()
                    }
                    
                    Text(flow.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(colors.textMain)
                        .lineLimit(2)
                    
                    Text(flow.description)
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                        .lineLimit(2)
                }
            }
            .padding(12)
        }
    }
}

struct IssueFocus: View {
    let issues: [Issue]
    let tenantId: String
    let permissions: PermissionContext
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack {
                    Label("Issue Focus", systemImage: "ant.fill")
                        .font(.headline)
                        .foregroundStyle(colors.textMain)
                    Spacer()
                    Image(systemName: "arrow.right")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }
                
                VStack(spacing: 12) {
                    ForEach(issues) { issue in
                        NavigationLink(destination: ProjectIssueDetailView(
                            issue: issue,
                            tenantId: tenantId,
                            permissions: permissions
                        )) {
                            HStack {
                                Circle()
                                    .fill(colors.error)
                                    .frame(width: 8, height: 8)
                                Text(issue.title)
                                    .font(.subheadline)
                                    .foregroundStyle(colors.textMain)
                                    .lineLimit(1)
                                Spacer()
                                Text(issue.status)
                                    .font(.caption2)
                                    .foregroundStyle(colors.textMuted)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(12)
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

// MARK: - Missing Card Widgets

struct UpdatesWidget: View {
    let activity: [ActivityItem]
    let tasks: [ProjectTask]
    let flows: [Flow]
    let issues: [Issue]
    let resolvedTenantId: String?
    let permissionContext: PermissionContext
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack {
                    Label("Latest Activity", systemImage: "clock")
                        .font(.headline)
                        .foregroundStyle(colors.textMain)
                    Spacer()
                    Image(systemName: "arrow.right")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }
                
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(activity.prefix(5)) { item in
                        activityRow(for: item)
                    }
                    if activity.isEmpty {
                        Text("No recent updates.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                    }
                }
            }
            .padding(12)
        }
    }

    @ViewBuilder
    private func activityRow(for item: ActivityItem) -> some View {
        let tenantId = resolvedTenantId ?? ""
        let permissions = permissionContext
        
        Group {
            if let task = findTask(for: item) {
                NavigationLink(destination: ProjectTaskDetailView(
                    task: task,
                    tenantId: tenantId,
                    permissions: permissions
                )) {
                    rowContent(for: item)
                }
            } else if let issue = findIssue(for: item) {
                NavigationLink(destination: ProjectIssueDetailView(
                    issue: issue,
                    tenantId: tenantId,
                    permissions: permissions
                )) {
                    rowContent(for: item)
                }
            } else if let flow = findFlow(for: item) {
                NavigationLink(destination: FlowDetailView(flow: flow, tenantId: tenantId, permissions: permissions)) {
                    rowContent(for: item)
                }
            } else {
                rowContent(for: item)
            }
        }
    }

    private func rowContent(for item: ActivityItem) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(colors.surfaceHover)
                .frame(width: 28, height: 28)
                .overlay(
                    Image(systemName: icon(for: item.type))
                        .font(.system(size: 12))
                        .foregroundStyle(colors.textMuted)
                )
            
            VStack(alignment: .leading, spacing: 2) {
                Text("\(item.user) \(item.action)")
                    .font(.subheadline)
                    .foregroundStyle(colors.textMain)
                    .lineLimit(2)
                
                Text(item.createdAt?.dateValue().formatted(.relative(presentation: .named)) ?? "Just now")
                    .font(.caption2)
                    .foregroundStyle(colors.textMuted)
            }
            Spacer()
        }
    }

    private func findTask(for activity: ActivityItem) -> ProjectTask? {
        guard activity.type == "task", let relatedId = activity.relatedId else { return nil }
        return tasks.first { $0.id == relatedId }
    }

    private func findIssue(for activity: ActivityItem) -> Issue? {
        guard activity.type == "issue", let relatedId = activity.relatedId else { return nil }
        return issues.first { $0.id == relatedId }
    }

    private func findFlow(for activity: ActivityItem) -> Flow? {
        guard activity.type == "idea" || activity.type == "flow", let relatedId = activity.relatedId else { return nil }
        return flows.first { $0.id == relatedId }
    }

    private func icon(for type: String) -> String {
        switch type {
        case "task": return "checklist"
        case "issue": return "ant.fill"
        case "comment": return "bubble.left.fill"
        case "file": return "doc.fill"
        case "report": return "sparkles"
        default: return "circle.fill"
        }
    }
}

struct ResourcesWidget: View {
    let project: Project
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                Label("Resources", systemImage: "folder")
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                
                let allLinks = project.links + project.externalResources
                
                if allLinks.isEmpty {
                    Text("No resources added yet.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(allLinks) { link in
                            LinkRow(title: link.title, url: link.url)
                        }
                    }
                }
            }
            .padding(12)
        }
    }
}

struct LinkRow: View {
    let title: String
    let url: String
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    var body: some View {
        if let linkURL = URL(string: url.contains("://") ? url : "https://\(url)") {
            Link(destination: linkURL) {
                HStack {
                    Image(systemName: "link")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                    Text(title)
                        .font(.subheadline)
                        .foregroundStyle(colors.primary)
                    Spacer()
                    Image(systemName: "arrow.up.right")
                        .font(.caption2)
                        .foregroundStyle(colors.textMuted)
                }
                .padding(.vertical, 4)
            }
        } else {
            HStack {
                Image(systemName: "link")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)
                Spacer()
            }
            .padding(.vertical, 4)
        }
    }
}

struct PlanningWidget: View {
    let project: Project
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    private func formatDate(_ isoString: String) -> String {
        guard !isoString.isEmpty else { return "Not set" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: isoString) {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
        return isoString.prefix(10).description
    }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                Label("Planning", systemImage: "calendar")
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                
                HStack {
                    VStack(alignment: .leading) {
                        Text("Start Date")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                        Text(formatDate(project.startDate))
                            .font(.subheadline)
                            .foregroundStyle(colors.textMain)
                    }
                    Spacer()
                    VStack(alignment: .trailing) {
                        Text("Due Date")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                        Text(formatDate(project.dueDate))
                            .font(.subheadline)
                            .foregroundStyle(colors.textMain)
                    }
                }
                
                // Progress Bar
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Progress")
                            .font(.caption)
                        Spacer()
                        Text("\(Int(project.progress))%")
                            .font(.caption.weight(.bold))
                    }
                    .foregroundStyle(colors.textMuted)
                    
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(colors.surfaceHover)
                            Capsule()
                                .fill(colors.primary)
                                .frame(width: g.size.width * CGFloat(project.progress) / 100.0)
                        }
                    }
                    .frame(height: 6)
                }
            }
            .padding(12)
        }
    }
}

struct MilestonesWidget: View {
    let milestones: [Milestone]
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                Label("Milestones", systemImage: "flag.checkered")
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                
                if milestones.isEmpty {
                    Text("No milestones set.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(milestones.prefix(3)) { milestone in
                            HStack {
                                Circle()
                                    .fill(milestone.status == "Achieved" ? colors.success : colors.warning)
                                    .frame(width: 8, height: 8)
                                
                                Text(milestone.title)
                                    .font(.subheadline)
                                    .foregroundStyle(colors.textMain)
                                    .lineLimit(1)
                                
                                Spacer()
                                
                                Text(milestone.dueDate.prefix(10))
                                    .font(.caption2)
                                    .foregroundStyle(colors.textMuted)
                            }
                        }
                    }
                }
            }
            .padding(12)
        }
    }
}

struct AiInsightsWidget: View {
    let report: GeminiReport?
    let onTap: () -> Void
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: onTap) {
            PFCard {
                HStack(spacing: 12) {
                    Image(systemName: "sparkles")
                        .font(.title2)
                        .foregroundStyle(.purple)
                        .frame(width: 40, height: 40)
                        .background(Color.purple.opacity(0.1))
                        .clipShape(Circle())
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CORA Intelligence")
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        
                        if let report = report {
                            Text("Updated \(report.createdAt?.dateValue().formatted(.relative(presentation: .named)) ?? "recently")")
                                .font(.caption)
                                .foregroundStyle(colors.textMuted)
                        } else {
                            Text("Generate project analysis")
                                .font(.caption)
                                .foregroundStyle(colors.textMuted)
                        }
                    }
                    Spacer()
                    Image(systemName: "arrow.right")
                        .foregroundStyle(colors.textMuted)
                }
                .padding(12)
            }
        }
        .buttonStyle(.plain)
    }
}

struct TeamWidget: View {
    let profiles: [UserProfile]
    let onEdit: () -> Void
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack {
                    Label("Team", systemImage: "person.2")
                        .font(.headline)
                        .foregroundStyle(colors.textMain)
                    Spacer()
                    Button(action: onEdit) {
                        Image(systemName: "pencil.circle")
                            .foregroundStyle(colors.primary)
                    }
                }
                
                if profiles.isEmpty {
                    Text("No members listed.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                } else {
                    HStack(spacing: -8) {
                        ForEach(profiles.prefix(5)) { profile in
                            ZStack {
                                Circle()
                                    .fill(colors.surfaceCard)
                                    .frame(width: 34, height: 34)
                                
                                if let photoURL = profile.photoURL, let url = URL(string: photoURL) {
                                    AsyncImage(url: url) { image in
                                        image.resizable().scaledToFill()
                                    } placeholder: {
                                        colors.surfaceHover
                                    }
                                    .frame(width: 32, height: 32)
                                    .clipShape(Circle())
                                } else {
                                    Circle()
                                        .fill(colors.primary.opacity(0.2))
                                        .frame(width: 32, height: 32)
                                        .overlay(
                                            Text(String(profile.displayName.prefix(1)).uppercased())
                                                .font(.caption2.weight(.bold))
                                                .foregroundStyle(colors.primary)
                                        )
                                }
                            }
                            .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
                        }
                        
                        if profiles.count > 5 {
                            Circle()
                                .fill(colors.surfaceHover)
                                .frame(width: 32, height: 32)
                                .overlay(Text("+\(profiles.count - 5)").font(.caption2).foregroundStyle(colors.textMuted))
                                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
                        }
                    }
                }
            }
            .padding(12)
        }
    }
}

struct ControlsWidget: View {
    let project: Project
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                Label("Controls", systemImage: "slider.horizontal.3")
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                
                HStack {
                    Text("Status")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                    Spacer()
                    StatusPill(text: project.status)
                }
                
                Divider()
                
                HStack {
                    Text("Priority")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                    Spacer()
                    Text(project.priority.isEmpty ? "None" : project.priority)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(colors.textMain)
                }
            }
            .padding(12)
        }
    }
}
