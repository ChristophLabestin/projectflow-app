import * as functions from 'firebase-functions/v1';
import { FAST_START } from './runtime-options';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { EMAIL_SECRETS, sendEmail, getSystemEmailTemplate } from './email';
import { EMAIL_CONTENT, getLocale } from './email-locales';
import { ALLOWED_ORIGINS } from './corsConfig';
import { assertCanAddMember, loadPlanLimits } from './billing';
import { memberRef } from './tenant-id';

const db = admin.firestore();
const REGION = 'europe-west3';
const INVITABLE_ROLES = ['Admin', 'Member', 'Guest'];

// Workspace invitations live at tenants/{tenantId}/invitations/{inviteId}.
// Admins create them from the client (validated by firestore.rules); these
// functions deliver the email and perform the privileged acceptance.

const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const getMemberRole = async (tenantId: string, uid: string): Promise<string | null> => {
    const snap = await memberRef(tenantId, uid).get();
    return snap.exists ? String(snap.data()?.role || 'Member') : null;
};

const APPLE_RELAY_DOMAIN = 'privaterelay.appleid.com';

/** `anna.berger@example.com` -> `a***@e***.com` (enough for the user to recognise the address, not to harvest it). */
export const maskEmail = (email: string): string => {
    const [local = '', domain = ''] = email.toLowerCase().split('@');
    const dot = domain.lastIndexOf('.');
    const host = dot > 0 ? domain.slice(0, dot) : domain;
    const tld = dot > 0 ? domain.slice(dot) : '';
    return `${local.slice(0, 1)}***@${host.slice(0, 1)}***${tld}`;
};

/**
 * Details attached to the `invite-email-mismatch` error (the code/message stay unchanged) so clients can
 * explain *why* the account does not match: most often the user signed in with Apple "Hide My Email",
 * which gives the account a private-relay address that can never equal the invited address.
 */
export const describeEmailMismatch = (
    userRecord: { providerData?: Array<{ providerId: string }> },
    accountEmail: string,
    inviteEmail: string
) => {
    const providers = (userRecord.providerData || []).map((provider) => provider.providerId);
    const isPrivateRelay = accountEmail.endsWith(`@${APPLE_RELAY_DOMAIN}`);
    return {
        reason: isPrivateRelay ? 'apple-hide-my-email' : 'different-account',
        accountEmail,
        accountEmailIsPrivateRelay: isPrivateRelay,
        accountProviders: providers,
        signedInWithApple: providers.includes('apple.com'),
        invitedEmailHint: maskEmail(inviteEmail),
        // What the client may offer: ask the admin for a link invite, or link / switch accounts.
        suggestions: isPrivateRelay
            ? ['ask-for-link-invite', 'link-account-with-invited-email']
            : ['sign-in-with-invited-email', 'ask-for-link-invite']
    };
};

const resolveAppOrigin = (requested?: unknown) => {
    if (typeof requested === 'string' && ALLOWED_ORIGINS.includes(requested)) return requested;
    return process.env.APP_URL || 'https://app.getprojectflow.com';
};

export const sendInvitation = functions.region(REGION).runWith(FAST_START).runWith({ secrets: EMAIL_SECRETS }).https.onCall(async (data, context) => {
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

    if (!(await loadPlanLimits(tenantId)).invitesAllowed) {
        throw new functions.https.HttpsError('failed-precondition', 'plan-invites-disabled');
    }

    const inviteSnap = await db.doc(`tenants/${tenantId}/invitations/${inviteId}`).get();
    const invite = inviteSnap.data();
    if (!inviteSnap.exists || !invite || invite.status !== 'pending' || !invite.email) {
        throw new functions.https.HttpsError('failed-precondition', 'Invitation is not pending or has no email.');
    }

    const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
    const workspaceName = escapeHtml(String(tenantSnap.data()?.name || 'ProjectFlow'));
    const inviteUrl = `${resolveAppOrigin(origin)}/invite/${tenantId}/${inviteId}`;

    const locale = getLocale(language);
    const content = EMAIL_CONTENT[locale].invitation;
    const bodyHtml = `${content.bodyPrefix} <strong>${workspaceName}</strong> ${content.rolePrefix} <strong>${escapeHtml(String(invite.role))}</strong>. ${content.bodySuffix}`;
    const html = getSystemEmailTemplate(content.title, bodyHtml, inviteUrl, content.button, locale);

    await sendEmail(invite.email, content.subject, html, { tenantId, type: 'invitation' });
    return { success: true };
});

