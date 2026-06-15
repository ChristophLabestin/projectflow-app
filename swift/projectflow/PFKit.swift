import SwiftUI

// MARK: - PFKit — Companion V2 reusable components
//
// A small kit of building blocks shared by every V2 screen. Builds on the
// existing tokens (PFColors / PFSpacing / PFRadius / PFFont) and the existing
// PFCard / PFPrimaryButton / UserAvatar — it does not duplicate them.

// MARK: Semantic color + label mapping

enum PFSemantic {
    /// Tint for a status string coming from data (project/task/initiative).
    static func statusTint(_ raw: String, colors: PFColors) -> Color {
        switch raw.lowercased().replacingOccurrences(of: " ", with: "") {
        case "active": return colors.primary
        case "inprogress": return colors.warning
        case "blocked": return colors.error
        case "paused", "onhold": return colors.textSubtle
        case "planning", "open", "pending": return colors.textMuted
        case "completed", "done", "achieved", "closed": return colors.success
        case "canceled", "cancelled": return colors.error
        default: return colors.textMuted
        }
    }

    /// Tint for a priority string.
    static func priorityTint(_ raw: String, colors: PFColors) -> Color {
        switch raw.lowercased() {
        case "urgent": return colors.error
        case "high": return colors.warning
        case "medium": return colors.textMuted
        case "low": return colors.textSubtle
        default: return colors.textMuted
        }
    }

    /// Tint for an initiative health string.
    static func healthTint(_ raw: String, colors: PFColors) -> Color {
        switch raw.lowercased().replacingOccurrences(of: "_", with: "") {
        case "ontrack", "healthy", "good": return colors.success
        case "atrisk", "warning": return colors.warning
        case "offtrack", "critical", "bad": return colors.error
        default: return colors.textMuted
        }
    }
}

// MARK: Screen header

/// Large companion screen header: optional eyebrow, title, subtitle and a
/// trailing accessory (avatar, menu, "+").
struct PFScreenHeader<Trailing: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    var eyebrow: String? = nil
    var subtitle: String? = nil
    @ViewBuilder var trailing: () -> Trailing

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(alignment: .center, spacing: PFSpacing.md) {
            VStack(alignment: .leading, spacing: 3) {
                if let eyebrow {
                    Text(eyebrow.uppercased())
                        .font(PFFont.eyebrow)
                        .foregroundStyle(colors.textMuted)
                        .tracking(0.6)
                }
                Text(title)
                    .font(PFFont.display)
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if let subtitle {
                    Text(subtitle)
                        .font(PFFont.body)
                        .foregroundStyle(colors.textMuted)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
            trailing()
        }
    }
}

extension PFScreenHeader where Trailing == EmptyView {
    init(title: String, eyebrow: String? = nil, subtitle: String? = nil) {
        self.init(title: title, eyebrow: eyebrow, subtitle: subtitle, trailing: { EmptyView() })
    }
}

// MARK: Section title with optional action

struct PFSectionTitle: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    var subtitle: String? = nil
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(PFFont.section)
                    .foregroundStyle(colors.textMain)
                if let subtitle {
                    Text(subtitle)
                        .font(PFFont.detail)
                        .foregroundStyle(colors.textMuted)
                }
            }
            Spacer(minLength: 0)
            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(PFFont.chip)
                        .foregroundStyle(colors.primary)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: Icon tile

struct PFIconTile: View {
    @Environment(\.colorScheme) private var colorScheme
    let icon: String
    var tint: Color? = nil
    var size: CGFloat = 38
    var corner: CGFloat = PFRadius.md

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var resolvedTint: Color { tint ?? colors.primary }

    var body: some View {
        Image(systemName: icon)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(resolvedTint)
            .frame(width: size, height: size)
            .background(resolvedTint.opacity(colorScheme == .dark ? 0.20 : 0.12))
            .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
    }
}

// MARK: Dot

