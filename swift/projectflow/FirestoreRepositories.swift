import Foundation
import FirebaseFirestore

enum FirestorePath {
    static let tenants = "tenants"
    static let members = "members"
    static let projects = "projects"
    static let tasks = "tasks"
    static let flows = "ideas"
    static let issues = "issues"
    static let notifications = "notifications"
    static let users = "users"
}

enum FirestoreError: LocalizedError {
    case missingSnapshot

    var errorDescription: String? {
        switch self {
        case .missingSnapshot:
            return "Firestore snapshot was missing."
        }
    }
}

private extension DocumentReference {
    func setDataAsync(_ data: [String: Any], merge: Bool = false) async throws {
        try await withCheckedThrowingContinuation { continuation in
            setData(data, merge: merge) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
        }
    }

    func updateDataAsync(_ data: [String: Any]) async throws {
        try await withCheckedThrowingContinuation { continuation in
            updateData(data) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
        }
    }

    func deleteAsync() async throws {
        try await withCheckedThrowingContinuation { continuation in
            delete { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
        }
    }
}

final class ProjectRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
    }

    func listenProjects(tenantId: String, onUpdate: @escaping ([Project]) -> Void) -> ListenerRegistration {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)

        return ref.addSnapshotListener { snapshot, _ in
            let items = snapshot?.documents.map { Project(id: $0.documentID, data: $0.data()) } ?? []
            onUpdate(items)
        }
    }

    func createProject(tenantId: String, project: Project) async throws -> String {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document()

        var payload = project.data
        payload["createdAt"] = payload["createdAt"] ?? FieldValue.serverTimestamp()
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await ref.setDataAsync(payload)
        return ref.documentID
    }

    func updateProject(tenantId: String, projectId: String, updates: [String: Any]) async throws {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)

        var payload = updates
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await ref.updateDataAsync(payload)
    }

    func deleteProject(tenantId: String, projectId: String) async throws {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)

        try await ref.deleteAsync()
    }
}

final class TaskRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
    }

    func listenTasks(tenantId: String, projectId: String, onUpdate: @escaping ([Task]) -> Void) -> ListenerRegistration {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.tasks)

        return ref.addSnapshotListener { snapshot, _ in
            let items = snapshot?.documents.map { Task(id: $0.documentID, data: $0.data()) } ?? []
            onUpdate(items)
        }
    }

    func createTask(tenantId: String, projectId: String, task: Task) async throws -> String {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.tasks)
            .document()

        var payload = task.data
        payload["projectId"] = payload["projectId"] ?? projectId
        payload["createdAt"] = payload["createdAt"] ?? FieldValue.serverTimestamp()
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await ref.setDataAsync(payload)
        return ref.documentID
    }

    func updateTask(tenantId: String, projectId: String, taskId: String, updates: [String: Any]) async throws {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.tasks)
            .document(taskId)

        var payload = updates
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await ref.updateDataAsync(payload)
    }

    func deleteTask(tenantId: String, projectId: String, taskId: String) async throws {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.tasks)
            .document(taskId)

        try await ref.deleteAsync()
    }
}

final class FlowRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
    }

    func listenFlows(tenantId: String, projectId: String, onUpdate: @escaping ([Flow]) -> Void) -> ListenerRegistration {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.flows)

        return ref.addSnapshotListener { snapshot, _ in
            let items = snapshot?.documents.map { Flow(id: $0.documentID, data: $0.data()) } ?? []
            onUpdate(items)
        }
    }

    func createFlow(tenantId: String, projectId: String, flow: Flow) async throws -> String {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.flows)
            .document()

        var payload = flow.data
        payload["projectId"] = payload["projectId"] ?? projectId
        payload["createdAt"] = payload["createdAt"] ?? FieldValue.serverTimestamp()
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await ref.setDataAsync(payload)
        return ref.documentID
    }

    func updateFlow(tenantId: String, projectId: String, flowId: String, updates: [String: Any]) async throws {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.flows)
            .document(flowId)

        var payload = updates
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await ref.updateDataAsync(payload)
    }

    func deleteFlow(tenantId: String, projectId: String, flowId: String) async throws {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.flows)
            .document(flowId)

        try await ref.deleteAsync()
    }
}

final class IssueRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
    }

    func listenIssues(tenantId: String, projectId: String, onUpdate: @escaping ([Issue]) -> Void) -> ListenerRegistration {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.issues)

        return ref.addSnapshotListener { snapshot, _ in
            let items = snapshot?.documents.map { Issue(id: $0.documentID, data: $0.data()) } ?? []
            onUpdate(items)
        }
    }

    func createIssue(tenantId: String, projectId: String, issue: Issue) async throws -> String {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.issues)
            .document()

        var payload = issue.data
        payload["projectId"] = payload["projectId"] ?? projectId
        payload["createdAt"] = payload["createdAt"] ?? FieldValue.serverTimestamp()
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await ref.setDataAsync(payload)
        return ref.documentID
    }

    func updateIssue(tenantId: String, projectId: String, issueId: String, updates: [String: Any]) async throws {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.issues)
            .document(issueId)

        var payload = updates
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await ref.updateDataAsync(payload)
    }

    func deleteIssue(tenantId: String, projectId: String, issueId: String) async throws {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.issues)
            .document(issueId)

        try await ref.deleteAsync()
    }
}

final class NotificationRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
    }

    func listenNotifications(tenantId: String, userId: String, onUpdate: @escaping ([NotificationItem]) -> Void) -> ListenerRegistration {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.notifications)
            .whereField("userId", isEqualTo: userId)
            .order(by: "createdAt", descending: true)

        return ref.addSnapshotListener { snapshot, _ in
            let items = snapshot?.documents.map { NotificationItem(id: $0.documentID, data: $0.data()) } ?? []
            onUpdate(items)
        }
    }

    func markNotificationRead(tenantId: String, notificationId: String) async throws {
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.notifications)
            .document(notificationId)

        try await ref.updateDataAsync(["read": true])
    }
}
