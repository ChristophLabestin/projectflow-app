import Foundation
import FirebaseFirestore
import Combine

@MainActor
final class LabelsStore: ObservableObject {
    @Published var labels: [ProjectLabel] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?

    func start(tenantId: String, projectId: String? = nil) {
        isLoading = true
        errorMessage = nil
        listener?.remove()

        // In Firestore, we store labels either at tenant level or project level
        // For simplicity and matching web, let's look for both if in a project
        let collectionRef = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection("labels")

        listener = collectionRef.addSnapshotListener { [weak self] snapshot, error in
            guard let self = self else { return }
            if let error = error {
                self.errorMessage = error.localizedDescription
                self.isLoading = false
                return
            }

            let items = snapshot?.documents.map { ProjectLabel(id: $0.documentID, data: $0.data()) } ?? []
            
            // Filter by project if provided, otherwise show tenant labels
            if let projectId = projectId {
                self.labels = items.filter { $0.projectId == nil || $0.projectId == projectId }
            } else {
                self.labels = items
            }
            
            self.isLoading = false
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }
}
