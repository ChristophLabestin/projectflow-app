import Foundation
import PFModel

// Time-zone aware date helpers shared by `DayPlan`, `DueBuckets` and the other golden-fixture modules.
// Port of `web/utils/zonedDate.ts` — keep the two in lockstep (see `shared/fixtures/README.md`).
//
// No system clock: callers pass an explicit `now` and an IANA time zone.
//
//   instant – a point in time, milliseconds since the Unix epoch (`Double`, like JavaScript).
//   day     – a calendar day as "YYYY-MM-DD" (no time zone attached).
//
// Date-only strings ("2026-09-22") are *days*, not instants: they never shift with the time zone.
// Everything else (ISO date-times, Timestamps, epoch ms) is an instant and becomes a day by reading
// the wall clock in the zone.

/// Every shape a date field takes in Firestore data and in the golden fixtures.
public enum DateLike: Hashable, Sendable {
    case none
    case string(String)
    /// Epoch milliseconds.
    case number(Double)
    /// Firestore Timestamp (`{seconds, nanoseconds}`); nanoseconds are ignored like on the web.
    case timestamp(seconds: Double)
    /// Truthy but without an instant (e.g. an object we cannot read).
    case unparseable
    case date(Date)

    /// JavaScript truthiness (`Boolean(value)`): used for "has a due date" checks.
    public var isTruthy: Bool {
        switch self {
        case .none: false
        case .string(let value): !value.isEmpty
        case .number(let value): value != 0 && !value.isNaN
        case .timestamp, .unparseable, .date: true
        }
    }
}

extension DateLike: Decodable {
    private enum MapKeys: String, CodingKey { case seconds, _seconds }

    public init(from decoder: Decoder) throws {
        let single = try decoder.singleValueContainer()
        if single.decodeNil() { self = .none; return }
        if let string = try? single.decode(String.self) { self = .string(string); return }
        if let number = try? single.decode(Double.self) { self = .number(number); return }
        if let map = try? decoder.container(keyedBy: MapKeys.self) {
            if let seconds = try? map.decode(Double.self, forKey: .seconds) { self = .timestamp(seconds: seconds); return }
            if let seconds = try? map.decode(Double.self, forKey: ._seconds) { self = .timestamp(seconds: seconds); return }
        }
        self = .unparseable
    }
}

public enum ZonedDate {
    public static let dayMs: Double = 86_400_000
    /// `Number.MAX_SAFE_INTEGER`.
    public static let maxSafeInteger: Double = 9_007_199_254_740_991

    // MARK: Time zone

    /// The zone a plan is computed in. A missing or empty identifier means the device zone.
    public static func resolveTimeZone(_ identifier: String?) -> TimeZone {
        if let identifier, !identifier.isEmpty { return TimeZone(identifier: identifier) ?? .gmt }
        return .current
    }

    public static func identifier(_ identifier: String?) -> String {
        if let identifier, !identifier.isEmpty { return identifier }
        return TimeZone.current.identifier
    }

    /// Offset of `zone` from UTC at `instant`, in milliseconds (east positive).
    static func offsetMs(at instant: Double, in zone: TimeZone) -> Double {
        let seconds = (instant / 1000).rounded(.down)
        return Double(zone.secondsFromGMT(for: Date(timeIntervalSince1970: seconds))) * 1000
    }

    // MARK: Civil calendar arithmetic (proleptic Gregorian, no Foundation calendars)

    private static func floorDiv(_ a: Int, _ b: Int) -> Int {
        let q = a / b
        return (a % b != 0 && (a < 0) != (b < 0)) ? q - 1 : q
    }

