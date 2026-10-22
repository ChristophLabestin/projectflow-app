import Foundation
import Observation
import FirebaseFirestore
import PFModel

/// Live comments of one target (task or initiative) of a project, oldest first.
/// `TaskDetailStore` carries the task's own comments; this store serves the other targets.
@Observable
public final class CommentsStore {
    public let tenantId: String
    public let projectId: String
    public let targetId: String
    public private(set) var comments: [Comment] = []
    private let listeners = ListenerBag()

    public init(tenantId: String, projectId: String, targetId: String) {
        self.tenantId = tenantId
        self.projectId = projectId
        self.targetId = targetId
    }

    public func start() {
        guard listeners.keys.isEmpty else { return }
        let query = PFPath.comments(tenantId, projectId).whereField("targetId", isEqualTo: targetId)
        listeners.set("comments", query.addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.comments = snapshot.documents.compactMap { doc in doc.fields.map { Comment(id: doc.documentID, fields: $0) } }
                    .sorted { ($0.createdAt?.instant ?? .distantFuture) < ($1.createdAt?.instant ?? .distantFuture) }
            }
        })
    }

    public func stop() { listeners.removeAll() }
}
