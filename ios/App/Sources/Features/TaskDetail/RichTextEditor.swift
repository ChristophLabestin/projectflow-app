import SwiftUI
import UIKit
import Observation
import PFDesign

// Description editor: a UITextView (text input, not a UI control) with basic formatting — bold,
// italic, heading, bullet and numbered lists, links — that writes simple Tiptap-compatible HTML back.
// Only used when `RichDocument.isEditable` (the HTML contains nothing the editor would lose).

extension NSAttributedString.Key {
    static let pfBlock = NSAttributedString.Key("pf.block")
    static let pfMarker = NSAttributedString.Key("pf.marker")
}

enum EditorBlock: String {
    case p, h1, h2, h3, ul, ol

    var isList: Bool { self == .ul || self == .ol }
    var isHeading: Bool { self == .h1 || self == .h2 || self == .h3 }
}

@Observable
final class RichEditorController {
    @ObservationIgnored fileprivate weak var textView: UITextView?
    private(set) var isBold = false
    private(set) var isItalic = false
    private(set) var block: EditorBlock = .p
    private(set) var hasSelection = false
    private(set) var isDirty = false
    /// Bumped on every edit so the SwiftUI wrapper re-measures its height.
    private(set) var revision = 0
    @ObservationIgnored fileprivate var isNormalizing = false

    // MARK: Attributes

    private static let markerBullet = "•\t"

    fileprivate func font(_ block: EditorBlock, bold: Bool, italic: Bool) -> UIFont {
        let base: UIFont
        switch block {
        case .h1: base = PFFont.uiFont(.title)
        case .h2: base = PFFont.uiFont(.section).withSize(PFFont.uiFont(.section).pointSize + 5)
        case .h3: base = PFFont.uiFont(.section)
        default: base = PFFont.uiFont(.body)
        }
        var traits: UIFontDescriptor.SymbolicTraits = []
        if bold && !block.isHeading { traits.insert(.traitBold) }
        if italic { traits.insert(.traitItalic) }
        guard !traits.isEmpty, let descriptor = base.fontDescriptor.withSymbolicTraits(base.fontDescriptor.symbolicTraits.union(traits)) else { return base }
        return UIFont(descriptor: descriptor, size: base.pointSize)
    }

    fileprivate func paragraphStyle(_ block: EditorBlock) -> NSParagraphStyle {
        let style = NSMutableParagraphStyle()
        style.lineSpacing = 3
        style.paragraphSpacing = block.isHeading ? 6 : 8
        if block.isList {
            style.headIndent = 26
            style.firstLineHeadIndent = 0
            style.tabStops = [NSTextTab(textAlignment: .left, location: 26)]
            style.defaultTabInterval = 26
        }
        return style
    }

    fileprivate func attributes(_ block: EditorBlock, bold: Bool = false, italic: Bool = false, link: URL? = nil) -> [NSAttributedString.Key: Any] {
        var attributes: [NSAttributedString.Key: Any] = [
            .font: font(block, bold: bold, italic: italic),
            .foregroundColor: UIColor(PFColor.textMain),
            .paragraphStyle: paragraphStyle(block),
            .pfBlock: block.rawValue,
        ]
        if let link {
            attributes[.link] = link
            attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
        }
        return attributes
    }

    private func marker(_ block: EditorBlock, index: Int = 1) -> NSAttributedString {
        var attributes = attributes(block)
        attributes[.pfMarker] = true
        attributes[.foregroundColor] = UIColor(PFColor.textMuted)
        return NSAttributedString(string: (block == .ul ? Self.markerBullet : "\(index).\t"), attributes: attributes)
    }

    // MARK: Load / export

