import SwiftUI
import PFData
import PFDesign
import PFModel

/// Custom workspace roles (`tenants/{t}/roles`, web `RoleManagement`): Owner/Admin create, edit and delete.
struct RolesScreen: View {
    var body: some View { TeamHost { context in RolesContent(context: context) } }
}

private struct RolesContent: View {
    let context: TeamContext
    @Environment(AppModel.self) private var model

    private var custom: [TenantRole] { context.store.roles.filter { !$0.isSystem } }

    var body: some View {
        SettingsScaffold(title: L10n.t("team.roles"), subtitle: context.tenantName, topTrailing: context.canAdmin ? AnyView(
            PFIconButton("plus", label: L10n.t("team.role.new")) { present(nil) }
        ) : nil) {
            PFSectionHeader(L10n.t("team.roles.system"))
            SettingsCard(footer: L10n.t("team.roles.systemFooter")) {
                ForEach([WorkspaceRole.owner, .admin, .member, .guest], id: \.self) { role in
                    SettingsRow(systemImage: "shield", title: AccountLogic.roleLabel(role), subtitle: L10n.t("team.role.hint.\(key(role))"), showsChevron: false)
                }
            }
            PFSectionHeader(L10n.t("team.roles.custom"))
            if custom.isEmpty {
                PFEmptyState(systemImage: "shield.lefthalf.filled", title: L10n.t("team.roles.empty"), message: L10n.t("team.roles.emptyMessage"),
                             actionTitle: L10n.t("team.role.new")) { present(nil) }
            } else {
                SettingsCard {
                    ForEach(custom) { role in
                        SettingsRow(systemImage: "shield.lefthalf.filled", title: role.name,
                                    subtitle: L10n.t("team.role.allowed", ["count": role.allow.count]) + (role.deny.isEmpty ? "" : " · " + L10n.t("team.role.denied", ["count": role.deny.count])),
                                    action: { present(role) }) {
                            PFDot(TeamSwatch.color(role.color), size: 12)
                        }
                    }
                }
            }
        }
    }

    private func key(_ role: WorkspaceRole) -> String {
        switch role {
        case .owner: "owner"
        case .admin: "admin"
        case .guest: "guest"
        default: "member"
        }
    }

    private func present(_ role: TenantRole?) {
        model.presenter.present(detents: [.large]) { RoleSheet(context: context, roleId: role?.id) }
    }
}

/// Role editor: name, colour, description and Discord-style allow / inherit / deny per permission node.
struct RoleSheet: View {
    let context: TeamContext
    let roleId: String?
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var name = ""
    @State private var summary = ""
    @State private var color = TeamSwatch.presets[0]
    @State private var allow: Set<String> = []
    @State private var deny: Set<String> = []
    @State private var expanded: Set<String> = []
    @State private var isWorking = false
    @State private var prepared = false

    private var role: TenantRole? { roleId.flatMap { context.store.role($0) } }

