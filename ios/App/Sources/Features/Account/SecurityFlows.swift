import SwiftUI
import AuthenticationServices
import CoreImage.CIFilterBuiltins
import FirebaseAuth
import FirebaseFirestore
import PFData
import PFDesign

/// Fresh-login helpers for sensitive changes (password, second factor, unlinking).
@MainActor
enum Reauth {
    static var providers: [String] { Auth.auth().currentUser?.providerData.map(\.providerID) ?? [] }
    static var hasPassword: Bool { providers.contains("password") }

    static func isRecentLoginError(_ error: Error) -> Bool {
        let ns = error as NSError
        return ns.domain == AuthErrorDomain && ns.code == AuthErrorCode.requiresRecentLogin.rawValue
    }

    static func withPassword(_ password: String) async throws {
        try await AccountSecurity.reauthenticate(password: password)
    }

    static func withApple(auth: AuthService) async throws {
        try await AppleSignInCoordinator().signIn(auth: auth)
    }

    static func withGitHub() async throws {
        try await AccountSecurity.reauthenticateWithGitHub()
    }
}

/// Confirms the identity (password, Apple or GitHub), then runs `onDone`.
struct ReauthSheet: View {
    let onDone: () -> Void
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var password = ""
    @State private var isWorking = false
    @State private var errorText: String?

