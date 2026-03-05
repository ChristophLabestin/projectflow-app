import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as functions from 'firebase-functions';

import { hashToken, type ApiPermission } from './authUtils';
import { db } from './init';

const REGION = 'europe-west3';
const SMTP_SECRET_ID = 'smtp';
const FINANCIAL_SECRET_ID = 'projectflowFinancial';
const DEFAULT_FINANCIAL_ENDPOINT = 'https://europe-west3-quivena.cloudfunctions.net/projectflowFinancialLogs';
const DEFAULT_FINANCIAL_MONTHS = 6;
const MIN_FINANCIAL_MONTHS = 1;
const MAX_FINANCIAL_MONTHS = 24;
const ALLOWED_API_PERMISSIONS: ApiPermission[] = [
    'newsletter:write',
    'recipients:read',
    'projects:read',
    'projects:write',
    'projects:delete',
    'tasks:read',
    'tasks:write',
    'tasks:delete'
];

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

const requireWorkspaceAccess = async (tenantId: string, context: functions.https.CallableContext) => {
    const uid = requireAuth(context);

    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }

    if (uid === tenantId) {
        return uid;
    }

    const membership = await db.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
    if (membership.exists) {
        return uid;
    }

    throw new functions.https.HttpsError('permission-denied', 'Workspace access required.');
};

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeMonthsFromStored = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        return DEFAULT_FINANCIAL_MONTHS;
    }
    return Math.min(MAX_FINANCIAL_MONTHS, Math.max(MIN_FINANCIAL_MONTHS, parsed));
};

const parseMonthsInput = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < MIN_FINANCIAL_MONTHS || parsed > MAX_FINANCIAL_MONTHS) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            `months must be an integer between ${MIN_FINANCIAL_MONTHS} and ${MAX_FINANCIAL_MONTHS}.`
        );
    }

    return parsed;
};

const normalizeFinancialEndpoint = (value: unknown) => normalizeString(value).replace(/\/+$/, '');

const isValidHttpsUrl = (value: string) => {
    try {
        const url = new URL(value);
        return url.protocol === 'https:';
    } catch {
        return false;
    }
};

const normalizeMonthKey = (value: unknown): string | null => {
    const key = normalizeString(value);
    if (!key) {
        return null;
    }
    if (!/^\d{4}-\d{2}$/.test(key)) {
        throw new functions.https.HttpsError('invalid-argument', 'monthKey must use YYYY-MM format.');
    }
    return key;
};

const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

type FinancialBreakdownEntry = {
    name: string;
    aiUsd: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
};

type FinancialMonth = {
    monthKey: string;
    byModel: FinancialBreakdownEntry[];
    byFunction: FinancialBreakdownEntry[];
};

type FinancialTotals = {
    aiUsd: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
};

type FinancialUsageResponse = {
    endpoint: string;
    linkedProjectId: string | null;
    requestedMonths: number;
    totals: FinancialTotals;
    months: Array<{
        monthKey: string;
        byModel: Array<{
            model: string;
            aiUsd: number;
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
        }>;
        byFunction: Array<{
            function: string;
            aiUsd: number;
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
        }>;
    }>;
    isConfigured: boolean;
};

const normalizeBreakdownEntry = (entry: any) => {
    const name = normalizeString(entry?.name || entry?.model || entry?.function || entry?.id) || 'Unknown';
    return {
        name,
        aiUsd: toNumber(entry?.aiUsd),
        inputTokens: toNumber(entry?.inputTokens),
        outputTokens: toNumber(entry?.outputTokens),
        totalTokens: toNumber(entry?.totalTokens)
    };
};

const normalizeMonth = (month: any): FinancialMonth => {
    const key = normalizeString(month?.monthKey || month?.month || month?.key);
    const byModelRaw = Array.isArray(month?.byModel) ? month.byModel : [];
    const byFunctionRaw = Array.isArray(month?.byFunction) ? month.byFunction : [];

    return {
        monthKey: key || 'unknown',
        byModel: byModelRaw.map((entry: any) => normalizeBreakdownEntry(entry)),
        byFunction: byFunctionRaw.map((entry: any) => normalizeBreakdownEntry(entry))
    };
};

