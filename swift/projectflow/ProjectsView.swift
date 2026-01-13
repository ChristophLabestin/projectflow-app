import SwiftUI

struct ProjectsView: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text("Projects")
                    .font(.largeTitle)
                    .foregroundStyle(colors.textMain)

                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        Text("Active Projects")
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        Text("Project status, overview, and quick actions will be listed here.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                    }
                }

                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        Text("Flows & Issues")
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        Text("Access flows and issues from each project detail view.")
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
