import React from 'react';
import { SocialCampaign, SocialPost } from '../../../types';
import { differenceInDays, format } from 'date-fns';
import { useLanguage } from '../../../context/LanguageContext';
import { getSocialPostFormatLabel } from '../../../utils/socialLocalization';

interface CampaignStrategyViewProps {
    campaign: SocialCampaign;
    posts: SocialPost[];
    onTabChange: (tab: 'strategy' | 'board' | 'calendar') => void;
}

export const CampaignStrategyView: React.FC<CampaignStrategyViewProps> = ({ campaign, posts, onTabChange }) => {
    const { t, dateLocale, dateFormat } = useLanguage();
    // Derived Metrics
    const concepts = posts.filter(p => p.isConcept);
    const published = posts.filter(p => p.status === 'Published');
    const scheduled = posts.filter(p => p.status === 'Scheduled');
    const drafts = posts.filter(p => p.status === 'Draft' && !p.isConcept);

    // Timeline
    const totalDays = campaign.startDate && campaign.endDate ? differenceInDays(new Date(campaign.endDate), new Date(campaign.startDate)) : 0;
    const daysElapsed = campaign.startDate ? differenceInDays(new Date(), new Date(campaign.startDate)) : 0;
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const progress = totalDays > 0 ? Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100)) : 0;

    // Color
    const brandColor = campaign.color || '#E1306C';
    const durationUnitLabels: Record<string, string> = {
        Days: t('social.campaignStrategy.units.days'),
        Weeks: t('social.campaignStrategy.units.weeks'),
        Months: t('social.campaignStrategy.units.months')
    };
    const frequencyUnitLabels: Record<string, string> = {
        'Posts/Day': t('social.campaignStrategy.frequency.day'),
        'Posts/Week': t('social.campaignStrategy.frequency.week'),
        'Posts/Month': t('social.campaignStrategy.frequency.month')
    };
    const formatFrequencyUnit = (unit?: string) => frequencyUnitLabels[unit || ''] || unit?.replace('Posts/', '') || '';

    const StatCard = ({ icon, label, value, subtext }: { icon: string, label: string, value: string | number, subtext?: string }) => (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)] p-4 shadow-sm flex items-start justify-between">
            <div>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{label}</p>
                <p className="text-2xl font-black text-[var(--color-text-main)]">{value}</p>
                {subtext && <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{subtext}</p>}
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]`}>
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
            </div>
        </div>
    );

    const [showTimeline, setShowTimeline] = React.useState(false);

    return (
        <div className="space-y-8 animate-fade-in max-w-6xl mx-auto py-4 px-2">

            {/* 1. North Star / Core Flow */}
            <div className="bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] rounded-3xl p-8 border border-[var(--color-surface-border)] shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 transition-transform group-hover:rotate-6">
                    <span className="material-symbols-outlined text-[120px]">auto_awesome</span>
                </div>

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-7 space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[var(--color-primary)]/10 text-[var(--color-primary)]">{t('social.campaignStrategy.conceptBadge')}</span>
                                <div className="h-px flex-1 bg-[var(--color-surface-border)]" />
                                {campaign.plannedContent && campaign.plannedContent.length > 0 && (
                                    <button
                                        onClick={() => setShowTimeline(true)}
                                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">calendar_view_week</span>
                                        {t('social.campaignStrategy.viewTimeline')}
                                    </button>
                                )}
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-[var(--color-text-main)] leading-tight mb-2">
                                "{campaign.bigIdea || campaign.name}"
                            </h2>
                            <p className="text-base text-[var(--color-text-secondary)] font-medium leading-relaxed max-w-2xl">
                                {campaign.hook || campaign.description || t('social.campaignStrategy.noHook')}
                            </p>
                        </div>

                        {(campaign.mood || campaign.visualDirection) && (
                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <div className="bg-[var(--color-surface-hover)]/50 rounded-xl p-4 border border-[var(--color-surface-border)]">
                                    <h4 className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t('social.campaignStrategy.visualDirection')}</h4>
                                    <p className="text-xs font-bold text-[var(--color-text-main)] line-clamp-3">{campaign.visualDirection || t('social.campaignStrategy.notSpecified')}</p>
                                </div>
                                <div className="bg-[var(--color-surface-hover)]/50 rounded-xl p-4 border border-[var(--color-surface-border)]">
                                    <h4 className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t('social.campaignStrategy.moodTone')}</h4>
                                    <div className="flex items-center gap-2">
                                        {campaign.mood && <span className="px-2 py-1 bg-[var(--color-surface-card)] rounded text-[10px] font-bold border border-[var(--color-surface-border)]">{campaign.mood}</span>}
                                        {campaign.toneOfVoice && <span className="px-2 py-1 bg-[var(--color-surface-card)] rounded text-[10px] font-bold border border-[var(--color-surface-border)]">{campaign.toneOfVoice}</span>}
                                        {!campaign.mood && !campaign.toneOfVoice && <span className="text-xs text-[var(--color-text-muted)] italic">{t('social.campaignStrategy.notSet')}</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-5 flex flex-col justify-between gap-6 border-t lg:border-t-0 lg:border-l border-[var(--color-surface-border)] pt-6 lg:pt-0 lg:pl-8">
                        <div className="grid grid-cols-2 gap-4">
                            <StatCard
                                icon="calendar_today"
                                label={t('social.campaignStrategy.duration')}
                                value={`${totalDays}d`}
                                subtext={campaign.endDate
                                    ? t('social.campaignStrategy.ends').replace('{date}', format(new Date(campaign.endDate), dateFormat, { locale: dateLocale }))
                                    : t('social.campaignStrategy.ongoing')}
                            />
                            <StatCard
                                icon="layers"
                                label={t('social.campaignStrategy.content')}
                                value={posts.length}
                                subtext={t('social.campaignStrategy.scheduledCount').replace('{count}', String(scheduled.length))}
                            />
                        </div>

                        {(campaign.kpis && campaign.kpis.length > 0) && (
                            <div className="bg-[var(--color-surface-hover)]/30 rounded-xl p-4 border border-[var(--color-surface-border)]">
                                <h4 className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[14px]">flag</span>
                                    {t('social.campaignStrategy.successMetrics')}
                                </h4>
                                <div className="space-y-2">
                                    {campaign.kpis.map((kpi, i) => (
                                        <div key={i} className="flex justify-between items-center text-xs">
                                            <span className="text-[var(--color-text-secondary)] font-medium">{kpi.metric}</span>
                                            <span className="font-bold text-[var(--color-text-main)] bg-[var(--color-surface-card)] px-2 py-0.5 rounded border border-[var(--color-surface-border)]">{kpi.target}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Rollout & Channels Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left: Phased Rollout */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-[var(--color-text-main)] text-sm uppercase tracking-wider flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">timeline</span>
                            {t('social.campaignStrategy.rolloutPhases')}
                        </h3>
                    </div>

                    {campaign.phases && campaign.phases.length > 0 ? (
                        <div className="space-y-3">
                            {campaign.phases.map((phase, i) => (
                                <div key={i} className="bg-[var(--color-surface-card)] rounded-xl p-4 border border-[var(--color-surface-border)] flex gap-4 transition-all hover:border-[var(--color-primary)]/30 group">
                                    <div className="flex flex-col items-center gap-1 min-w-[3rem]">
                                        <div className="size-8 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-main)] font-black text-xs flex items-center justify-center border border-[var(--color-surface-border)] group-hover:scale-110 transition-transform">
                                            {i + 1}
                                        </div>
                                        <div className="h-full w-px bg-[var(--color-surface-border)]" />
                                    </div>
                                    <div className="flex-1 pb-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="font-bold text-[var(--color-text-main)] text-sm">{phase.name}</h4>
                                            <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider bg-[var(--color-surface-hover)] px-2 py-0.5 rounded">
                                                {phase.durationValue} {durationUnitLabels[phase.durationUnit] || phase.durationUnit}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{phase.focus}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-[var(--color-surface-card)] rounded-xl p-8 border border-dashed border-[var(--color-surface-border)] text-center">
                            <p className="text-xs text-[var(--color-text-muted)]">{t('social.campaignStrategy.noPhases')}</p>
                        </div>
                    )}
                </div>

                {/* Right: Channel Strategy */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-[var(--color-text-main)] text-sm uppercase tracking-wider flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">hub</span>
                            {t('social.campaignStrategy.channelMix')}
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(campaign.channelStrategy && campaign.channelStrategy.length > 0) ? campaign.channelStrategy.map((chan, i) => (
                            <div key={i} className="bg-[var(--color-surface-card)] rounded-xl p-4 border border-[var(--color-surface-border)] flex flex-col justify-between gap-3 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <div className="font-bold text-sm text-[var(--color-text-main)]">{chan.id}</div>
                                    {chan.frequencyValue && (
                                        <span className="text-[9px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/5 px-2 py-0.5 rounded-full uppercase">
                                            {chan.frequencyValue} {formatFrequencyUnit(chan.frequencyUnit)}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-[var(--color-text-secondary)] leading-snug line-clamp-2">
                                    {chan.role || t('social.campaignStrategy.noRole')}
                                </div>
                                <div className="pt-2 border-t border-[var(--color-surface-border)] flex items-center gap-2">
                                    <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t('social.campaignStrategy.formatLabel')}</span>
                                    <span className="text-[10px] font-bold text-[var(--color-text-main)]">
                                        {chan.format ? getSocialPostFormatLabel(chan.format, t) : t('social.campaignStrategy.mixed')}
                                    </span>
                                </div>
                            </div>
                        )) : (
                            (campaign.platforms || []).map(p => (
                                <div key={p} className="bg-[var(--color-surface-card)] rounded-xl p-4 border border-[var(--color-surface-border)]">
                                    <div className="font-bold text-sm text-[var(--color-text-main)] mb-1">{p}</div>
                                    <span className="text-xs text-[var(--color-text-muted)]">{t('social.campaignStrategy.legacyConfig')}</span>
                                </div>
                            ))
                        )}
                        {(!campaign.channelStrategy?.length && !campaign.platforms?.length) && (
                            <div className="col-span-2 text-center py-6 border border-dashed border-[var(--color-surface-border)] rounded-xl bg-[var(--color-surface-bg)]">
                                <p className="text-xs text-[var(--color-text-muted)]">{t('social.campaignStrategy.noChannels')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Analysis & Audience */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Audience */}
                <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-6 shadow-sm">
                    <h3 className="font-bold text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">group</span>
                        {t('social.campaignStrategy.audienceSegments')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {campaign.audienceSegments?.map((seg, i) => (
                            <span key={i} className="px-3 py-1.5 bg-[var(--color-surface-bg)] rounded-lg text-xs font-bold text-[var(--color-text-main)] border border-[var(--color-surface-border)]">
                                {seg}
                            </span>
                        ))}
                        {(!campaign.audienceSegments || campaign.audienceSegments.length === 0) && (
                            <span className="text-xs text-[var(--color-text-muted)] italic">{campaign.targetAudience || t('social.campaignStrategy.noSegments')}</span>
                        )}
                    </div>
                </div>

                {/* Risks */}
                <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-6 shadow-sm">
                    <h3 className="font-bold text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">warning</span>
                        {t('social.campaignStrategy.keyRisks')}
                    </h3>
                    <div className="space-y-3">
                        {campaign.risks?.slice(0, 3).map((risk, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <div className={`size-1.5 mt-1.5 rounded-full shrink-0 ${risk.severity === 'High' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                <div>
                                    <p className="text-xs font-bold text-[var(--color-text-main)] mb-0.5">{risk.title}</p>
                                    <p className="text-[10px] text-[var(--color-text-muted)] leading-snug">{risk.mitigation}</p>
                                </div>
                            </div>
                        ))}
                        {(!campaign.risks || campaign.risks.length === 0) && <p className="text-xs text-[var(--color-text-muted)] italic">{t('social.campaignStrategy.noRisks')}</p>}
                    </div>
                </div>

                {/* Wins */}
                <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-6 shadow-sm">
                    <h3 className="font-bold text-[var(--color-text-muted)] text-[11px] uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">emoji_events</span>
                        {t('social.campaignStrategy.projectedWins')}
                    </h3>
                    <div className="space-y-3">
                        {campaign.wins?.slice(0, 3).map((win, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <div className="size-1.5 mt-1.5 rounded-full shrink-0 bg-emerald-500" />
                                <div>
                                    <p className="text-xs font-bold text-[var(--color-text-main)] mb-0.5">{win.title}</p>
                                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400">
                                        {t('social.campaignStrategy.winImpact').replace('{impact}', win.impact)}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {(!campaign.wins || campaign.wins.length === 0) && <p className="text-xs text-[var(--color-text-muted)] italic">{t('social.campaignStrategy.noWins')}</p>}
                    </div>
                </div>
            </div>

            {/* Planned Timeline Modal */}
            <PlannedTimelineModal
                isOpen={showTimeline}
                onClose={() => setShowTimeline(false)}
                plannedContent={campaign.plannedContent || []}
            />
        </div>
    );
};

const PlannedTimelineModal = ({ isOpen, onClose, plannedContent }: { isOpen: boolean, onClose: () => void, plannedContent: any[] }) => {
    const [weekOffset, setWeekOffset] = React.useState(0);
    const { t } = useLanguage();

    // Calculate total weeks
    const maxDay = plannedContent.reduce((max, p) => Math.max(max, p.dayOffset), 0);
    const totalWeeks = Math.ceil((maxDay + 1) / 7);

    // Get posts for current week
    const weekStart = weekOffset * 7;
    const weekEnd = weekStart + 6;
    const weekPosts = {
        days: Array.from({ length: 7 }, (_, i) => {
            const dayOffset = weekStart + i;
            const posts = plannedContent.filter(p => p.dayOffset === dayOffset);
            return { dayOffset, dayNum: dayOffset + 1, posts };
        })
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-scale-in">
                <div className="flex items-center justify-between p-4 border-b border-[var(--color-surface-border)]">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--color-text-main)]">{t('social.campaignStrategy.timeline.title')}</h3>
                        <p className="text-xs text-[var(--color-text-muted)]">{t('social.campaignStrategy.timeline.subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--color-surface-hover)] rounded-full transition-colors">
                        <span className="material-symbols-outlined text-[var(--color-text-muted)]">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
                                    disabled={weekOffset === 0}
                                    className="p-1 hover:bg-[var(--color-surface-hover)] rounded-lg disabled:opacity-30 transition-colors"
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                <span className="text-sm font-bold text-[var(--color-text-main)]">
                                    {t('social.campaignStrategy.timeline.week').replace('{week}', String(weekOffset + 1)).replace('{total}', String(totalWeeks))}
                                </span>
                                <button
                                    onClick={() => setWeekOffset(prev => Math.min(totalWeeks - 1, prev + 1))}
                                    disabled={weekOffset >= totalWeeks - 1}
                                    className="p-1 hover:bg-[var(--color-surface-hover)] rounded-lg disabled:opacity-30 transition-colors"
                                >
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-3 min-w-[800px]">
                            {weekPosts.days.map((day) => (
                                <div key={day.dayOffset} className="flex flex-col gap-2">
                                    <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] text-center">
                                        {t('social.campaignStrategy.timeline.day').replace('{day}', String(day.dayNum))}
                                    </div>
                                    <div className="flex-1 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl min-h-[200px] p-2 space-y-2">
                                        {day.posts.map((post: any, idx: number) => (
                                            <div key={idx} className="bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg p-2 shadow-sm text-xs">
                                                <div className="flex items-center gap-1 mb-1">
                                                    {Array.isArray(post.platform) ? post.platform.map((p: string) => (
                                                        <span key={p} className="text-[8px] font-bold bg-[var(--color-surface-hover)] px-1 rounded">{p}</span>
                                                    )) : (
                                                        <span className="text-[8px] font-bold bg-[var(--color-surface-hover)] px-1 rounded">{post.platform}</span>
                                                    )}
                                                </div>
                                                <div className="font-semibold text-[var(--color-text-main)] mb-1 line-clamp-2">{post.hook}</div>
                                                <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                                                    {post.contentType ? getSocialPostFormatLabel(post.contentType as any, t) : t('social.campaignStrategy.timeline.unknownType')}
                                                </div>
                                            </div>
                                        ))}
                                        {day.posts.length === 0 && (
                                            <div className="h-full flex items-center justify-center text-[10px] text-[var(--color-text-subtle)] italic">
                                                {t('social.campaignStrategy.timeline.empty')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
