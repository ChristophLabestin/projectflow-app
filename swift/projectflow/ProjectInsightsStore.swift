import Foundation
import Combine
import FirebaseFirestore

struct ProjectMetrics: Equatable {
    var taskCount: Int
    var taskCompleted: Int
    var flowCount: Int
    var issueCount: Int
    var openIssueCount: Int

    static let empty = ProjectMetrics(taskCount: 0, taskCompleted: 0, flowCount: 0, issueCount: 0, openIssueCount: 0)

    var openTaskCount: Int {
        max(0, taskCount - taskCompleted)
    }
}

struct ProjectDeadlineItem: Equatable {
    let title: String
    let dueDate: Date
    let type: String
}

struct ProjectWorkloadSummary: Equatable {
    var urgentTasks: Int
    var urgentIssues: Int
    var overdueCount: Int
    var dueSoonCount: Int
    var nextDueItem: ProjectDeadlineItem?

    static let empty = ProjectWorkloadSummary(
        urgentTasks: 0,
        urgentIssues: 0,
        overdueCount: 0,
        dueSoonCount: 0,
        nextDueItem: nil
    )

    var hasSignals: Bool {
        urgentTasks > 0 || urgentIssues > 0 || overdueCount > 0 || dueSoonCount > 0 || nextDueItem != nil
    }
}

@MainActor
final class ProjectInsightsStore: ObservableObject {
    @Published var metricsByProject: [String: ProjectMetrics] = [:]
    @Published var healthByProject: [String: ProjectHealthSnapshot] = [:]
    @Published var spotlightProjectId: String?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private var projectListener: ListenerRegistration?
    private var taskListener: ListenerRegistration?
    private var flowListener: ListenerRegistration?
    private var issueListener: ListenerRegistration?
    private var milestoneListener: ListenerRegistration?
    private var sprintListener: ListenerRegistration?
    private var activityListener: ListenerRegistration?
    private var projects: [Project] = []
    private var tasks: [ProjectTask] = []
    private var flows: [Flow] = []
    private var issues: [Issue] = []
    private var milestones: [Milestone] = []
    private var sprints: [Sprint] = []
    private var activities: [ActivityItem] = []
    private var didLoadProjects = false
    private var didLoadTasks = false
    private var didLoadFlows = false
    private var didLoadIssues = false
    private var didLoadMilestones = false
    private var didLoadSprints = false
    private var didLoadActivities = false

