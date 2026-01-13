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
    deleteDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Notification, NotificationType } from '../types';

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
    issueId?: string;
    commentId?: string;
    inviteId?: string;
    tenantId?: string;
}): Promise<void> => {
    const user = auth.currentUser;

    console.log('Creating notification:', data.type, 'to user:', data.userId);

    // Don't send notification to yourself
    if (user?.uid === data.userId) {
        console.log('Skipping notification - sender is recipient.');
        return;
    }

    try {
        // Sanitize data to remove undefined values (Firestore rejects undefined)
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        );

        const tenantId = resolveTenantId(data.tenantId);
        console.log('[Notification] Attempting addDoc to tenant collection:', tenantId);

        const docRef = await addDoc(getNotificationsCollection(tenantId), {
            ...cleanData,
            actorId: user?.uid,
            actorName: user?.displayName || 'Someone',
            actorPhotoURL: user?.photoURL || '',
            read: false,
            createdAt: serverTimestamp()
        });
        console.log('[Notification] Success! Document ID:', docRef.id);
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
    targetType: 'task' | 'issue' | 'idea',
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
    targetType: 'task' | 'issue' | 'idea',
    projectId: string,
    targetId: string,
    commentId: string,
    tenantId?: string
): Promise<void> => {
    console.log('[notifyMention] Called with:', { userId, targetTitle, targetType, projectId, targetId, commentId, tenantId });
    await createNotification({
        userId,
        type: 'comment_mention',
        title: 'New Mention',
        message: `You were mentioned in a comment on ${targetType} "${targetTitle}"`,
        projectId,
        taskId: targetType === 'task' ? targetId : undefined,
        issueId: targetType === 'issue' ? targetId : undefined,
        commentId,
        tenantId
    });
};
