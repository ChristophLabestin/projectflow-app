import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query
} from 'firebase/firestore';

import { db } from '../firebase';
import type { CodexFollowUp, CodexSession } from '../../types';
import { resolveActiveTenantId } from './authService';

const CODEX_SESSIONS = 'codex_sessions';
const CODEX_FOLLOWUPS = 'codex_followups';

const projectCodexSessionsCollection = (tenantId: string, projectId: string) =>
    collection(db, 'tenants', tenantId, 'projects', projectId, CODEX_SESSIONS);

const projectCodexFollowupsCollection = (tenantId: string, projectId: string) =>
    collection(db, 'tenants', tenantId, 'projects', projectId, CODEX_FOLLOWUPS);

export const subscribeProjectCodexSessions = (
    projectId: string,
    callback: (sessions: CodexSession[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveActiveTenantId(tenantId);
    if (!resolvedTenant) {
        callback([]);
        return () => undefined;
    }

    const sessionsQuery = query(
        projectCodexSessionsCollection(resolvedTenant, projectId),
        orderBy('updatedAt', 'desc'),
        limit(100)
    );

    return onSnapshot(sessionsQuery, (snapshot) => {
        callback(snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        } as CodexSession)));
    }, (error) => {
        console.error('Error subscribing to Codex sessions:', error);
        callback([]);
    });
};

export const subscribeProjectCodexFollowUps = (
    projectId: string,
    callback: (followUps: CodexFollowUp[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveActiveTenantId(tenantId);
    if (!resolvedTenant) {
        callback([]);
        return () => undefined;
    }

    const followupsQuery = query(
        projectCodexFollowupsCollection(resolvedTenant, projectId),
        orderBy('updatedAt', 'desc'),
        limit(100)
    );

    return onSnapshot(followupsQuery, (snapshot) => {
        callback(snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        } as CodexFollowUp)));
    }, (error) => {
        console.error('Error subscribing to Codex follow-ups:', error);
        callback([]);
    });
};
