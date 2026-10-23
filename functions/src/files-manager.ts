// Callables for the workspace file manager (brain/plans/files-concept.md). Uploads go through
// createTenantFileUploadSession/finalizeTenantFileUpload with module 'files'; everything after the
// upload (urls, rename, move, trash, purge, quota) lives here. Firestore/Storage clients cannot write.
import * as functions from 'firebase-functions/v1';
import { FieldValue } from 'firebase-admin/firestore';

import { db } from './init';
import {
    REGION,
    STORAGE_SIGNED_URL_TTL_MS,
    TenantFileProviderRef,
    TenantFileRecord,
    deleteFileObjects,
    fileBucket,
    filesCollectionRef,
    generateExpiringUrlFromRecord,
    getSecretConfig,
    getWorkspaceFileUsage,
    isManagedDocument,
    loadFileAccess,
    normalizeString,
    requireAuth,
} from './file-storage';
import {
    FileParent,
    canManageFile,
    canPurgeFile,
    canReadScope,
    normalizeParent,
    sanitizeFileName,
    sanitizeFolder,
    sanitizeTags,
} from './files-logic';

const MAX_URL_BATCH = 60;

const loadManagedFile = async (tenantId: string, fileId: string) => {
    if (!tenantId || !fileId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and fileId are required.');
    }
    const ref = filesCollectionRef(tenantId).doc(fileId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'File not found.');
    }
    return { ref, record: snap.data() as TenantFileRecord };
};

const requireManage = async (tenantId: string, uid: string, record: TenantFileRecord) => {
    const access = await loadFileAccess(tenantId, uid, record.projectId || null);
    if (!isManagedDocument(record) || !canManageFile(access, record)) {
        throw new functions.https.HttpsError('permission-denied', 'You cannot change this file.');
    }
    return access;
};

/** Batch of short-lived view/download URLs; files the caller may not read are skipped. */
export const getTenantFileUrls = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = normalizeString(data?.tenantId);
    const download = Boolean(data?.download);
    const version = Number(data?.version) || 0;
    const fileIds: string[] = Array.isArray(data?.fileIds)
        ? Array.from(new Set((data.fileIds as unknown[]).map(normalizeString).filter(Boolean))).slice(0, MAX_URL_BATCH)
        : [];
    if (!tenantId || !fileIds.length) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and fileIds are required.');
    }

    const snaps = await db.getAll(...fileIds.map((id) => filesCollectionRef(tenantId).doc(id)));
    const secret = await getSecretConfig(tenantId);
    const accessByScope = new Map<string, Awaited<ReturnType<typeof loadFileAccess>>>();
    const urls: Record<string, string> = {};

    for (const snap of snaps) {
        if (!snap.exists) continue;
        const record = snap.data() as TenantFileRecord;
        const scope = record.projectId || '';
        if (!accessByScope.has(scope)) {
            accessByScope.set(scope, await loadFileAccess(tenantId, uid, record.projectId || null));
        }
        const access = accessByScope.get(scope)!;
        // Legacy media keeps its tenant.media.* semantics: readable by non-guests.
        if (!canReadScope(access, record.projectId || null)) continue;

        let target = record;
        if (version && version !== (record.version || 1)) {
            const older = (record.versions || []).find((entry) => entry.version === version);
            if (!older) continue;
            target = { ...record, fileName: older.fileName, provider: older.provider, providerRef: older.providerRef as TenantFileProviderRef };
        }
        try {
            urls[snap.id] = await generateExpiringUrlFromRecord(tenantId, secret, target, { download });
        } catch (error) {
            functions.logger.warn('File url failed', { tenantId, fileId: snap.id, error: String(error) });
        }
    }

    return { urls, expiresInSeconds: Math.floor(STORAGE_SIGNED_URL_TTL_MS / 1000) };
});

