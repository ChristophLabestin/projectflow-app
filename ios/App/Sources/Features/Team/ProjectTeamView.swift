import SwiftUI
import PFData
import PFDesign
import PFModel

/// Project "Team" tab: members with their project roles and workload; add workspace members, invite
/// externals, change role, remove (web `ProjectTeamManager`, `RolesTab`).
struct ProjectTeamView: View {
    let store: ProjectStore
    let canEdit: Bool

    var body: some View {
        TeamHost { context in ProjectTeamContent(context: context, store: store, canEdit: canEdit) }
    }
}

enum ProjectRoleLogic {
    static let system = ["Owner", "Editor", "Viewer"]

    static func label(_ raw: String, roles: [TenantRole]) -> String {
        switch raw {
        case "Owner": L10n.t("projectTeam.role.owner")
        case "Editor": L10n.t("projectTeam.role.editor")
        case "Viewer": L10n.t("projectTeam.role.viewer")
        default: roles.first { $0.id == raw }?.name ?? L10n.t("projectTeam.role.unknown")
        }
    }
}

private struct ProjectTeamContent: View {
    let context: TeamContext
    let store: ProjectStore
    let canEdit: Bool
    @Environment(AppModel.self) private var model

    private var project: Project? { store.project }

    private struct Entry: Identifiable {
        let person: Person
        let role: String
        let openTasks: Int
        var id: String { person.id }
    }

    private var entries: [Entry] {
        guard let project else { return [] }
        var roles: [String: String] = [:]
        for member in project.members { roles[member.userId] = member.role ?? "Viewer" }
        var ids = Set(project.memberIds).union(roles.keys)
        if let owner = project.ownerId { ids.insert(owner); roles[owner] = "Owner" }
        let open = store.tasks.filter { !$0.isCompleted }
        return ids.compactMap { id -> Entry? in
            guard let person = context.person(id) else { return nil }
            return Entry(person: person, role: roles[id] ?? "Viewer", openTasks: open.filter { $0.assigneeIds.contains(id) }.count)
        }
        .sorted { a, b in
            let ra = ProjectRoleLogic.system.firstIndex(of: a.role) ?? 3, rb = ProjectRoleLogic.system.firstIndex(of: b.role) ?? 3
            return ra != rb ? ra < rb : a.person.displayName.localizedCaseInsensitiveCompare(b.person.displayName) == .orderedAscending
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            let rows = entries
            let maxOpen = max(rows.map(\.openTasks).max() ?? 1, 1)
            if canEdit {
                HStack(spacing: PFSpace.xs) {
                    PFButton(L10n.t("projectTeam.add"), systemImage: "person.badge.plus", size: .medium, fullWidth: true) { presentAdd() }
                    if context.canAdmin {
                        PFButton(L10n.t("projectTeam.inviteExternal"), systemImage: "envelope", kind: .secondary, size: .medium, fullWidth: true) { presentInvite() }
                    }
                }
            }
            if !store.isLoaded {
                PFSkeleton(height: 64, radius: PFRadius.card)
            } else if rows.isEmpty {
                PFEmptyState(systemImage: "person.2", title: L10n.t("projectTeam.empty"), message: L10n.t("projectTeam.emptyMessage"))
            } else {
                PFSectionHeader(L10n.plural("team.count", rows.count))
                PFCardList {
                    ForEach(rows) { entry in
                        TeamPersonRow(person: entry.person, subtitle: workload(entry), isYou: entry.person.id == context.uid,
                                      action: canEdit && entry.role != "Owner" ? { presentMember(entry.person, role: entry.role) } : nil) {
                            VStack(alignment: .trailing, spacing: 6) {
                                PFPill(ProjectRoleLogic.label(entry.role, roles: context.store.roles), compact: true)
                                PFProgressBar(value: Double(entry.openTasks) / Double(maxOpen), height: 4).frame(width: 54)
                            }
                        }
                    }
                }
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.vertical, PFSpace.s)
    }

    private func workload(_ entry: Entry) -> String {
        entry.openTasks == 0 ? L10n.t("projectTeam.noOpen") : L10n.plural("projectTeam.open", entry.openTasks)
    }

    private func actions() -> ProjectTeamActions? {
        guard let project else { return nil }
        return ProjectTeamActions(tenantId: project.tenantId, projectId: project.id, uid: context.uid)
    }

    private func presentAdd() {
        guard let project, let actions = actions() else { return }
        let present = Set(entries.map(\.person.id))
        model.presenter.present(detents: [.large]) {
            ProjectAddMemberSheet(context: context, project: project, actions: actions, existing: present)
        }
    }

    private func presentInvite() {
        // Plan without invitations (Free, personal workspace): explain instead of opening the sheet.
        guard model.entitlements.canInvite else {
            model.toasts.show(PFToast(L10n.t("planError.plan-invites-disabled"), style: .warning))
            return
        }
        guard let project else { return }
        model.presenter.present(detents: [.large]) { InviteSheet(context: context, presetProjectIds: [project.id], presetRole: .guest) }
    }

    private func presentMember(_ person: Person, role: String) {
        guard let actions = actions() else { return }
        model.presenter.present(detents: [.fit]) { ProjectMemberSheet(context: context, person: person, role: role, actions: actions) }
    }
}

/// Role choices for a project member: Owner/Editor/Viewer plus the workspace's custom roles.
private struct ProjectRolePicker: View {
    let context: TeamContext
    @Binding var role: String

