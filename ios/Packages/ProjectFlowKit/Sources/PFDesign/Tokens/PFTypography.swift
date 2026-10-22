import SwiftUI
import UIKit
import CoreText

/// Two typefaces with a clear job (concept §4.2):
/// Plus Jakarta Sans (bundled variable font) for everything that says "ProjectFlow" — headlines,
/// titles, row titles, eyebrows, pills, buttons — and SF Pro for reading text and metadata.
public enum PFTextStyle: CaseIterable, Sendable {
    case display, displayLarge, title, section, rowTitle, eyebrow, pill, button, buttonSmall, tab
    case body, bodyEmphasis, meta, metaStrong, caption, number

    var spec: (size: CGFloat, weight: CGFloat, tracking: CGFloat, lineSpacing: CGFloat, jakarta: Bool, relativeTo: UIFont.TextStyle) {
        switch self {
        case .displayLarge: (40, 800, -0.02, 0.06, true, .largeTitle)
        case .display: (30, 800, -0.02, 0.18, true, .largeTitle)
        case .title: (26, 700, -0.02, 0.15, true, .title1)
        case .section: (17, 700, -0.01, 0.1, true, .headline)
        case .rowTitle: (16, 600, -0.005, 0.12, true, .body)
        case .eyebrow: (11, 800, 0.14, 0, true, .caption2)
        case .pill: (11, 700, 0.04, 0, true, .caption2)
        case .button: (15, 700, -0.005, 0, true, .body)
        case .buttonSmall: (13, 700, 0, 0, true, .footnote)
        case .tab: (10.5, 700, 0.01, 0, true, .caption2)
        case .body: (17, 400, 0, 0.3, false, .body)
        case .bodyEmphasis: (17, 600, 0, 0.3, false, .body)
        case .meta: (13, 500, 0, 0.1, false, .footnote)
        case .metaStrong: (13, 600, 0, 0.1, false, .footnote)
        case .caption: (11, 500, 0, 0, false, .caption2)
        case .number: (13, 600, 0, 0, false, .footnote)
        }
    }

    public var isUppercased: Bool { self == .eyebrow || self == .pill }
}

public enum PFFont {
    static let family = "Plus Jakarta Sans"
    private nonisolated(unsafe) static var registered = false

    /// Registers the bundled variable font once per process (app and extensions).
    public static func registerIfNeeded() {
        guard !registered else { return }
        registered = true
        if let url = Bundle.module.url(forResource: "PlusJakartaSans-VF", withExtension: "ttf") {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }

    /// Jakarta at an explicit weight via the variable `wght` axis, scaled for Dynamic Type.
    static func jakarta(size: CGFloat, weight: CGFloat, relativeTo style: UIFont.TextStyle, category: UIContentSizeCategory) -> UIFont {
        registerIfNeeded()
        let wghtAxis = 0x7767_6874 // 'wght'
        let descriptor = UIFontDescriptor(fontAttributes: [
            .family: family,
            kCTFontVariationAttribute as UIFontDescriptor.AttributeName: [wghtAxis: weight],
        ])
        let base = UIFont(descriptor: descriptor, size: size)
        let traits = UITraitCollection(preferredContentSizeCategory: category)
        return UIFontMetrics(forTextStyle: style).scaledFont(for: base, compatibleWith: traits)
    }

    static func system(size: CGFloat, weight: CGFloat, relativeTo style: UIFont.TextStyle, category: UIContentSizeCategory) -> UIFont {
        let uiWeight: UIFont.Weight = switch weight {
        case ..<450: .regular
        case ..<550: .medium
        case ..<650: .semibold
        default: .bold
        }
        let traits = UITraitCollection(preferredContentSizeCategory: category)
        return UIFontMetrics(forTextStyle: style).scaledFont(for: .systemFont(ofSize: size, weight: uiWeight), compatibleWith: traits)
    }

    public static func uiFont(_ style: PFTextStyle, category: UIContentSizeCategory = .large) -> UIFont {
        let s = style.spec
        return s.jakarta
            ? jakarta(size: s.size, weight: s.weight, relativeTo: s.relativeTo, category: category)
            : system(size: s.size, weight: s.weight, relativeTo: s.relativeTo, category: category)
    }
}

extension DynamicTypeSize {
    var contentSizeCategory: UIContentSizeCategory {
        switch self {
        case .xSmall: .extraSmall
        case .small: .small
        case .medium: .medium
        case .large: .large
        case .xLarge: .extraLarge
        case .xxLarge: .extraExtraLarge
        case .xxxLarge: .extraExtraExtraLarge
        case .accessibility1: .accessibilityMedium
        case .accessibility2: .accessibilityLarge
        case .accessibility3: .accessibilityExtraLarge
        case .accessibility4: .accessibilityExtraExtraLarge
        case .accessibility5: .accessibilityExtraExtraExtraLarge
        @unknown default: .large
        }
    }
}

struct PFTextStyleModifier: ViewModifier {
    let style: PFTextStyle
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    func body(content: Content) -> some View {
        let font = PFFont.uiFont(style, category: dynamicTypeSize.contentSizeCategory)
        let spec = style.spec
        content
            .font(Font(font))
            .tracking(spec.tracking * font.pointSize)
            .lineSpacing(spec.lineSpacing * font.pointSize * 0.5)
            .textCase(style.isUppercased ? .uppercase : nil)
            .monospacedDigit()
    }
}

public extension View {
    /// Applies a ProjectFlow text style (font, tracking, line spacing, casing, Dynamic Type).
    func pfText(_ style: PFTextStyle) -> some View { modifier(PFTextStyleModifier(style: style)) }
}
