import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class PinnedTasksStore: ObservableObject {
    @Published var pinnedItems: [PinnedItem] = []
    @Published var focusItemId: String?
    @Published var isLoading = false

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?

    func start() {
        guard let user = Auth.auth().currentUser else {
            reset()
            return
        }

        isLoading = true
        listener?.remove()

        listener = db.collection(FirestorePath.users)
            .document(user.uid)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self else { return }
                let data = snapshot?.data() ?? [:]
                let rawItems = data["pinnedItems"] as? [[String: Any]] ?? []
                pinnedItems = rawItems.map { PinnedItem(data: $0) }
                focusItemId = data["focusItemId"] as? String
                isLoading = false
            }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func pin(item: PinnedItem) {
        guard let user = Auth.auth().currentUser else { return }
        var next = pinnedItems
        guard !next.contains(where: { $0.id == item.id }) else { return }
        next.append(item)
        save(items: next, focusItemId: focusItemId, userId: user.uid)
    }

    func unpin(itemId: String) {
        guard let user = Auth.auth().currentUser else { return }
        let next = pinnedItems.filter { $0.id != itemId }
        let nextFocus = focusItemId == itemId ? nil : focusItemId
        save(items: next, focusItemId: nextFocus, userId: user.uid)
    }

    func isPinned(_ itemId: String) -> Bool {
        pinnedItems.contains { $0.id == itemId }
    }

    private func save(items: [PinnedItem], focusItemId: String?, userId: String) {
        db.collection(FirestorePath.users)
            .document(userId)
            .setData(
                [
                    "pinnedItems": items.map { $0.data },
                    "focusItemId": focusItemId as Any
                ],
                merge: true
            )
    }

    private func reset() {
        pinnedItems = []
        focusItemId = nil
        isLoading = false
    }
}