    var body: some View {
        TeamSheet(eyebrow: L10n.t("account.security"), title: L10n.t("security.reauth.title")) {
            Text(L10n.t("security.reauth.message")).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            if Reauth.hasPassword {
                PFSecureField(L10n.t("security.password.current"), text: $password, isNew: false) { run { try await Reauth.withPassword(password) } }
                PFButton(isWorking ? L10n.t("common.loading") : L10n.t("security.reauth.confirm"), size: .large, fullWidth: true) {
                    run { try await Reauth.withPassword(password) }
                }
                .disabled(password.isEmpty || isWorking)
            }
            if Reauth.providers.contains("apple.com") {
                PFButton(L10n.t("security.reauth.apple"), systemImage: "apple.logo", kind: .secondary, size: .large, fullWidth: true) {
                    run { try await Reauth.withApple(auth: model.auth) }
                }
                .disabled(isWorking)
            }
            if Reauth.providers.contains("github.com") {
                PFButton(L10n.t("security.reauth.github"), kind: .secondary, size: .large, fullWidth: true) { run { try await Reauth.withGitHub() } }
                    .disabled(isWorking)
            }
            if Reauth.providers.contains("google.com"), !Reauth.hasPassword, !Reauth.providers.contains("apple.com") {
                Text(L10n.t("security.reauth.googleWeb")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
            if let errorText { Text(errorText).pfText(.meta).foregroundStyle(PFColor.dangerText) }
        }
    }

    private func run(_ work: @escaping () async throws -> Void) {
        guard !isWorking else { return }
        isWorking = true
        errorText = nil
        Task {
            defer { isWorking = false }
            do {
                try await work()
                presenter.dismiss()
                onDone()
            } catch {
                if (error as NSError).code != ASAuthorizationError.canceled.rawValue { errorText = AuthErrorText.message(for: error) }
            }
        }
    }
}

/// Change the password, or set one for an account that signs in with Apple/GitHub/Google only.
struct PasswordSheet: View {
    let onChanged: () -> Void
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var current = ""
    @State private var next = ""
    @State private var confirm = ""
    @State private var isWorking = false
    @State private var errorText: String?

    private var hasPassword: Bool { Reauth.hasPassword }
    private var isValid: Bool { next.count >= 8 && next == confirm && (!hasPassword || !current.isEmpty) }

    var body: some View {
        TeamSheet(eyebrow: L10n.t("account.security"), title: hasPassword ? L10n.t("security.password.change") : L10n.t("security.password.set")) {
            if hasPassword {
                PFSecureField(L10n.t("security.password.current"), text: $current, isNew: false) {}
            }
            PFSecureField(L10n.t("security.password.new"), text: $next, isNew: true) {}
            PFSecureField(L10n.t("security.password.confirm"), text: $confirm, isNew: true) { if isValid { submit() } }
            Text(L10n.t("security.password.hint")).pfText(.meta).foregroundStyle(next.count >= 8 || next.isEmpty ? PFColor.textMuted : PFColor.warningText)
            if !confirm.isEmpty, next != confirm { Text(L10n.t("security.password.mismatch")).pfText(.meta).foregroundStyle(PFColor.dangerText) }
            if let errorText { Text(errorText).pfText(.meta).foregroundStyle(PFColor.dangerText) }
        }
        .pfSheetFooter([isWorking, isValid]) {
            PFButton(isWorking ? L10n.t("common.loading") : L10n.t("common.save"), size: .large, fullWidth: true) { submit() }
                .disabled(!isValid || isWorking)
                .padding(.horizontal, PFSpace.page)
        }
    }

    private func submit() {
        guard !isWorking else { return }
        isWorking = true
        errorText = nil
        Task {
            defer { isWorking = false }
            do {
                if hasPassword {
                    try await Reauth.withPassword(current)
                    try await AccountSecurity.updatePassword(to: next)
                } else {
                    try await AccountSecurity.linkPassword(next)
                }
                PFHaptics.success()
                presenter.dismiss()
                model.toasts.show(PFToast(L10n.t("security.password.saved"), style: .success))
                onChanged()
            } catch {
                if Reauth.isRecentLoginError(error) {
                    presenter.dismiss()
                    let retryNext = next
                    Task {
                        try? await Task.sleep(for: .milliseconds(380))
                        model.presenter.present(detents: [.fit]) { ReauthSheet { retry(password: retryNext) } }
                    }
                } else {
                    errorText = AuthErrorText.message(for: error)
                }
            }
        }
    }

    /// After the fresh login the password can be set without asking again.
    private func retry(password: String) {
        Task {
            do {
                try await AccountSecurity.linkPassword(password)
                PFHaptics.success()
                model.toasts.show(PFToast(L10n.t("security.password.saved"), style: .success))
                onChanged()
            } catch {
                model.toasts.show(PFToast(AuthErrorText.message(for: error), style: .error))
            }
        }
    }
}

/// TOTP enrolment (web `TwoFactorSetupModal`): fresh login, verified e-mail, QR + key, first code.
struct TotpEnrollSheet: View {
    private enum Stage { case reauth, verifyEmail, scan }

    let onEnrolled: () -> Void
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var stage: Stage = .reauth
    @State private var password = ""
    @State private var enrollment: AccountSecurity.TOTPEnrollment?
    @State private var code = ""
    @State private var isWorking = false
    @State private var errorText: String?
    @State private var verificationSent = false

    var body: some View {
        TeamSheet(eyebrow: L10n.t("security.twoFactor"), title: L10n.t("security.totp.title")) {
            switch stage {
            case .reauth: reauthStage
            case .verifyEmail: verifyStage
            case .scan: scanStage
            }
            if let errorText { Text(errorText).pfText(.meta).foregroundStyle(PFColor.dangerText) }
        }
    }

    // MARK: Stages

    private var reauthStage: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            Text(L10n.t("security.totp.intro")).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            if Reauth.hasPassword {
                PFSecureField(L10n.t("security.password.current"), text: $password, isNew: false) { run { try await Reauth.withPassword(password) } }
                PFButton(isWorking ? L10n.t("common.loading") : L10n.t("security.totp.start"), size: .large, fullWidth: true) {
                    run { try await Reauth.withPassword(password) }
                }
                .disabled(password.isEmpty || isWorking)
            }
            if Reauth.providers.contains("apple.com") {
                PFButton(L10n.t("security.reauth.apple"), systemImage: "apple.logo", kind: Reauth.hasPassword ? .secondary : .primary, size: .large, fullWidth: true) {
                    run { try await Reauth.withApple(auth: model.auth) }
                }
                .disabled(isWorking)
            }
            if Reauth.providers.contains("github.com") {
                PFButton(L10n.t("security.reauth.github"), kind: .secondary, size: .large, fullWidth: true) { run { try await Reauth.withGitHub() } }.disabled(isWorking)
            }
            if !Reauth.hasPassword, !Reauth.providers.contains("apple.com"), !Reauth.providers.contains("github.com") {
                Text(L10n.t("security.totp.webOnly")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
        }
    }

    private var verifyStage: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            Text(L10n.t("security.totp.verifyEmail", ["email": Auth.auth().currentUser?.email ?? ""]))
                .pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            PFButton(verificationSent ? L10n.t("security.totp.verifyEmail.resend") : L10n.t("security.totp.verifyEmail.send"), kind: .secondary, size: .large, fullWidth: true) {
                Task {
                    do {
                        try await AccountSecurity.sendEmailVerification()
                        verificationSent = true
                    } catch { errorText = AuthErrorText.message(for: error) }
                }
            }
            PFButton(isWorking ? L10n.t("common.loading") : L10n.t("security.totp.verifyEmail.done"), size: .large, fullWidth: true) {
                run {
                    guard try await AccountSecurity.isEmailVerified() else { throw PFDataError.message(L10n.t("security.totp.verifyEmail.pending")) }
                    try await beginEnrollment()
                }
            }
            .disabled(isWorking)
        }
    }

