import Foundation

// "Plan for today" logic (iOS Heute, web Dashboard slide 1). Port of `web/utils/dayPlan.ts`.
// No Firebase, no system clock, no i18n: the output carries i18n keys + parameters and the UI
// localises them. Behaviour is pinned by the golden fixtures in `shared/fixtures/dayPlan/` — read
// `shared/fixtures/README.md` before changing anything here, and change the web module in lockstep.

// MARK: - Input

public struct DayPlanTask: Hashable, Sendable, Decodable {
    public var id: String
    public var title: String
    /// Absent on personal tasks.
    public var projectId: String?
    public var tenantId: String?
    /// `Todo` (legacy) reads as `Open`. Only `Blocked` matters for the plan.
    public var status: String?
    /// The single source of truth for open/closed.
    public var isCompleted: Bool?
    public var priority: String?
    public var dueDate: DateLike
    public var scheduledDate: DateLike
    public var createdAt: DateLike
    public var completedAt: DateLike
    /// Ids of tasks that block this one.
    public var dependencies: [String]?
    public var blockerNote: String?
    public var nextStep: String?
    public var assigneeIds: [String]?

    public init(id: String, title: String, projectId: String? = nil, tenantId: String? = nil, status: String? = nil,
                isCompleted: Bool? = nil, priority: String? = nil, dueDate: DateLike = .none, scheduledDate: DateLike = .none,
                createdAt: DateLike = .none, completedAt: DateLike = .none, dependencies: [String]? = nil,
                blockerNote: String? = nil, nextStep: String? = nil, assigneeIds: [String]? = nil) {
        self.id = id; self.title = title; self.projectId = projectId; self.tenantId = tenantId; self.status = status
        self.isCompleted = isCompleted; self.priority = priority; self.dueDate = dueDate; self.scheduledDate = scheduledDate
        self.createdAt = createdAt; self.completedAt = completedAt; self.dependencies = dependencies
        self.blockerNote = blockerNote; self.nextStep = nextStep; self.assigneeIds = assigneeIds
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, projectId, tenantId, status, isCompleted, priority, dueDate, scheduledDate, createdAt, completedAt
        case dependencies, blockerNote, nextStep, assigneeIds
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        projectId = try c.decodeIfPresent(String.self, forKey: .projectId)
        tenantId = try c.decodeIfPresent(String.self, forKey: .tenantId)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        isCompleted = try c.decodeIfPresent(Bool.self, forKey: .isCompleted)
        priority = try c.decodeIfPresent(String.self, forKey: .priority)
        dueDate = try c.decodeIfPresent(DateLike.self, forKey: .dueDate) ?? .none
        scheduledDate = try c.decodeIfPresent(DateLike.self, forKey: .scheduledDate) ?? .none
        createdAt = try c.decodeIfPresent(DateLike.self, forKey: .createdAt) ?? .none
        completedAt = try c.decodeIfPresent(DateLike.self, forKey: .completedAt) ?? .none
        dependencies = try c.decodeIfPresent([String].self, forKey: .dependencies)
        blockerNote = try c.decodeIfPresent(String.self, forKey: .blockerNote)
        nextStep = try c.decodeIfPresent(String.self, forKey: .nextStep)
        assigneeIds = try c.decodeIfPresent([String].self, forKey: .assigneeIds)
    }
}

public struct DayPlanProject: Hashable, Sendable, Decodable {
    public var id: String
    public var title: String
    /// Project deadline; counts in the week strip.
    public var dueDate: DateLike

    public init(id: String, title: String, dueDate: DateLike = .none) {
        self.id = id; self.title = title; self.dueDate = dueDate
    }

    private enum CodingKeys: String, CodingKey { case id, title, dueDate }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        dueDate = try c.decodeIfPresent(DateLike.self, forKey: .dueDate) ?? .none
    }
}

public struct DayPlanFocus: Hashable, Sendable, Decodable {
    public var id: String
    /// `task` | `initiative` (| `personal-task`).
    public var type: String
    public var title: String
    public var projectId: String?
    public var tenantId: String?
    public var isCompleted: Bool?
    /// `active` | `snoozed` | `blocked`.
    public var status: String?
    public var snoozedUntil: DateLike

    public init(id: String, type: String, title: String, projectId: String? = nil, tenantId: String? = nil,
                isCompleted: Bool? = nil, status: String? = nil, snoozedUntil: DateLike = .none) {
        self.id = id; self.type = type; self.title = title; self.projectId = projectId; self.tenantId = tenantId
        self.isCompleted = isCompleted; self.status = status; self.snoozedUntil = snoozedUntil
    }

