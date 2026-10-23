import SwiftUI
import PFData
import PFDesign
import PFModel

/// Full-screen first-sign-in onboarding: name → workspace (owners only) → notifications.
/// Shown while `users/{uid}/private/onboarding.welcomePending` is true (web shows the same flow);
/// finishing it on any platform clears the flag everywhere.
struct WelcomeOnboardingView: View {
    private enum Step: Int { case name, workspace, notifications }
    private enum Mode: Hashable { case solo, team }

    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var step: Step = .name
    @State private var markCenter: CGPoint?
    @State private var name = ""
    @State private var workspaceName = ""
    @State private var mode: Mode = .solo
    @State private var emails = ""
    @State private var isBusy = false
    @State private var error: String?
    @State private var loaded = false
    @State private var goingBack = false

    private var isOwner: Bool { model.session?.role == .owner }
    private var steps: [Step] { isOwner ? [.name, .workspace, .notifications] : [.name, .notifications] }
    private var stepIndex: Int { steps.firstIndex(of: step) ?? 0 }
    private var parsedEmails: [String] {
        emails.split(whereSeparator: { ", ;\n\t".contains($0) }).map { $0.lowercased() }
    }
    private var invalidEmails: [String] {
        parsedEmails.filter { $0.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) == nil }
    }

    var body: some View {
        ZStack {
            PFColor.canvas.ignoresSafeArea()
            // Ripples start at the brand mark (top left on the first step), away from the text.
            PFFlowField(center: markCenter ?? CGPoint(x: 90, y: 160), period: 5).ignoresSafeArea()
            VStack(spacing: 0) {
                header
                ScrollView {
                    content
                        .id(step)
                        .transition(reduceMotion ? .opacity : .asymmetric(
                            insertion: .move(edge: goingBack ? .leading : .trailing).combined(with: .opacity),
                            removal: .move(edge: goingBack ? .trailing : .leading).combined(with: .opacity)))
                        .padding(.horizontal, PFSpace.page)
                        .padding(.top, PFSpace.xl)
                        .padding(.bottom, PFSpace.xl)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .scrollDismissesKeyboard(.interactively)
                .scrollBounceBehavior(.basedOnSize)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { footer }
        .task {
            guard !loaded else { return }
            loaded = true
            name = model.auth.displayName ?? ""
            workspaceName = model.session?.activeWorkspace?.name ?? L10n.t("onboarding.defaultWorkspace")
        }
    }

    // MARK: Chrome

    private var header: some View {
        HStack(spacing: PFSpace.s) {
            Button { go(back: true) } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(PFColor.textMain)
                    .frame(width: 36, height: 36)
                    .background(PFColor.raised, in: .circle)
            }
            .buttonStyle(.pfPressable)
            .opacity(stepIndex == 0 ? 0 : 1)
            .disabled(stepIndex == 0 || isBusy)
            .accessibilityLabel(L10n.t("welcome.back"))
            Spacer()
            HStack(spacing: 6) {
                ForEach(steps.indices, id: \.self) { index in
                    Capsule()
                        .fill(index <= stepIndex ? PFColor.textMain : PFColor.raised)
                        .frame(width: index == stepIndex ? 22 : 8, height: 8)
                }
            }
            .animation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.85), value: stepIndex)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(L10n.t("welcome.step", ["n": "\(stepIndex + 1)", "total": "\(steps.count)"]))
            Spacer()
            Color.clear.frame(width: 36, height: 36)
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.s)
    }

    private var footer: some View {
        VStack(spacing: PFSpace.xs) {
            if let error {
                Label(error, systemImage: "exclamationmark.circle")
                    .pfText(.metaStrong)
                    .foregroundStyle(PFColor.dangerText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            PFButton(primaryTitle, systemImage: step == .notifications ? "bell.badge" : "arrow.right", size: .large, fullWidth: true) { primaryAction() }
                .disabled(isBusy || !canContinue)
                .overlay(alignment: .trailing) { if isBusy { ProgressSpinner().padding(.trailing, 20) } }
            if step == .notifications {
                PFButton(L10n.t("welcome.notify.skip"), kind: .ghost, size: .medium, fullWidth: true) { finish() }
                    .disabled(isBusy)
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.s)
        .padding(.bottom, PFSpace.s)
        .background(.regularMaterial)
    }

    // MARK: Steps

    @ViewBuilder private var content: some View {
        switch step {
        case .name: nameStep
        case .workspace: workspaceStep
        case .notifications: notificationsStep
        }
    }

    private func heading(_ title: String, _ subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            Text(title).pfText(.display).foregroundStyle(PFColor.textMain)
                .accessibilityAddTraits(.isHeader)
            Text(subtitle).pfText(.body).foregroundStyle(PFColor.textMuted)
        }
    }

    private var nameStep: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            PFBrandMark(glyph: Image("Glyph"), size: 40)
                .onGeometryChange(for: CGPoint.self) { proxy in
                    let frame = proxy.frame(in: .global)
                    return CGPoint(x: frame.midX, y: frame.midY)
                } action: { markCenter = $0 }
            heading(L10n.t("welcome.name.title"), L10n.t("welcome.name.subtitle"))
            PFTextField(L10n.t("welcome.name.placeholder"), text: $name, systemImage: "person", submitLabel: .continue) {
                if canContinue { primaryAction() }
            }
            .textContentType(.name)
        }
    }

    private var workspaceStep: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            heading(L10n.t("welcome.workspace.title"), L10n.t("welcome.workspace.subtitle"))
            PFTextField(L10n.t("welcome.workspace.name"), text: $workspaceName, systemImage: "building.2")
            VStack(alignment: .leading, spacing: PFSpace.xs) {
                PFSegmented([(Mode.solo, L10n.t("welcome.mode.solo")), (Mode.team, L10n.t("welcome.mode.team"))], selection: $mode)
                Text(mode == .solo ? L10n.t("welcome.mode.soloHint") : L10n.t("welcome.mode.teamHint"))
                    .pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
            if mode == .team {
                VStack(alignment: .leading, spacing: PFSpace.xs) {
                    PFEyebrow(L10n.t("welcome.invite.label"))
                    PFTextField(L10n.t("welcome.invite.placeholder"), text: $emails, systemImage: "envelope", axis: .vertical)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Text(L10n.t("welcome.invite.hint")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
                .transition(.opacity)
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: mode)
    }

    private var notificationsStep: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            Image(systemName: "bell.badge")
                .font(.system(size: 30, weight: .medium))
                .foregroundStyle(PFColor.textMain)
                .frame(width: 72, height: 72)
                .background(PFColor.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                .pfElevation(.card, radius: 22)
            heading(L10n.t("welcome.notify.title"), L10n.t("welcome.notify.subtitle"))
        }
    }

    // MARK: Actions

    private var primaryTitle: String {
        switch step {
        case .name: L10n.t("onboarding.next")
        case .workspace: mode == .team && !parsedEmails.isEmpty ? L10n.t("welcome.invite.send") : L10n.t("onboarding.next")
        case .notifications: L10n.t("welcome.notify.allow")
        }
    }

    private var canContinue: Bool {
        switch step {
        case .name: !name.trimmingCharacters(in: .whitespaces).isEmpty
        case .workspace: !workspaceName.trimmingCharacters(in: .whitespaces).isEmpty
        case .notifications: true
        }
    }

    private func go(back: Bool) {
        error = nil
        let target = back ? stepIndex - 1 : stepIndex + 1
        guard steps.indices.contains(target) else { return }
        goingBack = back
        withAnimation(reduceMotion ? nil : .spring(response: 0.45, dampingFraction: 0.88)) { step = steps[target] }
    }

    private func primaryAction() {
        switch step {
        case .name: saveName()
        case .workspace: saveWorkspace()
        case .notifications:
            isBusy = true
            Task {
                await PushRegistrar.shared.requestPermissionIfNeeded()
                finish()
            }
        }
    }

    private func saveName() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard let uid = model.uid else { return }
        isBusy = true
        error = nil
        Task {
            defer { isBusy = false }
            do {
                // Same write as the profile editor: Auth profile, `users/{uid}`, membership docs.
                var draft = await ProfileDraft(uid: uid)
                draft.displayName = trimmed
                try await model.profileActions?.saveProfile(draft, tenantIds: model.session?.workspaces.map(\.id) ?? [])
                go(back: false)
            } catch {
                self.error = L10n.t("welcome.error")
            }
        }
    }

    private func saveWorkspace() {
        guard let session = model.session, let active = session.activeWorkspace else { return }
        if mode == .team, !invalidEmails.isEmpty {
            error = L10n.t("welcome.invite.invalid", ["emails": invalidEmails.joined(separator: ", ")])
            return
        }
        isBusy = true
        error = nil
        let newName = workspaceName.trimmingCharacters(in: .whitespaces)
        Task {
            defer { isBusy = false }
            do {
                let actions = TeamActions(tenantId: active.id, uid: session.uid)
                if newName != active.name {
                    try await actions.renameWorkspace(newName)
                    await session.reloadWorkspaces()
                }
                if mode == .team {
                    let language = L10n.locale.language.languageCode?.identifier ?? "de"
                    for email in parsedEmails {
                        try await actions.createInvitation(kind: .email, email: email, role: "Member", tenantName: newName,
                                                           inviterName: name.trimmingCharacters(in: .whitespaces), language: language)
                    }
                }
                go(back: false)
            } catch {
                self.error = L10n.t("welcome.error")
            }
        }
    }

    private func finish() {
        if let uid = model.uid { OnboardingState.markIntroSeen(uid: uid) }
        Task {
            await model.session?.finishWelcome()
            withAnimation(.easeOut(duration: 0.3)) { model.welcomeDismissed = true }
            PFHaptics.success()
        }
    }
}
