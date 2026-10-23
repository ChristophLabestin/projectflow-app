import SwiftUI
import FirebaseAuth
import FirebaseFirestore
import PFData
import PFDesign

/// "Erste Schritte": the first-run checklist of the web dashboard (`GettingStartedCard`). Every step is
/// derived from real data and ticks itself off; the card disappears once everything is done or the user
/// hides it (`checklistDismissed`, shared with web). Only accounts with an onboarding doc see it.
struct TodayGettingStarted: View {
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var emailVerified = Auth.auth().currentUser?.isEmailVerified ?? true
    @State private var secured = false
    @State private var verifySent = false
    @State private var busy = false

    private enum StepID: String, CaseIterable { case verify, project, tasks, invite, secure }

    private struct Step: Identifiable {
        let id: StepID
        let done: Bool
    }

    private var steps: [Step] {
        guard let workspace = model.workspace, let session = model.session else { return [] }
        let usesPassword = Auth.auth().currentUser?.providerData.contains { $0.providerID == "password" } ?? false
        let isAdmin = session.role == .owner || session.role == .admin
        var list: [Step] = []
        if usesPassword { list.append(Step(id: .verify, done: emailVerified)) }
        list.append(Step(id: .project, done: !workspace.projects.isEmpty))
        list.append(Step(id: .tasks, done: workspace.myTasks.count + workspace.personalTasks.count >= 3))
        if isAdmin { list.append(Step(id: .invite, done: workspace.people.count > 1)) }
        list.append(Step(id: .secure, done: secured))
        return list
    }

    /// Visible while the account is new enough, not hidden and not finished.
    static func isActive(model: AppModel) -> Bool {
        guard let session = model.session else { return false }
        return session.hasOnboarding && !session.checklistDismissed
    }

    var body: some View {
        let steps = steps
        let doneCount = steps.filter(\.done).count
        if Self.isActive(model: model), !steps.isEmpty, doneCount < steps.count {
            let next = steps.first { !$0.done }?.id
            VStack(alignment: .leading, spacing: PFSpace.m) {
                header(done: doneCount, total: steps.count)
                VStack(spacing: 0) {
                    ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                        if index > 0 { PFRowDivider(leadingInset: 52) }
                        row(step, isNext: step.id == next)
                    }
                }
                .pfCard()
            }
            .task { await refreshSecurity() }
            .animation(PFMotion.respecting(PFMotion.snappy), value: doneCount)
        }
    }

    private func header(done: Int, total: Int) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    PFEyebrow(L10n.t("gettingStarted.title"))
                    Text(L10n.t("gettingStarted.progress", ["done": done, "total": total]))
                        .pfText(.section)
                        .foregroundStyle(PFColor.textMain)
                        .contentTransition(.numericText())
                }
                Spacer()
                Button(L10n.t("gettingStarted.dismiss")) {
                    Task { await model.session?.dismissChecklist() }
                }
                .buttonStyle(.plain)
                .pfText(.metaStrong)
                .foregroundStyle(PFColor.textMuted)
            }
            PFProgressBar(value: Double(done) / Double(max(total, 1)))
        }
    }

    private func row(_ step: Step, isNext: Bool) -> some View {
        HStack(alignment: .top, spacing: PFSpace.s) {
            ZStack {
                Circle()
                    .fill(step.done ? PFColor.success : (isNext ? PFColor.primary : PFColor.raised))
                    .frame(width: 30, height: 30)
                Image(systemName: step.done ? "checkmark" : symbol(step.id))
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(step.done || isNext ? PFColor.onPrimary : PFColor.textMuted)
            }
            .padding(.top, 2)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                Text(L10n.t("gettingStarted.\(step.id.rawValue).title"))
                    .pfText(.rowTitle)
                    .foregroundStyle(step.done ? PFColor.textMuted : PFColor.textMain)
                    .strikethrough(step.done, color: PFColor.textSubtle)
                if !step.done {
                    Text(hint(step.id))
                        .pfText(.meta)
                        .foregroundStyle(PFColor.textMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if isNext {
                    PFButton(actionTitle(step.id), kind: .primary, size: .small) { run(step.id) }
                        .disabled(busy)
                        .padding(.top, 6)
                }
            }
            Spacer(minLength: 0)
            if !step.done, !isNext {
                Button { run(step.id) } label: {
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(PFColor.textSubtle)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.pfPressable)
                .accessibilityLabel(actionTitle(step.id))
            }
        }
        .padding(.horizontal, PFSpace.m)
        .padding(.vertical, 14)
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(step.done ? [.isSelected] : [])
    }

    private func symbol(_ id: StepID) -> String {
        switch id {
        case .verify: "envelope"
        case .project: "square.stack.3d.up"
        case .tasks: "checklist"
        case .invite: "person.badge.plus"
        case .secure: "person.badge.key"
        }
    }

    private func hint(_ id: StepID) -> String {
        if id == .verify, verifySent { return L10n.t("gettingStarted.verify.sent", ["email": Auth.auth().currentUser?.email ?? ""]) }
        return L10n.t("gettingStarted.\(id.rawValue).hint")
    }

    private func actionTitle(_ id: StepID) -> String {
        if id == .verify, verifySent { return L10n.t("gettingStarted.verify.check") }
        return L10n.t("gettingStarted.\(id.rawValue).action")
    }

    private func run(_ id: StepID) {
        PFHaptics.tap()
        switch id {
        case .project:
            presenter.present(detents: [.large]) { ProjectCreateSheet() }
        case .tasks:
            CaptureLauncher.present(model: model)
        case .invite:
            model.router.push(.team)
        case .secure:
            model.router.push(.securitySettings)
        case .verify:
            Task {
                busy = true
                defer { busy = false }
                if verifySent {
                    emailVerified = (try? await AccountSecurity.isEmailVerified()) ?? false
                    if !emailVerified { model.toasts.show(PFToast(L10n.t("gettingStarted.verify.pending"), style: .warning)) }
                } else {
                    try? await AccountSecurity.sendEmailVerification()
                    verifySent = true
                }
            }
        }
    }

    /// Passkey or second factor = secured (same rule as the web card).
    private func refreshSecurity() async {
        guard let user = Auth.auth().currentUser else { return }
        emailVerified = user.isEmailVerified
        if !user.multiFactor.enrolledFactors.isEmpty { secured = true; return }
        let passkeys = try? await PFPath.user(user.uid).collection("passkeys").limit(to: 1).getDocuments()
        secured = !(passkeys?.isEmpty ?? true)
    }
}
