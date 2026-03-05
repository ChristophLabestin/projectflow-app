import type { FinanceCostItem, FinanceScenario, FinanceScenarioResult } from '../types';

interface FinanceCalculationInput {
    plannedUnits: number;
    pricePerUnit: number;
    tokenQuotaPerUnit?: number;
    discountPercent?: number;
    salesCommissionPercent?: number;
    targetProfitPercentOnCost: number;
    fixedCostItems: FinanceCostItem[];
    variableCostItemsPerUnit: FinanceCostItem[];
}

const toFiniteNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const toNonNegative = (value: unknown) => Math.max(0, toFiniteNumber(value));

export const resolveFinanceCostItemAmount = (item: FinanceCostItem) => {
    const quantityPerUnit = toNonNegative(item.quantityPerUnit ?? 0);
    const unitCost = toNonNegative(item.unitCost ?? 0);

    if (quantityPerUnit > 0 && unitCost > 0) {
        return quantityPerUnit * unitCost;
    }

    return toNonNegative(item.amount);
};

export const resolveFinanceCostItemTokens = (item: FinanceCostItem) => {
    const quantityPerUnit = toNonNegative(item.quantityPerUnit ?? 0);
    const tokensPerUsage = toNonNegative(item.tokensPerUsage ?? 0);

    if (quantityPerUnit > 0 && tokensPerUsage > 0) {
        return quantityPerUnit * tokensPerUsage;
    }

    return 0;
};

const sumCostItems = (items: FinanceCostItem[]) => {
    return items.reduce((sum, item) => sum + resolveFinanceCostItemAmount(item), 0);
};

const sumTokenItems = (items: FinanceCostItem[]) => {
    return items.reduce((sum, item) => sum + resolveFinanceCostItemTokens(item), 0);
};

export const calculateFinanceScenarioResult = (
    input: FinanceCalculationInput | FinanceScenario
): FinanceScenarioResult => {
    const plannedUnitsRaw = toFiniteNumber(input.plannedUnits);
    const plannedUnits = plannedUnitsRaw > 0 ? plannedUnitsRaw : 0;

    const fixedCostsTotal = sumCostItems(input.fixedCostItems || []);
    const variableCostPerUnit = sumCostItems(input.variableCostItemsPerUnit || []);
    const tokensUsedPerUnit = sumTokenItems(input.variableCostItemsPerUnit || []);
    const pricePerUnit = toNonNegative(input.pricePerUnit);
    const tokenQuotaPerUnit = toNonNegative(input.tokenQuotaPerUnit ?? 0);
    const discountPercent = toNonNegative(input.discountPercent ?? 0);
    const salesCommissionPercent = toNonNegative(input.salesCommissionPercent ?? 0);
    const targetProfitPercentOnCost = toNonNegative(input.targetProfitPercentOnCost);

    const discountFactor = Math.max(0, 1 - (discountPercent / 100));
    const commissionFactor = Math.max(0, 1 - (salesCommissionPercent / 100));
    const retentionFactor = discountFactor * commissionFactor;

    const variableCostsTotal = variableCostPerUnit * plannedUnits;
    const tokensUsedTotal = tokensUsedPerUnit * plannedUnits;
    const tokenQuotaTotal = tokenQuotaPerUnit * plannedUnits;
    const isTokenQuotaExceededPerUnit = tokenQuotaPerUnit > 0
        ? tokensUsedPerUnit > tokenQuotaPerUnit
        : false;
    const isTokenQuotaExceededTotal = tokenQuotaTotal > 0
        ? tokensUsedTotal > tokenQuotaTotal
        : false;
    const tokensRemainingPerUnit = tokenQuotaPerUnit - tokensUsedPerUnit;
    const tokensRemainingTotal = tokenQuotaTotal - tokensUsedTotal;
    const totalCosts = fixedCostsTotal + variableCostsTotal;
    const totalCostPerUnit = plannedUnits > 0
        ? variableCostPerUnit + (fixedCostsTotal / plannedUnits)
        : 0;

    const revenuePerUnit = pricePerUnit; // Offer price (gross)
    const revenueTotal = revenuePerUnit * plannedUnits;
    const netRevenuePerUnit = revenuePerUnit * retentionFactor;
    const netRevenueTotal = netRevenuePerUnit * plannedUnits;
    const operatingProfitTotal = netRevenueTotal - totalCosts;
    const profitPercentOnCost = totalCosts > 0
        ? (operatingProfitTotal / totalCosts) * 100
        : 0;

    const requiredNetRevenuePerUnit = totalCostPerUnit * (1 + (targetProfitPercentOnCost / 100));
    const suggestedPricePerUnit = retentionFactor > 0
        ? requiredNetRevenuePerUnit / retentionFactor
        : 0;

    const contributionPerUnit = netRevenuePerUnit - variableCostPerUnit;
    const contributionTotal = contributionPerUnit * plannedUnits;
    const contributionMarginPercent = netRevenuePerUnit > 0
        ? (contributionPerUnit / netRevenuePerUnit) * 100
        : 0;

    const breakEvenUnits = contributionPerUnit > 0
        ? Math.ceil(fixedCostsTotal / contributionPerUnit)
        : null;
    const breakEvenRevenue = breakEvenUnits !== null
        ? breakEvenUnits * pricePerUnit
        : null;

    return {
        fixedCostsTotal,
        variableCostPerUnit,
        variableCostsTotal,
        tokenQuotaPerUnit,
        tokenQuotaTotal,
        tokensUsedPerUnit,
        tokensUsedTotal,
        tokensRemainingPerUnit,
        tokensRemainingTotal,
        isTokenQuotaExceededPerUnit,
        isTokenQuotaExceededTotal,
        totalCostPerUnit,
        totalCosts,
        netRevenuePerUnit,
        netRevenueTotal,
        revenuePerUnit,
        revenueTotal,
        contributionPerUnit,
        contributionTotal,
        contributionMarginPercent,
        operatingProfitTotal,
        profitPercentOnCost,
        suggestedPricePerUnit,
        breakEvenUnits,
        breakEvenRevenue,
        hasBreakEven: breakEvenUnits !== null,
    };
};