    var body: some View {
        PFCardList {
            ForEach(ProjectRoleLogic.system, id: \.self) { raw in
                TeamChoiceRow(title: ProjectRoleLogic.label(raw, roles: context.store.roles), subtitle: L10n.t("projectTeam.role.hint.\(raw.lowercased())"),
                              isSelected: role == raw) { role = raw }
            }
            ForEach(context.store.roles.filter { !$0.isSystem }) { custom in
                TeamChoiceRow(title: custom.name, subtitle: custom.summary.isEmpty ? nil : custom.summary,
                              leading: AnyView(PFDot(TeamSwatch.color(custom.color), size: 12)), isSelected: role == custom.id) { role = custom.id }
            }
        }
    }
}

/// Change the project role of one member or remove them from the project.
private struct ProjectMemberSheet: View {
    let context: TeamContext
    let person: Person
    let role: String
    let actions: ProjectTeamActions
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var selected = "Viewer"
    @State private var isWorking = false

    var body: some View {
        TeamSheet(eyebrow: person.displayName, title: L10n.t("projectTeam.role")) {
            ProjectRolePicker(context: context, role: $selected)
            PFButton(isWorking ? L10n.t("common.loading") : L10n.t("common.save"), size: .large, fullWidth: true) { save() }
                .disabled(isWorking || selected == role)
            PFButton(L10n.t("projectTeam.remove"), kind: .danger, size: .large, fullWidth: true) { remove() }.disabled(isWorking)
        }
        .onAppear { selected = role }
    }

    private func save() {
        isWorking = true
        Task {
            defer { isWorking = false }
            do {
                try await actions.setRole(person.id, role: selected)
                PFHaptics.success()
                presenter.dismiss()
            } catch {
                teamFail(model, error)
            }
        }
    }

    private func remove() {
        isWorking = true
        Task {
            defer { isWorking = false }
            do {
                try await actions.remove(person.id)
                PFHaptics.success()
                presenter.dismiss()
            } catch {
                teamFail(model, error)
            }
        }
    }
}

/// Add workspace members to the project with a role.
private struct ProjectAddMemberSheet: View {
    let context: TeamContext
    let project: Project
    let actions: ProjectTeamActions
    let existing: Set<String>
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var role = "Editor"
    @State private var query = ""
    @State private var added: Set<String> = []

    private var candidates: [Person] {
        let term = query.trimmingCharacters(in: .whitespaces)
        return TeamLogic.sorted(context.people.values.filter { !existing.contains($0.id) })
            .filter { term.isEmpty || $0.displayName.localizedCaseInsensitiveContains(term) || ($0.email ?? "").localizedCaseInsensitiveContains(term) }
    }

    var body: some View {
        TeamSheet(eyebrow: project.title, title: L10n.t("projectTeam.add")) {
            Text(L10n.t("projectTeam.role")).pfText(.eyebrow).foregroundStyle(PFColor.textMuted)
            ProjectRolePicker(context: context, role: $role)
            PFTextField(L10n.t("team.search"), text: $query, systemImage: "magnifyingglass")
            if candidates.isEmpty {
                Text(L10n.t("projectTeam.noCandidates")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            } else {
                PFCardList {
                    ForEach(candidates) { person in
                        TeamChoiceRow(title: person.displayName, subtitle: person.email,
                                      leading: AnyView(PFAvatar(name: person.displayName, seed: person.id, imageURL: person.photoURL, size: 34)),
                                      isSelected: added.contains(person.id)) { add(person) }
                    }
                }
            }
            PFButton(L10n.t("common.done"), kind: .ghost, size: .large, fullWidth: true) { presenter.dismiss() }
        }
    }

    private func add(_ person: Person) {
        guard !added.contains(person.id) else { return }
        added.insert(person.id)
        Task {
            do {
                try await actions.add(person, role: role)
                PFHaptics.success()
            } catch {
                added.remove(person.id)
                teamFail(model, error)
            }
        }
    }
}
