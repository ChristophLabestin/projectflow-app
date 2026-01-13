/**
 * Permission System Types
 * 
 * Discord-style permission model with:
 * - Granular permission nodes
 * - Allow/deny sets with deny overriding allow
 * - Role stacking (multiple roles per user)
 * - Hierarchy-based role management
 * - Scope-based evaluation (tenant → project → module → resource)
 * 
 * @see PERMISSIONS.md for full specification
 */

// =============================================================================
// PERMISSION NODES - Complete Catalog from PERMISSIONS.md
// =============================================================================

/**
 * Tenant-level permission nodes
 */
export type TenantPermissionNode =
    // General
    | 'tenant.view'
    | 'tenant.settings.view'
    | 'tenant.settings.edit'
    // Members & Invites
    | 'tenant.members.view'
    | 'tenant.members.invite'
    | 'tenant.members.remove'
    | 'tenant.members.manageRoles'
    | 'tenant.invites.view'
    | 'tenant.invites.create'
    | 'tenant.invites.revoke'
    // Roles & Hierarchy
    | 'tenant.roles.view'
    | 'tenant.roles.create'
    | 'tenant.roles.edit'
    | 'tenant.roles.delete'
    | 'tenant.roles.manageHierarchy'
    // Billing, Seats, Subscription
    | 'tenant.billing.view'
    | 'tenant.billing.manage'
    | 'tenant.seats.view'
    | 'tenant.seats.manage'
    | 'tenant.plan.view'
    | 'tenant.plan.manage'
    // SSO (Organization tier)
    | 'tenant.sso.view'
    | 'tenant.sso.configure'
    | 'tenant.sso.enforce'
    // AI Governance
    | 'tenant.ai.viewUsage'
    | 'tenant.ai.managePolicies'
    | 'tenant.ai.manageAllocations'
    | 'tenant.ai.manageProviderKeys'
    // Integrations & Audit
    | 'tenant.integrations.view'
    | 'tenant.integrations.manage'
    | 'tenant.audit.view'
    // Media Library (Tenant-wide)
    | 'tenant.media.view'
    | 'tenant.media.upload'
    | 'tenant.media.edit'
    | 'tenant.media.delete'
    | 'tenant.media.importUnsplash'
    | 'tenant.media.generateAI'
    | 'tenant.media.reworkAI'
    | 'tenant.media.manageVisibility'
    // Calendar (optional)
    | 'tenant.calendar.view'
    | 'tenant.calendar.manage'
    // Notifications (optional)
    | 'tenant.notifications.view'
    | 'tenant.notifications.manage'
    // User/Profile (optional)
    | 'tenant.users.viewProfiles'
    | 'tenant.users.manageProfiles';

/**
 * Project-level permission nodes
 */
