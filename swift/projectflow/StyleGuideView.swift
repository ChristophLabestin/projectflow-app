import SwiftUI
#if canImport(PhotosUI)
import PhotosUI
#endif

struct StyleGuideView: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var notice: GuideNotice?
    @State private var isBaseModalOpen = false
    @State private var isConfirmOpen = false
    @State private var isSettingsOpen = false
    @State private var isMediaOpen = false
    @State private var username = ""
    @State private var email = ""
    @State private var password = ""
    @State private var bio = ""
    @State private var priority = GuidePriority.medium
    @State private var selectValue = "Option 1"
    @State private var dateOnly = Date()
    @State private var timeOnly = Date()
    @State private var dateTime = Date()

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    header

                    if let notice {
                        NoticeBanner(notice: notice)
                    }

                    GuideSection(title: "Colors", subtitle: "Palette tokens used across ProjectFlow.") {
                        ColorSwatchGrid()
                    }

                    GuideSection(title: "Typography", subtitle: "Core type scale and weights.") {
                        TypographyShowcase()
                    }

                    GuideSection(title: "Buttons", subtitle: "Primary, secondary, and ghost actions.") {
                        ButtonShowcase(
                            onPrimaryTap: { notice = GuideNotice(message: "Primary action tapped.", tone: .info) },
                            onSecondaryTap: { notice = GuideNotice(message: "Secondary action tapped.", tone: .info) },
                            onGhostTap: { notice = GuideNotice(message: "Ghost action tapped.", tone: .info) }
                        )
                    }

                    GuideSection(title: "Modals", subtitle: "Modal patterns adapted for iOS.") {
                        HStack(spacing: PFSpacing.sm) {
                            StyleGuideButton(title: "Open Base", variant: .primary, size: .md) {
                                isBaseModalOpen = true
                            }
                            StyleGuideButton(title: "Confirm", variant: .secondary, size: .md) {
                                isConfirmOpen = true
                            }
                            StyleGuideButton(title: "Settings", variant: .ghost, size: .md) {
                                isSettingsOpen = true
                            }
                        }
                    }

                    GuideSection(title: "Cards", subtitle: "Surface containers with headers, body, and footer.") {
                        CardShowcase()
                    }

                    GuideSection(title: "Inputs", subtitle: "Text, password, textarea, select, and priority.") {
                        InputShowcase(
                            username: $username,
                            email: $email,
                            password: $password,
                            bio: $bio,
                            priority: $priority,
                            selectValue: $selectValue
                        )
                    }

                    GuideSection(title: "Date & Time", subtitle: "Date, time, and combined pickers.") {
                        DateTimeShowcase(dateOnly: $dateOnly, timeOnly: $timeOnly, dateTime: $dateTime)
                    }

                    GuideSection(title: "Media Library", subtitle: "Asset selection experience placeholder.") {
                        StyleGuideButton(title: "Open Media Library", variant: .primary, size: .md) {
                            isMediaOpen = true
                        }
                    }

                    GuideSection(title: "Badges", subtitle: "Status badges and tones.") {
                        HStack(spacing: PFSpacing.sm) {
                            BadgeChip(title: "Neutral", tone: .neutral)
                            BadgeChip(title: "Success", tone: .success)
                            BadgeChip(title: "Warning", tone: .warning)
                            BadgeChip(title: "Error", tone: .error)
                        }
                    }
                }
                .padding(PFSpacing.lg)
            }
#if os(iOS)
            .scrollDismissesKeyboard(.interactively)
#endif
        }
        .navigationTitle("Style Guide")
        .sheet(isPresented: $isBaseModalOpen) {
            BaseModalView(
                isPresented: $isBaseModalOpen,
                onSave: {
                    notice = GuideNotice(message: "Changes saved.", tone: .success)
                }
            )
            .presentationDetents([.medium])
        }
        .sheet(isPresented: $isSettingsOpen) {
            SettingsModalView(isPresented: $isSettingsOpen)
                .presentationDetents([.large])
        }
        .sheet(isPresented: $isMediaOpen) {
            MediaLibraryView(
                isPresented: $isMediaOpen,
                onSelect: { count in
                    notice = GuideNotice(message: "Selected \(count) asset(s).", tone: .success)
                }
            )
            .presentationDetents([.large])
        }
        .alert("Confirm Action", isPresented: $isConfirmOpen) {
            Button("Cancel", role: .cancel) { }
            Button("Confirm") {
                notice = GuideNotice(message: "Confirmation received.", tone: .info)
            }
        } message: {
            Text("This mimics the confirm modal pattern.")
        }
        .dismissKeyboardOnTap()
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text("Style Guide")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(colors.textMain)
            Text("Universal components used throughout the Swift app.")
                .font(.subheadline)
                .foregroundStyle(colors.textMuted)
        }
    }
}

private struct GuideSection<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let subtitle: String?
    let content: Content

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    init(title: String, subtitle: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            PFSectionHeader(title: title, subtitle: subtitle)
            content
        }
    }
}

private struct GuideNotice: Identifiable {
    enum Tone {
        case info
        case success
    }

