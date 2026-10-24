import SwiftUI
import PFData
import PFDesign

/// The workspace areas next to the projects (web sidebar group), shown in the workspace sidebar.
/// Guests only see Activity (scoped to their projects); the other areas are for full members.
struct WorkspaceArea: Identifiable {
    let id: String
    let icon: String
    let route: AppRoute

    @MainActor
    static func all(model: AppModel) -> [WorkspaceArea] {
        guard let tenantId = model.workspace?.tenantId else { return [] }
        var list = [WorkspaceArea(id: "activity", icon: "waveform.path.ecg", route: .activity(tenantId: tenantId, projectId: nil))]
        if model.session?.role != .guest {
            list += [WorkspaceArea(id: "insights", icon: "chart.bar.xaxis", route: .insights(tenantId: tenantId)),
                     WorkspaceArea(id: "files", icon: "doc.on.doc", route: .files(tenantId: tenantId)),
                     WorkspaceArea(id: "wiki", icon: "book.closed", route: .wiki(tenantId: tenantId)),
                     WorkspaceArea(id: "flows", icon: "bolt.horizontal", route: .flows(tenantId: tenantId))]
        }
        return list
    }
}
