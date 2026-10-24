import SwiftUI
import UIKit
import PFDesign

/// Left drawer like the ChatGPT app: a screen-edge pan pulls the content to the right and reveals the
/// sidebar underneath; tap the dimmed content or drag it back to close. Only enabled on root screens.
struct SidebarDrawer<Sidebar: View>: ViewModifier {
    @Binding var isOpen: Bool
    let isEnabled: Bool
    @ViewBuilder let sidebar: () -> Sidebar

    @State private var drag: CGFloat?
    @State private var width: CGFloat = 390
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var drawerWidth: CGFloat { min(width * 0.82, 330) }
    private var progress: CGFloat {
        let base: CGFloat = isOpen ? 1 : 0
        guard let drag else { return base }
        return min(max(base + drag / drawerWidth, 0), 1)
    }

    func body(content: Content) -> some View {
        ZStack(alignment: .leading) {
            if progress > 0 {
                sidebar()
                    .frame(width: drawerWidth)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .offset(x: reduceMotion ? 0 : -drawerWidth * 0.25 * (1 - progress))
                    .opacity(Double(0.4 + 0.6 * progress))
            }
            content
                .allowsHitTesting(progress == 0)
                .overlay {
                    if progress > 0 {
                        Color.black.opacity(0.22 * progress)
                            .ignoresSafeArea()
                            .contentShape(.rect)
                            .onTapGesture { set(false) }
                            .accessibilityLabel(L10n.t("sidebar.close"))
                            .accessibilityAddTraits(.isButton)
                    }
                }
                // A crisp hairline instead of a soft shadow that would smear grey over the sidebar.
                .overlay(alignment: .leading) {
                    if progress > 0 { Rectangle().fill(PFColor.hairlineStrong).frame(width: 1).ignoresSafeArea() }
                }
                .offset(x: drawerWidth * progress)
        }
        .background(PFCanvas())
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .gesture(EdgePan(isEnabled: isEnabled && !isOpen,
                         onChange: { drag = max($0, 0) },
                         onEnd: { translation, velocity in end(open: velocity > 300 || (velocity > -300 && translation > drawerWidth * 0.4)) }))
        // Simultaneous, so taps on the sidebar rows are never held back by the close drag.
        .simultaneousGesture(DragGesture(minimumDistance: 12)
            .onChanged { value in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                drag = min(value.translation.width, 0)
            }
            .onEnded { value in
                end(open: !(value.predictedEndTranslation.width < -drawerWidth * 0.35 || (drag ?? 0) < -drawerWidth * 0.5))
            }, isEnabled: isOpen)
        .onChange(of: isEnabled) { _, enabled in if !enabled && isOpen { isOpen = false } }
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
    func sidebarDrawer<Sidebar: View>(isOpen: Binding<Bool>, isEnabled: Bool, @ViewBuilder sidebar: @escaping () -> Sidebar) -> some View {
        modifier(SidebarDrawer(isOpen: isOpen, isEnabled: isEnabled, sidebar: sidebar))
    }
}
