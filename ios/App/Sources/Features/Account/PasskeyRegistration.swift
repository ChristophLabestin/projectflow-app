import AuthenticationServices
import UIKit
import PFData

/// Registers a passkey for the signed-in user against the existing callables
/// (`generatePasskeyRegistrationOptions` → system sheet → `verifyPasskeyRegistration`).
/// RP ID `app.getprojectflow.com`, origin `https://app.getprojectflow.com` (contract C6).
@MainActor
final class PasskeyRegistrationCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var continuation: CheckedContinuation<ASAuthorization, Error>?

    func register() async throws {
        guard let options = try await PFCallables.call("generatePasskeyRegistrationOptions", ["origin": PasskeyCoordinator.origin]) as? [String: Any],
              let challengeString = options["challenge"] as? String, let challenge = Data(base64URL: challengeString),
              let user = options["user"] as? [String: Any], let userIdString = user["id"] as? String,
              let userId = Data(base64URL: userIdString) else {
            throw PFDataError.message(L10n.t("auth.error.passkey"))
        }
        let rp = options["rp"] as? [String: Any]
        let rpId = rp?["id"] as? String ?? SharedConstants.webHost
        let name = user["name"] as? String ?? user["displayName"] as? String ?? "ProjectFlow"

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
        let request = provider.createCredentialRegistrationRequest(challenge: challenge, name: name, userID: userId)
        request.displayName = user["displayName"] as? String
        if let exclude = options["excludeCredentials"] as? [[String: Any]] {
            request.excludedCredentials = exclude.compactMap { ($0["id"] as? String).flatMap(Data.init(base64URL:)) }
                .map(ASAuthorizationPlatformPublicKeyCredentialDescriptor.init(credentialID:))
        }

        let authorization = try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
        guard let registration = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration,
              let attestation = registration.rawAttestationObject else {
            throw PFDataError.message(L10n.t("auth.error.passkey"))
        }
        let credentialId = registration.credentialID.base64URLEncoded
        let response: [String: Any] = [
            "id": credentialId, "rawId": credentialId, "type": "public-key",
            "authenticatorAttachment": "platform", "clientExtensionResults": [String: Any](),
            "response": [
                "clientDataJSON": registration.rawClientDataJSON.base64URLEncoded,
                "attestationObject": attestation.base64URLEncoded,
                "transports": ["internal", "hybrid"],
            ],
        ]
        _ = try await PFCallables.call("verifyPasskeyRegistration", [
            "response": response, "origin": PasskeyCoordinator.origin,
            "deviceName": UIDevice.current.name, "navigatorDetails": ["platform": "iOS"],
        ])
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