    let id = UUID()
    let message: String
    let tone: Tone
}

private struct NoticeBanner: View {
    @Environment(\.colorScheme) private var colorScheme
    let notice: GuideNotice

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var background: Color {
        notice.tone == .success ? colors.success.opacity(0.18) : colors.primaryFade
    }

    private var iconName: String {
        notice.tone == .success ? "checkmark.circle.fill" : "info.circle.fill"
    }

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            Image(systemName: iconName)
                .foregroundStyle(colors.textMain)
            Text(notice.message)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(colors.textMain)
            Spacer()
        }
        .padding(.horizontal, PFSpacing.md)
        .padding(.vertical, PFSpacing.sm)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
        .shadow(color: colors.shadowSm, radius: 4, x: 0, y: 2)
    }
}

private struct ColorSwatchGrid: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var swatches: [(name: String, color: Color, token: String)] {
        [
            ("Primary", colors.primary, "--color-primary"),
            ("Primary Dark", colors.primaryDark, "--color-primary-dark"),
            ("Primary Light", colors.primaryLight, "--color-primary-light"),
            ("Surface Bg", colors.surfaceBg, "--color-surface-bg"),
            ("Surface Card", colors.surfaceCard, "--color-surface-card"),
            ("Surface Hover", colors.surfaceHover, "--color-surface-hover"),
            ("Success", colors.success, "--color-success"),
            ("Warning", colors.warning, "--color-warning"),
            ("Error", colors.error, "--color-error"),
            ("Text Main", colors.textMain, "--color-text-main"),
            ("Text Muted", colors.textMuted, "--color-text-muted")
        ]
    }

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: PFSpacing.md)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: PFSpacing.md) {
            ForEach(swatches, id: \.name) { swatch in
                HStack(spacing: PFSpacing.md) {
                    RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                        .fill(swatch.color)
                        .frame(width: 42, height: 42)
                        .shadow(color: colors.shadowSm, radius: 4, x: 0, y: 2)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(swatch.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                        Text(swatch.token)
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                    }
                }
                .padding(PFSpacing.sm)
                .background(colors.surfaceCard)
                .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
                .shadow(color: colors.shadowSm, radius: 4, x: 0, y: 2)
            }
        }
    }
}

private struct TypographyShowcase: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            typeSample(title: "Heading 1", font: .largeTitle.weight(.bold), meta: "Weight 700")
            typeSample(title: "Heading 2", font: .title2.weight(.semibold), meta: "Weight 600")
            typeSample(title: "Heading 3", font: .title3.weight(.semibold), meta: "Weight 600")
            typeSample(title: "Body text example for everyday UI copy.", font: .body, meta: "Weight 400")
            typeSample(title: "Small caption text.", font: .caption, meta: "Weight 400")
        }
    }

    private func typeSample(title: String, font: Font, meta: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(font)
                .foregroundStyle(colors.textMain)
            Text(meta)
                .font(.caption)
                .foregroundStyle(colors.textMuted)
        }
    }
}

private struct ButtonShowcase: View {
    let onPrimaryTap: () -> Void
    let onSecondaryTap: () -> Void
    let onGhostTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            HStack(spacing: PFSpacing.sm) {
                StyleGuideButton(title: "Primary", variant: .primary, size: .md, action: onPrimaryTap)
                StyleGuideButton(title: "Secondary", variant: .secondary, size: .md, action: onSecondaryTap)
                StyleGuideButton(title: "Ghost", variant: .ghost, size: .md, action: onGhostTap)
            }

            HStack(spacing: PFSpacing.sm) {
                StyleGuideButton(title: "Small", variant: .primary, size: .sm) {}
                StyleGuideButton(title: "Medium", variant: .primary, size: .md) {}
                StyleGuideButton(title: "Large", variant: .primary, size: .lg) {}
            }

            HStack(spacing: PFSpacing.sm) {
                StyleGuideButton(title: "Loading", variant: .primary, size: .md, isLoading: true) {}
                StyleGuideButton(title: "Disabled", variant: .secondary, size: .md, isDisabled: true) {}
            }
        }
    }
}

private enum ButtonVariant {
    case primary
    case secondary
    case ghost
}

private enum ButtonSize {
    case sm
    case md
    case lg

    var verticalPadding: CGFloat {
        switch self {
        case .sm:
            return 6
        case .md:
            return 10
        case .lg:
            return 14
        }
    }

    var horizontalPadding: CGFloat {
        switch self {
        case .sm:
            return 14
        case .md:
            return 18
        case .lg:
            return 22
        }
    }

    var font: Font {
        switch self {
        case .sm:
            return .caption.weight(.semibold)
        case .md:
            return .subheadline.weight(.semibold)
        case .lg:
            return .headline.weight(.semibold)
        }
    }
}

