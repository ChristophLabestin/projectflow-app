import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as functions from 'firebase-functions';

import { hashToken, type ApiPermission } from './authUtils';
import { db } from './init';

const REGION = 'europe-west3';
const SMTP_SECRET_ID = 'smtp';
const ALLOWED_API_PERMISSIONS: ApiPermission[] = ['newsletter:write', 'recipients:read'];

const requireAuth = (context: functions.https.CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    return uid;
};

const requireWorkspaceOwner = async (tenantId: string, context: functions.https.CallableContext) => {
    const uid = requireAuth(context);

    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }

    if (uid === tenantId) {
        return uid;
    }

    const membership = await db.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
    if (membership.exists && membership.data()?.role === 'Owner') {
        return uid;
    }

    throw new functions.https.HttpsError('permission-denied', 'Workspace owner access required.');
};

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeSmtpConfig = (data: any) => {
    const port = Number(data?.port);
    const normalizedPort = Number.isFinite(port) && port > 0 && port <= 65535 ? port : 587;

    const smtpConfig: Record<string, unknown> = {
        host: normalizeString(data?.host),
        port: normalizedPort,
        user: normalizeString(data?.user),
        pass: typeof data?.pass === 'string' ? data.pass : '',
        useCustom: Boolean(data?.useCustom),
        fromEmail: normalizeString(data?.fromEmail)
    };

    if (Object.prototype.hasOwnProperty.call(data || {}, 'verified')) {
        smtpConfig.verified = Boolean(data?.verified);
    }

    return smtpConfig;
};

const generatePlainApiToken = () => `pfat_${crypto.randomBytes(32).toString('base64url')}`;

export const getWorkspaceSmtpConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    await requireWorkspaceOwner(tenantId, context);

    const secretSnap = await db.collection('tenants').doc(tenantId).collection('secrets').doc(SMTP_SECRET_ID).get();
    if (secretSnap.exists) {
        return { smtpConfig: secretSnap.data() };
    }

    const tenantSnap = await db.collection('tenants').doc(tenantId).get();
    const tenantData = tenantSnap.data() || {};
    return { smtpConfig: tenantData.smtpConfig || null };
});

export const saveWorkspaceSmtpConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    const actorId = await requireWorkspaceOwner(tenantId, context);
    const smtpConfig = normalizeSmtpConfig(data?.smtpConfig);

    await db.collection('tenants').doc(tenantId).collection('secrets').doc(SMTP_SECRET_ID).set({
        ...smtpConfig,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorId
    }, { merge: true });

    await db.collection('tenants').doc(tenantId).set({
        smtpConfig: admin.firestore.FieldValue.delete()
    }, { merge: true });

    return { success: true };
});

export const listWorkspaceApiTokens = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    await requireWorkspaceOwner(tenantId, context);

    const snapshot = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('api_tokens')
        .orderBy('createdAt', 'desc')
        .get();

    const tokens = snapshot.docs.map((doc) => {
        const token = doc.data();
        return {
            id: doc.id,
            name: token.name,
            tokenPrefix: token.tokenPrefix,
            permissions: token.permissions || [],
            projectScope: token.projectScope || null,
            createdAt: token.createdAt || null,
            lastUsedAt: token.lastUsedAt || null,
            expiresAt: token.expiresAt || null
        };
    });

    return { tokens };
});

export const createWorkspaceApiToken = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    const actorId = await requireWorkspaceOwner(tenantId, context);
    const name = normalizeString(data?.name);
    const projectScope = normalizeString(data?.projectScope) || null;
    const permissions = Array.isArray(data?.permissions)
        ? data.permissions.filter((value: unknown): value is string => typeof value === 'string')
        : [];

    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'Token name is required.');
    }

    if (permissions.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one permission is required.');
    }

    if (permissions.some((permission: string) => !ALLOWED_API_PERMISSIONS.includes(permission as ApiPermission))) {
        throw new functions.https.HttpsError('invalid-argument', 'One or more permissions are not allowed.');
    }

    let expiresAt: admin.firestore.Timestamp | null = null;
    if (data?.expiresAt) {
        const parsed = new Date(data.expiresAt);
        if (Number.isNaN(parsed.getTime())) {
            throw new functions.https.HttpsError('invalid-argument', 'expiresAt must be a valid date.');
        }
        expiresAt = admin.firestore.Timestamp.fromDate(parsed);
    }

    const plainToken = generatePlainApiToken();
    const tokenHash = hashToken(plainToken);
    const tokenPrefix = plainToken.substring(0, 12);

    const tokenRef = await db.collection('tenants').doc(tenantId).collection('api_tokens').add({
        tenantId,
        name,
        tokenHash,
        tokenPrefix,
        projectScope,
        permissions,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsedAt: null,
        expiresAt,
        createdBy: actorId
    });

    return {
        id: tokenRef.id,
        token: plainToken
    };
});

export const deleteWorkspaceApiToken = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    await requireWorkspaceOwner(tenantId, context);
    const tokenId = normalizeString(data?.tokenId);

    if (!tokenId) {
        throw new functions.https.HttpsError('invalid-argument', 'tokenId is required.');
    }

    await db.collection('tenants').doc(tenantId).collection('api_tokens').doc(tokenId).delete();
    return { success: true };
});
