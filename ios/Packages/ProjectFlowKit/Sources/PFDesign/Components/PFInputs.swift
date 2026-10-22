import SwiftUI

// MARK: - Segmented glider

/// Segmented control with a raised thumb that glides between options (the web sidebar "glider").
public struct PFSegmented<Value: Hashable>: View {
    let options: [(value: Value, label: String)]
    @Binding var selection: Value
    @Namespace private var glider

    public init(_ options: [(value: Value, label: String)], selection: Binding<Value>) {
        self.options = options
        self._selection = selection
    }

    public var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.value) { option in
                let selected = option.value == selection
                Button {
                    guard !selected else { return }
                    PFHaptics.selection()
                    withAnimation(PFMotion.respecting(PFMotion.snappy)) { selection = option.value }
                } label: {
                    Text(option.label)
                        .pfText(.buttonSmall)
                        .foregroundStyle(selected ? PFColor.textMain : PFColor.textMuted)
                        .lineLimit(1)
                        .padding(.horizontal, 14)
                        .frame(maxWidth: .infinity, minHeight: 34)
                        .background {
                            if selected {
                                Capsule().fill(PFColor.card)
                                    .pfElevation(.card, radius: 100)
                                    .matchedGeometryEffect(id: "thumb", in: glider)
                            }
                        }
                        .contentShape(.capsule)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(3)
        .background(PFColor.raised, in: .capsule)
    }
}

// MARK: - Chips

/// Toolbar/filter chip. `isSet` turns it solid (primary), like a chosen value.
public struct PFChip: View {
    let title: String
    let systemImage: String?
    let isSet: Bool
    let showsChevron: Bool
    let action: () -> Void

    public init(_ title: String, systemImage: String? = nil, isSet: Bool = false, showsChevron: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.isSet = isSet
        self.showsChevron = showsChevron
        self.action = action
    }

    public var body: some View {
        Button {
            PFHaptics.selection()
            action()
        } label: {
            HStack(spacing: 6) {
                if let systemImage { Image(systemName: systemImage).font(.system(size: 12, weight: .semibold)) }
                Text(title).pfText(.buttonSmall).lineLimit(1)
                if showsChevron { Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold)).opacity(0.6) }
            }
            .padding(.horizontal, 12)
            .frame(minHeight: 34)
            .foregroundStyle(isSet ? PFColor.onPrimary : PFColor.textMain)
            .background(isSet ? PFColor.primary : PFColor.card, in: .capsule)
            .pfElevation(.card, radius: 100)
            .contentShape(.capsule)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(isSet ? [.isButton, .isSelected] : .isButton)
    }
}

/// Horizontal scrolling row of chips with page gutters.
public struct PFChipRow<Content: View>: View {
    let content: Content

    public init(@ViewBuilder content: () -> Content) { self.content = content() }

    public var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) { content }
                .padding(.horizontal, PFSpace.page)
                .padding(.vertical, 4)
        }
        .scrollIndicators(.hidden)
    }
}

// MARK: - Switch

/// Capsule switch with a sliding knob. Behaves as a toggle for VoiceOver.
public struct PFSwitch: View {
    let label: String
    @Binding var isOn: Bool

    public init(_ label: String, isOn: Binding<Bool>) {
        self.label = label
        self._isOn = isOn
    }

