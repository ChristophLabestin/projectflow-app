/**
 * Permission Evaluation Service
 * 
 * Core permission logic implementing the Discord-style permission model:
 * - Allow/deny resolution (deny overrides allow)
 * - Role stacking (combine permissions across multiple roles)
 * - Hierarchy enforcement (can only manage lower roles)
 * - Scope-based evaluation
 * - Special handling for Owner, Member, Guest, Project Owner
 * 
 * @see PERMISSIONS.md for full specification
 */

import {
    PermissionNode,
    TenantPermissionNode,
    ProjectPermissionNode,
    AIPermissionNode,
    Role,
    RolePermissions,
    PermissionEvaluationContext,
    SystemRoleKey,
    ALL_PROJECT_PERMISSIONS,
    ALL_TENANT_PERMISSIONS,
    ALL_AI_PERMISSIONS,
    DEFAULT_MEMBER_PERMISSIONS,
    DEFAULT_GUEST_PERMISSIONS,
} from '../types/permissions';

// Re-export for convenience
export { ALL_PROJECT_PERMISSIONS, ALL_TENANT_PERMISSIONS, ALL_AI_PERMISSIONS };

// =============================================================================
// PERMISSION CATALOG
// =============================================================================

export interface PermissionMetadata {
    scope: 'tenant' | 'project' | 'ai' | 'user';
    description: string;
    dangerLevel?: 'low' | 'medium' | 'high';
}

/**
 * Permission catalog with metadata for each permission node
 * This is the single source of truth for permission information
 */
