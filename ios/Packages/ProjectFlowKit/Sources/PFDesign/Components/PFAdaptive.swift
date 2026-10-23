import SwiftUI

// MARK: - Wide layouts (iPhone Duo inner display)

public extension EnvironmentValues {
    /// True when the shell lays out for regular width (iPhone Duo opened). Set by the app shell from
    /// `horizontalSizeClass`; every regular iPhone, the Duo's outer display and Split View stay false.
    @Entry var pfIsWide = false
    /// Height of the shell's floating bottom chrome (focus bar, dock). `NavigationStack` destinations don't
    /// get the shell's `safeAreaInset`, so screens with their own floating action add this themselves.
    @Entry var pfBottomChromeHeight: CGFloat = 0
    /// Width of the system side region on the trailing edge (iPhone Duo outer display: status bar, Dynamic
    /// Island, camera), 0 elsewhere. Set by the app shell; drives the side rail and the side control column.
    @Entry var pfSideRegionWidth: CGFloat = 0
}

public enum PFLayout {
    /// Widest a single reading column grows; wider screens centre it.
    public static let readableWidth: CGFloat = 720
    /// Narrowest a board lane gets before the board shows fewer lanes.
    public static let minLaneWidth: CGFloat = 260
    /// How far a page's full-width bottom action (task "Mark as done"/"Reopen") sits below the regular float
    /// position, closer to the home indicator.
    public static let pageActionDrop: CGFloat = 12
    /// Smallest top safe area screens get (status-bar-less displays such as the iPhone Duo outer display).
    public static let minTopMargin: CGFloat = 14

    /// Side region present? Compact width plus a trailing inset wide enough for a rail (plain iPhones: 0).
    public static func sideRegionWidth(trailingInset: CGFloat, isCompact: Bool) -> CGFloat {
        isCompact && trailingInset >= 60 ? trailingInset : 0
    }

    /// Room a title-less `PFTopBar` takes above a page's content: none when its buttons moved to the side region.
    public static func topBarClearance(sideRegion: CGFloat) -> CGFloat {
        sideRegion > 0 ? 4 : 48
    }

    /// Gap that puts a rail-wide column in the side region with equal space to the screen edge (right,
    /// bottom) and to the content's page gutter (left), so it sits concentric in the rounded corner.
    public static func sideGap(_ side: CGFloat) -> CGFloat {
        ((side + PFSpace.page - PFDock.railWidth) / 2).rounded()
    }
}

// MARK: - Side control column (iPhone Duo outer display)

/// Controls a page hands to the side region, stacked top to bottom: toolbar buttons, the page's primary
/// action, back/close (always lowest). `PFTopBar` contributes toolbar + back, `pfSideAction` the action.
struct PFSideControlsKey: PreferenceKey {
    static let defaultValue = PFSideControls()
    static func reduce(value: inout PFSideControls, nextValue: () -> PFSideControls) {
        let next = nextValue()
        value.toolbar = value.toolbar ?? next.toolbar
        value.action = value.action ?? next.action
        value.back = value.back ?? next.back
    }
}

struct PFSideControls {
    var toolbar: AnyView?
    var action: AnyView?
    var back: AnyView?
}

/// The stacked column, placed bottom-trailing in the side region. Screens outside a `PFNavigator`
/// (e.g. the welcome onboarding) place their own controls with it.
public struct PFSideColumn<Content: View>: View {
    let side: CGFloat
    let content: Content

    public init(side: CGFloat, @ViewBuilder content: () -> Content) {
        self.side = side
        self.content = content()
    }

    public var body: some View {
        let gap = PFLayout.sideGap(side)
        VStack(spacing: 10) { content }
            .frame(width: PFDock.railWidth)
            .padding(.trailing, gap)
            // The 44 pt buttons sit centred in the rail-wide column; lift them by the same side margin so the
            // lowest one keeps equal distance to the bottom and the right screen edge.
            .padding(.bottom, gap + (PFDock.railWidth - 44) / 2)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            // Container only: with the keyboard up the column rides above it.
            .ignoresSafeArea(.container)
    }
}

extension View {
    /// Shows the side controls a page's `PFTopBar` handed over (pushed pages only).
    func pfSideControlsHost(side: CGFloat) -> some View {
        overlayPreferenceValue(PFSideControlsKey.self) { controls in
            if side > 0, controls.back != nil || controls.action != nil {
                PFSideColumn(side: side) {
                    controls.toolbar
                    controls.action
                    controls.back
                }
            }
        }
    }
}

