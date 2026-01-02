import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { auth } from '../services/firebase';
import { getProjectIdeas, getUserTasks } from '../services/dataService';
import { useTheme } from '../context/ThemeContext';
import { ProjectSwitcher } from './ProjectSwitcher';
import { NotificationDropdown } from './NotificationDropdown';
import { WorkspaceTeamIndicator } from './WorkspaceTeamIndicator';
import { useLanguage } from '../context/LanguageContext';

type SidebarProps = {
    isDrawer?: boolean;
    onClose?: () => void;
    workspace?: {
        projectId: string;
        projectTitle?: string;
        tasksCount?: number;
        ideasCount?: number;
        issuesCount?: number;
        modules?: string[];
        externalResources?: { title: string; url: string; icon?: string }[];
        isLoaded?: boolean; // New flag to prevent flickering
        navPrefs?: { order: string[]; hidden: string[] }; // User-specific nav preferences
    };
};

// ----------------------------------------------------------------------
// Styled Nav Item
// ----------------------------------------------------------------------

const NavItem = ({
    to,
    icon,
    label,
    badge,
    onClick,
    exact = false,
    disabled = false
}: {
    to: string;
    icon: string;
    label: string;
    badge?: number;
    onClick?: () => void;
    exact?: boolean;
    disabled?: boolean;
}) => {
    const location = useLocation();
    const isActive = exact
        ? location.pathname === to
        : to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to);

    if (disabled) {
        return (
            <div className="flex items-center gap-3.5 px-3 py-2 text-[var(--color-text-muted)] opacity-30 cursor-not-allowed">
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
                <span className="text-[14px]/none font-medium text-inherit">{label}</span>
            </div>
        );
    }

    return (
        <Link
            to={to}
            onClick={onClick}
            className={`
                group relative flex items-center gap-3.5 px-3.5 py-2 rounded-xl transition-all duration-300
                ${isActive
                    ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] font-bold shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]/40 hover:text-[var(--color-text-main)]'}
            `}
        >
            {/* Elegant Active Indicator */}
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-[var(--color-primary)] rounded-r-full shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.6)]" />
            )}

            <span
                className={`material-symbols-outlined text-[20px] transition-all duration-300 ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)] overflow-hidden'}`}
            >
                {icon}
            </span>
            <span className="text-[14px]/none flex-1 truncate tracking-tight font-medium group-hover:translate-x-0.5 transition-transform duration-300">{label}</span>

            {badge !== undefined && badge > 0 && (
                <div className={`
                    flex items-center justify-center min-w-[20px] h-5 rounded-full px-1 transition-all duration-300
                    ${isActive
                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] scale-100 shadow-lg shadow-[var(--color-primary)]/20'
                        : 'bg-[var(--color-surface-border)] text-[var(--color-text-muted)]'}
                `}>
                    <span className={`text-[10px] font-black leading-none ${isActive ? 'scale-90' : ''}`}>{badge}</span>
                </div>
            )}
        </Link>
    );
};

// ----------------------------------------------------------------------
// Sidebar Component
// ----------------------------------------------------------------------

