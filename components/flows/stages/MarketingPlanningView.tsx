import React, { useMemo, useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { Checkbox } from '../../common/Checkbox/Checkbox';
import { DatePicker } from '../../common/DateTime/DatePicker';
import { Select } from '../../common/Select/Select';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { createEmailCampaignFromIdea, createAdCampaignFromIdea } from '../../../services/marketingService';
import { auth } from '../../../services/firebase';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';

interface MarketingPlanningViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface MarketingPlan {
    emailSenderName: string;
    emailSubjectLines: string[];
    emailPreheader: string;
    adPlatform: string;
    dailyBudget: string;
    adHeadlines: string[];
    adCreativeType: string;
    audienceCriteria: string;
    assetsRequired: { name: string; done: boolean }[];
    timelineStart: string;
    timelineEnd: string;
}

export const MarketingPlanningView: React.FC<MarketingPlanningViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const defaultAssets = [
        { name: t('flowStages.marketingPlanning.assets.adCreatives'), done: false },
        { name: t('flowStages.marketingPlanning.assets.emailCopy'), done: false },
        { name: t('flowStages.marketingPlanning.assets.landingPage'), done: false },
        { name: t('flowStages.marketingPlanning.assets.utmCodes'), done: false },
    ];
    const plan: MarketingPlan = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    emailSenderName: parsed.emailSenderName || '',
                    emailSubjectLines: Array.isArray(parsed.emailSubjectLines) ? parsed.emailSubjectLines : [],
                    emailPreheader: parsed.emailPreheader || '',
                    adPlatform: parsed.adPlatform || 'Google Ads',
                    dailyBudget: parsed.dailyBudget || '',
                    adHeadlines: Array.isArray(parsed.adHeadlines) ? parsed.adHeadlines : [],
                    adCreativeType: parsed.adCreativeType || 'Image',
                    audienceCriteria: parsed.audienceCriteria || '',
                    assetsRequired: Array.isArray(parsed.assetsRequired) ? parsed.assetsRequired : defaultAssets,
                    timelineStart: parsed.timelineStart || '',
                    timelineEnd: parsed.timelineEnd || '',
                    ...parsed
                };
            }
        } catch { }
        return {
            emailSenderName: '',
            emailSubjectLines: [],
            emailPreheader: '',
            adPlatform: 'Google Ads',
            dailyBudget: '',
            adHeadlines: [],
            adCreativeType: 'Image',
            audienceCriteria: '',
            assetsRequired: defaultAssets,
            timelineStart: '',
            timelineEnd: ''
        };
    })();

    const updatePlan = (updates: Partial<MarketingPlan>) => {
        const newData = { ...plan, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const addToArray = (field: 'emailSubjectLines' | 'adHeadlines') => {
        updatePlan({ [field]: [...plan[field], ''] });
    };

    const updateArrayItem = (field: 'emailSubjectLines' | 'adHeadlines', idx: number, val: string) => {
        const newArr = [...plan[field]];
        newArr[idx] = val;
        updatePlan({ [field]: newArr });
    };

    const removeArrayItem = (field: 'emailSubjectLines' | 'adHeadlines', idx: number) => {
        const newArr = [...plan[field]];
        newArr.splice(idx, 1);
        updatePlan({ [field]: newArr });
    };

    const toggleAsset = (idx: number) => {
        const newAssets = [...plan.assetsRequired];
        newAssets[idx].done = !newAssets[idx].done;
        updatePlan({ assetsRequired: newAssets });
    };

    const navigate = useNavigate();
    const [isConverting, setIsConverting] = useState(false);

    const handleConvertToCampaign = async () => {
        const user = auth.currentUser;
        if (!user || !idea.projectId) return;
        setIsConverting(true);
        try {
            let campaignId = '';
            let type: 'email' | 'ad' = activeTab === 'Email' ? 'email' : 'ad';

            if (activeTab === 'Email') {
                campaignId = await createEmailCampaignFromIdea(
                    idea.projectId,
                    { id: idea.id, concept: idea.concept, title: idea.title },
                    { uid: user.uid, displayName: user.displayName || 'User' }
                );
            } else {
                campaignId = await createAdCampaignFromIdea(idea.projectId, { id: idea.id, concept: idea.concept, title: idea.title });
            }

            onUpdate({
                convertedCampaignId: campaignId,
                campaignType: type,
                stage: 'Execution'
            });
        } catch (error) {
            console.error('Failed to convert campaign', error);
        } finally {
            setIsConverting(false);
        }
    };

    const [activeTab, setActiveTab] = useState<'Email' | 'Ads'>('Email');
    const tabLabels: Record<'Email' | 'Ads', string> = {
        Email: t('flowStages.marketingPlanning.tabs.email'),
        Ads: t('flowStages.marketingPlanning.tabs.ads'),
    };

    const adPlatformOptions = useMemo(() => [
        { value: 'Google Ads', label: t('flowStages.marketingPlanning.ads.platform.google') },
        { value: 'Meta (FB/Insta)', label: t('flowStages.marketingPlanning.ads.platform.meta') },
        { value: 'LinkedIn Ads', label: t('flowStages.marketingPlanning.ads.platform.linkedin') },
        { value: 'Twitter / X', label: t('flowStages.marketingPlanning.ads.platform.x') },
        { value: 'TikTok Ads', label: t('flowStages.marketingPlanning.ads.platform.tiktok') },
    ], [t]);

    const adFormatOptions = useMemo(() => [
        { value: 'Image', label: t('flowStages.marketingPlanning.ads.format.image') },
        { value: 'Video', label: t('flowStages.marketingPlanning.ads.format.video') },
        { value: 'Carousel', label: t('flowStages.marketingPlanning.ads.format.carousel') },
        { value: 'Text Only', label: t('flowStages.marketingPlanning.ads.format.textOnly') },
    ], [t]);

    const timelineStartDate = plan.timelineStart ? new Date(plan.timelineStart) : null;
    const timelineEndDate = plan.timelineEnd ? new Date(plan.timelineEnd) : null;

    const actionLabel = isConverting
        ? t('flowStages.marketingPlanning.actions.creating')
        : idea.convertedCampaignId
            ? t('flowStages.marketingPlanning.actions.created')
            : t('flowStages.marketingPlanning.actions.createAndNext');

    return (
        <div className="flow-marketing-planning">
            <div className="flow-marketing-planning__container">
                <div className="flow-marketing-planning__grid">
                    <Card className="flow-marketing-planning__panel flow-marketing-planning__panel--main">
                        <div className="flow-marketing-planning__header">
                            <div>
                                <h2 className="flow-marketing-planning__title">{t('flowStages.marketingPlanning.title')}</h2>
                                <p className="flow-marketing-planning__subtitle">{t('flowStages.marketingPlanning.subtitle')}</p>
                            </div>
                            <div className="flow-marketing-planning__tabs">
                                {(['Email', 'Ads'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setActiveTab(tab)}
                                        className={`flow-marketing-planning__tab ${activeTab === tab ? 'is-active' : ''}`}
                                    >
                                        <span className="material-symbols-outlined">
                                            {tab === 'Email' ? 'mail' : 'ads_click'}
                                        </span>
                                        {tabLabels[tab]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flow-marketing-planning__body">
                            {activeTab === 'Email' ? (
                                <div className="flow-marketing-planning__section">
                                    <div className="flow-marketing-planning__field-grid">
                                        <TextInput
                                            label={t('flowStages.marketingPlanning.email.sender.label')}
                                            value={plan.emailSenderName}
                                            onChange={(event) => updatePlan({ emailSenderName: event.target.value })}
                                            placeholder={t('flowStages.marketingPlanning.email.sender.placeholder')}
                                            className="flow-marketing-planning__control"
                                        />
                                        <TextInput
                                            label={t('flowStages.marketingPlanning.email.preheader.label')}
                                            value={plan.emailPreheader}
                                            onChange={(event) => updatePlan({ emailPreheader: event.target.value })}
                                            placeholder={t('flowStages.marketingPlanning.email.preheader.placeholder')}
                                            className="flow-marketing-planning__control"
                                        />
                                    </div>

                                    <div className="flow-marketing-planning__list-section">
                                        <div className="flow-marketing-planning__list-header">
                                            <span className="flow-marketing-planning__label">{t('flowStages.marketingPlanning.email.subjects.label')}</span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => addToArray('emailSubjectLines')}
                                            >
                                                {t('flowStages.marketingPlanning.email.subjects.add')}
                                            </Button>
                                        </div>
                                        {plan.emailSubjectLines.length === 0 && (
                                            <p className="flow-marketing-planning__empty">{t('flowStages.marketingPlanning.email.subjects.empty')}</p>
                                        )}
                                        <div className="flow-marketing-planning__list">
                                            {plan.emailSubjectLines.map((line, idx) => (
                                                <div key={idx} className="flow-marketing-planning__list-row">
                                                    <div className="flow-marketing-planning__index">
                                                        {String.fromCharCode(65 + idx)}
                                                    </div>
                                                    <TextInput
                                                        value={line}
                                                        onChange={(event) => updateArrayItem('emailSubjectLines', idx, event.target.value)}
                                                        placeholder={t('flowStages.marketingPlanning.email.subjects.placeholder')}
                                                        className="flow-marketing-planning__control"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeArrayItem('emailSubjectLines', idx)}
                                                        className="flow-marketing-planning__remove"
                                                        aria-label={t('common.delete')}
                                                    >
                                                        <span className="material-symbols-outlined">close</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flow-marketing-planning__section">
                                    <div className="flow-marketing-planning__field-grid flow-marketing-planning__field-grid--wide">
                                        <Select
                                            label={t('flowStages.marketingPlanning.ads.platform.label')}
                                            value={plan.adPlatform}
                                            onChange={(value) => updatePlan({ adPlatform: String(value) })}
                                            options={adPlatformOptions}
                                            className="flow-marketing-planning__control"
                                        />
                                        <Select
                                            label={t('flowStages.marketingPlanning.ads.format.label')}
                                            value={plan.adCreativeType}
                                            onChange={(value) => updatePlan({ adCreativeType: String(value) })}
                                            options={adFormatOptions}
                                            className="flow-marketing-planning__control"
                                        />
                                        <TextInput
                                            label={t('flowStages.marketingPlanning.ads.budget.label')}
                                            value={plan.dailyBudget}
                                            onChange={(event) => updatePlan({ dailyBudget: event.target.value })}
                                            placeholder={t('flowStages.marketingPlanning.ads.budget.placeholder')}
                                            leftElement={<span className="flow-marketing-planning__currency">$</span>}
                                            className="flow-marketing-planning__control"
                                        />
                                    </div>

                                    <div className="flow-marketing-planning__list-section">
                                        <div className="flow-marketing-planning__list-header">
                                            <span className="flow-marketing-planning__label">{t('flowStages.marketingPlanning.ads.headlines.label')}</span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => addToArray('adHeadlines')}
                                            >
                                                {t('flowStages.marketingPlanning.ads.headlines.add')}
                                            </Button>
                                        </div>
                                        {plan.adHeadlines.length === 0 && (
                                            <p className="flow-marketing-planning__empty">{t('flowStages.marketingPlanning.ads.headlines.empty')}</p>
                                        )}
                                        <div className="flow-marketing-planning__list">
                                            {plan.adHeadlines.map((line, idx) => (
                                                <div key={idx} className="flow-marketing-planning__list-row">
                                                    <div className="flow-marketing-planning__index">
                                                        #{idx + 1}
                                                    </div>
                                                    <TextInput
                                                        value={line}
                                                        onChange={(event) => updateArrayItem('adHeadlines', idx, event.target.value)}
                                                        placeholder={t('flowStages.marketingPlanning.ads.headlines.placeholder')}
                                                        className="flow-marketing-planning__control"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeArrayItem('adHeadlines', idx)}
                                                        className="flow-marketing-planning__remove"
                                                        aria-label={t('common.delete')}
                                                    >
                                                        <span className="material-symbols-outlined">close</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <TextArea
                                        label={t('flowStages.marketingPlanning.ads.audience.label')}
                                        value={plan.audienceCriteria}
                                        onChange={(event) => updatePlan({ audienceCriteria: event.target.value })}
                                        placeholder={t('flowStages.marketingPlanning.ads.audience.placeholder')}
                                        className="flow-marketing-planning__control flow-marketing-planning__control--audience"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flow-marketing-planning__footer">
                            <Button
                                onClick={handleConvertToCampaign}
                                disabled={isConverting || !!idea.convertedCampaignId}
                                isLoading={isConverting}
                                icon={<span className="material-symbols-outlined">arrow_forward</span>}
                                iconPosition="right"
                                className="flow-marketing-planning__advance"
                            >
                                <span className="flow-marketing-planning__advance-text">{actionLabel}</span>
                                <span className="flow-marketing-planning__advance-subtext">{t('flowStages.marketingPlanning.actions.confirmNext')}</span>
                            </Button>
                        </div>
                    </Card>

                    <Card className="flow-marketing-planning__panel flow-marketing-planning__panel--aside">
                        <h3 className="flow-marketing-planning__panel-title">{t('flowStages.marketingPlanning.readiness.title')}</h3>

                        <div className="flow-marketing-planning__section">
                            <span className="flow-marketing-planning__label">{t('flowStages.marketingPlanning.timeline.title')}</span>
                            <div className="flow-marketing-planning__field-stack">
                                <DatePicker
                                    label={t('flowStages.marketingPlanning.timeline.start')}
                                    value={timelineStartDate}
                                    onChange={(date) => updatePlan({ timelineStart: date ? date.toISOString().split('T')[0] : '' })}
                                    placeholder={t('flowStages.marketingPlanning.timeline.startPlaceholder')}
                                />
                                <DatePicker
                                    label={t('flowStages.marketingPlanning.timeline.end')}
                                    value={timelineEndDate}
                                    onChange={(date) => updatePlan({ timelineEnd: date ? date.toISOString().split('T')[0] : '' })}
                                    placeholder={t('flowStages.marketingPlanning.timeline.endPlaceholder')}
                                />
                            </div>
                        </div>

                        <div className="flow-marketing-planning__section">
                            <span className="flow-marketing-planning__label">{t('flowStages.marketingPlanning.assets.title')}</span>
                            <div className="flow-marketing-planning__asset-list">
                                {plan.assetsRequired.map((asset, idx) => (
                                    <Checkbox
                                        key={idx}
                                        label={asset.name}
                                        checked={asset.done}
                                        onChange={() => toggleAsset(idx)}
                                        className={`flow-marketing-planning__asset ${asset.done ? 'is-done' : ''}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>

                {idea.convertedCampaignId && (
                    <Card className="flow-marketing-planning__converted">
                        <div className="flow-marketing-planning__converted-info">
                            <span className="material-symbols-outlined">verified</span>
                            <div>
                                <h4>{t('flowStages.marketingPlanning.converted.title')}</h4>
                                <p>{t('flowStages.marketingPlanning.converted.subtitle')}</p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => navigate(`/projects/${idea.projectId}/marketing/${idea.campaignType === 'email' ? 'email' : 'ads'}/${idea.convertedCampaignId}`)}
                        >
                            {t('flowStages.marketingPlanning.converted.action')}
                        </Button>
                    </Card>
                )}
            </div>
        </div>
    );
};
