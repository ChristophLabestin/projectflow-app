import Foundation
import Combine
import FirebaseFirestore
import FirebaseStorage

@MainActor
final class ProjectOverviewStore: ObservableObject {
    @Published var tasks: [Task] = []
    @Published var flows: [Flow] = []
    @Published var issues: [Issue] = []
    @Published var activity: [ActivityItem] = []
    @Published var milestones: [Milestone] = []
    @Published var sprints: [Sprint] = []
    @Published var coverImageURL: URL?
    @Published var projectIconURL: URL?
    @Published var isLoading = true

    private let db = Firestore.firestore()
    private let taskRepository = TaskRepository()
    private let flowRepository = FlowRepository()
    private let issueRepository = IssueRepository()
    private var taskListener: ListenerRegistration?
    private var flowListener: ListenerRegistration?
    private var issueListener: ListenerRegistration?
    private var activityListener: ListenerRegistration?
    private var milestoneListener: ListenerRegistration?
    private var sprintListener: ListenerRegistration?

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

        let milestoneRef = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.milestones)
            .order(by: "createdAt", descending: true)

        milestoneListener = milestoneRef.addSnapshotListener { [weak self] snapshot, _ in
            guard let self else { return }
            let items = snapshot?.documents.map { Milestone(id: $0.documentID, data: $0.data()) } ?? []
            milestones = items
            isLoading = false
        }

        let sprintRef = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.sprints)
            .order(by: "createdAt", descending: true)

        sprintListener = sprintRef.addSnapshotListener { [weak self] snapshot, _ in
            guard let self else { return }
            let items = snapshot?.documents.map { Sprint(id: $0.documentID, data: $0.data()) } ?? []
            sprints = items
            isLoading = false
        }
        
        fetchProjectAssets(tenantId: tenantId, projectId: projectId)
    }

    private func fetchProjectAssets(tenantId: String, projectId: String) {
        let storage = Storage.storage()
        // 1. Try specific project folder
        let folderRef = storage.reference().child("tenants/\(tenantId)/projects/\(projectId)")
        
        folderRef.listAll { [weak self] result, error in
            guard let self else { return }
            
            if let result = result, !result.items.isEmpty, let first = result.items.first {
                // Found assets in folder
                first.downloadURL { url, _ in
                    if let url {
                        DispatchQueue.main.async {
                            self.coverImageURL = url
                        }
                    }
                }
            } else {
                // 2. Fallback to legacy root folder
                let rootRef = storage.reference().child("tenants/\(tenantId)/projects")
                rootRef.listAll { [weak self] result, error in
                    guard let self, let result = result else { return }
                    // Filter for project ID in name: {timestamp}_media_{projectId}_{filename}
                    if let match = result.items.first(where: { $0.name.contains("_media_\(projectId)") }) {
                        match.downloadURL { url, _ in
                             if let url {
                                 DispatchQueue.main.async {
                                     self.coverImageURL = url
                                 }
                             }
                        }
                    }
                }
            }
        }
    }

    func stop() {
        taskListener?.remove()
        flowListener?.remove()
        issueListener?.remove()
        activityListener?.remove()
        milestoneListener?.remove()
        sprintListener?.remove()
        taskListener = nil
        flowListener = nil
        issueListener = nil
        activityListener = nil
        milestoneListener = nil
        sprintListener = nil
    }
}
