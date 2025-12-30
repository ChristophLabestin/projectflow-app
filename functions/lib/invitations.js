"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInvitation = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const email_1 = require("./email");
const email_locales_1 = require("./email-locales");
const db = admin.firestore();
const REGION = 'europe-west3';
// Helper to generate a unique token
const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
exports.sendInvitation = functions.region(REGION).https.onCall(async (data, context) => {
    // 1. Validate Request
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in to send invites.');
    }
    const { email, type, targetId, role, tenantId: inputTenantId, language } = data;
    // For workspace invites, inputTenantId might be null if we are inviting TO the tenant context which is usually implicit
    // Actually, usually inviter is in a tenant. 
    if (!email || !type || !targetId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: email, type, targetId');
    }
    // Resolve tenantId
    // If inviting to a project, project might belong to a tenant.
    // Ideally the frontend passes the tenantId.
    const tenantId = inputTenantId;
    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'Tenant ID is required');
    }
    try {
        console.log(`Sending invite to ${email} for ${type} ${targetId} in tenant ${tenantId}`);
        // 2. Create Invite Record
        const inviteToken = generateToken();
        // inviteRef removed as it was unused and redundant with docRef logic below
        // Using auto ID allows multiple invites.
        // Actually, we might want to check if the user is already a member?
        // For now, let's just send the invite.
        // We need to store the invite so the frontend can validate it when the user clicks the link.
        // Wait, for workspace invites, we usually just add them to the users list or something?
        // The existing logic uses `getWorkspaceInviteLinks`. Let's see how they work.
        // `generateWorkspaceInviteLink` in `dataService.ts` just creates a doc in `invites` collection.
        // Let's emulate that structure but maybe add specific email targeting.
        const inviteData = {
            type,
            targetId,
            role: role || 'Member',
            email,
            token: inviteToken,
            createdBy: context.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
            used: false
        };
        // If it's a project invite, we should store it in project invites or similar?
        // The existing `getProjectInviteLinks` looks at `tenants/{tid}/projects/{pid}/invites`.
        let docRef;
        if (type === 'project') {
            docRef = db.collection('tenants').doc(tenantId).collection('projects').doc(targetId).collection('invites').doc();
        }
        else {
            docRef = db.collection('tenants').doc(tenantId).collection('invites').doc();
        }
        await docRef.set(inviteData);
        // 3. Send Email
        // Construct Link
        // Assuming app is hosted at something like https://app.projectflow.com or localhost
        // We need the origin.
        // For now, let's assume a standard URL structure:
        // /invite?token=...&type=...
        // Or /join/...
        const origin = process.env.APP_URL || 'http://localhost:5173'; // Fallback for dev
        // In production, we should probably pass the origin from the client or config.
        // Let's ask client to pass origin? Or just config it.
        const inviteUrl = `${origin}/accept-invite?token=${docRef.id}&type=${type}&tenantId=${tenantId}&targetId=${targetId}`;
        // Note: existing invites rely on doc ID or token field? 
        // `generateWorkspaceInviteLink` returns the ID. 
        // Let's assume the ID acts as the token for simplicity unless we implemented a token field lookup.
        const locale = (0, email_locales_1.getLocale)(language);
        const content = email_locales_1.EMAIL_CONTENT[locale].invitation;
        const subject = content.subject;
        const bodyHtml = `${content.bodyPrefix} <strong>${type}</strong> ${content.rolePrefix} <strong>${role || 'Member'}</strong>. ${content.bodySuffix}`;
        const html = (0, email_1.getSystemEmailTemplate)(content.title, bodyHtml, inviteUrl, content.button, locale);
        await (0, email_1.sendEmail)(email, subject, html);
        return { success: true, message: 'Invitation sent' };
    }
    catch (error) {
        console.error('Error sending invitation:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=invitations.js.map