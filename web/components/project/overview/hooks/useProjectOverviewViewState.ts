import { useCallback, useMemo, useState } from 'react';
import {
    DEFAULT_VIEW_FOR_TAB,
    type OverviewGroupBy,
    type OverviewSortBy,
    type OverviewTab,
    type OverviewWorkView,
    resolveViewsForTab
} from '../config/overviewConfig';

const STORAGE = {
    tab: 'projectflow.projectOverview.tab',
    workView: 'projectflow.projectOverview.workView',
    sort: 'projectflow.projectOverview.sort',
    groupBy: 'projectflow.projectOverview.groupBy',
    filters: 'projectflow.projectOverview.filters'
} as const;

export type OverviewFilters = {
    search: string;
    statuses: string[];
    priorities: string[];
    assigneeIds: string[];
    initiativeId: string | null;
    showCompleted: boolean;
};

const EMPTY_FILTERS: OverviewFilters = {
    search: '',
    statuses: [],
    priorities: [],
    assigneeIds: [],
    initiativeId: null,
    showCompleted: false
};

const read = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
};

const write = (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Storage may be unavailable (private mode); fail silently.
    }
};

const isTab = (value: string | null): value is OverviewTab =>
    value === 'work' || value === 'sprints' || value === 'milestones' || value === 'activity';

const isWorkView = (value: string | null): value is OverviewWorkView =>
    value === 'list' || value === 'board' || value === 'kanban'
    || value === 'timeline' || value === 'calendar' || value === 'relationships';

const isSortBy = (value: string | null): value is OverviewSortBy =>
    value === 'manual' || value === 'priority' || value === 'dueDate'
    || value === 'title' || value === 'createdAt';

const isGroupBy = (value: string | null): value is OverviewGroupBy =>
    value === 'status' || value === 'priority' || value === 'initiative'
    || value === 'assignee' || value === 'none';

const readFilters = (): OverviewFilters => {
    const raw = read(STORAGE.filters);
    if (!raw) return EMPTY_FILTERS;
    try {
        const parsed = JSON.parse(raw) as Partial<OverviewFilters>;
        return {
            ...EMPTY_FILTERS,
            ...parsed,
            // Search is intentionally ephemeral.
            search: ''
        };
    } catch {
        return EMPTY_FILTERS;
    }
};

export type ProjectOverviewViewState = {
    tab: OverviewTab;
    setTab: (tab: OverviewTab) => void;
    view: OverviewWorkView;
    setView: (view: OverviewWorkView) => void;
    sortBy: OverviewSortBy;
    setSortBy: (sort: OverviewSortBy) => void;
    groupBy: OverviewGroupBy;
    setGroupBy: (group: OverviewGroupBy) => void;
    filters: OverviewFilters;
    setFilters: (next: OverviewFilters | ((prev: OverviewFilters) => OverviewFilters)) => void;
    resetFilters: () => void;
    activeFilterCount: number;
};

/**
 * Owns tab/view/sort/group/filter state for the overview workspace and persists
 * the durable parts to localStorage. The active view is clamped to the views
 * that the active tab actually supports.
 */
export const useProjectOverviewViewState = (): ProjectOverviewViewState => {
    const [tab, setTabState] = useState<OverviewTab>(() => {
        const stored = read(STORAGE.tab);
        return isTab(stored) ? stored : 'work';
    });
    const [view, setViewState] = useState<OverviewWorkView>(() => {
        const stored = read(STORAGE.workView) ?? read('projectflow.projectOverview.tasksView');
        return isWorkView(stored) ? stored : DEFAULT_VIEW_FOR_TAB.work;
    });
    const [sortBy, setSortByState] = useState<OverviewSortBy>(() => {
        const stored = read(STORAGE.sort);
        return isSortBy(stored) ? stored : 'manual';
    });
    const [groupBy, setGroupByState] = useState<OverviewGroupBy>(() => {
        const stored = read(STORAGE.groupBy);
        return isGroupBy(stored) ? stored : 'status';
    });
    const [filters, setFiltersState] = useState<OverviewFilters>(readFilters);

    const setTab = useCallback((next: OverviewTab) => {
        setTabState(next);
        write(STORAGE.tab, next);
        // Clamp the active view to one supported by the new tab.
        const supported = resolveViewsForTab(next).map((v) => v.id);
        setViewState((current) => {
            if (supported.includes(current)) return current;
            const fallback = DEFAULT_VIEW_FOR_TAB[next];
            const resolved = supported.includes(fallback) ? fallback : supported[0];
            write(STORAGE.workView, resolved);
            return resolved;
        });
    }, []);

    const setView = useCallback((next: OverviewWorkView) => {
        setViewState(next);
        write(STORAGE.workView, next);
    }, []);

    const setSortBy = useCallback((next: OverviewSortBy) => {
        setSortByState(next);
        write(STORAGE.sort, next);
    }, []);

    const setGroupBy = useCallback((next: OverviewGroupBy) => {
        setGroupByState(next);
        write(STORAGE.groupBy, next);
    }, []);

    const setFilters = useCallback((next: OverviewFilters | ((prev: OverviewFilters) => OverviewFilters)) => {
        setFiltersState((prev) => {
            const resolved = typeof next === 'function' ? next(prev) : next;
            write(STORAGE.filters, JSON.stringify({ ...resolved, search: '' }));
            return resolved;
        });
    }, []);

    const resetFilters = useCallback(() => {
        setFiltersState(EMPTY_FILTERS);
        write(STORAGE.filters, JSON.stringify(EMPTY_FILTERS));
    }, []);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.statuses.length) count += 1;
        if (filters.priorities.length) count += 1;
        if (filters.assigneeIds.length) count += 1;
        if (filters.initiativeId) count += 1;
        if (filters.showCompleted) count += 1;
        return count;
    }, [filters]);

    return {
        tab,
        setTab,
        view,
        setView,
        sortBy,
        setSortBy,
        groupBy,
        setGroupBy,
        filters,
        setFilters,
        resetFilters,
        activeFilterCount
    };
};
