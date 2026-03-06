import { orderBy } from 'firebase/firestore';

import type {
    FinanceAccount,
    FinanceFiscalYear,
    FinancePeriod,
    FinanceV2Settings,
} from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface UpsertFinanceAccountInput {
    tenantId?: string;
    accountId?: string;
    accountNo: string;
    name: string;
    category: FinanceAccount['category'];
    normalBalance: FinanceAccount['normalBalance'];
    datevAccountNo?: string;
    taxCodeId?: string;
    isActive?: boolean;
    allowManualPosting?: boolean;
    notes?: string;
}

export interface UpsertFinancePeriodInput {
    tenantId?: string;
    periodKey: string;
    fiscalYearId: string;
    status: FinancePeriod['status'];
    startDate: string;
    endDate: string;
    notes?: string;
}

export interface UpsertFinanceSettingsInput {
    tenantId?: string;
    settings: Partial<FinanceV2Settings>;
}

export const subscribeFinanceAccounts = (
    callback: (rows: FinanceAccount[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceAccount>(
        FINANCE_V2_COLLECTIONS.accounts,
        callback,
        tenantId,
        [orderBy('accountNo', 'asc')]
    );
};

export const subscribeFinanceFiscalYears = (
    callback: (rows: FinanceFiscalYear[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceFiscalYear>(
        FINANCE_V2_COLLECTIONS.fiscalYears,
        callback,
        tenantId,
        [orderBy('year', 'desc')]
    );
};

export const subscribeFinancePeriods = (
    callback: (rows: FinancePeriod[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinancePeriod>(
        FINANCE_V2_COLLECTIONS.periods,
        callback,
        tenantId,
        [orderBy('monthKey', 'desc')]
    );
};

export const upsertFinanceAccount = async (input: UpsertFinanceAccountInput) => {
    return callFinanceFunction('upsertFinanceAccount', withTenant(input, input.tenantId));
};

export const upsertFinancePeriod = async (input: UpsertFinancePeriodInput) => {
    return callFinanceFunction('upsertFinancePeriod', withTenant(input, input.tenantId));
};

export const upsertFinanceSettings = async (input: UpsertFinanceSettingsInput) => {
    return callFinanceFunction('upsertFinanceSettings', withTenant(input, input.tenantId));
};
