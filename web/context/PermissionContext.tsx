/**
 * Permission Context
 * 
 * React context for permission state management.
 * Provides easy access to permission checks throughout the app.
 * 
 * Usage:
 * ```tsx
 * const { hasPermission, isTenantOwner } = usePermissions();
 * 
 * // Check tenant permission
 * if (hasPermission('tenant.members.invite')) { ... }
 * 
 * // Check project permission
 * if (hasPermission('project.tasks.create', projectId)) { ... }
 * ```
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { auth } from '../services/firebase';
import { subscribeTenantUsers, subscribeTenantRoles, FirestoreRole } from '../services/dataService';
import { getActiveTenantId } from '../services/domain/authService';
import {
    PermissionNode,
    Role,
    PermissionEvaluationContext,
    LegacyWorkspaceRole,
} from '../types/permissions';
import {
    evaluatePermission,
    evaluatePermissions,
    hasAllPermissions,
    hasAnyPermission,
    canManageRole,
    getHighestPosition,
    SYSTEM_ROLE_DEFAULTS,
} from '../services/permissionService';

// =============================================================================
// SYSTEM ROLES (code-defined; custom roles live in Firestore role docs)
// =============================================================================

const OWNER_ROLE: Role = { id: 'system-owner', name: 'Owner', systemKey: 'OWNER', ...SYSTEM_ROLE_DEFAULTS.OWNER };
const MEMBER_ROLE: Role = { id: 'system-member', name: 'Member', systemKey: 'MEMBER', ...SYSTEM_ROLE_DEFAULTS.MEMBER };
const GUEST_ROLE: Role = { id: 'system-guest', name: 'Guest', systemKey: 'GUEST', ...SYSTEM_ROLE_DEFAULTS.GUEST };

/** Map a Firestore role doc to the in-memory Role model. */
function firestoreRoleToRole(fr: FirestoreRole): Role {
    return {
        id: fr.id,
        name: fr.name,
        color: fr.color,
        description: fr.description,
        position: fr.position,
        isSystem: fr.isSystem,
        systemKey: fr.systemKey as Role['systemKey'],
        permissions: {
            allow: (fr.permissions?.allow || []) as PermissionNode[],
            deny: (fr.permissions?.deny || []) as PermissionNode[],
        },
    };
}

// =============================================================================
// TYPES
// =============================================================================

interface PermissionContextValue {
    // Loading state
    loading: boolean;

    // Current user info
    userId: string | null;
    tenantId: string | null;

    // Quick permission checks
    hasPermission: (node: PermissionNode, projectId?: string) => boolean;
    hasAllPermissions: (nodes: PermissionNode[], projectId?: string) => boolean;
    hasAnyPermission: (nodes: PermissionNode[], projectId?: string) => boolean;

    // Role info
    tenantRoles: Role[];
    isTenantOwner: boolean;

    // Hierarchy checks for role management
    canManageRole: (targetRole: Role) => boolean;
    highestPosition: number;

    // Legacy compatibility
    legacyWorkspaceRole: LegacyWorkspaceRole | null;

    // Raw evaluation context (for advanced use)
    getEvaluationContext: (projectId?: string) => PermissionEvaluationContext | null;
}

// =============================================================================
// CONTEXT
// =============================================================================

const PermissionContext = createContext<PermissionContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface PermissionProviderProps {
    children: ReactNode;
}

