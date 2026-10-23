import Foundation

// "My tasks" grouping by due date (web work list, iOS Arbeit). Port of `web/utils/dueBuckets.ts`:
// Overdue → Today → Next 7 days → Later → No date → Completed. Pinned by the golden fixtures in
// `shared/fixtures/dueBuckets/` (see `shared/fixtures/README.md`).

public enum DueBucket: String, Hashable, Sendable, Codable, CaseIterable {
    case overdue, today, week, later
    /// No (valid) due date. Raw value `none` like the web.
    case undated = "none"
}

public enum DueGroupKey: String, Hashable, Sendable, Codable, CaseIterable {
    case overdue, today, week, later
    /// No (valid) due date. Raw value `none` like the web.
    case undated = "none"
    case done

    /// Display order of the groups.
    public static let order: [DueGroupKey] = [.overdue, .today, .week, .later, .undated, .done]
}

/// Anything that can be grouped by due date (app work items, fixture tasks).
public protocol DueBucketTask {
    var dueBucketId: String { get }
    var dueBucketTitle: String { get }
    var dueBucketDate: DateLike { get }
    var dueBucketPriority: String? { get }
    var dueBucketStatus: String? { get }
    var dueBucketIsCompleted: Bool { get }
}

public struct DueContext: Hashable, Sendable, Decodable {
    /// The current moment (instant).
    public var now: DateLike
    /// IANA time zone that defines "today". Defaults to the device zone.
    public var timeZone: String?

    public init(now: DateLike, timeZone: String? = nil) {
        self.now = now
        self.timeZone = timeZone
    }

    private enum CodingKeys: String, CodingKey { case now, timeZone }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        now = try c.decodeIfPresent(DateLike.self, forKey: .now) ?? .none
        timeZone = try c.decodeIfPresent(String.self, forKey: .timeZone)
    }
}

public struct DueGroup<Task: DueBucketTask> {
    public var key: DueGroupKey
    public var tasks: [Task]
}

public struct DueSummary: Hashable, Sendable, Codable {
    public var overdue = 0
    public var today = 0
    /// Due within the next 7 days (tomorrow … today + 7).
    public var week = 0
    /// Open tasks in total.
    public var open = 0
}

/// A task as the fixtures describe it (`{ id, title, dueDate?, priority?, status?, isCompleted? }`).
public struct DueBucketFixtureTask: Hashable, Sendable, Decodable, DueBucketTask {
    public var id: String
    public var title: String
    public var dueDate: DateLike
    public var priority: String?
    public var status: String?
    public var isCompleted: Bool?

    private enum CodingKeys: String, CodingKey { case id, title, dueDate, priority, status, isCompleted }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        dueDate = try c.decodeIfPresent(DateLike.self, forKey: .dueDate) ?? .none
        priority = try c.decodeIfPresent(String.self, forKey: .priority)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        isCompleted = try c.decodeIfPresent(Bool.self, forKey: .isCompleted)
    }

    public var dueBucketId: String { id }
    public var dueBucketTitle: String { title }
    public var dueBucketDate: DateLike { dueDate }
    public var dueBucketPriority: String? { priority }
    public var dueBucketStatus: String? { status }
    public var dueBucketIsCompleted: Bool { isCompleted == true }
}

public enum DueBuckets {
    private static let priorityRank: [String: Int] = ["Urgent": 4, "High": 3, "Medium": 2, "Low": 1]

    /// `Todo` is a legacy alias of `Open`; completed tasks always read as `Done`.
    public static func normalizeStatus(isCompleted: Bool, status: String?) -> String {
        if isCompleted { return "Done" }
        if status == nil || status == "" || status == "Todo" { return "Open" }
        return status!
    }

    public static func normalizeStatus(_ task: some DueBucketTask) -> String {
        normalizeStatus(isCompleted: task.dueBucketIsCompleted, status: task.dueBucketStatus)
    }

    private static func today(_ context: DueContext) -> (zone: TimeZone, today: String) {
        let zone = ZonedDate.resolveTimeZone(context.timeZone)
        let nowMs = ZonedDate.toInstantOrZero(context.now, in: zone)
        return (zone, ZonedDate.toDay(.number(nowMs), in: zone) ?? "1970-01-01")
    }

