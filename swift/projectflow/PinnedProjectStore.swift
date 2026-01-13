import Foundation
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class PinnedProjectStore: ObservableObject {
    @Published var pinnedProjectId: String?
    @Published var pinnedProject: Project?
    @Published var isLoading = false

    private let db = Firestore.firestore()
    private var memberListener: ListenerRegistration?
    private var projectListener: ListenerRegistration?

    func start(tenantId: String) {
        guard let user = Auth.auth().currentUser else {
            reset()
            return
        }

        isLoading = true
        memberListener?.remove()
        projectListener?.remove()

        let memberRef = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.members)
            .document(user.uid)

        memberListener = memberRef.addSnapshotListener { [weak self] snapshot, _ in
            guard let self else { return }
            let data = snapshot?.data() ?? [:]
            let nextPinnedId = data["pinnedProjectId"] as? String
            pinnedProjectId = nextPinnedId
            isLoading = false

            projectListener?.remove()
            pinnedProject = nil

            guard let projectId = nextPinnedId else { return }

            let projectRef = db.collection(FirestorePath.tenants)
                .document(tenantId)
                .collection(FirestorePath.projects)
                .document(projectId)

            projectListener = projectRef.addSnapshotListener { [weak self] projectSnap, _ in
                guard let self else { return }
                guard let projectSnap, projectSnap.exists else {
                    pinnedProject = nil
                    return
                }
                pinnedProject = Project(id: projectSnap.documentID, data: projectSnap.data() ?? [:])
            }
        }
    }

    func stop() {
        memberListener?.remove()
        projectListener?.remove()
        memberListener = nil
        projectListener = nil
    }

    func pin(projectId: String, tenantId: String) {
        guard let user = Auth.auth().currentUser else { return }
        db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.members)
            .document(user.uid)
            .setData(["pinnedProjectId": projectId], merge: true)
    }

    func unpin(tenantId: String) {
        guard let user = Auth.auth().currentUser else { return }
        db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.members)
            .document(user.uid)
            .updateData(["pinnedProjectId": FieldValue.delete()])
    }

    private func reset() {
        pinnedProjectId = nil
        pinnedProject = nil
        isLoading = false
    }
}
