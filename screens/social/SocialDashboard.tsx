
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subscribeSocialPosts, subscribeCampaigns } from '../../services/dataService';
import { SocialPost, SocialCampaign } from '../../types';
import { DonutChart } from '../../components/ui/charts/DonutChart';
import { BarChart } from '../../components/ui/charts/BarChart';
import { subDays, format, isSameDay } from 'date-fns';

export const SocialDashboard = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId) return;

        const unsubPosts = subscribeSocialPosts(projectId, (data) => setPosts(data));
        const unsubCampaigns = subscribeCampaigns(projectId, (data) => setCampaigns(data));

        setLoading(false);

        return () => {
            unsubPosts();
            unsubCampaigns();
        };
    }, [projectId]);

    const stats = {
        totalPosts: posts.length,
        scheduled: posts.filter(p => p.status === 'Scheduled').length,
        published: posts.filter(p => p.status === 'Published').length,
        activeCampaigns: campaigns.filter(c => c.status === 'Active' || c.status === 'Planning').length
    };

    // Platform Distribution (Donut Chart)
    const platformData = [
        { label: 'Instagram', value: posts.filter(p => p.platform === 'Instagram').length, color: '#E1306C' },
        { label: 'Facebook', value: posts.filter(p => p.platform === 'Facebook').length, color: '#1877F2' },
        { label: 'LinkedIn', value: posts.filter(p => p.platform === 'LinkedIn').length, color: '#0A66C2' },
        { label: 'X', value: posts.filter(p => p.platform === 'X').length, color: '#000000' },
        { label: 'TikTok', value: posts.filter(p => p.platform === 'TikTok').length, color: '#00F2EA' }
    ].filter(d => d.value > 0);

    // Activity (Bar Chart)
    const activityData = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(new Date(), 29 - i); // Last 30 days
        const count = posts.filter(p => {
            const pDate = p.scheduledFor ? new Date(p.scheduledFor) : p.publishedAt ? new Date(p.publishedAt) : null;
            return pDate && isSameDay(pDate, date);
        }).length;
        return { label: format(date, 'MMM d'), value: count };
    });

    const upcomingPosts = posts
        .filter(p => p.status === 'Scheduled')
        .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())
        .slice(0, 3);

    const activeCampaignsList = campaigns
        .filter(c => c.status === 'Active' || c.status === 'Planning')
        .slice(0, 3);

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="h2 mb-2">Social Dashboard</h1>
                    <p className="text-[var(--color-text-muted)]">Overview of your social media performance.</p>
                </div>
                <Link
                    to={`/project/${projectId}/social/create`}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    New Post
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Posts" value={stats.totalPosts} icon="post" color="bg-blue-500" />
                <StatCard label="Scheduled" value={stats.scheduled} icon="calendar_clock" color="bg-amber-500" />
                <StatCard label="Published" value={stats.published} icon="check_circle" color="bg-green-500" />
                <StatCard label="Active Campaigns" value={stats.activeCampaigns} icon="flag" color="bg-purple-500" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)] p-6">
                    <h3 className="text-lg font-bold mb-6">Platform Distribution</h3>
                    <div className="flex justify-center">
                        <DonutChart data={platformData} />
                    </div>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)] p-6">
                    <h3 className="text-lg font-bold mb-6">30-Day Activity</h3>
                    <div className="mt-4">
                        <BarChart data={activityData} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Upcoming Posts */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="h4">Upcoming Posts</h2>
                        <Link to="calendar" className="text-sm text-[var(--color-primary)] hover:underline">View Calendar</Link>
                    </div>

                    <div className="space-y-3">
                        {upcomingPosts.length === 0 && (
                            <div className="p-6 text-center text-[var(--color-text-muted)] bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)]">
                                No upcoming posts scheduled.
                            </div>
                        )}
                        {upcomingPosts.map(post => (
                            <div key={post.id} className="flex gap-4 p-4 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl">
                                <div className="flex flex-col items-center justify-center w-12 h-12 bg-[var(--color-surface-hover)] rounded-lg text-xs font-bold shrink-0">
                                    <span className="text-[var(--color-primary)]">{new Date(post.scheduledFor!).getDate()}</span>
                                    <span className="text-[var(--color-text-muted)] uppercase">{new Date(post.scheduledFor!).toLocaleString('default', { month: 'short' })}</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${post.platform === 'Instagram' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {post.platform}
                                        </span>
                                        <span className="text-xs text-[var(--color-text-muted)]">{new Date(post.scheduledFor!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-sm font-medium line-clamp-1">{post.content.caption}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Active Campaigns */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="h4">Active Campaigns</h2>
                        <Link to="campaigns" className="text-sm text-[var(--color-primary)] hover:underline">View All</Link>
                    </div>

                    <div className="space-y-3">
                        {activeCampaignsList.length === 0 && (
                            <div className="p-6 text-center text-[var(--color-text-muted)] bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)]">
                                No active campaigns.
                            </div>
                        )}
                        {activeCampaignsList.map(campaign => (
                            <div key={campaign.id} className="p-4 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold">{campaign.name}</h3>
                                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">{campaign.status}</span>
                                </div>
                                <p className="text-sm text-[var(--color-text-muted)] line-clamp-1">{campaign.goal}</p>
                                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                    <span>Ends {new Date(campaign.endDate || '').toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, icon, color }: any) => (
    <div className="bg-[var(--color-surface-card)] p-5 rounded-xl border border-[var(--color-surface-border)] flex items-center gap-4">
        <div className={`size-12 rounded-full flex items-center justify-center text-white ${color}`}>
            <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">{label}</div>
        </div>
    </div>
);