    private static func bucket(forDiff diff: Int?) -> DueBucket {
        guard let diff else { return .undated }
        if diff < 0 { return .overdue }
        if diff == 0 { return .today }
        if diff <= 7 { return .week }
        return .later
    }

    /// Whole days between today and the due day (negative = past), or `nil` without a valid date.
    public static func daysUntilDue(_ value: DateLike, context: DueContext) -> Int? {
        let (zone, today) = today(context)
        guard let day = ZonedDate.toDay(value, in: zone) else { return nil }
        return ZonedDate.daysBetween(today, day)
    }

    /// Groups a due date for "what should I do next" lists.
    public static func bucket(for value: DateLike, context: DueContext) -> DueBucket {
        bucket(forDiff: daysUntilDue(value, context: context))
    }

    /// Earliest due first (undated last), then higher priority, then title. Returns < 0, 0 or > 0.
    public static func compareWork(_ a: some DueBucketTask, _ b: some DueBucketTask, zone: TimeZone, locale: Locale = Locale(identifier: "en_US")) -> Double {
        let date = ZonedDate.dateSortKey(a.dueBucketDate, in: zone) - ZonedDate.dateSortKey(b.dueBucketDate, in: zone)
        if date != 0 { return date }
        let rankA = priorityRank[(a.dueBucketPriority?.isEmpty ?? true) ? "Medium" : a.dueBucketPriority!] ?? 0
        let rankB = priorityRank[(b.dueBucketPriority?.isEmpty ?? true) ? "Medium" : b.dueBucketPriority!] ?? 0
        if rankA != rankB { return Double(rankB - rankA) }
        switch a.dueBucketTitle.compare(b.dueBucketTitle, locale: locale) {
        case .orderedAscending: return -1
        case .orderedDescending: return 1
        case .orderedSame: return 0
        }
    }

    /// Splits tasks into the ordered due groups (empty groups are omitted). Open tasks are sorted
    /// with `compareWork`; completed tasks form a trailing `done` group sorted by due date, latest
    /// first (undated first).
    public static func group<Task: DueBucketTask>(_ tasks: [Task], context: DueContext, locale: Locale = Locale(identifier: "en_US")) -> [DueGroup<Task>] {
        let (zone, today) = today(context)
        let open = stableSorted(tasks.filter { !$0.dueBucketIsCompleted }) { compareWork($0, $1, zone: zone, locale: locale) }
        let done = tasks.filter(\.dueBucketIsCompleted)

        func bucketOf(_ task: Task) -> DueBucket {
            guard let day = ZonedDate.toDay(task.dueBucketDate, in: zone) else { return .undated }
            return bucket(forDiff: ZonedDate.daysBetween(today, day))
        }

        var groups: [DueGroup<Task>] = [DueBucket.overdue, .today, .week, .later, .undated].map { key in
            DueGroup(key: DueGroupKey(rawValue: key.rawValue) ?? .undated, tasks: open.filter { bucketOf($0) == key })
        }
        let sortedDone = stableSorted(done) {
            ZonedDate.dateSortKey($1.dueBucketDate, in: zone) - ZonedDate.dateSortKey($0.dueBucketDate, in: zone)
        }
        groups.append(DueGroup(key: .done, tasks: sortedDone))
        return groups.filter { !$0.tasks.isEmpty }
    }

    /// Summary counts for the page header ("2 overdue · 1 today · 4 this week").
    public static func summarize(_ tasks: [some DueBucketTask], context: DueContext) -> DueSummary {
        var summary = DueSummary()
        let (zone, today) = today(context)
        for task in tasks where !task.dueBucketIsCompleted {
            summary.open += 1
            guard let day = ZonedDate.toDay(task.dueBucketDate, in: zone) else { continue }
            let diff = ZonedDate.daysBetween(today, day)
            if diff < 0 { summary.overdue += 1 } else if diff == 0 { summary.today += 1 } else if diff <= 7 { summary.week += 1 }
        }
        return summary
    }
}
