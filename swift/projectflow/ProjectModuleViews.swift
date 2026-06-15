import SwiftUI
import FirebaseFirestore
import Combine

struct CompanyProjectOverviewSection: View {
    let project: Project
    let linkedProjects: [Project]
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        if project.isCompanyProject {
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.md) {
                    PFSectionTitle(
                        title: L10n.tr("company.entry", fallback: "Company command"),
                        subtitle: project.startupProfile.map { "\(L10n.tr("company.stage", fallback: "Stage")): \(StartupProjects.stageLabel($0.stage))" }
                    )
                    if let readiness = project.startupReadiness {
                        let percents = StartupProjects.readinessPercent(readiness)
                        HStack(spacing: PFSpacing.lg) {
                            ring(label: L10n.tr("company.formation", fallback: "Formation"), value: percents.formation, tint: colors.primary)
                            ring(label: L10n.tr("company.launch", fallback: "Launch"), value: percents.launch, tint: colors.success)
                            Spacer(minLength: 0)
                        }
                    }
                    if !linkedProjects.isEmpty {
                        Divider()
                        PFFieldLabel(text: L10n.tr("company.workstreams", fallback: "Workstreams"))
                        ForEach(linkedProjects, id: \.id) { linked in
                            NavigationLink {
                                ProjectOverviewView(project: linked, tenantId: linked.tenantId ?? project.tenantId ?? "")
                            } label: {
                                PFListRow(
                                    title: linked.title,
                                    subtitle: "\(Int(linked.progress))%",
                                    icon: "square.stack.3d.up",
                                    iconTint: PFSemantic.statusTint(linked.status, colors: colors)
                                )
                                .padding(.vertical, 2)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private func ring(label: String, value: Int, tint: Color) -> some View {
        VStack(spacing: PFSpacing.xs) {
            PFCircularProgress(value: Double(value) / 100, tint: tint, size: 60, label: "\(value)%")
            Text(label).font(PFFont.chip).foregroundStyle(colors.textMuted)
        }
    }
}

struct ProjectModuleNavBar: View {
    let project: Project
    let permissions: PermissionContext
    @Binding var selection: ProjectNavDestination
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var evaluator: PermissionEvaluator { PermissionEvaluator(context: permissions) }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: PFSpacing.xs) {
                navChip(.overview, title: L10n.tr("tabs.home", fallback: "Overview"))
                if evaluator.canViewModule(.initiatives, project: project) {
                    navChip(.initiatives, title: L10n.tr("work.initiatives", fallback: "Initiatives"))
                }
                if evaluator.canViewModule(.tasks, project: project) {
                    navChip(.tasks, title: L10n.tr("work.tasks", fallback: "Tasks"))
                }
                if !PmCoreConfig.isPmCoreOnly && evaluator.canViewModule(.sprints, project: project) {
                    navChip(.sprints, title: L10n.tr("deadline.sprints", fallback: "Sprints"))
                }
                if evaluator.canViewModule(.milestones, project: project) {
                    navChip(.milestones, title: L10n.tr("deadline.milestones", fallback: "Milestones"))
                }
                if evaluator.canViewModule(.activity, project: project) {
                    navChip(.activity, title: L10n.tr("module.activity", fallback: "Activity"))
                }
                navChip(.codex, title: "Codex")
                navChip(.details, title: L10n.tr("settings.title", fallback: "Settings"))
            }
            .padding(.horizontal, 2)
        }
    }

    private func navChip(_ destination: ProjectNavDestination, title: String) -> some View {
        let isSelected = selection == destination
        return Button {
            withAnimation(.spring(response: 0.28, dampingFraction: 0.8)) { selection = destination }
        } label: {
            Text(title)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(isSelected ? colors.primaryText : colors.textMuted)
                .padding(.horizontal, PFSpacing.md)
                .padding(.vertical, PFSpacing.sm + 1)
                .background(isSelected ? colors.primary : colors.surfaceHover)
                .clipShape(Capsule())
                .pfElevation(isSelected ? .card : .none)
        }
        .buttonStyle(.plain)
    }
}

struct ProjectActivityView: View {
    let tenantId: String
    let projectId: String
    @StateObject private var store = ActivityFeedStore()
    @State private var typeFilter: ActivityFeedFilter = .all
    @State private var timeRange: ActivityTimeRange = .week

