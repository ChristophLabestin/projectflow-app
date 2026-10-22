import Foundation
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore
import FirebaseFunctions

/// Which backend the app talks to. `emulator` uses the local Firebase emulators started by
/// `scripts/dev-e2e.sh` (project `demo-projectflow`, contract C11); `production` uses the bundled
/// `GoogleService-Info.plist` (project `projectflow-labestin`).
public enum PFBackend: Sendable, Equatable {
    case production
    case emulator(host: String, authPort: Int, firestorePort: Int, functionsPort: Int, storagePort: Int)

    public static let defaultEmulator = PFBackend.emulator(host: "127.0.0.1", authPort: 9631, firestorePort: 8631, functionsPort: 5631, storagePort: 9632)

    public var isEmulator: Bool { if case .emulator = self { true } else { false } }
}

public enum PFFirebase {
    public static let functionsRegion = "europe-west3"
    public private(set) static var backend: PFBackend = .production

    /// Configures Firebase exactly once. Call from the app delegate before anything else.
    public static func configure(_ backend: PFBackend) {
        guard FirebaseApp.app() == nil else { return }
        self.backend = backend
        switch backend {
        case .production:
            FirebaseApp.configure()
            let settings = Firestore.firestore().settings
            settings.cacheSettings = PersistentCacheSettings(sizeBytes: NSNumber(value: 200 * 1024 * 1024))
            Firestore.firestore().settings = settings
        case let .emulator(host, authPort, firestorePort, functionsPort, _):
            let options = FirebaseOptions(googleAppID: "1:123456789012:ios:0123456789abcdef", gcmSenderID: "123456789012")
            options.projectID = "demo-projectflow"
            options.apiKey = "demo-key-emulator-only"
            options.bundleID = Bundle.main.bundleIdentifier ?? "de.christophlabestin.projectflow"
            FirebaseApp.configure(options: options)
            Auth.auth().useEmulator(withHost: host, port: authPort)
            let settings = Firestore.firestore().settings
            settings.host = "\(host):\(firestorePort)"
            settings.isSSLEnabled = false
            settings.cacheSettings = PersistentCacheSettings(sizeBytes: NSNumber(value: 100 * 1024 * 1024))
            Firestore.firestore().settings = settings
            functions.useEmulator(withHost: host, port: functionsPort)
        }
    }

    public static var db: Firestore { Firestore.firestore() }
    public static var functions: Functions { Functions.functions(region: functionsRegion) }
}
