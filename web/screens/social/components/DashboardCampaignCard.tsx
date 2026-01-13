import React from 'react';
import { SocialCampaign, SocialPost } from '../../../types';
import { Link } from 'react-router-dom';
import { PlatformIcon } from './PlatformIcon';
import { format } from 'date-fns';
import { useLanguage } from '../../../context/LanguageContext';
import { getSocialCampaignStatusLabel } from '../../../utils/socialLocalization';

interface DashboardCampaignCardProps {
    campaign: SocialCampaign;
    posts: SocialPost[];
    projectId: string;
}

export const DashboardCampaignCard: React.FC<DashboardCampaignCardProps> = ({ campaign, posts, projectId }) => {
    const { t, dateLocale, dateFormat } = useLanguage();
    const campaignPosts = posts.filter(p => p.campaignId === campaign.id);
    const publishedPosts = campaignPosts.filter(p => p.status === 'Published').length;
    const totalPosts = campaignPosts.length;
    const progress = totalPosts > 0 ? (publishedPosts / totalPosts) * 100 : 0;

    const brandColor = campaign.color || '#E1306C';

    return (
        <div className="bg-card rounded-xl border border-surface overflow-hidden hover:shadow-lg transition-all group">
            <div className="h-2 w-full" style={{ backgroundColor: brandColor }} />
            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-main group-hover:text-primary transition-colors">
                            {campaign.name}
                        </h3>
                        <p className="text-xs text-muted line-clamp-1 mt-1">
                            {campaign.goal}
                        </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${campaign.status === 'Active' ? 'bg-green-100 text-green-700' :
                        campaign.status === 'Planning' ? 'bg-blue-100 text-blue-700' :
                            'bg-surface-hover text-muted'
                        }`}>
                        {getSocialCampaignStatusLabel(campaign.status, t)}
                    </span>
                </div>

                <div className="space-y-4">
                    {/* Progress */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{t('social.dashboardCampaign.progress')}</span>
                            <span className="text-[10px] font-bold text-main">
                                {t('social.dashboardCampaign.postsCount').replace('{published}', String(publishedPosts)).replace('{total}', String(totalPosts))}
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-hover rounded-full overflow-hidden">
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
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider mr-1">{t('social.dashboardCampaign.platforms')}</span>
                        <div className="flex gap-1.5">
                            {campaign.platforms?.map(platform => (
                                <div key={platform} className="size-5" title={platform}>
                                    <PlatformIcon platform={platform} className="size-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-5 pt-4 border-t border-surface">
                    <div className="flex items-center gap-2 text-[10px] text-muted">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        <span>
                            {t('social.dashboardCampaign.ends')
                                .replace('{date}', campaign.endDate ? format(new Date(campaign.endDate), dateFormat, { locale: dateLocale }) : t('social.dashboardCampaign.tbd'))}
                        </span>
                    </div>
                    <Link
                        to={`/project/${projectId}/social/campaigns/${campaign.id}`}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                        {t('social.dashboardCampaign.viewBoard')}
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};
