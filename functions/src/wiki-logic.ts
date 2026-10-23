// Pure planning for wiki activity events (brain/plans/wiki-concept.md, activity-events-contract.md).
type Json = Record<string, any>;

export const DOC_UPDATE_BUCKET_MS = 10 * 60 * 1000;

export interface PlannedDocEvent {
    type: 'doc.created' | 'doc.updated' | 'doc.archived' | 'doc.restored' | 'doc.deleted';
    actorId: string;
    /** Idempotency suffix; doc.updated uses a 10-minute bucket per page + person (throttle). */
    key: string;
    changes?: Record<string, { from: unknown; to: unknown }>;
}

const millis = (value: any): number => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value._seconds === 'number') return value._seconds * 1000;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
};

export const docPath = (docId: string, data: Json) =>
    data.spaceType === 'project' && data.projectId ? `/project/${data.projectId}/wiki/${docId}` : `/wiki/${docId}`;

export const planDocEvents = (before: Json | null, after: Json | null, docId: string, now = Date.now()): PlannedDocEvent[] => {
    if (!before && after) {
        return [{ type: 'doc.created', actorId: String(after.createdBy || ''), key: 'c' }];
    }
    if (before && !after) {
        return [{ type: 'doc.deleted', actorId: '', key: 'd' }];
    }
    if (!before || !after) return [];

    const wasArchived = Boolean(before.archivedAt);
    const isArchived = Boolean(after.archivedAt);
    if (!wasArchived && isArchived) {
        // Sub-pages archived with their parent do not get their own event.
        return after.archivedRoot === false ? [] : [{ type: 'doc.archived', actorId: String(after.archivedBy || ''), key: 'a' }];
    }
    if (wasArchived && !isArchived) {
        return [{ type: 'doc.restored', actorId: String(after.updatedBy || ''), key: 'r' }];
    }
    if (isArchived) return [];

    const contentChanged = Number(after.bodyRev || 0) > Number(before.bodyRev || 0);
    const titleChanged = (before.title || '') !== (after.title || '');
    if (!contentChanged && !titleChanged) return [];
    const actorId = String(after.updatedBy || '');
    const bucket = Math.floor((millis(after.updatedAt) || now) / DOC_UPDATE_BUCKET_MS);
    return [{
        type: 'doc.updated',
        actorId,
        key: `u-${actorId || 'x'}-${bucket}`,
        ...(titleChanged ? { changes: { title: { from: before.title || '', to: after.title || '' } } } : {}),
    }];
};
