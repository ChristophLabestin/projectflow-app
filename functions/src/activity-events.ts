// Single writer of the workspace activity stream `tenants/{t}/activity/{eventId}`.
// Contract: brain/plans/activity-events-contract.md. Server-only (firestore.rules deny client writes).
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './init';
import {
    ACTIVITY_RETENTION_DAYS,
    ACTIVITY_SCHEMA_VERSION,
    ActivityActor,
    ActivityChanges,
    ActivityEventType,
    ActivityObject,
    domainOf,
    sanitizeValue
} from './activity-logic';
import { idPart } from './task-effects';

export * from './activity-logic';

const ALREADY_EXISTS = 6;

export interface ActivityEventInput {
    type: ActivityEventType;
    actor: ActivityActor;
    object: ActivityObject;
    /** Permission scope; null = workspace-level (full members only). */
    projectId: string | null;
    projectTitle?: string;
    changes?: ActivityChanges;
    meta?: Record<string, unknown>;
    /** Writer id, e.g. 'onTaskWritten'. */
    source: string;
}

/**
 * Write one event. `key` must be deterministic per logical event (e.g. `${context.eventId}-a0`) so
 * a retried function does not duplicate it. Returns false when the event already existed.
 * Never throws for activity problems — the stream must not break the caller's main work.
 */
export const emitActivityEvent = async (tenantId: string, input: ActivityEventInput, key: string): Promise<boolean> => {
    if (!tenantId || !input?.type || !input.object?.id) return false;
    const actor = sanitizeValue(input.actor) as ActivityActor;
    const doc: Record<string, unknown> = {
        v: ACTIVITY_SCHEMA_VERSION,
        type: input.type,
        domain: domainOf(input.type),
        actor,
        actorId: input.actor.kind === 'user' || input.actor.kind === 'ai' ? input.actor.id || null : null,
        object: sanitizeValue(input.object),
        projectId: input.projectId || null,
        source: input.source,
        createdAt: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    };
    if (input.projectTitle) doc.projectTitle = input.projectTitle;
    if (input.changes && Object.keys(input.changes).length) doc.changes = sanitizeValue(input.changes);
    if (input.meta && Object.keys(input.meta).length) doc.meta = sanitizeValue(input.meta);

    try {
        await db.doc(`tenants/${tenantId}/activity/${idPart(key)}`).create(doc);
        return true;
    } catch (error: any) {
        if (error?.code === ALREADY_EXISTS) return false;
        console.error('emitActivityEvent failed', tenantId, input.type, error);
        return false;
    }
};
