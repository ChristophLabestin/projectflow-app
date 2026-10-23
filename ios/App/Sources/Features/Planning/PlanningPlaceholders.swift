import SwiftUI
import PFData
import PFModel

// Interface for the project "Plan" tab (milestones, sprints, timeline). The Planning package replaces it.
struct ProjectPlanView: View {
    let store: ProjectStore
    let canEdit: Bool
    var body: some View { Text("Plan").padding() }
}
