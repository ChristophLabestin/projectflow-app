import { callFinanceFunction, withTenant } from './common';

export interface RunLegacyFinanceMigrationInput {
    tenantId?: string;
    dryRun?: boolean;
}

export interface RunLegacyFinanceMigrationSummary {
    dryRun: boolean;
    transactions: {
        total: number;
        migrated: number;
        skipped: number;
        incomeTotal: number;
        expenseTotal: number;
    };
    recurring: {
        total: number;
        migrated: number;
        skipped: number;
    };
    scenarios: {
        total: number;
        migrated: number;
        skipped: number;
    };
}

export const migrateLegacyFinanceV1ToV2 = async (input: RunLegacyFinanceMigrationInput) => {
    return callFinanceFunction<
        RunLegacyFinanceMigrationInput & { tenantId: string },
        RunLegacyFinanceMigrationSummary
    >('migrateLegacyFinanceV1ToV2', withTenant({ dryRun: input.dryRun ?? true }, input.tenantId));
};
