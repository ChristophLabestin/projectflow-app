import Foundation
import FirebaseAuth
import FirebaseCore

@MainActor
final class SessionStore: ObservableObject {
    @Published var user: User?
    @Published var isLoading = true
    @Published var authError: String?
    @Published var authMessage: String?
    @Published var isBusy = false

    private var handle: AuthStateDidChangeListenerHandle?
    private let isPreview = ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1"

    init() {
        guard !isPreview else {
            isLoading = false
            return
        }

        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        handle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.user = user
            self?.isLoading = false
            if user != nil {
                PushTokenManager.shared.syncPendingToken()
            }
        }
    }

    deinit {
        if let handle {
            Auth.auth().removeStateDidChangeListener(handle)
        }
    }

    func signIn(email: String, password: String) {
        isBusy = true
        authError = nil
        authMessage = nil
        Auth.auth().signIn(withEmail: email, password: password) { [weak self] _, error in
            self?.isBusy = false
            if let error {
                self?.authError = Self.mapAuthError(error)
            }
        }
    }

    func signUp(email: String, password: String) {
        isBusy = true
        authError = nil
        authMessage = nil
        Auth.auth().createUser(withEmail: email, password: password) { [weak self] _, error in
            self?.isBusy = false
            if let error {
                self?.authError = Self.mapAuthError(error)
            }
        }
    }

    func signOut() {
        authError = nil
        authMessage = nil
        do {
            try Auth.auth().signOut()
        } catch {
            authError = Self.mapAuthError(error)
        }
    }

    func sendPasswordReset(email: String) {
        isBusy = true
        authError = nil
        authMessage = nil
        Auth.auth().sendPasswordReset(withEmail: email) { [weak self] error in
            self?.isBusy = false
            if let error {
                self?.authError = Self.mapAuthError(error)
            } else {
                self?.authMessage = "Password reset email sent."
            }
        }
    }

    func clearMessages() {
        authError = nil
        authMessage = nil
    }

    private static func mapAuthError(_ error: Error) -> String {
        let nsError = error as NSError
        guard let code = AuthErrorCode.Code(rawValue: nsError.code) else {
            return nsError.localizedDescription
        }

        switch code {
        case .invalidEmail:
            return "Enter a valid email address."
        case .wrongPassword, .invalidCredential:
            return "Incorrect email or password."
        case .userNotFound:
            return "No account found for that email."
        case .emailAlreadyInUse:
            return "An account already exists for this email."
        case .weakPassword:
            return "Password must be at least 6 characters."
        case .networkError:
            return "Network error. Check your connection."
        default:
            return nsError.localizedDescription
        }
    }
}