    private var filteredItems: [ActivityItem] {
        ActivityPresentation.filter(store.items, type: typeFilter, range: timeRange)
    }

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionTitle(title: L10n.tr("module.activity", fallback: "Activity"))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: PFSpacing.xs) {
                    ForEach(ActivityFeedFilter.allCases) { filter in
                        let isSelected = typeFilter == filter
                        Button { typeFilter = filter } label: {
                            Text(filter.label)
                                .font(PFFont.chip)
                                .foregroundStyle(isSelected ? colors.primaryText : colors.textMuted)
                                .padding(.horizontal, PFSpacing.md)
                                .padding(.vertical, PFSpacing.sm)
                                .background(isSelected ? colors.primary : colors.surfaceHover)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Picker("Range", selection: $timeRange) {
                ForEach(ActivityTimeRange.allCases) { range in
                    Text(range.label).tag(range)
                }
            }
            .pickerStyle(.segmented)

            if filteredItems.isEmpty {
                PFCard { PFEmptyState(icon: "clock.arrow.circlepath", title: L10n.tr("module.activity.empty", fallback: "No activity yet.")) }
            } else {
                PFCard {
                    VStack(spacing: 0) {
                        ForEach(filteredItems, id: \.id) { item in
                            HStack(alignment: .top, spacing: PFSpacing.sm) {
                                PFIconTile(icon: ActivityPresentation.icon(for: item), tint: colors.textMuted, size: 30, corner: PFRadius.sm)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.action).font(PFFont.rowTitle).foregroundStyle(colors.textMain)
                                    if !item.details.isEmpty {
                                        Text(item.details).font(PFFont.detail).foregroundStyle(colors.textMuted)
                                    }
                                    if let created = item.createdAt?.dateValue() {
                                        Text(created.formatted(date: .abbreviated, time: .shortened))
                                            .font(.caption2).foregroundStyle(colors.textSubtle)
                                    }
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.vertical, PFSpacing.sm)
                            if item.id != filteredItems.last?.id { Divider() }
                        }
                    }
                }
            }
        }
        .onAppear { store.start(tenantId: tenantId, projectId: projectId) }
        .onDisappear { store.stop() }
    }
}

@MainActor
final class ActivityFeedStore: ObservableObject {
    @Published var items: [ActivityItem] = []
    private let repository = ActivityRepository()
    private var listener: ListenerRegistration?

    func start(tenantId: String, projectId: String) {
        listener = repository.listenActivity(tenantId: tenantId, projectId: projectId) { [weak self] items in
            self?.items = items
        }
    }

    func stop() { listener?.remove() }
}

struct ProjectCodexView: View {
    let tenantId: String
    let projectId: String
    @State private var sessions: [CodexSession] = []
    @State private var followUps: [CodexFollowUp] = []
    private let repository = CodexRepository()
    @State private var sessionListener: ListenerRegistration?
    @State private var followUpListener: ListenerRegistration?
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            if sessions.isEmpty && followUps.isEmpty {
                PFCard { PFEmptyState(icon: "terminal", title: L10n.tr("module.codex.empty", fallback: "No Codex sessions yet.")) }
            } else {
                if !sessions.isEmpty {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        PFSectionTitle(title: L10n.tr("module.codex.sessions", fallback: "Sessions"))
                        VStack(spacing: PFSpacing.sm) {
                            ForEach(sessions, id: \.id) { session in
                                PFCard {
                                    PFListRow(
                                        title: session.title,
                                        subtitle: session.summary.isEmpty ? nil : session.summary,
                                        icon: "terminal",
                                        iconTint: PFSemantic.statusTint(session.status, colors: colors),
                                        showsChevron: false
                                    )
                                }
                            }
                        }
                    }
                }
                if !followUps.isEmpty {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        PFSectionTitle(title: L10n.tr("module.codex.followups", fallback: "Follow-ups"))
                        VStack(spacing: PFSpacing.sm) {
                            ForEach(followUps, id: \.id) { item in
                                PFCard {
                                    PFListRow(
                                        title: item.title,
                                        subtitle: item.description.isEmpty ? nil : item.description,
                                        icon: "arrow.turn.down.right",
                                        iconTint: colors.textMuted,
                                        showsChevron: false
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
        .onAppear {
            sessionListener = repository.listenSessions(tenantId: tenantId, projectId: projectId) { sessions = $0 }
            followUpListener = repository.listenFollowUps(tenantId: tenantId, projectId: projectId) { followUps = $0 }
        }
        .onDisappear {
            sessionListener?.remove()
            followUpListener?.remove()
        }
    }
}

struct ProjectMilestonesView: View {
    let tenantId: String
    let projectId: String
    let permissions: PermissionContext
    @State private var milestones: [Milestone] = []
    private let repository = MilestoneRepository()
    @State private var listener: ListenerRegistration?
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionTitle(title: L10n.tr("deadline.milestones", fallback: "Milestones"))
            if milestones.isEmpty {
                PFCard { PFEmptyState(icon: "flag.checkered", title: L10n.tr("module.milestones.empty", fallback: "No milestones yet.")) }
            } else {
                VStack(spacing: PFSpacing.sm) {
                    ForEach(milestones, id: \.id) { milestone in
                        PFCard {
                            HStack(spacing: PFSpacing.sm) {
                                PFDot(tint: milestone.status == "Achieved" ? colors.success : colors.warning, size: 9)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(milestone.title).font(PFFont.rowTitle).foregroundStyle(colors.textMain).lineLimit(1)
                                    Text(milestone.status).font(PFFont.detail).foregroundStyle(colors.textMuted)
                                }
                                Spacer()
                                if !milestone.dueDate.isEmpty {
                                    Text(String(milestone.dueDate.prefix(10))).font(PFFont.detail).foregroundStyle(colors.textMuted)
                                }
                            }
                        }
                    }
                }
            }
        }
        .onAppear {
            listener = repository.listenMilestones(tenantId: tenantId, projectId: projectId) { milestones = $0 }
        }
        .onDisappear { listener?.remove() }
    }
}

struct ProjectSprintsView: View {
    let tenantId: String
    let projectId: String
    let permissions: PermissionContext
    @State private var sprints: [Sprint] = []
    private let repository = SprintRepository()
    @State private var listener: ListenerRegistration?
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionTitle(title: L10n.tr("deadline.sprints", fallback: "Sprints"))
            if sprints.isEmpty {
                PFCard { PFEmptyState(icon: "figure.run", title: L10n.tr("module.sprints.empty", fallback: "No sprints yet.")) }
            } else {
                VStack(spacing: PFSpacing.sm) {
                    ForEach(sprints, id: \.id) { sprint in
                        PFCard {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(sprint.name).font(PFFont.rowTitle).foregroundStyle(colors.textMain)
                                    Spacer()
                                    PFStatusChip(status: sprint.status)
                                }
                                if !sprint.startDate.isEmpty || !sprint.endDate.isEmpty {
                                    Text("\(String(sprint.startDate.prefix(10))) – \(String(sprint.endDate.prefix(10)))")
                                        .font(PFFont.detail).foregroundStyle(colors.textMuted)
                                }
                            }
                        }
                    }
                }
            }
        }
        .onAppear {
            listener = repository.listenSprints(tenantId: tenantId, projectId: projectId) { sprints = $0 }
        }
        .onDisappear { listener?.remove() }
    }
}

