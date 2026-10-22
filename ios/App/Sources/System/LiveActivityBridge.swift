import ActivityKit
import Foundation
import UIKit
import UserNotifications
import PFData
import PFModel

/// Starts, updates and ends the focus Live Activity and reports its push tokens (contract C5) so the
/// backend can mirror focus changes made on the web.
@MainActor
final class LiveActivityBridge {
    static let shared = LiveActivityBridge()
    private var tokenTasks: [String: Task<Void, Never>] = [:]
    private var startTokenTask: Task<Void, Never>?

    var deviceId: String { UIDevice.current.identifierForVendor?.uuidString ?? "unknown-device" }

    /// Registers the push-to-start token once per launch.
    func observeStartToken(model: AppModel) {
        guard startTokenTask == nil else { return }
        startTokenTask = Task { [weak self] in
            for await data in Activity<FocusActivityAttributes>.pushToStartTokenUpdates {
                guard let self, let actions = model.profileActions else { continue }
                try? await actions.setLiveActivityStartToken(data.hexString, deviceId: self.deviceId)
            }
        }
    }

    /// Ends every focus activity (sign-out: nothing of the account may stay on the lock screen).
    func endAll() {
        tokenTasks.values.forEach { $0.cancel() }
        tokenTasks.removeAll()
        Task {
            for activity in Activity<FocusActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }

    func sync(focus: FocusState?, model: AppModel) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let state = focus.map { contentState(for: $0, model: model) }
        let tenantId = focus?.tenantId ?? model.workspace?.tenantId ?? ""
        Task {
            let activities = Activity<FocusActivityAttributes>.activities
            guard let focus, let state else {
                for activity in activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                    try? await model.profileActions?.removeLiveActivity(id: activity.id)
                }
                return
            }
            var kept = false
            for activity in activities {
                if activity.attributes.itemId == focus.itemId && !kept {
                    kept = true
                    await activity.update(ActivityContent(state: state, staleDate: nil))
                } else {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
            guard !kept else { return }
            let attributes = FocusActivityAttributes(itemId: focus.itemId, itemType: focus.itemType.rawValue,
                                                     tenantId: tenantId, projectId: focus.projectId)
            if let activity = try? Activity.request(attributes: attributes, content: ActivityContent(state: state, staleDate: nil), pushType: .token) {
                self.observeToken(activity, focus: focus, model: model)
            }
        }
    }

    private func observeToken(_ activity: Activity<FocusActivityAttributes>, focus: FocusState, model: AppModel) {
        tokenTasks[activity.id]?.cancel()
        tokenTasks[activity.id] = Task { [deviceId] in
            for await data in activity.pushTokenUpdates {
                try? await model.profileActions?.registerLiveActivity(id: activity.id, pushToken: data.hexString, deviceId: deviceId,
                                                                      itemId: focus.itemId, itemType: focus.itemType.rawValue)
            }
        }
    }

    private func contentState(for focus: FocusState, model: AppModel) -> FocusActivityAttributes.ContentState {
        let task = model.workspace?.task(focus.itemId)
        return FocusActivityAttributes.ContentState(
            title: focus.title,
            projectName: model.workspace?.project(focus.projectId)?.title,
            nextStep: task?.nextStep,
            status: focus.status.rawValue,
            startedAt: (focus.startedAt?.instant ?? .now).timeIntervalSince1970,
            snoozedUntil: focus.snoozedUntil?.instant.timeIntervalSince1970
        )
    }
}

/// Device-initiated local notifications (focus pause). Everything else is sent by the server.
enum LocalReminders {
    static let focusResumeId = "pf.focus.resume"

    static func scheduleFocusResume(title: String, at date: Date) {
        let content = UNMutableNotificationContent()
        content.title = L10n.t("focus.resumeTitle")
        content.body = title
        content.sound = .default
        content.categoryIdentifier = "PF_FOCUS"
        content.userInfo = ["deepLink": "/focus"]
        let interval = max(date.timeIntervalSinceNow, 5)
        let request = UNNotificationRequest(identifier: focusResumeId, content: content,
                                            trigger: UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false))
        UNUserNotificationCenter.current().add(request)
    }

    static func cancelFocusResume() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [focusResumeId])
    }
}

extension Data {
    var hexString: String { map { String(format: "%02x", $0) }.joined() }
}
