import React, { useEffect, useState, useMemo } from 'react';
import { Outlet, useLocation, useParams, useNavigate, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './ui/Breadcrumbs';
import { AISearchBar } from './AISearchBar';
import { PinnedProjectPill } from './PinnedProjectPill';
import { TaskCreateModal } from './TaskCreateModal';
import { useUIState } from '../context/UIContext';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../services/firebase';
import { getProjectById, getProjectIdeas, getProjectTasks, getUserProjects, subscribeProject, getProjectIssues, subscribeProjectTasks, subscribeProjectIssues, subscribeProjectIdeas } from '../services/dataService';
import { Project } from '../types';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { getSubTasks } from '../services/dataService';
import { SubTask } from '../types';


const PinnedTasksToggle = () => {
    const { toggleModal, pinnedItems, focusItemId } = usePinnedTasks();
    const hasItems = pinnedItems.length > 0;

    // Get the focused item details
    const focusItem = focusItemId ? pinnedItems.find(i => i.id === focusItemId) : null;

    // Fetch subtask counts for focus item
    const [subtaskStats, setSubtaskStats] = useState<{ done: number; total: number } | null>(null);

    useEffect(() => {
        if (!focusItemId || !focusItem || focusItem.type !== 'task') {
            setSubtaskStats(null);
            return;
        }

        let mounted = true;
        getSubTasks(focusItemId).then(subs => {
            if (mounted) {
                setSubtaskStats({
                    done: subs.filter(s => s.isCompleted).length,
                    total: subs.length
                });
            }
        }).catch(() => {
            if (mounted) setSubtaskStats(null);
        });

        return () => { mounted = false; };
    }, [focusItemId, focusItem?.type]);

    // Compact view when no focus
    if (!focusItem) {
        return (
            <button
                onClick={toggleModal}
                className={`
                    relative flex items-center justify-center h-[42px] w-[42px] rounded-full transition-all
                    ${hasItems ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}
                `}
                title="Pinned Tasks (Cmd+Shift+F)"
            >
                <span className="material-symbols-outlined text-[20px]">push_pin</span>
            </button>
        );
    }

    // Extended view with focus task info
    return (
        <button
            onClick={toggleModal}
            className="flex items-center gap-2.5 h-[42px] pl-3 pr-4 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all group"
            title="Focus Task (Cmd+Shift+F)"
        >
            <div className="relative shrink-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px] text-amber-600 dark:text-amber-400">center_focus_strong</span>
                <span className="absolute -top-0.5 -right-0.5 size-1.5 bg-amber-500 rounded-full animate-pulse" />
            </div>
            <div className="flex flex-col items-start min-w-0 leading-none">
                <span className="text-[11px] font-semibold text-[var(--color-text-main)] truncate max-w-[160px]">
                    {focusItem.title}
                </span>
                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                    {subtaskStats && subtaskStats.total > 0
                        ? `${subtaskStats.done}/${subtaskStats.total} done`
                        : 'Focus'
                    }
                </span>
            </div>
            <span className="material-symbols-outlined text-[14px] text-amber-600 dark:text-amber-400">expand_more</span>
        </button>
    );
};

export const AppLayout = () => {
    const { id: paramProjectId } = useParams<{ id: string }>();
    const { theme } = useTheme();
    const { isTaskCreateModalOpen, closeTaskCreateModal, taskCreateProjectId } = useUIState();
    const location = useLocation();

    // Derived project ID from URL if not in params (e.g. nested routes)
    const derivedProjectId = useMemo(() => {
        const match = location.pathname.match(/\/project\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    const projectId = paramProjectId || derivedProjectId;

    const [navOpen, setNavOpen] = useState(false);
    const [project, setProject] = useState<Project | null>(null);
    const [tasksCount, setTasksCount] = useState(0);
    const [ideasCount, setIdeasCount] = useState(0);
    const [issuesCount, setIssuesCount] = useState(0);
    const [projectMenuOpen, setProjectMenuOpen] = useState(false);
    const [projectOptions, setProjectOptions] = useState<Project[]>([]);
    const [taskTitle, setTaskTitle] = useState<string | null>(null);

    const user = auth?.currentUser;
    const navigate = useNavigate();

    // Close nav on route change
    useEffect(() => {
        setNavOpen(false);
        setProjectMenuOpen(false);
        setTaskTitle(null);
    }, [location.pathname]);

    // Fetch Project Data if we are in a project
    useEffect(() => {
        if (!projectId) {
            setProject(null);
            return;
        }

        let mounted = true;
        let unsubProject: (() => void) | undefined;
        let unsubTasks: (() => void) | undefined;
        let unsubIdeas: (() => void) | undefined;
        let unsubIssues: (() => void) | undefined;

        // First, find the project to get its tenant
        getProjectById(projectId).then(async (foundProject) => {
            if (!mounted || !foundProject) {
                if (mounted) setProject(null);
                return;
            }

            const projectTenantId = foundProject.tenantId;

            // Subscribe to project updates with the correct tenant
            unsubProject = subscribeProject(projectId, (p) => {
                if (mounted) setProject(p);
            }, projectTenantId);

            // Subscribe to tasks for real-time counts
            unsubTasks = subscribeProjectTasks(projectId, (tasks) => {
                if (mounted) {
                    const openTasks = tasks.filter(t => !t.isCompleted && t.status !== 'Done');
                    setTasksCount(openTasks.length);
                }
            }, projectTenantId);

            // Subscribe to ideas for real-time counts
            unsubIdeas = subscribeProjectIdeas(projectId, (ideas) => {
                if (mounted) {
                    setIdeasCount(ideas.length);
                }
            }, projectTenantId);

            // Subscribe to issues for real-time counts
            unsubIssues = subscribeProjectIssues(projectId, (issues) => {
                if (mounted) {
                    const unresolvedIssues = issues.filter(i => i.status !== 'Resolved' && i.status !== 'Closed');
                    setIssuesCount(unresolvedIssues.length);
                }
            }, projectTenantId);

        }).catch(err => {
            console.warn("Failed to load project data", err);
        });

        return () => {
            mounted = false;
            if (unsubProject) unsubProject();
            if (unsubTasks) unsubTasks();
            if (unsubIdeas) unsubIdeas();
            if (unsubIssues) unsubIssues();
        };
    }, [projectId]);

    // Global Breadcrumb Logic
    const breadcrumbs = useMemo(() => {
        const path = location.pathname;
        const rawItems: { label: string; to?: string }[] = [];

        // Always start with Dashboard or relevant root
        if (path === '/' || path === '/dashboard') {
            return [];
        }

        const parts = path.split('/').filter(Boolean);

        // Handle Projects Route
        if (parts[0] === 'projects') {
            rawItems.push({ label: 'Projects', to: '/projects' });
        }

        // Handle Individual Project Routes
        else if (parts[0] === 'project' && parts[1]) {
            rawItems.push({ label: 'Projects', to: '/projects' });

            // Project Title (or loading state)
            const pTitle = project?.title || 'Loading...';
            rawItems.push({ label: pTitle, to: `/project/${parts[1]}` });

            // Project Sub-pages
            if (parts[2]) {
                const sub = parts[2];
                switch (sub) {
                    case 'tasks':
                        rawItems.push({ label: 'Tasks', to: `/project/${parts[1]}/tasks` });
                        if (parts[3]) rawItems.push({ label: taskTitle || 'Task Details' });
                        break;
                    case 'ideas':
                        rawItems.push({ label: 'Ideas', to: `/project/${parts[1]}/ideas` });
                        break;
                    case 'issues':
                        rawItems.push({ label: 'Issues', to: `/project/${parts[1]}/issues` });
                        break;
                    case 'activity':
                        rawItems.push({ label: 'Activity', to: `/project/${parts[1]}/activity` });
                        break;
                    default:
                        rawItems.push({ label: sub.charAt(0).toUpperCase() + sub.slice(1) });
                }
            }
        }

        // Handle Other Top-Level Routes
        else if (parts[0] === 'tasks') {
            rawItems.push({ label: 'My Tasks' });
        } else if (parts[0] === 'brainstorm') {
            rawItems.push({ label: 'AI Studio' });
        } else if (parts[0] === 'team') {
            rawItems.push({ label: 'Team' });
        } else if (parts[0] === 'calendar') {
            rawItems.push({ label: 'Calendar' });
        } else if (parts[0] === 'settings') {
            rawItems.push({ label: 'Settings' });
        } else if (parts[0] === 'create') {
            rawItems.push({ label: 'New Project' });
        } else if (parts[0] === 'profile') {
            rawItems.push({ label: 'Profile' });
        }

        // Finalize: Remove link from the last item
        return rawItems.map((item, idx) => {
            if (idx === rawItems.length - 1) {
                const { to, ...rest } = item;
                return rest;
            }
            return item;
        });
    }, [location.pathname, project, taskTitle]);

    return (
        <div className="flex h-screen w-full bg-[var(--color-surface-bg)] overflow-hidden">
            {/* Sidebar Desktop */}
            <div className="hidden md:flex flex-shrink-0 h-full">
                <Sidebar
                    workspace={projectId ? {
                        projectId,
                        projectTitle: project?.title,
                        tasksCount,
                        ideasCount,
                        issuesCount,
                        modules: project?.modules,
                        externalResources: project?.externalResources,
                        isLoaded: Boolean(project)
                    } : undefined}
                />
            </div>

            {/* Mobile Sidebar Drawer */}
            {navOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    <div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setNavOpen(false)}
                    />
                    <div className="relative w-4/5 max-w-xs h-full bg-[var(--color-surface-card)] shadow-2xl animate-fade-in-left">
                        <Sidebar
                            isDrawer
                            onClose={() => setNavOpen(false)}
                            workspace={projectId ? {
                                projectId,
                                projectTitle: project?.title,
                                tasksCount,
                                ideasCount,
                                issuesCount,
                                modules: project?.modules,
                                externalResources: project?.externalResources,
                                isLoaded: Boolean(project)
                            } : undefined}
                        />
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative">

                {/* Header */}
                <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-card)] sticky top-0 z-30">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <button
                            onClick={() => setNavOpen(true)}
                            className="md:hidden p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] shrink-0"
                        >
                            <span className="material-symbols-outlined">menu</span>
                        </button>

                        {/* Global Breadcrumbs */}
                        <div className="flex-1 min-w-0">
                            <Breadcrumbs items={breadcrumbs} />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Pinned Tasks Toggle */}
                        <PinnedProjectPill />
                        <PinnedTasksToggle />

                        {/* AI-Powered Search (Mobile/Desktop) */}
                        <div className="hidden sm:block relative w-80 h-[42px] shrink-0">
                            <AISearchBar />
                        </div>
                    </div>
                </header>

                {/* Main Scroll Area */}
                <main className={`flex-1 w-full dotted-bg ${location.pathname === '/create' || location.pathname.includes('/social') || location.pathname.includes('/marketing') ? 'p-0 overflow-hidden' : 'overflow-y-auto p-4 sm:p-6 lg:p-8'}`}>
                    <div className={`${location.pathname === '/create' || location.pathname.includes('/social') || location.pathname.includes('/marketing') ? 'w-full h-full' : 'max-w-7xl mx-auto h-full'}`}>
                        <Outlet context={{ setTaskTitle }} />
                    </div>
                </main>

            </div>
            {/* Global Task Create Modal */}
            {isTaskCreateModalOpen && (
                <TaskCreateModal
                    isOpen={isTaskCreateModalOpen}
                    onClose={closeTaskCreateModal}
                    projectId={taskCreateProjectId || undefined}
                />
            )}
        </div>
    );
};
