import SwiftUI

struct CustomTabBar: View {
    @Binding var selection: MainTab
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private let tabs: [MainTab] = [
        .dashboard, .projects, .tasks, .flows, .settings
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs, id: \.self) { tab in
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        selection = tab
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: iconName(for: tab))
                            .font(.system(size: 20, weight: selection == tab ? .bold : .medium))
                            .symbolVariant(selection == tab ? .fill : .none)
                            
                        Text(title(for: tab))
                            .font(.system(size: 10, weight: selection == tab ? .semibold : .medium))
                    }
                    .foregroundColor(selection == tab ? colors.primary : colors.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .contentShape(Rectangle())
                }
            }
        }
        .padding(.horizontal, 6)
        .padding(.bottom, 20) // Internal padding for content
        .background(
            ZStack {
                // Glassmorphism background
                if colorScheme == .dark {
                    Color.black.opacity(0.8)
                } else {
                    Color.white.opacity(0.9)
                }
            }
            .background(.ultraThinMaterial)
            .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: -5)
        )
        // Ensure it ignores safe area bottom so the background extends fully
        .ignoresSafeArea(edges: .bottom)
    }

    private func iconName(for tab: MainTab) -> String {
        switch tab {
        case .dashboard: return "rectangle.grid.2x2"
        case .projects: return "square.stack.3d.down.forward"
        case .tasks: return "checklist"
        case .flows: return "sparkles"
        case .issues: return "exclamationmark.bubble"
        case .notifications: return "bell"
        case .settings: return "gearshape"
        }
    }

    private func title(for tab: MainTab) -> String {
        switch tab {
        case .dashboard: return "Dashboard"
        case .projects: return "Projects"
        case .tasks: return "Tasks"
        case .flows: return "Flows"
        case .issues: return "Issues"
        case .notifications: return "Inbox"
        case .settings: return "Settings"
        }
    }
}

// Preview helper
struct CustomTabBar_Previews: PreviewProvider {
    static var previews: some View {
        CustomTabBar(selection: .constant(.dashboard))
    }
}
