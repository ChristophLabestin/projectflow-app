import Foundation

// Project list grouping (`portfolioGroup` / `classifyPortfolio` in `web/utils/attention.ts`), pinned by
// `shared/fixtures/portfolioGroup/*.json`.

public enum PortfolioGroup: String, Sendable, Codable, CaseIterable, Hashable {
    case attention, active, planning, paused, closed
}

/// Open-task overdue/blocked counts of a project (nil while its tasks are not loaded).
public struct PortfolioSignals: Sendable, Hashable {
    public var overdue: Int
    public var blocked: Int

    public init(overdue: Int, blocked: Int) {
        self.overdue = overdue
        self.blocked = blocked
    }
}

public struct PortfolioClassification: Sendable, Hashable, Codable {
    public var projectId: String
    public var group: PortfolioGroup
}

public struct PortfolioInput: Sendable, Decodable {
    public var now: AttentionDate
    public var timeZone: String?
    public var projects: [AttentionProject]
    public var tasks: [AttentionTask]
    /// Project ids whose tasks are loaded; nil = all projects.
    public var loadedProjectIds: [String]?

    public init(now: AttentionDate, timeZone: String? = nil, projects: [AttentionProject], tasks: [AttentionTask], loadedProjectIds: [String]? = nil) {
        self.now = now
        self.timeZone = timeZone
        self.projects = projects
        self.tasks = tasks
        self.loadedProjectIds = loadedProjectIds
    }
}

public extension Attention {
    private static let planningStatuses: Set<String> = ["Planning", "Brainstorming", "Backlog"]
    private static let closedStatuses: Set<String> = ["Completed", "Canceled"]

    /// Group of a project in the portfolio list.
    static func portfolioGroup(status: String?, dueDate: AttentionDate?, signals: PortfolioSignals?, healthStatus: String?,
                               now: AttentionDate, timeZone: String?) -> PortfolioGroup {
        let status = status ?? ""
        if closedStatuses.contains(status) { return .closed }
        if status == "On Hold" { return .paused }
        if planningStatuses.contains(status) { return .planning }
        let zone = AttentionZone.zone(timeZone)
        let today = AttentionZone.dayOfInstant(AttentionZone.toInstantOrZero(now, zone), zone)
        let dueDay = AttentionZone.toDay(dueDate, zone)
        let dueOverdue = dueDay.flatMap { AttentionZone.daysBetween(today, $0) }.map { $0 < 0 } ?? false
        let needsAttention = (signals.map { $0.overdue > 0 || $0.blocked > 0 } ?? false)
            || healthStatus == "critical"
            || ((dueDate?.isPresent ?? false) && dueOverdue)
        return needsAttention ? .attention : .active
    }

    /// Open-task signals for one project from a task list (`classifyPortfolio`).
    static func signals(for projectId: String, tasks: [AttentionTask], now: AttentionDate, timeZone: String?) -> PortfolioSignals {
        let zone = AttentionZone.zone(timeZone)
        let today = AttentionZone.dayOfInstant(AttentionZone.toInstantOrZero(now, zone), zone)
        var signals = PortfolioSignals(overdue: 0, blocked: 0)
        for task in tasks where task.projectId == projectId && task.isCompleted != true {
            if task.status == "Blocked" { signals.blocked += 1 }
            if let day = AttentionZone.toDay(task.dueDate, zone), let diff = AttentionZone.daysBetween(today, day), diff < 0 { signals.overdue += 1 }
        }
        return signals
    }

    /// Groups every project from its tasks.
    static func classifyPortfolio(_ input: PortfolioInput) -> [PortfolioClassification] {
        input.projects.map { project in
            let loaded = input.loadedProjectIds.map { $0.contains(project.id) } ?? true
            let signals = loaded ? signals(for: project.id, tasks: input.tasks, now: input.now, timeZone: input.timeZone) : nil
            return PortfolioClassification(
                projectId: project.id,
                group: portfolioGroup(status: project.status, dueDate: project.dueDate, signals: signals, healthStatus: project.health?.status,
                                      now: input.now, timeZone: input.timeZone))
        }
    }
}