    private enum CodingKeys: String, CodingKey { case id, type, title, projectId, tenantId, isCompleted, status, snoozedUntil }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        type = try c.decode(String.self, forKey: .type)
        title = try c.decode(String.self, forKey: .title)
        projectId = try c.decodeIfPresent(String.self, forKey: .projectId)
        tenantId = try c.decodeIfPresent(String.self, forKey: .tenantId)
        isCompleted = try c.decodeIfPresent(Bool.self, forKey: .isCompleted)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        snoozedUntil = try c.decodeIfPresent(DateLike.self, forKey: .snoozedUntil) ?? .none
    }
}

public struct DayPlanInput: Hashable, Sendable, Decodable {
    /// The current moment (instant).
    public var now: DateLike
    /// IANA time zone that defines "today". Defaults to the device zone.
    public var timeZone: String?
    /// Active projects only (status Active / In Testing). Tasks of other projects are ignored.
    public var projects: [DayPlanProject]
    /// My open and completed project tasks.
    public var tasks: [DayPlanTask]
    /// My personal tasks (no project).
    public var personalTasks: [DayPlanTask]
    /// Tasks of other people in the same projects; used for "unblocks" and "waiting on me".
    public var otherTasks: [DayPlanTask]
    public var focus: DayPlanFocus?

    public init(now: DateLike, timeZone: String? = nil, projects: [DayPlanProject], tasks: [DayPlanTask],
                personalTasks: [DayPlanTask] = [], otherTasks: [DayPlanTask] = [], focus: DayPlanFocus? = nil) {
        self.now = now; self.timeZone = timeZone; self.projects = projects; self.tasks = tasks
        self.personalTasks = personalTasks; self.otherTasks = otherTasks; self.focus = focus
    }

    private enum CodingKeys: String, CodingKey { case now, timeZone, projects, tasks, personalTasks, otherTasks, focus }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        now = try c.decodeIfPresent(DateLike.self, forKey: .now) ?? .none
        timeZone = try c.decodeIfPresent(String.self, forKey: .timeZone)
        projects = try c.decodeIfPresent([DayPlanProject].self, forKey: .projects) ?? []
        tasks = try c.decodeIfPresent([DayPlanTask].self, forKey: .tasks) ?? []
        personalTasks = try c.decodeIfPresent([DayPlanTask].self, forKey: .personalTasks) ?? []
        otherTasks = try c.decodeIfPresent([DayPlanTask].self, forKey: .otherTasks) ?? []
        focus = try c.decodeIfPresent(DayPlanFocus.self, forKey: .focus)
    }
}

// MARK: - Output

public enum DayPlanTone: String, Hashable, Sendable, Codable { case info, danger, warning, neutral, success }
public enum DayPlanStopKind: String, Hashable, Sendable, Codable { case focus, overdue, dueToday, scheduled, followUp, suggestion }
public enum DayShape: String, Hashable, Sendable, Codable { case waiting, clear, behind, heavy, doable }

/// A message parameter: counts and days are numbers, titles and notes strings.
public enum PlanParam: Hashable, Sendable, Codable, CustomStringConvertible {
    case int(Int)
    case string(String)

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let value = try? c.decode(Int.self) { self = .int(value); return }
        if let value = try? c.decode(Double.self) { self = .int(Int(value.rounded())); return }
        self = .string(try c.decode(String.self))
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .int(let value): try c.encode(value)
        case .string(let value): try c.encode(value)
        }
    }

    public var description: String {
        switch self {
        case .int(let value): String(value)
        case .string(let value): value
        }
    }
}

/// An i18n message: `t(key)` with `{param}` placeholders replaced; or the literal `text` when `key` is nil.
public struct DayPlanMessage: Hashable, Sendable, Codable {
    public var key: String?
    public var params: [String: PlanParam]
    public var text: String?

    public init(key: String?, params: [String: PlanParam] = [:], text: String? = nil) {
        self.key = key; self.params = params; self.text = text
    }
}

public struct DayPlanStop: Hashable, Sendable, Codable, Identifiable {
    /// Unique within the plan: `<taskId>` | `personal:<id>` | `follow:<key>` | `suggest:<key>`.
    public var id: String
    public var kind: DayPlanStopKind
    public var tone: DayPlanTone
    /// True for quiet-day suggestions (dashed in the UI).
    public var proposed: Bool
    public var taskId: String
    /// `task` | `initiative` | `personal`.
    public var itemType: String
    /// Raw title; the UI wraps follow-ups in `dashboard.route.followUp`.
    public var title: String
    public var projectId: String?
    /// "" when the project is unknown or the task is personal.
    public var projectName: String
    public var tenantId: String?
    public var isPersonal: Bool
    public var priority: String?
    public var reason: DayPlanMessage
    /// Open tasks this one frees up; only set for `overdue` / `dueToday` stops (0 otherwise).
    public var unblocksCount: Int
    /// Whether "start focus" may be offered (the task belongs to a project).
    public var canFocus: Bool
}

