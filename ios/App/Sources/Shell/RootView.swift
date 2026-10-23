import SwiftUI
import UserNotifications
import PFData
import PFDesign

/// Top-level switch: launch → sign-in → workspace bootstrap → main shell.
struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            switch model.auth.phase {
            case .launching:
                LaunchView()
            case .signedOut, .needsSecondFactor:
                AuthFlowView()
                    .transition(.opacity)
            case .signedIn:
                if let session = model.session, session.state == .ready, model.workspace != nil {
                    // Strings re-render through the observable LanguageStore; no rebuild, so navigation is kept.
                    MainShell()
                        .transition(.opacity.combined(with: .scale(scale: 0.98)))
                } else if case .failed(let message)? = model.session?.state {
                    SessionErrorView(message: message)
                } else {
                    LaunchView(showsProgress: true)
                }
            }
            // Just above the dock on the tab roots, near the home indicator on pushed screens.
            PFToastHost(center: model.toasts, bottomInset: model.router.isDeep ? 12 : 66)
            PFPresenterHost(presenter: model.presenter)
        }
        .environment(model.presenter)
        .environment(model.swipes)
        .animation(PFMotion.respecting(PFMotion.normal), value: model.auth.phase)
        .task(id: model.auth.phase) { await model.syncSession() }
        .task(id: model.session?.activeWorkspaceId) { model.bindWorkspace() }
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

struct LaunchView: View {
    var showsProgress = false
    @State private var pulse = false

    var body: some View {
        ZStack {
            PFCanvas(dotted: true)
            VStack(spacing: PFSpace.l) {
                Image("Glyph")
                    .resizable()
                    .renderingMode(.template)
                    .foregroundStyle(PFColor.textMain)
                    .frame(width: 56, height: 56)
                    .scaleEffect(pulse ? 1.04 : 0.98)
                if showsProgress {
                    PFEyebrow(L10n.t("shell.preparing")).transition(.opacity)
                }
            }
        }
        .onAppear { withAnimation(PFMotion.pulse) { pulse = true } }
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
