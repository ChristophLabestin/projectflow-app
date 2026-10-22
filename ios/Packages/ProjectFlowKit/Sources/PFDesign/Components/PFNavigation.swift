import SwiftUI
import Observation

// MARK: - Navigator (custom stack, replaces NavigationStack)

@Observable
public final class PFNavigationModel<Route: Hashable> {
    public var path: [Route] = []

    public init() {}

    public func push(_ route: Route) {
        PFHaptics.soft()
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { path.append(route) }
    }

    public func pop() {
        guard !path.isEmpty else { return }
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { _ = path.popLast() }
    }

    public func popToRoot() {
        guard !path.isEmpty else { return }
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { path.removeAll() }
    }

    public func replace(with routes: [Route]) {
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { path = routes }
    }

    /// Removes the top screen without animation (used after an interactive edge-swipe finished it).
    func popWithoutAnimation() {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) { _ = path.popLast() }
    }
}

/// Stack navigator with its own transitions: the new screen slides in from the trailing edge while
/// the screen below drifts left and dims (parallax). Edge-swipe from the leading edge pops
/// interactively; VoiceOver's escape gesture pops too. Screens below stay alive (state preserved).
public struct PFNavigator<Route: Hashable, Root: View, Destination: View>: View {
    @Bindable var model: PFNavigationModel<Route>
    let root: Root
    let destination: (Route) -> Destination
    @State private var drag: CGFloat = 0
    @State private var width: CGFloat = 390

    public init(model: PFNavigationModel<Route>, @ViewBuilder root: () -> Root, @ViewBuilder destination: @escaping (Route) -> Destination) {
        self.model = model
        self.root = root()
        self.destination = destination
    }

    public var body: some View {
        let depth = model.path.count
        ZStack {
            layer(level: 0, depth: depth) { root }
            ForEach(Array(model.path.enumerated()), id: \.offset) { index, route in
                layer(level: index + 1, depth: depth) {
                    destination(route)
                        .background(PFCanvas())
                }
                .transition(.move(edge: .trailing))
                .zIndex(Double(index + 1))
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = max($0, 1) }
        .overlay(alignment: .leading) {
            if depth > 0 {
                Color.clear
                    .frame(width: 22)
                    .contentShape(.rect)
                    .gesture(edgeSwipe)
                    .accessibilityHidden(true)
            }
        }
    }

    private func layer<V: View>(level: Int, depth: Int, @ViewBuilder content: () -> V) -> some View {
        let isTop = level == depth
        let isBelowTop = level == depth - 1
        let progress = min(max(drag / width, 0), 1)
        return content()
            .offset(x: isTop && level > 0 ? drag : (isBelowTop ? -width * 0.28 * (1 - progress) : 0))
            .overlay {
                if isBelowTop {
                    Color.black.opacity(0.12 * (1 - progress)).ignoresSafeArea().allowsHitTesting(false)
                }
            }
            .shadow(color: .black.opacity(isTop && level > 0 ? 0.12 : 0), radius: 16, x: -4)
            .opacity(level < depth - 1 ? 0 : 1)
            .allowsHitTesting(isTop)
            .accessibilityHidden(!isTop)
            .accessibilityAction(.escape) { if isTop && level > 0 { model.pop() } }
    }

    private var edgeSwipe: some Gesture {
        DragGesture(minimumDistance: 8, coordinateSpace: .global)
            .onChanged { value in drag = max(value.translation.width, 0) }
            .onEnded { value in
                let shouldPop = value.translation.width > width * 0.33 || value.predictedEndTranslation.width > width * 0.6
                if shouldPop {
                    withAnimation(PFMotion.snappy) { drag = width } completion: {
                        model.popWithoutAnimation()
                        drag = 0
                    }
                } else {
                    withAnimation(PFMotion.snappy) { drag = 0 }
                }
            }
    }
}

/// Floating header for pushed screens: glass back button + optional trailing buttons.
public struct PFTopBar<Trailing: View>: View {
    let title: String?
    let backLabel: String
    let onBack: (() -> Void)?
    let trailing: Trailing

    public init(title: String? = nil, backLabel: String = "Back", onBack: (() -> Void)? = nil, @ViewBuilder trailing: () -> Trailing) {
        self.title = title
        self.backLabel = backLabel
        self.onBack = onBack
        self.trailing = trailing()
    }

    public var body: some View {
        HStack(spacing: PFSpace.xs) {
            if let onBack {
                PFIconButton("chevron.left", label: backLabel, action: onBack)
            }
            if let title {
                Text(title).pfText(.section).foregroundStyle(PFColor.textMain).lineLimit(1)
                    .padding(.horizontal, 14).frame(minHeight: 40)
                    .pfGlass(in: .capsule, interactive: false)
            }
            Spacer(minLength: 0)
            HStack(spacing: PFSpace.xs) { trailing }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, 4)
    }
}

public extension PFTopBar where Trailing == EmptyView {
    init(title: String? = nil, backLabel: String = "Back", onBack: (() -> Void)? = nil) {
        self.init(title: title, backLabel: backLabel, onBack: onBack) { EmptyView() }
    }
}

// MARK: - Dock (custom tab bar)

public struct PFDockItem: Identifiable, Hashable {
    public let id: String
    public let title: String
    public let systemImage: String
    public let badge: Int

