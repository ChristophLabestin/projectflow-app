import SwiftUI

// Controls of the Team package: role/group colour swatches and the allow/deny/inherit permission control.

/// The web's role colour presets (`DEFAULT_ROLE_COLORS`); stored as hex strings so web and iOS agree.
public enum TeamSwatch {
    public static let presets = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#78716c"]

    /// Colour for a stored `#rrggbb` value (neutral when unreadable).
    public static func color(_ hex: String?) -> Color {
        let cleaned = (hex ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "# "))
        guard cleaned.count == 6, let value = UInt32(cleaned, radix: 16) else { return PFColor.textSubtle }
        return Color(uiColor: UIColor(hex: value))
    }
}

/// Row of colour dots to pick one preset.
public struct TeamSwatchPicker: View {
    @Binding var selection: String
    let label: String

    public init(_ label: String, selection: Binding<String>) {
        self.label = label
        self._selection = selection
    }

    public var body: some View {
        HStack(spacing: PFSpace.xs) {
            ForEach(TeamSwatch.presets, id: \.self) { hex in
                Button {
                    PFHaptics.selection()
                    selection = hex
                } label: {
                    Circle().fill(TeamSwatch.color(hex)).frame(width: 28, height: 28)
                        .overlay {
                            if selection == hex {
                                Image(systemName: "checkmark").font(.system(size: 12, weight: .heavy)).foregroundStyle(PFColor.card)
                            }
                        }
                        .frame(width: 36, height: 36)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(label)
                .accessibilityAddTraits(selection == hex ? .isSelected : [])
            }
        }
    }
}

/// Three-state permission control: allow, inherit (neither) or deny — Discord-style, like the web role editor.
public struct TeamTriState: View {
    public enum Value: Sendable { case allow, inherit, deny }

    let value: Value
    let title: String
    let subtitle: String?
    let onSelect: (Value) -> Void
    let allowLabel: String
    let denyLabel: String
    let inheritLabel: String

    public init(title: String, subtitle: String? = nil, value: Value, allowLabel: String, inheritLabel: String, denyLabel: String,
                onSelect: @escaping (Value) -> Void) {
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.allowLabel = allowLabel
        self.inheritLabel = inheritLabel
        self.denyLabel = denyLabel
        self.onSelect = onSelect
    }

    public var body: some View {
        HStack(spacing: PFSpace.s) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).pfText(.metaStrong).foregroundStyle(PFColor.textMain).multilineTextAlignment(.leading)
                if let subtitle {
                    Text(subtitle).pfText(.caption).foregroundStyle(PFColor.textMuted).multilineTextAlignment(.leading)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 0) {
                segment("xmark", .deny, label: denyLabel, tint: PFColor.danger)
                segment("minus", .inherit, label: inheritLabel, tint: PFColor.textMuted)
                segment("checkmark", .allow, label: allowLabel, tint: PFColor.success)
            }
            .padding(2)
            .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
        }
        .padding(.horizontal, PFSpace.m)
        .padding(.vertical, 10)
        .frame(minHeight: 52)
        .accessibilityElement(children: .contain)
    }

    private func segment(_ symbol: String, _ target: Value, label: String, tint: Color) -> some View {
        let selected = value == target
        return Button {
            PFHaptics.selection()
            onSelect(target)
        } label: {
            Image(systemName: symbol).font(.system(size: 12, weight: .heavy))
                .foregroundStyle(selected ? tint : PFColor.textSubtle)
                .frame(width: 34, height: 30)
                .background(selected ? PFColor.card : Color.clear, in: .rect(cornerRadius: PFRadius.control - 2, style: .continuous))
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("\(title): \(label)"))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
