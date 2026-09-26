// Feature switches for surfaces that are kept in the codebase but not exposed.

/**
 * CORA Studio (`/brainstorm`) is disabled by default: the route redirects to
 * the dashboard and navigation entries are hidden. Set
 * `VITE_CORA_STUDIO_ENABLED=true` to bring it back.
 */
export const isCoraStudioEnabled = () => import.meta.env.VITE_CORA_STUDIO_ENABLED === 'true';
