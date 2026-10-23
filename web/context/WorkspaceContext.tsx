import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { signOut } from 'firebase/auth';

import { auth } from '../services/firebase';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import {
    createWorkspace as createWorkspaceDoc,
    listMyPendingInvitations,
    listMyWorkspaces,
    resolveWorkspaceForCurrentUser,
    switchWorkspace as switchWorkspaceAndReload,
    type WorkspaceInvitation,
    type WorkspaceSummary
} from '../services/domain/workspacesService';

const RESOLVE_TIMEOUT_MS = 20000;

type WorkspaceStatus = 'signed-out' | 'loading' | 'ready' | 'error';

interface WorkspaceContextValue {
    status: WorkspaceStatus;
    activeWorkspaceId: string | null;
    activeWorkspace: WorkspaceSummary | null;
    workspaces: WorkspaceSummary[];
    pendingInvitations: WorkspaceInvitation[];
    refresh: () => Promise<void>;
    switchWorkspace: (tenantId: string, redirectTo?: string) => Promise<void>;
    createWorkspace: (name: string) => Promise<string>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const useWorkspace = () => {
    const context = useContext(WorkspaceContext);
    if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
    return context;
};

/**
 * Resolves the active workspace once per signed-in user and renders the app
 * only when it is known, so every tenant-scoped read has a valid tenant id.
 */
const WorkspaceConnectingPanel = () => {
    const { t } = useLanguage();
    return (
        <div className="workspace-gate__panel">
            <span className="material-symbols-outlined workspace-gate__icon workspace-gate__spin">progress_activity</span>
            <p className="workspace-gate__text">{t('app.loading.connecting')}</p>
        </div>
    );
};

/** The gate's loading screen, for screens that hand over to the app right after sign-in. */
export const WorkspaceConnecting = () => (
    <div className="workspace-gate">
        <WorkspaceConnectingPanel />
    </div>
);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
    const { user, isAuthReady } = useAuth();
    const { t } = useLanguage();
    const [status, setStatus] = useState<WorkspaceStatus>('signed-out');
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
    const [pendingInvitations, setPendingInvitations] = useState<WorkspaceInvitation[]>([]);
    const resolvedFor = useRef<string | null>(null);
    const attemptRef = useRef(0);

    const defaultName = useCallback(() => {
        const current = auth.currentUser;
        const name = current?.displayName || (current?.email || '').split('@')[0];
        return name ? t('workspace.defaultName').replace('{name}', name) : t('workspace.defaultNameFallback');
    }, [t]);

    const resolve = useCallback(async () => {
        const attempt = ++attemptRef.current;
        setStatus('loading');
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            // A stalled Firestore connection would otherwise leave the spinner up forever.
            const timeout = new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Workspace resolution timed out')), RESOLVE_TIMEOUT_MS);
            });
            const { activeId, workspaces: list } = await Promise.race([resolveWorkspaceForCurrentUser(defaultName()), timeout]);
            if (attempt !== attemptRef.current) return;
            setWorkspaces(list);
            setActiveWorkspaceId(activeId);
            setStatus('ready');
            void listMyPendingInvitations().then(setPendingInvitations);
        } catch (error) {
            if (attempt !== attemptRef.current) return;
            console.error('Workspace resolution failed', error);
            setStatus('error');
        } finally {
            clearTimeout(timer);
        }
    }, [defaultName]);

    useEffect(() => {
        if (!isAuthReady) return;
        if (!user) {
            resolvedFor.current = null;
            setStatus('signed-out');
            setActiveWorkspaceId(null);
            setWorkspaces([]);
            setPendingInvitations([]);
            return;
        }
        if (resolvedFor.current === user.uid) return;
        resolvedFor.current = user.uid;
        void resolve();
    }, [isAuthReady, user, resolve]);

    const refresh = useCallback(async () => {
        const [list, invites] = await Promise.all([listMyWorkspaces(), listMyPendingInvitations()]);
        setWorkspaces(list);
        setPendingInvitations(invites);
    }, []);

    const createWorkspace = useCallback(async (name: string) => {
        const id = await createWorkspaceDoc(name);
        await refresh();
        return id;
    }, [refresh]);

    const value = useMemo<WorkspaceContextValue>(() => ({
        status,
        activeWorkspaceId,
        activeWorkspace: workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null,
        workspaces,
        pendingInvitations,
        refresh,
        switchWorkspace: switchWorkspaceAndReload,
        createWorkspace
    }), [status, activeWorkspaceId, workspaces, pendingInvitations, refresh, createWorkspace]);

    if (user && status !== 'ready') {
        return (
            <div className="workspace-gate">
                {status === 'error' ? (
                    <div className="workspace-gate__panel">
                        <span className="material-symbols-outlined workspace-gate__icon workspace-gate__icon--error">error</span>
                        <p className="workspace-gate__title">{t('workspace.gate.errorTitle')}</p>
                        <p className="workspace-gate__text">{t('workspace.gate.errorText')}</p>
                        <div className="workspace-gate__actions">
                            <button type="button" className="workspace-gate__button" onClick={() => void resolve()}>
                                {t('workspace.gate.retry')}
                            </button>
                            <button type="button" className="workspace-gate__button workspace-gate__button--ghost" onClick={() => void signOut(auth)}>
                                {t('workspace.gate.signOut')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <WorkspaceConnectingPanel />
                )}
            </div>
        );
    }

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};
