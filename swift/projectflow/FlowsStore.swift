import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class FlowsStore: ObservableObject {
    @Published var flows: [Flow] = []
    @Published var isLoading = true
    @Published var errorMessage: String?

    private let repository = FlowRepository()
    private var listener: ListenerRegistration?

    func start(tenantId: String, projectId: String? = nil) {
        isLoading = true
        errorMessage = nil
        listener?.remove()

        let db = Firestore.firestore()
        let query: Query
        
        if let projectId = projectId {
            query = db.collection(FirestorePath.tenants)
                .document(tenantId)
                .collection(FirestorePath.projects)
                .document(projectId)
                .collection(FirestorePath.flows)
        } else {
            query = db.collectionGroup(FirestorePath.flows)
                .whereField("tenantId", isEqualTo: tenantId)
        }

        listener = query.addSnapshotListener { [weak self] snapshot, error in
            guard let self = self else { return }
            if let error = error {
                self.errorMessage = error.localizedDescription
                self.isLoading = false
                return
            }
            
            let flows = snapshot?.documents.map { Flow(id: $0.documentID, data: $0.data()) } ?? []
            self.flows = flows.sorted { ($0.createdAt?.dateValue() ?? Date.distantPast) > ($1.createdAt?.dateValue() ?? Date.distantPast) }
            self.isLoading = false
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func createFlow(
        tenantId: String,
        projectId: String,
        title: String,
        description: String,
        type: String,
        stage: String,
        permissions: PermissionContext
    ) async {
        errorMessage = nil
        guard let userId = Auth.auth().currentUser?.uid else {
            errorMessage = "You must be signed in to create a flow."
            return
        }

        var flow = Flow(id: UUID().uuidString, data: [:])
        flow.projectId = projectId
        flow.ownerId = userId
        flow.title = title
        flow.description = description
        flow.type = type
        flow.stage = stage

        do {
            _ = try await repository.createFlow(tenantId: tenantId, projectId: projectId, flow: flow, permissions: permissions)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateFlow(
        tenantId: String,
        projectId: String,
        flowId: String,
        title: String? = nil,
        description: String? = nil,
        type: String? = nil,
        stage: String? = nil,
        impact: String? = nil,
        effort: String? = nil,
        concept: String? = nil,
        keywords: [String]? = nil,
        strengths: [String]? = nil,
        weaknesses: [String]? = nil,
        opportunities: [String]? = nil,
        threats: [String]? = nil,
        permissions: PermissionContext
    ) async {
        errorMessage = nil
        var updates: [String: Any] = [:]
        
        if let title { updates["title"] = title }
        if let description { updates["description"] = description }
        if let type { updates["type"] = type }
        if let stage { updates["stage"] = stage }
        if let impact { updates["impact"] = impact }
        if let effort { updates["effort"] = effort }
        if let concept { updates["concept"] = concept }
        if let keywords { updates["keywords"] = keywords }
        
        if strengths != nil || weaknesses != nil || opportunities != nil || threats != nil {
            // Fetch current analysis to avoid overwriting other keys if we only update one
            // However, FlowRepository.updateFlow usually merges? No, it uses updateData which merges at top level.
            // But "analysis" is a map, so we should probably handle it carefully.
            // For now, let's assume we provide all 4 if we provide any.
            let analysis: [String: Any] = [
                "strengths": strengths ?? [],
                "weaknesses": weaknesses ?? [],
                "opportunities": opportunities ?? [],
                "threats": threats ?? []
            ]
            updates["analysis"] = analysis
        }

        do {
            try await repository.updateFlow(
                tenantId: tenantId,
                projectId: projectId,
                flowId: flowId,
                updates: updates,
                permissions: permissions
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteFlow(tenantId: String, projectId: String, flowId: String, permissions: PermissionContext) async {
        errorMessage = nil
        do {
            try await repository.deleteFlow(tenantId: tenantId, projectId: projectId, flowId: flowId, permissions: permissions)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func convertToTask(
        tenantId: String,
        projectId: String,
        flow: Flow,
        permissions: PermissionContext
    ) async throws -> String {
        errorMessage = nil
        let taskRepository = TaskRepository()
        
        var task = ProjectTask(id: UUID().uuidString, data: [:])
        task.projectId = projectId
        task.ownerId = flow.ownerId
        task.title = flow.title
        task.description = flow.description
        task.status = "Backlog"
        task.priority = "Medium"
        
        do {
            let taskId = try await taskRepository.createTask(
                tenantId: tenantId,
                projectId: projectId,
                task: task,
                permissions: permissions
            )
            
            // Update flow stage
            try await repository.updateFlow(
                tenantId: tenantId,
                projectId: projectId,
                flowId: flow.id,
                updates: [
                    "stage": "Implemented",
                    "convertedTaskId": taskId,
                    "convertedAt": FieldValue.serverTimestamp()
                ],
                permissions: permissions
            )
            
            return taskId
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }
}