private struct StyleGuideButton: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let variant: ButtonVariant
    let size: ButtonSize
    var isLoading = false
    var isDisabled = false
    let action: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var background: Color {
        switch variant {
        case .primary:
            return colors.primary
        case .secondary:
            return colors.surfaceCard
        case .ghost:
            return Color.clear
        }
    }

    private var foreground: Color {
        switch variant {
        case .primary:
            return colors.primaryText
        case .secondary:
            return colors.textMain
        case .ghost:
            return colors.textMain
        }
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(foreground)
                }

                Text(title)
                    .font(size.font)
            }
            .padding(.horizontal, size.horizontalPadding)
            .padding(.vertical, size.verticalPadding)
            .foregroundStyle(foreground)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
            .shadow(color: variant == .ghost ? .clear : colors.shadowSm, radius: 3, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.55 : 1)
    }
}

private struct CardShowcase: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(spacing: PFSpacing.md) {
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.sm) {
                    Text("Card Title")
                        .font(.headline)
                        .foregroundStyle(colors.textMain)
                    Text("Card body content with supporting text.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                    HStack(spacing: PFSpacing.sm) {
                        StyleGuideButton(title: "Cancel", variant: .ghost, size: .sm) {}
                        StyleGuideButton(title: "Action", variant: .primary, size: .sm) {}
                    }
                }
            }

            PFCard {
                Text("Body-only card for compact info.")
                    .font(.subheadline)
                    .foregroundStyle(colors.textMain)
            }
        }
    }
}

private struct InputShowcase: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var username: String
    @Binding var email: String
    @Binding var password: String
    @Binding var bio: String
    @Binding var priority: GuidePriority
    @Binding var selectValue: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var selectOptions: [CustomSelectOption<String>] {
        [
            CustomSelectOption(value: "Option 1", title: "Option 1", subtitle: "Standard choice"),
            CustomSelectOption(value: "Option 2", title: "Option 2", subtitle: "Expanded access"),
            CustomSelectOption(value: "Option 3", title: "Option 3", subtitle: "Restricted"),
            CustomSelectOption(value: "Option 4", title: "Option 4", subtitle: "Disabled", isDisabled: true)
        ]
    }

    private var priorityOptions: [CustomSelectOption<GuidePriority>] {
        [
            CustomSelectOption(value: .low, title: GuidePriority.low.label, subtitle: "Low urgency"),
            CustomSelectOption(value: .medium, title: GuidePriority.medium.label, subtitle: "Standard priority"),
            CustomSelectOption(value: .high, title: GuidePriority.high.label, subtitle: "Team focus"),
            CustomSelectOption(value: .urgent, title: GuidePriority.urgent.label, subtitle: "Immediate action")
        ]
    }

    var body: some View {
        VStack(spacing: PFSpacing.md) {
            PFInputField(title: "Username", placeholder: "Enter username", text: $username, isSecure: false, keyboardType: .default)

            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                PFInputField(title: "Email", placeholder: "hello@projectflow.app", text: $email, isSecure: false, keyboardType: .emailAddress)
                Text("We’ll never share your email.")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            }

            PFInputField(
                title: "Password",
                placeholder: "Enter password",
                text: $password,
                isSecure: true,
                keyboardType: .default,
                error: password.isEmpty ? "Password is required." : nil
            )

            TextAreaField(
                title: "Bio",
                placeholder: "Share a short summary.",
                helper: "This appears on your profile.",
                text: $bio
            )

            CustomSelectField(
                title: "Priority (Dropdown)",
                helper: "Applies to new tasks by default.",
                options: priorityOptions,
                selection: $priority,
                placeholder: "Select priority"
            )

            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                Text("Priority (Group)")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
                PriorityGroup(selection: $priority)
            }

            CustomSelectField(
                title: "Select",
                helper: "Custom select in the ProjectFlow style.",
                options: selectOptions,
                selection: $selectValue,
                placeholder: "Pick an option"
            )
        }
    }
}

private enum GuidePriority: String, CaseIterable {
    case low
    case medium
    case high
    case urgent

    var label: String {
        rawValue.capitalized
    }
}

private struct TextAreaField: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let placeholder: String
    let helper: String?
    @Binding var text: String
    var minHeight: CGFloat = 110

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text(title)
                .font(.caption)
                .foregroundStyle(colors.textMuted)

            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text(placeholder)
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                        .padding(.horizontal, PFSpacing.sm + 2)
                        .padding(.vertical, PFSpacing.sm + 2)
                }

                textEditor
            }
            .background(colors.surfacePaper)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
            .shadow(color: colors.shadowSm, radius: 3, x: 0, y: 2)

            if let helper {
                Text(helper)
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            }
        }
    }

    @ViewBuilder
    private var textEditor: some View {
        if #available(iOS 16.0, macOS 13.0, *) {
            TextEditor(text: $text)
                .scrollContentBackground(.hidden)
                .foregroundStyle(colors.textMain)
                .font(.body)
                .frame(minHeight: minHeight)
                .padding(PFSpacing.sm)
        } else {
            TextEditor(text: $text)
                .foregroundStyle(colors.textMain)
                .font(.body)
                .frame(minHeight: minHeight)
                .padding(PFSpacing.sm)
        }
    }
}

private struct CustomSelectOption<Value: Hashable>: Identifiable, Hashable {
    let value: Value
    let title: String
    let subtitle: String?
    let isDisabled: Bool

