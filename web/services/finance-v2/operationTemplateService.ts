import { orderBy } from 'firebase/firestore';

import type { FinanceOperationTemplate } from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface UpsertFinanceOperationTemplateInput {
    tenantId?: string;
    templateId?: string;
    template: Omit<FinanceOperationTemplate, 'id' | 'tenantId' | 'createdBy' | 'createdAt' | 'updatedAt'>;
}

export interface DeleteFinanceOperationTemplateInput {
    tenantId?: string;
    templateId: string;
}

export const subscribeFinanceOperationTemplates = (
    callback: (rows: FinanceOperationTemplate[]) => void,
    tenantId?: string,
) => {
    return subscribeTenantFinanceCollection<FinanceOperationTemplate>(
        FINANCE_V2_COLLECTIONS.operationTemplates,
        callback,
        tenantId,
        [orderBy('updatedAt', 'desc')],
    );
};

export const upsertFinanceOperationTemplate = async (input: UpsertFinanceOperationTemplateInput) => {
    return callFinanceFunction('upsertFinanceOperationTemplate', withTenant(input, input.tenantId));
};

export const deleteFinanceOperationTemplate = async (input: DeleteFinanceOperationTemplateInput) => {
    return callFinanceFunction('deleteFinanceOperationTemplate', withTenant(input, input.tenantId));
};
