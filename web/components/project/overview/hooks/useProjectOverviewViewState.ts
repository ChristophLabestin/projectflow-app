import { useCallback, useMemo, useState } from 'react';
import {
    DEFAULT_VIEW_FOR_TAB,
    type OverviewGroupBy,
    type OverviewSortBy,
    type OverviewTab,
    type OverviewWorkView,
    resolveViewsForTab
} from '../config/overviewConfig';
import { auth } from '../../../../services/firebase';

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

const userKey = (key: string) => `${key}.${auth.currentUser?.uid || 'anonymous'}`;

const read = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
        // Per user, so a shared device does not hand one person's view to the next.
        return window.localStorage.getItem(userKey(key));
    } catch {
        return null;
    }
};

const write = (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(userKey(key), value);
    } catch {
        // Storage may be unavailable (private mode); fail silently.
    }
};

const isWorkView = (value: string | null): value is OverviewWorkView =>
    value === 'list' || value === 'board' || value === 'people'
    || value === 'timeline' || value === 'roadmap' || value === 'calendar' || value === 'relationships';

const normalizeWorkView = (value: string | null): OverviewWorkView | null => {
    if (value === 'kanban') return 'board';
    return isWorkView(value) ? value : null;
};

const isSortBy = (value: string | null): value is OverviewSortBy =>
    value === 'manual' || value === 'priority' || value === 'dueDate'
    || value === 'title' || value === 'createdAt';

const isGroupBy = (value: string | null): value is OverviewGroupBy =>
    value === 'due' || value === 'status' || value === 'priority' || value === 'initiative'
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
    // Only the work tab remains (see OVERVIEW_TABS); older stored tabs fall back to it.
    const [tab, setTabState] = useState<OverviewTab>('work');
    const [view, setViewState] = useState<OverviewWorkView>(() => {
        // The roadmap used to be its own tab; it is a work view now.
        if (read(STORAGE.tab) === 'roadmap') {
            write(STORAGE.tab, 'work');
            write(STORAGE.workView, 'roadmap');
            return 'roadmap';
        }
        const stored = read(STORAGE.workView) ?? read('projectflow.projectOverview.tasksView');
        return normalizeWorkView(stored) || DEFAULT_VIEW_FOR_TAB.work;
    });
    const [sortBy, setSortByState] = useState<OverviewSortBy>(() => {
        const stored = read(STORAGE.sort);
        return isSortBy(stored) ? stored : 'manual';
    });
    const [groupBy, setGroupByState] = useState<OverviewGroupBy>(() => {
        const stored = read(STORAGE.groupBy);
        return isGroupBy(stored) ? stored : 'due';
    });
    const [filters, setFiltersState] = useState<OverviewFilters>(readFilters);

    const setTab = useCallback((next: OverviewTab) => {
        setTabState(next);
        write(STORAGE.tab, next);
        // Clamp the active view to one supported by the new tab.
        const supported = resolveViewsForTab(next).map((v) => v.id);
        setViewState((current) => {
            // Tabs without sub-views (roadmap, activity) keep the work view as is.
            if (!supported.length || supported.includes(current)) return current;
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
