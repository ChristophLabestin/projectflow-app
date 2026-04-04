import { orderBy } from 'firebase/firestore';

import type {
    FinanceOperationApproval,
    FinanceOperationPreview,
    FinanceOperationRecommendation,
    FinanceOperationRun,
    FinanceOperationType,
} from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface PreviewFinanceOperationInput {
    tenantId?: string;
    operationType: FinanceOperationType;
    payload?: Record<string, unknown>;
}

export interface ExecuteFinanceOperationInput {
    tenantId?: string;
    operationType: FinanceOperationType;
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
    confirm?: boolean;
    runId?: string;
}

export interface ExecuteFinanceOperationResponse {
    runId: string;
    status: FinanceOperationRun['status'];
    requiresConfirmation?: boolean;
}

export interface GetFinanceOperationRunInput {
    tenantId?: string;
    runId: string;
}

export interface ListFinanceOperationRunsInput {
    tenantId?: string;
    operationType?: FinanceOperationType;
    status?: FinanceOperationRun['status'];
    limit?: number;
}

export interface RetryFinanceOperationRunInput {
    tenantId?: string;
    runId: string;
    confirm?: boolean;
}

export const subscribeFinanceOperationRuns = (
    callback: (rows: FinanceOperationRun[]) => void,
    tenantId?: string,
) => {
    return subscribeTenantFinanceCollection<FinanceOperationRun>(
        FINANCE_V2_COLLECTIONS.operationRuns,
        callback,
        tenantId,
        [orderBy('createdAt', 'desc')],
    );
};

export const subscribeFinanceOperationApprovals = (
    callback: (rows: FinanceOperationApproval[]) => void,
    tenantId?: string,
) => {
    return subscribeTenantFinanceCollection<FinanceOperationApproval>(
        FINANCE_V2_COLLECTIONS.operationApprovals,
        callback,
        tenantId,
        [orderBy('createdAt', 'desc')],
    );
};

export const previewFinanceOperation = async (input: PreviewFinanceOperationInput) => {
    return callFinanceFunction<
        PreviewFinanceOperationInput & { tenantId: string },
        FinanceOperationPreview
    >('previewFinanceOperation', withTenant(input, input.tenantId));
};

export const executeFinanceOperation = async (input: ExecuteFinanceOperationInput) => {
    return callFinanceFunction<
        ExecuteFinanceOperationInput & { tenantId: string },
        ExecuteFinanceOperationResponse
    >('executeFinanceOperation', withTenant(input, input.tenantId));
};

export const getFinanceOperationRun = async (input: GetFinanceOperationRunInput) => {
    return callFinanceFunction<
        GetFinanceOperationRunInput & { tenantId: string },
        { run: FinanceOperationRun | null }
    >('getFinanceOperationRun', withTenant(input, input.tenantId));
};

export const listFinanceOperationRuns = async (input: ListFinanceOperationRunsInput = {}) => {
    return callFinanceFunction<
        ListFinanceOperationRunsInput & { tenantId: string },
        { runs: FinanceOperationRun[] }
    >('listFinanceOperationRuns', withTenant(input, input.tenantId));
};

export const retryFinanceOperationRun = async (input: RetryFinanceOperationRunInput) => {
    return callFinanceFunction<
        RetryFinanceOperationRunInput & { tenantId: string },
        ExecuteFinanceOperationResponse
    >('retryFinanceOperationRun', withTenant(input, input.tenantId));
};

export const recommendFinanceOperations = async (input: { tenantId?: string } = {}) => {
    return callFinanceFunction<
        { tenantId: string },
        { recommendations: FinanceOperationRecommendation[] }
    >('recommendFinanceOperations', withTenant(input, input.tenantId));
};
