// Workspace file manager (brain/plans/files-concept.md). Metadata is read straight from
// tenants/{t}/files (rules enforce object access); every write goes through Callables.
import { collection, onSnapshot, query, where, type DocumentData, type Query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from './firebase';
import { uploadTenantFile } from './fileStorageService';
import { toMillis } from '../utils/time';

export type FileParentType = 'task' | 'initiative' | 'project' | 'comment' | 'doc' | 'workspace';

export interface FileParent {
    type: FileParentType;
    id: string;
    projectId: string | null;
    /** Object the user lands on (comments: their task/initiative). */
    rootType?: FileParentType;
    rootId?: string;
    title?: string;
}

export interface FileVersion {
    version: number;
    fileName: string;
    sizeBytes: number;
    mimeType: string;
    createdBy: string;
    createdAt: number;
}

export interface FileItem {
    id: string;
    tenantId: string;
    name: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    status: 'ready' | 'trashed';
    projectId: string | null;
    parent: Required<Pick<FileParent, 'type' | 'id' | 'rootType' | 'rootId'>> & Pick<FileParent, 'projectId' | 'title'>;
    folder: string;
    tags: string[];
    version: number;
    versions: FileVersion[];
    createdBy: string;
    uploaderName: string;
    createdAt: number;
    updatedAt: number;
    trashedAt: number | null;
    /** Pre-file-manager rows (media library, desktop attachments): read-only here. */
    legacy: boolean;
}

export type FileKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'document' | 'sheet' | 'slides' | 'archive' | 'other';

const FILES = 'files';
const LEGACY_ATTACHMENT_TYPES = ['task-attachment', 'initiative-attachment'];

const str = (value: unknown) => (typeof value === 'string' ? value : '');

export const toFileItem = (id: string, data: DocumentData): FileItem | null => {
    const status = data.status === 'trashed' ? 'trashed' : data.status === 'ready' ? 'ready' : null;
    if (!status) return null;
    const projectId = str(data.projectId) || null;
    const legacy = data.module !== 'files';
    let parent = data.parent as FileItem['parent'] | undefined;
    if (!parent) {
        const entityType = str(data.entityType);
        const isTask = entityType === 'task-attachment';
        const isInitiative = entityType === 'initiative-attachment';
        if (isTask || isInitiative) {
            const type: FileParentType = isTask ? 'task' : 'initiative';
            parent = { type, id: str(data.entityId), projectId, rootType: type, rootId: str(data.entityId) };
        } else if (projectId) {
            parent = { type: 'project', id: projectId, projectId, rootType: 'project', rootId: projectId };
        } else {
            parent = { type: 'workspace', id: 'workspace', projectId: null, rootType: 'workspace', rootId: 'workspace' };
        }
    }
    const fileName = str(data.fileName);
    return {
        id,
        tenantId: str(data.tenantId),
        name: str(data.name) || fileName || id,
        fileName,
        mimeType: str(data.mimeType) || 'application/octet-stream',
        sizeBytes: Number(data.sizeBytes) || 0,
        status,
        projectId,
        parent,
        folder: str(data.folder),
        tags: Array.isArray(data.tags) ? data.tags : [],
        version: Number(data.version) || 1,
        versions: Array.isArray(data.versions)
            ? data.versions.map((entry: DocumentData) => ({
                version: Number(entry.version) || 1,
                fileName: str(entry.fileName),
                sizeBytes: Number(entry.sizeBytes) || 0,
                mimeType: str(entry.mimeType),
                createdBy: str(entry.createdBy),
                createdAt: toMillis(entry.createdAt) || 0,
            }))
            : [],
        createdBy: str(data.createdBy),
        uploaderName: str(data.uploaderName),
        createdAt: toMillis(data.createdAt) || 0,
        updatedAt: toMillis(data.updatedAt) || toMillis(data.createdAt) || 0,
        trashedAt: toMillis(data.trashedAt) || null,
        legacy,
    };
};

export const fileKind = (file: Pick<FileItem, 'mimeType' | 'name'>): FileKind => {
    const mime = file.mimeType.toLowerCase();
    const ext = (/\.([a-z0-9]+)$/i.exec(file.name)?.[1] || '').toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('text/') || mime === 'application/json' || ['md', 'txt', 'csv', 'json', 'log', 'yml', 'yaml'].includes(ext)) return 'text';
    if (/sheet|excel|spreadsheet/.test(mime) || ['xls', 'xlsx', 'ods', 'numbers'].includes(ext)) return 'sheet';
    if (/presentation|powerpoint/.test(mime) || ['ppt', 'pptx', 'odp', 'key'].includes(ext)) return 'slides';
    if (/word|opendocument\.text|rtf/.test(mime) || ['doc', 'docx', 'odt', 'rtf', 'pages'].includes(ext)) return 'document';
    if (/zip|compressed|tar|rar|7z/.test(mime) || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    return 'other';
};

export const FILE_KIND_ICONS: Record<FileKind, string> = {
    image: 'image',
    pdf: 'picture_as_pdf',
    video: 'movie',
    audio: 'music_note',
    text: 'article',
    document: 'description',
    sheet: 'table_chart',
    slides: 'slideshow',
    archive: 'folder_zip',
    other: 'draft',
};

export const canPreview = (file: Pick<FileItem, 'mimeType' | 'name'>) =>
    ['image', 'pdf', 'video', 'audio', 'text'].includes(fileKind(file));

export const formatBytes = (bytes: number, locale = 'de') => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / 1024 ** index;
    return `${value.toLocaleString(locale, { maximumFractionDigits: index === 0 ? 0 : 1 })} ${units[index]}`;
};

