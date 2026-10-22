import SwiftUI

/// Page background: canvas colour, optionally with the web's 20 pt dot grid.
public struct PFCanvas: View {
    let dotted: Bool

    public init(dotted: Bool = false) { self.dotted = dotted }

    public var body: some View {
        ZStack {
            PFColor.canvas
            if dotted {
                Canvas { context, size in
                    let spacing: CGFloat = 20
                    let dot = Path(ellipseIn: CGRect(x: -0.75, y: -0.75, width: 1.5, height: 1.5))
                    var y: CGFloat = spacing / 2
                    while y < size.height {
                        var x: CGFloat = spacing / 2
                        while x < size.width {
                            context.fill(dot.offsetBy(dx: x, dy: y), with: .color(PFColor.dot))
                            x += spacing
                        }
                        y += spacing
                    }
                }
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
        }
        .ignoresSafeArea()
    }
}

public extension View {
    /// ProjectFlow's own frosted chrome (not the system Liquid Glass): the web top-bar pill recipe —
    /// card colour at ~72 % over a backdrop blur, a hairline ring and the `shadow-sm` lift.
    /// Use for floating chrome (navigation bar, focus bar, floating buttons). Never for content cards.
    func pfGlass<S: Shape>(in shape: S, interactive: Bool = true, tint: Color? = nil) -> some View {
        modifier(PFFrostModifier(shape: shape, tint: tint))
    }

    /// Same as `pfGlass`, named for what it is.
    func pfFrost<S: Shape>(in shape: S, tint: Color? = nil) -> some View {
        modifier(PFFrostModifier(shape: shape, tint: tint))
    }
}

struct PFFrostModifier<S: Shape>: ViewModifier {
    let shape: S
    let tint: Color?
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        content
            .background {
                ZStack {
                    if !reduceTransparency { shape.fill(.ultraThinMaterial) }
                    shape.fill(PFColor.card.opacity(reduceTransparency ? 1 : (scheme == .dark ? 0.78 : 0.72)))
                    if let tint { shape.fill(tint.opacity(0.12)) }
                }
            }
            .overlay {
                shape.stroke(scheme == .dark ? Color.white.opacity(0.07) : Color.black.opacity(0.06), lineWidth: 1)
            }
            .compositingGroup()
            .shadow(color: .black.opacity(scheme == .dark ? 0.45 : 0.08), radius: scheme == .dark ? 18 : 12, y: 6)
            .shadow(color: .black.opacity(scheme == .dark ? 0.2 : 0.05), radius: 2, y: 1)
    }
}

/// Uppercase, wide-tracked eyebrow label ("DEIN PLAN FÜR HEUTE").
public struct PFEyebrow: View {
    let text: String
    let color: Color

    public init(_ text: String, color: Color = PFColor.textMuted) {
        self.text = text
        self.color = color
    }

    public var body: some View {
        Text(text)
            .pfText(.eyebrow)
            .foregroundStyle(color)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Section header row: eyebrow on the left, optional trailing accessory.
public struct PFSectionHeader<Trailing: View>: View {
    let title: String
    let trailing: Trailing

    public init(_ title: String, @ViewBuilder trailing: () -> Trailing) {
        self.title = title
        self.trailing = trailing()
    }

    public var body: some View {
        HStack(alignment: .center) {
            PFEyebrow(title)
            Spacer(minLength: PFSpace.s)
            trailing
        }
        .padding(.top, PFSpace.xl)
        .padding(.bottom, PFSpace.s)
    }
}

public extension PFSectionHeader where Trailing == EmptyView {
    init(_ title: String) { self.init(title) { EmptyView() } }
}

/// Divider between rows inside a card (inset 1 px line, like `inset 0 1px 0 rgba(text,.05)`).
public struct PFRowDivider: View {
    let leadingInset: CGFloat

    public init(leadingInset: CGFloat = PFSpace.m) { self.leadingInset = leadingInset }

    public var body: some View {
        Rectangle()
            .fill(PFColor.rowDivider)
            .frame(height: 1)
            .padding(.leading, leadingInset)
            .accessibilityHidden(true)
    }
}

/// Vertical stack of rows inside one card with dividers between them (no nested cards).
public struct PFCardList<Content: View>: View {
    let content: Content

    public init(@ViewBuilder content: () -> Content) { self.content = content() }

    public var body: some View {
        VStack(spacing: 0) {
            Group(subviews: content) { subviews in
                ForEach(Array(subviews.enumerated()), id: \.element.id) { index, subview in
                    if index > 0 { PFRowDivider() }
                    subview
                }
            }
        }
        .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
        .pfCard()
    }
}
