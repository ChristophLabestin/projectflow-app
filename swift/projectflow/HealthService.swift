import Foundation
import FirebaseCore

enum HealthStatus: String {
    case excellent
    case healthy
    case normal
    case warning
    case critical
    case stalemate

    var label: String {
        switch self {
        case .excellent:
            return "Excellent"
        case .healthy:
            return "Healthy"
        case .normal:
            return "Normal"
        case .warning:
            return "Warning"
        case .critical:
            return "Critical"
        case .stalemate:
            return "Stalemate"
        }
    }
}

enum HealthFactorType: String {
    case positive
    case negative
    case neutral
}

struct HealthFactor: Equatable {
    let id: String
    let label: String
    let description: String
    let impact: Int
    let type: HealthFactorType
    let labelKey: String?
    let descriptionKey: String?
    let meta: [String: String]?
}

enum HealthTrend: String {
    case improving
    case declining
    case stable

    var label: String {
        switch self {
        case .improving:
            return "Improving"
        case .declining:
            return "Declining"
        case .stable:
            return "Stable"
        }
    }
}

struct ProjectHealthSnapshot: Equatable {
    let score: Int
    let status: HealthStatus
    let factors: [HealthFactor]
    let recommendations: [String]
    let recommendationKeys: [String]
    let trend: HealthTrend
    let lastUpdated: Date
    let highlights: [String]
}

struct SpotlightReason: Equatable {
    let key: String
    let text: String
    let weight: Int
    let meta: [String: String]?
}

struct SpotlightScore: Equatable {
    let score: Int
    let reasons: [SpotlightReason]
    let primaryReason: String
    let primaryReasonKey: String?
    let primaryReasonMeta: [String: String]?
    let reason: String
    let reasonKey: String?
    let reasonMeta: [String: String]?
}

struct WorkspaceHealth: Equatable {
    let score: Int
    let status: HealthStatus
    let breakdown: HealthBreakdown
    let trend: HealthTrend
}

struct HealthBreakdown: Equatable {
    let critical: Int
    let warning: Int
    let healthy: Int
    let excellent: Int
    let normal: Int
    let total: Int
}

enum HealthService {
    private static let day: TimeInterval = 24 * 60 * 60
    private static let week: TimeInterval = 7 * 24 * 60 * 60

