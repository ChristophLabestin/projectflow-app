// Feature switches for surfaces that are kept in the codebase but not exposed.

/**
 * Workspace areas in the sidebar ("Arbeitsbereich") that are owned by other work streams.
 * Each owning session flips its flag to `true` once its route exists (activity-insights concept).
 */
export const WORKSPACE_AREAS = {
    documents: true,
    wiki: true,
    flows: true,
    // Forms (brain/plans/forms-concept.md): flips to true with package 2 (builder + /forms routes).
    forms: false,
} as const;

export type WorkspaceArea = keyof typeof WORKSPACE_AREAS;

export const isWorkspaceAreaEnabled = (area: WorkspaceArea): boolean => WORKSPACE_AREAS[area];
