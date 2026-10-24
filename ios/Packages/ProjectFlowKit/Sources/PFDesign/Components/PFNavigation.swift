import SwiftUI
import Observation

// MARK: - Navigator (SwiftUI NavigationStack with ProjectFlow chrome)

@Observable
public final class PFNavigationModel<Route: Hashable> {
    public var path: [Route] = []

    public init() {}

    public func push(_ route: Route) {
        PFHaptics.soft()
        path.append(route)
    }

    public func pop() {
        guard !path.isEmpty else { return }
        _ = path.popLast()
    }

    public func popToRoot() {
        guard !path.isEmpty else { return }
        path.removeAll()
    }

    public func replace(with routes: [Route]) {
        path = routes
    }
}

/// Page navigation is native SwiftUI (`NavigationStack`): system push/pop transitions and the
/// edge/full-screen swipe back feel exactly like iOS. The system navigation bar is hidden — every
/// screen draws its own ProjectFlow header (`PFTopBar` or a feature header).
public struct PFNavigator<Route: Hashable, Root: View, Destination: View>: View {
    @Bindable var model: PFNavigationModel<Route>
    let root: Root
    let destination: (Route) -> Destination
    @State private var topInset: CGFloat = 60
    @Environment(\.pfSideRegionWidth) private var sideRegion

    /// Displays without a top status bar (iPhone Duo outer display: status bar and camera sit in the side
    /// region) report a top inset of 0; headers would touch the rounded screen edge. Top it up to a minimum.
    /// Every regular iPhone has a taller status bar, so this adds nothing there.
    private var extraTop: CGFloat { max(0, PFLayout.minTopMargin - topInset) }

    public init(model: PFNavigationModel<Route>, @ViewBuilder root: () -> Root, @ViewBuilder destination: @escaping (Route) -> Destination) {
        self.model = model
        self.root = root()
        self.destination = destination
    }

    public var body: some View {
        NavigationStack(path: $model.path) {
            root
                .safeAreaPadding(.top, extraTop)
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: Route.self) { route in
                    destination(route)
                        .pfSideControlsHost(side: sideRegion)
                        .safeAreaPadding(.top, extraTop)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .background(PFCanvas())
                        .toolbar(.hidden, for: .navigationBar)
                }
        }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { topInset = $0 }
    }
}

/// Floating header for pushed screens: glass back button + optional trailing buttons.
public struct PFTopBar<Trailing: View>: View {
    let title: String?
    let backLabel: String
    let onBack: (() -> Void)?
    let trailing: Trailing
    @Environment(\.pfSideRegionWidth) private var sideRegion

    public init(title: String? = nil, backLabel: String = "Back", onBack: (() -> Void)? = nil, @ViewBuilder trailing: () -> Trailing) {
        self.title = title
        self.backLabel = backLabel
        self.onBack = onBack
        self.trailing = trailing()
    }

    public var body: some View {
        if sideRegion > 0, let onBack {
            // iPhone Duo outer display: back and the trailing buttons stack in the side region (back lowest,
            // under the thumb); only the title stays up here.
            HStack(spacing: PFSpace.xs) {
                if let title { titleCapsule(title) }
                Spacer(minLength: 0)
            }
            .frame(minHeight: 44)
            .padding(.horizontal, PFSpace.page)
            .padding(.top, 4)
            .preference(key: PFSideControlsKey.self, value: PFSideControls(
                toolbar: AnyView(VStack(spacing: 10) { trailing }),
                back: AnyView(PFIconButton("chevron.left", label: backLabel, action: onBack))
            ))
        } else {
            bar
        }
    }

    private func titleCapsule(_ title: String) -> some View {
        Text(title).pfText(.section).foregroundStyle(PFColor.textMain).lineLimit(1)
            .padding(.horizontal, 14).frame(minHeight: 40)
            .pfGlass(in: .capsule, interactive: false)
    }

