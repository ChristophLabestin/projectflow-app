import { useCallback, useMemo } from 'react';
import { PaidAd, AdCreative, AdTargetAudience, AdObjective, AdCampaign, AdPlatform } from '../types';
import { createAdCampaign } from '../services/marketingService';
import { auth } from '../services/firebase';
import { updatePaidAd } from '../services/domain/paidAdsService';

export interface AdData {
    objective?: AdObjective | string;
    missionStatement?: string;
    targetKPIs?: string;
    competitors?: string;
    duration?: string;
    offer?: string;
    funnelStage?: 'Awareness' | 'Consideration' | 'Conversion' | 'Retention';
    landingPage?: string;
    conversionEvent?: string;
    brandGuardrails?: string;
    creative?: AdCreative;
    targeting?: AdTargetAudience;
    budget?: {
        amount: number;
        type: 'Daily' | 'Lifetime';
        currency: string;
        startDate?: string;
        endDate?: string;
        bidStrategy?: string;
        pacing?: string;
        notes?: string;
    };
    research?: {
        marketInsights?: string;
        competitorNotes?: string;
        customerPainPoints?: string;
        proofPoints?: string;
        angleIdeas?: string[];
    };
    setup?: {
        platforms?: AdPlatform[];
        campaignStructure?: string;
        trackingStatus?: 'Not Started' | 'In Progress' | 'Verified';
        utmScheme?: string;
        checklist?: string[];
        qaNotes?: string;
    };
    optimization?: {
        hypotheses?: string[];
        scalingPlan?: string;
        reportingCadence?: string;
        guardrails?: string;
        learnings?: string;
    };
    riskAnalysis?: any;
    completeness: number;
    lastSavedAt?: string;
}

const DEFAULT_AD_DATA: AdData = {
    completeness: 0,
    creative: { variations: [] },
    targeting: { locations: [], interests: [], placements: [] },
    budget: { amount: 0, type: 'Daily', currency: 'USD' },
    research: { angleIdeas: [] },
    setup: { platforms: [], checklist: [] },
    optimization: { hypotheses: [] },
};

const mergeAdData = (data: Partial<AdData>): AdData => ({
    ...DEFAULT_AD_DATA,
    ...data,
    creative: { ...DEFAULT_AD_DATA.creative, ...data.creative },
    targeting: { ...DEFAULT_AD_DATA.targeting, ...data.targeting },
    budget: { ...DEFAULT_AD_DATA.budget, ...data.budget },
    research: { ...DEFAULT_AD_DATA.research, ...data.research },
    setup: { ...DEFAULT_AD_DATA.setup, ...data.setup },
    optimization: { ...DEFAULT_AD_DATA.optimization, ...data.optimization },
});

const calculateCompleteness = (data: AdData): number => {
    let score = 0;
    let total = 0;

    const check = (condition: boolean, weight: number) => {
        total += weight;
        if (condition) score += weight;
    };

    check(!!data.objective, 12);
    check(!!data.missionStatement, 8);
    check(!!data.offer, 8);
    check(!!data.funnelStage, 6);
    check(!!data.targetKPIs, 6);
    check(!!data.landingPage, 6);
    check(!!data.conversionEvent, 6);
    check(!!data.creative?.headline1, 8);
    check(!!data.creative?.primaryText, 8);
    check(!!data.creative?.visualConcept, 8);
    check(!!data.creative?.cta, 4);
    check((data.targeting?.locations?.length || 0) > 0, 6);
    check((data.targeting?.interests?.length || 0) > 0, 6);
    check((data.budget?.amount || 0) > 0, 10);
    check((data.setup?.platforms?.length || 0) > 0, 6);
    check(!!data.research?.marketInsights, 6);
    check((data.optimization?.hypotheses?.length || 0) > 0, 4);

    return total > 0 ? Math.round((score / total) * 100) : 0;
};

