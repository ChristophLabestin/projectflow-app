import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendEmail } from './email';

const auth = admin.auth();
const db = admin.firestore();
const REGION = 'europe-west3';

type DeliveryStatus = 'sent' | 'failed' | 'skipped';

const getString = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
};

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const compactData = (payload: Record<string, unknown>): Record<string, string> =>
    Object.entries(payload).reduce((acc, [key, value]) => {
        if (typeof value === 'string' && value.trim().length > 0) {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, string>);

const buildDeepLink = (notification: Record<string, unknown>): string => {
    const projectId = getString(notification.projectId);
    if (!projectId) {
        return '/notifications';
    }

    const taskId = getString(notification.taskId);
    if (taskId) {
        return `/project/${projectId}/tasks/${taskId}`;
    }

    const issueId = getString(notification.issueId);
    if (issueId) {
        return `/project/${projectId}/issues/${issueId}`;
    }

    const initiativeId = getString(notification.initiativeId);
    if (initiativeId) {
        return `/project/${projectId}/initiatives/${initiativeId}`;
    }

    const flowId = getString(notification.flowId);
    if (flowId) {
        return `/project/${projectId}/flows/${flowId}`;
    }

    return `/project/${projectId}`;
};

const logDelivery = async (
    tenantId: string,
    notificationId: string,
    userId: string,
    channel: 'email' | 'fcm',
    status: DeliveryStatus,
    reason: string,
    details: Record<string, unknown> = {}
) => {
    await db.collection('tenants').doc(tenantId).collection('notificationDeliveryLogs').add({
        notificationId,
        userId,
        channel,
        status,
        reason,
        details,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
};

const removeInvalidTokens = async (userId: string, tokens: string[]) => {
    if (tokens.length === 0) {
        return;
    }

    await db.collection('users').doc(userId).set({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokens),
        fcmUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
};

const sendPushNotification = async (
    tenantId: string,
    notificationId: string,
    notification: Record<string, unknown>,
    userId: string
) => {
    const userDoc = await db.collection('users').doc(userId).get();
    const fcmTokens = userDoc.data()?.fcmTokens;
    const tokens = Array.isArray(fcmTokens)
        ? Array.from(new Set(fcmTokens.filter((token): token is string => typeof token === 'string' && token.trim().length > 0)))
        : [];

    if (tokens.length === 0) {
        await logDelivery(tenantId, notificationId, userId, 'fcm', 'skipped', 'No FCM tokens found on user profile.');
        return;
    }

    const title = getString(notification.title, 'ProjectFlow');
    const body = getString(notification.message, 'You have a new ProjectFlow update.');
    const deepLink = buildDeepLink(notification);
    const data = compactData({
        notificationId,
        tenantId,
        title,
        message: body,
        type: getString(notification.type),
        projectId: getString(notification.projectId),
        taskId: getString(notification.taskId),
        issueId: getString(notification.issueId),
        initiativeId: getString(notification.initiativeId),
        flowId: getString(notification.flowId),
        deepLink
    });

    try {
        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title,
                body
            },
            data,
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        category: 'PROJECTFLOW_NOTIFICATION'
                    }
                }
            },
            webpush: {
                fcmOptions: {
                    link: deepLink
                }
            }
        });

        const invalidTokens = response.responses.reduce((acc, result, index) => {
            const code = result.error?.code;
            if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
                acc.push(tokens[index]);
            }
            return acc;
        }, [] as string[]);

        if (invalidTokens.length > 0) {
            await removeInvalidTokens(userId, invalidTokens);
        }

        await logDelivery(
            tenantId,
            notificationId,
            userId,
            'fcm',
            response.successCount > 0 ? 'sent' : 'failed',
            response.successCount > 0
                ? `Sent ${response.successCount} push notification(s); ${response.failureCount} failed.`
                : 'All FCM delivery attempts failed.',
            {
                attempted: tokens.length,
                successCount: response.successCount,
                failureCount: response.failureCount,
                invalidTokenCount: invalidTokens.length
            }
        );
    } catch (error: any) {
        console.error('Error sending FCM notification:', error);
        await logDelivery(tenantId, notificationId, userId, 'fcm', 'failed', error?.message || 'FCM send failed.');
    }
};

export const onNotificationCreated = functions.region(REGION).firestore
    .document('tenants/{tenantId}/notifications/{notificationId}')
    .onCreate(async (snapshot, context) => {
        const notification = snapshot.data();
        const notificationId = context.params.notificationId;
        const tenantId = context.params.tenantId;
        const userId = getString(notification.userId);

        console.log(`Processing notification ${notificationId} for user ${userId}`);

        if (!userId) {
            console.log('No userId in notification, skipping delivery.');
            return;
        }

        await sendPushNotification(tenantId, notificationId, notification, userId);

        try {
            // 1. Get user email and preferences
            const userRecord = await auth.getUser(userId);
            const email = userRecord.email;

            if (!email) {
                console.log(`User ${userId} has no email, skipping.`);
                await logDelivery(tenantId, notificationId, userId, 'email', 'skipped', 'User has no email address.');
                return;
            }

            // TODO: Check user preferences for email notifications if we implement that later
            // const userPrefs = await db.doc(`tenants/${context.params.tenantId}/users/${notification.userId}`).get();
            // if (userPrefs.exists && userPrefs.data()?.notificationsDisabled) return;

            // 2. Construct email content
            const subject = getString(notification.title, 'New Notification from ProjectFlow');
            const body = getString(notification.message, 'You have a new ProjectFlow update.');

            // Basic HTML template
            const html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>${escapeHtml(subject)}</h2>
                    <p>${escapeHtml(body)}</p>
                    <p style="color: #666; font-size: 12px; margin-top: 20px;">
                        Sent via ProjectFlow
                    </p>
                </div>
            `;

            // 3. Send Email
            await sendEmail(email, subject, html, { tenantId });
            await logDelivery(tenantId, notificationId, userId, 'email', 'sent', 'Email notification sent.');
            console.log(`Email sent to ${email} for notification ${notificationId}`);

        } catch (error: any) {
            console.error('Error processing notification email:', error);
            await logDelivery(tenantId, notificationId, userId, 'email', 'failed', error?.message || 'Email send failed.');
        }
    });
