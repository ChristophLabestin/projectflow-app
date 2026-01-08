import React, { useMemo, useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Badge } from '../../common/Badge/Badge';
import { Card } from '../../common/Card/Card';
import { generatePaidAdsRiskAnalysis } from '../../../services/geminiService';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';
import { useLanguage } from '../../../context/LanguageContext';

interface PaidAdsReviewViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const OBJECTIVE_LABELS = [
    { id: 'Traffic', labelKey: 'flowStages.paidAdsBrief.objectives.traffic.title' },
    { id: 'Leads', labelKey: 'flowStages.paidAdsBrief.objectives.leads.title' },
    { id: 'Sales', labelKey: 'flowStages.paidAdsBrief.objectives.sales.title' },
    { id: 'Brand Awareness', labelKey: 'flowStages.paidAdsBrief.objectives.brandAwareness.title' },
    { id: 'Engagement', labelKey: 'flowStages.paidAdsBrief.objectives.engagement.title' },
    { id: 'Video Views', labelKey: 'flowStages.paidAdsBrief.objectives.videoViews.title' },
    { id: 'App Installs', labelKey: 'flowStages.paidAdsBrief.objectives.appInstalls.title' },
];

const FUNNEL_LABELS = [
    { id: 'Awareness', labelKey: 'flowStages.paidAdsBrief.funnel.awareness' },
    { id: 'Consideration', labelKey: 'flowStages.paidAdsBrief.funnel.consideration' },
    { id: 'Conversion', labelKey: 'flowStages.paidAdsBrief.funnel.conversion' },
    { id: 'Retention', labelKey: 'flowStages.paidAdsBrief.funnel.retention' },
];

const PLATFORM_LABELS: Record<string, string> = {
    Meta: 'flowStages.paidAdsBuild.platforms.meta',
    Google: 'flowStages.paidAdsBuild.platforms.google',
    LinkedIn: 'flowStages.paidAdsBuild.platforms.linkedin',
    TikTok: 'flowStages.paidAdsBuild.platforms.tiktok',
    Other: 'flowStages.paidAdsBuild.platforms.other',
};

const BID_STRATEGY_LABELS = [
    { id: 'Lowest Cost', labelKey: 'flowStages.paidAdsBudget.strategies.lowestCost.title' },
    { id: 'Cost Cap', labelKey: 'flowStages.paidAdsBudget.strategies.costCap.title' },
    { id: 'Bid Cap', labelKey: 'flowStages.paidAdsBudget.strategies.bidCap.title' },
    { id: 'Target ROAS', labelKey: 'flowStages.paidAdsBudget.strategies.targetRoas.title' },
];

const CTA_OPTIONS = [
    { value: 'Learn More', labelKey: 'flowStages.paidAdsCreative.cta.learnMore' },
    { value: 'Shop Now', labelKey: 'flowStages.paidAdsCreative.cta.shopNow' },
    { value: 'Sign Up', labelKey: 'flowStages.paidAdsCreative.cta.signUp' },
    { value: 'Get Started', labelKey: 'flowStages.paidAdsCreative.cta.getStarted' },
    { value: 'Download', labelKey: 'flowStages.paidAdsCreative.cta.download' },
    { value: 'Contact Us', labelKey: 'flowStages.paidAdsCreative.cta.contactUs' },
    { value: 'Book Now', labelKey: 'flowStages.paidAdsCreative.cta.bookNow' },
    { value: 'Apply Now', labelKey: 'flowStages.paidAdsCreative.cta.applyNow' },
];

const GENDER_LABELS: Record<string, string> = {
    All: 'flowStages.paidAdsTargeting.gender.all',
    Male: 'flowStages.paidAdsTargeting.gender.male',
    Female: 'flowStages.paidAdsTargeting.gender.female',
};

const TRACKING_LABELS: Record<string, string> = {
    'Not Started': 'flowStages.paidAdsBuild.tracking.notStarted',
    'In Progress': 'flowStages.paidAdsBuild.tracking.inProgress',
    Verified: 'flowStages.paidAdsBuild.tracking.verified',
};

