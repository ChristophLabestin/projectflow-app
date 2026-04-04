import { orderBy } from 'firebase/firestore';

import type {
    FinanceSyncConnection,
    FinanceSyncRun,
} from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface UpsertFinanceSyncConnectionInput {
    tenantId?: string;
    connectionId?: string;
    connection: Omit<FinanceSyncConnection, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'>;
}

export interface RunFinanceSyncInput {
    tenantId?: string;
    connectionId: string;
    mode?: 'full' | 'delta';
    idempotencyKey?: string;
}

export const subscribeFinanceSyncConnections = (
    callback: (rows: FinanceSyncConnection[]) => void,
    tenantId?: string,
) => {
    return subscribeTenantFinanceCollection<FinanceSyncConnection>(
        FINANCE_V2_COLLECTIONS.syncConnections,
        callback,
        tenantId,
        [orderBy('updatedAt', 'desc')],
    );
};

export const subscribeFinanceSyncRuns = (
    callback: (rows: FinanceSyncRun[]) => void,
    tenantId?: string,
) => {
    return subscribeTenantFinanceCollection<FinanceSyncRun>(
        FINANCE_V2_COLLECTIONS.syncRuns,
        callback,
        tenantId,
        [orderBy('createdAt', 'desc')],
    );
};

export const upsertFinanceSyncConnection = async (input: UpsertFinanceSyncConnectionInput) => {
    return callFinanceFunction('upsertFinanceSyncConnection', withTenant(input, input.tenantId));
};

export const runFinanceSync = async (input: RunFinanceSyncInput) => {
    return callFinanceFunction('runFinanceSync', withTenant(input, input.tenantId));
};
