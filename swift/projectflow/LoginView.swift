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
                AppBackground()

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
                            VStack(alignment: .center, spacing: PFSpacing.xl) {
                                BrandPanel()
                                formPanel
                            }
                        }
                    }
                    .padding(.horizontal, PFSpacing.lg)
                    .padding(.vertical, PFSpacing.xl)
                    .frame(maxWidth: .infinity, minHeight: proxy.size.height)
                }
                .onTapGesture {
                    #if os(iOS)
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                    #endif
                }
                
                // MFA Overlay
                if let mfaState = session.mfaState {
                    MfaOverlay(
                        state: mfaState,
                        code: $mfaCode,
                        colors: colors,
                        colorScheme: colorScheme,
                        session: session
                    )
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: isMfaActive)
        }
    }

    private var formPanel: some View {
        VStack(spacing: PFSpacing.lg) {
            // Header Section
            VStack(spacing: PFSpacing.xs) {
                Text(mode == .signUp ? "Create your account" : "Welcome back")
                    .font(.title.weight(.bold))
                    .foregroundStyle(colors.textMain)
                
                Text(mode == .signUp ? "Start managing your projects today" : "Sign in to continue to your workspace")
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, PFSpacing.sm)

            // Form Fields (no card wrapper)
            VStack(spacing: PFSpacing.md) {
                LoginInputField(
                    title: "Email",
                    placeholder: "name@company.com",
                    text: $email,
                    isSecure: false,
                    keyboardType: .emailAddress,
                    error: emailError,
                    colors: colors,
                    colorScheme: colorScheme
                )
                .disabled(isMfaActive || session.isBusy)
                
                LoginInputField(
                    title: "Password",
                    placeholder: "Enter your password",
                    text: $password,
                    isSecure: true,
                    keyboardType: .default,
                    error: passwordError,
                    colors: colors,
                    colorScheme: colorScheme
                )
                .disabled(isMfaActive || session.isBusy)
                
                if mode == .signIn {
                    Button("Forgot password?") {
                        showValidation = true
                        guard isEmailValid else { return }
                        session.sendPasswordReset(email: trimmedEmail)
                    }
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(colors.primary)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .disabled(isMfaActive || session.isBusy)
                }
            }

            // Error / Message Display
            if let error = session.authError {
                HStack(spacing: PFSpacing.sm) {
                    Image(systemName: "exclamationmark.circle.fill")
                    Text(error)
                }
                .font(.footnote.weight(.medium))
                .foregroundStyle(colors.error)
                .padding(PFSpacing.sm)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                        .fill(colors.error.opacity(0.12))
                )
            }

            if let message = session.authMessage {
                HStack(spacing: PFSpacing.sm) {
                    Image(systemName: "checkmark.circle.fill")
                    Text(message)
                }
                .font(.footnote.weight(.medium))
                .foregroundStyle(colors.success)
                .padding(PFSpacing.sm)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                        .fill(colors.success.opacity(0.12))
                )
            }

            // Action Buttons
            VStack(spacing: PFSpacing.md) {
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
                    // Divider
                    HStack(spacing: PFSpacing.md) {
                        Rectangle()
                            .fill(colors.surfaceBorder)
                            .frame(height: 1)
                        Text("or")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(colors.textSubtle)
                        Rectangle()
                            .fill(colors.surfaceBorder)
                            .frame(height: 1)
                    }
                    .padding(.vertical, PFSpacing.xs)
                    
                    Button {
                        session.signInWithPasskey(email: trimmedEmail.isEmpty ? nil : trimmedEmail)
                    } label: {
                        HStack(spacing: PFSpacing.sm) {
                            Image(systemName: "key.fill")
                                .font(.subheadline)
                            Text(session.isBusy ? "Waiting for Passkey..." : "Continue with Passkey")
                                .font(.subheadline.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(colors.textMain)
                        .background(
                            RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                                .fill(colors.surfaceCard)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                                .stroke(colors.surfaceBorder, lineWidth: 1)
                        )
                    }
                    .disabled(session.isBusy || isMfaActive)
                }
            }

            // Mode Toggle
            HStack(spacing: PFSpacing.xs) {
                Text(mode == .signUp ? "Already have an account?" : "New to ProjectFlow?")
                    .font(.footnote)
                    .foregroundStyle(colors.textMuted)
                Button(mode == .signUp ? "Sign In" : "Create Account") {
                    session.clearMessages()
                    showValidation = false
                    mode = mode == .signUp ? .signIn : .signUp
                }
                .font(.footnote.weight(.bold))
                .foregroundStyle(colors.primary)
                .disabled(isMfaActive || session.isBusy)
            }
            .padding(.top, PFSpacing.sm)
        }
        .frame(maxWidth: 400)
    }
}

