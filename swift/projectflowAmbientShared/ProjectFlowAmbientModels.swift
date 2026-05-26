import Foundation

#if canImport(ActivityKit)
import ActivityKit
#endif

enum ProjectFlowAmbientConstants {
    static let appGroupIdentifier = "group.de.christophlabestin.projectflow"
    static let focusSnapshotKey = "projectflow.ambient.focusSnapshot"
    static let shareCapturesKey = "projectflow.share.pendingCaptures"
    static let focusReminderRequestIdentifier = "projectflow.focus.reminder"

    static var sharedDefaults: UserDefaults {
        UserDefaults(suiteName: appGroupIdentifier) ?? .standard
    }
}

enum ProjectFlowNotificationCategory {
    static let focusReminder = "PROJECTFLOW_FOCUS_REMINDER"
    static let projectNotification = "PROJECTFLOW_NOTIFICATION"
}

enum ProjectFlowNotificationAction {
    static let open = "PROJECTFLOW_OPEN"
    static let startFocus = "PROJECTFLOW_START_FOCUS"
    static let snoozeFocus = "PROJECTFLOW_SNOOZE_FOCUS"
    static let blockFocus = "PROJECTFLOW_BLOCK_FOCUS"
    static let completeFocus = "PROJECTFLOW_COMPLETE_FOCUS"

    static let backgroundActions: Set<String> = [
        startFocus,
        snoozeFocus,
        blockFocus,
        completeFocus
    ]
}

struct ProjectFlowAmbientFocusSnapshot: Codable, Hashable {
    var itemId: String
    var itemType: String
    var title: String
    var projectId: String?
    var tenantId: String?
    var priority: String?
    var isCompleted: Bool?
    var status: String
    var startedAt: String?
    var snoozedUntil: String?
    var blockedAt: String?
    var updatedAt: String?
    var lastAction: String?

    static let empty = ProjectFlowAmbientFocusSnapshot(
        itemId: "",
        itemType: "task",
        title: "No current focus",
        status: "none"
    )

    var isEmpty: Bool {
        itemId.isEmpty || status == "none"
    }

    var statusLabel: String {
        switch status {
        case "blocked":
            return "Blocked"
        case "snoozed":
            return "Snoozed"
        case "active":
            return "Current Focus"
        default:
            return "No Focus"
        }
    }

    var notificationUserInfo: [String: String] {
        var payload: [String: String] = [
            "itemId": itemId,
            "itemType": itemType,
            "title": title,
            "status": status,
            "type": "focus_checkin"
        ]
        if let projectId, !projectId.isEmpty {
            payload["projectId"] = projectId
        }
        if let tenantId, !tenantId.isEmpty {
            payload["tenantId"] = tenantId
        }
        if itemType == "task" || itemType == "personal-task" {
            payload["taskId"] = itemId
        }
        if itemType == "issue" {
            payload["issueId"] = itemId
        }
        return payload
    }
}

enum ProjectFlowAmbientSnapshotStore {
    static func readFocusSnapshot() -> ProjectFlowAmbientFocusSnapshot {
        guard let data = ProjectFlowAmbientConstants.sharedDefaults.data(forKey: ProjectFlowAmbientConstants.focusSnapshotKey),
              let snapshot = try? JSONDecoder().decode(ProjectFlowAmbientFocusSnapshot.self, from: data)
        else {
            return .empty
        }
        return snapshot
    }

    static func writeFocusSnapshot(_ snapshot: ProjectFlowAmbientFocusSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        ProjectFlowAmbientConstants.sharedDefaults.set(data, forKey: ProjectFlowAmbientConstants.focusSnapshotKey)
    }

    static func clearFocusSnapshot() {
        ProjectFlowAmbientConstants.sharedDefaults.removeObject(forKey: ProjectFlowAmbientConstants.focusSnapshotKey)
    }
}

struct ProjectFlowShareCapture: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var text: String
    var url: String?
    var createdAt: String

    init(id: String = UUID().uuidString, title: String, text: String, url: String? = nil, createdAt: String = ISO8601DateFormatter().string(from: Date())) {
        self.id = id
        self.title = title
        self.text = text
        self.url = url
        self.createdAt = createdAt
    }
}

enum ProjectFlowShareCaptureQueue {
    static func pending() -> [ProjectFlowShareCapture] {
        guard let data = ProjectFlowAmbientConstants.sharedDefaults.data(forKey: ProjectFlowAmbientConstants.shareCapturesKey),
              let captures = try? JSONDecoder().decode([ProjectFlowShareCapture].self, from: data)
        else {
            return []
        }
        return captures
    }

    static func enqueue(_ capture: ProjectFlowShareCapture) {
        var captures = pending()
        captures.append(capture)
        replace(captures)
    }

    static func replace(_ captures: [ProjectFlowShareCapture]) {
        guard let data = try? JSONEncoder().encode(captures) else { return }
        ProjectFlowAmbientConstants.sharedDefaults.set(data, forKey: ProjectFlowAmbientConstants.shareCapturesKey)
    }

    static func drain() -> [ProjectFlowShareCapture] {
        let captures = pending()
        ProjectFlowAmbientConstants.sharedDefaults.removeObject(forKey: ProjectFlowAmbientConstants.shareCapturesKey)
        return captures
    }
}

#if canImport(ActivityKit)
@available(iOS 16.1, *)
struct ProjectFlowFocusActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var status: String
        var itemId: String
        var projectId: String?
        var updatedAt: String?
    }

    var itemId: String
    var itemType: String
    var projectId: String?
}
#endif
