import { orderBy } from 'firebase/firestore';

import type {
    FinanceBankAccount,
    FinanceBankTransaction,
    FinanceReconciliation,
} from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface ImportBankStatementInput {
    tenantId?: string;
    bankAccountId?: string;
    transactions: Array<{
        bookingDate: string;
        valueDate?: string;
        amount: number;
        currencyCode?: string;
        description?: string;
        counterparty?: string;
        externalReference?: string;
        projectId?: string;
    }>;
}

export interface ReconciliationSuggestInput {
    tenantId?: string;
    bankAccountId?: string;
    periodKey?: string;
}

export interface ConfirmReconciliationInput {
    tenantId?: string;
    bankAccountId?: string;
    periodKey: string;
    matchedTransactionIds: string[];
    matchedItems?: Array<{
        bankTransactionId: string;
        targetType?: 'invoice' | 'bill' | null;
        targetId?: string | null;
        confidence?: number;
        rationale?: string;
    }>;
    unmatchedTransactionIds?: string[];
    notes?: string;
}

export const subscribeFinanceBankAccounts = (
    callback: (rows: FinanceBankAccount[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceBankAccount>(
        FINANCE_V2_COLLECTIONS.bankAccounts,
        callback,
        tenantId,
        [orderBy('name', 'asc')]
    );
};

export const subscribeFinanceBankTransactions = (
    callback: (rows: FinanceBankTransaction[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceBankTransaction>(
        FINANCE_V2_COLLECTIONS.bankTransactions,
        callback,
        tenantId,
        [orderBy('bookingDate', 'desc'), orderBy('createdAt', 'desc')]
    );
};

export const subscribeFinanceReconciliations = (
    callback: (rows: FinanceReconciliation[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceReconciliation>(
        FINANCE_V2_COLLECTIONS.reconciliations,
        callback,
        tenantId,
        [orderBy('periodKey', 'desc'), orderBy('createdAt', 'desc')]
    );
};

export const importBankStatement = async (input: ImportBankStatementInput) => {
    return callFinanceFunction('importBankStatement', withTenant(input, input.tenantId));
};

export const suggestReconciliation = async (input: ReconciliationSuggestInput) => {
    return callFinanceFunction('suggestReconciliation', withTenant(input, input.tenantId));
};

export const confirmReconciliation = async (input: ConfirmReconciliationInput) => {
    return callFinanceFunction('confirmReconciliation', withTenant(input, input.tenantId));
};