// MARK: - Clean Input Field for Login

private struct LoginInputField: View {
    let title: String
    let placeholder: String
    @Binding var text: String
    let isSecure: Bool
    let keyboardType: PFKeyboardType
    let error: String?
    let colors: PFColors
    let colorScheme: ColorScheme
    @FocusState private var isFocused: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(colors.textMain)
            
            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                        #if os(iOS)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        #endif
                }
            }
            #if os(iOS)
            .keyboardType(keyboardType)
            #endif
            .font(.body)
            .foregroundStyle(colors.textMain)
            .focused($isFocused)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                    .fill(colorScheme == .dark ? colors.surfaceHover : Color.white)
            )
            .overlay(
                RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                    .stroke(
                        error != nil ? colors.error : (isFocused ? colors.primary : colors.surfaceBorder),
                        lineWidth: isFocused ? 1.5 : 1
                    )
            )
            .animation(.easeInOut(duration: 0.15), value: isFocused)
            
            if let error = error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(colors.error)
            }
        }
    }
}

// MARK: - MFA Overlay

private struct MfaOverlay: View {
    let state: MfaState
    @Binding var code: String
    let colors: PFColors
    let colorScheme: ColorScheme
    @ObservedObject var session: SessionStore
    
    private var selected: MfaOption? { state.selectedOption }
    private var canVerify: Bool { code.count == 6 && !session.isMfaBusy }
    
    var body: some View {
        ZStack {
            // Backdrop
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture {
                    #if os(iOS)
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                    #endif
                }
            
            // Content Card
            VStack(spacing: PFSpacing.lg) {
                // Icon
                ZStack {
                    Circle()
                        .fill(colors.primary.opacity(0.15))
                        .frame(width: 72, height: 72)
                    
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 32, weight: .medium))
                        .foregroundStyle(colors.primary)
                }
                
                // Header
                VStack(spacing: PFSpacing.xs) {
                    Text("Two-Factor Authentication")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(colors.textMain)
                    
                    Text("Enter the 6-digit code from your authenticator app")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                        .multilineTextAlignment(.center)
                }
                
                // Method Selector (if multiple)
                if state.options.count > 1 {
                    Picker("Method", selection: Binding(
                        get: { state.selectedOptionId ?? state.options.first?.id ?? "" },
                        set: { session.selectMfaOption(id: $0) }
                    )) {
                        ForEach(state.options) { option in
                            Text(option.label).tag(option.id)
                        }
                    }
                    .pickerStyle(.segmented)
                } else if let option = selected {
                    HStack(spacing: PFSpacing.xs) {
                        Image(systemName: option.isPhone ? "iphone" : "lock.app.dashed")
                            .font(.caption)
                        Text(option.label)
                            .font(.footnote.weight(.semibold))
                    }
                    .foregroundStyle(colors.textMuted)
                    .padding(.horizontal, PFSpacing.md)
                    .padding(.vertical, PFSpacing.xs)
                    .background(colors.surfaceHover)
                    .clipShape(Capsule())
                }
                
                // Code Input
                MfaCodeInput(code: $code, colors: colors, colorScheme: colorScheme)
                    .onChange(of: code) { _, newValue in
                        if newValue.count == 6 && !session.isMfaBusy {
                            session.verifyMfa(code: newValue)
                        }
                    }
                
                // Error Display
                if let mfaError = session.mfaError {
                    HStack(spacing: PFSpacing.xs) {
                        Image(systemName: "xmark.circle.fill")
                        Text(mfaError)
                    }
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(colors.error)
                }
                
                // Message Display
                if let mfaMessage = session.mfaMessage {
                    Text(mfaMessage)
                        .font(.footnote)
                        .foregroundStyle(colors.textMuted)
                }
                
                // Verify Button
                PFPrimaryButton(
                    title: session.isMfaBusy ? "Verifying..." : "Verify Code",
                    isLoading: session.isMfaBusy
                ) {
                    session.verifyMfa(code: code)
                }
                .disabled(!canVerify)
                
                // Footer Actions
                HStack(spacing: PFSpacing.lg) {
                    if selected?.isPhone == true {
                        Button {
                            session.requestMfaCodeIfNeeded()
                        } label: {
                            HStack(spacing: PFSpacing.xs) {
                                Image(systemName: "arrow.clockwise")
                                Text("Resend")
                            }
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(colors.primary)
                        }
                        .disabled(session.isMfaBusy)
                    }
                    
                    Button {
                        code = ""
                        session.cancelMfa()
                    } label: {
                        HStack(spacing: PFSpacing.xs) {
                            Image(systemName: "xmark")
                            Text("Cancel")
                        }
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(colors.textMuted)
                    }
                }
            }
            .padding(PFSpacing.xl)
            .frame(maxWidth: 360)
            .background(
                RoundedRectangle(cornerRadius: PFRadius.xl, style: .continuous)
                    .fill(colors.surfaceCard)
                    .shadow(color: .black.opacity(0.25), radius: 24, x: 0, y: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: PFRadius.xl, style: .continuous)
                    .stroke(colors.surfaceBorder.opacity(0.3), lineWidth: 1)
            )
            .padding(PFSpacing.lg)
        }
    }
}