const getScoreTone = (score: number) => {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
};

export const PaidAdsReviewView: React.FC<PaidAdsReviewViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const { adData } = usePaidAdsData(idea, onUpdate);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [riskAnalysis, setRiskAnalysis] = useState<{ wins: string[]; risks: string[]; score: number } | null>(null);

    const creative = adData.creative || {};
    const targeting = adData.targeting || {};
    const budget = adData.budget || { amount: 0, type: 'Daily', bidStrategy: 'Lowest Cost' };
    const completeness = adData.completeness || 0;

    const objectiveLabel = useMemo(() => {
        const match = OBJECTIVE_LABELS.find((obj) => obj.id === adData.objective);
        return match ? t(match.labelKey) : t('flowStages.paidAdsReview.fallbacks.objective');
    }, [adData.objective, t]);

    const funnelLabel = useMemo(() => {
        const match = FUNNEL_LABELS.find((stage) => stage.id === adData.funnelStage);
        return match ? t(match.labelKey) : t('flowStages.paidAdsReview.fallbacks.notSet');
    }, [adData.funnelStage, t]);

    const bidStrategyLabel = useMemo(() => {
        const match = BID_STRATEGY_LABELS.find((strategy) => strategy.id === budget.bidStrategy);
        return match ? t(match.labelKey) : (budget.bidStrategy || t('flowStages.paidAdsReview.fallbacks.notSet'));
    }, [budget.bidStrategy, t]);

    const ctaLabel = useMemo(() => {
        const match = CTA_OPTIONS.find((option) => option.value === creative.cta);
        return match ? t(match.labelKey) : t('flowStages.paidAdsCreative.cta.learnMore');
    }, [creative.cta, t]);

    const platformLabels = (adData.setup?.platforms || []).map((platform) => (
        PLATFORM_LABELS[platform] ? t(PLATFORM_LABELS[platform]) : platform
    ));

    const genderLabels = (targeting.genders || []).map((gender) => (
        GENDER_LABELS[gender] ? t(GENDER_LABELS[gender]) : gender
    ));

    const trackingLabel = adData.setup?.trackingStatus
        ? (TRACKING_LABELS[adData.setup.trackingStatus] ? t(TRACKING_LABELS[adData.setup.trackingStatus]) : adData.setup.trackingStatus)
        : t('flowStages.paidAdsReview.fallbacks.notSet');

    const budgetTypeLabel = budget.type === 'Lifetime'
        ? t('flowStages.paidAdsBudget.types.lifetime')
        : t('flowStages.paidAdsBudget.types.daily');

    const heroTitle = adData.objective
        ? t('flowStages.paidAdsReview.hero.title').replace('{objective}', objectiveLabel)
        : t('flowStages.paidAdsReview.hero.titleFallback');

    const heroSubtitle = t('flowStages.paidAdsReview.hero.subtitle')
        .replace('{audience}', adData.missionStatement || t('flowStages.paidAdsReview.fallbacks.audience'))
        .replace('{budget}', `$${budget.amount || 0}`)
        .replace('{type}', budgetTypeLabel);

    const handleAnalyzeRisks = async () => {
        setIsAnalyzing(true);
        try {
            const campaignDetails = `
                Campaign Title: ${idea.title}
                Objective: ${adData.objective || 'Not defined'}
                Mission Statement: ${adData.missionStatement || 'Not defined'}
                Target Audience: ${JSON.stringify(adData.targeting || {})}
                Budget: ${adData.budget?.amount || '0'} ${adData.budget?.currency || 'USD'} (${adData.budget?.type || 'Daily'})
                Ad Copy: ${adData.creative?.headline1 || ''} - ${adData.creative?.primaryText || ''}
            `;
            const analysis = await generatePaidAdsRiskAnalysis(campaignDetails);
            setRiskAnalysis(analysis);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="flow-paid-ads-review">
            <div className="flow-paid-ads-review__container">
                <Card className="flow-paid-ads-review__hero">
                    <div className="flow-paid-ads-review__hero-content">
                        <div className="flow-paid-ads-review__badges">
                            <Badge variant="warning">{t('flowStages.paidAdsReview.hero.badgeReady')}</Badge>
                            <Badge variant="neutral">
                                {t('flowStages.paidAdsReview.hero.badgeComplete').replace('{count}', String(completeness))}
                            </Badge>
                        </div>
                        <h1 className="flow-paid-ads-review__title">{heroTitle}</h1>
                        <p className="flow-paid-ads-review__subtitle">{heroSubtitle}</p>
                    </div>
                    <div className="flow-paid-ads-review__hero-icon">
                        <span className="material-symbols-outlined">rocket_launch</span>
                    </div>
                </Card>

                <div className="flow-paid-ads-review__grid">
                    <div className="flow-paid-ads-review__main">
                        <Card className="flow-paid-ads-review__panel">
                            <h3 className="flow-paid-ads-review__panel-title">
                                {t('flowStages.paidAdsReview.sections.creative')}
                            </h3>
                            <div className="flow-paid-ads-review__creative">
                                <div className="flow-paid-ads-review__creative-preview">
                                    <div className="flow-paid-ads-review__mockup">
                                        <div className="flow-paid-ads-review__mockup-header">
                                            <div className="flow-paid-ads-review__mockup-avatar" />
                                            <div className="flow-paid-ads-review__mockup-meta">
                                                <span className="flow-paid-ads-review__mockup-line" />
                                                <span className="flow-paid-ads-review__mockup-line flow-paid-ads-review__mockup-line--short" />
                                            </div>
                                        </div>
                                        <div className="flow-paid-ads-review__mockup-media">
                                            {creative.visualConcept ? (
                                                <span className="flow-paid-ads-review__mockup-visual">{creative.visualConcept}</span>
                                            ) : (
                                                <span className="material-symbols-outlined">image</span>
                                            )}
                                        </div>
                                        <div className="flow-paid-ads-review__mockup-footer">
                                            <div>
                                                <div className="flow-paid-ads-review__mockup-title">{creative.headline1 || t('flowStages.paidAdsReview.preview.headlineFallback')}</div>
                                                <div className="flow-paid-ads-review__mockup-text">{creative.primaryText || t('flowStages.paidAdsReview.preview.primaryTextFallback')}</div>
                                                <div className="flow-paid-ads-review__mockup-label">{t('flowStages.paidAdsReview.preview.sponsored')}</div>
                                            </div>
                                            <span className="flow-paid-ads-review__mockup-cta">{ctaLabel}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flow-paid-ads-review__creative-details">
                                    <div className="flow-paid-ads-review__summary-grid">
                                        <div className="flow-paid-ads-review__summary-card">
                                            <span className="flow-paid-ads-review__summary-label">{t('flowStages.paidAdsReview.labels.headline')}</span>
                                            <span className="flow-paid-ads-review__summary-value">{creative.headline1 || t('flowStages.paidAdsReview.fallbacks.notSet')}</span>
                                        </div>
                                        <div className="flow-paid-ads-review__summary-card">
                                            <span className="flow-paid-ads-review__summary-label">{t('flowStages.paidAdsReview.labels.cta')}</span>
                                            <span className="flow-paid-ads-review__summary-value">{creative.cta ? ctaLabel : t('flowStages.paidAdsReview.fallbacks.notSet')}</span>
                                        </div>
                                    </div>
                                    <div className="flow-paid-ads-review__summary-card">
                                        <span className="flow-paid-ads-review__summary-label">{t('flowStages.paidAdsReview.labels.primaryText')}</span>
                                        <span className="flow-paid-ads-review__summary-text">
                                            {creative.primaryText || t('flowStages.paidAdsReview.fallbacks.notSet')}
                                        </span>
                                    </div>
                                    <div className="flow-paid-ads-review__summary-card">
                                        <span className="flow-paid-ads-review__summary-label">
                                            {t('flowStages.paidAdsReview.labels.variations').replace('{count}', String(creative.variations?.length || 0))}
                                        </span>
                                        <div className="flow-paid-ads-review__variation-list">
                                            {(creative.variations || []).length === 0 ? (
                                                <span className="flow-paid-ads-review__summary-empty">{t('flowStages.paidAdsReview.fallbacks.noVariations')}</span>
                                            ) : (
                                                (creative.variations || []).map((variation, index) => (
                                                    <span key={index} className="flow-paid-ads-review__variation-tag">{variation}</span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-review__panel">
                            <div className="flow-paid-ads-review__panel-header">
                                <h3 className="flow-paid-ads-review__panel-title">
                                    {t('flowStages.paidAdsReview.sections.analysis')}
                                </h3>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleAnalyzeRisks}
                                    isLoading={isAnalyzing}
                                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                                >
                                    {isAnalyzing
                                        ? t('flowStages.paidAdsReview.actions.analyzing')
                                        : t('flowStages.paidAdsReview.actions.analyze')}
                                </Button>
                            </div>

                            {riskAnalysis ? (
                                <div className="flow-paid-ads-review__analysis-grid">
                                    <div>
                                        <h4 className="flow-paid-ads-review__analysis-title flow-paid-ads-review__analysis-title--wins">
                                            <span className="material-symbols-outlined">check_circle</span>
                                            {t('flowStages.paidAdsReview.analysis.wins')}
                                        </h4>
                                        <ul className="flow-paid-ads-review__analysis-list">
                                            {riskAnalysis.wins.map((win, idx) => (
                                                <li key={idx}>{win}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="flow-paid-ads-review__analysis-title flow-paid-ads-review__analysis-title--risks">
                                            <span className="material-symbols-outlined">warning</span>
                                            {t('flowStages.paidAdsReview.analysis.risks')}
                                        </h4>
                                        <ul className="flow-paid-ads-review__analysis-list">
                                            {riskAnalysis.risks.map((risk, idx) => (
                                                <li key={idx}>{risk}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="flow-paid-ads-review__score">
                                        <span className="flow-paid-ads-review__score-label">
                                            {t('flowStages.paidAdsReview.analysis.scoreLabel')}
                                        </span>
                                        <div className="flow-paid-ads-review__score-bar">
                                            <div
                                                className={`flow-paid-ads-review__score-fill is-${getScoreTone(riskAnalysis.score)}`}
                                                style={{ width: `${riskAnalysis.score}%` }}
                                            />
                                        </div>
                                        <span className="flow-paid-ads-review__score-value">{riskAnalysis.score}/100</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flow-paid-ads-review__analysis-empty">
                                    <span className="material-symbols-outlined">analytics</span>
                                    <p>{t('flowStages.paidAdsReview.analysis.empty')}</p>
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="flow-paid-ads-review__aside">
                        <Card className="flow-paid-ads-review__panel">
                            <h3 className="flow-paid-ads-review__panel-title">
                                {t('flowStages.paidAdsReview.sections.strategy')}
                            </h3>
                            <div className="flow-paid-ads-review__detail">
                                <span>{t('flowStages.paidAdsReview.brief.offer')}</span>
                                <span>{adData.offer || t('flowStages.paidAdsReview.fallbacks.notDefined')}</span>
                            </div>
                            <div className="flow-paid-ads-review__detail">
                                <span>{t('flowStages.paidAdsReview.brief.funnelStage')}</span>
                                <span>{funnelLabel}</span>
                            </div>
                            <div className="flow-paid-ads-review__detail">
                                <span>{t('flowStages.paidAdsReview.brief.conversionEvent')}</span>
                                <span>{adData.conversionEvent || t('flowStages.paidAdsReview.fallbacks.notSet')}</span>
                            </div>
                            <div className="flow-paid-ads-review__detail flow-paid-ads-review__detail--stack">
                                <span>{t('flowStages.paidAdsReview.brief.landingPage')}</span>
                                <span className="flow-paid-ads-review__detail-link">
                                    {adData.landingPage || t('flowStages.paidAdsReview.fallbacks.notSet')}
                                </span>
                            </div>
                            <div className="flow-paid-ads-review__detail flow-paid-ads-review__detail--stack">
                                <span>{t('flowStages.paidAdsReview.brief.platforms')}</span>
                                <div className="flow-paid-ads-review__tag-list">
                                    {platformLabels.length > 0 ? (
                                        platformLabels.map((platform) => (
                                            <span key={platform} className="flow-paid-ads-review__tag">{platform}</span>
                                        ))
                                    ) : (
                                        <span className="flow-paid-ads-review__detail-muted">{t('flowStages.paidAdsReview.fallbacks.notSet')}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flow-paid-ads-review__detail">
                                <span>{t('flowStages.paidAdsReview.brief.trackingStatus')}</span>
                                <span>{trackingLabel}</span>
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-review__panel">
                            <h3 className="flow-paid-ads-review__panel-title">
                                {t('flowStages.paidAdsReview.sections.targeting')}
                            </h3>
                            <div className="flow-paid-ads-review__detail flow-paid-ads-review__detail--stack">
                                <span>{t('flowStages.paidAdsReview.targeting.coreAudience')}</span>
                                <span>{adData.missionStatement || t('flowStages.paidAdsReview.fallbacks.notDefined')}</span>
                            </div>
                            <div className="flow-paid-ads-review__detail flow-paid-ads-review__detail--stack">
                                <span>{t('flowStages.paidAdsReview.targeting.locations')}</span>
                                <div className="flow-paid-ads-review__tag-list">
                                    {(targeting.locations || []).length > 0 ? (
                                        (targeting.locations || []).map((location) => (
                                            <span key={location} className="flow-paid-ads-review__tag">{location}</span>
                                        ))
                                    ) : (
                                        <span className="flow-paid-ads-review__detail-muted">{t('flowStages.paidAdsReview.fallbacks.allLocations')}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flow-paid-ads-review__detail">
                                <span>{t('flowStages.paidAdsReview.targeting.age')}</span>
                                <span>
                                    {targeting.ageMin && targeting.ageMax
                                        ? `${targeting.ageMin} - ${targeting.ageMax}`
                                        : t('flowStages.paidAdsReview.fallbacks.allAges')}
                                </span>
                            </div>
                            <div className="flow-paid-ads-review__detail">
                                <span>{t('flowStages.paidAdsReview.targeting.genders')}</span>
                                <span>
                                    {genderLabels.length > 0 ? genderLabels.join(', ') : t('flowStages.paidAdsReview.fallbacks.allGenders')}
                                </span>
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-review__budget">
                            <h3 className="flow-paid-ads-review__budget-title">
                                {t('flowStages.paidAdsReview.sections.budget')}
                            </h3>
                            <div className="flow-paid-ads-review__budget-amount">${budget.amount || 0}</div>
                            <div className="flow-paid-ads-review__budget-type">
                                {t('flowStages.paidAdsReview.budget.limitLabel').replace('{type}', budgetTypeLabel)}
                            </div>
                            <div className="flow-paid-ads-review__budget-list">
                                <div>
                                    <span>{t('flowStages.paidAdsReview.budget.bidStrategy')}</span>
                                    <span>{bidStrategyLabel}</span>
                                </div>
                                <div>
                                    <span>{t('flowStages.paidAdsReview.budget.kpi')}</span>
                                    <span>{adData.targetKPIs || '-'}</span>
                                </div>
                            </div>
                            <Button
                                className="flow-paid-ads-review__publish"
                                onClick={() => onUpdate({ stage: 'Live' })}
                            >
                                {t('flowStages.paidAdsReview.actions.publish')}
                            </Button>
                        </Card>
                    </div>
                </div>
            </div>

            <div className="flow-paid-ads-review__quick-edit">
                <span className="flow-paid-ads-review__quick-label">{t('flowStages.paidAdsReview.quickEdit.title')}</span>
                <div className="flow-paid-ads-review__quick-actions">
                    <Button size="sm" variant="ghost" onClick={() => onUpdate({ stage: 'Targeting' })}>
                        {t('flows.stage.targeting')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onUpdate({ stage: 'Budget' })}>
                        {t('flows.stage.budget')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onUpdate({ stage: 'Creative' })}>
                        {t('flows.stage.creative')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onUpdate({ stage: 'Build' })}>
                        {t('flowStages.paidAdsReview.quickEdit.build')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
