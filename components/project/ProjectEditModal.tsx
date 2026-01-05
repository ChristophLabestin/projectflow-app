import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Badge } from '../ui/Badge';
import { Project, WorkspaceGroup, CustomRole } from '../../types';
import { MediaLibrary } from '../MediaLibrary/MediaLibraryModal';

import { ProjectTeamManager } from './ProjectTeamManager';
import { useProjectPermissions } from '../../hooks/useProjectPermissions';
import { useWorkspacePermissions } from '../../hooks/useWorkspacePermissions';
import { getWorkspaceGroups } from '../../services/dataService';
import { useLanguage } from '../../context/LanguageContext';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import { RolesTab } from './RolesTab';
import { getWorkspaceRoles } from '../../services/rolesService';

import { auth } from '../../services/firebase';
import { getUserProfile, linkWithGithub, updateUserData, getUserProjectNavPrefs, setUserProjectNavPrefs, ProjectNavPrefs } from '../../services/dataService';
import { fetchUserRepositories, GithubRepo } from '../../services/githubService';

interface ProjectEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onSave: (updatedFields: Partial<Project>) => Promise<void>;
    initialTab?: Tab;
}

export type Tab = 'general' | 'team' | 'roles' | 'appearance' | 'modules' | 'navigation' | 'integrations' | 'resources';

