import {
    collection,
    onSnapshot,
    orderBy,
    query,
    type DocumentData,
    type QueryConstraint,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';
import { resolveTenantId } from '../dataService';

export const TENANTS_COLLECTION = 'tenants';

export const FINANCE_V2_COLLECTIONS = {
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
} as const;

export type FinanceV2CollectionKey = keyof typeof FINANCE_V2_COLLECTIONS;

export const resolveFinanceTenantId = (tenantId?: string) => resolveTenantId(tenantId);

const tenantCollection = (tenantId: string, collectionName: string) =>
    collection(db, TENANTS_COLLECTION, tenantId, collectionName);

export const subscribeTenantFinanceCollection = <T extends DocumentData>(
    collectionName: string,
    callback: (rows: T[]) => void,
    tenantId?: string,
    constraints: QueryConstraint[] = [orderBy('updatedAt', 'desc')]
) => {
    const resolvedTenant = resolveFinanceTenantId(tenantId);
    const ref = tenantCollection(resolvedTenant, collectionName);
    const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref);

    return onSnapshot(q, (snapshot) => {
        const rows = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
        })) as T[];

        callback(rows);
    });
};

export const callFinanceFunction = async <TData = unknown, TResult = unknown>(
    functionName: string,
    payload: TData
): Promise<TResult> => {
    const callable = httpsCallable<TData, TResult>(functions, functionName);
    const response = await callable(payload);
    return response.data;
};

export const withTenant = <T extends Record<string, unknown>>(payload: T, tenantId?: string) => ({
    ...payload,
    tenantId: resolveFinanceTenantId(tenantId),
});
