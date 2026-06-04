import Foundation

enum PmCoreConfig {
    /// PM-core mode hides non-essential modules in navigation.
    static let isEnabled = true

    static var isPmCoreOnly: Bool { isEnabled }
}
