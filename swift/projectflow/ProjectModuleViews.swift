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
                    Text("Company Command").font(.headline)
                    if let profile = project.startupProfile {
                        Text("Stage: \(StartupProjects.stageLabel(profile.stage))")
                            .font(.subheadline.weight(.semibold))
                    }
                    if let readiness = project.startupReadiness {
                        let percents = StartupProjects.readinessPercent(readiness)
                        HStack {
                            metric(label: "Formation", value: percents.formation)
                            metric(label: "Launch", value: percents.launch)
                        }
                    }
                    if !linkedProjects.isEmpty {
                        Text("Linked workstreams").font(.subheadline.weight(.semibold))
                        ForEach(linkedProjects, id: \.id) { linked in
                            NavigationLink(linked.title) {
                                ProjectOverviewView(project: linked, tenantId: linked.tenantId ?? project.tenantId ?? "")
                            }
                            .font(.subheadline)
                        }
                    }
                }
            }
        }
    }

    private func metric(label: String, value: Int) -> some View {
        VStack(alignment: .leading) {
            Text(label).font(.caption).foregroundStyle(colors.textMuted)
            Text("\(value)%").font(.title3.weight(.bold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct ProjectModuleNavBar: View {
    let project: Project
    let permissions: PermissionContext
    @Binding var selection: ProjectNavDestination

    private var evaluator: PermissionEvaluator { PermissionEvaluator(context: permissions) }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: PFSpacing.sm) {
                navChip(.overview, title: "Overview")
                if evaluator.canViewModule(.initiatives, project: project) {
                    navChip(.initiatives, title: "Initiatives")
                }
                if evaluator.canViewModule(.tasks, project: project) {
                    navChip(.tasks, title: "Tasks")
                }
                if evaluator.canViewModule(.sprints, project: project) {
                    navChip(.sprints, title: "Sprints")
                }
                if evaluator.canViewModule(.issues, project: project) {
                    navChip(.issues, title: "Issues")
                }
                if evaluator.canViewModule(.ideas, project: project) {
                    navChip(.flows, title: "Flows")
                }
                if evaluator.canViewModule(.milestones, project: project) {
                    navChip(.milestones, title: "Milestones")
                }
                if evaluator.canViewModule(.activity, project: project) {
                    navChip(.activity, title: "Activity")
                }
                navChip(.codex, title: "Codex")
                navChip(.details, title: "Settings")
            }
            .padding(.horizontal, PFSpacing.md)
        }
    }

    private func navChip(_ destination: ProjectNavDestination, title: String) -> some View {
        Button {
            selection = destination
        } label: {
            Text(title)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(selection == destination ? Color.accentColor.opacity(0.15) : Color.clear)
                .overlay(
                    Capsule().stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                )
                .clipShape(Capsule())
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

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: PFSpacing.sm) {
                    ForEach(ActivityFeedFilter.allCases) { filter in
                        Button(filter.label) { typeFilter = filter }
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(typeFilter == filter ? Color.accentColor.opacity(0.15) : Color.clear)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(Color.secondary.opacity(0.25)))
                    }
                }
                .padding(.horizontal, PFSpacing.md)
                .padding(.vertical, PFSpacing.sm)
            }

            Picker("Range", selection: $timeRange) {
                ForEach(ActivityTimeRange.allCases) { range in
                    Text(range.label).tag(range)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, PFSpacing.md)
            .padding(.bottom, PFSpacing.sm)

            List(filteredItems, id: \.id) { item in
                HStack(alignment: .top, spacing: PFSpacing.sm) {
                    Image(systemName: ActivityPresentation.icon(for: item))
                        .foregroundStyle(.secondary)
                        .frame(width: 24)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.action).font(.subheadline.weight(.semibold))
                        Text(item.details).font(.caption).foregroundStyle(.secondary)
                        if let created = item.createdAt?.dateValue() {
                            Text(created.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(item.action). \(item.details)")
            }
        }
        .navigationTitle(L10n.tr("activity.all", fallback: "Activity"))
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

    var body: some View {
        List {
            Section("Sessions") {
                if sessions.isEmpty {
                    Text("No Codex sessions yet.").foregroundStyle(.secondary)
                } else {
                    ForEach(sessions, id: \.id) { session in
                        VStack(alignment: .leading) {
                            Text(session.title).font(.headline)
                            if !session.summary.isEmpty {
                                Text(session.summary).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            Section("Follow-ups") {
                if followUps.isEmpty {
                    Text("No follow-ups.").foregroundStyle(.secondary)
                } else {
                    ForEach(followUps, id: \.id) { item in
                        VStack(alignment: .leading) {
                            Text(item.title).font(.subheadline.weight(.semibold))
                            Text(item.description).font(.caption)
                        }
                    }
                }
            }
        }
        .navigationTitle("Codex")
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

    var body: some View {
        List(milestones, id: \.id) { milestone in
            VStack(alignment: .leading) {
                Text(milestone.title).font(.headline)
                Text(milestone.status).font(.caption)
            }
        }
        .navigationTitle("Milestones")
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

    var body: some View {
        List(sprints, id: \.id) { sprint in
            VStack(alignment: .leading) {
                Text(sprint.name).font(.headline)
                Text("\(sprint.startDate) – \(sprint.endDate)").font(.caption)
                Text(sprint.status).font(.caption2)
            }
        }
        .navigationTitle("Sprints")
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

    var body: some View {
        Form {
            Section("Modules") {
                ForEach(project.modules, id: \.self) { module in
                    Text(module)
                }
            }
            if let repo = project.githubRepo {
                Section("GitHub") {
                    Text(repo)
                    if project.githubIssueSync {
                        Text("Issue sync enabled").font(.caption)
                    }
                }
            }
            Section("Web") {
                if let url = OpenInWebLink.project(project.id, path: "/details") {
                    Button("Open full settings in web") { openURL(url) }
                }
            }
        }
        .navigationTitle("Project Settings")
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