export const PERMISSION_CATALOG: Record<PermissionNode, PermissionMetadata> = {
    // Tenant - General
    'tenant.view': { scope: 'tenant', description: 'View tenant/workspace shell and basic metadata' },
    'tenant.settings.view': { scope: 'tenant', description: 'View tenant settings' },
    'tenant.settings.edit': { scope: 'tenant', description: 'Edit tenant settings (name, branding, defaults)', dangerLevel: 'medium' },

    // Tenant - Members & Invites
    'tenant.members.view': { scope: 'tenant', description: 'View workspace members list' },
    'tenant.members.invite': { scope: 'tenant', description: 'Invite workspace members' },
    'tenant.members.remove': { scope: 'tenant', description: 'Remove/disable workspace members', dangerLevel: 'high' },
    'tenant.members.manageRoles': { scope: 'tenant', description: 'Assign/remove roles for workspace members (hierarchy-bound)', dangerLevel: 'high' },
    'tenant.invites.view': { scope: 'tenant', description: 'View workspace invite links / pending invites' },
    'tenant.invites.create': { scope: 'tenant', description: 'Create workspace invite links' },
    'tenant.invites.revoke': { scope: 'tenant', description: 'Revoke workspace invite links' },

    // Tenant - Roles & Hierarchy
    'tenant.roles.view': { scope: 'tenant', description: 'View roles list' },
    'tenant.roles.create': { scope: 'tenant', description: 'Create custom roles', dangerLevel: 'medium' },
    'tenant.roles.edit': { scope: 'tenant', description: 'Edit roles (name, permissions; hierarchy-bound)', dangerLevel: 'high' },
    'tenant.roles.delete': { scope: 'tenant', description: 'Delete custom roles (hierarchy-bound)', dangerLevel: 'high' },
    'tenant.roles.manageHierarchy': { scope: 'tenant', description: 'Reorder roles / change role positions (hierarchy-bound)', dangerLevel: 'high' },

    // Tenant - Billing, Seats, Subscription
    'tenant.billing.view': { scope: 'tenant', description: 'View billing information (invoices, payment method summary)' },
    'tenant.billing.manage': { scope: 'tenant', description: 'Manage billing (payment method, invoicing details)', dangerLevel: 'high' },
    'tenant.seats.view': { scope: 'tenant', description: 'View seat/license status (owner-managed mode)' },
    'tenant.seats.manage': { scope: 'tenant', description: 'Purchase/assign/revoke seats (owner-managed mode)', dangerLevel: 'high' },
    'tenant.plan.view': { scope: 'tenant', description: 'View subscription plan and entitlements' },
    'tenant.plan.manage': { scope: 'tenant', description: 'Change plan tier or plan settings', dangerLevel: 'high' },

    // Tenant - SSO
    'tenant.sso.view': { scope: 'tenant', description: 'View SSO configuration status' },
    'tenant.sso.configure': { scope: 'tenant', description: 'Configure SSO provider settings', dangerLevel: 'high' },
    'tenant.sso.enforce': { scope: 'tenant', description: 'Enforce SSO for tenant access', dangerLevel: 'high' },

    // Tenant - AI Governance
    'tenant.ai.viewUsage': { scope: 'tenant', description: 'View tenant AI usage summaries' },
    'tenant.ai.managePolicies': { scope: 'tenant', description: 'Manage tenant AI policies', dangerLevel: 'medium' },
    'tenant.ai.manageAllocations': { scope: 'tenant', description: 'Manage per-user AI allocations', dangerLevel: 'medium' },
    'tenant.ai.manageProviderKeys': { scope: 'tenant', description: 'Manage AI provider settings (BYO keys)', dangerLevel: 'high' },

    // Tenant - Integrations & Audit
    'tenant.integrations.view': { scope: 'tenant', description: 'View tenant-level integrations' },
    'tenant.integrations.manage': { scope: 'tenant', description: 'Configure tenant-level integrations', dangerLevel: 'medium' },
    'tenant.audit.view': { scope: 'tenant', description: 'View audit logs' },

    // Tenant - Media Library
    'tenant.media.view': { scope: 'tenant', description: 'View/browse tenant media library' },
    'tenant.media.upload': { scope: 'tenant', description: 'Upload new assets into tenant library' },
    'tenant.media.edit': { scope: 'tenant', description: 'Edit asset metadata (name, tags, folders)' },
    'tenant.media.delete': { scope: 'tenant', description: 'Delete assets from tenant library', dangerLevel: 'medium' },
    'tenant.media.importUnsplash': { scope: 'tenant', description: 'Import assets from Unsplash' },
    'tenant.media.generateAI': { scope: 'tenant', description: 'Use AI image generation' },
    'tenant.media.reworkAI': { scope: 'tenant', description: 'Use AI image rework/edit' },
    'tenant.media.manageVisibility': { scope: 'tenant', description: 'Change asset visibility/sharing rules' },

    // Tenant - Calendar
    'tenant.calendar.view': { scope: 'tenant', description: 'View tenant/global calendar' },
    'tenant.calendar.manage': { scope: 'tenant', description: 'Create/edit/remove tenant calendar items' },

    // Tenant - Notifications
    'tenant.notifications.view': { scope: 'tenant', description: 'View tenant notification center' },
    'tenant.notifications.manage': { scope: 'tenant', description: 'Manage tenant notification rules' },

    // Tenant - User/Profile
    'tenant.users.viewProfiles': { scope: 'tenant', description: 'View extended user profile info' },
    'tenant.users.manageProfiles': { scope: 'tenant', description: 'Edit user profile attributes (admin)', dangerLevel: 'medium' },

    // Project - General
    'project.view': { scope: 'project', description: 'View the project and access its dashboard' },
    'project.settings.view': { scope: 'project', description: 'View project settings' },
    'project.settings.edit': { scope: 'project', description: 'Edit project settings (name, description)', dangerLevel: 'medium' },
    'project.delete': { scope: 'project', description: 'Delete project', dangerLevel: 'high' },

    // Project - Members
    'project.members.view': { scope: 'project', description: 'View project members list' },
    'project.members.inviteWorkspaceUser': { scope: 'project', description: 'Invite workspace users to the project' },
    'project.members.inviteExternal': { scope: 'project', description: 'Invite external collaborators to the project' },
    'project.members.remove': { scope: 'project', description: 'Remove project members', dangerLevel: 'medium' },
    'project.members.manageRoles': { scope: 'project', description: 'Assign/remove roles for project members (hierarchy-bound)', dangerLevel: 'high' },

    // Project - Modules
    'project.modules.view': { scope: 'project', description: 'View enabled/available modules' },
    'project.modules.enableDisable': { scope: 'project', description: 'Enable/disable project modules', dangerLevel: 'medium' },

    // Project - Tasks
    'project.tasks.view': { scope: 'project', description: 'View tasks and task lists/boards' },
    'project.tasks.create': { scope: 'project', description: 'Create tasks' },
    'project.tasks.edit': { scope: 'project', description: 'Edit tasks (subject to ownership policy)' },
    'project.tasks.editAny': { scope: 'project', description: 'Edit any task regardless of ownership', dangerLevel: 'medium' },
    'project.tasks.delete': { scope: 'project', description: 'Delete tasks (subject to ownership policy)' },
    'project.tasks.deleteAny': { scope: 'project', description: 'Delete any task regardless of ownership', dangerLevel: 'medium' },
    'project.tasks.assign': { scope: 'project', description: 'Assign/unassign tasks' },
    'project.tasks.changeStatus': { scope: 'project', description: 'Change task status/column/state' },
    'project.tasks.manageSubtasks': { scope: 'project', description: 'Create/edit/delete subtasks' },
    'project.tasks.manageChecklists': { scope: 'project', description: 'Manage checklists within tasks' },
    'project.tasks.comment': { scope: 'project', description: 'Comment on tasks' },
    'project.tasks.attachFiles': { scope: 'project', description: 'Attach files/media to tasks' },
    'project.tasks.manageCustomFields': { scope: 'project', description: 'Create/edit custom fields for tasks', dangerLevel: 'medium' },

    // Project - Flows
    'project.flows.view': { scope: 'project', description: 'View flows list and flow details' },
    'project.flows.create': { scope: 'project', description: 'Create flows' },
    'project.flows.edit': { scope: 'project', description: 'Edit flow content' },
    'project.flows.delete': { scope: 'project', description: 'Delete flows', dangerLevel: 'medium' },
    'project.flows.comment': { scope: 'project', description: 'Comment on flows' },
    'project.flows.attachFiles': { scope: 'project', description: 'Attach files/media to flows' },
    'project.flows.advanceStep': { scope: 'project', description: 'Move flow to the next pipeline step' },
    'project.flows.revertStep': { scope: 'project', description: 'Move flow to a previous step' },
    'project.flows.setStep': { scope: 'project', description: 'Set flow to any step (jump)', dangerLevel: 'medium' },
    'project.flows.requestReview': { scope: 'project', description: 'Mark/request review for a flow' },
    'project.flows.approve': { scope: 'project', description: 'Approve a flow review', dangerLevel: 'medium' },
    'project.flows.reject': { scope: 'project', description: 'Reject a flow review' },
    'project.flows.handoffToTasks': { scope: 'project', description: 'Convert/handoff flow to tasks' },
    'project.flows.handoffToSocial': { scope: 'project', description: 'Handoff flow to Social module' },
    'project.flows.handoffToMarketing': { scope: 'project', description: 'Handoff flow to Marketing module' },

    // Project - Issues
    'project.issues.view': { scope: 'project', description: 'View issues' },
    'project.issues.create': { scope: 'project', description: 'Create issues' },
    'project.issues.edit': { scope: 'project', description: 'Edit issues' },
    'project.issues.delete': { scope: 'project', description: 'Delete issues', dangerLevel: 'medium' },
    'project.issues.assign': { scope: 'project', description: 'Assign/unassign issues' },
    'project.issues.changeStatus': { scope: 'project', description: 'Change issue status/state' },
    'project.issues.comment': { scope: 'project', description: 'Comment on issues' },
    'project.issues.linkGithub': { scope: 'project', description: 'Link issue to GitHub' },
    'project.issues.unlinkGithub': { scope: 'project', description: 'Unlink issue from GitHub' },

    // Project - Social Accounts
    'project.social.accounts.view': { scope: 'project', description: 'View connected social accounts' },
    'project.social.accounts.connect': { scope: 'project', description: 'Connect a social account', dangerLevel: 'medium' },
    'project.social.accounts.disconnect': { scope: 'project', description: 'Disconnect a social account', dangerLevel: 'medium' },

    // Project - Social Campaigns
    'project.social.campaigns.view': { scope: 'project', description: 'View campaigns' },
    'project.social.campaigns.create': { scope: 'project', description: 'Create campaigns' },
    'project.social.campaigns.edit': { scope: 'project', description: 'Edit campaigns' },
    'project.social.campaigns.delete': { scope: 'project', description: 'Delete campaigns', dangerLevel: 'medium' },

    // Project - Social Posts
    'project.social.posts.view': { scope: 'project', description: 'View posts' },
    'project.social.posts.create': { scope: 'project', description: 'Create posts' },
    'project.social.posts.edit': { scope: 'project', description: 'Edit posts' },
    'project.social.posts.delete': { scope: 'project', description: 'Delete posts', dangerLevel: 'medium' },
    'project.social.posts.schedule': { scope: 'project', description: 'Schedule posts' },
    'project.social.posts.publish': { scope: 'project', description: 'Publish posts', dangerLevel: 'high' },
    'project.social.posts.approve': { scope: 'project', description: 'Approve posts' },
    'project.social.posts.archive': { scope: 'project', description: 'Archive posts' },

    // Project - Social Assets
    'project.social.assets.manage': { scope: 'project', description: 'Manage social assets' },

    // Project - Marketing Ads
    'project.marketing.ads.view': { scope: 'project', description: 'View paid ad campaigns' },
    'project.marketing.ads.create': { scope: 'project', description: 'Create ad campaigns' },
    'project.marketing.ads.edit': { scope: 'project', description: 'Edit ad campaigns' },
    'project.marketing.ads.delete': { scope: 'project', description: 'Delete ad campaigns', dangerLevel: 'medium' },

    // Project - Marketing Email
    'project.marketing.email.view': { scope: 'project', description: 'View email campaigns' },
    'project.marketing.email.create': { scope: 'project', description: 'Create email campaigns' },
    'project.marketing.email.edit': { scope: 'project', description: 'Edit email campaigns' },
    'project.marketing.email.send': { scope: 'project', description: 'Send email campaigns', dangerLevel: 'high' },
    'project.marketing.email.manageRecipients': { scope: 'project', description: 'Manage recipient lists' },

    // Project - Marketing Blog
    'project.marketing.blog.view': { scope: 'project', description: 'View blog posts' },
    'project.marketing.blog.create': { scope: 'project', description: 'Create blog posts' },
    'project.marketing.blog.edit': { scope: 'project', description: 'Edit blog posts' },
    'project.marketing.blog.delete': { scope: 'project', description: 'Delete blog posts', dangerLevel: 'medium' },

    // Project - Marketing Settings
    'project.marketing.settings.view': { scope: 'project', description: 'View marketing settings' },
    'project.marketing.settings.edit': { scope: 'project', description: 'Edit marketing settings', dangerLevel: 'medium' },

    // Project - Sprints
    'project.sprints.view': { scope: 'project', description: 'View sprints' },
    'project.sprints.create': { scope: 'project', description: 'Create sprints' },
    'project.sprints.edit': { scope: 'project', description: 'Edit sprints' },
    'project.sprints.delete': { scope: 'project', description: 'Delete sprints', dangerLevel: 'medium' },
    'project.sprints.manageBacklog': { scope: 'project', description: 'Manage sprint backlog' },
    'project.sprints.manageAssignments': { scope: 'project', description: 'Manage sprint assignments' },

    // Project - Milestones
    'project.milestones.view': { scope: 'project', description: 'View milestones' },
    'project.milestones.create': { scope: 'project', description: 'Create milestones' },
    'project.milestones.edit': { scope: 'project', description: 'Edit milestones' },
    'project.milestones.delete': { scope: 'project', description: 'Delete milestones', dangerLevel: 'medium' },

    // Project - Media
    'project.media.view': { scope: 'project', description: 'Browse/select assets within project context' },
    'project.media.upload': { scope: 'project', description: 'Upload assets from within this project' },
    'project.media.edit': { scope: 'project', description: 'Edit asset metadata within project context' },
    'project.media.delete': { scope: 'project', description: 'Delete assets within project context', dangerLevel: 'medium' },
    'project.media.importUnsplash': { scope: 'project', description: 'Use Unsplash in project context' },
    'project.media.generateAI': { scope: 'project', description: 'Use AI generation in project context' },
    'project.media.reworkAI': { scope: 'project', description: 'Use AI rework in project context' },

    // Project - Calendar
    'project.calendar.view': { scope: 'project', description: 'View project calendar' },
    'project.calendar.manage': { scope: 'project', description: 'Create/edit/remove calendar items' },

    // Project - Notifications
    'project.notifications.view': { scope: 'project', description: 'View project notifications' },
    'project.notifications.manage': { scope: 'project', description: 'Manage project notification settings' },

    // AI Permissions
    'ai.text.use': { scope: 'ai', description: 'Use Gemini text features (summaries, generation)' },
    'ai.image.generate': { scope: 'ai', description: 'Generate images' },
    'ai.image.rework': { scope: 'ai', description: 'Rework/edit images' },
    'ai.usage.viewSelf': { scope: 'ai', description: 'View own AI usage' },
    'ai.usage.viewTenant': { scope: 'ai', description: 'View tenant AI usage' },
    'ai.limits.manageSelf': { scope: 'ai', description: 'Manage own AI limits/caps' },
    'ai.limits.manageOthers': { scope: 'ai', description: 'Manage other users\' AI limits/caps', dangerLevel: 'medium' },
    'ai.overage.allowSelf': { scope: 'ai', description: 'Allow self to exceed AI quotas (billable)', dangerLevel: 'medium' },
    'ai.overage.allowOthers': { scope: 'ai', description: 'Allow others to exceed AI quotas (billable)', dangerLevel: 'high' },

    // User Permissions
    'user.settings.editSelf': { scope: 'user', description: 'Edit own settings' },
};

