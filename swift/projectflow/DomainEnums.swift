import Foundation

enum FocusItemType: String, CaseIterable, Codable {
    case task
    case initiative
    case personalTask = "personal-task"

    var displayName: String {
        switch self {
        case .task: return "Task"
        case .initiative: return "Initiative"
        case .personalTask: return "Personal Task"
        }
    }

    var iconName: String {
        switch self {
        case .task: return "checkmark.circle"
        case .initiative: return "flag"
        case .personalTask: return "person.crop.circle"
        }
    }
}

enum ProjectStatus: String, CaseIterable {
    case backlog = "Backlog"
    case planning = "Planning"
    case active = "Active"
    case inProgress = "In Progress"
    case inTesting = "In Testing"
    case paused = "Paused"
    case onHold = "On Hold"
    case completed = "Completed"
    case canceled = "Canceled"

    static func isActive(_ status: String) -> Bool {
        let normalized = status.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized == active.rawValue
            || normalized == inProgress.rawValue
            || normalized == inTesting.rawValue
    }

    static func isPlanning(_ status: String) -> Bool {
        let normalized = status.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized == backlog.rawValue || normalized == planning.rawValue
    }

    static func isPaused(_ status: String) -> Bool {
        let normalized = status.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized == paused.rawValue || normalized == onHold.rawValue
    }

    static func isCompleted(_ status: String) -> Bool {
        status.trimmingCharacters(in: .whitespacesAndNewlines) == completed.rawValue
    }

    static func isCanceled(_ status: String) -> Bool {
        status.trimmingCharacters(in: .whitespacesAndNewlines) == canceled.rawValue
    }

    static func excludesFromHealth(_ status: String) -> Bool {
        isCanceled(status) || isCompleted(status)
    }
}

enum ProjectModule: String, CaseIterable {
    case tasks
    case initiatives
    case activity
    case milestones
    case social
    case marketing
    case accounting
    case sprints

    var navTitle: String {
        switch self {
        case .tasks: return "Tasks"
        case .initiatives: return "Initiatives"
        case .activity: return "Activity"
        case .milestones: return "Milestones"
        case .social: return "Social"
        case .marketing: return "Marketing"
        case .accounting: return "Accounting"
        case .sprints: return "Sprints"
        }
    }

    var iconName: String {
        switch self {
        case .tasks: return "checklist"
        case .initiatives: return "flag"
        case .activity: return "clock.arrow.circlepath"
        case .milestones: return "flag.checkered"
        case .social: return "bubble.left.and.bubble.right"
        case .marketing: return "megaphone"
        case .accounting: return "chart.bar.doc.horizontal"
        case .sprints: return "figure.run"
        }
    }
}

enum InitiativeHealth: String, CaseIterable {
    case onTrack = "On Track"
    case atRisk = "At Risk"
    case offTrack = "Off Track"
}

enum CompanyProjectRole: String {
    case parent = "parent"
    case workstream = "workstream"
}

enum StartupStage: String, CaseIterable {
    case idea
    case validating
    case preparing
    case filed
    case registered
    case operating
}

enum CommentTargetType: String {
    case task
    case initiative
}

enum MainTab: Hashable {
    case home
    case projects
    case focus
    case work
    case inbox
}

enum WorkSegment: String, CaseIterable {
    case tasks
    case initiatives
    case personal
}

enum ProjectNavDestination: Hashable {
    case overview
    case initiatives
    case tasks
    case sprints
    case milestones
    case activity
    case codex
    case details
}
