import React from 'react';
import { SocialCampaign, SocialPost } from '../../../types';
import { Link } from 'react-router-dom';
import { PlatformIcon } from './PlatformIcon';
import { format } from 'date-fns';
import { dateLocale, dateFormat } from '../../../utils/activityHelpers';

interface DashboardCampaignCardProps {
    campaign: SocialCampaign;
    posts: SocialPost[];
    projectId: string;
}

export const DashboardCampaignCard: React.FC<DashboardCampaignCardProps> = ({ campaign, posts, projectId }) => {
    const campaignPosts = posts.filter(p => p.campaignId === campaign.id);
    const publishedPosts = campaignPosts.filter(p => p.status === 'Published').length;
    const totalPosts = campaignPosts.length;
    const progress = totalPosts > 0 ? (publishedPosts / totalPosts) * 100 : 0;

    const brandColor = campaign.color || '#E1306C';

    return (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)] overflow-hidden hover:shadow-lg transition-all group">
            <div className="h-2 w-full" style={{ backgroundColor: brandColor }} />
            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">
                            {campaign.name}
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-1 mt-1">
                            {campaign.goal}
                        </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${campaign.status === 'Active' ? 'bg-green-100 text-green-700' :
                        campaign.status === 'Planning' ? 'bg-blue-100 text-blue-700' :
                            'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                        }`}>
                        {campaign.status}
                    </span>
                </div>

                <div className="space-y-4">
                    {/* Progress */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Progress</span>
                            <span className="text-[10px] font-bold text-[var(--color-text-main)]">{publishedPosts}/{totalPosts} Posts</span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                            <div
                                className="h-full transition-all duration-1000 ease-out"
                                style={{
                                    width: `${progress}%`,
                                    backgroundColor: brandColor
                                }}
                            />
                        </div>
                    </div>

                    {/* Platforms */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mr-1">Platforms:</span>
                        <div className="flex gap-1.5">
                            {campaign.platforms?.map(platform => (
                                <div key={platform} className="size-5" title={platform}>
                                    <PlatformIcon platform={platform} className="size-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--color-surface-border)]">
                    <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        <span>Ends {campaign.endDate ? format(new Date(campaign.endDate), dateFormat, { locale: dateLocale }) : ''}</span>
                    </div>
                    <Link
                        to={`/project/${projectId}/social/campaigns/${campaign.id}`}
                        className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1"
                    >
                        View Board
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};