    /// Days since 1970-01-01 for a civil date.
    static func daysFromCivil(year: Int, month: Int, day: Int) -> Int {
        let y = month <= 2 ? year - 1 : year
        let era = floorDiv(y, 400)
        let yoe = y - era * 400
        let doy = (153 * (month > 2 ? month - 3 : month + 9) + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    static func civilFromDays(_ days: Int) -> (year: Int, month: Int, day: Int) {
        let z = days + 719_468
        let era = floorDiv(z, 146_097)
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365
        let y = yoe + era * 400
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        return (m <= 2 ? y + 1 : y, m, d)
    }

    /// `Date.UTC(year, month - 1, day, ...)`: out-of-range fields roll over like JavaScript.
    static func utcMs(year: Int, month: Int, day: Int, hour: Int = 0, minute: Int = 0, second: Int = 0) -> Double {
        let monthIndex = month - 1
        let yearCarry = floorDiv(monthIndex, 12)
        let normalizedMonth = monthIndex - yearCarry * 12 + 1
        let days = daysFromCivil(year: year + yearCarry, month: normalizedMonth, day: 1) + (day - 1)
        return Double(days) * dayMs + Double(hour) * 3_600_000 + Double(minute) * 60_000 + Double(second) * 1000
    }

    private static func pad(_ value: Int, _ length: Int = 2) -> String {
        let text = String(value)
        return text.count >= length ? text : String(repeating: "0", count: length - text.count) + text
    }

    public static func formatDay(year: Int, month: Int, day: Int) -> String { "\(pad(year, 4))-\(pad(month))-\(pad(day))" }

    // MARK: Wall clock

    struct WallClock { var year: Int, month: Int, day: Int, hour: Int, minute: Int, second: Int }

    static func wallClock(at instant: Double, in zone: TimeZone) -> WallClock {
        let seconds = Int((instant / 1000).rounded(.down))
        let local = seconds + zone.secondsFromGMT(for: Date(timeIntervalSince1970: Double(seconds)))
        let days = floorDiv(local, 86_400)
        let rest = local - days * 86_400
        let civil = civilFromDays(days)
        return WallClock(year: civil.year, month: civil.month, day: civil.day, hour: rest / 3600, minute: (rest % 3600) / 60, second: rest % 60)
    }

    /// The instant at which the wall clock in `zone` reads the given fields (DST-safe two-pass lookup).
    // swiftlint:disable:next function_parameter_count
    public static func wallTimeToInstant(year: Int, month: Int, day: Int, hour: Int, minute: Int, second: Int, in zone: TimeZone) -> Double {
        let guess = utcMs(year: year, month: month, day: day, hour: hour, minute: minute, second: second)
        let firstOffset = offsetMs(at: guess, in: zone)
        let first = guess - firstOffset
        let secondOffset = offsetMs(at: first, in: zone)
        return secondOffset == firstOffset ? first : guess - secondOffset
    }

    /// Calendar day ("YYYY-MM-DD") that `instant` falls on in `zone`.
    public static func dayOfInstant(_ instant: Double, in zone: TimeZone) -> String {
        let wall = wallClock(at: instant, in: zone)
        return formatDay(year: wall.year, month: wall.month, day: wall.day)
    }

    /// "HH:mm" (24 h) wall-clock time of `instant` in `zone`.
    public static func clockLabel(_ instant: Double, in zone: TimeZone) -> String {
        let wall = wallClock(at: instant, in: zone)
        return "\(pad(wall.hour)):\(pad(wall.minute))"
    }

    // MARK: Days

    /// Parses "YYYY-MM-DD" (ASCII digits, nothing else).
    static func parseDateOnly(_ text: String) -> (year: Int, month: Int, day: Int)? {
        let bytes = Array(text.utf8)
        guard bytes.count == 10, bytes[4] == 0x2D, bytes[7] == 0x2D else { return nil }
        func number(_ range: Range<Int>) -> Int? {
            var result = 0
            for index in range {
                let byte = bytes[index]
                guard byte >= 0x30, byte <= 0x39 else { return nil }
                result = result * 10 + Int(byte - 0x30)
            }
            return result
        }
        guard let year = number(0..<4), let month = number(5..<7), let day = number(8..<10) else { return nil }
        return (year, month, day)
    }

    public static func isDateOnly(_ value: String) -> Bool {
        parseDateOnly(value.trimmingCharacters(in: .whitespacesAndNewlines)) != nil
    }

    /// Days since 1970-01-01 for a "YYYY-MM-DD" day; `nan` when the text is not a day.
    public static func dayNumber(_ day: String) -> Double {
        guard let parts = parseDateOnly(day) else { return .nan }
        return (utcMs(year: parts.year, month: parts.month, day: parts.day) / dayMs).rounded()
    }

    public static func addDays(_ day: String, _ amount: Int) -> String {
        let civil = civilFromDays(Int(dayNumber(day)) + amount)
        return formatDay(year: civil.year, month: civil.month, day: civil.day)
    }

    /// Whole days from `from` to `to` (positive when `to` is later).
    public static func daysBetween(_ from: String, _ to: String) -> Int { Int(dayNumber(to) - dayNumber(from)) }

    /// Monday = 0 … Sunday = 6.
    public static func weekdayIndex(_ day: String) -> Int {
        let number = Int(dayNumber(day))
        return (((number + 3) % 7) + 7) % 7   // 1970-01-01 was a Thursday
    }

    /// The instant at which `day` starts in `zone`; `nan` for an invalid day.
    public static func startOfDay(_ day: String, in zone: TimeZone) -> Double {
        guard let parts = parseDateOnly(day) else { return .nan }
        return wallTimeToInstant(year: parts.year, month: parts.month, day: parts.day, hour: 0, minute: 0, second: 0, in: zone)
    }

    // MARK: Parsing

    private static func parseOffset(_ text: [UInt8]) -> Double? {
        // Z | ±HH | ±HHMM | ±HH:MM — nothing may follow.
        guard let first = text.first else { return nil }
        if first == 0x5A || first == 0x7A { return text.count == 1 ? 0 : nil }
        guard first == 0x2B || first == 0x2D else { return nil }
        func digits(_ range: Range<Int>) -> Int? {
            guard range.upperBound <= text.count else { return nil }
            var value = 0
            for index in range {
                guard text[index] >= 0x30, text[index] <= 0x39 else { return nil }
                value = value * 10 + Int(text[index] - 0x30)
            }
            return value
        }
        guard let hours = digits(1..<3) else { return nil }
        var minutes = 0
        switch text.count {
        case 3: break
        case 5:
            guard let value = digits(3..<5) else { return nil }
            minutes = value
        case 6:
            guard text[3] == 0x3A, let value = digits(4..<6) else { return nil }
            minutes = value
        default: return nil
        }
        return Double((first == 0x2D ? -1 : 1) * (hours * 60 + minutes)) * 60_000
    }

    /// Parses `YYYY-MM-DD[T ]HH:mm[:ss[.fff]][ ]?(Z|±HH[:MM])?` (case-insensitive T/Z).
    private static func parseDateTime(_ text: String, in zone: TimeZone) -> Double? {
        let bytes = Array(text.utf8)
        guard bytes.count >= 16, bytes[4] == 0x2D, bytes[7] == 0x2D, bytes[13] == 0x3A else { return nil }
        guard bytes[10] == 0x54 || bytes[10] == 0x74 || bytes[10] == 0x20 else { return nil }
        func number(_ range: Range<Int>) -> Int? {
            var result = 0
            for index in range {
                guard bytes[index] >= 0x30, bytes[index] <= 0x39 else { return nil }
                result = result * 10 + Int(bytes[index] - 0x30)
            }
            return result
        }
        guard let year = number(0..<4), let month = number(5..<7), let day = number(8..<10),
              let hour = number(11..<13), let minute = number(14..<16) else { return nil }
        var second = 0
        var index = 16
        if index < bytes.count, bytes[index] == 0x3A {
            guard index + 3 <= bytes.count, let value = number((index + 1)..<(index + 3)) else { return nil }
            second = value
            index += 3
            if index < bytes.count, bytes[index] == 0x2E || bytes[index] == 0x2C {
                var cursor = index + 1
                while cursor < bytes.count, bytes[cursor] >= 0x30, bytes[cursor] <= 0x39 { cursor += 1 }
                guard cursor > index + 1 else { return nil }
                index = cursor
            }
        }
        while index < bytes.count, bytes[index] == 0x20 || bytes[index] == 0x09 || bytes[index] == 0x0A || bytes[index] == 0x0D { index += 1 }
        if index < bytes.count {
            guard let offset = parseOffset(Array(bytes[index...])) else { return nil }
            return utcMs(year: year, month: month, day: day, hour: hour, minute: minute, second: second) - offset
        }
        return wallTimeToInstant(year: year, month: month, day: day, hour: hour, minute: minute, second: second, in: zone)
    }

    /// Instant for any supported date value, or `nil` when there is none.
    ///
    /// - `.number`: epoch milliseconds · `.date` · `.timestamp(seconds:)` (nanoseconds ignored)
    /// - ISO date-time with offset: exact instant · without offset: wall-clock time in `zone`
    /// - date-only string: the start of that day in `zone`
    /// - anything else: no instant (the web falls back to the JS parser, not covered by fixtures)
    public static func toInstant(_ value: DateLike, in zone: TimeZone) -> Double? {
        switch value {
        case .none, .unparseable: return nil
        case .number(let number): return number.isFinite ? number : nil
        case .date(let date): return date.timeIntervalSince1970 * 1000
        case .timestamp(let seconds): return seconds * 1000
        case .string(let raw):
            let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty { return nil }
            if parseDateOnly(text) != nil { return startOfDay(text, in: zone) }
            return parseDateTime(text, in: zone)
        }
    }

    /// Like `toInstant`, but missing or invalid values read as 0 (the legacy `toMillis`).
    public static func toInstantOrZero(_ value: DateLike, in zone: TimeZone) -> Double { toInstant(value, in: zone) ?? 0 }

    /// Calendar day ("YYYY-MM-DD") of any supported date value, or `nil`.
    public static func toDay(_ value: DateLike, in zone: TimeZone) -> String? {
        switch value {
        case .none: return nil
        case .string(let raw):
            if raw.isEmpty { return nil }
            let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if parseDateOnly(text) != nil { return text }
        default: break
        }
        guard let instant = toInstant(value, in: zone) else { return nil }
        return dayOfInstant(instant, in: zone)
    }

    /// Sort key of a due/scheduled date: the instant (date-only values at the start of their day).
    /// Missing values sort last.
    public static func dateSortKey(_ value: DateLike, in zone: TimeZone) -> Double {
        guard value.isTruthy, let instant = toInstant(value, in: zone) else { return maxSafeInteger }
        return instant
    }

    /// Mirrors `Boolean(task.dueDate)`.
    public static func hasDateValue(_ value: DateLike) -> Bool { value.isTruthy }
}

// MARK: - From the app's model types

public extension DateLike {
    /// A `FlexDate` as the shared logic sees it: date-only values stay days, everything else an instant.
    init(_ flex: FlexDate?) {
        guard let flex else { self = .none; return }
        if flex.isDateOnly {
            let c = flex.calendarDay(in: .gmt)
            self = .string(ZonedDate.formatDay(year: c.year ?? 1970, month: c.month ?? 1, day: c.day ?? 1))
        } else {
            self = .number((flex.instant.timeIntervalSince1970 * 1000).rounded())
        }
    }

    init(_ date: Date?) {
        guard let date else { self = .none; return }
        self = .number((date.timeIntervalSince1970 * 1000).rounded())
    }
}
