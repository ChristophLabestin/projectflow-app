import Foundation
import FirebaseFirestore

extension FirestorePath {
    static let initiatives = "initiatives"
    static let personalTasks = "personalTasks"
    static let comments = "comments"
    static let codexSessions = "codex_sessions"
    static let codexFollowups = "codex_followups"
    static let roles = "roles"
}

final class InitiativeRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) { self.db = db }

    private func collection(tenantId: String, projectId: String) -> CollectionReference {
        db.collection(FirestorePath.tenants).document(tenantId)
            .collection(FirestorePath.projects).document(projectId)
            .collection(FirestorePath.initiatives)
    }

    func listenInitiatives(
        tenantId: String,
        projectId: String,
        onUpdate: @escaping ([Initiative]) -> Void,
        onError: ((Error) -> Void)? = nil
    ) -> ListenerRegistration {
        collection(tenantId: tenantId, projectId: projectId)
            .addSnapshotListener { snapshot, error in
                if let error { onError?(error); onUpdate([]); return }
                let items = snapshot?.documents.map { Initiative(id: $0.documentID, data: $0.data()) } ?? []
                onUpdate(items)
            }
    }

    func createInitiative(tenantId: String, projectId: String, initiative: Initiative, permissions: PermissionContext) async throws -> String {
        try PermissionEvaluator(context: permissions).require(PermissionNode.initiativesCreate)
        let ref = collection(tenantId: tenantId, projectId: projectId).document()
        var payload = initiative.data
        payload["projectId"] = projectId
        payload["tenantId"] = tenantId
        payload["createdAt"] = FieldValue.serverTimestamp()
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await ref.setDataAsync(payload)
        return ref.documentID
    }

    func updateInitiative(tenantId: String, projectId: String, initiativeId: String, updates: [String: Any], permissions: PermissionContext) async throws {
        try PermissionEvaluator(context: permissions).require(PermissionNode.initiativesEdit)
        var payload = updates
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await collection(tenantId: tenantId, projectId: projectId).document(initiativeId).updateDataAsync(payload)
    }

    func deleteInitiative(tenantId: String, projectId: String, initiativeId: String, permissions: PermissionContext) async throws {
        try PermissionEvaluator(context: permissions).require(PermissionNode.initiativesDelete)
        try await collection(tenantId: tenantId, projectId: projectId).document(initiativeId).deleteAsync()
    }

    func getInitiative(tenantId: String, projectId: String, initiativeId: String) async throws -> Initiative? {
        let snap = try await collection(tenantId: tenantId, projectId: projectId).document(initiativeId).getDocumentAsync()
        guard let data = snap.data() else { return nil }
        return Initiative(id: initiativeId, data: data)
    }
}

final class PersonalTaskRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) { self.db = db }

    private func collection(tenantId: String, userId: String) -> CollectionReference {
        db.collection(FirestorePath.tenants).document(tenantId)
            .collection(FirestorePath.users).document(userId)
            .collection(FirestorePath.personalTasks)
    }

    func listenPersonalTasks(
        tenantId: String,
        userId: String,
        onUpdate: @escaping ([PersonalTask]) -> Void,
        onError: ((Error) -> Void)? = nil
    ) -> ListenerRegistration {
        collection(tenantId: tenantId, userId: userId)
            .order(by: "createdAt", descending: true)
            .addSnapshotListener { snapshot, error in
                if let error { onError?(error); onUpdate([]); return }
                let items = snapshot?.documents.map { PersonalTask(id: $0.documentID, data: $0.data()) } ?? []
                onUpdate(items)
            }
    }

    func createPersonalTask(tenantId: String, userId: String, task: PersonalTask) async throws -> String {
        let ref = collection(tenantId: tenantId, userId: userId).document()
        var payload = task.data
        payload["ownerId"] = userId
        payload["tenantId"] = tenantId
        payload["createdAt"] = FieldValue.serverTimestamp()
        try await ref.setDataAsync(payload)
        return ref.documentID
    }

    func updatePersonalTask(tenantId: String, userId: String, taskId: String, updates: [String: Any]) async throws {
        var payload = updates
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await collection(tenantId: tenantId, userId: userId).document(taskId).updateDataAsync(payload)
    }

    func deletePersonalTask(tenantId: String, userId: String, taskId: String) async throws {
        try await collection(tenantId: tenantId, userId: userId).document(taskId).deleteAsync()
    }
}

final class CommentRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) { self.db = db }

    private func collection(tenantId: String, projectId: String) -> CollectionReference {
        db.collection(FirestorePath.tenants).document(tenantId)
            .collection(FirestorePath.projects).document(projectId)
            .collection(FirestorePath.comments)
    }

    func listenComments(
        tenantId: String,
        projectId: String,
        targetId: String,
        targetType: String,
        onUpdate: @escaping ([Comment]) -> Void
    ) -> ListenerRegistration {
        collection(tenantId: tenantId, projectId: projectId)
            .whereField("targetId", isEqualTo: targetId)
            .whereField("targetType", isEqualTo: targetType)
            .order(by: "createdAt", descending: false)
            .addSnapshotListener { snapshot, _ in
                let items = snapshot?.documents.map { Comment(id: $0.documentID, data: $0.data()) } ?? []
                onUpdate(items)
            }
    }

    func createComment(tenantId: String, projectId: String, comment: Comment, permissions: PermissionContext) async throws -> String {
        try PermissionEvaluator(context: permissions).require(PermissionNode.commentsCreate)
        let ref = collection(tenantId: tenantId, projectId: projectId).document()
        var payload = comment.data
        payload["projectId"] = projectId
        payload["createdAt"] = FieldValue.serverTimestamp()
        try await ref.setDataAsync(payload)
        return ref.documentID
    }
}

