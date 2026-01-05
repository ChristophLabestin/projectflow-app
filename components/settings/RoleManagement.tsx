/**
 * Role Management Component
 * 
 * Provides UI for creating, editing, and managing custom roles
 * following the Discord-style permission system from PERMISSIONS.md.
 * 
 * Per PERMISSIONS.md Section 3.1:
 * "Roles must be displayed in a vertical ordered list that communicates hierarchy."
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useToast, useConfirm } from '../../context/UIContext';
import { useWorkspacePermissions } from '../../hooks/useWorkspacePermissions';
import { useLanguage } from '../../context/LanguageContext';
import {
    PermissionNode,
    Role,
    DEFAULT_MEMBER_PERMISSIONS
} from '../../types/permissions';
import {
    PERMISSION_CATALOG,
    groupPermissionsByModule,
    isProtectedRole,
    SYSTEM_ROLE_DEFAULTS
} from '../../services/permissionService';
import {
    subscribeTenantRoles,
    createTenantRole,
    updateTenantRole,
    deleteTenantRole,
    FirestoreRole
} from '../../services/dataService';

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

interface RoleFormData {
    name: string;
    color: string;
    description: string;
    permissions: {
        allow: PermissionNode[];
        deny: PermissionNode[];
    };
}

const DEFAULT_ROLE_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#78716c', '#64748b', '#71717a'
];

// =============================================================================
// PERMISSION GROUP COMPONENT (for modal)
// =============================================================================

interface PermissionGroupProps {
    groupName: string;
    permissions: PermissionNode[];
    allowedPermissions: Set<PermissionNode>;
    deniedPermissions: Set<PermissionNode>;
    onToggleAllow: (permission: PermissionNode) => void;
    onToggleDeny: (permission: PermissionNode) => void;
    disabled?: boolean;
}

function PermissionGroup({
    groupName,
    permissions,
    allowedPermissions,
    deniedPermissions,
    onToggleAllow,
    onToggleDeny,
    disabled
}: PermissionGroupProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const displayName = groupName.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' → ');
    const allowedCount = permissions.filter(p => allowedPermissions.has(p)).length;

    return (
        <div className="border border-surface rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-2.5 bg-surface hover:bg-surface-hover transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-muted">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                    <span className="font-medium text-sm text-main">{displayName}</span>
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    {allowedCount}/{permissions.length}
                </span>
            </button>

            {isExpanded && (
                <div className="p-2 bg-surface/50 border-t border-surface space-y-1">
                    {permissions.map(permission => {
                        const meta = PERMISSION_CATALOG[permission];
                        const isAllowed = allowedPermissions.has(permission);
                        const isDenied = deniedPermissions.has(permission);

                        return (
                            <div key={permission} className="flex items-center gap-2 p-1.5 rounded hover:bg-surface-hover">
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => onToggleAllow(permission)}
                                        className={`size-4 rounded flex items-center justify-center border transition-all text-xs
                                            ${isAllowed ? 'bg-green-500 border-green-500 text-white' : 'border-surface hover:border-green-500'}
                                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        title="Allow"
                                    >
                                        {isAllowed && <span className="material-symbols-outlined text-xs">check</span>}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => onToggleDeny(permission)}
                                        className={`size-4 rounded flex items-center justify-center border transition-all text-xs
                                            ${isDenied ? 'bg-red-500 border-red-500 text-white' : 'border-surface hover:border-red-500'}
                                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        title="Deny"
                                    >
                                        {isDenied && <span className="material-symbols-outlined text-xs">close</span>}
                                    </button>
                                </div>
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <code className="text-[10px] text-muted font-mono truncate">{permission}</code>
                                    {meta?.dangerLevel === 'high' && (
                                        <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-500 shrink-0">!</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// =============================================================================
// DRAGGABLE ROLE ITEM (simplified and polished)
// =============================================================================

interface DraggableRoleItemProps {
    role: Role;
    rank: number; // Display rank (1, 2, 3...)
    isSelected: boolean;
    onSelect: () => void;
    canReorder: boolean;
    isDragging: boolean;
    dropPosition: 'above' | 'below' | null;
    onDragStart: () => void;
    onDragEnd: () => void;
    onDragEnter: (position: 'above' | 'below') => void;
    onDragLeave: () => void;
    onDrop: () => void;
}

function DraggableRoleItem({
    role,
    rank,
    isSelected,
    onSelect,
    canReorder,
    isDragging,
    dropPosition,
    onDragStart,
    onDragEnd,
    onDragEnter,
    onDragLeave,
    onDrop
}: DraggableRoleItemProps) {
    const isOwner = role.systemKey === 'OWNER';
    const isGuest = role.systemKey === 'GUEST';
    const canDrag = canReorder && !isOwner && !isGuest;

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        onDragEnter(e.clientY < midY ? 'above' : 'below');
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        onDrop();
    };

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', role.id);
        // Use setTimeout to prevent the dragging element from disappearing immediately
        setTimeout(() => onDragStart(), 0);
    };

    // Owner role styling
    if (isOwner) {
        return (
            <div className="relative">
                {dropPosition === 'below' && (
                    <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full animate-pulse z-10" />
                )}
                <div
                    onClick={onSelect}
                    onDragOver={handleDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={handleDrop}
                    className={`
                        flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer
                        bg-gradient-to-r from-amber-500/5 to-orange-500/5
                        border-2 border-amber-500/20 hover:border-amber-500/40
                        ${isSelected ? 'ring-2 ring-amber-500/50 border-amber-500/50' : ''}
                    `}
                >
                    <div className="size-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                        <span className="material-symbols-outlined text-lg">star</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-main">{role.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                                OWNER
                            </span>
                        </div>
                        <p className="text-xs text-muted">Full access to all features</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Drop indicator - above */}
            {dropPosition === 'above' && !isDragging && (
                <div className="absolute -top-1 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full animate-pulse z-10" />
            )}
            {/* Drop indicator - below */}
            {dropPosition === 'below' && !isDragging && (
                <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full animate-pulse z-10" />
            )}

            <div
                draggable={canDrag}
                onDragStart={canDrag ? handleDragStart : undefined}
                onDragEnd={onDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={onDragLeave}
                onDrop={handleDrop}
                onClick={onSelect}
                className={`
                    flex items-center gap-3 p-3 rounded-xl transition-all duration-200
                    border-2 border-transparent
                    ${isDragging
                        ? 'opacity-30 scale-95 bg-surface'
                        : 'bg-surface hover:bg-surface-hover'
                    }
                    ${isSelected
                        ? 'ring-2 ring-primary/50 border-primary/30 bg-primary/5'
                        : 'hover:border-surface'
                    }
                    ${dropPosition && !isDragging ? 'bg-primary/10' : ''}
                    ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                `}
            >
                {/* Drag handle */}
                {canDrag && (
                    <div className="text-muted/30 hover:text-muted transition-colors -ml-1">
                        <span className="material-symbols-outlined text-xl">drag_indicator</span>
                    </div>
                )}
                {!canDrag && <div className="w-5" />}

                {/* Role avatar with color */}
                <div
                    className="size-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md"
                    style={{
                        backgroundColor: role.color || '#6366f1',
                        boxShadow: `0 4px 14px ${role.color || '#6366f1'}40`
                    }}
                >
                    {role.name.charAt(0).toUpperCase()}
                </div>

                {/* Role info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-main">{role.name}</span>
                        {role.isSystem && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-border text-muted">
                                SYSTEM
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted">
                        {role.permissions.allow.length} permissions
                    </p>
                </div>

                {/* Rank indicator */}
                <div className="text-xs font-mono text-muted/60 bg-surface-border/50 px-2 py-1 rounded">
                    #{rank}
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// PERMISSION DISPLAY PANEL (right side)
// =============================================================================

interface PermissionDisplayPanelProps {
    role: Role | null;
    onEdit: () => void;
    onDelete: () => void;
    canManage: boolean;
}

function PermissionDisplayPanel({ role, onEdit, onDelete, canManage }: PermissionDisplayPanelProps) {
    const permissionGroups = useMemo(() => {
        if (!role) return new Map<string, PermissionNode[]>();

        const groups = new Map<string, PermissionNode[]>();
        for (const perm of role.permissions.allow) {
            const parts = perm.split('.');
            const groupKey = parts.slice(0, 2).join('.');
            if (!groups.has(groupKey)) groups.set(groupKey, []);
            groups.get(groupKey)!.push(perm);
        }
        return groups;
    }, [role]);

    if (!role) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <span className="material-symbols-outlined text-5xl text-muted/30 mb-3">touch_app</span>
                <p className="text-muted">Select a role to view its permissions</p>
            </div>
        );
    }

    const protection = isProtectedRole(role);
    const isOwner = role.systemKey === 'OWNER';

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className={`p-4 border-b border-surface ${isOwner ? 'bg-gradient-to-r from-amber-500/10 to-transparent' : ''}`}>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className={`size-10 rounded-full flex items-center justify-center text-white font-bold ${isOwner ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/25' : ''}`}
                            style={isOwner ? {} : { backgroundColor: role.color || 'var(--color-primary)' }}
                        >
                            {isOwner ? <span className="material-symbols-outlined">crown</span> : role.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className={`font-bold text-lg ${isOwner ? 'text-amber-600 dark:text-amber-400' : 'text-main'}`}>
                                {role.name}
                            </h3>
                            <p className="text-xs text-muted">
                                {role.description || `Position: ${role.position === Number.MAX_SAFE_INTEGER ? '∞ (Highest)' : role.position}`}
                            </p>
                        </div>
                    </div>
                    {canManage && (
                        <div className="flex gap-1">
                            {protection.canEdit && (
                                <Button variant="ghost" size="sm" onClick={onEdit}>
                                    <span className="material-symbols-outlined text-base">edit</span>
                                </Button>
                            )}
                            {protection.canDelete && (
                                <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                                    <span className="material-symbols-outlined text-base">delete</span>
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Permissions list */}
            <div className="flex-1 overflow-y-auto p-4">
                {isOwner ? (
                    <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center size-16 rounded-full bg-amber-500/10 mb-4">
                            <span className="material-symbols-outlined text-3xl text-amber-500">verified</span>
                        </div>
                        <h4 className="font-bold text-main mb-1">Full Access</h4>
                        <p className="text-sm text-muted">
                            The Owner role has unrestricted access to all features and cannot be modified.
                        </p>
                    </div>
                ) : role.permissions.allow.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                        <span className="material-symbols-outlined text-4xl mb-2">block</span>
                        <p>No permissions granted</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-muted">
                            <span>Allowed Permissions</span>
                            <span className="font-mono">{role.permissions.allow.length} total</span>
                        </div>

                        {Array.from(permissionGroups.entries()).map(([group, perms]) => (
                            <div key={group} className="space-y-1">
                                <div className="text-xs font-medium text-main flex items-center gap-2">
                                    <span className="size-1.5 rounded-full bg-green-500" />
                                    {group.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' → ')}
                                </div>
                                <div className="pl-3 space-y-0.5">
                                    {perms.map(p => {
                                        const meta = PERMISSION_CATALOG[p];
                                        return (
                                            <div key={p} className="flex items-center gap-2 text-xs">
                                                <span className="text-green-500">✓</span>
                                                <code className="text-muted font-mono text-[10px]">{p.split('.').slice(2).join('.')}</code>
                                                {meta?.dangerLevel === 'high' && (
                                                    <span className="text-[9px] px-1 rounded bg-red-500/10 text-red-500">dangerous</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {role.permissions.deny.length > 0 && (
                            <>
                                <div className="border-t border-surface my-4" />
                                <div className="text-xs font-medium text-red-500 flex items-center gap-2 mb-2">
                                    <span className="size-1.5 rounded-full bg-red-500" />
                                    Explicitly Denied ({role.permissions.deny.length})
                                </div>
                                <div className="pl-3 space-y-0.5">
                                    {role.permissions.deny.map(p => (
                                        <div key={p} className="flex items-center gap-2 text-xs">
                                            <span className="text-red-500">✗</span>
                                            <code className="text-muted font-mono text-[10px]">{p}</code>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function RoleManagement() {
    const { t } = useLanguage();
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();
    const { hasPermission, isOwner } = useWorkspacePermissions();

    // State
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [saving, setSaving] = useState(false);

    // Drag and drop state
    const [draggingRoleId, setDraggingRoleId] = useState<string | null>(null);
    const [dragOverInfo, setDragOverInfo] = useState<{ roleId: string; position: 'above' | 'below' } | null>(null);

    // Form state
    const [formData, setFormData] = useState<RoleFormData>({
        name: '',
        color: DEFAULT_ROLE_COLORS[0],
        description: '',
        permissions: { allow: [], deny: [] }
    });

    const permissionGroups = useMemo(() => groupPermissionsByModule(), []);
    const canManageRoles = isOwner || hasPermission('tenant.roles.create');
    const canEditRoles = isOwner || hasPermission('tenant.roles.edit');

    const selectedRole = useMemo(() => roles.find(r => r.id === selectedRoleId) || null, [roles, selectedRoleId]);

    // Load roles from Firebase with real-time subscription
    useEffect(() => {
        setLoading(true);

        // System roles are always present (not stored in Firebase)
        const systemRoles: Role[] = [
            {
                id: 'system-owner',
                name: 'Owner',
                position: Number.MAX_SAFE_INTEGER,
                isSystem: true,
                systemKey: 'OWNER',
                color: '#f59e0b',
                description: 'Full access to everything',
                permissions: SYSTEM_ROLE_DEFAULTS.OWNER.permissions,
            },
            {
                id: 'system-member',
                name: 'Member',
                position: 0,
                isSystem: true,
                systemKey: 'MEMBER',
                color: '#3b82f6',
                description: 'Default baseline for all members',
                permissions: SYSTEM_ROLE_DEFAULTS.MEMBER.permissions,
            },
            {
                id: 'system-guest',
                name: 'Guest',
                position: -1,
                isSystem: true,
                systemKey: 'GUEST',
                color: '#78716c',
                description: 'External project collaborators',
                permissions: SYSTEM_ROLE_DEFAULTS.GUEST.permissions,
            },
        ];

        // Subscribe to custom roles from Firebase
        const unsubscribe = subscribeTenantRoles((firestoreRoles: FirestoreRole[]) => {
            const customRoles: Role[] = firestoreRoles.map(fr => ({
                id: fr.id,
                name: fr.name,
                color: fr.color,
                description: fr.description,
                position: fr.position,
                isSystem: fr.isSystem,
                systemKey: fr.systemKey as Role['systemKey'],
                permissions: {
                    allow: fr.permissions.allow as PermissionNode[],
                    deny: fr.permissions.deny as PermissionNode[]
                }
            }));

            // Combine system roles with custom roles
            const allRoles = [...systemRoles, ...customRoles].sort((a, b) => b.position - a.position);
            setRoles(allRoles);
            if (!selectedRoleId) {
                setSelectedRoleId(allRoles[0]?.id || null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Drag and drop handler - reorder roles when dropped
    const handleDrop = useCallback(async (targetRoleId: string) => {
        console.log('=== DROP EVENT ===');
        console.log('draggingRoleId:', draggingRoleId);
        console.log('targetRoleId:', targetRoleId);
        console.log('dragOverInfo:', dragOverInfo);
        console.log('roles:', roles.map(r => `${r.name}(${r.position})`).join(', '));

        if (!draggingRoleId || draggingRoleId === targetRoleId) {
            console.log('Drop cancelled - same role or no dragging');
            setDraggingRoleId(null);
            setDragOverInfo(null);
            return;
        }

        const sorted = [...roles].sort((a, b) => b.position - a.position);
        const draggedRole = sorted.find(r => r.id === draggingRoleId);
        const targetRole = sorted.find(r => r.id === targetRoleId);
        const draggedIndex = sorted.findIndex(r => r.id === draggingRoleId);
        const targetIndex = sorted.findIndex(r => r.id === targetRoleId);

        if (!draggedRole || !targetRole) {
            console.log('Drop cancelled - role not found');
            setDraggingRoleId(null);
            setDragOverInfo(null);
            return;
        }

        // Can't move Owner or Guest (they're always at top and bottom)
        if (draggedRole.systemKey === 'OWNER' || draggedRole.systemKey === 'GUEST') {
            console.log('Drop cancelled - cannot move Owner or Guest');
            setDraggingRoleId(null);
            setDragOverInfo(null);
            return;
        }

        // Calculate new position based on where we're dropping
        // Use larger gaps to avoid collision issues
        const dropAbove = dragOverInfo?.position === 'above';
        let newPosition: number;

        if (dropAbove) {
            // Insert above target
            if (targetIndex === 0) {
                // Going to very top
                newPosition = targetRole.position + 100;
            } else {
                const roleAbove = sorted[targetIndex - 1];
                if (roleAbove.systemKey === 'OWNER') {
                    // Place just below owner with good gap
                    newPosition = targetRole.position + 100;
                } else {
                    // Calculate midpoint, ensure at least 1 gap
                    const gap = roleAbove.position - targetRole.position;
                    newPosition = targetRole.position + Math.max(1, Math.floor(gap / 2));
                }
            }
        } else {
            // Insert below target
            if (targetIndex >= sorted.length - 1) {
                newPosition = targetRole.position - 100;
            } else {
                const roleBelow = sorted[targetIndex + 1];
                if (roleBelow.systemKey === 'GUEST') {
                    // Place between Member (0) and Guest (-1)
                    // Guest position is -1, so we need a negative position above -1
                    // Use a fractional-style approach: targetRole.position - some offset
                    // Member is 0, Guest is -1, so place at -0.5 equivalent
                    // Since we use integers, use a scale: place at position that's between
                    newPosition = Math.max(roleBelow.position + 1, targetRole.position - 100);
                    // Ensure we're above guest
                    if (newPosition <= roleBelow.position) {
                        newPosition = roleBelow.position + 1;
                    }
                } else {
                    const gap = targetRole.position - roleBelow.position;
                    newPosition = targetRole.position - Math.max(1, Math.floor(gap / 2));
                }
            }
        }

        console.log('Position calculation:', {
            targetPosition: targetRole.position,
            newPosition,
            dropAbove
        });

        // Update position - custom roles go to Firebase, system roles update locally
        if (!draggedRole.isSystem) {
            try {
                await updateTenantRole(draggedRole.id, { position: newPosition });
                console.log('Firebase updated successfully');
            } catch (error) {
                console.error('Failed to update role position:', error);
                showError('Failed to reorder role');
            }
        } else {
            // For system roles like Member, update local state only
            console.log('Updating system role position locally');
            setRoles(prev => prev.map(r => {
                if (r.id === draggedRole.id) return { ...r, position: newPosition };
                return r;
            }).sort((a, b) => b.position - a.position));
        }

        // Clear drag state
        setDraggingRoleId(null);
        setDragOverInfo(null);
    }, [draggingRoleId, dragOverInfo, roles, showError]);

    const handleToggleAllow = (permission: PermissionNode) => {
        setFormData(prev => {
            const isAllowed = prev.permissions.allow.includes(permission);
            const newAllow = isAllowed ? prev.permissions.allow.filter(p => p !== permission) : [...prev.permissions.allow, permission];
            const newDeny = isAllowed ? prev.permissions.deny : prev.permissions.deny.filter(p => p !== permission);
            return { ...prev, permissions: { allow: newAllow, deny: newDeny } };
        });
    };

    const handleToggleDeny = (permission: PermissionNode) => {
        setFormData(prev => {
            const isDenied = prev.permissions.deny.includes(permission);
            const newDeny = isDenied ? prev.permissions.deny.filter(p => p !== permission) : [...prev.permissions.deny, permission];
            const newAllow = isDenied ? prev.permissions.allow : prev.permissions.allow.filter(p => p !== permission);
            return { ...prev, permissions: { allow: newAllow, deny: newDeny } };
        });
    };

    const handleOpenCreate = () => {
        setFormData({
            name: '',
            color: DEFAULT_ROLE_COLORS[Math.floor(Math.random() * DEFAULT_ROLE_COLORS.length)],
            description: '',
            permissions: { allow: [...DEFAULT_MEMBER_PERMISSIONS], deny: [] }
        });
        setEditingRole(null);
        setShowCreateModal(true);
    };

    const handleOpenEdit = (role: Role) => {
        setFormData({
            name: role.name,
            color: role.color || DEFAULT_ROLE_COLORS[0],
            description: role.description || '',
            permissions: { allow: [...role.permissions.allow], deny: [...role.permissions.deny] }
        });
        setEditingRole(role);
        setShowCreateModal(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) { showError('Role name is required'); return; }
        setSaving(true);
        try {
            const maxPosition = Math.max(...roles.filter(r => r.systemKey !== 'OWNER').map(r => r.position), 0);

            if (editingRole) {
                // Update existing role
                if (!editingRole.isSystem) {
                    await updateTenantRole(editingRole.id, {
                        name: formData.name.trim(),
                        color: formData.color,
                        description: formData.description,
                        permissions: {
                            allow: formData.permissions.allow,
                            deny: formData.permissions.deny
                        }
                    });
                }
                showSuccess('Role updated successfully');
            } else {
                // Create new role in Firebase
                const newRoleId = await createTenantRole({
                    name: formData.name.trim(),
                    color: formData.color,
                    description: formData.description,
                    position: maxPosition + 10,
                    isSystem: false,
                    permissions: {
                        allow: formData.permissions.allow,
                        deny: formData.permissions.deny
                    }
                });
                setSelectedRoleId(newRoleId);
                showSuccess('Role created successfully');
            }
            setShowCreateModal(false);
        } catch (error: any) {
            showError(error.message || 'Failed to save role');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (role: Role) => {
        if (role.isSystem) {
            showError('Cannot delete system roles');
            return;
        }
        const confirmed = await confirm('Delete Role', `Are you sure you want to delete "${role.name}"?`);
        if (!confirmed) return;
        try {
            await deleteTenantRole(role.id);
            if (selectedRoleId === role.id) {
                setSelectedRoleId(roles.find(r => r.id !== role.id)?.id || null);
            }
            showSuccess('Role deleted successfully');
        } catch (error: any) {
            showError(error.message || 'Failed to delete role');
        }
    };

    const allowedSet = useMemo(() => new Set(formData.permissions.allow), [formData.permissions.allow]);
    const deniedSet = useMemo(() => new Set(formData.permissions.deny), [formData.permissions.deny]);
    const sortedRoles = useMemo(() => [...roles].sort((a, b) => b.position - a.position), [roles]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full size-8 border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 shrink-0">
                <div>
                    <h2 className="text-xl font-display font-bold text-main">Role Hierarchy</h2>
                    <p className="text-muted text-sm">Manage roles and permissions</p>
                </div>
                {canManageRoles && (
                    <Button onClick={handleOpenCreate} size="sm">
                        <span className="material-symbols-outlined text-base mr-1">add</span>
                        New Role
                    </Button>
                )}
            </div>

            {/* 2-Column Layout - takes remaining space */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 min-h-0">
                {/* Left: Role hierarchy list */}
                <div className="lg:col-span-2 space-y-2 overflow-y-auto pr-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-wider mb-3 px-2">
                        <span className="material-symbols-outlined text-xs">arrow_upward</span>
                        <span>Higher Authority</span>
                    </div>

                    {sortedRoles.map((role, index) => (
                        <DraggableRoleItem
                            key={role.id}
                            role={role}
                            rank={index + 1}
                            isSelected={role.id === selectedRoleId}
                            onSelect={() => setSelectedRoleId(role.id)}
                            canReorder={canEditRoles}
                            isDragging={draggingRoleId === role.id}
                            dropPosition={dragOverInfo?.roleId === role.id ? dragOverInfo.position : null}
                            onDragStart={() => setDraggingRoleId(role.id)}
                            onDragEnd={() => {
                                setDraggingRoleId(null);
                                setDragOverInfo(null);
                            }}
                            onDragEnter={(position) => setDragOverInfo({ roleId: role.id, position })}
                            onDragLeave={() => setDragOverInfo(null)}
                            onDrop={() => handleDrop(role.id)}
                        />
                    ))}

                    <div className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-wider mt-3 px-2">
                        <span className="material-symbols-outlined text-xs">arrow_downward</span>
                        <span>Lower Authority</span>
                    </div>
                </div>

                {/* Right: Permission details */}
                <div className="lg:col-span-3 border border-surface rounded-xl bg-surface overflow-hidden">
                    <PermissionDisplayPanel
                        role={selectedRole}
                        onEdit={() => selectedRole && handleOpenEdit(selectedRole)}
                        onDelete={() => selectedRole && handleDelete(selectedRole)}
                        canManage={canEditRoles}
                    />
                </div>
            </div>

            {/* Create/Edit Modal */}
            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title={editingRole ? `Edit: ${editingRole.name}` : 'Create Role'} size="xl">
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Input label="Name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., Moderator" disabled={editingRole?.isSystem && editingRole?.systemKey !== 'MEMBER'} />
                        <div>
                            <label className="block text-sm font-medium text-main mb-1">Color</label>
                            <div className="flex flex-wrap gap-1">
                                {DEFAULT_ROLE_COLORS.map(color => (
                                    <button key={color} type="button" onClick={() => setFormData(prev => ({ ...prev, color }))}
                                        className={`size-5 rounded-full transition-all ${formData.color === color ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'hover:scale-110'}`}
                                        style={{ backgroundColor: color }} />
                                ))}
                            </div>
                        </div>
                    </div>
                    <Input label="Description" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Brief description" />
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-main">Permissions</label>
                            <div className="flex items-center gap-3 text-[10px] text-muted">
                                <span className="flex items-center gap-1"><span className="size-2 rounded bg-green-500" /> Allow</span>
                                <span className="flex items-center gap-1"><span className="size-2 rounded bg-red-500" /> Deny</span>
                            </div>
                        </div>

                        {/* Bulk action buttons */}
                        <div className="flex items-center gap-2 mb-3">
                            <button
                                type="button"
                                onClick={() => {
                                    const allPerms = Array.from(permissionGroups.values()).flat();
                                    setFormData(prev => ({ ...prev, permissions: { allow: allPerms, deny: [] } }));
                                }}
                                disabled={editingRole?.systemKey === 'OWNER' || editingRole?.systemKey === 'GUEST'}
                                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                Allow All
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const allPerms = Array.from(permissionGroups.values()).flat();
                                    setFormData(prev => ({ ...prev, permissions: { allow: [], deny: allPerms } }));
                                }}
                                disabled={editingRole?.systemKey === 'OWNER' || editingRole?.systemKey === 'GUEST'}
                                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-sm">cancel</span>
                                Deny All
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, permissions: { allow: [], deny: [] } }))}
                                disabled={editingRole?.systemKey === 'OWNER' || editingRole?.systemKey === 'GUEST'}
                                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-surface-border text-muted hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-sm">remove_circle_outline</span>
                                Clear All
                            </button>
                            <span className="text-[10px] text-muted ml-auto">
                                {formData.permissions.allow.length} allowed, {formData.permissions.deny.length} denied
                            </span>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                            {Array.from(permissionGroups.entries()).map(([groupName, permissions]) => (
                                <PermissionGroup key={groupName} groupName={groupName} permissions={permissions} allowedPermissions={allowedSet} deniedPermissions={deniedSet}
                                    onToggleAllow={handleToggleAllow} onToggleDeny={handleToggleDeny} disabled={editingRole?.systemKey === 'OWNER' || editingRole?.systemKey === 'GUEST'} />
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-3 border-t border-surface">
                        <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSave} loading={saving}>{editingRole ? 'Save' : 'Create'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default RoleManagement;
