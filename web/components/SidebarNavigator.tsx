import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { getUserTasks } from '../services/domain/tasksService';
import { getUserProjects, getSharedProjects } from '../services/domain/projectsService';
import { isCompanyProject, isClientProject, isContainerProject } from '../config/projectTemplates';
import { isPmCoreOnly, isDeprecatedProjectNavId, PM_CORE_PROJECT_NAV_ORDER } from '../config/pmCore';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useUIState } from '../context/UIContext';
import { NotificationDropdown } from './NotificationDropdown';
import logo from '../assets/logo.svg';
import type { Project, ProjectExternalResource } from '../types';
import { useWorkspace } from '../context/WorkspaceContext';
import { isCoraStudioEnabled } from '../config/features';
import { WorkspaceMenuSection } from './workspace/WorkspaceMenuSection';
import { InlineMenu, type InlineMenuOption } from './work/InlineMenu';
import { readRecentProjectAccess, recentProjectsStorageKey } from '../utils/recentProjects';
import { InitiativeCreateModal } from './InitiativeCreateModal';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

type SidebarNavigatorProps = {
    isDrawer?: boolean;
    collapsed?: boolean;
    onClose?: () => void;
    workspace?: {
        projectId: string;
        projectTitle?: string;
        tasksCount?: number;
        ideasCount?: number;
        issuesCount?: number;
        modules?: string[];
        isClientProject?: boolean;
        externalResources?: ProjectExternalResource[];
        isLoaded?: boolean;
        navPrefs?: { order: string[]; hidden: string[] };
    };
};

type NavRowDef = {
    key: string;
    to: string;
    icon: string;
    label: string;
    badge?: number;
    exact?: boolean;
};

// ----------------------------------------------------------------------
// Multi-pin store (independent from the single topbar pin) + recents
// ----------------------------------------------------------------------

const PINNED_STORAGE_PREFIX = 'projectflow.sidebar.pins';
const MAX_DOCK_PROJECTS = 4;

const pinnedStorageKey = (userId?: string) => `${PINNED_STORAGE_PREFIX}.${userId || 'anonymous'}`;

const readPinnedProjectIds = (userId?: string): string[] => {
    if (typeof window === 'undefined') return [];
    try {
        const stored = window.localStorage.getItem(pinnedStorageKey(userId));
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
        return [];
    }
};

const writePinnedProjectIds = (userId: string | undefined, ids: string[]) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(pinnedStorageKey(userId), JSON.stringify(ids.slice(0, 24)));
    } catch {
        // Pins are a convenience; ignore storage failures.
    }
};

const writeRecentProjectAccess = (userId: string | undefined, access: Record<string, number>) => {
    if (typeof window === 'undefined') return;
    const compact = Object.entries(access)
        .filter(([, ts]) => Number.isFinite(ts))
        .sort(([, a], [, b]) => b - a)
        .slice(0, 100)
        .reduce<Record<string, number>>((next, [id, ts]) => { next[id] = ts; return next; }, {});
    try {
        window.localStorage.setItem(recentProjectsStorageKey(userId), JSON.stringify(compact));
    } catch {
        // Recent ordering is a convenience; ignore storage failures.
    }
};

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

const statusTone = (status?: string): 'success' | 'warning' | 'error' | 'muted' => {
    const value = (status || '').toLowerCase();
    if (/cancel|blocked/.test(value)) return 'error';
    if (/pause|hold|risk|stuck|review/.test(value)) return 'warning';
    if (/active|progress|track|live|released|running|building/.test(value)) return 'success';
    return 'muted';
};

const projectInitial = (project: Project) => (project.title ? project.title.substring(0, 1).toUpperCase() : 'P');

const ProjectAvatar: React.FC<{ project: Project; className?: string }> = ({ project, className }) => (
    <span className={`snav-avatar ${isCompanyProject(project) ? 'snav-avatar--company' : ''} ${isClientProject(project) ? 'snav-avatar--client' : ''} ${className || ''}`}>
        {project.squareIcon ? (
            <img src={project.squareIcon} alt="" />
        ) : isCompanyProject(project) ? (
            <span className="material-symbols-outlined">domain</span>
        ) : isClientProject(project) ? (
            <span className="material-symbols-outlined">handshake</span>
        ) : (
            <span>{projectInitial(project)}</span>
        )}
    </span>
);

