import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class TasksStore: ObservableObject {
    @Published var tasks: [Task] = []
    @Published var isLoading = true
    @Published var errorMessage: String?

    private let repository = TaskRepository()
    private var listener: ListenerRegistration?

    func start(tenantId: String, projectId: String) {
        isLoading = true
        errorMessage = nil
        listener?.remove()
        listener = repository.listenTasks(
            tenantId: tenantId,
            projectId: projectId,
            onUpdate: { [weak self] tasks in
                self?.tasks = tasks.sorted { left, right in
                    let leftDate = left.createdAt?.dateValue() ?? Date.distantPast
                    let rightDate = right.createdAt?.dateValue() ?? Date.distantPast
                    return leftDate > rightDate
                }
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

        var task = Task(id: UUID().uuidString, data: [:])
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

    func toggleComplete(tenantId: String, projectId: String, task: Task, permissions: PermissionContext) async {
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
}
