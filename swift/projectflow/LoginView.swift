import SwiftUI

struct LoginView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @State private var email = ""
    @State private var password = ""
    @State private var mode: AuthMode = .signIn
    @State private var showValidation = false

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

    var body: some View {
        VStack(spacing: PFSpacing.lg) {
            Spacer()

            VStack(spacing: PFSpacing.sm) {
                Text("ProjectFlow")
                    .font(.largeTitle.weight(.semibold))
                    .foregroundStyle(colors.textMain)

                Text("Sign in to manage projects, tasks, flows, and issues.")
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)
                    .multilineTextAlignment(.center)
            }

            PFCard {
                VStack(spacing: PFSpacing.md) {
                    Picker("Mode", selection: $mode) {
                        Text("Sign In").tag(AuthMode.signIn)
                        Text("Create").tag(AuthMode.signUp)
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: mode) { _ in
                        session.clearMessages()
                        showValidation = false
                    }

                    PFInputField(
                        title: "Email",
                        placeholder: "name@company.com",
                        text: $email,
                        isSecure: false,
                        keyboardType: .emailAddress,
                        error: emailError
                    )
                    PFInputField(
                        title: "Password",
                        placeholder: "••••••••",
                        text: $password,
                        isSecure: true,
                        keyboardType: .default,
                        error: passwordError
                    )

                    if mode == .signIn {
                        Button("Forgot password?") {
                            showValidation = true
                            guard isEmailValid else { return }
                            session.sendPasswordReset(email: trimmedEmail)
                        }
                        .font(.footnote)
                        .foregroundStyle(colors.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
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
                .disabled(!canSubmit)

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

            Spacer()
        }
        .padding(PFSpacing.lg)
        .background(colors.surfaceBg.ignoresSafeArea())
    }
}

private enum AuthMode: String {
    case signIn
    case signUp
}
