import { orderBy } from 'firebase/firestore';

import type {
    FinanceTaxCode,
    FinanceTaxPeriod,
    FinanceTaxReport,
} from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface UpsertFinanceTaxCodeInput {
    tenantId?: string;
    taxCodeId?: string;
    code: string;
    label: string;
    ratePercent: number;
    kind: 'output' | 'input' | 'none';
    datevKey?: string;
    isActive?: boolean;
}

export interface BuildTaxReportInput {
    tenantId?: string;
    periodKey: string;
}

export const subscribeFinanceTaxCodes = (
    callback: (rows: FinanceTaxCode[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceTaxCode>(
        FINANCE_V2_COLLECTIONS.taxCodes,
        callback,
        tenantId,
        [orderBy('code', 'asc')]
    );
};

export const subscribeFinanceTaxPeriods = (
    callback: (rows: FinanceTaxPeriod[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceTaxPeriod>(
        FINANCE_V2_COLLECTIONS.taxPeriods,
        callback,
        tenantId,
        [orderBy('periodKey', 'desc')]
    );
};

export const subscribeFinanceTaxReports = (
    callback: (rows: FinanceTaxReport[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceTaxReport>(
        FINANCE_V2_COLLECTIONS.taxReports,
        callback,
        tenantId,
        [orderBy('periodKey', 'desc')]
    );
};

export const upsertFinanceTaxCode = async (input: UpsertFinanceTaxCodeInput) => {
    return callFinanceFunction('upsertFinanceTaxCode', withTenant(input, input.tenantId));
};

export const buildTaxReport = async (input: BuildTaxReportInput) => {
    return callFinanceFunction('buildTaxReport', withTenant(input, input.tenantId));
};