export type ProjectPermissionNode =
    // General
    | 'project.view'
    | 'project.settings.view'
    | 'project.settings.edit'
    | 'project.delete'
    // Members
    | 'project.members.view'
    | 'project.members.inviteWorkspaceUser'
    | 'project.members.inviteExternal'
    | 'project.members.remove'
    | 'project.members.manageRoles'
    // Modules
    | 'project.modules.view'
    | 'project.modules.enableDisable'
    // Tasks
    | 'project.tasks.view'
    | 'project.tasks.create'
    | 'project.tasks.edit'
    | 'project.tasks.editAny'
    | 'project.tasks.delete'
    | 'project.tasks.deleteAny'
    | 'project.tasks.assign'
    | 'project.tasks.changeStatus'
    | 'project.tasks.manageSubtasks'
    | 'project.tasks.manageChecklists'
    | 'project.tasks.comment'
    | 'project.tasks.attachFiles'
    | 'project.tasks.manageCustomFields'
    // Flows
    | 'project.flows.view'
    | 'project.flows.create'
    | 'project.flows.edit'
    | 'project.flows.delete'
    | 'project.flows.comment'
    | 'project.flows.attachFiles'
    | 'project.flows.advanceStep'
    | 'project.flows.revertStep'
    | 'project.flows.setStep'
    | 'project.flows.requestReview'
    | 'project.flows.approve'
    | 'project.flows.reject'
    | 'project.flows.handoffToTasks'
    | 'project.flows.handoffToSocial'
    | 'project.flows.handoffToMarketing'
    // Issues
    | 'project.issues.view'
    | 'project.issues.create'
    | 'project.issues.edit'
    | 'project.issues.delete'
    | 'project.issues.assign'
    | 'project.issues.changeStatus'
    | 'project.issues.comment'
    | 'project.issues.linkGithub'
    | 'project.issues.unlinkGithub'
    // Social - Accounts
    | 'project.social.accounts.view'
    | 'project.social.accounts.connect'
    | 'project.social.accounts.disconnect'
    // Social - Campaigns
    | 'project.social.campaigns.view'
    | 'project.social.campaigns.create'
    | 'project.social.campaigns.edit'
    | 'project.social.campaigns.delete'
    // Social - Posts
    | 'project.social.posts.view'
    | 'project.social.posts.create'
    | 'project.social.posts.edit'
    | 'project.social.posts.delete'
    | 'project.social.posts.schedule'
    | 'project.social.posts.publish'
    | 'project.social.posts.approve'
    | 'project.social.posts.archive'
    // Social - Assets
    | 'project.social.assets.manage'
    // Marketing - Paid Ads
    | 'project.marketing.ads.view'
    | 'project.marketing.ads.create'
    | 'project.marketing.ads.edit'
    | 'project.marketing.ads.delete'
    // Marketing - Email
    | 'project.marketing.email.view'
    | 'project.marketing.email.create'
    | 'project.marketing.email.edit'
    | 'project.marketing.email.send'
    | 'project.marketing.email.manageRecipients'
    // Marketing - Blog
    | 'project.marketing.blog.view'
    | 'project.marketing.blog.create'
    | 'project.marketing.blog.edit'
    | 'project.marketing.blog.delete'
    // Marketing - Settings
    | 'project.marketing.settings.view'
    | 'project.marketing.settings.edit'
    // Sprints
    | 'project.sprints.view'
    | 'project.sprints.create'
    | 'project.sprints.edit'
    | 'project.sprints.delete'
    | 'project.sprints.manageBacklog'
    | 'project.sprints.manageAssignments'
    // Milestones
    | 'project.milestones.view'
    | 'project.milestones.create'
    | 'project.milestones.edit'
    | 'project.milestones.delete'
    // Media (Project context)
    | 'project.media.view'
    | 'project.media.upload'
    | 'project.media.edit'
    | 'project.media.delete'
    | 'project.media.importUnsplash'
    | 'project.media.generateAI'
    | 'project.media.reworkAI'
    // Calendar (optional)
    | 'project.calendar.view'
    | 'project.calendar.manage'
    // Notifications (optional)
    | 'project.notifications.view'
    | 'project.notifications.manage';

/**
 * AI feature permission nodes
 */
export type AIPermissionNode =
    | 'ai.text.use'
    | 'ai.image.generate'
    | 'ai.image.rework'
    | 'ai.usage.viewSelf'
    | 'ai.usage.viewTenant'
    | 'ai.limits.manageSelf'
    | 'ai.limits.manageOthers'
    | 'ai.overage.allowSelf'
    | 'ai.overage.allowOthers';

/**
 * User self-service permission (optional gating)
 */
export type UserPermissionNode = 'user.settings.editSelf';

/**
 * Combined permission node type
 */
export type PermissionNode =
    | TenantPermissionNode
    | ProjectPermissionNode
    | AIPermissionNode
    | UserPermissionNode;

// =============================================================================
// PERMISSION SCOPE
// =============================================================================

export type PermissionScope = 'tenant' | 'project' | 'module' | 'resource';

// =============================================================================
// SYSTEM ROLE KEYS
// =============================================================================

export type SystemRoleKey = 'OWNER' | 'MEMBER' | 'GUEST' | 'PROJECT_OWNER';

// =============================================================================
// ROLE TYPES
// =============================================================================

/**
 * Permission set for a role (allow/deny model)
 */
export interface RolePermissions {
    allow: PermissionNode[];
    deny: PermissionNode[];
}

/**
 * Base role interface
 */
export interface Role {
    id: string;
    name: string;
    /** Role hierarchy position. Higher = more authority. Owner = Infinity, Member = 0, Guest = -1 */
    position: number;
    /** System roles cannot be deleted or renamed */
    isSystem: boolean;
    /** System role identifier for special handling */
    systemKey?: SystemRoleKey;
    /** Permission configuration */
    permissions: RolePermissions;
    /** Special mode for Project Owner - grants all project permissions */
    permissionsMode?: 'ALL_PROJECT_PERMISSIONS';
    /** Role color for UI display */
    color?: string;
    /** Role description */
    description?: string;
    /** Firestore metadata */
    createdAt?: any;
    updatedAt?: any;
}

