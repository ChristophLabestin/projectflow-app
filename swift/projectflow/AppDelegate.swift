import Foundation

enum NotificationDeepLinkStorage {
    static let userDefaultsKey = "projectflow.pendingNotificationDeepLink"
}

extension Notification.Name {
    static let projectflowNotificationTapped = Notification.Name("projectflowNotificationTapped")
}

#if os(iOS)
import UIKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        UNUserNotificationCenter.current().delegate = self
        Messaging.messaging().delegate = self
        FocusAmbientController.shared.registerNotificationCategories()
        requestPushAuthorization(application)

        if let remoteNotification = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
            persistNotificationPayload(remoteNotification)
        }

        return true
    }

    private func requestPushAuthorization(_ application: UIApplication) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            guard granted else { return }
            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        PushTokenManager.shared.updateToken(token)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if FocusNotificationActionHandler.shared.canHandle(response.actionIdentifier) {
            FocusNotificationActionHandler.shared.handle(response: response, completion: completionHandler)
            return
        }

        persistNotificationPayload(response.notification.request.content.userInfo)
        completionHandler()
    }

    private func persistNotificationPayload(_ userInfo: [AnyHashable: Any]) {
        let keys = [
            "notificationId",
            "tenantId",
            "projectId",
            "taskId",
            "issueId",
            "initiativeId",
            "flowId",
            "deepLink",
            "type"
        ]
        let payload = keys.reduce(into: [String: String]()) { result, key in
            if let value = userInfo[key] as? String, !value.isEmpty {
                result[key] = value
            }
        }

        guard !payload.isEmpty else { return }

        UserDefaults.standard.set(payload, forKey: NotificationDeepLinkStorage.userDefaultsKey)
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .projectflowNotificationTapped, object: nil)
        }
    }
}
#endif