// ----------------------------------------------------------------------
// Nav group with a single morphing "glider" highlight
// ----------------------------------------------------------------------

const NavGroup: React.FC<{
    items: NavRowDef[];
    onNavigate?: () => void;
    label?: string;
}> = ({ items, onNavigate, label }) => {
    const location = useLocation();
    const groupRef = React.useRef<HTMLDivElement>(null);
    const [pill, setPill] = React.useState<{ top: number; height: number } | null>(null);

    const isItemActive = React.useCallback((item: NavRowDef) => {
        if (item.exact) return location.pathname === item.to;
        return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
    }, [location.pathname]);

    // Pick the most specific match so "Overview" (exact) never steals focus from a child route.
    const activeKey = React.useMemo(() => {
        const matches = items.filter(isItemActive);
        if (matches.length === 0) return null;
        return matches.reduce((best, item) => (item.to.length > best.to.length ? item : best)).key;
    }, [items, isItemActive]);

    const signature = items.map(i => i.key).join('|');
    React.useLayoutEffect(() => {
        const node = groupRef.current?.querySelector<HTMLElement>('.snav-row.is-active');
        if (node) {
            setPill({ top: node.offsetTop, height: node.offsetHeight });
        } else {
            setPill(null);
        }
    }, [activeKey, signature, location.pathname]);

    return (
        <div className="snav-group" ref={groupRef}>
            {label && <div className="snav-section">{label}</div>}
            {pill && (
                <span
                    className="snav-glider"
                    style={{ transform: `translateY(${pill.top}px)`, height: `${pill.height}px` }}
                    aria-hidden="true"
                />
            )}
            {items.map(item => (
                <Link
                    key={item.key}
                    to={item.to}
                    onClick={onNavigate}
                    title={item.label}
                    className={`snav-row ${item.key === activeKey ? 'is-active' : ''}`}
                >
                    <span className="snav-row__icon material-symbols-outlined">{item.icon}</span>
                    <span className="snav-row__label">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                        <span className="snav-row__badge">{item.badge}</span>
                    )}
                </Link>
            ))}
        </div>
    );
};

// ----------------------------------------------------------------------
// Compact theme toggle
// ----------------------------------------------------------------------

const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();
    return (
        <div className="snav-theme" role="group" aria-label={t('theme.light')}>
            <button
                type="button"
                onClick={() => setTheme('light')}
                className={theme === 'light' ? 'is-active' : ''}
                aria-pressed={theme === 'light'}
            >
                <span className="material-symbols-outlined">light_mode</span>
                <span>{t('theme.light')}</span>
            </button>
            <button
                type="button"
                onClick={() => setTheme('dark')}
                className={theme === 'dark' ? 'is-active' : ''}
                aria-pressed={theme === 'dark'}
            >
                <span className="material-symbols-outlined">dark_mode</span>
                <span>{t('theme.dark')}</span>
            </button>
        </div>
    );
};

// ----------------------------------------------------------------------
// Sidebar Navigator
// ----------------------------------------------------------------------

