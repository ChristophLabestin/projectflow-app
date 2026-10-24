import SwiftUI
import PFData
import PFDesign
import PFModel

/// Full-screen first-sign-in onboarding: name (+ optional photo) → about you → team (+ workspace for owners) → how you got here → notifications.
/// Shown while `users/{uid}/private/onboarding.welcomePending` is true (web shows the same flow);
/// finishing it on any platform clears the flag everywhere.
struct WelcomeOnboardingView: View {
    private enum Step: Int { case name, about, team, invite, how, notifications }
    private enum WorkMode { case solo, team }

    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var step: Step = .name
    @State private var markCenter: CGPoint?
    @State private var name = ""
    @State private var photoURL = ""
    /// The name field has focus (keyboard up).
    @State private var nameFocused = false
    @State private var isUploadingPhoto = false
    @State private var teamName = ""
    @State private var workMode: WorkMode?
    /// Team workspace created in this onboarding (billing contract §7: team workspaces are separate from the personal one).
    @State private var createdTeam: (id: String, name: String)?
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

    private var steps: [Step] { workMode == .team ? [.name, .about, .team, .invite, .how, .notifications] : [.name, .about, .team, .how, .notifications] }
    private var invitesEnabled: Bool { step == .invite && createdTeam != nil }
    private var isSurveyStep: Bool { step == .about || step == .team || step == .invite || step == .how }
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
        .onChange(of: model.profile?.displayName) { _, _ in if name.isEmpty, !nameFocused { name = prefilledName } }
        .task {
            guard !loaded else { return }
            loaded = true
            if name.isEmpty { name = prefilledName }
            if let uid = model.uid { photoURL = await ProfileDraft(uid: uid).photoURL }
        }
    }

    // MARK: Chrome

    private var header: some View {
        HStack(spacing: PFSpace.s) {
            // iPhone Duo outer display: back lives in the side column instead.
            if stepIndex > 0, sideRegion == 0 {
                PFIconButton("chevron.left", label: L10n.t("welcome.back")) { go(back: true) }
                    .disabled(isBusy)
            }
            Spacer(minLength: 0)
            if let skipTitle {
                Button { skipCurrent() } label: {
                    Text(skipTitle).pfText(.buttonSmall).foregroundStyle(PFColor.textMain)
                        .padding(.horizontal, 14).frame(minHeight: 36)
                        .pfPillSurface()
                }
                .buttonStyle(.pfPressable)
                .disabled(isBusy)
                .accessibilityLabel(skipAccessibilityLabel)
            }
        }
        .frame(minHeight: 44)
        .overlay {
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
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.s)
    }

    /// Survey screens can be skipped, the notification screen can start without notifications.
    private var skipTitle: String? {
        if isSurveyStep { return L10n.t("survey.skip") }
        if step == .notifications { return L10n.t("welcome.notify.later") }
        return nil
    }

    private var skipAccessibilityLabel: String {
        step == .notifications ? L10n.t("welcome.notify.skip") : L10n.t("survey.skip")
    }

    private func skipCurrent() {
        if step == .notifications { finish() } else { skip() }
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
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, footerIsEmpty ? 0 : PFSpace.s)
        .padding(.bottom, footerIsEmpty ? 0 : PFSpace.s)
        .background(footerIsEmpty ? AnyShapeStyle(.clear) : AnyShapeStyle(.regularMaterial))
    }

    /// Side region: nothing left at the bottom unless there is an error.
    private var footerIsEmpty: Bool { sideRegion > 0 && error == nil }

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
        case .invite where !parsedEmails.isEmpty: "paperplane"
        default: "arrow.right"
        }
    }

    // MARK: Steps

    @ViewBuilder private var content: some View {
        switch step {
        case .name: nameStep
        case .about: aboutStep
        case .team: teamStep
        case .invite: inviteStep
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

    /// Name given at signup or in the checkout (`updateProfile` → Auth `displayName`, mirrored to `users/{uid}`).
    /// The bare email prefix the profile falls back to is not a name, so it's not prefilled.
    private var prefilledName: String {
        let emailPrefix = model.auth.email?.components(separatedBy: "@").first?.lowercased()
        for candidate in [model.profile?.displayName, model.auth.displayName] {
            let value = candidate?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !value.isEmpty, value.lowercased() != emailPrefix, value != "User" { return value }
        }
        return ""
    }

    private var nameStep: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            // With the keyboard up the mark steps aside, so the step never scrolls under the indicator.
            if !nameFocused {
                PFBrandMark(glyph: Image("Glyph"), size: 40)
                    .onGeometryChange(for: CGPoint.self) { proxy in
                        let frame = proxy.frame(in: .global)
                        return CGPoint(x: frame.midX, y: frame.midY)
                    } action: { markCenter = $0 }
                    .transition(.scale(scale: 0.6, anchor: .topLeading).combined(with: .opacity))
            }
            heading(L10n.t("welcome.name.title"), L10n.t("welcome.name.subtitle"))
            // The name is written like a task title in the capture sheet: big text, no field chrome.
            CaptureTextField(text: $name, isFocused: $nameFocused, placeholder: L10n.t("welcome.name.placeholder"),
                             highlights: [], submitLabel: .continue, onTapHighlight: { _ in }) {
                if canContinue { primaryAction() }
            }
            .accessibilityLabel(L10n.t("welcome.name.label"))
            .onAppear { if prefilledName.isEmpty && name.isEmpty { nameFocused = true } }
            identityCard
        }
        .animation(PFMotion.respecting(PFMotion.snappy), value: nameFocused)
    }

    /// Profile photo (optional, uploads and saves right away).
    private var identityCard: some View {
        VStack(alignment: .leading, spacing: PFSpace.l) {
            Button { changePhoto() } label: {
                HStack(spacing: PFSpace.m) {
                    photoCircle
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Text(L10n.t("welcome.photo.label")).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                            Text(L10n.t("welcome.optional")).pfText(.caption).foregroundStyle(PFColor.textMuted)
                                .padding(.horizontal, 7).frame(minHeight: 20)
                                .background(PFColor.raised, in: .capsule)
                        }
                        Text(L10n.t(photoURL.isEmpty ? "welcome.photo.tapAdd" : "welcome.photo.tapChange"))
                            .pfText(.meta).foregroundStyle(PFColor.textMuted)
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.pfPressable)
            .disabled(isUploadingPhoto || isBusy)
            .accessibilityLabel(L10n.t(photoURL.isEmpty ? "welcome.photo.add" : "profile.photo.change"))
            .accessibilityHint(L10n.t("welcome.optional"))
        }
        .padding(PFSpace.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PFColor.card, in: .rect(cornerRadius: 24, style: .continuous))
        .pfElevation(.card, radius: 24)
    }

    private var photoCircle: some View {
        ZStack {
            if photoURL.isEmpty {
                Circle().fill(PFColor.raised)
                Circle().strokeBorder(PFColor.hairlineStrong, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                Image(systemName: "camera.fill").font(.system(size: 22, weight: .semibold)).foregroundStyle(PFColor.textMuted)
            } else {
                PFAvatar(name: name, seed: model.uid, imageURL: photoURL, size: 76)
            }
            if isUploadingPhoto { Circle().fill(.black.opacity(0.25)); ProgressView().tint(.white) }
        }
        .frame(width: 76, height: 76)
        .overlay(alignment: .bottomTrailing) {
            Image(systemName: photoURL.isEmpty ? "plus" : "pencil")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(PFColor.onPrimary)
                .frame(width: 26, height: 26)
                .background(PFColor.primary, in: .circle)
                .overlay(Circle().stroke(PFColor.card, lineWidth: 2.5))
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
            heading(L10n.t("welcome.mode.title"), L10n.t("welcome.mode.subtitle"))
            VStack(spacing: PFSpace.s) {
                modeOption(.solo, icon: "person", title: L10n.t("welcome.mode.solo"), hint: L10n.t("welcome.mode.soloHint"))
                modeOption(.team, icon: "person.2", title: L10n.t("welcome.mode.team"), hint: L10n.t("welcome.mode.teamHint"))
            }
            if workMode == .team {
                VStack(alignment: .leading, spacing: PFSpace.xs) {
                    PFEyebrow(L10n.t("welcome.team.name"))
                    PFTextField(L10n.t("welcome.team.placeholder"), text: $teamName, systemImage: "building.2")
                }
                .transition(.opacity)
                question(L10n.t("survey.teamSize.label")) {
                    single("teamSize", OnboardingSurvey.teamSizes.filter { $0 != "solo" }, $teamSize)
                }
                .transition(.opacity)
            }
            question(L10n.t("survey.industry.label")) { single("industry", OnboardingSurvey.industries, $industry) }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: workMode)
    }

    private func modeOption(_ mode: WorkMode, icon: String, title: String, hint: String) -> some View {
        let selected = workMode == mode
        return Button {
            PFHaptics.selection()
            workMode = mode
            teamSize = mode == .solo ? "solo" : (teamSize == "solo" ? nil : teamSize)
        } label: {
            HStack(spacing: PFSpace.m) {
                Image(systemName: icon).font(.system(size: 18, weight: .semibold)).foregroundStyle(PFColor.textMain)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                    Text(hint).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(selected ? PFColor.textMain : PFColor.hairlineStrong)
            }
            .padding(.horizontal, PFSpace.m)
            .padding(.vertical, 12)
            .frame(minHeight: 64)
            // Selected sinks into the canvas (no outline); the others stay raised cards.
            .background(selected ? .clear : PFColor.card, in: RoundedRectangle(cornerRadius: PFRadius.card, style: .continuous))
            .pfSunken(selected, in: RoundedRectangle(cornerRadius: PFRadius.card, style: .continuous))
            .pfElevation(selected ? .flat : .card, radius: PFRadius.card)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private var inviteStep: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            heading(L10n.t("welcome.invite.title"), L10n.t("welcome.invite.subtitle", ["name": createdTeam?.name ?? teamName]))
            VStack(alignment: .leading, spacing: PFSpace.xs) {
                PFEyebrow(L10n.t("welcome.invite.label"))
                PFTextField(L10n.t("welcome.invite.placeholder"), text: $emails, systemImage: "envelope", axis: .vertical)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Text(L10n.t("welcome.invite.hint")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
        }
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
        case .invite: parsedEmails.isEmpty ? L10n.t("onboarding.next") : L10n.t("welcome.invite.send")
        case .name, .about, .team, .how: L10n.t("onboarding.next")
        case .notifications: L10n.t("welcome.notify.allow")
        }
    }

    private var canContinue: Bool {
        switch step {
        case .name: !name.trimmingCharacters(in: .whitespaces).isEmpty && !isUploadingPhoto
        case .team: workMode == .solo || (workMode == .team && !teamName.trimmingCharacters(in: .whitespaces).isEmpty)
        case .about, .invite, .how, .notifications: true
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
        case .invite: sendInvites()
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
        case .team:
            // Skipping the question means working alone in the personal workspace.
            teamSize = nil; industry = nil; workMode = .solo
            switchToPersonal()
        case .invite: emails = ""
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

    /// Solo: continue in the personal workspace. Team: create a team workspace (once) and make it active; invites follow.
    private func saveWorkspace() {
        guard let session = model.session else { go(back: false); return }
        guard workMode == .team else {
            switchToPersonal()
            go(back: false)
            return
        }
        let newName = teamName.trimmingCharacters(in: .whitespaces)
        isBusy = true
        error = nil
        Task {
            defer { isBusy = false }
            do {
                if let team = createdTeam {
                    if team.name != newName {
                        try await TeamActions(tenantId: team.id, uid: session.uid).renameWorkspace(newName)
                        createdTeam = (team.id, newName)
                        await session.reloadWorkspaces()
                    }
                } else {
                    let id = try await session.createWorkspace(name: newName)
                    createdTeam = (id, newName)
                    await session.reloadWorkspaces()
                    model.switchWorkspace(to: id)
                }
                go(back: false)
            } catch {
                self.error = PlanErrorCode.code(in: error) != nil ? model.errorMessage(error) : L10n.t("welcome.error")
            }
        }
    }

    private func switchToPersonal() {
        guard let session = model.session, let personal = session.workspaces.first(where: \.isPersonal) else { return }
        model.switchWorkspace(to: personal.id)
    }

    private func sendInvites() {
        guard let team = createdTeam, let session = model.session, !parsedEmails.isEmpty else { go(back: false); return }
        if !invalidEmails.isEmpty {
            error = L10n.t("welcome.invite.invalid", ["emails": invalidEmails.joined(separator: ", ")])
            return
        }
        isBusy = true
        error = nil
        Task {
            defer { isBusy = false }
            do {
                let actions = TeamActions(tenantId: team.id, uid: session.uid)
                let language = L10n.locale.language.languageCode?.identifier ?? "de"
                for email in parsedEmails {
                    try await actions.createInvitation(kind: .email, email: email, role: "Member", tenantName: team.name,
                                                       inviterName: name.trimmingCharacters(in: .whitespaces), language: language)
                }
                go(back: false)
            } catch {
                self.error = PlanErrorCode.code(in: error) != nil ? model.errorMessage(error) : L10n.t("welcome.error")
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
