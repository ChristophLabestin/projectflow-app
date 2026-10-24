import SwiftUI
import SafariServices
import PFDesign

/// First-install flow before sign-in: welcome → language → crash reports (opt-in) → privacy → terms.
/// Same look and mechanics as the welcome onboarding; on the iPhone Duo outer display next/back move into
/// the side region. Choices live on the device (`FirstRunState`); finishing it shows the sign-in.
struct FirstRunFlowView: View {
    private enum Step: Int, CaseIterable { case welcome, language, crash, privacy, terms }

    let onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var step: Step = .welcome
    @State private var goingBack = false
    @State private var markCenter: CGPoint?
    @State private var trailingInset: CGFloat = 0
    @State private var language: L10n.Language = L10n.language
    @State private var crashReports = FirstRunState.crashReportsEnabled

    private var steps: [Step] { Step.allCases }
    private var stepIndex: Int { step.rawValue }
    private var sideRegion: CGFloat {
        PFLayout.sideRegionWidth(trailingInset: trailingInset, isCompact: horizontalSizeClass == .compact)
    }

    var body: some View {
        ZStack {
            PFColor.canvas.ignoresSafeArea()
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
                        .frame(maxWidth: 560, alignment: .leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .scrollBounceBehavior(.basedOnSize)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { if sideRegion == 0 { footer } }
        .overlay { if sideRegion > 0 { sideControls } }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.trailing } action: { trailingInset = $0 }
    }

    // MARK: Chrome

    private var header: some View {
        HStack(spacing: PFSpace.s) {
            if stepIndex > 0, sideRegion == 0 {
                PFIconButton("chevron.left", label: L10n.t("firstRun.back")) { go(back: true) }
            }
            Spacer(minLength: 0)
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
            .accessibilityLabel(L10n.t("firstRun.step", ["n": "\(stepIndex + 1)", "total": "\(steps.count)"]))
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.s)
    }

    private var footer: some View {
        PFButton(primaryTitle, systemImage: primaryIcon, size: .large, fullWidth: true) { primaryAction() }
            .padding(.horizontal, PFSpace.page)
            .padding(.vertical, PFSpace.s)
            .background(.regularMaterial)
    }

    /// iPhone Duo outer display: next above back in the side region, as on pushed pages.
    private var sideControls: some View {
        PFSideColumn(side: sideRegion) {
            PFIconButton(primaryIcon, label: primaryTitle, style: .primary) { primaryAction() }
            if stepIndex > 0 {
                PFIconButton("chevron.left", label: L10n.t("firstRun.back")) { go(back: true) }
            }
        }
    }

    // MARK: Steps

    @ViewBuilder private var content: some View {
        switch step {
        case .welcome: welcomeStep
        case .language: languageStep
        case .crash: crashStep
        case .privacy: legalStep("privacy", icon: "lock.shield", points: [
            ("globe.europe.africa", "firstRun.privacy.point.eu"),
            ("eye.slash", "firstRun.privacy.point.noAds"),
            ("trash", "firstRun.privacy.point.control"),
        ], url: FirstRunState.privacyURL)
        case .terms: legalStep("terms", icon: "doc.text", points: [
            ("person.badge.key", "firstRun.terms.point.account"),
            ("square.stack.3d.up", "firstRun.terms.point.content"),
            ("hand.raised", "firstRun.terms.point.fair"),
        ], url: FirstRunState.termsURL)
        }
    }

    private func heading(_ title: String, _ subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            Text(title).pfText(.display).foregroundStyle(PFColor.textMain)
                .accessibilityAddTraits(.isHeader)
            Text(subtitle).pfText(.body).foregroundStyle(PFColor.textMuted)
        }
    }

