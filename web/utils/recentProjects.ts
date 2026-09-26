const RECENT_STORAGE_PREFIX = 'projectflow.recentProjects';

export const recentProjectsStorageKey = (userId?: string) => `${RECENT_STORAGE_PREFIX}.${userId || 'anonymous'}`;

/** Last-opened timestamps per project id, written by the sidebar when a project is opened. */
export const readRecentProjectAccess = (userId?: string): Record<string, number> => {
    if (typeof window === 'undefined') return {};
    try {
        const stored = window.localStorage.getItem(recentProjectsStorageKey(userId));
        if (!stored) return {};
        const parsed = JSON.parse(stored);
        return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {};
    } catch {
        return {};
    }
};