/** App deep link used by "Copy link": access is checked when it is opened. */
export const fileDeepLink = (fileId: string) => `${window.location.origin}/files?file=${encodeURIComponent(fileId)}`;

/** Route of the object a file hangs on, or null for workspace files. */
export const fileOriginPath = (file: Pick<FileItem, 'parent' | 'projectId'>) => {
    const { rootType, rootId } = file.parent;
    const projectId = file.projectId;
    if (rootType === 'task' && projectId) return `/project/${projectId}/tasks/${rootId}`;
    if (rootType === 'initiative' && projectId) return `/project/${projectId}/initiatives/${rootId}`;
    if (rootType === 'project' && projectId) return `/project/${projectId}/files`;
    if (rootType === 'doc') return projectId ? `/project/${projectId}/docs/${rootId}` : `/docs/${rootId}`;
    return null;
};

// ---- Subscriptions -----------------------------------------------------------------------------

const subscribeMerged = (queries: Query[], callback: (files: FileItem[]) => void, onError?: (error: Error) => void) => {
    const buckets = queries.map(() => new Map<string, FileItem>());
    const ready = queries.map(() => false);
    const emit = () => {
        if (!ready.every(Boolean)) return;
        const merged = new Map<string, FileItem>();
        buckets.forEach((bucket) => bucket.forEach((file, id) => merged.set(id, file)));
        callback(Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt));
    };
    if (!queries.length) {
        callback([]);
        return () => undefined;
    }
    const unsubscribers = queries.map((q, index) => onSnapshot(q, (snapshot) => {
        const bucket = new Map<string, FileItem>();
        snapshot.docs.forEach((docSnap) => {
            const item = toFileItem(docSnap.id, docSnap.data());
            if (item) bucket.set(item.id, item);
        });
        buckets[index] = bucket;
        ready[index] = true;
        emit();
    }, (error) => {
        console.error('File subscription failed', error);
        ready[index] = true;
        emit();
        onError?.(error);
    }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};

const filesRef = (tenantId: string) => collection(db, 'tenants', tenantId, FILES);

/**
 * Every file the user may see. Guests only query their projects (rules must be able to prove
 * each query), everyone else sees listed files plus legacy media and desktop attachments.
 */
export const subscribeWorkspaceFiles = (
    input: { tenantId: string; isGuest: boolean; projectIds: string[] },
    callback: (files: FileItem[]) => void,
    onError?: (error: Error) => void,
) => {
    const ref = filesRef(input.tenantId);
    const queries = input.isGuest
        ? input.projectIds.map((projectId) => query(ref, where('projectId', '==', projectId), where('listed', '==', true)))
        : [
            query(ref, where('listed', '==', true)),
            query(ref, where('module', '==', 'media')),
            query(ref, where('entityType', 'in', LEGACY_ATTACHMENT_TYPES)),
        ];
    return subscribeMerged(queries, callback, onError);
};

/** Files of one project (project tab), including task and comment attachments. */
export const subscribeProjectFiles = (
    tenantId: string,
    projectId: string,
    callback: (files: FileItem[]) => void,
) => {
    const ref = filesRef(tenantId);
    return subscribeMerged([
        query(ref, where('projectId', '==', projectId), where('listed', '==', true)),
        query(ref, where('projectId', '==', projectId), where('entityType', 'in', LEGACY_ATTACHMENT_TYPES)),
    ], callback);
};

/** Files whose root is one object (task + its comments, a doc …). */
export const subscribeParentFiles = (
    input: { tenantId: string; projectId: string | null; rootId: string },
    callback: (files: FileItem[]) => void,
) => {
    const ref = filesRef(input.tenantId);
    const queries = [query(ref, where('projectId', '==', input.projectId), where('parent.rootId', '==', input.rootId))];
    if (input.projectId) {
        queries.push(query(ref, where('projectId', '==', input.projectId), where('entityId', '==', input.rootId), where('entityType', 'in', LEGACY_ATTACHMENT_TYPES)));
    }
    return subscribeMerged(queries, callback);
};

// ---- Commands ----------------------------------------------------------------------------------

const call = async <TOut>(name: string, payload: Record<string, unknown>) => {
    const fn = httpsCallable<Record<string, unknown>, TOut>(functions, name);
    return (await fn(payload)).data;
};

export type UploadFailure = { file: File; reason: 'blocked-type' | 'too-large' | 'quota' | 'failed' };

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

const failureReason = (error: unknown): UploadFailure['reason'] => {
    const details = (error as { details?: { reason?: string } })?.details;
    if (details?.reason === 'blocked-type' || details?.reason === 'too-large' || details?.reason === 'quota') return details.reason;
    return 'failed';
};

/** Uploads files one after another; returns the failures so the caller can explain them. */
export const uploadFiles = async (input: {
    tenantId: string;
    parent: FileParent;
    files: File[];
    folder?: string;
    onProgress?: (done: number, total: number) => void;
}) => {
    const failures: UploadFailure[] = [];
    let done = 0;
    for (const file of input.files) {
        if (file.size > MAX_FILE_BYTES) {
            failures.push({ file, reason: 'too-large' });
        } else {
            try {
                await uploadTenantFile({
                    tenantId: input.tenantId,
                    module: 'files',
                    entityType: input.parent.type,
                    entityId: input.parent.id,
                    projectId: input.parent.projectId || undefined,
                    parent: { ...input.parent },
                    folder: input.folder,
                    file,
                });
            } catch (error) {
                console.error('File upload failed', error);
                failures.push({ file, reason: failureReason(error) });
            }
        }
        done += 1;
        input.onProgress?.(done, input.files.length);
    }
    return failures;
};

export const uploadFileVersion = async (tenantId: string, fileId: string, file: File) => {
    await uploadTenantFile({ tenantId, module: 'files', entityType: '', entityId: '', replaceFileId: fileId, file });
};

export const updateFile = (tenantId: string, fileId: string, changes: { name?: string; folder?: string; tags?: string[]; parent?: FileParent }) =>
    call<{ ok: boolean }>('updateTenantFile', { tenantId, fileId, ...changes });

export const trashFile = (tenantId: string, fileId: string) => call<{ ok: boolean }>('trashTenantFile', { tenantId, fileId });
export const restoreFile = (tenantId: string, fileId: string) => call<{ ok: boolean }>('restoreTenantFile', { tenantId, fileId });
export const purgeFile = (tenantId: string, fileId: string) => call<{ ok: boolean }>('purgeTenantFile', { tenantId, fileId });

export type WorkspaceFileQuota = { usedBytes: number; quotaBytes: number; fileCount: number; maxFileBytes: number };
export const getWorkspaceFileQuota = (tenantId: string) => call<WorkspaceFileQuota>('getWorkspaceFileQuota', { tenantId });

// Signed URLs live 15 minutes; cache them a little shorter.
const URL_TTL_MS = 12 * 60 * 1000;
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export const getFileUrls = async (
    tenantId: string,
    fileIds: string[],
    options: { download?: boolean; version?: number } = {},
): Promise<Record<string, string>> => {
    const keyOf = (id: string) => `${tenantId}/${id}/${options.download ? 'd' : 'v'}/${options.version || 0}`;
    const now = Date.now();
    const result: Record<string, string> = {};
    const missing: string[] = [];
    fileIds.forEach((id) => {
        const cached = urlCache.get(keyOf(id));
        if (cached && cached.expiresAt > now) result[id] = cached.url;
        else missing.push(id);
    });
    for (let index = 0; index < missing.length; index += 60) {
        const batch = missing.slice(index, index + 60);
        const { urls } = await call<{ urls: Record<string, string> }>('getTenantFileUrls', {
            tenantId, fileIds: batch, download: Boolean(options.download), version: options.version || 0,
        });
        Object.entries(urls).forEach(([id, url]) => {
            urlCache.set(keyOf(id), { url, expiresAt: now + URL_TTL_MS });
            result[id] = url;
        });
    }
    return result;
};

/** Starts a browser download through a short-lived URL with attachment disposition. */
export const downloadFile = async (tenantId: string, file: Pick<FileItem, 'id' | 'name'>, version?: number) => {
    const urls = await getFileUrls(tenantId, [file.id], { download: true, version });
    const url = urls[file.id];
    if (!url) throw new Error('No download url');
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
};
