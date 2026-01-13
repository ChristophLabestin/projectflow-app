import Foundation
import Combine
import FirebaseAuth
import FirebaseCore

@MainActor
final class SessionStore: ObservableObject {
    @Published var user: User?
    @Published var isLoading = true
    @Published var authError: String?
    @Published var authMessage: String?
    @Published var isBusy = false
    @Published var mfaState: MfaState?
    @Published var mfaError: String?
    @Published var mfaMessage: String?
    @Published var isMfaBusy = false

    private var handle: AuthStateDidChangeListenerHandle?
    private let isPreview = ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1"

    init() {
        guard !isPreview else {
            isLoading = false
            return
        }

        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        handle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.user = user
            self?.isLoading = false
            if user != nil {
                PushTokenManager.shared.syncPendingToken()
            }
        }
    }

    deinit {
        if let handle {
            Auth.auth().removeStateDidChangeListener(handle)
        }
    }

    func signIn(email: String, password: String) {
        isBusy = true
        authError = nil
        authMessage = nil
        mfaError = nil
        mfaMessage = nil
        Auth.auth().signIn(withEmail: email, password: password) { [weak self] _, error in
            self?.isBusy = false
            if let error {
                if let resolver = Self.extractResolver(from: error) {
                    self?.beginMfaFlow(resolver: resolver)
                    return
                }
                self?.authError = Self.mapAuthError(error)
            }
        }
    }

    func signUp(email: String, password: String) {
        isBusy = true
        authError = nil
        authMessage = nil
        Auth.auth().createUser(withEmail: email, password: password) { [weak self] _, error in
            self?.isBusy = false
            if let error {
                self?.authError = Self.mapAuthError(error)
            }
        }
    }

    func signOut() {
        authError = nil
        authMessage = nil
        mfaState = nil
        mfaError = nil
        mfaMessage = nil
        do {
            try Auth.auth().signOut()
        } catch {
            authError = Self.mapAuthError(error)
        }
    }

    func sendPasswordReset(email: String) {
        isBusy = true
        authError = nil
        authMessage = nil
        Auth.auth().sendPasswordReset(withEmail: email) { [weak self] error in
            self?.isBusy = false
            if let error {
                self?.authError = Self.mapAuthError(error)
            } else {
                self?.authMessage = "Password reset email sent."
            }
        }
    }

    func signInWithPasskey(email: String?) {
        isBusy = true
        authError = nil
        authMessage = nil
        mfaError = nil
        mfaMessage = nil

        _Concurrency.Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let token = try await PasskeyService.shared.signIn(email: email)
                try await self.signIn(withCustomToken: token)
            } catch {
                self.authError = Self.mapAuthError(error)
            }
            self.isBusy = false
        }
    }

    func selectMfaOption(id: String) {
        guard var state = mfaState else { return }
        state.selectedOptionId = id
        state.verificationId = nil
        mfaState = state
        requestMfaCodeIfNeeded()
    }

    func requestMfaCodeIfNeeded() {
        guard let state = mfaState else { return }
        guard let option = state.selectedOption else { return }
        guard option.isPhone else { return }
        sendSmsCode(for: option)
    }

    func verifyMfa(code: String) {
        guard let state = mfaState else { return }
        guard let option = state.selectedOption else { return }
        let resolver = state.resolver

        mfaError = nil
        mfaMessage = nil
        isMfaBusy = true

        if option.isPhone {
            guard let verificationId = state.verificationId else {
                isMfaBusy = false
                mfaError = "Request a verification code first."
                return
            }

            let credential = PhoneAuthProvider.provider().credential(
                withVerificationID: verificationId,
                verificationCode: code
            )
            let assertion = PhoneMultiFactorGenerator.assertion(with: credential)
            resolver.resolveSignIn(with: assertion) { [weak self] _, error in
                self?.isMfaBusy = false
                if let error {
                    self?.mfaError = Self.mapAuthError(error)
                    return
                }
                self?.clearMfaState()
            }
            return
        }

        if option.isTotp {
            let enrollmentId = option.hint.uid
            let assertion = TOTPMultiFactorGenerator.assertionForSignIn(
                withEnrollmentID: enrollmentId,
                oneTimePassword: code
            )
            resolver.resolveSignIn(with: assertion) { [weak self] _, error in
                self?.isMfaBusy = false
                if let error {
                    self?.mfaError = Self.mapAuthError(error)
                    return
                }
                self?.clearMfaState()
            }
            return
        }

        isMfaBusy = false
        mfaError = "Unsupported second factor."
    }

    func cancelMfa() {
        clearMfaState()
    }

    func clearMessages() {
        authError = nil
        authMessage = nil
    }

    private func beginMfaFlow(resolver: MultiFactorResolver) {
        let options = resolver.hints.map { hint in
            MfaOption(
                id: hint.uid,
                factorId: hint.factorID,
                displayName: hint.displayName,
                phoneNumber: (hint as? PhoneMultiFactorInfo)?.phoneNumber,
                hint: hint
            )
        }

        mfaState = MfaState(
            resolver: resolver,
            options: options,
            selectedOptionId: options.first?.id,
            verificationId: nil
        )
        requestMfaCodeIfNeeded()
    }

    private func sendSmsCode(for option: MfaOption) {
        guard option.isPhone, let resolver = mfaState?.resolver else { return }
        guard let phoneHint = option.hint as? PhoneMultiFactorInfo else { return }

        mfaError = nil
        mfaMessage = nil
        isMfaBusy = true

        PhoneAuthProvider.provider().verifyPhoneNumber(
            with: phoneHint,
            uiDelegate: nil,
            multiFactorSession: resolver.session
        ) { [weak self] verificationId, error in
            self?.isMfaBusy = false
            if let error {
                self?.mfaError = Self.mapAuthError(error)
                return
            }
            guard let verificationId else {
                self?.mfaError = "Unable to send verification code."
                return
            }
            self?.mfaState?.verificationId = verificationId
            self?.mfaMessage = "Verification code sent."
        }
    }

    private func signIn(withCustomToken token: String) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            Auth.auth().signIn(withCustomToken: token) { _, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
        }
    }

    private func clearMfaState() {
        mfaState = nil
        mfaError = nil
        mfaMessage = nil
        isMfaBusy = false
    }

    private static func extractResolver(from error: Error) -> MultiFactorResolver? {
        let nsError = error as NSError
        if AuthErrorCode(rawValue: nsError.code) == .secondFactorRequired {
            return nsError.userInfo[AuthErrorUserInfoMultiFactorResolverKey] as? MultiFactorResolver
        }
        return nil
    }

    private static func mapAuthError(_ error: Error) -> String {
        let nsError = error as NSError
        guard let code = AuthErrorCode(rawValue: nsError.code) else {
            return nsError.localizedDescription
        }

        switch code {
        case .invalidEmail:
            return "Enter a valid email address."
        case .wrongPassword, .invalidCredential:
            return "Incorrect email or password."
        case .userNotFound:
            return "No account found for that email."
        case .emailAlreadyInUse:
            return "An account already exists for this email."
        case .weakPassword:
            return "Password must be at least 6 characters."
        case .networkError:
            return "Network error. Check your connection."
        case .secondFactorRequired:
            return "Two-factor verification required."
        default:
            return nsError.localizedDescription
        }
    }
}

struct MfaState {
    let resolver: MultiFactorResolver
    let options: [MfaOption]
    var selectedOptionId: String?
    var verificationId: String?

    var selectedOption: MfaOption? {
        guard let selectedOptionId else { return options.first }
        return options.first { $0.id == selectedOptionId } ?? options.first
    }
}

struct MfaOption: Identifiable {
    let id: String
    let factorId: String
    let displayName: String?
    let phoneNumber: String?
    let hint: MultiFactorInfo

    var isPhone: Bool {
        hint is PhoneMultiFactorInfo || factorId == "phone"
    }

    var isTotp: Bool {
        factorId == "totp"
    }

    var label: String {
        if let phoneNumber {
            return phoneNumber
        }
        if let displayName, !displayName.isEmpty {
            return displayName
        }
        return isTotp ? "Authenticator app" : "Second factor"
    }
}
