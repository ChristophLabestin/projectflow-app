import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subscribeAdCampaigns } from '../../services/marketingService';
import { AdCampaign } from '../../types';
import { CreateMarketingCampaignModal } from './components/CreateMarketingCampaignModal';

export const PaidAdsList = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeAdCampaigns(projectId, (data) => {
            setCampaigns(data);
            setLoading(false);
        });
        return () => unsub();
    }, [projectId]);

    const totalSpend = campaigns.reduce((acc, c) => acc + c.spend, 0);
    const totalConversions = campaigns.reduce((acc, c) => acc + c.metrics.conversions, 0);
    const avgRoas = campaigns.length > 0
        ? campaigns.reduce((acc, c) => acc + c.metrics.roas, 0) / campaigns.length
        : 0;

    return (
        <div className="space-y-6">
            <CreateMarketingCampaignModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                type="ad"
                projectId={projectId!}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="h3 mb-1">Paid Advertising</h2>
                    <p className="text-[var(--color-text-muted)]">Manage your campaigns across Google, Meta, and LinkedIn.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] font-bold rounded-lg hover:opacity-90 transition-opacity self-start"
                >
                    <span className="material-symbols-outlined">add</span>
                    Create Campaign
                </button>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--color-surface-card)] p-4 rounded-xl border border-[var(--color-surface-border)]">
                    <p className="text-xs text-[var(--color-text-muted)] uppercase font-bold tracking-wider mb-1">Total Spend</p>
                    <p className="text-2xl font-bold">${totalSpend.toLocaleString()}</p>
                </div>
                <div className="bg-[var(--color-surface-card)] p-4 rounded-xl border border-[var(--color-surface-border)]">
                    <p className="text-xs text-[var(--color-text-muted)] uppercase font-bold tracking-wider mb-1">Conversions</p>
                    <p className="text-2xl font-bold">{totalConversions}</p>
                </div>
                <div className="bg-[var(--color-surface-card)] p-4 rounded-xl border border-[var(--color-surface-border)]">
                    <p className="text-xs text-[var(--color-text-muted)] uppercase font-bold tracking-wider mb-1">Avg. ROAS</p>
                    <p className="text-2xl font-bold text-green-500">{avgRoas.toFixed(2)}x</p>
                </div>
                <div className="bg-[var(--color-surface-card)] p-4 rounded-xl border border-[var(--color-surface-border)]">
                    <p className="text-xs text-[var(--color-text-muted)] uppercase font-bold tracking-wider mb-1">Active Campaigns</p>
                    <p className="text-2xl font-bold">{campaigns.filter(c => c.status === 'Enabled').length}</p>
                </div>
            </div>

            {/* Campaign List */}
            <div className="space-y-4">
                {campaigns.map(campaign => (
                    <div key={campaign.id} className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-5 hover:border-[var(--color-primary)] transition-colors cursor-pointer group">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                            <div className="flex items-center gap-3">
                                <PlatformIcon platform={campaign.platform} />
                                <div>
                                    <h3 className="font-bold text-lg group-hover:text-[var(--color-primary)] transition-colors">{campaign.name}</h3>
                                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                        <span className={`px-2 py-0.5 rounded-full ${campaign.status === 'Enabled' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {campaign.status}
                                        </span>
                                        <span>•</span>
                                        <span>{campaign.objective}</span>
                                        {campaign.originIdeaId && (
                                            <>
                                                <span>•</span>
                                                <Link
                                                    to={`/project/${projectId}/ideas/${campaign.originIdeaId}`}
                                                    className="flex items-center gap-1 text-purple-600 hover:text-purple-800 transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">lightbulb</span>
                                                    <span className="hover:underline">Strategy</span>
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium">{campaign.metrics.clicks} Clicks</p>
                                <p className="text-xs text-[var(--color-text-muted)]">CPC: ${campaign.metrics.cpc.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Mini Metrics Grid inside card */}
                        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-[var(--color-surface-border)]">
                            <div>
                                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Impressions</p>
                                <p className="font-semibold text-sm">{campaign.metrics.impressions.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">CTR</p>
                                <p className="font-semibold text-sm">{campaign.metrics.ctr}%</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Cost / Conv.</p>
                                <p className="font-semibold text-sm">${campaign.metrics.costPerConversion.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Daily Budget</p>
                                <p className="font-semibold text-sm">${campaign.budgetDaily}</p>
                            </div>
                        </div>
                    </div>
                ))}

                {campaigns.length === 0 && !loading && (
                    <div className="text-center py-12 bg-[var(--color-surface-bg)] rounded-xl border border-dashed border-[var(--color-surface-border)] text-[var(--color-text-muted)]">
                        No ad campaigns yet. Create one to start tracking performance.
                    </div>
                )}
            </div>
        </div>
    );
};

const PlatformIcon = ({ platform }: { platform: string }) => {
    // Simple visual indicators for platforms
    const colors: any = {
        Google: 'bg-blue-500',
        Meta: 'bg-blue-600',
        LinkedIn: 'bg-blue-800',
        Other: 'bg-gray-500'
    };

    return (
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs ${colors[platform] || colors.Other}`}>
            {platform[0]}
        </div>
    );
};
