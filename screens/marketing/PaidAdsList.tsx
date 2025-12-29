import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { subscribeAdCampaigns, updateAdCampaignStatus } from '../../services/marketingService';
import { subscribeProjectIdeas } from '../../services/dataService';
import { AdCampaign, Idea, AdPlatform, AdCampaignStatus } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';

// Platform configuration with colors and icons
const PLATFORM_CONFIG: Record<AdPlatform, { color: string; bg: string; darkBg: string }> = {
    Google: { color: '#4285F4', bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/30' },
    Meta: { color: '#0668E1', bg: 'bg-indigo-100', darkBg: 'dark:bg-indigo-900/30' },
    LinkedIn: { color: '#0A66C2', bg: 'bg-sky-100', darkBg: 'dark:bg-sky-900/30' },
    TikTok: { color: '#000000', bg: 'bg-gray-100', darkBg: 'dark:bg-gray-700' },
    Other: { color: '#6B7280', bg: 'bg-gray-100', darkBg: 'dark:bg-gray-700' }
};

const STATUS_CONFIG: Record<AdCampaignStatus, { label: string; color: string; bg: string }> = {
    Draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' },
    Pending: { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    Enabled: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    Paused: { label: 'Paused', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    Ended: { label: 'Ended', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
    Rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' }
};

export const PaidAdsList = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t, dateLocale, dateFormat } = useLanguage();

    const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterPlatform, setFilterPlatform] = useState<AdPlatform | 'All'>('All');
    const [filterStatus, setFilterStatus] = useState<AdCampaignStatus | 'All'>('All');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!projectId) return;

        const unsubCampaigns = subscribeAdCampaigns(projectId, (data) => {
            setCampaigns(data);
            setLoading(false);
        });

        // Subscribe to marketing ideas that are approved and could become campaigns
        const unsubIdeas = subscribeProjectIdeas(projectId, (data) => {
            setIdeas(data.filter(i =>
                i.type === 'Marketing' &&
                (i.stage === 'Approved' || i.stage === 'Live') &&
                i.campaignType !== 'ad' // Not already converted
            ));
        });

        return () => {
            unsubCampaigns();
            unsubIdeas();
        };
    }, [projectId]);

    // Filtered campaigns
    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(c => {
            const matchesPlatform = filterPlatform === 'All' || c.platform === filterPlatform;
            const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
            const matchesSearch = !searchQuery ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesPlatform && matchesStatus && matchesSearch;
        });
    }, [campaigns, filterPlatform, filterStatus, searchQuery]);

    // Aggregate stats
    const stats = useMemo(() => {
        const active = campaigns.filter(c => c.status === 'Enabled');
        return {
            totalSpend: campaigns.reduce((sum, c) => sum + (c.spend || 0), 0),
            totalConversions: campaigns.reduce((sum, c) => sum + (c.metrics?.conversions || 0), 0),
            avgRoas: active.length > 0
                ? active.reduce((sum, c) => sum + (c.metrics?.roas || 0), 0) / active.length
                : 0,
            activeCampaigns: active.length,
            totalImpressions: campaigns.reduce((sum, c) => sum + (c.metrics?.impressions || 0), 0),
            avgCtr: active.length > 0
                ? active.reduce((sum, c) => sum + (c.metrics?.ctr || 0), 0) / active.length
                : 0
        };
    }, [campaigns]);

    // Platform breakdown
    const platformBreakdown = useMemo(() => {
        const breakdown: Record<string, { count: number; spend: number }> = {};
        campaigns.forEach(c => {
            if (!breakdown[c.platform]) {
                breakdown[c.platform] = { count: 0, spend: 0 };
            }
            breakdown[c.platform].count++;
            breakdown[c.platform].spend += c.spend || 0;
        });
        return Object.entries(breakdown).sort((a, b) => b[1].spend - a[1].spend);
    }, [campaigns]);

    const handleStatusToggle = async (campaign: AdCampaign) => {
        const newStatus: AdCampaignStatus = campaign.status === 'Enabled' ? 'Paused' : 'Enabled';
        await updateAdCampaignStatus(campaign.id, newStatus);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <span className="material-symbols-outlined animate-spin text-3xl text-[var(--color-primary)]">progress_activity</span>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-text-main)] tracking-tight">Paid Advertising</h1>
                    <p className="text-[var(--color-text-muted)] font-medium">Manage campaigns across Google, Meta, LinkedIn, and TikTok.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/project/${projectId}/flows?pipeline=Marketing`)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-hover)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-card)] rounded-xl text-sm font-bold transition-all border border-[var(--color-surface-border)]"
                    >
                        <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                        Flow Pipeline
                    </button>
                    <button
                        onClick={() => navigate(`/project/${projectId}/marketing/ads/create`)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white dark:text-slate-900 hover:bg-[var(--color-primary)]/90 shadow-lg shadow-[var(--color-primary)]/20 active:scale-95 rounded-xl text-sm font-bold transition-all"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Create Campaign
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <StatCard
                    label="Total Spend"
                    value={`$${stats.totalSpend.toLocaleString()}`}
                    icon="payments"
                    color="text-blue-500"
                    trend={null}
                />
                <StatCard
                    label="Active Campaigns"
                    value={stats.activeCampaigns}
                    icon="campaign"
                    color="text-emerald-500"
                    trend={null}
                />
                <StatCard
                    label="Conversions"
                    value={stats.totalConversions.toLocaleString()}
                    icon="conversion_path"
                    color="text-purple-500"
                    trend={null}
                />
                <StatCard
                    label="Avg. ROAS"
                    value={`${stats.avgRoas.toFixed(2)}x`}
                    icon="trending_up"
                    color="text-amber-500"
                    positive={stats.avgRoas >= 1}
                    trend={null}
                />
                <StatCard
                    label="Impressions"
                    value={stats.totalImpressions >= 1000
                        ? `${(stats.totalImpressions / 1000).toFixed(1)}K`
                        : stats.totalImpressions}
                    icon="visibility"
                    color="text-indigo-500"
                    trend={null}
                />
                <StatCard
                    label="Avg. CTR"
                    value={`${stats.avgCtr.toFixed(2)}%`}
                    icon="ads_click"
                    color="text-rose-500"
                    trend={null}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                {/* Left Column: Campaigns */}
                <div className="xl:col-span-8 space-y-6">

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3 p-4 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)]">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-[18px]">search</span>
                                <input
                                    type="text"
                                    placeholder="Search campaigns..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-10 pl-10 pr-4 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                />
                            </div>
                        </div>

                        <select
                            value={filterPlatform}
                            onChange={(e) => setFilterPlatform(e.target.value as AdPlatform | 'All')}
                            className="h-10 px-3 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl text-sm font-medium"
                        >
                            <option value="All">All Platforms</option>
                            <option value="Google">Google</option>
                            <option value="Meta">Meta</option>
                            <option value="LinkedIn">LinkedIn</option>
                            <option value="TikTok">TikTok</option>
                        </select>

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as AdCampaignStatus | 'All')}
                            className="h-10 px-3 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl text-sm font-medium"
                        >
                            <option value="All">All Status</option>
                            <option value="Enabled">Active</option>
                            <option value="Paused">Paused</option>
                            <option value="Draft">Draft</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>

                    {/* Campaign List */}
                    <div className="space-y-4">
                        {filteredCampaigns.length === 0 ? (
                            <EmptyState
                                onCreateClick={() => navigate(`/project/${projectId}/marketing/ads/create`)}
                                hasIdeas={ideas.length > 0}
                            />
                        ) : (
                            filteredCampaigns.map(campaign => (
                                <CampaignCard
                                    key={campaign.id}
                                    campaign={campaign}
                                    projectId={projectId!}
                                    onStatusToggle={handleStatusToggle}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Right Column: Sidebar */}
                <div className="xl:col-span-4 space-y-6">

                    {/* Platform Breakdown */}
                    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-5">
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-purple-500">pie_chart</span>
                            Platform Breakdown
                        </h3>
                        <div className="space-y-3">
                            {platformBreakdown.length === 0 ? (
                                <p className="text-xs text-[var(--color-text-muted)] text-center py-4">No campaign data yet</p>
                            ) : (
                                platformBreakdown.map(([platform, data]) => {
                                    const total = stats.totalSpend || 1;
                                    const pct = Math.round((data.spend / total) * 100);
                                    const config = PLATFORM_CONFIG[platform as AdPlatform];
                                    return (
                                        <div key={platform} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className={`size-6 flex items-center justify-center rounded-lg text-white font-bold text-[10px] ${config?.bg} ${config?.darkBg}`}
                                                    style={{ color: config?.color }}
                                                >
                                                    {platform[0]}
                                                </div>
                                                <span className="font-semibold text-[var(--color-text-main)]">{platform}</span>
                                                <span className="text-[var(--color-text-muted)]">({data.count})</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-[var(--color-surface-bg)] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{ width: `${pct}%`, backgroundColor: config?.color }}
                                                    />
                                                </div>
                                                <span className="font-bold text-[var(--color-text-muted)] w-8 text-right">{pct}%</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Ready to Convert from Flow */}
                    {ideas.length > 0 && (
                        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-5">
                            <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-amber-500">lightbulb</span>
                                Ready to Launch
                            </h3>
                            <p className="text-xs text-[var(--color-text-muted)] mb-4">
                                Approved marketing flows ready to become ad campaigns.
                            </p>
                            <div className="space-y-2">
                                {ideas.slice(0, 4).map(idea => (
                                    <Link
                                        key={idea.id}
                                        to={`/project/${projectId}/flows/${idea.id}`}
                                        className="flex items-center gap-3 p-3 bg-[var(--color-surface-bg)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors group"
                                    >
                                        <div className="size-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-[16px]">campaign</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-[var(--color-text-main)] truncate group-hover:text-[var(--color-primary)]">
                                                {idea.title}
                                            </p>
                                            <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold">
                                                {idea.stage}
                                            </p>
                                        </div>
                                        <span className="material-symbols-outlined text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] group-hover:translate-x-1 transition-all text-[18px]">
                                            arrow_forward
                                        </span>
                                    </Link>
                                ))}
                            </div>
                            {ideas.length > 4 && (
                                <Link
                                    to={`/project/${projectId}/flows?pipeline=Marketing`}
                                    className="block text-center text-xs font-bold text-[var(--color-primary)] mt-3 hover:underline"
                                >
                                    View all {ideas.length} ideas →
                                </Link>
                            )}
                        </div>
                    )}

                    {/* Quick Tips */}
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 p-5">
                        <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-200 mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">tips_and_updates</span>
                            Quick Tips
                        </h3>
                        <ul className="text-xs text-indigo-700 dark:text-indigo-300 space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-[14px] mt-0.5">check</span>
                                Start campaigns from the Flow Pipeline for strategic alignment
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-[14px] mt-0.5">check</span>
                                Boost social posts to amplify high-performing content
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-[14px] mt-0.5">check</span>
                                Track ROAS to optimize budget allocation
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Sub-components ---

const StatCard = ({
    label,
    value,
    icon,
    color,
    positive,
    trend
}: {
    label: string;
    value: string | number;
    icon: string;
    color: string;
    positive?: boolean;
    trend: number | null;
}) => (
    <div className="bg-[var(--color-surface-card)] p-4 rounded-2xl border border-[var(--color-surface-border)] flex flex-col">
        <div className="flex items-center justify-between mb-2">
            <span className={`material-symbols-outlined text-xl ${color}`}>{icon}</span>
            {trend !== null && (
                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    <span className="material-symbols-outlined text-[12px]">{trend >= 0 ? 'trending_up' : 'trending_down'}</span>
                    {Math.abs(trend)}%
                </span>
            )}
        </div>
        <div className={`text-xl font-black ${positive === false ? 'text-red-500' : 'text-[var(--color-text-main)]'}`}>
            {value}
        </div>
        <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mt-1">{label}</div>
    </div>
);

const CampaignCard = ({
    campaign,
    projectId,
    onStatusToggle
}: {
    campaign: AdCampaign;
    projectId: string;
    onStatusToggle: (campaign: AdCampaign) => void;
}) => {
    const platformConfig = PLATFORM_CONFIG[campaign.platform];
    const statusConfig = STATUS_CONFIG[campaign.status];
    const budgetProgress = campaign.budgetTotal ? (campaign.spend / campaign.budgetTotal) * 100 : 0;

    return (
        <Link
            to={`/project/${projectId}/marketing/ads/${campaign.id}`}
            className="block bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl p-5 hover:border-[var(--color-primary)] transition-all group"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${platformConfig.bg} ${platformConfig.darkBg}`}
                        style={{ color: platformConfig.color }}
                    >
                        {campaign.platform[0]}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">
                            {campaign.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mt-0.5">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                                {statusConfig.label}
                            </span>
                            <span>•</span>
                            <span>{campaign.objective}</span>
                            {campaign.originIdeaId && (
                                <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1 text-purple-600">
                                        <span className="material-symbols-outlined text-[14px]">lightbulb</span>
                                        From Flow
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm font-bold text-[var(--color-text-main)]">
                            ${campaign.spend?.toLocaleString() || 0}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold">Spent</p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onStatusToggle(campaign);
                        }}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${campaign.status === 'Enabled'
                                ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                            }`}
                        title={campaign.status === 'Enabled' ? 'Pause campaign' : 'Enable campaign'}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {campaign.status === 'Enabled' ? 'pause' : 'play_arrow'}
                        </span>
                    </button>
                </div>
            </div>

            {/* Budget Progress */}
            {campaign.budgetTotal && campaign.budgetTotal > 0 && (
                <div className="mb-4">
                    <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
                        <span>Budget Progress</span>
                        <span>${campaign.spend?.toLocaleString() || 0} / ${campaign.budgetTotal.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--color-surface-bg)] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${budgetProgress > 90 ? 'bg-red-500' : budgetProgress > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(budgetProgress, 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-3 pt-4 border-t border-[var(--color-surface-border)]">
                <MetricCell label="Impressions" value={campaign.metrics?.impressions?.toLocaleString() || 0} />
                <MetricCell label="CTR" value={`${campaign.metrics?.ctr?.toFixed(2) || 0}%`} />
                <MetricCell label="Conversions" value={campaign.metrics?.conversions || 0} />
                <MetricCell
                    label="ROAS"
                    value={`${campaign.metrics?.roas?.toFixed(2) || 0}x`}
                    highlight={campaign.metrics?.roas && campaign.metrics.roas >= 1}
                />
            </div>
        </Link>
    );
};

const MetricCell = ({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) => (
    <div>
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold">{label}</p>
        <p className={`font-bold text-sm ${highlight ? 'text-emerald-500' : 'text-[var(--color-text-main)]'}`}>{value}</p>
    </div>
);

const EmptyState = ({ onCreateClick, hasIdeas }: { onCreateClick: () => void; hasIdeas: boolean }) => (
    <div className="text-center py-16 bg-[var(--color-surface-card)] rounded-2xl border-2 border-dashed border-[var(--color-surface-border)]">
        <div className="inline-flex p-4 rounded-full bg-[var(--color-surface-bg)] text-[var(--color-text-muted)] mb-4">
            <span className="material-symbols-outlined text-4xl">campaign</span>
        </div>
        <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-2">No ad campaigns yet</h3>
        <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto mb-6">
            {hasIdeas
                ? "Convert your approved marketing flows into ad campaigns, or create a new one from scratch."
                : "Create your first ad campaign to start tracking performance across platforms."
            }
        </p>
        <button
            onClick={onCreateClick}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90 transition-opacity"
        >
            <span className="material-symbols-outlined">add</span>
            Create Campaign
        </button>
    </div>
);
