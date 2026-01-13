import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

struct LoginView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @State private var email = ""
    @State private var password = ""
    @State private var mode: AuthMode = .signIn
    @State private var showValidation = false
    @State private var mfaCode = ""

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var trimmedEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var isEmailValid: Bool { trimmedEmail.contains("@") && trimmedEmail.contains(".") }
    private var isPasswordValid: Bool {
        if mode == .signUp {
            return password.count >= 6
        }
        return !password.isEmpty
    }
    private var canSubmit: Bool { isEmailValid && isPasswordValid && !session.isBusy }
    private var emailError: String? {
        guard showValidation else { return nil }
        if trimmedEmail.isEmpty { return "Email is required." }
        if !isEmailValid { return "Enter a valid email address." }
        return nil
    }
    private var passwordError: String? {
        guard showValidation else { return nil }
        if password.isEmpty { return "Password is required." }
        if mode == .signUp && password.count < 6 { return "Password must be at least 6 characters." }
        return nil
    }
    private var isMfaActive: Bool { session.mfaState != nil }

    var body: some View {
        GeometryReader { proxy in
            let isWide = proxy.size.width >= 800

            ZStack {
                LoginBackground(colors: colors)

                ScrollView(showsIndicators: false) {
                    Group {
                        if isWide {
                            HStack(alignment: .center, spacing: PFSpacing.xl) {
                                BrandPanel()
                                    .frame(maxWidth: 360, alignment: .leading)
                                formPanel
                                    .frame(maxWidth: 420)
                            }
                        } else {
                            VStack(alignment: .leading, spacing: PFSpacing.xl) {
                                BrandPanel()
                                formPanel
                            }
                        }
                    }
                    .padding(.horizontal, PFSpacing.lg)
                    .padding(.vertical, PFSpacing.xl)
                    .frame(maxWidth: .infinity, minHeight: proxy.size.height)
                }
            }
        }
        .ignoresSafeArea(edges: .bottom)
    }

    private var formPanel: some View {
        VStack(alignment: .leading, spacing: PFSpacing.lg) {
            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text(mode == .signUp ? "Create your account" : "Welcome back")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                Text("Use your workspace credentials to continue.")
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)
            }

            PFCard {
                VStack(spacing: PFSpacing.md) {
                    Picker("Mode", selection: $mode) {
                        Text("Sign In").tag(AuthMode.signIn)
                        Text("Create").tag(AuthMode.signUp)
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: mode) { _, _ in
                        session.clearMessages()
                        showValidation = false
                    }
                    .disabled(isMfaActive || session.isBusy)

                    PFInputField(
                        title: "Email",
                        placeholder: "name@company.com",
                        text: $email,
                        isSecure: false,
                        keyboardType: .emailAddress,
                        error: emailError
                    )
                    .disabled(isMfaActive || session.isBusy)

                    PFInputField(
                        title: "Password",
                        placeholder: "••••••••",
                        text: $password,
                        isSecure: true,
                        keyboardType: .default,
                        error: passwordError
                    )
                    .disabled(isMfaActive || session.isBusy)

                    if mode == .signIn {
                        Button("Forgot password?") {
                            showValidation = true
                            guard isEmailValid else { return }
                            session.sendPasswordReset(email: trimmedEmail)
                        }
                        .font(.footnote)
                        .foregroundStyle(colors.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .disabled(isMfaActive || session.isBusy)
                    }
                }
            }

            if let error = session.authError {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(colors.error)
            }

            if let message = session.authMessage {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(colors.textMuted)
            }

            VStack(spacing: PFSpacing.sm) {
                PFPrimaryButton(
                    title: mode == .signUp
                        ? (session.isBusy ? "Creating..." : "Create Account")
                        : (session.isBusy ? "Signing In..." : "Sign In"),
                    isLoading: session.isBusy
                ) {
                    showValidation = true
                    guard canSubmit else { return }
                    if mode == .signUp {
                        session.signUp(email: trimmedEmail, password: password)
                    } else {
                        session.signIn(email: trimmedEmail, password: password)
                    }
                }
                .disabled(!canSubmit || isMfaActive)

                if mode == .signIn {
                    Button {
                        session.signInWithPasskey(email: trimmedEmail.isEmpty ? nil : trimmedEmail)
                    } label: {
                        HStack(spacing: PFSpacing.sm) {
                            Image(systemName: "key.fill")
                            Text(session.isBusy ? "Waiting for Passkey..." : "Use Passkey")
                                .font(.subheadline.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, PFSpacing.sm)
                        .foregroundStyle(colors.textMain)
                        .background(colors.surfaceCard)
                        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                    }
                    .disabled(session.isBusy || isMfaActive)
                }

                HStack(spacing: PFSpacing.xs) {
                    Text(mode == .signUp ? "Already have an account?" : "New to ProjectFlow?")
                        .font(.footnote)
                        .foregroundStyle(colors.textMuted)
                    Button(mode == .signUp ? "Sign In" : "Create Account") {
                        session.clearMessages()
                        showValidation = false
                        mode = mode == .signUp ? .signIn : .signUp
                    }
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                }
            }

            if let mfaState = session.mfaState {
                mfaPanel(for: mfaState)
            }
        }
    }

    private func mfaPanel(for state: MfaState) -> some View {
        let selected = state.selectedOption
        let canVerify = !mfaCode.isEmpty && !session.isMfaBusy

        return PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                Text("Two-factor verification")
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                Text("Enter the code from your authenticator or SMS.")
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)

                if state.options.count > 1 {
                    Picker("Verification method", selection: Binding(
                        get: { state.selectedOptionId ?? state.options.first?.id ?? "" },
                        set: { session.selectMfaOption(id: $0) }
                    )) {
                        ForEach(state.options) { option in
                            Text(option.label).tag(option.id)
                        }
                    }
                    .pickerStyle(.menu)
                } else if let option = selected {
                    Text(option.label)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(colors.textMain)
                }

                PFInputField(
                    title: "Verification code",
                    placeholder: "123456",
                    text: $mfaCode,
                    isSecure: false,
                    keyboardType: .numberPad
                )

                if let mfaError = session.mfaError {
                    Text(mfaError)
                        .font(.footnote)
                        .foregroundStyle(colors.error)
                }

                if let mfaMessage = session.mfaMessage {
                    Text(mfaMessage)
                        .font(.footnote)
                        .foregroundStyle(colors.textMuted)
                }

                PFPrimaryButton(
                    title: session.isMfaBusy ? "Verifying..." : "Verify",
                    isLoading: session.isMfaBusy
                ) {
                    session.verifyMfa(code: mfaCode)
                }
                .disabled(!canVerify)

                HStack(spacing: PFSpacing.sm) {
                    if selected?.isPhone == true {
                        Button("Resend code") {
                            session.requestMfaCodeIfNeeded()
                        }
                        .font(.footnote)
                        .foregroundStyle(colors.textMuted)
                        .disabled(session.isMfaBusy)
                    }

                    Button("Cancel") {
                        mfaCode = ""
                        session.cancelMfa()
                    }
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                }
            }
        }
    }
}

