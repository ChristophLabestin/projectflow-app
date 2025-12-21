import React, { useEffect, useState, useMemo } from 'react';
import { Outlet, useLocation, useParams, useNavigate, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './ui/Breadcrumbs';
import { auth } from '../services/firebase';
import { getProjectById, getProjectIdeas, getProjectTasks, getUserProjects, subscribeProject } from '../services/dataService';
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
    const [projectMenuOpen, setProjectMenuOpen] = useState(false);
    const [projectOptions, setProjectOptions] = useState<Project[]>([]);

    const user = auth?.currentUser;
    const navigate = useNavigate();

    // Close nav on route change
    useEffect(() => {
        setNavOpen(false);
        setProjectMenuOpen(false);
    }, [location.pathname]);

    // Fetch Project Data if we are in a project
    useEffect(() => {
        if (!projectId) {
            setProject(null);
            return;
        }

        let mounted = true;
        let unsubProject: (() => void) | undefined;

        (async () => {
            try {
                // Subscribe to project updates
                unsubProject = subscribeProject(projectId, (p) => {
                    if (mounted) setProject(p);
                });

                // Fetch counts
                const [tasks, ideas] = await Promise.all([
                    getProjectTasks(projectId),
                    getProjectIdeas(projectId)
                ]);

                if (mounted) {
                    setTasksCount(tasks.length);
                    setIdeasCount(ideas.length);
                }
            } catch (err) {
                console.warn("Failed to load project data", err);
            }
        })();

        return () => {
            mounted = false;
            if (unsubProject) unsubProject();
        };
    }, [projectId]);

    // Global Breadcrumb Logic
    const breadcrumbs = useMemo(() => {
        const path = location.pathname;
        const items: { label: string; to?: string }[] = [];

        // Always start with Dashboard or relevant root
        if (path === '/' || path === '/dashboard') {
            items.push({ label: 'Dashboard' });
            return items;
        }

        items.push({ label: 'Dashboard', to: '/' });

        const parts = path.split('/').filter(Boolean);

        // Handle Projects Route
        if (parts[0] === 'projects') {
            items.push({ label: 'Projects', to: '/projects' });
        }

        // Handle Individual Project Routes
        else if (parts[0] === 'project' && parts[1]) {
            items.push({ label: 'Projects', to: '/projects' });

            // Project Title (or loading state)
            const pTitle = project?.title || 'Loading...';
            items.push({ label: pTitle, to: `/project/${parts[1]}` });

            // Project Sub-pages
            if (parts[2]) {
                const sub = parts[2];
                switch (sub) {
                    case 'tasks':
                        items.push({ label: 'Tasks', to: `/project/${parts[1]}/tasks` });
                        if (parts[3]) items.push({ label: 'Task Details' });
                        break;
                    case 'ideas':
                        items.push({ label: 'Ideas', to: `/project/${parts[1]}/ideas` });
                        break;
                    case 'issues':
                        items.push({ label: 'Issues', to: `/project/${parts[1]}/issues` });
                        break;
                    case 'activity':
                        items.push({ label: 'Activity', to: `/project/${parts[1]}/activity` });
                        break;
                    default:
                        items.push({ label: sub.charAt(0).toUpperCase() + sub.slice(1) });
                }
            }
        }

        // Handle Other Top-Level Routes
        else if (parts[0] === 'create') {
            items.push({ label: 'New Project' });
        } else if (parts[0] === 'profile') {
            items.push({ label: 'Profile' });
        }

        return items;
    }, [location.pathname, project]);

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
                        modules: project?.modules,
                        externalResources: project?.externalResources
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
                                modules: project?.modules,
                                externalResources: project?.externalResources
                            } : undefined}
                        />
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative">

                {/* Header */}
                <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-card)]/80 backdrop-blur-md sticky top-0 z-30">
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
                        {/* Search (Mobile/Desktop) */}
                        <div className="hidden sm:flex items-center bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-full px-4 py-1.5 w-64 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                            <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">search</span>
                            <input
                                className="bg-transparent border-none focus:outline-none text-sm ml-2 w-full text-[var(--color-text-main)] placeholder-[var(--color-text-subtle)]"
                                placeholder="Search..."
                            />
                        </div>

                        {/* Top Right Actions */}
                        <button className="size-9 rounded-full hover:bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-muted)] transition-colors relative">
                            <span className="material-symbols-outlined text-[20px]">notifications</span>
                            <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                    </div>
                </header>

                {/* Main Scroll Area */}
                <main className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto h-full">
                        <Outlet />
                    </div>
                </main>

            </div>
        </div>
    );
};
