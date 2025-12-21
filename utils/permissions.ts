import { ProjectRole, RoleCapabilities, Project, ProjectMember } from '../types';
import { auth } from '../services/firebase';

/**
 * Role Capabilities Matrix
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
        canView: true,
    },
    Editor: {
        canEdit: false, // Cannot edit project settings
        canDelete: false,
        canInvite: false,
        canManageTasks: true,
        canManageIdeas: true,
        canManageIssues: true,
        canComment: true,
        canView: true,
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
    },
};

/**
 * Get the role of the current user in a project
 */
export function getUserRole(project: Project | null, userId?: string): ProjectRole | null {
    if (!project || !userId) return null;

    // Owner always has Owner role
    if (project.ownerId === userId) return 'Owner';

    // Check if user is in members array
    if (!project.members) return null;

    // Handle legacy string[] format (migration support)
    if (typeof project.members[0] === 'string') {
        return (project.members as unknown as string[]).includes(userId) ? 'Editor' : null;
    }

    // New ProjectMember[] format
    const member = (project.members as ProjectMember[]).find(m => m.userId === userId);
    return member?.role || null;
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
        };
    }

    return ROLE_CAPABILITIES[role];
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
