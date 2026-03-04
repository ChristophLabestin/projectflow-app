import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { resolveTenantId } from './dataService';
import type { ProjectBlueprint, StudioChatSession, StudioMessage } from '../types';

const aiStudioChatsCollection = (tenantId: string, userId: string) =>
    collection(db, 'tenants', tenantId, 'users', userId, 'ai_studio_chats');

const sanitizeMessage = (message: StudioMessage) => ({
    ...message,
    mode: message.mode ?? null
});

const sanitizeBlueprint = (blueprint?: ProjectBlueprint | null) => {
    if (!blueprint) return null;
    const sanitized = { ...blueprint };

    if (sanitized.suggestedTechStack === undefined) {
        delete sanitized.suggestedTechStack;
    }

    return sanitized;
};

const sanitizeSession = (session: StudioChatSession) => ({
    ...session,
    mode: session.mode ?? null,
    blueprint: sanitizeBlueprint(session.blueprint),
    messages: session.messages.map(sanitizeMessage)
});

export const saveAiStudioChat = async (session: StudioChatSession, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    const resolvedTenant = resolveTenantId(tenantId);
    const docRef = doc(aiStudioChatsCollection(resolvedTenant, user.uid), session.id);
    await setDoc(docRef, sanitizeSession(session), { merge: true });
};

export const fetchAiStudioChats = async (tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) return [];

    const resolvedTenant = resolveTenantId(tenantId);
    const chatsQuery = query(
        aiStudioChatsCollection(resolvedTenant, user.uid),
        orderBy('updatedAt', 'desc')
    );
    const snapshot = await getDocs(chatsQuery);
    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
    } as StudioChatSession));
};
