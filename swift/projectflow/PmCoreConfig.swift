import Foundation

enum PmCoreConfig {
    /// PM-core mode hides flows/issues and non-essential modules in navigation.
    static let isEnabled = true

    static var isPmCoreOnly: Bool { isEnabled }
}
