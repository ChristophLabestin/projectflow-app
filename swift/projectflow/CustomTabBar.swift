import SwiftUI
import Combine

// MARK: - Tab bar scroll state
//
// Shared between the scrollable tab roots and the floating tab bar so the bar can
// shrink while scrolling down and grow back when scrolling up.

@MainActor
final class TabBarScrollState: ObservableObject {
    @Published var isCompact = false
}

private struct TabBarScrollShrinkModifier: ViewModifier {
    @EnvironmentObject private var state: TabBarScrollState

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.onScrollGeometryChange(for: Double.self) { geo in
                geo.contentOffset.y + geo.contentInsets.top
            } action: { oldValue, newValue in
                let delta = newValue - oldValue
                guard abs(delta) > 4 else { return }
                if delta > 0 && newValue > 36 {
                    if !state.isCompact {
                        withAnimation(.spring(response: 0.34, dampingFraction: 0.82)) { state.isCompact = true }
                    }
                } else if delta < 0 || newValue < 36 {
                    if state.isCompact {
                        withAnimation(.spring(response: 0.34, dampingFraction: 0.82)) { state.isCompact = false }
                    }
                }
            }
        } else {
            content
        }
    }
}

extension View {
    /// Reports scroll direction to the floating tab bar so it can shrink/grow.
    func tabBarScrollShrink() -> some View { modifier(TabBarScrollShrinkModifier()) }
}

// MARK: - CustomTabBar — Companion V2 (icons-only, pill-shaped, shrink-on-scroll)

struct CustomTabBar: View {
    @Binding var selection: MainTab
    var unreadCount: Int = 0
    @ObservedObject var scrollState: TabBarScrollState
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private let tabs: [MainTab] = [.home, .projects, .focus, .work, .inbox]

    private var compact: Bool { scrollState.isCompact }
    private var itemHeight: CGFloat { compact ? 40 : 50 }
    private var iconSize: CGFloat { compact ? 16 : 20 }
    private var horizontalMargin: CGFloat { compact ? 64 : 22 }

    var body: some View {
        HStack(spacing: 4) {
            ForEach(tabs, id: \.self) { tab in
                tabButton(tab)
            }
        }
        .padding(.horizontal, 5)
        .padding(.vertical, 5)
        .background(
            Capsule(style: .continuous)
                .fill(colors.surfaceCard)
                .overlay(Capsule(style: .continuous).stroke(colors.surfaceBorder, lineWidth: 1))
        )
        .clipShape(Capsule(style: .continuous))
        .pfElevation(.raised)
        .padding(.horizontal, horizontalMargin)
        .padding(.bottom, 4)
        .animation(.spring(response: 0.34, dampingFraction: 0.82), value: compact)
    }

    private func tabButton(_ tab: MainTab) -> some View {
        let isSelected = selection == tab
        return Button {
            withAnimation(.spring(response: 0.32, dampingFraction: 0.78)) { selection = tab }
        } label: {
            ZStack {
                if isSelected {
                    Capsule(style: .continuous)
                        .fill(colors.primary)
                }
                Image(systemName: iconName(for: tab))
                    .font(.system(size: iconSize, weight: isSelected ? .semibold : .regular))
                    .symbolVariant(isSelected ? .fill : .none)
                    .foregroundStyle(isSelected ? colors.primaryText : colors.textMuted)
                    .overlay(alignment: .topTrailing) {
                        if tab == .inbox, unreadCount > 0 {
                            Circle()
                                .fill(colors.error)
                                .frame(width: 7, height: 7)
                                .offset(x: 6, y: -4)
                        }
                    }
            }
            .frame(maxWidth: .infinity)
            .frame(height: itemHeight)
            .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(String(format: L10n.tr("accessibility.tab", fallback: "%@ tab"), title(for: tab)))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func iconName(for tab: MainTab) -> String {
        switch tab {
        case .home: return "house"
        case .projects: return "square.stack.3d.up"
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
