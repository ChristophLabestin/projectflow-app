import SwiftUI
import PFData
import PFDesign
import PFModel

/// Invite to the workspace by e-mail or link (web `InviteToWorkspaceModal`): role, optional projects,
/// link limits. E-mail invites go through `sendInvitation`; the link always works.
struct InviteSheet: View {
    enum Mode: Hashable { case email, link }

    let context: TeamContext
    var presetProjectIds: [String] = []
    var presetRole: WorkspaceRole?
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var mode: Mode = .email
    @State private var email = ""
    @State private var role: WorkspaceRole = .member
    @State private var projectIds: Set<String> = []
    @State private var maxUses = 0
    @State private var isWorking = false
    @State private var createdURL: URL?

    private var isValid: Bool {
        mode == .link || (email.contains("@") && email.contains(".") && !email.hasSuffix("."))
    }

    var body: some View {
        TeamSheet(eyebrow: context.tenantName, title: L10n.t("team.invite.title")) {
            if let createdURL {
                created(createdURL)
            } else {
                form
            }
        }
        .onAppear {
            projectIds = Set(presetProjectIds)
            if let presetRole, context.inviteRoles.contains(presetRole) { role = presetRole }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFSegmented([(value: Mode.email, label: L10n.t("team.invite.byEmail")), (value: Mode.link, label: L10n.t("team.invite.byLink"))], selection: $mode)
            if mode == .email {
                PFTextField(L10n.t("team.invite.emailPlaceholder"), text: $email, systemImage: "envelope", submitLabel: .done)
                    .textInputAutocapitalization(.never).keyboardType(.emailAddress).autocorrectionDisabled()
            } else {
                PFSegmented([(value: 0, label: L10n.t("team.invite.unlimited")), (value: 1, label: "1"), (value: 10, label: "10"), (value: 50, label: "50")],
                            selection: $maxUses)
                Text(L10n.t("team.invite.maxUses")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
            PFSectionHeader(L10n.t("team.invite.role"))
            PFCardList {
                ForEach(context.inviteRoles, id: \.self) { candidate in
                    TeamChoiceRow(title: AccountLogic.roleLabel(candidate), subtitle: L10n.t("team.role.hint.\(roleKey(candidate))"), isSelected: role == candidate) {
                        role = candidate
                    }
                }
            }
            let projects = model.workspace?.projects ?? []
            if !projects.isEmpty {
                PFSectionHeader(L10n.t("team.invite.projects"))
                Text(role == .guest ? L10n.t("team.invite.projects.guest") : L10n.t("team.invite.projects.hint"))
                    .pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
                PFCardList {
                    ForEach(projects) { project in
                        TeamChoiceRow(title: project.title, isSelected: projectIds.contains(project.id)) {
                            if projectIds.contains(project.id) { projectIds.remove(project.id) } else { projectIds.insert(project.id) }
                        }
                    }
                }
            }
            PFButton(isWorking ? L10n.t("common.loading") : (mode == .email ? L10n.t("team.invite.send") : L10n.t("team.invite.createLink")),
                     size: .large, fullWidth: true) { submit() }
                .disabled(!isValid || isWorking)
        }
    }

    private func created(_ url: URL) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            Text(L10n.t("team.invite.linkReady")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            Text(url.absoluteString).pfText(.meta).foregroundStyle(PFColor.textMain).textSelection(.enabled)
                .padding(PFSpace.s).frame(maxWidth: .infinity, alignment: .leading)
                .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
            HStack(spacing: PFSpace.xs) {
                PFButton(L10n.t("team.invite.copy"), systemImage: "doc.on.doc", kind: .secondary, size: .large, fullWidth: true) {
                    TeamLogic.copy(url.absoluteString)
                    model.toasts.show(PFToast(L10n.t("team.invite.copied"), style: .success))
                }
                PFButton(L10n.t("team.invite.share"), systemImage: "square.and.arrow.up", size: .large, fullWidth: true) { TeamLogic.share([url]) }
            }
            PFButton(L10n.t("common.done"), kind: .ghost, size: .large, fullWidth: true) { presenter.dismiss() }
        }
    }

    private func roleKey(_ role: WorkspaceRole) -> String {
        switch role {
        case .admin: "admin"
        case .guest: "guest"
        default: "member"
        }
    }

    private func submit() {
        guard !isWorking else { return }
        isWorking = true
        Task {
            defer { isWorking = false }
            do {
                let id = try await context.actions.createInvitation(
                    kind: mode == .email ? .email : .link, email: email, role: roleRaw(role), tenantName: context.tenantName,
                    inviterName: context.inviterName, projectIds: Array(projectIds), maxUses: maxUses == 0 ? nil : maxUses,
                    language: L10n.locale.language.languageCode?.identifier ?? "de")
                PFHaptics.success()
                if mode == .email {
                    model.toasts.show(PFToast(L10n.t("team.invite.sent", ["email": email]), style: .success))
                    presenter.dismiss()
                } else {
                    createdURL = context.inviteURL(id)
                }
            } catch {
                teamFail(model, error)
            }
        }
    }

    private func roleRaw(_ role: WorkspaceRole) -> String {
        switch role {
        case .admin: "Admin"
        case .guest: "Guest"
        default: "Member"
        }
    }
}

/// A pending invitation: link actions and revoke.
struct InvitationSheet: View {
    let context: TeamContext
    let invitation: TeamInvitation
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        TeamSheet(eyebrow: TeamLogic.roleLabel(invitation.role), title: invitation.email ?? L10n.t("team.invite.linkTitle")) {
            VStack(alignment: .leading, spacing: PFSpace.m) {
                Text(TeamLogic.expiryText(invitation)).pfText(.meta).foregroundStyle(PFColor.textMuted)
                if invitation.kind == .link {
                    Text(L10n.t("team.invite.uses", ["uses": invitation.uses, "max": invitation.maxUses.map(String.init) ?? "∞"]))
                        .pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
                if let url = context.inviteURL(invitation.id) {
                    HStack(spacing: PFSpace.xs) {
                        PFButton(L10n.t("team.invite.copy"), systemImage: "doc.on.doc", kind: .secondary, size: .large, fullWidth: true) {
                            TeamLogic.copy(url.absoluteString)
                            model.toasts.show(PFToast(L10n.t("team.invite.copied"), style: .success))
                        }
                        PFButton(L10n.t("team.invite.share"), systemImage: "square.and.arrow.up", size: .large, fullWidth: true) { TeamLogic.share([url]) }
                    }
                }
                PFButton(L10n.t("team.invite.revoke"), kind: .danger, size: .large, fullWidth: true) { revoke() }
            }
        }
    }

    private func revoke() {
        Task {
            do {
                try await context.actions.revokeInvitation(invitation.id)
                PFHaptics.success()
                presenter.dismiss()
                model.toasts.show(PFToast(L10n.t("team.invite.revoked")))
            } catch {
                teamFail(model, error)
            }
        }
    }
}