/**
 * Tenant role (stored at tenant level)
 */
export interface TenantRole extends Role {
    tenantId: string;
}

/**
 * Project-scoped role (only Project Owner uses this)
 */
export interface ProjectRole extends Role {
    tenantId: string;
    projectId: string;
}

// =============================================================================
// MEMBERSHIP TYPES
// =============================================================================

export type MembershipStatus = 'active' | 'invited' | 'suspended';
export type ProjectMemberType = 'workspaceUser' | 'external';

/**
 * Tenant membership record
 */
export interface TenantMembership {
    userId: string;
    status: MembershipStatus;
    /** Role IDs assigned to this member. Does NOT include implicit Member role. */
    roleIds: string[];
    /** User display info (denormalized for performance) */
    displayName?: string;
    email?: string;
    photoURL?: string;
    /** Timestamp when user joined */
    joinedAt?: any;
    /** Who invited this user */
    invitedBy?: string;
}

/**
 * Project membership record
 */
export interface ProjectMembership {
    id: string;
    /** Type of member */
    type: ProjectMemberType;
    /** User ID (optional for pending external invites) */
    userId?: string;
    /** External email (for pending invites) */
    email?: string;
    /** Role IDs assigned. MUST include GUEST role ID if type is 'external'. */
    roleIds: string[];
    /** User display info (denormalized) */
    displayName?: string;
    photoURL?: string;
    /** Timestamp when user joined */
    joinedAt?: any;
    /** Who invited this user */
    invitedBy?: string;
}

// =============================================================================
// PERMISSION CONTEXT (for evaluation)
// =============================================================================

/**
 * Context for evaluating permissions
 */
export interface PermissionEvaluationContext {
    /** Current user ID */
    userId: string;
    /** Tenant ID */
    tenantId: string;
    /** Project ID (if in project context) */
    projectId?: string;
    /** Is user the tenant owner? */
    isTenantOwner: boolean;
    /** All roles assigned to user (including implicit Member) */
    roles: Role[];
    /** Is user an external project collaborator? */
    isExternal?: boolean;
}

// =============================================================================
// LEGACY COMPATIBILITY TYPES
// =============================================================================

/**
 * @deprecated Use Role with proper permission sets instead
 * Legacy project role type - kept for backward compatibility
 */
export type LegacyProjectRole = 'Owner' | 'Editor' | 'Viewer';

/**
 * @deprecated Use TenantMembership with roleIds instead
 * Legacy workspace role type - kept for backward compatibility
 */
export type LegacyWorkspaceRole = 'Owner' | 'Admin' | 'Member' | 'Guest';

// =============================================================================
// DEFAULT ROLE CONFIGURATIONS
// =============================================================================

/**
 * Default permissions for system roles
 * These are used when creating a new tenant
 */
export const DEFAULT_MEMBER_PERMISSIONS: PermissionNode[] = [
    // Basic tenant access
    'tenant.view',
    'tenant.members.view',
    'tenant.roles.view',
    // Media library access
    'tenant.media.view',
    'tenant.media.upload',
    // AI access (basic)
    'ai.text.use',
    'ai.usage.viewSelf',
    // User self-service
    'user.settings.editSelf',
];

/**
 * Default permissions for Guest role (externals)
 */
export const DEFAULT_GUEST_PERMISSIONS: PermissionNode[] = [
    // Very limited - externals only see what's explicitly granted via project roles
    'user.settings.editSelf',
];

/**
 * All project permissions (for Project Owner role)
 */
