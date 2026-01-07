import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { TextInput } from '../common/Input/TextInput';
import { TextArea } from '../common/Input/TextArea';
import { Select } from '../common/Select/Select';
import { Checkbox } from '../common/Checkbox/Checkbox';
import { Badge } from '../common/Badge/Badge';
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
import { getUserProfile, linkWithGithub, updateUserData, getUserProjectNavPrefs, setUserProjectNavPrefs } from '../../services/dataService';
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
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
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

    const projectStatusOptions = [
        { value: 'Active', label: projectStatusLabels.Active },
        { value: 'Planning', label: projectStatusLabels.Planning },
        { value: 'On Hold', label: projectStatusLabels['On Hold'] },
        { value: 'Completed', label: projectStatusLabels.Completed },
        { value: 'Brainstorming', label: projectStatusLabels.Brainstorming },
        { value: 'Review', label: projectStatusLabels.Review },
    ];

    const projectPriorityOptions = [
        { value: 'Low', label: t('tasks.priority.low') },
        { value: 'Medium', label: t('tasks.priority.medium') },
        { value: 'High', label: t('tasks.priority.high') },
        { value: 'Urgent', label: t('tasks.priority.urgent') },
    ];

    const projectStateOptions = [
        { value: 'not specified', label: projectStateLabels['not specified'] },
        { value: 'pre-release', label: projectStateLabels['pre-release'] },
        { value: 'released', label: projectStateLabels.released },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'general': {
                const isEveryone = !isPrivate && visibilityGroupIds.length === 0;
                const isGroupOnly = !isPrivate && visibilityGroupIds.length > 0;

                return (
                    <div className="project-edit-modal__panel project-edit-modal__panel--general animate-fade-in">
                        <div className="project-edit-modal__stack">
                            <TextInput
                                label={t('projectSettings.general.fields.title')}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                            <TextArea
                                label={t('projectSettings.general.fields.description')}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={5}
                            />
                        </div>
                        <div className="project-edit-modal__grid project-edit-modal__grid--two">
                            <Select
                                label={t('projectSettings.general.fields.status')}
                                value={status || 'Active'}
                                onChange={(value) => setStatus(value as any)}
                                options={projectStatusOptions}
                            />
                            <Select
                                label={t('projectSettings.general.fields.priority')}
                                value={priority || 'Medium'}
                                onChange={(value) => setPriority(String(value))}
                                options={projectPriorityOptions}
                            />
                        </div>
                        <div className="project-edit-modal__grid">
                            <Select
                                label={t('projectSettings.general.fields.state')}
                                value={projectState || 'not specified'}
                                onChange={(value) => setProjectState(value as any)}
                                options={projectStateOptions}
                            />
                        </div>

                        {/* Visibility Settings - Only for Owners/Internal Members */}
                        {canChangeVisibility && workspaceGroups.length > 0 && (
                            <div className="project-edit-modal__visibility">
                                <div className="project-edit-modal__visibility-title">
                                    <span className="material-symbols-outlined">visibility</span>
                                    {t('projectSettings.visibility.title')}
                                </div>

                                <div className="project-edit-modal__visibility-options">
                                    {/* Everyone Option */}
                                    <button
                                        type="button"
                                        onClick={() => { setVisibilityGroupIds([]); setIsPrivate(false); }}
                                        className="project-edit-modal__visibility-option"
                                        data-tone="success"
                                        data-selected={isEveryone ? 'true' : 'false'}
                                    >
                                        <div className="project-edit-modal__visibility-icon" data-tone="success">
                                            <span className="material-symbols-outlined">public</span>
                                        </div>
                                        <div className="project-edit-modal__visibility-body">
                                            <div className="project-edit-modal__visibility-row">
                                                <span className="project-edit-modal__visibility-label">
                                                    {t('projectSettings.visibility.everyone')}
                                                </span>
                                                {isEveryone && (
                                                    <span className="material-symbols-outlined project-edit-modal__visibility-check">check_circle</span>
                                                )}
                                            </div>
                                            <p className="project-edit-modal__visibility-description">
                                                {t('projectSettings.visibility.everyoneDescription')}
                                            </p>
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
                                        className="project-edit-modal__visibility-option"
                                        data-tone="primary"
                                        data-selected={isGroupOnly ? 'true' : 'false'}
                                    >
                                        <div className="project-edit-modal__visibility-icon" data-tone="primary">
                                            <span className="material-symbols-outlined">lock_person</span>
                                        </div>
                                        <div className="project-edit-modal__visibility-body">
                                            <div className="project-edit-modal__visibility-row">
                                                <span className="project-edit-modal__visibility-label">
                                                    {t('projectSettings.visibility.specificGroup')}
                                                </span>
                                                {isGroupOnly && (
                                                    <span className="material-symbols-outlined project-edit-modal__visibility-check">check_circle</span>
                                                )}
                                            </div>
                                            <p className="project-edit-modal__visibility-description">
                                                {t('projectSettings.visibility.specificGroupDescription')}
                                            </p>
                                        </div>
                                    </button>

                                    {/* Private Option */}
                                    <button
                                        type="button"
                                        onClick={() => { setIsPrivate(true); setVisibilityGroupIds([]); }}
                                        className="project-edit-modal__visibility-option"
                                        data-tone="danger"
                                        data-selected={isPrivate ? 'true' : 'false'}
                                    >
                                        <div className="project-edit-modal__visibility-icon" data-tone="danger">
                                            <span className="material-symbols-outlined">lock</span>
                                        </div>
                                        <div className="project-edit-modal__visibility-body">
                                            <div className="project-edit-modal__visibility-row">
                                                <span className="project-edit-modal__visibility-label">
                                                    {t('projectSettings.visibility.private')}
                                                </span>
                                                {isPrivate && (
                                                    <span className="material-symbols-outlined project-edit-modal__visibility-check">check_circle</span>
                                                )}
                                            </div>
                                            <p className="project-edit-modal__visibility-description">
                                                {t('projectSettings.visibility.privateDescription')}
                                            </p>
                                        </div>
                                    </button>
                                </div>

                                {isGroupOnly && (
                                    <div className="project-edit-modal__visibility-groups animate-fade-in">
                                        <label className="project-edit-modal__visibility-groups-title">
                                            <span className="project-edit-modal__visibility-groups-line" />
                                            {t('projectSettings.visibility.allowedGroups')}
                                        </label>
                                        <div className="project-edit-modal__visibility-group-list">
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
                                                        className="project-edit-modal__visibility-group"
                                                        data-selected={isSelected ? 'true' : 'false'}
                                                    >
                                                        <div
                                                            className="project-edit-modal__visibility-group-dot"
                                                            style={{ backgroundColor: group.color || '#9ca3af' }}
                                                        />
                                                        <div className="project-edit-modal__visibility-group-name">
                                                            {group.name}
                                                        </div>
                                                        {isSelected && (
                                                            <span className="material-symbols-outlined project-edit-modal__visibility-group-check">check</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            }
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
                    <div className="project-edit-modal__panel project-edit-modal__panel--appearance animate-fade-in">
                        <div className="project-edit-modal__media-grid">
                            {/* Cover Image */}
                            <div className="project-edit-modal__media-block">
                                <label className="project-edit-modal__media-label">{t('projectSettings.appearance.coverLabel')}</label>
                                <button
                                    type="button"
                                    className="project-edit-modal__media-preview project-edit-modal__media-preview--cover"
                                    data-has-image={coverImage ? 'true' : 'false'}
                                    onClick={() => { setMediaTarget('cover'); setShowMediaLibrary(true); }}
                                >
                                    {coverImage ? (
                                        <>
                                            <img src={coverImage} alt={t('projectSettings.appearance.coverAlt')} className="project-edit-modal__media-image" />
                                            <div className="project-edit-modal__media-overlay">
                                                <span className="project-edit-modal__media-overlay-text">{t('projectSettings.appearance.coverChange')}</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="project-edit-modal__media-remove"
                                                onClick={(e) => { e.stopPropagation(); setCoverImage(undefined); }}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="project-edit-modal__media-empty">
                                            <span className="material-symbols-outlined project-edit-modal__media-empty-icon">image</span>
                                            <span className="project-edit-modal__media-empty-text">{t('projectSettings.appearance.coverUpload')}</span>
                                        </div>
                                    )}
                                </button>
                            </div>

                            {/* Icon */}
                            <div className="project-edit-modal__media-block">
                                <label className="project-edit-modal__media-label">{t('projectSettings.appearance.iconLabel')}</label>
                                <button
                                    type="button"
                                    className="project-edit-modal__media-preview project-edit-modal__media-preview--icon"
                                    data-has-image={squareIcon ? 'true' : 'false'}
                                    onClick={() => { setMediaTarget('icon'); setShowMediaLibrary(true); }}
                                >
                                    {squareIcon ? (
                                        <>
                                            <img src={squareIcon} alt={t('projectSettings.appearance.iconAlt')} className="project-edit-modal__media-image" />
                                            <div className="project-edit-modal__media-overlay">
                                                <span className="project-edit-modal__media-overlay-text">{t('projectSettings.appearance.iconChange')}</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="project-edit-modal__media-remove project-edit-modal__media-remove--compact"
                                                onClick={(e) => { e.stopPropagation(); setSquareIcon(undefined); }}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="project-edit-modal__media-empty">
                                            <span className="material-symbols-outlined project-edit-modal__media-empty-icon">apps</span>
                                            <span className="project-edit-modal__media-empty-text">{t('projectSettings.appearance.iconUpload')}</span>
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'modules':
                return (
                    <div className="project-edit-modal__panel project-edit-modal__panel--modules animate-fade-in">
                        <p className="project-edit-modal__hint">{t('projectSettings.modules.description')}</p>
                        <div className="project-edit-modal__modules-grid">
                            {['tasks', 'sprints', 'issues', 'ideas', 'milestones', 'activity', 'social', 'marketing', 'accounting'].map((mod) => {
                                if (mod === 'social' && !isSocialAllowed) return null;
                                if (mod === 'marketing' && !isMarketingAllowed) return null;
                                if (mod === 'accounting' && !isAccountingAllowed) return null;

                                const isEnabled = modules.includes(mod as any);

                                return (
                                    <button
                                        key={mod}
                                        type="button"
                                        className="project-edit-modal__module-card"
                                        data-active={isEnabled ? 'true' : 'false'}
                                        onClick={() => {
                                            if (isEnabled) {
                                                setModules(modules.filter(m => m !== mod));
                                            } else {
                                                setModules([...modules, mod as any]);
                                            }
                                        }}
                                    >
                                        <div className="project-edit-modal__module-icon" data-active={isEnabled ? 'true' : 'false'}>
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
                                        <div className="project-edit-modal__module-body">
                                            <p className="project-edit-modal__module-title">{moduleLabels[mod] || mod}</p>
                                        </div>
                                        <Checkbox
                                            checked={isEnabled}
                                            readOnly
                                            tabIndex={-1}
                                            className="project-edit-modal__module-check"
                                            aria-hidden="true"
                                        />
                                    </button>
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
                    <div className="project-edit-modal__panel project-edit-modal__panel--navigation animate-fade-in">
                        <p className="project-edit-modal__hint">
                            {t('projectSettings.navigation.description')}
                            <span className="project-edit-modal__hint-strong"> {t('projectSettings.navigation.note')}</span>
                        </p>

                        <div className="project-edit-modal__nav-list">
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
                                        className="project-edit-modal__nav-item"
                                        data-dragging={draggedItem === item.id ? 'true' : 'false'}
                                        data-hidden={isHidden ? 'true' : 'false'}
                                    >
                                        <span className="material-symbols-outlined project-edit-modal__nav-handle">drag_indicator</span>

                                        <div className="project-edit-modal__nav-icon" data-hidden={isHidden ? 'true' : 'false'}>
                                            <span className="material-symbols-outlined">{item.icon}</span>
                                        </div>

                                        <div className="project-edit-modal__nav-label" data-hidden={isHidden ? 'true' : 'false'}>
                                            {item.label}
                                        </div>

                                        {canHide ? (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); toggleHidden(item.id); }}
                                                className="project-edit-modal__nav-toggle"
                                                data-hidden={isHidden ? 'true' : 'false'}
                                                title={isHidden ? t('projectSettings.navigation.show') : t('projectSettings.navigation.hide')}
                                            >
                                                <span className="material-symbols-outlined">
                                                    {isHidden ? 'visibility_off' : 'visibility'}
                                                </span>
                                            </button>
                                        ) : (
                                            <span className="project-edit-modal__nav-always">
                                                {t('projectSettings.navigation.alwaysVisible')}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {availableNavItems.length === 0 && (
                            <div className="project-edit-modal__empty">
                                <span className="material-symbols-outlined">extension_off</span>
                                <p>{t('projectSettings.navigation.empty')}</p>
                            </div>
                        )}
                    </div>
                );
            case 'integrations': {
                const githubRepoOptions = githubRepos.map(repo => ({
                    value: repo.full_name,
                    label: repo.full_name,
                }));

                return (
                    <div className="project-edit-modal__panel project-edit-modal__panel--integrations animate-fade-in">
                        <div className="project-edit-modal__integration-card">
                            <div className="project-edit-modal__integration-header">
                                <div className="project-edit-modal__integration-icon">
                                    <span className="material-symbols-outlined">terminal</span>
                                </div>
                                <div className="project-edit-modal__integration-meta">
                                    <h3 className="project-edit-modal__integration-title">{t('projectSettings.integrations.github.title')}</h3>
                                    <p className="project-edit-modal__integration-subtitle">{t('projectSettings.integrations.github.subtitle')}</p>
                                </div>
                                <Badge
                                    variant={githubRepo ? 'success' : 'neutral'}
                                    className="project-edit-modal__integration-badge"
                                >
                                    {githubRepo ? t('projectSettings.integrations.github.connected') : t('projectSettings.integrations.github.notLinked')}
                                </Badge>
                            </div>

                            {!githubToken ? (
                                <Button
                                    onClick={handleConnectGithub}
                                    disabled={connectingGithub}
                                    isLoading={connectingGithub}
                                    variant="secondary"
                                    className="project-edit-modal__integration-button"
                                    icon={<span className="material-symbols-outlined">link</span>}
                                >
                                    {connectingGithub
                                        ? t('projectSettings.integrations.github.connecting')
                                        : t('projectSettings.integrations.github.connectAccount')}
                                </Button>
                            ) : (
                                <div className="project-edit-modal__integration-body">
                                    <Select
                                        label={t('projectSettings.integrations.github.repositoryLabel')}
                                        value={githubRepo || null}
                                        onChange={(value) => setGithubRepo(String(value))}
                                        options={githubRepoOptions}
                                        placeholder={loadingGithub ? t('projectSettings.integrations.github.loadingRepos') : t('projectSettings.integrations.github.selectRepo')}
                                        disabled={loadingGithub}
                                    />

                                    <Checkbox
                                        id="gh-sync"
                                        checked={githubIssueSync}
                                        onChange={(e) => setGithubIssueSync(e.target.checked)}
                                        disabled={!githubRepo}
                                        label={t('projectSettings.integrations.github.issueSync')}
                                        className="project-edit-modal__integration-checkbox"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
            case 'resources':
                return (
                    <div className="project-edit-modal__panel project-edit-modal__panel--resources animate-fade-in">
                        {/* Overview Links */}
                        <div className="project-edit-modal__resource-section">
                            <div className="project-edit-modal__resource-header">
                                <label className="project-edit-modal__resource-title">{t('projectSettings.resources.overviewTitle')}</label>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setLinks([...links, { title: '', url: '' }])}
                                >
                                    {t('projectSettings.resources.addLink')}
                                </Button>
                            </div>
                            <div className="project-edit-modal__resource-list">
                                {links.map((link, idx) => (
                                    <div key={idx} className="project-edit-modal__resource-item">
                                        <div className="project-edit-modal__resource-fields project-edit-modal__resource-fields--two">
                                            <TextInput
                                                placeholder={t('projectSettings.resources.linkTitlePlaceholder')}
                                                value={link.title}
                                                onChange={(e) => {
                                                    const newLinks = [...links];
                                                    newLinks[idx] = { ...newLinks[idx], title: e.target.value };
                                                    setLinks(newLinks);
                                                }}
                                            />
                                            <TextInput
                                                placeholder={t('projectSettings.resources.linkUrlPlaceholder')}
                                                value={link.url}
                                                onChange={(e) => {
                                                    const newLinks = [...links];
                                                    newLinks[idx] = { ...newLinks[idx], url: e.target.value };
                                                    setLinks(newLinks);
                                                }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                                            className="project-edit-modal__resource-remove"
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                ))}
                                {links.length === 0 && (
                                    <p className="project-edit-modal__resource-empty">{t('projectSettings.resources.noLinks')}</p>
                                )}
                            </div>
                        </div>

                        <div className="project-edit-modal__divider" />

                        {/* Sidebar Resources */}
                        <div className="project-edit-modal__resource-section">
                            <div className="project-edit-modal__resource-header">
                                <label className="project-edit-modal__resource-title">{t('projectSettings.resources.sidebarTitle')}</label>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setExternalResources([...externalResources, { title: '', url: '', icon: 'link' }])}
                                >
                                    {t('projectSettings.resources.addShortcut')}
                                </Button>
                            </div>
                            <div className="project-edit-modal__resource-list">
                                {externalResources.map((res, idx) => (
                                    <div key={idx} className="project-edit-modal__resource-item">
                                        <div className="project-edit-modal__resource-fields project-edit-modal__resource-fields--two">
                                            <TextInput
                                                placeholder={t('projectSettings.resources.shortcutTitlePlaceholder')}
                                                value={res.title}
                                                onChange={(e) => {
                                                    const newRes = [...externalResources];
                                                    newRes[idx] = { ...newRes[idx], title: e.target.value };
                                                    setExternalResources(newRes);
                                                }}
                                            />
                                            <TextInput
                                                placeholder={t('projectSettings.resources.shortcutUrlPlaceholder')}
                                                value={res.url}
                                                onChange={(e) => {
                                                    const newRes = [...externalResources];
                                                    newRes[idx] = { ...newRes[idx], url: e.target.value };
                                                    setExternalResources(newRes);
                                                }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setExternalResources(externalResources.filter((_, i) => i !== idx))}
                                            className="project-edit-modal__resource-remove"
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                ))}
                                {externalResources.length === 0 && (
                                    <p className="project-edit-modal__resource-empty">{t('projectSettings.resources.noShortcuts')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={t('projectSettings.title')} size="xl">
                <div className="project-edit-modal">
                    <div className="project-edit-modal__layout">
                        {/* Sidebar */}
                        <div className="project-edit-modal__sidebar">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`project-edit-modal__tab ${activeTab === tab.id ? 'project-edit-modal__tab--active' : ''}`}
                                >
                                    <span className={`material-symbols-outlined project-edit-modal__tab-icon ${activeTab === tab.id ? 'fill' : ''}`}>
                                        {tab.icon}
                                    </span>
                                    <span className="project-edit-modal__tab-label">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="project-edit-modal__content">
                            <div className="project-edit-modal__body">
                                {renderContent()}
                            </div>

                            {/* Footer */}
                            <div className="project-edit-modal__footer">
                                <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                                <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
                                    {t('common.saveChanges')}
                                </Button>
                            </div>
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