    public var body: some View {
        Button {
            PFHaptics.selection()
            withAnimation(PFMotion.respecting(PFMotion.snappy)) { isOn.toggle() }
        } label: {
            HStack(spacing: PFSpace.s) {
                Text(label).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                    .frame(maxWidth: .infinity, alignment: .leading)
                ZStack(alignment: isOn ? .trailing : .leading) {
                    Capsule().fill(isOn ? PFColor.primary : PFColor.raised)
                        .frame(width: 48, height: 28)
                    Circle().fill(isOn ? PFColor.onPrimary : PFColor.card)
                        .frame(width: 22, height: 22)
                        .shadow(color: .black.opacity(0.15), radius: 2, y: 1)
                        .padding(3)
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(isOn ? Text("1") : Text("0"))
        .accessibilityAddTraits(.isToggle)
    }
}

// MARK: - Text field

/// Filled input (42 pt, radius 10). Focus is shown by a fill change, not a ring (web rule).
public struct PFTextField: View {
    let placeholder: String
    @Binding var text: String
    let systemImage: String?
    let axis: Axis
    let submitLabel: SubmitLabel
    let onSubmit: () -> Void
    @FocusState private var focused: Bool

    public init(_ placeholder: String, text: Binding<String>, systemImage: String? = nil, axis: Axis = .horizontal,
                submitLabel: SubmitLabel = .done, onSubmit: @escaping () -> Void = {}) {
        self.placeholder = placeholder
        self._text = text
        self.systemImage = systemImage
        self.axis = axis
        self.submitLabel = submitLabel
        self.onSubmit = onSubmit
    }

    public var body: some View {
        HStack(spacing: 10) {
            if let systemImage {
                Image(systemName: systemImage).font(.system(size: 15, weight: .medium)).foregroundStyle(PFColor.textMuted)
            }
            TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(PFColor.textSubtle), axis: axis)
                .textFieldStyle(.plain)
                .pfText(.body)
                .foregroundStyle(PFColor.textMain)
                .focused($focused)
                .submitLabel(submitLabel)
                .onSubmit(onSubmit)
            if !text.isEmpty && focused {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(PFColor.textSubtle)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text("Clear"))
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 46)
        .background(focused ? PFColor.card : PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: PFRadius.control, style: .continuous)
                .strokeBorder(PFColor.hairlineStrong.opacity(focused ? 1 : 0), lineWidth: 1)
        }
        .animation(PFMotion.fast, value: focused)
        .contentShape(.rect)
        .onTapGesture { focused = true }
    }
}

// MARK: - Date strip

/// Horizontal strip of days with quick choices above — replaces the native date picker.
public struct PFDateStrip: View {
    public struct Quick: Identifiable, Sendable {
        public let id: String
        public let label: String
        public let date: Date?
        public init(id: String, label: String, date: Date?) { self.id = id; self.label = label; self.date = date }
    }

    let quick: [Quick]
    let days: Int
    let calendar: Calendar
    let locale: Locale
    @Binding var selection: Date?

    public init(quick: [Quick], days: Int = 21, calendar: Calendar = .current, locale: Locale = .current, selection: Binding<Date?>) {
        self.quick = quick
        self.days = days
        self.calendar = calendar
        self.locale = locale
        self._selection = selection
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFChipRow {
                ForEach(quick) { item in
                    PFChip(item.label, isSet: isSelected(item.date)) { select(item.date) }
                }
            }
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(0..<days, id: \.self) { offset in
                        let day = calendar.date(byAdding: .day, value: offset, to: calendar.startOfDay(for: .now))!
                        dayCell(day)
                    }
                }
                .padding(.horizontal, PFSpace.page)
            }
            .scrollIndicators(.hidden)
        }
    }

    private func dayCell(_ day: Date) -> some View {
        let selected = isSelected(day)
        let weekday = day.formatted(.dateTime.weekday(.narrow).locale(locale))
        let number = day.formatted(.dateTime.day().locale(locale))
        let isWeekend = calendar.isDateInWeekend(day)
        return Button { select(day) } label: {
            VStack(spacing: 4) {
                Text(weekday).font(.system(size: 11, weight: .semibold)).foregroundStyle(selected ? PFColor.onPrimary.opacity(0.8) : PFColor.textMuted)
                Text(number).pfText(.section).foregroundStyle(selected ? PFColor.onPrimary : (isWeekend ? PFColor.textMuted : PFColor.textMain))
            }
            .frame(width: 44, height: 58)
            .background(selected ? PFColor.primary : PFColor.card, in: .rect(cornerRadius: 12, style: .continuous))
            .pfElevation(.card, radius: 12)
        }
        .buttonStyle(.pfPressable)
        .accessibilityLabel(day.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(locale)))
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private func isSelected(_ date: Date?) -> Bool {
        switch (date, selection) {
        case (nil, nil): true
        case let (a?, b?): calendar.isDate(a, inSameDayAs: b)
        default: false
        }
    }

    private func select(_ date: Date?) {
        PFHaptics.selection()
        withAnimation(PFMotion.snappy) { selection = date }
    }
}
