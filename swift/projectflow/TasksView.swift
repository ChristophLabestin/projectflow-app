import SwiftUI

struct TasksView: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text("Tasks")
                    .font(.largeTitle)
                    .foregroundStyle(colors.textMain)

                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        Text("Assigned to you")
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        Text("Task CRUD, status updates, and due dates will appear here.")
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
