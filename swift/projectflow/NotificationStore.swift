import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

struct AppNotification: Identifiable {
    let id: String
    let type: String
    let title: String
    let message: String
    let read: Bool
    let createdAt: Date?
    let tenantId: String
}

@MainActor
final class NotificationStore: ObservableObject {
    @Published var items: [AppNotification] = []
    @Published var isLoading = true

    private var listener: ListenerRegistration?
    private let db = Firestore.firestore()

    func start() {
        guard let user = Auth.auth().currentUser else {
            items = []
            isLoading = false
            return
        }

        guard let tenantId = TenantResolver.resolveTenantId(for: user) else {
            items = []
            isLoading = false
            return
        }

        isLoading = true
        listener?.remove()

        let query = db.collection("tenants")
            .document(tenantId)
            .collection("notifications")
            .whereField("userId", isEqualTo: user.uid)

        listener = query.addSnapshotListener { [weak self] snapshot, error in
            guard let self else { return }
            if let error {
                print("Notifications listener error: \(error.localizedDescription)")
                self.items = []
                self.isLoading = false
                return
            }

            let notifications = snapshot?.documents.compactMap { doc -> AppNotification? in
                let data = doc.data()
                guard
                    let type = data["type"] as? String,
                    let title = data["title"] as? String,
                    let message = data["message"] as? String,
                    let read = data["read"] as? Bool
                else {
                    return nil
                }

                let createdAt = (data["createdAt"] as? Timestamp)?.dateValue()

                return AppNotification(
                    id: doc.documentID,
                    type: type,
                    title: title,
                    message: message,
                    read: read,
                    createdAt: createdAt,
                    tenantId: tenantId
                )
            } ?? []

            self.items = notifications.sorted { lhs, rhs in
                let left = lhs.createdAt ?? Date.distantPast
                let right = rhs.createdAt ?? Date.distantPast
                return left > right
            }
            self.isLoading = false
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func markAsRead(_ notification: AppNotification) {
        guard !notification.read else { return }
        db.collection("tenants")
            .document(notification.tenantId)
            .collection("notifications")
            .document(notification.id)
            .updateData(["read": true])
    }
}

enum TenantResolver {
    static let activeTenantKey = "activeTenantId"

    static func resolveTenantId(for user: User) -> String? {
        UserDefaults.standard.string(forKey: activeTenantKey) ?? user.uid
    }
}
