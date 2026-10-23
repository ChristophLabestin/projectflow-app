import SwiftUI
import AuthenticationServices
import FirebaseAuth
import FirebaseFirestore
import PFData
import PFDesign

/// Sicherheit: linked sign-in methods, Apple linking, passkeys and the (read-only) two-factor status.
struct SecuritySettingsScreen: View {
    private struct PasskeyEntry: Identifiable, Hashable {
        let id: String
        let label: String
        let createdAt: Date?
    }

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @Environment(\.openURL) private var openURL
    @State private var passkeys: [PasskeyEntry] = []
    @State private var passkeysLoaded = false
    @State private var isWorking = false

    private var providers: [String] { model.auth.providerIDs }
    private var hasApple: Bool { providers.contains("apple.com") }

    @State private var factorRefresh = 0

    private var hasTOTP: Bool {
        _ = factorRefresh
        return AccountSecurity.hasTOTP
    }

    var body: some View {
        SettingsScaffold(title: L10n.t("account.security")) {
            PFSectionHeader(L10n.t("security.password.section"))
            SettingsCard(footer: model.auth.providerIDs.contains("password") ? nil : L10n.t("security.password.setFooter")) {
                SettingsRow(systemImage: "lock.rotation", title: model.auth.providerIDs.contains("password") ? L10n.t("security.password.change") : L10n.t("security.password.set")) {
                    presenter.present(detents: [.large]) { PasswordSheet { refreshProviders() } }
                }
            }

            PFSectionHeader(L10n.t("security.methods"))
            SettingsCard(footer: L10n.t("security.methods.footer")) {
                ForEach(providers, id: \.self) { provider in
                    SettingsRow(systemImage: Self.icon(provider), title: Self.name(provider), subtitle: provider == "password" ? model.auth.email : nil, showsChevron: false) {
                        if providers.count > 1 {
                            PFButton(L10n.t("security.unlink"), kind: .ghost, size: .small) { confirmUnlink(provider) }
                        } else {
                            SettingsStateLabel(text: L10n.t("security.linked"), tone: .good)
                        }
                    }
                }
                if !hasApple {
                    SettingsRow(systemImage: "apple.logo", title: L10n.t("security.apple.link"), showsChevron: true, action: linkApple)
                }
                if !providers.contains("github.com") {
                    SettingsRow(systemImage: "chevron.left.forwardslash.chevron.right", title: L10n.t("security.github.link"), action: linkGitHub)
                }
                if !providers.contains("google.com") {
                    SettingsRow(systemImage: "globe", title: L10n.t("security.google.link"), subtitle: L10n.t("security.web.subtitle")) { openWeb() }
                }
            }

            PFSectionHeader(L10n.t("settings.security.passkeys.title"))
            SettingsCard(footer: L10n.t("settings.security.passkeys.description")) {
                if !passkeysLoaded {
                    PFSkeleton(height: 20).padding(PFSpace.m)
                }
                ForEach(passkeys) { passkey in
                    SettingsRow(systemImage: "person.badge.key", title: passkey.label, subtitle: passkey.createdAt.map { L10n.t("settings.security.passkeys.addedDate", ["date": $0.formatted(.dateTime.day().month(.abbreviated).year().locale(L10n.locale))]) },
                                showsChevron: false, action: { rename(passkey) }) {
                        PFIconButton("trash", label: L10n.t("settings.security.passkeys.delete.title"), style: .raised, size: 34) { confirmDelete(passkey) }
                    }
                }
                SettingsRow(systemImage: "plus", title: L10n.t("settings.security.passkeys.addButton"), action: addPasskey)
            }

            PFSectionHeader(L10n.t("security.twoFactor"))
            SettingsCard(footer: L10n.t("security.twoFactor.footer")) {
                SettingsRow(systemImage: "lock.shield", title: L10n.t("settings.security.twoFactor.title"), showsChevron: false) {
                    SettingsStateLabel(text: hasTOTP ? L10n.t("settings.security.twoFactor.enabled") : L10n.t("security.twoFactor.off"), tone: hasTOTP ? .good : .warning)
                }
                if hasTOTP {
                    SettingsRow(systemImage: "lock.open", title: L10n.t("security.totp.disable"), role: .danger, showsChevron: false) { confirmDisable() }
                } else {
                    SettingsRow(systemImage: "qrcode", title: L10n.t("security.totp.setup")) {
                        presenter.present(detents: [.large]) { TotpEnrollSheet { factorRefresh += 1 } }
                    }
                }
            }
        }
        .task { await loadPasskeys() }
    }

    private func openWeb() {
        if let url = URL(string: "https://\(SharedConstants.webHost)/profile") { openURL(url) }
    }

    private func refreshProviders() {
        model.auth.refreshProviders()
        factorRefresh += 1
    }

    private func linkGitHub() {
        Task {
            do {
                try await AccountSecurity.linkGitHub()
                model.auth.refreshProviders()
                PFHaptics.success()
                model.toasts.show(PFToast(L10n.t("security.github.linked"), style: .success))
            } catch {
                if (error as NSError).code != ASWebAuthenticationSessionError.canceledLogin.rawValue {
                    model.toasts.show(PFToast(AuthErrorText.message(for: error), style: .error))
                }
            }
        }
    }

