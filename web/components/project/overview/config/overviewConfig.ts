import type { ProjectModule } from '../../../../types';

/**
 * Workspace tabs in the redesigned overview. The sidebar is the only project
 * navigation, so the overview itself only has the work tab; sprints,
 * milestones and activity live on their own sidebar pages and the roadmap is a
 * work view. The other ids stay for persisted-state compatibility.
 */
export type OverviewTab = 'work' | 'roadmap' | 'sprints' | 'milestones' | 'activity';

/** Work views available for the work-item surface. */
export type OverviewWorkView = 'list' | 'board' | 'people' | 'timeline' | 'roadmap' | 'calendar' | 'relationships';

export type OverviewGroupBy = 'due' | 'status' | 'priority' | 'initiative' | 'assignee' | 'none';
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
    { id: 'work', icon: 'dashboard', labelKey: 'projectOverview.v2.tabs.work' }
];

export const OVERVIEW_VIEWS: ViewDescriptor[] = [
    { id: 'list', icon: 'view_list', labelKey: 'projectOverview.v2.views.list', supportedTabs: ['work', 'sprints', 'milestones'] },
    { id: 'board', icon: 'view_column', labelKey: 'projectOverview.v2.views.board', supportedTabs: ['work', 'sprints'] },
    { id: 'people', icon: 'groups', labelKey: 'planning.views.people', supportedTabs: ['work'] },
    { id: 'timeline', icon: 'view_timeline', labelKey: 'projectOverview.v2.views.timeline', supportedTabs: ['work', 'milestones'] },
    { id: 'roadmap', icon: 'route', labelKey: 'planning.tabs.roadmap', supportedTabs: ['work'] },
    { id: 'calendar', icon: 'calendar_month', labelKey: 'projectOverview.v2.views.calendar', supportedTabs: ['work', 'milestones'] },
    { id: 'relationships', icon: 'hub', labelKey: 'projectOverview.v2.views.relationships', supportedTabs: ['work'] }
];

export const resolveViewsForTab = (tab: OverviewTab): ViewDescriptor[] =>
    OVERVIEW_VIEWS.filter((view) => view.supportedTabs.includes(tab));

export const DEFAULT_VIEW_FOR_TAB: Record<OverviewTab, OverviewWorkView> = {
    work: 'list',
    roadmap: 'timeline',
    sprints: 'board',
    milestones: 'timeline',
    activity: 'list'
};