const normalizeTotals = (totals: any): FinancialTotals => ({
    aiUsd: toNumber(totals?.aiUsd),
    inputTokens: toNumber(totals?.inputTokens),
    outputTokens: toNumber(totals?.outputTokens),
    totalTokens: toNumber(totals?.totalTokens)
});

const aggregateTotalsFromMonths = (months: FinancialMonth[]): FinancialTotals => {
    return months.reduce<FinancialTotals>((acc, month) => {
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

const buildEmptyFinancialUsageResponse = (
    endpoint: string,
    linkedProjectId: string | null,
    requestedMonths: number
): FinancialUsageResponse => ({
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

export const getWorkspaceFinancialConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    await requireWorkspaceOwner(tenantId, context);

    const secretSnap = await db.collection('tenants').doc(tenantId).collection('secrets').doc(FINANCIAL_SECRET_ID).get();
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

export const saveWorkspaceFinancialConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    const actorId = await requireWorkspaceOwner(tenantId, context);

    const endpoint = normalizeFinancialEndpoint(data?.endpoint) || DEFAULT_FINANCIAL_ENDPOINT;
    if (!isValidHttpsUrl(endpoint)) {
        throw new functions.https.HttpsError('invalid-argument', 'endpoint must be a valid HTTPS URL.');
    }

    const monthsInput = parseMonthsInput(data?.months);
    const months = monthsInput ?? DEFAULT_FINANCIAL_MONTHS;
    const linkedProjectId = normalizeString(data?.linkedProjectId) || null;
    const tokenInput = normalizeString(data?.token);

    const secretRef = db.collection('tenants').doc(tenantId).collection('secrets').doc(FINANCIAL_SECRET_ID);
    const existingSnap = await secretRef.get();
    const existingToken = existingSnap.exists ? normalizeString(existingSnap.data()?.token) : '';
    const token = tokenInput || existingToken;

    if (!token) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'A financial endpoint token is required for the initial setup.'
        );
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

export const fetchWorkspaceFinancialUsage = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    await requireWorkspaceAccess(tenantId, context);
    const monthsInput = parseMonthsInput(data?.months);
    const monthKey = normalizeMonthKey(data?.monthKey);

    const secretSnap = await db.collection('tenants').doc(tenantId).collection('secrets').doc(FINANCIAL_SECRET_ID).get();
    if (!secretSnap.exists) {
        return buildEmptyFinancialUsageResponse(
            DEFAULT_FINANCIAL_ENDPOINT,
            null,
            monthsInput ?? DEFAULT_FINANCIAL_MONTHS
        );
    }

    const secret = secretSnap.data() || {};
    const endpoint = normalizeFinancialEndpoint(secret.endpoint) || DEFAULT_FINANCIAL_ENDPOINT;
    const token = normalizeString(secret.token);
    const linkedProjectId = normalizeString(secret.linkedProjectId) || null;
    const requestedMonths = monthsInput ?? normalizeMonthsFromStored(secret.months);

    if (!token) {
        return buildEmptyFinancialUsageResponse(endpoint, linkedProjectId, requestedMonths);
    }

    const endpointUrl = new URL(endpoint);
    if (monthKey) {
        endpointUrl.searchParams.set('monthKey', monthKey);
    } else {
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
        throw new functions.https.HttpsError(
            'failed-precondition',
            `Financial endpoint request failed with HTTP ${response.status}.${details}`
        );
    }

    let parsed: any = {};
    try {
        parsed = rawBody ? JSON.parse(rawBody) : {};
    } catch {
        throw new functions.https.HttpsError('internal', 'Financial endpoint returned invalid JSON.');
    }

    const normalizedMonths: FinancialMonth[] = Array.isArray(parsed?.months)
        ? parsed.months.map((month: any) => normalizeMonth(month))
        : [];

    const totals = normalizeTotals(parsed?.totals);
    const resolvedTotals = (
        totals.aiUsd === 0 &&
        totals.inputTokens === 0 &&
        totals.outputTokens === 0 &&
        totals.totalTokens === 0 &&
        normalizedMonths.length > 0
    )
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
