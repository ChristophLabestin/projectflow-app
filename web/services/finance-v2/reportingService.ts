import type {
    FinanceProjectProfitabilityRow,
    FinanceReportBundle,
} from '../../types';
import { callFinanceFunction, withTenant } from './common';

export interface BuildFinancialReportsInput {
    tenantId?: string;
    periodKeyFrom?: string;
    periodKeyTo?: string;
    includeProjectProfitability?: boolean;
}

export interface BuildFinancialReportsResponse extends FinanceReportBundle {
    generatedAt: string;
}

export const buildFinancialReports = async (input: BuildFinancialReportsInput) => {
    return callFinanceFunction<
        BuildFinancialReportsInput & { tenantId: string },
        BuildFinancialReportsResponse
    >('buildFinancialReports', withTenant(input, input.tenantId));
};

export const getTopProjectProfitabilityRows = (
    report: BuildFinancialReportsResponse | null,
    limit = 10
): FinanceProjectProfitabilityRow[] => {
    if (!report?.projectProfitability) return [];

    return [...report.projectProfitability]
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, Math.max(0, limit));
};
