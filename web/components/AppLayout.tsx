import { WelcomeDialog } from './onboarding/WelcomeDialog';
import React, { Suspense, lazy, useEffect, useState, useMemo } from 'react';
import { Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import { useUIState } from '../context/UIContext';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../services/firebase';
import { subscribeUserProjectNavPrefs } from '../services/dataService';
import { Project, ProjectExternalResource } from '../types';
import { useWorkspacePresence } from '../hooks/usePresence';
import { useLanguage } from '../context/LanguageContext';
import { getProjectById, subscribeProject } from '../services/domain/projectsService';
import { subscribeUserStatusPreference } from '../services/domain/userStatusService';
import { subscribeProjectTasks } from '../services/domain/tasksService';
import { isProjectExcludedFromHealth } from '../services/healthService';
import { isClientProject } from '../config/projectTemplates';

const Sidebar = lazy(() => import('./Sidebar').then((module) => ({ default: module.Sidebar })));
const TopBar = lazy(() => import('./TopBar').then((module) => ({ default: module.TopBar })));
const TaskCreateModal = lazy(() => import('./TaskCreateModal').then((module) => ({ default: module.TaskCreateModal })));
const CreateProjectModal = lazy(() => import('./CreateProjectModal').then((module) => ({ default: module.CreateProjectModal })));

// Per user: a shared device should not hand one person's collapsed sidebar to the next.
const wideStorageKey = () => `projectflow.projectOverview.wide.${auth.currentUser?.uid || 'anonymous'}`;

export const AppLayout = () => {
    const { id: paramProjectId } = useParams<{ id: string }>();
    const { theme } = useTheme();
    const {
        isTaskCreateModalOpen, closeTaskCreateModal, taskCreateProjectId, taskCreateAllowProjectSelect,
        isProjectCreateModalOpen, closeProjectCreateModal
    } = useUIState();
    const location = useLocation();
    const isFullWidthRoute = location.pathname.includes('/marketing')
        || location.pathname.includes('/activity')
        || location.pathname.includes('/team')
        || location.pathname.includes('/brainstorm');

    // Derived project ID from URL if not in params (e.g. nested routes)
    const derivedProjectId = useMemo(() => {
        const match = location.pathname.match(/\/project\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    const projectId = paramProjectId || derivedProjectId;
    const resolvedTaskCreateProjectId = taskCreateProjectId || projectId || null;

    const [navOpen, setNavOpen] = useState(false);
    const [project, setProject] = useState<Project | null>(null);
    const [companyProject, setCompanyProject] = useState<Project | null>(null);
    const [tasksCount, setTasksCount] = useState(0);
    const [navPrefs, setNavPrefs] = useState<{ order: string[]; hidden: string[] } | undefined>(undefined);
    const [statusPreference, setStatusPreference] = useState<'online' | 'busy' | 'idle' | 'offline'>('online');
    const [projectMenuOpen, setProjectMenuOpen] = useState(false);
    const [projectOptions, setProjectOptions] = useState<Project[]>([]);
    const [taskTitle, setTaskTitle] = useState<string | null>(null);
    // Full-width content mode (toggled from the project overview "stretch" button).
    // When on, the content area uses the full available width and the sidebar
    // collapses to icon-only.
    const [contentWide, setContentWideState] = useState<boolean>(() => {
        try { return window.localStorage.getItem(wideStorageKey()) === '1'; } catch { return false; }
    });
    const setContentWide = (next: boolean) => {
        setContentWideState(next);
        try { window.localStorage.setItem(wideStorageKey(), next ? '1' : '0'); } catch { /* ignore */ }
    };

    const user = auth?.currentUser;
    const navigate = useNavigate();
    const { t } = useLanguage();
    const isCurrentProjectCanceled = isProjectExcludedFromHealth(project);
    const visibleExternalResources = useMemo<ProjectExternalResource[]>(() => {
        const resources = project?.externalResources || [];
        if (!project || resources.length === 0) return [];
        const userId = user?.uid;

        return resources.filter(resource => {
            const restrictedRoles = resource.restrictedToRoleIds || [];
            if (restrictedRoles.length === 0) return true;
            if (!userId) return false;
            if (project.ownerId === userId) return true;

            const member = (project.members || []).find(memberEntry => (
                (typeof memberEntry === 'string' ? memberEntry : memberEntry.userId) === userId
            ));
            const memberRole = typeof member === 'object' ? member.role : (member ? 'Viewer' : '');
            return Boolean(memberRole && restrictedRoles.includes(memberRole));
        });
    }, [project, user?.uid]);

    // Close the mobile drawer on every navigation (including same-path / query-only changes).
    useEffect(() => {
        setNavOpen(false);
    }, [location.key, location.pathname, location.search]);

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
            setCompanyProject(null);
            return;
        }

        let mounted = true;
        let unsubProject: (() => void) | undefined;
        let unsubTasks: (() => void) | undefined;
        let unsubNav: (() => void) | undefined;

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

            // Subscribe to user's nav preferences for this project
            if (user) {
                unsubNav = subscribeUserProjectNavPrefs(user.uid, projectId, (prefs) => {
                    if (mounted) {
                        setNavPrefs(prefs || undefined);
                    }
                }, projectTenantId);
            }

        }).catch(err => {
            console.warn("Failed to load project data", err);
        });

        return () => {
            mounted = false;
            if (unsubProject) unsubProject();
            if (unsubTasks) unsubTasks();
            if (unsubNav) unsubNav();
        };
    }, [projectId, user?.uid]);

    // Subscribe to global status preference
    useEffect(() => {
        if (!user) return;
        const unsub = subscribeUserStatusPreference(user.uid, (status) => {
            setStatusPreference(status);
        });
        return () => unsub();
    }, [user?.uid]);

    useEffect(() => {
        if (!project?.companyProjectId) {
            setCompanyProject(null);
            return;
        }

        let mounted = true;
        getProjectById(project.companyProjectId, project.tenantId)
            .then(parentProject => {
                if (mounted) setCompanyProject(parentProject);
            })
            .catch(error => {
                console.warn('Failed to load breadcrumb company project', error);
                if (mounted) setCompanyProject(null);
            });

        return () => {
            mounted = false;
        };
    }, [project?.companyProjectId, project?.tenantId]);

    // Global Workspace Presence Heartbeat
    useWorkspacePresence({
        enabled: !!user,
        manualStatus: statusPreference
    });

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
            rawItems.push({ label: t('breadcrumbs.projects'), to: '/projects' });
        }

        // Handle Individual Project Routes
        else if (parts[0] === 'project' && parts[1]) {
            rawItems.push({ label: t('breadcrumbs.projects'), to: '/projects' });
            if (companyProject && companyProject.id !== parts[1]) {
                rawItems.push({ label: companyProject.title, to: `/project/${companyProject.id}` });
            }

            // Project Title (or loading state)
            const pTitle = project?.title || t('breadcrumbs.loading');
            rawItems.push({ label: pTitle, to: `/project/${parts[1]}` });

            // Project Sub-pages
            if (parts[2]) {
                const sub = parts[2];
                switch (sub) {
                    case 'tasks':
                        rawItems.push({ label: t('breadcrumbs.tasks'), to: `/project/${parts[1]}/tasks` });
                        if (parts[3]) rawItems.push({ label: taskTitle || t('breadcrumbs.taskDetails') });
                        break;
                    case 'initiatives':
                        rawItems.push({ label: t('breadcrumbs.initiatives'), to: `/project/${parts[1]}/initiatives` });
                        if (parts[3]) rawItems.push({ label: taskTitle || t('breadcrumbs.initiativeDetails') });
                        break;
                    case 'activity':
                        rawItems.push({ label: t('breadcrumbs.activity'), to: `/project/${parts[1]}/activity` });
                        break;
                    default:
                        rawItems.push({ label: sub.charAt(0).toUpperCase() + sub.slice(1) });
                }
            }
        }

        // Handle Other Top-Level Routes
        else if (parts[0] === 'tasks') {
            rawItems.push({ label: t('breadcrumbs.myTasks') });
        } else if (parts[0] === 'brainstorm') {
            rawItems.push({ label: t('breadcrumbs.aiStudio') });
        } else if (parts[0] === 'team') {
            rawItems.push({ label: t('breadcrumbs.team') });
        } else if (parts[0] === 'calendar') {
            rawItems.push({ label: t('breadcrumbs.calendar') });
        } else if (parts[0] === 'finance') {
            rawItems.push({ label: t('breadcrumbs.finance') });
        } else if (parts[0] === 'settings') {
            rawItems.push({ label: t('breadcrumbs.settings') });
        } else if (parts[0] === 'profile') {
            rawItems.push({ label: t('breadcrumbs.profile') });
        }

        // Finalize: Remove link from the last item
        return rawItems.map((item, idx) => {
            if (idx === rawItems.length - 1) {
                const { to, ...rest } = item;
                return rest;
            }
            return item;
        });
    }, [location.pathname, project, companyProject, taskTitle, t]);

    return (
        <div className="flex app-viewport-height w-full bg-surface overflow-hidden relative">
            {/* Sidebar Desktop — collapsed, it floats over the content (which
                keeps its place via --app-content-inset-left) so wide boards can
                scroll out behind it. */}
            <div className={`hidden md:flex flex-shrink-0 h-full ${contentWide ? 'app-sidebar-slot--overlay' : ''}`.trim()}>
                <Suspense fallback={<div className="h-full w-72 border-r border-surface bg-card" />}>
                    <Sidebar
                        collapsed={contentWide}
                        onToggleCollapsed={() => setContentWide(!contentWide)}
                        workspace={projectId ? {
                            projectId,
                            projectTitle: project?.title,
                            tasksCount: isCurrentProjectCanceled ? 0 : tasksCount,
                            ideasCount: 0,
                            issuesCount: 0,
                            modules: project?.modules,
                            isClientProject: project ? isClientProject(project) : false,
                            externalResources: visibleExternalResources,
                            isLoaded: Boolean(project),
                            navPrefs: navPrefs
                        } : undefined}
                    />
                </Suspense>
            </div>

            {/* Mobile Sidebar Drawer */}
            {navOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    <div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setNavOpen(false)}
                    />
                    <div className="relative w-4/5 max-w-xs h-full bg-card shadow-2xl animate-fade-in-left">
                        <Suspense fallback={<div className="h-full w-full bg-card" />}>
                            <Sidebar
                                isDrawer
                                onClose={() => setNavOpen(false)}
                                workspace={projectId ? {
                                    projectId,
                                    projectTitle: project?.title,
                                    tasksCount: isCurrentProjectCanceled ? 0 : tasksCount,
                                    ideasCount: 0,
                                    issuesCount: 0,
                                    modules: project?.modules,
                                    isClientProject: project ? isClientProject(project) : false,
                                    externalResources: visibleExternalResources,
                                    isLoaded: Boolean(project),
                                    navPrefs: navPrefs
                                } : undefined}
                            />
                        </Suspense>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 h-full relative ${contentWide ? 'app-main-column--under-sidebar' : ''}`.trim()}>

                {/* Header */}
                <Suspense fallback={<div className="topbar-shell" />}>
                    <TopBar
                        project={project}
                        tenantId={project?.tenantId}
                        breadcrumbs={breadcrumbs}
                        onOpenNav={() => setNavOpen(true)}
                    />
                </Suspense>

                {/* Main Scroll Area */}
                <main className={`app-main-scroll dotted-bg ${(isFullWidthRoute || contentWide) ? 'app-main-scroll--full' : 'app-main-scroll--standard'}`}>
                    <div className={(isFullWidthRoute || contentWide) ? 'w-full h-full' : 'max-w-7xl mx-auto h-full'}>
                        <Outlet context={{ setTaskTitle, statusPreference, contentWide, setContentWide }} />
                    </div>
                </main>

            </div>
            {/* Global Task Create Modal */}
            {isTaskCreateModalOpen && (resolvedTaskCreateProjectId || taskCreateAllowProjectSelect) && (
                <Suspense fallback={null}>
                    <TaskCreateModal
                        onClose={closeTaskCreateModal}
                        projectId={resolvedTaskCreateProjectId || undefined}
                        allowProjectSelect={taskCreateAllowProjectSelect}
                    />
                </Suspense>
            )}

            {/* First sign-in: workspace name, solo/team, invites */}
            <WelcomeDialog />

            {/* Global Project Create Modal */}
            {isProjectCreateModalOpen && (
                <Suspense fallback={null}>
                    <CreateProjectModal
                        isOpen={isProjectCreateModalOpen}
                        onClose={closeProjectCreateModal}
                    />
                </Suspense>
            )}
        </div>
    );
};
