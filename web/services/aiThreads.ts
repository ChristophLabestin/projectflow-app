import { deleteDoc, doc, getDoc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
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

export const saveThread = async (uid: string, key: string, tenantId: string, messages: AiChatMessage[]) => {
    await setDoc(threadRef(uid, key), {
        tenantId,
        messages: messages.slice(-MAX_MESSAGES).map(({ role, content }) => ({ role, content: content.slice(0, 8000) })),
        updatedAt: serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + RETENTION_MS)
    });
};

export const clearThread = (uid: string, key: string) => deleteDoc(threadRef(uid, key));
