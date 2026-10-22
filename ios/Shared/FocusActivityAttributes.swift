import ActivityKit
import Foundation

/// Live Activity for the running focus (contract C5). The type name must stay
/// `FocusActivityAttributes` because the backend sends `aps.attributes-type` with it.
nonisolated struct FocusActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var projectName: String?
        var nextStep: String?
        /// "active" | "snoozed" | "blocked"
        var status: String
        /// Epoch seconds.
        var startedAt: Double
        var snoozedUntil: Double?
    }

    var itemId: String
    var itemType: String
    var tenantId: String
    var projectId: String?
}
