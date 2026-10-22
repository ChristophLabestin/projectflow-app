import SwiftUI
import PFDesign
import PFModel

/// "Seen" flags of the first-run experience, per account.
enum OnboardingState {
    private static func key(_ uid: String) -> String { "pf.onboarding.introSeen.\(uid)" }

    static func hasSeenIntro(uid: String) -> Bool { UserDefaults.standard.bool(forKey: key(uid)) }
    static func markIntroSeen(uid: String) { UserDefaults.standard.set(true, forKey: key(uid)) }
    static func resetIntro(uid: String) { UserDefaults.standard.removeObject(forKey: key(uid)) }
}

/// Attaches the first-run intro and the invitation sheet to an always-mounted view of the signed-in
/// shell (`InboxScreen`; all four tab roots stay alive in `MainShell`).
struct OnboardingHost: ViewModifier {
    @Environment(AppModel.self) private var model

    func body(content: Content) -> some View {
        content
            .task(id: model.workspaceGeneration) {
                presentIntroIfNeeded()
                runQAHooks()
            }
            .onChange(of: model.router.pendingInvite, initial: true) { _, link in
                guard let link else { return }
                model.router.pendingInvite = nil
                model.presenter.present(detents: [.fit]) { InviteAcceptSheet(link: link) }
            }
    }

    /// Debug/QA launch arguments used for screenshots: `-pfCapture [text]`, `-pfSearch`, `-pfAccount`.
    private func runQAHooks() {
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        guard model.workspace != nil else { return }
        if let index = arguments.firstIndex(of: "-pfCapture") {
            let text = arguments.count > index + 1 && !arguments[index + 1].hasPrefix("-") ? arguments[index + 1] : nil
            Task {
                try? await Task.sleep(for: .milliseconds(600))
                CaptureLauncher.present(model: model, context: CaptureContext(initialText: text))
            }
        }
        if arguments.contains("-pfSearch") { model.router.openSearch() }
        if arguments.contains("-pfAccount") { model.router.push(.account) }
        #endif
    }

    private func presentIntroIfNeeded() {
        guard let uid = model.uid else { return }
        let forced = ProcessInfo.processInfo.arguments.contains("-pfShowIntro")
        guard forced || !OnboardingState.hasSeenIntro(uid: uid) else { return }
        guard model.workspace != nil, model.presenter.sheets.isEmpty else { return }
        model.presenter.present(detents: [.large], onDismiss: { OnboardingState.markIntroSeen(uid: uid) }) {
            OnboardingIntroSheet()
        }
    }
}

extension View {
    func onboardingHost() -> some View { modifier(OnboardingHost()) }
}

/// Three cards — Heute · Fokus · Eingang — in a custom paging scroller.
struct OnboardingIntroSheet: View {
    private struct Card: Identifiable {
        let id: Int
        let title: String
        let text: String
    }

    @Environment(PFPresenter.self) private var presenter
    @State private var page: Int? = 0

    private var cards: [Card] {
        [
            Card(id: 0, title: L10n.t("onboarding.today.title"), text: L10n.t("onboarding.today.text")),
            Card(id: 1, title: L10n.t("onboarding.focus.title"), text: L10n.t("onboarding.focus.text")),
            Card(id: 2, title: L10n.t("onboarding.inbox.title"), text: L10n.t("onboarding.inbox.text")),
        ]
    }