struct PFDot: View {
    let tint: Color
    var size: CGFloat = 8
    var body: some View {
        Circle().fill(tint).frame(width: size, height: size)
    }
}

// MARK: Tag / chip primitives

struct PFTag: View {
    @Environment(\.colorScheme) private var colorScheme
    let text: String
    var tint: Color? = nil
    var filled: Bool = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var resolvedTint: Color { tint ?? colors.textMuted }

    var body: some View {
        Text(text)
            .font(PFFont.chip)
            .foregroundStyle(filled ? colors.surfaceCard : resolvedTint)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(filled ? resolvedTint : resolvedTint.opacity(colorScheme == .dark ? 0.18 : 0.12))
            .clipShape(Capsule())
    }
}

struct PFStatusChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let status: String
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        let tint = PFSemantic.statusTint(status, colors: colors)
        HStack(spacing: 5) {
            PFDot(tint: tint, size: 6)
            Text(status)
                .font(PFFont.chip)
                .foregroundStyle(colors.textMain)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(colors.surfaceHover)
        .clipShape(Capsule())
    }
}

struct PFPriorityChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let priority: String
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        let tint = PFSemantic.priorityTint(priority, colors: colors)
        Text(priority)
            .font(PFFont.chip)
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(tint.opacity(colorScheme == .dark ? 0.18 : 0.12))
            .clipShape(Capsule())
    }
}

// MARK: Progress bar

struct PFProgressBar: View {
    @Environment(\.colorScheme) private var colorScheme
    /// 0...1
    let value: Double
    var tint: Color? = nil
    var height: CGFloat = 6

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var resolvedTint: Color { tint ?? colors.primary }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(colors.surfaceHover)
                Capsule()
                    .fill(resolvedTint)
                    .frame(width: max(0, min(1, value)) * proxy.size.width)
            }
        }
        .frame(height: height)
    }
}

// MARK: Circular progress (readiness rings)

struct PFCircularProgress: View {
    @Environment(\.colorScheme) private var colorScheme
    /// 0...1
    let value: Double
    var tint: Color? = nil
    var lineWidth: CGFloat = 7
    var size: CGFloat = 64
    var label: String? = nil

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var resolvedTint: Color { tint ?? colors.primary }

    var body: some View {
        ZStack {
            Circle()
                .stroke(colors.surfaceHover, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0, min(1, value)))
                .stroke(resolvedTint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if let label {
                Text(label)
                    .font(PFFont.rowTitle)
                    .foregroundStyle(colors.textMain)
            }
        }
        .frame(width: size, height: size)
    }
}

// MARK: List row

/// Generic companion list row: leading icon tile, title, optional subtitle,
/// optional trailing accessory view, optional chevron. Wrap in a Button /
/// NavigationLink at the call site.
struct PFListRow<Accessory: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    var subtitle: String? = nil
    var icon: String? = nil
    var iconTint: Color? = nil
    var leadingDot: Color? = nil
    var showsChevron: Bool = true
    @ViewBuilder var accessory: () -> Accessory

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.md) {
            if let leadingDot {
                PFDot(tint: leadingDot, size: 9)
            } else if let icon {
                PFIconTile(icon: icon, tint: iconTint, size: 36, corner: PFRadius.sm)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(PFFont.rowTitle)
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(PFFont.detail)
                        .foregroundStyle(colors.textMuted)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)

            accessory()

            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textSubtle)
            }
        }
        .contentShape(Rectangle())
    }
}

extension PFListRow where Accessory == EmptyView {
    init(
        title: String,
        subtitle: String? = nil,
        icon: String? = nil,
        iconTint: Color? = nil,
        leadingDot: Color? = nil,
        showsChevron: Bool = true
    ) {
        self.init(
            title: title,
            subtitle: subtitle,
            icon: icon,
            iconTint: iconTint,
            leadingDot: leadingDot,
            showsChevron: showsChevron,
            accessory: { EmptyView() }
        )
    }
}