export const createEmptyFinanceCostItem = (overrides?: Partial<FinanceCostItem>): FinanceCostItem => {
    const fallbackId = `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
        id: overrides?.id || fallbackId,
        label: overrides?.label || '',
        amount: toNonNegative(overrides?.amount ?? 0),
        quantityPerUnit: toNonNegative(overrides?.quantityPerUnit ?? 0),
        unitCost: toNonNegative(overrides?.unitCost ?? 0),
        tokensPerUsage: toNonNegative(overrides?.tokensPerUsage ?? 0),
    };
};

export const createDefaultFinanceScenarioDraft = () => {
    return {
        projectId: '',
        name: '',
        preset: 'software' as const,
        period: 'monthly' as const,
        unitLabel: 'User',
        plannedUnits: 100,
        pricePerUnit: 0,
        tokenQuotaPerUnit: 0,
        discountPercent: 0,
        salesCommissionPercent: 0,
        targetProfitPercentOnCost: 20,
        fixedCostItems: [
            createEmptyFinanceCostItem({ label: 'Infrastructure', amount: 0 }),
        ],
        variableCostItemsPerUnit: [
            createEmptyFinanceCostItem({ label: 'Support pro User', amount: 0 }),
        ],
        notes: '',
    };
};

export const sanitizeFinanceCostItems = (items: FinanceCostItem[]) => {
    return (items || [])
        .map((item) => ({
            id: item.id || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            label: (item.label || '').trim(),
            amount: toNonNegative(item.amount),
            quantityPerUnit: toNonNegative(item.quantityPerUnit ?? 0),
            unitCost: toNonNegative(item.unitCost ?? 0),
            tokensPerUsage: toNonNegative(item.tokensPerUsage ?? 0),
        }))
        .filter((item) => (
            item.label.length > 0 ||
            item.amount > 0 ||
            item.quantityPerUnit > 0 ||
            item.unitCost > 0 ||
            item.tokensPerUsage > 0
        ));
};
