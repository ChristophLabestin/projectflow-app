import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    doc,
    serverTimestamp,
    writeBatch,
    writeBatch,
    getDocs,
    deleteDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Notification, NotificationType } from '../types';

const NOTIFICATIONS = 'notifications';

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

    // Don't send notification to yourself
    if (user?.uid === data.userId) return;

    try {
        await addDoc(collection(db, NOTIFICATIONS), {
            ...data,
            actorId: user?.uid,
            actorName: user?.displayName || 'Someone',
            actorPhotoURL: user?.photoURL || '',
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
};

/**
 * Subscribe to real-time notifications for the current user
 */
export const subscribeToNotifications = (
    userId: string,
    callback: (notifications: Notification[]) => void
) => {
    const q = query(
        collection(db, NOTIFICATIONS),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Notification[];
        callback(notifications);
    }, (error) => {
        console.error('Error subscribing to notifications:', error);
        callback([]);
    });
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    try {
        const notificationRef = doc(db, NOTIFICATIONS, notificationId);
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
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
    try {
        const q = query(
            collection(db, NOTIFICATIONS),
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
export const deleteNotification = async (notificationId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, NOTIFICATIONS, notificationId));
    } catch (error) {
        console.error('Failed to delete notification:', error);
        throw error;
    }
};

/**
 * Delete all notifications for a user
 */
export const deleteAllNotifications = async (userId: string): Promise<void> => {
    try {
        const q = query(
            collection(db, NOTIFICATIONS),
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
export const getUnreadCount = async (userId: string): Promise<number> => {
    try {
        const q = query(
            collection(db, NOTIFICATIONS),
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
