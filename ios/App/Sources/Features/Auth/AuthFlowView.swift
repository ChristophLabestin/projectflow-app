import SwiftUI
import AuthenticationServices
import PFData
import PFDesign

/// Sign in / register / second factor. Immersive dotted canvas, editorial headline, custom controls.
struct AuthFlowView: View {
    @Environment(AppModel.self) private var model
    @State private var mode: Mode = .signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var isBusy = false
    @State private var error: String?
    @State private var apple = AppleSignInCoordinator()
    @State private var passkey = PasskeyCoordinator()
    @State private var markCenter: CGPoint?
    @State private var appeared = false

    enum Mode: Hashable { case signIn, register }

    var body: some View {
        ZStack {
            PFCanvas(dotted: true)
            if case .needsSecondFactor(let hint) = model.auth.phase {
                SecondFactorView(hint: hint)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            } else {
                form.transition(.opacity)
            }
        }
        .animation(PFMotion.respecting(PFMotion.snappy), value: model.auth.phase)
    }

    /// Hero (rippling canvas, floating mark, rotating headline) above a raised card with the form.
    private var form: some View {
        ZStack {
            PFFlowField(center: markCenter, period: 4.2)
            ScrollView {
                VStack(spacing: PFSpace.xl) {
                    hero
                    card
                        .offset(y: appeared ? 0 : 40)
                        .opacity(appeared ? 1 : 0)
                    alternatives
                        .opacity(appeared ? 1 : 0)
                }
                .padding(.horizontal, PFSpace.page)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
                .animation(PFMotion.respecting(PFMotion.snappy), value: mode)
                .animation(PFMotion.respecting(PFMotion.normal), value: error)
            }
            .scrollDismissesKeyboard(.interactively)
            .scrollIndicators(.hidden)
        }
        .onAppear { withAnimation(.spring(response: 0.8, dampingFraction: 0.8).delay(0.15)) { appeared = true } }
        .task {
            if ProcessInfo.processInfo.arguments.contains("-pfAutoLogin") {
                email = "demo@projectflow.test"
                password = "projectflow-demo"
                submit()
            }
        }
    }

    private var hero: some View {
        VStack(spacing: PFSpace.m) {
            PFBrandMark(glyph: Image("Glyph"), size: 36)
                .onGeometryChange(for: CGPoint.self) { proxy in
                    let frame = proxy.frame(in: .global)
                    return CGPoint(x: frame.midX, y: frame.midY)
                } action: { markCenter = $0 }
            VStack(spacing: 2) {
                Text(L10n.t("auth.hero.lead"))
                    .pfText(.display)
                    .foregroundStyle(PFColor.textMain)
                PFRotatingWord(L10n.t("auth.hero.words").components(separatedBy: "|"), style: .display)
            }
            .multilineTextAlignment(.center)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            Text(mode == .signIn ? L10n.t("auth.headline.signIn") : L10n.t("auth.headline.register"))
                .pfText(.body)
                .foregroundStyle(PFColor.textMuted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .contentTransition(.opacity)
        }
        .padding(.top, PFSpace.xl)
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFSegmented([(Mode.signIn, L10n.t("auth.signIn")), (Mode.register, L10n.t("auth.register"))], selection: $mode)

            VStack(spacing: PFSpace.s) {
                if mode == .register {
                    PFTextField(L10n.t("auth.name"), text: $name, systemImage: "person")
                        .textContentType(.name)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
                PFTextField(L10n.t("auth.email"), text: $email, systemImage: "envelope", submitLabel: .next)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                PFSecureField(L10n.t("auth.password"), text: $password, isNew: mode == .register) { submit() }
            }

            if let error {
                Label(error, systemImage: "exclamationmark.circle")
                    .pfText(.metaStrong)
                    .foregroundStyle(PFColor.dangerText)
                    .transition(.opacity)
                    .accessibilityAddTraits(.updatesFrequently)
            }

            PFButton(mode == .signIn ? L10n.t("auth.signIn") : L10n.t("auth.createAccount"),
                     systemImage: "arrow.right", size: .large, fullWidth: true) { submit() }
                .disabled(isBusy || email.isEmpty || password.count < 6 || (mode == .register && name.isEmpty))
                .overlay(alignment: .trailing) { if isBusy { ProgressSpinner().padding(.trailing, 20) } }

            if mode == .signIn {
                Button(L10n.t("auth.forgot")) { forgotPassword() }
                    .buttonStyle(.plain)
                    .pfText(.metaStrong)
                    .foregroundStyle(PFColor.textMuted)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(PFSpace.l)
        .pfCard(radius: PFRadius.surface + 4)
    }

    private var alternatives: some View {
        VStack(spacing: PFSpace.m) {
            HStack(spacing: PFSpace.s) {
                Rectangle().fill(PFColor.hairline).frame(height: 1)
                Text(L10n.t("auth.or")).pfText(.eyebrow).foregroundStyle(PFColor.textMuted)
                Rectangle().fill(PFColor.hairline).frame(height: 1)
            }
            VStack(spacing: PFSpace.s) {
                PFButton(L10n.t("auth.apple"), systemImage: "apple.logo", kind: .secondary, size: .large, fullWidth: true) {
                    Task { await run { try await apple.signIn(auth: model.auth) } }
                }
                PFButton(L10n.t("auth.passkey"), systemImage: "person.badge.key", kind: .secondary, size: .large, fullWidth: true) {
                    Task { await run { try await passkey.signIn(auth: model.auth, email: email.isEmpty ? nil : email) } }
                }
            }
            Text(L10n.t("auth.legal")).pfText(.caption).foregroundStyle(PFColor.textMuted)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
                .padding(.bottom, PFSpace.xxl)
        }
    }

    private func submit() {
        Task {
            await run {
                if mode == .signIn {
                    try await model.auth.signIn(email: email, password: password)
                } else {
                    try await model.auth.signUp(name: name, email: email, password: password)
                }
            }
        }
    }

    private func forgotPassword() {
        guard !email.isEmpty else {
            error = L10n.t("auth.enterEmailFirst")
            return
        }
        Task {
            await run { try await model.auth.sendPasswordReset(email: email) }
            if error == nil { model.toasts.show(PFToast(L10n.t("auth.resetSent"), style: .success)) }
        }
    }

    private func run(_ work: () async throws -> Void) async {
        isBusy = true
        error = nil
        defer { isBusy = false }
        do {
            try await work()
        } catch let authError as ASAuthorizationError where authError.code == .canceled {
            // User dismissed the system sheet.
        } catch {
            self.error = AuthErrorText.message(for: error)
        }
    }
}

/// Password field with show/hide, same look as `PFTextField`.
struct PFSecureField: View {
    let placeholder: String
    @Binding var text: String
    let isNew: Bool
    let onSubmit: () -> Void
    @State private var reveal = false
    @FocusState private var focused: Bool

    init(_ placeholder: String, text: Binding<String>, isNew: Bool, onSubmit: @escaping () -> Void) {
        self.placeholder = placeholder
        self._text = text
        self.isNew = isNew
        self.onSubmit = onSubmit
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "lock").font(.system(size: 15, weight: .medium)).foregroundStyle(PFColor.textMuted)
            Group {
                if reveal {
                    TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(PFColor.textSubtle))
                } else {
                    SecureField("", text: $text, prompt: Text(placeholder).foregroundStyle(PFColor.textSubtle))
                }
            }
            .textFieldStyle(.plain)
            .pfText(.body)
            .textContentType(isNew ? .newPassword : .password)
            .focused($focused)
            .submitLabel(.go)
            .onSubmit(onSubmit)
            Button { reveal.toggle() } label: {
                Image(systemName: reveal ? "eye.slash" : "eye").foregroundStyle(PFColor.textMuted)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(L10n.t(reveal ? "auth.hidePassword" : "auth.showPassword"))
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 46)
        .background(PFColor.card, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: PFRadius.control, style: .continuous)
                .strokeBorder(focused ? PFColor.textMuted.opacity(0.55) : PFColor.hairlineStrong, lineWidth: 1)
        }
        .animation(PFMotion.fast, value: focused)
    }
}

