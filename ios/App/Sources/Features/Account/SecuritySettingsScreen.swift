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
    private var hasTOTP: Bool {
        (Auth.auth().currentUser?.multiFactor.enrolledFactors ?? []).contains { $0.factorID == TOTPMultiFactorID }
    }

    var body: some View {
        SettingsScaffold(title: L10n.t("account.security")) {
            PFSectionHeader(L10n.t("security.methods"))
            SettingsCard(footer: hasApple ? nil : L10n.t("security.apple.footer")) {
                ForEach(providers, id: \.self) { provider in
                    SettingsRow(systemImage: Self.icon(provider), title: Self.name(provider), subtitle: provider == "password" ? model.auth.email : nil, showsChevron: false) {
                        SettingsStateLabel(text: L10n.t("security.linked"), tone: .good)
                    }
                }
                if !hasApple {
                    SettingsRow(systemImage: "apple.logo", title: L10n.t("security.apple.link"), showsChevron: true, action: linkApple)
                }
            }

            PFSectionHeader(L10n.t("settings.security.passkeys.title"))
            SettingsCard(footer: L10n.t("settings.security.passkeys.description")) {
                if !passkeysLoaded {
                    PFSkeleton(height: 20).padding(PFSpace.m)
                }
                ForEach(passkeys) { passkey in
                    SettingsRow(systemImage: "person.badge.key", title: passkey.label, subtitle: passkey.createdAt.map { L10n.t("settings.security.passkeys.addedDate", ["date": $0.formatted(.dateTime.day().month(.abbreviated).year().locale(L10n.locale))]) },
                                showsChevron: false) {
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
                SettingsRow(systemImage: "safari", title: L10n.t("security.twoFactor.web")) {
                    if let url = URL(string: "https://\(SharedConstants.webHost)/profile") { openURL(url) }
                }
            }
        }
        .task { await loadPasskeys() }
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
