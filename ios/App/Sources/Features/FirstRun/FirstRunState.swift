import Foundation

/// Device-level choices from the first-install flow (before sign-in): language, crash-report opt-in and the
/// accepted privacy policy / terms versions. Stored in `UserDefaults`; bump a version to ask again.
nonisolated enum FirstRunState {
    static let privacyVersion = "2026-10"
    static let termsVersion = "2026-10"

    static let privacyURL = URL(string: "https://app.getprojectflow.com/legal/privacy")!
    static let termsURL = URL(string: "https://app.getprojectflow.com/legal/terms")!

    private static let languageKey = "pf.firstRun.language"
    private static let crashKey = "pf.consent.crashReports"
    private static let privacyKey = "pf.consent.privacy"
    private static let termsKey = "pf.consent.terms"

    /// The flow is done once the current privacy policy and terms are accepted on this device.
    static var isComplete: Bool {
        acceptedVersion(privacyKey) == privacyVersion && acceptedVersion(termsKey) == termsVersion
    }

    /// Language picked before sign-in ("de"/"en"); the profile language wins once it is set.
    static var language: String? {
        get { UserDefaults.standard.string(forKey: languageKey) }
        set { UserDefaults.standard.set(newValue, forKey: languageKey) }
    }

    /// Opt-in for anonymous crash reports (default off). Read by the crash reporter once one is integrated.
    static var crashReportsEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: crashKey) }
        set { UserDefaults.standard.set(newValue, forKey: crashKey) }
    }

    static func acceptPrivacy() { accept(privacyKey, version: privacyVersion) }
    static func acceptTerms() { accept(termsKey, version: termsVersion) }

    static func reset() {
        for key in [languageKey, crashKey, privacyKey, termsKey] { UserDefaults.standard.removeObject(forKey: key) }
    }

    private static func accept(_ key: String, version: String) {
        UserDefaults.standard.set(["version": version, "acceptedAt": Date().timeIntervalSince1970], forKey: key)
    }

    private static func acceptedVersion(_ key: String) -> String? {
        (UserDefaults.standard.dictionary(forKey: key))?["version"] as? String
    }
}
