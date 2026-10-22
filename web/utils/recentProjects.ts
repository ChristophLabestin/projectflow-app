const RECENT_STORAGE_PREFIX = 'projectflow.recentProjects';

/** Fired on window after a project is created or deleted so cached project lists reload. */
export const PROJECTS_CHANGED_EVENT = 'projectflow:projects-changed';
export const notifyProjectsChanged = () => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT));
};

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
