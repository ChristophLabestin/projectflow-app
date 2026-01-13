import React, { useState } from 'react';
import { Idea, AdCampaign } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { createAdCampaign } from '../../../services/marketingService';
import { updateIdea } from '../../../services/dataService';
import { useParams, Link } from 'react-router-dom';
import { auth } from '../../../services/firebase';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';
import { useLanguage } from '../../../context/LanguageContext';

interface PaidAdsLiveViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const PaidAdsLiveView: React.FC<PaidAdsLiveViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const { id: projectId } = useParams<{ id: string }>();
    const { adData } = usePaidAdsData(idea, onUpdate);
    const [converting, setConverting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isConverted = !!idea.convertedCampaignId;
    const budgetAmount = adData.budget?.amount || 0;
    const objective = adData.objective || '';

    const objectiveLabels: Record<string, string> = {
        'Traffic': t('flowStages.paidAdsLive.objectives.traffic'),
        'Leads': t('flowStages.paidAdsLive.objectives.leads'),
        'Sales': t('flowStages.paidAdsLive.objectives.sales'),
        'Brand Awareness': t('flowStages.paidAdsLive.objectives.brandAwareness'),
        'Engagement': t('flowStages.paidAdsLive.objectives.engagement'),
        'Video Views': t('flowStages.paidAdsLive.objectives.videoViews'),
        'App Installs': t('flowStages.paidAdsLive.objectives.appInstalls'),
    };

    const objectiveLabel = objectiveLabels[objective] || objective || t('flowStages.paidAdsLive.objectives.unknown');

    const mapObjective = (obj: string): AdCampaign['objective'] => {
        const map: Record<string, AdCampaign['objective']> = {
            'Traffic': 'Traffic',
            'Leads': 'Leads',
            'Sales': 'Sales',
            'Brand Awareness': 'Brand Awareness',
            'Engagement': 'Engagement',
            'Video Views': 'Video Views',
            'App Installs': 'App Installs',
        };
        return map[obj] || 'Traffic';
    };

    const handleConvertToCampaign = async () => {
        if (!projectId || !auth.currentUser) return;
        setConverting(true);
        setError(null);

        try {
            const budgetType = adData.budget?.type || 'Daily';
            const selectedPlatform = (adData.setup?.platforms?.[0] as AdCampaign['platform']) || 'Meta';

            const campaign: Omit<AdCampaign, 'id'> = {
                projectId,
                name: idea.title,
                description: idea.description || adData.creative?.primaryText || '',
                platform: selectedPlatform,
                status: 'Pending',
                budgetType: budgetType,
                budgetDaily: budgetType === 'Daily' ? budgetAmount : undefined,
                budgetTotal: budgetType === 'Lifetime' ? budgetAmount : undefined,
                spend: 0,
                objective: mapObjective(adData.objective || 'Traffic'),
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
                originIdeaId: idea.id,
                createdBy: auth.currentUser.uid,
                createdAt: new Date(),
            };

            const campaignId = await createAdCampaign(campaign);

            await updateIdea(idea.id, {
                convertedCampaignId: campaignId,
                campaignType: 'ad',
                stage: 'Optimization',
            }, projectId);

            onUpdate({
                convertedCampaignId: campaignId,
                campaignType: 'ad',
                stage: 'Optimization',
            });
        } catch (e) {
            console.error('Failed to create campaign:', e);
            setError(t('flowStages.paidAdsLive.error.createCampaign'));
        } finally {
            setConverting(false);
        }
    };

    if (isConverted) {
        const campaignPath = projectId && idea.convertedCampaignId
            ? `/project/${projectId}/marketing/ads/${idea.convertedCampaignId}`
            : '#';

        return (
            <div className="flow-paid-ads-live flow-paid-ads-live--converted">
                <div className="flow-paid-ads-live__container flow-paid-ads-live__container--center">
                    <Card className="flow-paid-ads-live__success-card">
                        <div className="flow-paid-ads-live__success-bar" />
                        <div className="flow-paid-ads-live__success-icon">
                            <span className="material-symbols-outlined">rocket_launch</span>
                        </div>
                        <h2 className="flow-paid-ads-live__success-title">
                            {t('flowStages.paidAdsLive.success.title')}
                        </h2>
                        <p className="flow-paid-ads-live__success-message">
                            {t('flowStages.paidAdsLive.success.message')}
                        </p>
                        <Link
                            to={campaignPath}
                            className="btn btn--primary btn--lg flow-paid-ads-live__success-link"
                        >
                            <span className="material-symbols-outlined">analytics</span>
                            {t('flowStages.paidAdsLive.success.cta')}
                        </Link>

                        <div className="flow-paid-ads-live__stats">
                            <div className="flow-paid-ads-live__stat">
                                <span className="flow-paid-ads-live__stat-label">
                                    {t('flowStages.paidAdsLive.stats.status')}
                                </span>
                                <span className="flow-paid-ads-live__stat-value flow-paid-ads-live__stat-value--pending">
                                    <span className="flow-paid-ads-live__pulse" />
                                    {t('flowStages.paidAdsLive.stats.pending')}
                                </span>
                            </div>
                            <div className="flow-paid-ads-live__stat">
                                <span className="flow-paid-ads-live__stat-label">
                                    {t('flowStages.paidAdsLive.stats.budget')}
                                </span>
                                <span className="flow-paid-ads-live__stat-value">
                                    ${budgetAmount}
                                </span>
                            </div>
                            <div className="flow-paid-ads-live__stat">
                                <span className="flow-paid-ads-live__stat-label">
                                    {t('flowStages.paidAdsLive.stats.objective')}
                                </span>
                                <span className="flow-paid-ads-live__stat-value">
                                    {objectiveLabel}
                                </span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flow-paid-ads-live">
            <div className="flow-paid-ads-live__container">
                <div className="flow-paid-ads-live__grid">
                    <div className="flow-paid-ads-live__content">
                        <div className="flow-paid-ads-live__intro">
                            <span className="flow-paid-ads-live__badge">
                                <span className="material-symbols-outlined">hub</span>
                                {t('flowStages.paidAdsLive.launch.badge')}
                            </span>
                            <h1 className="flow-paid-ads-live__title">
                                {t('flowStages.paidAdsLive.launch.title')}
                            </h1>
                            <p className="flow-paid-ads-live__description">
                                {t('flowStages.paidAdsLive.launch.description').replace('{title}', idea.title)}
                            </p>
                        </div>

                        <Card className="flow-paid-ads-live__summary">
                            <div className="flow-paid-ads-live__summary-item">
                                <div className="flow-paid-ads-live__summary-icon flow-paid-ads-live__summary-icon--budget">
                                    <span className="material-symbols-outlined">payments</span>
                                </div>
                                <div className="flow-paid-ads-live__summary-text">
                                    <span className="flow-paid-ads-live__summary-title">
                                        {t('flowStages.paidAdsLive.summary.budget.title')}
                                    </span>
                                    <span className="flow-paid-ads-live__summary-subtitle">
                                        {t('flowStages.paidAdsLive.summary.budget.subtitle')}
                                    </span>
                                </div>
                                <div className="flow-paid-ads-live__summary-value">
                                    ${budgetAmount}
                                </div>
                            </div>

                            <div className="flow-paid-ads-live__summary-item">
                                <div className="flow-paid-ads-live__summary-icon flow-paid-ads-live__summary-icon--audience">
                                    <span className="material-symbols-outlined">target</span>
                                </div>
                                <div className="flow-paid-ads-live__summary-text">
                                    <span className="flow-paid-ads-live__summary-title">
                                        {t('flowStages.paidAdsLive.summary.audience.title')}
                                    </span>
                                    <span className="flow-paid-ads-live__summary-subtitle">
                                        {t('flowStages.paidAdsLive.summary.audience.subtitle')}
                                    </span>
                                </div>
                                <div className="flow-paid-ads-live__summary-value">
                                    {t('flowStages.paidAdsLive.summary.audience.value')}
                                </div>
                            </div>

                            <div className="flow-paid-ads-live__summary-item">
                                <div className="flow-paid-ads-live__summary-icon flow-paid-ads-live__summary-icon--creative">
                                    <span className="material-symbols-outlined">palette</span>
                                </div>
                                <div className="flow-paid-ads-live__summary-text">
                                    <span className="flow-paid-ads-live__summary-title">
                                        {t('flowStages.paidAdsLive.summary.creative.title')}
                                    </span>
                                    <span className="flow-paid-ads-live__summary-subtitle">
                                        {t('flowStages.paidAdsLive.summary.creative.subtitle')}
                                    </span>
                                </div>
                                <div className="flow-paid-ads-live__summary-status">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    {t('flowStages.paidAdsLive.summary.creative.status')}
                                </div>
                            </div>
                        </Card>

                        {error && (
                            <div className="flow-paid-ads-live__error">
                                <span className="material-symbols-outlined">error</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="flow-paid-ads-live__actions">
                            <Button
                                variant="secondary"
                                size="lg"
                                className="flow-paid-ads-live__back"
                                onClick={() => onUpdate({ stage: 'Review' })}
                            >
                                {t('flowStages.paidAdsLive.actions.back')}
                            </Button>
                            <Button
                                size="lg"
                                className="flow-paid-ads-live__launch"
                                onClick={handleConvertToCampaign}
                                isLoading={converting}
                                icon={<span className="material-symbols-outlined">rocket_launch</span>}
                            >
                                {t('flowStages.paidAdsLive.actions.launch')}
                            </Button>
                        </div>
                    </div>

                    <div className="flow-paid-ads-live__visual">
                        <div className="flow-paid-ads-live__float flow-paid-ads-live__float--top">
                            <div className="flow-paid-ads-live__float-block" />
                            <div className="flow-paid-ads-live__float-line" />
                            <div className="flow-paid-ads-live__float-line flow-paid-ads-live__float-line--short" />
                        </div>

                        <div className="flow-paid-ads-live__float flow-paid-ads-live__float--bottom">
                            <div className="flow-paid-ads-live__float-value">
                                {t('flowStages.paidAdsLive.visual.metric.value')}
                            </div>
                            <div className="flow-paid-ads-live__float-label">
                                {t('flowStages.paidAdsLive.visual.metric.label')}
                            </div>
                        </div>

                        <div className="flow-paid-ads-live__visual-center">
                            <div className="flow-paid-ads-live__visual-glow" />
                            <span className="material-symbols-outlined">campaign</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