// MARK: - MFA Code Input (6-digit boxes)

private struct MfaCodeInput: View {
    @Binding var code: String
    let colors: PFColors
    let colorScheme: ColorScheme
    @FocusState private var isFocused: Bool
    
    var body: some View {
        ZStack {
            // Digit boxes overlay
            HStack(spacing: 8) {
                ForEach(0..<6, id: \.self) { index in
                    DigitBox(
                        digit: digitAt(index),
                        isActive: index == code.count && isFocused,
                        colors: colors,
                        colorScheme: colorScheme
                    )
                }
            }
            .allowsHitTesting(false)
            
            // Invisible but interactive TextField for input + paste
            TextField("", text: $code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($isFocused)
                .foregroundColor(.clear)
                .tint(.clear)
                .accentColor(.clear)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .onChange(of: code) { _, newValue in
                    let filtered = newValue.filter { $0.isNumber }
                    if filtered != newValue || filtered.count > 6 {
                        code = String(filtered.prefix(6))
                    }
                }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            isFocused = true
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                isFocused = true
            }
        }
    }
    
    private func digitAt(_ index: Int) -> String? {
        guard index < code.count else { return nil }
        let idx = code.index(code.startIndex, offsetBy: index)
        return String(code[idx])
    }
}

private struct DigitBox: View {
    let digit: String?
    let isActive: Bool
    let colors: PFColors
    let colorScheme: ColorScheme
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                .fill(colorScheme == .dark ? colors.surfaceHover : colors.surfacePaper)
            
            RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                .stroke(
                    isActive ? colors.primary : colors.surfaceBorder,
                    lineWidth: isActive ? 2 : 1
                )
            
            if let digit = digit {
                Text(digit)
                    .font(.title.weight(.bold).monospacedDigit())
                    .foregroundStyle(colors.textMain)
            } else if isActive {
                Rectangle()
                    .fill(colors.primary)
                    .frame(width: 2, height: 24)
                    .modifier(BlinkingModifier())
            }
        }
        .frame(width: 48, height: 56)
        .animation(.easeInOut(duration: 0.15), value: isActive)
        .animation(.easeInOut(duration: 0.1), value: digit)
    }
}

private struct BlinkingModifier: ViewModifier {
    @State private var isVisible = true
    
    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) {
                    isVisible = false
                }
            }
    }
}

// MARK: - Supporting Views

private enum AuthMode: String {
    case signIn
    case signUp
}

private struct BrandPanel: View {
    @Environment(\.colorScheme) private var colorScheme

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(spacing: PFSpacing.md) {
            AppIconView(size: 56)
                .shadow(color: colors.shadowSm, radius: 8, x: 0, y: 4)
            
            Text("ProjectFlow")
                .font(.title2.weight(.bold))
                .foregroundStyle(colors.textMain)
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
                    .font(.title3.weight(.bold))
                    .foregroundStyle(colors.primaryText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(colors.primary)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous)
                .stroke(colors.surfaceBorder.opacity(0.5), lineWidth: 1)
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
