import SwiftUI
import PFData
import PFDesign
import PFModel

/// Full-screen first-sign-in onboarding: name (+ optional photo) → about you → team (+ workspace for owners) → how you got here → notifications.
/// Shown while `users/{uid}/private/onboarding.welcomePending` is true (web shows the same flow);
/// finishing it on any platform clears the flag everywhere.
struct WelcomeOnboardingView: View {
    private enum Step: Int { case name, about, team, how, notifications }

    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var step: Step = .name
    @State private var markCenter: CGPoint?
    @State private var name = ""
    @State private var photoURL = ""
    @State private var isUploadingPhoto = false
    @State private var workspaceName = ""
    @State private var role: String?
    @State private var useCases: Set<String> = []
    @State private var teamSize: String?
    @State private var industry: String?
    @State private var source: String?
    @State private var previousTool: String?
    @State private var emails = ""
    @State private var isBusy = false
    @State private var error: String?
    @State private var loaded = false
    @State private var goingBack = false
    @State private var trailingInset: CGFloat = 0

    /// iPhone Duo outer display: back and next move into the side region, like on pushed pages.
    private var sideRegion: CGFloat {
        PFLayout.sideRegionWidth(trailingInset: trailingInset, isCompact: horizontalSizeClass == .compact)
    }

    private var isOwner: Bool { model.session?.role == .owner }
    private var steps: [Step] { [.name, .about, .team, .how, .notifications] }
    private var invitesEnabled: Bool { isOwner && teamSize != nil && teamSize != "solo" }
    private var isSurveyStep: Bool { step == .about || step == .team || step == .how }
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
        .overlay { if sideRegion > 0 { sideControls } }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.trailing } action: { trailingInset = $0 }
        .task {
            guard !loaded else { return }
            loaded = true
            name = model.auth.displayName ?? ""
            workspaceName = model.session?.activeWorkspace?.name ?? L10n.t("onboarding.defaultWorkspace")
            if let uid = model.uid { photoURL = await ProfileDraft(uid: uid).photoURL }
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
            .opacity(stepIndex == 0 || sideRegion > 0 ? 0 : 1)
            .disabled(stepIndex == 0 || isBusy || sideRegion > 0)
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
            if sideRegion == 0 {
                PFButton(primaryTitle, systemImage: primaryIcon, size: .large, fullWidth: true) { primaryAction() }
                    .disabled(isBusy || !canContinue)
                    .overlay(alignment: .trailing) { if isBusy { ProgressSpinner().padding(.trailing, 20) } }
            }
            if isSurveyStep {
                PFButton(L10n.t("survey.skip"), kind: .ghost, size: .medium, fullWidth: true) { skip() }
                    .disabled(isBusy)
            }
            if step == .notifications {
                PFButton(L10n.t("welcome.notify.skip"), kind: .ghost, size: .medium, fullWidth: true) { finish() }
                    .disabled(isBusy)
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, footerIsEmpty ? 0 : PFSpace.s)
        .padding(.bottom, footerIsEmpty ? 0 : PFSpace.s)
        .background(footerIsEmpty ? AnyShapeStyle(.clear) : AnyShapeStyle(.regularMaterial))
    }

    /// Side region: nothing but the side controls left at the bottom (no secondary button, no error).
    private var footerIsEmpty: Bool {
        sideRegion > 0 && error == nil && !isSurveyStep && step != .notifications
    }

    /// Next above back (back lowest, under the thumb), as on pushed pages.
    private var sideControls: some View {
        PFSideColumn(side: sideRegion) {
            PFIconButton(primaryIcon, label: primaryTitle, style: .primary) { primaryAction() }
                .disabled(isBusy || !canContinue)
                .opacity(isBusy || !canContinue ? 0.4 : 1)
            if stepIndex > 0 {
                PFIconButton("chevron.left", label: L10n.t("welcome.back")) { go(back: true) }
                    .disabled(isBusy)
            }
        }
    }

    private var primaryIcon: String {
        switch step {
        case .notifications: "bell.badge"
        case .team where invitesEnabled && !parsedEmails.isEmpty: "paperplane"
        default: "arrow.right"
        }
    }

    // MARK: Steps

    @ViewBuilder private var content: some View {
        switch step {
        case .name: nameStep
        case .about: aboutStep
        case .team: teamStep
        case .how: howStep
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
            photoRow
        }
    }

    /// Optional profile photo; uploaded and saved right away (same path as the profile editor).
    private var photoRow: some View {
        HStack(spacing: PFSpace.m) {
            Button { changePhoto() } label: {
                PFAvatar(name: name, seed: model.uid, imageURL: photoURL.isEmpty ? nil : photoURL, size: 64)
                    .overlay { if isUploadingPhoto { ProgressView() } }
                    .overlay(alignment: .bottomTrailing) {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(PFColor.onPrimary)
                            .frame(width: 24, height: 24)
                            .background(PFColor.textMain, in: .circle)
                            .overlay(Circle().stroke(PFColor.canvas, lineWidth: 2))
                            .offset(x: 2, y: 2)
                    }
            }
            .buttonStyle(.pfPressable)
            .disabled(isUploadingPhoto || isBusy)
            .accessibilityLabel(L10n.t(photoURL.isEmpty ? "welcome.photo.add" : "profile.photo.change"))
            VStack(alignment: .leading, spacing: PFSpace.xs) {
                PFButton(L10n.t(photoURL.isEmpty ? "welcome.photo.add" : "profile.photo.change"), systemImage: "camera",
                         kind: .secondary, size: .small) { changePhoto() }
                    .disabled(isUploadingPhoto || isBusy)
                Text(L10n.t("welcome.photo.hint")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
            .accessibilityElement(children: .contain)
        }
    }

    private func options(_ group: String, _ ids: [String]) -> [ChoiceChips.Option] {
        ids.map { ChoiceChips.Option(id: $0, title: L10n.t("survey.\(group).\($0)")) }
    }

    private func question(_ label: String, @ViewBuilder _ chips: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFEyebrow(label)
            chips()
        }
    }

    private func single(_ group: String, _ ids: [String], _ value: Binding<String?>) -> some View {
        ChoiceChips(options: options(group, ids), selection: Set([value.wrappedValue].compactMap { $0 })) { id in
            value.wrappedValue = value.wrappedValue == id ? nil : id
        }
    }

    private var aboutStep: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            heading(L10n.t("survey.about.title"), L10n.t("survey.about.subtitle"))
            question(L10n.t("survey.role.label")) { single("role", OnboardingSurvey.roles, $role) }
            question(L10n.t("survey.useCases.label")) {
                ChoiceChips(options: options("useCases", OnboardingSurvey.useCases), selection: useCases) { id in
                    if useCases.contains(id) { useCases.remove(id) } else { useCases.insert(id) }
                }
            }
        }
    }

    private var teamStep: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            heading(L10n.t("survey.team.title"), L10n.t("survey.team.subtitle"))
            question(L10n.t("survey.teamSize.label")) { single("teamSize", OnboardingSurvey.teamSizes, $teamSize) }
            question(L10n.t("survey.industry.label")) { single("industry", OnboardingSurvey.industries, $industry) }
            if isOwner {
                VStack(alignment: .leading, spacing: PFSpace.xs) {
                    PFEyebrow(L10n.t("welcome.workspace.name"))
                    PFTextField(L10n.t("welcome.workspace.name"), text: $workspaceName, systemImage: "building.2")
                }
            }
            if invitesEnabled {
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
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: invitesEnabled)
    }

    private var howStep: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            heading(L10n.t("survey.how.title"), L10n.t("survey.how.subtitle"))
            question(L10n.t("survey.source.label")) { single("source", OnboardingSurvey.sources, $source) }
            question(L10n.t("survey.previousTool.label")) { single("previousTool", OnboardingSurvey.previousTools, $previousTool) }
        }
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
            if let id = OnboardingSurvey.suggestedTemplateId(useCases: Array(useCases)), let key = OnboardingSurvey.templateLabelKey(id) {
                Label(L10n.t("welcome.notify.template", ["name": L10n.t(key)]), systemImage: "square.stack.3d.up")
                    .pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
        }
    }

    // MARK: Actions

    private var primaryTitle: String {
        switch step {
        case .team: invitesEnabled && !parsedEmails.isEmpty ? L10n.t("welcome.invite.send") : L10n.t("onboarding.next")
        case .name, .about, .how: L10n.t("onboarding.next")
        case .notifications: L10n.t("welcome.notify.allow")
        }
    }

    private var canContinue: Bool {
        switch step {
        case .name: !name.trimmingCharacters(in: .whitespaces).isEmpty && !isUploadingPhoto
        case .team: !isOwner || !workspaceName.trimmingCharacters(in: .whitespaces).isEmpty
        case .about, .how, .notifications: true
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
        case .about: go(back: false)
        case .team: saveWorkspace()
        case .how:
            saveSurvey()
            go(back: false)
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

    private func changePhoto() {
        isUploadingPhoto = true
        Task {
            defer { isUploadingPhoto = false }
            guard let file = await MediaUpload.pickAndUpload(model: model, purpose: .profilePhoto) else { return }
            do {
                try await model.profileActions?.setPhoto(url: file.url, tenantIds: model.session?.workspaces.map(\.id) ?? [])
                photoURL = file.url
                PFHaptics.success()
            } catch {
                self.error = L10n.t("welcome.error")
            }
        }
    }

    /// Skips the current survey screen: its answers stay absent, nothing else is saved.
    private func skip() {
        switch step {
        case .about: role = nil; useCases = []
        case .team: teamSize = nil; industry = nil
        case .how: source = nil; previousTool = nil; saveSurvey()
        default: break
        }
        go(back: false)
    }

    /// Written once when the last survey screen is left (also when everything was skipped).
    private func saveSurvey() {
        let ordered = OnboardingSurvey.useCases.filter(useCases.contains)
        Task {
            await model.session?.saveSurvey(role: role, useCases: ordered, teamSize: teamSize, industry: industry,
                                            source: source, previousTool: previousTool)
        }
    }

    private func saveWorkspace() {
        guard isOwner, let session = model.session, let active = session.activeWorkspace else { go(back: false); return }
        if invitesEnabled, !invalidEmails.isEmpty {
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
                if invitesEnabled {
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