    init(value: Value, title: String, subtitle: String? = nil, isDisabled: Bool = false) {
        self.value = value
        self.title = title
        self.subtitle = subtitle
        self.isDisabled = isDisabled
    }

    var id: Value { value }
}

private struct CustomSelectField<Value: Hashable>: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let helper: String?
    let options: [CustomSelectOption<Value>]
    @Binding var selection: Value
    let placeholder: String

    @State private var isOpen = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var selectedOption: CustomSelectOption<Value>? {
        options.first { $0.value == selection }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text(title)
                .font(.caption)
                .foregroundStyle(colors.textMuted)

            Button {
                isOpen = true
            } label: {
                HStack(spacing: PFSpacing.sm) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(selectedOption?.title ?? placeholder)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(selectedOption == nil ? colors.textMuted : colors.textMain)
                        if let subtitle = selectedOption?.subtitle {
                            Text(subtitle)
                                .font(.caption)
                                .foregroundStyle(colors.textMuted)
                        }
                    }
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(colors.textMuted)
                }
                .padding(PFSpacing.sm)
                .background(colors.surfacePaper)
                .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                .shadow(color: colors.shadowSm, radius: 3, x: 0, y: 2)
            }
            .buttonStyle(.plain)

            if let helper {
                Text(helper)
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            }
        }
        .sheet(isPresented: $isOpen) {
            SelectSheet(
                title: title,
                isPresented: $isOpen,
                options: options,
                selection: $selection
            )
            .presentationDetents([.medium, .large])
        }
    }
}

private struct SelectSheet<Value: Hashable>: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    @Binding var isPresented: Bool
    let options: [CustomSelectOption<Value>]
    @Binding var selection: Value

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ZStack {
            AppBackground()
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack {
                    Text(title)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(colors.textMain)
                    Spacer()
                    StyleGuideButton(title: "Close", variant: .ghost, size: .sm) {
                        isPresented = false
                    }
                }

                ScrollView(showsIndicators: false) {
                    LazyVStack(spacing: PFSpacing.sm) {
                        ForEach(options) { option in
                            SelectOptionRow(
                                option: option,
                                isSelected: option.value == selection
                            ) {
                                selection = option.value
                                isPresented = false
                            }
                        }
                    }
                    .padding(.bottom, PFSpacing.lg)
                }
#if os(iOS)
                .scrollDismissesKeyboard(.interactively)
#endif

                Spacer(minLength: 0)
            }
            .padding(PFSpacing.lg)
        }
        .dismissKeyboardOnTap()
    }
}

private struct SelectOptionRow<Value: Hashable>: View {
    @Environment(\.colorScheme) private var colorScheme
    let option: CustomSelectOption<Value>
    let isSelected: Bool
    let onSelect: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: PFSpacing.sm) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(option.isDisabled ? colors.textMuted : colors.textMain)
                    if let subtitle = option.subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                    }
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(colors.primary)
                }
            }
            .padding(PFSpacing.md)
            .background(isSelected ? colors.primaryFade : colors.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
            .shadow(color: colors.shadowSm, radius: 4, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .disabled(option.isDisabled)
        .opacity(option.isDisabled ? 0.5 : 1)
    }
}

private struct PriorityGroup: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var selection: GuidePriority

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            ForEach(GuidePriority.allCases, id: \.self) { option in
                Button {
                    selection = option
                } label: {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(tint(for: option))
                            .frame(width: 6, height: 6)
                        Text(option.label)
                            .font(.subheadline.weight(.semibold))
                    }
                    .padding(.horizontal, PFSpacing.md)
                    .padding(.vertical, 8)
                    .foregroundStyle(selection == option ? tint(for: option) : colors.textMain)
                    .background(selection == option ? tint(for: option).opacity(0.2) : colors.surfacePaper)
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                    .shadow(color: colors.shadowSm, radius: 3, x: 0, y: 2)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func tint(for priority: GuidePriority) -> Color {
        switch priority {
        case .low:
            return colors.success
        case .medium:
            return colors.primary
        case .high:
            return colors.warning
        case .urgent:
            return colors.error
        }
    }
}

private struct DateTimeShowcase: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var dateOnly: Date
    @Binding var timeOnly: Date
    @Binding var dateTime: Date

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text("Date")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
                DatePicker("", selection: $dateOnly, displayedComponents: .date)
                    .datePickerStyle(.compact)
                    .labelsHidden()
            }

            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text("Time")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
                DatePicker("", selection: $timeOnly, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.compact)
                    .labelsHidden()
            }

            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text("Date & Time")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
                DatePicker("", selection: $dateTime, displayedComponents: [.date, .hourAndMinute])
                    .datePickerStyle(.compact)
                    .labelsHidden()
            }
        }
    }
}

private enum BadgeTone {
    case neutral
    case success
    case warning
    case error
}

