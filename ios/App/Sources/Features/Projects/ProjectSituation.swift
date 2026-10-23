import SwiftUI
import PFDesign
import PFModel

/// Numbers behind the cockpit: what burns, the next milestone, per-person workload.
struct ProjectPulse {
    let summary: ProjectSummary
    /// Open tasks that are overdue or blocked, most urgent first.
    let burning: [WorkTask]
    let nextMilestone: Milestone?

    init(tasks: [WorkTask], milestones: [Milestone]) {
        summary = ProjectSummary(tasks: tasks)
        burning = tasks.filter { task in
            guard !task.isCompleted else { return false }
            if task.status == .blocked { return true }
            guard let due = task.dueDate else { return false }
            return Formatting.dayOffset(due) < 0
        }
        .sorted { lhs, rhs in
            let l = lhs.dueDate?.instant ?? .distantFuture, r = rhs.dueDate?.instant ?? .distantFuture
            if (lhs.status == .blocked) != (rhs.status == .blocked) { return lhs.status == .blocked }
            return l < r
        }
        nextMilestone = milestones.first { !$0.isAchieved && $0.dueDate != nil } ?? milestones.first { !$0.isAchieved }
    }
}

/// The one-line editorial situation sentence under the project title.
enum ProjectSituation {
    @MainActor
    static func text(pulse: ProjectPulse, status: ProjectStatus) -> Text? {
        let s = pulse.summary
        if s.total == 0 { return Text(L10n.t("projects.situation.empty")) }
        let percent = ProjectsFormat.percent(s.progress)
        switch status {
        case .completed: return marked(L10n.t("projects.situation.completed", ["percent": percent]))
        case .canceled: return marked(L10n.t("projects.situation.canceled", ["open": s.open]))
        case .onHold: return marked(L10n.t("projects.situation.paused", ["percent": percent, "open": s.open]))
        default: break
        }
        if s.open == 0 { return marked(L10n.t("projects.situation.allDone", ["total": s.total])) }
        let fire = pulse.burning.count
        let firePart: String = switch fire {
        case 0: L10n.t("projects.situation.fire.none")
        case 1: L10n.t("projects.situation.fire.one")
        case 2: L10n.t("projects.situation.fire.two")
        default: L10n.t("projects.situation.fire.other", ["count": fire])
        }
        var parts = [firePart]
        if let milestone = pulse.nextMilestone, let due = milestone.dueDate {
            let days = Formatting.dayOffset(due)
            let phrase: String = switch days {
            case ..<0: L10n.t("projects.situation.milestone.overdue")
            case 0: L10n.t("projects.situation.milestone.today")
            case 1: L10n.t("projects.situation.milestone.tomorrow")
            default: L10n.t("projects.situation.milestone.days", ["count": days])
            }
            parts.append(phrase)
        }
        return marked(L10n.t("projects.situation.main", ["percent": percent, "rest": parts.joined(separator: ", ")]))
    }

    /// `**bold**` markers become emphasised runs.
    @MainActor
    static func marked(_ raw: String) -> Text {
        let pieces = raw.components(separatedBy: "**")
        var result = Text("")
        for (index, piece) in pieces.enumerated() where !piece.isEmpty {
            // swiftlint:disable:next shorthand_operator
            result = result + (index % 2 == 1 ? Text(piece).fontWeight(.bold).foregroundStyle(PFColor.textMain) : Text(piece))
        }
        return result
    }
}