export const ALL_PROJECT_PERMISSIONS: ProjectPermissionNode[] = [
    'project.view',
    'project.settings.view',
    'project.settings.edit',
    'project.delete',
    'project.members.view',
    'project.members.inviteWorkspaceUser',
    'project.members.inviteExternal',
    'project.members.remove',
    'project.members.manageRoles',
    'project.modules.view',
    'project.modules.enableDisable',
    'project.tasks.view',
    'project.tasks.create',
    'project.tasks.edit',
    'project.tasks.editAny',
    'project.tasks.delete',
    'project.tasks.deleteAny',
    'project.tasks.assign',
    'project.tasks.changeStatus',
    'project.tasks.manageSubtasks',
    'project.tasks.manageChecklists',
    'project.tasks.comment',
    'project.tasks.attachFiles',
    'project.tasks.manageCustomFields',
    'project.flows.view',
    'project.flows.create',
    'project.flows.edit',
    'project.flows.delete',
    'project.flows.comment',
    'project.flows.attachFiles',
    'project.flows.advanceStep',
    'project.flows.revertStep',
    'project.flows.setStep',
    'project.flows.requestReview',
    'project.flows.approve',
    'project.flows.reject',
    'project.flows.handoffToTasks',
    'project.flows.handoffToSocial',
    'project.flows.handoffToMarketing',
    'project.issues.view',
    'project.issues.create',
    'project.issues.edit',
    'project.issues.delete',
    'project.issues.assign',
    'project.issues.changeStatus',
    'project.issues.comment',
    'project.issues.linkGithub',
    'project.issues.unlinkGithub',
    'project.social.accounts.view',
    'project.social.accounts.connect',
    'project.social.accounts.disconnect',
    'project.social.campaigns.view',
    'project.social.campaigns.create',
    'project.social.campaigns.edit',
    'project.social.campaigns.delete',
    'project.social.posts.view',
    'project.social.posts.create',
    'project.social.posts.edit',
    'project.social.posts.delete',
    'project.social.posts.schedule',
    'project.social.posts.publish',
    'project.social.posts.approve',
    'project.social.posts.archive',
    'project.social.assets.manage',
    'project.marketing.ads.view',
    'project.marketing.ads.create',
    'project.marketing.ads.edit',
    'project.marketing.ads.delete',
    'project.marketing.email.view',
    'project.marketing.email.create',
    'project.marketing.email.edit',
    'project.marketing.email.send',
    'project.marketing.email.manageRecipients',
    'project.marketing.blog.view',
    'project.marketing.blog.create',
    'project.marketing.blog.edit',
    'project.marketing.blog.delete',
    'project.marketing.settings.view',
    'project.marketing.settings.edit',
    'project.sprints.view',
    'project.sprints.create',
    'project.sprints.edit',
    'project.sprints.delete',
    'project.sprints.manageBacklog',
    'project.sprints.manageAssignments',
    'project.milestones.view',
    'project.milestones.create',
    'project.milestones.edit',
    'project.milestones.delete',
    'project.media.view',
    'project.media.upload',
    'project.media.edit',
    'project.media.delete',
    'project.media.importUnsplash',
    'project.media.generateAI',
    'project.media.reworkAI',
    'project.calendar.view',
    'project.calendar.manage',
    'project.notifications.view',
    'project.notifications.manage',
];

/**
 * All tenant permissions (for Tenant Owner)
 */
export const ALL_TENANT_PERMISSIONS: TenantPermissionNode[] = [
    'tenant.view',
    'tenant.settings.view',
    'tenant.settings.edit',
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
    'tenant.roles.manageHierarchy',
    'tenant.billing.view',
    'tenant.billing.manage',
    'tenant.seats.view',
    'tenant.seats.manage',
    'tenant.plan.view',
    'tenant.plan.manage',
    'tenant.sso.view',
    'tenant.sso.configure',
    'tenant.sso.enforce',
    'tenant.ai.viewUsage',
    'tenant.ai.managePolicies',
    'tenant.ai.manageAllocations',
    'tenant.ai.manageProviderKeys',
    'tenant.integrations.view',
    'tenant.integrations.manage',
    'tenant.audit.view',
    'tenant.media.view',
    'tenant.media.upload',
    'tenant.media.edit',
    'tenant.media.delete',
    'tenant.media.importUnsplash',
    'tenant.media.generateAI',
    'tenant.media.reworkAI',
    'tenant.media.manageVisibility',
    'tenant.calendar.view',
    'tenant.calendar.manage',
    'tenant.notifications.view',
    'tenant.notifications.manage',
    'tenant.users.viewProfiles',
    'tenant.users.manageProfiles',
];

/**
 * All AI permissions (for full AI access)
 */
export const ALL_AI_PERMISSIONS: AIPermissionNode[] = [
    'ai.text.use',
    'ai.image.generate',
    'ai.image.rework',
    'ai.usage.viewSelf',
    'ai.usage.viewTenant',
    'ai.limits.manageSelf',
    'ai.limits.manageOthers',
    'ai.overage.allowSelf',
    'ai.overage.allowOthers',
];
