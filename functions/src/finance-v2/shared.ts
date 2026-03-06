import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as functions from 'firebase-functions';

import { db } from '../init';

export const REGION = 'europe-west3';

export const FINANCE_COLLECTIONS = {
    accounts: 'finance_accounts',
    fiscalYears: 'finance_fiscal_years',
    periods: 'finance_periods',
    journalEntries: 'finance_journal_entries',
    journalLines: 'finance_journal_lines',
    customers: 'finance_customers',
    vendors: 'finance_vendors',
    invoices: 'finance_invoices',
    creditNotes: 'finance_credit_notes',
    bills: 'finance_bills',
    payments: 'finance_payments',
    paymentAllocations: 'finance_payment_allocations',
    subscriptions: 'finance_subscriptions',
    subscriptionEvents: 'finance_subscription_events',
    bankAccounts: 'finance_bank_accounts',
    bankTransactions: 'finance_bank_transactions',
    reconciliations: 'finance_reconciliations',
    assets: 'finance_assets',
    depreciationSchedules: 'finance_depreciation_schedules',
    budgets: 'finance_budgets',
    forecasts: 'finance_forecasts',
    scenarios: 'finance_scenarios',
    taxCodes: 'finance_tax_codes',
    taxPeriods: 'finance_tax_periods',
    taxReports: 'finance_tax_reports',
    exports: 'finance_exports',
    auditLog: 'finance_audit_log',
    settings: 'finance_settings',
} as const;

export type FinancePermissionNode =
    | 'tenant.finance.view'
    | 'tenant.finance.manage'
    | 'tenant.finance.accounts.manage'
    | 'tenant.finance.ledger.post'
    | 'tenant.finance.ar.manage'
    | 'tenant.finance.ap.manage'
    | 'tenant.finance.tax.manage'
    | 'tenant.finance.close'
    | 'tenant.finance.export.datev'
    | 'tenant.finance.audit.view'
    | 'tenant.finance.reconciliation.manage';

const ADMIN_GRANTED_PERMISSIONS: FinancePermissionNode[] = [
    'tenant.finance.view',
    'tenant.finance.manage',
    'tenant.finance.accounts.manage',
    'tenant.finance.ledger.post',
    'tenant.finance.ar.manage',
    'tenant.finance.ap.manage',
    'tenant.finance.tax.manage',
    'tenant.finance.close',
    'tenant.finance.export.datev',
    'tenant.finance.audit.view',
    'tenant.finance.reconciliation.manage',
];

const MEMBER_GRANTED_PERMISSIONS: FinancePermissionNode[] = [
    'tenant.finance.view',
];

export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

export const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const toNonNegative = (value: unknown) => Math.max(0, toNumber(value));

export const toPeriodKey = (input: unknown): string => {
    const value = input instanceof Date
        ? input.toISOString().slice(0, 10)
        : normalizeString(input);

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid date value.');
    }

    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

export const normalizeCurrencyCode = (value: unknown, fallback = 'EUR') => {
    const code = normalizeString(value).toUpperCase();
    if (!code) return fallback;
    return code.slice(0, 3);
};

export const tenantDocRef = (tenantId: string) => db.collection('tenants').doc(tenantId);

export const tenantCollectionRef = (tenantId: string, collectionName: string) =>
    tenantDocRef(tenantId).collection(collectionName);

export const buildIdempotencyKey = (payload: unknown) => {
    const serialized = JSON.stringify(payload);
    return crypto.createHash('sha256').update(serialized).digest('hex');
};

const requireAuth = (context: functions.https.CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    return uid;
};

const getRolePermissions = async (
    tenantId: string,
    uid: string,
): Promise<Set<FinancePermissionNode>> => {
    if (uid === tenantId) {
        return new Set(ADMIN_GRANTED_PERMISSIONS);
    }

    const memberSnap = await tenantCollectionRef(tenantId, 'members').doc(uid).get();
    if (!memberSnap.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Workspace access required.');
    }

    const membership = memberSnap.data() || {};
    const rawRole = normalizeString(membership.role);

    if (rawRole === 'Owner' || rawRole === 'Admin') {
        return new Set(ADMIN_GRANTED_PERMISSIONS);
    }

    if (rawRole === 'Member' || rawRole === 'Guest') {
        return new Set(MEMBER_GRANTED_PERMISSIONS);
    }

    const tenantSnap = await tenantDocRef(tenantId).get();
    const tenantData = tenantSnap.data() || {};
    const customRoles = Array.isArray(tenantData.customRoles) ? tenantData.customRoles : [];
    const customRole = customRoles.find((role) => normalizeString(role?.id) === rawRole);
    const permissions = Array.isArray(customRole?.permissions) ? customRole.permissions : [];

    const resolved = new Set<FinancePermissionNode>(MEMBER_GRANTED_PERMISSIONS);
    permissions.forEach((permission: unknown) => {
        const normalized = normalizeString(permission) as FinancePermissionNode;
        if (normalized.startsWith('tenant.finance.')) {
            resolved.add(normalized);
        }
        if (normalized === 'tenant.finance.view' || normalized === 'tenant.finance.manage') {
            resolved.add(normalized);
        }
    });

    if (resolved.has('tenant.finance.manage')) {
        ADMIN_GRANTED_PERMISSIONS.forEach((permission) => resolved.add(permission));
    }

    return resolved;
};

export const requireFinancePermission = async (
    tenantId: string,
    context: functions.https.CallableContext,
    required: FinancePermissionNode,
) => {
    const uid = requireAuth(context);
    const permissions = await getRolePermissions(tenantId, uid);

    if (permissions.has(required)) {
        return uid;
    }

    if (required !== 'tenant.finance.view' && permissions.has('tenant.finance.manage')) {
        return uid;
    }

    throw new functions.https.HttpsError('permission-denied', `Missing permission: ${required}`);
};

export const assertPeriodWritable = async (tenantId: string, periodKey: string) => {
    const periodSnap = await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.periods).doc(periodKey).get();
    if (!periodSnap.exists) return;

    const status = normalizeString(periodSnap.data()?.status);
    if (status === 'closed') {
        throw new functions.https.HttpsError('failed-precondition', `Period ${periodKey} is closed.`);
    }
};

export const writeFinanceAuditLog = async (
    tenantId: string,
    actorId: string,
    action: string,
    details: Record<string, unknown>,
) => {
    await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.auditLog).add({
        tenantId,
        actorId,
        action,
        details,
        createdAt: serverTimestamp(),
    });
};