export const SidebarNavigator: React.FC<SidebarNavigatorProps> = ({ isDrawer = false, collapsed = false, onClose, workspace }) => {
    const location = useLocation();
    const { t } = useLanguage();
    const { isAuthReady, isAuthenticated, user } = useAuth();
    const { hasPermission } = usePermissions();
    const { openProjectCreateModal, openTaskCreateModal } = useUIState();
    const [initiativeModalOpen, setInitiativeModalOpen] = React.useState(false);

    const effectiveCollapsed = collapsed && !isDrawer;
    const canViewFinance = hasPermission('tenant.finance.view');
    const pmCore = isPmCoreOnly();

    const isFinanceContext = location.pathname === '/finance' || location.pathname.startsWith('/finance/');
    const contextKind: 'project' | 'finance' | null = isFinanceContext && canViewFinance && !pmCore
        ? 'finance'
        : workspace?.projectId
            ? 'project'
            : null;

    // Depth: 0 = workspace anchors, 1 = active context (project/finance).
    // Auto-follows the route, but the user can pop back to preview the workspace.
    const [previewWorkspace, setPreviewWorkspace] = React.useState(false);
    React.useEffect(() => {
        setPreviewWorkspace(false);
    }, [contextKind, workspace?.projectId]);
    const depth = contextKind && !previewWorkspace ? 1 : 0;

    // ---- Data: my-tasks badge ------------------------------------------------
    const [taskCount, setTaskCount] = React.useState(0);
    React.useEffect(() => {
        if (!isAuthReady || !isAuthenticated || !user) return;
        let mounted = true;
        const timer = window.setTimeout(() => {
            getUserTasks().then(tasks => {
                if (!mounted) return;
                const mine = Array.isArray(tasks) ? tasks.filter(task =>
                    !task.isCompleted &&
                    (task.assigneeId === user.uid || (task.assigneeIds && task.assigneeIds.includes(user.uid)))
                ) : [];
                setTaskCount(mine.length);
            }).catch(() => { /* badge is best-effort */ });
        }, 300);
        return () => { mounted = false; window.clearTimeout(timer); };
    }, [isAuthReady, isAuthenticated, user]);

    // Inline workspace / project switch menu open state. Declared here (before the
    // project fetch effect) so that effect can refetch when the menu opens.
    const [menuOpen, setMenuOpen] = React.useState(false);
    const { activeWorkspace } = useWorkspace();

    // ---- Data: projects for the dock ----------------------------------------
    const [projects, setProjects] = React.useState<Project[]>([]);
    React.useEffect(() => {
        if (!isAuthReady || !isAuthenticated) {
            setProjects([]);
            return;
        }
        let mounted = true;
        const timer = window.setTimeout(() => {
            Promise.all([
                getUserProjects(undefined, { includeScreenshots: false }),
                getSharedProjects({ includeScreenshots: false })
            ]).then(([mine, shared]) => {
                if (!mounted) return;
                const unique = Array.from(new Map([...mine, ...shared].map(p => [p.id, p])).values());
                setProjects(unique);
            }).catch(() => { /* dock degrades gracefully to current project only */ });
        }, 350);
        return () => { mounted = false; window.clearTimeout(timer); };
        // Re-runs when the project menu opens so freshly-changed project settings
        // (e.g. switching a project to a client project) are reflected without reload.
    }, [isAuthReady, isAuthenticated, menuOpen]);

    const projectsById = React.useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

    // ---- Pins (multi) --------------------------------------------------------
    const [pinnedIds, setPinnedIds] = React.useState<string[]>(() => readPinnedProjectIds());
    React.useEffect(() => {
        if (!isAuthReady) return;
        setPinnedIds(readPinnedProjectIds(user?.uid));
    }, [isAuthReady, user?.uid]);

    const togglePin = React.useCallback((projectId: string) => {
        setPinnedIds(prev => {
            const next = prev.includes(projectId) ? prev.filter(id => id !== projectId) : [projectId, ...prev];
            writePinnedProjectIds(user?.uid, next);
            return next;
        });
    }, [user?.uid]);

    // ---- Dock list: pinned first, then recents, then current ----------------
    const dockProjects = React.useMemo(() => {
        const recents = readRecentProjectAccess(user?.uid);
        const pinned = pinnedIds.map(id => projectsById.get(id)).filter((p): p is Project => Boolean(p));
        const seen = new Set(pinned.map(p => p.id));
        const dock: Project[] = [...pinned];

        const recentSorted = Object.entries(recents)
            .sort(([, a], [, b]) => b - a)
            .map(([id]) => projectsById.get(id))
            .filter((p): p is Project => Boolean(p));
        for (const project of recentSorted) {
            if (dock.length >= MAX_DOCK_PROJECTS) break;
            if (!seen.has(project.id)) { dock.push(project); seen.add(project.id); }
        }

        const currentId = workspace?.projectId;
        if (currentId && !seen.has(currentId)) {
            const current = projectsById.get(currentId);
            if (current) dock.unshift(current);
        }
        return dock.slice(0, MAX_DOCK_PROJECTS);
    }, [pinnedIds, projectsById, user?.uid, workspace?.projectId]);

    const pinnedProjects = React.useMemo(
        () => pinnedIds.map(id => projectsById.get(id)).filter((p): p is Project => Boolean(p)),
        [pinnedIds, projectsById]
    );

    const closeOnNavigate = isDrawer ? onClose : undefined;

    // ---- Inline workspace / project switch menu -----------------------------
    const navigate = useNavigate();
    const [query, setQuery] = React.useState('');

    // Close the menu whenever the route changes.
    React.useEffect(() => { setMenuOpen(false); setQuery(''); }, [location.pathname]);

    // Escape closes the menu.
    React.useEffect(() => {
        if (!menuOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [menuOpen]);

    // Record the current project into recents so the dock stays fresh.
    React.useEffect(() => {
        if (!workspace?.projectId || !isAuthReady || !isAuthenticated) return;
        const access = readRecentProjectAccess(user?.uid);
        access[workspace.projectId] = Date.now();
        writeRecentProjectAccess(user?.uid, access);
    }, [workspace?.projectId, isAuthReady, isAuthenticated, user?.uid]);

    const selectProject = (projectId: string) => {
        const access = readRecentProjectAccess(user?.uid);
        access[projectId] = Date.now();
        writeRecentProjectAccess(user?.uid, access);
        setMenuOpen(false);
        setQuery('');
        if (isDrawer) onClose?.();
        navigate(`/project/${projectId}`);
    };
    const goWorkspace = () => { setMenuOpen(false); setQuery(''); if (isDrawer) onClose?.(); navigate('/'); };
    const createProject = () => { setMenuOpen(false); if (isDrawer) onClose?.(); openProjectCreateModal(); };

    const trimmedQuery = query.trim().toLowerCase();
    const sortedProjects = React.useMemo(() => {
        const recents = readRecentProjectAccess(user?.uid);
        const score = (p: Project) => recents[p.id] ?? 0;
        return [...projects].sort((a, b) => {
            const diff = score(b) - score(a);
            if (diff !== 0) return diff;
            return (a.title || '').localeCompare(b.title || '');
        });
    }, [projects, user?.uid]);
    // Group into companies (with their linked workstreams nested) + the rest.
    const matchesQuery = (p: Project) => !trimmedQuery ||
        (p.title || '').toLowerCase().includes(trimmedQuery) ||
        (p.status || '').toLowerCase().includes(trimmedQuery);
    const ordinaryProjects = sortedProjects.filter(p => !isContainerProject(p));
    const linkedWorkstreams = (containerId: string) =>
        ordinaryProjects.filter(p => p.companyProjectId === containerId && matchesQuery(p));
    const visibleCompanies = sortedProjects.filter(p =>
        isCompanyProject(p) && (matchesQuery(p) || linkedWorkstreams(p.id).length > 0));
    const visibleClients = sortedProjects.filter(p =>
        isClientProject(p) && (matchesQuery(p) || linkedWorkstreams(p.id).length > 0));
    const ungroupedProjects = ordinaryProjects.filter(p => !p.companyProjectId && matchesQuery(p));
    const hasResults = visibleCompanies.length > 0 || visibleClients.length > 0 || ungroupedProjects.length > 0;

    const renderMenuRow = (project: Project, options: { nested?: boolean } = {}) => {
        const active = project.id === workspace?.projectId;
        const pinned = pinnedIds.includes(project.id);
        return (
            <div
                key={project.id}
                role="button"
                tabIndex={0}
                className={`snav-ws-row ${options.nested ? 'snav-ws-row--nested' : ''} ${active ? 'is-active' : ''}`}
                onClick={() => selectProject(project.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectProject(project.id); } }}
                title={project.title}
            >
                <ProjectAvatar project={project} className="snav-avatar--row" />
                <div className="snav-ws-row__copy">
                    <span className="snav-ws-row__title">{project.title}</span>
                    {project.status && (
                        <span className="snav-ws-row__meta">
                            <span className={`snav-dot snav-dot--${statusTone(project.status)}`} aria-hidden="true" />
                            {project.status}
                        </span>
                    )}
                </div>
                {active && <span className="material-symbols-outlined snav-ws-row__check">check</span>}
                <button
                    type="button"
                    className={`snav-ws-row__pin ${pinned ? 'is-pinned' : ''}`}
                    onClick={(e) => { e.stopPropagation(); togglePin(project.id); }}
                    title={pinned ? t('projectSwitcher.unpinProject') : t('projectSwitcher.pinProject')}
                    aria-label={pinned ? t('projectSwitcher.unpinProject') : t('projectSwitcher.pinProject')}
                >
                    <span className="material-symbols-outlined">{pinned ? 'push_pin' : 'keep'}</span>
                </button>
            </div>
        );
    };

    // ---- Workspace anchors ---------------------------------------------------
    // Group 1 (no header): your daily cockpit — personal views.
    const primaryAnchors: NavRowDef[] = [
        { key: 'dashboard', to: '/', icon: 'space_dashboard', label: t('nav.dashboard'), exact: true },
        { key: 'tasks', to: '/tasks', icon: 'task_alt', label: t('nav.myTasks'), badge: taskCount },
        { key: 'calendar', to: '/calendar', icon: 'calendar_today', label: t('nav.calendar') },
    ];
    // Group 2 ("Arbeitsbereich"): shared workspace areas.
    const secondaryAnchors: NavRowDef[] = [
        { key: 'projects', to: '/projects', icon: 'layers', label: t('nav.projects') },
        ...(canViewFinance ? [{ key: 'finance', to: '/finance/cockpit', icon: 'account_balance_wallet', label: t('nav.finance') }] : []),
        ...(activeWorkspace?.role !== 'Guest' ? [{ key: 'media', to: '/media', icon: 'perm_media', label: t('nav.media') }] : []),
        ...(isCoraStudioEnabled() ? [{ key: 'aiStudio', to: '/brainstorm', icon: 'auto_awesome', label: t('nav.aiStudio') }] : []),
    ];

    // ---- Project module nav (honours navPrefs + module gating) --------------
    const projectModules: NavRowDef[] = React.useMemo(() => {
        if (!workspace?.projectId) return [];
        const projectId = workspace.projectId;
        const showInvoices = Boolean(workspace.isClientProject);
        const defs = [
            { id: 'overview', path: '', icon: 'grid_view', label: t('nav.overview'), exact: true },
            { id: 'initiatives', path: '/initiatives', icon: 'rocket_launch', label: t('nav.initiatives'), moduleKey: 'initiatives' },
            { id: 'intake', path: '/intake', icon: 'inbox', label: t('nav.intake') },
            { id: 'tasks', path: '/tasks', icon: 'checklist', label: t('nav.tasks'), moduleKey: 'tasks', badge: workspace.tasksCount },
            { id: 'sprints', path: '/sprints', icon: 'directions_run', label: t('nav.sprints'), moduleKey: 'sprints' },
            { id: 'milestones', path: '/milestones', icon: 'outlined_flag', label: t('nav.milestones'), moduleKey: 'milestones' },
            { id: 'social', path: '/social', icon: 'campaign', label: t('nav.social'), moduleKey: 'social' },
            { id: 'marketing', path: '/marketing', icon: 'ads_click', label: t('nav.marketing'), moduleKey: 'marketing' },
            { id: 'accounting', path: '/accounting', icon: 'receipt_long', label: t('nav.accounting'), moduleKey: 'accounting' },
            // Effort + invoices live only on client projects ("Kundenprojekte").
            ...(showInvoices ? [
                { id: 'effort', path: '/effort', icon: 'schedule', label: t('nav.effort') },
                { id: 'invoices', path: '/invoices', icon: 'request_quote', label: t('nav.invoices') }
            ] : []),
            { id: 'activity', path: '/activity', icon: 'history', label: t('nav.activity'), moduleKey: 'activity' },
            { id: 'codex', path: '/codex', icon: 'terminal', label: t('nav.codex') },
        ];

        const defaultOrder = pmCore ? [...PM_CORE_PROJECT_NAV_ORDER] : defs.map(d => d.id);
        const order = workspace.navPrefs?.order?.length && !pmCore ? workspace.navPrefs.order : defaultOrder;
        const ordered = order.map(id => defs.find(d => d.id === id)).filter((d): d is typeof defs[number] => Boolean(d));
        defs.forEach(d => { if (!ordered.find(o => o.id === d.id)) ordered.push(d); });

        const hidden = workspace.navPrefs?.hidden || [];
        return ordered
            .filter(d => {
                const moduleEnabled = !d.moduleKey || !workspace.modules || workspace.modules.includes(d.moduleKey);
                return moduleEnabled && !hidden.includes(d.id) && !isDeprecatedProjectNavId(d.id);
            })
            .map(d => ({
                key: d.id,
                to: `/project/${projectId}${d.path}`,
                icon: d.icon,
                label: d.label,
                badge: d.badge,
                exact: d.exact,
            }));
    }, [workspace?.projectId, workspace?.modules, workspace?.navPrefs, workspace?.tasksCount, workspace?.isClientProject, pmCore, t]);

    // ---- Finance subnav ------------------------------------------------------
    const financeModules: NavRowDef[] = [
        { key: 'fin-cockpit', to: '/finance/cockpit', icon: 'space_dashboard', label: t('finance.v2.nav.cockpit') },
        { key: 'fin-bookings', to: '/finance/bookings', icon: 'receipt_long', label: t('finance.v2.nav.bookings') },
        { key: 'fin-receivables', to: '/finance/receivables', icon: 'payments', label: t('finance.v2.nav.receivables') },
        { key: 'fin-payables', to: '/finance/payables', icon: 'request_quote', label: t('finance.v2.nav.payables') },
        { key: 'fin-bank', to: '/finance/bank', icon: 'account_balance', label: t('finance.v2.nav.bank') },
        { key: 'fin-tax', to: '/finance/tax', icon: 'gavel', label: t('finance.v2.nav.tax') },
        { key: 'fin-reports', to: '/finance/reports', icon: 'analytics', label: t('finance.v2.nav.reports') },
        { key: 'fin-functions', to: '/finance/functions', icon: 'function', label: t('finance.v2.nav.functions') },
        { key: 'fin-exports', to: '/finance/exports', icon: 'file_download', label: t('finance.v2.nav.exports') },
        { key: 'fin-sync', to: '/finance/sync', icon: 'sync', label: t('finance.v2.nav.sync') },
        { key: 'fin-settings', to: '/finance/settings', icon: 'tune', label: t('finance.v2.nav.settings') },
        { key: 'fin-calc', to: '/finance/calculations', icon: 'calculate', label: t('finance.v2.nav.planning') },
    ];

    const currentProject = workspace?.projectId ? projectsById.get(workspace.projectId) : undefined;
    const currentPinned = workspace?.projectId ? pinnedIds.includes(workspace.projectId) : false;

    // "+" in the dock: task first (most frequent), project last. Inside a project,
    // task and initiative go straight into it; elsewhere the task dialog asks.
    const createOptions: InlineMenuOption[] = [
        { value: 'task', label: t('nav.create.task'), leading: <span className="material-symbols-outlined">add_task</span>, shortcut: 't' },
        ...(workspace?.projectId
            ? [{ value: 'initiative', label: t('nav.create.initiative'), leading: <span className="material-symbols-outlined">rocket_launch</span>, shortcut: 'i' }]
            : []),
        { value: 'project', label: t('nav.newProject'), leading: <span className="material-symbols-outlined">create_new_folder</span>, shortcut: 'p', dividerBefore: true }
    ];
    const handleCreate = (kind: string) => {
        if (isDrawer) onClose?.();
        if (kind === 'task') {
            if (workspace?.projectId) openTaskCreateModal(workspace.projectId);
            else openTaskCreateModal(undefined, { allowProjectSelect: true });
        } else if (kind === 'initiative') {
            setInitiativeModalOpen(true);
        } else {
            openProjectCreateModal();
        }
    };
    const externalResources = workspace?.externalResources || [];

    // ---- Context layer header ------------------------------------------------
    const contextHeader = contextKind === 'finance' ? (
        <div className="snav-context-head">
            <span className="snav-avatar snav-avatar--finance">
                <span className="material-symbols-outlined">account_balance_wallet</span>
            </span>
            <div className="snav-context-head__copy">
                <span className="snav-context-head__title">{t('nav.finance')}</span>
                <span className="snav-context-head__meta">{t('projectSwitcher.scope.workspace')}</span>
            </div>
        </div>
    ) : contextKind === 'project' ? (
        <div className="snav-context-head">
            {currentProject
                ? <ProjectAvatar project={currentProject} />
                : <span className="snav-avatar"><span>{(workspace?.projectTitle || 'P').substring(0, 1).toUpperCase()}</span></span>}
            <div className="snav-context-head__copy">
                <span className="snav-context-head__title">{workspace?.projectTitle || t('breadcrumbs.loading')}</span>
                {currentProject && (
                    <span className="snav-context-head__meta">
                        <span className={`snav-dot snav-dot--${statusTone(currentProject.status)}`} aria-hidden="true" />
                        {currentProject.status || t('projectSwitcher.scope.project')}
                    </span>
                )}
            </div>
            {workspace?.projectId && (
                <button
                    type="button"
                    onClick={() => togglePin(workspace.projectId)}
                    className={`snav-pin ${currentPinned ? 'is-pinned' : ''}`}
                    title={currentPinned ? t('projectSwitcher.unpinProject') : t('projectSwitcher.pinProject')}
                    aria-label={currentPinned ? t('projectSwitcher.unpinProject') : t('projectSwitcher.pinProject')}
                    aria-pressed={currentPinned}
                >
                    <span className="material-symbols-outlined">{currentPinned ? 'push_pin' : 'keep'}</span>
                </button>
            )}
        </div>
    ) : null;

    return (
        <aside className={`snav ${isDrawer ? 'snav--drawer' : ''} ${effectiveCollapsed ? 'snav--collapsed' : ''} ${menuOpen ? 'snav--menu-open' : ''}`}>
            <div className="snav-card">
                <div className="snav-inner">

                    {/* Workspace identity — opens the inline project switcher */}
                    <div className="snav-top">
                        <button type="button" className="snav-ws" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" aria-expanded={menuOpen}>
                            <span className="snav-ws__logo"><img src={logo} alt="" /></span>
                            <span className="snav-ws__name">{activeWorkspace?.name || t('app.brand')}</span>
                            <span className="material-symbols-outlined snav-ws__chev">unfold_more</span>
                        </button>
                        {isDrawer && (
                            <button type="button" onClick={onClose} className="snav-icon-btn" aria-label={t('sidebar.close')}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        )}
                    </div>

                    {/* Zoom viewport: workspace (depth 0) <-> context (depth 1) */}
                    <div className="snav-viewport">
                        <div className="snav-track" data-depth={depth}>

                            {/* Layer 0 — Workspace */}
                            <div className="snav-layer" aria-hidden={depth === 1}>
                                {pinnedProjects.length > 0 && (
                                    <div className="snav-group snav-group--pins">
                                        <div className="snav-section">{t('projectSwitcher.pinned')}</div>
                                        {pinnedProjects.map(project => (
                                            <Link
                                                key={project.id}
                                                to={`/project/${project.id}`}
                                                onClick={closeOnNavigate}
                                                className="snav-row snav-row--project"
                                                title={project.title}
                                            >
                                                <ProjectAvatar project={project} className="snav-avatar--row" />
                                                <span className="snav-row__label">{project.title}</span>
                                                <span className={`snav-dot snav-dot--${statusTone(project.status)}`} aria-hidden="true" />
                                            </Link>
                                        ))}
                                    </div>
                                )}
                                <NavGroup items={primaryAnchors} onNavigate={closeOnNavigate} />
                                <NavGroup items={secondaryAnchors} onNavigate={closeOnNavigate} label={t('nav.workspace')} />
                            </div>

                            {/* Layer 1 — Active context */}
                            <div className="snav-layer" aria-hidden={depth === 0}>
                                {contextKind && (
                                    <button type="button" className="snav-back" onClick={() => setPreviewWorkspace(true)}>
                                        <span className="material-symbols-outlined">chevron_left</span>
                                        <span>{t('nav.workspace')}</span>
                                    </button>
                                )}
                                {contextHeader}
                                {contextKind === 'finance' && (
                                    <NavGroup items={financeModules} onNavigate={closeOnNavigate} />
                                )}
                                {contextKind === 'project' && (
                                    <>
                                        <NavGroup items={projectModules} onNavigate={closeOnNavigate} />
                                        {externalResources.length > 0 && (
                                            <div className="snav-group">
                                                <div className="snav-section">{t('sidebar.resources')}</div>
                                                {externalResources.map((res, idx) => (
                                                    <a
                                                        key={`${res.url}-${idx}`}
                                                        href={res.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={closeOnNavigate}
                                                        className="snav-row snav-row--external"
                                                        title={res.title}
                                                    >
                                                        <span className="snav-row__icon material-symbols-outlined">{res.icon || 'link'}</span>
                                                        <span className="snav-row__label">{res.title}</span>
                                                        {(res.sensitivity === 'confidential' || res.sensitivity === 'restricted' || res.advisorReviewRequired) && (
                                                            <span className="material-symbols-outlined snav-row__lock" title={t('sidebar.resourcesRestricted')}>lock</span>
                                                        )}
                                                        <span className="material-symbols-outlined snav-row__ext">open_in_new</span>
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                        </div>
                    </div>

                    {/* Project dock — quick switch, always one click */}
                    <div className="snav-dock">
                        <Link to="/" onClick={closeOnNavigate} className="snav-dock__home" title={t('sidebar.workspaceHome')} aria-label={t('sidebar.workspaceHome')}>
                            <span className="material-symbols-outlined">home</span>
                        </Link>
                        <span className="snav-dock__divider" aria-hidden="true" />
                        <div className="snav-dock__projects">
                            {dockProjects.map(project => {
                                const active = project.id === workspace?.projectId;
                                return (
                                    <Link
                                        key={project.id}
                                        to={`/project/${project.id}`}
                                        onClick={closeOnNavigate}
                                        className={`snav-dock__project ${active ? 'is-active' : ''}`}
                                        aria-label={project.title}
                                    >
                                        <ProjectAvatar project={project} className="snav-avatar--dock" />
                                        {pinnedIds.includes(project.id) && <span className="snav-dock__pin material-symbols-outlined">push_pin</span>}
                                        <span className="snav-dock__tip">{project.title}</span>
                                    </Link>
                                );
                            })}
                        </div>
                        <InlineMenu
                            label={t('nav.create.label')}
                            triggerClassName="snav-dock__add"
                            trigger={<span className="material-symbols-outlined">add</span>}
                            options={createOptions}
                            onSelect={handleCreate}
                            width={220}
                        />
                    </div>

                    {/* Footer — theme, notifications */}
                    <div className="snav-footer">
                        <div className="snav-footer__row">
                            <ThemeToggle />
                            <NotificationDropdown position="sidebar" />
                        </div>
                    </div>

                </div>

                {/* Inline project switcher — flat, native to the card */}
                {menuOpen && (
                    <div className="snav-ws-menu" role="dialog" aria-label={t('nav.projects')}>
                        <div className="snav-ws-menu__search">
                            <span className="material-symbols-outlined">search</span>
                            <input
                                type="text"
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t('projectSwitcher.searchPlaceholder')}
                            />
                            <button type="button" onClick={() => setMenuOpen(false)} className="snav-icon-btn" aria-label={t('sidebar.close')}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="snav-ws-menu__list">
                            {!trimmedQuery && <WorkspaceMenuSection />}
                            {!trimmedQuery && (
                                <button type="button" className="snav-ws-row" onClick={goWorkspace}>
                                    <span className="snav-avatar snav-avatar--finance"><span className="material-symbols-outlined">space_dashboard</span></span>
                                    <div className="snav-ws-row__copy">
                                        <span className="snav-ws-row__title">{t('nav.dashboard')}</span>
                                        <span className="snav-ws-row__meta">{t('projectSwitcher.scope.workspace')}</span>
                                    </div>
                                </button>
                            )}
                            {!trimmedQuery && pinnedProjects.length > 0 && (
                                <div className="snav-ws-group">
                                    <div className="snav-section">{t('projectSwitcher.pinned')}</div>
                                    {pinnedProjects.map(project => renderMenuRow(project))}
                                </div>
                            )}
                            {visibleCompanies.length > 0 && (
                                <div className="snav-ws-group">
                                    <div className="snav-section">{t('projectSwitcher.companyProjects')}</div>
                                    {visibleCompanies.map(company => (
                                        <React.Fragment key={company.id}>
                                            {renderMenuRow(company)}
                                            {linkedWorkstreams(company.id).map(ws => renderMenuRow(ws, { nested: true }))}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                            {visibleClients.length > 0 && (
                                <div className="snav-ws-group">
                                    <div className="snav-section">{t('projectSwitcher.clientProjects')}</div>
                                    {visibleClients.map(client => (
                                        <React.Fragment key={client.id}>
                                            {renderMenuRow(client)}
                                            {linkedWorkstreams(client.id).map(ws => renderMenuRow(ws, { nested: true }))}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                            {ungroupedProjects.length > 0 && (
                                <div className="snav-ws-group">
                                    <div className="snav-section">{t('nav.projects')}</div>
                                    {ungroupedProjects.map(project => renderMenuRow(project))}
                                </div>
                            )}
                            {!hasResults && (
                                <div className="snav-ws-empty">{t('projectSwitcher.empty')}</div>
                            )}
                        </div>
                        <button type="button" className="snav-ws-menu__create" onClick={createProject}>
                            <span className="material-symbols-outlined">add</span>
                            <span>{t('projectSwitcher.createProject')}</span>
                        </button>
                    </div>
                )}
            </div>
            {workspace?.projectId && (
                <InitiativeCreateModal
                    isOpen={initiativeModalOpen}
                    projectId={workspace.projectId}
                    tenantId={currentProject?.tenantId}
                    onClose={() => setInitiativeModalOpen(false)}
                />
            )}
        </aside>
    );
};

export default SidebarNavigator;
