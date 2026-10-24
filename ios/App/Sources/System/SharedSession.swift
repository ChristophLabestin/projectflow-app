import Foundation
import FirebaseAuth
import FirebaseCore
import PFData

/// Publishes the minimum a thin extension needs to write on the user's behalf (share extension): the Firebase
/// refresh token, API key, project id, active workspace and uid, in the shared keychain access group.
/// Written on sign-in and when the workspace changes, removed on sign-out.
@MainActor
enum SharedSession {
    static func update(model: AppModel) {
        guard let uid = model.uid, let tenantId = model.session?.activeWorkspaceId,
              let user = Auth.auth().currentUser, let options = FirebaseApp.app()?.options,
              let apiKey = options.apiKey, let projectId = options.projectID else { return }
        let refreshToken = user.refreshToken ?? ""
        guard !refreshToken.isEmpty else { return }
        var credentials = SharedSessionCredentials(refreshToken: refreshToken, apiKey: apiKey, projectId: projectId,
                                                   tenantId: tenantId, uid: uid)
        if case let .emulator(host, authPort, firestorePort, functionsPort, _) = PFFirebase.backend {
            credentials.emulatorHost = host
            credentials.authPort = authPort
            credentials.firestorePort = firestorePort
            credentials.functionsPort = functionsPort
        }
        SharedSessionStore.save(credentials)
    }

    static func clear() {
        SharedSessionStore.clear()
    }
}
