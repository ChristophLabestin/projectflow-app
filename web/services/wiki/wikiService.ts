// Firestore access for Wiki & Docs (brain/plans/wiki-concept.md).
import {
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch,
    type DocumentData,
    type Query,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
    WikiDocMeta,
    WikiEditorPresence,
    WikiJsonNode,
    WikiPrefs,
    WikiSpace,
    WikiTemplate,
    WikiVersion,
} from '../../types/wiki';
import {
    WIKI_CHUNK_CHARS,
    buildExcerpt,
    buildSearchText,
    descendantIds,
    extractPlainText,
    extractRefs,
    joinChunks,
    parseDocJson,
    splitIntoChunks,
    unionRefs,
} from './wikiContent';

const MAX_VERSIONS = 50;
const AUTOSAVE_VERSION_INTERVAL_MS = 10 * 60 * 1000;
const MAX_RECENT = 12;

const docsCol = (tenantId: string) => collection(db, 'tenants', tenantId, 'docs');
const docRef = (tenantId: string, docId: string) => doc(db, 'tenants', tenantId, 'docs', docId);
const bodyRef = (tenantId: string, docId: string, index: number) =>
    doc(db, 'tenants', tenantId, 'docs', docId, 'body', String(index));
const versionsCol = (tenantId: string, docId: string) => collection(db, 'tenants', tenantId, 'docs', docId, 'versions');
const editorsCol = (tenantId: string, docId: string) => collection(db, 'tenants', tenantId, 'docs', docId, 'editors');
const templatesCol = (tenantId: string) => collection(db, 'tenants', tenantId, 'docTemplates');
const prefsRef = (tenantId: string, uid: string) => doc(db, 'tenants', tenantId, 'users', uid, 'prefs', 'wiki');

const toMillis = (value: unknown): number | null => {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (typeof (value as { toMillis?: () => number }).toMillis === 'function') return (value as { toMillis: () => number }).toMillis();
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
};

const arr = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);

export const toWikiDocMeta = (id: string, data: DocumentData): WikiDocMeta => ({
    id,
    tenantId: data.tenantId,
    spaceType: data.spaceType === 'project' ? 'project' : 'workspace',
    projectId: data.projectId || null,
    parentId: data.parentId || null,
    order: typeof data.order === 'number' ? data.order : 0,
    title: data.title || '',
    icon: data.icon || null,
    excerpt: data.excerpt || '',
    searchText: data.searchText || '',
    bodyChunks: data.bodyChunks || 0,
    bodyRev: data.bodyRev || 0,
    bodySize: data.bodySize || 0,
    linkedTaskRefs: arr(data.linkedTaskRefs),
    mentionTaskRefs: arr(data.mentionTaskRefs),
    taskRefs: arr(data.taskRefs),
    outLinks: arr(data.outLinks),
    mentionedUserIds: arr(data.mentionedUserIds),
    createdBy: data.createdBy || '',
    updatedBy: data.updatedBy || null,
    updatedByName: data.updatedByName || null,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    archivedAt: toMillis(data.archivedAt),
    archivedBy: data.archivedBy || null,
});

const currentUser = () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not signed in');
    return { uid: user.uid, name: user.displayName || user.email?.split('@')[0] || '', photoURL: user.photoURL || null };
};

/** Space filter. Guests may only run queries constrained to their project. */
const spaceQuery = (tenantId: string, space: WikiSpace): Query =>
    space.type === 'project'
        ? query(docsCol(tenantId), where('spaceType', '==', 'project'), where('projectId', '==', space.projectId))
        : query(docsCol(tenantId), where('spaceType', '==', 'workspace'));

export const subscribeWikiDocs = (
    tenantId: string,
    space: WikiSpace,
    onChange: (docs: WikiDocMeta[]) => void,
    onError?: (error: Error) => void,
) => onSnapshot(
    spaceQuery(tenantId, space),
    (snapshot) => onChange(snapshot.docs.map((snap) => toWikiDocMeta(snap.id, snap.data()))),
    (error) => onError?.(error),
);

