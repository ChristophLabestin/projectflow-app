import SwiftUI

struct SettingsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text("Settings")
                    .font(.largeTitle)
                    .foregroundStyle(colors.textMain)

                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        Text("Account")
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        Text("Profile, security, and workspace preferences will live here.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                    }
                }

                PFPrimaryButton(title: "Sign out", action: { session.signOut() })
            }
            .padding(PFSpacing.lg)
        }
        .background(colors.surfaceBg.ignoresSafeArea())
    }
}