    private var current: Int { page ?? 0 }
    private var isLast: Bool { current >= cards.count - 1 }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                PFEyebrow(L10n.t("onboarding.welcome"))
                Spacer()
                if !isLast {
                    Button { presenter.dismiss() } label: {
                        Text(L10n.t("onboarding.skip")).pfText(.buttonSmall).foregroundStyle(PFColor.textMuted)
                            .padding(.horizontal, 12).frame(minHeight: 36)
                    }
                    .buttonStyle(.pfPressable)
                    .transition(.opacity)
                }
            }
            .padding(.horizontal, PFSpace.page)

            ScrollView(.horizontal) {
                HStack(spacing: 0) {
                    ForEach(cards) { card in
                        cardView(card)
                            .containerRelativeFrame(.horizontal)
                            .id(card.id)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .scrollPosition(id: $page)
            .scrollIndicators(.hidden)

            VStack(spacing: PFSpace.m) {
                HStack(spacing: 6) {
                    ForEach(cards) { card in
                        Capsule()
                            .fill(card.id == current ? PFColor.primary : PFColor.hairlineStrong)
                            .frame(width: card.id == current ? 22 : 7, height: 7)
                    }
                }
                .animation(PFMotion.respecting(PFMotion.snappy), value: current)
                .accessibilityHidden(true)
                PFButton(isLast ? L10n.t("onboarding.start") : L10n.t("onboarding.next"), size: .large, fullWidth: true) {
                    if isLast {
                        presenter.dismiss()
                    } else {
                        withAnimation(PFMotion.respecting(PFMotion.snappy)) { page = current + 1 }
                    }
                }
            }
            .padding(.horizontal, PFSpace.page)
            .padding(.bottom, PFSpace.l)
        }
        .animation(PFMotion.respecting(PFMotion.fast), value: isLast)
    }

    private func cardView(_ card: Card) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.l) {
            illustration(card.id)
                .frame(maxWidth: .infinity)
                .frame(height: 250)
                .background { PFCanvas(dotted: true).clipShape(.rect(cornerRadius: PFRadius.surface, style: .continuous)) }
                .clipShape(.rect(cornerRadius: PFRadius.surface, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: PFSpace.xs) {
                Text(card.title).pfText(.display).foregroundStyle(PFColor.textMain)
                    .fixedSize(horizontal: false, vertical: true)
                Text(card.text).pfText(.body).foregroundStyle(PFColor.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.m)
    }

    @ViewBuilder private func illustration(_ index: Int) -> some View {
        switch index {
        case 0: todayIllustration
        case 1: focusIllustration
        default: inboxIllustration
        }
    }

    // MARK: Illustrations (built from the real components, not interactive)

    private var todayIllustration: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFEyebrow(L10n.t("onboarding.sample.eyebrow"))
            Text(L10n.t("onboarding.sample.statement"))
                .pfText(.section)
                .foregroundStyle(PFColor.textMain)
                .fixedSize(horizontal: false, vertical: true)
            PFDayBand(segments: [
                PFBandSegment(id: "a", kind: .overdue), PFBandSegment(id: "b", kind: .due), PFBandSegment(id: "c", kind: .due),
                PFBandSegment(id: "d", kind: .waiting), PFBandSegment(id: "e", kind: .free, weight: 2),
            ])
            VStack(spacing: 0) {
                sampleTask(L10n.t("onboarding.sample.task1"), severity: .overdue)
                PFRowDivider()
                sampleTask(L10n.t("onboarding.sample.task2"), severity: .due)
            }
            .background(PFColor.card, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            .pfElevation(.card, radius: PFRadius.card)
        }
        .padding(PFSpace.l)
    }

    private func sampleTask(_ title: String, severity: Severity) -> some View {
        HStack(spacing: PFSpace.s) {
            Circle().strokeBorder(PFColor.severity(severity), lineWidth: 2).frame(width: 22, height: 22)
            Text(title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
            Spacer()
        }
        .padding(.horizontal, PFSpace.m)
        .frame(minHeight: 52)
    }

    private var focusIllustration: some View {
        VStack(spacing: PFSpace.m) {
            Text(L10n.t("onboarding.sample.task1"))
                .pfText(.title)
                .foregroundStyle(PFColor.textMain)
                .multilineTextAlignment(.center)
                .padding(.horizontal, PFSpace.xl)
            PFFocusBar(title: L10n.t("onboarding.sample.task1"), subtitle: L10n.t("onboarding.sample.since"),
                       completeLabel: L10n.t("common.complete"), onOpen: {}, onComplete: {})
                .allowsHitTesting(false)
        }
    }

    private var inboxIllustration: some View {
        PFInboxRow(isUnread: true, title: L10n.t("onboarding.sample.inboxTitle"), time: L10n.t("onboarding.sample.time"),
                   leading: { PFAvatar(name: "Lena Meier", size: 36) },
                   mini: { PFInboxMiniTask(title: L10n.t("onboarding.sample.task2"), statusLabel: TaskStatus.inProgress.label, statusTone: .inProgress) },
                   footer: {
                       HStack(spacing: PFSpace.xs) {
                           PFButton(L10n.t("inbox.action.planToday"), systemImage: "sun.max", size: .small) {}
                           PFButton(L10n.t("common.open"), kind: .ghost, size: .small) {}
                       }
                   })
            .background(PFColor.card, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            .pfElevation(.card, radius: PFRadius.card)
            .padding(PFSpace.l)
            .allowsHitTesting(false)
    }
}
