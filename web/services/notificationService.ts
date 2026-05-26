import {
    collection,
    addDoc,
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
import { httpsCallable } from 'firebase/functions';
import { db, auth, app, firebaseConfig, functions as cloudFunctions } from './firebase';
import type { Notification, NotificationType } from '../types';

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

// Helper to get tenant ID without importing from dataService (circular dependency)
const getCachedTenantId = () => {
    try {
        if (typeof localStorage === "undefined") return undefined;
        return localStorage.getItem("activeTenantId") || undefined;
    } catch {
        return undefined;
    }
};

const resolveTenantId = (tenantId?: string) => {
    const user = auth.currentUser;
    const resolved = tenantId || getCachedTenantId() || user?.uid;
    if (!resolved) {
        // Fallback to error or maybe just user.uid if auth exists?
        // If we can't resolve a tenant, we can't save/read notifications.
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

/**
 * Create a new notification
 */
export const createNotification = async (data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    projectId?: string;
    taskId?: string;
    initiativeId?: string;
    issueId?: string;
    commentId?: string;
    inviteId?: string;
    tenantId?: string;
}): Promise<void> => {
    const user = auth.currentUser;

    // Don't send notification to yourself
    if (user?.uid === data.userId) {
        return;
    }

    try {
        // Sanitize data to remove undefined values (Firestore rejects undefined)
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        );

        const tenantId = resolveTenantId(data.tenantId);

        await addDoc(getNotificationsCollection(tenantId), {
            ...cleanData,
            actorId: user?.uid,
            actorName: user?.displayName || 'Someone',
            actorPhotoURL: user?.photoURL || '',
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error('[Notification] ERROR:', error);
    }
};

/**
 * Subscribe to real-time notifications for the current user
 * @param userId - The user ID to listen for
 * @param callback - Function to call with updates
 * @param tenantId - Optional tenant ID. If not provided, uses active tenant.
 */
export const subscribeToNotifications = (
    userId: string,
    callback: (notifications: Notification[]) => void,
    tenantId?: string
) => {
    try {
        const tid = resolveTenantId(tenantId);

        // REMOVED orderBy to avoid requiring a composite index which breaks the app for new users
        const q = query(
            getNotificationsCollection(tid),
            where('userId', '==', userId)
        );

        return onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Notification[];

            // Client-side sort (descending by createdAt)
            notifications.sort((a, b) => {
                const timeA = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
                const timeB = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
                return timeB - timeA;
            });

            callback(notifications);
        }, (error) => {
            console.error('Error subscribing to notifications:', error);
            callback([]);
        });
    } catch (error) {
        console.error("Failed to subscribe to notifications:", error);
        // Return a dummy unsubscribe
        return () => { };
    }
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
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string, tenantId?: string): Promise<void> => {
    try {
        const tid = resolveTenantId(tenantId);
        const notificationRef = doc(db, 'tenants', tid, 'notifications', notificationId);
        await updateDoc(notificationRef, {
            read: true
        });
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (userId: string, tenantId?: string): Promise<void> => {
    try {
        const tid = resolveTenantId(tenantId);
        const q = query(
            getNotificationsCollection(tid),
            where('userId', '==', userId),
            where('read', '==', false)
        );

        const snapshot = await getDocs(q);
        const batch = writeBatch(db);

        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });

        await batch.commit();
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
    }
};

/**
 * Delete a single notification
 */
export const deleteNotification = async (notificationId: string, tenantId?: string): Promise<void> => {
    try {
        const tid = resolveTenantId(tenantId);
        await deleteDoc(doc(db, 'tenants', tid, 'notifications', notificationId));
    } catch (error) {
        console.error('Failed to delete notification:', error);
        throw error;
    }
};

/**
 * Delete all notifications for a user
 */
export const deleteAllNotifications = async (userId: string, tenantId?: string): Promise<void> => {
    try {
        const tid = resolveTenantId(tenantId);
        const q = query(
            getNotificationsCollection(tid),
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);
        const batch = writeBatch(db);

        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
    } catch (error) {
        console.error('Failed to delete all notifications:', error);
        throw error;
    }
};

/**
 * Get unread notification count for a user
 */
export const getUnreadCount = async (userId: string, tenantId?: string): Promise<number> => {
    try {
        const tid = resolveTenantId(tenantId);
        const q = query(
            getNotificationsCollection(tid),
            where('userId', '==', userId),
            where('read', '==', false)
        );

        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error('Failed to get unread count:', error);
        return 0;
    }
};

/**
 * Helper to send task assignment notification
 */
export const notifyTaskAssignment = async (
    assigneeId: string,
    taskTitle: string,
    projectId: string,
    taskId: string,
    tenantId?: string
): Promise<void> => {
    await createNotification({
        userId: assigneeId,
        type: 'task_assigned',
        title: 'New Task Assignment',
        message: `You've been assigned to "${taskTitle}"`,
        projectId,
        taskId,
        tenantId
    });
};

/**
 * Helper to send issue assignment notification
 */
export const notifyIssueAssignment = async (
    assigneeId: string,
    issueTitle: string,
    projectId: string,
    issueId: string,
    tenantId?: string
): Promise<void> => {
    await createNotification({
        userId: assigneeId,
        type: 'issue_assigned',
        title: 'New Issue Assignment',
        message: `You've been assigned to issue "${issueTitle}"`,
        projectId,
        issueId,
        tenantId
    });
};

/**
 * Helper to send comment notification
 */
export const notifyComment = async (
    userId: string,
    targetTitle: string,
    targetType: 'task' | 'issue' | 'idea' | 'initiative',
    projectId: string,
    targetId: string,
    commentId: string,
    tenantId?: string
): Promise<void> => {
    await createNotification({
        userId,
        type: 'comment_added',
        title: 'New Comment',
        message: `New comment on ${targetType} "${targetTitle}"`,
        projectId,
        taskId: targetType === 'task' ? targetId : undefined,
        initiativeId: targetType === 'initiative' ? targetId : undefined,
        issueId: targetType === 'issue' ? targetId : undefined,
        commentId,
        tenantId
    });
};

/**
 * Helper to send project invite notification
 */
export const notifyProjectInvite = async (
    userId: string,
    projectTitle: string,
    projectId: string,
    tenantId?: string
): Promise<void> => {
    await createNotification({
        userId,
        type: 'project_invite',
        title: 'Project Invitation',
        message: `You've been invited to project "${projectTitle}"`,
        projectId,
        tenantId
    });
};

/**
 * Helper to send subtask assignment notification
 */
export const notifySubtaskAssignment = async (
    assigneeId: string,
    subtaskTitle: string,
    taskTitle: string,
    projectId: string,
    taskId: string,
    tenantId?: string
): Promise<void> => {
    await createNotification({
        userId: assigneeId,
        type: 'subtask_assigned',
        title: 'New Subtask Assignment',
        message: `You've been assigned to subtask "${subtaskTitle}" in task "${taskTitle}"`,
        projectId,
        taskId,
        tenantId
    });
};

/**
 * Helper to send mention notification
 */
export const notifyMention = async (
    userId: string,
    targetTitle: string,
    targetType: 'task' | 'issue' | 'idea' | 'initiative',
    projectId: string,
    targetId: string,
    commentId: string,
    tenantId?: string
): Promise<void> => {
    await createNotification({
        userId,
        type: 'comment_mention',
        title: 'New Mention',
        message: `You were mentioned in a comment on ${targetType} "${targetTitle}"`,
        projectId,
        taskId: targetType === 'task' ? targetId : undefined,
        initiativeId: targetType === 'initiative' ? targetId : undefined,
        issueId: targetType === 'issue' ? targetId : undefined,
        commentId,
        tenantId
    });
};