// MARK: Metric tile

struct PFMetricTile: View {
    @Environment(\.colorScheme) private var colorScheme
    let value: String
    let label: String
    var icon: String? = nil
    var tint: Color? = nil
    var action: (() -> Void)? = nil

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var resolvedTint: Color { tint ?? colors.primary }

    var body: some View {
        let tile = VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack {
                if let icon {
                    Image(systemName: icon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(resolvedTint)
                }
                Spacer(minLength: 0)
            }
            Text(value)
                .font(PFFont.title)
                .foregroundStyle(colors.textMain)
            Text(label)
                .font(PFFont.detail)
                .foregroundStyle(colors.textMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(PFSpacing.md)
        .background(colors.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
        .pfElevation(.card)

        if let action {
            Button(action: action) { tile }.buttonStyle(.plain)
        } else {
            tile
        }
    }
}

// MARK: Quick action button (compact)

struct PFQuickActionButton: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let icon: String
    var tint: Color? = nil
    let action: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var resolvedTint: Color { tint ?? colors.primary }

    var body: some View {
        Button(action: action) {
            HStack(spacing: PFSpacing.sm) {
                PFIconTile(icon: icon, tint: resolvedTint, size: 32, corner: PFRadius.sm)
                Text(title)
                    .font(PFFont.rowTitle)
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(PFSpacing.sm)
            .background(colors.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
            .pfElevation(.card)
        }
        .buttonStyle(.plain)
    }
}

// MARK: Empty state

struct PFEmptyState: View {
    @Environment(\.colorScheme) private var colorScheme
    let icon: String
    let title: String
    var message: String? = nil
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(spacing: PFSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 28, weight: .regular))
                .foregroundStyle(colors.textSubtle)
                .frame(width: 56, height: 56)
                .background(colors.surfaceHover)
                .clipShape(Circle())
                .padding(.bottom, 2)

            Text(title)
                .font(PFFont.rowTitle)
                .foregroundStyle(colors.textMain)
                .multilineTextAlignment(.center)

            if let message {
                Text(message)
                    .font(PFFont.detail)
                    .foregroundStyle(colors.textMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(PFFont.chip)
                        .foregroundStyle(colors.primaryText)
                        .padding(.vertical, PFSpacing.xs + 2)
                        .padding(.horizontal, PFSpacing.md)
                        .background(colors.primary)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .padding(.top, PFSpacing.xs)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, PFSpacing.lg)
    }
}

// MARK: Segmented control

struct PFSegmentedControl: View {
    struct Segment: Identifiable, Equatable {
        let id: String
        let title: String
        var icon: String? = nil
    }

    @Environment(\.colorScheme) private var colorScheme
    let segments: [Segment]
    @Binding var selection: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: 3) {
            ForEach(segments) { segment in
                let isSelected = segment.id == selection
                Button {
                    withAnimation(.spring(response: 0.28, dampingFraction: 0.8)) {
                        selection = segment.id
                    }
                } label: {
                    HStack(spacing: 5) {
                        if let icon = segment.icon {
                            Image(systemName: icon).font(.caption2.weight(.semibold))
                        }
                        Text(segment.title)
                            .font(PFFont.chip)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .foregroundStyle(isSelected ? colors.textMain : colors.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, PFSpacing.sm)
                    .background(isSelected ? colors.surfaceCard : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                    .pfElevation(isSelected ? .card : .none)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(colors.surfaceHover)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md + 3, style: .continuous))
    }
}

// MARK: Sheet scaffold

/// Standard companion sheet: navigation title + Cancel / Save toolbar buttons,
/// scrollable content. Keeps every create/edit sheet visually consistent.
struct PFSheetScaffold<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    var saveTitle: String = L10n.tr("common.save", fallback: "Save")
    var canSave: Bool = true
    var isSaving: Bool = false
    let onCancel: () -> Void
    let onSave: () -> Void
    @ViewBuilder var content: () -> Content

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        NavigationStack {
            ZStack {
                colors.surfaceBg.ignoresSafeArea()
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: PFSpacing.md) {
                        content()
                    }
                    .padding(PFSpacing.md)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.tr("common.cancel", fallback: "Cancel"), action: onCancel)
                        .foregroundStyle(colors.textMuted)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView().tint(colors.primary)
                    } else {
                        Button(saveTitle, action: onSave)
                            .font(.body.weight(.semibold))
                            .disabled(!canSave)
                    }
                }
            }
        }
    }
}