private struct BadgeChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let tone: BadgeTone

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var tint: Color {
        switch tone {
        case .neutral:
            return colors.textMuted
        case .success:
            return colors.success
        case .warning:
            return colors.warning
        case .error:
            return colors.error
        }
    }

    var body: some View {
        Text(title.uppercased())
            .font(.caption2.weight(.semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, PFSpacing.sm)
            .padding(.vertical, 4)
            .background(tint.opacity(0.12))
            .clipShape(Capsule())
    }
}

private struct BaseModalView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var isPresented: Bool
    @State private var modalText = ""
    let onSave: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ZStack {
            AppBackground()
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                Text("Base Modal")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                Text("Use this layout for focused edits or review flows.")
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)

                PFInputField(
                    title: "Example Field",
                    placeholder: "Add a value",
                    text: $modalText,
                    isSecure: false,
                    keyboardType: .default
                )

                HStack(spacing: PFSpacing.sm) {
                    StyleGuideButton(title: "Cancel", variant: .ghost, size: .md) {
                        isPresented = false
                    }
                    StyleGuideButton(title: "Save", variant: .primary, size: .md) {
                        onSave()
                        isPresented = false
                    }
                }
            }
            .padding(PFSpacing.lg)
            .background(colors.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.xl, style: .continuous))
            .shadow(color: colors.shadowSm, radius: 10, x: 0, y: 6)
            .padding(PFSpacing.lg)
        }
        .dismissKeyboardOnTap()
    }
}

private struct SettingsModalView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var isPresented: Bool
    @State private var tab = SettingsTab.general

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ZStack {
            AppBackground()
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack {
                    Text("Settings")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(colors.textMain)
                    Spacer()
                    StyleGuideButton(title: "Done", variant: .ghost, size: .sm) {
                        isPresented = false
                    }
                }

                Picker("Tabs", selection: $tab) {
                    ForEach(SettingsTab.allCases, id: \.self) { item in
                        Text(item.label).tag(item)
                    }
                }
                .pickerStyle(.segmented)

                PFCard {
                    Text(tab.description)
                        .font(.subheadline)
                        .foregroundStyle(colors.textMain)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Spacer()
            }
            .padding(PFSpacing.lg)
        }
        .dismissKeyboardOnTap()
    }
}

private enum SettingsTab: CaseIterable {
    case general
    case profile
    case notifications
    case advanced

    var label: String {
        switch self {
        case .general:
            return "General"
        case .profile:
            return "Profile"
        case .notifications:
            return "Notifications"
        case .advanced:
            return "Advanced"
        }
    }

    var description: String {
        switch self {
        case .general:
            return "General preferences and workspace settings."
        case .profile:
            return "Profile details and visibility."
        case .notifications:
            return "Notification routing and quiet hours."
        case .advanced:
            return "Advanced controls and integrations."
        }
    }
}

private struct MediaLibraryView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var isPresented: Bool
    let onSelect: (Int) -> Void

    @State private var activeTab: MediaLibraryTab = .gallery
    @State private var gallerySearch = ""
    @State private var stockSearch = ""
    @State private var aiPrompt = ""
    @State private var aiMode: AIMode = .generate
    @State private var aiStyle: AIStyle = .photographic
    @State private var generatedAssets: [MediaAsset] = []
    @State private var galleryAssets: [MediaAsset] = MediaAsset.sampleGallery
    @State private var stockAssets: [MediaAsset] = MediaAsset.sampleStock
    @State private var uploadAssets: [MediaAsset] = []
    @State private var referenceAsset: MediaAsset?
    @State private var selectedAssetIDs: Set<UUID> = []
#if canImport(PhotosUI)
    @State private var photosPickerItems: [PhotosPickerItem] = []
#endif

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var selectedCount: Int { selectedAssetIDs.count }

    var body: some View {
        ZStack {
            AppBackground()
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                header

                MediaTabBar(activeTab: $activeTab)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: PFSpacing.lg) {
                        content
                        actionBar
                    }
                    .padding(.bottom, PFSpacing.lg)
                }
#if os(iOS)
                .scrollDismissesKeyboard(.interactively)
#endif
            }
            .padding(PFSpacing.lg)
        }
        .dismissKeyboardOnTap()
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Media Library")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                Text("Upload, curate, and generate assets.")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            }
            Spacer()
            StyleGuideButton(title: "Close", variant: .ghost, size: .sm) {
                isPresented = false
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch activeTab {
        case .upload:
            uploadSection
        case .gallery:
            gallerySection
        case .stock:
            stockSection
        case .ai:
            aiSection
        }
    }

    private var uploadSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            uploadCard

            if !uploadAssets.isEmpty {
                MediaAssetGrid(
                    title: "Recently Added",
                    assets: uploadAssets,
                    selectedAssetIDs: selectedAssetIDs,
                    onToggle: toggleSelection
                )
            }

            UploadInfoRow(title: "Accepted formats", value: "PNG, JPG, HEIC, MP4")
            UploadInfoRow(title: "Max size", value: "250 MB per file")
        }
    }

    private var uploadCard: some View {
#if canImport(PhotosUI)
        if #available(iOS 16.0, *) {
            return AnyView(
                PhotosPicker(selection: $photosPickerItems, maxSelectionCount: 6, matching: .images) {
                    UploadCard()
                }
                .onChange(of: photosPickerItems) { newItems in
                    let newAssets = makeUploads(from: newItems)
                    uploadAssets = newAssets
                    galleryAssets = newAssets + galleryAssets
                }
            )
        } else {
            return AnyView(UploadCard())
        }
