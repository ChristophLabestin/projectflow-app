import Foundation

/// Task status as stored by the web (`web/types.ts` TaskStatus). Legacy `Todo` reads as `.open`.
public enum TaskStatus: String, CaseIterable, Sendable, Codable, Hashable {
    case backlog = "Backlog"
    case open = "Open"
    case inProgress = "In Progress"
    case review = "Review"
    case onHold = "On Hold"
    case blocked = "Blocked"
    case done = "Done"

    public init(raw: String?) {
        switch raw {
        case "Todo", nil, "": self = .open
        default: self = TaskStatus(rawValue: raw!) ?? .open
        }
    }

    /// Status tone key used by the design system (`PFColor.status(_:)`).
    public var tone: StatusTone {
        switch self {
        case .backlog: .backlog
        case .open: .open
        case .inProgress: .inProgress
        case .review: .review
        case .onHold: .onHold
        case .blocked: .blocked
        case .done: .done
        }
    }

    /// Order used for boards and pickers.
    public static let workflow: [TaskStatus] = [.backlog, .open, .inProgress, .review, .onHold, .blocked, .done]
}

/// Initiative / project-level status tones also include `planning`.
public enum StatusTone: String, Sendable, Codable, Hashable, CaseIterable {
    case backlog, open, inProgress, review, onHold, blocked, done, planning
}

public enum TaskPriority: String, CaseIterable, Sendable, Codable, Hashable, Comparable {
    case low = "Low"
    case medium = "Medium"
    case high = "High"
    case urgent = "Urgent"

    public init?(raw: String?) {
        guard let raw else { return nil }
        if let value = TaskPriority(rawValue: raw) { self = value; return }
        switch raw.lowercased() {
        case "low": self = .low
        case "medium": self = .medium
        case "high": self = .high
        case "urgent": self = .urgent
        default: return nil
        }
    }

    public var rank: Int {
        switch self { case .low: 0; case .medium: 1; case .high: 2; case .urgent: 3 }
    }

    public static func < (lhs: TaskPriority, rhs: TaskPriority) -> Bool { lhs.rank < rhs.rank }
}

public enum ProjectStatus: String, CaseIterable, Sendable, Codable, Hashable {
    case active = "Active"
    case inTesting = "In Testing"
    case backlog = "Backlog"
    case brainstorming = "Brainstorming"
    case canceled = "Canceled"
    case completed = "Completed"
    case review = "Review"
    case onHold = "On Hold"
    case planning = "Planning"

    public init(raw: String?) { self = ProjectStatus(rawValue: raw ?? "") ?? .active }

    /// Portfolio lifecycle bucket (`ProjectPortfolioList`): active, planning, paused, closed.
    public var lifecycle: ProjectLifecycle {
        switch self {
        case .active, .inTesting, .review: .active
        case .backlog, .brainstorming, .planning: .planning
        case .onHold: .paused
        case .completed, .canceled: .closed
        }
    }

    public var tone: StatusTone {
        switch self {
        case .active, .inTesting: .inProgress
        case .review: .review
        case .backlog, .brainstorming: .backlog
        case .planning: .planning
        case .onHold: .onHold
        case .completed: .done
        case .canceled: .blocked
        }
    }
}

public enum ProjectLifecycle: String, Sendable, Codable, CaseIterable {
    case active, planning, paused, closed
}

public enum InitiativeHealth: String, Sendable, Codable, CaseIterable {
    case onTrack = "On Track"
    case atRisk = "At Risk"
    case offTrack = "Off Track"
}

public enum WorkspaceRole: Hashable, Sendable, Codable {
    case owner, admin, member, guest
    case custom(String)

    public init(raw: String?) {
        switch raw {
        case "Owner": self = .owner
        case "Admin": self = .admin
        case "Member", nil: self = .member
        case "Guest": self = .guest
        default: self = .custom(raw!)
        }
    }

    public var isFullMember: Bool { self != .guest }
}

public enum FocusItemType: String, Sendable, Codable, Hashable {
    case task
    case initiative
    case personalTask = "personal-task"
    case issue
}

public enum FocusStatus: String, Sendable, Codable, Hashable {
    case active, snoozed, blocked
}

public enum FocusLastAction: String, Sendable, Codable, Hashable {
    case started, resumed, snoozed, blocked, completed, cleared
}

public enum NotificationKind: String, Sendable, Codable, Hashable {
    case taskAssigned = "task_assigned"
    case taskUpdated = "task_updated"
    case taskCompleted = "task_completed"
    case projectInvite = "project_invite"
    case workspaceInvite = "workspace_invite"
    case commentMention = "comment_mention"
    case commentAdded = "comment_added"
    case projectShared = "project_shared"
    case subtaskAssigned = "subtask_assigned"
    case joinRequest = "project_join_request"
    case joinRequestAccepted = "project_join_request_accepted"
    case joinRequestDenied = "project_join_request_denied"
    case reminder
    case taskDueToday = "task_due_today"
    case morningBriefing = "morning_briefing"
    case dayClose = "day_close"
    case other

    public init(raw: String?) { self = NotificationKind(rawValue: raw ?? "") ?? .other }

    public var filter: InboxFilter {
        switch self {
        case .commentMention: .mentions
        case .taskAssigned, .subtaskAssigned: .assignments
        default: .all
        }
    }
}

public enum InboxFilter: String, Sendable, CaseIterable {
    case all, mentions, assignments
}

public enum ProjectModule: String, Sendable, Codable, CaseIterable {
    case tasks, initiatives, activity, milestones, social, marketing, accounting, sprints
}
