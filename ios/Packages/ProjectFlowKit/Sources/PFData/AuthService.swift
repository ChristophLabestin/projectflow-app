import Foundation
import Observation
import FirebaseAuth
import FirebaseFunctions

/// Firebase Auth wrapper: email/password, TOTP MFA, Apple, generic OAuth credentials and passkey
/// custom tokens. UI-specific flows (ASAuthorization, web auth sessions) live in the app target and
/// hand their credentials to this service.
@Observable
public final class AuthService {
    public enum Phase: Equatable {
        case launching
        case signedOut
        case needsSecondFactor(hint: String)
        case signedIn(uid: String)
    }

    public private(set) var phase: Phase = .launching
    public private(set) var email: String?
    public private(set) var displayName: String?
    public private(set) var providerIDs: [String] = []
    private var handle: AuthStateDidChangeListenerHandle?
    private var resolver: MultiFactorResolver?

    public init() {}

    public func start() {
        guard handle == nil else { return }
        handle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            MainActor.assumeIsolated { self?.apply(user) }
        }
    }

    private func apply(_ user: User?) {
        if let user {
            email = user.email
            displayName = user.displayName
            providerIDs = user.providerData.map(\.providerID)
            phase = .signedIn(uid: user.uid)
        } else {
            email = nil
            displayName = nil
            providerIDs = []
            if case .needsSecondFactor = phase { return }
            phase = .signedOut
        }
    }

    public var uid: String? { if case .signedIn(let uid) = phase { uid } else { nil } }

    // MARK: Email + password

    public func signIn(email: String, password: String) async throws {
        do {
            _ = try await Auth.auth().signIn(withEmail: email.trimmingCharacters(in: .whitespaces), password: password)
        } catch let error as NSError {
            try handleSecondFactor(error)
        }
    }

    public func signUp(name: String, email: String, password: String) async throws {
        let result = try await Auth.auth().createUser(withEmail: email.trimmingCharacters(in: .whitespaces), password: password)
        let change = result.user.createProfileChangeRequest()
        change.displayName = name.trimmingCharacters(in: .whitespaces)
        try await change.commitChanges()
        try? await result.user.sendEmailVerification()
        apply(Auth.auth().currentUser)
    }

    public func sendPasswordReset(email: String) async throws {
        try await Auth.auth().sendPasswordReset(withEmail: email.trimmingCharacters(in: .whitespaces))
    }

    // MARK: Credentials from the app (Apple, Google, GitHub)

    public func signIn(with credential: AuthCredential) async throws {
        do {
            _ = try await Auth.auth().signIn(with: credential)
        } catch let error as NSError {
            try handleSecondFactor(error)
        }
    }

    public func link(_ credential: AuthCredential) async throws {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        _ = try await user.link(with: credential)
        apply(Auth.auth().currentUser)
    }

    /// Re-reads providers and display data after unlinking a provider or setting a password.
    public func refreshProviders() {
        apply(Auth.auth().currentUser)
    }

    /// Passkey sign-in returns a Firebase custom token from `verifyPasskeyAuthentication`.
    public func signIn(customToken: String) async throws {
        _ = try await Auth.auth().signIn(withCustomToken: customToken)
    }

    // MARK: TOTP second factor

    private func handleSecondFactor(_ error: NSError) throws {
        guard error.code == AuthErrorCode.secondFactorRequired.rawValue,
              let resolver = error.userInfo[AuthErrorUserInfoMultiFactorResolverKey] as? MultiFactorResolver else {
            throw error
        }
        self.resolver = resolver
        phase = .needsSecondFactor(hint: resolver.hints.first?.displayName ?? "Authenticator")
    }

    public func resolveSecondFactor(code: String) async throws {
        guard let resolver, let hint = resolver.hints.first(where: { $0.factorID == TOTPMultiFactorID }) ?? resolver.hints.first else {
            throw PFDataError.notSignedIn
        }
        let assertion = TOTPMultiFactorGenerator.assertionForSignIn(withEnrollmentID: hint.uid, oneTimePassword: code)
        _ = try await resolver.resolveSignIn(with: assertion)
        self.resolver = nil
        apply(Auth.auth().currentUser)
    }

    public func cancelSecondFactor() {
        resolver = nil
        phase = .signedOut
    }

    // MARK: Session

    public func signOut() {
        try? Auth.auth().signOut()
        phase = .signedOut
    }

    public func idToken() async throws -> String {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        return try await user.getIDToken()
    }

    /// Deletes the account via the backend callable (handles workspace ownership checks and data).
    /// Apple tokens are revoked first when an authorization code is supplied (App Store requirement).
    public func deleteAccount(appleAuthorizationCode: String?) async throws {
        if let appleAuthorizationCode {
            try? await Auth.auth().revokeToken(withAuthorizationCode: appleAuthorizationCode)
        }
        _ = try await PFFirebase.functions.httpsCallable("deleteMyAccount").call([:])
        signOut()
    }
}