/** Every page the user can read: full members see all; guests pass their project ids. */
export const getAccessibleWikiDocs = async (tenantId: string, guestProjectIds?: string[]): Promise<WikiDocMeta[]> => {
    const snaps = guestProjectIds
        ? await Promise.all(guestProjectIds.map((projectId) => getDocs(spaceQuery(tenantId, { type: 'project', projectId }))))
        : [await getDocs(docsCol(tenantId))];
    return snaps.flatMap((snap) => snap.docs.map((d) => toWikiDocMeta(d.id, d.data()))).filter((d) => !d.archivedAt);
};

export const subscribeWikiDoc = (tenantId: string, docId: string, onChange: (meta: WikiDocMeta | null) => void, onError?: (error: Error) => void) =>
    onSnapshot(
        docRef(tenantId, docId),
        (snap) => onChange(snap.exists() ? toWikiDocMeta(snap.id, snap.data()) : null),
        (error) => onError?.(error),
    );

export const getWikiDoc = async (tenantId: string, docId: string): Promise<WikiDocMeta | null> => {
    const snap = await getDoc(docRef(tenantId, docId));
    return snap.exists() ? toWikiDocMeta(snap.id, snap.data()) : null;
};

export const loadDocBody = async (tenantId: string, docId: string): Promise<{ json: WikiJsonNode; raw: string }> => {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'docs', docId, 'body'));
    const raw = joinChunks(snap.docs.map((d) => ({ i: Number(d.data().i ?? d.id), data: String(d.data().data || '') })));
    return { json: parseDocJson(raw), raw };
};

/** Derived meta fields for a content save. */
export const deriveContentMeta = (title: string, json: WikiJsonNode, linkedTaskRefs: string[] = []) => {
    const plain = extractPlainText(json);
    const refs = extractRefs(json);
    return {
        excerpt: buildExcerpt(plain),
        searchText: buildSearchText(title, plain),
        outLinks: refs.outLinks,
        mentionTaskRefs: refs.mentionTaskRefs,
        mentionedUserIds: refs.mentionedUserIds,
        taskRefs: unionRefs(linkedTaskRefs, refs.mentionTaskRefs),
    };
};

export interface CreateWikiDocInput {
    space: WikiSpace;
    title: string;
    parentId?: string | null;
    order: number;
    icon?: string | null;
    content?: WikiJsonNode;
    linkedTaskRefs?: string[];
}

export const createWikiDoc = async (tenantId: string, input: CreateWikiDocInput): Promise<string> => {
    const user = currentUser();
    const ref = doc(docsCol(tenantId));
    const json = input.content || parseDocJson(null);
    const raw = JSON.stringify(json);
    const chunks = splitIntoChunks(raw);
    const linked = input.linkedTaskRefs || [];
    const batch = writeBatch(db);
    batch.set(ref, {
        tenantId,
        spaceType: input.space.type,
        projectId: input.space.type === 'project' ? input.space.projectId : null,
        parentId: input.parentId || null,
        order: input.order,
        title: input.title,
        icon: input.icon || null,
        ...deriveContentMeta(input.title, json, linked),
        linkedTaskRefs: linked,
        bodyChunks: chunks.length,
        bodyRev: 1,
        bodySize: raw.length,
        createdBy: user.uid,
        updatedBy: user.uid,
        updatedByName: user.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        archivedAt: null,
        archivedBy: null,
    });
    chunks.forEach((data, i) => batch.set(bodyRef(tenantId, ref.id, i), { i, data }));
    await batch.commit();
    return ref.id;
};

export class WikiConflictError extends Error {
    constructor(public readonly remote: WikiDocMeta) {
        super('wiki-conflict');
    }
}