export const acceptWorkspaceInvite = functions.region(REGION).runWith(FAST_START).https.onCall(async (data, context) => {
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
    const memberDoc = memberRef(tenantId, uid);
    const tenantRef = db.doc(`tenants/${tenantId}`);

    // Plan check (Free: no invitations; Team: up to 50 full members). Guests are free.
    const [preInvite, preMember] = await Promise.all([inviteRef.get(), memberDoc.get()]);
    const preInviteRole = INVITABLE_ROLES.includes(preInvite.data()?.role) ? String(preInvite.data()?.role) : 'Member';
    const preRole = preMember.exists ? String(preMember.data()?.role || 'Member') : null;
    if (preInvite.exists && (preRole === null || (preRole === 'Guest' && preInviteRole !== 'Guest'))) {
        await assertCanAddMember(tenantId, preInviteRole);
    }

    const result = await db.runTransaction(async (tx) => {
        const [inviteSnap, memberSnap, tenantSnap] = await Promise.all([tx.get(inviteRef), tx.get(memberDoc), tx.get(tenantRef)]);
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
            throw new functions.https.HttpsError('permission-denied', 'invite-email-mismatch', describeEmailMismatch(userRecord, email, String(invite.email)));
        }
        // Anyone can register an account with any address; only a confirmed
        // address proves the caller is the person the invitation was sent to.
        if (invite.kind === 'email' && !userRecord.emailVerified) {
            throw new functions.https.HttpsError('permission-denied', 'invite-email-unverified');
        }
        const inviteRole = INVITABLE_ROLES.includes(invite.role) ? invite.role : 'Member';
        const projectIds: string[] = Array.isArray(invite.projectIds) ? invite.projectIds.filter((id: unknown) => typeof id === 'string') : [];

        const projectSnaps = await Promise.all(projectIds.map((projectId) => tx.get(db.doc(`tenants/${tenantId}/projects/${projectId}`))));

        // Existing members keep their (higher) role; only their project access grows.
        const existingRole = memberSnap.exists ? String(memberSnap.data()?.role || 'Member') : null;
        const rank: Record<string, number> = { Guest: 0, Member: 1, Admin: 2, Owner: 3 };
        const role = existingRole && (rank[existingRole] ?? 1) >= (rank[inviteRole] ?? 1) ? existingRole : inviteRole;

        const now = FieldValue.serverTimestamp();
        tx.set(memberDoc, {
            uid,
            role,
            roleIds: memberSnap.data()?.roleIds || [],
            joinedAt: memberSnap.data()?.joinedAt || now,
            invitedBy: invite.invitedBy || null,
            inviteId,
            displayName: userRecord.displayName || email.split('@')[0] || 'User',
            email,
            photoURL: userRecord.photoURL || ''
        }, { merge: true });

        projectSnaps.forEach((projectSnap) => {
            if (!projectSnap.exists) return;
            const memberIds: string[] = projectSnap.data()?.memberIds || [];
            if (memberIds.includes(uid)) return;
            tx.update(projectSnap.ref, {
                memberIds: FieldValue.arrayUnion(uid),
                members: FieldValue.arrayUnion({
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
        tx.update(inviteRef, {
            uses,
            lastAcceptedBy: uid,
            lastAcceptedAt: now,
            ...(usedUp ? { status: 'accepted', acceptedBy: uid, acceptedAt: now } : {})
        });

        return { tenantId, role };
    });

    return result;
});
