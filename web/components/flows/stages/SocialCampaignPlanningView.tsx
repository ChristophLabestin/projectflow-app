import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { Idea, SocialPlatform, SocialPostFormat } from '../../../types';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { PLATFORM_FORMATS } from '../constants';
import {
    generateCampaignWeekPlanAI,
    PostPlaceholder
} from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialCampaignPlanningViewProps {
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

interface Platform {
    id: string;
    role: string;
    frequencyValue?: number;
    frequencyUnit?: string;
    frequency?: string;
    phaseFrequencies?: { phaseId: string; frequencyValue?: number; frequencyUnit: string }[];
}

interface PlanningData {
    posts: PostPlaceholder[];
}

const CONTENT_TYPES: { id: SocialPostFormat; icon: string; labelKey: string; tone: string }[] = [
    { id: 'Post', icon: 'image', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.post', tone: 'primary' },
    { id: 'Reel', icon: 'play_circle', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.reel', tone: 'warning' },
    { id: 'Story', icon: 'auto_stories', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.story', tone: 'neutral' },
    { id: 'Carousel', icon: 'view_carousel', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.carousel', tone: 'success' },
    { id: 'Short', icon: 'movie', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.short', tone: 'warning' },
    { id: 'Video', icon: 'videocam', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.video', tone: 'warning' },
    { id: 'Text', icon: 'text_fields', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.text', tone: 'neutral' },
];

const PHASE_TONES = ['primary', 'warning', 'success', 'neutral', 'danger'] as const;

const getBasePlatform = (platformId: string): SocialPlatform => {
    if (platformId === 'YouTube Video' || platformId === 'YouTube Shorts') return 'YouTube';
    return platformId as SocialPlatform;
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

const calculatePlatformTargets = (platform: Platform, phases: Phase[]): { perWeek: number; total: number; label: string } => {
    if (phases.length === 0) {
        const val = platform.frequencyValue || 3;
        const perWeek = platform.frequencyUnit === 'Posts/Day'
            ? val * 7
            : platform.frequencyUnit === 'Posts/Month'
                ? val / 4
                : val;
        return {
            perWeek: Math.round(perWeek * 10) / 10,
            total: Math.ceil(perWeek * 2),
            label: `${val} ${platform.frequencyUnit?.replace('Posts/', '') || '/wk'}`
        };
    }

    let totalPosts = 0;
    let weightedWeeklySum = 0;
    let totalDays = 0;

    phases.forEach((phase) => {
        const days = phaseToDays(phase);
        totalDays += days;

        const override = platform.phaseFrequencies?.find((phaseFrequency) => phaseFrequency.phaseId === phase.id);

        let freqVal = platform.frequencyValue || 3;
        let freqUnit = platform.frequencyUnit || 'Posts/Week';

        if (override) {
            freqVal = override.frequencyValue || 1;
            freqUnit = override.frequencyUnit;
        }

        let postsPerDay = 0;
        if (freqUnit === 'Posts/Day') postsPerDay = freqVal;
        else if (freqUnit === 'Posts/Week') postsPerDay = freqVal / 7;
        else if (freqUnit === 'Posts/Month') postsPerDay = freqVal / 30;

        totalPosts += postsPerDay * days;
        weightedWeeklySum += (postsPerDay * 7) * days;
    });

    const averagePerWeek = totalDays > 0 ? weightedWeeklySum / totalDays : 0;

    let label = `${platform.frequencyValue || 3} ${platform.frequencyUnit?.replace('Posts/', '') || '/wk'}`;
    if (platform.phaseFrequencies && platform.phaseFrequencies.length > 0) {
        label = 'Variable';
    }

    return {
        perWeek: Math.round(averagePerWeek * 10) / 10,
        total: Math.ceil(totalPosts),
        label
    };
};

export const SocialCampaignPlanningView: React.FC<SocialCampaignPlanningViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);
    const [genProgress, setGenProgress] = useState(0);
    const [genStage, setGenStage] = useState('');
    const progressRef = useRef<NodeJS.Timeout | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
    const [dragOverDay, setDragOverDay] = useState<number | null>(null);
    const contentTypes = useMemo(() => CONTENT_TYPES.map(type => ({ ...type, label: t(type.labelKey) })), [t]);
    const contentTypeById = useMemo(() => new Map(contentTypes.map(type => [type.id, type])), [contentTypes]);
    const frequencyUnitShortLabels: Record<string, string> = {
        'Posts/Day': t('flowStages.socialCampaignPlanning.frequencyUnits.day'),
        'Posts/Week': t('flowStages.socialCampaignPlanning.frequencyUnits.week'),
        'Posts/Month': t('flowStages.socialCampaignPlanning.frequencyUnits.month'),
    };
    const formatFrequencyUnitShort = (unit?: string) => frequencyUnitShortLabels[unit || ''] || unit?.replace('Posts/', '') || '';

    useEffect(() => {
        if (generating) {
            setGenProgress(0);
            setGenStage(t('flowStages.socialCampaignPlanning.generate.initial'));
            const stages = [
                { at: 10, text: t('flowStages.socialCampaignPlanning.generate.readingGoals') },
                { at: 25, text: t('flowStages.socialCampaignPlanning.generate.analyzingFrequencies') },
                { at: 40, text: t('flowStages.socialCampaignPlanning.generate.planningThemes') },
                { at: 55, text: t('flowStages.socialCampaignPlanning.generate.scheduling') },
                { at: 70, text: t('flowStages.socialCampaignPlanning.generate.generatingHooks') },
                { at: 85, text: t('flowStages.socialCampaignPlanning.generate.finalizing') },
            ];
            let progress = 0;
            progressRef.current = setInterval(() => {
                progress += Math.random() * 3 + 1;
                if (progress > 92) progress = 92;
                setGenProgress(progress);
                const stage = stages.find(stageItem => stageItem.at <= progress && stages.indexOf(stageItem) === stages.filter(filtered => filtered.at <= progress).length - 1);
                if (stage) setGenStage(stage.text);
            }, 200);
        } else {
            if (progressRef.current) {
                clearInterval(progressRef.current);
                progressRef.current = null;
            }
            if (genProgress > 0) {
                setGenProgress(100);
                setGenStage(t('flowStages.socialCampaignPlanning.generate.done'));
                setTimeout(() => {
                    setGenProgress(0);
                    setGenStage('');
                }, 1000);
            }
        }
        return () => {
            if (progressRef.current) clearInterval(progressRef.current);
        };
    }, [generating, t]);

    const strategyData = useMemo(() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                const phases: Phase[] = Array.isArray(parsed.phases)
                    ? parsed.phases.map((phase: any) => ({
                        id: phase.id || Math.random().toString(36).substr(2, 9),
                        name: phase.name || 'Phase',
                        durationValue: phase.durationValue || parseInt(phase.duration) || 1,
                        durationUnit: phase.durationUnit || 'Weeks',
                        focus: phase.focus || '',
                    }))
                    : [];

                const platforms: Platform[] = Array.isArray(parsed.platforms)
                    ? parsed.platforms.map((platform: any) => {
                        let frequencyValue = platform.frequencyValue;
                        let frequencyUnit = platform.frequencyUnit || 'Posts/Week';
                        if (frequencyValue === undefined && platform.frequency) {
                            const match = platform.frequency.match(/(\d+)/);
                            if (match) frequencyValue = parseInt(match[1]);
                            const freqLower = platform.frequency.toLowerCase();
                            if (freqLower.includes('day')) frequencyUnit = 'Posts/Day';
                            else if (freqLower.includes('month')) frequencyUnit = 'Posts/Month';
                        }

                        const phaseFrequencies = Array.isArray(platform.phaseFrequencies) ? platform.phaseFrequencies : [];

                        return { ...platform, frequencyValue: frequencyValue || 3, frequencyUnit, phaseFrequencies };
                    })
                    : [];

                return { phases, platforms, audienceSegments: parsed.audienceSegments || [], campaignType: parsed.campaignType || 'Engagement' };
            }
        } catch {
            return { phases: [] as Phase[], platforms: [] as Platform[], audienceSegments: [] as string[], campaignType: 'Engagement' };
        }
        return { phases: [] as Phase[], platforms: [] as Platform[], audienceSegments: [] as string[], campaignType: 'Engagement' };
    }, [idea.concept]);

    const campaignMetrics = useMemo(() => {
        const totalDays = strategyData.phases.length > 0
            ? strategyData.phases.reduce((sum, phase) => sum + phaseToDays(phase), 0)
            : 14;
        const totalWeeks = Math.ceil(totalDays / 7);
        const platformTargets = strategyData.platforms.map((platform) => ({ ...platform, ...calculatePlatformTargets(platform, strategyData.phases) }));
        const totalTargetPosts = platformTargets.reduce((sum, platform) => sum + platform.total, 0);
        return { totalDays, totalWeeks, platformTargets, totalTargetPosts };
    }, [strategyData]);

    const phaseRanges = useMemo(() => {
        let startDay = 0;
        return strategyData.phases.map((phase, index) => {
            const days = phaseToDays(phase);
            const tone = PHASE_TONES[index % PHASE_TONES.length];
            const range = { phase, startDay, endDay: startDay + days - 1, tone };
            startDay += days;
            return range;
        });
    }, [strategyData.phases]);

    const planningData: PlanningData = useMemo(() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return { posts: Array.isArray(parsed.planningPosts) ? parsed.planningPosts : [] };
            }
        } catch {
            return { posts: [] };
        }
        return { posts: [] };
    }, [idea.concept]);

    const updatePlanningData = useCallback((updates: Partial<PlanningData>) => {
        let existingJson: any = {};
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                existingJson = JSON.parse(idea.concept);
            }
        } catch {
            existingJson = {};
        }
        const newData = { ...existingJson, planningPosts: updates.posts ?? existingJson.planningPosts };
        onUpdate({ concept: JSON.stringify(newData) });
    }, [idea.concept, onUpdate]);
    const weekData = useMemo(() => {
        const startDay = weekOffset * 7;
        const days = Array.from({ length: 7 }, (_, i) => {
            const dayOffset = startDay + i;
            const isInCampaign = dayOffset < campaignMetrics.totalDays;
            const phase = phaseRanges.find(range => dayOffset >= range.startDay && dayOffset <= range.endDay);
            const posts = planningData.posts.filter(post => post.dayOffset === dayOffset);
            return { dayOffset, dayNum: dayOffset + 1, isInCampaign, phase, posts };
        });
        const postsThisWeek = days.reduce((sum, day) => sum + day.posts.length, 0);
        return { days, postsThisWeek };
    }, [weekOffset, campaignMetrics.totalDays, phaseRanges, planningData.posts]);

    const handleGeneratePlan = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            const platformFrequencies = campaignMetrics.platformTargets.map(platform => ({
                platform: platform.id,
                postsPerWeek: platform.perWeek,
                totalPosts: platform.total,
            }));

            const posts = await generateCampaignWeekPlanAI(idea, {
                ...strategyData,
                totalDays: campaignMetrics.totalDays,
                totalWeeks: campaignMetrics.totalWeeks,
                targetPosts: campaignMetrics.totalTargetPosts,
                platformFrequencies,
                phaseRanges: phaseRanges.map(range => ({
                    name: range.phase.name,
                    startDay: range.startDay,
                    endDay: range.endDay,
                    focus: range.phase.focus,
                })),
            } as any, 0);
            updatePlanningData({ posts: posts.filter(post => post.dayOffset < campaignMetrics.totalDays) });
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    const addPost = (dayOffset: number) => {
        const newPost: PostPlaceholder = {
            id: Math.random().toString(36).substr(2, 9),
            dayOffset,
            platforms: strategyData.platforms.slice(0, 1).map(platform => platform.id),
            contentType: 'Post',
            hook: '',
            status: 'empty',
        };
        updatePlanningData({ posts: [...planningData.posts, newPost] });
        setSelectedPostId(newPost.id);
    };

    const updatePost = (id: string, updates: Partial<PostPlaceholder>) => {
        updatePlanningData({ posts: planningData.posts.map(post => post.id === id ? { ...post, ...updates } : post) });
    };

    const deletePost = (id: string) => {
        updatePlanningData({ posts: planningData.posts.filter(post => post.id !== id) });
        setSelectedPostId(null);
    };

    const handleDragStart = (event: React.DragEvent, postId: string) => {
        setDraggedPostId(postId);
        event.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (event: React.DragEvent, dayOffset: number) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOverDay(dayOffset);
    };

    const handleDragLeave = () => {
        setDragOverDay(null);
    };

    const handleDrop = (event: React.DragEvent, targetDayOffset: number) => {
        event.preventDefault();
        setDragOverDay(null);
        if (draggedPostId) {
            updatePost(draggedPostId, { dayOffset: targetDayOffset });
            setDraggedPostId(null);
        }
    };

    const handleDragEnd = () => {
        setDraggedPostId(null);
        setDragOverDay(null);
    };

    const selectedPost = planningData.posts.find(post => post.id === selectedPostId);
    const totalPlanned = planningData.posts.length;
    const channelList = strategyData.platforms.map(platform => platform.id).join(', ') || t('flowStages.socialCampaignPlanning.hero.channelsFallback');
    const missionPlanned = t('flowStages.socialCampaignPlanning.hero.mission.planned')
        .replace('{planned}', `${totalPlanned}`)
        .replace('{target}', `${campaignMetrics.totalTargetPosts}`);
    const missionDays = t('flowStages.socialCampaignPlanning.hero.mission.days')
        .replace('{days}', `${campaignMetrics.totalDays}`);

    return (
        <div className="flow-social-campaign-planning">
            <div className="flow-social-campaign-planning__container">
                <div className="flow-social-campaign-planning__hero">
                    <div className="flow-social-campaign-planning__hero-glow">
                        <span className="material-symbols-outlined">calendar_month</span>
                    </div>
                    <div className="flow-social-campaign-planning__hero-content">
                        <div className="flow-social-campaign-planning__badge">
                            {t('flowStages.socialCampaignPlanning.hero.badge')}
                        </div>
                        <h1 className="flow-social-campaign-planning__title">
                            {t('flowStages.socialCampaignPlanning.hero.title')}
                        </h1>
                        <div className="flow-social-campaign-planning__mission-card">
                            <p>
                                "{t('flowStages.socialCampaignPlanning.hero.mission.prefix')} <span className="flow-social-campaign-planning__mission-highlight">{missionPlanned}</span>
                                {' '}{t('flowStages.socialCampaignPlanning.hero.mission.across')} <span className="flow-social-campaign-planning__mission-highlight">{channelList}</span>
                                {' '}{t('flowStages.socialCampaignPlanning.hero.mission.over')} <span className="flow-social-campaign-planning__mission-highlight">{missionDays}</span>."
                            </p>
                        </div>
                    </div>
                    <div className="flow-social-campaign-planning__hero-actions">
                        <Button
                            onClick={handleGeneratePlan}
                            isLoading={generating}
                            variant="secondary"
                            size="sm"
                            icon={<span className="material-symbols-outlined">auto_awesome</span>}
                        >
                            {generating ? t('flowStages.socialCampaignPlanning.actions.generating') : t('flowStages.socialCampaignPlanning.actions.aiFill')}
                        </Button>
                        {(generating || genProgress > 0) && (
                            <div className="flow-social-campaign-planning__progress">
                                <div className="flow-social-campaign-planning__progress-bar">
                                    <div style={{ width: `${genProgress}%` }} />
                                </div>
                                <p>{genStage}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flow-social-campaign-planning__week-nav">
                    <button
                        type="button"
                        onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                        disabled={weekOffset === 0}
                        className="flow-social-campaign-planning__week-button"
                        aria-label={t('flowStages.socialCampaignPlanning.weekLabel').replace('{week}', String(weekOffset))}
                    >
                        <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <div className="flow-social-campaign-planning__week-list">
                        {Array.from({ length: campaignMetrics.totalWeeks }).map((_, i) => {
                            const isActive = i === weekOffset;
                            const weekPosts = planningData.posts.filter(post => Math.floor(post.dayOffset / 7) === i).length;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setWeekOffset(i)}
                                    className={`flow-social-campaign-planning__week-chip ${isActive ? 'is-active' : ''}`}
                                >
                                    {t('flowStages.socialCampaignPlanning.weekLabel').replace('{week}', `${i + 1}`)}
                                    {weekPosts > 0 && (
                                        <span className="flow-social-campaign-planning__week-count">{weekPosts}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={() => setWeekOffset(Math.min(campaignMetrics.totalWeeks - 1, weekOffset + 1))}
                        disabled={weekOffset >= campaignMetrics.totalWeeks - 1}
                        className="flow-social-campaign-planning__week-button"
                        aria-label={t('flowStages.socialCampaignPlanning.weekLabel').replace('{week}', String(weekOffset + 2))}
                    >
                        <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                </div>

                <Card className="flow-social-campaign-planning__calendar">
                    <div className="flow-social-campaign-planning__calendar-grid">
                        {weekData.days.map((day) => (
                            <div
                                key={day.dayOffset}
                                className={`flow-social-campaign-planning__day ${!day.isInCampaign ? 'is-out' : ''} ${dragOverDay === day.dayOffset ? 'is-drag-over' : ''}`}
                                onDragOver={(event) => day.isInCampaign && handleDragOver(event, day.dayOffset)}
                                onDragLeave={handleDragLeave}
                                onDrop={(event) => day.isInCampaign && handleDrop(event, day.dayOffset)}
                            >
                                <div
                                    className="flow-social-campaign-planning__day-header"
                                    data-tone={day.phase?.tone}
                                >
                                    <div>
                                        <span>{t('flowStages.socialCampaignPlanning.dayLabel')} {day.dayNum}</span>
                                        {day.phase && (
                                            <small>{day.phase.phase.name}</small>
                                        )}
                                    </div>
                                    <span className="flow-social-campaign-planning__day-count">{day.posts.length}</span>
                                </div>
                                <div className="flow-social-campaign-planning__day-body">
                                    {day.posts.map((post) => {
                                        const isSelected = post.id === selectedPostId;
                                        const isDragging = post.id === draggedPostId;
                                        const type = contentTypeById.get(post.contentType) || contentTypes[0];
                                        return (
                                            <div
                                                key={post.id}
                                                draggable
                                                onDragStart={(event) => handleDragStart(event, post.id)}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => setSelectedPostId(isSelected ? null : post.id)}
                                                className={`flow-social-campaign-planning__post ${isSelected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''}`}
                                            >
                                                <div className="flow-social-campaign-planning__post-header">
                                                    <div className="flow-social-campaign-planning__post-platforms">
                                                        {post.platforms?.slice(0, 2).map(platform => (
                                                            <span key={platform}>
                                                                <PlatformIcon platform={platform as SocialPlatform} />
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <span className="flow-social-campaign-planning__post-type" data-tone={type.tone}>{type.label}</span>
                                                </div>
                                                <p className="flow-social-campaign-planning__post-hook">
                                                    {post.hook || t('flowStages.socialCampaignPlanning.editor.previewEmpty')}
                                                </p>
                                            </div>
                                        );
                                    })}

                                    {day.isInCampaign && (
                                        <button
                                            type="button"
                                            className="flow-social-campaign-planning__post-add"
                                            onClick={() => addPost(day.dayOffset)}
                                            aria-label={t('common.add')}
                                        >
                                            <span className="material-symbols-outlined">add</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {phaseRanges.length > 0 && (
                    <div className="flow-social-campaign-planning__legend">
                        {phaseRanges.map((range, index) => (
                            <div key={index} className="flow-social-campaign-planning__legend-item" data-tone={range.tone}>
                                <span>{range.phase.name}</span>
                                <small>
                                    {t('flowStages.socialCampaignPlanning.dayRange')
                                        .replace('{start}', `${range.startDay + 1}`)
                                        .replace('{end}', `${range.endDay + 1}`)}
                                </small>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flow-social-campaign-planning__summary">
                    <Card className="flow-social-campaign-planning__targets">
                        <h3>{t('flowStages.socialCampaignPlanning.targets.title')}</h3>
                        <div className="flow-social-campaign-planning__targets-grid">
                            {campaignMetrics.platformTargets.map((platform) => {
                                const planned = planningData.posts.filter(post => post.platforms?.includes(platform.id)).length;
                                const progress = Math.min(100, (planned / Math.max(1, platform.total)) * 100);
                                return (
                                    <div key={platform.id} className="flow-social-campaign-planning__target">
                                        <div className="flow-social-campaign-planning__target-header">
                                            <div className="flow-social-campaign-planning__target-icon">
                                                <PlatformIcon platform={platform.id as SocialPlatform} />
                                            </div>
                                            <div>
                                                <span>{platform.id}</span>
                                                <small>{platform.frequencyValue} {formatFrequencyUnitShort(platform.frequencyUnit)}</small>
                                            </div>
                                        </div>
                                        <div className="flow-social-campaign-planning__target-bar">
                                            <div style={{ width: `${progress}%` }} />
                                        </div>
                                        <span className="flow-social-campaign-planning__target-count">{planned}/{platform.total}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    <div className="flow-social-campaign-planning__stats">
                        <div className="flow-social-campaign-planning__stat">
                            <strong>{totalPlanned}</strong>
                            <span>{t('flowStages.socialCampaignPlanning.stats.planned')}</span>
                        </div>
                        <div className="flow-social-campaign-planning__stat">
                            <strong>{campaignMetrics.totalTargetPosts}</strong>
                            <span>{t('flowStages.socialCampaignPlanning.stats.target')}</span>
                        </div>
                        <div className="flow-social-campaign-planning__stat">
                            <strong>{campaignMetrics.totalDays}</strong>
                            <span>{t('flowStages.socialCampaignPlanning.stats.days')}</span>
                        </div>
                        <Button
                            className="flow-social-campaign-planning__advance"
                            onClick={() => onUpdate({ stage: 'Submit' })}
                            icon={<span className="material-symbols-outlined">arrow_forward</span>}
                            iconPosition="right"
                        >
                            {t('flowStages.socialCampaignPlanning.actions.advance')}
                        </Button>
                    </div>
                </div>
            </div>

            <div className={`flow-social-campaign-planning__drawer ${selectedPost ? 'is-open' : ''}`}>
                {selectedPost && (
                    <div className="flow-social-campaign-planning__drawer-panel">
                        <div className="flow-social-campaign-planning__drawer-header">
                            <div>
                                <span className="material-symbols-outlined">edit</span>
                                <div>
                                    <h2>{t('flowStages.socialCampaignPlanning.editor.title')}</h2>
                                    <p>{t('flowStages.socialCampaignPlanning.editor.day').replace('{day}', `${selectedPost.dayOffset + 1}`)}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="flow-social-campaign-planning__drawer-close"
                                onClick={() => setSelectedPostId(null)}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </Button>
                        </div>

                        <div className="flow-social-campaign-planning__drawer-body">
                            <div className="flow-social-campaign-planning__drawer-section">
                                <label>{t('flowStages.socialCampaignPlanning.editor.platforms')}</label>
                                <div className="flow-social-campaign-planning__platforms">
                                    {strategyData.platforms.map(platform => (
                                        <button
                                            key={platform.id}
                                            type="button"
                                            className={`flow-social-campaign-planning__platform ${selectedPost.platforms?.includes(platform.id) ? 'is-active' : ''}`}
                                            onClick={() => {
                                                const current = selectedPost.platforms || [];
                                                const updated = current.includes(platform.id)
                                                    ? current.filter((entry) => entry !== platform.id)
                                                    : [...current, platform.id];
                                                updatePost(selectedPost.id, { platforms: updated });
                                            }}
                                        >
                                            <PlatformIcon platform={platform.id as SocialPlatform} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flow-social-campaign-planning__drawer-section">
                                <label>{t('flowStages.socialCampaignPlanning.editor.format')}</label>
                                {(() => {
                                    const selectedPlatforms = selectedPost.platforms || [];
                                    let validFormats: SocialPostFormat[] = [];

                                    selectedPlatforms.forEach((platform) => {
                                        const basePlatform = getBasePlatform(platform);
                                        const platformFormats = PLATFORM_FORMATS[basePlatform] || [];

                                        if (platform === 'YouTube Video') {
                                            validFormats.push('Video');
                                        } else if (platform === 'YouTube Shorts') {
                                            validFormats.push('Short');
                                        } else {
                                            validFormats = [...validFormats, ...platformFormats];
                                        }
                                    });

                                    validFormats = [...new Set(validFormats)];

                                    const filteredTypes = validFormats.length > 0
                                        ? contentTypes.filter((type) => validFormats.includes(type.id))
                                        : contentTypes;

                                    return (
                                        <div className="flow-social-campaign-planning__format-grid">
                                            {filteredTypes.map((type) => (
                                                <button
                                                    key={type.id}
                                                    type="button"
                                                    className={`flow-social-campaign-planning__format ${selectedPost.contentType === type.id ? 'is-active' : ''}`}
                                                    data-tone={type.tone}
                                                    onClick={() => updatePost(selectedPost.id, { contentType: type.id as any })}
                                                >
                                                    <span className="material-symbols-outlined">{type.icon}</span>
                                                    {type.label}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="flow-social-campaign-planning__drawer-section">
                                <label>{t('flowStages.socialCampaignPlanning.editor.hook')}</label>
                                <TextArea
                                    value={selectedPost.hook || ''}
                                    onChange={event => updatePost(selectedPost.id, { hook: event.target.value })}
                                    placeholder={t('flowStages.socialCampaignPlanning.editor.hookPlaceholder')}
                                    className="flow-social-campaign-planning__hook"
                                />
                            </div>

                            <Card className="flow-social-campaign-planning__preview">
                                <span>{t('flowStages.socialCampaignPlanning.editor.preview')}</span>
                                <div className="flow-social-campaign-planning__preview-header">
                                    <div className="flow-social-campaign-planning__post-platforms">
                                        {selectedPost.platforms?.map(platform => (
                                            <span key={platform}>
                                                <PlatformIcon platform={platform as SocialPlatform} />
                                            </span>
                                        ))}
                                    </div>
                                    <span className="flow-social-campaign-planning__post-type" data-tone={contentTypeById.get(selectedPost.contentType)?.tone}>
                                        {contentTypeById.get(selectedPost.contentType)?.label || selectedPost.contentType}
                                    </span>
                                </div>
                                <p>{selectedPost.hook || t('flowStages.socialCampaignPlanning.editor.previewEmpty')}</p>
                            </Card>
                        </div>

                        <div className="flow-social-campaign-planning__drawer-footer">
                            <Button
                                variant="ghost"
                                onClick={() => deletePost(selectedPost.id)}
                            >
                                {t('flowStages.socialCampaignPlanning.editor.delete')}
                            </Button>
                            <Button
                                onClick={() => setSelectedPostId(null)}
                            >
                                {t('flowStages.socialCampaignPlanning.editor.done')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {selectedPost && (
                <div
                    className="flow-social-campaign-planning__backdrop"
                    onClick={() => setSelectedPostId(null)}
                />
            )}
        </div>
    );
};