    func load(_ document: RichDocument) {
        let result = NSMutableAttributedString()
        for (index, block) in document.blocks.enumerated() {
            let editorBlock = Self.editorBlock(block.kind)
            if editorBlock.isList {
                var number = 1
                if case .ordered(_, let n) = block.kind { number = n }
                result.append(marker(editorBlock, index: number))
            }
            for run in block.runs {
                result.append(NSAttributedString(string: run.text.replacingOccurrences(of: "\n", with: " "),
                                                 attributes: attributes(editorBlock, bold: run.bold, italic: run.italic, link: run.link)))
            }
            if index < document.blocks.count - 1 { result.append(NSAttributedString(string: "\n", attributes: attributes(editorBlock))) }
        }
        if document.blocks.isEmpty { result.append(NSAttributedString(string: "", attributes: attributes(.p))) }
        textView?.attributedText = result
        textView?.typingAttributes = attributes(document.blocks.first.map { Self.editorBlock($0.kind) } ?? .p)
        isDirty = false
        revision += 1
    }

    private static func editorBlock(_ kind: RichBlockKind) -> EditorBlock {
        switch kind {
        case .heading(let level): level == 1 ? .h1 : (level == 2 ? .h2 : .h3)
        case .bullet: .ul
        case .ordered: .ol
        default: .p
        }
    }

    func resign() { textView?.resignFirstResponder() }