const moveFirebaseObject = async (path: string | undefined, fromScope: string, toScope: string) => {
    if (!path) return path;
    const marker = `/files/files/${fromScope}/`;
    if (!path.includes(marker)) return path;
    const next = path.replace(marker, `/files/files/${toScope}/`);
    await fileBucket().file(path).move(next);
    return next;
};

/** Rename, set folder/tags, or move to another parent (task, project, workspace…). */
export const updateTenantFile = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = normalizeString(data?.tenantId);
    const { ref, record } = await loadManagedFile(tenantId, normalizeString(data?.fileId));
    await requireManage(tenantId, uid, record);

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (data?.name !== undefined) {
        const name = sanitizeFileName(data.name);
        if (!name) throw new functions.https.HttpsError('invalid-argument', 'Name is required.');
        update.name = name;
        update.nameLower = name.toLowerCase();
    }
    if (data?.folder !== undefined) update.folder = sanitizeFolder(data.folder);
    if (data?.tags !== undefined) update.tags = sanitizeTags(data.tags);

    if (data?.parent !== undefined) {
        const parent = normalizeParent(data.parent) as FileParent | null;
        if (!parent) throw new functions.https.HttpsError('invalid-argument', 'A valid parent is required.');
        const targetAccess = await loadFileAccess(tenantId, uid, parent.projectId);
        if (!canReadScope(targetAccess, parent.projectId)) {
            throw new functions.https.HttpsError('permission-denied', 'No access to the target.');
        }
        const fromScope = record.projectId || 'global';
        const toScope = parent.projectId || 'global';
        // Storage rules key off the scope segment, so Firebase objects move with the file.
        if (fromScope !== toScope && record.provider === 'firebase') {
            update.providerRef = { ...record.providerRef, firebasePath: await moveFirebaseObject(record.providerRef.firebasePath, fromScope, toScope) };
            const versions = [];
            for (const version of record.versions || []) {
                versions.push(version.provider === 'firebase'
                    ? { ...version, providerRef: { ...version.providerRef, firebasePath: await moveFirebaseObject(version.providerRef.firebasePath, fromScope, toScope) } }
                    : version);
            }
            update.versions = versions;
        }
        Object.assign(update, { parent, projectId: parent.projectId, entityType: parent.type, entityId: parent.id });
    }

    await ref.update(update);
    return { ok: true };
});

export const trashTenantFile = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = normalizeString(data?.tenantId);
    const { ref, record } = await loadManagedFile(tenantId, normalizeString(data?.fileId));
    await requireManage(tenantId, uid, record);
    await ref.update({ status: 'trashed', trashedAt: FieldValue.serverTimestamp(), trashedBy: uid, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true };
});

export const restoreTenantFile = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = normalizeString(data?.tenantId);
    const { ref, record } = await loadManagedFile(tenantId, normalizeString(data?.fileId));
    await requireManage(tenantId, uid, record);
    await ref.update({ status: 'ready', trashedAt: null, trashedBy: null, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true };
});

/** Permanent deletion of a trashed file, including all stored versions. */
export const purgeTenantFile = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = normalizeString(data?.tenantId);
    const { ref, record } = await loadManagedFile(tenantId, normalizeString(data?.fileId));
    const access = await loadFileAccess(tenantId, uid, record.projectId || null);
    if (!isManagedDocument(record) || !canPurgeFile(access, record)) {
        throw new functions.https.HttpsError('permission-denied', 'You cannot delete this file.');
    }
    if (record.status !== 'trashed') {
        throw new functions.https.HttpsError('failed-precondition', 'Move the file to the trash first.');
    }
    const secret = await getSecretConfig(tenantId);
    await deleteFileObjects(tenantId, secret, record);
    await ref.delete();
    return { ok: true };
});

export const getWorkspaceFileQuota = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    const tenantId = normalizeString(data?.tenantId);
    const access = await loadFileAccess(tenantId, uid, null);
    if (!access.isMember) {
        throw new functions.https.HttpsError('permission-denied', 'Workspace access required.');
    }
    return getWorkspaceFileUsage(tenantId);
});
