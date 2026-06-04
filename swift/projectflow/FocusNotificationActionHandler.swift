import Foundation
import FirebaseAuth
import FirebaseFirestore

#if os(iOS)
import UserNotifications

final class FocusNotificationActionHandler {
    static let shared = FocusNotificationActionHandler()

    private let db = Firestore.firestore()
    private let isoFormatter = ISO8601DateFormatter()

    private init() {}

    func canHandle(_ actionIdentifier: String) -> Bool {
        ProjectFlowNotificationAction.backgroundActions.contains(actionIdentifier)
    }

    func handle(response: UNNotificationResponse, completion: @escaping () -> Void) {
        guard canHandle(response.actionIdentifier) else {
            completion()
            return
        }

        Task {
            do {
                try await perform(action: response.actionIdentifier, response: response)
            } catch {
                print("Failed to handle ProjectFlow notification action: \(error.localizedDescription)")
            }
            completion()
        }
    }

    private func perform(action: String, response: UNNotificationResponse) async throws {
        guard let user = Auth.auth().currentUser else { return }
        guard let item = FocusActionItem(response: response, fallbackTenantId: TenantResolver.resolveTenantId(for: user)) else {
            return
        }

        switch action {
        case ProjectFlowNotificationAction.startFocus:
            try await saveFocus(userId: user.uid, item: item, status: "active", lastAction: "started")
        case ProjectFlowNotificationAction.snoozeFocus:
            try await saveFocus(userId: user.uid, item: item, status: "snoozed", lastAction: "snoozed", snoozedUntil: Date().addingTimeInterval(60 * 60))
        case ProjectFlowNotificationAction.blockFocus:
            try await markBlocked(item: item)
            try await saveFocus(userId: user.uid, item: item, status: "blocked", lastAction: "blocked")
        case ProjectFlowNotificationAction.completeFocus:
            try await markComplete(item: item, userId: user.uid)
            try await clearFocus(userId: user.uid)
        default:
            break
        }
    }

    private func saveFocus(
        userId: String,
        item: FocusActionItem,
        status: String,
        lastAction: String,
        snoozedUntil: Date? = nil
    ) async throws {
        let now = isoFormatter.string(from: Date())
        var focusState: [String: Any] = [
            "itemId": item.id,
            "itemType": item.type,
            "title": item.title,
            "status": status,
            "startedAt": now,
            "updatedAt": now,
            "lastAction": lastAction
        ]
        if let projectId = item.projectId {
            focusState["projectId"] = projectId
        }
        if let tenantId = item.tenantId {
            focusState["tenantId"] = tenantId
        }
        if status == "blocked" {
            focusState["blockedAt"] = now
        }
        if let snoozedUntil {
            focusState["snoozedUntil"] = isoFormatter.string(from: snoozedUntil)
        }

        var pinnedItem: [String: Any] = [
            "id": item.id,
            "type": item.type,
            "title": item.title,
            "projectId": item.projectId ?? ""
        ]
        if let tenantId = item.tenantId {
            pinnedItem["tenantId"] = tenantId
        }

        try await db.collection(FirestorePath.users).document(userId).setDataAsync([
            "focusItemId": item.id,
            "focusState": focusState,
            "pinnedItems": FieldValue.arrayUnion([pinnedItem])
        ], merge: true)
    }

    private func clearFocus(userId: String) async throws {
        try await db.collection(FirestorePath.users).document(userId).updateDataAsync([
            "focusItemId": FieldValue.delete(),
            "focusState": FieldValue.delete()
        ])
    }

    private func markBlocked(item: FocusActionItem) async throws {
        guard item.type == "task", let tenantId = item.tenantId, let projectId = item.projectId else { return }
        try await db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)
            .collection(FirestorePath.tasks)
            .document(item.id)
            .updateDataAsync([
                "status": "Blocked",
                "isCompleted": false
            ])
    }

    private func markComplete(item: FocusActionItem, userId: String) async throws {
        guard let tenantId = item.tenantId else { return }

        if item.type == "task", let projectId = item.projectId {
            try await db.collection(FirestorePath.tenants)
                .document(tenantId)
                .collection(FirestorePath.projects)
                .document(projectId)
                .collection(FirestorePath.tasks)
                .document(item.id)
                .updateDataAsync([
                    "status": "Done",
                    "isCompleted": true
                ])
        } else if item.type == "personal-task" {
            try await db.collection(FirestorePath.tenants)
                .document(tenantId)
                .collection(FirestorePath.users)
                .document(userId)
                .collection("personalTasks")
                .document(item.id)
                .updateDataAsync([
                    "isCompleted": true,
                    "completedAt": FieldValue.serverTimestamp()
                ])
        }
    }
}

private struct FocusActionItem {
    let id: String
    let type: String
    let title: String
    let projectId: String?
    let tenantId: String?

    init?(response: UNNotificationResponse, fallbackTenantId: String?) {
        let userInfo = response.notification.request.content.userInfo
        let taskId = Self.string(userInfo["taskId"])
        let explicitItemId = Self.string(userInfo["itemId"])

        guard let resolvedId = explicitItemId ?? taskId else {
            return nil
        }

        id = resolvedId
        type = Self.string(userInfo["itemType"]) ?? "task"
        title = Self.string(userInfo["title"]) ?? response.notification.request.content.title
        projectId = Self.string(userInfo["projectId"])
        tenantId = Self.string(userInfo["tenantId"]) ?? fallbackTenantId
    }

    private static func string(_ value: Any?) -> String? {
        if let value = value as? String, !value.isEmpty {
            return value
        }
        return nil
    }
}

#endif
