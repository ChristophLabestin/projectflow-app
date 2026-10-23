// Activity events for the file manager (brain/plans/activity-events-contract.md). Best effort:
// a failed event never fails the file operation.
import * as functions from 'firebase-functions/v1';

import { emitActivityEvent } from './activity-events';
import type { FileParent } from './files-logic';

export type FileEventType = 'file.uploaded' | 'file.version_added' | 'file.moved' | 'file.trashed' | 'file.restored' | 'file.deleted';

export const emitFileEvent = async (args: {
    tenantId: string;
    type: FileEventType;
    fileId: string;
    record: { name?: string; fileName?: string; projectId?: string | null; parent?: FileParent; sizeBytes?: number; mimeType?: string; version?: number };
    context: functions.https.CallableContext;
    key: string;
    meta?: Record<string, unknown>;
}) => {
    const token = (args.context.auth?.token || {}) as Record<string, unknown>;
    const parent = args.record.parent;
    await emitActivityEvent(args.tenantId, {
        type: args.type,
        actor: {
            kind: 'user',
            id: args.context.auth?.uid || null,
            name: String(token.name || token.email || ''),
            ...(token.picture ? { photoURL: String(token.picture) } : {}),
        },
        object: {
            type: 'file',
            id: args.fileId,
            title: args.record.name || args.record.fileName || '',
            ...(parent ? { parentType: parent.rootType || parent.type, parentId: parent.rootId || parent.id } : {}),
        },
        projectId: args.record.projectId || null,
        meta: {
            ...(args.record.mimeType ? { mimeType: args.record.mimeType } : {}),
            ...(args.record.sizeBytes ? { sizeBytes: args.record.sizeBytes } : {}),
            ...(parent?.title ? { parentTitle: parent.title } : {}),
            ...(args.meta || {}),
        },
        source: 'files',
    }, args.key).catch(() => false);
};
