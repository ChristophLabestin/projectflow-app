import Foundation
import FirebaseAuth
import FirebaseFirestore
import PFModel

/// Who may see a profile field (web `PrivacyScope`).
public enum PrivacyScope: String, CaseIterable, Sendable, Hashable {
    case `public`, members, guests, `private`
}

/// Editable profile (web `PrivacySettings` keys: email, bio, skills, address, stats).
public struct ProfileDraft: Equatable, Sendable {
    public var displayName = ""
    public var title = ""
    public var bio = ""
    public var address = ""
    public var skills: [String] = []
    public var photoURL = ""
    public var privacy: [String: PrivacyScope] = ProfileDraft.defaultPrivacy

    public static let privacyKeys = ["email", "bio", "skills", "address", "stats"]
    public static let defaultPrivacy: [String: PrivacyScope] = [
        "email": .members, "bio": .public, "skills": .public, "address": .members, "stats": .members,
    ]

    public init() {}

    public init(uid: String) async {
        let data = (try? await PFPath.user(uid).getDocument())?.data() ?? [:]
        displayName = (data["displayName"] as? String) ?? Auth.auth().currentUser?.displayName ?? ""
        title = (data["title"] as? String) ?? ""
        bio = (data["bio"] as? String) ?? ""
        address = (data["address"] as? String) ?? ""
        skills = (data["skills"] as? [String]) ?? []
        photoURL = (data["photoURL"] as? String) ?? Auth.auth().currentUser?.photoURL?.absoluteString ?? ""
        let stored = (data["privacySettings"] as? [String: Any]) ?? [:]
        for key in Self.privacyKeys {
            if let raw = stored[key] as? String, let scope = PrivacyScope(rawValue: raw) { privacy[key] = scope }
        }
    }
}

extension ProfileActions {
    /// Web `updateUserProfile`: Auth profile + `users/{uid}`; the display fields are copied to the
    /// membership docs of the given workspaces (the app reads people from `members`).
    public func saveProfile(_ draft: ProfileDraft, tenantIds: [String]) async throws {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        let trimmed = draft.displayName.trimmingCharacters(in: .whitespaces)
        let name = trimmed.isEmpty ? (user.displayName ?? "") : trimmed
        let change = user.createProfileChangeRequest()
        change.displayName = name
        if let url = URL(string: draft.photoURL), !draft.photoURL.isEmpty { change.photoURL = url }
        try? await change.commitChanges()
        try await PFPath.user(uid).setData([
            "displayName": name, "photoURL": draft.photoURL, "title": draft.title, "bio": draft.bio,
            "email": user.email ?? "", "address": draft.address, "skills": draft.skills,
            "privacySettings": draft.privacy.mapValues(\.rawValue), "updatedAt": FieldValue.serverTimestamp(),
        ], merge: true)
        for tenantId in tenantIds {
            try? await PFPath.members(tenantId).document(uid).updateData(["displayName": name, "photoURL": draft.photoURL, "title": draft.title])
        }
    }

    public func setPhoto(url: String, tenantIds: [String]) async throws {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        if let parsed = URL(string: url) {
            let change = user.createProfileChangeRequest()
            change.photoURL = parsed
            try? await change.commitChanges()
        }
        try await PFPath.user(uid).setData(["photoURL": url, "updatedAt": FieldValue.serverTimestamp()], merge: true)
        for tenantId in tenantIds {
            try? await PFPath.members(tenantId).document(uid).updateData(["photoURL": url])
        }
    }
}

/// Firebase Auth calls of the security screens (kept in PFData: Firebase's Auth types are not Sendable).
public enum AccountSecurity {
    public static func updatePassword(to password: String) async throws {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        try await user.updatePassword(to: password)
    }

    /// Adds the e-mail/password provider to an account that signed in another way.
    public static func linkPassword(_ password: String) async throws {
        guard let user = Auth.auth().currentUser, let email = user.email else { throw PFDataError.notSignedIn }
        _ = try await user.link(with: EmailAuthProvider.credential(withEmail: email, password: password))
    }

    public static func unlink(provider: String) async throws {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        _ = try await user.unlink(fromProvider: provider)
    }

    public static func sendEmailVerification() async throws {
        try await Auth.auth().currentUser?.sendEmailVerification()
    }

    /// Reloads the user and reports whether the e-mail address is verified.
    public static func isEmailVerified() async throws -> Bool {
        try await Auth.auth().currentUser?.reload()
        return Auth.auth().currentUser?.isEmailVerified ?? false
    }

    public struct TOTPEnrollment {
        let secret: TOTPSecret
        public let key: String
        public let otpauthURL: String
    }

    public static func beginTOTP(issuer: String) async throws -> TOTPEnrollment {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        let session = try await user.multiFactor.session()
        let secret = try await TOTPMultiFactorGenerator.generateSecret(with: session)
        return TOTPEnrollment(secret: secret, key: secret.sharedSecretKey(),
                              otpauthURL: secret.generateQRCodeURL(withAccountName: user.email ?? issuer, issuer: issuer))
    }

    public static func finishTOTP(_ enrollment: TOTPEnrollment, code: String) async throws {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        let assertion = TOTPMultiFactorGenerator.assertionForEnrollment(with: enrollment.secret, oneTimePassword: code)
        try await user.multiFactor.enroll(with: assertion, displayName: "Authenticator")
    }

    public static var hasTOTP: Bool {
        (Auth.auth().currentUser?.multiFactor.enrolledFactors ?? []).contains { $0.factorID == TOTPMultiFactorID }
    }

    public static func disableTOTP() async throws {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        for factor in user.multiFactor.enrolledFactors where factor.factorID == TOTPMultiFactorID {
            try await user.multiFactor.unenroll(with: factor)
        }
    }

    public static func reauthenticate(password: String) async throws {
        guard let user = Auth.auth().currentUser, let email = user.email else { throw PFDataError.notSignedIn }
        try await user.reauthenticate(with: EmailAuthProvider.credential(withEmail: email, password: password))
    }

    public static func reauthenticateWithGitHub() async throws {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        let credential = try await OAuthProvider(providerID: "github.com").credential(with: nil)
        try await user.reauthenticate(with: credential)
    }

    public static func linkGitHub() async throws {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        let credential = try await OAuthProvider(providerID: "github.com").credential(with: nil)
        _ = try await user.link(with: credential)
    }
}
