import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class DashboardStore: ObservableObject {
    @Published var isLoading = true
    @Published var projectCount = 0
    @Published var taskCount = 0
    @Published var openTaskCount = 0
    @Published var issueCount = 0
    @Published var openIssueCount = 0
    @Published var flowCount = 0
    @Published var recentTasks: [Task] = []
    @Published var recentIssues: [Issue] = []
    @Published var recentFlows: [Flow] = []

    private let db = Firestore.firestore()
    private let projectRepository = ProjectRepository()
    private var projectListener: ListenerRegistration?
    private var taskListener: ListenerRegistration?
    private var issueListener: ListenerRegistration?
    private var flowListener: ListenerRegistration?

    func start() {
        guard let user = Auth.auth().currentUser else {
            reset()
            return
        }

        guard let tenantId = TenantResolver.resolveTenantId(for: user) else {
            reset()
            return
        }

        isLoading = true
        removeListeners()

        projectListener = projectRepository.listenProjects(tenantId: tenantId) { [weak self] projects in
            self?.projectCount = projects.count
            self?.isLoading = false
        }

        taskListener = db.collectionGroup(FirestorePath.tasks)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self else { return }
                let tasks = snapshot?.documents.map { Task(id: $0.documentID, data: $0.data()) } ?? []
                taskCount = tasks.count
                openTaskCount = tasks.filter { !$0.isCompleted }.count
                recentTasks = recentItems(from: tasks, limit: 4) { $0.createdAt }
                isLoading = false
            }

        issueListener = db.collectionGroup(FirestorePath.issues)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self else { return }
                let issues = snapshot?.documents.map { Issue(id: $0.documentID, data: $0.data()) } ?? []
                issueCount = issues.count
                openIssueCount = issues.filter { $0.status != "Resolved" && $0.status != "Closed" }.count
                recentIssues = recentItems(from: issues, limit: 4) { $0.createdAt }
                isLoading = false
            }

        flowListener = db.collectionGroup(FirestorePath.flows)
            .whereField("tenantId", isEqualTo: tenantId)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self else { return }
                let flows = snapshot?.documents.map { Flow(id: $0.documentID, data: $0.data()) } ?? []
                flowCount = flows.count
                recentFlows = recentItems(from: flows, limit: 4) { $0.createdAt }
                isLoading = false
            }
    }

    func stop() {
        removeListeners()
    }

    private func reset() {
        isLoading = false
        projectCount = 0
        taskCount = 0
        openTaskCount = 0
        issueCount = 0
        openIssueCount = 0
        flowCount = 0
        recentTasks = []
        recentIssues = []
        recentFlows = []
    }

    private func removeListeners() {
        projectListener?.remove()
        taskListener?.remove()
        issueListener?.remove()
        flowListener?.remove()
        projectListener = nil
        taskListener = nil
        issueListener = nil
        flowListener = nil
    }

    private func recentItems<T>(from items: [T], limit: Int, timestamp: (T) -> Timestamp?) -> [T] {
        let sorted = items.sorted { lhs, rhs in
            let left = timestamp(lhs)?.dateValue() ?? Date.distantPast
            let right = timestamp(rhs)?.dateValue() ?? Date.distantPast
            return left > right
        }
        return Array(sorted.prefix(limit))
    }
}