/**
 * Saves the body with an optimistic revision check. Throws WikiConflictError when
 * someone else saved since `expectedRev` (unless `force`).
 */
export const saveWikiDocBody = async (
    tenantId: string,
    docId: string,
    input: { title: string; json: WikiJsonNode; expectedRev: number; force?: boolean },
): Promise<number> => {
    const user = currentUser();
    const raw = JSON.stringify(input.json);
    const chunks = splitIntoChunks(raw, WIKI_CHUNK_CHARS);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef(tenantId, docId));
        if (!snap.exists()) throw new Error('wiki-missing');
        const meta = toWikiDocMeta(snap.id, snap.data());
        if (!input.force && meta.bodyRev !== input.expectedRev) throw new WikiConflictError(meta);
        const nextRev = meta.bodyRev + 1;
        chunks.forEach((data, i) => tx.set(bodyRef(tenantId, docId, i), { i, data }));
        for (let i = chunks.length; i < meta.bodyChunks; i += 1) tx.delete(bodyRef(tenantId, docId, i));
        tx.update(docRef(tenantId, docId), {
            title: input.title,
            ...deriveContentMeta(input.title, input.json, meta.linkedTaskRefs),
            bodyChunks: chunks.length,
            bodyRev: nextRev,
            bodySize: raw.length,
            updatedBy: user.uid,
            updatedByName: user.name,
            updatedAt: serverTimestamp(),
        });
        return nextRev;
    });
};

export const updateWikiDocMeta = (
    tenantId: string,
    docId: string,
    patch: Partial<Pick<WikiDocMeta, 'title' | 'icon' | 'parentId' | 'order'>> & { searchText?: string },
) => {
    const user = currentUser();
    return updateDoc(docRef(tenantId, docId), { ...patch, updatedBy: user.uid, updatedByName: user.name, updatedAt: serverTimestamp() });
};

export const moveWikiDoc = (tenantId: string, docId: string, parentId: string | null, order: number) =>
    updateDoc(docRef(tenantId, docId), { parentId, order });

/** Soft delete: the page and its sub-pages move to the trash. */
export const archiveWikiDoc = async (tenantId: string, docs: WikiDocMeta[], docId: string) => {
    const user = currentUser();
    const ids = [docId, ...descendantIds(docs, docId)].filter((id) => !docs.find((d) => d.id === id)?.archivedAt);
    const batch = writeBatch(db);
    ids.forEach((id) => batch.update(docRef(tenantId, id), { archivedAt: serverTimestamp(), archivedBy: user.uid, archivedRoot: id === docId }));
    await batch.commit();
    return ids;
};

export const restoreWikiDoc = async (tenantId: string, docs: WikiDocMeta[], docId: string) => {
    const ids = [docId, ...descendantIds(docs, docId)];
    const target = docs.find((d) => d.id === docId);
    const parentArchived = target?.parentId ? docs.find((d) => d.id === target.parentId)?.archivedAt : null;
    const batch = writeBatch(db);
    ids.forEach((id) => batch.update(docRef(tenantId, id), {
        archivedAt: null,
        archivedBy: null,
        archivedRoot: false,
        ...(id === docId && parentArchived ? { parentId: null } : {}),
    }));
    await batch.commit();
};

const deleteCollection = async (tenantId: string, docId: string, name: 'body' | 'versions' | 'editors') => {
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'docs', docId, name));
    for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
};

/** Hard delete from the trash (author or Owner/Admin; rules enforce it). */
export const deleteWikiDocPermanently = async (tenantId: string, docs: WikiDocMeta[], docId: string) => {
    const ids = [...descendantIds(docs, docId).reverse(), docId];
    for (const id of ids) {
        await deleteCollection(tenantId, id, 'versions');
        await deleteCollection(tenantId, id, 'editors');
        await deleteCollection(tenantId, id, 'body');
        await deleteDoc(docRef(tenantId, id));
    }
};

