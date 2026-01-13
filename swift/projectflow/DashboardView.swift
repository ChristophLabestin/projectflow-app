import SwiftUI

struct DashboardView: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text("Dashboard")
                    .font(.largeTitle)
                    .foregroundStyle(colors.textMain)

                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        PFSectionHeader(title: "Pinned Project")
                        Text("No project pinned yet.")
                            .foregroundStyle(colors.textMuted)
                    }
                }

                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        PFSectionHeader(title: "Pinned Tasks")
                        Text("No pinned tasks.")
                            .foregroundStyle(colors.textMuted)
                    }
                }

                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        PFSectionHeader(title: "Recent Activity")
                        Text("Activity will appear here once you start updating tasks and projects.")
                            .foregroundStyle(colors.textMuted)
                    }
                }
            }
            .padding(PFSpacing.lg)
        }
        .background(colors.surfaceBg.ignoresSafeArea())
    }
}
