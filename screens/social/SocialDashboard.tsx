
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { subscribeSocialPosts, subscribeCampaigns, subscribeProjectIdeas } from '../../services/dataService';
import { SocialPost, SocialCampaign, Idea } from '../../types';
import { subDays, format, isSameDay, differenceInDays } from 'date-fns';
import { PlatformIcon } from './components/PlatformIcon';
import { DashboardFlowCard } from './components/DashboardFlowCard';
import { useLanguage } from '../../context/LanguageContext';
import { getSocialCampaignStatusLabel } from '../../utils/socialLocalization';
import { Button } from '../../components/ui/Button';

export const SocialDashboard = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t, dateLocale } = useLanguage();
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId) return;

        const unsubPosts = subscribeSocialPosts(projectId, (data) => setPosts(data));
        const unsubCampaigns = subscribeCampaigns(projectId, (data) => setCampaigns(data));
        const unsubIdeas = subscribeProjectIdeas(projectId, (data) => {
            setIdeas(data.filter(i => i.campaignType === 'social' || i.type === 'Social' || (i.type === 'Marketing' && i.stage === 'Ideation')));
        });

        setLoading(false);

        return () => {
            unsubPosts();
            unsubCampaigns();
            unsubIdeas();
        };
    }, [projectId]);

    // Stats
    const stats = {
        totalPosts: posts.length,
        scheduled: posts.filter(p => p.status === 'Scheduled').length,
        published: posts.filter(p => p.status === 'Published').length,
        drafts: posts.filter(p => p.status === 'Draft').length,
        inReview: posts.filter(p => p.status === 'In Review' || p.status === 'PendingReview').length,
        activeCampaigns: campaigns.filter(c => c.status === 'Active' || c.status === 'Planning').length,
        pendingIdeas: ideas.filter(i => i.stage === 'Ideation' || i.stage === 'Drafting').length,
        pendingReview: ideas.filter(i => i.stage === 'PendingReview' && i.type === 'Social').length,
    };

    // Platform breakdown
    const platformCounts: Record<string, number> = {};
    posts.forEach(post => {
        const platform = post.platform || 'Unknown';
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });
    const topPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

    // Upcoming scheduled posts
    const upcomingPosts = posts
        .filter(p => p.status === 'Scheduled' && p.scheduledFor)
        .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())
        .slice(0, 5);

    // Active campaigns
    const activeCampaignsList = campaigns
        .filter(c => c.status === 'Active' || c.status === 'Planning')
        .slice(0, 4);

    // Ideas needing review (Pending Approval)
    const pendingReviewIdeas = ideas.filter(i => i.stage === 'PendingReview' && i.type === 'Social');

    // Raw Ideas (Ideation/Drafting)
    const rawIdeas = ideas.filter(i => i.stage === 'Ideation' || i.stage === 'Drafting').slice(0, 4);

    // Filter Posts missing assets (Approved/Scheduled but no assets)
    const missingAssetsPosts = posts.filter(p =>
        (p.status === 'Approved' || p.status === 'Scheduled') &&
        p.scheduledFor &&
        (!p.assets || p.assets.length === 0) &&
        p.format !== 'Text'
    ).sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime());

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 px-6 pt-6">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-main tracking-tight">{t('socialDashboard.title')}</h1>
                    <p className="text-muted font-medium">{t('socialDashboard.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/project/${projectId}/flows?pipeline=Social`)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-surface-hover text-main hover:bg-card rounded-xl text-sm font-bold transition-all border border-surface"
                    >
                        <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                        {t('socialDashboard.actions.flowsPipeline')}
                    </button>
                    <Button
                        onClick={() => navigate(`/project/${projectId}/social/create`)}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 shadow-lg shadow-[var(--color-primary)]/20 active:scale-95 transition-all gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        {t('socialDashboard.actions.createPost')}
                    </Button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                {/* Left Column: Pipelines & Content (Span 8) */}
                <div className="xl:col-span-8 space-y-10">

                    {/* SECTION 0: ALERTS (Missing Assets) */}
                    {missingAssetsPosts.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-surface">
                                <span className="material-symbols-outlined text-rose-500 animate-pulse">warning</span>
                                <h2 className="text-lg font-black text-main uppercase tracking-wide">{t('socialDashboard.sections.actionRequired')}</h2>
                            </div>

                            <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl overflow-hidden">
                                <div className="px-6 py-4 border-b border-rose-100 dark:border-rose-900/30 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-rose-700 dark:text-rose-400">{t('socialDashboard.alerts.missingAssets.title')}</h3>
                                        <p className="text-xs text-rose-600/80 dark:text-rose-400/80 font-medium">
                                            {t('socialDashboard.alerts.missingAssets.subtitle').replace('{count}', String(missingAssetsPosts.length))}
                                        </p>
                                    </div>
                                    <span className="material-symbols-outlined text-rose-400 text-3xl opacity-50">perm_media</span>
                                </div>
                                <div className="divide-y divide-rose-100 dark:divide-rose-900/30">
                                    {missingAssetsPosts.map(post => (
                                        <div key={post.id} className="p-4 flex items-center justify-between hover:bg-rose-100/50 dark:hover:bg-rose-900/20 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-center justify-center w-12 h-12 bg-card rounded-xl border border-rose-200 dark:border-rose-900/50 shrink-0">
                                                    <span className="text-lg font-black text-main leading-none">
                                                        {post.scheduledFor ? format(new Date(post.scheduledFor), 'd', { locale: dateLocale }) : '?'}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-muted uppercase">
                                                        {post.scheduledFor ? format(new Date(post.scheduledFor), 'MMM', { locale: dateLocale }) : t('socialDashboard.alerts.missingAssets.tbd')}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <PlatformIcon platform={post.platform} className="size-3.5" />
                                                        <span className="text-xs font-bold text-muted uppercase px-1.5 py-0.5 rounded bg-card border border-surface">
                                                            {post.format}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-bold text-main line-clamp-1">
                                                        {post.videoConcept?.title || post.content.caption || t('socialDashboard.alerts.missingAssets.untitledPost')}
                                                    </h4>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => navigate(`/project/${projectId}/social/edit/${post.id}`)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-card hover:bg-white dark:hover:bg-slate-700 text-rose-600 text-xs font-bold rounded-lg border border-rose-200 dark:border-rose-900/50 shadow-sm transition-all group-hover:scale-105"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">upload</span>
                                                {t('socialDashboard.alerts.missingAssets.upload')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 1: APPROVALS & REVIEW (High Priority) */}
                    {(pendingReviewIdeas.length > 0 || stats.inReview > 0) && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-surface">
                                <span className="material-symbols-outlined text-amber-500">priority_high</span>
                                <h2 className="text-lg font-black text-main uppercase tracking-wide">{t('socialDashboard.sections.needsApproval')}</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Campaign Concepts Pending Review */}
                                {pendingReviewIdeas.map(idea => (
                                    <Link
                                        key={idea.id}
                                        to={`/project/${projectId}/social/review/${idea.id}`}
                                        className="group relative bg-card rounded-2xl border border-amber-200 dark:border-amber-900/40 p-5 transition-all hover:shadow-lg hover:border-amber-400 overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <span className="material-symbols-outlined text-5xl text-amber-500 -rotate-12 translate-x-2 -translate-y-2">rate_review</span>
                                        </div>
                                            <div className="flex items-center gap-3 relative z-10 mb-3">
                                                <div className="size-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined">lightbulb</span>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">{t('socialDashboard.cards.campaignConcept')}</div>
                                                    <h3 className="font-bold text-main truncate max-w-[200px]">{idea.title}</h3>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-xs font-bold text-amber-600 relative z-10 pl-13">
                                                <span>{t('socialDashboard.cards.reviewStrategy')}</span>
                                                <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                            </div>
                                        </Link>
                                    ))}

                                {/* Posts Pending Review (Link to Approvals page if many, or list here) */}
                                {stats.inReview > 0 && (
                                    <Link
                                        to={`/project/${projectId}/social/approvals`}
                                        className="group relative bg-card rounded-2xl border border-amber-200 dark:border-amber-900/40 p-5 transition-all hover:shadow-lg hover:border-amber-400 overflow-hidden flex flex-col justify-center"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="size-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined">fact_check</span>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black text-main">{stats.inReview}</div>
                                                <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">{t('socialDashboard.cards.postsPendingReview')}</div>
                                            </div>
                                            <span className="material-symbols-outlined text-amber-400 ml-auto group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                        </div>
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                    {/* SECTION 2: RAW FLOWS (Backlog/Ideation) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-surface">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-500">tips_and_updates</span>
                                <h2 className="text-lg font-black text-main uppercase tracking-wide">{t('socialDashboard.sections.flowPipeline')}</h2>
                            </div>
                            <Link to={`/project/${projectId}/flows?pipeline=Social`} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                {t('socialDashboard.actions.viewFullPipeline')} <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </Link>
                        </div>

                        {rawIdeas.length === 0 ? (
                            <div className="p-8 text-center bg-card rounded-2xl border-2 border-dashed border-surface">
                                <span className="material-symbols-outlined text-4xl text-muted opacity-50 mb-2">lightbulb</span>
                                <p className="text-sm font-medium text-muted">{t('socialDashboard.empty.flows')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {rawIdeas.map(idea => (
                                    <DashboardFlowCard key={idea.id} idea={idea} projectId={projectId!} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* SECTION 3: ACTIVE CAMPAIGNS */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-surface">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-rose-500">campaign</span>
                                <h2 className="text-lg font-black text-main uppercase tracking-wide">{t('socialDashboard.sections.activeCampaigns')}</h2>
                            </div>
                            <Link to={`/project/${projectId}/social/campaigns`} className="text-xs font-bold text-primary hover:underline">{t('socialDashboard.actions.viewAll')}</Link>
                        </div>

                        {activeCampaignsList.length === 0 ? (
                            <div className="bg-card rounded-2xl border border-surface p-6 text-center">
                                <p className="text-sm text-muted">{t('socialDashboard.empty.activeCampaigns')}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeCampaignsList.map(campaign => (
                                    <CampaignRow key={campaign.id} campaign={campaign} projectId={projectId!} postsCount={posts.filter(p => p.campaignId === campaign.id).length} />
                                ))}
                            </div>
                        )}
                    </div>

                </div>

                {/* Right Column: Schedule & Stats (Span 4) */}
                <div className="xl:col-span-4 space-y-8">

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <QuickStatBox label={t('socialDashboard.stats.scheduled')} value={stats.scheduled} icon="event" color="text-blue-500" />
                        <QuickStatBox label={t('socialDashboard.stats.published')} value={stats.published} icon="check_circle" color="text-emerald-500" />
                        <QuickStatBox label={t('socialDashboard.stats.activeDrafts')} value={stats.drafts} icon="edit_note" color="text-slate-500" />
                        <QuickStatBox label={t('socialDashboard.stats.totalPosts')} value={stats.totalPosts} icon="grid_view" color="text-indigo-500" />
                    </div>

                    {/* Upcoming Content */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-surface">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500">calendar_month</span>
                                <h2 className="text-lg font-black text-main uppercase tracking-wide">{t('socialDashboard.sections.upNext')}</h2>
                            </div>
                            <Link to={`/project/${projectId}/social/calendar`} className="text-xs font-bold text-primary hover:underline">{t('socialDashboard.actions.calendar')}</Link>
                        </div>

                        <div className="space-y-3">
                            {upcomingPosts.length === 0 ? (
                                <div className="p-6 text-center bg-card rounded-2xl border border-surface border-dashed">
                                    <p className="text-xs text-muted italic">{t('socialDashboard.empty.queue')}</p>
                                </div>
                            ) : (
                                upcomingPosts.map(post => (
                                    <CompactScheduleItem key={post.id} post={post} projectId={projectId!} />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Platform Mix */}
                    <div className="bg-card rounded-2xl border border-surface p-5">
                        <h3 className="text-sm font-bold text-main mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-purple-500">pie_chart</span>
                            {t('socialDashboard.platformMix.title')}
                        </h3>
                        <div className="space-y-3">
                            {topPlatforms.length === 0 ? (
                                <p className="text-xs text-muted text-center">{t('socialDashboard.platformMix.empty')}</p>
                            ) : (
                                topPlatforms.map(([platform, count]) => {
                                    const total = posts.length || 1;
                                    const pct = Math.round((count / total) * 100);
                                    return (
                                        <div key={platform} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="size-5 flex items-center justify-center rounded bg-surface">
                                                    <PlatformIcon platform={platform as any} className="size-3" />
                                                </div>
                                                <span className="font-semibold text-main">{platform}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="font-bold text-muted w-6 text-right">{pct}%</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

// --- Sub-components ---

const QuickStatBox = ({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) => (
    <div className="bg-card p-4 rounded-2xl border border-surface flex flex-col items-center justify-center text-center">
        <span className={`material-symbols-outlined text-2xl mb-1 ${color}`}>{icon}</span>
        <div className="text-xl font-black text-main">{value}</div>
        <div className="text-[10px] font-bold text-muted uppercase">{label}</div>
    </div>
);

const CampaignRow = ({ campaign, projectId, postsCount }: { campaign: SocialCampaign; projectId: string; postsCount: number }) => {
    const { t } = useLanguage();
    const brandColor = campaign.color || '#E1306C';
    const progress = campaign.endDate ? Math.round((differenceInDays(new Date(), new Date(campaign.startDate)) / differenceInDays(new Date(campaign.endDate), new Date(campaign.startDate))) * 100) : 0;
    const cleanProgress = Math.min(Math.max(progress, 0), 100);
    const statusLabel = getSocialCampaignStatusLabel(campaign.status, t);

    return (
        <Link
            to={`/project/${projectId}/social/campaigns/${campaign.id}`}
            className="flex items-center gap-4 p-4 bg-card hover:bg-surface-hover border border-surface rounded-2xl transition-all group"
        >
            <div className="w-1 h-10 rounded-full" style={{ backgroundColor: brandColor }} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-main truncate text-sm">{campaign.name}</h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 uppercase">{statusLabel}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">article</span> {t('socialDashboard.campaignRow.posts').replace('{count}', String(postsCount))}
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">flag</span> {t('socialDashboard.campaignRow.phases').replace('{count}', String(campaign.phases?.length || 0))}
                    </span>
                </div>
            </div>
            {/* Mini Progress Circle */}
            <div className="relative size-8 flex items-center justify-center shrink-0">
                <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                    <path className="text-[var(--color-surface-border)]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                    <path className="text-primary transition-all duration-500" strokeDasharray={`${cleanProgress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
                <span className="absolute text-[8px] font-bold text-muted">{cleanProgress}%</span>
            </div>
        </Link>
    );
};

const CompactScheduleItem = ({ post, projectId }: { post: SocialPost; projectId: string }) => {
    const { t, dateLocale } = useLanguage();
    const date = new Date(post.scheduledFor!);
    return (
        <Link
            to={`/project/${projectId}/social/posts/edit/${post.id}`}
            className="flex items-center gap-3 p-3 bg-card hover:bg-surface-hover border border-surface rounded-xl transition-all group"
        >
            <div className="flex flex-col items-center justify-center w-10 h-10 bg-surface rounded-lg border border-surface shrink-0">
                <span className="text-sm font-black text-main leading-none">{format(date, 'd', { locale: dateLocale })}</span>
                <span className="text-[8px] font-bold text-muted uppercase">{format(date, 'MMM', { locale: dateLocale })}</span>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <PlatformIcon platform={post.platform} className="size-3" />
                    <span className="text-[10px] font-semibold text-muted">{format(date, 'HH:mm', { locale: dateLocale })}</span>
                </div>
                <p className="text-xs font-bold text-main truncate group-hover:text-primary transition-colors">
                    {post.content.caption || t('socialDashboard.compact.untitledContent')}
                </p>
            </div>
        </Link>
    );
};