    static func calculateProjectHealth(
        project: Project,
        tasks: [ProjectTask] = [],
        milestones: [Milestone] = [],
        issues: [Issue] = [],
        sprints: [Sprint] = [],
        activities: [ActivityItem] = []
    ) -> ProjectHealthSnapshot {
        var score = 70
        var factors: [HealthFactor] = []
        var recommendationEntries: [(key: String, text: String)] = []
        let now = Date()

        func addRecommendation(_ key: String, _ text: String) {
            recommendationEntries.append((key: key, text: text))
        }

        // 1. DEADLINE URGENCY
        if let dueDate = parseDate(project.dueDate) {
            let daysUntilDue = (dueDate.timeIntervalSince(now)) / day

            if daysUntilDue < 0 {
                let overdueDays = abs(Int(floor(daysUntilDue)))
                let urgency = min(40, abs(Int(floor(daysUntilDue))) * 3)
                score -= (30 + urgency)
                factors.append(
                    HealthFactor(
                        id: "deadline_overdue",
                        label: "Deadline Overdue",
                        description: "The project passed its deadline \(overdueDays) days ago.",
                        impact: -(30 + urgency),
                        type: .negative,
                        labelKey: "health.factors.deadline_overdue.label",
                        descriptionKey: "health.factors.deadline_overdue.description",
                        meta: ["days": "\(overdueDays)"]
                    )
                )
                addRecommendation(
                    "health.recommendations.updateDeadline",
                    "Update project deadline or complete outstanding core milestones."
                )
            } else if daysUntilDue <= 3 {
                score -= 25
                factors.append(
                    HealthFactor(
                        id: "deadline_imminent",
                        label: "Deadline Imminent",
                        description: "The project deadline is less than 3 days away.",
                        impact: -25,
                        type: .negative,
                        labelKey: "health.factors.deadline_imminent.label",
                        descriptionKey: "health.factors.deadline_imminent.description",
                        meta: nil
                    )
                )
                addRecommendation(
                    "health.recommendations.prioritizeTasks",
                    "Prioritize remaining high-priority tasks to meet the deadline."
                )
            } else if daysUntilDue <= 14 {
                score -= 5
                factors.append(
                    HealthFactor(
                        id: "deadline_approaching",
                        label: "Deadline Approaching",
                        description: "The project is due within 2 weeks.",
                        impact: -5,
                        type: .neutral,
                        labelKey: "health.factors.deadline_approaching.label",
                        descriptionKey: "health.factors.deadline_approaching.description",
                        meta: nil
                    )
                )
            }
        }

        // 2. TASK VELOCITY & PROGRESS
        let totalTasks = tasks.count
        let completedTasks = tasks.filter { $0.isCompleted || $0.status == "Done" }.count
        let progress = totalTasks > 0 ? (Double(completedTasks) / Double(totalTasks)) * 100 : project.progress
        var recentCompletions = 0

        if totalTasks > 0 {
            recentCompletions = tasks.filter { task in
                guard task.isCompleted || task.status == "Done" else { return false }
                let created = task.createdAt?.dateValue() ?? Date.distantPast
                return now.timeIntervalSince(created) < week
            }.count

            if recentCompletions >= 5 {
                score += 15
                factors.append(
                    HealthFactor(
                        id: "high_velocity",
                        label: "High Velocity",
                        description: "\(recentCompletions) tasks completed in the last week. Great momentum!",
                        impact: 15,
                        type: .positive,
                        labelKey: "health.factors.high_velocity.label",
                        descriptionKey: "health.factors.high_velocity.description",
                        meta: ["count": "\(recentCompletions)"]
                    )
                )
            } else if recentCompletions > 0 {
                score += 5
                factors.append(
                    HealthFactor(
                        id: "steady_progress",
                        label: "Steady Progress",
                        description: "Active progress is being made on project tasks.",
                        impact: 5,
                        type: .positive,
                        labelKey: "health.factors.steady_progress.label",
                        descriptionKey: "health.factors.steady_progress.description",
                        meta: nil
                    )
                )
            } else if totalTasks > 5 && progress < 90 {
                score -= 10
                factors.append(
                    HealthFactor(
                        id: "stalled_velocity",
                        label: "Stalled Velocity",
                        description: "No tasks completed in the last 7 days.",
                        impact: -10,
                        type: .negative,
                        labelKey: "health.factors.stalled_velocity.label",
                        descriptionKey: "health.factors.stalled_velocity.description",
                        meta: nil
                    )
                )
                addRecommendation(
                    "health.recommendations.breakdownTasks",
                    "Consider breaking down large tasks to regain momentum."
                )
            }

            let newTasks = tasks.filter { task in
                let created = task.createdAt?.dateValue() ?? Date.distantPast
                return now.timeIntervalSince(created) < week
            }.count

            if newTasks > recentCompletions + 5 && totalTasks > 10 {
                score -= 10
                factors.append(
                    HealthFactor(
                        id: "scope_creep",
                        label: "Scope Creep",
                        description: "Tasks are being added faster than they are being completed.",
                        impact: -10,
                        type: .negative,
                        labelKey: "health.factors.scope_creep.label",
                        descriptionKey: "health.factors.scope_creep.description",
                        meta: nil
                    )
                )
                addRecommendation(
                    "health.recommendations.reviewScope",
                    "Review project scope and prioritize essential features."
                )
            }

            let incompleteTasks = tasks.filter { !$0.isCompleted && $0.status != "Done" }
            let tasksWithDueDate = incompleteTasks.filter { !$0.dueDate.isEmpty }

            var taskDeadlineImpact = 0
            var overdueCount = 0
            var dueSoonCount = 0
            let todayMidnight = Calendar.current.startOfDay(for: now)

            for task in tasksWithDueDate {
                guard let taskDate = parseDate(task.dueDate) else { continue }
                let normalized = Calendar.current.startOfDay(for: taskDate)
                let diffDays = normalized.timeIntervalSince(todayMidnight) / day

                if diffDays < 0 {
                    overdueCount += 1
                    let base = task.priority == "Urgent" ? 12 : task.priority == "High" ? 8 : 4
                    taskDeadlineImpact -= base
                } else if diffDays == 0 || diffDays == 1 {
                    dueSoonCount += 1
                    let base = task.priority == "Urgent" ? 35 : task.priority == "High" ? 25 : 15
                    taskDeadlineImpact -= base
                } else if diffDays <= 3 && diffDays >= 0 {
                    dueSoonCount += 1
                    let base = task.priority == "Urgent" ? 10 : task.priority == "High" ? 8 : 4
                    taskDeadlineImpact -= base
                }
            }

            if overdueCount > 0 {
                let impact = min(60, abs(taskDeadlineImpact * 2))
                score -= impact
                factors.append(
                    HealthFactor(
                        id: "tasks_overdue",
                        label: "Overdue Tasks",
                        description: "\(overdueCount) tasks are past their deadline.",
                        impact: -impact,
                        type: .negative,
                        labelKey: "health.factors.tasks_overdue.label",
                        descriptionKey: "health.factors.tasks_overdue.description",
                        meta: ["count": "\(overdueCount)"]
                    )
                )
                addRecommendation(
                    "health.recommendations.rescheduleOverdue",
                    "Complete or reschedule overdue tasks immediately."
                )
            } else if dueSoonCount > 0 {
                let impact = min(25, Int(abs(Double(taskDeadlineImpact)) * 1.5))
                score -= impact
                factors.append(
                    HealthFactor(
                        id: "tasks_due_soon",
                        label: "Tasks Due Soon",
                        description: "\(dueSoonCount) tasks are due within 72 hours.",
                        impact: -impact,
                        type: .negative,
                        labelKey: "health.factors.tasks_due_soon.label",
                        descriptionKey: "health.factors.tasks_due_soon.description",
                        meta: ["count": "\(dueSoonCount)"]
                    )
                )
            }

        }

        // 3. BLOCKERS & ISSUES
        let blockedTasks = tasks.filter { $0.status == "Blocked" }.count
        if blockedTasks > 0 {
            let impact = min(25, blockedTasks * 5)
            score -= impact
            factors.append(
                HealthFactor(
                    id: "blocked_tasks",
                    label: "Task Blockers",
                    description: "\(blockedTasks) task(s) are currently blocked.",
                    impact: -impact,
                    type: .negative,
                    labelKey: "health.factors.blocked_tasks.label",
                    descriptionKey: "health.factors.blocked_tasks.description",
                    meta: ["count": "\(blockedTasks)"]
                )
            )
            addRecommendation(
                "health.recommendations.resolveBlockers",
                "Resolve dependencies or clear blockers for the restricted tasks."
            )
        }

        let urgentIssues = issues.filter {
            ($0.priority == "Urgent" || $0.priority == "High") && $0.status != "Resolved" && $0.status != "Closed"
        }.count
        if urgentIssues > 0 {
            let impact = min(20, urgentIssues * 4)
            score -= impact
            factors.append(
                HealthFactor(
                    id: "unresolved_issues",
                    label: "Critical Issues",
                    description: "\(urgentIssues) high-priority issue(s) remain unresolved.",
                    impact: -impact,
                    type: .negative,
                    labelKey: "health.factors.unresolved_issues.label",
                    descriptionKey: "health.factors.unresolved_issues.description",
                    meta: ["count": "\(urgentIssues)"]
                )
            )
            addRecommendation(
                "health.recommendations.addressIssues",
                "Address critical issues to stabilize project health."
            )
        }

        // 4. ENGAGEMENT & STALENESS
        let lastActivity = activities.compactMap { $0.createdAt?.dateValue() }.max()
            ?? project.updatedAt?.dateValue()
            ?? project.createdAt?.dateValue()
            ?? now

        let idleDays = now.timeIntervalSince(lastActivity) / day

        if idleDays > 14 {
            score -= 25
            factors.append(
                HealthFactor(
                    id: "stale_project",
                    label: "Stale Project",
                    description: "No activity recorded for over \(Int(floor(idleDays))) days.",
                    impact: -25,
                    type: .negative,
                    labelKey: "health.factors.stale_project.label",
                    descriptionKey: "health.factors.stale_project.description",
                    meta: ["days": "\(Int(floor(idleDays)))"]
                )
            )
            addRecommendation(
                "health.recommendations.reactivateProject",
                "Reactivate the project with a status update or team meeting."
            )
        } else if idleDays > 7 {
            score -= 10
            factors.append(
                HealthFactor(
                    id: "inactive_recent",
                    label: "Recent Inactivity",
                    description: "No activity in the last 7 days.",
                    impact: -10,
                    type: .neutral,
                    labelKey: "health.factors.inactive_recent.label",
                    descriptionKey: "health.factors.inactive_recent.description",
                    meta: nil
                )
            )
        } else {
            score += 2
            factors.append(
                HealthFactor(
                    id: "active_engagement",
                    label: "Highly Engaged",
                    description: "The project has seen recent activity and team engagement.",
                    impact: 2,
                    type: .positive,
                    labelKey: "health.factors.active_engagement.label",
                    descriptionKey: "health.factors.active_engagement.description",
                    meta: nil
                )
            )
        }

        // 5. MILESTONE HEALTH
        let missedMilestones = milestones.filter { milestone in
            if milestone.status == "Missed" {
                return true
            }
            if milestone.status == "Pending", let due = parseDate(milestone.dueDate) {
                return due < now
            }
            return false
        }.count

        if missedMilestones > 0 {
            let impact = min(30, missedMilestones * 12)
            score -= impact
            factors.append(
                HealthFactor(
                    id: "missed_milestones",
                    label: "Milestone Delays",
                    description: "\(missedMilestones) milestone(s) have been missed or are overdue.",
                    impact: -impact,
                    type: .negative,
                    labelKey: "health.factors.missed_milestones.label",
                    descriptionKey: "health.factors.missed_milestones.description",
                    meta: ["count": "\(missedMilestones)"]
                )
            )
            addRecommendation(
                "health.recommendations.replanMilestones",
                "Replan missed milestones to provide a realistic project timeline."
            )
        }

        score = max(0, min(100, score))

        var status: HealthStatus
        if score >= 90 {
            status = .excellent
        } else if score >= 75 {
            status = .healthy
        } else if score >= 50 {
            status = .normal
        } else if score >= 30 {
            status = .warning
        } else {
            status = .critical
        }

        if totalTasks == 0 && (status == .excellent || status == .healthy) {
            status = .normal
            score = min(score, 74)
        }

        if progress < 100 && idleDays > 30 && status != .critical {
            status = .stalemate
        }

        var trend: HealthTrend = .stable
        if score > 80 && recentCompletions > 2 {
            trend = .improving
        }
        if score < 50 && (blockedTasks > 0 || urgentIssues > 0) {
            trend = .declining
        }

        let hasUrgentDeadline = factors.contains { $0.id == "tasks_due_soon" || $0.id == "deadline_imminent" }
        if hasUrgentDeadline && status != .critical {
            status = .warning
            if score > 48 { score = 48 }
        }

        factors.sort { left, right in
            if status == .critical || status == .warning {
                if left.type == .negative && right.type != .negative { return true }
                if right.type == .negative && left.type != .negative { return false }
            }
            return abs(left.impact) > abs(right.impact)
        }

        var uniqueRecommendations: [(key: String, text: String)] = []
        var seenRecommendations = Set<String>()
        for entry in recommendationEntries {
            if seenRecommendations.contains(entry.key) { continue }
            seenRecommendations.insert(entry.key)
            uniqueRecommendations.append(entry)
        }

        let highlights = factors.prefix(3).map { $0.label }
        let fallbackHighlights: [String] = totalTasks > 0
            ? ["Tasks done: \(completedTasks)/\(totalTasks)"]
            : ["No activity yet"]

        return ProjectHealthSnapshot(
            score: score,
            status: status,
            factors: factors,
            recommendations: uniqueRecommendations.map { $0.text },
            recommendationKeys: uniqueRecommendations.map { $0.key },
            trend: trend,
            lastUpdated: now,
            highlights: highlights.isEmpty ? fallbackHighlights : highlights
        )
    }

