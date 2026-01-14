import SwiftUI
import UniformTypeIdentifiers
import FirebaseCore // For Timestamp
import FirebaseStorage


struct ProjectOverviewView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    let project: Project
    let tenantId: String?
    @StateObject private var store = ProjectOverviewStore()
    @StateObject private var layoutStore = ProjectOverviewLayoutStore()
    @StateObject private var tenantStore = TenantStore()
    @State private var draggingCardId: String?
    @State private var showingCustomizer = false
    @State private var isEditing = false

    init(project: Project, tenantId: String? = nil) {
        self.project = project
        self.tenantId = tenantId
    }

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let columns = [GridItem(.flexible())] // Single column for mobile vertical layout
    private var resolvedTenantId: String? {
        tenantId ?? project.tenantId
    }
    private var permissionContext: PermissionContext {
        tenantStore.permissionContext(projectOwnerId: project.ownerId)
    }
    private var canEditLayout: Bool {
        PermissionEvaluator(context: permissionContext).allows(PermissionNode.projectSettingsEdit)
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
                VStack(spacing: 0) {
                    // Header fits edge-to-edge at the top of the scroll view
                    CoverImageHeader(project: project, coverImageURL: store.coverImageURL)
                    
                    content
                        .padding(PFSpacing.lg)
                        .padding(.bottom, 100) // Extra padding for scrolling
                }
            }
            .edgesIgnoringSafeArea(.top)
        }
        .navigationTitle(project.title)
        .toolbar(.hidden, for: .navigationBar) // iOS 16+
        .edgesIgnoringSafeArea(.top)
//        .toolbar { overviewToolbar } // Toolbar temporarily disabled or needs adjustment for new layout
        .sheet(isPresented: $showingCustomizer) {
            ProjectOverviewCustomizationSheet(
                layout: $layoutStore.layout,
                onReset: {
                    layoutStore.resetToDefault()
                    persistLayoutChanges()
                },
                onDone: {
                    persistLayoutChanges()
                    showingCustomizer = false
                }
            )
        }
        .onAppear {
            tenantStore.update(for: session.user)
            guard let tenantId = resolvedTenantId else { return }
            store.start(tenantId: tenantId, projectId: project.id)
            layoutStore.start(tenantId: tenantId, projectId: project.id)
        }
        .onChange(of: session.user) { _, user in
            tenantStore.update(for: user)
        }
        .onDisappear {
            store.stop()
            layoutStore.stop()
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
                    // Always show Snapshot & Execution. 
                    // Layout customization logic reserved for future or re-enabled later.
                    
                    SnapshotSection(health: healthSnapshot, tasks: store.tasks, activity: store.activity)
                    
                    ExecutionSection(tasks: store.tasks, flows: store.flows, issues: store.issues, projectGroups: [])
                    
                    // Added Missing Cards
                    Group {
                         // Updates
                        UpdatesWidget(activity: store.activity)
                        
                        // Resources
                        ResourcesWidget() // Needs project links
                        
                        // Planning
                        PlanningWidget(project: project)
                        
                        // Milestones
                        MilestonesWidget(milestones: store.milestones)
                        
                        // AI Insights
                        AiInsightsWidget()
                        
                        // Team
                        TeamWidget() // Needs team profiles
                        
                        // Controls
                        ControlsWidget(project: project)
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

    private var persistLayoutChanges: () -> Void = {} // Placeholder if needed
}

// MARK: - Header
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
                .padding(PFSpacing.lg)
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
    let tasks: [Task]
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
                HealthWidget(health: health)
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
                    // Gauge
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
                            .font(.title3.weight(.bold))
                            .foregroundStyle(colors.textMain)
                            .offset(y: -5)
                    }
                    .frame(width: 60, height: 30)
                    
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
    let tasks: [Task]
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
    let tasks: [Task]
    let flows: [Flow]
    let issues: [Issue]
    let projectGroups: [String] // Simplified for now
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
                ExecutionTaskList(tasks: tasks)
                
                if !flows.isEmpty {
                    FlowSpotlight(flow: flows.first!)
                }
                
                if !issues.isEmpty {
                    IssueFocus(issues: Array(issues.prefix(5)))
                }
            }
        }
    }
}

struct ExecutionTaskList: View {
    let tasks: [Task]
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var displayTasks: [Task] {
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
                        TaskRowView(task: task)
                        
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
    let task: Task
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
            Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .foregroundStyle(task.isCompleted ? colors.success : colors.textMuted)
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
                }
            }
            .padding(12)
        }
    }
}


private struct ProjectOverviewDropDelegate: DropDelegate {
    let item: ProjectOverviewCardConfig
    @Binding var cards: [ProjectOverviewCardConfig]
    @Binding var draggingCardId: String?
    let onDrop: () -> Void

    func dropEntered(info: DropInfo) {
        guard let draggingId = draggingCardId,
              draggingId != item.id,
              let fromIndex = cards.firstIndex(where: { $0.id == draggingId }),
              let toIndex = cards.firstIndex(where: { $0.id == item.id })
        else { return }

        withAnimation(.spring(response: 0.25, dampingFraction: 0.85)) {
            cards.move(fromOffsets: IndexSet(integer: fromIndex), toOffset: toIndex > fromIndex ? toIndex + 1 : toIndex)
        }
    }

