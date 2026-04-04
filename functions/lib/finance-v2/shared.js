"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFinanceAuditLog = exports.assertPeriodWritable = exports.requireFinancePermission = exports.buildIdempotencyKey = exports.tenantCollectionRef = exports.tenantDocRef = exports.normalizeCurrencyCode = exports.toPeriodKey = exports.toNonNegative = exports.toNumber = exports.normalizeString = exports.serverTimestamp = exports.FINANCE_COLLECTIONS = exports.REGION = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const functions = require("firebase-functions");
const init_1 = require("../init");
exports.REGION = 'europe-west3';
exports.FINANCE_COLLECTIONS = {
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
    jobs: 'finance_jobs',
    documents: 'finance_documents',
    documentVersions: 'finance_document_versions',
    recurringTemplates: 'finance_recurring_templates',
    allocationRules: 'finance_allocation_rules',
    syncConnections: 'finance_sync_connections',
    syncRuns: 'finance_sync_runs',
    operationRuns: 'finance_operation_runs',
    operationTemplates: 'finance_operation_templates',
    operationApprovals: 'finance_operation_approvals',
};
const ADMIN_GRANTED_PERMISSIONS = [
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
    'tenant.finance.documents.manage',
    'tenant.finance.sync.manage',
    'tenant.finance.reports.manage',
    'tenant.finance.functions.view',
    'tenant.finance.functions.execute',
    'tenant.finance.functions.retry',
    'tenant.finance.functions.template.manage',
    'tenant.finance.functions.approve.high_risk',
];
const MEMBER_GRANTED_PERMISSIONS = [
    'tenant.finance.view',
];
exports.serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
exports.normalizeString = normalizeString;
const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
exports.toNumber = toNumber;
const toNonNegative = (value) => Math.max(0, (0, exports.toNumber)(value));
exports.toNonNegative = toNonNegative;
const toPeriodKey = (input) => {
    const value = input instanceof Date
        ? input.toISOString().slice(0, 10)
        : (0, exports.normalizeString)(input);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid date value.');
    }
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};
exports.toPeriodKey = toPeriodKey;
const normalizeCurrencyCode = (value, fallback = 'EUR') => {
    const code = (0, exports.normalizeString)(value).toUpperCase();
    if (!code)
        return fallback;
    return code.slice(0, 3);
};
exports.normalizeCurrencyCode = normalizeCurrencyCode;
const tenantDocRef = (tenantId) => init_1.db.collection('tenants').doc(tenantId);
exports.tenantDocRef = tenantDocRef;
const tenantCollectionRef = (tenantId, collectionName) => (0, exports.tenantDocRef)(tenantId).collection(collectionName);
exports.tenantCollectionRef = tenantCollectionRef;
const buildIdempotencyKey = (payload) => {
    const serialized = JSON.stringify(payload);
    return crypto.createHash('sha256').update(serialized).digest('hex');
};
exports.buildIdempotencyKey = buildIdempotencyKey;
const requireAuth = (context) => {
    var _a;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    return uid;
};
const getRolePermissions = async (tenantId, uid) => {
    if (uid === tenantId) {
        return new Set(ADMIN_GRANTED_PERMISSIONS);
    }
    const memberSnap = await (0, exports.tenantCollectionRef)(tenantId, 'members').doc(uid).get();
    if (!memberSnap.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Workspace access required.');
    }
    const membership = memberSnap.data() || {};
    const rawRole = (0, exports.normalizeString)(membership.role);
    if (rawRole === 'Owner' || rawRole === 'Admin') {
        return new Set(ADMIN_GRANTED_PERMISSIONS);
    }
    if (rawRole === 'Member' || rawRole === 'Guest') {
        return new Set(MEMBER_GRANTED_PERMISSIONS);
    }
    const tenantSnap = await (0, exports.tenantDocRef)(tenantId).get();
    const tenantData = tenantSnap.data() || {};
    const customRoles = Array.isArray(tenantData.customRoles) ? tenantData.customRoles : [];
    const customRole = customRoles.find((role) => (0, exports.normalizeString)(role === null || role === void 0 ? void 0 : role.id) === rawRole);
    const permissions = Array.isArray(customRole === null || customRole === void 0 ? void 0 : customRole.permissions) ? customRole.permissions : [];
    const resolved = new Set(MEMBER_GRANTED_PERMISSIONS);
    permissions.forEach((permission) => {
        const normalized = (0, exports.normalizeString)(permission);
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
const requireFinancePermission = async (tenantId, context, required) => {
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
exports.requireFinancePermission = requireFinancePermission;
const assertPeriodWritable = async (tenantId, periodKey) => {
    var _a;
    const periodSnap = await (0, exports.tenantCollectionRef)(tenantId, exports.FINANCE_COLLECTIONS.periods).doc(periodKey).get();
    if (!periodSnap.exists)
        return;
    const status = (0, exports.normalizeString)((_a = periodSnap.data()) === null || _a === void 0 ? void 0 : _a.status);
    if (status === 'closed') {
        throw new functions.https.HttpsError('failed-precondition', `Period ${periodKey} is closed.`);
    }
};
exports.assertPeriodWritable = assertPeriodWritable;
const writeFinanceAuditLog = async (tenantId, actorId, action, details) => {
    await (0, exports.tenantCollectionRef)(tenantId, exports.FINANCE_COLLECTIONS.auditLog).add({
        tenantId,
        actorId,
        action,
        details,
        createdAt: (0, exports.serverTimestamp)(),
    });
};
exports.writeFinanceAuditLog = writeFinanceAuditLog;
//# sourceMappingURL=shared.js.map