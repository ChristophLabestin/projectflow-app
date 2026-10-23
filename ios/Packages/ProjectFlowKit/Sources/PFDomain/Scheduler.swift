import Foundation
import PFModel

/// Port of `web/utils/scheduler.ts` (`distributeTasks`, "Smart verteilen"): spreads open tasks over the
/// next working days so nobody carries more than `maxItemsPerDay` tasks on one day. Works on calendar
/// days ("YYYY-MM-DD") instead of JS `Date`s, so it is deterministic and timezone-free.
public struct SchedulerPreferences: Hashable, Sendable {
    public var maxItemsPerDay: Int
    public var includeWeekends: Bool
    public var prioritizeOverdue: Bool

    public init(maxItemsPerDay: Int = 5, includeWeekends: Bool = false, prioritizeOverdue: Bool = true) {
        self.maxItemsPerDay = maxItemsPerDay
        self.includeWeekends = includeWeekends
        self.prioritizeOverdue = prioritizeOverdue
    }
}

/// One task as the scheduler sees it.
public struct SchedulerItem: Hashable, Sendable {
    public var id: String
    public var title: String
    public var isCompleted: Bool
    /// `scheduledDate ?? dueDate` as a calendar day.
    public var day: String?
    public var priority: TaskPriority?
    public var assigneeIds: [String]

    public init(id: String, title: String = "", isCompleted: Bool = false, day: String? = nil,
                priority: TaskPriority? = nil, assigneeIds: [String] = []) {
        self.id = id
        self.title = title
        self.isCompleted = isCompleted
        self.day = day
        self.priority = priority
        self.assigneeIds = assigneeIds
    }

    /// Reads a task the way the web does: planned day, else due day; assignees, else the owner.
    public init(task: WorkTask, zone: TimeZone) {
        let scheduled = DateLike(task.scheduledDate)
        self.init(id: task.id, title: task.title, isCompleted: task.isCompleted,
                  day: ZonedDate.toDay(scheduled.isTruthy ? scheduled : DateLike(task.dueDate), in: zone),
                  priority: task.priority, assigneeIds: task.effectiveAssignees)
    }
}

public struct ProposedSchedule: Hashable, Sendable, Identifiable {
    public enum Reason: String, Sendable { case overdue, optimized }

    public var taskId: String
    public var newDay: String
    public var originalDay: String?
    public var reason: Reason
    public var id: String { taskId }

    public init(taskId: String, newDay: String, originalDay: String?, reason: Reason) {
        self.taskId = taskId
        self.newDay = newDay
        self.originalDay = originalDay
        self.reason = reason
    }
}

public enum Scheduler {
    /// Web `PRIORITY_WEIGHTS`; a task without priority weighs 1.
    public static func weight(_ priority: TaskPriority?) -> Int {
        switch priority {
        case .urgent: 4
        case .high: 3
        case .medium: 2
        case .low: 1
        case nil: 1
        }
    }

    /// `items` are the current user's tasks, `teamItems` their co-assignees' tasks (they take up
    /// capacity and are rescheduled too, exactly like the web). Returns only the tasks that move.
    public static func distribute(items: [SchedulerItem], teamItems: [SchedulerItem] = [], today: String,
                                  preferences: SchedulerPreferences = SchedulerPreferences()) -> [ProposedSchedule] {
        // Pool: open tasks, deduplicated by id (own tasks win).
        var seen = Set<String>()
        var pool: [SchedulerItem] = []
        for item in items + teamItems where !item.isCompleted && seen.insert(item.id).inserted {
            pool.append(item)
        }

        func isOverdue(_ item: SchedulerItem) -> Bool { item.day.map { $0 < today } ?? false }

        // Sort: overdue first, then priority, then earliest day, undated last; JS sort is stable.
        let ordered = pool.enumerated().sorted { lhs, rhs in
            let a = lhs.element, b = rhs.element
            if preferences.prioritizeOverdue, isOverdue(a) != isOverdue(b) { return isOverdue(a) }
            let wa = weight(a.priority), wb = weight(b.priority)
            if wa != wb { return wa > wb }
            switch (a.day, b.day) {
            case let (x?, y?) where x != y: return x < y
            case (.some, .none): return true
            case (.none, .some): return false
            default: return lhs.offset < rhs.offset
            }
        }.map(\.element)

        let capacity = max(1, preferences.maxItemsPerDay)
        var load: [String: [String: Int]] = [:]   // day -> user -> count

        func isWeekend(_ day: String) -> Bool { ZonedDate.weekdayIndex(day) >= 5 }
        func available(_ day: String, _ users: [String]) -> Bool {
            users.allSatisfy { (load[day]?[$0] ?? 0) < capacity }
        }

        var proposals: [ProposedSchedule] = []
        for item in ordered {
            var candidate = today
            while (!preferences.includeWeekends && isWeekend(candidate)) || !available(candidate, item.assigneeIds) {
                candidate = ZonedDate.addDays(candidate, 1)
            }
            if item.day != candidate {
                proposals.append(ProposedSchedule(taskId: item.id, newDay: candidate, originalDay: item.day,
                                                  reason: isOverdue(item) ? .overdue : .optimized))
            }
            for user in item.assigneeIds { load[candidate, default: [:]][user, default: 0] += 1 }
        }
        return proposals
    }
}
