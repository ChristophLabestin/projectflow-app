import Foundation

// Portfolio "where to look" ranking, ported from `web/utils/attention.ts`. Pure logic: no clock, no
// i18n (output carries i18n keys + params), no Firebase. Health is not recomputed here; callers pass
// the status/trend they already have (iOS: the server `healthSnapshots`). Behaviour is pinned by
// `shared/fixtures/attention/*.json` (see `shared/fixtures/README.md`), run by `AttentionTests`.

// MARK: - Input

public struct AttentionHealth: Sendable, Hashable, Decodable {
    public var status: String?
    public var trend: String?

    public init(status: String? = nil, trend: String? = nil) {
        self.status = status
        self.trend = trend
    }
}

public struct AttentionProject: Sendable, Hashable, Decodable {
    public var id: String
    public var title: String
    public var status: String?
    public var dueDate: AttentionDate?
    public var health: AttentionHealth?

    public init(id: String, title: String, status: String? = nil, dueDate: AttentionDate? = nil, health: AttentionHealth? = nil) {
        self.id = id
        self.title = title
        self.status = status
        self.dueDate = dueDate
        self.health = health
    }
}

public struct AttentionTask: Sendable, Hashable, Decodable {
    public var id: String
    public var title: String?
    public var projectId: String?
    public var isCompleted: Bool?
    public var status: String?
    public var dueDate: AttentionDate?
    public var createdAt: AttentionDate?
    public var completedAt: AttentionDate?

    public init(id: String, title: String? = nil, projectId: String? = nil, isCompleted: Bool? = nil, status: String? = nil,
                dueDate: AttentionDate? = nil, createdAt: AttentionDate? = nil, completedAt: AttentionDate? = nil) {
        self.id = id
        self.title = title
        self.projectId = projectId
        self.isCompleted = isCompleted
        self.status = status
        self.dueDate = dueDate
        self.createdAt = createdAt
        self.completedAt = completedAt
    }
}

public struct AttentionUnlocker: Sendable, Hashable, Decodable {
    public var title: String
    public var count: Int

    public init(title: String, count: Int) {
        self.title = title
        self.count = count
    }
}

public struct AttentionInput: Sendable, Decodable {
    public var now: AttentionDate
    public var timeZone: String?
    public var projects: [AttentionProject]
    public var tasks: [AttentionTask]
    public var unlocker: AttentionUnlocker?

    public init(now: AttentionDate, timeZone: String? = nil, projects: [AttentionProject], tasks: [AttentionTask],
                unlocker: AttentionUnlocker? = nil) {
        self.now = now
        self.timeZone = timeZone
        self.projects = projects
        self.tasks = tasks
        self.unlocker = unlocker
    }
}

// MARK: - Output

/// A message parameter: counts are integers, names are strings.
public enum AttentionParam: Sendable, Hashable, Codable, CustomStringConvertible {
    case int(Int)
    case string(String)

    public init(from decoder: any Decoder) throws {
        let single = try decoder.singleValueContainer()
        if let value = try? single.decode(Int.self) { self = .int(value); return }
        self = .string(try single.decode(String.self))
    }

    public func encode(to encoder: any Encoder) throws {
        var single = encoder.singleValueContainer()
        switch self {
        case .int(let value): try single.encode(value)
        case .string(let value): try single.encode(value)
        }
    }

    public var description: String {
        switch self {
        case .int(let value): String(value)
        case .string(let value): value
        }
    }
}

public struct AttentionChip: Sendable, Hashable, Codable {
    public enum Key: String, Sendable, Codable { case overdue, blocked, stalled, declining, critical, warning, deadline }
    public enum Tone: String, Sendable, Codable { case danger, warning, info, neutral }

    public var key: Key
    public var tone: Tone
    /// i18n key of the chip label (`dashboard.pulse.chip.<key>`).
    public var labelKey: String
    public var params: [String: AttentionParam]
}

public struct AttentionEntry: Sendable, Hashable, Codable {
    public var projectId: String
    public var title: String
    public var openCount: Int
    public var overdueCount: Int
    public var blockedCount: Int
    /// Whole days since the newest task creation/completion, nil without tasks.
    public var stalledDays: Int?
    /// Calendar days until the project deadline (> 0), else nil.
    public var deadlineDays: Int?
    /// Tasks completed in the last 7 × 24 h.
    public var completedWeek: Int
    public var score: Int
    /// At most 3.
    public var chips: [AttentionChip]
}