    static func calculateSpotlightScore(
        project: Project,
        tasks: [ProjectTask] = [],
        milestones: [Milestone] = [],
        issues: [Issue] = [],
        sprints: [Sprint] = [],
        activities: [ActivityItem] = []
    ) -> SpotlightScore {
        var score = 0
        var reasons: [SpotlightReason] = []
        let now = Date()

        func addReason(_ key: String, _ text: String, _ weight: Int, _ meta: [String: String]? = nil) {
            reasons.append(SpotlightReason(key: key, text: text, weight: weight, meta: meta))
            score += weight
        }

        if let dueDate = parseDate(project.dueDate) {
            let daysUntilDue = (dueDate.timeIntervalSince(now)) / day

            if daysUntilDue < 0 {
                let overdueDays = abs(Int(floor(daysUntilDue)))
                addReason(
                    "health.spotlight.projectOverdue",
                    "Project is \(overdueDays) day\(overdueDays == 1 ? "" : "s") overdue",
                    100,
                    ["days": "\(overdueDays)"]
                )
            } else if daysUntilDue <= 1 {
                addReason("health.spotlight.projectDueToday", "Project due today/tomorrow", 60)
            } else if daysUntilDue <= 3 {
                let days = Int(ceil(daysUntilDue))
                addReason("health.spotlight.projectDueSoon", "Due in \(days) days", 40, ["days": "\(days)"])
            } else if daysUntilDue <= 7 {
                addReason("health.spotlight.projectDueThisWeek", "Due this week", 20)
            }
        }

        if project.priority == "Urgent" {
            addReason("health.spotlight.urgentPriority", "Marked as urgent priority", 30)
        } else if project.priority == "High" {
            addReason("health.spotlight.highPriority", "High priority project", 15)
        }

        let incompleteTasks = tasks.filter { !$0.isCompleted && $0.status != "Done" }
        var overdueTaskCount = 0
        var overdueCriticalCount = 0
        var blockedCount = 0
        var dueTodayCount = 0
        var dueSoonCount = 0
        var dueThisWeekCount = 0

        let todayMidnight = Calendar.current.startOfDay(for: now)

        for task in incompleteTasks {
            if task.status == "Blocked" {
                blockedCount += 1
            }

            guard let dueDate = parseDate(task.dueDate) else { continue }
            let normalized = Calendar.current.startOfDay(for: dueDate)
            let diffDays = normalized.timeIntervalSince(todayMidnight) / day

            if diffDays < 0 {
                overdueTaskCount += 1
                if task.priority == "Urgent" || task.priority == "High" {
                    overdueCriticalCount += 1
                }
            } else if diffDays == 0 {
                dueTodayCount += 1
            } else if diffDays <= 3 {
                dueSoonCount += 1
            } else if diffDays <= 7 {
                dueThisWeekCount += 1
            }
        }

        if overdueCriticalCount > 0 {
            addReason(
                "health.spotlight.criticalOverdueTasks",
                "\(overdueCriticalCount) critical overdue task\(overdueCriticalCount == 1 ? "" : "s")",
                overdueCriticalCount * 50,
                ["count": "\(overdueCriticalCount)"]
            )
        } else if overdueTaskCount > 0 {
            addReason(
                "health.spotlight.overdueTasks",
                "\(overdueTaskCount) overdue task\(overdueTaskCount == 1 ? "" : "s")",
                overdueTaskCount * 25,
                ["count": "\(overdueTaskCount)"]
            )
        }

        if dueTodayCount > 0 {
            addReason(
                "health.spotlight.tasksDueToday",
                "\(dueTodayCount) task\(dueTodayCount == 1 ? "" : "s") due today",
                dueTodayCount * 35,
                ["count": "\(dueTodayCount)"]
            )
        }

        if dueSoonCount > 0 {
            addReason(
                "health.spotlight.tasksDueSoon",
                "\(dueSoonCount) task\(dueSoonCount == 1 ? "" : "s") due in next 3 days",
                dueSoonCount * 15,
                ["count": "\(dueSoonCount)"]
            )
        }

        if blockedCount > 0 {
            addReason(
                "health.spotlight.blockedTasks",
                "\(blockedCount) blocked task\(blockedCount == 1 ? "" : "s") need attention",
                blockedCount * 20,
                ["count": "\(blockedCount)"]
            )
        }

        let pendingMilestones = milestones.filter { $0.status == "Pending" }
        var overdueMilestones = 0
        var imminentMilestones = 0

        for milestone in pendingMilestones {
            guard let dueDate = parseDate(milestone.dueDate) else { continue }
            let diffDays = dueDate.timeIntervalSince(now) / day

            if dueDate < now {
                overdueMilestones += 1
            } else if diffDays < 7 {
                imminentMilestones += 1
            }
        }

        if overdueMilestones > 0 {
            addReason(
                "health.spotlight.overdueMilestones",
                "\(overdueMilestones) overdue milestone\(overdueMilestones == 1 ? "" : "s")",
                overdueMilestones * 60,
                ["count": "\(overdueMilestones)"]
            )
        } else if imminentMilestones > 0 {
            addReason(
                "health.spotlight.milestonesDueSoon",
                "\(imminentMilestones) milestone\(imminentMilestones == 1 ? "" : "s") due this week",
                imminentMilestones * 30,
                ["count": "\(imminentMilestones)"]
            )
        }

        let openIssues = issues.filter { $0.status != "Resolved" && $0.status != "Closed" }
        let urgentIssueCount = openIssues.filter { $0.priority == "Urgent" }.count
        let highPriorityIssueCount = openIssues.filter { $0.priority == "High" }.count

        if urgentIssueCount > 0 {
            addReason(
                "health.spotlight.urgentIssues",
                "\(urgentIssueCount) urgent issue\(urgentIssueCount == 1 ? "" : "s") open",
                urgentIssueCount * 40,
                ["count": "\(urgentIssueCount)"]
            )
        } else if highPriorityIssueCount > 0 {
            addReason(
                "health.spotlight.highPriorityIssues",
                "\(highPriorityIssueCount) high-priority issue\(highPriorityIssueCount == 1 ? "" : "s") open",
                highPriorityIssueCount * 20,
                ["count": "\(highPriorityIssueCount)"]
            )
        }

        if !activities.isEmpty {
            let recentActivityCount = activities.filter { activity in
                let created = activity.createdAt?.dateValue() ?? Date.distantPast
                return now.timeIntervalSince(created) < week
            }.count

            if recentActivityCount > 10 {
                addReason(
                    "health.spotlight.highlyActive",
                    "Highly active with recent updates",
                    15,
                    ["activityCount": "\(recentActivityCount)"]
                )
            } else if recentActivityCount > 0 {
                addReason(
                    "health.spotlight.recentActivity",
                    "Recent project activity",
                    5,
                    ["activityCount": "\(recentActivityCount)"]
                )
            }
        }

        if let dueDate = parseDate(project.dueDate), let startDate = parseDate(project.startDate) {
            let totalDuration = dueDate.timeIntervalSince(startDate)
            let elapsed = now.timeIntervalSince(startDate)

            if totalDuration > 0 && elapsed > 0 {
                let expectedProgress = min(100, (elapsed / totalDuration) * 100)
                let actualProgress = project.progress
                let progressGap = expectedProgress - actualProgress

                if progressGap > 30 && actualProgress < 80 {
                    addReason(
                        "health.spotlight.behindSchedule",
                        "\(Int(round(progressGap)))% behind expected progress",
                        min(40, Int(progressGap)),
                        [
                            "gap": "\(Int(round(progressGap)))",
                            "expected": "\(Int(round(expectedProgress)))",
                            "actual": "\(Int(round(actualProgress)))"
                        ]
                    )
                }
            }
        }

        let activeSprints = sprints.filter { $0.status == "Active" }
        let overdueSprints = sprints.filter { sprint in
            guard sprint.status == "Active", let endDate = parseDate(sprint.endDate) else { return false }
            return endDate < now
        }

        if overdueSprints.count > 0 {
            addReason(
                "health.spotlight.overdueSprints",
                "\(overdueSprints.count) overdue sprint\(overdueSprints.count == 1 ? "" : "s")",
                overdueSprints.count * 70,
                ["count": "\(overdueSprints.count)"]
            )
        } else if activeSprints.count > 0 {
            addReason(
                "health.spotlight.activeSprint",
                "Active sprint in progress",
                10,
                ["count": "\(activeSprints.count)"]
            )
        }

        if project.status == "Active" && project.progress < 20 {
            let progress = project.progress
            if !reasons.contains(where: { $0.key == "health.spotlight.behindSchedule" }) {
                addReason(
                    "health.spotlight.lowProgress",
                    "Only \(Int(progress))% complete",
                    20,
                    ["progress": "\(Int(progress))"]
                )
            }
        }

        if project.status == "Active" {
            score += 10
        } else if project.status == "Brainstorming" || project.status == "Planning" {
            score -= 500
        } else if project.status == "On Hold" {
            score -= 200
        }

        reasons.sort { $0.weight > $1.weight }

        let primaryReason = reasons.first ?? SpotlightReason(
            key: "health.spotlight.recentlyUpdated",
            text: "Recently updated",
            weight: 0,
            meta: nil
        )

        if reasons.isEmpty {
            reasons.append(primaryReason)
        }

        return SpotlightScore(
            score: score,
            reasons: reasons,
            primaryReason: primaryReason.text,
            primaryReasonKey: primaryReason.key,
            primaryReasonMeta: primaryReason.meta,
            reason: primaryReason.text,
            reasonKey: primaryReason.key,
            reasonMeta: primaryReason.meta
        )
    }

