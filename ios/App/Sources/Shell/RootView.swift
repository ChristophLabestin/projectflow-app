import SwiftUI
import UserNotifications
import PFData
import PFDesign

/// Top-level switch: launch → sign-in → workspace bootstrap → main shell.
struct RootView: View {
    @Environment(AppModel.self) private var model
    /// The cold-start brand moment plays at least once in full, even when the session is ready sooner.
    @State private var introPlayed = false
    /// First-install flow (welcome, language, crash reports, privacy, terms) runs once before the first sign-in.
    @State private var firstRunDone: Bool = {
        #if DEBUG
        // QA: `-pfFirstRun` shows the first-install flow again.
        if ProcessInfo.processInfo.arguments.contains("-pfFirstRun") { FirstRunState.reset(); return false }
        #endif
        return FirstRunState.isComplete
    }()

    private var isPreparing: Bool {
        guard case .signedIn = model.auth.phase else { return false }
        if case .failed? = model.session?.state { return false }
        return !(model.session?.state == .ready && (model.workspace != nil || model.session?.isActiveSuspended == true))
    }

    private var showsLaunch: Bool {
        !introPlayed || model.auth.phase == .launching || isPreparing
    }

    var body: some View {
        ZStack {
            if showsLaunch {
                LaunchView(showsProgress: introPlayed || isPreparing)
                    .transition(.opacity)
            } else {
                switch model.auth.phase {
                case .launching:
                    EmptyView()
                case .signedOut, .needsSecondFactor:
                    if firstRunDone {
                        AuthFlowView()
                            .transition(.opacity)
                    } else {
                        FirstRunFlowView { firstRunDone = true }
                            .transition(.opacity)
                    }
                case .signedIn:
                    if case .failed(let message)? = model.session?.state {
                        SessionErrorView(message: message)
                    } else if model.session?.isActiveSuspended == true {
                        SuspendedWorkspaceView()
                            .transition(.opacity)
                    } else {
                        // Strings re-render through the observable LanguageStore; no rebuild, so navigation is kept.
                        MainShell()
                            .transition(.opacity.combined(with: .scale(scale: 1.02)))
                        if model.showsWelcome {
                            WelcomeOnboardingView()
                                .transition(.opacity)
                                .zIndex(1)
                        }
                    }
                }
            }
            // Just above the dock on the tab roots, near the home indicator on pushed screens.
            PFToastHost(center: model.toasts, bottomInset: model.router.isDeep ? 12 : 66)
            PFPresenterHost(presenter: model.presenter)
        }
        .environment(model.presenter)
        .environment(model.swipes)
        .animation(PFMotion.respecting(PFMotion.normal), value: model.auth.phase)
        .animation(.easeInOut(duration: 0.5), value: showsLaunch)
        .task {
            #if DEBUG
            // QA: `-pfHoldLaunch` keeps the launch scene on screen (screenshots).
            if ProcessInfo.processInfo.arguments.contains("-pfHoldLaunch") { return }
            #endif
            try? await Task.sleep(for: .seconds(UIAccessibility.isReduceMotionEnabled ? 0.4 : 1.5))
            introPlayed = true
        }
        .task(id: model.auth.phase) { await model.syncSession() }
        // Rebinds on a workspace switch and when the platform suspends or releases the active workspace.
        .task(id: "\(model.session?.activeWorkspaceId ?? "")|\(model.session?.isActiveSuspended == true)") { model.bindWorkspace() }
        .onChange(of: model.profile?.language) { _, language in
            L10n.apply(profileLanguage: language)
            // Push action titles are registered once at launch — re-register them in the new language.
            UNUserNotificationCenter.current().setNotificationCategories(NotificationCategories.all)
            SnapshotPublisher.publish(model: model)
        }
        .preferredColorScheme(model.colorScheme)
        .tint(PFColor.primary)
    }
}

/// Cold start: the dotted canvas ripples out from the brand mark in the status colours, the wordmark
/// rises in letter by letter, and a gliding track shows that the workspace is being prepared.
struct LaunchView: View {
    var showsProgress = false
    @State private var markCenter: CGPoint?
    @State private var appeared = false

    var body: some View {
        ZStack {
            PFFlowField(center: markCenter)
            VStack(spacing: PFSpace.xl) {
                PFBrandMark(glyph: Image("Glyph"), size: 46)
                    .scaleEffect(appeared ? 1 : 0.6)
                    .opacity(appeared ? 1 : 0)
                    .onGeometryChange(for: CGPoint.self) { proxy in
                        let frame = proxy.frame(in: .global)
                        return CGPoint(x: frame.midX, y: frame.midY)
                    } action: { markCenter = $0 }
                PFStaggeredText("ProjectFlow", style: .displayLarge, delay: 0.25)
                    .foregroundStyle(PFColor.textMain)
            }
            .offset(y: -40)
            if showsProgress {
                VStack(spacing: PFSpace.s) {
                    PFLoadingTrack()
                    PFEyebrow(L10n.t("shell.preparing"))
                }
                .frame(maxHeight: .infinity, alignment: .bottom)
                .padding(.bottom, 72)
                .opacity(appeared ? 1 : 0)
                .transition(.opacity)
            }
        }
        .onAppear { withAnimation(.spring(response: 0.7, dampingFraction: 0.72)) { appeared = true } }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("ProjectFlow")
    }
}

struct SessionErrorView: View {
    let message: String
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            PFCanvas(dotted: true)
            PFEmptyState(systemImage: "exclamationmark.triangle", title: L10n.t("shell.sessionFailed"), message: message,
                         actionTitle: L10n.t("shell.signOut")) {
                model.auth.signOut()
            }
            .padding(PFSpace.page)
        }
    }
}
