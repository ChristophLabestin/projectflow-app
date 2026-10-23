// Reads the workspace activity stream `tenants/{t}/activity` (server-written).
// Contract: brain/plans/activity-events-contract.md. Guests must always constrain `projectId`.
import {
    collection,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    startAfter,
    where,
    type DocumentSnapshot,
    type QueryConstraint,
} from 'firebase/firestore';

import { db } from '../firebase';
import { toMillis } from '../../utils/time';

export type ActivityActorKind = 'user' | 'ai' | 'automation' | 'system';

export interface ActivityEvent {
    id: string;
    type: string;
    domain: string;
    actor: { kind: ActivityActorKind; id: string | null; name: string; photoURL?: string; client?: string; automationId?: string };
    actorId: string | null;
    object: { type: string; id: string; title: string; parentType?: string; parentId?: string };
    projectId: string | null;
    projectTitle?: string;
    changes?: Record<string, { from: unknown; to: unknown }>;
    meta?: Record<string, unknown>;
    /** Epoch millis (0 while the server timestamp is pending). */
    createdAtMs: number;
}

export interface ActivityFeedFilter {
    /** Single project (project feed or project filter). */
    projectId?: string;
    /** Guest scope: projects the user may see (max 30, used when no projectId is set). */
    scopeProjectIds?: string[];
    actorId?: string;
    domain?: string;
    /** Only events at or after this instant. */
    sinceMs?: number;
}

export const ACTIVITY_PAGE_SIZE = 30;
const MAX_IN = 30;

const activityCollection = (tenantId: string) => collection(db, 'tenants', tenantId, 'activity');

const toEvent = (snap: DocumentSnapshot): ActivityEvent => {
    const data = snap.data() || {};
    return {
        id: snap.id,
        type: String(data.type || ''),
        domain: String(data.domain || String(data.type || '').split('.')[0]),
        actor: data.actor || { kind: 'system', id: null, name: '' },
        actorId: data.actorId ?? null,
        object: data.object || { type: '', id: '', title: '' },
        projectId: data.projectId ?? null,
        projectTitle: data.projectTitle,
        changes: data.changes,
        meta: data.meta,
        createdAtMs: toMillis(data.createdAt) || Date.now(),
    };
};

/** Null when the filter cannot produce results (guest without projects). */
const buildConstraints = (filter: ActivityFeedFilter): QueryConstraint[] | null => {
    const constraints: QueryConstraint[] = [];
    if (filter.projectId) {
        constraints.push(where('projectId', '==', filter.projectId));
    } else if (filter.scopeProjectIds) {
        const scope = filter.scopeProjectIds.slice(0, MAX_IN);
        if (scope.length === 0) return null;
        constraints.push(where('projectId', 'in', scope));
    }
    if (filter.actorId) constraints.push(where('actorId', '==', filter.actorId));
    if (filter.domain) constraints.push(where('domain', '==', filter.domain));
    if (filter.sinceMs) constraints.push(where('createdAt', '>=', new Date(filter.sinceMs)));
    constraints.push(orderBy('createdAt', 'desc'));
    return constraints;
};

export interface ActivityPage {
    events: ActivityEvent[];
    cursor: DocumentSnapshot | null;
    hasMore: boolean;
}

/** Live first page. */
export const subscribeActivityFeed = (
    tenantId: string,
    filter: ActivityFeedFilter,
    callback: (page: ActivityPage) => void,
    onError?: (error: Error) => void
): (() => void) => {
    const constraints = buildConstraints(filter);
    if (!tenantId || !constraints) {
        callback({ events: [], cursor: null, hasMore: false });
        return () => undefined;
    }
    return onSnapshot(
        query(activityCollection(tenantId), ...constraints, limit(ACTIVITY_PAGE_SIZE)),
        (snapshot) => callback({
            events: snapshot.docs.map(toEvent),
            cursor: snapshot.docs[snapshot.docs.length - 1] || null,
            hasMore: snapshot.docs.length === ACTIVITY_PAGE_SIZE,
        }),
        (error) => onError?.(error)
    );
};

/** Older page after `cursor`. */
export const fetchActivityPage = async (
    tenantId: string,
    filter: ActivityFeedFilter,
    cursor: DocumentSnapshot
): Promise<ActivityPage> => {
    const constraints = buildConstraints(filter);
    if (!tenantId || !constraints) return { events: [], cursor: null, hasMore: false };
    const snapshot = await getDocs(query(activityCollection(tenantId), ...constraints, startAfter(cursor), limit(ACTIVITY_PAGE_SIZE)));
    return {
        events: snapshot.docs.map(toEvent),
        cursor: snapshot.docs[snapshot.docs.length - 1] || null,
        hasMore: snapshot.docs.length === ACTIVITY_PAGE_SIZE,
    };
};

/** Last-N events for a time window (insights report preview, small widgets). */
export const fetchRecentActivity = async (tenantId: string, filter: ActivityFeedFilter, max = 200): Promise<ActivityEvent[]> => {
    const constraints = buildConstraints(filter);
    if (!tenantId || !constraints) return [];
    const snapshot = await getDocs(query(activityCollection(tenantId), ...constraints, limit(max)));
    return snapshot.docs.map(toEvent);
};
