import { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getWorkspaceAiPolicy } from '../services/aiIntegrations';

/**
 * Whether the in-app assistant (✦, ⌘J) is available in the active workspace: the rollout flag
 * `inAppAi` and the Owner/Admin switch `inAppEnabled` must both be on. The policy is read once per
 * workspace and cached; `forgetInAppAi` drops the cache after a settings change.
 */
const cache = new Map<string, Promise<boolean>>();
const listeners = new Set<() => void>();

const load = (tenantId: string) => {
    let entry = cache.get(tenantId);
    if (!entry) {
        entry = getWorkspaceAiPolicy(tenantId)
            .then(({ policy }) => Boolean(policy.inAppAi && policy.inAppEnabled))
            .catch(() => false);
        cache.set(tenantId, entry);
    }
    return entry;
};

export const forgetInAppAi = (tenantId?: string) => {
    if (tenantId) cache.delete(tenantId);
    else cache.clear();
    listeners.forEach((listener) => listener());
};

export const useInAppAi = () => {
    const { activeWorkspaceId } = useWorkspace();
    const [enabled, setEnabled] = useState(false);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const listener = () => setVersion((value) => value + 1);
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }, []);

    useEffect(() => {
        let alive = true;
        if (!activeWorkspaceId) {
            setEnabled(false);
            return undefined;
        }
        load(activeWorkspaceId).then((value) => { if (alive) setEnabled(value); });
        return () => { alive = false; };
    }, [activeWorkspaceId, version]);

    return { enabled, tenantId: activeWorkspaceId };
};
