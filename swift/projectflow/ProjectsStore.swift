import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class ProjectsStore: ObservableObject {
    @Published var projects: [Project] = []
    @Published var isLoading = true
    @Published var errorMessage: String?

    private let repository = ProjectRepository()
    private var listener: ListenerRegistration?

    func start(tenantId: String) {
        isLoading = true
        errorMessage = nil
        listener?.remove()
        listener = repository.listenProjects(
            tenantId: tenantId,
            onUpdate: { [weak self] projects in
                self?.projects = projects.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
                self?.isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func createProject(
        tenantId: String,
        title: String,
        description: String,
        status: String,
        permissions: PermissionContext
    ) async {
        errorMessage = nil
        guard let userId = Auth.auth().currentUser?.uid else {
            errorMessage = "You must be signed in to create a project."
            return
        }

        var project = Project(id: UUID().uuidString, data: [:])
        project.title = title
        project.description = description
        project.status = status
        project.ownerId = userId
        project.modules = ["tasks", "ideas", "issues", "activity"]
        project.visibilityGroupIds = []

        do {
            _ = try await repository.createProject(tenantId: tenantId, project: project, permissions: permissions)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateProject(
        tenantId: String,
        projectId: String,
        title: String,
        description: String,
        status: String,
        permissions: PermissionContext
    ) async {
        errorMessage = nil
        let updates: [String: Any] = [
            "title": title,
            "description": description,
            "status": status
        ]

        do {
            try await repository.updateProject(tenantId: tenantId, projectId: projectId, updates: updates, permissions: permissions)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteProject(tenantId: String, projectId: String, permissions: PermissionContext) async {
        errorMessage = nil
        do {
            try await repository.deleteProject(tenantId: tenantId, projectId: projectId, permissions: permissions)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
