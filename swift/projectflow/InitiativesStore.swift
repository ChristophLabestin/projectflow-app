import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class InitiativesStore: ObservableObject {
    @Published var initiatives: [Initiative] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository = InitiativeRepository()
    private var listener: ListenerRegistration?
    private var projectListener: ListenerRegistration?

    func listenProject(tenantId: String, projectId: String) {
        stop()
        isLoading = true
        listener = repository.listenInitiatives(tenantId: tenantId, projectId: projectId) { [weak self] items in
            self?.initiatives = items.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
            self?.isLoading = false
        }
    }

    func listenAllInTenant(tenantId: String) {
        stop()
        isLoading = true
        let db = Firestore.firestore()
        projectListener = db.collection(FirestorePath.tenants).document(tenantId)
            .collection(FirestorePath.projects)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self else { return }
                let projectIds = snapshot?.documents.map { $0.documentID } ?? []
                Task { await self.loadAllInitiatives(tenantId: tenantId, projectIds: projectIds) }
            }
    }

    private func loadAllInitiatives(tenantId: String, projectIds: [String]) async {
        var all: [Initiative] = []
        let db = Firestore.firestore()
        for projectId in projectIds {
            do {
                let snap = try await db.collection(FirestorePath.tenants).document(tenantId)
                    .collection(FirestorePath.projects).document(projectId)
                    .collection(FirestorePath.initiatives).getDocumentsAsync()
                all.append(contentsOf: snap.documents.map { Initiative(id: $0.documentID, data: $0.data()) })
            } catch {
                continue
            }
        }
        initiatives = all.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        isLoading = false
    }

    func create(tenantId: String, projectId: String, initiative: Initiative, permissions: PermissionContext) async throws -> String {
        try await repository.createInitiative(tenantId: tenantId, projectId: projectId, initiative: initiative, permissions: permissions)
    }

    func update(tenantId: String, projectId: String, initiativeId: String, updates: [String: Any], permissions: PermissionContext) async throws {
        try await repository.updateInitiative(tenantId: tenantId, projectId: projectId, initiativeId: initiativeId, updates: updates, permissions: permissions)
    }

    func stop() {
        listener?.remove()
        projectListener?.remove()
        listener = nil
        projectListener = nil
    }
}

@MainActor
final class PersonalTasksStore: ObservableObject {
    @Published var tasks: [PersonalTask] = []
    @Published var isLoading = false

    private let repository = PersonalTaskRepository()
    private var listener: ListenerRegistration?

    func start(tenantId: String) {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        listener?.remove()
        isLoading = true
        listener = repository.listenPersonalTasks(tenantId: tenantId, userId: userId) { [weak self] items in
            self?.tasks = items
            self?.isLoading = false
        }
    }

    func create(tenantId: String, task: PersonalTask) async throws -> String {
        guard let userId = Auth.auth().currentUser?.uid else { return "" }
        return try await repository.createPersonalTask(tenantId: tenantId, userId: userId, task: task)
    }

    func update(tenantId: String, taskId: String, updates: [String: Any]) async throws {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        try await repository.updatePersonalTask(tenantId: tenantId, userId: userId, taskId: taskId, updates: updates)
    }

    func stop() {
        listener?.remove()
        listener = nil
    }
}

@MainActor
final class CommentsStore: ObservableObject {
    @Published var comments: [Comment] = []
    private let repository = CommentRepository()
    private var listener: ListenerRegistration?

    func listen(tenantId: String, projectId: String, targetId: String, targetType: String) {
        listener?.remove()
        listener = repository.listenComments(
            tenantId: tenantId,
            projectId: projectId,
            targetId: targetId,
            targetType: targetType
        ) { [weak self] items in
            self?.comments = items
        }
    }

    func post(tenantId: String, projectId: String, comment: Comment, permissions: PermissionContext) async throws {
        _ = try await repository.createComment(tenantId: tenantId, projectId: projectId, comment: comment, permissions: permissions)
    }

    func stop() {
        listener?.remove()
        listener = nil
    }
}

enum FocusItemResolver {
    static func fetchPinnedItemDetails(_ item: PinnedItem, tenantId: String) async -> (title: String, subtitle: String?) {
        let db = Firestore.firestore()
        switch item.type {
        case FocusItemType.initiative.rawValue:
            guard !item.projectId.isEmpty else { return (item.title, nil) }
            let snap = try? await db.collection(FirestorePath.tenants).document(tenantId)
                .collection(FirestorePath.projects).document(item.projectId)
                .collection(FirestorePath.initiatives).document(item.id).getDocumentAsync()
            let title = snap?.data()?["title"] as? String ?? item.title
            return (title, "Initiative")
        case FocusItemType.issue.rawValue:
            guard !item.projectId.isEmpty else { return (item.title, nil) }
            let snap = try? await db.collection(FirestorePath.tenants).document(tenantId)
                .collection(FirestorePath.projects).document(item.projectId)
                .collection(FirestorePath.issues).document(item.id).getDocumentAsync()
            let title = snap?.data()?["title"] as? String ?? item.title
            return (title, "Issue")
        case FocusItemType.personalTask.rawValue:
            guard let userId = Auth.auth().currentUser?.uid else { return (item.title, "Personal Task") }
            let snap = try? await db.collection(FirestorePath.tenants).document(tenantId)
                .collection(FirestorePath.users).document(userId)
                .collection(FirestorePath.personalTasks).document(item.id).getDocumentAsync()
            let title = snap?.data()?["title"] as? String ?? item.title
            return (title, "Personal Task")
        default:
            guard !item.projectId.isEmpty else { return (item.title, "Task") }
            let snap = try? await db.collection(FirestorePath.tenants).document(tenantId)
                .collection(FirestorePath.projects).document(item.projectId)
                .collection(FirestorePath.tasks).document(item.id).getDocumentAsync()
            let title = snap?.data()?["title"] as? String ?? item.title
            return (title, "Task")
        }
    }
}
