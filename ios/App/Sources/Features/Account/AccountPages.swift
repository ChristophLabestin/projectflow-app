import SwiftUI

/// Pushable pages of the Account/Team packages (`AppRoute.accountPage`).
enum AccountPage: Hashable {
    case profile
    case workspaceSettings
    case roles
    case groups
    case member(String)
}

struct AccountPageView: View {
    let page: AccountPage

    var body: some View {
        switch page {
        case .profile: ProfileScreen()
        case .workspaceSettings: WorkspaceSettingsScreen()
        case .roles: RolesScreen()
        case .groups: GroupsScreen()
        case .member(let uid): MemberScreen(uid: uid)
        }
    }
}
