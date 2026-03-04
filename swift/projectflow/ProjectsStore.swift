import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

enum ProjectSortOption: String, CaseIterable, Identifiable {
    case title = "Name"
    case health = "Health"
    case dueDate = "Due Date"
    case activity = "Last Activity"

    var id: String { rawValue }
}

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

    func updateProjectFields(
        tenantId: String,
        projectId: String,
        updates: [String: Any],
        permissions: PermissionContext
    ) async {
        errorMessage = nil
        do {
            try await repository.updateProject(tenantId: tenantId, projectId: projectId, updates: updates, permissions: permissions)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateMemberRole(tenantId: String, projectId: String, userId: String, newRole: String, permissions: PermissionContext) async {
        errorMessage = nil
        guard let project = projects.first(where: { $0.id == projectId }) else { return }
        
        var nextMembers = project.members
        if let index = nextMembers.firstIndex(where: { $0.userId == userId }) {
            nextMembers[index].role = newRole
        }
        
        let updates: [String: Any] = ["members": nextMembers.map { $0.data }]
        await updateProjectFields(tenantId: tenantId, projectId: projectId, updates: updates, permissions: permissions)
    }

    func removeMember(tenantId: String, projectId: String, userId: String, permissions: PermissionContext) async {
        errorMessage = nil
        guard let project = projects.first(where: { $0.id == projectId }) else { return }
        
        let nextMembers = project.members.filter { $0.userId != userId }
        let nextMemberIds = project.memberIds.filter { $0 != userId }
        
        let updates: [String: Any] = [
            "members": nextMembers.map { $0.data },
            "memberIds": nextMemberIds
        ]
        await updateProjectFields(tenantId: tenantId, projectId: projectId, updates: updates, permissions: permissions)
    }

    func inviteMember(tenantId: String, projectId: String, email: String, permissions: PermissionContext) async {
        errorMessage = nil
        // In this app, we assume users already exist or we just add their ID if we found them by email
        // For simplicity, let's look up the user by email first
        do {
            let userSnapshot = try await Firestore.firestore().collection(FirestorePath.users)
                .whereField("email", isEqualTo: email)
                .getDocuments()
            
            guard let userDoc = userSnapshot.documents.first else {
                errorMessage = "No user found with that email."
                return
            }
            
            let userId = userDoc.documentID
            guard let project = projects.first(where: { $0.id == projectId }) else { return }
            
            if project.memberIds.contains(userId) {
                errorMessage = "User is already a member."
                return
            }
            
            var nextMembers = project.members
            nextMembers.append(ProjectMember(userId: userId, role: "Member"))
            
            var nextMemberIds = project.memberIds
            nextMemberIds.append(userId)
            
            let updates: [String: Any] = [
                "members": nextMembers.map { $0.data },
                "memberIds": nextMemberIds
            ]
            
            try await repository.updateProject(tenantId: tenantId, projectId: projectId, updates: updates, permissions: permissions)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
