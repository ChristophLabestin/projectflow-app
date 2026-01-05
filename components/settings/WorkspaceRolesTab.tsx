import React, { useState, useMemo, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Tenant, CustomRole, Permission, WorkspaceRole } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Checkbox } from '../ui/Checkbox';
import { useToast, useConfirm } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';
import {
    createCustomRole,
    updateCustomRole,
    deleteCustomRole,
    setDefaultRole,
    reorderCustomRoles,
    PERMISSION_CATEGORIES,
    getEditorPreset,
    getViewerPreset,
    ALL_PERMISSIONS
} from '../../services/rolesService';
import { auth } from '../../services/firebase';

interface WorkspaceRolesTabProps {
    tenant: Partial<Tenant>;
    isOwner: boolean;
    onUpdate?: () => void;
}

const COLOR_PRESETS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#6b7280'
];

// --- Sub-component: Sortable Role Item ---
interface SortableRoleItemProps {
    role: CustomRole;
    isDefault: boolean;
    isLocked: boolean; // If true, user cannot move this role
    t: (key: string) => string;
}

const SortableRoleItem = ({ role, isDefault, isLocked, t }: SortableRoleItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: role.id,
        disabled: isLocked
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`role-item ${isDragging ? 'dragging' : ''}`}
        >
            {/* Drag Handle */}
            <div
                className={`drag-handle ${isLocked ? 'invisible' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
            </div>

            <div
                className="role-color-dot"
                style={{ backgroundColor: role.color }}
            />

            <div className="role-info">
                <div className="role-name">
                    {role.name}
                </div>
                <div className="role-meta">
                    {role.permissions.length} {t('roles.permissionsCount')}
                </div>
            </div>

            {isDefault && (
                <Badge size="sm" variant="success">{t('roles.default')}</Badge>
            )}

            {isLocked && (
                <span className="material-symbols-outlined text-[14px] text-gray-400" title={t('roles.lockedTooltip')}>lock</span>
            )}
        </div>
    );
};

// --- Main Component ---
export const WorkspaceRolesTab: React.FC<WorkspaceRolesTabProps> = ({ tenant, isOwner, onUpdate }) => {
    const { t } = useLanguage();
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();

    // Auth & Permissions
    const currentUser = auth.currentUser;
    // Calculate current user's highest priority (lower number = higher rank)
    // Owner is -1.
    const userPriority = useMemo(() => {
        if (isOwner) return -1;
        // If not owner, look for their membership role
        const member = tenant.members?.find(m => m.uid === currentUser?.uid);
        if (!member) return 9999; // Fallback

        if (member.role === 'Admin') return 0; // Built-in Admin is effectively priority 0 (above all custom roles)
        if (member.role === 'Member') return 9999; // Standard members shouldn't see this page usually

        // Check if role is custom
        const userCustomRole = tenant.customRoles?.find(r => r.id === member.role);
        return userCustomRole ? userCustomRole.position : 9999;
    }, [tenant, isOwner, currentUser]);

    const [activeRoles, setActiveRoles] = useState<CustomRole[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [roleName, setRoleName] = useState('');
    const [roleColor, setRoleColor] = useState('#3b82f6');
    const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Load roles into local state for sorting
    useEffect(() => {
        if (tenant.customRoles) {
            // Sort by position (ascending)
            setActiveRoles([...tenant.customRoles].sort((a, b) => a.position - b.position));
        }
    }, [tenant.customRoles]);

    const selectedRole = useMemo(() => {
        if (!selectedRoleId) return null;
        return activeRoles.find(r => r.id === selectedRoleId) || null;
    }, [selectedRoleId, activeRoles]);

    // Derived: Is the selected role editable by the current user?
    // User can only edit roles BELOW their priority (greater position number)
    const canEditSelected = useMemo(() => {
        if (isOwner) return true; // Owner edits everything
        if (isCreating) return true; // Can always create (will be added to bottom)
        if (!selectedRole) return false;
        return selectedRole.position > userPriority;
    }, [isOwner, isCreating, selectedRole, userPriority]);

    const selectRole = (role: CustomRole) => {
        setSelectedRoleId(role.id);
        setRoleName(role.name);
        setRoleColor(role.color);
        setRolePermissions([...role.permissions]);
        setIsCreating(false);
    };

    const startCreateRole = () => {
        setSelectedRoleId(null);
        setRoleName('');
        setRoleColor('#3b82f6');
        setRolePermissions([]);
        setIsCreating(true);
    };

    const cancelEdit = () => {
        setSelectedRoleId(null);
        setIsCreating(false);
    };

    // --- Drag & Drop Handlers ---
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            const oldIndex = activeRoles.findIndex(r => r.id === active.id);
            const newIndex = activeRoles.findIndex(r => r.id === over?.id);

            // Optimistic Update
            const newOrder = arrayMove(activeRoles, oldIndex, newIndex);
            setActiveRoles(newOrder);

            // Persist
            try {
                // Map only IDs for the service
                await reorderCustomRoles(newOrder.map(r => r.id), activeRoles, tenant.id);
                // onUpdate?.(); // Optional: might reload from server
            } catch (error) {
                console.error("Reorder failed", error);
                showError("Failed to save new order");
                // Revert
                setActiveRoles(tenant.customRoles || []);
            }
        }
    };

    // Filter roles for sidebar (mostly strictly visual, DND might get weird if filtered but acceptable for now)
    const filteredRoles = useMemo(() => {
        return activeRoles.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [activeRoles, searchQuery]);

    // --- Actions ---

    const handleSaveRole = async () => {
        if (!roleName.trim()) {
            showError(t('roles.errors.nameRequired'));
            return;
        }

        setIsSaving(true);
        try {
            if (isCreating) {
                await createCustomRole(roleName.trim(), roleColor, rolePermissions, tenant.id);
                showSuccess(t('roles.toast.created'));
            } else if (selectedRoleId) {
                await updateCustomRole(
                    selectedRoleId,
                    { name: roleName.trim(), color: roleColor, permissions: rolePermissions },
                    activeRoles,
                    tenant.id
                );
                showSuccess(t('roles.toast.updated'));
            }
            cancelEdit();
            onUpdate?.();
        } catch (error: any) {
            console.error('Failed to save role', error);
            showError(error.message || t('roles.errors.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRole = async () => {
        if (!selectedRoleId) return;
        if (!await confirm(t('roles.confirm.deleteTitle'), t('roles.confirm.deleteMessage').replace('{name}', roleName))) return;

        setIsSaving(true);
        try {
            await deleteCustomRole(selectedRoleId, activeRoles, tenant.id);
            showSuccess(t('roles.toast.deleted'));
            cancelEdit();
            onUpdate?.();
        } catch (error: any) {
            showError(error.message || t('roles.errors.deleteFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSetDefault = async () => {
        if (!selectedRoleId) return;
        try {
            const newDefault = tenant.defaultRoleId === selectedRoleId ? null : selectedRoleId;
            await setDefaultRole(newDefault, tenant.id);
            showSuccess(newDefault ? t('roles.toast.setDefault') : t('roles.toast.unsetDefault'));
            onUpdate?.();
        } catch (error: any) {
            showError(error.message || t('roles.errors.setDefaultFailed'));
        }
    };

    const togglePermission = (key: Permission) => {
        setRolePermissions(prev =>
            prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
        );
    };

    // --- Render ---

    // Security check: if user can't see this tab at all
    if (!isOwner && userPriority >= 9999 && !activeRoles.some(r => r.permissions.includes('role.manage'))) {
        return (
            <div className="text-center py-12 text-[var(--color-text-muted)]">
                <span className="material-symbols-outlined text-4xl mb-3 opacity-30 block">lock</span>
                <p>{t('roles.noPermission')}</p>
            </div>
        );
    }

    return (
        <div className="roles-layout">
            {/* --- Left Sidebar: Role List --- */}
            <div className="roles-sidebar">
                <div className="roles-sidebar-header">
                    <div className="header-content">
                        <h2>{t('roles.force_list_title', 'Roles')}</h2>
                        <button
                            onClick={startCreateRole}
                            className="add-btn"
                            title={t('roles.form.createTitle')}
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                    </div>
                    <div className="divider" />
                </div>

                <div className="roles-list">
                    {/* Built-in Owner (Always Top, Locked) */}
                    <div className="role-item" style={{ marginBottom: '8px', cursor: 'default' }}>
                        <div className="role-color-dot" style={{ backgroundColor: '#f59e0b' }} />
                        <div className="role-info">
                            <div className="role-name">{t('roles.owner')}</div>
                            <div className="role-meta">{t('roles.adminAccess')}</div>
                        </div>
                        <span className="material-symbols-outlined text-[16px] text-amber-500 opacity-60">lock</span>
                    </div>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={filteredRoles.map(r => r.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {filteredRoles.map((role) => (
                                <SortableRoleItem
                                    key={role.id}
                                    role={role}
                                    isDefault={role.isDefault || false}
                                    isLocked={role.isProtected || (role.priority <= userPriority && role.id !== currentUser?.uid)}
                                    t={t}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>

                    {isCreating && (
                        <div className="p-3 bg-[var(--color-primary)]/10 border border-[var(--color-primary)] rounded-lg">
                            <span className="text-sm font-semibold text-[var(--color-primary)]">{t('roles.newRolePlaceholder')}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* --- Right Panel: Editor --- */}
            <div className="role-editor">
                {(selectedRole || isCreating) ? (
                    <div className="flex flex-col h-full">
                        {/* Header */}
                        <div className="role-editor-header">
                            <div className="header-top">
                                <h2>
                                    {isCreating ? t('roles.form.createTitle') : t('roles.form.editTitle')}
                                </h2>
                                {!canEditSelected && !isCreating && (
                                    <Badge variant="warning" className="flex items-center gap-2 font-black px-3.5 py-1 rounded-full border border-amber-500/20 text-[10px]">
                                        <span className="material-symbols-outlined text-[14px]">lock_open</span>
                                        {t('roles.protected')}
                                    </Badge>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-[11px] font-black text-[var(--color-text-main)] uppercase tracking-[0.25em] opacity-60 mb-2 block px-1">{t('roles.form.name')}</label>
                                        <Input
                                            value={roleName}
                                            onChange={(e) => setRoleName(e.target.value)}
                                            placeholder={t('roles.form.namePlaceholder')}
                                            disabled={!canEditSelected}
                                            className="h-11 font-black text-[13px] bg-[var(--color-surface-bg)]/50 border-none rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-[var(--color-text-main)] uppercase tracking-[0.25em] opacity-60 block px-1">{t('roles.form.color')}</label>
                                        <div className="color-picker-grid">
                                            {COLOR_PRESETS.slice(0, 12).map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => canEditSelected && setRoleColor(color)}
                                                    disabled={!canEditSelected}
                                                    className={`${roleColor === color ? 'active' : 'opacity-80 hover:opacity-100'}`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Permissions */}
                        <div className="permissions-container">
                            <div className="max-w-3xl mx-auto space-y-8">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-[var(--color-text-main)]">{t('roles.form.permissions')}</h3>
                                    {canEditSelected && (
                                        <Button size="sm" variant="ghost" onClick={() => setRolePermissions([])}>{t('roles.form.clearAll')}</Button>
                                    )}
                                </div>

                                {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => (
                                    <div key={key} className="permission-card">
                                        <header className="card-header">
                                            <div className="icon-box">
                                                <span className="material-symbols-outlined text-[20px]">
                                                    {key === 'project' ? 'folder' :
                                                        key === 'tasks' ? 'checklist' :
                                                            key === 'issues' ? 'bug_report' :
                                                                key === 'ideas' ? 'lightbulb' :
                                                                    key === 'groups' ? 'groups' : 'shield_person'}
                                                </span>
                                            </div>
                                            <h4>{t(`roles.categories.${key}`)}</h4>
                                        </header>

                                        <div className="permission-grid">
                                            {category.permissions.map(perm => (
                                                <label
                                                    key={perm.key}
                                                    className={`permission-item ${rolePermissions.includes(perm.key) ? 'active' : ''} ${!canEditSelected ? 'disabled' : ''}`}
                                                >
                                                    <span>{t(`roles.permissions.${perm.key}`)}</span>
                                                    <div className="size-5 flex items-center justify-center">
                                                        <Checkbox
                                                            checked={rolePermissions.includes(perm.key)}
                                                            onChange={() => togglePermission(perm.key)}
                                                            disabled={!canEditSelected}
                                                        />
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        {canEditSelected && (
                            <div className="p-5 pb-8 bg-transparent flex items-center justify-between">
                                <div>
                                    {!isCreating && selectedRoleId && (
                                        <Button
                                            variant="ghost"
                                            className="h-11 text-rose-600 font-black hover:bg-rose-500/10 px-5 rounded-xl text-[13px]"
                                            onClick={handleDeleteRole}
                                        >
                                            {t('roles.form.delete')}
                                        </Button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" className="h-11 font-black px-6 rounded-xl text-[13px]" onClick={cancelEdit}>{t('roles.form.cancel')}</Button>
                                    <Button
                                        onClick={handleSaveRole}
                                        loading={isSaving}
                                        className="h-11 px-8 rounded-xl font-black shadow-lg shadow-[var(--color-primary)]/20 text-[13px]"
                                    >
                                        {isCreating ? t('roles.form.create') : t('roles.form.save')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="roles-empty-state">
                        <span className="material-symbols-outlined icon">shield_person</span>
                        <p>{t('roles.emptyState.select')}</p>
                        <p className="subtext">{t('roles.emptyState.drag')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

