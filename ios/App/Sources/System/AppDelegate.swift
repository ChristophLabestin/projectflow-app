import UIKit
import UserNotifications
import FirebaseCore
import FirebaseMessaging
import PFData
import PFDesign
import PFModel

/// Configures Firebase, push (FCM → APNs, contract C4) and notification actions.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    static var backend: PFBackend {
        #if EMULATOR
        // Override per run (e.g. `SIMCTL_CHILD_PF_EMULATOR_AUTH_PORT=9731 xcrun simctl launch …`) so parallel
        // emulator instances started with `scripts/dev-e2e.sh` on other ports can be used.
        let env = ProcessInfo.processInfo.environment
        func port(_ key: String, _ fallback: Int) -> Int { env[key].flatMap(Int.init) ?? fallback }
        return .emulator(host: env["PF_EMULATOR_HOST"] ?? "127.0.0.1",
                         authPort: port("PF_EMULATOR_AUTH_PORT", 9631),
                         firestorePort: port("PF_EMULATOR_FIRESTORE_PORT", 8631),
                         functionsPort: port("PF_EMULATOR_FUNCTIONS_PORT", 5631),
                         storagePort: port("PF_EMULATOR_STORAGE_PORT", 9632))
        #else
        return .production
        #endif
    }

    /// Set by `ProjectFlowApp` so notification actions can write through the signed-in session.
    weak var model: AppModel?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // First, so MetricKit can deliver the last crash; does nothing unless the user opted in.
        CrashReporter.applyConsent()
        #if DEBUG
        CrashReporter.crashIfRequested()
        #endif
        PFFont.registerIfNeeded()
        PFFirebase.configure(Self.backend)
        AppIntentBridge.bootstrap()
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().setNotificationCategories(NotificationCategories.all)
        Messaging.messaging().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {}

    // MARK: MessagingDelegate

    nonisolated func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken else { return }
        Task { @MainActor in PushRegistrar.shared.didReceive(fcmToken: fcmToken) }
    }

    // MARK: UNUserNotificationCenterDelegate

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        let payload = NotificationPayload(userInfo: info)
        let action = response.actionIdentifier
        let text = (response as? UNTextInputNotificationResponse)?.userText
        await MainActor.run {
            NotificationActionHandler.handle(action: action, payload: payload, replyText: text)
        }
    }
}

/// Data keys sent by `onNotificationCreated` (contract C4).
nonisolated struct NotificationPayload: Sendable {
    let notificationId: String?
    let tenantId: String?
    let type: String?
    let projectId: String?
    let taskId: String?
    let initiativeId: String?
    let deepLink: String?

    init(userInfo: [AnyHashable: Any]) {
        func value(_ key: String) -> String? {
            (userInfo[key] as? String).flatMap { $0.isEmpty ? nil : $0 }
        }
        notificationId = value("notificationId")
        tenantId = value("tenantId")
        type = value("type")
        projectId = value("projectId")
        taskId = value("taskId")
        initiativeId = value("initiativeId")
        deepLink = value("deepLink")
    }

    var taskRef: TaskRef? {
        guard let tenantId, let projectId, let taskId else { return nil }
        return TaskRef(tenantId: tenantId, projectId: projectId, taskId: taskId)
    }
}

enum NotificationCategories {
    static let done = "PF_DONE"
    static let today = "PF_TODAY"
    static let tomorrow = "PF_TOMORROW"
    static let reply = "PF_REPLY"
    static let snoozeHour = "PF_SNOOZE_1H"
    static let resume = "PF_RESUME"

    static var all: Set<UNNotificationCategory> {
        let done = UNNotificationAction(identifier: Self.done, title: L10n.t("push.action.done"), options: [], icon: .init(systemImageName: "checkmark"))
        let today = UNNotificationAction(identifier: Self.today, title: L10n.t("push.action.today"), options: [], icon: .init(systemImageName: "sun.max"))
        let tomorrow = UNNotificationAction(identifier: Self.tomorrow, title: L10n.t("push.action.tomorrow"), options: [], icon: .init(systemImageName: "arrow.right"))
        let reply = UNTextInputNotificationAction(identifier: Self.reply, title: L10n.t("push.action.reply"), options: [],
                                                  icon: .init(systemImageName: "arrowshape.turn.up.left"),
                                                  textInputButtonTitle: L10n.t("push.action.send"), textInputPlaceholder: L10n.t("push.action.replyPlaceholder"))
        let snooze = UNNotificationAction(identifier: Self.snoozeHour, title: L10n.t("push.action.snoozeHour"), options: [], icon: .init(systemImageName: "clock"))
        let resume = UNNotificationAction(identifier: Self.resume, title: L10n.t("push.action.resume"), options: [.foreground], icon: .init(systemImageName: "play"))
        func category(_ id: String, _ actions: [UNNotificationAction]) -> UNNotificationCategory {
            UNNotificationCategory(identifier: id, actions: actions, intentIdentifiers: [], options: [])
        }
        return [
            category("PF_ASSIGNMENT", [done, today]),
            category("PF_MENTION", [reply]),
            category("PF_COMMENT", [reply]),
            category("PF_DUE", [done, tomorrow]),
            category("PF_REMINDER", [done, snooze]),
            category("PF_BRIEFING", []),
            category("PF_DAYCLOSE", []),
            category("PF_GENERIC", []),
            category("PF_FOCUS", [resume, done]),
            category("PROJECTFLOW_NOTIFICATION", []),
        ]
    }
}

