import SwiftUI
import PFDesign

/// Teaches the edge swipe for the workspace sidebar: once, a dimmed coach mark with an arrow at the left edge while
/// the sidebar peeks in; later, after 14 days without opening it, only the peek as a quiet reminder.
struct SidebarHint: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = false
    @State private var nudge = false
    @State private var showsText = false

    private static let shownKey = "pf.sidebarHint.shown"
    private static let lastOpenedKey = "pf.sidebar.lastOpened"
    private static let reminderAfter: TimeInterval = 14 * 24 * 3600

    var body: some View {
        ZStack(alignment: .leading) {
            if visible {
                // Blurred and darkened, so the message reads without a box around it.
                ZStack {
                    // A light blur only: Today stays recognisable underneath.
                    Rectangle().fill(.ultraThinMaterial).environment(\.colorScheme, .dark).opacity(0.75)
                    Color.black.opacity(0.55)
                }
                    .ignoresSafeArea()
                    .contentShape(.rect)
                    .onTapGesture { dismiss() }
                    .gesture(DragGesture(minimumDistance: 20).onEnded { value in
                        guard value.translation.width > 40 else { return }
                        dismiss()
                        withAnimation(PFMotion.respecting(PFMotion.snappy)) { model.router.isSidebarOpen = true }
                    })
                // A glowing line along the whole left edge — where the swipe starts.
                LinearGradient(colors: [.white.opacity(0), .white.opacity(0.95), .white.opacity(0.95), .white.opacity(0)],
                               startPoint: .top, endPoint: .bottom)
                    .frame(width: 5)
                    .shadow(color: .white.opacity(nudge ? 0.9 : 0.4), radius: 12)
                    .opacity(nudge ? 1 : 0.7)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .transition(.opacity)
                // Message right on the dimmed screen, centred in the upper half — no box.
                if showsText {
                VStack(spacing: PFSpace.s) {
                    Image(systemName: "chevron.right.2")
                        .font(.system(size: 28, weight: .bold))
                        .offset(x: nudge ? 10 : -10)
                    Text(L10n.t("sidebar.hint.title")).pfText(.title).multilineTextAlignment(.center)
                    Text(L10n.t("sidebar.hint.body")).pfText(.body).opacity(0.85).multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.3), radius: 8)
                // A soft dark halo behind the words (not a box) keeps them readable over Today.
                .background {
                    // Larger than the text so it fades out fully before its own edges.
                    RadialGradient(colors: [.black.opacity(0.5), .black.opacity(0)], center: .center, startRadius: 0, endRadius: 200)
                        .frame(width: 520, height: 400)
                        .allowsHitTesting(false)
                }
                .padding(.horizontal, PFSpace.xl)
                .frame(maxWidth: .infinity)
                .containerRelativeFrame(.vertical, alignment: .center) { height, _ in height * 0.62 }
                .frame(maxHeight: .infinity, alignment: .top)
                .allowsHitTesting(false)
                .transition(.opacity.combined(with: .offset(y: 12)))
                }
            }
        }
        .task(id: eligible) { await check() }
        .onChange(of: model.router.isSidebarOpen) { _, open in
            guard open else { return }
            UserDefaults.standard.set(Date(), forKey: Self.lastOpenedKey)
            if visible { dismiss() }
        }
    }

    /// Only once the signed-in shell has settled (loading swaps views and would drop the hint unseen).
    private var ready: Bool { model.session?.state == .ready && model.workspace?.isReady == true }

    /// Only on Today's root, with nothing else on top: not behind the onboarding, not on another tab, a pushed
    /// screen, search, the focus room or a sheet. Leaving cancels the pending hint; coming back restarts the wait.
    private var eligible: Bool {
        let router = model.router
        return ready && !model.showsWelcome && router.tab == .today && !router.isSearchActive && !router.isDeep
            && !router.isFocusRoomOpen && !router.isSidebarOpen && !model.presenter.isPresenting
    }

    private func check() async {
        guard eligible else { return }
        let defaults = UserDefaults.standard
        #if DEBUG
        // QA: `-pfSidebarHint` shows the coach mark again.
        let forced = ProcessInfo.processInfo.arguments.contains("-pfSidebarHint")
        #else
        let forced = false
        #endif
        if forced || !defaults.bool(forKey: Self.shownKey) {
            // Give the person a moment on Today first.
            try? await Task.sleep(for: .seconds(2.5))
            guard !Task.isCancelled, eligible else { return }
            defaults.set(true, forKey: Self.shownKey)
            defaults.set(Date(), forKey: Self.lastOpenedKey)
            // Soft entrance: the dim fades in, then the message rises in.
            withAnimation(.easeInOut(duration: 0.7)) { visible = true }
            try? await Task.sleep(for: .milliseconds(350))
            withAnimation(.easeOut(duration: 0.5)) { showsText = true }
            try? await Task.sleep(for: .milliseconds(500))
            // Peek, with arrows and edge line moving in step with the sidebar (same springs as the drawer's peek).
            while visible, !Task.isCancelled {
                model.router.sidebarPeek += 1
                if !reduceMotion { withAnimation(.spring(duration: 0.35)) { nudge = true } }
                try? await Task.sleep(for: .milliseconds(420))
                if !reduceMotion { withAnimation(.spring(duration: 0.45, bounce: 0.3)) { nudge = false } }
                try? await Task.sleep(for: .seconds(2.2))
            }
        } else if let last = defaults.object(forKey: Self.lastOpenedKey) as? Date,
                  Date().timeIntervalSince(last) > Self.reminderAfter {
            try? await Task.sleep(for: .seconds(2.5))
            guard !Task.isCancelled, eligible else { return }
            defaults.set(Date(), forKey: Self.lastOpenedKey)
            model.router.sidebarPeek += 1
        }
    }

    private func dismiss() {
        withAnimation(.easeInOut(duration: 0.4)) {
            showsText = false
            visible = false
        }
    }
}
