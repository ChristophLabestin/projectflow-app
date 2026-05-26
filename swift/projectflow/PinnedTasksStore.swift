import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class PinnedTasksStore: ObservableObject {
    @Published var pinnedItems: [PinnedItem] = []
    @Published var focusItemId: String?
    @Published var focusState: ProjectFlowFocusState?
    @Published var isLoading = false

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?
    private let isoFormatter = ISO8601DateFormatter()

    var focusItem: PinnedItem? {
        guard let focusItemId else { return nil }
        return pinnedItems.first { $0.id == focusItemId }
    }

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
                if let rawFocusState = data["focusState"] as? [String: Any] {
                    focusState = ProjectFlowFocusState(data: rawFocusState)
                } else if let focusItem = focusItem {
                    focusState = buildFocusState(for: focusItem, status: "active", lastAction: "started")
                } else {
                    focusState = nil
                }
                FocusAmbientController.shared.sync(item: focusItem, focusState: focusState)
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
        save(items: next, focusItemId: focusItemId, focusState: focusState, userId: user.uid)
    }

    func unpin(itemId: String) {
        guard let user = Auth.auth().currentUser else { return }
        let next = pinnedItems.filter { $0.id != itemId }
        let nextFocus = focusItemId == itemId ? nil : focusItemId
        let nextFocusState = focusItemId == itemId ? nil : focusState
        save(items: next, focusItemId: nextFocus, focusState: nextFocusState, userId: user.uid)
    }

    func isPinned(_ itemId: String) -> Bool {
        pinnedItems.contains { $0.id == itemId }
    }

    func startFocus(item: PinnedItem) {
        guard let user = Auth.auth().currentUser else { return }
        var next = pinnedItems
        if let index = next.firstIndex(where: { $0.id == item.id }) {
            next[index] = item
        } else {
            next.append(item)
        }
        let nextFocusState = buildFocusState(for: item, status: "active", lastAction: focusItemId == item.id ? "resumed" : "started")
        FocusAmbientController.shared.sync(item: item, focusState: nextFocusState)
        save(items: next, focusItemId: item.id, focusState: nextFocusState, userId: user.uid)
    }

    func snoozeFocus(minutes: Int = 60) {
        guard let user = Auth.auth().currentUser, let focusItem else { return }
        let now = Date()
        let snoozedUntil = Calendar.current.date(byAdding: .minute, value: minutes, to: now) ?? now
        var nextFocusState = buildFocusState(for: focusItem, status: "snoozed", lastAction: "snoozed")
        var data = nextFocusState.data
        data["snoozedUntil"] = isoFormatter.string(from: snoozedUntil)
        data["updatedAt"] = isoFormatter.string(from: now)
        nextFocusState = ProjectFlowFocusState(data: data)
        FocusAmbientController.shared.sync(item: focusItem, focusState: nextFocusState)
        save(items: pinnedItems, focusItemId: focusItem.id, focusState: nextFocusState, userId: user.uid)
    }

    func blockFocus() {
        guard let user = Auth.auth().currentUser, let focusItem else { return }
        let nextFocusState = buildFocusState(for: focusItem, status: "blocked", lastAction: "blocked")
        FocusAmbientController.shared.sync(item: focusItem, focusState: nextFocusState)
        save(items: pinnedItems, focusItemId: focusItem.id, focusState: nextFocusState, userId: user.uid)
    }

    func clearFocus() {
        guard let user = Auth.auth().currentUser else { return }
        FocusAmbientController.shared.clearFocus()
        save(items: pinnedItems, focusItemId: nil, focusState: nil, userId: user.uid)
    }

    private func buildFocusState(for item: PinnedItem, status: String, lastAction: String) -> ProjectFlowFocusState {
        let now = isoFormatter.string(from: Date())
        let startedAt = focusState?.itemId == item.id ? focusState?.startedAt : nil
        var data: [String: Any] = [
            "itemId": item.id,
            "itemType": item.type,
            "title": item.title,
            "status": status,
            "startedAt": startedAt ?? now,
            "updatedAt": now,
            "lastAction": lastAction
        ]
        if !item.projectId.isEmpty {
            data["projectId"] = item.projectId
        }
        if let tenantId = item.tenantId {
            data["tenantId"] = tenantId
        }
        if status == "blocked" {
            data["blockedAt"] = now
        }
        return ProjectFlowFocusState(data: data)
    }

    private func save(items: [PinnedItem], focusItemId: String?, focusState: ProjectFlowFocusState?, userId: String) {
        var payload: [String: Any] = [
            "pinnedItems": items.map { $0.data }
        ]
        payload["focusItemId"] = focusItemId ?? FieldValue.delete()
        payload["focusState"] = focusState?.data ?? FieldValue.delete()

        db.collection(FirestorePath.users)
            .document(userId)
            .setData(payload, merge: true)
    }

    private func reset() {
        pinnedItems = []
        focusItemId = nil
        focusState = nil
        FocusAmbientController.shared.clearFocus()
        isLoading = false
    }
}
