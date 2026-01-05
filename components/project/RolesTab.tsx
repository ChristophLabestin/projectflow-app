import React, { useState, useMemo, useEffect } from 'react';
import { Project, CustomRole, Permission } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Checkbox } from '../ui/Checkbox';
import { useToast, useConfirm } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';
import {
    createCustomRole,
    updateCustomRole,
    deleteCustomRole,
    setDefaultRole,
    PERMISSION_CATEGORIES,
    getEditorPreset,
    getViewerPreset,
    ALL_PERMISSIONS,
    getWorkspaceRoles
} from '../../services/rolesService';

interface RolesTabProps {
    project: Project;
    isOwner: boolean;
    onProjectUpdate?: () => void;
    customRoles?: CustomRole[];
}

type ColorPreset = { name: string; hex: string };

const COLOR_PRESETS: ColorPreset[] = [
    { name: 'Red', hex: '#ef4444' },
    { name: 'Orange', hex: '#f97316' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Yellow', hex: '#eab308' },
    { name: 'Lime', hex: '#84cc16' },
    { name: 'Green', hex: '#22c55e' },
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Teal', hex: '#14b8a6' },
    { name: 'Cyan', hex: '#06b6d4' },
    { name: 'Sky', hex: '#0ea5e9' },
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Indigo', hex: '#6366f1' },
    { name: 'Violet', hex: '#8b5cf6' },
    { name: 'Purple', hex: '#a855f7' },
    { name: 'Fuchsia', hex: '#d946ef' },
    { name: 'Pink', hex: '#ec4899' },
    { name: 'Rose', hex: '#f43f5e' },
    { name: 'Gray', hex: '#6b7280' },
];

export const RolesTab: React.FC<RolesTabProps> = ({ project, isOwner, onProjectUpdate, customRoles: passedRoles }) => {
    const { t } = useLanguage();
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();

    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form state for editing/creating
    const [roleName, setRoleName] = useState('');
    const [roleColor, setRoleColor] = useState('#3b82f6');
    const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
    const [loading, setLoading] = useState(true);

    const loadRoles = async () => {
        setLoading(true);
        try {
            const roles = await getWorkspaceRoles(project.tenantId);
            setCustomRoles(roles.sort((a, b) => a.position - b.position));
        } catch (e) {
            console.error('Failed to load roles', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (passedRoles && passedRoles.length > 0) {
            setCustomRoles([...passedRoles].sort((a, b) => a.position - b.position));
            setLoading(false);
        } else {
            loadRoles();
        }
    }, [project.tenantId, passedRoles]);

    const selectedRole = useMemo(() => {
        if (!selectedRoleId) return null;
        return customRoles.find(r => r.id === selectedRoleId) || null;
    }, [selectedRoleId, customRoles]);

    // Load role data into form when selected
    const selectRole = (role: CustomRole) => {
        setSelectedRoleId(role.id);
        setRoleName(role.name);
        setRoleColor(role.color);
        setRolePermissions([...role.permissions]);
        setIsCreating(false);
    };

    // Start creating a new role
    const startCreateRole = () => {
        setSelectedRoleId(null);
        setRoleName('');
        setRoleColor('#3b82f6');
        setRolePermissions([]);
        setIsCreating(true);
    };

    // Cancel editing/creating
    const cancelEdit = () => {
        setSelectedRoleId(null);
        setIsCreating(false);
        setRoleName('');
        setRoleColor('#3b82f6');
        setRolePermissions([]);
    };

    // Toggle a permission
    const togglePermission = (permission: Permission) => {
        if (rolePermissions.includes(permission)) {
            setRolePermissions(rolePermissions.filter(p => p !== permission));
        } else {
            setRolePermissions([...rolePermissions, permission]);
        }
    };

    // Apply preset permissions
    const applyPreset = (preset: 'editor' | 'viewer' | 'all' | 'none') => {
        switch (preset) {
            case 'editor':
                setRolePermissions(getEditorPreset());
                break;
            case 'viewer':
                setRolePermissions(getViewerPreset());
                break;
            case 'all':
                setRolePermissions([...ALL_PERMISSIONS]);
                break;
            case 'none':
                setRolePermissions([]);
                break;
        }
    };

    // Save role (create or update)
    const handleSaveRole = async () => {
        if (!roleName.trim()) {
            showError(t('roles.errors.nameRequired'));
            return;
        }

        setIsSaving(true);
        try {
            if (isCreating) {
                await createCustomRole(roleName.trim(), roleColor, rolePermissions, project.tenantId);
                showSuccess(t('roles.toast.created'));
            } else if (selectedRoleId) {
                await updateCustomRole(
                    selectedRoleId,
                    { name: roleName.trim(), color: roleColor, permissions: rolePermissions },
                    customRoles,
                    project.tenantId
                );
                showSuccess(t('roles.toast.updated'));
            }
            cancelEdit();
            onProjectUpdate?.();
        } catch (error: any) {
            console.error('Failed to save role', error);
            showError(error.message || t('roles.errors.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    // Delete role
    const handleDeleteRole = async () => {
        if (!selectedRoleId) return;

        // Check if any members have this role
        const membersWithRole = project.members?.filter(m =>
            typeof m !== 'string' && m.role === selectedRoleId
        ) || [];

        if (membersWithRole.length > 0) {
            showError(t('roles.errors.hasMembers').replace('{count}', String(membersWithRole.length)));
            return;
        }

        const confirmed = await confirm(
            t('roles.confirm.deleteTitle'),
            t('roles.confirm.deleteMessage').replace('{name}', roleName)
        );
        if (!confirmed) return;

        setIsSaving(true);
        try {
            await deleteCustomRole(selectedRoleId, customRoles, project.tenantId);
            showSuccess(t('roles.toast.deleted'));
            cancelEdit();
            onProjectUpdate?.();
        } catch (error: any) {
            console.error('Failed to delete role', error);
            showError(error.message || t('roles.errors.deleteFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    // Set as default role
    const handleSetDefault = async (roleId: string) => {
        try {
            const newDefault = project.defaultRoleId === roleId ? null : roleId;
            await setDefaultRole(newDefault, project.tenantId);
            showSuccess(newDefault ? t('roles.toast.setDefault') : t('roles.toast.unsetDefault'));
            onProjectUpdate?.();
        } catch (error: any) {
            showError(error.message || t('roles.errors.setDefaultFailed'));
        }
    };

    if (!isOwner) {
        return (
            <div className="text-center py-12 text-[var(--color-text-muted)]">
                <span className="material-symbols-outlined text-4xl mb-3 opacity-30 block">lock</span>
                <p>{t('roles.noPermission')}</p>
            </div>
        );
    }

    return (
        <div className="flex gap-6 min-h-[400px] animate-in fade-in duration-300">
            {/* Roles List */}
            <div className="w-64 flex-shrink-0 space-y-3">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[var(--color-text-main)]">{t('roles.title')}</h3>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={startCreateRole}
                        icon={<span className="material-symbols-outlined text-[16px]">add</span>}
                    >
                        {t('roles.actions.create')}
                    </Button>
                </div>

                {/* Owner Role (always first, not editable) */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div
                        className="w-3 h-3 rounded-full ring-2 ring-white dark:ring-black/20"
                        style={{ backgroundColor: '#f59e0b' }}
                    />
                    <div className="flex-1">
                        <div className="font-semibold text-sm text-amber-900 dark:text-amber-100">{t('roles.owner')}</div>
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">{t('roles.ownerDescription')}</div>
                    </div>
                    <span className="material-symbols-outlined text-amber-500 text-[18px]">verified</span>
                </div>

                {/* Custom Roles */}
                {customRoles.map(role => {
                    const isSelected = selectedRoleId === role.id;
                    const isDefault = project.defaultRoleId === role.id;

                    return (
                        <button
                            key={role.id}
                            onClick={() => selectRole(role)}
                            className={`
                                w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                                ${isSelected
                                    ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
                                    : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] hover:border-[var(--color-primary)]/50'
                                }
                            `}
                        >
                            <div
                                className="w-3 h-3 rounded-full ring-2 ring-white dark:ring-black/20 shrink-0"
                                style={{ backgroundColor: role.color }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-[var(--color-text-main)] truncate">
                                    {role.name}
                                </div>
                                <div className="text-[10px] text-[var(--color-text-muted)]">
                                    {role.permissions.length} {t('roles.permissionsCount')}
                                </div>
                            </div>
                            {isDefault && (
                                <Badge size="sm" variant="success">{t('roles.default')}</Badge>
                            )}
                        </button>
                    );
                })}

                {customRoles.length === 0 && !isCreating && (
                    <div className="text-center py-6 text-[var(--color-text-muted)] text-sm">
                        <span className="material-symbols-outlined text-2xl mb-2 opacity-30 block">shield_person</span>
                        {t('roles.empty')}
                    </div>
                )}
            </div>

            {/* Role Editor */}
            <div className="flex-1">
                {(selectedRole || isCreating) ? (
                    <Card className="h-full">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h3 className="font-bold text-lg text-[var(--color-text-main)]">
                                    {isCreating ? t('roles.createTitle') : t('roles.editTitle')}
                                </h3>
                                <p className="text-sm text-[var(--color-text-muted)]">
                                    {isCreating ? t('roles.createSubtitle') : t('roles.editSubtitle')}
                                </p>
                            </div>
                            <button
                                onClick={cancelEdit}
                                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Name & Color */}
                        <div className="space-y-4 mb-6">
                            <Input
                                label={t('roles.fields.name')}
                                value={roleName}
                                onChange={(e) => setRoleName(e.target.value)}
                                placeholder={t('roles.fields.namePlaceholder')}
                            />

                            <div>
                                <label className="text-sm font-medium text-[var(--color-text-main)] mb-2 block">
                                    {t('roles.fields.color')}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {COLOR_PRESETS.map(preset => (
                                        <button
                                            key={preset.hex}
                                            onClick={() => setRoleColor(preset.hex)}
                                            className={`
                                                w-7 h-7 rounded-lg transition-all
                                                ${roleColor === preset.hex
                                                    ? 'ring-2 ring-offset-2 ring-[var(--color-primary)] scale-110'
                                                    : 'hover:scale-105'
                                                }
                                            `}
                                            style={{ backgroundColor: preset.hex }}
                                            title={preset.name}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Permission Presets */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-[var(--color-text-main)]">
                                    {t('roles.fields.permissions')}
                                </label>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => applyPreset('editor')}>
                                        {t('roles.presets.editor')}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => applyPreset('viewer')}>
                                        {t('roles.presets.viewer')}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => applyPreset('all')}>
                                        {t('roles.presets.all')}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => applyPreset('none')}>
                                        {t('roles.presets.none')}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Permission Categories */}
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                            {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => (
                                <div key={key} className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                                        <span className="material-symbols-outlined text-[14px]">
                                            {key === 'project' ? 'folder' :
                                                key === 'tasks' ? 'checklist' :
                                                    key === 'issues' ? 'bug_report' :
                                                        key === 'ideas' ? 'lightbulb' :
                                                            key === 'groups' ? 'groups' : 'shield_person'}
                                        </span>
                                        {category.label}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {category.permissions.map(perm => (
                                            <label
                                                key={perm.key}
                                                className={`
                                                    flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
                                                    ${rolePermissions.includes(perm.key)
                                                        ? 'bg-[var(--color-primary)]/10'
                                                        : 'bg-[var(--color-surface-hover)]/50 hover:bg-[var(--color-surface-hover)]'
                                                    }
                                                `}
                                            >
                                                <Checkbox
                                                    checked={rolePermissions.includes(perm.key)}
                                                    onChange={() => togglePermission(perm.key)}
                                                />
                                                <span className="text-sm text-[var(--color-text-main)]">
                                                    {perm.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-surface-border)]">
                            <div className="flex gap-2">
                                {!isCreating && selectedRoleId && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleSetDefault(selectedRoleId)}
                                        >
                                            {project.defaultRoleId === selectedRoleId
                                                ? t('roles.actions.unsetDefault')
                                                : t('roles.actions.setDefault')
                                            }
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleDeleteRole}
                                            className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                        >
                                            {t('roles.actions.delete')}
                                        </Button>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={cancelEdit}>
                                    {t('common.cancel')}
                                </Button>
                                <Button onClick={handleSaveRole} loading={isSaving}>
                                    {isCreating ? t('roles.actions.create') : t('common.save')}
                                </Button>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="h-full flex items-center justify-center text-center text-[var(--color-text-muted)]">
                        <div>
                            <span className="material-symbols-outlined text-5xl mb-3 opacity-20 block">shield_person</span>
                            <p className="font-medium">{t('roles.selectOrCreate')}</p>
                            <p className="text-sm mt-1">{t('roles.selectOrCreateHint')}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
