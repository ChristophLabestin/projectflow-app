import Foundation
import PFModel

/// A date value the way `web/utils/zonedDate.ts` accepts it (`DateLike`): date-only strings are calendar
/// *days*, other strings are ISO date-times, numbers are epoch milliseconds and `{seconds}` maps are
/// Firestore timestamps. Used by the golden-fixture modules so web and iOS read dates identically.
public enum AttentionDate: Sendable, Hashable, Decodable {
    case absent
    case text(String)
    case millis(Double)
    case seconds(Double)

    private enum Keys: String, CodingKey { case seconds, _seconds }

    public init(from decoder: any Decoder) throws {
        if let keyed = try? decoder.container(keyedBy: Keys.self) {
            if let value = try? keyed.decode(Double.self, forKey: .seconds) { self = .seconds(value); return }
            if let value = try? keyed.decode(Double.self, forKey: ._seconds) { self = .seconds(value); return }
            self = .absent
            return
        }
        let single = try decoder.singleValueContainer()
        if single.decodeNil() { self = .absent; return }
        if let text = try? single.decode(String.self) { self = .text(text); return }
        if let number = try? single.decode(Double.self) { self = .millis(number); return }
        self = .absent
    }

    /// Bridges the app's `FlexDate` (date-only values stay calendar days).
    public init(_ date: FlexDate?) {
        guard let date else { self = .absent; return }
        self = date.isDateOnly ? .text(date.webString) : .millis((date.instant.timeIntervalSince1970 * 1000).rounded())
    }

    public init(_ date: Date) { self = .millis((date.timeIntervalSince1970 * 1000).rounded()) }

    /// The legacy `Boolean(value)` check: any non-empty value counts as present.
    public var isPresent: Bool {
        switch self {
        case .absent: false
        case .text(let text): !text.isEmpty
        case .millis(let value): value != 0
        case .seconds: true
        }
    }
}

/// Time-zone aware date arithmetic ported from `web/utils/zonedDate.ts`.
/// "Day" is a `YYYY-MM-DD` string; "instant" is milliseconds since the Unix epoch.
enum AttentionZone {
    static let dayMs: Double = 86_400_000

    // MARK: Pure calendar arithmetic

