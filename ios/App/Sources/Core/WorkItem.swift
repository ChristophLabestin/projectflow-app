import Foundation
import PFDesign
import PFModel

/// A project task or a personal task, so lists, Today and search can treat both the same way.
enum WorkItem: Identifiable, Hashable {
    case task(WorkTask)
    case personal(PersonalTask)

    var id: String {
        switch self {
        case .task(let t): t.id
        case .personal(let p): "personal:\(p.id)"
        }
    }

    var rawId: String {
        switch self {
        case .task(let t): t.id
        case .personal(let p): p.id
        }
    }

    var title: String {
        switch self {
        case .task(let t): t.title
        case .personal(let p): p.title
        }
    }

    var isCompleted: Bool {
        switch self {
        case .task(let t): t.isCompleted
        case .personal(let p): p.isCompleted
        }
    }

    var status: TaskStatus {
        switch self {
        case .task(let t): t.status
        case .personal(let p): p.status
        }
    }

    var priority: TaskPriority? {
        switch self {
        case .task(let t): t.priority
        case .personal(let p): p.priority
        }
    }

    var dueDate: FlexDate? {
        switch self {
        case .task(let t): t.dueDate
        case .personal(let p): p.dueDate
        }
    }

    var scheduledDate: FlexDate? {
        switch self {
        case .task(let t): t.scheduledDate
        case .personal(let p): p.scheduledDate
        }
    }

    var isPersonal: Bool { if case .personal = self { true } else { false } }
    var task: WorkTask? { if case .task(let t) = self { t } else { nil } }
    var personal: PersonalTask? { if case .personal(let p) = self { p } else { nil } }
    var projectId: String? { task?.projectId }

    var route: AppRoute {
        switch self {
        case .task(let t): .task(t.ref)
        case .personal(let p): .personalTask(tenantId: p.tenantId, id: p.id)
        }
    }

    var pinned: PinnedItem {
        switch self {
        case .task(let t): PinnedItem(id: t.id, type: .task, title: t.title, projectId: t.projectId, tenantId: t.tenantId, priority: t.priority?.rawValue)
        case .personal(let p): PinnedItem(id: p.id, type: .personalTask, title: p.title, projectId: nil, tenantId: p.tenantId, priority: p.priority?.rawValue)
        }
    }

    var severity: Severity { Formatting.severity(due: dueDate, isDone: isCompleted) }
}

extension WorkspaceStoreAccess {
    /// My open project tasks and personal tasks as one list.
    static func allItems(_ model: AppModel, includeCompleted: Bool = false) -> [WorkItem] {
        guard let workspace = model.workspace else { return [] }
        let tasks = workspace.myTasks.filter { includeCompleted || !$0.isCompleted }.map(WorkItem.task)
        let personal = workspace.personalTasks.filter { includeCompleted || !$0.isCompleted }.map(WorkItem.personal)
        return tasks + personal
    }
}

enum WorkspaceStoreAccess {}
