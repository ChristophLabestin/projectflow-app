import Foundation
import PFData

/// Simple editing for wiki pages: Tiptap JSON ⇄ a Markdown-light text. Paragraphs, headings (1–3), bullet / ordered /
/// check lists (nested by two spaces), quotes, rules, **bold**, *italic*, `code`, ~~strike~~, [links](url) and @mentions
/// round-trip. Everything else (tables, callouts, code blocks, toggles, files, images, task lists, TOC) becomes a locked
/// placeholder line `⟦n⟧ Label` that maps back to the original node unchanged (delete the line to remove the block).
struct WikiEditableText {
    var text: String
    var blocks: [Int: [String: Any]]
    var mentions: [String: [String: Any]]

    // MARK: JSON → text

    static func make(from doc: [String: Any], label: (String) -> String) -> WikiEditableText {
        var editable = WikiEditableText(text: "", blocks: [:], mentions: [:])
        var out: [String] = []
        for node in doc["content"] as? [[String: Any]] ?? [] {
            out.append(editable.block(node, label: label))
        }
        editable.text = out.joined(separator: "\n\n").trimmingCharacters(in: .newlines)
        return editable
    }

    private mutating func block(_ node: [String: Any], label: (String) -> String) -> String {
        let type = node["type"] as? String ?? ""
        let content = node["content"] as? [[String: Any]] ?? []
        switch type {
        case "paragraph": return inline(content)
        case "heading":
            let level = min(max(((node["attrs"] as? [String: Any])?["level"] as? NSNumber)?.intValue ?? 1, 1), 3)
            return String(repeating: "#", count: level) + " " + inline(content)
        case "bulletList", "orderedList", "taskList": return list(node, indent: 0, label: label)
        case "blockquote":
            return content.map { "> " + ($0["type"] as? String == "paragraph" ? inline($0["content"] as? [[String: Any]] ?? []) : "") }
                .joined(separator: "\n")
        case "horizontalRule": return "---"
        default:
            let index = blocks.count
            blocks[index] = node
            let key: String = switch type {
            case "table": "wiki.block.table"
            case "wikiCallout": "wiki.block.callout"
            case "codeBlock": "wiki.block.code"
            case "details": "wiki.block.details"
            case "wikiFile": "wiki.block.file"
            case "image": "wiki.block.image"
            case "wikiTaskList": "wiki.block.taskList"
            case "wikiToc": "wiki.block.toc"
            default: "wiki.block.other"
            }
            var name = label(key)
            if type == "wikiFile", let file = (node["attrs"] as? [String: Any])?["name"] as? String, !file.isEmpty { name += ": \(file)" }
            return "⟦\(index)⟧ \(name)"
        }
    }

    private mutating func list(_ node: [String: Any], indent: Int, label: (String) -> String) -> String {
        let type = node["type"] as? String
        var lines: [String] = []
        for (index, item) in (node["content"] as? [[String: Any]] ?? []).enumerated() {
            let pad = String(repeating: "  ", count: indent)
            let marker: String
            switch type {
            case "orderedList": marker = "\(index + 1). "
            case "taskList": marker = ((item["attrs"] as? [String: Any])?["checked"] as? Bool == true) ? "- [x] " : "- [ ] "
            default: marker = "- "
            }
            var first = true
            for child in item["content"] as? [[String: Any]] ?? [] {
                let childType = child["type"] as? String
                if childType == "bulletList" || childType == "orderedList" || childType == "taskList" {
                    lines.append(list(child, indent: indent + 1, label: label))
                } else if first {
                    lines.append(pad + marker + inline(child["content"] as? [[String: Any]] ?? []))
                    first = false
                } else {
                    lines.append(pad + "  " + inline(child["content"] as? [[String: Any]] ?? []))
                }
            }
            if first { lines.append(pad + marker) }
        }
        return lines.joined(separator: "\n")
    }

