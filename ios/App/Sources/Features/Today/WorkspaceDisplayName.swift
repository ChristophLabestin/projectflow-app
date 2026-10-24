import SwiftUI
import PFData
import PFDesign

extension SessionStore.WorkspaceSummary {
    /// The personal workspace is always shown as "Persönlich" (billing contract §7), team workspaces by name.
    var displayName: String { isPersonal ? L10n.t("workspace.personal") : name }
}
