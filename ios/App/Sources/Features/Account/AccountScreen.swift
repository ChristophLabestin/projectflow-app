import SwiftUI
import PFData
import PFDesign
import PFModel

/// Konto (route `.account`): profile, workspaces, settings entries, export, legal, sign out, delete.
struct AccountScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL

    private var profile: UserProfile? { model.profile }
    private var session: SessionStore? { model.session }

    var body: some View {
        SettingsScaffold(title: L10n.t("account.title")) {
            Button { model.router.push(.accountPage(.profile)) } label: {
                profileHeader.padding(.top, PFSpace.l).contentShape(.rect)
            }
            .buttonStyle(.pfPressable)
            .accessibilityHint(L10n.t("profile.edit"))
            PFSectionHeader(L10n.t("account.workspaces"))
            workspaceCard
            PFSectionHeader(L10n.t("account.settings"))
            settingsCard
            PFSectionHeader(L10n.t("account.data"))
            dataCard
            PFSectionHeader(L10n.t("account.legal"))
            legalCard
            PFSectionHeader(L10n.t("account.session"))
            sessionCard
            Text(versionText)
                .pfText(.caption)
                .foregroundStyle(PFColor.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.top, PFSpace.xl)
        }
    }

    // MARK: Profile

    private var profileHeader: some View {
        HStack(spacing: PFSpace.m) {
            PFAvatar(name: profile?.displayName ?? model.auth.displayName ?? "?", seed: model.uid, imageURL: profile?.photoURL, size: 72)
            VStack(alignment: .leading, spacing: 4) {
                Text(profile?.displayName ?? model.auth.displayName ?? "—").pfText(.title).foregroundStyle(PFColor.textMain)
                    .lineLimit(2).minimumScaleFactor(0.8)
                Text(profile?.email ?? model.auth.email ?? "").pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                if let role = session?.activeWorkspace?.role {
                    PFPill(AccountLogic.roleLabel(role), compact: true).padding(.top, 2)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(PFColor.textSubtle)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Workspaces

    private var workspaceCard: some View {
        SettingsCard {
            ForEach(session?.workspaces ?? []) { workspace in
                SettingsRow(systemImage: "square.stack.3d.up", title: workspace.name, subtitle: AccountLogic.roleLabel(workspace.role),
                            showsChevron: false, action: { switchTo(workspace) }) {
                    if workspace.id == session?.activeWorkspaceId {
                        Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(PFColor.textMain)
                    }
                }
                .accessibilityAddTraits(workspace.id == session?.activeWorkspaceId ? .isSelected : [])
            }
            SettingsRow(systemImage: "gearshape", title: L10n.t("team.workspaceSettings")) { model.router.push(.accountPage(.workspaceSettings)) }
            SettingsRow(systemImage: "plus", title: L10n.t("account.newWorkspace")) { presentCreateWorkspace() }
        }
    }

    private func switchTo(_ workspace: SessionStore.WorkspaceSummary) {
        guard workspace.id != session?.activeWorkspaceId else { return }
        PFHaptics.selection()
        model.switchWorkspace(to: workspace.id)
    }

    private func presentCreateWorkspace() {
        model.presenter.present(detents: [.fit]) { CreateWorkspaceSheet() }
    }

    // MARK: Settings and data

    private var settingsCard: some View {
        SettingsCard {
            SettingsRow(systemImage: "circle.lefthalf.filled", title: L10n.t("account.appearance"),
                        subtitle: AccountLogic.appearanceSummary(profile)) { model.router.push(.appearanceSettings) }
            SettingsRow(systemImage: "person.crop.circle", title: L10n.t("profile.title")) { model.router.push(.accountPage(.profile)) }
            SettingsRow(systemImage: "bell", title: L10n.t("account.notifications")) { model.router.push(.notificationSettings) }
            SettingsRow(systemImage: "lock.shield", title: L10n.t("account.security")) { model.router.push(.securitySettings) }
            SettingsRow(systemImage: "person.2", title: L10n.t("account.team")) { model.router.push(.team) }
        }
    }

    private var dataCard: some View {
        SettingsCard(footer: L10n.t("account.export.footer")) {
            SettingsRow(systemImage: "square.and.arrow.up", title: L10n.t("account.export")) { Task { await DataExport.run(model: model) } }
            SettingsRow(systemImage: "safari", title: L10n.t("account.openWorkspaceWeb")) { openWeb("/profile") }
        }
    }

    private var legalCard: some View {
        SettingsCard {
            SettingsRow(systemImage: "hand.raised", title: L10n.t("account.privacy")) { openWeb("/legal/privacy") }
            SettingsRow(systemImage: "doc.text", title: L10n.t("account.terms")) { openWeb("/legal/terms") }
            SettingsRow(systemImage: "building.2", title: L10n.t("account.imprint")) { openWeb("/legal/impressum") }
        }
    }

    private var sessionCard: some View {
        SettingsCard {
            SettingsRow(systemImage: "rectangle.portrait.and.arrow.right", title: L10n.t("shell.signOut"), showsChevron: false) { signOut() }
            SettingsRow(systemImage: "trash", title: L10n.t("account.delete"), role: .danger) {
                model.presenter.present(detents: [.large]) { AccountDeletionSheet() }
            }
        }
    }

    private func openWeb(_ path: String) {
        if let url = URL(string: "https://\(SharedConstants.webHost)\(path)") { openURL(url) }
    }

    private func signOut() {
        let uid = model.uid
        Task {
            await PushRegistrar.shared.signOut()
            if let uid { SearchRecents.erase(uid: uid) }
            model.auth.signOut()
        }
    }

    private var versionText: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return L10n.t("account.version", ["version": version, "build": build])
    }
}

/// Labels shared by the account screens.
enum AccountLogic {
    static func roleLabel(_ role: WorkspaceRole) -> String {
        switch role {
        case .owner: L10n.t("role.owner")
        case .admin: L10n.t("role.admin")
        case .member: L10n.t("role.member")
        case .guest: L10n.t("role.guest")
        case .custom(let name): name
        }
    }

    static func appearanceSummary(_ profile: UserProfile?) -> String {
        let theme: String = switch profile?.theme {
        case "light": L10n.t("account.theme.light")
        case "dark": L10n.t("account.theme.dark")
        default: L10n.t("account.theme.system")
        }
        return theme
    }
}

/// Sheet to create a workspace (owner of the new one, like on the web).
struct CreateWorkspaceSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var name = ""
    @State private var isWorking = false

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            VStack(alignment: .leading, spacing: 4) {
                PFEyebrow(L10n.t("account.workspaces"))
                Text(L10n.t("account.newWorkspace")).pfText(.section).foregroundStyle(PFColor.textMain)
            }
            PFTextField(L10n.t("account.workspaceName"), text: $name, systemImage: "square.stack.3d.up", submitLabel: .done) { create() }
            PFButton(isWorking ? L10n.t("common.loading") : L10n.t("account.createWorkspace"), size: .large, fullWidth: true) { create() }
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isWorking)
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.bottom, PFSpace.l)
    }

    private func create() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !isWorking, let session = model.session else { return }
        isWorking = true
        Task {
            do {
                let id = try await session.createWorkspace(name: trimmed)
                await session.reloadWorkspaces()
                presenter.dismiss()
                model.switchWorkspace(to: id)
            } catch {
                model.toasts.show(PFToast(L10n.t("common.error"), style: .error))
                isWorking = false
            }
        }
    }
}
