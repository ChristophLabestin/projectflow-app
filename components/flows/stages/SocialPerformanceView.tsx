import React, { useState, useEffect } from 'react';
import { Idea, SocialPlatform, SocialCampaign } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { Select } from '../../common/Select/Select';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { subscribeCampaigns, createSocialPost } from '../../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialPerformanceViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface ContentDraft {
    copy: string;
    assets: string[];
    status: 'draft' | 'ready';
    lastRefined?: string;
}

interface StudioData {
    concepts: Record<string, { hook: string; contentBody: string; visualCue: string; format: string }>;
    drafts: Record<string, ContentDraft>;
    activeDraftPlatform: string | null;
    selectedCampaignId?: string;
}

export const SocialPerformanceView: React.FC<SocialPerformanceViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
    const [isDistributing, setIsDistributing] = useState(false);
    const [distributionResult, setDistributionResult] = useState<'success' | 'error' | null>(null);

    useEffect(() => {
        if (idea.projectId) {
            const unsubscribe = subscribeCampaigns(idea.projectId, (data) => {
                setCampaigns(data.filter((campaign) => campaign.status === 'Active' || campaign.status === 'Planning'));
            });
            return () => unsubscribe();
        }
    }, [idea.projectId]);

    const studioData: StudioData = (() => {
        try {
            const parsed = idea.concept ? JSON.parse(idea.concept) : {};
            return {
                concepts: parsed.concepts || {},
                drafts: parsed.drafts || {},
                activeDraftPlatform: parsed.activeDraftPlatform || null,
                selectedCampaignId: parsed.selectedCampaignId || '',
            };
        } catch {
            return { concepts: {}, drafts: {}, activeDraftPlatform: null, selectedCampaignId: '' };
        }
    })();

    const platforms = Object.keys(studioData.drafts) as SocialPlatform[];

    const updateStudioData = (updates: Partial<StudioData>) => {
        const currentParsed = idea.concept ? JSON.parse(idea.concept) : {};
        const newData = { ...currentParsed, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const handleDistribute = async () => {
        if (isDistributing || !idea.projectId) return;
        setIsDistributing(true);
        setDistributionResult(null);

        try {
            const promises = platforms.map(async (platform) => {
                const draft = studioData.drafts[platform];
                if (!draft) return;

                const postData = {
                    campaignId: studioData.selectedCampaignId || undefined,
                    platform: platform,
                    content: {
                        caption: draft.copy,
                        hashtags: [],
                        originIdeaId: idea.id
                    },
                    assets: draft.assets.map((url) => ({
                        id: Math.random().toString(36).substr(2, 9),
                        projectId: idea.projectId!,
                        url: url,
                        storagePath: '',
                        type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                        filename: 'Asset',
                        mimeType: 'application/octet-stream',
                        size: 0,
                        createdAt: new Date(),
                        createdBy: ''
                    })),
                    format: (studioData.concepts[platform]?.format as any) || 'Post',
                    status: 'Draft' as const,
                    isConcept: true,
                    originIdeaId: idea.id
                };

                await createSocialPost(idea.projectId!, postData as any);
            });

            await Promise.all(promises);
            setDistributionResult('success');
        } catch (e) {
            console.error(e);
            setDistributionResult('error');
        } finally {
            setIsDistributing(false);
        }
    };

    const campaignOptions = [
        { label: t('flowStages.socialPerformance.transmission.target.noneOption'), value: '' },
        ...campaigns.map((campaign) => ({ label: campaign.name, value: campaign.id })),
    ];

    return (
        <div className="flow-social-performance">
            <div className="flow-social-performance__container">
                <div className="flow-social-performance__hero">
                    <div className="flow-social-performance__hero-glow">
                        <span className="material-symbols-outlined">podium</span>
                    </div>
                    <div className="flow-social-performance__hero-content">
                        <div className="flow-social-performance__hero-header">
                            <div className="flow-social-performance__badge">
                                {t('flowStages.socialPerformance.hero.badge')}
                            </div>
                            <h1 className="flow-social-performance__title">{t('flowStages.socialPerformance.hero.title')}</h1>
                        </div>
                        <p className="flow-social-performance__subtitle">{t('flowStages.socialPerformance.hero.subtitle')}</p>
                    </div>
                </div>

                <div className="flow-social-performance__grid">
                    <div className="flow-social-performance__main">
                        <Card className="flow-social-performance__panel">
                            <h3 className="flow-social-performance__panel-title">
                                <span className="material-symbols-outlined">inventory_2</span>
                                {t('flowStages.socialPerformance.ready.title')}
                            </h3>

                            {platforms.length === 0 ? (
                                <div className="flow-social-performance__empty">
                                    <span className="material-symbols-outlined">drafts</span>
                                    <p>{t('flowStages.socialPerformance.ready.empty')}</p>
                                    <Button
                                        onClick={() => onUpdate({ stage: 'Studio' })}
                                        size="sm"
                                        variant="ghost"
                                    >
                                        {t('flowStages.socialPerformance.ready.backToStudio')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flow-social-performance__list">
                                    {platforms.map((platform) => {
                                        const draft = studioData.drafts[platform];
                                        const concept = studioData.concepts[platform];
                                        const isReady = draft.status === 'ready';

                                        return (
                                            <div key={platform} className="flow-social-performance__card">
                                                <div className="flow-social-performance__asset">
                                                    {draft.assets[0] ? (
                                                        draft.assets[0].match(/\.(mp4|mov|webm)$/i) ? (
                                                            <video src={`${draft.assets[0]}#t=0.001`} className="flow-social-performance__asset-media" />
                                                        ) : (
                                                            <img src={draft.assets[0]} alt="" className="flow-social-performance__asset-media" />
                                                        )
                                                    ) : (
                                                        <div className="flow-social-performance__asset-empty">
                                                            <span className="material-symbols-outlined">image_not_supported</span>
                                                        </div>
                                                    )}
                                                    <div className="flow-social-performance__asset-icon">
                                                        <PlatformIcon platform={platform} />
                                                    </div>
                                                </div>

                                                <div className="flow-social-performance__card-body">
                                                    <div className="flow-social-performance__card-header">
                                                        <span>{platform} - {concept?.format}</span>
                                                        <span className={`flow-social-performance__status ${isReady ? 'is-ready' : ''}`}>
                                                            {isReady ? t('flowStages.socialPerformance.ready.status.ready') : t('flowStages.socialPerformance.ready.status.draft')}
                                                        </span>
                                                    </div>
                                                    <p className="flow-social-performance__caption">
                                                        {draft.copy || <span className="flow-social-performance__caption-empty">{t('flowStages.socialPerformance.ready.noCaption')}</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="flow-social-performance__sidebar">
                        <Card className="flow-social-performance__panel flow-social-performance__panel--sticky">
                            <div className="flow-social-performance__transmission">
                                <div className="flow-social-performance__transmission-icon">
                                    <span className="material-symbols-outlined">rocket_launch</span>
                                </div>
                                <div>
                                    <h3>{t('flowStages.socialPerformance.transmission.title')}</h3>
                                    <p>{t('flowStages.socialPerformance.transmission.subtitle')}</p>
                                </div>
                            </div>

                            <div className="flow-social-performance__settings">
                                <Select
                                    label={t('flowStages.socialPerformance.transmission.target.label')}
                                    value={studioData.selectedCampaignId || ''}
                                    onChange={(value) => updateStudioData({ selectedCampaignId: String(value) })}
                                    options={campaignOptions}
                                    className="flow-social-performance__select"
                                />
                                <p className="flow-social-performance__hint">{t('flowStages.socialPerformance.transmission.target.hint')}</p>

                                <div className="flow-social-performance__divider" />

                                <div className="flow-social-performance__total">
                                    <span>{t('flowStages.socialPerformance.transmission.total')}</span>
                                    <span>{platforms.length}</span>
                                </div>

                                <Button
                                    onClick={handleDistribute}
                                    disabled={isDistributing || distributionResult === 'success' || platforms.length === 0}
                                    className="flow-social-performance__send"
                                >
                                    {isDistributing ? (
                                        <>
                                            <span className="material-symbols-outlined flow-social-performance__spinner animate-spin">sync</span>
                                            {t('flowStages.socialPerformance.transmission.sending')}
                                        </>
                                    ) : distributionResult === 'success' ? (
                                        <>
                                            <span className="material-symbols-outlined">check_circle</span>
                                            {t('flowStages.socialPerformance.transmission.sent')}
                                        </>
                                    ) : (
                                        <>
                                            {t('flowStages.socialPerformance.transmission.send')}
                                            <span className="material-symbols-outlined">send</span>
                                        </>
                                    )}
                                </Button>

                                {distributionResult === 'success' && (
                                    <div className="flow-social-performance__success">
                                        <p>{t('flowStages.socialPerformance.transmission.success')}</p>
                                        <Button
                                            variant="secondary"
                                            className="flow-social-performance__view-module"
                                            onClick={() => navigate(`/project/${idea.projectId}/social/campaigns`)}
                                        >
                                            {t('flowStages.socialPerformance.transmission.viewModule')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};


