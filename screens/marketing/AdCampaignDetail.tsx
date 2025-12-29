import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    subscribeAdCampaign,
    subscribeAdSets,
    updateAdCampaignStatus,
    deleteAdCampaign,
    getAdPerformanceHistory
} from '../../services/marketingService';
import { getIdeaById, getSocialPostById } from '../../services/dataService';
import { AdCampaign, AdSet, Idea, SocialPost, AdPlatform, AdCampaignStatus } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useConfirm } from '../../context/UIContext';
import { format } from 'date-fns';

const PLATFORM_CONFIG: Record<AdPlatform, { color: string; bg: string; darkBg: string; name: string }> = {
    Google: { color: '#4285F4', bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/30', name: 'Google Ads' },
    Meta: { color: '#0668E1', bg: 'bg-indigo-100', darkBg: 'dark:bg-indigo-900/30', name: 'Meta Ads' },
    LinkedIn: { color: '#0A66C2', bg: 'bg-sky-100', darkBg: 'dark:bg-sky-900/30', name: 'LinkedIn Ads' },
    TikTok: { color: '#000000', bg: 'bg-gray-100', darkBg: 'dark:bg-gray-700', name: 'TikTok Ads' },
    Other: { color: '#6B7280', bg: 'bg-gray-100', darkBg: 'dark:bg-gray-700', name: 'Other' }
};

const STATUS_CONFIG: Record<AdCampaignStatus, { label: string; color: string; bg: string }> = {
    Draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' },
    Pending: { label: 'Pending Review', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    Enabled: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    Paused: { label: 'Paused', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    Ended: { label: 'Ended', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
    Rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' }
};

export const AdCampaignDetail = () => {
    const { id: projectId, campaignId } = useParams<{ id: string; campaignId: string }>();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { t, dateLocale, dateFormat } = useLanguage();

    const [campaign, setCampaign] = useState<AdCampaign | null>(null);
    const [adSets, setAdSets] = useState<AdSet[]>([]);
    const [originIdea, setOriginIdea] = useState<Idea | null>(null);
    const [linkedPosts, setLinkedPosts] = useState<SocialPost[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!campaignId) return;

        const unsubCampaign = subscribeAdCampaign(campaignId, async (data) => {
            setCampaign(data);
            setLoading(false);

            // Load origin idea if linked
            if (data?.originIdeaId && projectId) {
                const idea = await getIdeaById(projectId, data.originIdeaId);
                setOriginIdea(idea);
            }

            // Load linked social posts
            if (data?.linkedSocialPostIds && projectId) {
                const posts = await Promise.all(
                    data.linkedSocialPostIds.map(id => getSocialPostById(projectId, id))
                );
                setLinkedPosts(posts.filter(Boolean) as SocialPost[]);
            }
        });

        const unsubAdSets = subscribeAdSets(campaignId, (data) => {
            setAdSets(data);
        });

        return () => {
            unsubCampaign();
            unsubAdSets();
        };
    }, [campaignId, projectId]);

    const handleStatusToggle = async () => {
        if (!campaign) return;
        const newStatus: AdCampaignStatus = campaign.status === 'Enabled' ? 'Paused' : 'Enabled';
        await updateAdCampaignStatus(campaign.id, newStatus);
    };

    const handleDelete = async () => {
        if (!campaign) return;
        const confirmed = await confirm(
            'Delete Campaign',
            'Are you sure you want to delete this campaign? This action cannot be undone.'
        );
        if (confirmed) {
            await deleteAdCampaign(campaign.id);
            navigate(`/project/${projectId}/marketing/ads`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <span className="material-symbols-outlined animate-spin text-3xl text-[var(--color-primary)]">progress_activity</span>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <span className="material-symbols-outlined text-4xl text-[var(--color-text-muted)]">error</span>
                <p className="text-[var(--color-text-muted)]">Campaign not found</p>
                <Link to={`/project/${projectId}/marketing/ads`} className="text-[var(--color-primary)] font-bold hover:underline">
                    ← Back to Campaigns
                </Link>
            </div>
        );
    }

    const platformConfig = PLATFORM_CONFIG[campaign.platform];
    const statusConfig = STATUS_CONFIG[campaign.status];
    const budgetProgress = campaign.budgetTotal ? (campaign.spend / campaign.budgetTotal) * 100 : 0;

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">

            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        to={`/project/${projectId}/marketing/ads`}
                        className="w-10 h-10 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:border-[var(--color-text-muted)] transition-all"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold ${platformConfig.bg} ${platformConfig.darkBg}`}
                        style={{ color: platformConfig.color }}
                    >
                        {campaign.platform[0]}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-2xl font-black text-[var(--color-text-main)]">{campaign.name}</h1>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                                {statusConfig.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
                            <span>{platformConfig.name}</span>
                            <span>•</span>
                            <span>{campaign.objective}</span>
                            <span>•</span>
                            <span>Started {format(new Date(campaign.startDate), dateFormat, { locale: dateLocale })}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleStatusToggle}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${campaign.status === 'Enabled'
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">
                            {campaign.status === 'Enabled' ? 'pause' : 'play_arrow'}
                        </span>
                        {campaign.status === 'Enabled' ? 'Pause' : 'Enable'}
                    </button>
                    <Link
                        to={`/project/${projectId}/marketing/ads/${campaign.id}/edit`}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] hover:border-[var(--color-primary)] text-[var(--color-text-main)] rounded-xl text-sm font-bold transition-all"
                    >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                        Edit
                    </Link>
                    <button
                        onClick={handleDelete}
                        className="w-10 h-10 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-500 hover:border-red-500 transition-all"
                    >
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>

            {/* Campaign Description */}
            {campaign.description && (
                <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-5">
                    <p className="text-[var(--color-text-main)]">{campaign.description}</p>
                </div>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <MetricCard label="Total Spend" value={`$${campaign.spend?.toLocaleString() || 0}`} icon="payments" color="text-blue-500" />
                <MetricCard label="Impressions" value={(campaign.metrics?.impressions || 0).toLocaleString()} icon="visibility" color="text-indigo-500" />
                <MetricCard label="Clicks" value={(campaign.metrics?.clicks || 0).toLocaleString()} icon="ads_click" color="text-purple-500" />
                <MetricCard label="CTR" value={`${campaign.metrics?.ctr?.toFixed(2) || 0}%`} icon="percent" color="text-teal-500" />
                <MetricCard label="Conversions" value={campaign.metrics?.conversions || 0} icon="conversion_path" color="text-amber-500" />
                <MetricCard
                    label="ROAS"
                    value={`${campaign.metrics?.roas?.toFixed(2) || 0}x`}
                    icon="trending_up"
                    color={campaign.metrics?.roas && campaign.metrics.roas >= 1 ? 'text-emerald-500' : 'text-red-500'}
                />
            </div>

            {/* Budget Progress */}
            {campaign.budgetTotal && campaign.budgetTotal > 0 && (
                <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-5">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-[var(--color-text-main)] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-blue-500">account_balance_wallet</span>
                            Budget Progress
                        </h3>
                        <span className="text-sm font-bold text-[var(--color-text-muted)]">
                            ${campaign.spend?.toLocaleString() || 0} / ${campaign.budgetTotal.toLocaleString()}
                            <span className="ml-2 text-[var(--color-text-subtle)]">({budgetProgress.toFixed(1)}%)</span>
                        </span>
                    </div>
                    <div className="h-3 bg-[var(--color-surface-bg)] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${budgetProgress > 90 ? 'bg-red-500' : budgetProgress > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                            style={{ width: `${Math.min(budgetProgress, 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-2">
                        <span>Daily: ${campaign.budgetDaily?.toLocaleString() || 'Not set'}</span>
                        <span>
                            {campaign.endDate
                                ? `Ends ${format(new Date(campaign.endDate), dateFormat, { locale: dateLocale })}`
                                : 'No end date'
                            }
                        </span>
                    </div>
                </div>
            )}

            {/* Grid: Ad Sets + Sidebar */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Ad Sets (coming soon placeholder) */}
                <div className="xl:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-[var(--color-text-main)] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-purple-500">layers</span>
                            Ad Sets
                        </h3>
                        <button
                            className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1"
                            disabled
                        >
                            <span className="material-symbols-outlined text-[14px]">add</span>
                            Add Ad Set
                        </button>
                    </div>

                    {adSets.length === 0 ? (
                        <div className="bg-[var(--color-surface-card)] rounded-2xl border-2 border-dashed border-[var(--color-surface-border)] p-8 text-center">
                            <span className="material-symbols-outlined text-4xl text-[var(--color-text-muted)] opacity-50 mb-2">layers</span>
                            <p className="text-sm text-[var(--color-text-muted)]">No ad sets yet</p>
                            <p className="text-xs text-[var(--color-text-subtle)] mt-1">Ad sets help organize targeting and creatives</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {adSets.map(adSet => (
                                <div
                                    key={adSet.id}
                                    className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)] p-4 hover:border-[var(--color-primary)] transition-all cursor-pointer"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-[var(--color-text-main)]">{adSet.name}</h4>
                                            <span className={`text-xs font-bold ${adSet.status === 'Enabled' ? 'text-emerald-500' : 'text-gray-500'}`}>
                                                {adSet.status}
                                            </span>
                                        </div>
                                        {adSet.budgetDaily && (
                                            <span className="text-sm font-bold text-[var(--color-text-muted)]">
                                                ${adSet.budgetDaily}/day
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">

                    {/* Origin Flow */}
                    {originIdea && (
                        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-5">
                            <h3 className="font-bold text-[var(--color-text-main)] mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px] text-purple-500">lightbulb</span>
                                Origin Flow
                            </h3>
                            <Link
                                to={`/project/${projectId}/flows/${originIdea.id}`}
                                className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-xl transition-colors group"
                            >
                                <div className="size-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined">campaign</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-purple-700 dark:text-purple-300 truncate group-hover:text-purple-800 dark:group-hover:text-purple-200">
                                        {originIdea.title}
                                    </p>
                                    <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 uppercase font-bold">
                                        {originIdea.stage}
                                    </p>
                                </div>
                                <span className="material-symbols-outlined text-purple-400 group-hover:translate-x-1 transition-transform">
                                    arrow_forward
                                </span>
                            </Link>
                        </div>
                    )}

                    {/* Linked Social Posts */}
                    {linkedPosts.length > 0 && (
                        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-5">
                            <h3 className="font-bold text-[var(--color-text-main)] mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px] text-rose-500">share</span>
                                Linked Social Posts
                            </h3>
                            <div className="space-y-2">
                                {linkedPosts.map(post => (
                                    <Link
                                        key={post.id}
                                        to={`/project/${projectId}/social/edit/${post.id}`}
                                        className="flex items-center gap-3 p-3 bg-[var(--color-surface-bg)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors group"
                                    >
                                        <div className="size-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center text-xs font-bold">
                                            {post.platform[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-[var(--color-text-main)] truncate">
                                                {post.content?.caption?.slice(0, 40) || 'Untitled post'}...
                                            </p>
                                            <p className="text-[10px] text-[var(--color-text-muted)]">
                                                {post.platform} • {post.status}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Campaign Details */}
                    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-5">
                        <h3 className="font-bold text-[var(--color-text-main)] mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-blue-500">info</span>
                            Details
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-[var(--color-text-muted)]">Created</span>
                                <span className="font-medium text-[var(--color-text-main)]">
                                    {campaign.createdAt?.toDate
                                        ? format(campaign.createdAt.toDate(), dateFormat, { locale: dateLocale })
                                        : 'Unknown'
                                    }
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--color-text-muted)]">Budget Type</span>
                                <span className="font-medium text-[var(--color-text-main)]">{campaign.budgetType}</span>
                            </div>
                            {campaign.targetAudience?.locations && campaign.targetAudience.locations.length > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-[var(--color-text-muted)]">Locations</span>
                                    <span className="font-medium text-[var(--color-text-main)]">
                                        {campaign.targetAudience.locations.slice(0, 2).join(', ')}
                                        {campaign.targetAudience.locations.length > 2 && ` +${campaign.targetAudience.locations.length - 2}`}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Sub-components
const MetricCard = ({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) => (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-4">
        <span className={`material-symbols-outlined text-xl mb-2 block ${color}`}>{icon}</span>
        <div className="text-xl font-black text-[var(--color-text-main)]">{value}</div>
        <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mt-1">{label}</div>
    </div>
);
