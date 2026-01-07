import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { Select } from '../../common/Select/Select';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { Idea, SocialPlatform, SocialStrategy as SocialStrategyType, SocialPostFormat } from '../../../types';
import { PLATFORM_FORMATS } from '../constants';
import {
    generateSocialCampaignStrategyAI,
    generateAudienceAlternativesAI
} from '../../../services/geminiService';
import { subscribeSocialStrategy } from '../../../services/dataService';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { getDefaultPlatformFrequency } from '../constants/platformFrequencyData';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialCampaignStrategyViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface Phase {
    id: string;
    name: string;
    durationValue: number;
    durationUnit: 'Days' | 'Weeks' | 'Months';
    focus: string;
}

interface CampaignStrategy {
    phases: Phase[];
    platforms: {
        id: string;
        role: string;
        frequencyValue?: number;
        frequencyUnit?: string;
        frequency?: string;
        phaseFrequencies?: { phaseId: string; frequencyValue?: number; frequencyUnit: string; format?: SocialPostFormat }[];
        format?: SocialPostFormat;
    }[];
    kpis: { metric: string; target: string }[];
    audienceSegments: string[];
    campaignType: string;
    subGoal: string;
    pillar: string;
    aiSuggestedPlatforms?: string[];
    aiTactics?: any[];
}

const SOCIAL_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube Video', 'YouTube Shorts'];
const PHASE_TONES = ['primary', 'warning', 'success', 'neutral', 'danger'] as const;

const getPhaseTone = (index: number) => PHASE_TONES[index % PHASE_TONES.length];