public struct DayPlanStatement: Hashable, Sendable, Codable {
    public var key: String
    public var params: [String: PlanParam]
    /// Emphasised value substituted for `{value}` (count or title).
    public var value: String?
    /// i18n key of the value when it is itself a localised phrase.
    public var valueKey: String?
}

public struct DayPlanCounts: Hashable, Sendable, Codable {
    public var overdue: Int
    public var dueToday: Int
    public var scheduledToday: Int
    /// overdue + dueToday + scheduledToday, de-duplicated.
    public var queue: Int
    /// Open project tasks with status Blocked.
    public var blocked: Int
    /// Open project + personal tasks.
    public var open: Int
    /// Open, undated (no due and no scheduled date), not blocked.
    public var undated: Int
    public var completedLast7Days: Int
    public var completedPrevious7Days: Int
}

public struct DayPlanBandSegment: Hashable, Sendable, Codable, Identifiable {
    public enum Kind: String, Hashable, Sendable, Codable { case overdue, due, waiting, rest }
    public var key: String
    public var type: Kind
    public var flex: Double
    public var id: String { key }
}

public struct DayPlanBandPart: Hashable, Sendable, Codable {
    public enum Key: String, Hashable, Sendable, Codable { case overdue, due, waiting }
    public var key: Key
    public var tone: DayPlanTone
    public var count: Int
}

public struct DayPlanBand: Hashable, Sendable, Codable {
    public var segments: [DayPlanBandSegment]
    public var caption: [DayPlanBandPart]
}

public struct DayPlanWeekDay: Hashable, Sendable, Codable, Identifiable {
    /// "YYYY-MM-DD".
    public var date: String
    /// Monday = 0 … Sunday = 6.
    public var weekday: Int
    public var count: Int
    public var isToday: Bool
    public var isWeekend: Bool
    public var id: String { date }
}

public struct DayPlanWeek: Hashable, Sendable, Codable {
    public var badge: DayPlanMessage
    public var days: [DayPlanWeekDay]
    public var total: Int
}

public struct DayPlanNightEntry: Hashable, Sendable, Codable, Identifiable {
    public enum Kind: String, Hashable, Sendable, Codable { case done, new, overdue }
    public var key: String
    public var kind: Kind
    public var taskId: String
    public var title: String
    public var timeMs: Double
    /// "HH:mm" in the plan's time zone.
    public var time: String
    public var tone: DayPlanTone
    public var id: String { key }
}

public struct DayPlanWaitingEntry: Hashable, Sendable, Codable, Identifiable {
    public enum Kind: String, Hashable, Sendable, Codable { case dependent, blocked }
    /// `dependent`: someone else's task depends on my open task. `blocked`: my own task is blocked.
    public var kind: Kind
    public var taskId: String
    public var title: String
    public var projectId: String?
    public var projectName: String
    /// Who is waiting (`dependent`); empty for `blocked`.
    public var assigneeIds: [String]
    /// `dependent`: my open task it hangs on. `blocked`: first open dependency, if any.
    public var blockerTaskId: String?
    public var blockerTitle: String?
    /// `blocked`: the blocker note.
    public var note: String?
    public var id: String { "\(kind.rawValue):\(taskId)" }
}

public struct DayPlanUnlocker: Hashable, Sendable, Codable {
    public var taskId: String
    public var title: String
    public var count: Int
}

public struct DayPlan: Hashable, Sendable, Codable {
    /// "YYYY-MM-DD" of `now` in the plan's time zone.
    public var today: String
    public var timeZone: String
    public var stops: [DayPlanStop]
    /// Open tasks (project + personal) that are not part of `stops`.
    public var moreCount: Int
    /// True when every stop is a quiet-day suggestion.
    public var isSuggested: Bool
    public var statement: DayPlanStatement
    public var dayShape: DayShape
    public var cause: DayPlanMessage
    public var counts: DayPlanCounts
    public var band: DayPlanBand
    public var week: DayPlanWeek
    public var overnight: [DayPlanNightEntry]
    public var waitingOnMe: [DayPlanWaitingEntry]
    /// My open task that frees up the most other tasks (ties: first), or nil.
    public var topUnlocker: DayPlanUnlocker?
}

// MARK: - Helpers

public enum DayPlanLimits {
    public static let maxStops = 4
    public static let maxSuggestedStops = 3
    public static let maxOvernight = 4
    static let bandCap = 6
}

private let priorityRankTable: [String: Int] = ["Urgent": 0, "High": 1, "Medium": 2, "Low": 3]

private func planPriorityRank(_ priority: String?) -> Int {
    priorityRankTable[(priority?.isEmpty ?? true) ? "Medium" : priority!] ?? 2
}

