import { orderBy } from 'firebase/firestore';

import type {
    FinanceScenario,
    FinanceScenarioResult,
} from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface UpsertScenarioInput {
    tenantId?: string;
    scenarioId?: string;
    scenario: Omit<FinanceScenario, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>;
}

export interface CalculateScenarioSnapshotInput {
    tenantId?: string;
    scenario: Omit<FinanceScenario, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>;
}

export interface CalculateScenarioSnapshotResponse {
    result: FinanceScenarioResult;
}

export const subscribeFinanceScenariosV2 = (
    callback: (rows: FinanceScenario[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceScenario>(
        FINANCE_V2_COLLECTIONS.scenarios,
        callback,
        tenantId,
        [orderBy('updatedAt', 'desc')]
    );
};

export const upsertScenario = async (input: UpsertScenarioInput) => {
    return callFinanceFunction('upsertScenario', withTenant(input, input.tenantId));
};

export const calculateScenarioSnapshot = async (input: CalculateScenarioSnapshotInput) => {
    return callFinanceFunction<
        CalculateScenarioSnapshotInput & { tenantId: string },
        CalculateScenarioSnapshotResponse
    >('calculateScenarioSnapshot', withTenant(input, input.tenantId));
};
