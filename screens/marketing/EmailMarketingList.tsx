import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subscribeEmailCampaigns, subscribeAudiences } from '../../services/marketingService';
import { EmailCampaign, MarketingAudience } from '../../types';
import { CreateMarketingCampaignModal } from './components/CreateMarketingCampaignModal';

export const EmailMarketingList = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [audiences, setAudiences] = useState<MarketingAudience[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!projectId) return;
        const unsubCampaigns = subscribeEmailCampaigns(projectId, (data) => setCampaigns(data));
        const unsubAudiences = subscribeAudiences(projectId, (data) => setAudiences(data));
        setLoading(false);
        return () => {
            unsubCampaigns();
            unsubAudiences();
        };
    }, [projectId]);

    const totalSent = campaigns.reduce((acc, c) => acc + c.stats.sent, 0);
    const avgOpenRate = campaigns.length > 0
        ? (campaigns.reduce((acc, c) => acc + (c.stats.sent > 0 ? (c.stats.opened / c.stats.sent) * 100 : 0), 0) / campaigns.length)
        : 0;

    return (
        <div className="space-y-6">
            <CreateMarketingCampaignModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                type="email"
                projectId={projectId!}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="h3 mb-1">Email Marketing</h2>
                    <p className="text-[var(--color-text-muted)]">Manage newsletters and automated email campaigns.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white font-bold rounded-lg hover:opacity-90 transition-opacity self-start"
                >
                    <span className="material-symbols-outlined">add</span>
                    Create Email
                </button>
                <Link to="builder">
                    <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] text-[var(--color-text-main)] font-bold rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors self-start">
                        <span className="material-symbols-outlined">design_services</span>
                        New Template
                    </button>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main List */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="h4">Campaigns</h3>
                    {campaigns.map(campaign => (
                        <div key={campaign.id} className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-5 hover:border-[var(--color-primary)] transition-colors group">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-lg group-hover:text-[var(--color-primary)] transition-colors">{campaign.name}</h4>
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${campaign.status === 'Sent' ? 'bg-green-100 text-green-700' :
                                            campaign.status === 'Draft' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {campaign.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--color-text-muted)]">{campaign.subject}</p>
                                </div>
                                <div className="text-right text-xs text-[var(--color-text-muted)]">
                                    {campaign.sentAt && new Date(campaign.sentAt).toLocaleDateString()}
                                </div>
                            </div>

                            {campaign.status === 'Sent' && (
                                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--color-surface-border)] mt-4">
                                    <div>
                                        <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Sent</p>
                                        <p className="font-semibold">{campaign.stats.sent.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Open Rate</p>
                                        <p className="font-semibold flex items-center gap-1">
                                            {((campaign.stats.opened / campaign.stats.sent) * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Click Rate</p>
                                        <p className="font-semibold">
                                            {((campaign.stats.clicked / campaign.stats.sent) * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {campaigns.length === 0 && (
                        <div className="p-8 text-center bg-[var(--color-surface-bg)] rounded-xl border border-dashed border-[var(--color-surface-border)] text-[var(--color-text-muted)]">
                            No email campaigns found.
                        </div>
                    )}
                </div>

                {/* Sidebar Stats & Audiences */}
                <div className="space-y-6">
                    <div className="bg-[var(--color-surface-card)] p-5 rounded-xl border border-[var(--color-surface-border)]">
                        <h3 className="h5 mb-4">Performance</h3>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-[var(--color-text-muted)] uppercase font-bold tracking-wider">Total Emails Sent</p>
                                <p className="text-2xl font-bold">{totalSent.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-[var(--color-text-muted)] uppercase font-bold tracking-wider">Avg. Open Rate</p>
                                <p className="text-2xl font-bold text-blue-500">{avgOpenRate.toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--color-surface-card)] p-5 rounded-xl border border-[var(--color-surface-border)]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="h5">Audiences</h3>
                            <button className="text-[var(--color-primary)] text-sm font-bold hover:underline">Manage</button>
                        </div>
                        <ul className="space-y-3">
                            {audiences.map(audience => (
                                <li key={audience.id} className="flex justify-between items-center text-sm">
                                    <span className="font-medium">{audience.name}</span>
                                    <span className="bg-[var(--color-surface-hover)] px-2 py-1 rounded-full text-xs text-[var(--color-text-muted)]">
                                        {audience.count.toLocaleString()}
                                    </span>
                                </li>
                            ))}
                            {audiences.length === 0 && (
                                <li className="text-[var(--color-text-muted)] text-sm italic">No audiences defined.</li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
