import Foundation
import FirebaseFirestore
import Combine

@MainActor
final class GroupStore: ObservableObject {
    @Published var groups: [UserGroup] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?

    func start(tenantId: String) {
        isLoading = true
        errorMessage = nil
        listener?.remove()

        let collectionRef = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection("groups")

        listener = collectionRef.addSnapshotListener { [weak self] snapshot, error in
            guard let self = self else { return }
            if let error = error {
                self.errorMessage = error.localizedDescription
                self.isLoading = false
                return
            }

            self.groups = snapshot?.documents.map { UserGroup(id: $0.documentID, data: $0.data()) } ?? []
            self.isLoading = false
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func createGroup(tenantId: String, name: String, description: String, color: String) async {
        errorMessage = nil
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection("groups")
            .document()
        
        let group = UserGroup(id: ref.documentID, data: [
            "name": name,
            "description": description,
            "color": color,
            "memberIds": []
        ])
        
        do {
            try await ref.setData(group.data)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateGroupMembers(tenantId: String, groupId: String, memberIds: [String]) async {
        errorMessage = nil
        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection("groups")
            .document(groupId)
        
        do {
            try await ref.updateData(["memberIds": memberIds])
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
