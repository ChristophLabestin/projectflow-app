import { describe, expect, it } from 'vitest';
import { calculateFinanceScenarioResult } from '../../utils/finance-calculations';

const baseInput = {
    plannedUnits: 100,
    pricePerUnit: 15,
    targetProfitPercentOnCost: 20,
    fixedCostItems: [
        { id: 'f1', label: 'Infra', amount: 500 },
    ],
    variableCostItemsPerUnit: [
        { id: 'v1', label: 'Support', amount: 3 },
    ],
};

describe('finance calculations', () => {
    it('calculates unit economics including fixed-cost allocation', () => {
        const result = calculateFinanceScenarioResult(baseInput);

        expect(result.fixedCostsTotal).toBe(500);
        expect(result.variableCostPerUnit).toBe(3);
        expect(result.totalCostPerUnit).toBe(8);
    });

    it('scales total values with planned units', () => {
        const result = calculateFinanceScenarioResult(baseInput);

        expect(result.variableCostsTotal).toBe(300);
        expect(result.totalCosts).toBe(800);
        expect(result.revenueTotal).toBe(1500);
    });

    it('calculates suggested price from target profit on cost', () => {
        const result = calculateFinanceScenarioResult(baseInput);
        expect(result.suggestedPricePerUnit).toBeCloseTo(9.6, 5);
    });

    it('calculates positive contribution margin and break-even', () => {
        const result = calculateFinanceScenarioResult(baseInput);

        expect(result.contributionPerUnit).toBe(12);
        expect(result.contributionTotal).toBe(1200);
        expect(result.contributionMarginPercent).toBeCloseTo(80, 5);
        expect(result.breakEvenUnits).toBe(42);
        expect(result.breakEvenRevenue).toBe(630);
        expect(result.hasBreakEven).toBe(true);
    });

    it('returns no break-even when contribution per unit is zero or negative', () => {
        const result = calculateFinanceScenarioResult({
            ...baseInput,
            pricePerUnit: 2,
        });

        expect(result.contributionPerUnit).toBe(-1);
        expect(result.breakEvenUnits).toBeNull();
        expect(result.breakEvenRevenue).toBeNull();
        expect(result.hasBreakEven).toBe(false);
    });

    it('supports usage-based variable cost planning per user', () => {
        const result = calculateFinanceScenarioResult({
            plannedUnits: 10,
            pricePerUnit: 0,
            tokenQuotaPerUnit: 3000000,
            targetProfitPercentOnCost: 0,
            fixedCostItems: [],
            variableCostItemsPerUnit: [
                { id: 'ideas', label: 'Recipe ideas', amount: 0, quantityPerUnit: 200, unitCost: 0.00013, tokensPerUsage: 1200 },
                { id: 'expand', label: 'Recipe expansion', amount: 0, quantityPerUnit: 100, unitCost: 0.007, tokensPerUsage: 6000 },
                { id: 'images', label: 'Images', amount: 0, quantityPerUnit: 40, unitCost: 0.06, tokensPerUsage: 800 },
            ],
        });

        expect(result.variableCostPerUnit).toBeCloseTo(3.126, 6);
        expect(result.variableCostsTotal).toBeCloseTo(31.26, 6);
        expect(result.totalCosts).toBeCloseTo(31.26, 6);
        expect(result.tokensUsedPerUnit).toBeCloseTo(872000, 6);
        expect(result.tokensUsedTotal).toBeCloseTo(8720000, 6);
        expect(result.isTokenQuotaExceededPerUnit).toBe(false);
        expect(result.tokensRemainingPerUnit).toBeCloseTo(2128000, 6);
    });

    it('flags token quota exceed when planned usage is above quota', () => {
        const result = calculateFinanceScenarioResult({
            plannedUnits: 1,
            pricePerUnit: 0,
            tokenQuotaPerUnit: 1000,
            targetProfitPercentOnCost: 0,
            fixedCostItems: [],
            variableCostItemsPerUnit: [
                { id: 'model-a', label: 'Model A', amount: 0, quantityPerUnit: 5, unitCost: 0.01, tokensPerUsage: 300 },
            ],
        });

        expect(result.tokensUsedPerUnit).toBe(1500);
        expect(result.tokenQuotaPerUnit).toBe(1000);
        expect(result.isTokenQuotaExceededPerUnit).toBe(true);
        expect(result.tokensRemainingPerUnit).toBe(-500);
    });

    it('calculates retrograde offer price with discount and sales commission', () => {
        const result = calculateFinanceScenarioResult({
            plannedUnits: 100,
            pricePerUnit: 20,
            discountPercent: 10,
            salesCommissionPercent: 5,
            targetProfitPercentOnCost: 20,
            fixedCostItems: [
                { id: 'f1', label: 'Infra', amount: 500 },
            ],
            variableCostItemsPerUnit: [
                { id: 'v1', label: 'Support', amount: 3 },
            ],
        });

        expect(result.totalCostPerUnit).toBeCloseTo(8, 5);
        expect(result.netRevenuePerUnit).toBeCloseTo(17.1, 5); // 20 * 0.9 * 0.95
        expect(result.netRevenueTotal).toBeCloseTo(1710, 5);
        expect(result.operatingProfitTotal).toBeCloseTo(910, 5); // 1710 - 800
        expect(result.suggestedPricePerUnit).toBeCloseTo(11.228, 3); // 9.6 / (0.9 * 0.95)
    });
});
