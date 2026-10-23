import SwiftUI
import FirebaseFirestore
import PFData
import PFDesign
import PFModel

/// Member detail (`.accountPage(.member)`): role, groups, shared profile fields, open tasks.
struct MemberScreen: View {
    let uid: String
    var body: some View {
        TeamHost { context in MemberContent(context: context, uid: uid) }
    }
}

private struct MemberContent: View {
    let context: TeamContext
    let uid: String
    @Environment(AppModel.self) private var model
    @State private var details: Fields?
    @State private var tasks: [WorkTask] = []
    @State private var tasksLoaded = false

    private var person: Person? { context.person(uid) }
    private var membership: Membership? { context.store.memberships[uid] }

    var body: some View {
        SettingsScaffold(title: person?.displayName ?? "—", subtitle: person?.title ?? person?.email) {
            if let person {
                header(person)
                profileCard
                if context.canManage(person) || context.canAdmin {
                    PFSectionHeader(L10n.t("team.member.access"))
                    accessCard(person)
                }
                PFSectionHeader(L10n.plural("team.member.openTasks", tasks.count))
                tasksCard
            } else {
                PFEmptyState(systemImage: "person.crop.circle.badge.questionmark", title: L10n.t("team.member.missing"), message: "")
                    .padding(.top, PFSpace.l)
            }
        }
        .task(id: uid) { await load() }
    }

