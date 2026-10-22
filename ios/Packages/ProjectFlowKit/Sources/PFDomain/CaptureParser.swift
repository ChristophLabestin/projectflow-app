import Foundation
import PFModel

// Quick-capture token parser (concept §5.3): `#projekt`, `@person` and natural dates in German and
// English ("morgen", "next monday", "in 2 Wochen", "am 24.10.", "Oct 24") become chips; the title is
// the text without them. There is deliberately no `!` token (priority is a chip; `!` means tasks in search).

/// A project or person the parser may resolve `#`/`@` tokens against.
public struct CaptureEntity: Hashable, Sendable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct CaptureToken: Identifiable, Hashable, Sendable {
    public enum Kind: String, Sendable { case project, person, date }

    public let kind: Kind
    /// UTF-16 range inside the parsed text (matches `NSRange`/`NSString`).
    public let range: NSRange
    /// The matched text exactly as typed.
    public let text: String
    /// Resolved project/person id.
    public let entityId: String?
    /// Resolved calendar day for date tokens.
    public let day: FlexDate?

    public var id: String { "\(kind.rawValue):\(range.location):\(range.length)" }

    /// Stable identity used to remember "the user undid this highlight" across edits.
    public var key: String { "\(kind.rawValue):\(text.lowercased())" }

    public func stringRange(in string: String) -> Range<String.Index>? { Range(range, in: string) }
}

public struct CaptureParseResult: Equatable, Sendable {
    /// The text without tokens, whitespace collapsed.
    public var title: String
    /// Active tokens, sorted by position.
    public var tokens: [CaptureToken]

    public var projectId: String? { tokens.first { $0.kind == .project }?.entityId }
    public var personId: String? { tokens.first { $0.kind == .person }?.entityId }
    public var dueDate: FlexDate? { tokens.first { $0.kind == .date }?.day }
}

public enum CaptureParser {
    public struct Options: Sendable {
        public var now: Date
        public var calendar: Calendar
        public var projects: [CaptureEntity]
        public var people: [CaptureEntity]
        /// `CaptureToken.key` values the user switched off by tapping the highlight.
        public var dismissed: Set<String>
        /// Ask `NSDataDetector` when none of the own rules found a date.
        public var usesDataDetector: Bool

        public init(now: Date = .now, calendar: Calendar = .current, projects: [CaptureEntity] = [], people: [CaptureEntity] = [],
                    dismissed: Set<String> = [], usesDataDetector: Bool = true) {
            self.now = now
            self.calendar = calendar
            self.projects = projects
            self.people = people
            self.dismissed = dismissed
            self.usesDataDetector = usesDataDetector
        }
    }

    public static func parse(_ text: String, options: Options = Options()) -> CaptureParseResult {
        let ns = text as NSString
        let full = NSRange(location: 0, length: ns.length)
        var tokens: [CaptureToken] = []

        // 1. `#project` and `@person`
        for (kind, regex, entities) in [(CaptureToken.Kind.project, Rules.project, options.projects),
                                        (CaptureToken.Kind.person, Rules.person, options.people)] {
            for match in regex.matches(in: text, range: full) {
                let typed = ns.substring(with: match.range)
                let word = ns.substring(with: match.range(at: 1))
                guard let entity = resolve(word, among: entities) else { continue }
                let token = CaptureToken(kind: kind, range: match.range, text: typed, entityId: entity.id, day: nil)
                if !options.dismissed.contains(token.key) { tokens.append(token) }
            }
        }
        // One project and one person at most: the first one wins, the others stay in the title.
        tokens = firstOf(.project, in: tokens) + firstOf(.person, in: tokens)

        // 2. one date: leftmost-longest own rule, else the data detector
        let occupied = tokens.map(\.range)
        let candidates = dateCandidates(in: text, ns: ns, options: options)
            .filter { candidate in !occupied.contains { NSIntersectionRange($0, candidate.range).length > 0 } }
            .filter { candidate in !options.dismissed.contains("date:\(ns.substring(with: candidate.range).lowercased())") }
        var date = candidates.first
        if date == nil, options.usesDataDetector {
            date = detectorCandidate(in: text, ns: ns, options: options, avoiding: occupied)
                .flatMap { options.dismissed.contains("date:\(ns.substring(with: $0.range).lowercased())") ? nil : $0 }
        }
        if let date {
            tokens.append(CaptureToken(kind: .date, range: date.range, text: ns.substring(with: date.range), entityId: nil, day: date.day))
        }

        tokens.sort { $0.range.location < $1.range.location }
        return CaptureParseResult(title: cleanTitle(text, removing: tokens.map(\.range)), tokens: tokens)
    }

