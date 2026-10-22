import SwiftUI
import PFDesign

// Tiptap HTML (the web description editor) as read-only SwiftUI text. A small tolerant parser turns
// the HTML into blocks and inline runs; unknown tags keep their text. `isEditable` is true only when
// every tag is one the phone editor can write back losslessly (p, br, strong/b, em/i, h1–h3,
// ul/ol/li one level deep, a) — otherwise the UI offers "Im Web bearbeiten".

struct RichRun: Hashable {
    var text: String
    var bold = false
    var italic = false
    var underline = false
    var strike = false
    var code = false
    var link: URL?
}

enum RichBlockKind: Hashable {
    case paragraph
    case heading(Int)
    case bullet(depth: Int)
    case ordered(depth: Int, index: Int)
    case quote
    case code
    case rule
}

struct RichBlock: Identifiable, Hashable {
    let id = UUID()
    var kind: RichBlockKind
    var runs: [RichRun]

    var plainText: String { runs.map(\.text).joined() }
}

struct RichDocument {
    var blocks: [RichBlock]
    var isEditable: Bool

    var isEmpty: Bool { blocks.allSatisfy { $0.plainText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.kind != .rule } }
}

enum RichHTML {
    private static let editableTags: Set<String> = ["p", "br", "strong", "b", "em", "i", "h1", "h2", "h3", "ul", "ol", "li", "a"]