    private mutating func inline(_ nodes: [[String: Any]]) -> String {
        var out = ""
        for node in nodes {
            switch node["type"] as? String {
            case "text":
                var text = node["text"] as? String ?? ""
                for mark in (node["marks"] as? [[String: Any]] ?? []).reversed() {
                    switch mark["type"] as? String {
                    case "bold": text = "**\(text)**"
                    case "italic": text = "*\(text)*"
                    case "code": text = "`\(text)`"
                    case "strike": text = "~~\(text)~~"
                    case "link":
                        if let href = (mark["attrs"] as? [String: Any])?["href"] as? String { text = "[\(text)](\(href))" }
                    default: break
                    }
                }
                out += text
            case WikiContent.mentionNode:
                let attrs = node["attrs"] as? [String: Any] ?? [:]
                let label = attrs["label"] as? String ?? ""
                mentions[label] = attrs
                out += "@\(label)"
            case "hardBreak": out += "\n"
            default: break
            }
        }
        return out
    }

    // MARK: Text → JSON

    func document() -> [String: Any] {
        var content: [[String: Any]] = []
        var paragraph: [String] = []
        var quote: [String] = []
        var listLines: [String] = []

        func flushParagraph() {
            guard !paragraph.isEmpty else { return }
            var inlines: [[String: Any]] = []
            for (index, line) in paragraph.enumerated() {
                if index > 0 { inlines.append(["type": "hardBreak"]) }
                inlines += inlineNodes(line)
            }
            content.append(inlines.isEmpty ? ["type": "paragraph"] : ["type": "paragraph", "content": inlines])
            paragraph = []
        }
        func flushQuote() {
            guard !quote.isEmpty else { return }
            content.append(["type": "blockquote", "content": quote.map { line -> [String: Any] in
                let nodes = inlineNodes(line)
                return nodes.isEmpty ? ["type": "paragraph"] : ["type": "paragraph", "content": nodes]
            }])
            quote = []
        }
        func flushList() {
            guard !listLines.isEmpty else { return }
            content += buildLists(listLines)
            listLines = []
        }
        func flushAll() { flushParagraph(); flushQuote(); flushList() }

        for raw in text.components(separatedBy: "\n") {
            let line = raw.replacingOccurrences(of: "\t", with: "  ")
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if let match = trimmed.wholeMatch(of: /⟦(\d+)⟧.*/), let index = Int(match.1), let node = blocks[index] {
                flushAll(); content.append(node); continue
            }
            if trimmed.isEmpty { flushAll(); continue }
            if Self.listMarker(line) != nil { flushParagraph(); flushQuote(); listLines.append(line); continue }
            if !listLines.isEmpty, line.hasPrefix("  ") { listLines.append(line); continue }
            flushList()
            if trimmed == "---" { flushAll(); content.append(["type": "horizontalRule"]); continue }
            if let match = trimmed.wholeMatch(of: /(#{1,3})\s+(.*)/) {
                flushAll()
                let nodes = inlineNodes(String(match.2))
                var heading: [String: Any] = ["type": "heading", "attrs": ["level": match.1.count]]
                if !nodes.isEmpty { heading["content"] = nodes }
                content.append(heading)
                continue
            }
            if trimmed.hasPrefix(">") {
                flushParagraph()
                quote.append(String(trimmed.dropFirst()).trimmingCharacters(in: .whitespaces))
                continue
            }
            flushQuote()
            paragraph.append(line)
        }
        flushAll()
        return ["type": "doc", "content": content.isEmpty ? [["type": "paragraph"]] : content]
    }

    /// (indent level, list type, checked?, rest of the line)
    private static func listMarker(_ line: String) -> (Int, String, Bool?, String)? {
        guard let match = line.wholeMatch(of: /( *)(- \[( |x|X)\] |[-*] |\d+\. )(.*)/) else { return nil }
        let level = match.1.count / 2
        let marker = String(match.2)
        if marker.hasPrefix("- [") { return (level, "taskList", match.3.map { $0 != " " } ?? false, String(match.4)) }
        if marker.first?.isNumber == true { return (level, "orderedList", nil, String(match.4)) }
        return (level, "bulletList", nil, String(match.4))
    }

    private func buildLists(_ lines: [String]) -> [[String: Any]] {
        // Items as (level, type, checked, text); continuation lines (no marker) append as extra paragraphs.
        var items: [(level: Int, type: String, checked: Bool?, paragraphs: [String])] = []
        for line in lines {
            if let marker = Self.listMarker(line) {
                items.append((marker.0, marker.1, marker.2, [marker.3]))
            } else if !items.isEmpty {
                items[items.count - 1].paragraphs.append(line.trimmingCharacters(in: .whitespaces))
            }
        }
        var index = 0
        func build(level: Int) -> [[String: Any]] {
            var lists: [[String: Any]] = []
            while index < items.count, items[index].level >= level {
                let type = items[index].type
                var listItems: [[String: Any]] = []
                while index < items.count, items[index].level == level, items[index].type == type {
                    let item = items[index]
                    index += 1
                    var children: [[String: Any]] = item.paragraphs.map { text in
                        let nodes = inlineNodes(text)
                        return nodes.isEmpty ? ["type": "paragraph"] : ["type": "paragraph", "content": nodes]
                    }
                    if index < items.count, items[index].level > level { children += build(level: level + 1) }
                    var node: [String: Any] = ["type": type == "taskList" ? "taskItem" : "listItem", "content": children]
                    if type == "taskList" { node["attrs"] = ["checked": item.checked ?? false] }
                    listItems.append(node)
                }
                if listItems.isEmpty { index += 1; continue }
                lists.append(["type": type, "content": listItems])
                if index < items.count, items[index].level < level { break }
            }
            return lists
        }
        return build(level: 0)
    }

    /// Inline Markdown-light → Tiptap text nodes with marks; `@Label` of a known mention → mention node.
    func inlineNodes(_ line: String) -> [[String: Any]] {
        var nodes: [[String: Any]] = []
        var marks: [[String: Any]] = []
        var buffer = ""
        let labels = mentions.keys.sorted { $0.count > $1.count }
        var i = line.startIndex

        func flush() {
            guard !buffer.isEmpty else { return }
            var node: [String: Any] = ["type": "text", "text": buffer]
            if !marks.isEmpty { node["marks"] = marks }
            nodes.append(node)
            buffer = ""
        }
        func toggle(_ type: String) {
            flush()
            if let index = marks.firstIndex(where: { $0["type"] as? String == type }) { marks.remove(at: index) } else { marks.append(["type": type]) }
        }

        while i < line.endIndex {
            let rest = line[i...]
            if rest.hasPrefix("**") { toggle("bold"); i = line.index(i, offsetBy: 2); continue }
            if rest.hasPrefix("~~") { toggle("strike"); i = line.index(i, offsetBy: 2); continue }
            if rest.hasPrefix("`") { toggle("code"); i = line.index(after: i); continue }
            if rest.hasPrefix("*"), !rest.hasPrefix("* ") || marks.contains(where: { $0["type"] as? String == "italic" }) {
                toggle("italic"); i = line.index(after: i); continue
            }
            if rest.hasPrefix("["), let match = rest.prefixMatch(of: /\[([^\]]+)\]\(([^)\s]+)\)/) {
                flush()
                var linkMarks = marks
                linkMarks.append(["type": "link", "attrs": ["href": String(match.2)]])
                nodes.append(["type": "text", "text": String(match.1), "marks": linkMarks])
                i = match.range.upperBound
                continue
            }
            if rest.hasPrefix("@"), let label = labels.first(where: { rest.dropFirst().hasPrefix($0) }), let attrs = mentions[label] {
                flush()
                nodes.append(["type": WikiContent.mentionNode, "attrs": attrs])
                i = line.index(i, offsetBy: label.count + 1)
                continue
            }
            buffer.append(line[i])
            i = line.index(after: i)
        }
        flush()
        return nodes
    }
}
