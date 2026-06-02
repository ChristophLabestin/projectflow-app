import Foundation
import FirebaseFirestore
import Combine

struct WorkspaceInfo: Identifiable, Equatable {
    let id: String
    let name: String
    let planTier: String
    let role: String
}

@MainActor
final class WorkspaceStore: ObservableObject {
    @Published var workspaces: [WorkspaceInfo] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?

    func start(userId: String) {
        isLoading = true
        errorMessage = nil
        listener?.remove()

        // Query all 'members' collection groups where the document ID matches the userId
        // Note: collectionGroup(FirestorePath.members) where docID == userId
        // Since Firestore doesn't support docID filtering in collectionGroup directly in a simple way without whereField("uid", ...),
        // we assume 'uid' or 'userId' is a field in the member doc as per APP_CONCEPT.
        
        listener = db.collectionGroup(FirestorePath.members)
            .whereField("uid", isEqualTo: userId)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self = self else { return }
                if let error = error {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                    return
                }

                _Concurrency.Task {
                    await self.fetchTenantDetails(from: snapshot?.documents ?? [])
                }
            }
    }

    private func fetchTenantDetails(from memberDocs: [QueryDocumentSnapshot]) async {
        var results: [WorkspaceInfo] = []
        
        for doc in memberDocs {
            // Member doc is at tenants/{tenantId}/members/{userId}
            let tenantRef = doc.reference.parent.parent
            guard let tenantId = tenantRef?.documentID else { continue }
            
            do {
                let tenantDoc = try await tenantRef?.getDocument()
                if let data = tenantDoc?.data() {
                    let name = data["name"] as? String ?? "Untitled Workspace"
                    let plan = data["planTier"] as? String ?? "Starter"
                    let role = doc.data()["role"] as? String ?? "Member"
                    
                    results.append(WorkspaceInfo(
                        id: tenantId,
                        name: name,
                        planTier: plan,
                        role: role
                    ))
                }
            } catch {
                print("Failed to fetch tenant \(tenantId): \(error)")
            }
        }
        
        self.workspaces = results.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        self.isLoading = false
    }

    func stop() {
        listener?.remove()
        listener = nil
    }
}
