import type {
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