    var body: some View {
        TeamSheet(eyebrow: context.tenantName, title: role == nil ? L10n.t("team.role.new") : L10n.t("team.role.edit")) {
            PFTextField(L10n.t("team.role.name"), text: $name, systemImage: "shield.lefthalf.filled")
            PFTextField(L10n.t("team.role.description"), text: $summary, systemImage: "text.alignleft", axis: .vertical)
            TeamSwatchPicker(L10n.t("team.color"), selection: $color)
            PFSectionHeader(L10n.t("team.role.permissions")) {
                Text(L10n.t("team.role.counts", ["allowed": allow.count, "denied": deny.count])).pfText(.caption).foregroundStyle(PFColor.textMuted)
            }
            HStack(spacing: PFSpace.xs) {
                PFButton(L10n.t("team.role.allowAll"), kind: .secondary, size: .small) { allow = Set(TeamPermissionCatalog.allKeys); deny = [] }
                PFButton(L10n.t("team.role.denyAll"), kind: .secondary, size: .small) { deny = Set(TeamPermissionCatalog.allKeys); allow = [] }
                PFButton(L10n.t("team.role.reset"), kind: .ghost, size: .small) { allow = []; deny = [] }
            }
            VStack(spacing: PFSpace.xs) {
                ForEach(TeamPermissionCatalog.groups) { group in groupView(group) }
            }
            if let role {
                PFButton(L10n.t("team.role.delete"), kind: .danger, size: .large, fullWidth: true) { confirmDelete(role) }
            }
        }
        .pfSheetFooter([isWorking, name.trimmingCharacters(in: .whitespaces).isEmpty]) {
            PFButton(isWorking ? L10n.t("common.loading") : L10n.t("common.save"), size: .large, fullWidth: true) { save() }
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isWorking)
                .padding(.horizontal, PFSpace.page)
        }
        .onAppear {
            guard !prepared else { return }
            prepared = true
            if let role {
                name = role.name
                summary = role.summary
                color = role.color
                allow = Set(role.allow)
                deny = Set(role.deny)
            } else {
                allow = Set(TeamPermissionCatalog.memberDefaults)
            }
        }
    }

    private func groupView(_ group: TeamPermissionCatalog.Group) -> some View {
        let isOpen = expanded.contains(group.id)
        let allowed = group.nodes.filter { allow.contains($0.key) }.count
        return VStack(spacing: 0) {
            Button {
                PFHaptics.selection()
                if isOpen { expanded.remove(group.id) } else { expanded.insert(group.id) }
            } label: {
                HStack {
                    Text(group.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                    Spacer()
                    Text("\(allowed)/\(group.nodes.count)").pfText(.caption).foregroundStyle(PFColor.textMuted)
                    Image(systemName: isOpen ? "chevron.up" : "chevron.down").font(.system(size: 12, weight: .semibold)).foregroundStyle(PFColor.textSubtle)
                }
                .padding(.horizontal, PFSpace.m).frame(minHeight: 52).contentShape(.rect)
            }
            .buttonStyle(.pfPressable)
            if isOpen {
                ForEach(group.nodes) { node in
                    TeamTriState(title: node.key, subtitle: node.text, value: state(node.key), allowLabel: L10n.t("team.role.allow"),
                                 inheritLabel: L10n.t("team.role.inherit"), denyLabel: L10n.t("team.role.deny")) { set(node.key, $0) }
                }
            }
        }
        .background(PFColor.card, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
    }

    private func state(_ key: String) -> TeamTriState.Value {
        allow.contains(key) ? .allow : deny.contains(key) ? .deny : .inherit
    }

    private func set(_ key: String, _ value: TeamTriState.Value) {
        allow.remove(key)
        deny.remove(key)
        switch value {
        case .allow: allow.insert(key)
        case .deny: deny.insert(key)
        case .inherit: break
        }
    }

    private func save() {
        isWorking = true
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        let maxPosition = context.store.roles.filter { !$0.isSystem }.map(\.position).max() ?? 0
        Task {
            defer { isWorking = false }
            do {
                try await context.actions.saveRole(id: roleId, name: trimmed, color: color, summary: summary, allow: allow.sorted(), deny: deny.sorted(),
                                                   position: maxPosition + 10)
                PFHaptics.success()
                presenter.dismiss()
            } catch {
                teamFail(model, error)
            }
        }
    }

    private func confirmDelete(_ role: TenantRole) {
        let assigned = context.store.memberships.values.filter { $0.roleIds.contains(role.id) }.map(\.uid)
        presenter.dismiss()
        Task {
            try? await Task.sleep(for: .milliseconds(380))
            model.presenter.present(detents: [.fit]) {
                ConfirmSheet(title: L10n.t("team.role.delete"), message: L10n.t("team.role.deleteMessage", ["name": role.name]), confirmTitle: L10n.t("common.delete")) {
                    Task {
                        do { try await context.actions.deleteRole(role.id, assignedTo: assigned) } catch { teamFail(model, error) }
                    }
                }
            }
        }
    }
}
