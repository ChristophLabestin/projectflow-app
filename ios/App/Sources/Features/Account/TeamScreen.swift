import SwiftUI
import FirebaseCore
import Observation
import FirebaseDatabase
import PFData
import PFDesign
import PFModel

/// Team: members of the active workspace with their roles; presence (online/idle/busy) is read-only.
struct TeamScreen: View {
    @Environment(AppModel.self) private var model
    @State private var presence = TeamPresence()

    private var members: [Person] {
        let people = Array(model.workspace?.people.values ?? [:].values)
        return people.sorted { a, b in
            let ra = Self.rank(a.role), rb = Self.rank(b.role)
            return ra != rb ? ra < rb : a.displayName.localizedCaseInsensitiveCompare(b.displayName) == .orderedAscending
        }
    }

    private static func rank(_ role: WorkspaceRole?) -> Int {
        switch role {
        case .owner: 0
        case .admin: 1
        case .member, .none: 2
        case .custom: 3
        case .guest: 4
        }
    }

    var body: some View {
        SettingsScaffold(title: L10n.t("account.team"), subtitle: model.session?.activeWorkspace?.name) {
            if (model.workspace?.loaded.contains(.people) ?? false) == false {
                PFSkeleton(height: 60, radius: PFRadius.card).padding(.top, PFSpace.l)
            } else if members.isEmpty {
                PFEmptyState(systemImage: "person.2", title: L10n.t("team.empty.title"), message: L10n.t("team.empty.message"))
                    .padding(.top, PFSpace.l)
            } else {
                PFSectionHeader(L10n.plural("team.count", members.count))
                SettingsCard(footer: L10n.t("team.footer")) {
                    ForEach(members) { person in row(person) }
                }
            }
        }
        .task(id: model.workspace?.tenantId) { presence.start(tenantId: model.workspace?.tenantId) }
        .onDisappear { presence.stop() }
    }

    private func row(_ person: Person) -> some View {
        HStack(spacing: PFSpace.s) {
            PFAvatar(name: person.displayName, seed: person.id, imageURL: person.photoURL, size: 40)
                .overlay(alignment: .bottomTrailing) {
                    if let state = presence.states[person.id], state != .offline {
                        Circle().fill(state.color).frame(width: 12, height: 12)
                            .overlay { Circle().strokeBorder(PFColor.card, lineWidth: 2) }
                    }
                }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(person.displayName).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                    if person.id == model.uid {
                        Text(L10n.t("team.you")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    }
                }
                Text(person.title ?? person.email ?? "").pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
            }
            Spacer(minLength: 0)
            if let role = person.role { PFPill(AccountLogic.roleLabel(role), compact: true) }
        }
        .padding(.horizontal, PFSpace.m)
        .frame(minHeight: 64)
        .accessibilityElement(children: .combine)
        .accessibilityValue(presence.states[person.id].map { $0.label } ?? "")
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
