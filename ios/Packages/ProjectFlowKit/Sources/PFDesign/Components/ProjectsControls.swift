import SwiftUI

// Controls of the Projects / Task detail features. All custom, no native controls.

// MARK: - Pill button

/// A pill that opens an option sheet (status, priority, due date…). Same look as `PFPill`, plus a
/// tiny chevron so it reads as tappable.
public struct PFPillButton: View {
    let text: String
    let tone: PFPill.Tone
    let leading: AnyView?
    let showsChevron: Bool
    let isEnabled: Bool
    let action: () -> Void

    public init(_ text: String, tone: PFPill.Tone = .neutral, showsChevron: Bool = true, isEnabled: Bool = true, action: @escaping () -> Void) {
        self.text = text
        self.tone = tone
        self.leading = nil
        self.showsChevron = showsChevron
        self.isEnabled = isEnabled
        self.action = action
    }

    public init<Leading: View>(_ text: String, tone: PFPill.Tone = .neutral, showsChevron: Bool = true, isEnabled: Bool = true,
                               action: @escaping () -> Void, @ViewBuilder leading: () -> Leading) {
        self.text = text
        self.tone = tone
        self.leading = AnyView(leading())
        self.showsChevron = showsChevron
        self.isEnabled = isEnabled
        self.action = action
    }

    public var body: some View {
        Button {
            PFHaptics.selection()
            action()
        } label: {
            HStack(spacing: 6) {
                leading
                Text(text).pfText(.pill).lineLimit(1)
                if showsChevron && isEnabled {
                    Image(systemName: "chevron.down").font(.system(size: 8, weight: .heavy)).opacity(0.55)
                }
            }
            .padding(.horizontal, 11)
            .frame(minHeight: 30)
            .foregroundStyle(foreground)
            .background(background, in: .capsule)
            .contentShape(.capsule)
        }
        .buttonStyle(.pfPressable)
        .disabled(!isEnabled)
        .accessibilityAddTraits(.isButton)
    }

    private var foreground: Color {
        switch tone {
        case .status(let t): PFColor.statusText(t)
        case .neutral: PFColor.textMain
        case .severity(let s): PFColor.severityText(s)
        case .custom(let c): c
        }
    }

    private var background: Color {
        switch tone {
        case .status(let t): PFColor.statusFill(t)
        case .neutral: PFColor.raised
        case .severity(let s): PFColor.severity(s).opacity(0.12)
        case .custom(let c): c.opacity(0.12)
        }
    }
}

// MARK: - Tab strip

/// Scrollable segmented strip with a gliding thumb — for five-ish labels that do not fit `PFSegmented`.
public struct PFTabStrip<Value: Hashable>: View {
    let options: [(value: Value, label: String)]
    @Binding var selection: Value
    @Namespace private var glider

    public init(_ options: [(value: Value, label: String)], selection: Binding<Value>) {
        self.options = options
        self._selection = selection
    }

    public var body: some View {
        ScrollViewReader { reader in
            ScrollView(.horizontal) {
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
                                .padding(.horizontal, 11)
                                .frame(minHeight: 34)
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
                        .id(option.value)
                        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                    }
                }
                .padding(3)
                .background(PFColor.raised, in: .capsule)
                .padding(.horizontal, PFSpace.page)
            }
            .scrollIndicators(.hidden)
            .onChange(of: selection) { _, value in
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { reader.scrollTo(value, anchor: .center) }
            }
        }
    }
}

// MARK: - Detail row

/// Label on the left, value on the right; optionally tappable with a chevron. Lives inside `PFCardList`.
public struct PFDetailRow<Value: View>: View {
    let label: String
    let showsChevron: Bool
    let action: (() -> Void)?
    let value: Value

    public init(_ label: String, showsChevron: Bool = false, action: (() -> Void)? = nil, @ViewBuilder value: () -> Value) {
        self.label = label
        self.showsChevron = showsChevron
        self.action = action
        self.value = value()
    }

    public var body: some View {
        let content = HStack(alignment: .center, spacing: PFSpace.s) {
            Text(label).pfText(.meta).foregroundStyle(PFColor.textMuted)
            Spacer(minLength: PFSpace.s)
            value
                .pfText(.body)
                .foregroundStyle(PFColor.textMain)
                .multilineTextAlignment(.trailing)
            if showsChevron {
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).foregroundStyle(PFColor.textSubtle)
            }
        }
        .padding(.horizontal, PFSpace.m)
        .frame(minHeight: 52)
        .contentShape(.rect)
        if let action {
            Button(action: action) { content }
                .buttonStyle(.pfPressable)
                .accessibilityElement(children: .combine)
        } else {
            content.accessibilityElement(children: .combine)
        }
    }
}

// MARK: - Sheet header

/// Eyebrow + title block at the top of a custom sheet.
public struct PFSheetHeader: View {
    let eyebrow: String
    let title: String?

    public init(_ eyebrow: String, title: String? = nil) {
        self.eyebrow = eyebrow
        self.title = title
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            PFEyebrow(eyebrow)
            if let title { Text(title).pfText(.section).foregroundStyle(PFColor.textMain).lineLimit(2) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, PFSpace.page)
    }
}

// MARK: - Edge card

public extension View {
    /// Card with a coloured leading edge (3 pt) — the blocker card of the workbench.
    func pfEdgeCard(_ edge: Color?, radius: CGFloat = PFRadius.card) -> some View {
        modifier(PFEdgeCardModifier(edge: edge, radius: radius))
    }