// =============================================================================
// SYSTEM ROLE DEFAULTS
// =============================================================================

/**
 * Default configuration for system roles
 */
export const SYSTEM_ROLE_DEFAULTS: Record<SystemRoleKey, {
    position: number;
    isSystem: true;
    permissions: RolePermissions;
    permissionsMode?: 'ALL_PROJECT_PERMISSIONS';
}> = {
    OWNER: {
        position: Number.MAX_SAFE_INTEGER, // Always highest
        isSystem: true,
        permissions: {
            allow: [...ALL_TENANT_PERMISSIONS, ...ALL_PROJECT_PERMISSIONS, ...ALL_AI_PERMISSIONS, 'user.settings.editSelf'],
            deny: [],
        },
    },
    MEMBER: {
        position: 0, // Always lowest for regular members
        isSystem: true,
        permissions: {
            allow: DEFAULT_MEMBER_PERMISSIONS,
            deny: [],
        },
    },
    GUEST: {
        position: -1, // Below Member
        isSystem: true,
        permissions: {
            allow: DEFAULT_GUEST_PERMISSIONS,
            deny: [],
        },
    },
    PROJECT_OWNER: {
        position: Number.MAX_SAFE_INTEGER - 1, // Below tenant Owner but above all others in project
        isSystem: true,
        permissionsMode: 'ALL_PROJECT_PERMISSIONS',
        permissions: {
            allow: ALL_PROJECT_PERMISSIONS,
            deny: [],
        },
    },
};

