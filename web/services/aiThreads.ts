import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { AiChatMessage, AiContextEnvelope } from './aiAssistClient';

/**
 * In-app AI conversations live at the object they are about (`users/{uid}/ai_threads/{key}`), owner
 * only, deleted after 30 days by a Firestore TTL on `expireAt` (concept decision 5).
 */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_MESSAGES = 40;

export const threadKey = (tenantId: string, context: AiContextEnvelope) => {
    const target = context.entity ? `${context.entity.kind}-${context.entity.id}` : context.projectId ? `project-${context.projectId}` : context.surface;
    return `${tenantId}__${target}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200);
};

const threadRef = (uid: string, key: string) => doc(db, 'users', uid, 'ai_threads', key);

export const loadThread = async (uid: string, key: string): Promise<AiChatMessage[]> => {
    const snapshot = await getDoc(threadRef(uid, key)).catch(() => null);
    const messages = snapshot?.data()?.messages;
    return Array.isArray(messages) ? messages.filter((m) => m && typeof m.content === 'string') : [];
};

/** Where the conversation happened (history: label + reopen at that route). */
export interface AiThreadMeta { route?: string; label?: string }

export interface AiThreadSummary { key: string; route: string; label: string; question: string; updatedAt: number }

export const saveThread = async (uid: string, key: string, tenantId: string, messages: AiChatMessage[], meta: AiThreadMeta = {}) => {
    await setDoc(threadRef(uid, key), {
        tenantId,
        ...(meta.route ? { route: meta.route.slice(0, 300) } : {}),
        ...(meta.label ? { label: meta.label.slice(0, 200) } : {}),
        messages: messages.slice(-MAX_MESSAGES).map(({ role, content }) => ({ role, content: content.slice(0, 8000) })),
        updatedAt: serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + RETENTION_MS)
    });
};

export const clearThread = (uid: string, key: string) => deleteDoc(threadRef(uid, key));

/**
 * Recent conversations of this workspace (newest first). Ordered by `updatedAt` only and filtered by tenant
 * here, so no composite index is needed; threads from before the history (no route) are skipped.
 */
export const listRecentThreads = async (uid: string, tenantId: string, max = 6): Promise<AiThreadSummary[]> => {
    const snapshot = await getDocs(query(collection(db, 'users', uid, 'ai_threads'), orderBy('updatedAt', 'desc'), limit(40)));
    return snapshot.docs
        .map((entry) => {
            const data = entry.data();
            const first = Array.isArray(data.messages) ? data.messages.find((message: AiChatMessage) => message?.role === 'user') : null;
            return {
                key: entry.id,
                tenantId: data.tenantId,
                route: typeof data.route === 'string' ? data.route : '',
                label: typeof data.label === 'string' ? data.label : '',
                question: typeof first?.content === 'string' ? first.content : '',
                updatedAt: data.updatedAt?.toMillis?.() || 0
            };
        })
        .filter((thread) => thread.tenantId === tenantId && thread.route && thread.question)
        .slice(0, max)
        .map(({ tenantId: _tenant, ...thread }) => thread);
};