export const ProjectEditModal: React.FC<ProjectEditModalProps> = ({
    isOpen,
    onClose,
    project,
    onSave,
    initialTab = 'general'
}) => {
    const { t } = useLanguage();
    const { hasAccess: isSocialAllowed } = useModuleAccess('social');
    const { hasAccess: isMarketingAllowed } = useModuleAccess('marketing');
    const { hasAccess: isAccountingAllowed } = useModuleAccess('accounting');
    const { hasAccess: isSprintsAllowed } = useModuleAccess('sprints');
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [title, setTitle] = useState(project.title);
    const [description, setDescription] = useState(project.description);
    const [status, setStatus] = useState(project.status);
    const [priority, setPriority] = useState(project.priority);
    const [projectState, setProjectState] = useState(project.projectState || 'not specified');
    const [coverImage, setCoverImage] = useState(project.coverImage);
    const [squareIcon, setSquareIcon] = useState(project.squareIcon);
    const [modules, setModules] = useState(project.modules || []);
    const [githubRepo, setGithubRepo] = useState(project.githubRepo || '');
    const [githubIssueSync, setGithubIssueSync] = useState(project.githubIssueSync || false);
    const [links, setLinks] = useState(project.links || []);
    const [externalResources, setExternalResources] = useState(project.externalResources || []);
    const [visibilityGroupIds, setVisibilityGroupIds] = useState<string[]>(project.visibilityGroupIds || (project.visibilityGroupId ? [project.visibilityGroupId] : []));
    const [isPrivate, setIsPrivate] = useState(project.isPrivate || false);
    const [workspaceGroups, setWorkspaceGroups] = useState<WorkspaceGroup[]>([]);
    const [customRoles, setCustomRoles] = useState<import('../../types').CustomRole[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const { can } = useProjectPermissions(project, customRoles);

    // Permission check for visibility settings
    const { isOwner, role: workspaceRole } = useWorkspacePermissions();
    const canChangeVisibility = isOwner && (workspaceRole === 'Owner' || workspaceRole === 'Admin' || workspaceRole === 'Member');

    // GitHub State
    const [githubToken, setGithubToken] = useState<string | null>(null);
    const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
    const [loadingGithub, setLoadingGithub] = useState(false);
    const [connectingGithub, setConnectingGithub] = useState(false);

    // Media Library State
    const [showMediaLibrary, setShowMediaLibrary] = useState(false);
    const [mediaTarget, setMediaTarget] = useState<'cover' | 'icon' | null>(null);

    // Navigation Preferences State (user-specific)
    const [navOrder, setNavOrder] = useState<string[]>([]);
    const [navHidden, setNavHidden] = useState<string[]>([]);
    const [draggedItem, setDraggedItem] = useState<string | null>(null);

    // Module Access Checks (Must be at top level)
    // Default nav items
    const defaultNavItems = [
        { id: 'overview', icon: 'grid_view', label: t('nav.overview'), canHide: false },
        { id: 'tasks', icon: 'checklist', label: t('nav.tasks'), moduleKey: 'tasks' },
        { id: 'sprints', icon: 'directions_run', label: t('nav.sprints'), moduleKey: 'sprints' },
        { id: 'issues', icon: 'medication', label: t('nav.issues'), moduleKey: 'issues' },
        { id: 'ideas', icon: 'emoji_objects', label: t('nav.flows'), moduleKey: 'ideas' },
        { id: 'milestones', icon: 'outlined_flag', label: t('nav.milestones'), moduleKey: 'milestones' },
        { id: 'social', icon: 'campaign', label: t('nav.social'), moduleKey: 'social' },
        { id: 'marketing', icon: 'ads_click', label: t('nav.marketing'), moduleKey: 'marketing' },
        { id: 'activity', icon: 'history', label: t('nav.activity'), moduleKey: 'activity' },
    ];

    // Reset state when modal opens & Load GitHub & Nav Prefs & Roles
    useEffect(() => {
        if (isOpen) {
            setTitle(project.title);
            setDescription(project.description);
            setStatus(project.status);
            setPriority(project.priority);
            setProjectState(project.projectState || 'not specified');
            setCoverImage(project.coverImage);
            setSquareIcon(project.squareIcon);
            setModules(project.modules || []);
            setGithubRepo(project.githubRepo || '');
            setGithubIssueSync(project.githubIssueSync || false);
            setLinks(project.links || []);
            setExternalResources(project.externalResources || []);
            setVisibilityGroupIds(project.visibilityGroupIds || (project.visibilityGroupId ? [project.visibilityGroupId] : []));
            setIsPrivate(project.isPrivate || false);
            setActiveTab(initialTab);

            // Load GitHub Data
            const loadGithubData = async () => {
                const user = auth.currentUser;
                if (user) {
                    const profile = await getUserProfile(user.uid);
                    if (profile?.githubToken) {
                        setGithubToken(profile.githubToken);
                        setLoadingGithub(true);
                        try {
                            const repos = await fetchUserRepositories(profile.githubToken);
                            setGithubRepos(repos);
                        } catch (e) {
                            console.error('Failed to fetch repos', e);
                        } finally {
                            setLoadingGithub(false);
                        }
                    }
                }
            };
            loadGithubData();

            // Load Nav Prefs
            const loadNavPrefs = async () => {
                const user = auth.currentUser;
                if (user && project.id) {
                    const prefs = await getUserProjectNavPrefs(user.uid, project.id, project.tenantId);
                    if (prefs) {
                        // Merge any new nav items that weren't in the stored order
                        const allIds = defaultNavItems.map(n => n.id);
                        const storedOrder = prefs.order || [];
                        const missingIds = allIds.filter(id => !storedOrder.includes(id));
                        // Add missing items at the end while preserving user's custom order
                        const mergedOrder = [...storedOrder, ...missingIds].filter(id => allIds.includes(id));
                        setNavOrder(mergedOrder);
                        setNavHidden(prefs.hidden || []);
                    } else {
                        // Default order
                        setNavOrder(defaultNavItems.map(n => n.id));
                        setNavHidden([]);
                    }
                }
            };
            loadNavPrefs();
            loadRoles();
        }
    }, [isOpen]); // Only reset when modal opens, avoid resetting on background project updates

    const loadRoles = async () => {
        if (!project.tenantId) return;
        setLoadingRoles(true);
        try {
            const roles = await getWorkspaceRoles(project.tenantId);
            setCustomRoles(roles);
        } catch (e) {
            console.error('Failed to load roles in edit modal', e);
        } finally {
            setLoadingRoles(false);
        }
    };

    const handleConnectGithub = async () => {
        const user = auth.currentUser;
        if (!user) return;
        setConnectingGithub(true);
        try {
            const token = await linkWithGithub();
            await updateUserData(user.uid, { githubToken: token });
            setGithubToken(token);
            const repos = await fetchUserRepositories(token);
            setGithubRepos(repos);
        } catch (e: any) {
            console.error('Failed to link GitHub', e);
        } finally {
            setConnectingGithub(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save project settings
            await onSave({
                title,
                description,
                status,
                priority,
                projectState,
                coverImage,
                squareIcon,
                modules,
                githubRepo,
                githubIssueSync,
                links,
                externalResources,
                isPrivate,
                visibilityGroupIds: visibilityGroupIds, // Pass the array directly (including empty array for "Everyone")
                visibilityGroupId: visibilityGroupIds && visibilityGroupIds.length > 0 ? visibilityGroupIds[0] : null // Maintain backward compat for now
            });

            // Save user's nav preferences (user-specific, not project-wide)
            const user = auth.currentUser;
            if (user && project.id) {
                await setUserProjectNavPrefs(user.uid, project.id, {
                    order: navOrder,
                    hidden: navHidden
                }, project.tenantId);
            }

            onClose();
        } catch (error) {
            console.error("Failed to save project settings:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Check if current user is project owner (for showing Roles tab)
    const isProjectOwner = auth.currentUser?.uid === project.ownerId;

    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'general', label: t('projectSettings.tabs.general'), icon: 'settings' },
        { id: 'team', label: t('projectSettings.tabs.team'), icon: 'group' },
        ...(isProjectOwner ? [{ id: 'roles' as Tab, label: t('projectSettings.tabs.roles', 'Roles'), icon: 'shield_person' }] : []),
        { id: 'appearance', label: t('projectSettings.tabs.appearance'), icon: 'palette' },
        { id: 'modules', label: t('projectSettings.tabs.modules'), icon: 'extension' },
        { id: 'navigation', label: t('projectSettings.tabs.navigation'), icon: 'menu' },
        { id: 'integrations', label: t('projectSettings.tabs.integrations'), icon: 'integration_instructions' },
        { id: 'resources', label: t('projectSettings.tabs.resources'), icon: 'link' },
    ];

    const moduleLabels: Record<string, string> = {
        tasks: t('nav.tasks'),
        milestones: t('nav.milestones'),
        issues: t('nav.issues'),
        ideas: t('nav.flows'),

        activity: t('nav.activity'),
        social: t('nav.social'),
        marketing: t('nav.marketing'),
        accounting: t('nav.accounting') || 'Accounting',
        sprints: t('nav.sprints') || 'Sprints'
    };

    const projectStatusLabels: Record<string, string> = {
        Active: t('project.status.active'),
        Planning: t('project.status.planning'),
        'On Hold': t('project.status.onHold'),
        Completed: t('project.status.completed'),
        Brainstorming: t('project.status.brainstorming'),
        Review: t('project.status.review')
    };

    const projectStateLabels: Record<string, string> = {
        'not specified': t('projectSettings.state.notSpecified'),
        'pre-release': t('projectSettings.state.preRelease'),
        released: t('projectSettings.state.released')
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="space-y-4">
                            <Input
                                label={t('projectSettings.general.fields.title')}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full"
                            />
                            <Textarea
                                label={t('projectSettings.general.fields.description')}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={5}
                                className="w-full"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label={t('projectSettings.general.fields.status')}
                                value={status}
                                onChange={(e) => setStatus(e.target.value as any)}
                            >
                                <option value="Active">{projectStatusLabels.Active}</option>
                                <option value="Planning">{projectStatusLabels.Planning}</option>
                                <option value="On Hold">{projectStatusLabels['On Hold']}</option>
                                <option value="Completed">{projectStatusLabels.Completed}</option>
                                <option value="Brainstorming">{projectStatusLabels.Brainstorming}</option>
                                <option value="Review">{projectStatusLabels.Review}</option>
                            </Select>
                            <Select
                                label={t('projectSettings.general.fields.priority')}
                                value={priority || 'Medium'}
                                onChange={(e) => setPriority(e.target.value)}
                            >
                                <option value="Low">{t('tasks.priority.low')}</option>
                                <option value="Medium">{t('tasks.priority.medium')}</option>
                                <option value="High">{t('tasks.priority.high')}</option>
                                <option value="Urgent">{t('tasks.priority.urgent')}</option>
                            </Select>
                        </div>
                        <div className="grid grid-cols-1">
                            <Select
                                label={t('projectSettings.general.fields.state')}
                                value={projectState || 'not specified'}
                                onChange={(e) => setProjectState(e.target.value as any)}
                            >
                                <option value="not specified">{projectStateLabels['not specified']}</option>
                                <option value="pre-release">{projectStateLabels['pre-release']}</option>
                                <option value="released">{projectStateLabels.released}</option>
                            </Select>
                        </div>

                        {/* Visibility Settings - Only for Owners/Internal Members */}
                        {
                            canChangeVisibility && workspaceGroups.length > 0 && (
                                <div className="pt-6 mt-6 border-t border-[var(--color-surface-border)]">
                                    <label className="text-base font-semibold text-[var(--color-text-main)] mb-3 block flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[var(--color-text-subtle)]">visibility</span>
                                        {t('projectSettings.visibility.title')}
                                    </label>

                                    <div className="grid grid-cols-1 gap-3 mb-4">
                                        {/* Everyone Option */}
                                        <button
                                            type="button"
                                            onClick={() => { setVisibilityGroupIds([]); setIsPrivate(false); }}
                                            className={`relative p-4 rounded-xl border text-left transition-all flex items-start gap-4 group ${!isPrivate && visibilityGroupIds.length === 0
                                                ? 'bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500'
                                                : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] hover:border-[var(--color-text-subtle)] hover:bg-[var(--color-surface-hover)]'
                                                }`}
                                        >
                                            <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${!isPrivate && visibilityGroupIds.length === 0
                                                ? 'bg-emerald-100/50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-subtle)] group-hover:text-[var(--color-text-main)]'
                                                }`}>
                                                <span className="material-symbols-outlined text-xl">public</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`font-semibold ${!isPrivate && visibilityGroupIds.length === 0
                                                        ? 'text-emerald-900 dark:text-emerald-100'
                                                        : 'text-[var(--color-text-main)]'
                                                        }`}>{t('projectSettings.visibility.everyone')}</span>
                                                    {(!isPrivate && visibilityGroupIds.length === 0) && (
                                                        <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
                                                    )}
                                                </div>
                                                <p className={`text-sm ${!isPrivate && visibilityGroupIds.length === 0
                                                    ? 'text-emerald-700/80 dark:text-emerald-300/80'
                                                    : 'text-[var(--color-text-muted)]'
                                                    }`}>{t('projectSettings.visibility.everyoneDescription')}</p>
                                            </div>
                                        </button>

                                        {/* Specific Groups Option */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsPrivate(false);
                                                if (workspaceGroups.length > 0 && visibilityGroupIds.length === 0) {
                                                    setVisibilityGroupIds([workspaceGroups[0].id]);
                                                }
                                            }}
                                            className={`relative p-4 rounded-xl border text-left transition-all flex items-start gap-4 group ${!isPrivate && visibilityGroupIds.length > 0
                                                ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
                                                : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] hover:border-[var(--color-text-subtle)] hover:bg-[var(--color-surface-hover)]'
                                                }`}
                                        >
                                            <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${!isPrivate && visibilityGroupIds.length > 0
                                                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-subtle)] group-hover:text-[var(--color-text-main)]'
                                                }`}>
                                                <span className="material-symbols-outlined text-xl">lock_person</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`font-semibold ${!isPrivate && visibilityGroupIds.length > 0
                                                        ? 'text-[var(--color-primary)]'
                                                        : 'text-[var(--color-text-main)]'
                                                        }`}>{t('projectSettings.visibility.specificGroup')}</span>
                                                    {(!isPrivate && visibilityGroupIds.length > 0) && (
                                                        <span className="material-symbols-outlined text-[var(--color-primary)] text-[20px]">check_circle</span>
                                                    )}
                                                </div>
                                                <p className={`text-sm ${!isPrivate && visibilityGroupIds.length > 0
                                                    ? 'text-[var(--color-primary)]/80'
                                                    : 'text-[var(--color-text-muted)]'
                                                    }`}>{t('projectSettings.visibility.specificGroupDescription')}</p>
                                            </div>
                                        </button>

                                        {/* Private Option */}
                                        <button
                                            type="button"
                                            onClick={() => { setIsPrivate(true); setVisibilityGroupIds([]); }}
                                            className={`relative p-4 rounded-xl border text-left transition-all flex items-start gap-4 group ${isPrivate
                                                ? 'bg-rose-50/50 dark:bg-rose-500/10 border-rose-500 ring-1 ring-rose-500'
                                                : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] hover:border-[var(--color-text-subtle)] hover:bg-[var(--color-surface-hover)]'
                                                }`}
                                        >
                                            <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${isPrivate
                                                ? 'bg-rose-100/50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                                                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-subtle)] group-hover:text-[var(--color-text-main)]'
                                                }`}>
                                                <span className="material-symbols-outlined text-xl">lock</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`font-semibold ${isPrivate
                                                        ? 'text-rose-900 dark:text-rose-100'
                                                        : 'text-[var(--color-text-main)]'
                                                        }`}>{t('projectSettings.visibility.private')}</span>
                                                    {isPrivate && (
                                                        <span className="material-symbols-outlined text-rose-600 text-[20px]">check_circle</span>
                                                    )}
                                                </div>
                                                <p className={`text-sm ${isPrivate
                                                    ? 'text-rose-700/80 dark:text-rose-300/80'
                                                    : 'text-[var(--color-text-muted)]'
                                                    }`}>{t('projectSettings.visibility.privateDescription')}</p>
                                            </div>
                                        </button>
                                    </div>

                                    {!isPrivate && visibilityGroupIds.length > 0 && (
                                        <div className="ml-14 animate-fade-in space-y-3">
                                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-4 h-px bg-[var(--color-surface-border)]"></span>
                                                {t('projectSettings.visibility.allowedGroups')}
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {workspaceGroups.map(group => {
                                                    const isSelected = visibilityGroupIds.includes(group.id);
                                                    return (
                                                        <button
                                                            key={group.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setVisibilityGroupIds(prev => prev.filter(id => id !== group.id));
                                                                } else {
                                                                    setVisibilityGroupIds(prev => [...prev, group.id]);
                                                                }
                                                            }}
                                                            className={`p-2.5 rounded-lg flex items-center gap-3 border transition-all text-left ${isSelected
                                                                ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-text-main)]'
                                                                : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-subtle)]'
                                                                }`}
                                                        >
                                                            <div
                                                                className="size-3 rounded-full shrink-0 ring-1 ring-white/20"
                                                                style={{ backgroundColor: group.color || '#9ca3af' }}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-sm font-medium truncate block">{group.name}</span>
                                                            </div>
                                                            {isSelected && (
                                                                <span className="material-symbols-outlined text-[18px] text-[var(--color-primary)] shrink-0">check</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        }
                    </div >
                );
            case 'team':
                return (
                    <ProjectTeamManager
                        project={project}
                        canManage={can('canInvite')}
                        customRoles={customRoles}
                    />
                );
            case 'roles':
                return (
                    <RolesTab
                        project={project}
                        isOwner={isProjectOwner}
                        onProjectUpdate={loadRoles} // Trigger roles reload
                        customRoles={customRoles}
                    />
                );
            case 'appearance':
                return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Cover Image */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--color-text-main)]">{t('projectSettings.appearance.coverLabel')}</label>
                                <div
                                    className="group relative aspect-video rounded-xl border border-dashed border-[var(--color-surface-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface-hover)]/30 overflow-hidden cursor-pointer transition-all"
                                    onClick={() => { setMediaTarget('cover'); setShowMediaLibrary(true); }}
                                >
                                    {coverImage ? (
                                        <>
                                            <img src={coverImage} alt={t('projectSettings.appearance.coverAlt')} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-white text-sm font-medium">{t('projectSettings.appearance.coverChange')}</span>
                                            </div>
                                            <button
                                                className="absolute top-2 right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                                onClick={(e) => { e.stopPropagation(); setCoverImage(undefined); }}
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                                            <span className="material-symbols-outlined text-3xl mb-2">image</span>
                                            <span className="text-sm">{t('projectSettings.appearance.coverUpload')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Icon */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--color-text-main)]">{t('projectSettings.appearance.iconLabel')}</label>
                                <div
                                    className="group relative w-32 h-32 rounded-2xl border border-dashed border-[var(--color-surface-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface-hover)]/30 overflow-hidden cursor-pointer transition-all"
                                    onClick={() => { setMediaTarget('icon'); setShowMediaLibrary(true); }}
                                >
                                    {squareIcon ? (
                                        <>
                                            <img src={squareIcon} alt={t('projectSettings.appearance.iconAlt')} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-white text-xs font-medium">{t('projectSettings.appearance.iconChange')}</span>
                                            </div>
                                            <button
                                                className="absolute top-1 right-1 p-0.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                                onClick={(e) => { e.stopPropagation(); setSquareIcon(undefined); }}
                                            >
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                                            <span className="material-symbols-outlined text-2xl mb-1">apps</span>
                                            <span className="text-xs">{t('projectSettings.appearance.iconUpload')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'modules':
                return (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <p className="text-sm text-[var(--color-text-muted)]">{t('projectSettings.modules.description')}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {['tasks', 'sprints', 'issues', 'ideas', 'milestones', 'activity', 'social', 'marketing', 'accounting'].map((mod) => {
                                // Restricted Check
                                // Restricted Check - using top-level hooks


                                if (mod === 'social' && !isSocialAllowed) return null;
                                if (mod === 'marketing' && !isMarketingAllowed) return null;
                                if (mod === 'accounting' && !isAccountingAllowed) return null;

                                return (
                                    <div
                                        key={mod}
                                        className={`
                                        flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                                        ${modules.includes(mod as any)
                                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 dark:bg-[var(--color-primary)]/10'
                                                : 'border-[var(--color-surface-border)] hover:border-[var(--color-surface-border-hover)] hover:bg-[var(--color-surface-hover)]'
                                            }
                                    `}
                                        onClick={() => {
                                            if (modules.includes(mod as any)) {
                                                setModules(modules.filter(m => m !== mod));
                                            } else {
                                                setModules([...modules, mod as any]);
                                            }
                                        }}
                                    >
                                        <div className={`
                                        size-10 rounded-lg flex items-center justify-center transition-colors
                                        ${modules.includes(mod as any) ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'}
                                    `}>
                                            <span className="material-symbols-outlined">
                                                {mod === 'tasks' ? 'check_circle' :
                                                    mod === 'ideas' ? 'lightbulb' :
                                                        mod === 'milestones' ? 'flag' :
                                                            mod === 'social' ? 'campaign' :
                                                                mod === 'marketing' ? 'ads_click' :
                                                                    mod === 'accounting' ? 'receipt_long' :

                                                                        mod === 'sprints' ? 'directions_run' :
                                                                            mod === 'activity' ? 'history' : 'bug_report'}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm text-[var(--color-text-main)]">{moduleLabels[mod] || mod}</p>
                                        </div>
                                        <Checkbox
                                            checked={modules.includes(mod as any)}
                                            readOnly
                                            className="pointer-events-none"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'navigation':
                // Get nav items in the user's custom order
                const orderedNavItems = navOrder.length > 0
                    ? navOrder.map(id => defaultNavItems.find(n => n.id === id)).filter(Boolean) as typeof defaultNavItems
                    : defaultNavItems;

                // Filter by enabled modules
                const availableNavItems = orderedNavItems.filter(item => {
                    if (!item.moduleKey) return true; // Overview is always available
                    return modules.includes(item.moduleKey as any);
                });

                const handleDragStart = (e: React.DragEvent, itemId: string) => {
                    setDraggedItem(itemId);
                    e.dataTransfer.effectAllowed = 'move';
                };

                const handleDragOver = (e: React.DragEvent, targetId: string) => {
                    e.preventDefault();
                    if (!draggedItem || draggedItem === targetId) return;

                    const newOrder = [...navOrder];
                    const draggedIdx = newOrder.indexOf(draggedItem);
                    const targetIdx = newOrder.indexOf(targetId);

                    if (draggedIdx > -1 && targetIdx > -1) {
                        newOrder.splice(draggedIdx, 1);
                        newOrder.splice(targetIdx, 0, draggedItem);
                        setNavOrder(newOrder);
                    }
                };

                const handleDragEnd = () => {
                    setDraggedItem(null);
                };

                const toggleHidden = (itemId: string) => {
                    if (navHidden.includes(itemId)) {
                        setNavHidden(navHidden.filter(id => id !== itemId));
                    } else {
                        setNavHidden([...navHidden, itemId]);
                    }
                };

                return (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {t('projectSettings.navigation.description')}
                            <span className="font-medium"> {t('projectSettings.navigation.note')}</span>
                        </p>

                        <div className="space-y-2">
                            {availableNavItems.map((item) => {
                                const isHidden = navHidden.includes(item.id);
                                const canHide = item.canHide !== false;

                                return (
                                    <div
                                        key={item.id}
                                        draggable={true}
                                        onDragStart={(e) => handleDragStart(e, item.id)}
                                        onDragOver={(e) => handleDragOver(e, item.id)}
                                        onDragEnd={handleDragEnd}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing
                                            ${draggedItem === item.id
                                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 scale-[1.02] shadow-lg'
                                                : isHidden
                                                    ? 'border-[var(--color-surface-border)] bg-[var(--color-surface-hover)]/30 opacity-50'
                                                    : 'border-[var(--color-surface-border)] hover:border-[var(--color-primary)]/50 bg-white dark:bg-[var(--color-surface-card)]'
                                            }
                                        `}
                                    >
                                        {/* Drag Handle */}
                                        <span className="material-symbols-outlined text-[var(--color-text-muted)] text-lg">drag_indicator</span>

                                        {/* Icon */}
                                        <div className={`
                                            size-9 rounded-lg flex items-center justify-center transition-colors
                                            ${isHidden
                                                ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                                                : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                            }
                                        `}>
                                            <span className="material-symbols-outlined text-lg">{item.icon}</span>
                                        </div>

                                        {/* Label */}
                                        <div className="flex-1">
                                            <p className={`font-semibold text-sm ${isHidden ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'}`}>
                                                {item.label}
                                            </p>
                                        </div>

                                        {/* Visibility Toggle */}
                                        {canHide ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleHidden(item.id); }}
                                                className={`
                                                    size-8 rounded-lg flex items-center justify-center transition-all
                                                    ${isHidden
                                                        ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:bg-rose-100 hover:text-rose-600'
                                                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100'
                                                    }
                                                `}
                                                title={isHidden ? t('projectSettings.navigation.show') : t('projectSettings.navigation.hide')}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {isHidden ? 'visibility_off' : 'visibility'}
                                                </span>
                                            </button>
                                        ) : (
                                            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide px-2 py-1 rounded bg-[var(--color-surface-hover)]">
                                                {t('projectSettings.navigation.alwaysVisible')}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {availableNavItems.length === 0 && (
                            <div className="text-center py-8 text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">extension_off</span>
                                <p className="text-sm">{t('projectSettings.navigation.empty')}</p>
                            </div>
                        )}
                    </div>
                );
            case 'integrations':
                return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="border border-[var(--color-surface-border)] rounded-xl p-4 bg-[var(--color-surface-paper)]/50">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="size-10 bg-black rounded-full flex items-center justify-center text-white">
                                    <span className="material-symbols-outlined">terminal</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-[var(--color-text-main)]">{t('projectSettings.integrations.github.title')}</h3>
                                    <p className="text-xs text-[var(--color-text-muted)]">{t('projectSettings.integrations.github.subtitle')}</p>
                                </div>
                                <Badge variant={githubRepo ? 'success' : 'secondary'}>{githubRepo ? t('projectSettings.integrations.github.connected') : t('projectSettings.integrations.github.notLinked')}</Badge>
                            </div>

                            {!githubToken ? (
                                <button
                                    onClick={handleConnectGithub}
                                    disabled={connectingGithub}
                                    className="w-full p-3 rounded-lg bg-black/[0.05] dark:bg-white/[0.05] hover:bg-black/[0.1] dark:hover:bg-white/[0.1] transition-colors flex items-center justify-center gap-2 text-sm font-medium text-[var(--color-text-main)]"
                                >
                                    {connectingGithub ? (
                                        <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> {t('projectSettings.integrations.github.connecting')}</>
                                    ) : (
                                        <>{t('projectSettings.integrations.github.connectAccount')}</>
                                    )}
                                </button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{t('projectSettings.integrations.github.repositoryLabel')}</label>
                                        <select
                                            value={githubRepo}
                                            onChange={(e) => setGithubRepo(e.target.value)}
                                            disabled={loadingGithub}
                                            className="w-full h-10 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 text-sm text-[var(--color-text-main)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
                                        >
                                            <option value="">{loadingGithub ? t('projectSettings.integrations.github.loadingRepos') : t('projectSettings.integrations.github.selectRepo')}</option>
                                            {githubRepos.map(repo => (
                                                <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                                        <Checkbox
                                            id="gh-sync"
                                            checked={githubIssueSync}
                                            onChange={(e) => setGithubIssueSync(e.target.checked)}
                                            disabled={!githubRepo}
                                        />
                                        <label htmlFor="gh-sync" className={`text-sm ${!githubRepo ? 'opacity-50' : ''} text-[var(--color-text-main)]`}>
                                            {t('projectSettings.integrations.github.issueSync')}
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'resources':
                return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Overview Links */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-[var(--color-text-main)]">{t('projectSettings.resources.overviewTitle')}</label>
                                <Button size="sm" variant="ghost" onClick={() => setLinks([...links, { title: '', url: '' }])}>{t('projectSettings.resources.addLink')}</Button>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                {links.map((link, idx) => (
                                    <div key={idx} className="flex gap-2 items-start">
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <Input
                                                placeholder={t('projectSettings.resources.linkTitlePlaceholder')}
                                                value={link.title}
                                                onChange={(e) => {
                                                    const newLinks = [...links];
                                                    newLinks[idx] = { ...newLinks[idx], title: e.target.value };
                                                    setLinks(newLinks);
                                                }}
                                            />
                                            <Input
                                                placeholder={t('projectSettings.resources.linkUrlPlaceholder')}
                                                value={link.url}
                                                onChange={(e) => {
                                                    const newLinks = [...links];
                                                    newLinks[idx] = { ...newLinks[idx], url: e.target.value };
                                                    setLinks(newLinks);
                                                }}
                                            />
                                        </div>
                                        <button onClick={() => setLinks(links.filter((_, i) => i !== idx))} className="mt-2 text-[var(--color-text-subtle)] hover:text-red-500">
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                ))}
                                {links.length === 0 && <p className="text-sm text-[var(--color-text-muted)] italic">{t('projectSettings.resources.noLinks')}</p>}
                            </div>
                        </div>

                        <div className="h-px bg-[var(--color-surface-border)]" />

                        {/* Sidebar Resources */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-[var(--color-text-main)]">{t('projectSettings.resources.sidebarTitle')}</label>
                                <Button size="sm" variant="ghost" onClick={() => setExternalResources([...externalResources, { title: '', url: '', icon: 'link' }])}>{t('projectSettings.resources.addShortcut')}</Button>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                {externalResources.map((res, idx) => (
                                    <div key={idx} className="flex gap-2 items-start">
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <Input
                                                placeholder={t('projectSettings.resources.shortcutTitlePlaceholder')}
                                                value={res.title}
                                                onChange={(e) => {
                                                    const newRes = [...externalResources];
                                                    newRes[idx] = { ...newRes[idx], title: e.target.value };
                                                    setExternalResources(newRes);
                                                }}
                                            />
                                            <Input
                                                placeholder={t('projectSettings.resources.shortcutUrlPlaceholder')}
                                                value={res.url}
                                                onChange={(e) => {
                                                    const newRes = [...externalResources];
                                                    newRes[idx] = { ...newRes[idx], url: e.target.value };
                                                    setExternalResources(newRes);
                                                }}
                                            />
                                        </div>
                                        <button onClick={() => setExternalResources(externalResources.filter((_, i) => i !== idx))} className="mt-2 text-[var(--color-text-subtle)] hover:text-red-500">
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                ))}
                                {externalResources.length === 0 && <p className="text-sm text-[var(--color-text-muted)] italic">{t('projectSettings.resources.noShortcuts')}</p>}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={t('projectSettings.title')} size="xl">
                <div className="flex h-[600px] -m-6">
                    {/* Sidebar */}
                    <div className="w-64 shrink-0 bg-[var(--color-surface-hover)]/30 border-r border-[var(--color-surface-border)] p-4 flex flex-col gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                                    ${activeTab === tab.id
                                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'}
                                `}
                            >
                                <span className={`material-symbols-outlined text-[20px] ${activeTab === tab.id ? 'fill' : ''}`}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                            {renderContent()}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 p-4 border-t border-[var(--color-surface-border)] flex items-center justify-end gap-3 bg-[var(--color-surface-paper)]">
                            <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                            <Button variant="primary" onClick={handleSave} isLoading={isSaving}>{t('common.saveChanges')}</Button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Media Library Picker */}
            {project && (
                <MediaLibrary
                    isOpen={showMediaLibrary}
                    onClose={() => setShowMediaLibrary(false)}
                    projectId={project.id}
                    tenantId={project.tenantId}
                    onSelect={(asset) => {
                        if (mediaTarget === 'cover') {
                            setCoverImage(asset.url);
                        } else if (mediaTarget === 'icon') {
                            setSquareIcon(asset.url);
                        }
                        setShowMediaLibrary(false);
                    }}
                />
            )}
        </>
    );
};