    private static func firstOf(_ kind: CaptureToken.Kind, in tokens: [CaptureToken]) -> [CaptureToken] {
        tokens.filter { $0.kind == kind }.sorted { $0.range.location < $1.range.location }.prefix(1).map { $0 }
    }

    // MARK: Entities

    /// Best match for a typed `#word`/`@word`: start of name beats start of a word beats inside a word.
    public static func resolve(_ word: String, among entities: [CaptureEntity]) -> CaptureEntity? {
        let terms = SearchQuery.normalize(word)
            .split(whereSeparator: { "-_".contains($0) }).map(String.init)
        guard !terms.isEmpty else { return nil }
        var best: (entity: CaptureEntity, score: Double)?
        for entity in entities {
            let score = SearchQuery.score(terms: terms, title: entity.name)
            guard score >= 1.5 else { continue }
            if best == nil || score > best!.score || (score == best!.score && entity.name.count < best!.entity.name.count) {
                best = (entity, score)
            }
        }
        return best?.entity
    }

    // MARK: Title

    private static func cleanTitle(_ text: String, removing ranges: [NSRange]) -> String {
        let mutable = NSMutableString(string: text)
        for range in ranges.sorted(by: { $0.location > $1.location }) {
            mutable.replaceCharacters(in: range, with: " ")
        }
        var title = String(mutable)
        while title.contains("  ") { title = title.replacingOccurrences(of: "  ", with: " ") }
        title = title.replacingOccurrences(of: " ,", with: ",").replacingOccurrences(of: " ;", with: ";")
        let trim = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: ",;:-–—"))
        return title.trimmingCharacters(in: trim)
    }

    // MARK: Dates

    struct Candidate {
        var range: NSRange
        var day: FlexDate
        var isWeekday = false
    }

    fileprivate struct Context {
        let now: Date
        let calendar: Calendar

        var today: Date { calendar.startOfDay(for: now) }
        var weekday: Int { calendar.component(.weekday, from: today) }

        func day(offset days: Int) -> FlexDate? {
            calendar.date(byAdding: .day, value: days, to: today).map { FlexDate.day(of: $0, in: calendar.timeZone) }
        }

        func day(addingMonths months: Int) -> FlexDate? {
            calendar.date(byAdding: .month, value: months, to: today).map { FlexDate.day(of: $0, in: calendar.timeZone) }
        }

        /// Days until the next `weekday` (1 = Sunday … 7 = Saturday); `inclusive` lets today count.
        func distance(to weekday: Int, inclusive: Bool) -> Int {
            let delta = (weekday - self.weekday + 7) % 7
            return delta == 0 && !inclusive ? 7 : delta
        }

        /// A day/month (optionally with year); without a year the next upcoming occurrence.
        func date(day: Int, month: Int, year: Int?) -> FlexDate? {
            guard (1...31).contains(day), (1...12).contains(month) else { return nil }
            let currentYear = calendar.component(.year, from: today)
            let years: [Int]
            if let year {
                years = [year < 100 ? 2000 + year : year]
            } else {
                years = (0...4).map { currentYear + $0 }
            }
            for candidateYear in years {
                var parts = DateComponents()
                parts.year = candidateYear; parts.month = month; parts.day = day
                guard let date = calendar.date(from: parts),
                      calendar.component(.day, from: date) == day, calendar.component(.month, from: date) == month else { continue }
                if year == nil, date < today { continue }
                return FlexDate.day(of: date, in: calendar.timeZone)
            }
            return nil
        }
    }

    private static func dateCandidates(in text: String, ns: NSString, options: Options) -> [Candidate] {
        let context = Context(now: options.now, calendar: options.calendar)
        let full = NSRange(location: 0, length: ns.length)
        var found: [Candidate] = []
        for rule in Rules.dates {
            for match in rule.regex.matches(in: text, range: full) {
                func group(_ index: Int) -> String? {
                    let range = match.range(at: index)
                    return range.location == NSNotFound ? nil : ns.substring(with: range).lowercased()
                }
                if let day = rule.resolve(group, context) {
                    found.append(Candidate(range: match.range, day: day, isWeekday: rule.isWeekday))
                }
            }
        }
        // Leftmost wins, longest at the same position.
        found.sort { $0.range.location != $1.range.location ? $0.range.location < $1.range.location : $0.range.length > $1.range.length }
        var chosen: [Candidate] = []
        for candidate in found where !chosen.contains(where: { NSIntersectionRange($0.range, candidate.range).length > 0 }) {
            chosen.append(candidate)
        }
        // "Freitag, 24.10." — an explicit date right behind a weekday name wins and swallows the name.
        var merged: [Candidate] = []
        var index = 0
        while index < chosen.count {
            let current = chosen[index]
            if current.isWeekday, index + 1 < chosen.count, !chosen[index + 1].isWeekday {
                let next = chosen[index + 1]
                let gap = NSRange(location: NSMaxRange(current.range), length: max(next.range.location - NSMaxRange(current.range), 0))
                let between = next.range.location >= NSMaxRange(current.range) ? ns.substring(with: gap) : "x"
                if between.count <= 3, between.allSatisfy({ ", .".contains($0) }), !between.isEmpty {
                    merged.append(Candidate(range: NSUnionRange(current.range, next.range), day: next.day))
                    index += 2
                    continue
                }
            }
            merged.append(current)
            index += 1
        }
        return merged
    }

    // MARK: Data detector fallback

    private static func detectorCandidate(in text: String, ns: NSString, options: Options, avoiding occupied: [NSRange]) -> Candidate? {
        guard let detector = Rules.detector else { return nil }
        let context = Context(now: options.now, calendar: options.calendar)
        let limit = options.calendar.date(byAdding: .year, value: 2, to: context.today) ?? context.today
        for match in detector.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            guard let date = match.date, match.range.length >= 3,
                  !occupied.contains(where: { NSIntersectionRange($0, match.range).length > 0 }) else { continue }
            // The detector also reports times ("5pm") and starts matches at unrelated words ("Lunch the 30th").
            // Accept only matches that begin with a digit, a month/weekday name or a relative word, and that
            // do not just mean "today at some time".
            let matched = ns.substring(with: match.range)
            let firstWord = matched.lowercased().prefix(while: { $0.isLetter || $0.isNumber })
            let startsLikeADate = firstWord.first?.isNumber == true || Rules.months[String(firstWord)] != nil
                || Rules.weekdays[String(firstWord)] != nil || Rules.relativeWords.contains(String(firstWord))
            guard startsLikeADate else { continue }
            let day = options.calendar.startOfDay(for: date)
            let mentionsToday = matched.lowercased().contains("today") || matched.lowercased().contains("heute") || matched.lowercased().contains("tonight")
            guard day >= context.today, day <= limit, day > context.today || mentionsToday else { continue }
            return Candidate(range: match.range, day: FlexDate.day(of: day, in: options.calendar.timeZone))
        }
        return nil
    }
}

