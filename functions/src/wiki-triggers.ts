// Wiki activity events: tenants/{t}/docs/{docId} → tenants/{t}/activity (contract v1).
import * as functions from 'firebase-functions/v1';
import { db } from './init';
import { buildActor, emitActivityEvent, freshWriteVia } from './activity-events';
import { getActor, idPart } from './notification-writer';
import { docPath, planDocEvents } from './wiki-logic';

const REGION = 'europe-west3';

const loadProjectTitle = async (tenantId: string, projectId: string): Promise<string> => {
    try {
        const snap = await db.doc(`tenants/${tenantId}/projects/${projectId}`).get();
        const title = snap.data()?.title;
        return typeof title === 'string' ? title.trim() : '';
    } catch {
        return '';
    }
};

export const onWikiDocWritten = functions.region(REGION).firestore
    .document('tenants/{tenantId}/docs/{docId}')
    .onWrite(async (change, context) => {
        const { tenantId, docId } = context.params as Record<string, string>;
        const before = change.before.exists ? (change.before.data() || {}) : null;
        const after = change.after.exists ? (change.after.data() || {}) : null;
        const events = planDocEvents(before, after, docId);
        if (!events.length) return;

        const data = (after || before) as Record<string, any>;
        const projectId = data.spaceType === 'project' && data.projectId ? String(data.projectId) : null;
        const projectTitle = projectId ? await loadProjectTitle(tenantId, projectId) : '';
        const eventId = idPart(context.eventId || `${docId}-${Date.now()}`);

        for (const event of events) {
            const user = event.actorId ? await getActor(event.actorId) : null;
            const key = event.type === 'doc.updated' ? `doc-${idPart(docId)}-${event.key}` : `${eventId}-doc-${event.key}`;
            await emitActivityEvent(tenantId, {
                type: event.type,
                actor: buildActor(event.type === 'doc.deleted' ? null : user, after ? freshWriteVia(before, after) : null),
                object: { type: 'doc', id: docId, title: String(data.title || '') || 'Untitled' },
                projectId,
                ...(projectTitle ? { projectTitle } : {}),
                ...(event.changes ? { changes: event.changes } : {}),
                meta: { path: docPath(docId, data), spaceType: data.spaceType === 'project' ? 'project' : 'workspace' },
                source: 'onWikiDocWritten',
            }, key);
        }
    });