private enum AuthMode: String {
    case signIn
    case signUp
}

private struct BrandPanel: View {
    @Environment(\.colorScheme) private var colorScheme

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.lg) {
            HStack(spacing: PFSpacing.sm) {
                AppIconView(size: 44)

                Text("ProjectFlow")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(colors.textMain)
            }

            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                Text("Ship the work that matters.")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                Text("Plan projects, coordinate tasks, and keep teams aligned with a focused workspace.")
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)
            }

            VStack(alignment: .leading, spacing: PFSpacing.md) {
                FeatureRow(icon: "checkmark.circle", title: "Project visibility", detail: "Track status, milestones, and risks at a glance.")
                FeatureRow(icon: "list.bullet.rectangle", title: "Task execution", detail: "Assign and update tasks without noise.")
                FeatureRow(icon: "bell", title: "Smart notifications", detail: "Stay on top of changes across projects.")
            }
        }
    }
}

private struct AppIconView: View {
    @Environment(\.colorScheme) private var colorScheme
    let size: CGFloat

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ZStack {
            if let image = AppIconProvider.iconImage() {
                #if os(iOS)
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                #elseif os(macOS)
                Image(nsImage: image)
                    .resizable()
                    .scaledToFill()
                #endif
            } else {
                Text("PF")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(colors.primaryText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(colors.primary)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                .stroke(colors.surfaceBorder, lineWidth: 1)
        )
    }
}

private enum AppIconProvider {
    static func iconImage() -> PlatformImage? {
        guard
            let info = Bundle.main.infoDictionary,
            let icons = info["CFBundleIcons"] as? [String: Any],
            let primary = icons["CFBundlePrimaryIcon"] as? [String: Any],
            let iconFiles = primary["CFBundleIconFiles"] as? [String],
            let iconName = iconFiles.last
        else {
            return nil
        }

        #if os(iOS)
        return UIImage(named: iconName)
        #elseif os(macOS)
        return NSImage(named: iconName)
        #else
        return nil
        #endif
    }
}

#if os(iOS)
private typealias PlatformImage = UIImage
#elseif os(macOS)
private typealias PlatformImage = NSImage
#endif

private struct FeatureRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let icon: String
    let title: String
    let detail: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(alignment: .top, spacing: PFSpacing.sm) {
            Image(systemName: icon)
                .foregroundStyle(colors.textMain)
                .frame(width: 22, height: 22)
                .padding(6)
                .background(colors.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: PFRadius.sm, style: .continuous))

            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(colors.textMuted)
            }
        }
    }
}

private struct LoginBackground: View {
    let colors: PFColors

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [colors.surfaceBg, colors.surfaceHover],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RoundedRectangle(cornerRadius: PFRadius.xl, style: .continuous)
                .fill(colors.primaryFade)
                .frame(width: 280, height: 280)
                .offset(x: -180, y: -220)

            RoundedRectangle(cornerRadius: PFRadius.xl, style: .continuous)
                .fill(colors.surfaceCard)
                .frame(width: 320, height: 240)
                .offset(x: 200, y: 260)
        }
        .ignoresSafeArea()
    }
}
