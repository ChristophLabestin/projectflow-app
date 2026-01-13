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
            }

            PFCard {
                VStack(spacing: PFSpacing.md) {
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
                    .disabled(isMfaActive || session.isBusy)
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

private struct LoginBackground: View {
    let colors: PFColors

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [colors.surfaceBg, colors.surfaceHover],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            DottedBackground(color: colors.surfaceBorder.opacity(0.25))
                .opacity(0.6)
                .allowsHitTesting(false)

            RoundedRectangle(cornerRadius: PFRadius.xl, style: .continuous)
                .fill(colors.primaryFade)
                .frame(width: 280, height: 280)
                .offset(x: -180, y: -220)
        }
        .ignoresSafeArea()
    }
}

private struct DottedBackground: View {
    let color: Color
    var spacing: CGFloat = 18
    var dotSize: CGFloat = 2

    var body: some View {
        Canvas { context, size in
            let columns = Int(size.width / spacing)
            let rows = Int(size.height / spacing)

            for row in 0...rows {
                for column in 0...columns {
                    let x = CGFloat(column) * spacing + spacing * 0.5
                    let y = CGFloat(row) * spacing + spacing * 0.5
                    let rect = CGRect(x: x, y: y, width: dotSize, height: dotSize)
                    context.fill(Path(ellipseIn: rect), with: .color(color))
                }
            }
        }
    }
}
