import SwiftUI

// MARK: - Wide layouts (iPhone Duo inner display)

public extension EnvironmentValues {
    /// True when the shell lays out for regular width (iPhone Duo opened). Set by the app shell from
    /// `horizontalSizeClass`; every regular iPhone, the Duo's outer display and Split View stay false.
    @Entry var pfIsWide = false
}

public enum PFLayout {
    /// Widest a single reading column grows; wider screens centre it.
    public static let readableWidth: CGFloat = 720
    /// Narrowest a board lane gets before the board shows fewer lanes.
    public static let minLaneWidth: CGFloat = 260
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
