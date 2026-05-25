import Foundation
import FirebaseAuth
import FirebaseFirestore

final class PushTokenManager {
    static let shared = PushTokenManager()

    private let tokenKey = "projectflow.fcmToken"
    private let tokenSyncedAtKey = "projectflow.fcmTokenSyncedAt"
    private let db = Firestore.firestore()

    private init() {}

    var currentToken: String? {
        UserDefaults.standard.string(forKey: tokenKey)
    }

    var lastSyncDate: Date? {
        UserDefaults.standard.object(forKey: tokenSyncedAtKey) as? Date
    }

    func updateToken(_ token: String) {
        UserDefaults.standard.set(token, forKey: tokenKey)
        syncPendingToken()
    }

    func syncPendingToken() {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        guard let token = currentToken else { return }

        db.collection("users").document(userId).setData([
            "fcmTokens": FieldValue.arrayUnion([token]),
            "fcmUpdatedAt": FieldValue.serverTimestamp()
        ], merge: true) { error in
            if let error {
                print("Failed to sync FCM token: \(error.localizedDescription)")
                return
            }
            UserDefaults.standard.set(Date(), forKey: self.tokenSyncedAtKey)
        }
    }
}
