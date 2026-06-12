import type { Project, ProjectModule } from '../../../../types';
import { normalizeModulesForPmCore } from '../../../../config/pmCore';

/** Workspace tabs in the redesigned overview. */
export type OverviewTab = 'work' | 'sprints' | 'milestones' | 'activity';

/** Work views available for the work-item surface. */
export type OverviewWorkView = 'list' | 'board' | 'timeline' | 'calendar' | 'relationships';

export type OverviewGroupBy = 'status' | 'priority' | 'initiative' | 'assignee' | 'none';
export type OverviewSortBy = 'manual' | 'priority' | 'dueDate' | 'title' | 'createdAt';

export type TabDescriptor = {
    id: OverviewTab;
    icon: string;
    labelKey: string;
    /** Module that must be enabled for this tab to render (omitted = always). */
    module?: ProjectModule;
};

export type ViewDescriptor = {
    id: OverviewWorkView;
    icon: string;
    labelKey: string;
    /** Tabs this view is available on. */
    supportedTabs: OverviewTab[];
};

export const OVERVIEW_TABS: TabDescriptor[] = [
    { id: 'work', icon: 'dashboard', labelKey: 'projectOverview.v2.tabs.work' },
    { id: 'sprints', icon: 'sprint', labelKey: 'projectOverview.v2.tabs.sprints', module: 'sprints' },
    { id: 'milestones', icon: 'flag', labelKey: 'projectOverview.v2.tabs.milestones', module: 'milestones' },
    { id: 'activity', icon: 'history', labelKey: 'projectOverview.v2.tabs.activity', module: 'activity' }
];

export const OVERVIEW_VIEWS: ViewDescriptor[] = [
    { id: 'list', icon: 'view_list', labelKey: 'projectOverview.v2.views.list', supportedTabs: ['work', 'sprints', 'milestones'] },
    { id: 'board', icon: 'view_column', labelKey: 'projectOverview.v2.views.board', supportedTabs: ['work', 'sprints'] },
    { id: 'timeline', icon: 'timeline', labelKey: 'projectOverview.v2.views.timeline', supportedTabs: ['work', 'milestones'] },
    { id: 'calendar', icon: 'calendar_month', labelKey: 'projectOverview.v2.views.calendar', supportedTabs: ['work', 'milestones'] },
    { id: 'relationships', icon: 'hub', labelKey: 'projectOverview.v2.views.relationships', supportedTabs: ['work'] }
];

/** Resolve the project's effective module set (PM-core normalized). */
export const resolveEnabledModules = (project: Project | null): Set<ProjectModule> => {
    const modules = project?.modules ?? [];
    return new Set(normalizeModulesForPmCore([...modules]));
};

export const resolveEnabledTabs = (project: Project | null): TabDescriptor[] => {
    const enabled = resolveEnabledModules(project);
    return OVERVIEW_TABS.filter((tab) => !tab.module || enabled.has(tab.module));
};

export const resolveViewsForTab = (tab: OverviewTab): ViewDescriptor[] =>
    OVERVIEW_VIEWS.filter((view) => view.supportedTabs.includes(tab));

export const DEFAULT_VIEW_FOR_TAB: Record<OverviewTab, OverviewWorkView> = {
    work: 'board',
    sprints: 'board',
    milestones: 'timeline',
    activity: 'list'
};