export function PermissionProvider({ children }: PermissionProviderProps) {
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [members, setMembers] = useState<any[]>([]);
    const [customRoles, setCustomRoles] = useState<Role[]>([]);

    const tenantId = getActiveTenantId();
    const currentUser = auth.currentUser;
    const userId = currentUser?.uid ?? null;
    const loading = loadingMembers || loadingRoles;

    // Subscribe to tenant members (for the current user's roleIds)
    useEffect(() => {
        if (!tenantId) {
            setLoadingMembers(false);
            return;
        }
        const unsubscribe = subscribeTenantUsers((fetchedMembers) => {
            setMembers(fetchedMembers as any[]);
            setLoadingMembers(false);
        }, tenantId);
        return () => unsubscribe();
    }, [tenantId]);

    // Subscribe to the tenant's custom role documents (authoritative permissions)
    useEffect(() => {
        if (!tenantId) {
            setLoadingRoles(false);
            return;
        }
        const unsubscribe = subscribeTenantRoles((firestoreRoles) => {
            setCustomRoles(firestoreRoles.map(firestoreRoleToRole));
            setLoadingRoles(false);
        }, tenantId);
        return () => unsubscribe();
    }, [tenantId]);

    // The current user's membership record
    const currentMember = useMemo(() => {
        if (!userId) return null;
        return members.find((m: any) => m.id === userId || m.uid === userId) ?? null;
    }, [members, userId]);

    // Check if current user is tenant owner
    const isTenantOwner = useMemo(() => {
        if (!userId || !tenantId) return false;
        if (userId === tenantId) return true; // personal workspace
        return currentMember?.role === 'Owner';
    }, [userId, tenantId, currentMember]);

    const isExternal = currentMember?.role === 'Guest';

    // Legacy role label kept for any consumer that still reads it
    const legacyWorkspaceRole = useMemo((): LegacyWorkspaceRole | null => {
        if (!userId || !tenantId) return null;
        if (isTenantOwner) return 'Owner';
        const role = currentMember?.role as string | undefined;
        if (!role) return 'Member';
        if (role === 'Editor') return 'Member';
        if (role === 'Viewer') return 'Guest';
        return role as LegacyWorkspaceRole;
    }, [currentMember, userId, tenantId, isTenantOwner]);

    // Build the current user's effective roles from member.roleIds + system roles.
    // System roles are code-defined; Member is always implicit; Owner short-circuits.
    const tenantRoles = useMemo((): Role[] => {
        if (!userId || !tenantId) return [];
        if (isTenantOwner) return [OWNER_ROLE];

        const roles: Role[] = [MEMBER_ROLE];
        const assignedIds: string[] = currentMember?.roleIds || [];
        assignedIds.forEach((id) => {
            const match = customRoles.find((r) => r.id === id);
            if (match) roles.push(match);
        });
        if (isExternal) roles.push(GUEST_ROLE);
        return roles;
    }, [userId, tenantId, isTenantOwner, isExternal, currentMember, customRoles]);

    // Get highest position for hierarchy checks
    const highestPosition = useMemo(() => {
        return getHighestPosition(tenantRoles);
    }, [tenantRoles]);

    // Build evaluation context
    const getEvaluationContext = useCallback((projectId?: string): PermissionEvaluationContext | null => {
        if (!userId || !tenantId) return null;

        return {
            userId,
            tenantId,
            projectId,
            isTenantOwner,
            roles: tenantRoles,
            isExternal,
        };
    }, [userId, tenantId, isTenantOwner, tenantRoles, isExternal]);

    // Permission check functions
    const hasPermissionFn = useCallback((node: PermissionNode, projectId?: string): boolean => {
        const context = getEvaluationContext(projectId);
        if (!context) return false;
        return evaluatePermission(context, node);
    }, [getEvaluationContext]);

    const hasAllPermissionsFn = useCallback((nodes: PermissionNode[], projectId?: string): boolean => {
        const context = getEvaluationContext(projectId);
        if (!context) return false;
        return hasAllPermissions(context, nodes);
    }, [getEvaluationContext]);

    const hasAnyPermissionFn = useCallback((nodes: PermissionNode[], projectId?: string): boolean => {
        const context = getEvaluationContext(projectId);
        if (!context) return false;
        return hasAnyPermission(context, nodes);
    }, [getEvaluationContext]);

    const canManageRoleFn = useCallback((targetRole: Role): boolean => {
        return canManageRole(tenantRoles, targetRole);
    }, [tenantRoles]);

    // Context value
    const value = useMemo((): PermissionContextValue => ({
        loading,
        userId,
        tenantId,
        hasPermission: hasPermissionFn,
        hasAllPermissions: hasAllPermissionsFn,
        hasAnyPermission: hasAnyPermissionFn,
        tenantRoles,
        isTenantOwner,
        canManageRole: canManageRoleFn,
        highestPosition,
        legacyWorkspaceRole,
        getEvaluationContext,
    }), [
        loading,
        userId,
        tenantId,
        hasPermissionFn,
        hasAllPermissionsFn,
        hasAnyPermissionFn,
        tenantRoles,
        isTenantOwner,
        canManageRoleFn,
        highestPosition,
        legacyWorkspaceRole,
        getEvaluationContext,
    ]);

    return (
        <PermissionContext.Provider value={value}>
            {children}
        </PermissionContext.Provider>
    );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Main hook for accessing permission context
 */
export function usePermissions(): PermissionContextValue {
    const context = useContext(PermissionContext);
    if (!context) {
        throw new Error('usePermissions must be used within a PermissionProvider');
    }
    return context;
}

/**
 * Simple hook for checking a single permission
 * 
 * @example
 * const canInvite = usePermission('tenant.members.invite');
 * const canCreateTask = usePermission('project.tasks.create', projectId);
 */
export function usePermission(node: PermissionNode, projectId?: string): boolean {
    const { hasPermission, loading } = usePermissions();
    return useMemo(() => {
        if (loading) return false;
        return hasPermission(node, projectId);
    }, [hasPermission, node, projectId, loading]);
}

/**
 * Hook for checking multiple permissions at once
 * Returns an object mapping each permission to its result
 * 
 * @example
 * const perms = usePermissionMap(['project.tasks.create', 'project.tasks.delete'], projectId);
 * if (perms['project.tasks.create']) { ... }
 */
export function usePermissionMap(
    nodes: PermissionNode[],
    projectId?: string
): Record<PermissionNode, boolean> {
    const { getEvaluationContext, loading } = usePermissions();

    return useMemo(() => {
        const result: Record<string, boolean> = {};

        if (loading) {
            nodes.forEach(n => result[n] = false);
            return result as Record<PermissionNode, boolean>;
        }

        const context = getEvaluationContext(projectId);
        if (!context) {
            nodes.forEach(n => result[n] = false);
            return result as Record<PermissionNode, boolean>;
        }

        return evaluatePermissions(context, nodes);
    }, [getEvaluationContext, nodes, projectId, loading]);
}

/**
 * Hook for checking if user has ALL specified permissions
 */
export function useHasAllPermissions(nodes: PermissionNode[], projectId?: string): boolean {
    const { hasAllPermissions, loading } = usePermissions();
    return useMemo(() => {
        if (loading) return false;
        return hasAllPermissions(nodes, projectId);
    }, [hasAllPermissions, nodes, projectId, loading]);
}

/**
 * Hook for checking if user has ANY of the specified permissions
 */
export function useHasAnyPermission(nodes: PermissionNode[], projectId?: string): boolean {
    const { hasAnyPermission, loading } = usePermissions();
    return useMemo(() => {
        if (loading) return false;
        return hasAnyPermission(nodes, projectId);
    }, [hasAnyPermission, nodes, projectId, loading]);
}

// =============================================================================
// EXPORTS
// =============================================================================

export { PermissionContext };
export type { PermissionContextValue };
