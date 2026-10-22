import SwiftUI
import UIKit
import Observation

public struct PFSwipeAction: Identifiable {
    public let id = UUID()
    public let title: String
    public let systemImage: String
    public let tint: Color
    public let foreground: Color
    public let handler: @MainActor () -> Void

    public init(_ title: String, systemImage: String, tint: Color, foreground: Color = .white, handler: @escaping @MainActor () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.tint = tint
        self.foreground = foreground
        self.handler = handler
    }
}

/// Keeps only one row open at a time.
@Observable
public final class PFSwipeCoordinator {
    public var openRow: UUID?
    public init() {}
}

/// Row with the app-wide swipe grammar (concept §6): swipe right fully = complete;
/// swipe left reveals up to two actions ("Heute", "Später…"). Built on a horizontal-only pan
/// so vertical scrolling stays untouched.
public struct PFSwipeRow<Content: View>: View {
    let leading: PFSwipeAction?
    let trailing: [PFSwipeAction]
    let content: Content
    @State private var offset: CGFloat = 0
    @State private var width: CGFloat = 0
    @State private var rowID = UUID()
    @State private var armed = false
    @Environment(PFSwipeCoordinator.self) private var coordinator: PFSwipeCoordinator?

    private let actionWidth: CGFloat = 78

    public init(leading: PFSwipeAction? = nil, trailing: [PFSwipeAction] = [], @ViewBuilder content: () -> Content) {
        self.leading = leading
        self.trailing = trailing
        self.content = content()
    }

    public var body: some View {
        ZStack {
            backgrounds
            content
                .background(PFColor.card)
                .offset(x: offset)
                .gesture(HorizontalPan(onChanged: changed, onEnded: ended))
                .onTapGesture { if offset != 0 { close() } }
                .allowsHitTesting(true)
        }
        .clipped()
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .onChange(of: coordinator?.openRow) { _, open in if open != rowID, offset != 0 { close() } }
        .accessibilityActions {
            if let leading { Button(leading.title) { leading.handler() } }
            ForEach(trailing) { action in Button(action.title) { action.handler() } }
        }
    }

    @ViewBuilder private var backgrounds: some View {
        if offset > 0, let leading {
            HStack {
                Image(systemName: leading.systemImage)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(leading.foreground)
                    .scaleEffect(armed ? 1.2 : 0.9)
                    .padding(.leading, 24)
                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(armed ? leading.tint : leading.tint.opacity(0.75))
            .animation(PFMotion.fast, value: armed)
        } else if offset < 0, !trailing.isEmpty {
            HStack(spacing: 0) {
                Spacer()
                ForEach(trailing) { action in
                    Button {
                        PFHaptics.tap()
                        close()
                        action.handler()
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: action.systemImage).font(.system(size: 17, weight: .semibold))
                            Text(action.title).pfText(.caption).lineLimit(1)
                        }
                        .foregroundStyle(action.foreground)
                        .frame(width: actionWidth)
                        .frame(maxHeight: .infinity)
                        .background(action.tint)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func changed(_ translation: CGFloat) {
        var proposed = translation + (offset < 0 && translation > 0 ? -revealWidth : 0)
        if leading == nil { proposed = min(proposed, 0) }
        if trailing.isEmpty { proposed = max(proposed, 0) }
        if proposed < -revealWidth { proposed = -revealWidth - (abs(proposed) - revealWidth) * 0.25 }
        offset = proposed
        let shouldArm = proposed > max(width * 0.38, 120)
        if shouldArm != armed {
            armed = shouldArm
            PFHaptics.selection()
        }
        if proposed != 0 { coordinator?.openRow = rowID }
    }

    private func ended(_ translation: CGFloat, _ velocity: CGFloat) {
        if offset > 0 {
            if armed || velocity > 900, let leading {
                withAnimation(PFMotion.snappy) { offset = width }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
                    leading.handler()
                    var t = Transaction(); t.disablesAnimations = true
                    withTransaction(t) { offset = 0; armed = false }
                }
            } else { close() }
        } else if offset < 0 {
            if offset < -revealWidth * 0.45 || velocity < -600 {
                withAnimation(PFMotion.snappy) { offset = -revealWidth }
            } else { close() }
        }
    }

    private var revealWidth: CGFloat { actionWidth * CGFloat(trailing.count) }

    private func close() {
        withAnimation(PFMotion.snappy) { offset = 0; armed = false }
    }
}

/// UIKit pan that only begins for clearly horizontal movement, so it never steals vertical scrolls.
struct HorizontalPan: UIGestureRecognizerRepresentable {
    let onChanged: (CGFloat) -> Void
    let onEnded: (CGFloat, CGFloat) -> Void

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let recognizer = UIPanGestureRecognizer()
        recognizer.delegate = context.coordinator
        return recognizer
    }

    func handleUIGestureRecognizerAction(_ recognizer: UIPanGestureRecognizer, context: Context) {
        let translation = recognizer.translation(in: recognizer.view).x
        switch recognizer.state {
        case .changed: onChanged(translation)
        case .ended, .cancelled, .failed: onEnded(translation, recognizer.velocity(in: recognizer.view).x)
        default: break
        }
    }

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            guard let pan = gestureRecognizer as? UIPanGestureRecognizer else { return false }
            let velocity = pan.velocity(in: pan.view)
            return abs(velocity.x) > abs(velocity.y) * 1.3
        }
    }
}