public struct AttentionMessage: Sendable, Hashable, Codable {
    public var key: String?
    public var params: [String: AttentionParam]
    public var text: String?
    /// For `dashboard.pulse.insight.worst`: the UI localizes these and joins them with ", " into `{reasons}`.
    public var chips: [AttentionChip]?
}

public struct AttentionStatement: Sendable, Hashable, Codable {
    public var key: String
    public var params: [String: AttentionParam]
    public var value: String?
    public var valueKey: String?
}

public struct AttentionHorizonItem: Sendable, Hashable, Codable {
    public enum Kind: String, Sendable, Codable { case task, project }

    public var kind: Kind
    public var id: String
    public var title: String
    public var projectId: String?
    /// "YYYY-MM-DD".
    public var day: String
}

public struct AttentionStats: Sendable, Hashable, Codable {
    public var projects: Int
    public var open: Int
    public var overdue: Int
    public var doneWeek: Int
}

public struct AttentionMomentum: Sendable, Hashable, Codable {
    public struct Point: Sendable, Hashable, Codable {
        public var date: String
        public var value: Int
    }

    public var current: Int
    public var previous: Int
    public var caption: AttentionMessage
    /// 14 buckets, oldest first, ending today.
    public var trend: [Point]
}

public struct AttentionBestRun: Sendable, Hashable, Codable {
    public var projectId: String
    public var completedWeek: Int
}

public struct AttentionResult: Sendable, Hashable, Codable {
    public var today: String
    public var timeZone: String
    /// One entry per active project, in input order.
    public var entries: [AttentionEntry]
    /// Project ids needing attention (score >= 3), worst first, at most 3.
    public var attention: [String]
    public var quietCount: Int
    /// Project ids with open work, most open tasks first, at most 4 (Today rail).
    public var rail: [String]
    /// Same ordering, at most 5 (workload bars).
    public var workload: [String]
    public var bestRun: AttentionBestRun?
    public var statement: AttentionStatement
    public var insight: AttentionMessage
    /// Stalled-project or unlocker line for the Today rail.
    public var accent: AttentionMessage?
    public var stats: AttentionStats
    public var momentum: AttentionMomentum
    /// At most 3 "wins" lines.
    public var wins: [AttentionMessage]
    /// Next 4 task/project deadlines within the next 14 days.
    public var horizon: [AttentionHorizonItem]

    public func entry(_ projectId: String) -> AttentionEntry? { entries.first { $0.projectId == projectId } }
}

// MARK: - Ranking

public enum Attention {
    public static let threshold = 3
    public static let maxAttention = 3
    public static let maxRail = 4
    public static let maxWorkload = 5
    public static let stalledDays = 7

    private static func message(_ key: String, _ params: [String: AttentionParam] = [:]) -> AttentionMessage {
        AttentionMessage(key: key, params: params, text: nil, chips: nil)
    }

    private static func chip(_ key: AttentionChip.Key, _ tone: AttentionChip.Tone, _ params: [String: AttentionParam] = [:]) -> AttentionChip {
        AttentionChip(key: key, tone: tone, labelKey: "dashboard.pulse.chip.\(key.rawValue)", params: params)
    }

    /// Stable sort: ties keep input order (Swift's `sort` makes no such promise).
    private static func stableSort<T>(_ items: [T], _ areInOrder: (T, T) -> Bool) -> [T] {
        items.enumerated().sorted { lhs, rhs in
            if areInOrder(lhs.element, rhs.element) { return true }
            if areInOrder(rhs.element, lhs.element) { return false }
            return lhs.offset < rhs.offset
        }.map(\.element)
    }

