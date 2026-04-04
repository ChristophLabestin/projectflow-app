import { orderBy } from 'firebase/firestore';

import type { FinanceAllocationRule } from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface UpsertFinanceAllocationRuleInput {
    tenantId?: string;
    ruleId?: string;
    rule: Omit<FinanceAllocationRule, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'>;
}

export const subscribeFinanceAllocationRules = (
    callback: (rows: FinanceAllocationRule[]) => void,
    tenantId?: string,
) => {
    return subscribeTenantFinanceCollection<FinanceAllocationRule>(
        FINANCE_V2_COLLECTIONS.allocationRules,
        callback,
        tenantId,
        [orderBy('updatedAt', 'desc')],
    );
};

export const upsertFinanceAllocationRule = async (input: UpsertFinanceAllocationRuleInput) => {
    return callFinanceFunction('upsertFinanceAllocationRule', withTenant(input, input.tenantId));
};
