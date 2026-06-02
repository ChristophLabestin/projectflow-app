import Foundation

enum PermissionNode {
    static let tenantNotificationsView = "tenant.notifications.view"
    static let tenantMembersView = "tenant.members.view"
    static let tenantMembersInvite = "tenant.members.invite"

    static let projectSettingsEdit = "project.settings.edit"
    static let projectSettingsView = "project.settings.view"
    static let projectDelete = "project.delete"

    static let tasksView = "project.tasks.view"
    static let tasksCreate = "project.tasks.create"
    static let tasksEdit = "project.tasks.edit"
    static let tasksDelete = "project.tasks.delete"

    static let initiativesView = "project.initiatives.view"
    static let initiativesCreate = "project.initiatives.create"
    static let initiativesEdit = "project.initiatives.edit"
    static let initiativesDelete = "project.initiatives.delete"

    static let flowsView = "project.flows.view"
    static let flowsCreate = "project.flows.create"
    static let flowsEdit = "project.flows.edit"
    static let flowsDelete = "project.flows.delete"

    static let issuesView = "project.issues.view"
    static let issuesCreate = "project.issues.create"
    static let issuesEdit = "project.issues.edit"
    static let issuesDelete = "project.issues.delete"

    static let milestonesView = "project.milestones.view"
    static let milestonesCreate = "project.milestones.create"
    static let milestonesEdit = "project.milestones.edit"

    static let sprintsView = "project.sprints.view"
    static let sprintsCreate = "project.sprints.create"
    static let sprintsEdit = "project.sprints.edit"

    static let commentsCreate = "project.comments.create"
    static let activityView = "project.activity.view"
    static let codexView = "project.codex.view"
}

struct PermissionContext {
    let isTenantOwner: Bool
    let isProjectOwner: Bool
    let workspaceRole: String
    let projectRoleIds: [String]
    let allow: Set<String>
    let deny: Set<String>
    let canCreateProjects: Bool

    init(
        isTenantOwner: Bool,
        isProjectOwner: Bool,
        workspaceRole: String = "Member",
        projectRoleIds: [String] = [],
        allow: [String] = [],
        deny: [String] = [],
        canCreateProjects: Bool = false
    ) {
        self.isTenantOwner = isTenantOwner
        self.isProjectOwner = isProjectOwner
        self.workspaceRole = workspaceRole
        self.projectRoleIds = projectRoleIds
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
        if context.isTenantOwner { return true }
        if projectScoped && context.isProjectOwner { return true }
        if context.deny.contains(node) { return false }
        if context.allow.contains(node) { return true }
        return defaultAllow(node, projectScoped: projectScoped)
    }

    private func defaultAllow(_ node: String, projectScoped: Bool) -> Bool {
        switch context.workspaceRole {
        case "Owner", "Admin":
            return true
        case "Member":
            if node.hasSuffix(".view") { return true }
            return projectScoped && context.isProjectOwner
        default:
            return node.hasSuffix(".view") && projectScoped
        }
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

    func canViewModule(_ module: ProjectModule, project: Project) -> Bool {
        guard project.hasModule(module) else { return false }
        switch module {
        case .tasks: return allows(PermissionNode.tasksView)
        case .initiatives: return allows(PermissionNode.initiativesView)
        case .ideas: return allows(PermissionNode.flowsView)
        case .issues: return allows(PermissionNode.issuesView)
        case .milestones: return allows(PermissionNode.milestonesView)
        case .sprints: return allows(PermissionNode.sprintsView)
        case .activity: return allows(PermissionNode.activityView)
        default: return false
        }
    }
}

@MainActor
final class PermissionService {
    static let shared = PermissionService()

    private let roleRepository = RoleRepository()
    private var roleCache: [String: [TenantRole]] = [:]

    func loadRoles(tenantId: String) async -> [TenantRole] {
        if let cached = roleCache[tenantId] { return cached }
        do {
            let roles = try await roleRepository.fetchRoles(tenantId: tenantId)
            roleCache[tenantId] = roles
            return roles
        } catch {
            return []
        }
    }

    func buildContext(
        membership: TenantMembership?,
        tenantOwnerId: String?,
        currentUserId: String?,
        project: Project?,
        roles: [TenantRole]
    ) -> PermissionContext {
        let roleName = membership?.role ?? "Member"
        let isTenantOwner = roleName == "Owner" || tenantOwnerId == currentUserId
        let isProjectOwner = project?.ownerId == currentUserId
        var allow: [String] = []
        var deny: [String] = []

        for role in roles where roleName == role.name || role.id == roleName {
            allow.append(contentsOf: role.allow)
            deny.append(contentsOf: role.deny)
        }

        return PermissionContext(
            isTenantOwner: isTenantOwner,
            isProjectOwner: isProjectOwner,
            workspaceRole: roleName,
            allow: allow,
            deny: deny,
            canCreateProjects: ["Owner", "Admin", "Member"].contains(roleName)
        )
    }

    func invalidateCache(tenantId: String? = nil) {
        if let tenantId {
            roleCache.removeValue(forKey: tenantId)
        } else {
            roleCache.removeAll()
        }
    }
}
