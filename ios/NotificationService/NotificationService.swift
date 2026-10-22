import UserNotifications
import PFSnapshot

/// Enriches pushes (contract C4 data keys): thread, category, deep link and title fallbacks, project name as subtitle,
/// relevance score and interruption level. Light on purpose: no Firebase, no network.
final class NotificationService: UNNotificationServiceExtension {
    private let box = ContentBox()

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
            contentHandler(request.content)
            return
        }
        box.content = content
        box.handler = contentHandler
        UNUserNotificationCenter.current().getNotificationSettings { [box] settings in
            let timeSensitiveAllowed = settings.timeSensitiveSetting == .enabled
            let handler = box.handler
            if let content = box.content {
                PushEnricher.enrich(content, timeSensitiveAllowed: timeSensitiveAllowed)
                handler?(content)
            }
        }
    }

    /// System is about to kill the extension: deliver what we have.
    override func serviceExtensionTimeWillExpire() {
        if let content = box.content { box.handler?(content) }
    }
}

/// The extension API hands over non-Sendable content and a handler; both are only touched from the system's callbacks.
private final class ContentBox: @unchecked Sendable {
    var content: UNMutableNotificationContent?
    var handler: ((UNNotificationContent) -> Void)?
}

enum PushEnricher {
    static func enrich(_ content: UNMutableNotificationContent, timeSensitiveAllowed: Bool) {
        let info = content.userInfo
        func value(_ key: String) -> String? { (info[key] as? String).flatMap { $0.isEmpty ? nil : $0 } }

        let snapshot = SnapshotStore.load()
        let strings = ExtensionStrings(language: snapshot?.language)
        let type = value("type")

        // Grouping: one thread per project (workspace for workspace-level pushes).
        if content.threadIdentifier.isEmpty {
            content.threadIdentifier = value("threadId") ?? value("projectId") ?? value("tenantId") ?? ""
        }

        // Actions: category by type when the server did not set a known one (contract C4 table).
        if content.categoryIdentifier.isEmpty || content.categoryIdentifier == "PROJECTFLOW_NOTIFICATION" {
            content.categoryIdentifier = category(for: type)
        }

        // Deep link: derive the web route when the payload has ids but no link.
        if value("deepLink") == nil, let link = deepLink(projectId: value("projectId"), taskId: value("taskId"), initiativeId: value("initiativeId")) {
            var updated = info
            updated["deepLink"] = link
            content.userInfo = updated
        }

        // Title fallback by type, project name as subtitle.
        if content.title.isEmpty, let key = titleKey(for: type) { content.title = strings.t(key) }
        if content.subtitle.isEmpty, let projectId = value("projectId"),
           let project = snapshot?.projects.first(where: { $0.id == projectId }) {
            content.subtitle = project.title
        }

        // Ranking in notification summaries and Focus filtering.
        content.relevanceScore = relevance(for: type)
        switch type {
        case "comment_mention":
            content.interruptionLevel = timeSensitiveAllowed ? .timeSensitive : .active
        case "morning_briefing", "day_close":
            content.interruptionLevel = .passive
        default:
            content.interruptionLevel = .active
        }
    }

    static func category(for type: String?) -> String {
        switch type {
        case "task_assigned", "subtask_assigned": "PF_ASSIGNMENT"
        case "comment_mention": "PF_MENTION"
        case "comment_added": "PF_COMMENT"
        case "task_due_today": "PF_DUE"
        case "reminder": "PF_REMINDER"
        case "morning_briefing": "PF_BRIEFING"
        case "day_close": "PF_DAYCLOSE"
        default: "PF_GENERIC"
        }
    }

    static func titleKey(for type: String?) -> String? {
        switch type {
        case "task_assigned", "subtask_assigned": "push.assigned"
        case "comment_mention": "push.mention"
        case "comment_added": "push.comment"
        case "task_due_today": "push.due"
        case "reminder": "push.reminder"
        case "morning_briefing": "push.briefing"
        case "day_close": "push.dayclose"
        default: nil
        }
    }

    static func relevance(for type: String?) -> Double {
        switch type {
        case "comment_mention": 1.0
        case "task_assigned", "subtask_assigned": 0.9
        case "task_due_today", "reminder": 0.8
        case "comment_added": 0.6
        case "morning_briefing": 0.5
        case "day_close": 0.3
        default: 0.2
        }
    }

    static func deepLink(projectId: String?, taskId: String?, initiativeId: String?) -> String? {
        guard let projectId else { return nil }
        if let taskId { return "/project/\(projectId)/tasks/\(taskId)" }
        if let initiativeId { return "/project/\(projectId)/initiatives/\(initiativeId)" }
        return "/project/\(projectId)"
    }
}
