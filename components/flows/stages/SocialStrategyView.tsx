import React from 'react';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { Select } from '../../common/Select/Select';
import { TextArea } from '../../common/Input/TextArea';
import { subscribeSocialStrategy, subscribeCampaigns } from '../../../services/dataService';
import { SocialStrategy as SocialStrategyType, Idea, SocialPlatform, SocialCampaign } from '../../../types';
import {
    generateSocialStrategyAI,
    generateAudienceAlternativesAI,
    generateSocialPlaybookAI
} from '../../../services/geminiService';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialStrategyViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface SocialStrategy {
    campaignType: string;
    subGoal: string;
    targetAudience: string;
    channels: SocialPlatform[];
    pillar: string;
    scope: 'post' | 'campaign';
    linkedCampaignId?: string;
    plays: Record<string, { play: string; tips: string[] }>;
}

export const SocialStrategyView: React.FC<SocialStrategyViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [projectStrategy, setProjectStrategy] = React.useState<SocialStrategyType | null>(null);
    const [availableCampaigns, setAvailableCampaigns] = React.useState<SocialCampaign[]>([]);
    const [generating, setGenerating] = React.useState(false);
    const [regeneratingPlatform, setRegeneratingPlatform] = React.useState<string | null>(null);
    const [audienceSuggestions, setAudienceSuggestions] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (!idea.projectId) return;
        const unsubStrategy = subscribeSocialStrategy(idea.projectId, setProjectStrategy);
        const unsubCampaigns = subscribeCampaigns(idea.projectId, setAvailableCampaigns);
        return () => {
            unsubStrategy();
            unsubCampaigns();
        };
    }, [idea.projectId]);

    const strategy: SocialStrategy = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    campaignType: parsed.campaignType || '',
                    subGoal: parsed.subGoal || '',
                    targetAudience: parsed.targetAudience || '',
                    channels: Array.isArray(parsed.channels) ? parsed.channels : [],
                    pillar: parsed.pillar || '',
                    scope: parsed.scope || 'post',
                    linkedCampaignId: parsed.linkedCampaignId,
                    plays: parsed.plays || {},
                    ...parsed
                };
            }
        } catch { }
        return {
            campaignType: '',
            subGoal: '',
            targetAudience: '',
            channels: [],
            pillar: '',
            scope: 'post',
            plays: {}
        };
    })();

    const updateStrategy = (updates: Partial<SocialStrategy>) => {
        const newData = { ...strategy, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const handleGeneratePlaybook = async () => {
        if (generating || strategy.channels.length === 0) return;
        setGenerating(true);
        try {
            const playbookData = await generateSocialPlaybookAI(idea, strategy.channels, strategy.scope, {
                goal: strategy.campaignType,
                subGoal: strategy.subGoal,
                audience: strategy.targetAudience
            });
            updateStrategy({ plays: playbookData });
        } catch (error) {
            console.error('Playbook generation error:', error);
        } finally {
            setGenerating(false);
        }
    };

    const handleRegeneratePlatform = async (platform: SocialPlatform) => {
        if (regeneratingPlatform) return;
        setRegeneratingPlatform(platform);
        try {
            const singlePlaybook = await generateSocialPlaybookAI(idea, [platform], strategy.scope, {
                goal: strategy.campaignType,
                subGoal: strategy.subGoal,
                audience: strategy.targetAudience
            });
            updateStrategy({
                plays: {
                    ...strategy.plays,
                    ...singlePlaybook
                }
            });
        } catch (error) {
            console.error('Regeneration error:', error);
        } finally {
            setRegeneratingPlatform(null);
        }
    };

    const toggleChannel = (channel: SocialPlatform) => {
        const current = strategy.channels;
        if (current.includes(channel)) {
            updateStrategy({ channels: current.filter((c) => c !== channel) });
        } else {
            updateStrategy({ channels: [...current, channel] });
        }
    };

    const GOALS = [
        { id: 'Brand Awareness', label: t('flowStages.socialStrategy.goals.brandAwareness') },
        { id: 'Engagement', label: t('flowStages.socialStrategy.goals.engagement') },
        { id: 'Traffic / Link', label: t('flowStages.socialStrategy.goals.traffic') },
        { id: 'Sales / Promo', label: t('flowStages.socialStrategy.goals.sales') },
        { id: 'Community Building', label: t('flowStages.socialStrategy.goals.community') },
        { id: 'Education', label: t('flowStages.socialStrategy.goals.education') },
    ];
    const ALL_CHANNELS: SocialPlatform[] = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube'];
    const COMMON_CHANNELS = projectStrategy?.defaultPlatforms && projectStrategy.defaultPlatforms.length > 0
        ? projectStrategy.defaultPlatforms
        : ALL_CHANNELS;

    const getGoalLabel = (value?: string) => {
        if (!value) return '';
        return GOALS.find((goal) => goal.id === value)?.label || value;
    };

    const selectedCampaign = availableCampaigns.find((campaign) => campaign.id === strategy.linkedCampaignId);

    const missionText = (
        <p className="flow-social-strategy__mission">
            "{t('flowStages.socialStrategy.mission.prefix')} <span className="flow-social-strategy__mission-highlight">
                {strategy.scope === 'post' ? t('flowStages.socialStrategy.scope.post') : t('flowStages.socialStrategy.mission.campaign')}
            </span>
            {strategy.scope === 'post' && selectedCampaign && (
                <>
                    {' '}{t('flowStages.socialStrategy.mission.for')} <span className="flow-social-strategy__mission-highlight">{selectedCampaign.name}</span>
                </>
            )}
            {' '}{t('flowStages.socialStrategy.mission.targeting')} <span className="flow-social-strategy__mission-highlight">
                {strategy.targetAudience || t('flowStages.socialStrategy.mission.audienceFallback')}
            </span>
            {' '}{t('flowStages.socialStrategy.mission.on')} <span className="flow-social-strategy__mission-highlight">
                {strategy.channels.length > 0 ? strategy.channels.join(', ') : t('flowStages.socialStrategy.mission.channelFallback')}
            </span>
            {' '}{t('flowStages.socialStrategy.mission.toDrive')} <span className="flow-social-strategy__mission-highlight">
                {getGoalLabel(strategy.campaignType) || t('flowStages.socialStrategy.mission.goalFallback')}
                {strategy.subGoal && <span className="flow-social-strategy__mission-muted">&amp;</span>}
                {strategy.subGoal ? getGoalLabel(strategy.subGoal) : ''}
            </span>."
        </p>
    );

    const campaignOptions = [
        { label: t('flowStages.socialStrategy.scope.noneOption'), value: '' },
        ...availableCampaigns.map((campaign) => ({ label: campaign.name, value: campaign.id })),
    ];

    const subGoalOptions = GOALS
        .filter((goal) => goal.id !== strategy.campaignType)
        .map((goal) => ({ label: goal.label, value: goal.id }));

    return (
        <div className="flow-social-strategy">
            <div className="flow-social-strategy__container">
                <div className="flow-social-strategy__hero">
                    <div className="flow-social-strategy__hero-glow">
                        <span className="material-symbols-outlined">flag</span>
                    </div>
                    <div className="flow-social-strategy__hero-content">
                        <div className="flow-social-strategy__hero-header">
                            <div className="flow-social-strategy__badge">
                                {t('flowStages.socialStrategy.hero.badge')}
                            </div>
                            <h1 className="flow-social-strategy__title">
                                {t('flowStages.socialStrategy.hero.title')}
                            </h1>
                        </div>
                        <div className="flow-social-strategy__mission-card">
                            {missionText}
                        </div>
                    </div>
                </div>

                <div className="flow-social-strategy__grid">
                    <div className="flow-social-strategy__sidebar">
                        <Card className="flow-social-strategy__panel">
                            <h3 className="flow-social-strategy__panel-title">{t('flowStages.socialStrategy.scope.title')}</h3>
                            <div className="flow-social-strategy__toggle">
                                <button
                                    type="button"
                                    className={`flow-social-strategy__toggle-button ${strategy.scope === 'post' ? 'is-active' : ''}`}
                                    onClick={() => updateStrategy({ scope: 'post' })}
                                >
                                    <span className="material-symbols-outlined">sticky_note_2</span>
                                    {t('flowStages.socialStrategy.scope.post')}
                                </button>
                                <button
                                    type="button"
                                    className={`flow-social-strategy__toggle-button ${strategy.scope === 'campaign' ? 'is-active' : ''}`}
                                    onClick={() => updateStrategy({ scope: 'campaign' })}
                                >
                                    <span className="material-symbols-outlined">layers</span>
                                    {t('flowStages.socialStrategy.scope.campaign')}
                                </button>
                            </div>

                            {strategy.scope === 'post' && (
                                <div className="flow-social-strategy__linked">
                                    <Select
                                        label={t('flowStages.socialStrategy.scope.linkLabel')}
                                        value={strategy.linkedCampaignId || ''}
                                        onChange={(value) => updateStrategy({ linkedCampaignId: value ? String(value) : undefined })}
                                        options={campaignOptions}
                                        className="flow-social-strategy__select"
                                    />
                                </div>
                            )}
                        </Card>

                        <Card className="flow-social-strategy__panel">
                            <h3 className="flow-social-strategy__panel-title">{t('flowStages.socialStrategy.channels.title')}</h3>
                            <div className="flow-social-strategy__channels">
                                {COMMON_CHANNELS.map((channel) => {
                                    const isActive = strategy.channels.includes(channel);
                                    return (
                                        <button
                                            key={channel}
                                            type="button"
                                            className={`flow-social-strategy__channel ${isActive ? 'is-active' : ''}`}
                                            onClick={() => toggleChannel(channel)}
                                        >
                                            <div className="flow-social-strategy__channel-main">
                                                <div className="flow-social-strategy__channel-icon">
                                                    <PlatformIcon platform={channel} />
                                                </div>
                                                <span>{channel}</span>
                                            </div>
                                            <div className="flow-social-strategy__channel-check">
                                                {isActive && <span className="material-symbols-outlined">check</span>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>

                        <Card className="flow-social-strategy__panel">
                            <div className="flow-social-strategy__panel-header">
                                <h3 className="flow-social-strategy__panel-title">{t('flowStages.socialStrategy.base.title')}</h3>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async () => {
                                        setGenerating(true);
                                        try {
                                            const [strategyRes, altsRes] = await Promise.all([
                                                generateSocialStrategyAI(idea),
                                                generateAudienceAlternativesAI(idea)
                                            ]);

                                            setAudienceSuggestions(altsRes);
                                            updateStrategy({
                                                campaignType: strategyRes.goal,
                                                subGoal: strategyRes.subGoal,
                                                targetAudience: strategyRes.targetAudience,
                                                pillar: strategyRes.pillar
                                            });
                                        } catch (e) {
                                            console.error(e);
                                        } finally {
                                            setGenerating(false);
                                        }
                                    }}
                                    isLoading={generating}
                                    className="flow-social-strategy__ai-button"
                                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                                >
                                    {t('flowStages.socialStrategy.base.aiSuggest')}
                                </Button>
                            </div>

                            <div className="flow-social-strategy__form">
                                <div>
                                    <label className="flow-social-strategy__label">{t('flowStages.socialStrategy.base.goalLabel')}</label>
                                    <div className="flow-social-strategy__goal-grid">
                                        {GOALS.map((goal) => (
                                            <button
                                                key={goal.id}
                                                type="button"
                                                className={`flow-social-strategy__goal ${strategy.campaignType === goal.id ? 'is-active' : ''}`}
                                                onClick={() => updateStrategy({ campaignType: goal.id })}
                                            >
                                                {goal.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <Select
                                        label={t('flowStages.socialStrategy.base.secondaryLabel')}
                                        value={strategy.subGoal}
                                        onChange={(value) => updateStrategy({ subGoal: String(value) })}
                                        options={subGoalOptions}
                                        placeholder={t('flowStages.socialStrategy.base.secondaryPlaceholder')}
                                        className="flow-social-strategy__select"
                                    />
                                </div>

                                <div>
                                    <label className="flow-social-strategy__label">{t('flowStages.socialStrategy.base.audienceLabel')}</label>
                                    <TextArea
                                        value={strategy.targetAudience}
                                        onChange={(e) => updateStrategy({ targetAudience: e.target.value })}
                                        className="flow-social-strategy__textarea"
                                    />
                                    <div className="flow-social-strategy__audience-actions">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={async () => {
                                                if (generating) return;
                                                setGenerating(true);
                                                try {
                                                    const alts = await generateAudienceAlternativesAI(idea);
                                                    setAudienceSuggestions(alts);
                                                } finally {
                                                    setGenerating(false);
                                                }
                                            }}
                                            icon={<span className="material-symbols-outlined">auto_awesome</span>}
                                            className="flow-social-strategy__audience-button"
                                        >
                                            {t('flowStages.socialStrategy.base.suggestAlternatives')}
                                        </Button>
                                    </div>
                                    {audienceSuggestions.length > 0 && (
                                        <div className="flow-social-strategy__audience-suggestions">
                                            {audienceSuggestions.map((suggestion, index) => (
                                                <button
                                                    key={`${suggestion}-${index}`}
                                                    type="button"
                                                    className="flow-social-strategy__audience-option"
                                                    onClick={() => {
                                                        updateStrategy({ targetAudience: suggestion });
                                                        setAudienceSuggestions([]);
                                                    }}
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="flow-social-strategy__main">
                        <Card className="flow-social-strategy__playbook">
                            <div className="flow-social-strategy__playbook-header">
                                <div>
                                    <h3>{t('flowStages.socialStrategy.playbook.title')}</h3>
                                    <p>{t('flowStages.socialStrategy.playbook.subtitle')}</p>
                                </div>
                                <Button
                                    onClick={handleGeneratePlaybook}
                                    isLoading={generating}
                                    disabled={strategy.channels.length === 0}
                                    className="flow-social-strategy__playbook-button"
                                    icon={<span className="material-symbols-outlined">bolt</span>}
                                >
                                    {t('flowStages.socialStrategy.playbook.generate')}
                                </Button>
                            </div>

                            {strategy.channels.length === 0 ? (
                                <div className="flow-social-strategy__playbook-empty">
                                    <span className="material-symbols-outlined">ads_click</span>
                                    <h4>{t('flowStages.socialStrategy.playbook.empty.title')}</h4>
                                    <p>{t('flowStages.socialStrategy.playbook.empty.subtitle')}</p>
                                </div>
                            ) : (
                                <div className="flow-social-strategy__playbook-grid">
                                    {strategy.channels.map((channel) => (
                                        <div key={channel} className="flow-social-strategy__playbook-card">
                                            <div className="flow-social-strategy__playbook-card-header">
                                                <div className="flow-social-strategy__channel-main">
                                                    <div className="flow-social-strategy__channel-icon">
                                                        <PlatformIcon platform={channel} />
                                                    </div>
                                                    <span>{channel}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="flow-social-strategy__refresh"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleRegeneratePlatform(channel);
                                                    }}
                                                    disabled={!!regeneratingPlatform}
                                                    title={t('flowStages.socialStrategy.playbook.regenerate')}
                                                >
                                                    <span className={`material-symbols-outlined ${regeneratingPlatform === channel ? 'animate-spin' : ''}`}>
                                                        {regeneratingPlatform === channel ? 'sync' : 'refresh'}
                                                    </span>
                                                </button>
                                            </div>

                                            {strategy.plays[channel] ? (
                                                <div className="flow-social-strategy__playbook-content">
                                                    <div>
                                                        <span className="flow-social-strategy__playbook-label">{t('flowStages.socialStrategy.playbook.playTitle')}</span>
                                                        <h4>{strategy.plays[channel].play}</h4>
                                                    </div>
                                                    <div>
                                                        <span className="flow-social-strategy__playbook-label">{t('flowStages.socialStrategy.playbook.tipsTitle')}</span>
                                                        <div className="flow-social-strategy__tips">
                                                            {strategy.plays[channel].tips.map((tip, index) => (
                                                                <div key={index} className="flow-social-strategy__tip">
                                                                    <span>{index + 1}</span>
                                                                    <p>{tip}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flow-social-strategy__playbook-placeholder">
                                                    <span className="material-symbols-outlined">hourglass_bottom</span>
                                                    <p>{t('flowStages.socialStrategy.playbook.pending')}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        <div className="flow-social-strategy__footer">
                            <Button
                                className="flow-social-strategy__advance"
                                onClick={() => onUpdate({ stage: 'CreativeLab' })}
                                icon={<span className="material-symbols-outlined">science</span>}
                                iconPosition="right"
                            >
                                {t('flowStages.socialStrategy.actions.advance')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
