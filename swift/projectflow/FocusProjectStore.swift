import Foundation
import Combine
import FirebaseFirestore

@MainActor
final class FocusProjectStore: ObservableObject {
    @Published var focusProjectId: String?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?

    func start(tenantId: String) {
        isLoading = true
        errorMessage = nil
        listener?.remove()

        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)

        listener = ref.addSnapshotListener { [weak self] snapshot, error in
            guard let self else { return }
            if let error {
                errorMessage = error.localizedDescription
                isLoading = false
                return
            }

            let data = snapshot?.data() ?? [:]
            focusProjectId = data["focusProjectId"] as? String
            isLoading = false
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
        focusProjectId = nil
        isLoading = false
    }

    func setFocus(tenantId: String, projectId: String?) async {
        errorMessage = nil
        isLoading = true
        let ref = db.collection(FirestorePath.tenants).document(tenantId)
        let value: Any = projectId ?? NSNull()

        do {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                ref.updateData(["focusProjectId": value]) { error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: ())
                    }
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
