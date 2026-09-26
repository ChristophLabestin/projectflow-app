"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptWorkspaceInvite = exports.sendInvitation = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const email_1 = require("./email");
const email_locales_1 = require("./email-locales");
const corsConfig_1 = require("./corsConfig");
const db = admin.firestore();
const REGION = 'europe-west3';
const INVITABLE_ROLES = ['Admin', 'Member', 'Guest'];
// Workspace invitations live at tenants/{tenantId}/invitations/{inviteId}.
// Admins create them from the client (validated by firestore.rules); these
// functions deliver the email and perform the privileged acceptance.
const escapeHtml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const getMemberRole = async (tenantId, uid) => {
    var _a;
    const snap = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
    return snap.exists ? String(((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.role) || 'Member') : null;
};
const resolveAppOrigin = (requested) => {
    if (typeof requested === 'string' && corsConfig_1.ALLOWED_ORIGINS.includes(requested))
        return requested;
    return process.env.APP_URL || 'https://app.getprojectflow.com';
};
exports.sendInvitation = functions.region(REGION).https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in to send invites.');
    }
    const { tenantId, inviteId, language, origin } = data || {};
    if (typeof tenantId !== 'string' || typeof inviteId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and inviteId are required.');
    }
    const role = await getMemberRole(tenantId, context.auth.uid);
    if (role !== 'Owner' && role !== 'Admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only workspace admins can send invitations.');
    }
    const inviteSnap = await db.doc(`tenants/${tenantId}/invitations/${inviteId}`).get();
    const invite = inviteSnap.data();
    if (!inviteSnap.exists || !invite || invite.status !== 'pending' || !invite.email) {
        throw new functions.https.HttpsError('failed-precondition', 'Invitation is not pending or has no email.');
    }
    const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
    const workspaceName = escapeHtml(String(((_a = tenantSnap.data()) === null || _a === void 0 ? void 0 : _a.name) || 'ProjectFlow'));
    const inviteUrl = `${resolveAppOrigin(origin)}/invite/${tenantId}/${inviteId}`;
    const locale = (0, email_locales_1.getLocale)(language);
    const content = email_locales_1.EMAIL_CONTENT[locale].invitation;
    const bodyHtml = `${content.bodyPrefix} <strong>${workspaceName}</strong> ${content.rolePrefix} <strong>${escapeHtml(String(invite.role))}</strong>. ${content.bodySuffix}`;
    const html = (0, email_1.getSystemEmailTemplate)(content.title, bodyHtml, inviteUrl, content.button, locale);
    await (0, email_1.sendEmail)(invite.email, content.subject, html, { tenantId });
    return { success: true };
});
exports.acceptWorkspaceInvite = functions.region(REGION).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in to accept the invitation.');
    }
    const { tenantId, inviteId } = data || {};
    if (typeof tenantId !== 'string' || typeof inviteId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and inviteId are required.');
    }
    const uid = context.auth.uid;
    const token = context.auth.token;
    const userRecord = await admin.auth().getUser(uid);
    const email = String(userRecord.email || token.email || '').toLowerCase();
    const inviteRef = db.doc(`tenants/${tenantId}/invitations/${inviteId}`);
    const memberRef = db.doc(`tenants/${tenantId}/members/${uid}`);
    const tenantRef = db.doc(`tenants/${tenantId}`);
    const result = await db.runTransaction(async (tx) => {
        var _a, _b, _c, _d, _e;
        const [inviteSnap, memberSnap, tenantSnap] = await Promise.all([tx.get(inviteRef), tx.get(memberRef), tx.get(tenantRef)]);
        const invite = inviteSnap.data();
        if (!inviteSnap.exists || !invite || !tenantSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Invitation not found.');
        }
        if (invite.status !== 'pending') {
            throw new functions.https.HttpsError('failed-precondition', 'invite-not-pending');
        }
        if (invite.expiresAt && Date.parse(invite.expiresAt) < Date.now()) {
            throw new functions.https.HttpsError('failed-precondition', 'invite-expired');
        }
        if (invite.maxUses && Number(invite.uses || 0) >= Number(invite.maxUses)) {
            throw new functions.https.HttpsError('failed-precondition', 'invite-used-up');
        }
        if (invite.kind === 'email' && invite.email && invite.email !== email) {
            throw new functions.https.HttpsError('permission-denied', 'invite-email-mismatch');
        }
        // Anyone can register an account with any address; only a confirmed
        // address proves the caller is the person the invitation was sent to.
        if (invite.kind === 'email' && !userRecord.emailVerified) {
            throw new functions.https.HttpsError('permission-denied', 'invite-email-unverified');
        }
        const inviteRole = INVITABLE_ROLES.includes(invite.role) ? invite.role : 'Member';
        const projectIds = Array.isArray(invite.projectIds) ? invite.projectIds.filter((id) => typeof id === 'string') : [];
        const projectSnaps = await Promise.all(projectIds.map((projectId) => tx.get(db.doc(`tenants/${tenantId}/projects/${projectId}`))));
        // Existing members keep their (higher) role; only their project access grows.
        const existingRole = memberSnap.exists ? String(((_a = memberSnap.data()) === null || _a === void 0 ? void 0 : _a.role) || 'Member') : null;
        const rank = { Guest: 0, Member: 1, Admin: 2, Owner: 3 };
        const role = existingRole && ((_b = rank[existingRole]) !== null && _b !== void 0 ? _b : 1) >= ((_c = rank[inviteRole]) !== null && _c !== void 0 ? _c : 1) ? existingRole : inviteRole;
        const now = firestore_1.FieldValue.serverTimestamp();
        tx.set(memberRef, {
            uid,
            role,
            roleIds: ((_d = memberSnap.data()) === null || _d === void 0 ? void 0 : _d.roleIds) || [],
            joinedAt: ((_e = memberSnap.data()) === null || _e === void 0 ? void 0 : _e.joinedAt) || now,
            invitedBy: invite.invitedBy || null,
            inviteId,
            displayName: userRecord.displayName || email.split('@')[0] || 'User',
            email,
            photoURL: userRecord.photoURL || ''
        }, { merge: true });
        projectSnaps.forEach((projectSnap) => {
            var _a;
            if (!projectSnap.exists)
                return;
            const memberIds = ((_a = projectSnap.data()) === null || _a === void 0 ? void 0 : _a.memberIds) || [];
            if (memberIds.includes(uid))
                return;
            tx.update(projectSnap.ref, {
                memberIds: firestore_1.FieldValue.arrayUnion(uid),
                members: firestore_1.FieldValue.arrayUnion({
                    userId: uid,
                    role: 'Editor',
                    joinedAt: new Date().toISOString(),
                    invitedBy: invite.invitedBy || null
                }),
                [`roles.${uid}`]: 'Editor'
            });
        });
        const uses = Number(invite.uses || 0) + 1;
        const usedUp = invite.kind === 'email' || (invite.maxUses && uses >= Number(invite.maxUses));
        tx.update(inviteRef, Object.assign({ uses, lastAcceptedBy: uid, lastAcceptedAt: now }, (usedUp ? { status: 'accepted', acceptedBy: uid, acceptedAt: now } : {})));
        return { tenantId, role };
    });
    return result;
});
//# sourceMappingURL=invitations.js.map