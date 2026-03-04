"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteWorkspaceApiToken = exports.createWorkspaceApiToken = exports.listWorkspaceApiTokens = exports.saveWorkspaceSmtpConfig = exports.getWorkspaceSmtpConfig = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const functions = require("firebase-functions");
const authUtils_1 = require("./authUtils");
const init_1 = require("./init");
const REGION = 'europe-west3';
const SMTP_SECRET_ID = 'smtp';
const ALLOWED_API_PERMISSIONS = ['newsletter:write', 'recipients:read'];
const requireAuth = (context) => {
    var _a;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    return uid;
};
const requireWorkspaceOwner = async (tenantId, context) => {
    var _a;
    const uid = requireAuth(context);
    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }
    if (uid === tenantId) {
        return uid;
    }
    const membership = await init_1.db.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
    if (membership.exists && ((_a = membership.data()) === null || _a === void 0 ? void 0 : _a.role) === 'Owner') {
        return uid;
    }
    throw new functions.https.HttpsError('permission-denied', 'Workspace owner access required.');
};
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeSmtpConfig = (data) => {
    const port = Number(data === null || data === void 0 ? void 0 : data.port);
    const normalizedPort = Number.isFinite(port) && port > 0 && port <= 65535 ? port : 587;
    const smtpConfig = {
        host: normalizeString(data === null || data === void 0 ? void 0 : data.host),
        port: normalizedPort,
        user: normalizeString(data === null || data === void 0 ? void 0 : data.user),
        pass: typeof (data === null || data === void 0 ? void 0 : data.pass) === 'string' ? data.pass : '',
        useCustom: Boolean(data === null || data === void 0 ? void 0 : data.useCustom),
        fromEmail: normalizeString(data === null || data === void 0 ? void 0 : data.fromEmail)
    };
    if (Object.prototype.hasOwnProperty.call(data || {}, 'verified')) {
        smtpConfig.verified = Boolean(data === null || data === void 0 ? void 0 : data.verified);
    }
    return smtpConfig;
};
const generatePlainApiToken = () => `pfat_${crypto.randomBytes(32).toString('base64url')}`;
exports.getWorkspaceSmtpConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    await requireWorkspaceOwner(tenantId, context);
    const secretSnap = await init_1.db.collection('tenants').doc(tenantId).collection('secrets').doc(SMTP_SECRET_ID).get();
    if (secretSnap.exists) {
        return { smtpConfig: secretSnap.data() };
    }
    const tenantSnap = await init_1.db.collection('tenants').doc(tenantId).get();
    const tenantData = tenantSnap.data() || {};
    return { smtpConfig: tenantData.smtpConfig || null };
});
exports.saveWorkspaceSmtpConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    const actorId = await requireWorkspaceOwner(tenantId, context);
    const smtpConfig = normalizeSmtpConfig(data === null || data === void 0 ? void 0 : data.smtpConfig);
    await init_1.db.collection('tenants').doc(tenantId).collection('secrets').doc(SMTP_SECRET_ID).set(Object.assign(Object.assign({}, smtpConfig), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actorId }), { merge: true });
    await init_1.db.collection('tenants').doc(tenantId).set({
        smtpConfig: admin.firestore.FieldValue.delete()
    }, { merge: true });
    return { success: true };
});
exports.listWorkspaceApiTokens = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    await requireWorkspaceOwner(tenantId, context);
    const snapshot = await init_1.db
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
exports.createWorkspaceApiToken = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    const actorId = await requireWorkspaceOwner(tenantId, context);
    const name = normalizeString(data === null || data === void 0 ? void 0 : data.name);
    const projectScope = normalizeString(data === null || data === void 0 ? void 0 : data.projectScope) || null;
    const permissions = Array.isArray(data === null || data === void 0 ? void 0 : data.permissions)
        ? data.permissions.filter((value) => typeof value === 'string')
        : [];
    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'Token name is required.');
    }
    if (permissions.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one permission is required.');
    }
    if (permissions.some((permission) => !ALLOWED_API_PERMISSIONS.includes(permission))) {
        throw new functions.https.HttpsError('invalid-argument', 'One or more permissions are not allowed.');
    }
    let expiresAt = null;
    if (data === null || data === void 0 ? void 0 : data.expiresAt) {
        const parsed = new Date(data.expiresAt);
        if (Number.isNaN(parsed.getTime())) {
            throw new functions.https.HttpsError('invalid-argument', 'expiresAt must be a valid date.');
        }
        expiresAt = admin.firestore.Timestamp.fromDate(parsed);
    }
    const plainToken = generatePlainApiToken();
    const tokenHash = (0, authUtils_1.hashToken)(plainToken);
    const tokenPrefix = plainToken.substring(0, 12);
    const tokenRef = await init_1.db.collection('tenants').doc(tenantId).collection('api_tokens').add({
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
exports.deleteWorkspaceApiToken = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    await requireWorkspaceOwner(tenantId, context);
    const tokenId = normalizeString(data === null || data === void 0 ? void 0 : data.tokenId);
    if (!tokenId) {
        throw new functions.https.HttpsError('invalid-argument', 'tokenId is required.');
    }
    await init_1.db.collection('tenants').doc(tenantId).collection('api_tokens').doc(tokenId).delete();
    return { success: true };
});
//# sourceMappingURL=workspace-admin.js.map