import SwiftUI

struct CustomTabBar: View {
    @Binding var selection: MainTab
    var unreadCount: Int = 0
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private let tabs: [MainTab] = [
        .home, .projects, .focus, .work, .inbox
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
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: iconName(for: tab))
                                .font(.system(size: 16, weight: selection == tab ? .semibold : .medium))
                                .symbolVariant(selection == tab ? .fill : .none)
                            if tab == .inbox, unreadCount > 0 {
                                Text("\(min(unreadCount, 99))")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(3)
                                    .background(colors.error)
                                    .clipShape(Circle())
                                    .offset(x: 8, y: -6)
                            }
                        }
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
                .accessibilityLabel(String(format: L10n.tr("accessibility.tab", fallback: "%@ tab"), title(for: tab)))
                .accessibilityAddTraits(selection == tab ? .isSelected : [])
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
        case .home: return "rectangle.grid.2x2"
        case .projects: return "square.stack.3d.down.forward"
        case .focus: return "scope"
        case .work: return "checklist"
        case .inbox: return "bell"
        }
    }

    private func title(for tab: MainTab) -> String {
        switch tab {
        case .home: return L10n.tr("tabs.home", fallback: "Home")
        case .projects: return L10n.tr("tabs.projects", fallback: "Projects")
        case .focus: return L10n.tr("tabs.focus", fallback: "Focus")
        case .work: return L10n.tr("tabs.work", fallback: "Work")
        case .inbox: return L10n.tr("tabs.inbox", fallback: "Inbox")
        }
    }
}