    func start(tenantId: String) {
        stop()
        isLoading = true
        errorMessage = nil
        didLoadProjects = false
        didLoadTasks = false
        didLoadFlows = false
        didLoadIssues = false
        didLoadMilestones = false
        didLoadSprints = false
        didLoadActivities = false

        projectListener = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    errorMessage = error.localizedDescription
                    projects = []
                    didLoadProjects = true
                    refreshInsights()
                    return
                }
                projects = snapshot?.documents.map { Project(id: $0.documentID, data: $0.data()) } ?? []
                didLoadProjects = true
                refreshInsights()
            }

        taskListener = db.collectionGroup(FirestorePath.tasks)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    errorMessage = error.localizedDescription
                    tasks = []
                    didLoadTasks = true
                    refreshInsights()
                    return
                }
                tasks = snapshot?.documents.map { ProjectTask(id: $0.documentID, data: $0.data()) } ?? []
                didLoadTasks = true
                refreshInsights()
            }

        flowListener = db.collectionGroup(FirestorePath.flows)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    errorMessage = error.localizedDescription
                    flows = []
                    didLoadFlows = true
                    refreshInsights()
                    return
                }
                flows = snapshot?.documents.map { Flow(id: $0.documentID, data: $0.data()) } ?? []
                didLoadFlows = true
                refreshInsights()
            }

        issueListener = db.collectionGroup(FirestorePath.issues)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    errorMessage = error.localizedDescription
                    issues = []
                    didLoadIssues = true
                    refreshInsights()
                    return
                }
                issues = snapshot?.documents.map { Issue(id: $0.documentID, data: $0.data()) } ?? []
                didLoadIssues = true
                refreshInsights()
            }

        milestoneListener = db.collectionGroup(FirestorePath.milestones)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    errorMessage = error.localizedDescription
                    milestones = []
                    didLoadMilestones = true
                    refreshInsights()
                    return
                }
                milestones = snapshot?.documents.map { Milestone(id: $0.documentID, data: $0.data()) } ?? []
                didLoadMilestones = true
                refreshInsights()
            }

        sprintListener = db.collectionGroup(FirestorePath.sprints)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    errorMessage = error.localizedDescription
                    sprints = []
                    didLoadSprints = true
                    refreshInsights()
                    return
                }
                sprints = snapshot?.documents.map { Sprint(id: $0.documentID, data: $0.data()) } ?? []
                didLoadSprints = true
                refreshInsights()
            }

        activityListener = db.collectionGroup(FirestorePath.activity)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    errorMessage = error.localizedDescription
                    activities = []
                    didLoadActivities = true
                    refreshInsights()
                    return
                }
                activities = snapshot?.documents.map { ActivityItem(id: $0.documentID, data: $0.data()) } ?? []
                didLoadActivities = true
                refreshInsights()
            }
    }

    func stop() {
        projectListener?.remove()
        taskListener?.remove()
        flowListener?.remove()
        issueListener?.remove()
        milestoneListener?.remove()
        sprintListener?.remove()
        activityListener?.remove()
        projectListener = nil
        taskListener = nil
        flowListener = nil
        issueListener = nil
        milestoneListener = nil
        sprintListener = nil
        activityListener = nil
        projects = []
        tasks = []
        flows = []
        issues = []
        milestones = []
        sprints = []
        activities = []
        metricsByProject = [:]
        healthByProject = [:]
        spotlightProjectId = nil
        isLoading = false
    }

    func metrics(for projectId: String) -> ProjectMetrics {
        metricsByProject[projectId] ?? .empty
    }

    func health(for projectId: String) -> ProjectHealthSnapshot {
        if let health = healthByProject[projectId] {
            return health
        }
        let fallback = projects.first { $0.id == projectId } ?? Project(id: projectId, data: [:])
        return HealthService.calculateProjectHealth(project: fallback)
    }

    func activity(for projectId: String) -> [ActivityItem] {
        activities
            .filter { $0.projectId == projectId }
            .sorted { left, right in
                let leftDate = left.createdAt?.dateValue() ?? Date.distantPast
                let rightDate = right.createdAt?.dateValue() ?? Date.distantPast
                if leftDate != rightDate {
                    return leftDate > rightDate
                }
                return left.id < right.id
            }
    }

    func workloadSummary(for projectId: String) -> ProjectWorkloadSummary {
        let openTasks = tasks.filter {
            $0.projectId == projectId && !$0.isCompleted && $0.status != "Done"
        }
        let openIssues = issues.filter {
            $0.projectId == projectId && $0.status != "Resolved" && $0.status != "Closed"
        }

        let urgentTasks = openTasks.filter { $0.priority == "Urgent" }.count
        let urgentIssues = openIssues.filter { $0.priority == "Urgent" }.count

        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let soonDate = calendar.date(byAdding: .day, value: 7, to: today) ?? today

        var overdueCount = 0
        var dueSoonCount = 0
        var nextDueItem: ProjectDeadlineItem?

        func considerDueItem(title: String, type: String, date: Date) {
            let dueDay = calendar.startOfDay(for: date)
            if dueDay < today {
                overdueCount += 1
            } else if dueDay <= soonDate {
                dueSoonCount += 1
            }

            if let existing = nextDueItem {
                if dueDay < calendar.startOfDay(for: existing.dueDate) {
                    nextDueItem = ProjectDeadlineItem(title: title, dueDate: date, type: type)
                }
            } else {
                nextDueItem = ProjectDeadlineItem(title: title, dueDate: date, type: type)
            }
        }

        for task in openTasks {
            guard let dueDate = Self.parseDate(task.dueDate) else { continue }
            considerDueItem(title: task.title, type: "Task", date: dueDate)
        }

        for issue in openIssues {
            guard let dueDate = Self.parseDate(issue.dueDate) else { continue }
            considerDueItem(title: issue.title, type: "Issue", date: dueDate)
        }

        return ProjectWorkloadSummary(
            urgentTasks: urgentTasks,
            urgentIssues: urgentIssues,
            overdueCount: overdueCount,
            dueSoonCount: dueSoonCount,
            nextDueItem: nextDueItem
        )
    }

    private func refreshInsights() {
        var metrics = [String: ProjectMetrics]()

        for task in tasks {
            guard let projectId = task.projectId else { continue }
            var entry = metrics[projectId] ?? .empty
            entry.taskCount += 1
            if task.isCompleted || task.status == "Done" {
                entry.taskCompleted += 1
            }
            metrics[projectId] = entry
        }

        for flow in flows {
            guard let projectId = flow.projectId else { continue }
            var entry = metrics[projectId] ?? .empty
            entry.flowCount += 1
            metrics[projectId] = entry
        }

        for issue in issues {
            guard let projectId = issue.projectId else { continue }
            var entry = metrics[projectId] ?? .empty
            entry.issueCount += 1
            if issue.status != "Resolved" && issue.status != "Closed" {
                entry.openIssueCount += 1
            }
            metrics[projectId] = entry
        }

        var projectIds = Set(metrics.keys)
        let projectsById = Dictionary(uniqueKeysWithValues: projects.map { ($0.id, $0) })
        projectIds.formUnion(projectsById.keys)

        metricsByProject = projectIds.reduce(into: [:]) { result, projectId in
            result[projectId] = metrics[projectId] ?? .empty
        }

        let tasksByProject = Dictionary(grouping: tasks, by: { $0.projectId ?? "" })
        let issuesByProject = Dictionary(grouping: issues, by: { $0.projectId ?? "" })
        let milestonesByProject = Dictionary(grouping: milestones, by: { $0.projectId })
        let sprintsByProject = Dictionary(grouping: sprints, by: { $0.projectId })
        let activitiesByProject = Dictionary(grouping: activities, by: { $0.projectId })

        healthByProject = projectIds.reduce(into: [:]) { result, projectId in
            let project = projectsById[projectId] ?? Project(id: projectId, data: [:])
            let projectTasks = tasksByProject[projectId] ?? []
            let projectIssues = issuesByProject[projectId] ?? []
            let projectMilestones = milestonesByProject[projectId] ?? []
            let projectSprints = sprintsByProject[projectId] ?? []
            let projectActivities = activitiesByProject[projectId] ?? []
            result[projectId] = HealthService.calculateProjectHealth(
                project: project,
                tasks: projectTasks,
                milestones: projectMilestones,
                issues: projectIssues,
                sprints: projectSprints,
                activities: projectActivities
            )
        }

        let allLoaded = didLoadProjects && didLoadTasks && didLoadFlows && didLoadIssues && didLoadMilestones && didLoadSprints && didLoadActivities
        
        if allLoaded {
            spotlightProjectId = Self.spotlightProjectId(
                projects: projectIds,
                projectsById: projectsById,
                tasksByProject: tasksByProject,
                milestonesByProject: milestonesByProject,
                issuesByProject: issuesByProject,
                sprintsByProject: sprintsByProject,
                activitiesByProject: activitiesByProject
            )
        }
        isLoading = !allLoaded
    }

    private static func spotlightProjectId(
        projects: Set<String>,
        projectsById: [String: Project],
        tasksByProject: [String: [ProjectTask]],
        milestonesByProject: [String: [Milestone]],
        issuesByProject: [String: [Issue]],
        sprintsByProject: [String: [Sprint]],
        activitiesByProject: [String: [ActivityItem]]
    ) -> String? {
        guard !projects.isEmpty else { return nil }
        let scored = projects.map { projectId -> (id: String, score: SpotlightScore) in
            let project = projectsById[projectId] ?? Project(id: projectId, data: [:])
            let spotlight = HealthService.calculateSpotlightScore(
                project: project,
                tasks: tasksByProject[projectId] ?? [],
                milestones: milestonesByProject[projectId] ?? [],
                issues: issuesByProject[projectId] ?? [],
                sprints: sprintsByProject[projectId] ?? [],
                activities: activitiesByProject[projectId] ?? []
            )
            return (id: projectId, score: spotlight)
        }

        return scored.sorted { left, right in
            if left.score.score != right.score.score {
                return left.score.score > right.score.score
            }
            return left.id < right.id
        }.first?.id
    }

    private static func parseDate(_ value: String) -> Date? {
        guard !value.isEmpty else { return nil }
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractionalFormatter.date(from: value) {
            return date
        }
        let isoFormatter = ISO8601DateFormatter()
        if let date = isoFormatter.date(from: value) {
            return date
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }
}