    static func parse(_ source: String?) -> RichDocument {
        let html = (source ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !html.isEmpty else { return RichDocument(blocks: [], isEditable: true) }
        // Plain text (legacy or personal tasks): one paragraph per line.
        if !html.contains("<") {
            let blocks = decodeEntities(html).components(separatedBy: .newlines)
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
                .map { RichBlock(kind: .paragraph, runs: [RichRun(text: $0)]) }
            return RichDocument(blocks: blocks, isEditable: true)
        }
        var parser = Parser()
        parser.run(html)
        return RichDocument(blocks: parser.blocks, isEditable: parser.isEditable)
    }

    // MARK: Parser

    private struct Parser {
        var blocks: [RichBlock] = []
        var isEditable = true

        private var runs: [RichRun] = []
        private var kind: RichBlockKind = .paragraph
        private var containerKind: RichBlockKind?
        private var lists: [(ordered: Bool, counter: Int)] = []
        private var quoteDepth = 0
        private var bold = 0, italic = 0, underline = 0, strike = 0, code = 0
        private var links: [URL?] = []
        private var inPre = false

        mutating func run(_ html: String) {
            var index = html.startIndex
            var text = ""
            func flushText(_ parser: inout Parser) {
                if !text.isEmpty { parser.addText(decodeEntities(text)); text = "" }
            }
            while index < html.endIndex {
                let character = html[index]
                if character == "<", let end = tagEnd(html, from: index) {
                    flushText(&self)
                    let raw = String(html[html.index(after: index)..<end])
                    handleTag(raw)
                    index = html.index(after: end)
                } else {
                    text.append(character)
                    index = html.index(after: index)
                }
            }
            flushText(&self)
            flush()
        }

        /// Index of the `>` closing the tag that opens at `start` (quotes in attributes are respected).
        private func tagEnd(_ html: String, from start: String.Index) -> String.Index? {
            var quote: Character?
            var index = html.index(after: start)
            while index < html.endIndex {
                let c = html[index]
                if let q = quote { if c == q { quote = nil } } else if c == "\"" || c == "'" { quote = c } else if c == ">" { return index }
                index = html.index(after: index)
            }
            return nil
        }

        private mutating func handleTag(_ raw: String) {
            var body = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if body.hasPrefix("!") || body.hasPrefix("?") { return }
            let closing = body.hasPrefix("/")
            if closing { body.removeFirst() }
            let selfClosing = body.hasSuffix("/")
            if selfClosing { body.removeLast() }
            let name = body.prefix { !$0.isWhitespace }.lowercased()
            let attributes = String(body.dropFirst(name.count))
            guard !name.isEmpty else { return }
            if !Self.knownIgnored.contains(name), !RichHTML.editableTags.contains(name) { isEditable = false }
            if closing { close(name) } else { open(name, attributes: attributes, selfClosing: selfClosing) }
        }

        /// Wrappers that carry no content or formatting of their own.
        private static let knownIgnored: Set<String> = ["html", "head", "body", "span"]

        private mutating func open(_ name: String, attributes: String, selfClosing: Bool) {
            switch name {
            case "p", "div":
                flush()
                kind = containerKind ?? (quoteDepth > 0 ? .quote : .paragraph)
            case "h1", "h2", "h3", "h4", "h5", "h6":
                flush()
                kind = .heading(Int(name.dropFirst()) ?? 2)
            case "ul", "ol":
                flush()
                if !lists.isEmpty { isEditable = false }
                lists.append((name == "ol", 0))
            case "li":
                flush()
                guard !lists.isEmpty else { containerKind = .bullet(depth: 0); kind = .bullet(depth: 0); return }
                lists[lists.count - 1].counter += 1
                let list = lists[lists.count - 1]
                let item: RichBlockKind = list.ordered ? .ordered(depth: lists.count - 1, index: list.counter) : .bullet(depth: lists.count - 1)
                containerKind = item
                kind = item
            case "blockquote":
                flush()
                quoteDepth += 1
                kind = .quote
            case "pre":
                flush()
                kind = .code
                inPre = true
            case "hr":
                flush()
                blocks.append(RichBlock(kind: .rule, runs: []))
            case "br":
                runs.append(RichRun(text: "\n"))
            case "strong", "b": bold += 1
            case "em", "i": italic += 1
            case "u": underline += 1
            case "s", "strike", "del": strike += 1
            case "code": code += 1
            case "a":
                links.append(Self.href(attributes))
            case "img":
                if let alt = Self.attribute("alt", in: attributes), !alt.isEmpty { addText(alt) }
            default: break
            }
            if selfClosing, ["p", "div", "li"].contains(name) { close(name) }
        }

        private mutating func close(_ name: String) {
            switch name {
            case "p", "div", "h1", "h2", "h3", "h4", "h5", "h6":
                flush()
            case "li":
                flush()
                containerKind = nil
            case "ul", "ol":
                flush()
                if !lists.isEmpty { lists.removeLast() }
                containerKind = nil
                kind = quoteDepth > 0 ? .quote : .paragraph
            case "blockquote":
                flush()
                quoteDepth = max(0, quoteDepth - 1)
                kind = quoteDepth > 0 ? .quote : .paragraph
            case "pre":
                flush()
                inPre = false
            case "strong", "b": bold = max(0, bold - 1)
            case "em", "i": italic = max(0, italic - 1)
            case "u": underline = max(0, underline - 1)
            case "s", "strike", "del": strike = max(0, strike - 1)
            case "code": code = max(0, code - 1)
            case "a": if !links.isEmpty { links.removeLast() }
            default: break
            }
        }

        private mutating func addText(_ raw: String) {
            var text = raw
            if !inPre {
                text = text.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
                if runs.isEmpty || runs.last?.text.hasSuffix("\n") == true { text = String(text.drop { $0 == " " }) }
            }
            guard !text.isEmpty else { return }
            var run = RichRun(text: text, bold: bold > 0, italic: italic > 0, underline: underline > 0, strike: strike > 0, code: code > 0)
            run.link = links.last ?? nil
            if let last = runs.last, last.bold == run.bold, last.italic == run.italic, last.underline == run.underline,
               last.strike == run.strike, last.code == run.code, last.link == run.link {
                runs[runs.count - 1].text += run.text
            } else {
                runs.append(run)
            }
        }

        private mutating func flush() {
            defer {
                runs = []
                kind = containerKind ?? (quoteDepth > 0 ? .quote : .paragraph)
            }
            guard !runs.isEmpty else { return }
            // Trim the trailing space HTML whitespace collapsing leaves at the block end.
            if var last = runs.popLast() {
                last.text = last.text.replacingOccurrences(of: "[ \\n]+$", with: "", options: .regularExpression)
                if !last.text.isEmpty { runs.append(last) }
            }
            guard !runs.isEmpty else { return }
            blocks.append(RichBlock(kind: kind, runs: runs))
        }

        private static func attribute(_ name: String, in attributes: String) -> String? {
            let pattern = "\\b\(name)\\s*=\\s*(\"([^\"]*)\"|'([^']*)')"
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
                  let match = regex.firstMatch(in: attributes, range: NSRange(attributes.startIndex..., in: attributes)) else { return nil }
            for group in [2, 3] {
                if let range = Range(match.range(at: group), in: attributes) { return decodeEntities(String(attributes[range])) }
            }
            return nil
        }

        private static func href(_ attributes: String) -> URL? {
            guard let value = attribute("href", in: attributes) else { return nil }
            guard let url = URL(string: value), let scheme = url.scheme?.lowercased(), ["http", "https", "mailto", "tel"].contains(scheme) else { return nil }
            return url
        }
    }

    // MARK: Entities

    static func decodeEntities(_ text: String) -> String {
        guard text.contains("&") else { return text }
        var result = text
        let named = ["&nbsp;": " ", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…"]
        for (entity, value) in named { result = result.replacingOccurrences(of: entity, with: value) }
        if let regex = try? NSRegularExpression(pattern: "&#(x?[0-9a-fA-F]+);") {
            let matches = regex.matches(in: result, range: NSRange(result.startIndex..., in: result)).reversed()
            for match in matches {
                guard let full = Range(match.range, in: result), let codeRange = Range(match.range(at: 1), in: result) else { continue }
                let code = String(result[codeRange])
                let value = code.hasPrefix("x") ? UInt32(code.dropFirst(), radix: 16) : UInt32(code)
                if let value, let scalar = Unicode.Scalar(value) { result.replaceSubrange(full, with: String(Character(scalar))) }
            }
        }
        return result.replacingOccurrences(of: "&amp;", with: "&")
    }

    static func escape(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
    }
}

// MARK: - View

/// Read-only rendering of a description (headings, bold, italic, lists, links; unknown blocks as text).
struct RichTextView: View {
    let html: String?
    var color: Color = PFColor.textMain

    var body: some View {
        let document = RichHTML.parse(html)
        VStack(alignment: .leading, spacing: 10) {
            ForEach(document.blocks) { block in
                blockView(block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .tint(PFColor.textMain)
    }

    @ViewBuilder
    private func blockView(_ block: RichBlock) -> some View {
        switch block.kind {
        case .paragraph:
            Text(attributed(block.runs)).pfText(.body).foregroundStyle(color).fixedSize(horizontal: false, vertical: true)
        case .heading(let level):
            Text(attributed(block.runs)).pfText(level == 1 ? .title : .section).foregroundStyle(color)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)
                .accessibilityAddTraits(.isHeader)
        case .bullet(let depth):
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("•").pfText(.body).foregroundStyle(PFColor.textMuted).frame(width: 14, alignment: .center)
                Text(attributed(block.runs)).pfText(.body).foregroundStyle(color).fixedSize(horizontal: false, vertical: true)
            }
            .padding(.leading, CGFloat(depth) * 18)
        case .ordered(let depth, let index):
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(index).").pfText(.body).foregroundStyle(PFColor.textMuted).frame(minWidth: 20, alignment: .trailing)
                Text(attributed(block.runs)).pfText(.body).foregroundStyle(color).fixedSize(horizontal: false, vertical: true)
            }
            .padding(.leading, CGFloat(depth) * 18)
        case .quote:
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 1.5).fill(PFColor.hairlineStrong).frame(width: 3)
                Text(attributed(block.runs)).pfText(.body).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            }
            .fixedSize(horizontal: false, vertical: true)
        case .code:
            Text(block.plainText)
                .font(.system(size: 14, design: .monospaced))
                .foregroundStyle(color)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
        case .rule:
            Rectangle().fill(PFColor.hairline).frame(height: 1)
        }
    }

    private func attributed(_ runs: [RichRun]) -> AttributedString {
        var result = AttributedString()
        for run in runs {
            var piece = AttributedString(run.text)
            var intent: InlinePresentationIntent = []
            if run.bold { intent.insert(.stronglyEmphasized) }
            if run.italic { intent.insert(.emphasized) }
            if run.code { intent.insert(.code) }
            if run.strike { intent.insert(.strikethrough) }
            if !intent.isEmpty { piece.inlinePresentationIntent = intent }
            if run.underline { piece.underlineStyle = .single }
            if let link = run.link {
                piece.link = link
                piece.underlineStyle = .single
            }
            result.append(piece)
        }
        return result
    }
}