/// Executes notification actions through the signed-in session; plain taps open the deep link.
@MainActor
enum NotificationActionHandler {
    static weak var model: AppModel?

    static func handle(action: String, payload: NotificationPayload, replyText: String?) {
        guard let model else { return }
        if let tenantId = payload.tenantId, let session = model.session, tenantId != session.activeWorkspaceId,
           session.workspaces.contains(where: { $0.id == tenantId }), action == UNNotificationDefaultActionIdentifier {
            model.switchWorkspace(to: tenantId)
        }
        let actions = payload.tenantId.flatMap { tenant in
            model.uid.map { WorkActions(tenantId: tenant, uid: $0, actorName: model.profile?.displayName ?? "") }
        }
        Task {
            switch action {
            case NotificationCategories.done:
                if let ref = payload.taskRef { await model.perform { try await actions?.setCompleted(ref, true) } }
                else if model.profile?.focus != nil { await FocusController(model: model).complete() }
            case NotificationCategories.today:
                if let ref = payload.taskRef { await model.perform { try await actions?.setScheduledDate(ref, Formatting.day(offset: 0)) } }
            case NotificationCategories.tomorrow:
                if let ref = payload.taskRef { await model.perform { try await actions?.setDueDate(ref, Formatting.day(offset: 1)) } }
            case NotificationCategories.reply:
                if let text = replyText, !text.isEmpty, let projectId = payload.projectId, let target = payload.taskId ?? payload.initiativeId {
                    await model.perform {
                        try await actions?.addComment(projectId: projectId, targetId: target,
                                                      targetType: payload.taskId != nil ? "task" : "initiative",
                                                      content: text, mentionedUserIds: [], photoURL: model.profile?.photoURL)
                    }
                }
            case NotificationCategories.snoozeHour:
                if let ref = payload.taskRef, let task = model.workspace?.task(ref.taskId) {
                    let reminder = ProjectReminder(title: task.title, remindAt: FlexDate(instant: .now.addingTimeInterval(3600)), createdBy: model.uid ?? "")
                    await model.perform { try await actions?.setReminders(ref, task.reminders + [reminder]) }
                }
            case NotificationCategories.resume:
                await FocusController(model: model).resume()
                model.router.isFocusRoomOpen = true
            case UNNotificationDefaultActionIdentifier:
                if let link = payload.deepLink, let url = URL(string: "https://app.getprojectflow.com\(link)") {
                    model.router.handle(url: url, activeTenant: model.workspace?.tenantId)
                }
            default:
                break
            }
            if let id = payload.notificationId, let tenant = payload.tenantId, let uid = model.uid {
                let item = InboxItem(id: id, tenantId: tenant, fields: .init(["userId": uid]))
                try? await WorkActions(tenantId: tenant, uid: uid, actorName: "").markRead(item)
            }
        }
    }
}

/// Requests notification permission at a meaningful moment (concept §7) and registers the FCM token.
@MainActor
final class PushRegistrar {
    static let shared = PushRegistrar()
    private var token: String?
    weak var model: AppModel?

    var deviceId: String { UIDevice.current.identifierForVendor?.uuidString ?? "unknown-device" }

    /// Call after the first meaningful moment (first assignment in the inbox, first focus pause).
    func requestPermissionIfNeeded() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined:
            let granted = (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
            if granted { UIApplication.shared.registerForRemoteNotifications() }
        case .authorized, .provisional, .ephemeral:
            UIApplication.shared.registerForRemoteNotifications()
        default:
            break
        }
    }

    func registerIfAuthorized() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func didReceive(fcmToken: String) {
        token = fcmToken
        upload()
    }

    func upload() {
        guard let token, let actions = model?.profileActions else { return }
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        Task { try? await actions.registerFCMToken(token, deviceId: deviceId, appVersion: version) }
    }

    func signOut() async {
        guard let token, let actions = model?.profileActions else { return }
        try? await actions.unregisterFCMToken(token, deviceId: deviceId)
    }
}