// =============================================================================
// PERMISSION EVALUATION ALGORITHM
// =============================================================================

/**
 * Get the effective permissions from a set of roles
 * Combines all allow/deny sets according to the algorithm:
 * 1. Collect all `allow` permissions from all roles
 * 2. Collect all `deny` permissions from all roles
 * 3. Deny always overrides allow
 * 
 * @param roles - Array of roles assigned to the user
 * @param includeProjectOwner - If true, handle PROJECT_OWNER special mode
 * @returns Combined allow and deny sets
 */
export function getEffectivePermissions(
    roles: Role[],
    includeProjectOwner: boolean = false
): { allowed: Set<PermissionNode>; denied: Set<PermissionNode> } {
    const allowed = new Set<PermissionNode>();
    const denied = new Set<PermissionNode>();

    for (const role of roles) {
        // Handle PROJECT_OWNER special mode
        if (role.permissionsMode === 'ALL_PROJECT_PERMISSIONS' && includeProjectOwner) {
            ALL_PROJECT_PERMISSIONS.forEach(p => allowed.add(p));
        }

        // Add regular permissions
        role.permissions.allow.forEach(p => allowed.add(p));
        role.permissions.deny.forEach(p => denied.add(p));
    }

    return { allowed, denied };
}

/**
 * Evaluate if a user has a specific permission
 * 
 * Algorithm (from PERMISSIONS.md Section 5):
 * 0) If user is Tenant Owner → allow
 * 1) Membership gating (checked externally)
 * 2) Assemble roles (passed in via context)
 * 3) Combine allow/deny (deny wins)
 * 4) Apply overrides (project → module → resource) - not implemented yet
 * 5) Enforce entitlements (plan, seats) - not implemented yet
 * 
 * @param context - Permission evaluation context
 * @param permission - Permission node to check
 * @returns true if permission is granted
 */
