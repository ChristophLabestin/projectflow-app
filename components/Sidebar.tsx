import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { getProjectIdeas, getUserTasks } from '../services/dataService';

type SidebarProps = {
    isDrawer?: boolean;
    onClose?: () => void;
    workspace?: {
        projectId: string;
        projectTitle?: string;
        tasksCount?: number;
        ideasCount?: number;
        modules?: string[];
        externalResources?: { title: string; url: string; icon?: string }[];
    };
};

const NavItem = ({
    to,
    icon,
    label,
    badge,
    onClick,
    exact = false,
    isSubItem = false
}: {
    to: string;
    icon: string;
    label: string;
    badge?: number;
    onClick?: () => void;
    exact?: boolean;
    isSubItem?: boolean;
}) => {
    const location = useLocation();
    const isActive = exact
        ? location.pathname === to
        : to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to);

    return (
        <Link
            to={to}
            onClick={onClick}
            className={`
                group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                ${isSubItem ? 'ml-4' : ''}
                ${isActive
                    ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] font-bold shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'}
            `}
        >
            <span
                className={`material-symbols-outlined text-[20px] transition-colors ${isActive ? 'text-[var(--color-text-main)]' : 'group-hover:text-[var(--color-text-main)]'}`}
            >
                {icon}
            </span>
            <span className="text-sm flex-1 truncate">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className={`
                    text-[10px] font-bold px-2 py-0.5 rounded-full 
                    ${isActive
                        ? 'bg-[var(--color-text-main)] text-[var(--color-surface-bg)]'
                        : 'bg-[var(--color-surface-border)] text-[var(--color-text-muted)] group-hover:bg-[var(--color-surface-border)]'}
                `}>
                    {badge}
                </span>
            )}
        </Link>
    );
};