    var isEmpty: Bool { (textView?.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    /// Tiptap-compatible HTML: `<p>`, `<h1–3>`, `<ul><li><p>`, `<strong>`, `<em>`, `<a href>`.
    func html() -> String {
        guard let storage = textView?.textStorage else { return "" }
        let string = storage.string as NSString
        var output = ""
        var openList: EditorBlock?
        func closeList() {
            if let list = openList { output += list == .ul ? "</ul>" : "</ol>"; openList = nil }
        }
        string.enumerateSubstrings(in: NSRange(location: 0, length: string.length), options: .byParagraphs) { _, range, _, _ in
            guard range.length > 0 else { return }
            let block = EditorBlock(rawValue: storage.attribute(.pfBlock, at: range.location, effectiveRange: nil) as? String ?? "p") ?? .p
            let markerLength = block.isList ? self.markerLength(storage, paragraph: range) : 0
            let content = NSRange(location: range.location + markerLength, length: range.length - markerLength)
            guard content.length > 0 else { return }
            let inline = self.inlineHTML(storage, range: content, block: block)
            if inline.isEmpty { return }
            if block.isList {
                if openList != block {
                    closeList()
                    output += block == .ul ? "<ul>" : "<ol>"
                    openList = block
                }
                output += "<li><p>\(inline)</p></li>"
            } else {
                closeList()
                switch block {
                case .h1, .h2, .h3: output += "<\(block.rawValue)>\(inline)</\(block.rawValue)>"
                default: output += "<p>\(inline)</p>"
                }
            }
        }
        closeList()
        return output
    }

    private func inlineHTML(_ storage: NSTextStorage, range: NSRange, block: EditorBlock) -> String {
        var html = ""
        storage.enumerateAttributes(in: range, options: []) { attributes, runRange, _ in
            let text = (storage.string as NSString).substring(with: runRange)
            var piece = RichHTML.escape(text)
            let traits = (attributes[.font] as? UIFont)?.fontDescriptor.symbolicTraits ?? []
            if traits.contains(.traitItalic) { piece = "<em>\(piece)</em>" }
            if traits.contains(.traitBold) && !block.isHeading { piece = "<strong>\(piece)</strong>" }
            if let link = attributes[.link] as? URL {
                piece = "<a href=\"\(RichHTML.escape(link.absoluteString).replacingOccurrences(of: "\"", with: "&quot;"))\">\(piece)</a>"
            } else if let link = attributes[.link] as? String {
                piece = "<a href=\"\(RichHTML.escape(link).replacingOccurrences(of: "\"", with: "&quot;"))\">\(piece)</a>"
            }
            html += piece
        }
        return html.trimmingCharacters(in: .whitespaces)
    }

    // MARK: Paragraph helpers

    fileprivate func markerLength(_ storage: NSTextStorage, paragraph: NSRange) -> Int {
        var length = 0
        while length < paragraph.length, storage.attribute(.pfMarker, at: paragraph.location + length, effectiveRange: nil) != nil { length += 1 }
        return length
    }

    fileprivate func blockAt(_ storage: NSTextStorage, _ location: Int) -> EditorBlock {
        guard storage.length > 0 else { return .p }
        let safe = min(max(location, 0), storage.length - 1)
        return EditorBlock(rawValue: storage.attribute(.pfBlock, at: safe, effectiveRange: nil) as? String ?? "p") ?? .p
    }

    fileprivate func paragraphRanges(_ storage: NSTextStorage, in selection: NSRange) -> [NSRange] {
        let string = storage.string as NSString
        guard string.length > 0 else { return [NSRange(location: 0, length: 0)] }
        var ranges: [NSRange] = []
        var location = min(selection.location, string.length)
        let end = min(selection.location + selection.length, string.length)
        repeat {
            let paragraph = string.paragraphRange(for: NSRange(location: min(location, string.length - (location >= string.length ? 1 : 0)), length: 0))
            if ranges.last != paragraph { ranges.append(paragraph) }
            location = paragraph.location + paragraph.length
        } while location < end
        // A cursor at the very end of text that ends in "\n" sits in an empty last paragraph.
        if string.length > 0, selection.location >= string.length, string.hasSuffix("\n") { ranges = [NSRange(location: string.length, length: 0)] }
        return ranges
    }

    // MARK: Toolbar actions

    func toggleBold() { toggleTrait(.traitBold) }
    func toggleItalic() { toggleTrait(.traitItalic) }

    private func toggleTrait(_ trait: UIFontDescriptor.SymbolicTraits) {
        guard let textView else { return }
        let selection = textView.selectedRange
        if selection.length == 0 {
            var typing = textView.typingAttributes
            if let font = typing[.font] as? UIFont { typing[.font] = Self.toggled(font, trait, on: !font.fontDescriptor.symbolicTraits.contains(trait)) }
            textView.typingAttributes = typing
        } else {
            let storage = textView.textStorage
            var allSet = true
            storage.enumerateAttribute(.font, in: selection) { value, _, _ in
                if let font = value as? UIFont, !font.fontDescriptor.symbolicTraits.contains(trait) { allSet = false }
            }
            storage.beginEditing()
            storage.enumerateAttribute(.font, in: selection) { value, range, _ in
                guard let font = value as? UIFont else { return }
                if trait == .traitBold, self.blockAt(storage, range.location).isHeading { return }
                storage.addAttribute(.font, value: Self.toggled(font, trait, on: !allSet), range: range)
            }
            storage.endEditing()
        }
        didEdit()
        refreshState()
    }

    private static func toggled(_ font: UIFont, _ trait: UIFontDescriptor.SymbolicTraits, on: Bool) -> UIFont {
        var traits = font.fontDescriptor.symbolicTraits
        if on { traits.insert(trait) } else { traits.remove(trait) }
        guard let descriptor = font.fontDescriptor.withSymbolicTraits(traits) else { return font }
        return UIFont(descriptor: descriptor, size: font.pointSize)
    }

    /// Heading ⇄ paragraph for the selected paragraphs (`target` toggles back to paragraph when already set).
    func setBlock(_ target: EditorBlock) {
        guard let textView else { return }
        let storage = textView.textStorage
        let ranges = paragraphRanges(storage, in: textView.selectedRange)
        let current = blockAt(storage, ranges.first?.location ?? 0)
        let newBlock: EditorBlock = current == target ? .p : target
        storage.beginEditing()
        for range in ranges.reversed() {
            if blockAt(storage, range.location).isList, range.length > 0 { removeMarker(storage, paragraph: range) }
            let fresh = paragraphRanges(storage, in: NSRange(location: range.location, length: 0)).first ?? range
            restyle(storage, paragraph: fresh, as: newBlock)
        }
        storage.endEditing()
        textView.typingAttributes = typingAttributes(for: newBlock, from: textView.typingAttributes)
        normalize()
        didEdit()
        refreshState()
    }

    func toggleList(ordered: Bool) {
        guard let textView else { return }
        let storage = textView.textStorage
        let target: EditorBlock = ordered ? .ol : .ul
        let ranges = paragraphRanges(storage, in: textView.selectedRange)
        let allTarget = ranges.allSatisfy { blockAt(storage, $0.location) == target && storage.length > 0 }
        storage.beginEditing()
        for range in ranges.reversed() {
            if blockAt(storage, range.location).isList, range.length > 0 { removeMarker(storage, paragraph: range) }
            let fresh = paragraphRanges(storage, in: NSRange(location: range.location, length: 0)).first ?? range
            if allTarget {
                restyle(storage, paragraph: fresh, as: .p)
            } else {
                restyle(storage, paragraph: fresh, as: target)
                storage.insert(marker(target), at: fresh.location)
            }
        }
        storage.endEditing()
        textView.typingAttributes = typingAttributes(for: allTarget ? .p : target, from: textView.typingAttributes)
        normalize()
        didEdit()
        refreshState()
    }

    private func typingAttributes(for block: EditorBlock, from existing: [NSAttributedString.Key: Any]) -> [NSAttributedString.Key: Any] {
        var attributes = existing
        attributes[.font] = font(block, bold: false, italic: false)
        attributes[.paragraphStyle] = paragraphStyle(block)
        attributes[.pfBlock] = block.rawValue
        attributes[.pfMarker] = nil
        attributes[.foregroundColor] = UIColor(PFColor.textMain)
        return attributes
    }

    fileprivate func removeMarker(_ storage: NSTextStorage, paragraph: NSRange) {
        let length = markerLength(storage, paragraph: paragraph)
        if length > 0 { storage.deleteCharacters(in: NSRange(location: paragraph.location, length: length)) }
    }

    /// Re-applies block attributes and fonts while keeping each run's bold/italic.
    fileprivate func restyle(_ storage: NSTextStorage, paragraph: NSRange, as block: EditorBlock) {
        guard paragraph.length > 0 else { return }
        storage.enumerateAttributes(in: paragraph, options: []) { attributes, range, _ in
            let traits = (attributes[.font] as? UIFont)?.fontDescriptor.symbolicTraits ?? []
            let wasHeading = (attributes[.pfBlock] as? String).flatMap(EditorBlock.init(rawValue:))?.isHeading ?? false
            let bold = traits.contains(.traitBold) && !wasHeading
            storage.addAttributes([
                .font: font(block, bold: bold, italic: traits.contains(.traitItalic)),
                .paragraphStyle: paragraphStyle(block),
                .pfBlock: block.rawValue,
            ], range: range)
        }
    }

    func applyLink(_ url: URL?) {
        guard let textView else { return }
        let storage = textView.textStorage
        var selection = textView.selectedRange
        if selection.length == 0, let url {
            let text = NSAttributedString(string: url.absoluteString, attributes: attributes(blockAt(storage, selection.location), link: url))
            storage.insert(text, at: selection.location)
            selection = NSRange(location: selection.location, length: text.length)
        } else if let url {
            storage.addAttributes([.link: url, .underlineStyle: NSUnderlineStyle.single.rawValue], range: selection)
        } else if selection.length > 0 {
            storage.removeAttribute(.link, range: selection)
            storage.removeAttribute(.underlineStyle, range: selection)
        }
        textView.selectedRange = NSRange(location: selection.location + selection.length, length: 0)
        didEdit()
        refreshState()
    }

    /// The link at the cursor/selection, for pre-filling the link sheet.
    var currentLink: URL? {
        guard let textView, textView.textStorage.length > 0 else { return nil }
        let location = min(max(textView.selectedRange.location, 0), textView.textStorage.length - 1)
        return textView.textStorage.attribute(.link, at: location, effectiveRange: nil) as? URL
    }

    var selectedText: String {
        guard let textView, textView.selectedRange.length > 0 else { return "" }
        return (textView.text as NSString).substring(with: textView.selectedRange)
    }

    // MARK: State

    fileprivate func didEdit() {
        isDirty = true
        revision += 1
    }

    fileprivate func refreshState() {
        guard let textView else { return }
        let storage = textView.textStorage
        let typing = textView.typingAttributes
        let traits = (typing[.font] as? UIFont)?.fontDescriptor.symbolicTraits ?? []
        isBold = traits.contains(.traitBold)
        isItalic = traits.contains(.traitItalic)
        block = blockAt(storage, textView.selectedRange.location - (textView.selectedRange.location > 0 && textView.selectedRange.location >= storage.length ? 1 : 0))
        hasSelection = textView.selectedRange.length > 0
    }

    /// Drops list styling from paragraphs whose marker was edited away and renumbers ordered lists.
    fileprivate func normalize() {
        guard let textView, !isNormalizing else { return }
        isNormalizing = true
        defer { isNormalizing = false }
        let storage = textView.textStorage
        let string = storage.string as NSString
        guard string.length > 0 else { return }
        let selection = textView.selectedRange
        var counter = 0
        var location = 0
        var delta = 0
        storage.beginEditing()
        while location < string.length {
            let paragraph = (storage.string as NSString).paragraphRange(for: NSRange(location: location, length: 0))
            let block = blockAt(storage, paragraph.location)
            if block.isList {
                let length = markerLength(storage, paragraph: paragraph)
                if length == 0 {
                    restyle(storage, paragraph: paragraph, as: .p)
                    counter = 0
                } else if block == .ol {
                    counter += 1
                    let expected = "\(counter).\t"
                    let current = (storage.string as NSString).substring(with: NSRange(location: paragraph.location, length: length))
                    if current != expected {
                        storage.replaceCharacters(in: NSRange(location: paragraph.location, length: length), with: marker(.ol, index: counter))
                        delta += expected.count - length
                    }
                } else {
                    counter = 0
                }
            } else {
                counter = 0
            }
            let updated = (storage.string as NSString).paragraphRange(for: NSRange(location: paragraph.location, length: 0))
            location = updated.location + updated.length
            if updated.length == 0 { break }
        }
        storage.endEditing()
        if delta != 0, selection.location >= 0 {
            textView.selectedRange = NSRange(location: min(max(selection.location + delta, 0), storage.length), length: selection.length)
        }
    }

    fileprivate func clampSelectionOutOfMarker() {
        guard let textView, textView.selectedRange.length == 0 else { return }
        let storage = textView.textStorage
        guard storage.length > 0 else { return }
        let location = textView.selectedRange.location
        let paragraph = (storage.string as NSString).paragraphRange(for: NSRange(location: min(location, storage.length - 1), length: 0))
        guard blockAt(storage, paragraph.location).isList else { return }
        let length = markerLength(storage, paragraph: paragraph)
        if location < paragraph.location + length { textView.selectedRange = NSRange(location: paragraph.location + length, length: 0) }
    }
}

