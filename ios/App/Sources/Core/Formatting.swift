import Foundation
import PFDesign
import PFModel

/// Date and due-text helpers shared by all features (same wording as the web due chips).
enum Formatting {
    static var timeZone: TimeZone { .current }

    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        calendar.locale = L10n.locale
        calendar.firstWeekday = 2
        return calendar
    }

    /// Whole-day distance from today to the value's calendar day (negative = past).
    static func dayOffset(_ date: FlexDate, now: Date = .now) -> Int {
        let day = date.calendarDay(in: timeZone)
        guard let target = calendar.date(from: day) else { return 0 }
        return calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: target)).day ?? 0
    }

    static func severity(due: FlexDate?, isDone: Bool = false, now: Date = .now) -> Severity {
        if isDone { return .done }
        guard let due else { return .neutral }
        let offset = dayOffset(due, now: now)
        if offset < 0 { return .overdue }
        if offset == 0 { return .due }
        return .neutral
    }

    /// "Seit 3 Tagen überfällig", "Heute fällig", "Morgen", "Freitag", "Fr., 24. Okt."
    static func dueText(_ due: FlexDate?, now: Date = .now) -> String? {
        guard let due else { return nil }
        let offset = dayOffset(due, now: now)
        switch offset {
        case ..<(-1): return L10n.plural("due.overdueDays", -offset)
        case -1: return L10n.t("due.yesterday")
        case 0: return L10n.t("due.today")
        case 1: return L10n.t("due.tomorrow")
        case 2...6: return weekday(due)
        default: return shortDate(due)
        }
    }

    static func date(_ value: FlexDate) -> Date? { calendar.date(from: value.calendarDay(in: timeZone)) }

    static func weekday(_ value: FlexDate) -> String {
        date(value)?.formatted(.dateTime.weekday(.wide).locale(L10n.locale)) ?? ""
    }

    static func shortDate(_ value: FlexDate) -> String {
        date(value)?.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).locale(L10n.locale)) ?? ""
    }

    static func time(_ date: Date) -> String {
        date.formatted(.dateTime.hour().minute().locale(L10n.locale))
    }

    static func longToday(_ now: Date = .now) -> String {
        now.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(L10n.locale))
    }

    static func relative(_ date: Date, now: Date = .now) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = L10n.locale
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: now)
    }

    /// Date-only value for today + `days` in the user's time zone (how the web stores planned days).
    static func day(offset days: Int, from now: Date = .now) -> FlexDate {
        let date = calendar.date(byAdding: .day, value: days, to: now) ?? now
        return FlexDate.day(of: date, in: timeZone)
    }

    static func nextWeekday(_ weekday: Int, from now: Date = .now) -> FlexDate {
        let date = calendar.nextDate(after: now, matching: DateComponents(weekday: weekday), matchingPolicy: .nextTime) ?? now
        return FlexDate.day(of: date, in: timeZone)
    }

    /// Quick picks used by swipe "Später…", capture and day close.
    static var quickDates: [(id: String, label: String, value: FlexDate)] {
        [
            ("today", L10n.t("common.today"), day(offset: 0)),
            ("tomorrow", L10n.t("common.tomorrow"), day(offset: 1)),
            ("weekend", L10n.t("common.weekend"), nextWeekday(7)),
            ("nextWeek", L10n.t("common.nextWeek"), nextWeekday(2)),
        ]
    }
}
