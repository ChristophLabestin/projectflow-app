// Feature switches for surfaces that are kept in the codebase but not exposed.

/**
 * CORA Studio (`/brainstorm`) is disabled by default: the route redirects to
 * the dashboard and navigation entries are hidden. Set
 * `VITE_CORA_STUDIO_ENABLED=true` to bring it back.
 */
export const isCoraStudioEnabled = () => import.meta.env.VITE_CORA_STUDIO_ENABLED === 'true';

/**
 * Workspace areas in the sidebar ("Arbeitsbereich") that are owned by other work streams.
 * Each owning session flips its flag to `true` once its route exists (activity-insights concept).
 */
export const WORKSPACE_AREAS = {
    documents: true,
    wiki: true,
    flows: false,
} as const;

export type WorkspaceArea = keyof typeof WORKSPACE_AREAS;

export const isWorkspaceAreaEnabled = (area: WorkspaceArea): boolean => WORKSPACE_AREAS[area];
