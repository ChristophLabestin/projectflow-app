import Foundation
import FirebaseFunctions

#if os(iOS)
import AuthenticationServices
import UIKit
#endif

struct PasskeyAuthenticationOptions: Decodable {
    struct AllowCredential: Decodable {
        let id: String
        let type: String
        let transports: [String]?
    }

    let challenge: String
    let rpId: String?
    let allowCredentials: [AllowCredential]?
    let userVerification: String?
}

struct PasskeyVerificationResult: Decodable {
    let success: Bool
    let token: String?
}

enum PasskeyError: LocalizedError {
    case invalidChallenge
    case missingCredential
    case verificationFailed
    case cancelled
    case notSupported

    var errorDescription: String? {
        switch self {
        case .invalidChallenge:
            return "Passkey challenge is invalid."
        case .missingCredential:
            return "No passkey credential returned."
        case .verificationFailed:
            return "Passkey verification failed."
        case .cancelled:
            return "Passkey request was cancelled."
        case .notSupported:
            return "Passkeys are not supported on this device yet."
        }
    }
}

final class PasskeyService {
    static let shared = PasskeyService()

    private let functions = Functions.functions(region: "europe-west3")

    private init() {}

    func signIn(email: String?) async throws -> String {
        #if os(iOS)
        let options: PasskeyAuthenticationOptions = try await callFunction(
            name: "generatePasskeyAuthenticationOptions",
            data: email.flatMap { $0.isEmpty ? nil : $0 }.map { ["email": $0] } ?? [:]
        )

        let assertion = try await requestAssertion(options: options)
        let responsePayload = buildAuthenticationResponse(assertion: assertion)

        let result: PasskeyVerificationResult = try await callFunction(
            name: "verifyPasskeyAuthentication",
            data: [
                "response": responsePayload,
                "email": email ?? ""
            ]
        )

        guard result.success, let token = result.token else {
            throw PasskeyError.verificationFailed
        }

        return token
        #else
        throw PasskeyError.notSupported
        #endif
    }

    private func callFunction<T: Decodable>(name: String, data: [String: Any]) async throws -> T {
        try await withCheckedThrowingContinuation { continuation in
            functions.httpsCallable(name).call(data) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let payload = result?.data else {
                    continuation.resume(throwing: PasskeyError.verificationFailed)
                    return
                }

                do {
                    let json = try JSONSerialization.data(withJSONObject: payload)
                    let decoded = try JSONDecoder().decode(T.self, from: json)
                    continuation.resume(returning: decoded)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    #if os(iOS)
    private var assertionDelegate: PasskeyAuthorizationDelegate?

    private func requestAssertion(options: PasskeyAuthenticationOptions) async throws -> ASAuthorizationPlatformPublicKeyCredentialAssertion {
        guard let challenge = Data(base64URLEncoded: options.challenge) else {
            throw PasskeyError.invalidChallenge
        }

        let rpId = options.rpId ?? "app.getprojectflow.com"
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
        let request = provider.createCredentialAssertionRequest(challenge: challenge)

        if let allow = options.allowCredentials {
            var descriptors: [ASAuthorizationPublicKeyCredentialDescriptor] = []
            for credential in allow {
                guard let data = Data(base64URLEncoded: credential.id) else { continue }
                descriptors.append(ASAuthorizationPublicKeyCredentialDescriptor(credentialID: data))
            }
            request.allowedCredentials = descriptors
        }

        return try await withCheckedThrowingContinuation { continuation in
            let controller = ASAuthorizationController(authorizationRequests: [request])
            let delegate = PasskeyAuthorizationDelegate(continuation: continuation) { [weak self] in
                self?.assertionDelegate = nil
            }
            assertionDelegate = delegate
            controller.delegate = delegate
            controller.presentationContextProvider = delegate
            controller.performRequests()
        }
    }

    private func buildAuthenticationResponse(assertion: ASAuthorizationPlatformPublicKeyCredentialAssertion) -> [String: Any] {
        let credentialId = assertion.credentialID.base64URLEncodedString()
        var response: [String: Any] = [
            "authenticatorData": assertion.rawAuthenticatorData.base64URLEncodedString(),
            "clientDataJSON": assertion.rawClientDataJSON.base64URLEncodedString(),
            "signature": assertion.signature.base64URLEncodedString()
        ]

        if !assertion.userID.isEmpty {
            response["userHandle"] = assertion.userID.base64URLEncodedString()
        }

        return [
            "id": credentialId,
            "rawId": credentialId,
            "type": "public-key",
            "response": response
        ]
    }
    #endif
}

#if os(iOS)
private final class PasskeyAuthorizationDelegate: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private let continuation: CheckedContinuation<ASAuthorizationPlatformPublicKeyCredentialAssertion, Error>
    private let onFinish: () -> Void

    init(
        continuation: CheckedContinuation<ASAuthorizationPlatformPublicKeyCredentialAssertion, Error>,
        onFinish: @escaping () -> Void
    ) {
        self.continuation = continuation
        self.onFinish = onFinish
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        if let assertion = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion {
            continuation.resume(returning: assertion)
        } else {
            continuation.resume(throwing: PasskeyError.missingCredential)
        }
        onFinish()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if (error as NSError).code == ASAuthorizationError.canceled.rawValue {
            continuation.resume(throwing: PasskeyError.cancelled)
        } else {
            continuation.resume(throwing: error)
        }
        onFinish()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first
        return scene?.windows.first { $0.isKeyWindow } ?? UIWindow()
    }
}
#endif