final class MilestoneRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) { self.db = db }

    private func collection(tenantId: String, projectId: String) -> CollectionReference {
        db.collection(FirestorePath.tenants).document(tenantId)
            .collection(FirestorePath.projects).document(projectId)
            .collection(FirestorePath.milestones)
    }

    func listenMilestones(tenantId: String, projectId: String, onUpdate: @escaping ([Milestone]) -> Void) -> ListenerRegistration {
        collection(tenantId: tenantId, projectId: projectId).addSnapshotListener { snapshot, _ in
            let items = snapshot?.documents.map { Milestone(id: $0.documentID, data: $0.data()) } ?? []
            onUpdate(items)
        }
    }

    func createMilestone(tenantId: String, projectId: String, milestone: Milestone, permissions: PermissionContext) async throws -> String {
        try PermissionEvaluator(context: permissions).require(PermissionNode.milestonesCreate)
        let ref = collection(tenantId: tenantId, projectId: projectId).document()
        var payload = milestone.data
        payload["projectId"] = projectId
        payload["tenantId"] = tenantId
        payload["createdAt"] = FieldValue.serverTimestamp()
        try await ref.setDataAsync(payload)
        return ref.documentID
    }

    func updateMilestone(tenantId: String, projectId: String, milestoneId: String, updates: [String: Any], permissions: PermissionContext) async throws {
        try PermissionEvaluator(context: permissions).require(PermissionNode.milestonesEdit)
        try await collection(tenantId: tenantId, projectId: projectId).document(milestoneId).updateDataAsync(updates)
    }
}

final class SprintRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) { self.db = db }

    private func collection(tenantId: String, projectId: String) -> CollectionReference {
        db.collection(FirestorePath.tenants).document(tenantId)
            .collection(FirestorePath.projects).document(projectId)
            .collection(FirestorePath.sprints)
    }

    func listenSprints(tenantId: String, projectId: String, onUpdate: @escaping ([Sprint]) -> Void) -> ListenerRegistration {
        collection(tenantId: tenantId, projectId: projectId).addSnapshotListener { snapshot, _ in
            let items = snapshot?.documents.map { Sprint(id: $0.documentID, data: $0.data()) } ?? []
            onUpdate(items)
        }
    }

    func createSprint(tenantId: String, projectId: String, sprint: Sprint, permissions: PermissionContext) async throws -> String {
        try PermissionEvaluator(context: permissions).require(PermissionNode.sprintsCreate)
        let ref = collection(tenantId: tenantId, projectId: projectId).document()
        var payload = sprint.data
        payload["projectId"] = projectId
        payload["tenantId"] = tenantId
        payload["createdAt"] = FieldValue.serverTimestamp()
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await ref.setDataAsync(payload)
        return ref.documentID
    }

    func updateSprint(tenantId: String, projectId: String, sprintId: String, updates: [String: Any], permissions: PermissionContext) async throws {
        try PermissionEvaluator(context: permissions).require(PermissionNode.sprintsEdit)
        var payload = updates
        payload["updatedAt"] = FieldValue.serverTimestamp()
        try await collection(tenantId: tenantId, projectId: projectId).document(sprintId).updateDataAsync(payload)
    }
}

final class ActivityRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) { self.db = db }

    func listenActivity(tenantId: String, projectId: String, onUpdate: @escaping ([ActivityItem]) -> Void) -> ListenerRegistration {
        db.collection(FirestorePath.tenants).document(tenantId)
            .collection(FirestorePath.projects).document(projectId)
            .collection(FirestorePath.activity)
            .order(by: "createdAt", descending: true)
            .limit(to: 50)
            .addSnapshotListener { snapshot, _ in
                let items = snapshot?.documents.map { ActivityItem(id: $0.documentID, data: $0.data()) } ?? []
                onUpdate(items)
            }
    }
}

final class CodexRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) { self.db = db }

    func listenSessions(tenantId: String, projectId: String, onUpdate: @escaping ([CodexSession]) -> Void) -> ListenerRegistration {
        db.collection(FirestorePath.tenants).document(tenantId)
            .collection(FirestorePath.projects).document(projectId)
            .collection(FirestorePath.codexSessions)
            .order(by: "createdAt", descending: true)
            .addSnapshotListener { snapshot, _ in
                let items = snapshot?.documents.map { CodexSession(id: $0.documentID, data: $0.data()) } ?? []
                onUpdate(items)
            }
    }

    func listenFollowUps(tenantId: String, projectId: String, onUpdate: @escaping ([CodexFollowUp]) -> Void) -> ListenerRegistration {
        db.collection(FirestorePath.tenants).document(tenantId)
            .collection(FirestorePath.projects).document(projectId)
            .collection(FirestorePath.codexFollowups)
            .order(by: "createdAt", descending: true)
            .addSnapshotListener { snapshot, _ in
                let items = snapshot?.documents.map { CodexFollowUp(id: $0.documentID, data: $0.data()) } ?? []
                onUpdate(items)
            }
    }
}

final class RoleRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) { self.db = db }

    func fetchRoles(tenantId: String) async throws -> [TenantRole] {
        let snapshot = try await db.collection(FirestorePath.tenants).document(tenantId)
            .collection(FirestorePath.roles).getDocumentsAsync()
        return snapshot.documents.map { TenantRole(id: $0.documentID, data: $0.data()) }
    }
}
