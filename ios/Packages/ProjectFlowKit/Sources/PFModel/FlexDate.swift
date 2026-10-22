import Foundation

/// A date as the web app stores it. Firestore documents mix ISO date-times, date-only strings
/// (`2026-10-22`), Firestore Timestamps and `{seconds, nanoseconds}` maps. `FlexDate` keeps the
/// parsed instant plus whether the source was a calendar day without a time.
///
/// Parity note: JavaScript parses `new Date('2026-10-22')` as UTC midnight. `instant` follows that
/// rule so ported logic compares the same way the web does; `calendarDay(in:)` gives the intended
/// calendar day for display.
public struct FlexDate: Hashable, Sendable, Codable, Comparable {
    public let instant: Date
    public let isDateOnly: Bool

    public init(instant: Date, isDateOnly: Bool = false) {
        self.instant = instant
        self.isDateOnly = isDateOnly
    }

    public static func < (lhs: FlexDate, rhs: FlexDate) -> Bool { lhs.instant < rhs.instant }

    /// Parses any of the web formats. Returns nil for empty or unparseable values.
    public static func parse(_ value: Any?) -> FlexDate? {
        switch value {
        case let date as Date:
            return FlexDate(instant: date)
        case let string as String:
            return parse(string: string)
        case let number as Double:
            return FlexDate(instant: Date(timeIntervalSince1970: number > 1e12 ? number / 1000 : number))
        case let number as Int:
            let n = Double(number)
            return FlexDate(instant: Date(timeIntervalSince1970: n > 1e12 ? n / 1000 : n))
        case let map as [String: Any]:
            let seconds = (map["seconds"] ?? map["_seconds"]) as? NSNumber
            let nanos = (map["nanoseconds"] ?? map["_nanoseconds"]) as? NSNumber
            guard let seconds else { return nil }
            return FlexDate(instant: Date(timeIntervalSince1970: seconds.doubleValue + (nanos?.doubleValue ?? 0) / 1e9))
        default:
            return nil
        }
    }

    public static func parse(string raw: String) -> FlexDate? {
        let string = raw.trimmingCharacters(in: .whitespaces)
        guard !string.isEmpty else { return nil }
        if string.count == 10, let day = dateOnlyFormatter.date(from: string) {
            return FlexDate(instant: day, isDateOnly: true)
        }
        if let date = isoFractional.date(from: string) ?? isoPlain.date(from: string) {
            return FlexDate(instant: date)
        }
        // `2026-10-22T09:00` (no zone) is local time in JS.
        if let date = localDateTime.date(from: string) {
            return FlexDate(instant: date)
        }
        return nil
    }

    /// The calendar day the value refers to in `timeZone`. Date-only values keep their written day.
    public func calendarDay(in timeZone: TimeZone) -> DateComponents {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = isDateOnly ? TimeZone(identifier: "UTC")! : timeZone
        return calendar.dateComponents([.year, .month, .day], from: instant)
    }

    /// Serialises like the web writes dates: date-only as `YYYY-MM-DD`, otherwise ISO 8601 with millis.
    public var webString: String {
        isDateOnly ? FlexDate.dateOnlyFormatter.string(from: instant) : FlexDate.isoFractional.string(from: instant)
    }

    public static func dateOnly(year: Int, month: Int, day: Int) -> FlexDate {
        var components = DateComponents()
        components.year = year; components.month = month; components.day = day
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return FlexDate(instant: calendar.date(from: components)!, isDateOnly: true)
    }

    /// A date-only value for the local calendar day of `date` in `timeZone`.
    public static func day(of date: Date, in timeZone: TimeZone) -> FlexDate {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return dateOnly(year: c.year!, month: c.month!, day: c.day!)
    }

    nonisolated(unsafe) static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    nonisolated(unsafe) static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static let dateOnlyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static let localDateTime: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm"
        return f
    }()
}
