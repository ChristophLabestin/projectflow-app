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
    private var tasks: [Task] = []
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
                tasks = snapshot?.documents.map { Task(id: $0.documentID, data: $0.data()) } ?? []
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

        spotlightProjectId = Self.spotlightProjectId(
            projects: projectIds,
            projectsById: projectsById,
            tasksByProject: tasksByProject,
            milestonesByProject: milestonesByProject,
            issuesByProject: issuesByProject,
            sprintsByProject: sprintsByProject,
            activitiesByProject: activitiesByProject
        )
        isLoading = !(didLoadProjects && didLoadTasks && didLoadFlows && didLoadIssues && didLoadMilestones && didLoadSprints && didLoadActivities)
    }

    private static func spotlightProjectId(
        projects: Set<String>,
        projectsById: [String: Project],
        tasksByProject: [String: [Task]],
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
}
