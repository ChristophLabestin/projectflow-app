import SwiftUI
import PFDesign

/// Teaches the edge swipe for the workspace sidebar: once, a dimmed coach mark with an arrow at the left edge while
/// the sidebar peeks in; later, after 14 days without opening it, only the peek as a quiet reminder.
struct SidebarHint: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = false
    @State private var nudge = false

    private static let shownKey = "pf.sidebarHint.shown"
    private static let lastOpenedKey = "pf.sidebar.lastOpened"
    private static let reminderAfter: TimeInterval = 14 * 24 * 3600

    var body: some View {
        ZStack(alignment: .leading) {
            if visible {
                // Blurred and darkened, so the message reads without a box around it.
                ZStack {
                    Rectangle().fill(.ultraThinMaterial).environment(\.colorScheme, .dark)
                    Color.black.opacity(0.5)
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
                .padding(.horizontal, PFSpace.xl)
                .frame(maxWidth: .infinity)
                .containerRelativeFrame(.vertical, alignment: .center) { height, _ in height * 0.62 }
                .frame(maxHeight: .infinity, alignment: .top)
                .allowsHitTesting(false)
                .transition(.opacity)
            }
        }
        .animation(PFMotion.respecting(PFMotion.normal), value: visible)
        .task(id: "\(model.router.isDeep)-\(model.showsWelcome)-\(ready)") { await check() }
        .onChange(of: model.router.isSidebarOpen) { _, open in
            guard open else { return }
            UserDefaults.standard.set(Date(), forKey: Self.lastOpenedKey)
            if visible { dismiss() }
        }
    }

    /// Only once the signed-in shell has settled (loading swaps views and would drop the hint unseen).
    private var ready: Bool { model.session?.state == .ready && model.workspace?.isReady == true }

    private func check() async {
        // Not behind the welcome onboarding (it covers the shell) or on a pushed screen.
        guard ready, !model.showsWelcome, !model.router.isDeep, !model.router.isFocusRoomOpen else { return }
        let defaults = UserDefaults.standard
        #if DEBUG
        // QA: `-pfSidebarHint` shows the coach mark again.
        let forced = ProcessInfo.processInfo.arguments.contains("-pfSidebarHint")
        #else
        let forced = false
        #endif
        if forced || !defaults.bool(forKey: Self.shownKey) {
            try? await Task.sleep(for: .seconds(1.2))
            guard !Task.isCancelled, ready, !model.router.isSidebarOpen, !model.showsWelcome else { return }
            defaults.set(true, forKey: Self.shownKey)
            defaults.set(Date(), forKey: Self.lastOpenedKey)
            visible = true
            // Peek and nudge the arrow while the hint is up.
            while visible, !Task.isCancelled {
                model.router.sidebarPeek += 1
                if !reduceMotion {
                    withAnimation(.easeInOut(duration: 0.45).repeatCount(3, autoreverses: true)) { nudge.toggle() }
                }
                try? await Task.sleep(for: .seconds(2.6))
            }
        } else if let last = defaults.object(forKey: Self.lastOpenedKey) as? Date,
                  Date().timeIntervalSince(last) > Self.reminderAfter {
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled, !model.router.isSidebarOpen else { return }
            defaults.set(Date(), forKey: Self.lastOpenedKey)
            model.router.sidebarPeek += 1
        }
    }

    private func dismiss() { visible = false }
}
