import SwiftUI

public enum PFButtonKind: Sendable { case primary, secondary, ghost, danger, glass, tinted(Color) }
public enum PFButtonSize: Sendable {
    case small, medium, large
    var height: CGFloat { switch self { case .small: 36; case .medium: 44; case .large: 52 } }
    var padding: CGFloat { switch self { case .small: 14; case .medium: 18; case .large: 22 } }
    var text: PFTextStyle { self == .small ? .buttonSmall : .button }
}

/// Capsule button. Visuals are fully custom; `Button` is kept underneath for accessibility and
/// press handling (VoiceOver, Switch Control, keyboard).
public struct PFButton: View {
    let title: String
    let systemImage: String?
    let kind: PFButtonKind
    let size: PFButtonSize
    let fullWidth: Bool
    let action: () -> Void

    public init(_ title: String, systemImage: String? = nil, kind: PFButtonKind = .primary, size: PFButtonSize = .medium,
                fullWidth: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.kind = kind
        self.size = size
        self.fullWidth = fullWidth
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let systemImage { Image(systemName: systemImage).font(.system(size: size == .small ? 13 : 15, weight: .semibold)) }
                Text(title).pfText(size.text).lineLimit(1).minimumScaleFactor(0.85)
            }
            .padding(.horizontal, size.padding)
            .frame(minHeight: size.height)
            .frame(maxWidth: fullWidth ? .infinity : nil)
        }
        .buttonStyle(PFCapsuleStyle(kind: kind))
    }
}

struct PFCapsuleStyle: ButtonStyle {
    let kind: PFButtonKind
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        styled(configuration.label)
            .opacity(isEnabled ? 1 : 0.45)
            .scaleEffect(pressed ? 0.97 : 1)
            .animation(PFMotion.fast, value: pressed)
            .contentShape(.capsule)
    }

    @ViewBuilder
    private func styled(_ label: Configuration.Label) -> some View {
        switch kind {
        case .primary:
            label.foregroundStyle(PFColor.onPrimary).background(PFColor.primary, in: .capsule)
        case .secondary:
            label.foregroundStyle(PFColor.textMain).background(PFColor.card, in: .capsule).pfElevation(.card, radius: 100)
        case .ghost:
            label.foregroundStyle(PFColor.textMain).pfPillSurface()
        case .danger:
            label.foregroundStyle(Color.white).background(PFColor.danger, in: .capsule)
        case .glass:
            label.foregroundStyle(PFColor.textMain).pfGlass(in: .capsule)
        case .tinted(let color):
            label.foregroundStyle(color).background(color.opacity(0.12), in: .capsule)
        }
    }
}

/// Round icon button. `glass` for floating chrome, `raised` inside content.
public struct PFIconButton: View {
    public enum Style: Sendable { case glass, raised, primary, plain }

    let systemImage: String
    let label: String
    let style: Style
    let size: CGFloat
    let action: () -> Void

    public init(_ systemImage: String, label: String, style: Style = .glass, size: CGFloat = 44, action: @escaping () -> Void) {
        self.systemImage = systemImage
        self.label = label
        self.style = style
        self.size = size
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: size * 0.4, weight: .semibold))
                .frame(width: size, height: size)
                .contentShape(.circle)
        }
        .buttonStyle(PFIconStyle(style: style))
        .accessibilityLabel(label)
    }
}

struct PFIconStyle: ButtonStyle {
    let style: PFIconButton.Style

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        Group {
            switch style {
            case .glass: configuration.label.foregroundStyle(PFColor.textMain).pfGlass(in: .circle)
            case .raised: configuration.label.foregroundStyle(PFColor.textMuted).background(PFColor.raised, in: .circle)
            case .primary: configuration.label.foregroundStyle(PFColor.onPrimary).background(PFColor.primary, in: .circle)
            case .plain: configuration.label.foregroundStyle(PFColor.textMuted)
            }
        }
        .scaleEffect(pressed ? 0.92 : 1)
        .animation(PFMotion.fast, value: pressed)
    }
}

/// Plain tap target with a soft press response — for rows and cards.
public struct PFPressableStyle: ButtonStyle {
    let scale: CGFloat

    public init(scale: CGFloat = 0.985) { self.scale = scale }

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(PFMotion.fast, value: configuration.isPressed)
    }
}

public extension ButtonStyle where Self == PFPressableStyle {
    static var pfPressable: PFPressableStyle { PFPressableStyle() }
}
