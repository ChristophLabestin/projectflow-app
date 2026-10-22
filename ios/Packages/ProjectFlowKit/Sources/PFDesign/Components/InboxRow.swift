import SwiftUI
import UIKit
import CoreText
import PFModel

/// Jakarta at an explicit size/weight for the few places that sit between two `PFTextStyle`s.
enum PFJakarta {
    static func font(size: CGFloat, weight: CGFloat, relativeTo style: UIFont.TextStyle, category: UIContentSizeCategory = .large) -> UIFont {
        PFFont.registerIfNeeded()
        let weightAxis = 0x7767_6874 // 'wght'
        let descriptor = UIFontDescriptor(fontAttributes: [
            .family: "Plus Jakarta Sans",
            kCTFontVariationAttribute as UIFontDescriptor.AttributeName: [weightAxis: weight],
        ])
        let base = UIFont(descriptor: descriptor, size: size)
        return UIFontMetrics(forTextStyle: style).scaledFont(for: base, compatibleWith: UITraitCollection(preferredContentSizeCategory: category))
    }
}

/// "SEIT GESTERN ABEND" eyebrow with the one-sentence summary underneath (editorial headline, like Today).
public struct PFInboxSummary: View {
    let eyebrow: String
    let sentence: String
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    public init(eyebrow: String, sentence: String) {
        self.eyebrow = eyebrow
        self.sentence = sentence
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            PFEyebrow(eyebrow)
            Text(sentence)
                .font(Font(PFJakarta.font(size: 20, weight: 700, relativeTo: .title3, category: dynamicTypeSize.contentSizeCategory)))
                .tracking(-0.3)
                .lineSpacing(3)
                .foregroundStyle(PFColor.textMain)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Round tile with an SF Symbol for inbox entries without a person behind them (briefing, reminder, invite).
public struct PFInboxSymbol: View {
    let systemImage: String

    public init(systemImage: String) { self.systemImage = systemImage }

    public var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(PFColor.textMuted)
            .frame(width: 36, height: 36)
            .background(PFColor.raised, in: .circle)
            .accessibilityHidden(true)
    }
}

/// One inbox entry: leading avatar/symbol, unread dot, headline, time, optional quote, the affected
/// task as a mini row and a footer for the primary action (buttons or inline reply).
public struct PFInboxRow<Leading: View, Mini: View, Footer: View>: View {
    let isUnread: Bool
    let title: String
    let message: String?
    let time: String
    let tag: String?
    let leading: Leading
    let mini: Mini
    let footer: Footer

    public init(isUnread: Bool, title: String, message: String? = nil, time: String, tag: String? = nil,
                @ViewBuilder leading: () -> Leading, @ViewBuilder mini: () -> Mini, @ViewBuilder footer: () -> Footer) {
        self.isUnread = isUnread
        self.title = title
        self.message = message
        self.time = time
        self.tag = tag
        self.leading = leading()
        self.mini = mini()
        self.footer = footer()
    }

    public var body: some View {
        HStack(alignment: .top, spacing: PFSpace.s) {
            leading.padding(.top, 1)
            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    if isUnread {
                        PFDot(PFColor.primary, size: 8).alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 3 }
                    }
                    Text(title)
                        .pfText(.rowTitle)
                        .foregroundStyle(isUnread ? PFColor.textMain : PFColor.textMuted)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(time).pfText(.caption).foregroundStyle(PFColor.textMuted).lineLimit(1)
                }
                if let tag {
                    PFPill(tag, compact: true)
                }
                if let message, !message.isEmpty {
                    Text(message)
                        .pfText(.meta)
                        .foregroundStyle(PFColor.textMuted)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                mini
                footer
            }
        }
        .padding(.horizontal, PFSpace.m)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
    }
}

/// The affected task as a compact row inside an inbox entry: status pill · title · due.
public struct PFInboxMiniTask: View {
    let title: String
    let statusLabel: String
    let statusTone: StatusTone
    let meta: String?
    let metaSeverity: Severity
    let isDone: Bool

    public init(title: String, statusLabel: String, statusTone: StatusTone, meta: String? = nil, metaSeverity: Severity = .neutral,
                isDone: Bool = false) {
        self.title = title
        self.statusLabel = statusLabel
        self.statusTone = statusTone
        self.meta = meta
        self.metaSeverity = metaSeverity
        self.isDone = isDone
    }

    public var body: some View {
        HStack(spacing: 8) {
            PFPill(statusLabel, tone: .status(statusTone), compact: true)
            Text(title)
                .pfText(.metaStrong)
                .foregroundStyle(isDone ? PFColor.textMuted : PFColor.textMain)
                .strikethrough(isDone, color: PFColor.textMuted)
                .lineLimit(1)
            if let meta {
                Text("·").pfText(.meta).foregroundStyle(PFColor.textMuted)
                Text(meta).pfText(.meta).foregroundStyle(PFColor.severityText(metaSeverity)).lineLimit(1).layoutPriority(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 8)
        .frame(minHeight: 34)
        .background(PFColor.raisedSoft, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// Inline reply field of an inbox entry: filled input with a round send button.
public struct PFInboxReplyField: View {
    @Binding var text: String
    let placeholder: String
    let sendLabel: String
    let isSending: Bool
    let onSend: () -> Void
    @SwiftUI.FocusState private var focused: Bool

    public init(text: Binding<String>, placeholder: String, sendLabel: String, isSending: Bool = false, onSend: @escaping () -> Void) {
        self._text = text
        self.placeholder = placeholder
        self.sendLabel = sendLabel
        self.isSending = isSending
        self.onSend = onSend
    }

    private var canSend: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending }

    public var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(PFColor.textSubtle), axis: .vertical)
                .textFieldStyle(.plain)
                .pfText(.body)
                .foregroundStyle(PFColor.textMain)
                .lineLimit(1...5)
                .focused($focused)
                .submitLabel(.send)
                .onSubmit { if canSend { onSend() } }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(PFColor.raised, in: .rect(cornerRadius: 20, style: .continuous))
            Button {
                PFHaptics.tap()
                onSend()
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(canSend ? PFColor.onPrimary : PFColor.textSubtle)
                    .frame(width: 40, height: 40)
                    .background(canSend ? PFColor.primary : PFColor.raised, in: .circle)
            }
            .buttonStyle(.pfPressable)
            .disabled(!canSend)
            .accessibilityLabel(sendLabel)
        }
        .onAppear { focused = true }
    }
}
