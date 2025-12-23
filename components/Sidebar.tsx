import React, { useMemo } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { getProjectIdeas, getUserTasks } from '../services/dataService';
import { useTheme } from '../context/ThemeContext';
import { ProjectSwitcher } from './ProjectSwitcher';
import { NotificationDropdown } from './NotificationDropdown';

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
                        ? 'bg-[var(--color-primary)] text-white dark:text-black scale-100 shadow-lg shadow-[var(--color-primary)]/20'
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
    const navigate = useNavigate();
    const user = auth.currentUser;
    const { theme } = useTheme();

    // Data Loaders for badges
    const [taskCount, setTaskCount] = React.useState<number>(0);
    const [ideaCount, setIdeaCount] = React.useState<number>(0);

    // User Menu State
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);

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

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            if (typeof localStorage !== 'undefined') localStorage.removeItem('activeTenantId');
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

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
                        bg-[var(--color-primary)] text-white dark:text-black font-bold text-[13px]
                        rounded-xl shadow-xl shadow-[var(--color-primary)]/15
                        hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden
                    "
                >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    <span className="tracking-tight">New Project</span>
                </Link>
            </div>

            {/* 2. Scrollable Navigation Area */}
            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-none">

                {/* Scope: Global Workspace */}
                <div>
                    <div className="flex items-center gap-3 px-1 mb-3">
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] opacity-50">
                            Workspace
                        </span>
                        <div className="flex-1 h-px bg-gradient-to-r from-[var(--color-surface-border)]/50 to-transparent" />
                    </div>

                    <div className="grid gap-1">
                        <NavItem to="/" icon="space_dashboard" label="Dashboard" exact onClick={isDrawer ? onClose : undefined} />
                        <NavItem to="/projects" icon="layers" label="Projects" onClick={isDrawer ? onClose : undefined} />
                        <NavItem to="/tasks" icon="task_alt" label="My Tasks" badge={taskCount} onClick={isDrawer ? onClose : undefined} />
                        <NavItem to="/calendar" icon="calendar_today" label="Calendar" onClick={isDrawer ? onClose : undefined} />
                        <NavItem to="/brainstorm" icon="auto_awesome" label="AI Studio" badge={ideaCount} onClick={isDrawer ? onClose : undefined} />
                        <NavItem to="/team" icon="group" label="Team" onClick={isDrawer ? onClose : undefined} />
                    </div>
                </div>

                {/* Scope: Current Context (Active Project) */}
                {isProjectActive && workspace && workspace.isLoaded && (
                    <div className="animate-fade-in-down">
                        <div className="flex items-center gap-3 px-1 mb-3">
                            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] opacity-50">
                                Project Context
                            </span>
                            <div className="flex-1 h-px bg-gradient-to-r from-[var(--color-surface-border)]/50 to-transparent" />
                        </div>

                        <div className="grid gap-0.5">
                            <NavItem
                                to={`/project/${workspace.projectId}`}
                                icon="grid_view"
                                label="Overview"
                                exact
                                onClick={isDrawer ? onClose : undefined}
                            />
                            {(!workspace.modules || workspace.modules.includes('tasks')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/tasks`}
                                    icon="checklist"
                                    label="Tasks"
                                    badge={workspace.tasksCount}
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}
                            {(!workspace.modules || workspace.modules.includes('ideas')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/ideas`}
                                    icon="emoji_objects"
                                    label="Ideas"
                                    badge={workspace.ideasCount}
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}
                            {(!workspace.modules || workspace.modules.includes('issues')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/issues`}
                                    icon="medication"
                                    label="Issues"
                                    badge={workspace.issuesCount}
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}
                            {(!workspace.modules || workspace.modules.includes('mindmap')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/mindmap`}
                                    icon="hub"
                                    label="Mindmap"
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}
                            {(!workspace.modules || workspace.modules.includes('milestones')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/milestones`}
                                    icon="outlined_flag"
                                    label="Milestones"
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}
                            {(!workspace.modules || workspace.modules.includes('social')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/social`}
                                    icon="campaign"
                                    label="Social"
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}
                            {(!workspace.modules || workspace.modules.includes('marketing')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/marketing`}
                                    icon="ads_click" // or 'campaign' or 'trending_up'
                                    label="Marketing"
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}
                            {(!workspace.modules || workspace.modules.includes('activity')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/activity`}
                                    icon="history"
                                    label="Activity"
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}

                            {/* Resources Section - Integrated as NavItems */}
                            {workspace.externalResources && workspace.externalResources.length > 0 && (
                                <div className="mt-5 space-y-1">
                                    <div className="flex items-center gap-3 px-1 mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] opacity-50">
                                            Resources
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

            {/* 3. Footer / User Profile */}
            <div className="p-4 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-card)]">

                {/* Theme Toggle + Notification Bell Row */}
                <div className="flex items-center justify-between mb-4">
                    <ThemeToggle />
                    <NotificationDropdown position="sidebar" />
                </div>

                {/* User Menu Dropdown (Absolute positioned upwards) */}
                <div className="relative">
                    {isUserMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}></div>
                            <div className="absolute bottom-full left-0 w-full mb-3 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] shadow-xl rounded-xl z-20 overflow-hidden ring-1 ring-black/5 dark:ring-white/10 animate-scale-up origin-bottom">
                                <Link
                                    to="/profile"
                                    onClick={() => { setIsUserMenuOpen(false); if (isDrawer && onClose) onClose(); }}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)] transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">badge</span>
                                    <span className="text-sm font-medium">Profile</span>
                                </Link>
                                <Link
                                    to="/settings"
                                    onClick={() => { setIsUserMenuOpen(false); if (isDrawer && onClose) onClose(); }}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)] transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">settings</span>
                                    <span className="text-sm font-medium">Settings</span>
                                </Link>
                                <div className="h-px bg-[var(--color-surface-border)] mx-2 my-1"></div>
                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 transition-colors text-left"
                                >
                                    <span className="material-symbols-outlined text-[20px]">logout</span>
                                    <span className="text-sm font-medium">Log out</span>
                                </button>
                            </div>
                        </>
                    )}

                    <div
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className={`
                            group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200
                            ${isUserMenuOpen ? 'bg-[var(--color-surface-hover)]' : 'hover:bg-[var(--color-surface-hover)]'}
                        `}
                    >
                        <div
                            className="size-9 rounded-full bg-cover bg-center border border-[var(--color-surface-border)] shrink-0 shadow-sm"
                            style={{ backgroundImage: user?.photoURL ? `url("${user.photoURL}")` : undefined }}
                        >
                            {!user?.photoURL && (
                                <div className="w-full h-full flex items-center justify-center bg-indigo-500 text-white font-bold rounded-full">
                                    {user?.displayName?.charAt(0) || 'U'}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-sm font-semibold text-[var(--color-text-main)] truncate">
                                {user?.displayName || 'User'}
                            </span>
                            <span className="text-[11px] text-[var(--color-text-muted)] truncate">
                                {user?.email}
                            </span>
                        </div>
                        <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)]">
                            unfold_more
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
};

// ----------------------------------------------------------------------
// Internal Micro-Components
// ----------------------------------------------------------------------

const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();
    return (
        <div className="inline-flex bg-[var(--color-surface-hover)] p-0.5 rounded-full border border-[var(--color-surface-border)]">
            <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${theme === 'light' ? 'bg-white text-yellow-600 shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                    }`}
            >
                <span className="material-symbols-outlined text-[14px]">light_mode</span>
                <span>Light</span>
            </button>
            <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${theme === 'dark' ? 'bg-slate-700 text-indigo-200 shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                    }`}
            >
                <span className="material-symbols-outlined text-[14px]">dark_mode</span>
                <span>Dark</span>
            </button>
        </div>
    );
};
