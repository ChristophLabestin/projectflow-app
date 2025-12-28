import React from 'react';
import { SocialCampaign, SocialPost } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { PlatformIcon } from './PlatformIcon';
import { format } from 'date-fns';
import { dateLocale } from '../../../utils/activityHelpers';

interface CampaignHeaderProps {
    campaign: SocialCampaign;
    posts: SocialPost[]; // For calculating stats
    onEdit: () => void;
    onAIPlan: () => void;
    onViewPlannedContent?: () => void;
    onAddContent: () => void;
    onBack: () => void;
    brandColor?: string;
    isGenerating?: boolean;
}

export const CampaignHeader: React.FC<CampaignHeaderProps> = ({
    campaign,
    posts,
    onEdit,
    onAIPlan,
    onViewPlannedContent,
    onAddContent,
    onBack,
    brandColor = '#E1306C',
    isGenerating = false,
}) => {
    // Calculate simple stats
    // const publishedCount = posts.filter(p => p.status === 'Published').length;

    // Using date-fns for formatting
    const startDate = campaign.startDate ? format(new Date(campaign.startDate), 'MMM d', { locale: dateLocale }) : 'TBD';
    const endDate = campaign.endDate ? format(new Date(campaign.endDate), 'MMM d, yyyy', { locale: dateLocale }) : 'TBD';

    return (
        <div className="relative shrink-0 border-b border-[var(--color-surface-border)] bg-[var(--color-bg-base)]">
            {/* Background Gradient - reduced opacity/height */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-surface-card)] to-[var(--color-bg-base)]" />
                <div className="absolute top-0 left-0 bottom-0 w-1/3 opacity-30 blur-3xl" style={{ backgroundColor: brandColor }} />
            </div>

            <div className="relative z-10 px-6 py-4">
                <div className="flex flex-col gap-4">
                    {/* Top Row: Identity & Actions */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        {/* Identity */}
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                onClick={onBack}
                                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors p-1.5 -ml-1.5 rounded-md hover:bg-[var(--color-surface-hover)]"
                                title="Back to Campaigns"
                            >
                                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                            </button>

                            <h1 className="text-xl md:text-2xl font-bold text-[var(--color-text-main)] truncate tracking-tight">
                                {campaign.name}
                            </h1>

                            <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)]" style={{ color: brandColor, borderColor: `${brandColor}30` }}>
                                {campaign.status}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 items-center self-end md:self-auto pl-8 md:pl-0">
                            <button
                                onClick={onEdit}
                                className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] transition-colors border border-transparent hover:border-[var(--color-surface-border)]"
                                title="Edit Campaign"
                            >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>

                            <div className="h-4 w-px bg-[var(--color-surface-border)] mx-1" />

                            <Button
                                variant="secondary"
                                onClick={onAIPlan}
                                isLoading={isGenerating}
                                icon={<span className="material-symbols-outlined text-[16px]">auto_awesome</span>}
                                className="bg-[var(--color-surface-bg)] h-8 text-xs px-3 border border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]"
                            >
                                AI Plan
                            </Button>
                            {onViewPlannedContent && (
                                <Button
                                    variant="secondary"
                                    onClick={onViewPlannedContent}
                                    icon={<span className="material-symbols-outlined text-[16px]">table_chart</span>}
                                    className="bg-[var(--color-surface-bg)] h-8 text-xs px-3 border border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]"
                                >
                                    View Planned
                                </Button>
                            )}
                            <Button
                                variant="primary"
                                onClick={onAddContent}
                                icon={<span className="material-symbols-outlined text-[16px]">add</span>}
                                style={{ backgroundColor: brandColor, borderColor: brandColor }}
                                className="text-white h-8 text-xs px-3 shadow-sm shadow-current/20"
                            >
                                Add Content
                            </Button>
                        </div>
                    </div>

                    {/* Bottom Row: Meta Info (Cleaned up) */}
                    <div className="flex items-center gap-6 text-xs text-[var(--color-text-muted)] ml-8 pl-1">
                        {/* Date Range */}
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                            <span className="font-medium">
                                {startDate} - {endDate}
                            </span>
                        </div>

                        <div className="h-3 w-px bg-[var(--color-surface-border)]" />

                        {/* Item Count */}
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                            <span className="font-medium">{posts.length} Items</span>
                        </div>

                        {/* Removed Hashtags from here per plan to move them to Strategy View */}
                    </div>
                </div>
            </div>
        </div>
    );
};