export function evaluatePermission(
    context: PermissionEvaluationContext,
    permission: PermissionNode
): boolean {
    // Step 0: Tenant Owner bypass - has all permissions
    if (context.isTenantOwner) {
        return true;
    }

    // Step 3: Combine allow/deny from all roles
    const { allowed, denied } = getEffectivePermissions(
        context.roles,
        context.projectId !== undefined
    );

    // Deny overrides allow
    if (denied.has(permission)) {
        return false;
    }

    return allowed.has(permission);
}

/**
 * Check multiple permissions at once
 * 
 * @param context - Permission evaluation context
 * @param permissions - Array of permission nodes to check
 * @returns Object mapping each permission to its result
 */
export function evaluatePermissions(
    context: PermissionEvaluationContext,
    permissions: PermissionNode[]
): Record<PermissionNode, boolean> {
    const result: Record<string, boolean> = {};

    for (const permission of permissions) {
        result[permission] = evaluatePermission(context, permission);
    }

    return result as Record<PermissionNode, boolean>;
}

/**
 * Check if ALL permissions are granted
 */
export function hasAllPermissions(
    context: PermissionEvaluationContext,
    permissions: PermissionNode[]
): boolean {
    return permissions.every(p => evaluatePermission(context, p));
}

/**
 * Check if ANY of the permissions is granted
 */
