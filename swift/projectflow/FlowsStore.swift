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

    func start(tenantId: String, projectId: String) {
        isLoading = true
        listener?.remove()
        listener = repository.listenFlows(tenantId: tenantId, projectId: projectId) { [weak self] flows in
            self?.flows = flows.sorted { left, right in
                let leftDate = left.createdAt?.dateValue() ?? Date.distantPast
                let rightDate = right.createdAt?.dateValue() ?? Date.distantPast
                return leftDate > rightDate
            }
            self?.isLoading = false
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
        title: String,
        description: String,
        type: String,
        stage: String,
        permissions: PermissionContext
    ) async {
        errorMessage = nil
        let updates: [String: Any] = [
            "title": title,
            "description": description,
            "type": type,
            "stage": stage
        ]

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
}
