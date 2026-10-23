import {
    collection,
    query,
    where,
    onSnapshot,
    updateDoc,
    doc,
    serverTimestamp,
    writeBatch,
    getDocs,
    deleteDoc,
    setDoc,
    arrayUnion
} from 'firebase/firestore';
import type { DocumentReference, WriteBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, app, firebaseConfig, functions as cloudFunctions } from './firebase';
import type { Notification } from '../types';
import { getCachedTenantId } from './internal/workspaceDataCore';
import { isDesktop } from './desktop';

export interface WebNotificationDiagnostics {
    browserNotificationsSupported: boolean;
    serviceWorkerSupported: boolean;
    pushManagerSupported: boolean;
    firebaseMessagingSupported: boolean;
    permission: NotificationPermission | 'unsupported';
    vapidKeyConfigured: boolean;
    tokenRegistered: boolean;
    lastTokenSyncAt?: string;
    lastTokenError?: string;
}

export interface NotificationDeliveryLog {
    id: string;
    notificationId: string;
    userId: string;
    channel: 'email' | 'fcm';
    status: 'sent' | 'failed' | 'skipped';
    reason: string;
    details?: Record<string, unknown>;
    createdAt?: any;
}

export interface SendTestNotificationResult {
    success: boolean;
    tenantId: string;
    notificationId: string;
    fcmTokenCount: number;
}

const WEB_PUSH_TOKEN_SYNC_KEY = 'projectflow.webPush.lastTokenSyncAt';
const WEB_PUSH_TOKEN_ERROR_KEY = 'projectflow.webPush.lastTokenError';

const getMessagingWorkerUrl = () => {
    const params = new URLSearchParams();
    Object.entries(firebaseConfig).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
            params.set(key, value);
        }
    });
    return `/firebase-messaging-sw.js?${params.toString()}`;
};

export const getWebNotificationDiagnostics = async (): Promise<WebNotificationDiagnostics> => {
    const browserNotificationsSupported = typeof window !== 'undefined' && 'Notification' in window;
    const serviceWorkerSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const pushManagerSupported = typeof window !== 'undefined' && 'PushManager' in window;
    const vapidKeyConfigured = Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY);
    let firebaseMessagingSupported = false;

    if (browserNotificationsSupported && serviceWorkerSupported && pushManagerSupported) {
        try {
            const messaging = await import('firebase/messaging');
            firebaseMessagingSupported = await messaging.isSupported();
        } catch (error) {
            console.warn('Firebase messaging support check failed', error);
        }
    }

    return {
        browserNotificationsSupported,
        serviceWorkerSupported,
        pushManagerSupported,
        firebaseMessagingSupported,
        permission: browserNotificationsSupported ? window.Notification.permission : 'unsupported',
        vapidKeyConfigured,
        tokenRegistered: Boolean(localStorage.getItem(WEB_PUSH_TOKEN_SYNC_KEY)),
        lastTokenSyncAt: localStorage.getItem(WEB_PUSH_TOKEN_SYNC_KEY) || undefined,
        lastTokenError: localStorage.getItem(WEB_PUSH_TOKEN_ERROR_KEY) || undefined
    };
};

export const registerWebPushToken = async (): Promise<WebNotificationDiagnostics> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('No signed-in user.');
    }

    // The desktop app shows notifications natively (FCM web push does not work in Electron).
    if (isDesktop()) {
        throw new Error('The desktop app shows notifications natively; web push is not needed here.');
    }

    const diagnostics = await getWebNotificationDiagnostics();
    if (!diagnostics.browserNotificationsSupported || !diagnostics.serviceWorkerSupported || !diagnostics.pushManagerSupported) {
        throw new Error('This browser does not support web push notifications.');
    }

    if (!diagnostics.firebaseMessagingSupported) {
        throw new Error('Firebase Messaging is not supported in this browser.');
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
        throw new Error('VITE_FIREBASE_VAPID_KEY is not configured.');
    }

    const permission = await window.Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error(`Notification permission is ${permission}.`);
    }

    try {
        const registration = await navigator.serviceWorker.register(getMessagingWorkerUrl());
        const { getMessaging, getToken } = await import('firebase/messaging');
        const token = await getToken(getMessaging(app), {
            vapidKey,
            serviceWorkerRegistration: registration
        });

        if (!token) {
            throw new Error('Firebase Messaging did not return a token.');
        }

        const now = new Date().toISOString();
        await setDoc(doc(db, 'users', user.uid), {
            fcmTokens: arrayUnion(token),
            fcmUpdatedAt: serverTimestamp(),
            webPush: {
                enabled: true,
                lastTokenSyncAt: serverTimestamp(),
                permission
            }
        }, { merge: true });

        localStorage.setItem(WEB_PUSH_TOKEN_SYNC_KEY, now);
        localStorage.removeItem(WEB_PUSH_TOKEN_ERROR_KEY);
        return getWebNotificationDiagnostics();
    } catch (error: any) {
        const message = error?.message || 'Failed to register web push token.';
        localStorage.setItem(WEB_PUSH_TOKEN_ERROR_KEY, message);
        throw error;
    }
};

const resolveTenantId = (tenantId?: string) => {
    const resolved = tenantId || getCachedTenantId();
    if (!resolved) {
        throw new Error("Cannot resolve tenant ID for notifications");
    }
    return resolved;
};

