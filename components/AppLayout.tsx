import React, { useEffect, useState, useMemo } from 'react';
import { Outlet, useLocation, useParams, useNavigate, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './ui/Breadcrumbs';
import { AISearchBar } from './AISearchBar';
import { auth } from '../services/firebase';
import { getProjectById, getProjectIdeas, getProjectTasks, getUserProjects, subscribeProject, getProjectIssues, subscribeProjectTasks, subscribeProjectIssues, subscribeProjectIdeas } from '../services/dataService';
import { Project } from '../types';

export const AppLayout = () => {
    const { id: paramProjectId } = useParams<{ id: string }>();
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

                    <div className="flex items-center shrink-0">
                        {/* AI-Powered Search (Mobile/Desktop) */}
                        <div className="hidden sm:block relative w-80 h-[42px] shrink-0">
                            <AISearchBar />
                        </div>
                    </div>
                </header>

                {/* Main Scroll Area */}
                <main className={`flex-1 overflow-y-auto w-full dotted-bg ${location.pathname === '/create' || location.pathname.includes('/social') ? 'p-0 overflow-hidden' : 'p-4 sm:p-6 lg:p-8'}`}>
                    <div className={`${location.pathname === '/create' || location.pathname.includes('/social') ? 'w-full h-full' : 'max-w-7xl mx-auto h-full'}`}>
                        <Outlet context={{ setTaskTitle }} />
                    </div>
                </main>

            </div>
        </div>
    );
};