    public init(id: String, title: String, systemImage: String, badge: Int = 0) {
        self.id = id
        self.title = title
        self.systemImage = systemImage
        self.badge = badge
    }
}

/// ProjectFlow's own navigation bar (not a system tab bar): a frosted card floating above the
/// content, items with heavy Jakarta labels and the web sidebar's "glider" — a raised pill plus a
/// glowing primary bar that slide to the active item. Search lives in the same bar, set apart by a hairline.
public struct PFDock: View {
    let items: [PFDockItem]
    @Binding var selection: String
    let searchLabel: String
    let isSearchSelected: Bool
    let onSearch: () -> Void
    let onReselect: (String) -> Void
    @Namespace private var glider
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let searchId = "__search"

    public init(items: [PFDockItem], selection: Binding<String>, searchLabel: String, isSearchSelected: Bool,
                onSearch: @escaping () -> Void, onReselect: @escaping (String) -> Void) {
        self.items = items
        self._selection = selection
        self.searchLabel = searchLabel
        self.isSearchSelected = isSearchSelected
        self.onSearch = onSearch
        self.onReselect = onReselect
    }

    private var activeId: String { isSearchSelected ? Self.searchId : selection }

    public var body: some View {
        HStack(spacing: 2) {
            ForEach(items) { item in
                itemButton(id: item.id, title: item.title, systemImage: item.systemImage, badge: item.badge) {
                    if item.id == selection && !isSearchSelected {
                        onReselect(item.id)
                    } else {
                        withAnimation(PFMotion.respecting(PFMotion.snappy)) { selection = item.id }
                    }
                }
            }
            Capsule()
                .fill(PFColor.hairlineStrong)
                .frame(width: 1, height: 28)
                .padding(.horizontal, 3)
                .accessibilityHidden(true)
            itemButton(id: Self.searchId, title: searchLabel, systemImage: "magnifyingglass", badge: 0, compact: true) {
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { onSearch() }
            }
        }
        .padding(6)
        .pfFrost(in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .padding(.horizontal, PFSpace.m)
        .animation(reduceMotion ? .easeInOut(duration: 0.15) : PFMotion.snappy, value: activeId)
    }

    private func itemButton(id: String, title: String, systemImage: String, badge: Int, compact: Bool = false,
                            action: @escaping () -> Void) -> some View {
        let selected = id == activeId
        return Button {
            PFHaptics.selection()
            action()
        } label: {
            VStack(spacing: 3) {
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: selected ? .semibold : .regular))
                    .symbolVariant(selected && id != Self.searchId ? .fill : .none)
                    .frame(width: 28, height: 24)
                    .overlay(alignment: .topTrailing) {
                        if badge > 0 {
                            Text(badge > 99 ? "99+" : "\(badge)")
                                .font(.system(size: 10, weight: .heavy)).monospacedDigit()
                                .foregroundStyle(Color.white)
                                .padding(.horizontal, 4)
                                .frame(minWidth: 16, minHeight: 16)
                                .background(PFColor.danger, in: .capsule)
                                .overlay { Capsule().stroke(PFColor.card, lineWidth: 2) }
                                .offset(x: 10, y: -5)
                        }
                    }
                Text(title)
                    .pfText(.tab)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(selected ? PFColor.textMain : PFColor.textMuted)
            .frame(maxWidth: compact ? 64 : .infinity, minHeight: 54)
            .background {
                if selected {
                    RoundedRectangle(cornerRadius: 19, style: .continuous)
                        .fill(PFColor.raised)
                        .overlay(alignment: .top) {
                            Capsule()
                                .fill(PFColor.primary)
                                .frame(width: 18, height: 3)
                                .shadow(color: PFColor.primary.opacity(0.45), radius: 5, y: 1)
                                .offset(y: -1)
                        }
                        .matchedGeometryEffect(id: "pf-dock-glider", in: glider)
                }
            }
            .contentShape(.rect(cornerRadius: 19))
        }
        .buttonStyle(PFDockPressStyle())
        .accessibilityLabel(badge > 0 ? "\(title), \(badge)" : title)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}

struct PFDockPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1)
            .animation(PFMotion.fast, value: configuration.isPressed)
    }
}

// MARK: - Focus bar (custom "now playing" accessory)

/// Shows the running focus above the dock like a mini player. Tap opens the focus room.
public struct PFFocusBar: View {
    let title: String
    let subtitle: String
    let completeLabel: String
    let isBlocked: Bool
    let onOpen: () -> Void
    let onComplete: () -> Void

    public init(title: String, subtitle: String, completeLabel: String, isBlocked: Bool = false,
                onOpen: @escaping () -> Void, onComplete: @escaping () -> Void) {
        self.title = title
        self.subtitle = subtitle
        self.completeLabel = completeLabel
        self.isBlocked = isBlocked
        self.onOpen = onOpen
        self.onComplete = onComplete
    }

    public var body: some View {
        HStack(spacing: 12) {
            Button(action: onOpen) {
                HStack(spacing: 12) {
                    PFPulseDot(color: isBlocked ? PFColor.danger : PFColor.primary)
                    Text(title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                    Spacer(minLength: 4)
                    Text(subtitle).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                }
                .padding(.leading, 18)
                .frame(maxHeight: .infinity)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            Button {
                PFHaptics.success()
                onComplete()
            } label: {
                Image(systemName: "checkmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(PFColor.onPrimary)
                    .frame(width: 40, height: 40)
                    .background(PFColor.primary, in: .circle)
            }
            .buttonStyle(.pfPressable)
            .accessibilityLabel(completeLabel)
            .padding(.trailing, 7)
        }
        .frame(height: 54)
        .pfGlass(in: .capsule)
        .padding(.horizontal, PFSpace.m)
        .accessibilityElement(children: .contain)
    }
}