#else
        UploadCard()
#endif
    }

    private var gallerySection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            MediaSearchField(text: $gallerySearch, placeholder: "Search library")

            MediaAssetGrid(
                title: "Project Assets",
                assets: filteredGalleryAssets,
                selectedAssetIDs: selectedAssetIDs,
                onToggle: toggleSelection
            )
        }
    }

    private var stockSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            MediaSearchField(text: $stockSearch, placeholder: "Search stock images")

            MediaAssetGrid(
                title: "Curated Stock",
                assets: filteredStockAssets,
                selectedAssetIDs: selectedAssetIDs,
                onToggle: toggleSelection
            )

            Text("Tap to save curated images to your library.")
                .font(.caption)
                .foregroundStyle(colors.textMuted)
        }
    }

    private var aiSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            AIModeToggle(mode: $aiMode)

            TextAreaField(
                title: aiMode == .generate ? "Prompt" : "Rework Instructions",
                placeholder: aiMode == .generate ? "Describe the image you need." : "Explain how to refine the image.",
                helper: "The AI generator uses your prompt and style.",
                text: $aiPrompt,
                minHeight: 120
            )

            CustomSelectField(
                title: "Style",
                helper: "Match the look and feel of your brand.",
                options: AIStyle.allCases.map { CustomSelectOption(value: $0, title: $0.label, subtitle: $0.detail) },
                selection: $aiStyle,
                placeholder: "Select style"
            )

            if aiMode == .rework {
                MediaReferencePicker(
                    assets: galleryAssets,
                    selectedAsset: $referenceAsset
                )
            }

            StyleGuideButton(
                title: generatedAssets.isEmpty ? "Generate Assets" : "Generate More",
                variant: .primary,
                size: .md,
                isDisabled: aiPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ) {
                generatedAssets = MediaAsset.sampleAI
            }

            if !generatedAssets.isEmpty {
                MediaAssetGrid(
                    title: "AI Results",
                    assets: generatedAssets,
                    selectedAssetIDs: selectedAssetIDs,
                    onToggle: toggleSelection
                )
            }
        }
    }

    private var actionBar: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack {
                Text("\(selectedCount) selected")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                Spacer()
                Text(activeTab.actionHint)
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            }

            StyleGuideButton(
                title: activeTab.actionTitle,
                variant: .primary,
                size: .md,
                isDisabled: selectedCount == 0
            ) {
                guard selectedCount > 0 else { return }
                onSelect(selectedCount)
                isPresented = false
            }
        }
        .padding(PFSpacing.md)
        .background(colors.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
        .shadow(color: colors.shadowSm, radius: 6, x: 0, y: 4)
    }

    private var filteredGalleryAssets: [MediaAsset] {
        let trimmed = gallerySearch.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return galleryAssets }
        return galleryAssets.filter { $0.name.localizedCaseInsensitiveContains(trimmed) }
    }

    private var filteredStockAssets: [MediaAsset] {
        let trimmed = stockSearch.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return stockAssets }
        return stockAssets.filter { $0.name.localizedCaseInsensitiveContains(trimmed) }
    }

    private func toggleSelection(_ asset: MediaAsset) {
        if selectedAssetIDs.contains(asset.id) {
            selectedAssetIDs.remove(asset.id)
        } else {
            selectedAssetIDs.insert(asset.id)
        }
    }

#if canImport(PhotosUI)
    private func makeUploads(from items: [PhotosPickerItem]) -> [MediaAsset] {
        items.enumerated().map { index, _ in
            MediaAsset(
                name: "Upload \(index + 1)",
                source: .upload,
                kind: .image,
                tone: MediaTone.allCases[index % MediaTone.allCases.count]
            )
        }
    }
#endif
}

private enum MediaLibraryTab: String, CaseIterable {
    case upload
    case gallery
    case stock
    case ai

    var label: String {
        switch self {
        case .upload:
            return "Upload"
        case .gallery:
            return "Library"
        case .stock:
            return "Stock"
        case .ai:
            return "AI"
        }
    }

    var icon: String {
        switch self {
        case .upload:
            return "arrow.up.circle.fill"
        case .gallery:
            return "photo.on.rectangle"
        case .stock:
            return "sparkles"
        case .ai:
            return "wand.and.stars"
        }
    }

    var actionTitle: String {
        switch self {
        case .upload:
            return "Add to Library"
        case .gallery:
            return "Select Assets"
        case .stock:
            return "Save to Library"
        case .ai:
            return "Use Selected"
        }
    }

    var actionHint: String {
        switch self {
        case .upload:
            return "Add uploads to the library."
        case .gallery:
            return "Attach assets to the project."
        case .stock:
            return "Save curated picks."
        case .ai:
            return "Apply generated assets."
        }
    }
}

private enum MediaAssetKind: String {
    case image
    case video
}

