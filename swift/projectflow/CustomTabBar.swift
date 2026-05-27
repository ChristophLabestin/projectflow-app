import SwiftUI

struct CustomTabBar: View {
    @Binding var selection: MainTab
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private let tabs: [MainTab] = [
        .dashboard, .projects, .focus, .tasks, .settings
    ]

    var body: some View {
        HStack(spacing: 3) {
            ForEach(tabs, id: \.self) { tab in
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        selection = tab
                    }
                } label: {
                    VStack(spacing: 1) {
                        Image(systemName: iconName(for: tab))
                            .font(.system(size: 16, weight: selection == tab ? .semibold : .medium))
                            .symbolVariant(selection == tab ? .fill : .none)
                            
                        Text(title(for: tab))
                            .font(.system(size: 9, weight: selection == tab ? .semibold : .medium))
                            .lineLimit(1)
                            .minimumScaleFactor(0.78)
                    }
                    .foregroundColor(selection == tab ? colors.primary : colors.textMuted)
                    .frame(maxWidth: .infinity)
                    .frame(height: 38)
                    .background(selection == tab ? colors.primaryFade : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .padding(.top, 5)
        .padding(.bottom, 4)
        .background(
            ZStack {
                if colorScheme == .dark {
                    Color.black.opacity(0.72)
                } else {
                    Color.white.opacity(0.9)
                }
            }
            .background(.ultraThinMaterial)
            .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: -3)
            .ignoresSafeArea(edges: .bottom)
        )
        .overlay(alignment: .top) {
            Rectangle()
                .fill(colors.surfaceBorder)
                .frame(height: 0.5)
        }
    }

    private func iconName(for tab: MainTab) -> String {
        switch tab {
        case .dashboard: return "rectangle.grid.2x2"
        case .projects: return "square.stack.3d.down.forward"
        case .tasks: return "checklist"
        case .focus: return "scope"
        case .flows: return "point.3.connected.trianglepath.dotted"
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
        case .focus: return "Focus"
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
