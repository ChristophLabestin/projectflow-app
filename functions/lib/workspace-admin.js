"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWorkspaceFinancialUsage = exports.saveWorkspaceFinancialConfig = exports.getWorkspaceFinancialConfig = exports.deleteWorkspaceApiToken = exports.createWorkspaceApiToken = exports.listWorkspaceApiTokens = exports.saveWorkspaceSmtpConfig = exports.getWorkspaceSmtpConfig = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const functions = require("firebase-functions");
const authUtils_1 = require("./authUtils");
const init_1 = require("./init");
const REGION = 'europe-west3';
const SMTP_SECRET_ID = 'smtp';
const FINANCIAL_SECRET_ID = 'projectflowFinancial';
const DEFAULT_FINANCIAL_ENDPOINT = 'https://europe-west3-quivena.cloudfunctions.net/projectflowFinancialLogs';
const DEFAULT_FINANCIAL_MONTHS = 6;
const MIN_FINANCIAL_MONTHS = 1;
const MAX_FINANCIAL_MONTHS = 24;
const ALLOWED_API_PERMISSIONS = [
    'newsletter:write',
    'recipients:read',
    'projects:read',
    'projects:write',
    'projects:delete',
    'tasks:read',
    'tasks:write',
    'tasks:delete'
];
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
const requireWorkspaceAccess = async (tenantId, context) => {
    const uid = requireAuth(context);
    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }
    if (uid === tenantId) {
        return uid;
    }
    const membership = await init_1.db.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
    if (membership.exists) {
        return uid;
    }
    throw new functions.https.HttpsError('permission-denied', 'Workspace access required.');
};
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeMonthsFromStored = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        return DEFAULT_FINANCIAL_MONTHS;
    }
    return Math.min(MAX_FINANCIAL_MONTHS, Math.max(MIN_FINANCIAL_MONTHS, parsed));
};
const parseMonthsInput = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < MIN_FINANCIAL_MONTHS || parsed > MAX_FINANCIAL_MONTHS) {
        throw new functions.https.HttpsError('invalid-argument', `months must be an integer between ${MIN_FINANCIAL_MONTHS} and ${MAX_FINANCIAL_MONTHS}.`);
    }
    return parsed;
};
const normalizeFinancialEndpoint = (value) => normalizeString(value).replace(/\/+$/, '');
const isValidHttpsUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === 'https:';
    }
    catch (_a) {
        return false;
    }
};
const normalizeMonthKey = (value) => {
    const key = normalizeString(value);
    if (!key) {
        return null;
    }
    if (!/^\d{4}-\d{2}$/.test(key)) {
        throw new functions.https.HttpsError('invalid-argument', 'monthKey must use YYYY-MM format.');
    }
    return key;
};
const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeBreakdownEntry = (entry) => {
    const name = normalizeString((entry === null || entry === void 0 ? void 0 : entry.name) || (entry === null || entry === void 0 ? void 0 : entry.model) || (entry === null || entry === void 0 ? void 0 : entry.function) || (entry === null || entry === void 0 ? void 0 : entry.id)) || 'Unknown';
    return {
        name,
        aiUsd: toNumber(entry === null || entry === void 0 ? void 0 : entry.aiUsd),
        inputTokens: toNumber(entry === null || entry === void 0 ? void 0 : entry.inputTokens),
        outputTokens: toNumber(entry === null || entry === void 0 ? void 0 : entry.outputTokens),
        totalTokens: toNumber(entry === null || entry === void 0 ? void 0 : entry.totalTokens)
    };
};
const normalizeMonth = (month) => {
    const key = normalizeString((month === null || month === void 0 ? void 0 : month.monthKey) || (month === null || month === void 0 ? void 0 : month.month) || (month === null || month === void 0 ? void 0 : month.key));
    const byModelRaw = Array.isArray(month === null || month === void 0 ? void 0 : month.byModel) ? month.byModel : [];
    const byFunctionRaw = Array.isArray(month === null || month === void 0 ? void 0 : month.byFunction) ? month.byFunction : [];
    return {
        monthKey: key || 'unknown',
        byModel: byModelRaw.map((entry) => normalizeBreakdownEntry(entry)),
        byFunction: byFunctionRaw.map((entry) => normalizeBreakdownEntry(entry))
    };
};
const normalizeTotals = (totals) => ({
    aiUsd: toNumber(totals === null || totals === void 0 ? void 0 : totals.aiUsd),
    inputTokens: toNumber(totals === null || totals === void 0 ? void 0 : totals.inputTokens),
    outputTokens: toNumber(totals === null || totals === void 0 ? void 0 : totals.outputTokens),
    totalTokens: toNumber(totals === null || totals === void 0 ? void 0 : totals.totalTokens)
});
const aggregateTotalsFromMonths = (months) => {
    return months.reduce((acc, month) => {
        month.byModel.forEach((entry) => {
            acc.aiUsd += entry.aiUsd;
            acc.inputTokens += entry.inputTokens;
            acc.outputTokens += entry.outputTokens;
            acc.totalTokens += entry.totalTokens;
        });
        return acc;
    }, {
        aiUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
    });
};
const buildEmptyFinancialUsageResponse = (endpoint, linkedProjectId, requestedMonths) => ({
    endpoint,
    linkedProjectId,
    requestedMonths,
    totals: {
        aiUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
    },
    months: [],
    isConfigured: false
});
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
exports.getWorkspaceFinancialConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    await requireWorkspaceOwner(tenantId, context);
    const secretSnap = await init_1.db.collection('tenants').doc(tenantId).collection('secrets').doc(FINANCIAL_SECRET_ID).get();
    if (!secretSnap.exists) {
        return {
            config: null
        };
    }
    const config = secretSnap.data() || {};
    return {
        config: {
            endpoint: normalizeString(config.endpoint) || DEFAULT_FINANCIAL_ENDPOINT,
            months: normalizeMonthsFromStored(config.months),
            linkedProjectId: normalizeString(config.linkedProjectId) || null,
            hasToken: Boolean(normalizeString(config.token)),
            updatedAt: config.updatedAt || null
        }
    };
});
exports.saveWorkspaceFinancialConfig = functions.region(REGION).https.onCall(async (data, context) => {
    var _a;
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    const actorId = await requireWorkspaceOwner(tenantId, context);
    const endpoint = normalizeFinancialEndpoint(data === null || data === void 0 ? void 0 : data.endpoint) || DEFAULT_FINANCIAL_ENDPOINT;
    if (!isValidHttpsUrl(endpoint)) {
        throw new functions.https.HttpsError('invalid-argument', 'endpoint must be a valid HTTPS URL.');
    }
    const monthsInput = parseMonthsInput(data === null || data === void 0 ? void 0 : data.months);
    const months = monthsInput !== null && monthsInput !== void 0 ? monthsInput : DEFAULT_FINANCIAL_MONTHS;
    const linkedProjectId = normalizeString(data === null || data === void 0 ? void 0 : data.linkedProjectId) || null;
    const tokenInput = normalizeString(data === null || data === void 0 ? void 0 : data.token);
    const secretRef = init_1.db.collection('tenants').doc(tenantId).collection('secrets').doc(FINANCIAL_SECRET_ID);
    const existingSnap = await secretRef.get();
    const existingToken = existingSnap.exists ? normalizeString((_a = existingSnap.data()) === null || _a === void 0 ? void 0 : _a.token) : '';
    const token = tokenInput || existingToken;
    if (!token) {
        throw new functions.https.HttpsError('invalid-argument', 'A financial endpoint token is required for the initial setup.');
    }
    await secretRef.set({
        endpoint,
        token,
        months,
        linkedProjectId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorId
    }, { merge: true });
    return {
        config: {
            endpoint,
            months,
            linkedProjectId,
            hasToken: true
        }
    };
});
exports.fetchWorkspaceFinancialUsage = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    await requireWorkspaceAccess(tenantId, context);
    const monthsInput = parseMonthsInput(data === null || data === void 0 ? void 0 : data.months);
    const monthKey = normalizeMonthKey(data === null || data === void 0 ? void 0 : data.monthKey);
    const secretSnap = await init_1.db.collection('tenants').doc(tenantId).collection('secrets').doc(FINANCIAL_SECRET_ID).get();
    if (!secretSnap.exists) {
        return buildEmptyFinancialUsageResponse(DEFAULT_FINANCIAL_ENDPOINT, null, monthsInput !== null && monthsInput !== void 0 ? monthsInput : DEFAULT_FINANCIAL_MONTHS);
    }
    const secret = secretSnap.data() || {};
    const endpoint = normalizeFinancialEndpoint(secret.endpoint) || DEFAULT_FINANCIAL_ENDPOINT;
    const token = normalizeString(secret.token);
    const linkedProjectId = normalizeString(secret.linkedProjectId) || null;
    const requestedMonths = monthsInput !== null && monthsInput !== void 0 ? monthsInput : normalizeMonthsFromStored(secret.months);
    if (!token) {
        return buildEmptyFinancialUsageResponse(endpoint, linkedProjectId, requestedMonths);
    }
    const endpointUrl = new URL(endpoint);
    if (monthKey) {
        endpointUrl.searchParams.set('monthKey', monthKey);
    }
    else {
        endpointUrl.searchParams.set('months', String(requestedMonths));
    }
    const response = await fetch(endpointUrl.toString(), {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            'X-ProjectFlow-Token': token,
            Accept: 'application/json'
        }
    });
    const rawBody = await response.text();
    if (!response.ok) {
        const details = rawBody ? ` ${rawBody.slice(0, 300)}` : '';
        throw new functions.https.HttpsError('failed-precondition', `Financial endpoint request failed with HTTP ${response.status}.${details}`);
    }
    let parsed = {};
    try {
        parsed = rawBody ? JSON.parse(rawBody) : {};
    }
    catch (_a) {
        throw new functions.https.HttpsError('internal', 'Financial endpoint returned invalid JSON.');
    }
    const normalizedMonths = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.months)
        ? parsed.months.map((month) => normalizeMonth(month))
        : [];
    const totals = normalizeTotals(parsed === null || parsed === void 0 ? void 0 : parsed.totals);
    const resolvedTotals = (totals.aiUsd === 0 &&
        totals.inputTokens === 0 &&
        totals.outputTokens === 0 &&
        totals.totalTokens === 0 &&
        normalizedMonths.length > 0)
        ? aggregateTotalsFromMonths(normalizedMonths)
        : totals;
    return {
        endpoint,
        linkedProjectId,
        requestedMonths,
        totals: resolvedTotals,
        months: normalizedMonths.map((month) => ({
            monthKey: month.monthKey,
            byModel: month.byModel.map((entry) => ({
                model: entry.name,
                aiUsd: entry.aiUsd,
                inputTokens: entry.inputTokens,
                outputTokens: entry.outputTokens,
                totalTokens: entry.totalTokens
            })),
            byFunction: month.byFunction.map((entry) => ({
                function: entry.name,
                aiUsd: entry.aiUsd,
                inputTokens: entry.inputTokens,
                outputTokens: entry.outputTokens,
                totalTokens: entry.totalTokens
            }))
        })),
        isConfigured: true
    };
});
//# sourceMappingURL=workspace-admin.js.map