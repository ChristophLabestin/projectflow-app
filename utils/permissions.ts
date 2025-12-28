import { ProjectRole, RoleCapabilities, Project, ProjectMember, WorkspaceRole, WorkspacePermissions, Tenant, Member } from '../types';
import { auth } from '../services/firebase';

/**
 * Role Capabilities Matrix (Project)
 * Defines what each role can do in a project
 */
export const ROLE_CAPABILITIES: Record<ProjectRole, RoleCapabilities> = {
    Owner: {
        canEdit: true,
        canDelete: true,
        canInvite: true,
        canManageTasks: true,
        canManageIdeas: true,
        canManageIssues: true,
        canComment: true,
        canComment: true,
        canView: true,
        canManageGroups: true,
    },
    Editor: {
        canEdit: false, // Cannot edit project settings
        canDelete: false,
        canInvite: false,
        canManageTasks: true,
        canManageIdeas: true,
        canManageIssues: true,
        canComment: true,
        canComment: true,
        canView: true,
        canManageGroups: true,
    },
    Viewer: {
        canEdit: false,
        canDelete: false,
        canInvite: false,
        canManageTasks: false,
        canManageIdeas: false,
        canManageIssues: false,
        canComment: true, // Can still add comments
        canView: true,
        canManageGroups: false,
    },
};

/**
 * Role Capabilities Matrix (Workspace)
 */
export const WORKSPACE_CAPABILITIES: Record<WorkspaceRole, WorkspacePermissions> = {
    Owner: {
        canManageWorkspace: true,
        canManageMembers: true,
        canManageGroups: true,
        canCreateProjects: true,
        canDeleteProjects: true,
        canViewAllProjects: true,
    },
    Admin: {
        canManageWorkspace: false, // Only owner manages billing/deletion of workspace
        canManageMembers: true,
        canManageGroups: true,
        canCreateProjects: true,
        canDeleteProjects: true, // Can delete any project? Maybe restricts to own? Admin usually can.
        canViewAllProjects: true,
    },
    Member: {
        canManageWorkspace: false,
        canManageMembers: false,
        canManageGroups: false,
        canCreateProjects: true, // Standard members usually can create projects
        canDeleteProjects: false, // Only own projects
        canViewAllProjects: false, // Only assigned projects
    },
    Guest: {
        canManageWorkspace: false,
        canManageMembers: false,
        canManageGroups: false,
        canCreateProjects: false,
        canDeleteProjects: false,
        canViewAllProjects: false,
    },
};

// --- Project Permissions ---

/**
 * Get the role of the current user in a project
 */
export function getUserRole(project: Project | null, userId?: string): ProjectRole | null {
    if (!project || !userId) return null;

    // Owner always has Owner role
    if (project.ownerId === userId) return 'Owner';

    // Check if user is in members array
    if (!project.members || project.members.length === 0) return null;

    // Handle mixed format: iterate and check each member individually
    for (const member of project.members) {
        if (typeof member === 'string') {
            // Legacy format: user ID string
            if (member === userId) return 'Editor'; // Default role for legacy members
        } else {
            // New format: ProjectMember object
            if ((member as ProjectMember).userId === userId) {
                return (member as ProjectMember).role || 'Editor';
            }
        }
    }

    return null;
}

/**
 * Check if a user has a specific capability in a project
 */
export function checkPermission(
    project: Project | null,
    userId: string | undefined,
    capability: keyof RoleCapabilities
): boolean {
    const role = getUserRole(project, userId);
    if (!role) return false;

    return ROLE_CAPABILITIES[role][capability];
}

/**
 * Get all capabilities for a user's role in a project
 */
export function getUserCapabilities(project: Project | null, userId?: string): RoleCapabilities {
    const role = getUserRole(project, userId);
    if (!role) {
        // Return all false if no role
        return {
            canEdit: false,
            canDelete: false,
            canInvite: false,
            canManageTasks: false,
            canManageIdeas: false,
            canManageIssues: false,
            canComment: false,
            canView: false,
            canManageGroups: false,
        };
    }

    return ROLE_CAPABILITIES[role];
}

// --- Workspace Permissions ---

/**
 * Get the role of the current user in a workspace
 */
export function getWorkspaceRole(members: Member[] = [], userId?: string): WorkspaceRole | 'None' {
    if (!userId) return 'None';

    const member = members.find(m => m.uid === userId);
    if (!member) return 'None';

    // Handle legacy roles
    const role = member.role as string;
    if (role === 'Editor') return 'Member';
    if (role === 'Viewer') return 'Guest';

    return member.role as WorkspaceRole;
}

/**
 * Check if a user has a specific capability in a workspace
 */
export function checkWorkspacePermission(
    members: Member[],
    userId: string | undefined,
    capability: keyof WorkspacePermissions
): boolean {
    const role = getWorkspaceRole(members, userId);
    if (role === 'None') return false;
    return WORKSPACE_CAPABILITIES[role][capability];
}

/**
 * Migrate legacy members array (string[]) to new format (ProjectMember[])
 */
export function migrateMembersToRoles(
    members: string[] | ProjectMember[] | undefined,
    ownerId: string
): ProjectMember[] {
    if (!members || members.length === 0) return [];

    // Already migrated
    if (typeof members[0] !== 'string') {
        return members as ProjectMember[];
    }

    // Migrate: assign Editor role to all non-owner members
    return (members as string[])
        .filter(uid => uid !== ownerId) // Owner shouldn't be in members
        .map(userId => ({
            userId,
            role: 'Editor' as ProjectRole,
            joinedAt: new Date(), // Approximate
            invitedBy: ownerId, // Assume owner invited
        }));
}