    private func iconTile(_ systemImage: String) -> some View {
        Image(systemName: systemImage)
            .font(.system(size: 30, weight: .medium))
            .foregroundStyle(PFColor.textMain)
            .frame(width: 72, height: 72)
            .background(PFColor.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .pfElevation(.card, radius: 22)
            .accessibilityHidden(true)
    }

    private var welcomeStep: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            PFBrandMark(glyph: Image("Glyph"), size: 56)
                .onGeometryChange(for: CGPoint.self) { proxy in
                    let frame = proxy.frame(in: .global)
                    return CGPoint(x: frame.midX, y: frame.midY)
                } action: { markCenter = $0 }
            heading(L10n.t("firstRun.welcome.title"), L10n.t("firstRun.welcome.subtitle"))
        }
    }

    private var languageStep: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            iconTile("character.bubble")
            heading(L10n.t("firstRun.language.title"), L10n.t("firstRun.language.subtitle"))
            VStack(spacing: PFSpace.s) {
                languageOption(.de, title: "Deutsch", subtitle: "German")
                languageOption(.en, title: "English", subtitle: "Englisch")
            }
        }
    }

    private func languageOption(_ value: L10n.Language, title: String, subtitle: String) -> some View {
        let selected = language == value
        return Button {
            PFHaptics.selection()
            language = value
            // Applies right away, so the rest of the flow (and the sign-in) is already in the chosen language.
            withAnimation(PFMotion.respecting(PFMotion.fast)) { L10n.language = value }
            FirstRunState.language = value.rawValue
        } label: {
            HStack(spacing: PFSpace.m) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).pfText(.rowTitle).foregroundStyle(selected ? PFColor.onPrimary : PFColor.textMain)
                    Text(subtitle).pfText(.meta).foregroundStyle(selected ? PFColor.onPrimary.opacity(0.75) : PFColor.textMuted)
                }
                Spacer(minLength: 0)
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(selected ? PFColor.onPrimary : PFColor.hairlineStrong)
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 64)
            // Chosen option is inverted (web "selected"); glyphs inside flip with it.
            .background(selected ? PFColor.primary : PFColor.card, in: RoundedRectangle(cornerRadius: PFRadius.card, style: .continuous))
            .pfElevation(selected ? .flat : .card, radius: PFRadius.card)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private var crashStep: some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            iconTile("stethoscope")
            heading(L10n.t("firstRun.crash.title"), L10n.t("firstRun.crash.subtitle"))
            PFSwitch(L10n.t("firstRun.crash.toggle"), isOn: $crashReports)
                .padding(.horizontal, PFSpace.m)
                .frame(minHeight: 64)
                .background(PFColor.card, in: RoundedRectangle(cornerRadius: PFRadius.card, style: .continuous))
                .pfElevation(.card, radius: PFRadius.card)
                .onChange(of: crashReports) { _, value in FirstRunState.crashReportsEnabled = value }
            points([
                ("person.crop.circle.badge.xmark", "firstRun.crash.point.anonymous"),
                ("cpu", "firstRun.crash.point.technical"),
                ("slider.horizontal.3", "firstRun.crash.point.optional"),
            ])
        }
    }

    private func legalStep(_ kind: String, icon: String, points items: [(String, String)], url: URL) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.xl) {
            iconTile(icon)
            heading(L10n.t("firstRun.\(kind).title"), L10n.t("firstRun.\(kind).subtitle"))
            points(items)
            PFButton(L10n.t("firstRun.\(kind).read"), systemImage: "arrow.up.right", kind: .ghost, size: .small) {
                SafariPresenter.open(url)
            }
            Text(L10n.t("firstRun.required")).pfText(.meta).foregroundStyle(PFColor.textMuted)
        }
    }

    private func points(_ items: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            ForEach(items, id: \.1) { item in
                HStack(alignment: .firstTextBaseline, spacing: PFSpace.s) {
                    Image(systemName: item.0)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(PFColor.textMuted)
                        .frame(width: 22)
                        .accessibilityHidden(true)
                    Text(L10n.t(item.1)).pfText(.body).foregroundStyle(PFColor.textMain)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    // MARK: Actions

    private var primaryTitle: String {
        switch step {
        case .welcome: L10n.t("firstRun.welcome.start")
        case .language, .crash: L10n.t("firstRun.next")
        case .privacy: L10n.t("firstRun.privacy.accept")
        case .terms: L10n.t("firstRun.terms.accept")
        }
    }

    private var primaryIcon: String {
        switch step {
        case .privacy, .terms: "checkmark"
        default: "arrow.right"
        }
    }

    private func primaryAction() {
        switch step {
        case .welcome, .crash: go(back: false)
        case .language:
            FirstRunState.language = language.rawValue
            go(back: false)
        case .privacy:
            FirstRunState.acceptPrivacy()
            go(back: false)
        case .terms:
            FirstRunState.acceptTerms()
            PFHaptics.success()
            withAnimation(.easeOut(duration: 0.3)) { onFinish() }
        }
    }

    private func go(back: Bool) {
        guard let target = Step(rawValue: stepIndex + (back ? -1 : 1)) else { return }
        goingBack = back
        withAnimation(reduceMotion ? nil : .spring(response: 0.45, dampingFraction: 0.88)) { step = target }
    }
}

/// Shows a web page in an in-app Safari sheet (legal pages before sign-in).
@MainActor
enum SafariPresenter {
    static func open(_ url: URL) {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        top?.present(SFSafariViewController(url: url), animated: true)
    }
}
