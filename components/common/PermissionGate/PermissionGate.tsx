/**
 * PermissionGate Component
 * 
 * Declarative permission-based rendering for UI components.
 * Conditionally renders children based on user permissions.
 * 
 * @example
 * // Single permission
 * <PermissionGate permission="project.tasks.create" projectId={projectId}>
 *     <Button>Create Task</Button>
 * </PermissionGate>
 * 
 * // With fallback
 * <PermissionGate permission="tenant.billing.manage" fallback={<UpgradePrompt />}>
 *     <BillingSettings />
 * </PermissionGate>
 * 
 * // All permissions required (AND)
 * <PermissionGate permissions={['project.tasks.create', 'project.tasks.assign']}>
 *     <AssignTaskButton />
 * </PermissionGate>
 * 
 * // Any permission sufficient (OR)
 * <PermissionGate anyOf={['project.tasks.edit', 'project.tasks.editAny']}>
 *     <EditTaskButton />
 * </PermissionGate>
 */

import React, { ReactNode, useMemo } from 'react';
import { PermissionNode } from '../../types/permissions';
import { usePermissions } from '../../context/PermissionContext';

interface PermissionGateProps {
    /** Single permission to check */
    permission?: PermissionNode;

    /** Multiple permissions - ALL must be granted (AND logic) */
    permissions?: PermissionNode[];

    /** Multiple permissions - ANY one must be granted (OR logic) */
    anyOf?: PermissionNode[];

    /** Project ID for project-scoped permissions */
    projectId?: string;

    /** Content to render when permission is granted */
    children: ReactNode;

    /** Content to render when permission is denied (optional) */
    fallback?: ReactNode;

    /** If true, shows fallback while loading instead of nothing */
    showFallbackWhileLoading?: boolean;
}

export function PermissionGate({
    permission,
    permissions,
    anyOf,
    projectId,
    children,
    fallback = null,
    showFallbackWhileLoading = false,
}: PermissionGateProps): JSX.Element | null {
    const { hasPermission, hasAllPermissions, hasAnyPermission, loading } = usePermissions();

    const isGranted = useMemo(() => {
        // While loading, deny by default (secure)
        if (loading) return false;

        // Single permission check
        if (permission) {
            return hasPermission(permission, projectId);
        }

        // Multiple permissions (AND)
        if (permissions && permissions.length > 0) {
            return hasAllPermissions(permissions, projectId);
        }

        // Any permission (OR)
        if (anyOf && anyOf.length > 0) {
            return hasAnyPermission(anyOf, projectId);
        }

        // No permission specified - allow (component misconfiguration)
        console.warn('PermissionGate: No permission specified, rendering children by default');
        return true;
    }, [permission, permissions, anyOf, projectId, hasPermission, hasAllPermissions, hasAnyPermission, loading]);

    // Handle loading state
    if (loading && !showFallbackWhileLoading) {
        return null;
    }

    if (loading && showFallbackWhileLoading) {
        return <>{fallback}</>;
    }

    // Render based on permission
    return isGranted ? <>{children}</> : <>{fallback}</>;
}

// =============================================================================
// CONVENIENCE VARIANTS
// =============================================================================

interface TenantPermissionGateProps {
    permission: PermissionNode;
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Shorthand for tenant-level permission checks
 */
export function TenantPermissionGate({ permission, children, fallback }: TenantPermissionGateProps) {
    return (
        <PermissionGate permission={permission} fallback={fallback}>
            {children}
        </PermissionGate>
    );
}

interface ProjectPermissionGateProps {
    permission: PermissionNode;
    projectId: string;
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Shorthand for project-level permission checks
 */
export function ProjectPermissionGate({ permission, projectId, children, fallback }: ProjectPermissionGateProps) {
    return (
        <PermissionGate permission={permission} projectId={projectId} fallback={fallback}>
            {children}
        </PermissionGate>
    );
}

// =============================================================================
// HOOK-BASED ALTERNATIVE FOR COMPLEX LOGIC
// =============================================================================

/**
 * Hook for when you need to check permissions in component logic
 * instead of just conditional rendering
 * 
 * @example
 * const { canCreate, canDelete } = useProjectPermissionChecks(projectId, {
 *     canCreate: 'project.tasks.create',
 *     canDelete: 'project.tasks.delete',
 * });
 * 
 * const handleClick = () => {
 *     if (!canCreate) {
 *         showToast('Permission denied');
 *         return;
 *     }
 *     // ... create logic
 * };
 */
export function usePermissionChecks<T extends Record<string, PermissionNode>>(
    checks: T,
    projectId?: string
): Record<keyof T, boolean> {
    const { hasPermission, loading } = usePermissions();

    return useMemo(() => {
        const result = {} as Record<keyof T, boolean>;

        for (const [key, node] of Object.entries(checks)) {
            result[key as keyof T] = loading ? false : hasPermission(node as PermissionNode, projectId);
        }

        return result;
    }, [checks, projectId, hasPermission, loading]);
}

export default PermissionGate;
