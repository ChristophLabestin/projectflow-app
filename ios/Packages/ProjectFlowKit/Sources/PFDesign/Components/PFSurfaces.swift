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

    /// Surface of a pill (choice chips, capture chips, small inline actions): primary fill when selected,
    /// otherwise the frosted chrome of the round back button, so pills and back buttons read as one family.
    @ViewBuilder func pfPillSurface(selected: Bool = false) -> some View {
        if selected {
            background(PFColor.primary, in: .capsule)
        } else {
            pfGlass(in: Capsule())
        }
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

// MARK: - State surfaces (web STYLING §1.10/§1.11)
//
// Three states, never a border or ring:
// • sunken   — focused field, current navigation/list item (dock item, sidebar row, calendar day, tree item)
// • selected — chosen option in a choice (option card, chip, segment, template/type, theme): inverted primary
// • glass    — menus/popovers: milky, borderless panel; options sink in, the chosen one gets bar + check

/// Sunken fill: a touch darker than the surroundings with a soft inner shadow from the top edge.
public struct PFSunkenFill<S: Shape>: View {
    let shape: S
    let color: Color
    public init(_ shape: S, color: Color = PFColor.sunken) { self.shape = shape; self.color = color }
    public var body: some View {
        shape.fill(color
            .shadow(.inner(color: PFColor.sunkenShadow, radius: 1, y: 1))
            .shadow(.inner(color: PFColor.sunkenShadow, radius: 2, y: 1)))
    }
}

public extension View {
    /// Field background: `field` at rest, sunken while focused. No border.
    func pfFieldSurface(focused: Bool, cornerRadius: CGFloat = PFRadius.control) -> some View {
        background {
            let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            if focused { PFSunkenFill(shape) } else { shape.fill(PFColor.field) }
        }
    }

    /// Current navigation/list item: sinks in (not inverted).
    func pfSunken<S: Shape>(_ isOn: Bool, in shape: S) -> some View {
        background { if isOn { PFSunkenFill(shape) } }
    }

    /// Chosen option in a choice: inverted (primary fill, primary-text content). Inner glyphs flip with
    /// `PFColor.onPrimary`; unselected options keep `rest` (default card).
    func pfSelected<S: Shape>(_ isOn: Bool, in shape: S, rest: Color = PFColor.card) -> some View {
        foregroundStyle(isOn ? PFColor.onPrimary : PFColor.textMain)
            .background(isOn ? PFColor.primary : rest, in: shape)
    }

    /// Milky glass panel (menus, popovers, floating option lists): borderless, light top edge, soft drop shadow.
    func pfGlassPanel<S: Shape>(in shape: S) -> some View {
        background {
            ZStack {
                shape.fill(.regularMaterial)
                shape.fill(PFColor.glassTint)
            }
            .overlay(alignment: .top) {
                shape.stroke(PFColor.glassEdge, lineWidth: 1).mask(alignment: .top) { Rectangle().frame(height: 1.5) }
            }
            .shadow(color: .black.opacity(0.12), radius: 18, y: 8)
        }
    }

    /// Option inside a glass menu/sheet list: sinks into the glass while pressed/highlighted; the selected one is
    /// sunken + semibold with a short primary bar on the left (check is the caller's trailing glyph).
    func pfMenuOption(selected: Bool, cornerRadius: CGFloat = 12) -> some View {
        modifier(PFMenuOptionModifier(selected: selected, cornerRadius: cornerRadius))
    }
}

struct PFMenuOptionModifier: ViewModifier {
    let selected: Bool
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        content
            .fontWeight(selected ? .semibold : nil)
            .background { if selected { PFSunkenFill(shape, color: PFColor.glassSunken) } }
            .overlay(alignment: .leading) {
                if selected {
                    Capsule().fill(PFColor.primary).frame(width: 3, height: 14).padding(.leading, 4)
                }
            }
    }
}
