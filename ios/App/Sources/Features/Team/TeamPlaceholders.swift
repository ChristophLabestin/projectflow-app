import SwiftUI
import PFData
import PFModel

// Interface for the project "Team" tab (members, roles, invites). The Team package replaces it.
struct ProjectTeamView: View {
    let store: ProjectStore
    let canEdit: Bool
    var body: some View { Text("Team").padding() }
}