/// Six separate code cells for the TOTP second factor.
struct SecondFactorView: View {
    let hint: String
    @Environment(AppModel.self) private var model
    @State private var code = ""
    @State private var error: String?
    @State private var busy = false
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.l) {
            Spacer().frame(height: PFSpace.xxl)
            PFEyebrow(L10n.t("auth.mfa.eyebrow"))
            Text(L10n.t("auth.mfa.title")).pfText(.display).foregroundStyle(PFColor.textMain)
            Text(L10n.t("auth.mfa.lead", ["hint": hint])).pfText(.body).foregroundStyle(PFColor.textMuted)
            ZStack {
                TextField("", text: $code)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .focused($focused)
                    .opacity(0.02)
                    .onChange(of: code) { _, value in
                        code = String(value.filter(\.isNumber).prefix(6))
                        if code.count == 6 { verify() }
                    }
                HStack(spacing: 10) {
                    ForEach(0..<6, id: \.self) { index in
                        let character = index < code.count ? String(code[code.index(code.startIndex, offsetBy: index)]) : ""
                        Text(character)
                            .font(.system(size: 26, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(PFColor.textMain)
                            .frame(maxWidth: .infinity, minHeight: 60)
                            .background(PFColor.card, in: .rect(cornerRadius: 14, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .strokeBorder(index == code.count && focused ? PFColor.primary : PFColor.hairline, lineWidth: index == code.count && focused ? 2 : 1)
                            }
                            .scaleEffect(index == code.count - 1 ? 1.04 : 1)
                            .animation(PFMotion.bouncy, value: code)
                    }
                }
                .contentShape(.rect)
                .onTapGesture { focused = true }
                .accessibilityElement()
                .accessibilityLabel(L10n.t("auth.mfa.title"))
                .accessibilityValue(code)
            }
            if let error { Text(error).pfText(.metaStrong).foregroundStyle(PFColor.dangerText) }
            PFButton(L10n.t("auth.mfa.verify"), size: .large, fullWidth: true) { verify() }
                .disabled(code.count < 6 || busy)
            PFButton(L10n.t("common.cancel"), kind: .ghost, fullWidth: true) { model.auth.cancelSecondFactor() }
            Spacer()
        }
        .padding(.horizontal, PFSpace.page)
        .onAppear { focused = true }
    }

    private func verify() {
        guard !busy else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                try await model.auth.resolveSecondFactor(code: code)
            } catch {
                self.error = AuthErrorText.message(for: error)
                code = ""
                PFHaptics.warning()
            }
        }
    }
}

/// Small indeterminate spinner drawn with a trimmed circle (no native ProgressView).
struct ProgressSpinner: View {
    var color: Color = PFColor.onPrimary
    @State private var spin = false

    var body: some View {
        Circle()
            .trim(from: 0.15, to: 0.85)
            .stroke(color, style: StrokeStyle(lineWidth: 2.2, lineCap: .round))
            .frame(width: 18, height: 18)
            .rotationEffect(.degrees(spin ? 360 : 0))
            .onAppear { withAnimation(.linear(duration: 0.8).repeatForever(autoreverses: false)) { spin = true } }
            .accessibilityLabel(L10n.t("common.loading"))
    }
}
