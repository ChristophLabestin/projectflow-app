import { deleteField, doc, getDoc, increment, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../firebase';
import type { AIUsage } from '../../types';

/**
 * Owner-only user data. `users/{uid}` is readable by every signed-in user (for
 * names/avatars), so anything that is nobody else's business — AI usage, the
 * last active workspace — lives under `users/{uid}/private/*` instead.
 */
const usageDocRef = (userId: string) => doc(db, 'users', userId, 'private', 'usage');
const workspaceDocRef = (userId: string) => doc(db, 'users', userId, 'private', 'workspace');
const publicUserRef = (userId: string) => doc(db, 'users', userId);

export const DEFAULT_AI_USAGE = {
    tokensUsed: 0,
    tokenLimit: 1000000,
    imagesUsed: 0,
    imageLimit: 50
};

/**
 * Create the private usage doc on first sign-in and move legacy public fields
 * (`aiUsage`, `lastTenantId`) out of the world-readable profile.
 */
export const ensurePrivateUserData = async (
    userId: string,
    legacy: { aiUsage?: AIUsage | null; lastTenantId?: string | null } = {}
) => {
    const snap = await getDoc(usageDocRef(userId));
    if (!snap.exists()) {
        await setDoc(usageDocRef(userId), {
            aiUsage: legacy.aiUsage || { ...DEFAULT_AI_USAGE, lastReset: serverTimestamp() }
        });
    }
    if (legacy.lastTenantId) {
        await writeLastTenantId(userId, legacy.lastTenantId);
    }
    if (legacy.aiUsage || legacy.lastTenantId) {
        await setDoc(publicUserRef(userId), { aiUsage: deleteField(), lastTenantId: deleteField() }, { merge: true });
    }
};

export const getAIUsage = async (userId: string): Promise<AIUsage | null> => {
    try {
        const snap = await getDoc(usageDocRef(userId));
        const usage = snap.exists() ? (snap.data().aiUsage as AIUsage | undefined) : undefined;
        if (!usage) return null;

        // Monthly reset.
        const lastReset = (usage.lastReset as any)?.toDate?.() || new Date(usage.lastReset as any);
        const now = new Date();
        if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
            const resetUsage = { ...usage, tokensUsed: 0, imagesUsed: 0, lastReset: serverTimestamp() };
            await setDoc(usageDocRef(userId), { aiUsage: resetUsage }, { merge: true });
            return resetUsage as AIUsage;
        }
        return usage;
    } catch (error) {
        console.warn('Failed to get CORA usage', error);
        return null;
    }
};

export const incrementAIUsage = (userId: string, tokens: number) =>
    setDoc(usageDocRef(userId), { aiUsage: { tokensUsed: increment(tokens) } }, { merge: true });

export const incrementImageUsage = (userId: string, count: number) =>
    setDoc(usageDocRef(userId), { aiUsage: { imagesUsed: increment(count) } }, { merge: true });

export const readLastTenantId = async (userId: string): Promise<string | undefined> => {
    const snap = await getDoc(workspaceDocRef(userId));
    return snap.exists() ? (snap.data().lastTenantId as string | undefined) : undefined;
};

export const writeLastTenantId = (userId: string, tenantId: string) =>
    setDoc(workspaceDocRef(userId), { lastTenantId: tenantId, updatedAt: serverTimestamp() }, { merge: true });
