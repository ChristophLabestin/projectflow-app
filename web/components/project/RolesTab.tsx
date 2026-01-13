import React, { useState, useMemo, useEffect } from 'react';
import { Project, CustomRole, Permission } from '../../types';
import { Button } from '../common/Button/Button';
import { TextInput } from '../common/Input/TextInput';
import { Card } from '../common/Card/Card';
import { Badge } from '../common/Badge/Badge';
import { Checkbox } from '../common/Checkbox/Checkbox';
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
import './roles-tab.scss';

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
            <div className="roles-tab__locked">
                <span className="material-symbols-outlined roles-tab__locked-icon">lock</span>
                <p>{t('roles.noPermission')}</p>
            </div>
        );
    }

    return (
        <div className="roles-tab">
            {/* Roles List */}
            <div className="roles-tab__list">
                <div className="roles-tab__list-header">
                    <h3 className="roles-tab__list-title">{t('roles.title')}</h3>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={startCreateRole}
                        icon={<span className="material-symbols-outlined">add</span>}
                    >
                        {t('roles.actions.create')}
                    </Button>
                </div>

                {/* Owner Role (always first, not editable) */}
                <div className="roles-tab__owner">
                    <div className="roles-tab__owner-dot" />
                    <div className="roles-tab__owner-body">
                        <div className="roles-tab__owner-title">{t('roles.owner')}</div>
                        <div className="roles-tab__owner-subtitle">{t('roles.ownerDescription')}</div>
                    </div>
                    <span className="material-symbols-outlined roles-tab__owner-icon">verified</span>
                </div>

                {/* Custom Roles */}
                {customRoles.map(role => {
                    const isSelected = selectedRoleId === role.id;
                    const isDefault = project.defaultRoleId === role.id;

                    return (
                        <button
                            key={role.id}
                            type="button"
                            onClick={() => selectRole(role)}
                            className={`roles-tab__role ${isSelected ? 'roles-tab__role--active' : ''}`}
                        >
                            <div
                                className="roles-tab__role-dot"
                                style={{ backgroundColor: role.color }}
                            />
                            <div className="roles-tab__role-body">
                                <div className="roles-tab__role-title">{role.name}</div>
                                <div className="roles-tab__role-meta">
                                    {role.permissions.length} {t('roles.permissionsCount')}
                                </div>
                            </div>
                            {isDefault && (
                                <Badge variant="success" className="roles-tab__default-badge">
                                    {t('roles.default')}
                                </Badge>
                            )}
                        </button>
                    );
                })}

                {customRoles.length === 0 && !isCreating && (
                    <div className="roles-tab__empty">
                        <span className="material-symbols-outlined roles-tab__empty-icon">shield_person</span>
                        <p>{t('roles.empty')}</p>
                    </div>
                )}
            </div>

            {/* Role Editor */}
            <div className="roles-tab__editor">
                {(selectedRole || isCreating) ? (
                    <Card className="roles-tab__card">
                        <div className="roles-tab__editor-header">
                            <div>
                                <h3 className="roles-tab__editor-title">
                                    {isCreating ? t('roles.createTitle') : t('roles.editTitle')}
                                </h3>
                                <p className="roles-tab__editor-subtitle">
                                    {isCreating ? t('roles.createSubtitle') : t('roles.editSubtitle')}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="roles-tab__close"
                                onClick={cancelEdit}
                                aria-label={t('common.cancel')}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </Button>
                        </div>

                        {/* Name & Color */}
                        <div className="roles-tab__form">
                            <TextInput
                                label={t('roles.fields.name')}
                                value={roleName}
                                onChange={(e) => setRoleName(e.target.value)}
                                placeholder={t('roles.fields.namePlaceholder')}
                            />

                            <div className="roles-tab__color">
                                <label className="roles-tab__color-label">{t('roles.fields.color')}</label>
                                <div className="roles-tab__color-grid">
                                    {COLOR_PRESETS.map(preset => (
                                        <button
                                            key={preset.hex}
                                            type="button"
                                            onClick={() => setRoleColor(preset.hex)}
                                            className={`roles-tab__color-swatch ${roleColor === preset.hex ? 'roles-tab__color-swatch--active' : ''}`}
                                            style={{ backgroundColor: preset.hex }}
                                            title={preset.name}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Permission Presets */}
                        <div className="roles-tab__presets">
                            <label className="roles-tab__presets-label">{t('roles.fields.permissions')}</label>
                            <div className="roles-tab__presets-actions">
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

                        {/* Permission Categories */}
                        <div className="roles-tab__permissions">
                            {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => (
                                <div key={key} className="roles-tab__permission-group">
                                    <div className="roles-tab__permission-title">
                                        <span className="material-symbols-outlined">
                                            {key === 'project' ? 'folder' :
                                                key === 'tasks' ? 'checklist' :
                                                    key === 'issues' ? 'bug_report' :
                                                        key === 'ideas' ? 'lightbulb' :
                                                            key === 'groups' ? 'groups' : 'shield_person'}
                                        </span>
                                        {category.label}
                                    </div>
                                    <div className="roles-tab__permission-grid">
                                        {category.permissions.map(perm => {
                                            const isActive = rolePermissions.includes(perm.key);
                                            return (
                                                <Checkbox
                                                    key={perm.key}
                                                    checked={isActive}
                                                    onChange={() => togglePermission(perm.key)}
                                                    label={perm.label}
                                                    className={`roles-tab__permission-item ${isActive ? 'roles-tab__permission-item--active' : ''}`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="roles-tab__actions">
                            <div className="roles-tab__actions-left">
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
                                            className="roles-tab__danger"
                                        >
                                            {t('roles.actions.delete')}
                                        </Button>
                                    </>
                                )}
                            </div>
                            <div className="roles-tab__actions-right">
                                <Button variant="secondary" onClick={cancelEdit}>
                                    {t('common.cancel')}
                                </Button>
                                <Button onClick={handleSaveRole} isLoading={isSaving}>
                                    {isCreating ? t('roles.actions.create') : t('common.save')}
                                </Button>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="roles-tab__placeholder">
                        <span className="material-symbols-outlined roles-tab__placeholder-icon">shield_person</span>
                        <p className="roles-tab__placeholder-title">{t('roles.selectOrCreate')}</p>
                        <p className="roles-tab__placeholder-subtitle">{t('roles.selectOrCreateHint')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