struct CalendarView: View {
    @EnvironmentObject private var session: AppSession
    @StateObject private var tasksStore = TasksStore()

    var body: some View {
        NavigationStack {
            List(scheduledTasks, id: \.id) { task in
                VStack(alignment: .leading) {
                    Text(task.title).font(.headline)
                    Text(task.scheduledDate.isEmpty ? task.dueDate : task.scheduledDate)
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Calendar")
            .onAppear {
                if let tenantId = session.activeTenantId {
                    tasksStore.start(tenantId: tenantId)
                }
            }
            .onDisappear { tasksStore.stop() }
        }
    }

    private var scheduledTasks: [ProjectTask] {
        tasksStore.tasks.filter { !$0.scheduledDate.isEmpty || !$0.dueDate.isEmpty }
    }
}

struct TeamView: View {
    @EnvironmentObject private var session: AppSession
    @StateObject private var workspaceStore = WorkspaceStore()

    var body: some View {
        NavigationStack {
            List(workspaceStore.workspaces, id: \.id) { workspace in
                VStack(alignment: .leading) {
                    Text(workspace.name).font(.headline)
                    Text(workspace.role).font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Team")
            .onAppear {
                if let uid = session.membership?.id {
                    workspaceStore.start(userId: uid)
                }
            }
        }
    }
}

struct ProjectDetailsView: View {
    let project: Project
    let tenantId: String
    let permissions: PermissionContext
    @Environment(\.openURL) private var openURL
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.sm) {
                    PFSectionTitle(title: L10n.tr("module.settings.modules", fallback: "Modules"))
                    if project.modules.isEmpty {
                        Text(L10n.tr("common.none", fallback: "None")).font(PFFont.body).foregroundStyle(colors.textMuted)
                    } else if #available(iOS 16.0, *) {
                        FlowLayout(spacing: PFSpacing.sm) {
                            ForEach(project.modules, id: \.self) { module in
                                PFTag(text: module.capitalized)
                            }
                        }
                    } else {
                        HStack { ForEach(project.modules, id: \.self) { PFTag(text: $0.capitalized) } }
                    }
                }
            }

            if let repo = project.githubRepo, !repo.isEmpty {
                PFCard {
                    PFListRow(title: repo, icon: "chevron.left.slash.chevron.right", iconTint: colors.textMuted, showsChevron: false)
                }
            }

            if let url = OpenInWebLink.project(project.id, path: "/details") {
                Button { openURL(url) } label: {
                    HStack {
                        Label(L10n.tr("module.settings.web", fallback: "Open full settings on the web"), systemImage: "safari")
                            .font(PFFont.rowTitle)
                        Spacer()
                        Image(systemName: "arrow.up.right").font(.caption.weight(.bold))
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

struct OpenInWebButton: View {
    let url: URL?
    let title: String
    @Environment(\.openURL) private var openURL

    var body: some View {
        if let url {
            Button(title) { openURL(url) }
        }
    }
}
