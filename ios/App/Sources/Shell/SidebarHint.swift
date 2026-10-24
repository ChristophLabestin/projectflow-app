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
                Color.black.opacity(0.66)
                    .ignoresSafeArea()
                    .contentShape(.rect)
                    .onTapGesture { dismiss() }
                    .gesture(DragGesture(minimumDistance: 20).onEnded { value in
                        guard value.translation.width > 40 else { return }
                        dismiss()
                        withAnimation(PFMotion.respecting(PFMotion.snappy)) { model.router.isSidebarOpen = true }
                    })
                // A glowing handle on the edge the swipe starts from.
                Capsule().fill(.white.opacity(0.9)).frame(width: 5, height: 64)
                    .shadow(color: .white.opacity(0.6), radius: 8)
                    .padding(.leading, 4)
                    .offset(x: nudge ? 6 : 0)
                    .allowsHitTesting(false)
                HStack(spacing: PFSpace.s) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 22, weight: .bold))
                        .offset(x: nudge ? 14 : 0)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(L10n.t("sidebar.hint.title")).pfText(.section)
                        Text(L10n.t("sidebar.hint.body")).pfText(.meta).opacity(0.85)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .foregroundStyle(.white)
                .padding(PFSpace.m)
                .background(Color(white: 0.1).opacity(0.94), in: .rect(cornerRadius: 20, style: .continuous))
                .padding(.leading, PFSpace.page)
                .padding(.trailing, PFSpace.xl)
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