private enum MediaTone: CaseIterable {
    case aurora
    case tide
    case ember
    case dusk
    case moss
    case plum
}

private struct MediaAsset: Identifiable, Hashable {
    let id: UUID
    let name: String
    let source: MediaLibraryTab
    let kind: MediaAssetKind
    let tone: MediaTone

    init(name: String, source: MediaLibraryTab, kind: MediaAssetKind, tone: MediaTone) {
        self.id = UUID()
        self.name = name
        self.source = source
        self.kind = kind
        self.tone = tone
    }

    static let sampleGallery: [MediaAsset] = [
        MediaAsset(name: "Launch Banner", source: .gallery, kind: .image, tone: .aurora),
        MediaAsset(name: "Product Closeup", source: .gallery, kind: .image, tone: .tide),
        MediaAsset(name: "Workflow Diagram", source: .gallery, kind: .image, tone: .ember),
        MediaAsset(name: "User Storyboard", source: .gallery, kind: .image, tone: .dusk),
        MediaAsset(name: "Demo Clip", source: .gallery, kind: .video, tone: .plum),
        MediaAsset(name: "Press Kit", source: .gallery, kind: .image, tone: .moss),
        MediaAsset(name: "Cover Render", source: .gallery, kind: .image, tone: .aurora),
        MediaAsset(name: "Sprint Recap", source: .gallery, kind: .image, tone: .tide)
    ]

    static let sampleStock: [MediaAsset] = [
        MediaAsset(name: "Workspace Overhead", source: .stock, kind: .image, tone: .moss),
        MediaAsset(name: "Night City", source: .stock, kind: .image, tone: .dusk),
        MediaAsset(name: "Studio Portrait", source: .stock, kind: .image, tone: .plum),
        MediaAsset(name: "Product Grid", source: .stock, kind: .image, tone: .ember),
        MediaAsset(name: "Team Huddle", source: .stock, kind: .image, tone: .aurora),
        MediaAsset(name: "Blueprint Detail", source: .stock, kind: .image, tone: .tide)
    ]

    static let sampleAI: [MediaAsset] = [
        MediaAsset(name: "AI Concept 01", source: .ai, kind: .image, tone: .aurora),
        MediaAsset(name: "AI Concept 02", source: .ai, kind: .image, tone: .plum),
        MediaAsset(name: "AI Concept 03", source: .ai, kind: .image, tone: .ember),
        MediaAsset(name: "AI Concept 04", source: .ai, kind: .image, tone: .tide)
    ]
}

private enum AIMode: String, CaseIterable {
    case generate
    case rework

    var label: String {
        switch self {
        case .generate:
            return "Generate"
        case .rework:
            return "Rework"
        }
    }
}

private enum AIStyle: String, CaseIterable {
    case photographic
    case digitalArt
    case cinematic
    case render3d
    case sketch
    case abstract

    var label: String {
        switch self {
        case .photographic:
            return "Photographic"
        case .digitalArt:
            return "Digital Art"
        case .cinematic:
            return "Cinematic"
        case .render3d:
            return "3D Render"
        case .sketch:
            return "Sketch"
        case .abstract:
            return "Abstract"
        }
    }

    var detail: String {
        switch self {
        case .photographic:
            return "Natural lighting with soft grain."
        case .digitalArt:
            return "Illustrated with bold shading."
        case .cinematic:
            return "High contrast, dramatic lighting."
        case .render3d:
            return "Polished render with depth."
        case .sketch:
            return "Hand-drawn pencil texture."
        case .abstract:
            return "Shapes and gradients only."
        }
    }
}

private struct MediaTabBar: View {
    @Binding var activeTab: MediaLibraryTab

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            ForEach(MediaLibraryTab.allCases, id: \.self) { tab in
                MediaTabButton(tab: tab, isActive: tab == activeTab) {
                    activeTab = tab
                }
            }
        }
    }
}

private struct MediaTabButton: View {
    @Environment(\.colorScheme) private var colorScheme
    let tab: MediaLibraryTab
    let isActive: Bool
    let action: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: tab.icon)
                    .font(.caption.weight(.semibold))
                Text(tab.label)
                    .font(.subheadline.weight(.semibold))
            }
            .padding(.horizontal, PFSpacing.md)
            .padding(.vertical, 8)
            .foregroundStyle(isActive ? colors.textMain : colors.textMuted)
            .background(isActive ? colors.surfaceCard : colors.surfacePaper)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
            .shadow(color: colors.shadowSm, radius: isActive ? 4 : 2, x: 0, y: 2)
        }
        .buttonStyle(.plain)
    }
}

private struct UploadCard: View {
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack(spacing: PFSpacing.sm) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundStyle(colors.primary)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Upload Media")
                        .font(.headline)
                        .foregroundStyle(colors.textMain)
                    Text("Add files from your device to the library.")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }
            }

            Text("Browse Files")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(colors.textMain)
                .padding(.horizontal, PFSpacing.md)
                .padding(.vertical, 8)
                .background(colors.surfacePaper)
                .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                .shadow(color: colors.shadowSm, radius: 3, x: 0, y: 2)
        }
        .padding(PFSpacing.md)
        .background(colors.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
        .shadow(color: colors.shadowSm, radius: 4, x: 0, y: 2)
    }
}

