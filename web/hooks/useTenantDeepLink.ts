import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useWorkspace } from '../context/WorkspaceContext';

/**
 * Handles `?tenant=<id>` deep links on project/task URLs.
 * - Member of that workspace: switches the active workspace (reloads on the same URL).
 * - Not a member: reports `noAccess` so the screen can show a "no access" state.
 */
export const useTenantDeepLink = () => {
    const location = useLocation();
    const { activeWorkspaceId, workspaces, switchWorkspace } = useWorkspace();
    const linkedTenantId = new URLSearchParams(location.search).get('tenant');
    const differs = Boolean(linkedTenantId && activeWorkspaceId && linkedTenantId !== activeWorkspaceId);
    const isMember = Boolean(linkedTenantId && workspaces.some((workspace) => workspace.id === linkedTenantId));

    useEffect(() => {
        if (differs && isMember && linkedTenantId) {
            void switchWorkspace(linkedTenantId, `${location.pathname}${location.search}`);
        }
    }, [differs, isMember, linkedTenantId, location.pathname, location.search, switchWorkspace]);

    return {
        switching: differs && isMember,
        noAccess: differs && !isMember
    };
};
