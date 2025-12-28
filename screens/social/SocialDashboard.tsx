
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subscribeSocialPosts, subscribeCampaigns, subscribeProjectIdeas } from '../../services/dataService';
import { SocialPost, SocialCampaign, Idea } from '../../types';
import { DonutChart } from '../../components/ui/charts/DonutChart';
import { BarChart } from '../../components/ui/charts/BarChart';
import { subDays, format, isSameDay } from 'date-fns';
import { PlatformIcon } from './components/PlatformIcon';
import { DashboardIdeationCard } from './components/DashboardIdeationCard';
import { DashboardCampaignCard } from './components/DashboardCampaignCard';
import { Button } from '../../components/ui/Button';

export const SocialDashboard = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId) return;

        const unsubPosts = subscribeSocialPosts(projectId, (data) => setPosts(data));
        const unsubCampaigns = subscribeCampaigns(projectId, (data) => setCampaigns(data));
        const unsubIdeas = subscribeProjectIdeas(projectId, (data) => {
            // Filter only social ideas
            setIdeas(data.filter(i => i.campaignType === 'social' || i.type === 'Social' || (i.type === 'Marketing' && i.stage === 'Ideation')));
        });

        setLoading(false);

        return () => {
            unsubPosts();
            unsubCampaigns();
            unsubIdeas();
        };
    }, [projectId]);

    const stats = {
        totalPosts: posts.length,
        scheduled: posts.filter(p => p.status === 'Scheduled').length,
        published: posts.filter(p => p.status === 'Published').length,
        pendingIdeas: ideas.filter(i => i.stage === 'Ideation' || i.stage === 'Drafting').length,
        activeCampaigns: campaigns.filter(c => c.status === 'Active' || c.status === 'Planning').length
    };

    // Platform Distribution (Donut Chart)
    const platformData = [
        { label: 'Instagram', value: posts.filter(p => p.platforms?.includes('Instagram') || p.platform === 'Instagram').length, color: '#E1306C' },
        { label: 'Facebook', value: posts.filter(p => p.platforms?.includes('Facebook') || p.platform === 'Facebook').length, color: '#1877F2' },
        { label: 'LinkedIn', value: posts.filter(p => p.platforms?.includes('LinkedIn') || p.platform === 'LinkedIn').length, color: '#0A66C2' },
        { label: 'X', value: posts.filter(p => p.platforms?.includes('X') || p.platform === 'X').length, color: '#000000' },
        { label: 'TikTok', value: posts.filter(p => p.platforms?.includes('TikTok') || p.platform === 'TikTok').length, color: '#00F2EA' },
        { label: 'YouTube', value: posts.filter(p => p.platforms?.includes('YouTube') || p.platform === 'YouTube').length, color: '#FF0000' }
    ].filter(d => d.value > 0);

    // Activity (Bar Chart)
    const activityData = Array.from({ length: 14 }, (_, i) => {
        const date = subDays(new Date(), 13 - i); // Last 14 days for more density
        const count = posts.filter(p => {
            const pDate = p.scheduledFor ? new Date(p.scheduledFor) : p.publishedAt ? new Date(p.publishedAt) : null;
            return pDate && isSameDay(pDate, date);
        }).length;
        return { label: format(date, 'MMM d'), value: count };
    });

    const reviewsNeeded = posts.filter(p => p.status === 'In Review');

    const upcomingPosts = posts
        .filter(p => p.status === 'Scheduled')
        .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())
        .slice(0, 4);

    const activeCampaignsList = campaigns
        .filter(c => c.status === 'Active' || c.status === 'Planning')
        .sort((a, b) => (b.status === 'Active' ? 1 : 0) - (a.status === 'Active' ? 1 : 0))
        .slice(0, 3);

    const missionControlIdeas = ideas
        .filter(i => i.stage === 'Ideation' || i.stage === 'Drafting')
        .slice(0, 4);

    const pendingReviewIdeas = ideas.filter(i => i.stage === 'PendingReview' && i.type === 'Social');

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <span className="material-symbols-outlined animate-spin text-3xl text-[var(--color-primary)]">progress_activity</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            {/* ... Header & Stats ... */}
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text-main)] mb-1">Social Command</h1>
                    <p className="text-[var(--color-text-muted)] text-base">
                        Overview of your creative pipeline and performance.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        className="bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)]"
                        onClick={() => window.open(`/project/${projectId}/ideas?pipeline=Social`, '_self')}
                        icon={<span className="material-symbols-outlined">lightbulb</span>}
                    >
                        Ideation Pipeline
                    </Button>
                    <Link
                        to={`/project/${projectId}/social/create`}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] rounded-xl text-sm font-bold transition-all"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Create Post
                    </Link>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <ModernStatCard
                    label="Total Content"
                    value={stats.totalPosts}
                    icon="auto_awesome_motion"
                    color="from-blue-500 to-indigo-600"
                    trend="+12% activity"
                />
                <ModernStatCard
                    label="Scheduled"
                    value={stats.scheduled}
                    icon="event_available"
                    color="from-amber-400 to-orange-500"
                    trend="Ready to publish"
                />
                <ModernStatCard
                    label="Active Campaigns"
                    value={stats.activeCampaigns}
                    icon="campaign"
                    color="from-rose-500 to-pink-600"
                    trend="Live now"
                />
                <ModernStatCard
                    label="Ideation Backlog"
                    value={stats.pendingIdeas}
                    icon="architecture"
                    color="from-emerald-400 to-teal-500"
                    trend="New concepts"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

                {/* LEFT COLUMN: Main Feed (lnbound Pipeline & Activity) - Span 8 */}
                <div className="xl:col-span-8 space-y-10">

                    {/* Inbound Pipeline Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-2 border-b border-[var(--color-surface-border)]">
                            <h2 className="text-lg font-black text-[var(--color-text-main)] uppercase tracking-wide flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500">all_inclusive</span>
                                Inbound Pipeline
                            </h2>
                        </div>

                        {/* 1. Campaign Concepts (High Priority) */}
                        {pendingReviewIdeas.length > 0 && (
                            <div className="space-y-4">
                                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider pl-1">Ready for Review</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {pendingReviewIdeas.map(idea => (
                                        <Link
                                            key={idea.id}
                                            to={`/project/${projectId}/social/review/${idea.id}`}
                                            className="group relative bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] hover:border-emerald-500/50 p-5 transition-all hover:shadow-lg flex flex-col gap-3 overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <span className="material-symbols-outlined text-5xl text-emerald-500 -rotate-12 translate-x-2 -translate-y-2">rocket_launch</span>
                                            </div>

                                            <div className="flex items-center gap-3 relative z-10">
                                                <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-lg">lightbulb</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Strategy Review</div>
                                                    <h3 className="font-bold text-[var(--color-text-main)] truncate group-hover:text-emerald-600 transition-colors">{idea.title}</h3>
                                                </div>
                                            </div>

                                            <div className="mt-auto pt-3 flex items-center justify-between text-xs font-bold text-emerald-600 relative z-10 pl-11">
                                                <span>Review Strategy</span>
                                                <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2. Raw Ideas (Lower Priority) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pl-1">
                                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Raw Ideas</div>
                                <Link to={`/project/${projectId}/ideas?pipeline=Social`} className="text-[10px] font-bold text-[var(--color-primary)] hover:underline">View All Pipeline</Link>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {missionControlIdeas.length === 0 ? (
                                    <div className="md:col-span-2 p-8 text-center bg-[var(--color-surface-card)] rounded-2xl border-2 border-dashed border-[var(--color-surface-border)]">
                                        <p className="text-xs font-medium text-[var(--color-text-muted)]">Pipeline empty. Start brainstorming!</p>
                                    </div>
                                ) : (
                                    missionControlIdeas.map(idea => (
                                        <DashboardIdeationCard key={idea.id} idea={idea} projectId={projectId!} />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Content Velocity Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--color-surface-border)]">
                            <h2 className="text-lg font-black text-[var(--color-text-main)] uppercase tracking-wide flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500">monitoring</span>
                                Content Velocity
                            </h2>
                        </div>
                        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-6 h-[260px]">
                            <BarChart data={activityData} />
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN: Action Center (Sidebar) - Span 4 */}
                <div className="xl:col-span-4 space-y-8">

                    {/* Action Center Header */}
                    <div className="pb-2 border-b border-[var(--color-surface-border)]">
                        <h2 className="text-lg font-black text-[var(--color-text-main)] uppercase tracking-wide flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500">gavel</span>
                            Action Center
                        </h2>
                    </div>

                    {/* 1. Review Queue */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Pending Approvals</h3>
                            <Link to="approvals" className="text-[10px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1">
                                View All <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                            </Link>
                        </div>

                        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] overflow-hidden shadow-sm">
                            {reviewsNeeded.length === 0 ? (
                                <div className="p-8 text-center bg-[var(--color-surface-bg)]/50">
                                    <span className="material-symbols-outlined text-3xl mb-2 text-emerald-500/50">verified</span>
                                    <p className="text-xs font-medium text-[var(--color-text-muted)]">All caught up!</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[var(--color-surface-border)]">
                                    {reviewsNeeded.slice(0, 4).map(post => (
                                        <Link
                                            key={post.id}
                                            to={`/project/${projectId}/social/${post.campaignId ? `campaigns/${post.campaignId}` : `posts/edit/${post.id}`}`}
                                            className="flex items-center gap-3 p-3 hover:bg-[var(--color-surface-hover)] transition-colors group"
                                        >
                                            <div className="size-8 shrink-0">
                                                <PlatformIcon platform={post.platform} className="size-full" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase">{post.format}</span>
                                                    <span className="text-[9px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 rounded">Review</span>
                                                </div>
                                                <p className="text-xs font-bold text-[var(--color-text-main)] truncate opacity-90 group-hover:text-[var(--color-primary)] transition-colors">
                                                    {post.content.caption}
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. Upcoming Schedule */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Up Next</h3>
                            <Link to="calendar" className="text-[10px] font-bold text-[var(--color-primary)] hover:underline">Calendar</Link>
                        </div>

                        <div className="space-y-2">
                            {upcomingPosts.length === 0 ? (
                                <div className="p-6 text-center bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)] border-dashed">
                                    <p className="text-xs text-[var(--color-text-muted)] italic">Queue empty.</p>
                                </div>
                            ) : (
                                upcomingPosts.map(post => {
                                    const date = new Date(post.scheduledFor!);
                                    return (
                                        <div key={post.id} className="flex gap-3 p-3 bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] rounded-xl transition-all items-center">
                                            <div className="flex flex-col items-center justify-center w-10 h-10 bg-[var(--color-surface-bg)] rounded-lg border border-[var(--color-surface-border)] shrink-0">
                                                <span className="text-[10px] font-black text-[var(--color-text-main)] leading-none">{format(date, 'd')}</span>
                                                <span className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase">{format(date, 'MMM')}</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <div className="size-3"><PlatformIcon platform={post.platform} /></div>
                                                    <span className="text-[9px] font-bold text-[var(--color-text-muted)]">{format(date, 'HH:mm')}</span>
                                                </div>
                                                <p className="text-xs font-medium text-[var(--color-text-main)] truncate">{post.content.caption}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* 3. Active Campaigns */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Live Campaigns</h3>
                            <Link to="campaigns" className="text-[10px] font-bold text-[var(--color-primary)] hover:underline">View All</Link>
                        </div>

                        <div className="space-y-3">
                            {activeCampaignsList.length === 0 ? (
                                <div className="p-6 text-center bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)]">
                                    <p className="text-xs text-[var(--color-text-muted)]">No active campaigns.</p>
                                </div>
                            ) : (
                                activeCampaignsList.map(campaign => (
                                    <Link
                                        key={campaign.id}
                                        to={`/project/${projectId}/social/campaigns/${campaign.id}`}
                                        className="block p-4 bg-[var(--color-surface-card)] hover:border-indigo-500/50 border border-[var(--color-surface-border)] rounded-xl transition-all group"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-indigo-500 text-lg">flag</span>
                                                <h4 className="text-sm font-bold text-[var(--color-text-main)] truncate max-w-[150px] group-hover:text-indigo-500 transition-colors">{campaign.name}</h4>
                                            </div>
                                            {campaign.status === 'Active' && <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                                                {(campaign.phases || []).length} Phases
                                            </span>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 4. Platform Health (Mini) */}
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)] p-4 space-y-3">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Platform Mix</h3>
                        {platformData.slice(0, 4).map((item, idx) => {
                            const total = platformData.reduce((acc, curr) => acc + curr.value, 0);
                            const percentage = total > 0 ? (item.value / total) * 100 : 0;
                            return (
                                <div key={idx} className="space-y-1">
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className="font-bold flex items-center gap-1.5">
                                            <div className="size-3"><PlatformIcon platform={item.label as any} className="size-full" /></div>
                                            {item.label}
                                        </span>
                                        <span className="text-[var(--color-text-muted)]">{Math.round(percentage)}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: item.color }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </div>
            </div>
        </div>
    );
};

interface ModernStatCardProps {
    label: string;
    value: number | string;
    icon: string;
    color: string;
    trend?: string;
}

const ModernStatCard: React.FC<ModernStatCardProps> = ({ label, value, icon, color, trend }) => (
    <div className="group bg-[var(--color-surface-card)] p-6 rounded-2xl border border-[var(--color-surface-border)] hover:border-[var(--color-primary)]/50 hover:shadow-xl transition-all relative overflow-hidden">
        {/* Background Accent */}
        <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 bg-gradient-to-br ${color} rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform`} />

        <div className="relative z-10">
            <div className={`size-12 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${color} shadow-lg shadow-${color.split('-')[1]}-500/20 mb-4`}>
                <span className="material-symbols-outlined text-[28px]">{icon}</span>
            </div>
            <div className="flex items-end justify-between">
                <div>
                    <div className="text-3xl font-black text-[var(--color-text-main)] mb-1 tracking-tight">{value}</div>
                    <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</div>
                </div>
            </div>
            {trend && (
                <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-emerald-500">trending_up</span>
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{trend}</span>
                </div>
            )}
        </div>
    </div>
);
