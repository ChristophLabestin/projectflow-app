import SwiftUI
import PFData
import PFDesign
import PFModel

/// Workspace settings from Account: profile fields (`tenants/{t}`), roles/groups entries, leave, transfer
/// ownership and delete. SMTP, storage, API tokens and MCP stay on the web.
struct WorkspaceSettingsScreen: View {
    var body: some View { TeamHost { context in WorkspaceSettingsContent(context: context) } }
}

private struct WorkspaceSettingsContent: View {
    let context: TeamContext
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var draft = WorkspaceProfile()
    @State private var prepared = false
    @State private var isSaving = false

    private var isDirty: Bool {
        let p = context.store.profile
        return draft.name != p.name || draft.summary != p.summary || draft.website != p.website || draft.contactEmail != p.contactEmail
    }

    var body: some View {
        SettingsScaffold(title: L10n.t("team.workspaceSettings"), subtitle: context.tenantName) {
            PFSectionHeader(L10n.t("team.ws.profile"))
            VStack(spacing: PFSpace.xs) {
                PFTextField(L10n.t("team.ws.name"), text: $draft.name, systemImage: "square.stack.3d.up")
                PFTextField(L10n.t("team.ws.description"), text: $draft.summary, systemImage: "text.alignleft", axis: .vertical)
                PFTextField(L10n.t("team.ws.website"), text: $draft.website, systemImage: "globe")
                    .textInputAutocapitalization(.never).keyboardType(.URL).autocorrectionDisabled()
                PFTextField(L10n.t("team.ws.contact"), text: $draft.contactEmail, systemImage: "envelope")
                    .textInputAutocapitalization(.never).keyboardType(.emailAddress).autocorrectionDisabled()
            }
            .disabled(!context.canAdmin)
            if context.canAdmin {
                PFButton(isSaving ? L10n.t("common.loading") : L10n.t("common.save"), size: .large, fullWidth: true) { save() }
                    .disabled(!isDirty || draft.name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                    .padding(.top, PFSpace.xs)
            } else {
                Text(L10n.t("team.ws.readonly")).pfText(.meta).foregroundStyle(PFColor.textMuted).padding(.top, PFSpace.xs)
            }

            PFSectionHeader(L10n.t("team.manage"))
            SettingsCard {
                SettingsRow(systemImage: "person.2", title: L10n.t("account.team")) { model.router.push(.team) }
                SettingsRow(systemImage: "person.3", title: L10n.t("team.groups")) { model.router.push(.accountPage(.groups)) }
                if context.canAdmin {
                    SettingsRow(systemImage: "shield.lefthalf.filled", title: L10n.t("team.roles")) { model.router.push(.accountPage(.roles)) }
                }
            }

            PFSectionHeader(L10n.t("team.ws.web"))
            SettingsCard(footer: L10n.t("team.ws.webFooter")) {
                SettingsRow(systemImage: "safari", title: L10n.t("team.ws.webRow")) {
                    if let url = URL(string: "https://\(SharedConstants.webHost)/team") { openURL(url) }
                }
            }

            PFSectionHeader(L10n.t("team.ws.danger"))
            SettingsCard(footer: context.isOwner ? L10n.t("team.ws.ownerFooter") : L10n.t("team.ws.leaveFooter")) {
                if context.isOwner {
                    SettingsRow(systemImage: "arrow.left.arrow.right", title: L10n.t("account.delete.transfer")) { presentTransfer() }
                    SettingsRow(systemImage: "trash", title: L10n.t("account.delete.deleteWorkspace"), role: .danger) { presentDelete() }
                } else {
                    SettingsRow(systemImage: "rectangle.portrait.and.arrow.right", title: L10n.t("team.ws.leave"), role: .danger, showsChevron: false) { confirmLeave() }
                }
            }
        }
        .onAppear { prepare() }
        .onChange(of: context.store.loaded) { _, _ in prepare() }
    }

    private func prepare() {
        guard !prepared, context.store.loaded.contains("tenant") else { return }
        prepared = true
        draft = context.store.profile
    }

    private func save() {
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                try await context.actions.updateWorkspace(draft)
                PFHaptics.success()
                await model.session?.reloadWorkspaces()
                model.toasts.show(PFToast(L10n.t("team.ws.saved"), style: .success))
            } catch {
                teamFail(model, error)
            }
        }
    }

    private func confirmLeave() {
        model.presenter.present(detents: [.fit]) {
            ConfirmSheet(title: L10n.t("team.ws.leave"), message: L10n.t("team.ws.leaveMessage", ["name": context.tenantName]),
                         confirmTitle: L10n.t("team.ws.leaveConfirm")) {
                Task {
                    do {
                        try await context.actions.leaveWorkspace()
                        PFHaptics.success()
                        await model.refreshAfterWorkspaceLoss()
                    } catch {
                        teamFail(model, error)
                    }
                }
            }
        }
    }

    private func presentTransfer() {
        model.presenter.present(detents: [.large]) { WorkspaceTransferSheet(context: context) }
    }

    private func presentDelete() {
        model.presenter.present(detents: [.large]) { WorkspaceDeleteSheet(context: context) }
    }
}

