import AuthenticationServices
import CryptoKit
import Foundation
import UIKit
import FirebaseAuth
import FirebaseCore
import GoogleSignIn
import PFData

/// Sign in with Apple → Firebase `apple.com` credential (contract C6). Keeps the last authorization
/// code so account deletion can revoke the Apple token.
@MainActor
final class AppleSignInCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var continuation: CheckedContinuation<ASAuthorization, Error>?
    private var nonce = ""
    static var lastAuthorizationCode: String?

    func signIn(auth: AuthService) async throws {
        let credential = try await requestCredential()
        try await auth.signIn(with: credential)
    }

    func link(auth: AuthService) async throws {
        let credential = try await requestCredential()
        try await auth.link(credential)
    }

    /// Fresh authorization just to obtain a code for token revocation (account deletion).
    func authorizationCode() async throws -> String? {
        _ = try await requestCredential()
        return Self.lastAuthorizationCode
    }

    private func requestCredential() async throws -> AuthCredential {
        nonce = Self.randomNonce()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = Self.sha256(nonce)
        let authorization = try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
        guard let apple = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = apple.identityToken, let token = String(data: tokenData, encoding: .utf8) else {
            throw PFDataError.message(L10n.t("auth.error.apple"))
        }
        Self.lastAuthorizationCode = apple.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        return OAuthProvider.appleCredential(withIDToken: token, rawNonce: nonce, fullName: apple.fullName)
    }

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        MainActor.assumeIsolated {
            continuation?.resume(returning: authorization)
            continuation = nil
        }
    }

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        MainActor.assumeIsolated {
            continuation?.resume(throwing: error)
            continuation = nil
        }
    }

    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        MainActor.assumeIsolated { UIApplication.shared.keyWindowScene?.keyWindow ?? ASPresentationAnchor() }
    }

    static func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String((0..<length).map { _ in charset[Int.random(in: 0..<charset.count)] })
    }

    static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

/// Passkey sign-in against the existing callables (`generatePasskeyAuthenticationOptions`,
/// `verifyPasskeyAuthentication`). RP ID `app.getprojectflow.com`; the backend accepts the native
/// origin `https://app.getprojectflow.com` (contract C6) and returns a Firebase custom token.
@MainActor
final class PasskeyCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    static let origin = "https://app.getprojectflow.com"
    private var continuation: CheckedContinuation<ASAuthorization, Error>?

    func signIn(auth: AuthService, email: String?) async throws {
        var payload: [String: Any] = ["origin": Self.origin]
        if let email { payload["email"] = email }
        guard let options = try await PFCallables.call("generatePasskeyAuthenticationOptions", payload) as? [String: Any],
              let challengeString = options["challenge"] as? String, let challenge = Data(base64URL: challengeString) else {
            throw PFDataError.message(L10n.t("auth.error.passkey"))
        }
        let rpId = options["rpId"] as? String ?? SharedConstants.webHost
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
        let request = provider.createCredentialAssertionRequest(challenge: challenge)
        if let allowed = options["allowCredentials"] as? [[String: Any]] {
            request.allowedCredentials = allowed.compactMap { ($0["id"] as? String).flatMap(Data.init(base64URL:)) }
                .map(ASAuthorizationPlatformPublicKeyCredentialDescriptor.init(credentialID:))
        }
        let authorization = try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
        guard let assertion = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion else {
            throw PFDataError.message(L10n.t("auth.error.passkey"))
        }
        let credentialId = assertion.credentialID.base64URLEncoded
        let response: [String: Any] = [
            "id": credentialId, "rawId": credentialId, "type": "public-key",
            "authenticatorAttachment": "platform", "clientExtensionResults": [String: Any](),
            "response": [
                "clientDataJSON": assertion.rawClientDataJSON.base64URLEncoded,
                "authenticatorData": assertion.rawAuthenticatorData.base64URLEncoded,
                "signature": assertion.signature.base64URLEncoded,
                "userHandle": assertion.userID.base64URLEncoded,
            ],
        ]
        guard let result = try await PFCallables.call("verifyPasskeyAuthentication", ["response": response, "origin": Self.origin]) as? [String: Any],
              let token = result["token"] as? String else {
            throw PFDataError.message(L10n.t("auth.error.passkey"))
        }
        try await auth.signIn(customToken: token)
    }

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        MainActor.assumeIsolated {
            continuation?.resume(returning: authorization)
            continuation = nil
        }
    }

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        MainActor.assumeIsolated {
            continuation?.resume(throwing: error)
            continuation = nil
        }
    }

    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        MainActor.assumeIsolated { UIApplication.shared.keyWindowScene?.keyWindow ?? ASPresentationAnchor() }
    }
}

enum AuthErrorText {
    static func message(for error: Error) -> String {
        let ns = error as NSError
        if ns.domain == AuthErrorDomain, let code = AuthErrorCode(rawValue: ns.code) {
            switch code {
            case .wrongPassword, .invalidCredential, .userNotFound, .invalidEmail: return L10n.t("auth.error.credentials")
            case .emailAlreadyInUse: return L10n.t("auth.error.emailInUse")
            case .weakPassword: return L10n.t("auth.error.weakPassword")
            case .networkError: return L10n.t("auth.error.network")
            case .tooManyRequests: return L10n.t("auth.error.tooMany")
            case .invalidVerificationCode: return L10n.t("auth.error.code")
            case .accountExistsWithDifferentCredential, .credentialAlreadyInUse: return L10n.t("auth.error.otherProvider")
            default: break
            }
        }
        return (error as? LocalizedError)?.errorDescription ?? L10n.t("common.error")
    }
}

extension UIApplication {
    var keyWindowScene: UIWindowScene? {
        connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive } ?? connectedScenes.compactMap { $0 as? UIWindowScene }.first
    }
}

extension Data {
    init?(base64URL string: String) {
        var base64 = string.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 { base64 += "=" }
        self.init(base64Encoded: base64)
    }

    var base64URLEncoded: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}

/// Google (GoogleSignIn SDK → `google.com` credential) and GitHub (Firebase OAuth web flow), same providers as the web.
@MainActor
enum SocialSignIn {
    /// Google needs the iOS OAuth client of the Firebase config (missing in the emulator setup).
    static var isGoogleAvailable: Bool { FirebaseApp.app()?.options.clientID != nil }

    static func google(auth: AuthService) async throws {
        guard let clientID = FirebaseApp.app()?.options.clientID else { throw PFDataError.message("Google Sign-In is not configured") }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        guard let presenter = UIApplication.shared.connectedScenes
            .compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController }).first else { return }
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: topmost(presenter))
        guard let idToken = result.user.idToken?.tokenString else { throw PFDataError.message("Google returned no ID token") }
        let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: result.user.accessToken.tokenString)
        try await auth.signIn(with: credential)
    }

    static func github(auth: AuthService) async throws {
        let provider = OAuthProvider(providerID: "github.com")
        provider.scopes = ["user:email"]
        let credential = try await provider.credential(with: nil)
        try await auth.signIn(with: credential)
    }

    /// True when the user closed the Google or GitHub sheet themselves.
    static func isCancellation(_ error: Error) -> Bool {
        let nsError = error as NSError
        if nsError.domain == kGIDSignInErrorDomain, nsError.code == GIDSignInError.canceled.rawValue { return true }
        return nsError.domain == AuthErrorDomain && nsError.code == AuthErrorCode.webContextCancelled.rawValue
    }

    private static func topmost(_ controller: UIViewController) -> UIViewController {
        var top = controller
        while let presented = top.presentedViewController { top = presented }
        return top
    }
}
