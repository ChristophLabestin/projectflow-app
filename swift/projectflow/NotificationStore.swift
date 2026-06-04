import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

#if os(iOS)
import UIKit
#endif

struct AppNotification: Identifiable {
    let id: String
    let type: String
    let title: String
    let message: String
    let read: Bool
    let createdAt: Date?
    let tenantId: String
    let projectId: String?
    let taskId: String?
    let initiativeId: String?
    let actorId: String?
}

@MainActor
final class NotificationStore: ObservableObject {
    @Published var items: [AppNotification] = []
    @Published var isLoading = true

    var unreadCount: Int {
        items.filter { !$0.read }.count
    }

    private var listener: ListenerRegistration?
    private let db = Firestore.firestore()

    func start() {
        guard let user = Auth.auth().currentUser else {
            items = []
            isLoading = false
            return
        }

        guard let tenantId = TenantResolver.resolveTenantId(for: user) ?? AppSession.shared.activeTenantId else {
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
                let projectId = data["projectId"] as? String
                let taskId = data["taskId"] as? String
                let initiativeId = data["initiativeId"] as? String
                let actorId = data["actorId"] as? String

                return AppNotification(
                    id: doc.documentID,
                    type: type,
                    title: title,
                    message: message,
                    read: read,
                    createdAt: createdAt,
                    tenantId: tenantId,
                    projectId: projectId,
                    taskId: taskId,
                    initiativeId: initiativeId,
                    actorId: actorId
                )
            } ?? []

            self.items = notifications.sorted { lhs, rhs in
                let left = lhs.createdAt ?? Date.distantPast
                let right = rhs.createdAt ?? Date.distantPast
                return left > right
            }
#if os(iOS)
            UIApplication.shared.applicationIconBadgeNumber = notifications.filter { !$0.read }.count
#endif
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

    func markAllAsRead() {
        let unread = items.filter { !$0.read }
        for item in unread {
            markAsRead(item)
        }
    }

    func clearAll() {
        for item in items {
            db.collection("tenants")
                .document(item.tenantId)
                .collection("notifications")
                .document(item.id)
                .delete()
        }
    }

    func deleteNotification(_ notification: AppNotification) {
        db.collection("tenants")
            .document(notification.tenantId)
            .collection("notifications")
            .document(notification.id)
            .delete()
    }

    func respondToInvite(notification: AppNotification, accept: Bool) async {
        guard let projectId = notification.projectId, let actorId = notification.actorId else { return }
        
        let projectRef = db.collection("tenants")
            .document(notification.tenantId)
            .collection("projects")
            .document(projectId)
            
        do {
            if accept {
                // Add user to project members
                try await projectRef.updateData([
                    "memberIds": FieldValue.arrayUnion([actorId])
                ])
            }
            
            // Delete notification after responding
            deleteNotification(notification)
        } catch {
            print("Failed to respond to invite: \(error)")
        }
    }
}
