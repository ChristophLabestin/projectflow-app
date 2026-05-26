import SwiftUI

struct PFColors {
    let primary: Color
    let primaryDark: Color
    let primaryLight: Color
    let primaryFade: Color
    let primaryText: Color

    let surfaceBg: Color
    let surfaceCard: Color
    let surfacePaper: Color
    let surfaceHover: Color
    let surfaceBorder: Color
    let surfaceBorderHover: Color

    let textMain: Color
    let textMuted: Color
    let textSubtle: Color
    let textOnDark: Color

    let success: Color
    let warning: Color
    let error: Color

    let shadowSm: Color

    static func palette(for scheme: ColorScheme) -> PFColors {
        if scheme == .dark {
            return PFColors(
                primary: Color(hex: "#e5e5e5"),
                primaryDark: Color(hex: "#d4d4d4"),
                primaryLight: Color(hex: "#a3a3a3"),
                primaryFade: Color(hex: "#262626"),
                primaryText: Color(hex: "#171717"),
                surfaceBg: Color(hex: "#0b0d11"),
                surfaceCard: Color(hex: "#151920"),
                surfacePaper: Color(hex: "#151920"),
                surfaceHover: Color(hex: "#1e242e"),
                surfaceBorder: Color(hex: "#2e3440"),
                surfaceBorderHover: Color(hex: "#2e3440"),
                textMain: Color(hex: "#e5e7eb"),
                textMuted: Color(hex: "#9ca3af"),
                textSubtle: Color(hex: "#6b7280"),
                textOnDark: Color(hex: "#ffffff"),
                success: Color(hex: "#10b981"),
                warning: Color(hex: "#f59e0b"),
                error: Color(hex: "#ef4444"),
                shadowSm: Color.black.opacity(0.3)
            )
        }

        return PFColors(
            primary: Color(hex: "#171717"),
            primaryDark: Color(hex: "#000000"),
            primaryLight: Color(hex: "#404040"),
            primaryFade: Color(hex: "#f5f5f5"),
            primaryText: Color(hex: "#ffffff"),
            surfaceBg: Color(hex: "#fafafa"),
            surfaceCard: Color(hex: "#ffffff"),
            surfacePaper: Color(hex: "#ffffff"),
            surfaceHover: Color(hex: "#f5f5f5"),
            surfaceBorder: Color(hex: "#e5e7eb"),
            surfaceBorderHover: Color(hex: "#d1d5db"),
            textMain: Color(hex: "#171717"),
            textMuted: Color(hex: "#737373"),
            textSubtle: Color(hex: "#a3a3a3"),
            textOnDark: Color(hex: "#ffffff"),
            success: Color(hex: "#10b981"),
            warning: Color(hex: "#f59e0b"),
            error: Color(hex: "#ef4444"),
            shadowSm: Color.black.opacity(0.05)
        )
    }
}

enum PFSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
}

struct PFScreenPadding: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    var vertical: CGFloat = PFSpacing.lg

    private var horizontal: CGFloat {
        horizontalSizeClass == .compact ? PFSpacing.md : PFSpacing.lg
    }

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, horizontal)
            .padding(.vertical, vertical)
    }
}

struct PFScreenHorizontalPadding: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private var horizontal: CGFloat {
        horizontalSizeClass == .compact ? PFSpacing.md : PFSpacing.lg
    }

    func body(content: Content) -> some View {
        content.padding(.horizontal, horizontal)
    }
}

extension View {
    func pfScreenPadding(vertical: CGFloat = PFSpacing.lg) -> some View {
        modifier(PFScreenPadding(vertical: vertical))
    }

    func pfScreenHorizontalPadding() -> some View {
        modifier(PFScreenHorizontalPadding())
    }
}

enum PFRadius {
    static let sm: CGFloat = 6
    static let md: CGFloat = 10
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let full: CGFloat = 999
}