const getNotificationsCollection = (tenantId?: string) => {
    const tid = resolveTenantId(tenantId);
    return collection(db, 'tenants', tid, 'notifications');
};

const getNotificationDeliveryLogsCollection = (tenantId?: string) => {
    const tid = resolveTenantId(tenantId);
    return collection(db, 'tenants', tid, 'notificationDeliveryLogs');
};

export const sendTestNotification = async (tenantId?: string): Promise<SendTestNotificationResult> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('No signed-in user.');
    }

    const callable = httpsCallable<{ tenantId: string }, SendTestNotificationResult>(cloudFunctions, 'sendTestNotification');
    const result = await callable({ tenantId: resolveTenantId(tenantId) });
    return result.data;
};

const toSeconds = (value: any): number => {
    if (!value) return 0;
    if (typeof value.seconds === 'number') return value.seconds;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms / 1000;
};

/**
 * Subscribe to the signed-in user's notifications in one workspace (newest first).
 * Notifications are created by Cloud Functions only; the client reads, marks read and deletes.
 * Sorting happens client-side so new workspaces work without a composite index.
 */
export const subscribeToNotifications = (
    userId: string,
    callback: (notifications: Notification[]) => void,
    tenantId?: string,
    onError?: (error: Error) => void
) => {
    try {
        const tid = resolveTenantId(tenantId);
        const q = query(getNotificationsCollection(tid), where('userId', '==', userId));

        return onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                tenantId: tid
            })) as Notification[];
            notifications.sort((a, b) => toSeconds(b.createdAt) - toSeconds(a.createdAt));
            callback(notifications);
        }, (error) => {
            console.error('Error subscribing to notifications:', error);
            onError?.(error);
        });
    } catch (error) {
        console.error('Failed to subscribe to notifications:', error);
        onError?.(error as Error);
        return () => { };
    }
};

/** Live unread count of the user's notifications in one workspace (used for other workspaces). */
export const subscribeToUnreadNotificationCount = (
    userId: string,
    tenantId: string,
    callback: (count: number) => void
) => {
    const q = query(
        getNotificationsCollection(tenantId),
        where('userId', '==', userId),
        where('read', '==', false)
    );
    return onSnapshot(q, (snapshot) => callback(snapshot.size), (error) => {
        console.warn('Failed to subscribe to unread notifications', tenantId, error);
        callback(0);
    });
};

export const subscribeToNotificationDeliveryLogs = (
    userId: string,
    callback: (logs: NotificationDeliveryLog[]) => void,
    tenantId?: string
) => {
    try {
        const q = query(
            getNotificationDeliveryLogsCollection(tenantId),
            where('userId', '==', userId)
        );

        return onSnapshot(q, (snapshot) => {
            const logs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as NotificationDeliveryLog[];

            logs.sort((a, b) => {
                const timeA = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
                const timeB = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
                return timeB - timeA;
            });

            callback(logs.slice(0, 8));
        }, (error) => {
            console.error('Error subscribing to notification delivery logs:', error);
            callback([]);
        });
    } catch (error) {
        console.error('Failed to subscribe to notification delivery logs:', error);
        return () => { };
    }
};

/**
 * Mark a notification as read or unread
 */
export const setNotificationRead = async (notificationId: string, read: boolean, tenantId?: string): Promise<void> => {
    const tid = resolveTenantId(tenantId);
    await updateDoc(doc(db, 'tenants', tid, 'notifications', notificationId), { read });
};

export const markNotificationAsRead = async (notificationId: string, tenantId?: string): Promise<void> => {
    try {
        await setNotificationRead(notificationId, true, tenantId);
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
};

const BATCH_LIMIT = 450;

const commitInChunks = async (refs: DocumentReference[], apply: (batch: WriteBatch, ref: DocumentReference) => void) => {
    for (let index = 0; index < refs.length; index += BATCH_LIMIT) {
        const batch = writeBatch(db);
        refs.slice(index, index + BATCH_LIMIT).forEach((ref) => apply(batch, ref));
        await batch.commit();
    }
};

/**
 * Mark all of the user's notifications in one workspace as read
 */
export const markAllNotificationsAsRead = async (userId: string, tenantId?: string): Promise<void> => {
    const tid = resolveTenantId(tenantId);
    const snapshot = await getDocs(query(
        getNotificationsCollection(tid),
        where('userId', '==', userId),
        where('read', '==', false)
    ));
    await commitInChunks(snapshot.docs.map((d) => d.ref), (batch, ref) => batch.update(ref, { read: true }));
};

/**
 * Delete a single notification
 */
export const deleteNotification = async (notificationId: string, tenantId?: string): Promise<void> => {
    const tid = resolveTenantId(tenantId);
    await deleteDoc(doc(db, 'tenants', tid, 'notifications', notificationId));
};

/**
 * Delete all of the user's notifications in one workspace
 */
export const deleteAllNotifications = async (userId: string, tenantId?: string): Promise<void> => {
    const tid = resolveTenantId(tenantId);
    const snapshot = await getDocs(query(getNotificationsCollection(tid), where('userId', '==', userId)));
    await commitInChunks(snapshot.docs.map((d) => d.ref), (batch, ref) => batch.delete(ref));
};