public extension View {
    /// The page's primary action as a round button in the side control column (iPhone Duo outer display),
    /// right above back. Pass nil when there is none or the page shows it in place (e.g. on iPhone).
    func pfSideAction(_ action: AnyView?) -> some View {
        // Merge, don't replace: the page's PFTopBar below already set toolbar and back.
        transformPreference(PFSideControlsKey.self) { $0.action = action }
    }
}

public extension View {
    /// Caps content at a readable width and centres it. A no-op on every iPhone screen narrower than the cap.
    func pfReadableWidth(_ maxWidth: CGFloat = PFLayout.readableWidth) -> some View {
        frame(maxWidth: maxWidth).frame(maxWidth: .infinity)
    }
}

/// List and detail side by side. The leading column takes ~40 % (320–420 pt); when the device is
/// partially folded (iOS 27.1 `.division` reserved region) the column boundary sits on the fold instead.
/// Hiding the leading column slides it out but keeps it alive, so its state survives the toggle.
public struct PFSplitColumns<Leading: View, Trailing: View>: View {
    let isLeadingHidden: Bool
    let leading: Leading
    let trailing: Trailing

    public init(isLeadingHidden: Bool = false, @ViewBuilder leading: () -> Leading, @ViewBuilder trailing: () -> Trailing) {
        self.isLeadingHidden = isLeadingHidden
        self.leading = leading()
        self.trailing = trailing()
    }

    public var body: some View {
        GeometryReader { proxy in
            let split = Self.split(proxy)
            HStack(spacing: 0) {
                HStack(spacing: 0) {
                    leading
                        .frame(width: split.leading)
                    Rectangle()
                        .fill(split.gap > 1 ? Color.clear : PFColor.hairline)
                        .frame(width: split.gap)
                        .accessibilityHidden(true)
                }
                .frame(width: isLeadingHidden ? 0 : split.leading + split.gap, alignment: .trailing)
                .clipped()
                .allowsHitTesting(!isLeadingHidden)
                .accessibilityHidden(isLeadingHidden)
                trailing
                    .frame(maxWidth: .infinity)
            }
        }
    }

    /// Leading column width and the gap after it (hairline, or the fold with its margins).
    static func split(_ proxy: GeometryProxy) -> (leading: CGFloat, gap: CGFloat) {
        let width = proxy.size.width
        if #available(iOS 27.1, *),
           let fold = proxy.reservedRegions(kind: .division).first(where: { $0.isActive && $0.frame.height > $0.frame.width }) {
            let start = fold.frame.minX - fold.margins.leading
            let end = fold.frame.maxX + fold.margins.trailing
            if start > 240, end < width - 240 { return (start, end - start) }
        }
        return (min(max((width * 0.4).rounded(), 320), 420), 1)
    }
}

// MARK: - Root tab actions (iPhone Duo outer display)

/// A root tab's header actions. Plain iPhones show them in place (laid out horizontally); with a side region
/// they move into the shell's side rail, stacked above the tabs.
public struct PFRootActions<Content: View>: View {
    @Environment(\.pfSideRegionWidth) private var sideRegion
    let content: Content

    public init(@ViewBuilder content: () -> Content) { self.content = content() }

    public var body: some View {
        if sideRegion > 0 {
            Color.clear.frame(width: 0, height: 0)
                .preference(key: PFSideControlsKey.self,
                            value: PFSideControls(toolbar: AnyView(VStack(spacing: 10) { content })))
        } else {
            HStack(spacing: PFSpace.xs) { content }
        }
    }
}

public extension View {
    /// Drops side controls coming from a hidden subtree (inactive tabs stay alive underneath).
    func pfHidesSideControls(_ hidden: Bool) -> some View {
        transformPreference(PFSideControlsKey.self) { if hidden { $0 = PFSideControls() } }
    }

    /// Reads the visible root tab's actions (`PFRootActions`) to stack them in the side rail.
    func pfSideToolbar<Overlay: View>(alignment: Alignment = .center,
                                      @ViewBuilder _ overlay: @escaping (AnyView?) -> Overlay) -> some View {
        overlayPreferenceValue(PFSideControlsKey.self, alignment: alignment) { overlay($0.toolbar) }
    }
}
