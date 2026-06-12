import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { auth } from '../services/firebase';
import { getUserTasks } from '../services/domain/tasksService';
import { isPmCoreOnly, isDeprecatedProjectNavId, PM_CORE_PROJECT_NAV_ORDER } from '../config/pmCore';
import { useTheme } from '../context/ThemeContext';
import { ProjectSwitcher } from './ProjectSwitcher';
import { NotificationDropdown } from './NotificationDropdown';
import { WorkspaceTeamIndicator } from './WorkspaceTeamIndicator';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useUIState } from '../context/UIContext';
import type { ProjectExternalResource } from '../types';

// When true, the sidebar renders icon-only (driven by the overview "stretch" mode).
const SidebarCollapsedContext = React.createContext(false);

type SidebarProps = {
    isDrawer?: boolean;
    collapsed?: boolean;
    onClose?: () => void;
    workspace?: {
        projectId: string;
        projectTitle?: string;
        tasksCount?: number;
        modules?: string[];
        externalResources?: ProjectExternalResource[];
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
    const collapsed = React.useContext(SidebarCollapsedContext);
    const isActive = exact
        ? location.pathname === to
        : to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to);

    if (disabled) {
        return (
            <div
                className={`flex items-center gap-3.5 px-3 py-2 text-muted opacity-30 cursor-not-allowed ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? label : undefined}
            >
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
                {!collapsed && <span className="text-[14px]/none font-medium text-inherit">{label}</span>}
            </div>
        );
    }

    return (
        <Link
            to={to}
            onClick={onClick}
            title={collapsed ? label : undefined}
            className={`
                app-sidebar__nav-item group relative flex items-center gap-3.5 rounded-xl transition-all duration-300
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3.5 py-2'}
                ${isActive ? 'is-active font-bold shadow-sm' : ''}
            `}
        >
            {/* Elegant Active Indicator */}
            {isActive && !collapsed && (
                <div className="app-sidebar__active-indicator absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full" />
            )}

            <span className="relative">
                <span
                    className="app-sidebar__nav-icon material-symbols-outlined text-[20px] transition-all duration-300 overflow-hidden"
                >
                    {icon}
                </span>
                {collapsed && badge !== undefined && badge > 0 && (
                    <span className="app-sidebar__collapsed-badge absolute -top-1 -right-1 size-2 rounded-full" />
                )}
            </span>

            {!collapsed && (
                <span className="app-sidebar__nav-label text-[14px]/none flex-1 truncate tracking-tight font-medium group-hover:translate-x-0.5 transition-transform duration-300">{label}</span>
            )}

            {!collapsed && badge !== undefined && badge > 0 && (
                <div className="app-sidebar__badge flex items-center justify-center min-w-[20px] h-5 rounded-full px-1 transition-all duration-300">
                    <span className={`text-[10px] font-black leading-none ${isActive ? 'scale-90' : ''}`}>{badge}</span>
                </div>
            )}
        </Link>
    );
};

// ----------------------------------------------------------------------
// Sidebar Component
// ----------------------------------------------------------------------

export const Sidebar = ({ isDrawer = false, collapsed = false, onClose, workspace }: SidebarProps) => {
    const effectiveCollapsed = collapsed && !isDrawer;
    const user = auth.currentUser;
    const location = useLocation();
    const { theme } = useTheme();
    const { t } = useLanguage();
    const { isAuthReady, isAuthenticated } = useAuth();
    const { hasPermission } = usePermissions();
    const { openProjectCreateModal } = useUIState();
    const canViewFinance = hasPermission('tenant.finance.view');
    const pmCore = isPmCoreOnly();
    const [advancedNavOpen, setAdvancedNavOpen] = React.useState(false);
    const isFinanceContext = location.pathname === '/finance' || location.pathname.startsWith('/finance/');
    const [useRegularNavInFinance, setUseRegularNavInFinance] = React.useState(false);
    const showFinanceNavigation = isFinanceContext && canViewFinance && !useRegularNavInFinance && !pmCore;

    React.useEffect(() => {
        if (!isFinanceContext) {
            setUseRegularNavInFinance(false);
        }
    }, [isFinanceContext]);

    // Data Loaders for badges
    const [taskCount, setTaskCount] = React.useState<number>(0);

    React.useEffect(() => {
        // Only fetch when auth is ready and user is authenticated
        if (!isAuthReady || !isAuthenticated) return;

        let mounted = true;
        const loadCounts = async () => {
            try {
                const tasks = await getUserTasks();
                if (mounted && user) {
                    const myIncompleteTasks = Array.isArray(tasks) ? tasks.filter(t =>
                        !t.isCompleted &&
                        (t.assigneeId === user.uid || (t.assigneeIds && t.assigneeIds.includes(user.uid)))
                    ) : [];
                    setTaskCount(myIncompleteTasks.length);
                }
            } catch (e) {
                console.warn('Failed to load counts', e);
            }
        };
        const timer = window.setTimeout(() => {
            void loadCounts();
        }, 300);

        return () => {
            mounted = false;
            window.clearTimeout(timer);
        };
    }, [isAuthReady, isAuthenticated, user]);

    // Derived State: Is inside a project?
    const isProjectActive = Boolean(workspace?.projectId);

    return (
      <SidebarCollapsedContext.Provider value={effectiveCollapsed}>
        <aside
            className={`
                app-sidebar flex flex-col bg-card border-r border-surface
                ${isDrawer ? 'w-full h-full' : effectiveCollapsed ? 'hidden md:flex w-[72px]' : 'hidden md:flex w-[280px]'}
                transition-all duration-300 relative z-20
            `}
        >
            {/* 1. Header Area */}
            <div className={`flex flex-col gap-4 p-4 pb-2 ${effectiveCollapsed ? 'items-center px-2' : ''}`}>
                {!effectiveCollapsed && (
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
                                className="size-8 rounded-full hover:bg-surface-hover flex items-center justify-center text-muted shrink-0"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        )}
                    </div>
                )}

                {/* New Project Button - Premium Design */}
                <button
                    type="button"
                    title={effectiveCollapsed ? t('nav.newProject') : undefined}
                    onClick={() => {
                        if (isDrawer) onClose?.();
                        openProjectCreateModal();
                    }}
                    className={`
                        app-sidebar__new-project
                        group relative flex items-center justify-center gap-3 py-2.5
                        font-bold text-[13px] rounded-xl border-none
                        hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden
                        ${effectiveCollapsed ? 'size-10 px-0' : 'w-full px-4'}
                    `}
                >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    {!effectiveCollapsed && <span className="tracking-tight">{t('nav.newProject')}</span>}
                </button>
            </div>

            {/* 2. Scrollable Navigation Area */}
            <nav className={`flex-1 overflow-y-auto py-6 space-y-8 scrollbar-none ${effectiveCollapsed ? 'px-2' : 'px-4'}`}>

                {/* Scope: Global Workspace */}
                <div>
                    {isFinanceContext && canViewFinance && !effectiveCollapsed && (
                        <button
                            type="button"
                            onClick={() => setUseRegularNavInFinance((prev) => !prev)}
                            className="mb-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-surface text-[12px] font-bold text-main bg-surface-hover hover:bg-surface-hover/70 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                {showFinanceNavigation ? 'menu_open' : 'account_balance_wallet'}
                            </span>
                            <span>
                                {showFinanceNavigation
                                    ? t('sidebar.finance.useRegularNavigation')
                                    : t('sidebar.finance.useFinanceNavigation')}
                            </span>
                        </button>
                    )}

                    {!effectiveCollapsed && (
                        <div className="flex items-center gap-3 px-1 mb-3">
                            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-muted opacity-50">
                                {t('nav.workspace')}
                            </span>
                            <div className="flex-1 h-px bg-gradient-to-r from-[var(--color-surface-border)]/50 to-transparent" />
                        </div>
                    )}

                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={showFinanceNavigation ? 'finance-nav' : 'regular-nav'}
                            className="grid gap-1"
                            initial={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                        >
                            {showFinanceNavigation ? (
                                <>
                                    <NavItem to="/finance/cockpit" icon="space_dashboard" label={t('finance.v2.nav.cockpit')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/finance/bookings" icon="receipt_long" label={t('finance.v2.nav.bookings')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/finance/receivables" icon="payments" label={t('finance.v2.nav.receivables')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/finance/payables" icon="request_quote" label={t('finance.v2.nav.payables')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/finance/bank" icon="account_balance" label={t('finance.v2.nav.bank')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/finance/tax" icon="gavel" label={t('finance.v2.nav.tax')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/finance/reports" icon="analytics" label={t('finance.v2.nav.reports')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/finance/functions" icon="function" label={t('finance.v2.nav.functions')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/finance/exports" icon="file_download" label={t('finance.v2.nav.exports')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/finance/sync" icon="sync" label={t('finance.v2.nav.sync')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/finance/settings" icon="tune" label={t('finance.v2.nav.settings')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/finance/calculations" icon="calculate" label={t('finance.v2.nav.planning')} onClick={isDrawer ? onClose : undefined} />
                                </>
                            ) : pmCore ? (
                                <>
                                    <NavItem to="/" icon="space_dashboard" label={t('nav.dashboard')} exact onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/projects" icon="layers" label={t('nav.projects')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/tasks" icon="task_alt" label={t('nav.myTasks')} badge={taskCount} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/calendar" icon="calendar_today" label={t('nav.calendar')} onClick={isDrawer ? onClose : undefined} />
                                    {!effectiveCollapsed && (
                                        <button
                                            type="button"
                                            onClick={() => setAdvancedNavOpen((prev) => !prev)}
                                            className="mt-2 w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-muted hover:bg-surface-hover/40 hover:text-main transition-colors"
                                        >
                                            <span className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                                                <span className="text-[14px] font-medium">{t('nav.advanced')}</span>
                                            </span>
                                            <span className="material-symbols-outlined text-[18px]">
                                                {advancedNavOpen ? 'expand_less' : 'expand_more'}
                                            </span>
                                        </button>
                                    )}
                                    {(advancedNavOpen || effectiveCollapsed) && (
                                        <div className={`grid gap-0.5 ${effectiveCollapsed ? '' : 'pl-1'}`}>
                                            {canViewFinance && (
                                                <NavItem to="/finance/cockpit" icon="account_balance_wallet" label={t('nav.finance')} onClick={isDrawer ? onClose : undefined} />
                                            )}
                                            <NavItem to="/brainstorm" icon="auto_awesome" label={t('nav.aiStudio')} onClick={isDrawer ? onClose : undefined} />
                                            <NavItem to="/team" icon="group" label={t('nav.team')} onClick={isDrawer ? onClose : undefined} />
                                            <NavItem to="/media" icon="perm_media" label={t('nav.media')} onClick={isDrawer ? onClose : undefined} />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <NavItem to="/" icon="space_dashboard" label={t('nav.dashboard')} exact onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/projects" icon="layers" label={t('nav.projects')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/tasks" icon="task_alt" label={t('nav.myTasks')} badge={taskCount} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/calendar" icon="calendar_today" label={t('nav.calendar')} onClick={isDrawer ? onClose : undefined} />
                                    {canViewFinance && (
                                        <NavItem to="/finance/cockpit" icon="account_balance_wallet" label={t('nav.finance')} onClick={isDrawer ? onClose : undefined} />
                                    )}
                                    <NavItem to="/brainstorm" icon="auto_awesome" label={t('nav.aiStudio')} onClick={isDrawer ? onClose : undefined} />
                                    <NavItem to="/team" icon="group" label={t('nav.team')} onClick={isDrawer ? onClose : undefined} />
                                </>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Scope: Current Context (Active Project) */}
                {isProjectActive && workspace && workspace.isLoaded && (
                    <div className="animate-fade-in-down">
                        {!effectiveCollapsed && (
                            <div className="flex items-center gap-3 px-1 mb-3">
                                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-muted opacity-50">
                                    {t('nav.projectContext')}
                                </span>
                                <div className="flex-1 h-px bg-gradient-to-r from-[var(--color-surface-border)]/50 to-transparent" />
                            </div>
                        )}

                        <div className="grid gap-0.5">
                            {(() => {
                                // Default nav item definitions
                                const defaultNavItems = [
                                    { id: 'overview', path: '', icon: 'grid_view', label: t('nav.overview'), exact: true },
                                    { id: 'initiatives', path: '/initiatives', icon: 'rocket_launch', label: t('nav.initiatives'), moduleKey: 'initiatives' },
                                    { id: 'tasks', path: '/tasks', icon: 'checklist', label: t('nav.tasks'), moduleKey: 'tasks', badge: workspace.tasksCount },
                                    { id: 'sprints', path: '/sprints', icon: 'directions_run', label: t('nav.sprints'), moduleKey: 'sprints' },
                                    { id: 'milestones', path: '/milestones', icon: 'outlined_flag', label: t('nav.milestones'), moduleKey: 'milestones' },
                                    { id: 'social', path: '/social', icon: 'campaign', label: t('nav.social'), moduleKey: 'social' },
                                    { id: 'marketing', path: '/marketing', icon: 'ads_click', label: t('nav.marketing'), moduleKey: 'marketing' },
                                    { id: 'accounting', path: '/accounting', icon: 'receipt_long', label: t('nav.accounting'), moduleKey: 'accounting' },
                                    { id: 'activity', path: '/activity', icon: 'history', label: t('nav.activity'), moduleKey: 'activity' },
                                    { id: 'codex', path: '/codex', icon: 'terminal', label: t('nav.codex') },
                                ];

                                // Get the order (custom or default)
                                const defaultOrder = pmCore
                                    ? [...PM_CORE_PROJECT_NAV_ORDER]
                                    : defaultNavItems.map(n => n.id);
                                const order = workspace.navPrefs?.order?.length && !pmCore
                                    ? workspace.navPrefs.order
                                    : defaultOrder;

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
                                        const notDeprecated = !isDeprecatedProjectNavId(item.id);
                                        return moduleEnabled && notHidden && notDeprecated;
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
                            {!effectiveCollapsed && workspace.externalResources && workspace.externalResources.length > 0 && (
                                <div className="mt-5 space-y-1">
                                    <div className="flex items-center gap-3 px-1 mb-3">
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted opacity-50">
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
                                                className="group relative flex items-center gap-3.5 px-3.5 py-2 rounded-xl transition-all duration-300 text-muted hover:bg-surface-hover/40 hover:text-main"
                                                onClick={isDrawer ? onClose : undefined}
                                            >
                                                <span className="material-symbols-outlined text-[20px] transition-all duration-300 text-muted group-hover:text-main group-hover:translate-y-[-1px]">
                                                    {res.icon || 'link'}
                                                </span>
                                                <span className="text-[14px]/none flex-1 truncate tracking-tight font-medium group-hover:translate-x-0.5 transition-transform duration-300">
                                                    {res.title}
                                                </span>
                                                {(res.sensitivity === 'confidential' || res.sensitivity === 'restricted' || res.advisorReviewRequired) && (
                                                    <span className="material-symbols-outlined text-[14px] text-warning" title={t('sidebar.resourcesRestricted')}>
                                                        lock
                                                    </span>
                                                )}
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
            {effectiveCollapsed ? (
                <div className="p-2 border-t border-surface bg-card flex flex-col items-center gap-2">
                    <NotificationDropdown position="sidebar" />
                </div>
            ) : (
                <div className="p-4 border-t border-surface bg-card space-y-4">
                    {/* Theme Toggle + Notification Bell Row */}
                    <div className="flex items-center justify-between">
                        <ThemeToggle />
                        <NotificationDropdown position="sidebar" />
                    </div>

                    {/* Workspace Team Presence Indicator */}
                    <WorkspaceTeamIndicator onClose={isDrawer ? onClose : undefined} />
                </div>
            )}
        </aside>
      </SidebarCollapsedContext.Provider>
    );
};

// ----------------------------------------------------------------------
// Internal Micro-Components
// ----------------------------------------------------------------------

const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();
    return (
        <div className="inline-flex bg-surface-hover p-0.5 rounded-full border border-surface">
            <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${theme === 'light' ? 'bg-white text-yellow-600 shadow-sm' : 'text-muted hover:text-main'
                    }`}
            >
                <span className="material-symbols-outlined text-[14px]">light_mode</span>
                <span>{t('theme.light')}</span>
            </button>
            <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${theme === 'dark' ? 'bg-slate-700 text-indigo-200 shadow-sm' : 'text-muted hover:text-main'
                    }`}
            >
                <span className="material-symbols-outlined text-[14px]">dark_mode</span>
                <span>{t('theme.dark')}</span>
            </button>
        </div>
    );
};
