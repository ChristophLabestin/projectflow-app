import React, { useEffect, useState, useMemo } from 'react';
import { Outlet, useLocation, useParams, useNavigate, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TaskCreateModal } from './TaskCreateModal';
import { CreateFlowModal } from './flows/CreateFlowModal';
import { CreateIssueModal } from './CreateIssueModal';
import { useUIState } from '../context/UIContext';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../services/firebase';
import { getProjectById, getProjectIdeas, getProjectTasks, getUserProjects, subscribeProject, getProjectIssues, subscribeProjectTasks, subscribeProjectIssues, subscribeProjectIdeas, getUserProjectNavPrefs, subscribeUserProjectNavPrefs, subscribeUserStatusPreference, getCampaignById } from '../services/dataService';
import { Project } from '../types';
import { useWorkspacePresence } from '../hooks/usePresence';
import { SubTask } from '../types';
import { useLanguage } from '../context/LanguageContext';


import { TopBar } from './TopBar';

export const AppLayout = () => {
    const { id: paramProjectId } = useParams<{ id: string }>();
    const { theme } = useTheme();
    const {
        isTaskCreateModalOpen, closeTaskCreateModal, taskCreateProjectId,
        isIdeaCreateModalOpen, closeIdeaCreateModal, ideaCreateProjectId,
        isIssueCreateModalOpen, closeIssueCreateModal, issueCreateProjectId
    } = useUIState();
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
    const [navPrefs, setNavPrefs] = useState<{ order: string[]; hidden: string[] } | undefined>(undefined);
    const [statusPreference, setStatusPreference] = useState<'online' | 'busy' | 'idle' | 'offline'>('online');
    const [projectMenuOpen, setProjectMenuOpen] = useState(false);
    const [projectOptions, setProjectOptions] = useState<Project[]>([]);
    const [taskTitle, setTaskTitle] = useState<string | null>(null);
    const [campaignName, setCampaignName] = useState<string | null>(null);

    const user = auth?.currentUser;
    const navigate = useNavigate();
    const { t } = useLanguage();

    // Close nav on route change
    useEffect(() => {
        setNavOpen(false);
        setProjectMenuOpen(false);
        setTaskTitle(null);
        setCampaignName(null);
    }, [location.pathname]);

    // Fetch campaign name when viewing a campaign detail page or editing/creating a post within a campaign
    useEffect(() => {
        // Check for campaign detail page pattern: /project/:id/social/campaigns/:campaignId
        const pathMatch = location.pathname.match(/\/project\/([^/]+)\/social\/campaigns\/([^/]+)/);
        if (pathMatch && pathMatch[1] && pathMatch[2]) {
            const [, pId, campId] = pathMatch;
            getCampaignById(pId, campId).then(campaign => {
                setCampaignName(campaign?.name || null);
            }).catch(() => setCampaignName(null));
            return;
        }

        // Check for create/edit page with campaignId query param
        const createEditMatch = location.pathname.match(/\/project\/([^/]+)\/social\/(create|edit)/);
        const searchParams = new URLSearchParams(location.search);
        const queryCampaignId = searchParams.get('campaignId');

        if (createEditMatch && createEditMatch[1] && queryCampaignId) {
            const pId = createEditMatch[1];
            getCampaignById(pId, queryCampaignId).then(campaign => {
                setCampaignName(campaign?.name || null);
            }).catch(() => setCampaignName(null));
            return;
        }

        setCampaignName(null);
    }, [location.pathname, location.search]);

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
            if (unsubIdeas) unsubIdeas();
            if (unsubIssues) unsubIssues();
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
                    case 'flows':
                    case 'ideas':
                        rawItems.push({ label: t('breadcrumbs.flows'), to: `/project/${parts[1]}/flows` });
                        break;
                    case 'issues':
                        rawItems.push({ label: t('breadcrumbs.issues'), to: `/project/${parts[1]}/issues` });
                        break;
                    case 'activity':
                        rawItems.push({ label: t('breadcrumbs.activity'), to: `/project/${parts[1]}/activity` });
                        break;
                    case 'social':
                        rawItems.push({ label: t('breadcrumbs.socialStudio'), to: `/project/${parts[1]}/social` });
                        // Handle social sub-menus
                        if (parts[3]) {
                            const socialSub = parts[3];
                            const socialLabels: Record<string, string> = {
                                'calendar': t('breadcrumbs.calendar'),
                                'campaigns': t('breadcrumbs.campaigns'),
                                'posts': t('breadcrumbs.posts'),
                                'assets': t('breadcrumbs.assets'),
                                'settings': t('breadcrumbs.settings')
                            };

                            // Check for campaignId in query params (for create/edit pages)
                            const searchParams = new URLSearchParams(location.search);
                            const queryCampaignId = searchParams.get('campaignId');

                            // Check if we're on a campaign detail page (has campaignId at parts[4])
                            if (socialSub === 'campaigns' && parts[4]) {
                                rawItems.push({ label: t('breadcrumbs.campaigns'), to: `/project/${parts[1]}/social/campaigns` });
                                rawItems.push({ label: campaignName || t('breadcrumbs.loading') });
                            } else if ((socialSub === 'create' || socialSub === 'edit') && queryCampaignId && campaignName) {
                                // Creating or editing a post within a campaign context
                                rawItems.push({ label: t('breadcrumbs.campaigns'), to: `/project/${parts[1]}/social/campaigns` });
                                rawItems.push({ label: campaignName, to: `/project/${parts[1]}/social/campaigns/${queryCampaignId}` });
                                rawItems.push({ label: socialSub === 'create' ? t('breadcrumbs.newPost') : t('breadcrumbs.editPost') });
                            } else {
                                rawItems.push({ label: socialLabels[socialSub] || socialSub.charAt(0).toUpperCase() + socialSub.slice(1) });
                            }
                        } else {
                            // Default is Dashboard when no sub-path
                            rawItems.push({ label: t('breadcrumbs.dashboard') });
                        }
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
        } else if (parts[0] === 'settings') {
            rawItems.push({ label: t('breadcrumbs.settings') });
        } else if (parts[0] === 'create') {
            rawItems.push({ label: t('breadcrumbs.newProject') });
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
    }, [location.pathname, project, taskTitle, campaignName, t]);

    const isFullWidth = location.pathname === '/create' ||
        location.pathname.includes('/social') ||
        location.pathname.includes('/marketing') ||
        location.pathname.includes('/flows') ||
        location.pathname.includes('/activity');

    return (
        <div className="app-layout">
            {/* Sidebar Desktop */}
            <div className="sidebar-wrapper">
                <Sidebar
                    workspace={projectId ? {
                        projectId,
                        projectTitle: project?.title,
                        tasksCount,
                        ideasCount,
                        issuesCount,
                        modules: project?.modules,
                        externalResources: project?.externalResources,
                        isLoaded: Boolean(project),
                        navPrefs: navPrefs
                    } : undefined}
                />
            </div>

            {/* Mobile Sidebar Drawer */}
            {navOpen && (
                <div className="mobile-drawer-overlay">
                    <div
                        className="backdrop"
                        onClick={() => setNavOpen(false)}
                    />
                    <div className="mobile-drawer">
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
                                isLoaded: Boolean(project),
                                navPrefs: navPrefs
                            } : undefined}
                        />
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="main-content-wrapper">

                {/* Header */}
                <TopBar
                    project={project}
                    breadcrumbs={breadcrumbs}
                    onOpenNav={() => setNavOpen(true)}
                />

                {/* Main Scroll Area */}
                <main className={`main-scroll-area dotted-bg ${isFullWidth ? 'full-width' : 'standard-padding'}`}>
                    <div className={`main-container ${isFullWidth ? 'full' : 'centered'}`}>
                        <Outlet context={{ setTaskTitle, statusPreference }} />
                    </div>
                </main>

            </div>
            {/* Global Task Create Modal */}
            {isTaskCreateModalOpen && taskCreateProjectId && (
                <TaskCreateModal
                    onClose={closeTaskCreateModal}
                    projectId={taskCreateProjectId}
                />
            )}

            {/* Global Flow Create Modal */}
            {isIdeaCreateModalOpen && ideaCreateProjectId && (
                <CreateFlowModal
                    isOpen={isIdeaCreateModalOpen}
                    onClose={closeIdeaCreateModal}
                    projectId={ideaCreateProjectId}
                    onCreated={closeIdeaCreateModal}
                />
            )}

            {/* Global Issue Create Modal */}
            {isIssueCreateModalOpen && issueCreateProjectId && (
                <CreateIssueModal
                    isOpen={isIssueCreateModalOpen}
                    onClose={closeIssueCreateModal}
                    projectId={issueCreateProjectId}
                />
            )}
        </div>
    );
};
