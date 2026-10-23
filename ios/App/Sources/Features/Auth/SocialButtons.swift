import SwiftUI
import AuthenticationServices
import PFDesign

// Third-party sign-in buttons follow each provider's brand guidelines, not the ProjectFlow tokens:
// colours, logos and fonts below are mandated by Apple, Google and GitHub and must not be themed.
// All three share the height and pill shape of the other sign-in buttons (allowed by every guideline).

private let socialButtonHeight: CGFloat = 52

/// "Continue with Apple": the system `ASAuthorizationAppleIDButton` (HIG: black on light, white on dark;
/// only the corner radius is adjusted). The tap runs the app's own authorization flow.
struct AppleSignInBrandButton: View {
    let action: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        AppleIDButtonRepresentable(style: colorScheme == .dark ? .white : .black, action: action)
            .id(colorScheme)
            .frame(maxWidth: .infinity)
            .frame(height: socialButtonHeight)
            .accessibilityLabel(L10n.t("auth.apple"))
    }
}

private struct AppleIDButtonRepresentable: UIViewRepresentable {
    let style: ASAuthorizationAppleIDButton.Style
    let action: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(action: action) }

    func makeUIView(context: Context) -> ASAuthorizationAppleIDButton {
        let button = ASAuthorizationAppleIDButton(authorizationButtonType: .continue, authorizationButtonStyle: style)
        button.cornerRadius = socialButtonHeight / 2
        button.addTarget(context.coordinator, action: #selector(Coordinator.tapped), for: .touchUpInside)
        return button
    }

    func updateUIView(_ uiView: ASAuthorizationAppleIDButton, context: Context) {
        context.coordinator.action = action
    }

    final class Coordinator: NSObject {
        var action: () -> Void
        init(action: @escaping () -> Void) { self.action = action }
        @objc func tapped() { action() }
    }
}

/// "Continue with Google" per the Google Identity branding guidelines: standard multi-colour "G",
/// Roboto Medium, light theme #FFFFFF / stroke #747775 / text #1F1F1F, dark theme #131314 / #8E918F /
/// #E3E3E3. Proportions of the 40 pt reference button (logo 20, text 14, padding 12, gap 10) scaled to 52 pt.
struct GoogleSignInBrandButton: View {
    let action: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    private var scale: CGFloat { socialButtonHeight / 40 }
    private var fill: Color { colorScheme == .dark ? Color(red: 0x13 / 255, green: 0x13 / 255, blue: 0x14 / 255) : .white }
    private var stroke: Color {
        colorScheme == .dark ? Color(red: 0x8E / 255, green: 0x91 / 255, blue: 0x8F / 255) : Color(red: 0x74 / 255, green: 0x77 / 255, blue: 0x75 / 255)
    }
    private var text: Color {
        colorScheme == .dark ? Color(red: 0xE3 / 255, green: 0xE3 / 255, blue: 0xE3 / 255) : Color(red: 0x1F / 255, green: 0x1F / 255, blue: 0x1F / 255)
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10 * scale) {
                Image("BrandGoogle")
                    .resizable()
                    .frame(width: 20 * scale, height: 20 * scale)
                Text(L10n.t("auth.google"))
                    .font(.custom("Roboto-Medium", fixedSize: 14 * scale))
                    .foregroundStyle(text)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12 * scale)
            .frame(maxWidth: .infinity)
            .frame(height: socialButtonHeight)
            .background(fill, in: .capsule)
            .overlay(Capsule().strokeBorder(stroke, lineWidth: 1))
            .contentShape(.capsule)
        }
        .buttonStyle(.pfPressable)
    }
}

/// "Continue with GitHub" per the GitHub logo guidelines: the unaltered Invertocat mark in black (light)
/// or white (dark), next to the name; button surface and text match the Google button's neutral style.
struct GitHubSignInBrandButton: View {
    let action: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let isDark = colorScheme == .dark
        Button(action: action) {
            HStack(spacing: 12) {
                Image("BrandGitHub")
                    .resizable()
                    .renderingMode(.template)
                    .foregroundStyle(isDark ? Color.white : Color.black)
                    .frame(width: 22, height: 22)
                Text(L10n.t("auth.github"))
                    .pfText(.button)
                    .foregroundStyle(isDark ? Color.white : Color.black)
                    .lineLimit(1)
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity)
            .frame(height: socialButtonHeight)
            .background(PFColor.card, in: .capsule)
            .overlay(Capsule().strokeBorder(PFColor.hairlineStrong, lineWidth: 1))
            .contentShape(.capsule)
        }
        .buttonStyle(.pfPressable)
    }
}