/// Sorts like JavaScript's stable `Array.prototype.sort` with a numeric comparator.
func stableSorted<T>(_ items: [T], by compare: (T, T) -> Double) -> [T] {
    items.enumerated().sorted { lhs, rhs in
        let result = compare(lhs.element, rhs.element)
        return result < 0 || (result == 0 && lhs.offset < rhs.offset)
    }.map(\.element)
}

private func message(_ key: String, _ params: [String: PlanParam] = [:]) -> DayPlanMessage { DayPlanMessage(key: key, params: params) }
private func literal(_ text: String) -> DayPlanMessage { DayPlanMessage(key: nil, params: [:], text: text) }

/// `isCompleted` is the only authority for open/closed; `status` is never used to infer it.
public func isTaskOpen(_ task: DayPlanTask) -> Bool { task.isCompleted != true }

/// Effective status: completed reads as `Done`, a missing or legacy `Todo` status as `Open`.
public func effectiveStatus(isCompleted: Bool?, status: String?) -> String {
    if isCompleted == true { return "Done" }
    if status == nil || status == "" || status == "Todo" { return "Open" }
    return status!
}

/// How many open tasks each task id blocks (reverse dependency count).
public func countUnblocks(_ openTasks: [DayPlanTask]) -> [String: Int] {
    var counts: [String: Int] = [:]
    for task in openTasks {
        for dependencyId in task.dependencies ?? [] { counts[dependencyId, default: 0] += 1 }
    }
    return counts
}

private struct PlanTask {
    var task: DayPlanTask
    var key: String
    var isPersonal: Bool

    init(_ task: DayPlanTask, isPersonal: Bool) {
        self.task = task
        self.key = isPersonal ? "personal:\(task.id)" : task.id
        self.isPersonal = isPersonal
    }

    var id: String { task.id }
    var title: String { task.title }
    var projectId: String? { task.projectId }
    var status: String? { task.status }
    var priority: String? { task.priority }
    var dueDate: DateLike { task.dueDate }
    var scheduledDate: DateLike { task.scheduledDate }
    var createdAt: DateLike { task.createdAt }
    var isCompleted: Bool { task.isCompleted == true }
    var isOpen: Bool { task.isCompleted != true }
}

// MARK: - The plan