    private var scanStage: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            Text(L10n.t("security.totp.scan")).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            if let enrollment {
                let uri = enrollment.otpauthURL
                if let image = Self.qrImage(uri) {
                    Image(uiImage: image).interpolation(.none).resizable().scaledToFit()
                        .frame(width: 200, height: 200).padding(PFSpace.s)
                        .background(Color.white, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
                        .frame(maxWidth: .infinity)
                        .accessibilityLabel(L10n.t("security.totp.qr"))
                }
                if let url = URL(string: uri), UIApplication.shared.canOpenURL(url) {
                    PFButton(L10n.t("security.totp.openApp"), systemImage: "arrow.up.forward.app", kind: .secondary, size: .medium, fullWidth: true) {
                        UIApplication.shared.open(url)
                    }
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(L10n.t("security.totp.key")).pfText(.eyebrow).foregroundStyle(PFColor.textMuted)
                    HStack {
                        Text(enrollment.key).pfText(.metaStrong).foregroundStyle(PFColor.textMain).textSelection(.enabled)
                        Spacer()
                        PFIconButton("doc.on.doc", label: L10n.t("team.invite.copy"), style: .raised, size: 34) { TeamLogic.copy(enrollment.key) }
                    }
                    .padding(PFSpace.s).background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
                }
            }
            PFTextField(L10n.t("security.totp.code"), text: $code, systemImage: "number", submitLabel: .go) { if code.count == 6 { enroll() } }
                .keyboardType(.numberPad).textContentType(.oneTimeCode)
            PFButton(isWorking ? L10n.t("common.loading") : L10n.t("security.totp.enable"), size: .large, fullWidth: true) { enroll() }
                .disabled(code.count != 6 || isWorking)
        }
    }

    // MARK: Actions

    private func run(_ work: @escaping () async throws -> Void) {
        guard !isWorking else { return }
        isWorking = true
        errorText = nil
        Task {
            defer { isWorking = false }
            do {
                try await work()
                if stage == .reauth { try await afterReauth() }
            } catch {
                if (error as NSError).code != ASAuthorizationError.canceled.rawValue {
                    errorText = (error as? PFDataError).map { _ in (error as NSError).localizedDescription } ?? AuthErrorText.message(for: error)
                }
            }
        }
    }

    private func afterReauth() async throws {
        if Auth.auth().currentUser?.isEmailVerified == true {
            try await beginEnrollment()
        } else {
            stage = .verifyEmail
        }
    }

    private func beginEnrollment() async throws {
        enrollment = try await AccountSecurity.beginTOTP(issuer: "ProjectFlow")
        stage = .scan
    }

    private func enroll() {
        guard let enrollment, !isWorking else { return }
        isWorking = true
        errorText = nil
        Task {
            defer { isWorking = false }
            do {
                try await AccountSecurity.finishTOTP(enrollment, code: code)
                PFHaptics.success()
                presenter.dismiss()
                model.toasts.show(PFToast(L10n.t("security.totp.enabled"), style: .success))
                onEnrolled()
            } catch {
                errorText = L10n.t("security.totp.invalidCode")
            }
        }
    }

    static func qrImage(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 8, y: 8)) else { return nil }
        let context = CIContext()
        guard let cg = context.createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

/// Rename a passkey (`users/{uid}/passkeys/{id}.label`).
struct PasskeyRenameSheet: View {
    let passkeyId: String
    let label: String
    let onRenamed: (String) -> Void
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var name = ""
    @State private var isWorking = false

    var body: some View {
        TeamSheet(eyebrow: L10n.t("settings.security.passkeys.title"), title: L10n.t("security.passkey.rename")) {
            PFTextField(L10n.t("security.passkey.name"), text: $name, systemImage: "person.badge.key", submitLabel: .done) { save() }
            PFButton(isWorking ? L10n.t("common.loading") : L10n.t("common.save"), size: .large, fullWidth: true) { save() }
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isWorking)
        }
        .onAppear { name = label }
    }

    private func save() {
        guard let uid = model.uid, !isWorking else { return }
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        isWorking = true
        Task {
            defer { isWorking = false }
            do {
                try await PFFirebase.db.collection("users").document(uid).collection("passkeys").document(passkeyId).updateData(["label": trimmed])
                PFHaptics.success()
                onRenamed(trimmed)
                presenter.dismiss()
            } catch {
                model.toasts.show(PFToast(L10n.t("common.error"), style: .error))
            }
        }
    }
}
