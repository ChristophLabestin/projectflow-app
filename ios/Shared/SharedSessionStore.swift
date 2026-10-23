import Foundation
import Security

/// What the share extension needs to write to Firestore without the Firebase SDK: a refresh token plus
/// the identifiers of the active workspace. Written by the app on sign-in, removed on sign-out.
/// Stored in the shared keychain access group (contract C11).
nonisolated struct SharedSessionCredentials: Codable, Hashable, Sendable {
    var refreshToken: String
    var apiKey: String
    var projectId: String
    var tenantId: String
    var uid: String
    /// Set in the Emulator build so the extension talks to the local emulators instead of Google.
    var emulatorHost: String?
    var authPort: Int?
    var firestorePort: Int?

    var isEmulator: Bool { emulatorHost != nil }
}

nonisolated enum SharedSessionStore {
    private static let service = "de.christophlabestin.projectflow.session"
    private static let account = "current"

    private static func query(group: Bool) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        if group { query[kSecAttrAccessGroup as String] = SharedConstants.keychainGroup }
        return query
    }

    @discardableResult
    static func save(_ credentials: SharedSessionCredentials) -> Bool {
        guard let data = try? JSONEncoder().encode(credentials) else { return false }
        // The access group only exists when the binary carries the keychain-access-groups entitlement
        // (signed builds). Unsigned simulator builds fall back to the app's default group.
        for useGroup in [true, false] {
            SecItemDelete(query(group: useGroup) as CFDictionary)
            var item = query(group: useGroup)
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            if SecItemAdd(item as CFDictionary, nil) == errSecSuccess { return true }
        }
        return false
    }

    static func load() -> SharedSessionCredentials? {
        for useGroup in [true, false] {
            var search = query(group: useGroup)
            search[kSecReturnData as String] = true
            search[kSecMatchLimit as String] = kSecMatchLimitOne
            var result: CFTypeRef?
            if SecItemCopyMatching(search as CFDictionary, &result) == errSecSuccess, let data = result as? Data,
               let credentials = try? JSONDecoder().decode(SharedSessionCredentials.self, from: data) {
                return credentials
            }
        }
        return nil
    }

    static func clear() {
        for useGroup in [true, false] { SecItemDelete(query(group: useGroup) as CFDictionary) }
    }
}