export const usePaidAdsData = (paidAd: PaidAd, onUpdate: (updates: Partial<PaidAd>) => void) => {
    const adData: AdData = useMemo(() => {
        if (paidAd.adData) {
            const merged = mergeAdData(paidAd.adData as AdData);
            merged.completeness = calculateCompleteness(merged);
            return merged;
        }

        const merged = mergeAdData({});
        merged.completeness = calculateCompleteness(merged);
        return merged;
    }, [paidAd.adData]);

    const updateAdData = useCallback((updates: Partial<AdData>) => {
        const next: AdData = {
            ...adData,
            ...updates,
            creative: updates.creative ? { ...adData.creative, ...updates.creative } : adData.creative,
            targeting: updates.targeting ? { ...adData.targeting, ...updates.targeting } : adData.targeting,
            budget: updates.budget ? { ...adData.budget, ...updates.budget } : adData.budget,
            research: updates.research ? { ...adData.research, ...updates.research } : adData.research,
            setup: updates.setup ? { ...adData.setup, ...updates.setup } : adData.setup,
            optimization: updates.optimization ? { ...adData.optimization, ...updates.optimization } : adData.optimization,
        };

        next.completeness = calculateCompleteness(next);
        next.lastSavedAt = new Date().toISOString();

        onUpdate({
            adData: next
        });
    }, [adData, onUpdate]);

    const createCampaign = useCallback(async (projectId: string) => {
        if (!auth.currentUser || !projectId) throw new Error('Unauthorized or invalid project');

        const budgetAmount = adData.budget?.amount || 0;
        const budgetType = adData.budget?.type || 'Daily';
        const selectedPlatform = (adData.setup?.platforms?.[0] as AdPlatform) || 'Meta';

        const mapObjective = (obj: string): AdCampaign['objective'] => {
            const valid: AdCampaign['objective'][] = ['Traffic', 'Leads', 'Sales', 'Brand Awareness', 'Engagement', 'Video Views', 'App Installs'];
            return valid.find(v => v === obj) || 'Traffic';
        };

        const campaign: Omit<AdCampaign, 'id'> = {
            projectId,
            name: paidAd.title,
            description: paidAd.description || adData.creative?.primaryText || '',
            platform: selectedPlatform,
            status: 'Pending',
            budgetType: budgetType,
            budgetDaily: budgetType === 'Daily' ? budgetAmount : undefined,
            budgetTotal: budgetType === 'Lifetime' ? budgetAmount : undefined,
            spend: 0,
            objective: mapObjective(String(adData.objective || 'Traffic')),
            startDate: adData.budget?.startDate || new Date().toISOString().split('T')[0],
            endDate: adData.budget?.endDate,
            targetAudience: {
                locations: adData.targeting?.locations || [],
                ageMin: adData.targeting?.ageMin || 18,
                ageMax: adData.targeting?.ageMax || 65,
                genders: adData.targeting?.genders || ['All'],
                interests: adData.targeting?.interests || [],
            },
            placements: adData.targeting?.placements || [],
            metrics: {
                impressions: 0,
                clicks: 0,
                ctr: 0,
                cpc: 0,
                conversions: 0,
                costPerConversion: 0,
                roas: 0,
            },
            createdBy: auth.currentUser.uid,
            createdAt: new Date(),
        };

        const campaignId = await createAdCampaign(campaign);

        await updatePaidAd(paidAd.id, {
            convertedCampaignId: campaignId,
            status: 'Live'
        }, projectId);

        onUpdate({
            convertedCampaignId: campaignId,
            status: 'Live'
        });

        return campaignId;
    }, [adData, paidAd, onUpdate]);

    return {
        adData,
        updateAdData,
        createCampaign,
        updateCreative: (creative: Partial<AdCreative>) => updateAdData({ creative }),
        updateTargeting: (targeting: Partial<AdTargetAudience>) => updateAdData({ targeting }),
        updateBudget: (budget: Partial<AdData['budget']>) => updateAdData({ budget }),
    };
};
