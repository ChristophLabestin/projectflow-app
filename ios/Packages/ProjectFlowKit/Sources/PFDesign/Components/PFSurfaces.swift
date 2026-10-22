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
    /// Liquid Glass for chrome (dock, focus bar, floating buttons, sheets). Never for content cards.
    func pfGlass<S: Shape>(in shape: S, interactive: Bool = true, tint: Color? = nil) -> some View {
        modifier(PFGlassModifier(shape: shape, interactive: interactive, tint: tint))
    }
}

struct PFGlassModifier<S: Shape>: ViewModifier {
    let shape: S
    let interactive: Bool
    let tint: Color?
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    func body(content: Content) -> some View {
        if reduceTransparency {
            content.background(PFColor.card, in: shape).pfElevation(.lifted, radius: 28)
        } else {
            content.glassEffect(glass, in: shape)
        }
    }

    private var glass: Glass {
        var glass = Glass.regular
        if let tint { glass = glass.tint(tint) }
        if interactive { glass = glass.interactive() }
        return glass
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
