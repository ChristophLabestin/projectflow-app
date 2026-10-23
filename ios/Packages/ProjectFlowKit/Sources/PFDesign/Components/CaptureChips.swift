import SwiftUI

/// Chip of the capture composer's bar above the keyboard: icon or custom leading view, value text,
/// solid when a value is set, outlined while its panel is open.
public struct CaptureChip: View {
    let title: String
    let leading: AnyView?
    let isSet: Bool
    let isActive: Bool
    let action: () -> Void

    public init(_ title: String, systemImage: String, isSet: Bool = false, isActive: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.leading = AnyView(Image(systemName: systemImage).font(.system(size: 13, weight: .semibold)))
        self.isSet = isSet
        self.isActive = isActive
        self.action = action
    }

    public init<Leading: View>(_ title: String, isSet: Bool = false, isActive: Bool = false, action: @escaping () -> Void,
                               @ViewBuilder leading: () -> Leading) {
        self.title = title
        self.leading = AnyView(leading())
        self.isSet = isSet
        self.isActive = isActive
        self.action = action
    }

    public var body: some View {
        Button {
            PFHaptics.selection()
            action()
        } label: {
            HStack(spacing: 6) {
                leading
                Text(title).pfText(.buttonSmall).lineLimit(1)
            }
            .padding(.horizontal, 13)
            .frame(minHeight: 38)
            .foregroundStyle(isSet ? PFColor.onPrimary : PFColor.textMain)
            .background(isSet ? PFColor.primary : PFColor.raised, in: .capsule)
            .overlay { Capsule().strokeBorder(PFColor.textMain.opacity(isActive ? 0.9 : 0), lineWidth: 1.5) }
            .contentShape(.capsule)
            .animation(PFMotion.fast, value: isActive)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }
}

/// Inline panel that opens above the chip bar (date strip, project list, priority, assignee).
public struct CapturePanel<Content: View>: View {
    let title: String
    let clearTitle: String?
    let onClear: (() -> Void)?
    let content: Content

    public init(_ title: String, clearTitle: String? = nil, onClear: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.clearTitle = clearTitle
        self.onClear = onClear
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            HStack {
                PFEyebrow(title)
                Spacer()
                if let clearTitle, let onClear {
                    Button(action: onClear) {
                        Text(clearTitle).pfText(.buttonSmall).foregroundStyle(PFColor.textMuted)
                            .padding(.horizontal, 10).frame(minHeight: 28)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
            .padding(.horizontal, PFSpace.page)
            content
        }
        .padding(.vertical, PFSpace.s)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PFColor.raisedSoft, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
        .padding(.horizontal, PFSpace.xs)
        .transition(.opacity.combined(with: .scale(scale: 0.97, anchor: .bottom)))
    }
}