    private func header(_ person: Person) -> some View {
        HStack(spacing: PFSpace.m) {
            PFAvatar(name: person.displayName, seed: person.id, imageURL: person.photoURL, size: 72)
            VStack(alignment: .leading, spacing: 6) {
                if let email = person.email { Text(email).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1) }
                HStack(spacing: 6) {
                    if let role = person.role { PFPill(AccountLogic.roleLabel(role), compact: true) }
                    ForEach(membership?.roleIds ?? [], id: \.self) { id in
                        if let role = context.store.role(id) { PFPill(role.name, tone: .custom(TeamSwatch.color(role.color)), compact: true) }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.top, PFSpace.l)
    }

    @ViewBuilder private var profileCard: some View {
        let bio = visible("bio") ? (details?.string("bio") ?? "") : ""
        let skills = visible("skills") ? (details?.strings("skills") ?? []) : []
        let address = visible("address") ? (details?.string("address") ?? "") : ""
        if !bio.isEmpty || !skills.isEmpty || !address.isEmpty {
            PFSectionHeader(L10n.t("team.member.about"))
            VStack(alignment: .leading, spacing: PFSpace.s) {
                if !bio.isEmpty { Text(bio).pfText(.body).foregroundStyle(PFColor.textMain).fixedSize(horizontal: false, vertical: true) }
                if !address.isEmpty {
                    Label(address, systemImage: "mappin.and.ellipse").pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
                if !skills.isEmpty {
                    PFChipRow { ForEach(skills, id: \.self) { PFPill($0, compact: true) } }
                }
            }
            .padding(PFSpace.m).frame(maxWidth: .infinity, alignment: .leading)
            .background(PFColor.card, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
        }
    }

    /// Hidden only when the person set the field to private (the app shows members to members and guests).
    private func visible(_ key: String) -> Bool {
        if uid == context.uid { return true }
        let scope = details?.map("privacySettings")?.string(key) ?? ProfileDraft.defaultPrivacy[key]?.rawValue ?? "members"
        return scope != "private"
    }

    private func accessCard(_ person: Person) -> some View {
        let manageable = context.canManage(person)
        let groups = (membership?.groupIds ?? []).compactMap { context.store.group($0)?.name }
        return SettingsCard(footer: manageable ? nil : L10n.t("team.member.locked")) {
            SettingsRow(systemImage: "shield.lefthalf.filled", title: L10n.t("team.member.role"),
                        subtitle: person.role.map(AccountLogic.roleLabel), showsChevron: manageable,
                        action: manageable ? { presentRoles(person) } : nil)
            SettingsRow(systemImage: "person.3", title: L10n.t("team.groups"),
                        subtitle: groups.isEmpty ? L10n.t("team.member.noGroups") : groups.joined(separator: ", "),
                        showsChevron: context.canAdmin, action: context.canAdmin ? { presentGroups(person) } : nil)
            if manageable {
                SettingsRow(systemImage: "person.badge.minus", title: L10n.t("team.member.remove"), role: .danger, showsChevron: false) { confirmRemove(person) }
            }
        }
    }

    @ViewBuilder private var tasksCard: some View {
        if !tasksLoaded {
            PFSkeleton(height: 60, radius: PFRadius.card)
        } else if tasks.isEmpty {
            Text(L10n.t("team.member.noTasks")).pfText(.meta).foregroundStyle(PFColor.textMuted)
        } else {
            PFCardList {
                ForEach(tasks.prefix(25)) { task in
                    WorkItemRow(item: .task(task), showsProject: true)
                }
            }
            if tasks.count > 25 {
                Text(L10n.t("team.member.moreTasks", ["count": tasks.count - 25])).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
        }
    }

    private func load() async {
        details = await TeamActions.userDetails(uid)
        let open = await context.actions.openTasks(of: uid)
        tasks = open.sorted { a, b in
            let left: Date = a.dueDate?.instant ?? Date.distantFuture
            let right: Date = b.dueDate?.instant ?? Date.distantFuture
            return left < right
        }
        tasksLoaded = true
    }

    private func presentRoles(_ person: Person) {
        model.presenter.present(detents: [.large]) { MemberRoleSheet(context: context, person: person) }
    }

    private func presentGroups(_ person: Person) {
        model.presenter.present(detents: [.large]) { MemberGroupsSheet(context: context, person: person) }
    }

    private func confirmRemove(_ person: Person) {
        model.presenter.present(detents: [.fit]) {
            ConfirmSheet(title: L10n.t("team.member.remove"), message: L10n.t("team.member.removeMessage", ["name": person.displayName]),
                         confirmTitle: L10n.t("team.member.removeConfirm")) {
                Task {
                    do {
                        try await context.actions.removeMember(person.id)
                        PFHaptics.success()
                        model.router.pop()
                    } catch {
                        teamFail(model, error)
                    }
                }
            }
        }
    }
}

/// System role (Admin/Member/Guest) and stacked custom roles of a member.
struct MemberRoleSheet: View {
    let context: TeamContext
    let person: Person
    @Environment(AppModel.self) private var model
    @State private var role: WorkspaceRole = .member
    @State private var roleIds: Set<String> = []
    @State private var isWorking = false

    private var customRoles: [TenantRole] { context.store.roles.filter { !$0.isSystem } }

    var body: some View {
        TeamSheet(eyebrow: person.displayName, title: L10n.t("team.member.role")) {
            PFCardList {
                ForEach(context.assignableRoles, id: \.self) { candidate in
                    TeamChoiceRow(title: AccountLogic.roleLabel(candidate), subtitle: L10n.t("team.role.hint.\(key(candidate))"), isSelected: role == candidate) {
                        role = candidate
                    }
                }
            }
            if !customRoles.isEmpty {
                PFSectionHeader(L10n.t("team.member.customRoles"))
                PFCardList {
                    ForEach(customRoles) { custom in
                        TeamChoiceRow(title: custom.name, subtitle: custom.summary.isEmpty ? nil : custom.summary,
                                      leading: AnyView(PFDot(TeamSwatch.color(custom.color), size: 12)), isSelected: roleIds.contains(custom.id)) {
                            if roleIds.contains(custom.id) { roleIds.remove(custom.id) } else { roleIds.insert(custom.id) }
                        }
                    }
                }
            }
            PFButton(isWorking ? L10n.t("common.loading") : L10n.t("common.save"), size: .large, fullWidth: true) { save() }.disabled(isWorking)
        }
        .onAppear {
            role = person.role.flatMap { context.assignableRoles.contains($0) ? $0 : nil } ?? .member
            roleIds = Set(context.store.memberships[person.id]?.roleIds ?? [])
        }
    }

    private func key(_ role: WorkspaceRole) -> String {
        switch role {
        case .admin: "admin"
        case .guest: "guest"
        default: "member"
        }
    }

    private func save() {
        isWorking = true
        Task {
            defer { isWorking = false }
            do {
                if role != person.role {
                    try await context.actions.setRole(person.id, role: role == .admin ? "Admin" : role == .guest ? "Guest" : "Member")
                }
                try await context.actions.setRoleIds(person.id, roleIds: Array(roleIds))
                PFHaptics.success()
                model.presenter.dismiss()
            } catch {
                teamFail(model, error)
            }
        }
    }
}

/// Group memberships of one person (toggle per group).
struct MemberGroupsSheet: View {
    let context: TeamContext
    let person: Person
    @Environment(AppModel.self) private var model

    var body: some View {
        TeamSheet(eyebrow: person.displayName, title: L10n.t("team.groups")) {
            if context.store.groups.isEmpty {
                Text(L10n.t("team.groups.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            } else {
                PFCardList {
                    ForEach(context.store.groups) { group in
                        let isMember = group.memberIds.contains(person.id)
                        TeamChoiceRow(title: group.name, subtitle: group.summary.isEmpty ? nil : group.summary,
                                      leading: AnyView(PFDot(TeamSwatch.color(group.color), size: 12)), isSelected: isMember) {
                            Task {
                                do { try await context.actions.setGroupMember(person.id, groupId: group.id, isMember: !isMember) } catch { teamFail(model, error) }
                            }
                        }
                    }
                }
            }
        }
    }
}
