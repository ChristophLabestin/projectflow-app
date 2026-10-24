import SwiftUI
import UIKit

public enum PFSpace {
    public static let xxs: CGFloat = 4
    public static let xs: CGFloat = 8
    public static let s: CGFloat = 12
    public static let m: CGFloat = 16
    public static let l: CGFloat = 20
    public static let xl: CGFloat = 24
    public static let xxl: CGFloat = 32
    /// Horizontal page gutter.
    public static let page: CGFloat = 20
}

public enum PFRadius {
    public static let small: CGFloat = 6
    public static let control: CGFloat = 10
    public static let card: CGFloat = 16
    public static let surface: CGFloat = 24
    public static let bandSegment: CGFloat = 3
}

/// Motion tokens. UI transitions use the web curve `cubic-bezier(0.16, 1, 0.3, 1)`; gestures use springs.
public enum PFMotion {
    public static let fast = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.15)
    public static let normal = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.3)
    public static let slow = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.5)
    public static let snappy = Animation.snappy(duration: 0.32, extraBounce: 0.02)
    public static let smooth = Animation.smooth(duration: 0.4)
    public static let bouncy = Animation.spring(response: 0.42, dampingFraction: 0.72)
    /// 1.8 s pulse of the web focus pill dot.
    public static let pulse = Animation.easeInOut(duration: 0.9).repeatForever(autoreverses: true)

    /// Returns `animation` unless Reduce Motion is on, in which case a short fade-friendly curve.
    @MainActor public static func respecting(_ animation: Animation) -> Animation {
        UIAccessibility.isReduceMotionEnabled ? .easeInOut(duration: 0.18) : animation
    }
}

@MainActor
public enum PFHaptics {
    public static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    public static func warning() { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
    public static func selection() { UISelectionFeedbackGenerator().selectionChanged() }
    public static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    public static func soft() { UIImpactFeedbackGenerator(style: .soft).impactOccurred(intensity: 0.7) }
}

public extension View {
    /// Elevation: light mode `shadow-sm` incl. the 1 px 5 % ring of the web token; dark mode relies on
    /// tonal steps and only overlays get a shadow.
    func pfElevation(_ level: PFElevation = .card, radius: CGFloat = PFRadius.card) -> some View {
        modifier(PFElevationModifier(level: level, radius: radius))
    }

    /// Standard content card: card surface, continuous radius, elevation.
    func pfCard(radius: CGFloat = PFRadius.card, padding: CGFloat = 0) -> some View {
        self
            .padding(padding)
            .background(PFColor.card, in: .rect(cornerRadius: radius, style: .continuous))
            .pfElevation(.card, radius: radius)
    }
}

/// `flat`: no edge, no shadow (e.g. a selected card that sank into the canvas).
public enum PFElevation: Sendable { case flat, card, lifted, overlay }

struct PFElevationModifier: ViewModifier {
    let level: PFElevation
    let radius: CGFloat
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        if level == .flat {
            content
        } else if scheme == .dark {
            content
                .overlay { shape.strokeBorder(Color.white.opacity(level == .card ? 0.03 : 0.06), lineWidth: 1) }
                .shadow(color: .black.opacity(level == .card ? 0 : 0.5), radius: level == .overlay ? 24 : 12, y: level == .overlay ? 12 : 6)
        } else {
            let (near, far, farRadius, farY): (Double, Double, CGFloat, CGFloat) = switch level {
            case .flat, .card: (0.06, 0.07, 4, 2)
            case .lifted: (0.06, 0.12, 12, 8)
            case .overlay: (0.06, 0.14, 16, 16)
            }
            content
                .overlay { shape.strokeBorder(Color.black.opacity(0.05), lineWidth: 1) }
                .shadow(color: .black.opacity(near), radius: 1, y: 1)
                .shadow(color: .black.opacity(far), radius: farRadius, y: farY)
        }
    }
}