// MARK: - Rules

private extension CaptureParser {
    struct DateRule: Sendable {
        let regex: NSRegularExpression
        var isWeekday = false
        /// Receives the lower-cased capture groups; nil rejects the match.
        let resolve: @Sendable (_ group: (Int) -> String?, _ context: Context) -> FlexDate?
    }

    enum Rules {
        static let project = regex(#"(?<![\p{L}\p{N}])#([\p{L}\p{N}_\-]+)"#)
        static let person = regex(#"(?<![\p{L}\p{N}.])@([\p{L}\p{N}_\-]+)"#)

        static let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue)

        static func regex(_ pattern: String) -> NSRegularExpression {
            // The patterns are literals in this file; a failure is a programming error caught by the tests.
            // swiftlint:disable:next force_try
            try! NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
        }

        // Pieces shared by the date rules.
        static let start = #"(?<![\p{L}\p{N}])"#
        static let end = #"(?![\p{L}\p{N}])"#
        /// "bis zum", "am", "on", "by" … directly before a date are part of the date phrase.
        static let lead = #"(?:(?:bis(?:\s+zum|\s+spätestens|\s+spaetestens)?|spätestens|spaetestens|am|zum|für|fuer|on|by|due|until|till|before|for)\s+)?"#
        static let daypart = #"(?:\s+(?:früh|frueh|morgens|vormittags?|mittags?|nachmittags?|abends?|nachts?|morning|afternoon|evening|night))?"#

        static let months: [String: Int] = [
            "januar": 1, "january": 1, "jan": 1, "februar": 2, "february": 2, "feb": 2,
            "märz": 3, "maerz": 3, "march": 3, "mär": 3, "mrz": 3, "mar": 3, "april": 4, "apr": 4,
            "mai": 5, "may": 5, "juni": 6, "june": 6, "jun": 6, "juli": 7, "july": 7, "jul": 7,
            "august": 8, "aug": 8, "september": 9, "sept": 9, "sep": 9, "oktober": 10, "october": 10, "okt": 10, "oct": 10,
            "november": 11, "nov": 11, "dezember": 12, "december": 12, "dez": 12, "dec": 12,
        ]
        static var monthPattern: String { months.keys.sorted { $0.count > $1.count }.joined(separator: "|") }

        static let weekdays: [String: Int] = [
            "sonntag": 1, "sunday": 1, "montag": 2, "monday": 2, "mon": 2, "dienstag": 3, "tuesday": 3, "tues": 3, "tue": 3,
            "mittwoch": 4, "wednesday": 4, "donnerstag": 5, "thursday": 5, "thurs": 5, "thur": 5, "thu": 5,
            "freitag": 6, "friday": 6, "fri": 6, "samstag": 7, "sonnabend": 7, "saturday": 7,
        ]
        static var weekdayPattern: String { weekdays.keys.sorted { $0.count > $1.count }.joined(separator: "|") }

        static let relativeWords: Set<String> = ["next", "this", "coming", "tomorrow", "today", "tonight", "morgen", "heute", "übermorgen", "nächsten", "nächste", "kommenden"]

        static let numberWords: [String: Int] = [
            "ein": 1, "eine": 1, "einem": 1, "einer": 1, "einen": 1, "a": 1, "an": 1, "one": 1,
            "zwei": 2, "two": 2, "drei": 3, "three": 3, "vier": 4, "four": 4, "fünf": 5, "fuenf": 5, "five": 5,
            "sechs": 6, "six": 6, "sieben": 7, "seven": 7, "acht": 8, "eight": 8, "neun": 9, "nine": 9,
            "zehn": 10, "ten": 10, "zwölf": 12, "zwoelf": 12, "twelve": 12,
        ]
        static var numberPattern: String { (numberWords.keys.sorted { $0.count > $1.count } + [#"\d{1,2}"#]).joined(separator: "|") }

        static func number(_ word: String?) -> Int? {
            guard let word else { return nil }
            return Int(word) ?? numberWords[word]
        }

        static let dates: [DateRule] = [
            // heute / today / tonight
            DateRule(regex: regex(start + lead + #"(heute|today|tonight)"# + end + #"(?:\s+(?:morgen|morgens|früh|frueh|vormittags?|mittags?|nachmittags?|abends?|nachts?|morning|afternoon|evening|night))?"#),
                     resolve: { _, context in context.day(offset: 0) }),
            // übermorgen / day after tomorrow
            DateRule(regex: regex(start + lead + #"(?:[üu]bermorgen|uebermorgen|(?:the\s+)?day\s+after\s+tomorrow)"# + end + daypart),
                     resolve: { _, context in context.day(offset: 2) }),
            // morgen / tomorrow
            DateRule(regex: regex(start + lead + #"(?:morgen|tomorrow|tmrw|tmr)"# + end + daypart),
                     resolve: { _, context in context.day(offset: 1) }),
            // (nächsten|diesen|next|this) Montag, am Freitag, on friday
            DateRule(regex: regex(start + lead + #"(?:(n[äa]e?chste[nrms]?|kommende[nrms]?|diese[nrms]?|next|this|coming)\s+)?("# + weekdayPattern + #")"# + end + daypart),
                     isWeekday: true,
                     resolve: { group, context in
                         guard let name = group(2), let weekday = weekdays[name] else { return nil }
                         let modifier = group(1) ?? ""
                         let inclusive = modifier.hasPrefix("diese") || modifier == "this"
                         return context.day(offset: context.distance(to: weekday, inclusive: inclusive))
                     }),
            // übernächste / nächste Woche, next week → Monday
            DateRule(regex: regex(start + lead + #"(?:([üu]e?bern[äa]e?chste[nrms]?)|(?:n[äa]e?chste[nrms]?|kommende[nrms]?|next|coming|following))\s+(?:woche|week)"# + end),
                     resolve: { group, context in
                         let weeks = group(1) != nil ? 1 : 0
                         return context.day(offset: context.distance(to: 2, inclusive: false) + 7 * weeks)
                     }),
            // Wochenende / (this|next) weekend → Saturday
            DateRule(regex: regex(start + lead + #"(?:(?:dieses|diesem|kommendes|kommenden|n[äa]e?chstes|n[äa]e?chsten|this|next|coming|the)\s+)?(?:wochenende|weekend)"# + end),
                     resolve: { _, context in context.day(offset: context.distance(to: 7, inclusive: true)) }),
            // in 2 Wochen / in 3 days / in einem Monat
            DateRule(regex: regex(start + #"in\s+("# + numberPattern + #")\s+(tag(?:en|e)?|wochen?|monat(?:en|e)?|days?|weeks?|months?)"# + end),
                     resolve: { group, context in
                         guard let count = number(group(1)), count > 0, let unit = group(2) else { return nil }
                         if unit.hasPrefix("tag") || unit.hasPrefix("day") { return context.day(offset: count) }
                         if unit.hasPrefix("woche") || unit.hasPrefix("week") { return context.day(offset: 7 * count) }
                         return context.day(addingMonths: count)
                     }),
            // 2026-10-24
            DateRule(regex: regex(start + lead + #"(\d{4})-(\d{2})-(\d{2})"# + end),
                     resolve: { group, context in
                         guard let year = group(1).flatMap(Int.init), let month = group(2).flatMap(Int.init), let day = group(3).flatMap(Int.init) else { return nil }
                         return context.date(day: day, month: month, year: year)
                     }),
            // 24.10. / 24.10.2026 / 24.10.26
            DateRule(regex: regex(start + lead + #"(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?(?![\p{L}\p{N}])"#),
                     resolve: { group, context in
                         guard let day = group(1).flatMap(Int.init), let month = group(2).flatMap(Int.init) else { return nil }
                         return context.date(day: day, month: month, year: group(3).flatMap(Int.init))
                     }),
            // am 24.10 / bis 24.10 (no trailing dot, only behind a preposition)
            DateRule(regex: regex(start + #"(?:am|bis(?:\s+zum)?|zum)\s+(\d{1,2})\.(\d{1,2})(?![\p{L}\p{N}.])"#),
                     resolve: { group, context in
                         guard let day = group(1).flatMap(Int.init), let month = group(2).flatMap(Int.init) else { return nil }
                         return context.date(day: day, month: month, year: nil)
                     }),
            // 24. Oktober (2026) / 24 Oct / 24th of October
            DateRule(regex: regex(start + lead + #"(\d{1,2})(?:st|nd|rd|th|\.)?\s*(?:of\s+)?("# + monthPattern + #")\.?(?:\s*,?\s*(\d{4}))?"# + end),
                     resolve: { group, context in
                         guard let day = group(1).flatMap(Int.init), let month = group(2).flatMap({ months[$0] }) else { return nil }
                         return context.date(day: day, month: month, year: group(3).flatMap(Int.init))
                     }),
            // Oct 24 / October 24th / Oct 24, 2026
            DateRule(regex: regex(start + lead + #"("# + monthPattern + #")\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?!\d)(?:\s*,?\s*(\d{4})(?!\d))?"# + end),
                     resolve: { group, context in
                         guard let month = group(1).flatMap({ months[$0] }), let day = group(2).flatMap(Int.init) else { return nil }
                         return context.date(day: day, month: month, year: group(3).flatMap(Int.init))
                     }),
        ]
    }
}