// MARK: Labeled field (for sheets)

struct PFFieldLabel: View {
    @Environment(\.colorScheme) private var colorScheme
    let text: String
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    var body: some View {
        Text(text.uppercased())
            .font(PFFont.eyebrow)
            .foregroundStyle(colors.textMuted)
            .tracking(0.5)
    }
}

/// A plain text field styled to match the companion sheet surfaces.
struct PFTextField: View {
    @Environment(\.colorScheme) private var colorScheme
    let placeholder: String
    @Binding var text: String
    var axis: Axis = .horizontal

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Group {
            if axis == .vertical {
                TextField(placeholder, text: $text, axis: .vertical)
                    .lineLimit(3...6)
            } else {
                TextField(placeholder, text: $text)
            }
        }
        .font(PFFont.body)
        .padding(PFSpacing.sm + 2)
        .background(colors.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                .stroke(colors.surfaceBorder, lineWidth: 1)
        )
    }
}

/// A pill-style single choice picker used in sheets (status / priority).
struct PFChoiceChips: View {
    @Environment(\.colorScheme) private var colorScheme
    let options: [String]
    @Binding var selection: String
    var tintProvider: ((String) -> Color)? = nil

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        if #available(iOS 16.0, *) {
            FlowLayout(spacing: PFSpacing.sm) {
                ForEach(options, id: \.self) { option in
                    chip(option)
                }
            }
        } else {
            HStack { ForEach(options, id: \.self) { chip($0) } }
        }
    }

    private func chip(_ option: String) -> some View {
        let isSelected = option == selection
        let tint = tintProvider?(option) ?? colors.primary
        return Button {
            selection = option
        } label: {
            Text(option)
                .font(PFFont.chip)
                .foregroundStyle(isSelected ? colors.primaryText : colors.textMain)
                .padding(.horizontal, PFSpacing.md)
                .padding(.vertical, PFSpacing.sm)
                .background(isSelected ? tint : colors.surfaceHover)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Previews

#if DEBUG
#Preview("PFKit") {
    ScrollView {
        VStack(alignment: .leading, spacing: 16) {
            PFScreenHeader(title: "Good morning, Chris", eyebrow: "Fri, Jun 13", subtitle: "2 overdue tasks need attention.")
            HStack {
                PFStatusChip(status: "Active")
                PFStatusChip(status: "Blocked")
                PFPriorityChip(priority: "Urgent")
                PFPriorityChip(priority: "Low")
            }
            HStack(spacing: 8) {
                PFMetricTile(value: "8", label: "Projects", icon: "square.stack.3d.down.forward")
                PFMetricTile(value: "23", label: "Open tasks", icon: "checklist", tint: .orange)
            }
            PFCard {
                VStack(spacing: 12) {
                    PFListRow(title: "Ship onboarding flow", subtitle: "Due today · ProjectFlow", icon: "checklist", iconTint: .orange)
                    PFListRow(title: "Wire up payments", subtitle: "High priority", leadingDot: .red)
                }
            }
            PFProgressBar(value: 0.62)
            PFQuickActionButton(title: "New project", icon: "plus") {}
            PFEmptyState(icon: "tray", title: "All clear", message: "No scheduled work in the next seven days.", actionTitle: "Add task") {}
        }
        .padding()
    }
    .background(AppBackground())
}
#endif
