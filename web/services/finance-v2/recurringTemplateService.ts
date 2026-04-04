import { orderBy } from 'firebase/firestore';

import type { FinanceRecurringTemplate } from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface UpsertRecurringTemplateInput {
    tenantId?: string;
    templateId?: string;
    template: Omit<FinanceRecurringTemplate, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'>;
}

export interface DeleteRecurringTemplateInput {
    tenantId?: string;
    templateId: string;
}

export const subscribeFinanceRecurringTemplates = (
    callback: (rows: FinanceRecurringTemplate[]) => void,
    tenantId?: string,
) => {
    return subscribeTenantFinanceCollection<FinanceRecurringTemplate>(
        FINANCE_V2_COLLECTIONS.recurringTemplates,
        callback,
        tenantId,
        [orderBy('updatedAt', 'desc')],
    );
};

export const upsertFinanceRecurringTemplate = async (input: UpsertRecurringTemplateInput) => {
    return callFinanceFunction('upsertFinanceRecurringTemplate', withTenant(input, input.tenantId));
};

export const deleteFinanceRecurringTemplate = async (input: DeleteRecurringTemplateInput) => {
    return callFinanceFunction('deleteFinanceRecurringTemplate', withTenant(input, input.tenantId));
};