private struct UploadInfoRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack {
            Text(title)
                .font(.caption)
                .foregroundStyle(colors.textMuted)
            Spacer()
            Text(value)
                .font(.caption.weight(.semibold))
                .foregroundStyle(colors.textMain)
        }
        .padding(.horizontal, PFSpacing.sm)
    }
}

private struct MediaSearchField: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var text: String
    let placeholder: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.caption.weight(.semibold))
                .foregroundStyle(colors.textMuted)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(colors.textMain)
        }
        .padding(PFSpacing.sm)
        .background(colors.surfacePaper)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
        .shadow(color: colors.shadowSm, radius: 3, x: 0, y: 2)
    }
}

private struct MediaAssetGrid: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let assets: [MediaAsset]
    let selectedAssetIDs: Set<UUID>
    let onToggle: (MediaAsset) -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let columns = [GridItem(.adaptive(minimum: 110), spacing: PFSpacing.md)]

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            Text(title)
                .font(.headline)
                .foregroundStyle(colors.textMain)

            if assets.isEmpty {
                Text("No assets found.")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            } else {
                LazyVGrid(columns: columns, spacing: PFSpacing.md) {
                    ForEach(assets) { asset in
                        MediaThumbnail(asset: asset, isSelected: selectedAssetIDs.contains(asset.id)) {
                            onToggle(asset)
                        }
                    }
                }
            }
        }
    }
}

private struct MediaThumbnail: View {
    @Environment(\.colorScheme) private var colorScheme
    let asset: MediaAsset
    let isSelected: Bool
    let onToggle: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: onToggle) {
            ZStack(alignment: .topTrailing) {
                RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous)
                    .fill(gradient(for: asset.tone))
                    .frame(height: 120)
                    .shadow(color: colors.shadowSm, radius: 4, x: 0, y: 2)

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(colors.primary)
                        .padding(8)
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        if asset.kind == .video {
                            Image(systemName: "play.circle.fill")
                                .font(.caption)
                                .foregroundStyle(colors.textMain)
                        }
                        Text(asset.source.label.uppercased())
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(colors.textMain)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(colors.surfaceCard.opacity(0.8))
                            .clipShape(Capsule())
                    }
                    Spacer()
                    Text(asset.name)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(colors.textMain)
                        .lineLimit(2)
                }
                .padding(PFSpacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
    }

    private func gradient(for tone: MediaTone) -> LinearGradient {
        let colors: [Color]
        switch tone {
        case .aurora:
            colors = [self.colors.primaryLight, self.colors.primary]
        case .tide:
            colors = [self.colors.primaryFade, self.colors.primaryLight]
        case .ember:
            colors = [self.colors.warning.opacity(0.6), self.colors.warning]
        case .dusk:
            colors = [self.colors.textMuted.opacity(0.4), self.colors.surfaceHover]
        case .moss:
            colors = [self.colors.success.opacity(0.4), self.colors.success]
        case .plum:
            colors = [self.colors.error.opacity(0.4), self.colors.error]
        }
        return LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

private struct AIModeToggle: View {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var mode: AIMode

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            ForEach(AIMode.allCases, id: \.self) { option in
                Button {
                    mode = option
                } label: {
                    Text(option.label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(mode == option ? colors.textMain : colors.textMuted)
                        .padding(.horizontal, PFSpacing.md)
                        .padding(.vertical, 8)
                        .background(mode == option ? colors.surfaceCard : colors.surfacePaper)
                        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                        .shadow(color: colors.shadowSm, radius: mode == option ? 4 : 2, x: 0, y: 2)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct MediaReferencePicker: View {
    @Environment(\.colorScheme) private var colorScheme
    let assets: [MediaAsset]
    @Binding var selectedAsset: MediaAsset?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            Text("Reference Image")
                .font(.caption)
                .foregroundStyle(colors.textMuted)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: PFSpacing.sm) {
                    ForEach(assets) { asset in
                        Button {
                            selectedAsset = asset
                        } label: {
                            MediaReferenceThumb(asset: asset, isSelected: asset.id == selectedAsset?.id)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }
}

private struct MediaReferenceThumb: View {
    @Environment(\.colorScheme) private var colorScheme
    let asset: MediaAsset
    let isSelected: Bool

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                .fill(colors.surfaceCard)
                .frame(width: 86, height: 86)
                .shadow(color: colors.shadowSm, radius: 3, x: 0, y: 2)
                .overlay(
                    Image(systemName: "photo")
                        .font(.title3)
                        .foregroundStyle(colors.textMuted)
                )

            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(colors.primary)
                    .padding(6)
            }
        }
    }
}

#if canImport(UIKit)
private extension View {
    func dismissKeyboardOnTap() -> some View {
        simultaneousGesture(TapGesture().onEnded {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        })
    }
}
#else
private extension View {
    func dismissKeyboardOnTap() -> some View { self }
}
#endif