    private func confirmUnlink(_ provider: String) {
        presenter.present(detents: [.fit]) {
            ConfirmSheet(title: L10n.t("security.unlink.title", ["provider": Self.name(provider)]), message: L10n.t("security.unlink.message", ["provider": Self.name(provider)]),
                         confirmTitle: L10n.t("security.unlink")) {
                Task {
                    do {
                        try await AccountSecurity.unlink(provider: provider)
                        refreshProviders()
                        PFHaptics.success()
                    } catch {
                        if Reauth.isRecentLoginError(error) {
                            try? await Task.sleep(for: .milliseconds(380))
                            presenter.present(detents: [.fit]) { ReauthSheet { confirmUnlink(provider) } }
                        } else {
                            model.toasts.show(PFToast(AuthErrorText.message(for: error), style: .error))
                        }
                    }
                }
            }
        }
    }

    private func confirmDisable() {
        presenter.present(detents: [.fit]) {
            ConfirmSheet(title: L10n.t("security.totp.disable"), message: L10n.t("security.totp.disableMessage"), confirmTitle: L10n.t("security.totp.disableConfirm")) {
                Task {
                    do {
                        try await AccountSecurity.disableTOTP()
                        factorRefresh += 1
                        PFHaptics.success()
                    } catch {
                        if Reauth.isRecentLoginError(error) {
                            try? await Task.sleep(for: .milliseconds(380))
                            presenter.present(detents: [.fit]) { ReauthSheet { confirmDisable() } }
                        } else {
                            model.toasts.show(PFToast(AuthErrorText.message(for: error), style: .error))
                        }
                    }
                }
            }
        }
    }

    private func rename(_ passkey: PasskeyEntry) {
        presenter.present(detents: [.fit]) {
            PasskeyRenameSheet(passkeyId: passkey.id, label: passkey.label) { newLabel in
                if let index = passkeys.firstIndex(where: { $0.id == passkey.id }) {
                    passkeys[index] = PasskeyEntry(id: passkey.id, label: newLabel, createdAt: passkey.createdAt)
                }
            }
        }
    }

    // MARK: Providers

    private static func name(_ provider: String) -> String {
        switch provider {
        case "password": L10n.t("security.provider.password")
        case "apple.com": "Apple"
        case "google.com": "Google"
        case "github.com": "GitHub"
        case "phone": L10n.t("security.provider.phone")
        default: provider
        }
    }

    private static func icon(_ provider: String) -> String {
        switch provider {
        case "password": "envelope"
        case "apple.com": "apple.logo"
        case "phone": "phone"
        case "github.com": "chevron.left.forwardslash.chevron.right"
        case "google.com": "globe"
        default: "person.crop.circle"
        }
    }

    private func linkApple() {
        Task {
            do {
                try await AppleSignInCoordinator().link(auth: model.auth)
                PFHaptics.success()
                model.toasts.show(PFToast(L10n.t("security.apple.linked"), style: .success))
            } catch {
                if (error as NSError).code != ASAuthorizationError.canceled.rawValue {
                    model.toasts.show(PFToast(AuthErrorText.message(for: error), style: .error))
                }
            }
        }
    }

    // MARK: Passkeys

    private func loadPasskeys() async {
        guard let uid = model.uid else { return }
        let snapshot = try? await PFFirebase.db.collection("users").document(uid).collection("passkeys").getDocuments()
        passkeys = (snapshot?.documents ?? []).map { doc in
            PasskeyEntry(id: doc.documentID, label: (doc.data()["label"] as? String) ?? "Passkey",
                         createdAt: (doc.data()["createdAt"] as? Timestamp)?.dateValue())
        }
        .sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
        passkeysLoaded = true
    }

    private func addPasskey() {
        guard !isWorking else { return }
        isWorking = true
        Task {
            defer { isWorking = false }
            do {
                try await PasskeyRegistrationCoordinator().register()
                PFHaptics.success()
                model.toasts.show(PFToast(L10n.t("settings.security.passkeys.toast.added"), style: .success))
                await loadPasskeys()
            } catch {
                if (error as NSError).code != ASAuthorizationError.canceled.rawValue {
                    model.toasts.show(PFToast(L10n.t("settings.security.passkeys.toast.error"), style: .error))
                }
            }
        }
    }

    private func confirmDelete(_ passkey: PasskeyEntry) {
        presenter.present(detents: [.fit]) {
            ConfirmSheet(title: L10n.t("settings.security.passkeys.delete.title"), message: L10n.t("settings.security.passkeys.delete.message", ["label": passkey.label]),
                         confirmTitle: L10n.t("common.delete")) {
                guard let uid = model.uid else { return }
                Task {
                    do {
                        try await PFFirebase.db.collection("users").document(uid).collection("passkeys").document(passkey.id).delete()
                        passkeys.removeAll { $0.id == passkey.id }
                        model.toasts.show(PFToast(L10n.t("settings.security.passkeys.toast.deleted")))
                    } catch {
                        model.toasts.show(PFToast(L10n.t("common.error"), style: .error))
                    }
                }
            }
        }
    }
}

/// Custom confirmation sheet for destructive actions (no system alerts).
struct ConfirmSheet: View {
    let title: String
    let message: String
    let confirmTitle: String
    let onConfirm: () -> Void
    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title).pfText(.section).foregroundStyle(PFColor.textMain)
                Text(message).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: PFSpace.xs) {
                PFButton(L10n.t("common.cancel"), kind: .ghost, size: .large, fullWidth: true) { presenter.dismiss() }
                PFButton(confirmTitle, kind: .danger, size: .large, fullWidth: true) {
                    presenter.dismiss()
                    onConfirm()
                }
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.bottom, PFSpace.l)
    }
}