    private var bar: some View {
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

    let axis: Axis
    let accessory: PFDockAccessory?
    let focus: PFDockFocus?

    private static let searchId = "__search"
    private static let accessoryId = "__accessory"
    /// Outer width of the vertical rail (54 pt items + 4 pt frost padding each side). The rail is its own,
    /// lighter variant (iPhone Duo): shorter items, regular icons, medium labels — the iPhone dock is unchanged.
    public static let railWidth: CGFloat = 62

    /// `axis: .vertical` turns the dock into a side rail (iPhone Duo opened); `accessory` adds one extra
    /// toggle after search (the rail's list-column switch).
    public init(items: [PFDockItem], selection: Binding<String>, searchLabel: String, isSearchSelected: Bool,
                axis: Axis = .horizontal, accessory: PFDockAccessory? = nil, focus: PFDockFocus? = nil,
                onSearch: @escaping () -> Void, onReselect: @escaping (String) -> Void) {
        self.axis = axis
        self.focus = focus
        self.accessory = accessory
        self.items = items
        self._selection = selection
        self.searchLabel = searchLabel
        self.isSearchSelected = isSearchSelected
        self.onSearch = onSearch
        self.onReselect = onReselect
    }

    private var activeId: String { isSearchSelected ? Self.searchId : selection }

    public var body: some View {
        let vertical = axis == .vertical
        let layout = vertical ? AnyLayout(VStackLayout(spacing: 2)) : AnyLayout(HStackLayout(spacing: 2))
        return layout {
            if vertical, let focus {
                focusItem(focus)
                Capsule()
                    .fill(PFColor.hairlineStrong)
                    .frame(width: 28, height: 1)
                    .padding(.vertical, 3)
                    .accessibilityHidden(true)
            }
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
                .frame(width: vertical ? 28 : 1, height: vertical ? 1 : 28)
                .padding(vertical ? .vertical : .horizontal, 3)
                .accessibilityHidden(true)
            itemButton(id: Self.searchId, title: searchLabel, systemImage: "magnifyingglass", badge: 0, compact: true) {
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { onSearch() }
            }
            if let accessory {
                itemButton(id: Self.accessoryId, title: accessory.title, systemImage: accessory.systemImage, badge: 0,
                           compact: true, isOn: accessory.isOn) {
                    withAnimation(PFMotion.respecting(PFMotion.snappy)) { accessory.action() }
                }
            }
        }
        .padding(vertical ? 4 : 6)
        .pfFrost(in: RoundedRectangle(cornerRadius: vertical ? 22 : 26, style: .continuous))
        .padding(.horizontal, vertical ? 0 : PFSpace.m)
        .animation(reduceMotion ? .easeInOut(duration: 0.15) : PFMotion.snappy, value: activeId)
    }

    private func itemButton(id: String, title: String, systemImage: String, badge: Int, compact: Bool = false,
                            isOn: Bool = false, action: @escaping () -> Void) -> some View {
        let selected = id == activeId
        let vertical = axis == .vertical
        return Button {
            PFHaptics.selection()
            action()
        } label: {
            VStack(spacing: vertical ? 2 : 3) {
                Image(systemName: systemImage)
                    .font(.system(size: vertical ? 16 : 18, weight: vertical ? (selected ? .medium : .regular) : (selected ? .semibold : .regular)))
                    .symbolVariant(selected && id != Self.searchId ? .fill : .none)
                    .frame(width: 28, height: vertical ? 22 : 24)
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
                    .pfText(vertical ? .tabRail : .tab)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(selected || isOn ? PFColor.textMain : PFColor.textMuted)
            .frame(width: vertical ? 54 : nil, height: vertical ? 48 : nil)
            .frame(maxWidth: vertical ? nil : (compact ? 64 : .infinity), minHeight: vertical ? nil : 54)
            .background {
                if selected {
                    RoundedRectangle(cornerRadius: vertical ? 17 : 19, style: .continuous)
                        .fill(PFColor.raised)
                        .overlay(alignment: .top) {
                            Capsule()
                                .fill(PFColor.primary)
                                .frame(width: vertical ? 14 : 18, height: vertical ? 2.5 : 3)
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
        .accessibilityAddTraits(selected || isOn ? [.isButton, .isSelected] : .isButton)
    }
}

/// Extra toggle at the end of the dock (used by the side rail for the list column).
public struct PFDockAccessory {
    let title: String
    let systemImage: String
    let isOn: Bool
    let action: () -> Void

    public init(title: String, systemImage: String, isOn: Bool, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.isOn = isOn
        self.action = action
    }
}

/// The running focus as the rail's first item (side rail only): a dock-styled "Fokus" entry with a live
/// pulse; tap opens the focus room, completing is a VoiceOver action (and lives in the room itself).
public struct PFDockFocus {
    let label: String
    let accessibilityLabel: String
    let completeLabel: String
    let isBlocked: Bool
    let onOpen: () -> Void
    let onComplete: () -> Void

    public init(label: String, accessibilityLabel: String, completeLabel: String, isBlocked: Bool,
                onOpen: @escaping () -> Void, onComplete: @escaping () -> Void) {
        self.label = label
        self.accessibilityLabel = accessibilityLabel
        self.completeLabel = completeLabel
        self.isBlocked = isBlocked
        self.onOpen = onOpen
        self.onComplete = onComplete
    }
}

extension PFDock {
    func focusItem(_ focus: PFDockFocus) -> some View {
        let tint = focus.isBlocked ? PFColor.danger : PFColor.primary
        return Button {
            PFHaptics.selection()
            focus.onOpen()
        } label: {
            VStack(spacing: 3) {
                Image(systemName: "scope")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: 28, height: 24)
                    .overlay(alignment: .topTrailing) {
                        PFPulseDot(color: tint)
                            .scaleEffect(0.8)
                            .offset(x: 3, y: -1)
                    }
                Text(focus.label)
                    .pfText(.tab)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .foregroundStyle(PFColor.textMain)
            }
            .frame(width: 58, height: 56)
            .contentShape(.rect(cornerRadius: 19))
        }
        .buttonStyle(PFDockPressStyle())
        .accessibilityLabel(focus.accessibilityLabel)
        .accessibilityAction(named: focus.completeLabel) { focus.onComplete() }
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
