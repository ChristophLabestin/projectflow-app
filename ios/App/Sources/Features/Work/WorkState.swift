import Foundation
import Observation
import PFDomain
import PFModel

/// Cross-feature handle on the Work tab: Today's week strip opens Arbeit in week mode, optionally
/// scrolled to a day. Kept here (not in the router) so the Work feature owns its own state.
@Observable
@MainActor
final class WorkNavigator {
    static let shared = WorkNavigator()

    enum Mode: String, Hashable { case list, week }

    var mode: Mode = .list
    /// "YYYY-MM-DD" the week view should scroll to when `requestToken` changes.
    private(set) var requestedDay: String?
    private(set) var requestToken = 0

    func openWeek(on day: String? = nil) {
        mode = .week
        requestedDay = day
        requestToken += 1
    }

    /// Hands out the requested day once, so returning to the week later does not scroll again.
    func consumeRequestedDay() -> String? {
        defer { requestedDay = nil }
        return requestedDay
    }
}

/// Filters of the Work screen (in memory only — Arbeit always opens unfiltered after a restart).
@Observable
@MainActor
final class WorkFilters {
    var projectIds: Set<String> = []
    var priorities: Set<TaskPriority> = []
    var includePersonal = true
    var showCompleted = false

    var isActive: Bool { !projectIds.isEmpty || !priorities.isEmpty || !includePersonal || showCompleted }

    func reset() {
        projectIds = []
        priorities = []
        includePersonal = true
        showCompleted = false
    }

    func matches(_ item: WorkItem) -> Bool {
        if item.isPersonal {
            if !includePersonal { return false }
        } else if !projectIds.isEmpty, !projectIds.contains(item.projectId ?? "") {
            return false
        }
        if !priorities.isEmpty {
            guard let priority = item.priority, priorities.contains(priority) else { return false }
        }
        return showCompleted || !item.isCompleted
    }
}

extension WorkItem: DueBucketTask {
    var dueBucketId: String { id }
    var dueBucketTitle: String { title }
    var dueBucketDate: DateLike { DateLike(dueDate) }
    var dueBucketPriority: String? { priority?.rawValue }
    var dueBucketStatus: String? { status.rawValue }
    var dueBucketIsCompleted: Bool { isCompleted }
}

/// "YYYY-MM-DD" days as the day plan and the week view use them.
enum DayString {
    /// Local midnight of the day (for formatting only).
    static func date(_ day: String) -> Date? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Formatting.calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    /// The planned day as the web stores it (`scheduledDate` / `dueDate` date-only values).
    static func flexDate(_ day: String) -> FlexDate? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return FlexDate.dateOnly(year: parts[0], month: parts[1], day: parts[2])
    }

    static func weekdayName(_ day: String) -> String {
        date(day)?.formatted(.dateTime.weekday(.wide).locale(L10n.locale)) ?? day
    }

    static func shortDate(_ day: String) -> String {
        date(day)?.formatted(.dateTime.day().month(.abbreviated).locale(L10n.locale)) ?? day
    }

    static func longDate(_ day: String) -> String {
        date(day)?.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(L10n.locale)) ?? day
    }
}