export const Sidebar = ({ isDrawer = false, onClose, workspace }: SidebarProps) => {
    const user = auth.currentUser;
    const { theme } = useTheme();

    const { t } = useLanguage();

    // Data Loaders for badges
    const [taskCount, setTaskCount] = React.useState<number>(0);
    const [ideaCount, setIdeaCount] = React.useState<number>(0);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [tasks, ideas] = await Promise.all([
                    getUserTasks(),
                    getProjectIdeas('').catch(() => [])
                ]);
                if (mounted && user) {
                    const myIncompleteTasks = Array.isArray(tasks) ? tasks.filter(t =>
                        !t.isCompleted &&
                        (t.assigneeId === user.uid || (t.assigneeIds && t.assigneeIds.includes(user.uid)))
                    ) : [];
                    setTaskCount(myIncompleteTasks.length);
                    setIdeaCount(Array.isArray(ideas) ? ideas.length : 0);
                }
            } catch (e) {
                console.warn('Failed to load counts', e);
            }
        })();
        return () => { mounted = false; };
    }, [user]);

    // Derived State: Is inside a project?
    const isProjectActive = Boolean(workspace?.projectId);

    return (
        <aside
            className={`
                flex flex-col bg-[var(--color-surface-card)] border-r border-[var(--color-surface-border)]
                ${isDrawer ? 'w-full h-full' : 'hidden md:flex w-[280px]'}
                transition-all duration-300 relative z-20
            `}
        >
            {/* 1. Header Area */}
            <div className="flex flex-col gap-4 p-4 pb-2">
                <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <ProjectSwitcher
                            currentProjectId={workspace?.projectId}
                            currentProjectTitle={workspace?.projectTitle}
                            onClose={onClose}
                        />
                    </div>
                    {isDrawer && (
                        <button
                            onClick={onClose}
                            className="size-8 rounded-full hover:bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-muted)] shrink-0"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                </div>

                {/* New Project Button - Premium Design */}
                <Link
                    to="/create"
                    onClick={isDrawer ? onClose : undefined}
                    className="
                        group relative w-full flex items-center justify-center gap-3 px-4 py-2.5 
                        bg-[var(--color-primary)] text-[var(--color-primary-text)] font-bold text-[13px]
                        rounded-xl shadow-xl shadow-[var(--color-primary)]/15
                        hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden
                    "
                >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    <span className="tracking-tight">{t('nav.newProject')}</span>
                </Link>
            </div>

            {/* 2. Scrollable Navigation Area */}
            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-none">

                {/* Scope: Global Workspace */}
                <div>
                    <div className="flex items-center gap-3 px-1 mb-3">
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] opacity-50">
                            {t('nav.workspace')}
                        </span>
                        <div className="flex-1 h-px bg-gradient-to-r from-[var(--color-surface-border)]/50 to-transparent" />
                    </div>

                    <div className="grid gap-1">
                        <NavItem to="/" icon="space_dashboard" label={t('nav.dashboard')} exact onClick={isDrawer ? onClose : undefined} />
                        <NavItem to="/projects" icon="layers" label={t('nav.projects')} onClick={isDrawer ? onClose : undefined} />
                        <NavItem to="/tasks" icon="task_alt" label={t('nav.myTasks')} badge={taskCount} onClick={isDrawer ? onClose : undefined} />
                        <NavItem to="/calendar" icon="calendar_today" label={t('nav.calendar')} onClick={isDrawer ? onClose : undefined} />
                        <NavItem to="/brainstorm" icon="auto_awesome" label={t('nav.aiStudio')} badge={ideaCount} onClick={isDrawer ? onClose : undefined} />
                        <NavItem to="/team" icon="group" label={t('nav.team')} onClick={isDrawer ? onClose : undefined} />
                    </div>
                </div>

                {/* Scope: Current Context (Active Project) */}
                {isProjectActive && workspace && workspace.isLoaded && (
                    <div className="animate-fade-in-down">
                        <div className="flex items-center gap-3 px-1 mb-3">
                            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] opacity-50">
                                {t('nav.projectContext')}
                            </span>
                            <div className="flex-1 h-px bg-gradient-to-r from-[var(--color-surface-border)]/50 to-transparent" />
                        </div>

                        <div className="grid gap-0.5">
                            {(() => {
                                // Default nav item definitions
                                const defaultNavItems = [
                                    { id: 'overview', path: '', icon: 'grid_view', label: t('nav.overview'), exact: true },
                                    { id: 'tasks', path: '/tasks', icon: 'checklist', label: t('nav.tasks'), moduleKey: 'tasks', badge: workspace.tasksCount },
                                    { id: 'sprints', path: '/sprints', icon: 'directions_run', label: t('nav.sprints'), moduleKey: 'sprints' },
                                    { id: 'issues', path: '/issues', icon: 'medication', label: t('nav.issues'), moduleKey: 'issues', badge: workspace.issuesCount },
                                    { id: 'ideas', path: '/flows', icon: 'emoji_objects', label: t('nav.flows'), moduleKey: 'ideas', badge: workspace.ideasCount },
                                    { id: 'milestones', path: '/milestones', icon: 'outlined_flag', label: t('nav.milestones'), moduleKey: 'milestones' },
                                    { id: 'social', path: '/social', icon: 'campaign', label: t('nav.social'), moduleKey: 'social' },
                                    { id: 'marketing', path: '/marketing', icon: 'ads_click', label: t('nav.marketing'), moduleKey: 'marketing' },
                                    { id: 'activity', path: '/activity', icon: 'history', label: t('nav.activity'), moduleKey: 'activity' },
                                ];

                                // Get the order (custom or default)
                                const order = workspace.navPrefs?.order?.length
                                    ? workspace.navPrefs.order
                                    : defaultNavItems.map(n => n.id);

                                // Sort items by the order
                                const orderedItems = order
                                    .map(id => defaultNavItems.find(n => n.id === id))
                                    .filter((item): item is typeof defaultNavItems[0] => !!item);

                                // Add any items not in the order (fallback)
                                defaultNavItems.forEach(item => {
                                    if (!orderedItems.find(o => o.id === item.id)) {
                                        orderedItems.push(item);
                                    }
                                });

                                // Get hidden items
                                const hiddenItems = workspace.navPrefs?.hidden || [];

                                // Filter and render
                                return orderedItems
                                    .filter(item => {
                                        // Check if module is enabled (or has no module requirement)
                                        const moduleEnabled = !item.moduleKey ||
                                            !workspace.modules ||
                                            workspace.modules.includes(item.moduleKey);
                                        // Check if not hidden by user
                                        const notHidden = !hiddenItems.includes(item.id);
                                        return moduleEnabled && notHidden;
                                    })
                                    .map(item => (
                                        <NavItem
                                            key={item.id}
                                            to={`/project/${workspace.projectId}${item.path}`}
                                            icon={item.icon}
                                            label={item.label}
                                            exact={item.exact}
                                            badge={item.badge}
                                            onClick={isDrawer ? onClose : undefined}
                                        />
                                    ));
                            })()}

                            {/* Resources Section - Integrated as NavItems */}
                            {workspace.externalResources && workspace.externalResources.length > 0 && (
                                <div className="mt-5 space-y-1">
                                    <div className="flex items-center gap-3 px-1 mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] opacity-50">
                                            {t('sidebar.resources')}
                                        </span>
                                        <div className="flex-1 h-px bg-gradient-to-r from-[var(--color-surface-border)]/50 to-transparent" />
                                    </div>
                                    <div className="grid gap-0.5">
                                        {workspace.externalResources.map((res, idx) => (
                                            <a
                                                key={idx}
                                                href={res.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group relative flex items-center gap-3.5 px-3.5 py-2 rounded-xl transition-all duration-300 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]/40 hover:text-[var(--color-text-main)]"
                                                onClick={isDrawer ? onClose : undefined}
                                            >
                                                <span className="material-symbols-outlined text-[20px] transition-all duration-300 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)] group-hover:translate-y-[-1px]">
                                                    {res.icon || 'link'}
                                                </span>
                                                <span className="text-[14px]/none flex-1 truncate tracking-tight font-medium group-hover:translate-x-0.5 transition-transform duration-300">
                                                    {res.title}
                                                </span>
                                                <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-40 transition-opacity">open_in_new</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </nav>

            {/* 3. Footer */}
            <div className="p-4 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-card)] space-y-4">


                {/* Theme Toggle + Notification Bell Row */}
                <div className="flex items-center justify-between">
                    <ThemeToggle />
                    <NotificationDropdown position="sidebar" />
                </div>

                {/* Workspace Team Presence Indicator */}
                <WorkspaceTeamIndicator onClose={isDrawer ? onClose : undefined} />
            </div>
        </aside>
    );
};

// ----------------------------------------------------------------------
// Internal Micro-Components
// ----------------------------------------------------------------------

const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();
    return (
        <div className="inline-flex bg-[var(--color-surface-hover)] p-0.5 rounded-full border border-[var(--color-surface-border)]">
            <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${theme === 'light' ? 'bg-white text-yellow-600 shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                    }`}
            >
                <span className="material-symbols-outlined text-[14px]">light_mode</span>
                <span>{t('theme.light')}</span>
            </button>
            <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${theme === 'dark' ? 'bg-slate-700 text-indigo-200 shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                    }`}
            >
                <span className="material-symbols-outlined text-[14px]">dark_mode</span>
                <span>{t('theme.dark')}</span>
            </button>
        </div>
    );
};
