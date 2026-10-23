import Foundation

// Query grammar and ranking of the global search. Port of `web/utils/globalSearch.ts`
// (fixtures: `shared/fixtures/globalSearch*`): prefixes `>` `#` `!` `?` and the filters
// `is:open|done|overdue|today|mine`, `prio:urgent|high|medium|low`.

public enum SearchScope: String, Sendable, CaseIterable {
    case all, projects, tasks, initiatives, commands, help
}

public enum SearchTaskFilter: String, Sendable, CaseIterable {
    case open, done, overdue, today, mine
}

public enum SearchPriorityFilter: String, Sendable, CaseIterable {
    case urgent, high, medium, low
}

public struct SearchQuery: Equatable, Sendable {
    public var raw: String
    /// Scope forced by a leading prefix (`>`, `#`, `!`, `?`), if any.
    public var prefixScope: SearchScope?
    /// Normalised (diacritics stripped, lower-cased) search words.
    public var terms: [String]
    public var taskFilters: [SearchTaskFilter]
    public var priority: SearchPriorityFilter?

    public init(raw: String = "", prefixScope: SearchScope? = nil, terms: [String] = [], taskFilters: [SearchTaskFilter] = [],
                priority: SearchPriorityFilter? = nil) {
        self.raw = raw
        self.prefixScope = prefixScope
        self.terms = terms
        self.taskFilters = taskFilters
        self.priority = priority
    }

    /// True when the query carries filters that only make sense for tasks.
    public var hasTaskFilters: Bool { !taskFilters.isEmpty || priority != nil }

    /// True when there is nothing to search for yet (no terms, filters or prefix).
    public var isEmpty: Bool { terms.isEmpty && !hasTaskFilters && prefixScope == nil }

    public static let scopePrefixes: [Character: SearchScope] = [">": .commands, "#": .projects, "!": .tasks, "?": .help]

    // MARK: Parsing

    public static func parse(_ input: String) -> SearchQuery {
        var rest = Substring(input.drop(while: { $0.isWhitespace }))
        var prefixScope: SearchScope?
        if let first = rest.first, let scope = scopePrefixes[first] {
            prefixScope = scope
            rest = rest.dropFirst()
        }

        var terms: [String] = []
        var taskFilters: [SearchTaskFilter] = []
        var priority: SearchPriorityFilter?

        for word in rest.split(whereSeparator: { $0.isWhitespace }) {
            let lower = normalize(String(word))
            let parts = lower.split(separator: ":", omittingEmptySubsequences: false)
            let key = parts.first.map(String.init) ?? ""
            let value = parts.count > 1 ? String(parts[1]) : ""
            if !value.isEmpty, key == "is", let filter = SearchTaskFilter(rawValue: value) {
                taskFilters.append(filter)
                continue
            }
            if !value.isEmpty, key == "prio" || key == "priority", let filter = SearchPriorityFilter(rawValue: value) {
                priority = filter
                continue
            }
            terms.append(lower)
        }
        return SearchQuery(raw: input, prefixScope: prefixScope, terms: terms, taskFilters: taskFilters, priority: priority)
    }

    /// Lower-case and strip diacritics so "Übersicht" matches "ubersicht".
    public static func normalize(_ value: String) -> String {
        var scalars = String.UnicodeScalarView()
        for scalar in value.decomposedStringWithCanonicalMapping.unicodeScalars where !(0x0300...0x036F).contains(scalar.value) {
            scalars.append(scalar)
        }
        return String(scalars).lowercased()
    }

    // MARK: Scoring

    private static func isWordBoundary(_ character: Character) -> Bool {
        character.isWhitespace || "-_/.,:;()[]".contains(character)
    }

    /// True if every character of `needle` appears in order in `haystack`.
    private static func isSubsequence(_ needle: String, _ haystack: String) -> Bool {
        var needleIterator = needle.unicodeScalars.makeIterator()
        var next = needleIterator.next()
        for scalar in haystack.unicodeScalars {
            guard let wanted = next else { return true }
            if scalar == wanted { next = needleIterator.next() }
        }
        return next == nil
    }

    /// Start of title beats start of word beats substring beats fuzzy subsequence.
    private static func scoreTerm(_ term: String, in text: String) -> Double {
        if let range = text.range(of: term, options: .literal) {
            if range.lowerBound == text.startIndex { return 4 }
            let previous = text[text.index(before: range.lowerBound)]
            return isWordBoundary(previous) ? 3 : 1.5
        }
        if term.utf16.count >= 3, isSubsequence(term, text) { return 0.5 }
        return 0
    }

    /// Scores one candidate: every term must match the title or one of the secondary texts
    /// (description, project name, keywords). Returns 0 for no match. Same numbers as the web.
    public static func score(terms: [String], title: String, secondary: [String] = []) -> Double {
        if terms.isEmpty { return 1 }
        let normTitle = normalize(title)
        let normSecondary = secondary.filter { !$0.isEmpty }.map(normalize)
        var score = 0.0
        for term in terms {
            let titleScore = scoreTerm(term, in: normTitle)
            if titleScore > 0 {
                score += titleScore
                continue
            }
            if normSecondary.contains(where: { $0.contains(term) }) {
                score += 0.75
                continue
            }
            return 0
        }
        if normTitle == terms.joined(separator: " ") { score += 3 }
        return score
    }

    /// Ranges of `text` that match any term (for highlighting), merged and sorted.
    public static func highlightRanges(in text: String, terms: [String]) -> [Range<String.Index>] {
        guard !text.isEmpty, !terms.isEmpty else { return [] }
        let characters = Array(text)
        let folded: [Character] = characters.map { character in
            normalize(String(character)).first ?? character
        }
        var spans: [(Int, Int)] = []
        for term in terms where !term.isEmpty {
            let needle = Array(term)
            guard needle.count <= folded.count else { continue }
            var start = 0
            while start + needle.count <= folded.count {
                if Array(folded[start..<(start + needle.count)]) == needle {
                    spans.append((start, start + needle.count))
                    start += needle.count
                } else {
                    start += 1
                }
            }
        }
        spans.sort { $0.0 < $1.0 }
        var merged: [(Int, Int)] = []
        for span in spans {
            if let last = merged.last, span.0 <= last.1 {
                merged[merged.count - 1].1 = max(last.1, span.1)
            } else {
                merged.append(span)
            }
        }
        return merged.map { span in
            let lower = text.index(text.startIndex, offsetBy: span.0)
            let upper = text.index(text.startIndex, offsetBy: span.1)
            return lower..<upper
        }
    }
}

/// Fuzzy ranker for local results (projects, tasks, people): drops non-matches, orders by score,
/// keeps the input order for ties (stable), optionally boosted by a caller-supplied bonus.
public enum SearchRanker {
    public static func rank<Item>(_ items: [Item], terms: [String], title: (Item) -> String,
                                  secondary: (Item) -> [String] = { _ in [] },
                                  bonus: (Item) -> Double = { _ in 0 }, limit: Int? = nil) -> [Item] {
        var scored: [(index: Int, score: Double, item: Item)] = []
        for (index, item) in items.enumerated() {
            let base = SearchQuery.score(terms: terms, title: title(item), secondary: secondary(item))
            guard base > 0 else { continue }
            scored.append((index, base + bonus(item), item))
        }
        scored.sort { $0.score != $1.score ? $0.score > $1.score : $0.index < $1.index }
        let ordered = scored.map(\.item)
        if let limit { return Array(ordered.prefix(limit)) }
        return ordered
    }
}
