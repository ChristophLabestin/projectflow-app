import SwiftUI

#if os(iOS)
import UIKit
typealias PFKeyboardType = UIKeyboardType
#else
enum PFKeyboardType {
    case `default`
    case emailAddress
    case numberPad
}
#endif

@available(iOS 16.0, *)
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        var totalHeight: CGFloat = 0
        var totalWidth: CGFloat = 0
        var lineWidth: CGFloat = 0
        var lineHeight: CGFloat = 0

        for size in sizes {
            if lineWidth + size.width + spacing > (proposal.width ?? .infinity) {
                totalHeight += lineHeight + spacing
                lineWidth = size.width
                lineHeight = size.height
            } else {
                lineWidth += size.width + spacing
                lineHeight = max(lineHeight, size.height)
            }
            totalWidth = max(totalWidth, lineWidth)
        }

        return CGSize(width: totalWidth, height: totalHeight + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        var lineX = bounds.minX
        var lineY = bounds.minY
        var lineHeight: CGFloat = 0

        for index in subviews.indices {
            if lineX + sizes[index].width > bounds.maxX {
                lineX = bounds.minX
                lineY += lineHeight + spacing
                lineHeight = 0
            }

            subviews[index].place(
                at: CGPoint(x: lineX, y: lineY),
                proposal: ProposedViewSize(sizes[index])
            )

            lineX += sizes[index].width + spacing
            lineHeight = max(lineHeight, sizes[index].height)
        }
    }
}

struct PFCard<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        content
            .padding(PFSpacing.md)
            .background(colors.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
            .shadow(color: colors.shadowSm, radius: 2, x: 0, y: 1)
    }
}

struct PFSectionHeader: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    var subtitle: String? = nil

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.headline)
                .foregroundStyle(colors.textMain)
            
            if let subtitle = subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)
            }
        }
    }
}

struct PFPrimaryButton: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let isLoading: Bool
    let action: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    init(title: String, isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: PFSpacing.sm) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(colors.primaryText)
                }

                Text(title)
                    .font(.headline)
                    .foregroundStyle(colors.primaryText)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, PFSpacing.sm)
        }
        .background(colors.primary)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

struct PFSecondaryButton: View {
    let title: String
    var icon: String? = nil
    var isLoading: Bool = false
    let action: () -> Void

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: action) {
            HStack(spacing: PFSpacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(colors.primary)
                } else {
                    if let icon = icon {
                        Image(systemName: icon)
                    }
                    Text(title)
                }
            }
            .font(.headline)
            .foregroundStyle(colors.primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, PFSpacing.sm)
            .background(colors.primary.opacity(0.1))
            .cornerRadius(PFRadius.md)
        }
        .disabled(isLoading)
    }
}

struct MultiAssigneePicker: View {
    @Binding var selectedIds: [String]
    let profiles: [UserProfile]
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        NavigationStack {
            List {
                ForEach(profiles) { profile in
                    Button {
                        if selectedIds.contains(profile.id) {
                            selectedIds.removeAll { $0 == profile.id }
                        } else {
                            selectedIds.append(profile.id)
                        }
                    } label: {
                        HStack {
                            UserAvatar(name: profile.displayName, url: URL(string: profile.photoURL ?? ""), size: 32)
                            Text(profile.displayName)
                                .foregroundStyle(colors.textMain)
                            Spacer()
                            if selectedIds.contains(profile.id) {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(colors.primary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Select Assignees")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct MultiLabelPicker: View {
    @Binding var selectedIds: [String]
    let labels: [ProjectLabel]
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        NavigationStack {
            List {
                ForEach(labels) { label in
                    Button {
                        if selectedIds.contains(label.id) {
                            selectedIds.removeAll { $0 == label.id }
                        } else {
                            selectedIds.append(label.id)
                        }
                    } label: {
                        HStack {
                            Circle()
                                .fill(Color(hex: label.color))
                                .frame(width: 12, height: 12)
                            Text(label.title)
                                .foregroundStyle(colors.textMain)
                            Spacer()
                            if selectedIds.contains(label.id) {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(colors.primary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Select Labels")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct UserAvatar: View {
    let name: String?
    let url: URL?
    let size: CGFloat

    private var initials: String {
        guard let name, !name.isEmpty else { return "U" }

        let parts = name
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first }

        let value = String(parts)
        return value.isEmpty ? "U" : value.uppercased()
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.accentColor.opacity(0.15))
                .frame(width: size, height: size)

            if let url {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    Text(initials)
                        .font(.system(size: size * 0.35, weight: .semibold))
                        .foregroundStyle(Color.accentColor)
                }
                .frame(width: size, height: size)
                .clipShape(Circle())
            } else {
                Text(initials)
                    .font(.system(size: size * 0.35, weight: .semibold))
                    .foregroundStyle(Color.accentColor)
            }
        }
    }
}

struct PFInputField: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let placeholder: String
    @Binding var text: String
    let isSecure: Bool
    let keyboardType: PFKeyboardType
    let error: String?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    init(
        title: String,
        placeholder: String,
        text: Binding<String>,
        isSecure: Bool,
        keyboardType: PFKeyboardType,
        error: String? = nil
    ) {
        self.title = title
        self.placeholder = placeholder
        self._text = text
        self.isSecure = isSecure
        self.keyboardType = keyboardType
        self.error = error
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text(title)
                .font(.caption)
                .foregroundStyle(colors.textMuted)

            let fieldBackground = error == nil
                ? colors.surfacePaper
                : colors.error.opacity(colorScheme == .dark ? 0.2 : 0.12)

            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
#if os(iOS)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
#endif
                }
            }
#if os(iOS)
            .keyboardType(keyboardType)
#endif
            .padding(PFSpacing.sm)
            .background(fieldBackground)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
            .shadow(color: colors.shadowSm, radius: 3, x: 0, y: 1)

            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(colors.error)
            }
        }
    }
}

struct DashboardStat: Identifiable {
    let id = UUID()
    let title: String
    let value: String
    let detail: String
    let icon: String
    let tint: Color
}

struct DashboardStatCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let stat: DashboardStat

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: PFSpacing.xs) {
                        Text(stat.title.uppercased())
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(colors.textMuted)
                        Text(stat.value)
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                    }

                    Spacer()

                    Circle()
                        .fill(stat.tint.opacity(0.2))
                        .frame(width: 36, height: 36)
                        .overlay(
                            Image(systemName: stat.icon)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(stat.tint)
                        )
                }

                Text(stat.detail)
                    .font(.caption)
                    .foregroundStyle(colors.textSubtle)
            }
        }
    }
}

struct ChartData: Identifiable {
    let id = UUID()
    let label: String
    let value: Int
    let color: Color
}
