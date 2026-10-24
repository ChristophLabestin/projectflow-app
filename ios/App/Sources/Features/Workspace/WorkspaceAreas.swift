import SwiftUI
import PFData
import PFDesign

/// "Arbeitsbereich" on the Projects tab: the workspace areas next to the projects (web sidebar group).
/// Guests only see Activity (scoped to their projects); the other areas are for full members.
struct WorkspaceAreasRow: View {
    @Environment(AppModel.self) private var model

    struct Area: Identifiable {
        let id: String
        let icon: String
        let route: AppRoute
    }

    private var areas: [Area] {
        guard let tenantId = model.workspace?.tenantId else { return [] }
        var list = [Area(id: "activity", icon: "waveform.path.ecg", route: .activity(tenantId: tenantId, projectId: nil))]
        if model.session?.role != .guest {
            list.append(Area(id: "insights", icon: "chart.bar.xaxis", route: .insights(tenantId: tenantId)))
            list += WorkspaceAreasRow.extraAreas(tenantId: tenantId)
        }
        return list
    }

    /// Filled in by later areas (files, wiki, flows).
    static func extraAreas(tenantId: String) -> [Area] {
        [Area(id: "files", icon: "doc.on.doc", route: .files(tenantId: tenantId)),
         Area(id: "wiki", icon: "book.closed", route: .wiki(tenantId: tenantId))]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            PFEyebrow(L10n.t("workspace.areas"))
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: PFSpace.s)], spacing: PFSpace.s) {
                ForEach(areas) { area in
                    Button { model.router.push(area.route) } label: {
                        VStack(alignment: .leading, spacing: PFSpace.s) {
                            Image(systemName: area.icon).font(.system(size: 17, weight: .semibold)).foregroundStyle(PFColor.textMain)
                            Text(L10n.t("nav.\(area.id)")).pfText(.metaStrong).foregroundStyle(PFColor.textMain).lineLimit(1)
                        }
                        .padding(PFSpace.m)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(PFColor.card, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                        .pfElevation(.card, radius: PFRadius.card)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
        }
    }
}