    /// Days since 1970-01-01 of a civil date (Howard Hinnant's `days_from_civil`).
    static func daysFromCivil(_ year: Int, _ month: Int, _ day: Int) -> Int {
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let mp = (month + 9) % 12
        let doy = (153 * mp + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    static func civilFromDays(_ days: Int) -> (year: Int, month: Int, day: Int) {
        let z = days + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365
        let y = yoe + era * 400
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        return (m <= 2 ? y + 1 : y, m, d)
    }

    static func formatDay(_ year: Int, _ month: Int, _ day: Int) -> String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    static func parseDay(_ text: String) -> (year: Int, month: Int, day: Int)? {
        guard text.count == 10 else { return nil }
        let parts = text.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
        return (y, m, d)
    }

    static func dayNumber(_ day: String) -> Int? {
        parseDay(day).map { daysFromCivil($0.year, $0.month, $0.day) }
    }

    static func addDays(_ day: String, _ amount: Int) -> String {
        guard let base = dayNumber(day) else { return day }
        let civil = civilFromDays(base + amount)
        return formatDay(civil.year, civil.month, civil.day)
    }

    /// Whole days from `from` to `to` (positive when `to` is later). Nil when either is not a day.
    static func daysBetween(_ from: String, _ to: String) -> Int? {
        guard let a = dayNumber(from), let b = dayNumber(to) else { return nil }
        return b - a
    }

    // MARK: Zones

    static func zone(_ identifier: String?) -> TimeZone {
        if let identifier, let zone = TimeZone(identifier: identifier) { return zone }
        return .current
    }

    static func offsetAt(_ instant: Double, _ zone: TimeZone) -> Double {
        Double(zone.secondsFromGMT(for: Date(timeIntervalSince1970: (instant / 1000).rounded(.down)))) * 1000
    }

    static func utcMillis(_ y: Int, _ mo: Int, _ d: Int, _ h: Int, _ mi: Int, _ s: Int) -> Double {
        Double(daysFromCivil(y, mo, d)) * dayMs + Double(h) * 3_600_000 + Double(mi) * 60_000 + Double(s) * 1000
    }

    /// The instant at which the wall clock in `zone` reads the given fields.
    static func wallTimeToInstant(_ y: Int, _ mo: Int, _ d: Int, _ h: Int, _ mi: Int, _ s: Int, _ zone: TimeZone) -> Double {
        let guess = utcMillis(y, mo, d, h, mi, s)
        let firstOffset = offsetAt(guess, zone)
        let first = guess - firstOffset
        let secondOffset = offsetAt(first, zone)
        return secondOffset == firstOffset ? first : guess - secondOffset
    }

    static func dayOfInstant(_ instant: Double, _ zone: TimeZone) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let c = calendar.dateComponents([.year, .month, .day], from: Date(timeIntervalSince1970: instant / 1000))
        return formatDay(c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }

    static func startOfDay(_ day: String, _ zone: TimeZone) -> Double? {
        parseDay(day).map { wallTimeToInstant($0.year, $0.month, $0.day, 0, 0, 0, zone) }
    }

    // MARK: Values

    private static let dateTime = try! NSRegularExpression(
        pattern: #"^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$"#,
        options: [.caseInsensitive])

    private static func parseOffset(_ raw: String) -> Double {
        if raw.uppercased() == "Z" { return 0 }
        let sign: Double = raw.hasPrefix("-") ? -1 : 1
        let digits = raw.dropFirst().replacingOccurrences(of: ":", with: "")
        let hours = Double(digits.prefix(2)) ?? 0
        let minutes = digits.count > 2 ? Double(digits.dropFirst(2).prefix(2)) ?? 0 : 0
        return sign * (hours * 60 + minutes) * 60 * 1000
    }

    static func isDateOnly(_ text: String) -> Bool { parseDay(text.trimmingCharacters(in: .whitespacesAndNewlines)) != nil }

    /// Instant for any supported date value, or nil when there is none (`toInstant`).
    static func toInstant(_ value: AttentionDate?, _ zone: TimeZone) -> Double? {
        switch value {
        case .absent, nil: return nil
        case .millis(let number): return number.isFinite ? number : nil
        case .seconds(let seconds): return seconds * 1000
        case .text(let raw):
            let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty { return nil }
            if parseDay(text) != nil { return startOfDay(text, zone) }
            let range = NSRange(text.startIndex..., in: text)
            guard let match = dateTime.firstMatch(in: text, range: range) else { return nil }
            func group(_ index: Int) -> String? {
                Range(match.range(at: index), in: text).map { String(text[$0]) }
            }
            guard let y = group(1).flatMap(Int.init), let mo = group(2).flatMap(Int.init), let d = group(3).flatMap(Int.init),
                  let h = group(4).flatMap(Int.init), let mi = group(5).flatMap(Int.init) else { return nil }
            let s = group(6).flatMap(Int.init) ?? 0
            if let offset = group(7) { return utcMillis(y, mo, d, h, mi, s) - parseOffset(offset) }
            return wallTimeToInstant(y, mo, d, h, mi, s, zone)
        }
    }

    static func toInstantOrZero(_ value: AttentionDate?, _ zone: TimeZone) -> Double { toInstant(value, zone) ?? 0 }

    /// Calendar day of any supported date value, or nil (`toDay`).
    static func toDay(_ value: AttentionDate?, _ zone: TimeZone) -> String? {
        switch value {
        case .absent, nil: return nil
        case .text(let raw):
            let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if parseDay(text) != nil { return text }
        default: break
        }
        return toInstant(value, zone).map { dayOfInstant($0, zone) }
    }

    /// Sort key of a due date: the instant, missing values last (`dateSortKey`).
    static func dateSortKey(_ value: AttentionDate?, _ zone: TimeZone) -> Double {
        guard let value, value.isPresent, let instant = toInstant(value, zone) else { return 9_007_199_254_740_991 }
        return instant
    }
}
