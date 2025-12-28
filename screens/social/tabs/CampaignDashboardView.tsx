import React from 'react';
import { SocialCampaign, SocialPost, SocialPlatform } from '../../../types';
import { format } from 'date-fns';
import { dateLocale, dateFormat } from '../../../utils/activityHelpers';

interface CampaignDashboardViewProps {
    campaign: SocialCampaign;
    posts: SocialPost[];
}

export const CampaignDashboardView: React.FC<CampaignDashboardViewProps> = ({ campaign, posts }) => {
    const brandColor = campaign.color || '#E1306C';

    // Calculate metrics
    const totalPosts = posts.length;
    const publishedPosts = posts.filter(p => p.status === 'Published').length;
    const scheduledPosts = posts.filter(p => p.status === 'Scheduled').length;
    const draftPosts = posts.filter(p => p.status === 'Draft').length;
    const inReviewPosts = posts.filter(p => p.status === 'PendingReview').length;

    // Platform breakdown
    const platformCounts: Record<string, number> = {};
    posts.forEach(post => {
        const platform = post.platform || 'Unknown';
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });
    const platformData = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);

    // Status distribution for visual
    const statusData = [
        { label: 'Published', count: publishedPosts, color: '#10b981' },
        { label: 'Scheduled', count: scheduledPosts, color: '#3b82f6' },
        { label: 'In Review', count: inReviewPosts, color: '#f59e0b' },
        { label: 'Draft', count: draftPosts, color: '#6b7280' },
    ].filter(s => s.count > 0);

    const maxStatusCount = Math.max(...statusData.map(s => s.count), 1);

    // Campaign progress (based on dates if available)
    let progressPercent = 0;
    if (campaign.startDate && campaign.endDate) {
        const start = new Date(campaign.startDate).getTime();
        const end = new Date(campaign.endDate).getTime();
        const now = Date.now();
        if (now >= end) progressPercent = 100;
        else if (now <= start) progressPercent = 0;
        else progressPercent = Math.round(((now - start) / (end - start)) * 100);
    }

    // Days remaining
    let daysRemaining: number | null = null;
    if (campaign.endDate) {
        const end = new Date(campaign.endDate).getTime();
        const now = Date.now();
        daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-6xl mx-auto py-4 px-2">
            {/* Header Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon="article"
                    label="Total Posts"
                    value={totalPosts}
                    color={brandColor}
                />
                <StatCard
                    icon="check_circle"
                    label="Published"
                    value={publishedPosts}
                    color="#10b981"
                />
                <StatCard
                    icon="schedule"
                    label="Scheduled"
                    value={scheduledPosts}
                    color="#3b82f6"
                />
                <StatCard
                    icon="pending"
                    label="In Review"
                    value={inReviewPosts}
                    color="#f59e0b"
                />
            </div>

            {/* Campaign Progress */}
            {campaign.startDate && campaign.endDate && (
                <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 border border-[var(--color-surface-border)]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]" style={{ color: brandColor }}>timeline</span>
                            Campaign Progress
                        </h3>
                        {daysRemaining !== null && (
                            <span className="text-xs font-bold text-[var(--color-text-muted)]">
                                {daysRemaining === 0 ? 'Ends today' : `${daysRemaining} days remaining`}
                            </span>
                        )}
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                            <span>{format(new Date(campaign.startDate), dateFormat, { locale: dateLocale })}</span>
                            <span>{format(new Date(campaign.endDate), dateFormat, { locale: dateLocale })}</span>
                        </div>
                        <div className="h-3 bg-[var(--color-surface-bg)] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%`, backgroundColor: brandColor }}
                            />
                        </div>
                        <div className="text-center text-sm font-bold" style={{ color: brandColor }}>
                            {progressPercent}% Complete
                        </div>
                    </div>
                </div>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Post Status Distribution */}
                <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 border border-[var(--color-surface-border)]">
                    <h3 className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider flex items-center gap-2 mb-6">
                        <span className="material-symbols-outlined text-[18px]" style={{ color: brandColor }}>bar_chart</span>
                        Post Status Distribution
                    </h3>
                    {statusData.length > 0 ? (
                        <div className="space-y-4">
                            {statusData.map(status => (
                                <div key={status.label} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-[var(--color-text-main)]">{status.label}</span>
                                        <span className="font-bold" style={{ color: status.color }}>{status.count}</span>
                                    </div>
                                    <div className="h-2 bg-[var(--color-surface-bg)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${(status.count / maxStatusCount) * 100}%`,
                                                backgroundColor: status.color
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
                            No posts yet
                        </div>
                    )}
                </div>

                {/* Platform Breakdown */}
                <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 border border-[var(--color-surface-border)]">
                    <h3 className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider flex items-center gap-2 mb-6">
                        <span className="material-symbols-outlined text-[18px]" style={{ color: brandColor }}>devices</span>
                        Platform Breakdown
                    </h3>
                    {platformData.length > 0 ? (
                        <div className="space-y-3">
                            {platformData.map(([platform, count]) => (
                                <div key={platform} className="flex items-center justify-between p-3 bg-[var(--color-surface-bg)] rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <PlatformIcon platform={platform as SocialPlatform} />
                                        <span className="font-medium text-sm text-[var(--color-text-main)]">{platform}</span>
                                    </div>
                                    <span className="text-sm font-bold px-2 py-0.5 rounded-lg bg-[var(--color-surface-hover)]" style={{ color: brandColor }}>
                                        {count} {count === 1 ? 'post' : 'posts'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
                            No posts yet
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Campaign Info */}
            <div className="bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] rounded-2xl p-6 border border-[var(--color-surface-border)]">
                <h3 className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[18px]" style={{ color: brandColor }}>info</span>
                    Campaign Overview
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <div className="text-[var(--color-text-muted)] text-xs uppercase mb-1">Status</div>
                        <div className="font-bold text-[var(--color-text-main)]">{campaign.status}</div>
                    </div>
                    <div>
                        <div className="text-[var(--color-text-muted)] text-xs uppercase mb-1">Platforms</div>
                        <div className="font-bold text-[var(--color-text-main)]">{campaign.platforms?.length || 0} active</div>
                    </div>
                    <div>
                        <div className="text-[var(--color-text-muted)] text-xs uppercase mb-1">Phases</div>
                        <div className="font-bold text-[var(--color-text-main)]">{campaign.phases?.length || 0} defined</div>
                    </div>
                    <div>
                        <div className="text-[var(--color-text-muted)] text-xs uppercase mb-1">KPIs</div>
                        <div className="font-bold text-[var(--color-text-main)]">{campaign.kpis?.length || 0} tracked</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper Components
const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) => (
    <div className="bg-[var(--color-surface-card)] rounded-2xl p-5 border border-[var(--color-surface-border)] flex flex-col">
        <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[20px]" style={{ color }}>{icon}</span>
            <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-3xl font-black text-[var(--color-text-main)]">{value}</div>
    </div>
);

const PlatformIcon = ({ platform }: { platform: SocialPlatform }) => {
    const icons: Record<string, { icon: string; color: string }> = {
        'Instagram': { icon: 'photo_camera', color: '#E1306C' },
        'Facebook': { icon: 'thumb_up', color: '#1877F2' },
        'LinkedIn': { icon: 'work', color: '#0A66C2' },
        'TikTok': { icon: 'music_note', color: '#000000' },
        'X': { icon: 'alternate_email', color: '#1DA1F2' },
        'YouTube': { icon: 'play_arrow', color: '#FF0000' },
    };
    const config = icons[platform] || { icon: 'public', color: '#6b7280' };

    return (
        <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${config.color}15` }}
        >
            <span className="material-symbols-outlined text-[18px]" style={{ color: config.color }}>{config.icon}</span>
        </div>
    );
};