    static func calculateWorkspaceHealth(
        projects: [Project],
        healthMap: [String: ProjectHealthSnapshot]
    ) -> WorkspaceHealth {
        guard !projects.isEmpty else {
            return WorkspaceHealth(
                score: 0,
                status: .normal,
                breakdown: HealthBreakdown(critical: 0, warning: 0, healthy: 0, excellent: 0, normal: 0, total: 0),
                trend: .stable
            )
        }

        var totalScore = 0
        var totalWeight = 0.0
        var breakdown = HealthBreakdown(critical: 0, warning: 0, healthy: 0, excellent: 0, normal: 0, total: 0)
        var decliningProjects = 0
        var improvingProjects = 0

        for project in projects {
            guard let health = healthMap[project.id] else { continue }
            breakdown = HealthBreakdown(
                critical: breakdown.critical + (health.status == .critical ? 1 : 0),
                warning: breakdown.warning + (health.status == .warning ? 1 : 0),
                healthy: breakdown.healthy + (health.status == .healthy ? 1 : 0),
                excellent: breakdown.excellent + (health.status == .excellent ? 1 : 0),
                normal: breakdown.normal + ((health.status == .normal || health.status == .stalemate) ? 1 : 0),
                total: breakdown.total + 1
            )

            if health.trend == .declining { decliningProjects += 1 }
            if health.trend == .improving { improvingProjects += 1 }

            var weight = 1.0
            if health.status == .critical { weight = 3 }
            else if health.status == .warning { weight = 2 }

            if project.status == "Brainstorming" || project.status == "Planning" {
                weight = 0.5
            }

            if project.priority == "Urgent" {
                weight *= 1.5
            }

            totalScore += Int(Double(health.score) * weight)
            totalWeight += weight
        }

        let avgScore = totalWeight > 0 ? Int(round(Double(totalScore) / totalWeight)) : 0

        var status: HealthStatus
        if avgScore >= 90 {
            status = .excellent
        } else if avgScore >= 75 {
            status = .healthy
        } else if avgScore >= 50 {
            status = .normal
        } else if avgScore >= 30 {
            status = .warning
        } else {
            status = .critical
        }

        if breakdown.total > 0 && Double(breakdown.critical) / Double(breakdown.total) > 0.2 {
            if avgScore > 49 {
                status = .warning
            }
        }

        var trend: HealthTrend = .stable
        if decliningProjects > improvingProjects {
            trend = .declining
        } else if improvingProjects > decliningProjects {
            trend = .improving
        }

        return WorkspaceHealth(
            score: avgScore,
            status: status,
            breakdown: breakdown,
            trend: trend
        )
    }

    private static func parseDate(_ value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: trimmed) {
            return date
        }

        isoFormatter.formatOptions = [.withInternetDateTime]
        if let date = isoFormatter.date(from: trimmed) {
            return date
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: trimmed)
    }
}
