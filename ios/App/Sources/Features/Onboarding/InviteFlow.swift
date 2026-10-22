import SwiftUI
import PFData
import PFDesign

/// `/invite/<tenantId>/<inviteId>` (universal link or `projectflow://invite/...`).
struct InviteLink: Hashable {
    let tenantId: String
    let inviteId: String
}

/// Why accepting an invitation failed (backend error codes of `acceptWorkspaceInvite`, contract C6).
enum InviteFailure: Equatable {
    case emailMismatch
    case emailUnverified
    case invalid
    case other

    init(_ error: Error) {
        // The Functions SDK can append the HTTP status ("invite-expired [412]"): map on the code only.
        let ns = error as NSError
        let message = (ns.userInfo[NSLocalizedDescriptionKey] as? String) ?? ns.localizedDescription
        switch message.split(separator: " ").first.map(String.init) {
        case "invite-email-mismatch": self = .emailMismatch
        case "invite-email-unverified": self = .emailUnverified
        case "invite-expired", "invite-used-up", "invite-not-pending", "not-found": self = .invalid
        default: self = .other
        }
    }
}

@MainActor
enum InviteService {
    /// Accepts the invitation, refreshes the memberships and switches to the new workspace.
    static func accept(_ link: InviteLink, model: AppModel) async throws {
        _ = try await PFCallables.call("acceptWorkspaceInvite", ["tenantId": link.tenantId, "inviteId": link.inviteId])
        await model.session?.reloadWorkspaces()
        model.switchWorkspace(to: link.tenantId)
    }
}

/// Sheet shown when an invitation link arrives (also after sign-in, the router replays the link).
struct InviteAcceptSheet: View {
    let link: InviteLink
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var isWorking = false
    @State private var failure: InviteFailure?

    init(link: InviteLink, failure: InviteFailure? = nil) {
        self.link = link
        self._failure = State(initialValue: failure)
    }

    var body: some View {
        VStack(spacing: PFSpace.m) {
            Image(systemName: failure == nil ? "envelope.open" : "exclamationmark.triangle")
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(failure == nil ? PFColor.textMuted : PFColor.warningText)
                .frame(width: 52, height: 52)
                .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
            VStack(spacing: 6) {
                Text(title).pfText(.section).foregroundStyle(PFColor.textMain).multilineTextAlignment(.center)
                Text(message).pfText(.meta).foregroundStyle(PFColor.textMuted).multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                if failure == .emailMismatch {
                    Text(L10n.t("invite.mismatch.apple")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true).padding(.top, 4)
                }
            }
            actions
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.xs)
        .padding(.bottom, PFSpace.l)
        .frame(maxWidth: .infinity)
    }

    private var email: String { model.auth.email ?? model.profile?.email ?? "—" }

    private var title: String {
        switch failure {
        case nil: L10n.t("invite.title")
        case .emailMismatch: L10n.t("invite.mismatch.title")
        case .emailUnverified: L10n.t("invite.unverified.title")
        case .invalid: L10n.t("invite.invalid.title")
        case .other: L10n.t("invite.error.title")
        }
    }

    private var message: String {
        switch failure {
        case nil: L10n.t("invite.message", ["email": email])
        case .emailMismatch: L10n.t("invite.mismatch.message", ["current": email])
        case .emailUnverified: L10n.t("invite.unverified.message")
        case .invalid: L10n.t("invite.invalid.message")
        case .other: L10n.t("invite.error.message")
        }
    }

    @ViewBuilder private var actions: some View {
        switch failure {
        case nil, .other:
            VStack(spacing: PFSpace.xs) {
                PFButton(isWorking ? L10n.t("common.loading") : L10n.t("invite.accept"), size: .large, fullWidth: true) { accept() }
                    .disabled(isWorking)
                PFButton(L10n.t("common.cancel"), kind: .ghost, size: .large, fullWidth: true) { presenter.dismiss() }
            }
        case .emailMismatch:
            VStack(spacing: PFSpace.xs) {
                PFButton(L10n.t("invite.openSecurity"), systemImage: "lock.shield", size: .large, fullWidth: true) {
                    presenter.dismissAll()
                    model.router.select(.today)
                    model.router.push(.securitySettings)
                }
                PFButton(L10n.t("invite.switchAccount"), kind: .ghost, size: .large, fullWidth: true) {
                    presenter.dismissAll()
                    Task {
                        await PushRegistrar.shared.signOut()
                        model.auth.signOut()
                    }
                }
                PFButton(L10n.t("common.close"), kind: .ghost, size: .large, fullWidth: true) { presenter.dismiss() }
            }
        case .emailUnverified, .invalid:
            PFButton(L10n.t("common.close"), kind: .ghost, size: .large, fullWidth: true) { presenter.dismiss() }
        }
    }

    private func accept() {
        isWorking = true
        Task {
            do {
                try await InviteService.accept(link, model: model)
                PFHaptics.success()
                presenter.dismiss()
                if let name = model.session?.activeWorkspace?.name {
                    model.toasts.show(PFToast(L10n.t("invite.joined", ["name": name]), style: .success))
                }
            } catch {
                failure = InviteFailure(error)
                isWorking = false
                PFHaptics.warning()
            }
        }
    }
}