export function hasAnyPermission(
    context: PermissionEvaluationContext,
    permissions: PermissionNode[]
): boolean {
    return permissions.some(p => evaluatePermission(context, p));
}

// =============================================================================
// ROLE HIERARCHY FUNCTIONS
// =============================================================================

/**
 * Get the highest position among a user's roles
 * Used for hierarchy checks
 */
export function getHighestPosition(roles: Role[]): number {
    if (roles.length === 0) return -Infinity;
    return Math.max(...roles.map(r => r.position));
}

/**
 * Check if an actor can manage (edit/delete/assign) a target role
 * 
 * Rules (from PERMISSIONS.md Section 3.3):
 * - Actor must have the relevant management permission
 * - Target role position must be strictly lower than actor's highest position
 * - Target role must not be protected against that operation
 * 
 * @param actorRoles - Roles held by the acting user
 * @param targetRole - The role being managed
 * @returns true if actor can manage the target role
 */
export function canManageRole(
    actorRoles: Role[],
    targetRole: Role
): boolean {
    // Protected roles that cannot be managed
    if (targetRole.systemKey === 'OWNER') {
        return false; // Cannot edit/delete Owner
    }

    const actorHighestPosition = getHighestPosition(actorRoles);

    // Must have strictly higher position
    return actorHighestPosition > targetRole.position;
}

/**
 * Check if a role is protected (system role with restrictions)
 */