/// Transfer the workspace to another full member (`transferWorkspaceOwnership`).
struct WorkspaceTransferSheet: View {
    let context: TeamContext
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var isWorking = false

    private var candidates: [Person] { TeamLogic.sorted(context.people.values.filter { $0.id != context.uid && $0.role != .guest }) }

    var body: some View {
        TeamSheet(eyebrow: context.tenantName, title: L10n.t("account.delete.transfer")) {
            Text(L10n.t("account.delete.transferMessage")).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            if candidates.isEmpty {
                Text(L10n.t("team.ws.noCandidates")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            } else {
                PFCardList {
                    ForEach(candidates) { person in
                        TeamPersonRow(person: person, subtitle: person.role.map(AccountLogic.roleLabel), action: { transfer(to: person) })
                            .disabled(isWorking)
                    }
                }
            }
        }
    }

    private func transfer(to person: Person) {
        isWorking = true
        Task {
            defer { isWorking = false }
            do {
                try await context.actions.transferOwnership(to: person.id)
                PFHaptics.success()
                await model.session?.reloadWorkspaces()
                presenter.dismiss()
                model.toasts.show(PFToast(L10n.t("team.ws.transferred", ["name": person.displayName]), style: .success))
            } catch {
                model.toasts.show(PFToast(L10n.t("account.delete.failed"), style: .error))
            }
        }
    }
}

/// Delete the workspace after typing its name (`deleteWorkspace`).
struct WorkspaceDeleteSheet: View {
    let context: TeamContext
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var confirmName = ""
    @State private var isWorking = false

    var body: some View {
        TeamSheet(eyebrow: context.tenantName, title: L10n.t("account.delete.deleteWorkspace")) {
            Text(L10n.t("account.delete.deleteWorkspaceMessage", ["name": context.tenantName, "count": context.people.count]))
                .pfText(.body).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            PFTextField(context.tenantName, text: $confirmName, systemImage: "character.cursor.ibeam")
            PFButton(isWorking ? L10n.t("common.loading") : L10n.t("account.delete.deleteWorkspaceConfirm"), kind: .danger, size: .large, fullWidth: true) { delete() }
                .disabled(confirmName.trimmingCharacters(in: .whitespaces) != context.tenantName.trimmingCharacters(in: .whitespaces) || isWorking)
        }
    }

    private func delete() {
        isWorking = true
        Task {
            defer { isWorking = false }
            do {
                try await context.actions.deleteWorkspace(confirmName: confirmName.trimmingCharacters(in: .whitespaces))
                PFHaptics.success()
                presenter.dismiss()
                await model.refreshAfterWorkspaceLoss()
            } catch {
                model.toasts.show(PFToast(L10n.t("account.delete.failed"), style: .error))
            }
        }
    }
}
