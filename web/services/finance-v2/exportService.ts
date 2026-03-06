import { orderBy } from 'firebase/firestore';

import type { FinanceExportJob } from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface GenerateDatevExportInput {
    tenantId?: string;
    periodKey: string;
}

export interface GenerateDatevExportResponse {
    exportJobId: string;
    status: FinanceExportJob['status'];
}

export interface RunMonthlyCloseInput {
    tenantId?: string;
    periodKey: string;
    notes?: string;
}

export interface ReopenPeriodInput {
    tenantId?: string;
    periodKey: string;
    reason?: string;
}

export const subscribeFinanceExportJobs = (
    callback: (rows: FinanceExportJob[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceExportJob>(
        FINANCE_V2_COLLECTIONS.exports,
        callback,
        tenantId,
        [orderBy('createdAt', 'desc')]
    );
};

export const generateDatevExport = async (input: GenerateDatevExportInput) => {
    return callFinanceFunction<
        GenerateDatevExportInput & { tenantId: string },
        GenerateDatevExportResponse
    >('generateDatevExport', withTenant(input, input.tenantId));
};

export const runMonthlyClose = async (input: RunMonthlyCloseInput) => {
    return callFinanceFunction('runMonthlyClose', withTenant(input, input.tenantId));
};

export const reopenPeriod = async (input: ReopenPeriodInput) => {
    return callFinanceFunction('reopenPeriod', withTenant(input, input.tenantId));
};
