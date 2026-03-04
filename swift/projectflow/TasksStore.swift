import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class TasksStore: ObservableObject {
    @Published var tasks: [ProjectTask] = []
    @Published var isLoading = true
    @Published var errorMessage: String?

    private let repository = TaskRepository()
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
                .collection(FirestorePath.tasks)
        } else {
            query = db.collectionGroup(FirestorePath.tasks)
                .whereField("tenantId", isEqualTo: tenantId)
        }

        listener = query.addSnapshotListener { [weak self] snapshot, error in
            guard let self else { return }
            if let error = error {
                self.errorMessage = error.localizedDescription
                self.isLoading = false
                return
            }
            
            let tasks = snapshot?.documents.map { ProjectTask(id: $0.documentID, data: $0.data()) } ?? []
            self.tasks = tasks.sorted { left, right in
                let leftDate = left.createdAt?.dateValue() ?? Date.distantPast
                let rightDate = right.createdAt?.dateValue() ?? Date.distantPast
                return leftDate > rightDate
            }
            self.isLoading = false
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func createTask(
        tenantId: String,
        projectId: String,
        title: String,
        description: String,
        status: String,
        priority: String,
        permissions: PermissionContext
    ) async {
        errorMessage = nil
        guard let userId = Auth.auth().currentUser?.uid else {
            errorMessage = "You must be signed in to create a task."
            return
        }

        var task = ProjectTask(id: UUID().uuidString, data: [:])
        task.projectId = projectId
        task.ownerId = userId
        task.title = title
        task.description = description
        task.status = status
        task.priority = priority
        task.isCompleted = status == "Done"
        task.assigneeIds = []
        task.assignedGroupIds = []

        do {
            _ = try await repository.createTask(tenantId: tenantId, projectId: projectId, task: task, permissions: permissions)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateTask(
        tenantId: String,
        projectId: String,
        taskId: String,
        title: String,
        description: String,
        status: String,
        priority: String,
        permissions: PermissionContext
    ) async {
        errorMessage = nil
        let updates: [String: Any] = [
            "title": title,
            "description": description,
            "status": status,
            "priority": priority,
            "isCompleted": status == "Done"
        ]

        do {
            try await repository.updateTask(
                tenantId: tenantId,
                projectId: projectId,
                taskId: taskId,
                updates: updates,
                permissions: permissions
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteTask(tenantId: String, projectId: String, taskId: String, permissions: PermissionContext) async {
        errorMessage = nil
        do {
            try await repository.deleteTask(tenantId: tenantId, projectId: projectId, taskId: taskId, permissions: permissions)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateTaskFields(
        tenantId: String,
        projectId: String,
        taskId: String,
        updates: [String: Any],
        permissions: PermissionContext
    ) async {
        errorMessage = nil
        do {
            try await repository.updateTask(
                tenantId: tenantId,
                projectId: projectId,
                taskId: taskId,
                updates: updates,
                permissions: permissions
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func toggleComplete(tenantId: String, projectId: String, task: ProjectTask, permissions: PermissionContext) async {
        let nextCompleted = !task.isCompleted
        let nextStatus = nextCompleted ? "Done" : "Open"
        await updateTask(
            tenantId: tenantId,
            projectId: projectId,
            taskId: task.id,
            title: task.title,
            description: task.description,
            status: nextStatus,
            priority: task.priority,
            permissions: permissions
        )
    }

    func addSubtask(tenantId: String, projectId: String, taskId: String, title: String, subtasks: [ProjectSubtask], permissions: PermissionContext) async {
        errorMessage = nil
        var nextSubtasks = subtasks
        nextSubtasks.append(ProjectSubtask(title: title))
        
        let updates: [String: Any] = ["subtasks": nextSubtasks.map { $0.data }]
        
        do {
            try await repository.updateTask(
                tenantId: tenantId,
                projectId: projectId,
                taskId: taskId,
                updates: updates,
                permissions: permissions
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func toggleSubtask(tenantId: String, projectId: String, taskId: String, subtaskId: String, subtasks: [ProjectSubtask], permissions: PermissionContext) async {
        errorMessage = nil
        var nextSubtasks = subtasks
        if let index = nextSubtasks.firstIndex(where: { $0.id == subtaskId }) {
            nextSubtasks[index].isCompleted.toggle()
        }
        
        let updates: [String: Any] = ["subtasks": nextSubtasks.map { $0.data }]
        
        do {
            try await repository.updateTask(
                tenantId: tenantId,
                projectId: projectId,
                taskId: taskId,
                updates: updates,
                permissions: permissions
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteSubtask(tenantId: String, projectId: String, taskId: String, subtaskId: String, subtasks: [ProjectSubtask], permissions: PermissionContext) async {
        errorMessage = nil
        let nextSubtasks = subtasks.filter { $0.id != subtaskId }
        let updates: [String: Any] = ["subtasks": nextSubtasks.map { $0.data }]
        
        do {
            try await repository.updateTask(
                tenantId: tenantId,
                projectId: projectId,
                taskId: taskId,
                updates: updates,
                permissions: permissions
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