// ---- Task links & backlinks -----------------------------------------------

export const linkTaskToDoc = (tenantId: string, docId: string, taskRef: string) =>
    updateDoc(docRef(tenantId, docId), { linkedTaskRefs: arrayUnion(taskRef), taskRefs: arrayUnion(taskRef) });

export const unlinkTaskFromDoc = async (tenantId: string, meta: WikiDocMeta, taskRef: string) =>
    updateDoc(docRef(tenantId, meta.id), {
        linkedTaskRefs: arrayRemove(taskRef),
        ...(meta.mentionTaskRefs.includes(taskRef) ? {} : { taskRefs: arrayRemove(taskRef) }),
    });

/** Pages linked to (or mentioning) a task. Guests only see their project's pages. */
export const subscribeDocsForTask = (
    tenantId: string,
    projectId: string,
    taskId: string,
    guest: boolean,
    onChange: (docs: WikiDocMeta[]) => void,
) => {
    const ref = `${projectId}/${taskId}`;
    const q = guest
        ? query(docsCol(tenantId), where('spaceType', '==', 'project'), where('projectId', '==', projectId), where('taskRefs', 'array-contains', ref))
        : query(docsCol(tenantId), where('taskRefs', 'array-contains', ref));
    return onSnapshot(q, (snap) => onChange(
        snap.docs.map((d) => toWikiDocMeta(d.id, d.data())).filter((d) => !d.archivedAt),
    ), () => onChange([]));
};

export const subscribeBacklinks = (
    tenantId: string,
    meta: WikiDocMeta,
    guest: boolean,
    onChange: (docs: WikiDocMeta[]) => void,
) => {
    const q = guest && meta.projectId
        ? query(docsCol(tenantId), where('spaceType', '==', 'project'), where('projectId', '==', meta.projectId), where('outLinks', 'array-contains', meta.id))
        : query(docsCol(tenantId), where('outLinks', 'array-contains', meta.id));
    return onSnapshot(q, (snap) => onChange(
        snap.docs.map((d) => toWikiDocMeta(d.id, d.data())).filter((d) => !d.archivedAt && d.id !== meta.id),
    ), () => onChange([]));
};

// ---- Versions ----------------------------------------------------------------

export const createWikiVersion = async (
    tenantId: string,
    docId: string,
    input: { raw: string; title: string; reason: WikiVersion['reason'] },
) => {
    const user = currentUser();
    const fits = input.raw.length <= WIKI_CHUNK_CHARS;
    await setDoc(doc(versionsCol(tenantId, docId)), {
        data: fits ? input.raw : null,
        title: input.title,
        size: input.raw.length,
        reason: input.reason,
        createdBy: user.uid,
        createdByName: user.name,
        createdAt: serverTimestamp(),
    });
    const all = await getDocs(query(versionsCol(tenantId, docId), orderBy('createdAt', 'desc')));
    const stale = all.docs.slice(MAX_VERSIONS);
    if (stale.length) {
        const batch = writeBatch(db);
        stale.forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
};

/** Autosave snapshots: at most one per page every 10 minutes. */
export const maybeCreateAutosaveVersion = async (tenantId: string, docId: string, raw: string, title: string) => {
    const latest = await getDocs(query(versionsCol(tenantId, docId), orderBy('createdAt', 'desc'), limit(1)));
    const at = latest.docs[0] ? toMillis(latest.docs[0].data().createdAt) : null;
    if (at && Date.now() - at < AUTOSAVE_VERSION_INTERVAL_MS) return false;
    await createWikiVersion(tenantId, docId, { raw, title, reason: 'autosave' });
    return true;
};

export const listWikiVersions = async (tenantId: string, docId: string): Promise<WikiVersion[]> => {
    const snap = await getDocs(query(versionsCol(tenantId, docId), orderBy('createdAt', 'desc'), limit(MAX_VERSIONS)));
    return snap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            data: data.data ?? null,
            title: data.title || '',
            size: data.size || 0,
            reason: data.reason || 'autosave',
            createdBy: data.createdBy || '',
            createdByName: data.createdByName || null,
            createdAt: toMillis(data.createdAt),
        };
    });
};

