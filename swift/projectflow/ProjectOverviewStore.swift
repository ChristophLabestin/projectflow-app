import Foundation
import Combine
import FirebaseFirestore
import FirebaseStorage

@MainActor
final class ProjectOverviewStore: ObservableObject {
    @Published var project: Project?
    @Published var tasks: [ProjectTask] = []
    @Published var activity: [ActivityItem] = []
    @Published var milestones: [Milestone] = []
    @Published var sprints: [Sprint] = []
    @Published var memberProfiles: [UserProfile] = []
    @Published var healthHistory: [ProjectHealthSnapshotEntry] = []
    @Published var pinnedReport: GeminiReport?
    @Published var coverImageURL: URL?
    @Published var projectIconURL: URL?
    @Published var isLoading = true
    @Published var isGeneratingReport = false

    private let db = Firestore.firestore()
    private let taskRepository = TaskRepository()
    private let geminiService = GeminiService.shared

    private var projectListener: ListenerRegistration?
    private var taskListener: ListenerRegistration?
    private var activityListener: ListenerRegistration?
    private var milestoneListener: ListenerRegistration?
    private var sprintListener: ListenerRegistration?
    private var reportListener: ListenerRegistration?
    private var healthListener: ListenerRegistration?

    func start(tenantId: String, projectId: String) {
        isLoading = true
        stop()

        // Fetch Project for Members and General Info
        projectListener = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self, let data = snapshot?.data() else { return }
                let fetchedProject = Project(id: projectId, data: data)
                self.project = fetchedProject
                fetchMemberProfiles(memberIds: fetchedProject.memberIds)
            }

        taskListener = taskRepository.listenTasks(tenantId: tenantId, projectId: projectId) { [weak self] tasks in
            self?.tasks = tasks.sorted { left, right in
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
        
        // Listen for health snapshots (last 30 days)
        let healthRef = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection("healthSnapshots")
            .order(by: "__name__", descending: true) // Document IDs are dates (YYYY-MM-DD)
            .limit(to: 30)
            
        healthListener = healthRef.addSnapshotListener { [weak self] snapshot, _ in
            guard let self = self else { return }
            let entries = snapshot?.documents.compactMap { ProjectHealthSnapshotEntry(id: $0.documentID, data: $0.data()) } ?? []
            self.healthHistory = entries.reversed() // Order by date ascending for charts
        }
        
        // Listen for latest Gemini Report
        let reportRef = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection("geminiReports")
            .order(by: "createdAt", descending: true)
            .limit(to: 1)
            
        reportListener = reportRef.addSnapshotListener { [weak self] snapshot, _ in
            guard let self else { return }
            if let doc = snapshot?.documents.first {
                pinnedReport = GeminiReport(id: doc.documentID, data: doc.data())
            } else {
                pinnedReport = nil
            }
        }
        
        fetchProjectAssets(tenantId: tenantId, projectId: projectId)
    }

    func toggleTask(tenantId: String, projectId: String, task: ProjectTask, permissions: PermissionContext) async {
        do {
            let nextStatus = !task.isCompleted
            try await taskRepository.updateTask(
                tenantId: tenantId,
                projectId: projectId,
                taskId: task.id,
                updates: ["isCompleted": nextStatus, "status": nextStatus ? "Done" : "Open"],
                permissions: permissions
            )
        } catch {
            print("Failed to toggle task: \(error)")
        }
    }

    func generateReport(tenantId: String, projectId: String, user: UserProfile) async {
        guard let project = project else { return }
        
        isGeneratingReport = true
        
        do {
            let prompt = geminiService.generateProjectReportPrompt(
                project: project,
                tasks: tasks,
                milestones: milestones,
                activity: activity,
                members: project.members
            )
            
            let result = try await geminiService.callGemini(prompt: prompt, temperature: 0.4)
            
            // Save report to Firestore
            let reportData: [String: Any] = [
                "projectId": projectId,
                "content": result.text,
                "createdAt": FieldValue.serverTimestamp(),
                "createdBy": user.id,
                "userName": user.displayName
            ]
            
            try await db.collection(FirestorePath.tenants)
                .document(tenantId)
                .collection(FirestorePath.projects)
                .document(projectId)
                .collection("geminiReports")
                .addDocument(data: reportData)
                
            // Activity log
            let activityLog: [String: Any] = [
                "projectId": projectId,
                "user": user.displayName,
                "action": "Generated project report",
                "target": "CORA Report",
                "details": result.text,
                "type": "report",
                "createdAt": FieldValue.serverTimestamp()
            ]
            
            try await db.collection(FirestorePath.tenants)
                .document(tenantId)
                .collection(FirestorePath.projects)
                .document(projectId)
                .collection("activity")
                .addDocument(data: activityLog)
                
        } catch {
            print("Failed to generate report: \(error)")
        }
        
        isGeneratingReport = false
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
        projectListener?.remove()
        taskListener?.remove()
        activityListener?.remove()
        milestoneListener?.remove()
        sprintListener?.remove()
        reportListener?.remove()
        healthListener?.remove()
        projectListener = nil
        taskListener = nil
        activityListener = nil
        milestoneListener = nil
        sprintListener = nil
        reportListener = nil
        healthListener = nil
    }

    private func fetchMemberProfiles(memberIds: [String]) {
        guard !memberIds.isEmpty else {
            self.memberProfiles = []
            return
        }

        db.collection(FirestorePath.users)
            .whereField(FieldPath.documentID(), in: memberIds)
            .getDocuments { [weak self] snapshot, _ in
                guard let self else { return }
                let profiles = snapshot?.documents.map { UserProfile(id: $0.documentID, data: $0.data()) } ?? []
                DispatchQueue.main.async {
                    self.memberProfiles = profiles
                }
            }
    }
}
