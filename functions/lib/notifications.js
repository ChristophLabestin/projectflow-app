"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onNotificationCreated = exports.sendTestNotification = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const email_1 = require("./email");
const auth = admin.auth();
const db = admin.firestore();
const REGION = 'europe-west3';
const getString = (value, fallback = '') => {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
};
const escapeHtml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
const compactData = (payload) => Object.entries(payload).reduce((acc, [key, value]) => {
    if (typeof value === 'string' && value.trim().length > 0) {
        acc[key] = value;
    }
    return acc;
}, {});
const buildDeepLink = (notification) => {
    const projectId = getString(notification.projectId);
    if (!projectId) {
        return '/notifications';
    }
    const taskId = getString(notification.taskId);
    if (taskId) {
        return `/project/${projectId}/tasks/${taskId}`;
    }
    const initiativeId = getString(notification.initiativeId);
    if (initiativeId) {
        return `/project/${projectId}/initiatives/${initiativeId}`;
    }
    return `/project/${projectId}`;
};
const logDelivery = async (tenantId, notificationId, userId, channel, status, reason, details = {}) => {
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
const requireTenantAccess = async (tenantId, context) => {
    var _a;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in before testing notifications.');
    }
    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }
    if (uid === tenantId) {
        return uid;
    }
    const membership = await db.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
    if (!membership.exists) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have access to this workspace.');
    }
    return uid;
};
const removeInvalidTokens = async (userId, tokens) => {
    if (tokens.length === 0) {
        return;
    }
    await db.collection('users').doc(userId).set({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokens),
        fcmUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
};
const sendPushNotification = async (tenantId, notificationId, notification, userId) => {
    var _a;
    const userDoc = await db.collection('users').doc(userId).get();
    const fcmTokens = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens;
    const tokens = Array.isArray(fcmTokens)
        ? Array.from(new Set(fcmTokens.filter((token) => typeof token === 'string' && token.trim().length > 0)))
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
        initiativeId: getString(notification.initiativeId),
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
            var _a;
            const code = (_a = result.error) === null || _a === void 0 ? void 0 : _a.code;
            if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
                acc.push(tokens[index]);
            }
            return acc;
        }, []);
        if (invalidTokens.length > 0) {
            await removeInvalidTokens(userId, invalidTokens);
        }
        await logDelivery(tenantId, notificationId, userId, 'fcm', response.successCount > 0 ? 'sent' : 'failed', response.successCount > 0
            ? `Sent ${response.successCount} push notification(s); ${response.failureCount} failed.`
            : 'All FCM delivery attempts failed.', {
            attempted: tokens.length,
            successCount: response.successCount,
            failureCount: response.failureCount,
            invalidTokenCount: invalidTokens.length
        });
    }
    catch (error) {
        console.error('Error sending FCM notification:', error);
        await logDelivery(tenantId, notificationId, userId, 'fcm', 'failed', (error === null || error === void 0 ? void 0 : error.message) || 'FCM send failed.');
    }
};
exports.sendTestNotification = functions.region(REGION).https.onCall(async (data, context) => {
    var _a, _b;
    const tenantId = getString(data === null || data === void 0 ? void 0 : data.tenantId, ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || '');
    const userId = await requireTenantAccess(tenantId, context);
    const stateRef = db.collection('tenants').doc(tenantId).collection('notificationDiagnostics').doc(userId);
    const notificationRef = db.collection('tenants').doc(tenantId).collection('notifications').doc();
    const now = Date.now();
    const userDoc = await db.collection('users').doc(userId).get();
    const fcmTokens = (_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.fcmTokens;
    const tokenCount = Array.isArray(fcmTokens)
        ? Array.from(new Set(fcmTokens.filter((token) => typeof token === 'string' && token.trim().length > 0))).length
        : 0;
    await db.runTransaction(async (transaction) => {
        var _a;
        const stateSnap = await transaction.get(stateRef);
        const lastTestAt = (_a = stateSnap.data()) === null || _a === void 0 ? void 0 : _a.lastTestNotificationAt;
        const lastTestMillis = typeof (lastTestAt === null || lastTestAt === void 0 ? void 0 : lastTestAt.toMillis) === 'function' ? lastTestAt.toMillis() : 0;
        if (lastTestMillis && now - lastTestMillis < 30000) {
            throw new functions.https.HttpsError('resource-exhausted', 'Wait a moment before sending another test notification.');
        }
        transaction.set(stateRef, {
            userId,
            tenantId,
            lastTestNotificationAt: admin.firestore.FieldValue.serverTimestamp(),
            lastTokenCount: tokenCount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        transaction.set(notificationRef, {
            userId,
            tenantId,
            type: 'diagnostic_test',
            title: 'ProjectFlow test notification',
            message: 'If this appears in ProjectFlow and on your device, notification delivery is working for this account.',
            read: false,
            actorId: userId,
            actorName: 'ProjectFlow Diagnostics',
            diagnostic: {
                requestedBy: userId,
                tokenCount
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    return {
        success: true,
        tenantId,
        notificationId: notificationRef.id,
        fcmTokenCount: tokenCount
    };
});
exports.onNotificationCreated = functions.region(REGION).firestore
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
        await (0, email_1.sendEmail)(email, subject, html, { tenantId });
        await logDelivery(tenantId, notificationId, userId, 'email', 'sent', 'Email notification sent.');
        console.log(`Email sent to ${email} for notification ${notificationId}`);
    }
    catch (error) {
        console.error('Error processing notification email:', error);
        await logDelivery(tenantId, notificationId, userId, 'email', 'failed', (error === null || error === void 0 ? void 0 : error.message) || 'Email send failed.');
    }
});
//# sourceMappingURL=notifications.js.map