import { toNonNegative } from './shared';

type FinanceCostItemLike = {
    amount?: unknown;
    quantityPerUnit?: unknown;
    unitCost?: unknown;
    tokensPerUsage?: unknown;
};

type ScenarioLike = {
    plannedUnits?: unknown;
    pricePerUnit?: unknown;
    tokenQuotaPerUnit?: unknown;
    discountPercent?: unknown;
    salesCommissionPercent?: unknown;
    targetProfitPercentOnCost?: unknown;
    fixedCostItems?: FinanceCostItemLike[];
    variableCostItemsPerUnit?: FinanceCostItemLike[];
};

const resolveCostAmount = (item: FinanceCostItemLike) => {
    const quantityPerUnit = toNonNegative(item.quantityPerUnit);
    const unitCost = toNonNegative(item.unitCost);

    if (quantityPerUnit > 0 && unitCost > 0) {
        return quantityPerUnit * unitCost;
    }

    return toNonNegative(item.amount);
};

const resolveCostTokens = (item: FinanceCostItemLike) => {
    const quantityPerUnit = toNonNegative(item.quantityPerUnit);
    const tokensPerUsage = toNonNegative(item.tokensPerUsage);

    if (quantityPerUnit > 0 && tokensPerUsage > 0) {
        return quantityPerUnit * tokensPerUsage;
    }

    return 0;
};

const sumAmounts = (items: FinanceCostItemLike[]) =>
    items.reduce((sum, item) => sum + resolveCostAmount(item), 0);

const sumTokens = (items: FinanceCostItemLike[]) =>
    items.reduce((sum, item) => sum + resolveCostTokens(item), 0);

export const calculateScenarioSnapshotFromInput = (scenario: ScenarioLike) => {
    const plannedUnitsRaw = toNonNegative(scenario.plannedUnits);
    const plannedUnits = plannedUnitsRaw > 0 ? plannedUnitsRaw : 0;

    const fixedCostsTotal = sumAmounts(scenario.fixedCostItems || []);
    const variableCostPerUnit = sumAmounts(scenario.variableCostItemsPerUnit || []);
    const tokensUsedPerUnit = sumTokens(scenario.variableCostItemsPerUnit || []);

    const pricePerUnit = toNonNegative(scenario.pricePerUnit);
    const tokenQuotaPerUnit = toNonNegative(scenario.tokenQuotaPerUnit);
    const discountPercent = toNonNegative(scenario.discountPercent);
    const salesCommissionPercent = toNonNegative(scenario.salesCommissionPercent);
    const targetProfitPercentOnCost = toNonNegative(scenario.targetProfitPercentOnCost);

    const discountFactor = Math.max(0, 1 - (discountPercent / 100));
    const commissionFactor = Math.max(0, 1 - (salesCommissionPercent / 100));
    const retentionFactor = discountFactor * commissionFactor;

    const variableCostsTotal = variableCostPerUnit * plannedUnits;
    const totalCosts = fixedCostsTotal + variableCostsTotal;
    const totalCostPerUnit = plannedUnits > 0
        ? variableCostPerUnit + (fixedCostsTotal / plannedUnits)
        : 0;

    const revenuePerUnit = pricePerUnit;
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

    const tokensUsedTotal = tokensUsedPerUnit * plannedUnits;
    const tokenQuotaTotal = tokenQuotaPerUnit * plannedUnits;

    return {
        fixedCostsTotal,
        variableCostPerUnit,
        variableCostsTotal,
        tokenQuotaPerUnit,
        tokenQuotaTotal,
        tokensUsedPerUnit,
        tokensUsedTotal,
        tokensRemainingPerUnit: tokenQuotaPerUnit - tokensUsedPerUnit,
        tokensRemainingTotal: tokenQuotaTotal - tokensUsedTotal,
        isTokenQuotaExceededPerUnit: tokenQuotaPerUnit > 0 ? tokensUsedPerUnit > tokenQuotaPerUnit : false,
        isTokenQuotaExceededTotal: tokenQuotaTotal > 0 ? tokensUsedTotal > tokenQuotaTotal : false,
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