export function isProtectedRole(role: Role): {
    canEdit: boolean;
    canDelete: boolean;
    canReorder: boolean;
} {
    switch (role.systemKey) {
        case 'OWNER':
            return { canEdit: false, canDelete: false, canReorder: false };
        case 'GUEST':
            return { canEdit: false, canDelete: false, canReorder: false };
        case 'MEMBER':
            return { canEdit: true, canDelete: false, canReorder: false }; // Can edit permissions, cannot delete
        case 'PROJECT_OWNER':
            return { canEdit: false, canDelete: false, canReorder: false };
        default:
            return { canEdit: true, canDelete: true, canReorder: true }; // Custom roles
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a permission node belongs to a specific scope
 */
export function isPermissionInScope(
    permission: PermissionNode,
    scope: 'tenant' | 'project' | 'ai' | 'user'
): boolean {
    return PERMISSION_CATALOG[permission]?.scope === scope;
}

/**
 * Get all permission nodes for a scope
 */
export function getPermissionsForScope(
    scope: 'tenant' | 'project' | 'ai' | 'user'
): PermissionNode[] {
    return Object.entries(PERMISSION_CATALOG)
        .filter(([_, meta]) => meta.scope === scope)
        .map(([node]) => node as PermissionNode);
}

/**
 * Check if permission is high-risk (dangerous)
 */
export function isDangerousPermission(permission: PermissionNode): boolean {
    return PERMISSION_CATALOG[permission]?.dangerLevel === 'high';
}

/**
 * Parse permission node to get its parts
 * e.g., 'project.tasks.create' -> { scope: 'project', module: 'tasks', action: 'create' }
 */
export function parsePermissionNode(permission: PermissionNode): {
    scope: string;
    module?: string;
    action: string;
} {
    const parts = permission.split('.');
    if (parts.length === 2) {
        return { scope: parts[0], action: parts[1] };
    }
    return {
        scope: parts[0],
        module: parts.slice(1, -1).join('.'),
        action: parts[parts.length - 1],
    };
}

/**
 * Group permissions by module for UI display
 */
export function groupPermissionsByModule(): Map<string, PermissionNode[]> {
    const groups = new Map<string, PermissionNode[]>();

    for (const [node, meta] of Object.entries(PERMISSION_CATALOG)) {
        const permission = node as PermissionNode;
        const parts = permission.split('.');
        const groupKey = parts.length > 2
            ? `${parts[0]}.${parts[1]}` // e.g., 'project.tasks'
            : parts[0]; // e.g., 'ai'

        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(permission);
    }

    return groups;
}

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================

import { LegacyProjectRole, LegacyWorkspaceRole } from '../types/permissions';

/**
 * Map legacy project roles to approximate permission sets
 * For backward compatibility during migration
 */
export function getLegacyProjectRolePermissions(role: LegacyProjectRole): PermissionNode[] {
    switch (role) {
        case 'Owner':
            return ALL_PROJECT_PERMISSIONS;
        case 'Editor':
            return [
                'project.view',
                'project.settings.view',
                'project.members.view',
                'project.tasks.view',
                'project.tasks.create',
                'project.tasks.edit',
                'project.tasks.delete',
                'project.tasks.assign',
                'project.tasks.changeStatus',
                'project.tasks.manageSubtasks',
                'project.tasks.manageChecklists',
                'project.tasks.comment',
                'project.tasks.attachFiles',
                'project.issues.view',
                'project.issues.create',
                'project.issues.edit',
                'project.issues.delete',
                'project.issues.assign',
                'project.issues.changeStatus',
                'project.issues.comment',
                'project.media.view',
                'project.media.upload',
            ];
        case 'Viewer':
            return [
                'project.view',
                'project.members.view',
                'project.tasks.view',
                'project.tasks.comment',
                'project.issues.view',
                'project.media.view',
            ];
        default:
            return [];
    }
}

/**
 * Map legacy workspace roles to approximate permission sets
 * For backward compatibility during migration
 */
export function getLegacyWorkspaceRolePermissions(role: LegacyWorkspaceRole): PermissionNode[] {
    switch (role) {
        case 'Owner':
            return [...ALL_TENANT_PERMISSIONS, ...ALL_AI_PERMISSIONS, 'user.settings.editSelf'];
        case 'Admin':
            return [
                'tenant.view',
                'tenant.settings.view',
                'tenant.members.view',
                'tenant.members.invite',
                'tenant.members.remove',
                'tenant.members.manageRoles',
                'tenant.invites.view',
                'tenant.invites.create',
                'tenant.invites.revoke',
                'tenant.roles.view',
                'tenant.roles.create',
                'tenant.roles.edit',
                'tenant.roles.delete',
                'tenant.media.view',
                'tenant.media.upload',
                'tenant.media.edit',
                'tenant.media.delete',
                'ai.text.use',
                'ai.image.generate',
                'ai.image.rework',
                'ai.usage.viewSelf',
                'user.settings.editSelf',
            ];
        case 'Member':
            return DEFAULT_MEMBER_PERMISSIONS;
        case 'Guest':
            return DEFAULT_GUEST_PERMISSIONS;
        default:
            return [];
    }
}