    func performDrop(info: DropInfo) -> Bool {
        draggingCardId = nil
        onDrop()
        return true
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
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

private struct ProjectOverviewCustomizationSheet: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var layout: ProjectOverviewLayout
    let onReset: () -> Void
    let onDone: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: PFSpacing.md) {
                        VStack(alignment: .leading, spacing: PFSpacing.xs) {
                            Text("Active Template")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(colors.textMuted)
                            Text(layout.templateLabel)
                                .font(.title3.weight(.bold))
                                .foregroundStyle(colors.textMain)
                        }

                        Text("Toggle cards on or off. Drag and drop on the overview screen to change their order.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)

                        VStack(spacing: PFSpacing.sm) {
                            ForEach($layout.cards) { $card in
                                Toggle(isOn: $card.isEnabled) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(card.type.title)
                                            .font(.headline)
                                            .foregroundStyle(colors.textMain)
                                        Text(card.type.subtitle)
                                            .font(.caption)
                                            .foregroundStyle(colors.textMuted)
                                    }
                                }
                                .toggleStyle(SwitchToggleStyle(tint: colors.primary))
                                .padding(PFSpacing.md)
                                .background(colors.surfaceCard)
                                .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
                                .shadow(color: colors.shadowSm, radius: 4, x: 0, y: 2)
                            }
                        }
                    }
                    .padding(PFSpacing.lg)
                }
            }
            .navigationTitle("Customize Overview")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Reset") {
                        onReset()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        onDone()
                    }
                }
            }
        }
        .onChange(of: layout.cards) { _, _ in
            if layout.templateId != ProjectOverviewTemplateId.custom {
                layout.templateId = ProjectOverviewTemplateId.custom
            }
        }
    }
}

// MARK: - Missing Card Widgets

struct UpdatesWidget: View {
    let activity: [ActivityItem]
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
                        HStack(alignment: .top, spacing: 10) {
                            Circle()
                                .fill(colors.surfaceHover)
                                .frame(width: 28, height: 28)
                                .overlay(
                                    Image(systemName: "bubble.left.fill") // Generic icon
                                        .font(.caption2)
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
                        }
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
}

struct ResourcesWidget: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                Label("Resources", systemImage: "folder")
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Quick Links")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(colors.textMain)
                    
                    // Placeholder links
                    LinkRow(title: "Project Drive", url: "https://drive.google.com")
                    LinkRow(title: "Design System", url: "https://figma.com")
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
}

struct PlanningWidget: View {
    let project: Project
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

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
                        Text(project.startDate.isEmpty ? "Not set" : project.startDate)
                            .font(.subheadline)
                            .foregroundStyle(colors.textMain)
                    }
                    Spacer()
                    VStack(alignment: .trailing) {
                        Text("Due Date")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                        Text(project.dueDate.isEmpty ? "Not set" : project.dueDate)
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
                        Text("\(project.progress)%")
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
                    ForEach(milestones.prefix(3)) { milestone in
                        HStack {
                            Circle()
                                .fill(milestone.status == "Achieved" ? colors.success : colors.warning)
                                .frame(width: 8, height: 8)
                            
                            Text(milestone.title)
                                .font(.subheadline)
                                .foregroundStyle(colors.textMain)
                            
                            Spacer()
                            
                            Text(milestone.dueDate ?? "")
                                .font(.caption2)
                                .foregroundStyle(colors.textMuted)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
            .padding(12)
        }
    }
}

struct AiInsightsWidget: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            HStack(spacing: 12) {
                Image(systemName: "sparkles")
                    .font(.title2)
                    .foregroundStyle(.purple)
                    .frame(width: 40, height: 40)
                    .background(Color.purple.opacity(0.1))
                    .clipShape(Circle())
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("AI Insights")
                        .font(.headline)
                        .foregroundStyle(colors.textMain)
                    Text("Generate a new project report")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }
                Spacer()
                Image(systemName: "arrow.right")
                    .foregroundStyle(colors.textMuted)
            }
            .padding(12)
        }
    }
}

struct TeamWidget: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                Label("Team", systemImage: "person.2")
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                
                HStack(spacing: -8) {
                    ForEach(0..<4) { i in
                        Circle()
                            .fill(Color(hue: Double(i) * 0.1, saturation: 0.5, brightness: 0.8))
                            .frame(width: 32, height: 32)
                            .overlay(Text("U\(i)").font(.caption2).foregroundStyle(.white))
                            .shadow(color: colors.shadowSm, radius: 3, x: 0, y: 2)
                    }
                    
                    Circle()
                        .fill(colors.surfaceHover)
                        .frame(width: 32, height: 32)
                        .overlay(Text("+2").font(.caption2).foregroundStyle(colors.textMuted))
                        .shadow(color: colors.shadowSm, radius: 3, x: 0, y: 2)
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
                    Text(project.priority)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(colors.textMain)
                }
            }
            .padding(12)
        }
    }
}
