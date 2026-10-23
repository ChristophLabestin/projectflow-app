import SwiftUI
import FirebaseCore
import Observation
import FirebaseDatabase
import PFData
import PFDesign
import PFModel

/// Team (route `.team`): members with roles and presence, pending invitations, groups, roles and the
/// entry to the workspace settings. Owner/Admin manage (rules of `firestore.rules`), everybody reads.
struct TeamScreen: View {
    var body: some View {
        TeamHost { context in TeamScreenContent(context: context) }
    }
}

private struct TeamScreenContent: View {
    let context: TeamContext
    @Environment(AppModel.self) private var model
    @State private var presence = TeamPresence()
    @State private var query = ""

    private var members: [Person] {
        let all = TeamLogic.sorted(Array(context.people.values))
        let term = query.trimmingCharacters(in: .whitespaces)
        guard !term.isEmpty else { return all }
        return all.filter { $0.displayName.localizedCaseInsensitiveContains(term) || ($0.email ?? "").localizedCaseInsensitiveContains(term) }
    }

    var body: some View {
        SettingsScaffold(title: L10n.t("account.team"), subtitle: context.tenantName, topTrailing: context.canAdmin ? AnyView(
            PFIconButton("person.badge.plus", label: L10n.t("team.invite.title")) { presentInvite() }
        ) : nil) {
            if context.canAdmin, !context.store.invitations.isEmpty {
                PFSectionHeader(L10n.plural("team.invitations.count", context.store.invitations.count))
                SettingsCard { ForEach(context.store.invitations) { invitation in invitationRow(invitation) } }
            }
            memberSection
            PFSectionHeader(L10n.t("team.manage"))
            SettingsCard {
                SettingsRow(systemImage: "person.3", title: L10n.t("team.groups"), subtitle: L10n.plural("team.groups.count", context.store.groups.count)) {
                    model.router.push(.accountPage(.groups))
                }
                if context.canAdmin {
                    SettingsRow(systemImage: "shield.lefthalf.filled", title: L10n.t("team.roles"), subtitle: L10n.plural("team.roles.count", context.store.roles.count)) {
                        model.router.push(.accountPage(.roles))
                    }
                }
                SettingsRow(systemImage: "gearshape", title: L10n.t("team.workspaceSettings")) { model.router.push(.accountPage(.workspaceSettings)) }
            }
        }
        .task(id: context.tenantId) { presence.start(tenantId: context.tenantId) }
        .onDisappear { presence.stop() }
    }

    @ViewBuilder private var memberSection: some View {
        PFSectionHeader(L10n.plural("team.count", context.people.count))
        if context.people.count > 6 {
            PFTextField(L10n.t("team.search"), text: $query, systemImage: "magnifyingglass").padding(.bottom, PFSpace.xs)
        }
        if (model.workspace?.loaded.contains(.people) ?? false) == false {
            PFSkeleton(height: 60, radius: PFRadius.card)
        } else if members.isEmpty {
            PFEmptyState(systemImage: "person.2", title: L10n.t("team.empty.title"), message: L10n.t("team.empty.message"))
        } else {
            SettingsCard(footer: context.canAdmin ? nil : L10n.t("team.footer")) {
                ForEach(members) { person in memberRow(person) }
            }
        }
    }

    private func memberRow(_ person: Person) -> some View {
        let membership = context.store.memberships[person.id]
        let customs = (membership?.roleIds ?? []).compactMap { context.store.role($0)?.name }
        return TeamPersonRow(person: person, subtitle: person.title ?? person.email, isYou: person.id == context.uid, action: {
            model.router.push(.accountPage(.member(person.id)))
        }) {
            HStack(spacing: 4) {
                if let state = presence.states[person.id], state != .offline {
                    PFDot(state.color, size: 8)
                }
                if let role = person.role { PFPill(AccountLogic.roleLabel(role), compact: true) }
                if let first = customs.first { PFPill(customs.count > 1 ? "\(first) +\(customs.count - 1)" : first, compact: true) }
            }
        }
        .accessibilityValue(presence.states[person.id].map { $0.label } ?? "")
    }

    private func invitationRow(_ invitation: TeamInvitation) -> some View {
        SettingsRow(systemImage: invitation.kind == .email ? "envelope" : "link",
                    title: invitation.email ?? L10n.t("team.invite.linkTitle"),
                    subtitle: "\(TeamLogic.roleLabel(invitation.role)) · \(TeamLogic.expiryText(invitation))") {
            model.presenter.present(detents: [.fit]) { InvitationSheet(context: context, invitation: invitation) }
        }
    }

    private func presentInvite() {
        model.presenter.present(detents: [.large]) { InviteSheet(context: context) }
    }
}

/// Reads `/status/{tenantId}` from the Realtime Database (read-only; the iPhone never reports presence,
/// concept decision 7). Stays empty when the project has no database configured (e.g. the emulator).
@Observable
final class TeamPresence {
    enum State: String {
        case online, idle, busy, offline

        var color: Color {
            switch self {
            case .online: PFColor.success
            case .idle: PFColor.warning
            case .busy: PFColor.danger
            case .offline: PFColor.textSubtle
            }
        }

        var label: String { L10n.t("team.presence.\(rawValue)") }
    }

    private(set) var states: [String: State] = [:]
    private var handle: DatabaseHandle?
    private var reference: DatabaseReference?

    func start(tenantId: String?) {
        stop()
        guard let tenantId, FirebaseApp.app()?.options.databaseURL != nil else { return }
        let reference = Database.database().reference(withPath: "status/\(tenantId)")
        self.reference = reference
        handle = reference.observe(.value) { [weak self] snapshot in
            var result: [String: State] = [:]
            for case let child as DataSnapshot in snapshot.children {
                if let value = child.value as? [String: Any], let state = (value["state"] as? String).flatMap(State.init(rawValue:)) {
                    result[child.key] = state
                }
            }
            MainActor.assumeIsolated { self?.states = result }
        }
    }

    func stop() {
        if let reference, let handle { reference.removeObserver(withHandle: handle) }
        reference = nil
        handle = nil
    }
}
