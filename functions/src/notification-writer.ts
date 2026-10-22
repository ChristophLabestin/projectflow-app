// Server-side writers for notification and activity docs (shared by the task triggers,
// reminder delivery and nudges). Docs use deterministic ids so a retried trigger never duplicates them.
import { FieldValue } from 'firebase-admin/firestore';
import { auth, db } from './init';
import { Json } from './task-effects';

export interface Actor {
    id: string;
    name: string;
    photoURL: string;
}

const ALREADY_EXISTS = 6;

/** Firestore-safe doc id fragment. */
export const idPart = (value: string): string => value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);

/** Display snapshot of a user (users/{uid}, then Auth, then email prefix). Cached per call chain via `cache`. */
export const getActor = async (uid: string, cache?: Map<string, Actor>): Promise<Actor> => {
    if (!uid) return { id: '', name: 'Someone', photoURL: '' };
    const cached = cache?.get(uid);
    if (cached) return cached;

    let name = '';
    let photoURL = '';
    try {
        const snap = await db.doc(`users/${uid}`).get();
        const data = (snap.data() || {}) as Json;
        name = typeof data.displayName === 'string' ? data.displayName.trim() : '';
        photoURL = typeof data.photoURL === 'string' ? data.photoURL : '';
        if (!name && typeof data.email === 'string' && data.email) name = data.email.split('@')[0];
    } catch (error) {
        console.warn('getActor: user profile read failed', uid, error);
    }
    if (!name) {
        try {
            const record = await auth.getUser(uid);
            name = record.displayName || (record.email ? record.email.split('@')[0] : '');
            photoURL = photoURL || record.photoURL || '';
        } catch {
            // Unknown user: fall through to the generic label.
        }
    }
    const actor = { id: uid, name: name || 'Someone', photoURL };
    cache?.set(uid, actor);
    return actor;
};

export interface NotificationInput {
    userId: string;
    tenantId: string;
    type: string;
    title: string;
    message: string;
    projectId?: string;
    taskId?: string;
    initiativeId?: string;
    issueId?: string;
    commentId?: string;
    deepLink?: string;
    extra?: Json;
}

/**
 * Create a notification doc with the same fields the web client wrote (incl. the actor snapshot).
 * `docId` makes the write idempotent; an existing doc is left untouched.
 */
export const createNotificationDoc = async (input: NotificationInput, actor: Actor | null, docId: string): Promise<boolean> => {
    const data: Json = {
        userId: input.userId,
        tenantId: input.tenantId,
        type: input.type,
        title: input.title,
        message: input.message,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        ...(input.extra || {})
    };
    const optional: Array<keyof NotificationInput> = ['projectId', 'taskId', 'initiativeId', 'issueId', 'commentId', 'deepLink'];
    optional.forEach((key) => {
        const value = input[key];
        if (typeof value === 'string' && value) data[key] = value;
    });
    if (actor) {
        data.actorId = actor.id;
        data.actorName = actor.name;
        data.actorPhotoURL = actor.photoURL;
    }

    try {
        await db.doc(`tenants/${input.tenantId}/notifications/${docId}`).create(data);
        return true;
    } catch (error: any) {
        if (error?.code === ALREADY_EXISTS) return false;
        throw error;
    }
};

export interface ActivityInput {
    action: string;
    target: string;
    type: string;
    relatedId: string | null;
    details: string;
}

/** Same shape as the web `logActivity`. */
export const createActivityDoc = async (
    tenantId: string,
    projectId: string,
    actor: Actor,
    activity: ActivityInput,
    docId: string
): Promise<boolean> => {
    try {
        await db.doc(`tenants/${tenantId}/projects/${projectId}/activities/${docId}`).create({
            projectId,
            tenantId,
            ownerId: actor.id,
            user: actor.name,
            userAvatar: actor.photoURL,
            action: activity.action,
            target: activity.target || 'Unknown',
            details: activity.details || '',
            relatedId: activity.relatedId || null,
            type: activity.type || 'task',
            createdAt: FieldValue.serverTimestamp()
        });
        return true;
    } catch (error: any) {
        if (error?.code === ALREADY_EXISTS) return false;
        throw error;
    }
};
