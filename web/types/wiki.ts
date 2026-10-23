// Wiki & Docs (brain/plans/wiki-concept.md). Firestore: tenants/{t}/docs/{docId}
// holds metadata only; the editor JSON lives in docs/{docId}/body/{n} chunks.

export type WikiSpaceType = 'workspace' | 'project';

export interface WikiSpace {
    type: WikiSpaceType;
    projectId: string | null;
}

export interface WikiDocMeta {
    id: string;
    tenantId: string;
    spaceType: WikiSpaceType;
    projectId: string | null;
    parentId: string | null;
    order: number;
    title: string;
    icon: string | null;
    excerpt: string;
    searchText: string;
    bodyChunks: number;
    bodyRev: number;
    bodySize: number;
    /** Explicit page ↔ task links ("projectId/taskId"). */
    linkedTaskRefs: string[];
    /** Task mentions found in the content ("projectId/taskId"). */
    mentionTaskRefs: string[];
    /** Union of both, used by the task detail query. */
    taskRefs: string[];
    /** Pages mentioned in the content (backlinks are the inverse query). */
    outLinks: string[];
    mentionedUserIds: string[];
    createdBy: string;
    updatedBy: string | null;
    updatedByName: string | null;
    createdAt: number | null;
    updatedAt: number | null;
    archivedAt: number | null;
    archivedBy: string | null;
}

export interface WikiVersion {
    id: string;
    data: string | null;
    title: string;
    size: number;
    reason: 'autosave' | 'manual' | 'restore' | 'before-restore' | 'conflict';
    createdBy: string;
    createdByName: string | null;
    createdAt: number | null;
}

export interface WikiEditorPresence {
    uid: string;
    name: string;
    photoURL: string | null;
    at: number;
}

export interface WikiTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    /** Serialized Tiptap JSON. */
    data: string;
    builtIn?: boolean;
    createdBy?: string;
}

export interface WikiPrefs {
    favorites: string[];
    recent: { docId: string; at: number }[];
}

/** A tiptap/ProseMirror JSON node (kept local so services do not import the editor). */
export interface WikiJsonNode {
    type?: string;
    attrs?: Record<string, any>;
    content?: WikiJsonNode[];
    text?: string;
    marks?: { type: string; attrs?: Record<string, any> }[];
}

export type WikiMentionKind = 'user' | 'task' | 'project' | 'doc';
