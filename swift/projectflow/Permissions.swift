import Foundation

enum PermissionNode {
    static let tenantNotificationsView = "tenant.notifications.view"

    static let projectSettingsEdit = "project.settings.edit"
    static let projectDelete = "project.delete"

    static let tasksCreate = "project.tasks.create"
    static let tasksEdit = "project.tasks.edit"
    static let tasksDelete = "project.tasks.delete"

    static let flowsCreate = "project.flows.create"
    static let flowsEdit = "project.flows.edit"
    static let flowsDelete = "project.flows.delete"

    static let issuesCreate = "project.issues.create"
    static let issuesEdit = "project.issues.edit"
    static let issuesDelete = "project.issues.delete"
}

struct PermissionContext {
    let isTenantOwner: Bool
    let isProjectOwner: Bool
    let allow: Set<String>
    let deny: Set<String>
    let canCreateProjects: Bool

    init(
        isTenantOwner: Bool,
        isProjectOwner: Bool,
        allow: [String] = [],
        deny: [String] = [],
        canCreateProjects: Bool = false
    ) {
        self.isTenantOwner = isTenantOwner
        self.isProjectOwner = isProjectOwner
        self.allow = Set(allow)
        self.deny = Set(deny)
        self.canCreateProjects = canCreateProjects
    }
}

enum PermissionError: LocalizedError {
    case denied(String)

    var errorDescription: String? {
        switch self {
        case .denied(let node):
            return "Missing permission: \(node)"
        }
    }
}

struct PermissionEvaluator {
    let context: PermissionContext

    func allows(_ node: String, projectScoped: Bool = true) -> Bool {
        if context.isTenantOwner {
            return true
        }
        if projectScoped && context.isProjectOwner {
            return true
        }
        if context.deny.contains(node) {
            return false
        }
        if context.allow.contains(node) {
            return true
        }
        return false
    }

    func require(_ node: String, projectScoped: Bool = true) throws {
        guard allows(node, projectScoped: projectScoped) else {
            throw PermissionError.denied(node)
        }
    }

    func requireProjectCreate() throws {
        guard context.isTenantOwner || context.canCreateProjects else {
            throw PermissionError.denied("project.create")
        }
    }
}
