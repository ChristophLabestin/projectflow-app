import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Badge } from '../ui/Badge';
import { Project } from '../../types';
import { MediaLibrary } from '../MediaLibrary/MediaLibraryModal';

import { auth } from '../../services/firebase';
import { getUserProfile, linkWithGithub, updateUserData, getUserProjectNavPrefs, setUserProjectNavPrefs, ProjectNavPrefs } from '../../services/dataService';
import { fetchUserRepositories, GithubRepo } from '../../services/githubService';

interface ProjectEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onSave: (updatedFields: Partial<Project>) => Promise<void>;
}

type Tab = 'general' | 'appearance' | 'modules' | 'navigation' | 'integrations' | 'resources';

export const ProjectEditModal: React.FC<ProjectEditModalProps> = ({
    isOpen,
    onClose,
    project,
    onSave
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [title, setTitle] = useState(project.title);
    const [description, setDescription] = useState(project.description);
    const [status, setStatus] = useState(project.status);
    const [priority, setPriority] = useState(project.priority);
    const [coverImage, setCoverImage] = useState(project.coverImage);
    const [squareIcon, setSquareIcon] = useState(project.squareIcon);
    const [modules, setModules] = useState(project.modules || []);
    const [githubRepo, setGithubRepo] = useState(project.githubRepo || '');
    const [githubIssueSync, setGithubIssueSync] = useState(project.githubIssueSync || false);
    const [links, setLinks] = useState(project.links || []);
    const [externalResources, setExternalResources] = useState(project.externalResources || []);

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

    // Default nav items
    const defaultNavItems = [
        { id: 'overview', icon: 'grid_view', label: 'Overview', canHide: false },
        { id: 'tasks', icon: 'checklist', label: 'Tasks', moduleKey: 'tasks' },
        { id: 'ideas', icon: 'emoji_objects', label: 'Ideas', moduleKey: 'ideas' },
        { id: 'issues', icon: 'medication', label: 'Issues', moduleKey: 'issues' },
        { id: 'mindmap', icon: 'hub', label: 'Mindmap', moduleKey: 'mindmap' },
        { id: 'milestones', icon: 'outlined_flag', label: 'Milestones', moduleKey: 'milestones' },
        { id: 'social', icon: 'campaign', label: 'Social', moduleKey: 'social' },
        { id: 'marketing', icon: 'ads_click', label: 'Marketing', moduleKey: 'marketing' },
        { id: 'activity', icon: 'history', label: 'Activity', moduleKey: 'activity' },
    ];

    // Reset state when modal opens & Load GitHub & Nav Prefs
    useEffect(() => {
        if (isOpen) {
            setTitle(project.title);
            setDescription(project.description);
            setStatus(project.status);
            setPriority(project.priority);
            setCoverImage(project.coverImage);
            setSquareIcon(project.squareIcon);
            setModules(project.modules || []);
            setGithubRepo(project.githubRepo || '');
            setGithubIssueSync(project.githubIssueSync || false);
            setLinks(project.links || []);
            setExternalResources(project.externalResources || []);
            setActiveTab('general');

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
                        setNavOrder(prefs.order);
                        setNavHidden(prefs.hidden);
                    } else {
                        // Default order
                        setNavOrder(defaultNavItems.map(n => n.id));
                        setNavHidden([]);
                    }
                }
            };
            loadNavPrefs();
        }
    }, [isOpen, project]);

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
                coverImage,
                squareIcon,
                modules,
                githubRepo,
                githubIssueSync,
                links,
                externalResources
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

    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'general', label: 'General', icon: 'settings' },
        { id: 'appearance', label: 'Appearance', icon: 'palette' },
        { id: 'modules', label: 'Modules', icon: 'extension' },
        { id: 'navigation', label: 'Navigation', icon: 'menu' },
        { id: 'integrations', label: 'Integrations', icon: 'integration_instructions' },
        { id: 'resources', label: 'Resources', icon: 'link' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="space-y-4">
                            <Input
                                label="Project Title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full"
                            />
                            <Textarea
                                label="Description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={5}
                                className="w-full"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Status"
                                value={status}
                                onChange={(e) => setStatus(e.target.value as any)}
                            >
                                <option value="Active">Active</option>
                                <option value="Planning">Planning</option>
                                <option value="On Hold">On Hold</option>
                                <option value="Completed">Completed</option>
                                <option value="Brainstorming">Brainstorming</option>
                                <option value="Review">Review</option>
                            </Select>
                            <Select
                                label="Priority"
                                value={priority || 'Medium'}
                                onChange={(e) => setPriority(e.target.value)}
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                            </Select>
                        </div>
                    </div>
                );
            case 'appearance':
                return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Cover Image */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--color-text-main)]">Cover Image</label>
                                <div
                                    className="group relative aspect-video rounded-xl border border-dashed border-[var(--color-surface-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface-hover)]/30 overflow-hidden cursor-pointer transition-all"
                                    onClick={() => { setMediaTarget('cover'); setShowMediaLibrary(true); }}
                                >
                                    {coverImage ? (
                                        <>
                                            <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-white text-sm font-medium">Change Cover</span>
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
                                            <span className="text-sm">Upload Cover Image</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Icon */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-[var(--color-text-main)]">Project Icon</label>
                                <div
                                    className="group relative w-32 h-32 rounded-2xl border border-dashed border-[var(--color-surface-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface-hover)]/30 overflow-hidden cursor-pointer transition-all"
                                    onClick={() => { setMediaTarget('icon'); setShowMediaLibrary(true); }}
                                >
                                    {squareIcon ? (
                                        <>
                                            <img src={squareIcon} alt="Icon" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-white text-xs font-medium">Change</span>
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
                                            <span className="text-xs">Upload Icon</span>
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
                        <p className="text-sm text-[var(--color-text-muted)]">Enable features for this project.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {['tasks', 'milestones', 'issues', 'ideas', 'mindmap', 'activity', 'social', 'marketing'].map((mod) => (
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
                                                        mod === 'mindmap' ? 'hub' :
                                                            mod === 'social' ? 'campaign' :
                                                                mod === 'marketing' ? 'ads_click' :
                                                                    mod === 'activity' ? 'history' : 'bug_report'}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm capitalize text-[var(--color-text-main)]">{mod}</p>
                                    </div>
                                    <Checkbox
                                        checked={modules.includes(mod as any)}
                                        readOnly
                                        className="pointer-events-none"
                                    />
                                </div>
                            ))}
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
                            Customize your sidebar navigation for this project. Drag items to reorder, or toggle visibility.
                            <span className="font-medium"> These settings only affect you.</span>
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
                                                title={isHidden ? 'Show in sidebar' : 'Hide from sidebar'}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {isHidden ? 'visibility_off' : 'visibility'}
                                                </span>
                                            </button>
                                        ) : (
                                            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide px-2 py-1 rounded bg-[var(--color-surface-hover)]">
                                                Always Visible
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {availableNavItems.length === 0 && (
                            <div className="text-center py-8 text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">extension_off</span>
                                <p className="text-sm">Enable some modules first to customize navigation.</p>
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
                                    <h3 className="font-bold text-[var(--color-text-main)]">GitHub</h3>
                                    <p className="text-xs text-[var(--color-text-muted)]">Connect a repository to sync issues.</p>
                                </div>
                                <Badge variant={githubRepo ? 'success' : 'secondary'}>{githubRepo ? 'Connected' : 'Not Linked'}</Badge>
                            </div>

                            {!githubToken ? (
                                <button
                                    onClick={handleConnectGithub}
                                    disabled={connectingGithub}
                                    className="w-full p-3 rounded-lg bg-black/[0.05] dark:bg-white/[0.05] hover:bg-black/[0.1] dark:hover:bg-white/[0.1] transition-colors flex items-center justify-center gap-2 text-sm font-medium text-[var(--color-text-main)]"
                                >
                                    {connectingGithub ? (
                                        <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Connecting...</>
                                    ) : (
                                        <>Connect GitHub Account</>
                                    )}
                                </button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Repository</label>
                                        <select
                                            value={githubRepo}
                                            onChange={(e) => setGithubRepo(e.target.value)}
                                            disabled={loadingGithub}
                                            className="w-full h-10 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 text-sm text-[var(--color-text-main)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
                                        >
                                            <option value="">{loadingGithub ? 'Loading repositories...' : 'Select a repository'}</option>
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
                                            Enable Issue Sync
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
                                <label className="text-sm font-semibold text-[var(--color-text-main)]">Overview Quick Links</label>
                                <Button size="sm" variant="ghost" onClick={() => setLinks([...links, { title: '', url: '' }])}>+ Add Link</Button>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                {links.map((link, idx) => (
                                    <div key={idx} className="flex gap-2 items-start">
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <Input
                                                placeholder="Title"
                                                value={link.title}
                                                onChange={(e) => {
                                                    const newLinks = [...links];
                                                    newLinks[idx].title = e.target.value;
                                                    setLinks(newLinks);
                                                }}
                                            />
                                            <Input
                                                placeholder="URL"
                                                value={link.url}
                                                onChange={(e) => {
                                                    const newLinks = [...links];
                                                    newLinks[idx].url = e.target.value;
                                                    setLinks(newLinks);
                                                }}
                                            />
                                        </div>
                                        <button onClick={() => setLinks(links.filter((_, i) => i !== idx))} className="mt-2 text-[var(--color-text-subtle)] hover:text-red-500">
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                ))}
                                {links.length === 0 && <p className="text-sm text-[var(--color-text-muted)] italic">No links added.</p>}
                            </div>
                        </div>

                        <div className="h-px bg-[var(--color-surface-border)]" />

                        {/* Sidebar Resources */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-[var(--color-text-main)]">Sidebar Shortcuts</label>
                                <Button size="sm" variant="ghost" onClick={() => setExternalResources([...externalResources, { title: '', url: '', icon: 'link' }])}>+ Add Shortcut</Button>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                {externalResources.map((res, idx) => (
                                    <div key={idx} className="flex gap-2 items-start">
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <Input
                                                placeholder="Title"
                                                value={res.title}
                                                onChange={(e) => {
                                                    const newRes = [...externalResources];
                                                    newRes[idx].title = e.target.value;
                                                    setExternalResources(newRes);
                                                }}
                                            />
                                            <Input
                                                placeholder="URL"
                                                value={res.url}
                                                onChange={(e) => {
                                                    const newRes = [...externalResources];
                                                    newRes[idx].url = e.target.value;
                                                    setExternalResources(newRes);
                                                }}
                                            />
                                        </div>
                                        <button onClick={() => setExternalResources(externalResources.filter((_, i) => i !== idx))} className="mt-2 text-[var(--color-text-subtle)] hover:text-red-500">
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                ))}
                                {externalResources.length === 0 && <p className="text-sm text-[var(--color-text-muted)] italic">No shortcuts added.</p>}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Project Settings" size="xl">
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
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button variant="primary" onClick={handleSave} isLoading={isSaving}>Save Changes</Button>
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
