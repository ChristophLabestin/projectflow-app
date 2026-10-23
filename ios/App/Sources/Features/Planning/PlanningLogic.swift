import SwiftUI
import PFDesign
import PFDomain
import PFModel

/// Derived planning data of one project: milestone timeline entries, sprint grouping and backlog.
/// Pure functions of the store contents so views stay thin.
struct PlanningSnapshot {
    let tasks: [WorkTask]
    let milestones: [Milestone]
    let sprints: [Sprint]
    let initiatives: [Initiative]
    let now: Date
    var zone: TimeZone { Formatting.timeZone }

    var today: String { ZonedDate.toDay(DateLike(now), in: zone) ?? "" }

    func day(_ date: FlexDate?) -> String? { date.flatMap { ZonedDate.toDay(DateLike($0), in: zone) } }

    /// Whole days from today to `date` (negative = past), nil without a date.
    func daysUntil(_ date: FlexDate?) -> Int? { day(date).map { ZonedDate.daysBetween(today, $0) } }

    // MARK: Milestones

    func progress(of milestone: Milestone) -> (done: Int, total: Int) {
        let linked = milestone.linkedTaskIds.compactMap { id in tasks.first { $0.id == id } }
        return (linked.filter(\.isCompleted).count, linked.count)
    }

    func state(of milestone: Milestone) -> PlanningTimelineEntry.State {
        switch milestone.statusRaw {
        case "Achieved", "Completed": return .achieved
        case "Missed": return .missed
        default:
            guard let days = daysUntil(milestone.dueDate) else { return .upcoming }
            if days < 0 { return .overdue }
            return days <= 7 ? .soon : .upcoming
        }
    }

    func countdown(of milestone: Milestone) -> String? {
        switch state(of: milestone) {
        case .achieved: return L10n.t("planning.milestone.status.Achieved")
        case .missed: return L10n.t("planning.milestone.status.Missed")
        default: break
        }
        guard let days = daysUntil(milestone.dueDate) else { return L10n.t("common.noDate") }
        switch days {
        case ..<(-1): return L10n.plural("due.overdueDays", -days)
        case -1: return L10n.t("due.yesterday")
        case 0: return L10n.t("due.today")
        case 1: return L10n.t("due.tomorrow")
        default: return L10n.plural("due.inDays", days)
        }
    }

    var timeline: [PlanningTimelineEntry] {
        milestones.map { milestone in
            let progress = progress(of: milestone)
            return PlanningTimelineEntry(
                id: milestone.id, title: milestone.title,
                dateText: milestone.dueDate.map { Formatting.shortDate($0) } ?? L10n.t("common.noDate"),
                countdownText: countdown(of: milestone),
                progress: progress.total == 0 ? nil : Double(progress.done) / Double(progress.total),
                progressText: progress.total == 0 ? nil : "\(progress.done)/\(progress.total)",
                state: state(of: milestone))
        }
    }

    // MARK: Sprints

    var activeSprint: Sprint? { sprints.first { $0.statusRaw == "Active" } }

    var plannedSprints: [Sprint] {
        sprints.filter { $0.statusRaw == "Planning" }.sorted { lhs, rhs in
            switch (lhs.startDate, rhs.startDate) {
            case let (a?, b?) where a != b: return a < b
            case (.some, .none): return true
            case (.none, .some): return false
            default: return (lhs.createdAt ?? .init(instant: .distantPast)) < (rhs.createdAt ?? .init(instant: .distantPast))
            }
        }
    }

    var completedSprints: [Sprint] { sprints.filter { $0.statusRaw == "Completed" || $0.statusRaw == "Archived" } }

    var liveSprintIds: Set<String> { Set(sprints.filter { $0.statusRaw == "Active" || $0.statusRaw == "Planning" }.map(\.id)) }

    func tasks(in sprint: Sprint) -> [WorkTask] { tasks.filter { $0.sprintId == sprint.id } }

    func progress(of sprint: Sprint) -> (done: Int, total: Int) {
        let list = tasks(in: sprint)
        return (list.filter(\.isCompleted).count, list.count)
    }

    /// Open tasks that are in no running or planned sprint.
    var backlog: [WorkTask] {
        tasks.filter { task in
            guard !task.isCompleted else { return false }
            guard let sprintId = task.sprintId else { return true }
            return !liveSprintIds.contains(sprintId)
        }
    }

    func sprintRange(_ sprint: Sprint) -> String? {
        switch (sprint.startDate, sprint.endDate) {
        case let (start?, end?): return "\(Formatting.shortDate(start)) – \(Formatting.shortDate(end))"
        case let (start?, nil): return Formatting.shortDate(start)
        case let (nil, end?): return "– \(Formatting.shortDate(end))"
        default: return nil
        }
    }

    /// "Noch 5 Tage" / "Endet heute" / "Seit 2 Tagen vorbei" for the active sprint.
    func sprintCountdown(_ sprint: Sprint) -> String? {
        guard let days = daysUntil(sprint.endDate) else { return nil }
        switch days {
        case ..<0: return L10n.plural("planning.sprint.overdueDays", -days)
        case 0: return L10n.t("planning.sprint.endsToday")
        default: return L10n.plural("planning.sprint.daysLeft", days)
        }
    }

    // MARK: Initiatives

    func progress(of initiative: Initiative) -> (done: Int, total: Int) {
        let list = tasks.filter { $0.initiativeId == initiative.id }
        return (list.filter(\.isCompleted).count, list.count)
    }
}