export const Sidebar = ({ isDrawer = false, onClose, workspace }: SidebarProps) => {
    const navigate = useNavigate();
    const user = auth.currentUser;
    const [taskCount, setTaskCount] = React.useState<number>(0);
    const [ideaCount, setIdeaCount] = React.useState<number>(0);
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);

    // Fetch global counts (only if we are not in a workspace or just to show global badge context?)
    // Let's keep it simple: always fetch global counts for the main menu to keep it alive
    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                // If we are in a workspace, we might not need to fetch global tasks/ideas urgently if we want to save reads,
                // but checking overall "Tasks" count is useful.
                const [tasks, ideas] = await Promise.all([
                    getUserTasks(),
                    getProjectIdeas('').catch(() => [])
                ]);
                if (mounted) {
                    setTaskCount(Array.isArray(tasks) ? tasks.filter(t => !t.isCompleted).length : 0);
                    setIdeaCount(Array.isArray(ideas) ? ideas.length : 0);
                }
            } catch (e) {
                console.warn('Failed to load counts', e);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <aside
            className={`
                flex flex-col bg-[var(--color-surface-card)] border-r border-[var(--color-surface-border)]
                ${isDrawer ? 'w-full h-full' : 'hidden md:flex w-72'}
                transition-all duration-300
            `}
        >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-[var(--color-surface-border)]">
                <img src="/assets/logo.svg" alt="ProjectFlow" className="size-8 object-contain" />
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold leading-tight text-[var(--color-text-main)] tracking-tight">ProjectFlow</h2>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">Workspace</p>
                </div>
                {isDrawer && (
                    <button
                        onClick={onClose}
                        className="size-8 rounded-full hover:bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-muted)]"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                )}
            </div>

            {/* Quick Action */}
            <div className="px-4 py-4">
                <Link
                    to="/create"
                    onClick={isDrawer ? onClose : undefined}
                    className="
                        w-full flex items-center justify-center gap-2 px-4 py-2.5 
                        bg-[var(--color-primary)] text-white 
                        dark:text-black
                        hover:bg-opacity-90 hover:shadow-lg
                        rounded-xl text-sm font-semibold transition-all duration-200
                        active:scale-95 shadow-md shadow-gray-900/10
                    "
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    New Project
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 px-4 flex-1 overflow-y-auto">

                {/* Workspace Context (If Active) */}
                {workspace?.projectId && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 px-3 mb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">Active Project</span>
                        </div>
                        <div className="bg-[var(--color-surface-bg)] rounded-2xl p-2 border border-[var(--color-surface-border)]">
                            <NavItem
                                to={`/project/${workspace.projectId}`}
                                icon="space_dashboard"
                                label="Overview"
                                exact
                                onClick={isDrawer ? onClose : undefined}
                            />

                            {/* Module: Tasks */}
                            {(!workspace.modules || workspace.modules.includes('tasks')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/tasks`}
                                    icon="checklist"
                                    label="Tasks"
                                    badge={workspace.tasksCount}
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}

                            {/* Module: Ideas */}
                            {(!workspace.modules || workspace.modules.includes('ideas')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/ideas`}
                                    icon="lightbulb"
                                    label="Ideas"
                                    badge={workspace.ideasCount}
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}

                            {/* Module: Mindmap */}
                            {(!workspace.modules || workspace.modules.includes('mindmap')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/mindmap`}
                                    icon="hub"
                                    label="Mindmap"
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}

                            {/* Module: Activity */}
                            {(!workspace.modules || workspace.modules.includes('activity')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/activity`}
                                    icon="history"
                                    label="Activity"
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}

                            {/* Module: Issues */}
                            {(!workspace.modules || workspace.modules.includes('issues')) && (
                                <NavItem
                                    to={`/project/${workspace.projectId}/issues`}
                                    icon="bug_report"
                                    label="Issues"
                                    onClick={isDrawer ? onClose : undefined}
                                />
                            )}

                            {/* External Resources */}
                            {workspace.externalResources && workspace.externalResources.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-[var(--color-surface-border)]">
                                    <p className="px-3 mb-1 text-[10px] uppercase font-bold text-[var(--color-text-subtle)]">Links</p>
                                    {workspace.externalResources.map((res, idx) => (
                                        <a
                                            key={idx}
                                            href={res.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex items-center gap-3 px-3 py-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)] transition-all duration-200"
                                            onClick={isDrawer ? onClose : undefined}
                                        >
                                            <span className="material-symbols-outlined text-[18px] group-hover:text-[var(--color-text-main)]">{res.icon || 'open_in_new'}</span>
                                            <span className="text-sm flex-1 truncate">{res.title}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                            <div className="h-px bg-[var(--color-surface-border)] my-2 mx-2" />
                            <Link
                                to="/"
                                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                                Back to Dashboard
                            </Link>
                        </div>
                    </div>
                )}

                {/* Main Menu */}
                <div className="mb-2">
                    <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">
                        Main Menu
                    </p>
                    <NavItem to="/" icon="dashboard" label="Dashboard" exact onClick={isDrawer ? onClose : undefined} />
                    <NavItem to="/calendar" icon="calendar_month" label="Calendar" onClick={isDrawer ? onClose : undefined} />
                    <NavItem to="/projects" icon="folder" label="Projects" onClick={isDrawer ? onClose : undefined} />
                    <NavItem to="/tasks" icon="check_circle" label="My Tasks" badge={taskCount} onClick={isDrawer ? onClose : undefined} />
                    <NavItem to="/brainstorm" icon="auto_awesome" label="AI Studio" badge={ideaCount} onClick={isDrawer ? onClose : undefined} />
                    <NavItem to="/team" icon="group" label="Team" onClick={isDrawer ? onClose : undefined} />
                </div>
            </nav>

            {/* Footer / User Profile */}
            <div className="p-4 border-t border-[var(--color-surface-border)]">

                {/* Theme Toggle Area */}
                <div className="mb-3 flex justify-start">
                    <ThemeToggle />
                </div>

                {/* User Card & Menu Container */}
                <div className="relative">

                    {/* User Menu Dropdown */}
                    {isUserMenuOpen && (
                        <>
                            {/* Backdrop */}
                            <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}></div>

                            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] shadow-2xl rounded-xl z-20 overflow-hidden animate-fade-up ring-1 ring-black/5 dark:ring-white/10">
                                <div className="p-2 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-hover)]/30">
                                    <p className="px-2 text-xs font-bold text-[var(--color-text-muted)] uppercase">My Account</p>
                                </div>
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
                                    <span className="text-sm font-medium">Team Settings</span>
                                </Link>
                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 transition-colors text-left"
                                >
                                    <span className="material-symbols-outlined text-[20px]">logout</span>
                                    <span className="text-sm font-medium">Log Out</span>
                                </button>
                            </div>
                        </>
                    )}

                    <div
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className={`flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer group ${isUserMenuOpen ? 'bg-[var(--color-surface-hover)] border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]' : 'bg-transparent border-transparent hover:bg-[var(--color-surface-hover)]'}`}
                    >
                        <div
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border border-[var(--color-surface-border)] shadow-sm shrink-0"
                            style={{
                                backgroundImage: user?.photoURL
                                    ? `url("${user.photoURL}")`
                                    : 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAUDnuDd21ZOybk43aAFZMF8BuZPooFbf615qSB3FofT8gp9e1995VjvW8jb9otnKFfzKlRUh60cKlpKWO3PvuhE5SmZa8nS03FSRIcFLcXxBiGJtYkrxjsmdGVHcgXXCySiQs7nDjqbvc0w8WmGBVGn6T-oQ43k7QWEmuuRT63iGTXNcnzfTKZ9eU-yYSgTWcRFORG_HHCxTuCFSUWxbu8OjYbx5-4qd8bOwHJCBM2tr-e5Ml5LlAUucWxYA4xRF_69RInugzbiW0")'
                            }}
                        ></div>
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-sm font-bold text-[var(--color-text-main)] truncate">{user?.displayName || 'User'}</span>
                            <span className="text-[11px] text-[var(--color-text-muted)] truncate">{user?.email}</span>
                        </div>
                        <span className={`material-symbols-outlined text-[var(--color-text-muted)] transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`}>expand_less</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};

// Internal Theme Toggle Component
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex bg-[var(--color-surface-hover)] p-1 rounded-full border border-[var(--color-surface-border)] relative w-fit">
            <button
                onClick={() => setTheme('light')}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${theme === 'light'
                    ? 'text-yellow-600 bg-white shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                    }`}
            >
                <span className="material-symbols-outlined text-[16px]">light_mode</span>
                <span>Light</span>
            </button>
            <button
                onClick={() => setTheme('dark')}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${theme === 'dark'
                    ? 'text-indigo-200 bg-slate-800 shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                    }`}
            >
                <span className="material-symbols-outlined text-[16px]">dark_mode</span>
                <span>Dark</span>
            </button>
        </div>
    );
};