export const SocialCampaignStrategyView: React.FC<SocialCampaignStrategyViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const { id: projectId } = useParams<{ id: string }>();
    const [socialStrategy, setSocialStrategy] = useState<SocialStrategyType | null>(null);
    const [generating, setGenerating] = useState(false);
    const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
    const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
    const [editingAudienceIndex, setEditingAudienceIndex] = useState<number | null>(null);
    const [audienceSuggestions, setAudienceSuggestions] = useState<string[]>([]);
    const [showAIConfig, setShowAIConfig] = useState(false);
    const [aiInstructions, setAiInstructions] = useState('');

    useEffect(() => {
        if (!projectId) return;
        const unsubscribe = subscribeSocialStrategy(projectId, setSocialStrategy);
        return () => unsubscribe();
    }, [projectId]);

    const enabledPlatforms = useMemo(() => {
        const raw = socialStrategy?.defaultPlatforms || SOCIAL_PLATFORMS;
        const expanded: string[] = [];
        raw.forEach((platform) => {
            if (platform === 'YouTube') {
                expanded.push('YouTube Video', 'YouTube Shorts');
            } else if (!expanded.includes(platform)) {
                expanded.push(platform);
            }
        });
        return expanded;
    }, [socialStrategy?.defaultPlatforms]);

    const getBasePlatform = (platform: string): SocialPlatform => {
        if (platform === 'YouTube Video' || platform === 'YouTube Shorts') return 'YouTube';
        return platform as SocialPlatform;
    };

    const phaseToDays = (phase: Phase): number => {
        const val = phase.durationValue || 1;
        switch (phase.durationUnit) {
            case 'Weeks':
                return val * 7;
            case 'Months':
                return val * 30;
            default:
                return val;
        }
    };

    const calculatePlatformTotal = (platform: { frequencyValue?: number; frequencyUnit?: string; phaseFrequencies?: any[] }, phases: Phase[]) => {
        let total = 0;
        phases.forEach((phase) => {
            const days = phaseToDays(phase);
            const override = platform.phaseFrequencies?.find((pf) => pf.phaseId === phase.id);

            let val = platform.frequencyValue || 1;
            let unit = platform.frequencyUnit || 'Posts/Week';

            if (override) {
                val = override.frequencyValue || 1;
                unit = override.frequencyUnit;
            }

            let dailyRate = 0;
            if (unit === 'Posts/Day') dailyRate = val;
            else if (unit === 'Posts/Week') dailyRate = val / 7;
            else if (unit === 'Posts/Month') dailyRate = val / 30;

            total += dailyRate * days;
        });
        return Math.ceil(total);
    };

    const strategyData: CampaignStrategy = useMemo(() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                const phases = Array.isArray(parsed.phases)
                    ? parsed.phases.map((phase: any) => ({
                        id: phase.id || Math.random().toString(36).substr(2, 9),
                        name: phase.name || '',
                        durationValue: phase.durationValue || parseInt(phase.duration) || 1,
                        durationUnit: phase.durationUnit || 'Days',
                        focus: phase.focus || '',
                    }))
                    : [];
                const platforms = Array.isArray(parsed.platforms)
                    ? parsed.platforms.map((platform: any) => {
                        let frequencyValue = platform.frequencyValue;
                        let frequencyUnit = platform.frequencyUnit || 'Posts/Week';

                        if (frequencyValue === undefined && platform.frequency) {
                            const match = platform.frequency.match(/(\d+)/);
                            frequencyValue = match ? parseInt(match[1]) : 1;
                            if (platform.frequency.toLowerCase().includes('day')) frequencyUnit = 'Posts/Day';
                            else if (platform.frequency.toLowerCase().includes('month')) frequencyUnit = 'Posts/Month';
                        }

                        const phaseFrequencies = (platform.phaseFrequencies || []).map((phaseFrequency: any) => ({
                            phaseId: phaseFrequency.phaseId,
                            frequencyValue: phaseFrequency.frequencyValue || phaseFrequency.value || 1,
                            frequencyUnit: phaseFrequency.frequencyUnit || phaseFrequency.unit || 'Posts/Week',
                            format: phaseFrequency.format
                        }));

                        return {
                            ...platform,
                            frequencyValue,
                            frequencyUnit,
                            phaseFrequencies
                        };
                    })
                    : [];

                return {
                    phases,
                    platforms,
                    kpis: Array.isArray(parsed.kpis) ? parsed.kpis : [],
                    audienceSegments: Array.isArray(parsed.audienceSegments) ? parsed.audienceSegments : [],
                    campaignType: parsed.campaignType || '',
                    subGoal: parsed.subGoal || '',
                    pillar: parsed.pillar || '',
                    aiSuggestedPlatforms: Array.isArray(parsed.aiSuggestedPlatforms) ? parsed.aiSuggestedPlatforms : [],
                    aiTactics: Array.isArray(parsed.aiTactics) ? parsed.aiTactics : [],
                };
            }
        } catch (e) {
            console.error('Strategy Parse Error', e);
        }

        return {
            phases: [],
            platforms: [],
            kpis: [],
            audienceSegments: [],
            campaignType: '',
            subGoal: '',
            pillar: '',
            aiSuggestedPlatforms: [],
            aiTactics: []
        };
    }, [idea.concept]);

    const totalCampaignPosts = useMemo(() => {
        return strategyData.platforms.reduce((sum, platform) => sum + calculatePlatformTotal(platform, strategyData.phases), 0);
    }, [strategyData.platforms, strategyData.phases]);
    const updateStrategy = (updates: Partial<CampaignStrategy>) => {
        let existingJson = {};
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                existingJson = JSON.parse(idea.concept);
            }
        } catch {
            existingJson = {};
        }
        onUpdate({ concept: JSON.stringify({ ...existingJson, ...updates }) });
    };

    const handleGenerateAI = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            let conceptContext = {};
            try {
                if (idea.concept && idea.concept.startsWith('{')) {
                    conceptContext = JSON.parse(idea.concept);
                }
            } catch {
                conceptContext = {};
            }

            const result = await generateSocialCampaignStrategyAI(idea, conceptContext, enabledPlatforms, aiInstructions, {
                preferredTone: socialStrategy?.preferredTone,
                brandPillars: socialStrategy?.brandPillars
            });

            const structuredPhases = result.phases.map((phase: any) => {
                const durationStr = (phase.duration || '1 week').toLowerCase();
                const numericMatch = durationStr.match(/(\d+)/);
                const durationValue = numericMatch ? parseInt(numericMatch[1]) : 1;
                let durationUnit: 'Days' | 'Weeks' | 'Months' = 'Days';
                if (durationStr.includes('week')) durationUnit = 'Weeks';
                else if (durationStr.includes('month')) durationUnit = 'Months';

                return {
                    id: Math.random().toString(36).substr(2, 9),
                    name: phase.name,
                    durationValue,
                    durationUnit,
                    focus: phase.focus,
                };
            });

            const structuredPlatforms = result.platforms.map((platform: any) => {
                const freqStr = (platform.frequency || '').toLowerCase();
                const decimalMatch = freqStr.match(/(\d+\.?\d*)/);
                let val = decimalMatch ? parseFloat(decimalMatch[1]) : 3;

                if (freqStr.includes('daily') && !decimalMatch) {
                    val = 1;
                }

                let unit = 'Posts/Week';
                if (freqStr.includes('day') || freqStr.includes('daily')) unit = 'Posts/Day';
                else if (freqStr.includes('month')) unit = 'Posts/Month';

                const frequencyValue = Math.max(1, Math.round(val));

                const phaseFrequencies = (platform.phaseFrequencies || [])
                    .map((phaseFrequency: any) => {
                        const matchedPhase = structuredPhases.find((phaseItem) => phaseItem.name === phaseFrequency.phaseName);
                        if (!matchedPhase) return null;

                        const pfFreqStr = (phaseFrequency.frequency || '').toLowerCase();
                        const pfDecimalMatch = pfFreqStr.match(/(\d+\.?\d*)/);
                        let pfVal = pfDecimalMatch ? parseFloat(pfDecimalMatch[1]) : 3;

                        if (pfFreqStr.includes('daily') && !pfDecimalMatch) {
                            pfVal = 1;
                        }

                        let pfUnit = 'Posts/Week';
                        if (pfFreqStr.includes('day') || pfFreqStr.includes('daily')) pfUnit = 'Posts/Day';
                        else if (pfFreqStr.includes('month')) pfUnit = 'Posts/Month';

                        const pfFrequencyValue = Math.max(1, Math.round(pfVal));

                        return {
                            phaseId: matchedPhase.id,
                            frequencyValue: pfFrequencyValue,
                            frequencyUnit: pfUnit,
                            format: phaseFrequency.format
                        };
                    })
                    .filter(Boolean);

                return {
                    ...platform,
                    frequencyValue,
                    frequencyUnit: unit,
                    phaseFrequencies
                };
            });

            updateStrategy({
                phases: structuredPhases,
                platforms: structuredPlatforms,
                aiSuggestedPlatforms: result.platforms.map((platform: any) => platform.id),
                aiTactics: structuredPlatforms,
                campaignType: result.campaignType,
                subGoal: result.subGoal,
                pillar: result.pillar,
                kpis: result.kpis,
                audienceSegments: result.audienceSegments
            });
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    const handleSuggestAudience = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            const alternatives = await generateAudienceAlternativesAI(idea);
            setAudienceSuggestions(alternatives);
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    const addPhase = () => {
        const newPhase: Phase = {
            id: Math.random().toString(36).substr(2, 9),
            name: '',
            durationValue: 1,
            durationUnit: 'Weeks',
            focus: '',
        };
        updateStrategy({ phases: [...strategyData.phases, newPhase] });
        setEditingPhaseId(newPhase.id);
    };

    const updatePhase = (index: number, field: string, value: any) => {
        const newPhases = [...strategyData.phases];
        newPhases[index] = { ...newPhases[index], [field]: value };
        updateStrategy({ phases: newPhases });
    };

    const removePhase = (index: number) => {
        updateStrategy({ phases: strategyData.phases.filter((_, i) => i !== index) });
        setEditingPhaseId(null);
    };

    const togglePlatform = (platformId: string) => {
        const index = strategyData.platforms.findIndex((platform) => platform.id === platformId);
        if (index >= 0) {
            updateStrategy({ platforms: strategyData.platforms.filter((_, i) => i !== index) });
        } else {
            const aiData = strategyData.aiTactics?.find((platform) => platform.id === platformId);
            const smartDefault = getDefaultPlatformFrequency(platformId);

            const newPlatform = aiData
                ? {
                    id: platformId,
                    role: aiData.role || '',
                    frequencyValue: aiData.frequencyValue,
                    frequencyUnit: aiData.frequencyUnit,
                    phaseFrequencies: aiData.phaseFrequencies || []
                }
                : {
                    id: platformId,
                    role: '',
                    frequencyValue: smartDefault.value,
                    frequencyUnit: smartDefault.unit,
                    phaseFrequencies: []
                };

            updateStrategy({ platforms: [...strategyData.platforms, newPlatform] });
        }
    };

    const hasYouTubeVideo = strategyData.platforms.some((platform) => platform.id === 'YouTube Video');
    const hasYouTubeShorts = strategyData.platforms.some((platform) => platform.id === 'YouTube Shorts');
    const showYouTubeSynergyWarning = hasYouTubeVideo && !hasYouTubeShorts && enabledPlatforms.includes('YouTube Shorts');

    const updatePlatform = (platformId: string, updates: any) => {
        const newPlatforms = strategyData.platforms.map((platform) => {
            if (platform.id === platformId) {
                return { ...platform, ...updates };
            }
            return platform;
        });
        updateStrategy({ platforms: newPlatforms });
    };

    const updatePhaseFrequency = (platformId: string, phaseId: string, frequencyValue: number | undefined, frequencyUnit: string, format?: SocialPostFormat) => {
        const platform = strategyData.platforms.find((entry) => entry.id === platformId);
        if (!platform) return;

        const currentFrequencies = platform.phaseFrequencies || [];
        const existingIndex = currentFrequencies.findIndex((frequency) => frequency.phaseId === phaseId);

        let newFrequencies;
        if (existingIndex >= 0) {
            newFrequencies = [...currentFrequencies];
            newFrequencies[existingIndex] = { phaseId, frequencyValue, frequencyUnit, format };
        } else {
            newFrequencies = [...currentFrequencies, { phaseId, frequencyValue, frequencyUnit, format }];
        }

        updatePlatform(platformId, { phaseFrequencies: newFrequencies });
    };
    const GOALS = [
        { id: 'Brand Awareness', label: t('flowStages.socialCampaignStrategy.goals.brandAwareness') },
        { id: 'Engagement', label: t('flowStages.socialCampaignStrategy.goals.engagement') },
        { id: 'Traffic / Link', label: t('flowStages.socialCampaignStrategy.goals.traffic') },
        { id: 'Sales / Promo', label: t('flowStages.socialCampaignStrategy.goals.sales') },
        { id: 'Community Building', label: t('flowStages.socialCampaignStrategy.goals.community') },
        { id: 'Education', label: t('flowStages.socialCampaignStrategy.goals.education') },
    ];
    const PILLARS = [
        { id: 'Educational', label: t('flowStages.socialCampaignStrategy.pillars.educational') },
        { id: 'Promotional', label: t('flowStages.socialCampaignStrategy.pillars.promotional') },
        { id: 'Entertainment', label: t('flowStages.socialCampaignStrategy.pillars.entertainment') },
        { id: 'Inspirational', label: t('flowStages.socialCampaignStrategy.pillars.inspirational') },
        { id: 'Community', label: t('flowStages.socialCampaignStrategy.pillars.community') },
        { id: 'Behind the Scenes', label: t('flowStages.socialCampaignStrategy.pillars.behindScenes') },
    ];

    const getGoalLabel = (value?: string) => {
        if (!value) return '';
        return GOALS.find((goal) => goal.id === value)?.label || value;
    };

    const getPillarLabel = (value?: string) => {
        if (!value) return '';
        return PILLARS.find((pillar) => pillar.id === value)?.label || value;
    };

    const frequencyUnitLabels: Record<string, string> = {
        'Posts/Day': t('flowStages.socialCampaignStrategy.tactics.frequency.units.day'),
        'Posts/Week': t('flowStages.socialCampaignStrategy.tactics.frequency.units.week'),
        'Posts/Month': t('flowStages.socialCampaignStrategy.tactics.frequency.units.month'),
    };
    const frequencyUnitShortLabels: Record<string, string> = {
        'Posts/Day': t('flowStages.socialCampaignStrategy.tactics.frequency.units.shortDay'),
        'Posts/Week': t('flowStages.socialCampaignStrategy.tactics.frequency.units.shortWeek'),
        'Posts/Month': t('flowStages.socialCampaignStrategy.tactics.frequency.units.shortMonth'),
    };

    const formatFrequencyUnit = (unit?: string) => frequencyUnitLabels[unit || ''] || unit || '';
    const formatFrequencyUnitShort = (unit?: string) => frequencyUnitShortLabels[unit || ''] || unit?.replace('Posts/', '') || '';

    const durationOptions = [
        { label: t('flowStages.socialCampaignStrategy.timeline.units.days'), value: 'Days' },
        { label: t('flowStages.socialCampaignStrategy.timeline.units.weeks'), value: 'Weeks' },
        { label: t('flowStages.socialCampaignStrategy.timeline.units.months'), value: 'Months' },
    ];

    const frequencyOptions = [
        { label: t('flowStages.socialCampaignStrategy.tactics.frequency.units.day'), value: 'Posts/Day' },
        { label: t('flowStages.socialCampaignStrategy.tactics.frequency.units.week'), value: 'Posts/Week' },
        { label: t('flowStages.socialCampaignStrategy.tactics.frequency.units.month'), value: 'Posts/Month' },
    ];

    const frequencyOptionsShort = [
        { label: t('flowStages.socialCampaignStrategy.tactics.frequency.units.shortDay'), value: 'Posts/Day' },
        { label: t('flowStages.socialCampaignStrategy.tactics.frequency.units.shortWeek'), value: 'Posts/Week' },
        { label: t('flowStages.socialCampaignStrategy.tactics.frequency.units.shortMonth'), value: 'Posts/Month' },
    ];

    const secondaryGoalOptions = [
        { label: t('flowStages.socialCampaignStrategy.objectives.secondaryPlaceholder'), value: '' },
        ...GOALS.filter((goal) => goal.id !== strategyData.campaignType).map((goal) => ({
            label: goal.label,
            value: goal.id
        }))
    ];

    const missionText = (
        <p className="flow-social-campaign-strategy__mission">
            "{t('flowStages.socialCampaignStrategy.mission.prefix')} <span className="flow-social-campaign-strategy__mission-highlight">{t('flowStages.socialCampaignStrategy.mission.campaign')}</span>
            {' '}{t('flowStages.socialCampaignStrategy.mission.targeting')} <span className="flow-social-campaign-strategy__mission-highlight">{strategyData.audienceSegments[0] || t('flowStages.socialCampaignStrategy.mission.audienceFallback')}</span>
            {' '}{t('flowStages.socialCampaignStrategy.mission.on')} <span className="flow-social-campaign-strategy__mission-highlight">{strategyData.platforms.length > 0 ? strategyData.platforms.map((platform) => platform.id).join(', ') : t('flowStages.socialCampaignStrategy.mission.channelFallback')}</span>
            {' '}{t('flowStages.socialCampaignStrategy.mission.toDrive')} <span className="flow-social-campaign-strategy__mission-highlight">
                {getGoalLabel(strategyData.campaignType) || t('flowStages.socialCampaignStrategy.mission.goalFallback')}
                {strategyData.subGoal && <span className="flow-social-campaign-strategy__mission-muted">&amp;</span>}
                {strategyData.subGoal ? getGoalLabel(strategyData.subGoal) : ''}
            </span>
            {strategyData.pillar && (
                <> {t('flowStages.socialCampaignStrategy.mission.pillarPrefix')} <span className="flow-social-campaign-strategy__mission-highlight">{getPillarLabel(strategyData.pillar)}</span> {t('flowStages.socialCampaignStrategy.mission.pillarSuffix')}</>
            )}."
        </p>
    );
    return (
        <div className="flow-social-campaign-strategy">
            <div className="flow-social-campaign-strategy__container">
                <div className="flow-social-campaign-strategy__hero">
                    <div className="flow-social-campaign-strategy__hero-glow">
                        <span className="material-symbols-outlined">flag</span>
                    </div>
                    <div className="flow-social-campaign-strategy__hero-content">
                        <div className="flow-social-campaign-strategy__badge">
                            {t('flowStages.socialCampaignStrategy.hero.badge')}
                        </div>
                        <h1 className="flow-social-campaign-strategy__title">{t('flowStages.socialCampaignStrategy.hero.title')}</h1>
                        <div className="flow-social-campaign-strategy__mission-card">
                            {missionText}
                        </div>
                    </div>
                    <div className="flow-social-campaign-strategy__hero-actions">
                        <Button
                            onClick={handleGenerateAI}
                            isLoading={generating}
                            variant="secondary"
                            size="sm"
                            icon={<span className="material-symbols-outlined">auto_awesome</span>}
                        >
                            {generating ? t('flowStages.socialCampaignStrategy.actions.dreaming') : t('flowStages.socialCampaignStrategy.actions.aiSuggest')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`flow-social-campaign-strategy__config-toggle ${showAIConfig ? 'is-active' : ''}`}
                            onClick={() => setShowAIConfig((prev) => !prev)}
                        >
                            {t('flowStages.socialCampaignStrategy.aiConfig.label')}
                        </Button>
                    </div>
                </div>

                {showAIConfig && (
                    <Card className="flow-social-campaign-strategy__ai-config">
                        <div className="flow-social-campaign-strategy__ai-config-header">
                            <span className="material-symbols-outlined">tune</span>
                            <h3>{t('flowStages.socialCampaignStrategy.aiConfig.label')}</h3>
                        </div>
                        <TextArea
                            className="flow-social-campaign-strategy__ai-config-input"
                            placeholder={t('flowStages.socialCampaignStrategy.aiConfig.placeholder')}
                            value={aiInstructions}
                            onChange={(e) => setAiInstructions(e.target.value)}
                        />
                        <div className="flow-social-campaign-strategy__ai-config-actions">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAIConfig(false)}
                            >
                                {t('flowStages.socialCampaignStrategy.aiConfig.cancel')}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    handleGenerateAI();
                                    setShowAIConfig(false);
                                }}
                                isLoading={generating}
                            >
                                {t('flowStages.socialCampaignStrategy.aiConfig.run')}
                            </Button>
                        </div>
                    </Card>
                )}

                <div className="flow-social-campaign-strategy__layout">
                    <div className="flow-social-campaign-strategy__main">
                        <Card className="flow-social-campaign-strategy__panel flow-social-campaign-strategy__timeline">
                            <div className="flow-social-campaign-strategy__panel-header">
                                <div>
                                    <h3>{t('flowStages.socialCampaignStrategy.timeline.title')}</h3>
                                    <p>{t('flowStages.socialCampaignStrategy.timeline.subtitle')}</p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={addPhase}
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('flowStages.socialCampaignStrategy.timeline.addPhase')}
                                </Button>
                            </div>
                            {strategyData.phases.length === 0 ? (
                                <div className="flow-social-campaign-strategy__empty">
                                    <span className="material-symbols-outlined">timeline</span>
                                    <h4>{t('flowStages.socialCampaignStrategy.timeline.empty.title')}</h4>
                                    <p>{t('flowStages.socialCampaignStrategy.timeline.empty.subtitle')}</p>
                                </div>
                            ) : (
                                <div className="flow-social-campaign-strategy__phase-list">
                                    {strategyData.phases.map((phase, index) => {
                                        const isEditing = editingPhaseId === phase.id;
                                        const tone = getPhaseTone(index);

                                        return (
                                            <div
                                                key={phase.id}
                                                className={`flow-social-campaign-strategy__phase ${isEditing ? 'is-editing' : ''}`}
                                                data-tone={tone}
                                                onClick={() => !isEditing && setEditingPhaseId(phase.id)}
                                            >
                                                <div className="flow-social-campaign-strategy__phase-index">{index + 1}</div>
                                                <div className="flow-social-campaign-strategy__phase-body">
                                                    {isEditing ? (
                                                        <div className="flow-social-campaign-strategy__phase-form">
                                                            <div className="flow-social-campaign-strategy__phase-row">
                                                                <TextInput
                                                                    value={phase.name}
                                                                    onChange={(e) => updatePhase(index, 'name', e.target.value)}
                                                                    placeholder={t('flowStages.socialCampaignStrategy.timeline.phaseNamePlaceholder')}
                                                                    className="flow-social-campaign-strategy__phase-input"
                                                                    autoFocus
                                                                />
                                                                <div className="flow-social-campaign-strategy__phase-duration">
                                                                    <TextInput
                                                                        type="number"
                                                                        min={1}
                                                                        value={phase.durationValue}
                                                                        onChange={(e) => updatePhase(index, 'durationValue', parseInt(e.target.value) || 1)}
                                                                        className="flow-social-campaign-strategy__phase-input flow-social-campaign-strategy__phase-input--number"
                                                                    />
                                                                    <Select
                                                                        value={phase.durationUnit}
                                                                        onChange={(value) => updatePhase(index, 'durationUnit', value)}
                                                                        options={durationOptions}
                                                                        className="flow-social-campaign-strategy__phase-select"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <TextArea
                                                                value={phase.focus}
                                                                onChange={(e) => updatePhase(index, 'focus', e.target.value)}
                                                                placeholder={t('flowStages.socialCampaignStrategy.timeline.focusPlaceholder')}
                                                                className="flow-social-campaign-strategy__phase-textarea"
                                                            />
                                                            <div className="flow-social-campaign-strategy__phase-actions">
                                                                <button
                                                                    type="button"
                                                                    className="flow-social-campaign-strategy__phase-delete"
                                                                    onClick={() => removePhase(index)}
                                                                >
                                                                    <span className="material-symbols-outlined">delete</span>
                                                                    {t('flowStages.socialCampaignStrategy.timeline.deletePhase')}
                                                                </button>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => setEditingPhaseId(null)}
                                                                >
                                                                    {t('flowStages.socialCampaignStrategy.timeline.savePhase')}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flow-social-campaign-strategy__phase-summary">
                                                            <div className="flow-social-campaign-strategy__phase-title-row">
                                                                <h4>{phase.name || t('flowStages.socialCampaignStrategy.timeline.untitledPhase')}</h4>
                                                                <span className="flow-social-campaign-strategy__phase-duration-pill">
                                                                    {phase.durationValue} {phase.durationUnit}
                                                                </span>
                                                            </div>
                                                            <p>{phase.focus || t('flowStages.socialCampaignStrategy.timeline.focusEmpty')}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                        <Card className="flow-social-campaign-strategy__panel flow-social-campaign-strategy__tactics">
                            <div className="flow-social-campaign-strategy__panel-header">
                                <div>
                                    <h3>{t('flowStages.socialCampaignStrategy.tactics.title')}</h3>
                                    <p>{t('flowStages.socialCampaignStrategy.tactics.totalReach')}</p>
                                </div>
                                <div className="flow-social-campaign-strategy__tactics-meta">
                                    <span>{t('flowStages.socialCampaignStrategy.tactics.postCount').replace('{count}', `${totalCampaignPosts}`)}</span>
                                    <span className="flow-social-campaign-strategy__tactics-label">{t('flowStages.socialCampaignStrategy.tactics.postsLabel')}</span>
                                </div>
                            </div>

                            {strategyData.platforms.length === 0 ? (
                                <div className="flow-social-campaign-strategy__empty">
                                    <span className="material-symbols-outlined">hourglass_bottom</span>
                                    <h4>{t('flowStages.socialCampaignStrategy.tactics.empty')}</h4>
                                </div>
                            ) : (
                                <div className="flow-social-campaign-strategy__platform-grid">
                                    {strategyData.platforms.map((platform) => {
                                        const isEditing = editingPlatformId === platform.id;
                                        const hasAdvanced = !!platform.phaseFrequencies && platform.phaseFrequencies.length > 0;

                                        return (
                                            <div
                                                key={platform.id}
                                                className={`flow-social-campaign-strategy__platform ${isEditing ? 'is-editing' : ''}`}
                                                onClick={() => !isEditing && setEditingPlatformId(platform.id)}
                                            >
                                                <div className="flow-social-campaign-strategy__platform-header">
                                                    <div className="flow-social-campaign-strategy__platform-id">
                                                        <div className="flow-social-campaign-strategy__platform-icon">
                                                            <PlatformIcon platform={platform.id as SocialPlatform} />
                                                        </div>
                                                        <span>{platform.id}</span>
                                                    </div>
                                                    <div className="flow-social-campaign-strategy__platform-count">
                                                        <span>{calculatePlatformTotal(platform, strategyData.phases)}</span>
                                                        <span>{t('flowStages.socialCampaignStrategy.tactics.postsLabel')}</span>
                                                    </div>
                                                </div>

                                                {isEditing ? (
                                                    <div className="flow-social-campaign-strategy__platform-form">
                                                        <div className="flow-social-campaign-strategy__field">
                                                            <label>{t('flowStages.socialCampaignStrategy.tactics.role.label')}</label>
                                                            <TextArea
                                                                value={platform.role}
                                                                onChange={(e) => updatePlatform(platform.id, { role: e.target.value })}
                                                                placeholder={t('flowStages.socialCampaignStrategy.tactics.role.placeholder')}
                                                                className="flow-social-campaign-strategy__platform-textarea"
                                                            />
                                                        </div>

                                                        <div className="flow-social-campaign-strategy__field">
                                                            <div className="flow-social-campaign-strategy__field-header">
                                                                <label>{t('flowStages.socialCampaignStrategy.tactics.frequency.label')}</label>
                                                                <div className="flow-social-campaign-strategy__frequency-toggle">
                                                                    <button
                                                                        type="button"
                                                                        className={!hasAdvanced ? 'is-active' : ''}
                                                                        onClick={() => updatePlatform(platform.id, { phaseFrequencies: [] })}
                                                                    >
                                                                        {t('flowStages.socialCampaignStrategy.tactics.frequency.simple')}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className={hasAdvanced ? 'is-active' : ''}
                                                                        onClick={() => {
                                                                            if (!hasAdvanced) {
                                                                                const initial = strategyData.phases.map((phase) => ({
                                                                                    phaseId: phase.id,
                                                                                    frequencyValue: platform.frequencyValue || 1,
                                                                                    frequencyUnit: platform.frequencyUnit || 'Posts/Week'
                                                                                }));
                                                                                updatePlatform(platform.id, { phaseFrequencies: initial });
                                                                            }
                                                                        }}
                                                                    >
                                                                        {t('flowStages.socialCampaignStrategy.tactics.frequency.advanced')}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {!hasAdvanced && (
                                                                <div className="flow-social-campaign-strategy__format-row">
                                                                    <div className="flow-social-campaign-strategy__format-list">
                                                                        {(PLATFORM_FORMATS[getBasePlatform(platform.id)] || []).map((format) => (
                                                                            <button
                                                                                key={format}
                                                                                type="button"
                                                                                onClick={() => updatePlatform(platform.id, { format })}
                                                                                className={platform.format === format ? 'is-active' : ''}
                                                                            >
                                                                                {format}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {!hasAdvanced ? (
                                                                <div className="flow-social-campaign-strategy__frequency-row">
                                                                    <TextInput
                                                                        type="number"
                                                                        min={1}
                                                                        value={platform.frequencyValue ?? ''}
                                                                        onChange={(e) => updatePlatform(platform.id, { frequencyValue: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                                                                        placeholder={t('flowStages.socialCampaignStrategy.tactics.frequency.placeholder')}
                                                                        className="flow-social-campaign-strategy__platform-input"
                                                                    />
                                                                    <Select
                                                                        value={platform.frequencyUnit || 'Posts/Week'}
                                                                        onChange={(value) => updatePlatform(platform.id, { frequencyUnit: value })}
                                                                        options={frequencyOptions}
                                                                        className="flow-social-campaign-strategy__platform-select"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="flow-social-campaign-strategy__frequency-advanced">
                                                                    {strategyData.phases.map((phase, phaseIndex) => {
                                                                        const phaseFrequency = platform.phaseFrequencies?.find((entry) => entry.phaseId === phase.id);
                                                                        const val = phaseFrequency ? phaseFrequency.frequencyValue : platform.frequencyValue ?? 1;
                                                                        const unit = phaseFrequency ? phaseFrequency.frequencyUnit : platform.frequencyUnit ?? 'Posts/Week';
                                                                        const tone = getPhaseTone(phaseIndex);

                                                                        return (
                                                                            <div key={phase.id} className="flow-social-campaign-strategy__phase-frequency" data-tone={tone}>
                                                                                <div className="flow-social-campaign-strategy__phase-frequency-header">
                                                                                    <span>{phase.name || t('flowStages.socialCampaignStrategy.timeline.untitledPhase')}</span>
                                                                                    <div className="flow-social-campaign-strategy__phase-frequency-inputs">
                                                                                        <TextInput
                                                                                            type="number"
                                                                                            min={1}
                                                                                            value={val ?? ''}
                                                                                            onChange={(e) => updatePhaseFrequency(platform.id, phase.id, e.target.value === '' ? undefined : parseInt(e.target.value), unit || 'Posts/Week', phaseFrequency?.format)}
                                                                                            className="flow-social-campaign-strategy__platform-input"
                                                                                        />
                                                                                        <Select
                                                                                            value={unit}
                                                                                            onChange={(value) => updatePhaseFrequency(platform.id, phase.id, val || 1, String(value), phaseFrequency?.format)}
                                                                                            options={frequencyOptionsShort}
                                                                                            className="flow-social-campaign-strategy__platform-select"
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flow-social-campaign-strategy__format-list">
                                                                                    {(PLATFORM_FORMATS[getBasePlatform(platform.id)] || []).map((format) => (
                                                                                        <button
                                                                                            key={format}
                                                                                            type="button"
                                                                                            onClick={() => updatePhaseFrequency(platform.id, phase.id, val || 1, unit || 'Posts/Week', format)}
                                                                                            className={phaseFrequency?.format === format ? 'is-active' : ''}
                                                                                        >
                                                                                            {format}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flow-social-campaign-strategy__platform-actions">
                                                            <button
                                                                type="button"
                                                                className="flow-social-campaign-strategy__platform-remove"
                                                                onClick={() => {
                                                                    togglePlatform(platform.id);
                                                                    setEditingPlatformId(null);
                                                                }}
                                                            >
                                                                <span className="material-symbols-outlined">delete</span>
                                                                {t('flowStages.socialCampaignStrategy.tactics.remove')}
                                                            </button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => setEditingPlatformId(null)}
                                                            >
                                                                {t('flowStages.socialCampaignStrategy.tactics.save')}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flow-social-campaign-strategy__platform-summary">
                                                        <div className="flow-social-campaign-strategy__platform-role">
                                                            <span>{t('flowStages.socialCampaignStrategy.tactics.role.label')}</span>
                                                            <p>{platform.role || t('flowStages.socialCampaignStrategy.tactics.role.empty')}</p>
                                                        </div>
                                                        <div className="flow-social-campaign-strategy__platform-frequency">
                                                            {hasAdvanced ? (
                                                                <div className="flow-social-campaign-strategy__frequency-list">
                                                                    {platform.phaseFrequencies?.map((phaseFrequency) => {
                                                                        const phase = strategyData.phases.find((entry) => entry.id === phaseFrequency.phaseId);
                                                                        if (!phase) return null;
                                                                        const phaseIndex = strategyData.phases.findIndex((entry) => entry.id === phaseFrequency.phaseId);
                                                                        const tone = getPhaseTone(phaseIndex);

                                                                        return (
                                                                            <div key={phaseFrequency.phaseId} className="flow-social-campaign-strategy__frequency-item" data-tone={tone}>
                                                                                <span>{phase.name || t('flowStages.socialCampaignStrategy.timeline.untitledPhase')}</span>
                                                                                <div>
                                                                                    {phaseFrequency.frequencyValue} {formatFrequencyUnitShort(phaseFrequency.frequencyUnit)}
                                                                                    {phaseFrequency.format && <span className="flow-social-campaign-strategy__format-label">{phaseFrequency.format}</span>}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="flow-social-campaign-strategy__frequency-pill">
                                                                    <span>
                                                                        {platform.frequencyValue} {formatFrequencyUnit(platform.frequencyUnit)}
                                                                    </span>
                                                                    {platform.format && <span>{platform.format}</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                    </div>
                    <div className="flow-social-campaign-strategy__sidebar">
                        <Card className="flow-social-campaign-strategy__panel flow-social-campaign-strategy__channels">
                            <div className="flow-social-campaign-strategy__panel-header">
                                <div>
                                    <h3>{t('flowStages.socialCampaignStrategy.brief.channels.title')}</h3>
                                    <p>{t('flowStages.socialCampaignStrategy.brief.title')}</p>
                                </div>
                            </div>
                            <div className="flow-social-campaign-strategy__channel-grid">
                                {enabledPlatforms.map((channel) => {
                                    const isAdded = strategyData.platforms.find((platform) => platform.id === channel);
                                    const isRecommended = strategyData.aiSuggestedPlatforms?.includes(channel);

                                    return (
                                        <button
                                            key={channel}
                                            type="button"
                                            className={`flow-social-campaign-strategy__channel ${isAdded ? 'is-active' : ''}`}
                                            data-recommended={isRecommended ? 'true' : 'false'}
                                            onClick={() => togglePlatform(channel)}
                                        >
                                            <span className="flow-social-campaign-strategy__channel-icon">
                                                <PlatformIcon platform={channel} />
                                            </span>
                                            <span className="flow-social-campaign-strategy__channel-label">{channel}</span>
                                            {isAdded && (
                                                <span className="material-symbols-outlined flow-social-campaign-strategy__channel-check">check</span>
                                            )}
                                            {isRecommended && (
                                                <span className="flow-social-campaign-strategy__channel-badge">
                                                    {t('flowStages.socialCampaignStrategy.brief.channels.aiRec')}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {showYouTubeSynergyWarning && (
                                <div className="flow-social-campaign-strategy__synergy">
                                    <span className="material-symbols-outlined">tips_and_updates</span>
                                    <div>
                                        <h4>{t('flowStages.socialCampaignStrategy.brief.channels.youtube.title')}</h4>
                                        <p>{t('flowStages.socialCampaignStrategy.brief.channels.youtube.message')}</p>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => togglePlatform('YouTube Shorts')}
                                            icon={<span className="material-symbols-outlined">add</span>}
                                        >
                                            {t('flowStages.socialCampaignStrategy.brief.channels.youtube.action')}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>

                        <Card className="flow-social-campaign-strategy__panel flow-social-campaign-strategy__objectives">
                            <div className="flow-social-campaign-strategy__panel-header">
                                <h3>{t('flowStages.socialCampaignStrategy.objectives.title')}</h3>
                            </div>

                            <div className="flow-social-campaign-strategy__objective-group">
                                <label className="flow-social-campaign-strategy__label">
                                    {t('flowStages.socialCampaignStrategy.objectives.primary')}
                                </label>
                                <div className="flow-social-campaign-strategy__option-grid">
                                    {GOALS.map((goal) => (
                                        <button
                                            key={goal.id}
                                            type="button"
                                            className={`flow-social-campaign-strategy__option ${strategyData.campaignType === goal.id ? 'is-active' : ''}`}
                                            onClick={() => updateStrategy({ campaignType: goal.id })}
                                        >
                                            {goal.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flow-social-campaign-strategy__objective-group">
                                <Select
                                    label={t('flowStages.socialCampaignStrategy.objectives.secondary')}
                                    value={strategyData.subGoal || ''}
                                    onChange={(value) => updateStrategy({ subGoal: String(value) })}
                                    options={secondaryGoalOptions}
                                    className="flow-social-campaign-strategy__select"
                                />
                            </div>

                            <div className="flow-social-campaign-strategy__objective-group">
                                <label className="flow-social-campaign-strategy__label">
                                    {t('flowStages.socialCampaignStrategy.objectives.pillar')}
                                </label>
                                <div className="flow-social-campaign-strategy__option-grid">
                                    {PILLARS.map((pillar) => (
                                        <button
                                            key={pillar.id}
                                            type="button"
                                            className={`flow-social-campaign-strategy__option ${strategyData.pillar === pillar.id ? 'is-active' : ''}`}
                                            onClick={() => updateStrategy({ pillar: pillar.id })}
                                        >
                                            {pillar.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </Card>
                        <Card className="flow-social-campaign-strategy__panel flow-social-campaign-strategy__audience">
                            <div className="flow-social-campaign-strategy__panel-header">
                                <div>
                                    <h3>{t('flowStages.socialCampaignStrategy.audience.title')}</h3>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleSuggestAudience}
                                    isLoading={generating}
                                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                                >
                                    {t('flowStages.socialCampaignStrategy.audience.aiSuggest')}
                                </Button>
                            </div>

                            <div className="flow-social-campaign-strategy__audience-list">
                                {strategyData.audienceSegments.map((segment, index) => {
                                    const isEditing = editingAudienceIndex === index;

                                    return (
                                        <div
                                            key={index}
                                            className={`flow-social-campaign-strategy__audience-item ${isEditing ? 'is-editing' : ''}`}
                                            onClick={() => !isEditing && setEditingAudienceIndex(index)}
                                        >
                                            {isEditing ? (
                                                <div className="flow-social-campaign-strategy__audience-edit">
                                                    <TextArea
                                                        value={segment}
                                                        onChange={(e) => {
                                                            const newSegments = [...strategyData.audienceSegments];
                                                            newSegments[index] = e.target.value;
                                                            updateStrategy({ audienceSegments: newSegments });
                                                        }}
                                                        placeholder={t('flowStages.socialCampaignStrategy.audience.placeholder')}
                                                        className="flow-social-campaign-strategy__audience-textarea"
                                                    />
                                                    <div className="flow-social-campaign-strategy__audience-actions">
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                updateStrategy({ audienceSegments: strategyData.audienceSegments.filter((_, idx) => idx !== index) });
                                                                setEditingAudienceIndex(null);
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined">delete</span>
                                                            {t('flowStages.socialCampaignStrategy.audience.remove')}
                                                        </button>
                                                        <Button
                                                            size="sm"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setEditingAudienceIndex(null);
                                                            }}
                                                        >
                                                            {t('flowStages.socialCampaignStrategy.audience.save')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flow-social-campaign-strategy__audience-summary">
                                                    <p>
                                                        {segment || (
                                                            <span className="flow-social-campaign-strategy__audience-empty">
                                                                {t('flowStages.socialCampaignStrategy.audience.emptySegment')}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <span className="material-symbols-outlined">edit</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    className="flow-social-campaign-strategy__audience-add"
                                    onClick={() => {
                                        const newSegments = [...strategyData.audienceSegments, ''];
                                        updateStrategy({ audienceSegments: newSegments });
                                        setEditingAudienceIndex(newSegments.length - 1);
                                    }}
                                >
                                    <span className="material-symbols-outlined">add_circle</span>
                                    {t('flowStages.socialCampaignStrategy.audience.add')}
                                </button>

                                {audienceSuggestions.length > 0 && (
                                    <div className="flow-social-campaign-strategy__suggestions">
                                        <div className="flow-social-campaign-strategy__suggestions-header">
                                            <span>{t('flowStages.socialCampaignStrategy.audience.aiAlternatives')}</span>
                                            <button type="button" onClick={() => setAudienceSuggestions([])}>
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                        <div className="flow-social-campaign-strategy__suggestions-list">
                                            {audienceSuggestions.map((suggestion, suggestionIndex) => (
                                                <div key={suggestionIndex} className="flow-social-campaign-strategy__suggestion">
                                                    <button
                                                        type="button"
                                                        className="flow-social-campaign-strategy__suggestion-main"
                                                        onClick={() => {
                                                            const newSegments = [...strategyData.audienceSegments];
                                                            let targetIdx = editingAudienceIndex;
                                                            if (targetIdx === null) {
                                                                const emptyIdx = newSegments.findIndex((entry) => !entry || entry.trim() === '');
                                                                if (emptyIdx !== -1) targetIdx = emptyIdx;
                                                            }
                                                            if (targetIdx !== null) {
                                                                newSegments[targetIdx] = suggestion;
                                                                updateStrategy({ audienceSegments: newSegments });
                                                            } else {
                                                                updateStrategy({ audienceSegments: [...newSegments, suggestion] });
                                                                targetIdx = newSegments.length;
                                                            }
                                                            setAudienceSuggestions(audienceSuggestions.filter((_, idx) => idx !== suggestionIndex));
                                                            setEditingAudienceIndex(targetIdx);
                                                        }}
                                                        title={t('flowStages.socialCampaignStrategy.audience.replace')}
                                                    >
                                                        {suggestion}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="flow-social-campaign-strategy__suggestion-add"
                                                        onClick={() => {
                                                            updateStrategy({ audienceSegments: [...strategyData.audienceSegments, suggestion] });
                                                            setAudienceSuggestions(audienceSuggestions.filter((_, idx) => idx !== suggestionIndex));
                                                            setEditingAudienceIndex(strategyData.audienceSegments.length);
                                                        }}
                                                        title={t('flowStages.socialCampaignStrategy.audience.addNew')}
                                                    >
                                                        <span className="material-symbols-outlined">add</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        {strategyData.audienceSegments.length > 0 && (
                                            <button
                                                type="button"
                                                className="flow-social-campaign-strategy__suggestions-clear"
                                                onClick={() => {
                                                    updateStrategy({ audienceSegments: [] });
                                                    setEditingAudienceIndex(null);
                                                }}
                                            >
                                                {t('flowStages.socialCampaignStrategy.audience.clear')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card>

                        <div className="flow-social-campaign-strategy__footer">
                            <Button
                                className="flow-social-campaign-strategy__advance"
                                onClick={() => onUpdate({ stage: 'Planning' })}
                                icon={<span className="material-symbols-outlined">arrow_forward</span>}
                                iconPosition="right"
                            >
                                {t('flowStages.socialCampaignStrategy.actions.advance')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
