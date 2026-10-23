// Generated from `web/services/permissionService.ts` PERMISSION_CATALOG (keys are the stored node ids; descriptions are the web's).
enum TeamPermissionCatalog {
    struct Group: Identifiable {
        let id: String
        let title: String
        let nodes: [Node]
    }
    struct Node: Identifiable {
        let key: String
        let text: String
        var id: String { key }
    }

    static let groups: [Group] = [
        Group(id: "tenant.view", title: "Tenant · View", nodes: [
            Node(key: "tenant.view", text: "View tenant/workspace shell and basic metadata"),
        ]),
        Group(id: "tenant.settings", title: "Tenant · Settings", nodes: [
            Node(key: "tenant.settings.view", text: "View tenant settings"),
            Node(key: "tenant.settings.edit", text: "Edit tenant settings (name, branding, defaults)"),
        ]),
        Group(id: "tenant.members", title: "Tenant · Members", nodes: [
            Node(key: "tenant.members.view", text: "View workspace members list"),
            Node(key: "tenant.members.invite", text: "Invite workspace members"),
            Node(key: "tenant.members.remove", text: "Remove/disable workspace members"),
            Node(key: "tenant.members.manageRoles", text: "Assign/remove roles for workspace members (hierarchy-bound)"),
        ]),
        Group(id: "tenant.invites", title: "Tenant · Invites", nodes: [
            Node(key: "tenant.invites.view", text: "View workspace invite links / pending invites"),
            Node(key: "tenant.invites.create", text: "Create workspace invite links"),
            Node(key: "tenant.invites.revoke", text: "Revoke workspace invite links"),
        ]),
        Group(id: "tenant.roles", title: "Tenant · Roles", nodes: [
            Node(key: "tenant.roles.view", text: "View roles list"),
            Node(key: "tenant.roles.create", text: "Create custom roles"),
            Node(key: "tenant.roles.edit", text: "Edit roles (name, permissions; hierarchy-bound)"),
            Node(key: "tenant.roles.delete", text: "Delete custom roles (hierarchy-bound)"),
            Node(key: "tenant.roles.manageHierarchy", text: "Reorder roles / change role positions (hierarchy-bound)"),
        ]),
        Group(id: "tenant.billing", title: "Tenant · Billing", nodes: [
            Node(key: "tenant.billing.view", text: "View billing information (invoices, payment method summary)"),
            Node(key: "tenant.billing.manage", text: "Manage billing (payment method, invoicing details)"),
        ]),
        Group(id: "tenant.seats", title: "Tenant · Seats", nodes: [
            Node(key: "tenant.seats.view", text: "View seat/license status (owner-managed mode)"),
            Node(key: "tenant.seats.manage", text: "Purchase/assign/revoke seats (owner-managed mode)"),
        ]),
        Group(id: "tenant.plan", title: "Tenant · Plan", nodes: [
            Node(key: "tenant.plan.view", text: "View subscription plan and entitlements"),
            Node(key: "tenant.plan.manage", text: "Change plan tier or plan settings"),
        ]),
        Group(id: "tenant.finance", title: "Tenant · Finance", nodes: [
            Node(key: "tenant.finance.view", text: "View tenant finance tracking (income, expenses, recurring)"),
            Node(key: "tenant.finance.manage", text: "Manage finance transactions and recurring items"),
            Node(key: "tenant.finance.accounts.manage", text: "Manage chart of accounts and account mappings"),
            Node(key: "tenant.finance.ledger.post", text: "Post journal entries in ledger"),
            Node(key: "tenant.finance.ar.manage", text: "Manage accounts receivable (customers, invoices, dunning)"),
            Node(key: "tenant.finance.ap.manage", text: "Manage accounts payable (vendors, bills, due items)"),
            Node(key: "tenant.finance.tax.manage", text: "Manage tax codes, reports, and tax periods"),
            Node(key: "tenant.finance.close", text: "Run monthly close and reopen periods"),
            Node(key: "tenant.finance.export.datev", text: "Generate DATEV exports"),
            Node(key: "tenant.finance.audit.view", text: "View finance audit trails"),
            Node(key: "tenant.finance.reconciliation.manage", text: "Manage bank reconciliation workflows"),
            Node(key: "tenant.finance.reports.manage", text: "Manage finance reports"),
            Node(key: "tenant.finance.functions.view", text: "View finance automation functions and runs"),
            Node(key: "tenant.finance.functions.execute", text: "Run finance automation functions"),
            Node(key: "tenant.finance.functions.retry", text: "Retry failed finance automation runs"),
            Node(key: "tenant.finance.functions.template.manage", text: "Manage finance automation templates"),
        ]),
        Group(id: "tenant.sso", title: "Tenant · Sso", nodes: [
            Node(key: "tenant.sso.view", text: "View SSO configuration status"),
            Node(key: "tenant.sso.configure", text: "Configure SSO provider settings"),
            Node(key: "tenant.sso.enforce", text: "Enforce SSO for tenant access"),
        ]),
        Group(id: "tenant.ai", title: "Tenant · Ai", nodes: [
            Node(key: "tenant.ai.viewUsage", text: "View tenant AI usage summaries"),
            Node(key: "tenant.ai.managePolicies", text: "Manage tenant AI policies"),
            Node(key: "tenant.ai.manageAllocations", text: "Manage per-user AI allocations"),
            Node(key: "tenant.ai.manageProviderKeys", text: "Manage AI provider settings (BYO keys)"),
        ]),
        Group(id: "tenant.integrations", title: "Tenant · Integrations", nodes: [
            Node(key: "tenant.integrations.view", text: "View tenant-level integrations"),
            Node(key: "tenant.integrations.manage", text: "Configure tenant-level integrations"),
        ]),
        Group(id: "tenant.audit", title: "Tenant · Audit", nodes: [
            Node(key: "tenant.audit.view", text: "View audit logs"),
        ]),
        Group(id: "tenant.media", title: "Tenant · Media", nodes: [
            Node(key: "tenant.media.view", text: "View/browse tenant media library"),
            Node(key: "tenant.media.upload", text: "Upload new assets into tenant library"),
            Node(key: "tenant.media.edit", text: "Edit asset metadata (name, tags, folders)"),
            Node(key: "tenant.media.delete", text: "Delete assets from tenant library"),
            Node(key: "tenant.media.importUnsplash", text: "Import assets from Unsplash"),
            Node(key: "tenant.media.generateAI", text: "Use AI image generation"),
            Node(key: "tenant.media.reworkAI", text: "Use AI image rework/edit"),
            Node(key: "tenant.media.manageVisibility", text: "Change asset visibility/sharing rules"),
        ]),
        Group(id: "tenant.calendar", title: "Tenant · Calendar", nodes: [
            Node(key: "tenant.calendar.view", text: "View tenant/global calendar"),
            Node(key: "tenant.calendar.manage", text: "Create/edit/remove tenant calendar items"),
        ]),
        Group(id: "tenant.notifications", title: "Tenant · Notifications", nodes: [
            Node(key: "tenant.notifications.view", text: "View tenant notification center"),
            Node(key: "tenant.notifications.manage", text: "Manage tenant notification rules"),
        ]),
        Group(id: "tenant.users", title: "Tenant · Users", nodes: [
            Node(key: "tenant.users.viewProfiles", text: "View extended user profile info"),
            Node(key: "tenant.users.manageProfiles", text: "Edit user profile attributes (admin)"),
        ]),
        Group(id: "project.view", title: "Project · View", nodes: [
            Node(key: "project.view", text: "View the project and access its dashboard"),
        ]),
        Group(id: "project.settings", title: "Project · Settings", nodes: [
            Node(key: "project.settings.view", text: "View project settings"),
            Node(key: "project.settings.edit", text: "Edit project settings (name, description)"),
        ]),
        Group(id: "project.delete", title: "Project · Delete", nodes: [
            Node(key: "project.delete", text: "Delete project"),
        ]),
        Group(id: "project.members", title: "Project · Members", nodes: [
            Node(key: "project.members.view", text: "View project members list"),
            Node(key: "project.members.inviteWorkspaceUser", text: "Invite workspace users to the project"),
            Node(key: "project.members.inviteExternal", text: "Invite external collaborators to the project"),
            Node(key: "project.members.remove", text: "Remove project members"),
            Node(key: "project.members.manageRoles", text: "Assign/remove roles for project members (hierarchy-bound)"),
        ]),
        Group(id: "project.modules", title: "Project · Modules", nodes: [
            Node(key: "project.modules.view", text: "View enabled/available modules"),
            Node(key: "project.modules.enableDisable", text: "Enable/disable project modules"),
        ]),
        Group(id: "project.initiatives", title: "Project · Initiatives", nodes: [
            Node(key: "project.initiatives.view", text: "View initiatives and initiative detail pages"),
            Node(key: "project.initiatives.create", text: "Create initiatives"),
            Node(key: "project.initiatives.edit", text: "Edit initiatives"),
            Node(key: "project.initiatives.delete", text: "Delete initiatives"),
            Node(key: "project.initiatives.manageTasks", text: "Attach, detach, and create child tasks within initiatives"),
        ]),
        Group(id: "project.tasks", title: "Project · Tasks", nodes: [
            Node(key: "project.tasks.view", text: "View tasks and task lists/boards"),
            Node(key: "project.tasks.create", text: "Create tasks"),
            Node(key: "project.tasks.edit", text: "Edit tasks (subject to ownership policy)"),
            Node(key: "project.tasks.editAny", text: "Edit any task regardless of ownership"),
            Node(key: "project.tasks.delete", text: "Delete tasks (subject to ownership policy)"),
            Node(key: "project.tasks.deleteAny", text: "Delete any task regardless of ownership"),
            Node(key: "project.tasks.assign", text: "Assign/unassign tasks"),
            Node(key: "project.tasks.changeStatus", text: "Change task status/column/state"),
            Node(key: "project.tasks.manageSubtasks", text: "Create/edit/delete subtasks"),
            Node(key: "project.tasks.manageChecklists", text: "Manage checklists within tasks"),
            Node(key: "project.tasks.comment", text: "Comment on tasks"),
            Node(key: "project.tasks.attachFiles", text: "Attach files/media to tasks"),
            Node(key: "project.tasks.manageCustomFields", text: "Create/edit custom fields for tasks"),
        ]),
        Group(id: "project.marketing", title: "Project · Marketing", nodes: [
            Node(key: "project.marketing.blog.view", text: "View blog posts"),
            Node(key: "project.marketing.blog.create", text: "Create blog posts"),
            Node(key: "project.marketing.blog.edit", text: "Edit blog posts"),
            Node(key: "project.marketing.blog.delete", text: "Delete blog posts"),
            Node(key: "project.marketing.settings.view", text: "View marketing settings"),
            Node(key: "project.marketing.settings.edit", text: "Edit marketing settings"),
        ]),
        Group(id: "project.sprints", title: "Project · Sprints", nodes: [
            Node(key: "project.sprints.view", text: "View sprints"),
            Node(key: "project.sprints.create", text: "Create sprints"),
            Node(key: "project.sprints.edit", text: "Edit sprints"),
            Node(key: "project.sprints.delete", text: "Delete sprints"),
            Node(key: "project.sprints.manageBacklog", text: "Manage sprint backlog"),
            Node(key: "project.sprints.manageAssignments", text: "Manage sprint assignments"),
        ]),
        Group(id: "project.milestones", title: "Project · Milestones", nodes: [
            Node(key: "project.milestones.view", text: "View milestones"),
            Node(key: "project.milestones.create", text: "Create milestones"),
            Node(key: "project.milestones.edit", text: "Edit milestones"),
            Node(key: "project.milestones.delete", text: "Delete milestones"),
        ]),
        Group(id: "project.media", title: "Project · Media", nodes: [
            Node(key: "project.media.view", text: "Browse/select assets within project context"),
            Node(key: "project.media.upload", text: "Upload assets from within this project"),
            Node(key: "project.media.edit", text: "Edit asset metadata within project context"),
            Node(key: "project.media.delete", text: "Delete assets within project context"),
            Node(key: "project.media.importUnsplash", text: "Use Unsplash in project context"),
            Node(key: "project.media.generateAI", text: "Use AI generation in project context"),
            Node(key: "project.media.reworkAI", text: "Use AI rework in project context"),
        ]),
        Group(id: "project.calendar", title: "Project · Calendar", nodes: [
            Node(key: "project.calendar.view", text: "View project calendar"),
            Node(key: "project.calendar.manage", text: "Create/edit/remove calendar items"),
        ]),
        Group(id: "project.notifications", title: "Project · Notifications", nodes: [
            Node(key: "project.notifications.view", text: "View project notifications"),
            Node(key: "project.notifications.manage", text: "Manage project notification settings"),
        ]),
        Group(id: "ai.text", title: "Ai · Text", nodes: [
            Node(key: "ai.text.use", text: "Use Gemini text features (summaries, generation)"),
        ]),
        Group(id: "ai.image", title: "Ai · Image", nodes: [
            Node(key: "ai.image.generate", text: "Generate images"),
            Node(key: "ai.image.rework", text: "Rework/edit images"),
        ]),
        Group(id: "ai.usage", title: "Ai · Usage", nodes: [
            Node(key: "ai.usage.viewSelf", text: "View own AI usage"),
            Node(key: "ai.usage.viewTenant", text: "View tenant AI usage"),
        ]),
        Group(id: "ai.limits", title: "Ai · Limits", nodes: [
            Node(key: "ai.limits.manageSelf", text: "Manage own AI limits/caps"),
            Node(key: "ai.limits.manageOthers", text: "Manage other users' AI limits/caps"),
        ]),
        Group(id: "ai.overage", title: "Ai · Overage", nodes: [
            Node(key: "ai.overage.allowSelf", text: "Allow self to exceed AI quotas (billable)"),
            Node(key: "ai.overage.allowOthers", text: "Allow others to exceed AI quotas (billable)"),
        ]),
        Group(id: "user.settings", title: "User · Settings", nodes: [
            Node(key: "user.settings.editSelf", text: "Edit own settings"),
        ]),
    ]

    static let allKeys: [String] = groups.flatMap { $0.nodes.map(\.key) }
    /// Web `DEFAULT_MEMBER_PERMISSIONS`: the start set for a new role.
    static let memberDefaults = ["tenant.view", "tenant.members.view", "tenant.roles.view", "tenant.finance.view", "tenant.media.view", "tenant.media.upload", "ai.text.use", "ai.usage.viewSelf", "user.settings.editSelf"]
}
