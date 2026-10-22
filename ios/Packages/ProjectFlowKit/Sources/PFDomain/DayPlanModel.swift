import Foundation
import PFModel

// Bridges the app's model types (PFModel) to the pure logic inputs.

public extension DayPlanTask {
    /// A project task as the plan sees it. `status` keeps its raw value (`Todo` already reads as `Open`).
    init(_ task: WorkTask) {
        self.init(
            id: task.id, title: task.title, projectId: task.projectId, tenantId: task.tenantId,
            status: task.status.rawValue, isCompleted: task.isCompleted, priority: task.priority?.rawValue,
            dueDate: DateLike(task.dueDate), scheduledDate: DateLike(task.scheduledDate),
            createdAt: DateLike(task.createdAt), completedAt: DateLike(task.completedAt),
            dependencies: task.dependencies, blockerNote: task.blockerNote, nextStep: task.nextStep,
            assigneeIds: task.effectiveAssignees
        )
    }

    /// A personal task: no project, never blocked.
    init(_ task: PersonalTask) {
        self.init(
            id: task.id, title: task.title, projectId: nil, tenantId: task.tenantId,
            status: task.status.rawValue, isCompleted: task.isCompleted, priority: task.priority?.rawValue,
            dueDate: DateLike(task.dueDate), scheduledDate: DateLike(task.scheduledDate),
            createdAt: DateLike(task.createdAt), completedAt: DateLike(task.completedAt)
        )
    }
}

public extension DayPlanProject {
    init(_ project: Project) { self.init(id: project.id, title: project.title, dueDate: DateLike(project.dueDate)) }
}

public extension DayPlanFocus {
    init(_ focus: FocusState) {
        self.init(
            id: focus.itemId, type: focus.itemType.rawValue, title: focus.title,
            projectId: focus.projectId, tenantId: focus.tenantId, isCompleted: nil,
            status: focus.status.rawValue, snoozedUntil: DateLike(focus.snoozedUntil)
        )
    }
}

public extension Project {
    /// The web's `isProjectActiveForGlobalSignals`: status Active or In Testing (never Canceled).
    var isActiveForDayPlan: Bool { status == .active || status == .inTesting }
}

public extension DayPlanInput {
    /// Builds the input from the workspace data. `now` and `timeZone` are explicit so callers (and
    /// tests) never depend on the system clock.
    init(now: Date, timeZone: TimeZone = .current, projects: [Project], tasks: [WorkTask], personalTasks: [PersonalTask],
         otherTasks: [WorkTask] = [], focus: FocusState? = nil) {
        self.init(
            now: DateLike(now), timeZone: timeZone.identifier,
            projects: projects.filter(\.isActiveForDayPlan).map(DayPlanProject.init),
            tasks: tasks.map(DayPlanTask.init), personalTasks: personalTasks.map(DayPlanTask.init),
            otherTasks: otherTasks.map(DayPlanTask.init), focus: focus.map(DayPlanFocus.init)
        )
    }
}

extension WorkTask: DueBucketTask {
    public var dueBucketId: String { id }
    public var dueBucketTitle: String { title }
    public var dueBucketDate: DateLike { DateLike(dueDate) }
    public var dueBucketPriority: String? { priority?.rawValue }
    public var dueBucketStatus: String? { status.rawValue }
    public var dueBucketIsCompleted: Bool { isCompleted }
}

extension PersonalTask: DueBucketTask {
    public var dueBucketId: String { "personal:\(id)" }
    public var dueBucketTitle: String { title }
    public var dueBucketDate: DateLike { DateLike(dueDate) }
    public var dueBucketPriority: String? { priority?.rawValue }
    public var dueBucketStatus: String? { status.rawValue }
    public var dueBucketIsCompleted: Bool { isCompleted }
}
