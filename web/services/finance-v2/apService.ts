import { orderBy } from 'firebase/firestore';

import type {
    FinanceBill,
    FinanceBillLine,
    FinanceExtractedInvoiceDraft,
    FinanceVendor,
} from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface UpsertFinanceVendorInput {
    tenantId?: string;
    vendorId?: string;
    vendorNo?: string;
    name: string;
    email?: string;
    vatId?: string;
    paymentTermsDays?: number;
    defaultExpenseAccountId?: string;
    isActive?: boolean;
}

export interface CreateBillInput {
    tenantId?: string;
    billNo?: string;
    vendorId: string;
    projectId?: string;
    billDate: string;
    dueDate: string;
    currencyCode?: string;
    notes?: string;
    lines: Array<
        Pick<FinanceBillLine, 'description' | 'quantity' | 'unitCost' | 'accountId' | 'projectId' | 'taxCodeId' | 'taxRatePercent'>
    >;
}

export interface BillActionInput {
    tenantId?: string;
    billId: string;
    reason?: string;
}

export interface ExtractInvoiceFromDocumentInput {
    tenantId?: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
}

export const subscribeFinanceVendors = (
    callback: (rows: FinanceVendor[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceVendor>(
        FINANCE_V2_COLLECTIONS.vendors,
        callback,
        tenantId,
        [orderBy('name', 'asc')]
    );
};

export const subscribeFinanceBills = (
    callback: (rows: FinanceBill[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceBill>(
        FINANCE_V2_COLLECTIONS.bills,
        callback,
        tenantId,
        [orderBy('billDate', 'desc'), orderBy('createdAt', 'desc')]
    );
};

export const upsertFinanceVendor = async (input: UpsertFinanceVendorInput) => {
    return callFinanceFunction('upsertFinanceVendor', withTenant(input, input.tenantId));
};

export const createBill = async (input: CreateBillInput) => {
    return callFinanceFunction('createBill', withTenant(input, input.tenantId));
};

export const postBill = async (input: BillActionInput) => {
    return callFinanceFunction('postBill', withTenant(input, input.tenantId));
};

export const voidBill = async (input: BillActionInput) => {
    return callFinanceFunction('voidBill', withTenant(input, input.tenantId));
};

export const extractInvoiceFromDocument = async (
    input: ExtractInvoiceFromDocumentInput
) => {
    return callFinanceFunction<
        ExtractInvoiceFromDocumentInput & { tenantId: string },
        FinanceExtractedInvoiceDraft
    >('extractInvoiceFromDocument', withTenant(input, input.tenantId));
};