    public static func build(_ input: AttentionInput) -> AttentionResult {
        let zone = AttentionZone.zone(input.timeZone)
        let nowMs = AttentionZone.toInstantOrZero(input.now, zone)
        let today = AttentionZone.dayOfInstant(nowMs, zone)
        let week = 7 * AttentionZone.dayMs

        let projectIds = Set(input.projects.map(\.id))
        let tasks = input.tasks.filter { task in task.projectId.map { !$0.isEmpty && projectIds.contains($0) } ?? false }
        let tasksByProject = Dictionary(grouping: tasks) { $0.projectId ?? "" }

        func isPastDue(_ value: AttentionDate?) -> Bool {
            guard let day = AttentionZone.toDay(value, zone), let diff = AttentionZone.daysBetween(today, day) else { return false }
            return diff < 0
        }

        let entries: [AttentionEntry] = input.projects.map { project in
            let projectTasks = tasksByProject[project.id] ?? []
            let open = projectTasks.filter { $0.isCompleted != true }
            let overdue = open.filter { isPastDue($0.dueDate) }
            let blocked = open.filter { $0.status == "Blocked" }
            let completedWeek = projectTasks.filter {
                $0.isCompleted == true && AttentionZone.toInstantOrZero($0.completedAt, zone) >= nowMs - week
            }.count

            var lastActivity: Double = 0
            for task in projectTasks {
                lastActivity = max(lastActivity, AttentionZone.toInstantOrZero(task.createdAt, zone), AttentionZone.toInstantOrZero(task.completedAt, zone))
            }
            let stalledDays: Int? = lastActivity > 0 ? Int(((nowMs - lastActivity) / AttentionZone.dayMs).rounded(.down)) : nil

            let dueDay = AttentionZone.toDay(project.dueDate, zone)
            let dueDiff = dueDay.flatMap { AttentionZone.daysBetween(today, $0) }
            let deadlineDays = dueDiff.flatMap { $0 > 0 ? $0 : nil }

            let declining = project.health?.trend == "declining"
            let critical = project.health?.status == "critical"
            let warning = project.health?.status == "warning"
            let stalled = (stalledDays.map { $0 >= Attention.stalledDays } ?? false) && !open.isEmpty

            var score = overdue.count * 3 + blocked.count * 2
            if critical { score += 6 } else if warning { score += 3 }
            if declining { score += 3 }
            if stalled { score += 3 }
            if let deadlineDays, deadlineDays <= 7, open.count > 3 { score += 2 }

            var chips: [AttentionChip] = []
            if !overdue.isEmpty { chips.append(chip(.overdue, .danger, ["count": .int(overdue.count)])) }
            if !blocked.isEmpty { chips.append(chip(.blocked, .danger, ["count": .int(blocked.count)])) }
            if stalled, let stalledDays { chips.append(chip(.stalled, .warning, ["days": .int(stalledDays)])) }
            if declining { chips.append(chip(.declining, .warning)) }
            else if critical { chips.append(chip(.critical, .danger)) }
            else if warning { chips.append(chip(.warning, .warning)) }
            if let deadlineDays, deadlineDays <= 14 { chips.append(chip(.deadline, .info, ["days": .int(deadlineDays)])) }

            return AttentionEntry(
                projectId: project.id, title: project.title, openCount: open.count, overdueCount: overdue.count,
                blockedCount: blocked.count, stalledDays: stalledDays, deadlineDays: deadlineDays,
                completedWeek: completedWeek, score: score, chips: Array(chips.prefix(3)))
        }

        let entryById = Dictionary(entries.map { ($0.projectId, $0) }, uniquingKeysWith: { first, _ in first })
        let attentionEntries = Array(stableSort(entries.filter { $0.score >= threshold }) { $0.score > $1.score }.prefix(maxAttention))
        let withWork = stableSort(entries.filter { $0.openCount > 0 }) { $0.openCount > $1.openCount }
        let quietCount = max(input.projects.count - attentionEntries.count, 0)

        let bestRunEntry = stableSort(entries) { $0.completedWeek > $1.completedWeek }.first
        let bestRun = bestRunEntry.flatMap { $0.completedWeek > 0 ? AttentionBestRun(projectId: $0.projectId, completedWeek: $0.completedWeek) : nil }

        // Statement + insight
        let statement: AttentionStatement
        if input.projects.isEmpty {
            statement = AttentionStatement(key: "dashboard.pulse.statement.none", params: [:], value: nil, valueKey: "dashboard.pulse.statement.noneValue")
        } else if !attentionEntries.isEmpty {
            statement = AttentionStatement(
                key: attentionEntries.count == 1 ? "dashboard.pulse.statement.driftingOne" : "dashboard.pulse.statement.drifting",
                params: ["total": .int(input.projects.count)], value: String(attentionEntries.count), valueKey: nil)
        } else {
            statement = AttentionStatement(
                key: input.projects.count == 1 ? "dashboard.pulse.statement.steadyOne" : "dashboard.pulse.statement.steady",
                params: [:], value: String(input.projects.count), valueKey: nil)
        }

        var insight: AttentionMessage
        if let worst = attentionEntries.first, !worst.chips.isEmpty {
            insight = message("dashboard.pulse.insight.worst", ["project": .string(worst.title)])
            insight.chips = worst.chips
        } else if let bestRun, let best = entryById[bestRun.projectId] {
            insight = message("dashboard.pulse.insight.bestRun", ["project": .string(best.title), "count": .int(bestRun.completedWeek)])
        } else {
            insight = message("dashboard.pulse.insight.quietAll")
        }

        // Accent
        var accent: AttentionMessage?
        let stalledEntries = entries.filter { ($0.stalledDays.map { $0 >= stalledDays } ?? false) && $0.openCount > 0 }
        if let stalled = stableSort(stalledEntries, { ($0.stalledDays ?? 0) > ($1.stalledDays ?? 0) }).first {
            if let deadline = stalled.deadlineDays {
                accent = message("dashboard.accent.stalledDeadline",
                                 ["project": .string(stalled.title), "deadline": .int(deadline), "days": .int(stalled.stalledDays ?? 0)])
            } else {
                accent = message("dashboard.accent.stalled", ["project": .string(stalled.title), "days": .int(stalled.stalledDays ?? 0)])
            }
        } else if let unlocker = input.unlocker, unlocker.count > 0 {
            accent = message("dashboard.accent.unlock", ["title": .string(unlocker.title), "count": .int(unlocker.count)])
        }

        // Stats + momentum
        let completed = tasks.filter { $0.isCompleted == true }
        let current = completed.filter { AttentionZone.toInstantOrZero($0.completedAt, zone) >= nowMs - week }.count
        let previous = completed.filter {
            let at = AttentionZone.toInstantOrZero($0.completedAt, zone)
            return at >= nowMs - 2 * week && at < nowMs - week
        }.count

        let stats = AttentionStats(projects: input.projects.count, open: entries.reduce(0) { $0 + $1.openCount },
                                   overdue: entries.reduce(0) { $0 + $1.overdueCount }, doneWeek: current)

        let caption: AttentionMessage
        if previous == 0 && current > 0 {
            caption = message("dashboard.pulse.momentum.firstWeek")
        } else if current > previous {
            caption = message("dashboard.pulse.momentum.up", ["diff": .int(current - previous)])
        } else if current < previous {
            caption = message("dashboard.pulse.momentum.down", ["diff": .int(previous - current)])
        } else {
            caption = message("dashboard.pulse.momentum.flat")
        }

        var trend = (0..<14).map { AttentionMomentum.Point(date: AttentionZone.addDays(today, $0 - 13), value: 0) }
        for task in completed {
            guard let day = AttentionZone.toDay(task.completedAt, zone), let index = trend.firstIndex(where: { $0.date == day }) else { continue }
            trend[index].value += 1
        }

        // Wins
        var wins: [AttentionMessage] = []
        if current > 0 { wins.append(message("dashboard.pulse.wins.completedWeek", ["count": .int(current)])) }
        if let bestRun, let best = entryById[bestRun.projectId] {
            wins.append(message("dashboard.pulse.wins.bestProject", ["project": .string(best.title), "count": .int(bestRun.completedWeek)]))
        }
        if quietCount > 0 && !input.projects.isEmpty {
            wins.append(message(quietCount == 1 ? "dashboard.pulse.wins.quietProjectsOne" : "dashboard.pulse.wins.quietProjects",
                                ["count": .int(quietCount)]))
        }

        // Horizon: deadlines from tomorrow through the next 14 days (tasks first, so a task wins a tie)
        var horizonAll: [(item: AttentionHorizonItem, sortKey: Double)] = []
        for task in tasks where task.isCompleted != true {
            guard let day = AttentionZone.toDay(task.dueDate, zone), let diff = AttentionZone.daysBetween(today, day), (1...14).contains(diff) else { continue }
            horizonAll.append((AttentionHorizonItem(kind: .task, id: task.id, title: task.title ?? "", projectId: task.projectId, day: day),
                               AttentionZone.dateSortKey(task.dueDate, zone)))
        }
        for project in input.projects {
            guard let day = AttentionZone.toDay(project.dueDate, zone), let diff = AttentionZone.daysBetween(today, day), (1...14).contains(diff) else { continue }
            horizonAll.append((AttentionHorizonItem(kind: .project, id: project.id, title: project.title, projectId: project.id, day: day),
                               AttentionZone.dateSortKey(project.dueDate, zone)))
        }
        let horizon = stableSort(horizonAll) { $0.sortKey < $1.sortKey }.prefix(4).map(\.item)

        return AttentionResult(
            today: today, timeZone: zone.identifier, entries: entries, attention: attentionEntries.map(\.projectId),
            quietCount: quietCount, rail: withWork.prefix(maxRail).map(\.projectId), workload: withWork.prefix(maxWorkload).map(\.projectId),
            bestRun: bestRun, statement: statement, insight: insight, accent: accent, stats: stats,
            momentum: AttentionMomentum(current: current, previous: previous, caption: caption, trend: trend),
            wins: Array(wins.prefix(3)), horizon: Array(horizon))
    }
}