// swiftlint:disable:next function_body_length
public func buildDayPlan(_ input: DayPlanInput) -> DayPlan {
    let zone = ZonedDate.resolveTimeZone(input.timeZone)
    let zoneId = ZonedDate.identifier(input.timeZone)
    let nowMs = ZonedDate.toInstantOrZero(input.now, in: zone)
    let today = ZonedDate.toDay(.number(nowMs), in: zone) ?? "1970-01-01"
    let todayStart = ZonedDate.startOfDay(today, in: zone)
    let dayMs = ZonedDate.dayMs

    func dayOf(_ value: DateLike) -> String? { ZonedDate.toDay(value, in: zone) }
    func isToday(_ value: DateLike) -> Bool { dayOf(value) == today }
    func isPastDue(_ value: DateLike) -> Bool {
        guard let day = dayOf(value) else { return false }
        return ZonedDate.daysBetween(today, day) < 0
    }
    func overdueDays(of task: PlanTask) -> Int {
        guard let day = dayOf(task.dueDate) else { return 0 }
        return max(1, ZonedDate.daysBetween(day, today))
    }
    func sortKey(_ value: DateLike) -> Double { ZonedDate.dateSortKey(value, in: zone) }
    func instantOrZero(_ value: DateLike) -> Double { ZonedDate.toInstantOrZero(value, in: zone) }

    var projectTitle: [String: String] = [:]
    for project in input.projects { projectTitle[project.id] = project.title }
    func isActiveProject(_ projectId: String?) -> Bool {
        guard let projectId, !projectId.isEmpty else { return false }
        return projectTitle[projectId] != nil
    }
    func projectLabel(_ projectId: String?) -> String {
        guard let projectId, let title = projectTitle[projectId] else { return "" }
        return title
    }

    // Task universe -------------------------------------------------------------
    let mine = input.tasks.filter { isActiveProject($0.projectId) }.map { PlanTask($0, isPersonal: false) }
    let mineIds = Set(mine.map(\.id))
    let others = input.otherTasks
        .filter { isActiveProject($0.projectId) && !mineIds.contains($0.id) }
        .map { PlanTask($0, isPersonal: false) }
    let personal = input.personalTasks.map { PlanTask($0, isPersonal: true) }

    var taskById: [String: PlanTask] = [:]
    for task in others + mine { taskById[task.id] = task }

    let openMine = mine.filter(\.isOpen)
    let openOthers = others.filter(\.isOpen)
    let openPersonal = personal.filter(\.isOpen)
    // Combined order: my project tasks first, then personal tasks.
    let open = openMine + openPersonal

    let unblocks = countUnblocks((openMine + openOthers).map(\.task))

    // Buckets ---------------------------------------------------------------------
    let overdue = open.filter { isPastDue($0.dueDate) }
    let dueToday = open.filter { isToday($0.dueDate) }
    let scheduledToday = open.filter { isToday($0.scheduledDate) && !isToday($0.dueDate) && !isPastDue($0.dueDate) }
    // Personal tasks cannot be blocked by or wait on anyone.
    let blocked = openMine.filter { $0.status == "Blocked" }

    var queue: [PlanTask] = []
    var queued = Set<String>()
    for task in overdue + dueToday + scheduledToday where !queued.contains(task.key) {
        queued.insert(task.key)
        queue.append(task)
    }

    let completedMine = mine.filter(\.isCompleted)
    let completedLast7Days = completedMine.filter { instantOrZero($0.task.completedAt) >= nowMs - 7 * dayMs }
    let completedPrevious7Days = completedMine.filter {
        let completed = instantOrZero($0.task.completedAt)
        return completed >= nowMs - 14 * dayMs && completed < nowMs - 7 * dayMs
    }

    // Focus -------------------------------------------------------------------------
    let focus = input.focus
    let focusSnoozed: Bool = {
        guard let focus, focus.status == "snoozed", focus.snoozedUntil.isTruthy else { return false }
        return (ZonedDate.toInstant(focus.snoozedUntil, in: zone) ?? 0) > nowMs
    }()

    // Stops ---------------------------------------------------------------------------
    var stops: [DayPlanStop] = []
    var seen = Set<String>()

    func stopFor(_ task: PlanTask, kind: DayPlanStopKind, tone: DayPlanTone, reason: DayPlanMessage,
                 id: String? = nil, proposed: Bool = false, unblocksCount: Int = 0, canFocus: Bool? = nil) -> DayPlanStop {
        DayPlanStop(
            id: id ?? task.key,
            kind: kind,
            tone: tone,
            proposed: proposed,
            taskId: task.id,
            itemType: task.isPersonal ? "personal" : "task",
            title: task.title,
            projectId: (task.projectId?.isEmpty ?? true) ? nil : task.projectId,
            projectName: task.isPersonal ? "" : projectLabel(task.projectId),
            tenantId: (task.task.tenantId?.isEmpty ?? true) ? nil : task.task.tenantId,
            isPersonal: task.isPersonal,
            priority: (task.priority?.isEmpty ?? true) ? nil : task.priority,
            reason: reason,
            unblocksCount: unblocksCount,
            canFocus: canFocus ?? (!(task.projectId?.isEmpty ?? true) && !task.isPersonal)
        )
    }

    func pushTask(_ task: PlanTask, kind: DayPlanStopKind, tone: DayPlanTone, reason: DayPlanMessage, withUnblocks: Bool) {
        if stops.count >= DayPlanLimits.maxStops || seen.contains(task.key) { return }
        seen.insert(task.key)
        stops.append(stopFor(task, kind: kind, tone: tone, reason: reason, unblocksCount: withUnblocks ? (unblocks[task.id] ?? 0) : 0))
    }

    if let focus, isActiveProject(focus.projectId), !focusSnoozed, focus.isCompleted != true {
        let focusTask = taskById[focus.id]
        if focusTask == nil || focusTask?.isCompleted == false {
            seen.insert(focus.id)
            let next = focusTask?.task.nextStep
            stops.append(DayPlanStop(
                id: focus.id,
                kind: .focus,
                tone: .info,
                proposed: false,
                taskId: focus.id,
                itemType: focus.type == "initiative" ? "initiative" : "task",
                title: focus.title,
                projectId: focus.projectId,
                projectName: projectLabel(focus.projectId),
                tenantId: (focus.tenantId?.isEmpty ?? true) ? nil : focus.tenantId,
                isPersonal: false,
                priority: (focusTask?.priority?.isEmpty ?? true) ? nil : focusTask?.priority,
                reason: (next?.isEmpty ?? true)
                    ? message("dashboard.today.reason.focusResume")
                    : message("dashboard.today.reason.focusNext", ["next": .string(next!)]),
                unblocksCount: 0,
                canFocus: true
            ))
        }
    }

    // Overdue, oldest first. Ties break by input order (JavaScript's sort is stable).
    for task in stableSorted(overdue, by: { sortKey($0.dueDate.isTruthy ? $0.dueDate : $0.scheduledDate) - sortKey($1.dueDate.isTruthy ? $1.dueDate : $1.scheduledDate) }) {
        let days = overdueDays(of: task)
        let reason = days <= 1
            ? message("dashboard.today.reason.overdueYesterday")
            : message("dashboard.today.reason.overdueDays", ["days": .int(days)])
        pushTask(task, kind: .overdue, tone: .danger, reason: reason, withUnblocks: true)
    }

    for task in stableSorted(dueToday, by: { Double(planPriorityRank($0.priority) - planPriorityRank($1.priority)) }) {
        pushTask(task, kind: .dueToday, tone: .warning, reason: message("dashboard.today.reason.dueToday"), withUnblocks: true)
    }

    for task in scheduledToday {
        pushTask(task, kind: .scheduled, tone: .neutral, reason: message("dashboard.today.reason.scheduled"), withUnblocks: false)
    }

    // Fill remaining stops with quick follow-ups on blocked work.
    func firstOpenDependency(_ task: PlanTask) -> PlanTask? {
        guard let first = task.task.dependencies?.first, let dependency = taskById[first] else { return nil }
        return dependency.isCompleted ? nil : dependency
    }
    for task in blocked {
        if stops.count >= DayPlanLimits.maxStops || seen.contains(task.key) { continue }
        seen.insert(task.key)
        var reason: DayPlanMessage?
        if let note = task.task.blockerNote, !note.isEmpty { reason = literal(note) }
        if reason == nil, let dependency = firstOpenDependency(task) {
            reason = message("dashboard.today.blockedRail.dependency", ["title": .string(dependency.title)])
        }
        stops.append(stopFor(task, kind: .followUp, tone: .neutral, reason: reason ?? message("dashboard.today.blockedRail.fallback"),
                             id: "follow:\(task.key)", canFocus: false))
    }

    // Quiet day: nothing dated drove the plan. Propose a plan from the backlog so it is never
    // empty — ranked by priority, then age. Undated personal tasks are only ever suggestions.
    if stops.count < 3 {
        func ageDays(_ task: PlanTask) -> Int {
            guard let created = ZonedDate.toInstant(task.createdAt, in: zone) else { return 0 }
            return max(0, Int(((nowMs - created) / dayMs).rounded(.down)))
        }
        let candidates = open.filter {
            !seen.contains($0.key) && $0.status != "Blocked" && !ZonedDate.hasDateValue($0.dueDate) && !ZonedDate.hasDateValue($0.scheduledDate)
        }
        let backlog = stableSorted(candidates) { a, b in
            let rank = Double(planPriorityRank(a.priority) - planPriorityRank(b.priority))
            return rank != 0 ? rank : instantOrZero(a.createdAt) - instantOrZero(b.createdAt)
        }
        for task in backlog {
            if stops.count >= DayPlanLimits.maxSuggestedStops || seen.contains(task.key) { continue }
            seen.insert(task.key)
            let age = ageDays(task)
            let reason: DayPlanMessage
            if task.priority == "Urgent" || task.priority == "High" {
                reason = message("dashboard.route.suggest.important")
            } else if age >= 7 {
                reason = message("dashboard.route.suggest.aged", ["days": .int(age)])
            } else {
                reason = message("dashboard.route.suggest.pick")
            }
            stops.append(stopFor(task, kind: .suggestion, tone: .neutral, reason: reason, id: "suggest:\(task.key)", proposed: true))
        }
    }

    let realCount = stops.filter { !$0.proposed }.count
    let isSuggested = !stops.isEmpty && realCount == 0

    let shownKeys = Set(stops.map { $0.isPersonal ? "personal:\($0.taskId)" : $0.taskId })
    let moreCount = open.filter { !shownKeys.contains($0.key) }.count

    let undated = open.filter {
        !ZonedDate.hasDateValue($0.dueDate) && !ZonedDate.hasDateValue($0.scheduledDate) && $0.status != "Blocked"
    }.count

    // Statement -------------------------------------------------------------------------
    let statement: DayPlanStatement = {
        func make(_ key: String, _ value: String?, valueKey: String? = nil) -> DayPlanStatement {
            DayPlanStatement(key: "dashboard.route.statement.\(key)", params: [:], value: value, valueKey: valueKey)
        }
        if stops.isEmpty { return make("clear", nil, valueKey: "dashboard.route.statement.clearValue") }
        if isSuggested { return make(stops.count == 1 ? "suggestOne" : "suggest", String(stops.count)) }
        if queue.isEmpty && !blocked.isEmpty { return make(blocked.count == 1 ? "waitingOne" : "waiting", String(blocked.count)) }
        if stops.count == 1 { return make("one", stops[0].title) }
        if !overdue.isEmpty { return make(stops[0].tone == .danger ? "behind" : "behindLater", String(stops.count)) }
        return make("clean", String(stops.count))
    }()

    // Day shape + cause line ------------------------------------------------------------
    let dayShape: DayShape = {
        if queue.isEmpty && !blocked.isEmpty { return .waiting }
        if queue.isEmpty { return .clear }
        if !overdue.isEmpty { return .behind }
        if queue.count >= 6 { return .heavy }
        return .doable
    }()

    let cause: DayPlanMessage = {
        let oldestOverdue = stableSorted(overdue) { sortKey($0.dueDate) - sortKey($1.dueDate) }.first

        // Project with the most queued tasks (ties: the one that appeared first).
        var loadOrder: [String] = []
        var loadCounts: [String: Int] = [:]
        for task in queue {
            guard let projectId = task.projectId, !projectId.isEmpty else { continue }
            if loadCounts[projectId] == nil { loadOrder.append(projectId) }
            loadCounts[projectId, default: 0] += 1
        }
        var leader: (title: String, count: Int)?
        for projectId in loadOrder {
            guard let title = projectTitle[projectId], let count = loadCounts[projectId] else { continue }
            if leader == nil || count > leader!.count { leader = (title, count) }
        }

        if dayShape == .behind, let oldestOverdue {
            let days = overdueDays(of: oldestOverdue)
            if days <= 1 { return message("dashboard.today.insight.oldestOverdueOne", ["title": .string(oldestOverdue.title)]) }
            return message("dashboard.today.insight.oldestOverdue", ["days": .int(days), "title": .string(oldestOverdue.title)])
        }
        if dayShape == .waiting, let first = blocked.first {
            if let note = first.task.blockerNote, !note.isEmpty {
                return message("dashboard.today.insight.blockedNote", ["title": .string(first.title), "note": .string(note)])
            }
            return message("dashboard.today.insight.blockedPlain", ["title": .string(first.title)])
        }
        if dayShape == .heavy || dayShape == .doable {
            if let leader, leader.count > 1 {
                return message("dashboard.today.insight.loadCenter", ["project": .string(leader.title), "count": .int(leader.count)])
            }
            if loadCounts.count > 1 { return message("dashboard.today.insight.spread", ["count": .int(loadCounts.count)]) }
        }
        if dayShape == .clear, let focus, isActiveProject(focus.projectId) {
            return message("dashboard.today.insight.focusOpen", ["title": .string(focus.title)])
        }
        if !completedLast7Days.isEmpty { return message("dashboard.today.insight.momentum", ["count": .int(completedLast7Days.count)]) }
        return message("dashboard.today.insight.fresh")
    }()

    // Day band -------------------------------------------------------------------------------
    let dueCount = queue.count - overdue.count
    func cap(_ count: Int) -> Int { min(count, DayPlanLimits.bandCap) }
    var segments: [DayPlanBandSegment] = []
    for index in 0..<cap(overdue.count) { segments.append(DayPlanBandSegment(key: "overdue-\(index)", type: .overdue, flex: 1.3)) }
    for index in 0..<cap(dueCount) { segments.append(DayPlanBandSegment(key: "due-\(index)", type: .due, flex: 1)) }
    for index in 0..<cap(blocked.count) { segments.append(DayPlanBandSegment(key: "waiting-\(index)", type: .waiting, flex: 0.8)) }
    let used = segments.reduce(0) { $0 + $1.flex }
    segments.append(DayPlanBandSegment(key: "rest", type: .rest, flex: ((max(used > 0 ? 2 : 8, 8 - used)) * 1000).rounded() / 1000))

    var caption: [DayPlanBandPart] = []
    if !overdue.isEmpty { caption.append(DayPlanBandPart(key: .overdue, tone: .danger, count: overdue.count)) }
    if dueCount > 0 { caption.append(DayPlanBandPart(key: .due, tone: .warning, count: dueCount)) }
    if !blocked.isEmpty { caption.append(DayPlanBandPart(key: .waiting, tone: .neutral, count: blocked.count)) }

    // Week strip + badge ---------------------------------------------------------------------
    let monday = ZonedDate.addDays(today, -ZonedDate.weekdayIndex(today))
    var dayCounts: [String: Int] = [:]
    func bump(_ value: DateLike) { if let day = dayOf(value) { dayCounts[day, default: 0] += 1 } }
    for task in open {
        bump(task.dueDate)
        if task.scheduledDate.isTruthy { bump(task.scheduledDate) }
    }
    for project in input.projects { bump(project.dueDate) }
    let days: [DayPlanWeekDay] = (0..<7).map { index in
        let date = ZonedDate.addDays(monday, index)
        return DayPlanWeekDay(date: date, weekday: index, count: dayCounts[date] ?? 0, isToday: date == today, isWeekend: index >= 5)
    }
    let weekTotal = days.reduce(0) { $0 + $1.count }

    let badge: DayPlanMessage = {
        let current = completedLast7Days.count
        let previous = completedPrevious7Days.count
        if current == 0 { return message("dashboard.week.none") }
        if current > previous { return message("dashboard.week.more", ["count": .int(current), "diff": .int(current - previous)]) }
        if current < previous { return message("dashboard.week.fewer", ["count": .int(current), "diff": .int(previous - current)]) }
        return message("dashboard.week.same", ["count": .int(current)])
    }()

    // Overnight (last 24 hours). Personal tasks only appear as "became overdue". --------------
    let dayAgo = nowMs - dayMs
    var overnightAll: [DayPlanNightEntry] = []
    for task in mine {
        let completedMs = instantOrZero(task.task.completedAt)
        if task.isCompleted && completedMs >= dayAgo {
            overnightAll.append(DayPlanNightEntry(key: "done:\(task.id)", kind: .done, taskId: task.id, title: task.title,
                                                  timeMs: completedMs, time: ZonedDate.clockLabel(completedMs, in: zone), tone: .success))
            continue
        }
        let createdMs = instantOrZero(task.createdAt)
        if !task.isCompleted && createdMs >= dayAgo {
            overnightAll.append(DayPlanNightEntry(key: "new:\(task.id)", kind: .new, taskId: task.id, title: task.title,
                                                  timeMs: createdMs, time: ZonedDate.clockLabel(createdMs, in: zone), tone: .info))
        }
    }
    for task in overdue {
        if let day = dayOf(task.dueDate), ZonedDate.daysBetween(day, today) == 1 {
            overnightAll.append(DayPlanNightEntry(key: "overdue:\(task.key)", kind: .overdue, taskId: task.id, title: task.title,
                                                  timeMs: todayStart, time: "00:00", tone: .warning))
        }
    }
    let overnight = Array(stableSorted(overnightAll) { $0.timeMs - $1.timeMs }.suffix(DayPlanLimits.maxOvernight))

    // Waiting on me ---------------------------------------------------------------------------
    var myOpenById: [String: PlanTask] = [:]
    for task in openMine { myOpenById[task.id] = task }
    var dependents: [(entry: DayPlanWaitingEntry, sortKey: Double)] = []
    for task in openOthers {
        guard let blockerId = (task.task.dependencies ?? []).first(where: { myOpenById[$0] != nil }), let blocker = myOpenById[blockerId] else { continue }
        dependents.append((
            DayPlanWaitingEntry(kind: .dependent, taskId: task.id, title: task.title,
                                projectId: (task.projectId?.isEmpty ?? true) ? nil : task.projectId, projectName: projectLabel(task.projectId),
                                assigneeIds: task.task.assigneeIds ?? [], blockerTaskId: blocker.id, blockerTitle: blocker.title, note: nil),
            sortKey(blocker.dueDate.isTruthy ? blocker.dueDate : blocker.scheduledDate)
        ))
    }
    var waitingOnMe: [DayPlanWaitingEntry] = stableSorted(dependents) { $0.sortKey - $1.sortKey }.map(\.entry)
    for task in blocked {
        let dependency = firstOpenDependency(task)
        waitingOnMe.append(DayPlanWaitingEntry(
            kind: .blocked, taskId: task.id, title: task.title,
            projectId: (task.projectId?.isEmpty ?? true) ? nil : task.projectId, projectName: projectLabel(task.projectId),
            assigneeIds: [], blockerTaskId: dependency?.id, blockerTitle: dependency?.title,
            note: (task.task.blockerNote?.isEmpty ?? true) ? nil : task.task.blockerNote
        ))
    }

    // Top unlocker ----------------------------------------------------------------------------
    var topUnlocker: DayPlanUnlocker?
    for task in openMine {
        let count = unblocks[task.id] ?? 0
        if count > 0, topUnlocker == nil || count > topUnlocker!.count {
            topUnlocker = DayPlanUnlocker(taskId: task.id, title: task.title, count: count)
        }
    }

    return DayPlan(
        today: today,
        timeZone: zoneId,
        stops: stops,
        moreCount: moreCount,
        isSuggested: isSuggested,
        statement: statement,
        dayShape: dayShape,
        cause: cause,
        counts: DayPlanCounts(
            overdue: overdue.count, dueToday: dueToday.count, scheduledToday: scheduledToday.count, queue: queue.count,
            blocked: blocked.count, open: open.count, undated: undated,
            completedLast7Days: completedLast7Days.count, completedPrevious7Days: completedPrevious7Days.count
        ),
        band: DayPlanBand(segments: segments, caption: caption),
        week: DayPlanWeek(badge: badge, days: days, total: weekTotal),
        overnight: overnight,
        waitingOnMe: waitingOnMe,
        topUnlocker: topUnlocker
    )
}
