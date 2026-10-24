import SwiftUI
import UIKit
import PFModel

/// Colour tokens mirrored from `web/styles/_tokens.scss` (source of truth). Every colour is a
/// light/dark pair resolved by the trait collection, so it follows the system or the in-app theme.
/// Never use colour literals outside this file (enforced by `.swiftlint.yml`).
public enum PFColor {
    // Depth ladder
    public static let canvas = dynamic(0xF2F2F3, 0x0B0D11)
    public static let card = dynamic(0xFFFFFF, 0x151920)
    public static let raised = dynamic(0xEDEDEE, 0x1F232A)
    public static let raisedSoft = dynamic(0xF7F7F8, 0x23272E)
    public static let hairline = dynamic(0xE5E7EB, 0x2E3440)
    public static let hairlineStrong = dynamic(0xD1D5DB, 0x3C4453)

    // Text
    public static let textMain = dynamic(0x171717, 0xE5E7EB)
    public static let textMuted = dynamic(0x666666, 0x9CA3AF)
    /// Decoration only (placeholders, disabled glyphs). Never for information (contrast < 4.5:1).
    public static let textSubtle = dynamic(0x8F8F8F, 0x6B7280)

    // Inverting primary (black on light, near-white on dark) — the app tint.
    public static let primary = dynamic(0x171717, 0xE5E5E5)
    public static let onPrimary = dynamic(0xFFFFFF, 0x171717)

    // Semantic
    public static let success = fixed(0x10B981)
    public static let warning = fixed(0xF59E0B)
    public static let danger = fixed(0xEF4444)
    /// Text-safe variants of the semantic colours (AA on card and canvas).
    public static let successText = dynamic(0x047857, 0x10B981)
    public static let warningText = dynamic(0xB45309, 0xF59E0B)
    public static let dangerText = dynamic(0xB91C1C, 0xF87171)

