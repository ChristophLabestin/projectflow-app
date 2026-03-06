import { orderBy, where } from 'firebase/firestore';

import type {
    FinanceJournalEntry,
    FinanceJournalLine,
    FinanceJournalSourceType,
} from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface PostJournalEntryLineInput {
    accountId: string;
    debit?: number;
    credit?: number;
    description?: string;
    taxCodeId?: string;
    projectId?: string;
    customerId?: string;
    vendorId?: string;
}

export interface PostJournalEntryInput {
    tenantId?: string;
    postingDate: string;
    description: string;
    sourceType?: FinanceJournalSourceType;
    sourceId?: string;
    sourceRefNo?: string;
    projectId?: string;
    currencyCode?: string;
    idempotencyKey?: string;
    lines: PostJournalEntryLineInput[];
}

export interface PostJournalEntryResponse {
    entryId: string;
    idempotentReplay?: boolean;
}

export const subscribeJournalEntries = (
    callback: (entries: FinanceJournalEntry[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceJournalEntry>(
        FINANCE_V2_COLLECTIONS.journalEntries,
        callback,
        tenantId,
        [orderBy('postingDate', 'desc'), orderBy('createdAt', 'desc')]
    );
};

export const subscribeJournalLinesByEntry = (
    entryId: string,
    callback: (lines: FinanceJournalLine[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceJournalLine>(
        FINANCE_V2_COLLECTIONS.journalLines,
        callback,
        tenantId,
        [where('entryId', '==', entryId), orderBy('lineNo', 'asc')]
    );
};

export const postJournalEntry = async (input: PostJournalEntryInput) => {
    return callFinanceFunction<
        PostJournalEntryInput & { tenantId: string },
        PostJournalEntryResponse
    >('postJournalEntry', withTenant(input, input.tenantId));
};
