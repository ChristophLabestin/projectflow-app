import Foundation
import FirebaseAuth
import FirebaseFirestore

final class PushTokenManager {
    static let shared = PushTokenManager()

    private let tokenKey = "projectflow.fcmToken"
    private let db = Firestore.firestore()

    private init() {}

    func updateToken(_ token: String) {
        UserDefaults.standard.set(token, forKey: tokenKey)
        syncPendingToken()
    }

    func syncPendingToken() {
        guard let userId = Auth.auth().currentUser?.uid else { return }
        guard let token = UserDefaults.standard.string(forKey: tokenKey) else { return }

        db.collection("users").document(userId).setData([
            "fcmTokens": FieldValue.arrayUnion([token]),
            "fcmUpdatedAt": FieldValue.serverTimestamp()
        ], merge: true)
    }
}
