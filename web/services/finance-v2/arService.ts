import { orderBy } from 'firebase/firestore';

import type {
    FinanceCustomer,
    FinanceInvoice,
    FinanceInvoiceLine,
} from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface UpsertFinanceCustomerInput {
    tenantId?: string;
    customerId?: string;
    customerNo?: string;
    name: string;
    email?: string;
    vatId?: string;
    paymentTermsDays?: number;
    defaultRevenueAccountId?: string;
    isActive?: boolean;
}

export interface CreateInvoiceInput {
    tenantId?: string;
    invoiceNo?: string;
    customerId: string;
    projectId?: string;
    issueDate: string;
    dueDate: string;
    currencyCode?: string;
    notes?: string;
    lines: Array<
        Pick<FinanceInvoiceLine, 'description' | 'quantity' | 'unitPrice' | 'accountId' | 'projectId' | 'taxCodeId' | 'taxRatePercent'>
    >;
}

export interface InvoiceActionInput {
    tenantId?: string;
    invoiceId: string;
    reason?: string;
}

export const subscribeFinanceCustomers = (
    callback: (rows: FinanceCustomer[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceCustomer>(
        FINANCE_V2_COLLECTIONS.customers,
        callback,
        tenantId,
        [orderBy('name', 'asc')]
    );
};

export const subscribeFinanceInvoices = (
    callback: (rows: FinanceInvoice[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceInvoice>(
        FINANCE_V2_COLLECTIONS.invoices,
        callback,
        tenantId,
        [orderBy('issueDate', 'desc'), orderBy('createdAt', 'desc')]
    );
};

export const upsertFinanceCustomer = async (input: UpsertFinanceCustomerInput) => {
    return callFinanceFunction('upsertFinanceCustomer', withTenant(input, input.tenantId));
};

export const createInvoice = async (input: CreateInvoiceInput) => {
    return callFinanceFunction('createInvoice', withTenant(input, input.tenantId));
};

export const issueInvoice = async (input: InvoiceActionInput) => {
    return callFinanceFunction('issueInvoice', withTenant(input, input.tenantId));
};

export const voidInvoice = async (input: InvoiceActionInput) => {
    return callFinanceFunction('voidInvoice', withTenant(input, input.tenantId));
};