    /// Floats `content` above the bottom edge on a canvas fade, so lists scroll underneath it.
    /// `isActive: false` drops the float and its fade (e.g. when the action moved to the side region).
    func pfBottomFloat<Float: View>(isActive: Bool = true, @ViewBuilder _ content: () -> Float) -> some View {
        modifier(PFBottomFloatModifier(floating: content(), isActive: isActive))
    }
}

struct PFEdgeCardModifier: ViewModifier {
    let edge: Color?
    let radius: CGFloat

    func body(content: Content) -> some View {
        content
            .background(PFColor.card, in: .rect(cornerRadius: radius, style: .continuous))
            .overlay(alignment: .leading) {
                if let edge {
                    Rectangle().fill(edge).frame(width: 3).accessibilityHidden(true)
                }
            }
            .clipShape(.rect(cornerRadius: radius, style: .continuous))
            .pfElevation(.card, radius: radius)
    }
}

struct PFBottomFloatModifier<Floating: View>: ViewModifier {
    let floating: Floating
    let isActive: Bool
    @Environment(\.pfBottomChromeHeight) private var chromeHeight

    func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if isActive { float }
        }
    }

    private var float: some View {
        floating
            .padding(.horizontal, PFSpace.page)
            // Above the focus bar when one is showing, otherwise just above the home indicator.
            .padding(.bottom, chromeHeight > 0 ? chromeHeight + 10 : 14)
            .padding(.top, 36)
            .frame(maxWidth: .infinity)
            .background {
                LinearGradient(stops: [.init(color: PFColor.canvas.opacity(0), location: 0), .init(color: PFColor.canvas.opacity(0.94), location: 0.42), .init(color: PFColor.canvas, location: 1)], startPoint: .top, endPoint: .bottom)
                    .allowsHitTesting(false)
            }
    }
}

// MARK: - Health card

/// "Wo hinschauen" card: health ring + trend, title, reason chips. Opens the project.
public struct PFHealthCard: View {
    public struct Reason: Identifiable {
        public let id: String
        public let text: String
        public let tone: PFPill.Tone

        public init(id: String, text: String, tone: PFPill.Tone) {
            self.id = id
            self.text = text
            self.tone = tone
        }
    }

    let title: String
    let subtitle: String?
    let score: Double?
    let trend: PFTrend?
    let reasons: [Reason]
    let glyph: AnyView
    let action: () -> Void

    public init<Glyph: View>(title: String, subtitle: String? = nil, score: Double?, trend: PFTrend?, reasons: [Reason],
                             action: @escaping () -> Void, @ViewBuilder glyph: () -> Glyph) {
        self.title = title
        self.subtitle = subtitle
        self.score = score
        self.trend = trend
        self.reasons = reasons
        self.glyph = AnyView(glyph())
        self.action = action
    }

    public var body: some View {
        Button {
            PFHaptics.soft()
            action()
        } label: {
            VStack(alignment: .leading, spacing: PFSpace.s) {
                HStack(alignment: .center, spacing: 10) {
                    if score == nil {
                        glyph
                    } else {
                        PFHealthRing(score: score, size: 46, lineWidth: 5)
                        if let trend { PFTrendArrow(trend, size: 15) }
                    }
                    Spacer(minLength: 0)
                    if score != nil { glyph }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).pfText(.section).foregroundStyle(PFColor.textMain).lineLimit(2).multilineTextAlignment(.leading)
                    if let subtitle { Text(subtitle).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1) }
                }
                Spacer(minLength: 0)
                HStack(spacing: 6) {
                    ForEach(reasons.prefix(2)) { reason in
                        PFPill(reason.text, tone: reason.tone, compact: true)
                    }
                }
            }
            .padding(PFSpace.m)
            .frame(width: 236, height: 178, alignment: .topLeading)
            .pfCard(radius: PFRadius.card)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Editable text

/// Inline-editable text with a placeholder (title, next step, blocker, subtask input). Single-paragraph
/// fields commit on Return or when focus leaves; read-only users just see the text.
public struct PFEditableText: View {
    let placeholder: String
    @Binding var text: String
    let style: PFTextStyle
    let color: Color
    let isEditable: Bool
    let lineLimit: ClosedRange<Int>
    let autofocus: Bool
    let onCommit: (String) -> Void
    @FocusState private var focused: Bool
    @State private var isEditing = false

    public init(_ placeholder: String, text: Binding<String>, style: PFTextStyle = .body, color: Color = PFColor.textMain,
                isEditable: Bool = true, lineLimit: ClosedRange<Int> = 1...12, autofocus: Bool = false,
                onCommit: @escaping (String) -> Void) {
        self.placeholder = placeholder
        self._text = text
        self.style = style
        self.color = color
        self.isEditable = isEditable
        self.lineLimit = lineLimit
        self.autofocus = autofocus
        self.onCommit = onCommit
    }

    public var body: some View {
        Group {
            if isEditable {
                TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(PFColor.textSubtle), axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(lineLimit)
                    .pfText(style)
                    .foregroundStyle(color)
                    .focused($focused)
                    .submitLabel(.done)
                    .onChange(of: text) { _, value in
                        if value.contains("\n") {
                            text = value.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespaces)
                            focused = false
                        }
                    }
                    .onChange(of: focused) { _, isFocused in
                        isEditing = isFocused
                        if !isFocused { onCommit(text) }
                    }
                    .onAppear { if autofocus { focused = true } }
                    // Leaving the screen (back) while typing never moves focus first: commit here too.
                    .onDisappear {
                        if isEditing {
                            isEditing = false
                            onCommit(text)
                        }
                    }
            } else {
                Text(text.isEmpty ? placeholder : text)
                    .pfText(style)
                    .foregroundStyle(text.isEmpty ? PFColor.textSubtle : color)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}
