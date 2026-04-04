import { orderBy, where } from 'firebase/firestore';

import type {
    FinanceDocument,
    FinanceDocumentVersion,
} from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface UploadFinanceDocumentInput {
    tenantId?: string;
    title?: string;
    documentType?: 'pdf' | 'xml' | 'other';
    projectId?: string;
    linkedEntityType?: string;
    linkedEntityId?: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
}

export interface VersionFinanceDocumentInput {
    tenantId?: string;
    documentId: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
}

export interface LinkFinanceDocumentInput {
    tenantId?: string;
    documentId: string;
    linkedEntityType: string;
    linkedEntityId: string;
    projectId?: string;
}

export interface DeleteFinanceDocumentInput {
    tenantId?: string;
    documentId: string;
    mode?: 'soft' | 'hard';
}

export interface ConfirmExtractedInvoiceDraftInput {
    tenantId?: string;
    documentId?: string;
    documentVersionId?: string;
    cadence: 'single' | 'recurring';
    recurringFrequency?: 'weekly' | 'monthly' | 'yearly';
    recurringEndDate?: string;
    vendorId?: string;
    vendorName?: string;
    vendorEmail?: string;
    vendorVatId?: string;
    billNo?: string;
    billDate: string;
    dueDate: string;
    projectId?: string;
    currencyCode?: string;
    lineDescription: string;
    quantity: number;
    unitCost: number;
    taxRatePercent?: number;
    notes?: string;
    autoPost?: boolean;
}

export const subscribeFinanceDocuments = (
    callback: (rows: FinanceDocument[]) => void,
    tenantId?: string,
) => {
    return subscribeTenantFinanceCollection<FinanceDocument>(
        FINANCE_V2_COLLECTIONS.documents,
        callback,
        tenantId,
        [orderBy('updatedAt', 'desc')],
    );
};

export const subscribeFinanceDocumentVersions = (
    documentId: string,
    callback: (rows: FinanceDocumentVersion[]) => void,
    tenantId?: string,
) => {
    return subscribeTenantFinanceCollection<FinanceDocumentVersion>(
        FINANCE_V2_COLLECTIONS.documentVersions,
        callback,
        tenantId,
        [where('documentId', '==', documentId), orderBy('versionNo', 'desc')],
    );
};

export const uploadFinanceDocument = async (input: UploadFinanceDocumentInput) => {
    return callFinanceFunction('uploadFinanceDocument', withTenant(input, input.tenantId));
};

export const versionFinanceDocument = async (input: VersionFinanceDocumentInput) => {
    return callFinanceFunction('versionFinanceDocument', withTenant(input, input.tenantId));
};

export const linkFinanceDocumentToEntity = async (input: LinkFinanceDocumentInput) => {
    return callFinanceFunction('linkFinanceDocumentToEntity', withTenant(input, input.tenantId));
};

export const deleteFinanceDocument = async (input: DeleteFinanceDocumentInput) => {
    return callFinanceFunction('deleteFinanceDocument', withTenant(input, input.tenantId));
};

export const confirmExtractedInvoiceDraft = async (input: ConfirmExtractedInvoiceDraftInput) => {
    return callFinanceFunction('confirmExtractedInvoiceDraft', withTenant(input, input.tenantId));
};
