import Foundation

#if os(iOS)
import ActivityKit
import UserNotifications
import WidgetKit

@MainActor
final class FocusAmbientController {
    static let shared = FocusAmbientController()

    private let isoFormatter = ISO8601DateFormatter()
    private let reminderLeadTime: TimeInterval = 45 * 60

    private init() {}

    func registerNotificationCategories() {
        let open = UNNotificationAction(
            identifier: ProjectFlowNotificationAction.open,
            title: "Open",
            options: [.foreground]
        )
        let startFocus = UNNotificationAction(
            identifier: ProjectFlowNotificationAction.startFocus,
            title: "Start Focus",
            options: [.foreground]
        )
        let snoozeFocus = UNNotificationAction(
            identifier: ProjectFlowNotificationAction.snoozeFocus,
            title: "Snooze 1h",
            options: []
        )
        let blockFocus = UNNotificationAction(
            identifier: ProjectFlowNotificationAction.blockFocus,
            title: "Blocked",
            options: []
        )
        let completeFocus = UNNotificationAction(
            identifier: ProjectFlowNotificationAction.completeFocus,
            title: "Complete",
            options: []
        )

        let focusReminder = UNNotificationCategory(
            identifier: ProjectFlowNotificationCategory.focusReminder,
            actions: [completeFocus, snoozeFocus, blockFocus, open],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        let projectNotification = UNNotificationCategory(
            identifier: ProjectFlowNotificationCategory.projectNotification,
            actions: [startFocus, completeFocus, snoozeFocus, open],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )

        UNUserNotificationCenter.current().setNotificationCategories([focusReminder, projectNotification])
    }

    func sync(item: PinnedItem?, focusState: ProjectFlowFocusState?) {
        guard let item else {
            clearFocus()
            return
        }

        let snapshot = ProjectFlowAmbientFocusSnapshot(
            itemId: item.id,
            itemType: item.type,
            title: focusState?.title.isEmpty == false ? focusState?.title ?? item.title : item.title,
            projectId: item.projectId.isEmpty ? focusState?.projectId : item.projectId,
            tenantId: item.tenantId ?? focusState?.tenantId,
            priority: item.priority,
            isCompleted: item.isCompleted,
            status: focusState?.status ?? "active",
            startedAt: focusState?.startedAt,
            snoozedUntil: focusState?.snoozedUntil,
            blockedAt: focusState?.blockedAt,
            updatedAt: focusState?.updatedAt ?? isoFormatter.string(from: Date()),
            lastAction: focusState?.lastAction
        )

        ProjectFlowAmbientSnapshotStore.writeFocusSnapshot(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
        scheduleReminder(for: snapshot)
        syncLiveActivity(for: snapshot)
    }

    func clearFocus() {
        ProjectFlowAmbientSnapshotStore.clearFocusSnapshot()
        WidgetCenter.shared.reloadAllTimelines()
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [
            ProjectFlowAmbientConstants.focusReminderRequestIdentifier
        ])
        endLiveActivities()
    }

    private func scheduleReminder(for snapshot: ProjectFlowAmbientFocusSnapshot) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [
            ProjectFlowAmbientConstants.focusReminderRequestIdentifier
        ])

        guard !snapshot.isEmpty, snapshot.status != "blocked", snapshot.isCompleted != true else {
            return
        }

        let reminderDate = nextReminderDate(for: snapshot)
        let content = UNMutableNotificationContent()
        content.title = snapshot.status == "snoozed" ? "Focus is ready again" : "Keep ProjectFlow moving"
        content.body = snapshot.title
        content.sound = .default
        content.categoryIdentifier = ProjectFlowNotificationCategory.focusReminder
        content.threadIdentifier = "projectflow.focus.\(snapshot.itemId)"
        content.userInfo = snapshot.notificationUserInfo

        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: reminderDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(
            identifier: ProjectFlowAmbientConstants.focusReminderRequestIdentifier,
            content: content,
            trigger: trigger
        )

        center.add(request) { error in
            if let error {
                print("Failed to schedule focus reminder: \(error.localizedDescription)")
            }
        }
    }

    private func nextReminderDate(for snapshot: ProjectFlowAmbientFocusSnapshot) -> Date {
        if snapshot.status == "snoozed",
           let snoozedUntil = snapshot.snoozedUntil,
           let date = isoFormatter.date(from: snoozedUntil),
           date > Date() {
            return date
        }
        return Date().addingTimeInterval(reminderLeadTime)
    }

    private func syncLiveActivity(for snapshot: ProjectFlowAmbientFocusSnapshot) {
        guard !snapshot.isEmpty, snapshot.status != "blocked", snapshot.isCompleted != true else {
            endLiveActivities()
            return
        }

        if #available(iOS 16.2, *) {
            Task {
                await updateLiveActivity(for: snapshot)
            }
        }
    }

    @available(iOS 16.2, *)
    private func updateLiveActivity(for snapshot: ProjectFlowAmbientFocusSnapshot) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            return
        }

        let state = ProjectFlowFocusActivityAttributes.ContentState(
            title: snapshot.title,
            status: snapshot.status,
            itemId: snapshot.itemId,
            projectId: snapshot.projectId,
            updatedAt: snapshot.updatedAt
        )
        let content = ActivityContent(
            state: state,
            staleDate: Date().addingTimeInterval(60 * 60)
        )

        if let activity = Activity<ProjectFlowFocusActivityAttributes>.activities.first(where: { $0.attributes.itemId == snapshot.itemId }) {
            await activity.update(content)
            return
        }

        for activity in Activity<ProjectFlowFocusActivityAttributes>.activities where activity.attributes.itemId != snapshot.itemId {
            await activity.end(dismissalPolicy: .immediate)
        }

        do {
            _ = try Activity.request(
                attributes: ProjectFlowFocusActivityAttributes(
                    itemId: snapshot.itemId,
                    itemType: snapshot.itemType,
                    projectId: snapshot.projectId
                ),
                content: content,
                pushType: nil
            )
        } catch {
            print("Failed to start focus Live Activity: \(error.localizedDescription)")
        }
    }

    private func endLiveActivities() {
        if #available(iOS 16.2, *) {
            Task {
                for activity in Activity<ProjectFlowFocusActivityAttributes>.activities {
                    await activity.end(dismissalPolicy: .immediate)
                }
            }
        }
    }
}
#endif
