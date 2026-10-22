import SwiftUI
import UIKit

/// Large multi-line title input with live token highlighting (capture composer). Text input is the one
/// place where the system control stays (so dictation, autocorrect and the keyboard just work); it is
/// restyled to the design tokens, highlights ranges as capsule-like tokens and reports taps on them.
public struct CaptureTextField: View {
    @Binding var text: String
    @Binding var isFocused: Bool
    let placeholder: String
    let highlights: [NSRange]
    let submitLabel: UIReturnKeyType
    let onTapHighlight: (NSRange) -> Void
    let onSubmit: () -> Void

    public init(text: Binding<String>, isFocused: Binding<Bool>, placeholder: String, highlights: [NSRange],
                submitLabel: UIReturnKeyType = .done, onTapHighlight: @escaping (NSRange) -> Void, onSubmit: @escaping () -> Void) {
        self._text = text
        self._isFocused = isFocused
        self.placeholder = placeholder
        self.highlights = highlights
        self.submitLabel = submitLabel
        self.onTapHighlight = onTapHighlight
        self.onSubmit = onSubmit
    }

    public var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text(placeholder)
                    .font(Font(CaptureTextView.font()))
                    .foregroundStyle(PFColor.textSubtle)
                    .padding(.top, 8)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
            CaptureTextView(text: $text, isFocused: $isFocused, highlights: highlights, placeholder: placeholder,
                            submitLabel: submitLabel, onTapHighlight: onTapHighlight, onSubmit: onSubmit)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

struct CaptureTextView: UIViewRepresentable {
    @Binding var text: String
    @Binding var isFocused: Bool
    let highlights: [NSRange]
    let placeholder: String
    let submitLabel: UIReturnKeyType
    let onTapHighlight: (NSRange) -> Void
    let onSubmit: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    static let minHeight: CGFloat = 44
    static let maxHeight: CGFloat = 180

    /// Plus Jakarta Sans 22/600 (concept mock-up), scaled with Dynamic Type.
    static func font(category: UIContentSizeCategory = .large) -> UIFont {
        PFJakarta.font(size: 22, weight: 600, relativeTo: .title2, category: category)
    }

    func makeUIView(context: Context) -> FocusingTextView {
        let view = FocusingTextView()
        view.delegate = context.coordinator
        view.backgroundColor = .clear
        view.isScrollEnabled = false
        view.textContainerInset = UIEdgeInsets(top: 8, left: 0, bottom: 8, right: 0)
        view.textContainer.lineFragmentPadding = 0
        view.returnKeyType = submitLabel
        view.enablesReturnKeyAutomatically = true
        view.autocapitalizationType = .sentences
        view.accessibilityLabel = placeholder
        view.shouldFocusOnAppear = true
        view.adjustsFontForContentSizeCategory = false
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        tap.cancelsTouchesInView = false
        tap.delegate = context.coordinator
        view.addGestureRecognizer(tap)
        context.coordinator.parent = self
        context.coordinator.apply(to: view, force: true)
        return view
    }

    func updateUIView(_ view: FocusingTextView, context: Context) {
        context.coordinator.parent = self
        if view.text != text, view.markedTextRange == nil { view.text = text }
        context.coordinator.apply(to: view, force: false)
        if isFocused, !view.isFirstResponder { view.becomeFirstResponder() }
        if !isFocused, view.isFirstResponder { view.resignFirstResponder() }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: FocusingTextView, context: Context) -> CGSize? {
        let width = proposal.width ?? 320
        let fitted = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude)).height
        let clamped = min(max(fitted, Self.minHeight), Self.maxHeight)
        uiView.isScrollEnabled = fitted > Self.maxHeight
        return CGSize(width: width, height: clamped)
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UITextViewDelegate, UIGestureRecognizerDelegate {
        var parent: CaptureTextView
        private var appliedHighlights: [NSRange] = []
        private var appliedText = ""
        private var appliedCategory: UIContentSizeCategory?

        init(_ parent: CaptureTextView) { self.parent = parent }

        /// Re-applies fonts and highlight attributes without replacing the text (keeps cursor, marked text and dictation intact).
        func apply(to view: UITextView, force: Bool) {
            guard view.markedTextRange == nil else { return }
            let category = parent.dynamicTypeSize.contentSizeCategory
            let length = (view.text as NSString).length
            let valid = parent.highlights.filter { NSMaxRange($0) <= length }
            guard force || valid != appliedHighlights || view.text != appliedText || category != appliedCategory else { return }
            appliedHighlights = valid
            appliedText = view.text
            appliedCategory = category

            let font = CaptureTextView.font(category: category)
            let base: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor(PFColor.textMain)]
            let selected = view.selectedRange
            let storage = view.textStorage
            storage.beginEditing()
            storage.setAttributes(base, range: NSRange(location: 0, length: length))
            for range in valid {
                storage.addAttributes([
                    .backgroundColor: UIColor(PFColor.primary).withAlphaComponent(0.12),
                    .foregroundColor: UIColor(PFColor.textMain),
                ], range: range)
            }
            storage.endEditing()
            view.typingAttributes = base
            if view.selectedRange != selected { view.selectedRange = selected }
        }

        func textViewDidChange(_ textView: UITextView) {
            if parent.text != textView.text { parent.text = textView.text }
            textView.invalidateIntrinsicContentSize()
        }

        func textViewDidBeginEditing(_ textView: UITextView) {
            if !parent.isFocused { parent.isFocused = true }
        }

        func textViewDidEndEditing(_ textView: UITextView) {
            if parent.isFocused { parent.isFocused = false }
        }

        func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText replacement: String) -> Bool {
            if replacement == "\n" {
                parent.onSubmit()
                return false
            }
            if replacement.contains("\n") {
                // Pasted multi-line text becomes a single line.
                let joined = replacement.components(separatedBy: .newlines).joined(separator: " ")
                if let start = textView.position(from: textView.beginningOfDocument, offset: range.location),
                   let end = textView.position(from: start, offset: range.length), let textRange = textView.textRange(from: start, to: end) {
                    textView.replace(textRange, withText: joined)
                }
                return false
            }
            return true
        }

        @objc func tapped(_ recognizer: UITapGestureRecognizer) {
            guard let view = recognizer.view as? UITextView, recognizer.state == .ended else { return }
            let point = recognizer.location(in: view)
            for range in appliedHighlights {
                guard let start = view.position(from: view.beginningOfDocument, offset: range.location),
                      let end = view.position(from: start, offset: range.length),
                      let textRange = view.textRange(from: start, to: end) else { continue }
                let hit = view.selectionRects(for: textRange).contains { $0.rect.insetBy(dx: -3, dy: -6).contains(point) }
                if hit {
                    parent.onTapHighlight(range)
                    return
                }
            }
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
    }
}

/// Becomes first responder as soon as it is in a window (the composer opens with the keyboard up).
final class FocusingTextView: UITextView {
    var shouldFocusOnAppear = false

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil, shouldFocusOnAppear {
            shouldFocusOnAppear = false
            DispatchQueue.main.async { [weak self] in _ = self?.becomeFirstResponder() }
        }
    }
}
