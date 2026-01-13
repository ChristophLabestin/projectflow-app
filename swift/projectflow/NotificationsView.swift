import SwiftUI

struct NotificationsView: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text("Notifications")
                    .font(.largeTitle)
                    .foregroundStyle(colors.textMain)

                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        Text("You're all caught up.")
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        Text("Project and task updates will show here.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                    }
                }
            }
            .padding(PFSpacing.lg)
        }
        .background(colors.surfaceBg.ignoresSafeArea())
    }
}
