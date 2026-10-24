import SwiftUI
import UIKit
import PFDesign

/// Left drawer like the ChatGPT app: a screen-edge pan pulls the content to the right and reveals the
/// sidebar underneath; tap the dimmed content or drag it back to close. Only enabled on root screens.
struct SidebarDrawer<Sidebar: View>: ViewModifier {
    @Binding var isOpen: Bool
    let isEnabled: Bool
    /// Bumped to let the sidebar peek in a few points and spring back (coach mark, reminder after a long pause).
    let peek: Int
    @ViewBuilder let sidebar: () -> Sidebar

    @State private var drag: CGFloat?
    @State private var width: CGFloat = 390
    @State private var insets = EdgeInsets()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var drawerWidth: CGFloat { min(width * 0.82, 330) }
    /// iPhone: the content slides right (ChatGPT style). With a side inset (iPhone Duo's status region) a shifted scroll
    /// view re-reads its safe area from where it's drawn and re-wraps, so there the sidebar slides in over the content.
    private var pushesContent: Bool { insets.leading == 0 && insets.trailing == 0 }
    private var progress: CGFloat {
        let base: CGFloat = isOpen ? 1 : 0
        guard let drag else { return base }
        return min(max(base + drag / drawerWidth, 0), 1)
    }

    func body(content: Content) -> some View {
        ZStack(alignment: .leading) {
            // Both layers stay in the hierarchy (no insert/remove while swiping).
            content
                .allowsHitTesting(progress == 0)
                .overlay {
                    Color.black.opacity(0.22 * progress)
                        .ignoresSafeArea()
                        .contentShape(.rect)
                        .onTapGesture { set(false) }
                        .allowsHitTesting(progress > 0)
                        .accessibilityLabel(L10n.t("sidebar.close"))
                        .accessibilityAddTraits(.isButton)
                        .accessibilityHidden(progress == 0)
                }
                .offset(x: pushesContent ? drawerWidth * progress : 0)
                .zIndex(pushesContent ? 1 : 0)
            sidebar()
                .frame(width: drawerWidth)
                .frame(maxHeight: .infinity, alignment: .top)
                .background { if !pushesContent { PFCanvas() } }
                // A crisp hairline instead of a soft shadow that would smear grey over the sidebar.
                .overlay(alignment: .trailing) {
                    Rectangle().fill(PFColor.hairlineStrong).frame(width: 1).ignoresSafeArea().opacity(progress > 0 ? 1 : 0)
                }
                .offset(x: pushesContent ? (reduceMotion ? 0 : -drawerWidth * 0.25 * (1 - progress)) : -drawerWidth * (1 - progress))
                .opacity(pushesContent ? (progress > 0 ? Double(0.4 + 0.6 * progress) : 0) : (progress > 0 ? 1 : 0))
                // Always hit-testable: closed it sits off screen (overlay) or under the content (push). Toggling
                // hit testing on open made the sidebar's scroll view swallow the first tap.
                .accessibilityHidden(progress == 0)
        }
        .background(PFCanvas())
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .onGeometryChange(for: EdgeInsets.self) { $0.safeAreaInsets } action: { insets = $0 }
        .gesture(EdgePan(isEnabled: isEnabled && !isOpen,
                         onChange: { drag = max($0, 0) },
                         onEnd: { translation, velocity in end(open: velocity > 300 || (velocity > -300 && translation > drawerWidth * 0.4)) }))
        // Simultaneous and always attached (toggling `isEnabled` on open swallowed the first tap in the sidebar).
        .simultaneousGesture(DragGesture(minimumDistance: 12)
            .onChanged { value in
                guard isOpen, abs(value.translation.width) > abs(value.translation.height) else { return }
                drag = min(value.translation.width, 0)
            }
            .onEnded { value in
                guard isOpen, drag != nil else { return }
                end(open: !(value.predictedEndTranslation.width < -drawerWidth * 0.35 || (drag ?? 0) < -drawerWidth * 0.5))
            })
        .onChange(of: isEnabled) { _, enabled in if !enabled && isOpen { isOpen = false } }
        .onChange(of: peek) { _, _ in
            guard isEnabled, !isOpen, drag == nil else { return }
            Task { @MainActor in
                withAnimation(PFMotion.respecting(.spring(duration: 0.35))) { drag = 44 }
                try? await Task.sleep(for: .milliseconds(420))
                guard !isOpen else { return }
                withAnimation(PFMotion.respecting(.spring(duration: 0.45, bounce: 0.3))) { drag = nil }
            }
        }
        // VoiceOver can't do the edge swipe: offer it as an action on every root screen.
        .accessibilityAction(named: L10n.t("sidebar.open")) { if isEnabled { set(true) } }
        .animation(PFMotion.respecting(PFMotion.snappy), value: isOpen)
    }

    private func end(open: Bool) {
        if open && !isOpen { PFHaptics.selection() }
        withAnimation(PFMotion.respecting(PFMotion.snappy)) {
            drag = nil
            isOpen = open
        }
    }

    private func set(_ open: Bool) { end(open: open) }
}

/// UIKit screen-edge pan from the left edge (doesn't fight scroll views or the system back swipe).
private struct EdgePan: UIGestureRecognizerRepresentable {
    let isEnabled: Bool
    let onChange: (CGFloat) -> Void
    let onEnd: (CGFloat, CGFloat) -> Void

    func makeUIGestureRecognizer(context: Context) -> UIScreenEdgePanGestureRecognizer {
        let recognizer = UIScreenEdgePanGestureRecognizer()
        recognizer.edges = .left
        return recognizer
    }

    func updateUIGestureRecognizer(_ recognizer: UIScreenEdgePanGestureRecognizer, context: Context) {
        recognizer.isEnabled = isEnabled
    }

    func handleUIGestureRecognizerAction(_ recognizer: UIScreenEdgePanGestureRecognizer, context: Context) {
        let translation = recognizer.translation(in: recognizer.view).x
        switch recognizer.state {
        case .began, .changed: onChange(translation)
        case .ended: onEnd(translation, recognizer.velocity(in: recognizer.view).x)
        case .cancelled, .failed: onEnd(0, -1)
        default: break
        }
    }
}

extension View {
    func sidebarDrawer<Sidebar: View>(isOpen: Binding<Bool>, isEnabled: Bool, peek: Int,
                                      @ViewBuilder sidebar: @escaping () -> Sidebar) -> some View {
        modifier(SidebarDrawer(isOpen: isOpen, isEnabled: isEnabled, peek: peek, sidebar: sidebar))
    }
}
