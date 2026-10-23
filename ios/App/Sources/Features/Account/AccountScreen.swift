import SwiftUI
import PFData
import PFDesign
import PFModel

/// Konto (route `.account`): who you are, where you work, how the app behaves — then data, legal, sign out.
/// iPhone: one column. Opened iPhone Duo (`pfIsWide`): identity + workspaces left, settings + data right.
struct AccountScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @Environment(\.pfIsWide) private var isWide
    @Environment(\.pfSideRegionWidth) private var sideRegion

    private var profile: UserProfile? { model.profile }
    private var session: SessionStore? { model.session }
    private var displayName: String { profile?.displayName ?? model.auth.displayName ?? "—" }

    var body: some View {
        VStack(spacing: 0) {
            PFTopBar(backLabel: L10n.t("common.back"), onBack: model.router.isDeep ? { model.router.pop() } : nil) {}
            ScrollView {
                Group {
                    if isWide {
                        HStack(alignment: .top, spacing: PFSpace.xl) {
                            VStack(alignment: .leading, spacing: PFSpace.xl) { identity; workspaces }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            VStack(alignment: .leading, spacing: PFSpace.xl) { settingsGrid; dataCard; footer }
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: PFSpace.xl) {
                            identity
                            workspaces
                            settingsGrid
                            dataCard
                            footer
                        }
                    }
                }
                .padding(.horizontal, PFSpace.page)
                .padding(.top, PFSpace.s)
                .padding(.bottom, PFSpace.xxl)
            }
        }
        // iPhone Duo outer display: editing the profile is the page action, above back in the side column.
        .pfSideAction(sideRegion > 0 ? AnyView(
            PFIconButton("pencil", label: L10n.t("account.editProfile"), style: .primary) { model.router.push(.accountPage(.profile)) }
        ) : nil)
    }

    // MARK: Identity

    private var identity: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFEyebrow(L10n.t("account.title"))
            HStack(alignment: .center, spacing: PFSpace.m) {
                PFAvatar(name: displayName, seed: model.uid, imageURL: profile?.photoURL, size: 76)
                VStack(alignment: .leading, spacing: 4) {
                    Text(displayName).pfText(.display).foregroundStyle(PFColor.textMain)
                        .lineLimit(2).minimumScaleFactor(0.7)
                    Text(profile?.email ?? model.auth.email ?? "").pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
            if sideRegion == 0 {
                PFButton(L10n.t("account.editProfile"), systemImage: "pencil", kind: .secondary, size: .small) {
                    model.router.push(.accountPage(.profile))
                }
            }
        }
    }

    // MARK: Workspaces

    private var workspaces: some View {
        let all = session?.workspaces ?? []
        let active = all.first { $0.id == session?.activeWorkspaceId }
        let others = all.filter { $0.id != session?.activeWorkspaceId }
        return VStack(alignment: .leading, spacing: PFSpace.s) {
            PFEyebrow(L10n.t("account.currentWorkspace"))
            if let active {
                HStack(spacing: PFSpace.s) {
                    WorkspaceMonogram(name: active.name, size: 48)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(active.name).pfText(.section).foregroundStyle(PFColor.textMain).lineLimit(1)
                        PFPill(AccountLogic.roleLabel(active.role), compact: true)
                    }
                    Spacer(minLength: 0)
                    PFIconButton("gearshape", label: L10n.t("team.workspaceSettings"), style: .raised, size: 40) {
                        model.router.push(.accountPage(.workspaceSettings))
                    }
                }
                .padding(PFSpace.m)
                .pfCard()
            }
            if !others.isEmpty {
                Text(L10n.t("account.switchTo")).pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                    .padding(.top, PFSpace.xs).padding(.horizontal, 4)
            }
            SettingsCard {
                ForEach(others) { workspace in
                    Button { switchTo(workspace) } label: {
                        HStack(spacing: PFSpace.s) {
                            WorkspaceMonogram(name: workspace.name, size: 34)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(workspace.name).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                                Text(AccountLogic.roleLabel(workspace.role)).pfText(.meta).foregroundStyle(PFColor.textMuted)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "arrow.left.arrow.right").font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(PFColor.textSubtle)
                        }
                        .padding(.horizontal, PFSpace.m)
                        .frame(minHeight: 56)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                }
                SettingsRow(systemImage: "plus", title: L10n.t("account.newWorkspace"), showsChevron: false) { presentCreateWorkspace() }
            }
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

    // MARK: Settings

    private var settingsGrid: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFEyebrow(L10n.t("account.settings"))
            // Rows of two; both tiles of a row share its height even when one hint wraps.
            VStack(spacing: PFSpace.s) {
                HStack(spacing: PFSpace.s) {
                    SettingsTile(systemImage: "circle.lefthalf.filled", title: L10n.t("account.appearance"),
                                 subtitle: AccountLogic.appearanceSummary(profile)) { model.router.push(.appearanceSettings) }
                    SettingsTile(systemImage: "bell", title: L10n.t("account.notifications"),
                                 subtitle: L10n.t("account.notifications.hint")) { model.router.push(.notificationSettings) }
                }
                .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: PFSpace.s) {
                    SettingsTile(systemImage: "lock.shield", title: L10n.t("account.security"),
                                 subtitle: L10n.t("account.security.hint")) { model.router.push(.securitySettings) }
                    SettingsTile(systemImage: "person.2", title: L10n.t("account.team"),
                                 subtitle: L10n.t("account.team.hint")) { model.router.push(.team) }
                }
                .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: Data, legal, session

    private var dataCard: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFEyebrow(L10n.t("account.data"))
            SettingsCard(footer: L10n.t("account.export.footer")) {
                SettingsRow(systemImage: "square.and.arrow.up", title: L10n.t("account.export")) { Task { await DataExport.run(model: model) } }
                SettingsRow(systemImage: "safari", title: L10n.t("account.openWorkspaceWeb")) { openWeb("/profile") }
            }
        }
    }

    private var footer: some View {
        VStack(spacing: PFSpace.m) {
            PFButton(L10n.t("shell.signOut"), systemImage: "rectangle.portrait.and.arrow.right", kind: .secondary, size: .large,
                     fullWidth: true) { signOut() }
            Button {
                model.presenter.present(detents: [.large]) { AccountDeletionSheet() }
            } label: {
                Text(L10n.t("account.delete")).pfText(.buttonSmall).foregroundStyle(PFColor.dangerText)
                    .padding(.horizontal, PFSpace.m).frame(minHeight: 44).contentShape(.rect)
            }
            .buttonStyle(.pfPressable)
            HStack(spacing: PFSpace.xs) {
                legalLink(L10n.t("account.privacy"), "/legal/privacy")
                Text("·").foregroundStyle(PFColor.textSubtle)
                legalLink(L10n.t("account.terms"), "/legal/terms")
                Text("·").foregroundStyle(PFColor.textSubtle)
                legalLink(L10n.t("account.imprint"), "/legal/impressum")
            }
            .pfText(.meta)
            Text(versionText).pfText(.caption).foregroundStyle(PFColor.textSubtle)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, PFSpace.s)
    }

    private func legalLink(_ title: String, _ path: String) -> some View {
        Button { openWeb(path) } label: { Text(title).foregroundStyle(PFColor.textMuted) }
            .buttonStyle(.pfPressable)
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