// ---- Presence -----------------------------------------------------------------

export const heartbeatWikiEditor = (tenantId: string, docId: string) => {
    const user = currentUser();
    return setDoc(doc(editorsCol(tenantId, docId), user.uid), { uid: user.uid, name: user.name, photoURL: user.photoURL, at: Date.now() });
};

export const clearWikiEditor = (tenantId: string, docId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return Promise.resolve();
    return deleteDoc(doc(editorsCol(tenantId, docId), uid)).catch(() => undefined);
};

export const subscribeWikiEditors = (tenantId: string, docId: string, onChange: (editors: WikiEditorPresence[]) => void) =>
    onSnapshot(editorsCol(tenantId, docId), (snap) => onChange(snap.docs.map((d) => d.data() as WikiEditorPresence)), () => onChange([]));

// ---- Templates & prefs ------------------------------------------------------------

export const subscribeWikiTemplates = (tenantId: string, onChange: (templates: WikiTemplate[]) => void) =>
    onSnapshot(templatesCol(tenantId), (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WikiTemplate, 'id'>) }))), () => onChange([]));

export const saveWikiTemplate = (tenantId: string, input: Omit<WikiTemplate, 'id' | 'builtIn' | 'createdBy'>) => {
    const user = currentUser();
    return setDoc(doc(templatesCol(tenantId)), { ...input, createdBy: user.uid, createdAt: serverTimestamp() });
};

export const deleteWikiTemplate = (tenantId: string, templateId: string) => deleteDoc(doc(templatesCol(tenantId), templateId));

export const subscribeWikiPrefs = (tenantId: string, uid: string, onChange: (prefs: WikiPrefs) => void) =>
    onSnapshot(prefsRef(tenantId, uid), (snap) => {
        const data = snap.data() || {};
        onChange({ favorites: arr(data.favorites), recent: Array.isArray(data.recent) ? data.recent : [] });
    }, () => onChange({ favorites: [], recent: [] }));

export const setWikiFavorite = (tenantId: string, docId: string, favorite: boolean) => {
    const { uid } = currentUser();
    return setDoc(prefsRef(tenantId, uid), { favorites: favorite ? arrayUnion(docId) : arrayRemove(docId) }, { merge: true });
};

export const recordWikiVisit = async (tenantId: string, docId: string, prefs: WikiPrefs) => {
    const { uid } = currentUser();
    const recent = [{ docId, at: Date.now() }, ...prefs.recent.filter((entry) => entry.docId !== docId)].slice(0, MAX_RECENT);
    await setDoc(prefsRef(tenantId, uid), { recent }, { merge: true });
};

// ---- Public entry point for other features ------------------------------------------

/**
 * Creates a wiki page from Markdown or plain text (e.g. the AI weekly report of
 * "Activity & Insights"). Appends at the end of the space root, or under `parentId`.
 * Returns the new docId; open it at `/wiki/{docId}` or `/project/{projectId}/wiki/{docId}`.
 */
export const createWikiPageFromMarkdown = async (
    tenantId: string,
    input: { space: WikiSpace; title: string; markdown: string; parentId?: string | null; icon?: string | null; linkedTaskRefs?: string[] },
): Promise<string> => {
    const { markdownToWikiJson } = await import('./wikiMarkdown');
    return createWikiDoc(tenantId, {
        space: input.space,
        title: input.title.trim().slice(0, 200) || 'Untitled',
        parentId: input.parentId || null,
        order: Date.now(),
        icon: input.icon || null,
        content: markdownToWikiJson(input.markdown),
        linkedTaskRefs: input.linkedTaskRefs,
    });
};
