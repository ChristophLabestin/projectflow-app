import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendEmail } from './email';

// db removed as unused
const auth = admin.auth();
const REGION = 'europe-west3';

export const onNotificationCreated = functions.region(REGION).firestore
    .document('tenants/{tenantId}/notifications/{notificationId}')
    .onCreate(async (snapshot, context) => {
        const notification = snapshot.data();
        const notificationId = context.params.notificationId;

        console.log(`Processing notification ${notificationId} for user ${notification.userId}`);

        if (!notification.userId) {
            console.log('No userId in notification, skipping email.');
            return;
        }

        try {
            // 1. Get user email and preferences
            const userRecord = await auth.getUser(notification.userId);
            const email = userRecord.email;

            if (!email) {
                console.log(`User ${notification.userId} has no email, skipping.`);
                return;
            }

            // TODO: Check user preferences for email notifications if we implement that later
            // const userPrefs = await db.doc(`tenants/${context.params.tenantId}/users/${notification.userId}`).get();
            // if (userPrefs.exists && userPrefs.data()?.notificationsDisabled) return;

            // 2. Construct email content
            const subject = notification.title || 'New Notification from ProjectFlow';

            // Basic HTML template
            const html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>${notification.title}</h2>
                    <p>${notification.message}</p>
                    <p style="color: #666; font-size: 12px; margin-top: 20px;">
                        Sent via ProjectFlow
                    </p>
                </div>
            `;

            // 3. Send Email
            await sendEmail(email, subject, html);
            console.log(`Email sent to ${email} for notification ${notificationId}`);

        } catch (error) {
            console.error('Error processing notification email:', error);
        }
    });