// MARK: - SwiftUI wrapper

struct RichTextEditorView: UIViewRepresentable {
    let controller: RichEditorController

    func makeUIView(context: Context) -> UITextView {
        let textView = UITextView()
        textView.isScrollEnabled = false
        textView.backgroundColor = .clear
        textView.textContainerInset = .zero
        textView.textContainer.lineFragmentPadding = 0
        textView.allowsEditingTextAttributes = false
        textView.autocorrectionType = .default
        textView.linkTextAttributes = [.foregroundColor: UIColor(PFColor.textMain), .underlineStyle: NSUnderlineStyle.single.rawValue]
        textView.delegate = context.coordinator
        controller.textView = textView
        return textView
    }

    func updateUIView(_ textView: UITextView, context: Context) {
        _ = controller.revision
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        let width = proposal.width ?? 320
        let size = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: max(size.height, 96))
    }

    func makeCoordinator() -> Coordinator { Coordinator(controller) }

    final class Coordinator: NSObject, UITextViewDelegate {
        let controller: RichEditorController

        init(_ controller: RichEditorController) { self.controller = controller }

        func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
            let storage = textView.textStorage
            let string = storage.string as NSString

            if text == "\n" {
                let probe = min(range.location, max(string.length - 1, 0))
                let paragraph = string.length == 0 ? NSRange(location: 0, length: 0) : string.paragraphRange(for: NSRange(location: probe, length: 0))
                let block = controller.blockAt(storage, range.location > 0 && range.location >= string.length ? range.location - 1 : range.location)
                if block.isList {
                    let markerLength = controller.markerLength(storage, paragraph: paragraph)
                    let contentLength = paragraph.length - markerLength - (string.length > paragraph.location + paragraph.length - 1 && paragraph.length > 0 && string.substring(with: NSRange(location: paragraph.location + paragraph.length - 1, length: 1)) == "\n" ? 1 : 0)
                    if contentLength <= 0 {
                        // Return on an empty item ends the list.
                        storage.beginEditing()
                        controller.removeMarker(storage, paragraph: paragraph)
                        let fresh = NSRange(location: paragraph.location, length: max(paragraph.length - markerLength, 0))
                        controller.restyle(storage, paragraph: fresh, as: .p)
                        storage.endEditing()
                        textView.selectedRange = NSRange(location: paragraph.location, length: 0)
                        textView.typingAttributes = controller.attributes(.p)
                    } else {
                        let index = 1 // renumbered by `normalize()` below
                        let insertion = NSMutableAttributedString(string: "\n", attributes: controller.attributes(block))
                        var markerAttributes = controller.attributes(block)
                        markerAttributes[.pfMarker] = true
                        markerAttributes[.foregroundColor] = UIColor(PFColor.textMuted)
                        insertion.append(NSAttributedString(string: block == .ul ? "•\t" : "\(index + 1).\t", attributes: markerAttributes))
                        storage.replaceCharacters(in: range, with: insertion)
                        textView.selectedRange = NSRange(location: range.location + insertion.length, length: 0)
                        textView.typingAttributes = controller.attributes(block)
                    }
                    controller.normalize()
                    controller.didEdit()
                    controller.refreshState()
                    return false
                }
                if block.isHeading, range.location >= paragraph.location + paragraph.length - (paragraph.length > 0 && string.substring(with: NSRange(location: paragraph.location + paragraph.length - 1, length: 1)) == "\n" ? 1 : 0) {
                    // Return at the end of a heading starts a normal paragraph.
                    let insertion = NSAttributedString(string: "\n", attributes: controller.attributes(block))
                    storage.replaceCharacters(in: range, with: insertion)
                    textView.selectedRange = NSRange(location: range.location + 1, length: 0)
                    textView.typingAttributes = controller.attributes(.p)
                    controller.didEdit()
                    controller.refreshState()
                    return false
                }
                return true
            }

            if text.isEmpty, range.length >= 1, string.length > 0 {
                // Backspace into a list marker removes the marker (and the list style) instead of eating it.
                let paragraph = string.paragraphRange(for: NSRange(location: min(range.location, string.length - 1), length: 0))
                if controller.blockAt(storage, paragraph.location).isList {
                    let markerLength = controller.markerLength(storage, paragraph: paragraph)
                    if range.location < paragraph.location + markerLength, range.location + range.length <= paragraph.location + markerLength {
                        storage.beginEditing()
                        controller.removeMarker(storage, paragraph: paragraph)
                        let fresh = NSRange(location: paragraph.location, length: max(paragraph.length - markerLength, 0))
                        controller.restyle(storage, paragraph: fresh, as: .p)
                        storage.endEditing()
                        textView.selectedRange = NSRange(location: paragraph.location, length: 0)
                        textView.typingAttributes = controller.attributes(.p)
                        controller.normalize()
                        controller.didEdit()
                        controller.refreshState()
                        return false
                    }
                }
            }
            return true
        }

        func textViewDidChange(_ textView: UITextView) {
            controller.normalize()
            controller.didEdit()
            controller.refreshState()
            revealCaret(textView)
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            controller.clampSelectionOutOfMarker()
            controller.refreshState()
        }

        /// The editor does not scroll itself (it sits in the screen's scroll view), so keep the caret visible.
        private func revealCaret(_ textView: UITextView) {
            guard let end = textView.selectedTextRange?.end else { return }
            let rect = textView.caretRect(for: end).insetBy(dx: 0, dy: -48)
            var view: UIView? = textView.superview
            while let current = view, !(current is UIScrollView) { view = current.superview }
            guard let scroll = view as? UIScrollView else { return }
            scroll.scrollRectToVisible(textView.convert(rect, to: scroll), animated: true)
        }
    }
}
