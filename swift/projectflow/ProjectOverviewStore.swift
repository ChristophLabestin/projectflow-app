import Foundation
import FirebaseFirestore

@MainActor
final class ProjectOverviewStore: ObservableObject {
    @Published var tasks: [Task] = []
    @Published var flows: [Flow] = []
    @Published var issues: [Issue] = []
    @Published var activity: [ActivityItem] = []
    @Published var isLoading = true

    private let db = Firestore.firestore()
    private let taskRepository = TaskRepository()
    private let flowRepository = FlowRepository()
    private let issueRepository = IssueRepository()
    private var taskListener: ListenerRegistration?
    private var flowListener: ListenerRegistration?
    private var issueListener: ListenerRegistration?
    private var activityListener: ListenerRegistration?

    func start(tenantId: String, projectId: String) {
        isLoading = true
        stop()

        taskListener = taskRepository.listenTasks(tenantId: tenantId, projectId: projectId) { [weak self] tasks in
            self?.tasks = tasks.sorted { left, right in
                let leftDate = left.createdAt?.dateValue() ?? Date.distantPast
                let rightDate = right.createdAt?.dateValue() ?? Date.distantPast
                return leftDate > rightDate
            }
            self?.isLoading = false
        }

        flowListener = flowRepository.listenFlows(tenantId: tenantId, projectId: projectId) { [weak self] flows in
            self?.flows = flows.sorted { left, right in
                let leftDate = left.createdAt?.dateValue() ?? Date.distantPast
                let rightDate = right.createdAt?.dateValue() ?? Date.distantPast
                return leftDate > rightDate
            }
            self?.isLoading = false
        }

        issueListener = issueRepository.listenIssues(tenantId: tenantId, projectId: projectId) { [weak self] issues in
            self?.issues = issues.sorted { left, right in
                let leftDate = left.createdAt?.dateValue() ?? Date.distantPast
                let rightDate = right.createdAt?.dateValue() ?? Date.distantPast
                return leftDate > rightDate
            }
            self?.isLoading = false
        }

        let activityRef = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection("activity")
            .order(by: "createdAt", descending: true)
            .limit(to: 12)

        activityListener = activityRef.addSnapshotListener { [weak self] snapshot, _ in
            guard let self else { return }
            let items = snapshot?.documents.map { ActivityItem(id: $0.documentID, data: $0.data()) } ?? []
            activity = items
            isLoading = false
        }
    }

    func stop() {
        taskListener?.remove()
        flowListener?.remove()
        issueListener?.remove()
        activityListener?.remove()
        taskListener = nil
        flowListener = nil
        issueListener = nil
        activityListener = nil
    }
}