    /// Dot grid on Today and in the focus room (rgba 0,0,0,.06 / 255,255,255,.04).
    public static let dot = Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
        ? UIColor(white: 1, alpha: 0.04) : UIColor(white: 0, alpha: 0.06) })

    /// Hairline used inside cards between rows (text-main at 5–6 %).
    public static let rowDivider = Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
        ? UIColor(white: 1, alpha: 0.06) : UIColor(white: 0, alpha: 0.06) })

    /// Grouped rows inside system sheets: a light translucent fill that lets the sheet material show
    /// through, like native inset-grouped lists on iOS 26 sheets.
    public static let sheetGroup = Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
        ? UIColor(white: 1, alpha: 0.07) : UIColor(white: 0, alpha: 0.045) })

    /// Sheet surface laid over the system material: mostly opaque — near-white in light mode,
    /// near-black in dark mode — so only a hint of the content behind shows through.
    public static let sheetSurface = Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
        ? UIColor(hex: 0x0B0D11, alpha: 0.86) : UIColor(white: 1, alpha: 0.86) })

    // State surfaces (web STYLING §1.10/§1.11: borderless / sunken / selected / glass).
    /// Field at rest (web `surface-hover`): filled, no hairline.
    public static let field = dynamic(0xEDEDEE, 0x1F232A)
    /// Field under the pointer (web `--field-bg-hover`).
    public static let fieldHover = dynamic(0xE9E9EB, 0x22262D)
    /// Sunken (web `--sunken-bg`): focused field, current navigation/list item. Always with `sunkenShadow`.
    /// Dark: black 24 % over the parent surface (canvas, card or sheet), so it always sinks relative to it.
    public static let sunken = Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
        ? UIColor(white: 0, alpha: 0.24) : UIColor(hex: 0xE7E7EA, alpha: 1) })
    /// Inner shadow strength of sunken surfaces (light 5 %, dark 40 %).
    public static let sunkenShadow = Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
        ? UIColor(white: 0, alpha: 0.40) : UIColor(white: 0, alpha: 0.05) })
    /// Highlight inside glass menus: sinks into the glass (black 4.5 % light / 28 % dark).
    public static let glassSunken = Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
        ? UIColor(white: 0, alpha: 0.28) : UIColor(white: 0, alpha: 0.045) })
    /// Milky glass panel tint (white / card at 86 %).
    public static let glassTint = Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
        ? UIColor(hex: 0x151920, alpha: 0.86) : UIColor(white: 1, alpha: 0.86) })
    /// Fine light top edge of glass panels.
    public static let glassEdge = Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
        ? UIColor(white: 1, alpha: 0.06) : UIColor(white: 1, alpha: 0.7) })

    public static let scrim = Color(uiColor: UIColor(white: 0, alpha: 0.35))

    // Status: base hue (fills at 12 %) and AA text tone (C10).
    public static func statusBase(_ tone: StatusTone) -> Color {
        switch tone {
        case .backlog: fixed(0x94A3B8)
        case .open: fixed(0x3B82F6)
        case .inProgress: fixed(0x0EA5E9)
        case .review: fixed(0xF59E0B)
        case .onHold: fixed(0x9CA3AF)
        case .blocked: fixed(0xEF4444)
        case .done: fixed(0x10B981)
        case .planning: fixed(0x8B5CF6)
        }
    }

    public static func statusText(_ tone: StatusTone) -> Color {
        switch tone {
        case .backlog: dynamic(0x475569, 0x94A3B8)
        case .open: dynamic(0x1D4ED8, 0x60A5FA)
        case .inProgress: dynamic(0x0369A1, 0x0EA5E9)
        case .review: dynamic(0xB45309, 0xF59E0B)
        case .onHold: dynamic(0x4B5563, 0x9CA3AF)
        case .blocked: dynamic(0xB91C1C, 0xF87171)
        case .done: dynamic(0x047857, 0x10B981)
        case .planning: dynamic(0x6D28D9, 0xA78BFA)
        }
    }

    public static func statusFill(_ tone: StatusTone) -> Color { statusBase(tone).opacity(0.12) }

    public static func priority(_ priority: TaskPriority) -> Color {
        switch priority {
        case .urgent: dynamic(0x7C3AED, 0xA78BFA)
        case .high: dynamic(0xEF4444, 0xF87171)
        case .medium: dynamic(0x3B82F6, 0x60A5FA)
        case .low: fixed(0x94A3B8)
        }
    }

    /// Severity used by ring checks, due chips and the day band.
    public static func severity(_ severity: Severity) -> Color {
        switch severity {
        case .overdue: danger
        case .due: warning
        case .neutral: textSubtle
        case .done: success
        }
    }

    public static func severityText(_ severity: Severity) -> Color {
        switch severity {
        case .overdue: dangerText
        case .due: warningText
        case .neutral: textMuted
        case .done: successText
        }
    }

    /// Deterministic avatar background for people without a photo.
    public static func avatar(seed: String) -> Color {
        let palette: [UInt32] = [0x8B5CF6, 0x0EA5E9, 0x10B981, 0xF59E0B, 0xEF4444, 0x3B82F6, 0x171717, 0x6D28D9]
        let index = abs(seed.unicodeScalars.reduce(0) { ($0 &* 31) &+ Int($1.value) }) % palette.count
        return fixed(palette[index])
    }

    public static func hex(_ string: String?) -> Color? {
        guard let string, string.hasPrefix("#"), let value = UInt32(string.dropFirst(), radix: 16), string.count == 7 else { return nil }
        return fixed(value)
    }

    // MARK: helpers

    static func fixed(_ hex: UInt32) -> Color { Color(uiColor: UIColor(hex: hex)) }

    static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { @Sendable traits in traits.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
}

public enum Severity: Sendable, Hashable {
    case overdue, due, neutral, done
}

extension UIColor {
    nonisolated convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
    }
}
