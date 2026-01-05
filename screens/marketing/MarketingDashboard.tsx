import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFunnelMetrics, subscribeMarketingCampaigns } from '../../services/marketingService';
import { MarketingFunnelMetric, MarketingCampaign } from '../../types';
import { BarChart } from '../../components/ui/charts/BarChart';

export const MarketingDashboard = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [funnel, setFunnel] = useState<MarketingFunnelMetric[]>([]);
    const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);

    useEffect(() => {
        if (!projectId) return;

        // Fetch funnel (async)
        getFunnelMetrics(projectId).then(setFunnel);

        // Subscribe global strategy campaigns
        const unsub = subscribeMarketingCampaigns(projectId, setCampaigns);
        return () => unsub();
    }, [projectId]);

    const budgetData = campaigns.map(c => ({
        label: c.name,
        value: c.budgetTotal || 0,
        color: '#3b82f6'
    }));

    const totalBudget = campaigns.reduce((acc, c) => acc + (c.budgetTotal || 0), 0);
    const totalSpent = campaigns.reduce((acc, c) => acc + (c.budgetSpent || 0), 0);
    const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Marketing Funnel */}
                <div className="bg-card rounded-xl border border-surface p-6">
                    <h3 className="h4 mb-6">Marketing Funnel</h3>
                    <div className="space-y-4">
                        {funnel.map((stage, index) => {
                            // Find the max value to calculate width percentage
                            const maxValue = funnel.length > 0 ? funnel[0].value : 1;
                            const widthPercent = (stage.value / maxValue) * 100;

                            return (
                                <div key={stage.stage} className="relative">
                                    <div className="flex justify-between text-sm font-medium mb-1 z-10 relative">
                                        <span>{stage.stage}</span>
                                        <div className="flex gap-3">
                                            <span>{stage.value.toLocaleString()}</span>
                                            <span className={`text-xs ${stage.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {stage.change > 0 ? '+' : ''}{stage.change}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-8 bg-surface-hover rounded-md overflow-hidden relative">
                                        <div
                                            className="h-full bg-primary opacity-20 absolute top-0 left-0"
                                            style={{ width: `${widthPercent}%` }}
                                        ></div>
                                        <div
                                            className="h-full bg-primary opacity-60 absolute top-0 left-0 rounded-r-md transition-all duration-500 ease-out"
                                            style={{ width: `${widthPercent * 0.8}%` }} // Main bar slightly shorter for visual effect
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Strategy Overview & Budget */}
                <div className="space-y-6">
                    <div className="bg-card rounded-xl border border-surface p-6">
                        <h3 className="h4 mb-4">Total Budget</h3>
                        <div className="flex items-end gap-2 mb-2">
                            <span className="text-3xl font-bold">${totalSpent.toLocaleString()}</span>
                            <span className="text-muted mb-1"> / ${totalBudget.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-3 bg-surface-hover rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-muted mt-2 text-right">{budgetUtilization.toFixed(1)}% Utilized</p>
                    </div>

                    <div className="bg-card rounded-xl border border-surface p-6">
                        <h3 className="h4 mb-6">Budget Allocation</h3>
                        <div className="h-48">
                            {budgetData.length > 0 ? (
                                <BarChart data={budgetData} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted">
                                    No active strategy campaigns.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Strategy Calendar (Simplified List for now) */}
            <div className="bg-card rounded-xl border border-surface p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="h4">Marketing Calendar</h3>
                    <button className="text-sm text-primary hover:underline">View Full Calendar</button>
                </div>
                <div className="space-y-3">
                    {campaigns.length === 0 && (
                        <p className="text-muted text-center py-4">No scheduled campaigns.</p>
                    )}
                    {campaigns.map(c => (
                        <div key={c.id} className="flex items-center gap-4 p-3 border-b border-surface last:border-0 hover:bg-surface-hover rounded transition-colors">
                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-surface-hover rounded-lg text-xs font-bold shrink-0">
                                <span className="text-primary">{new Date(c.startDate || new Date()).getDate()}</span>
                                <span className="text-muted uppercase">{new Date(c.startDate || new Date()).toLocaleString('default', { month: 'short' })}</span>
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-sm">{c.name}</h4>
                                <p className="text-xs text-muted line-clamp-1">{c.description}</p>
                            </div>
                            <div className="flex gap-2">
                                {c.channels.map(ch => (
                                    <span key={ch} className="text-[10px] px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                                        {ch}
                                    </span>
                                ))}
                            </div>
                            <div className={`text-xs px-2 py-1 rounded-full ${c.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                {c.status}
                            </div>
                            {c.originIdeaId && (
                                <Link to={`/project/${projectId}/flows/${c.originIdeaId}`} className="text-purple-400 hover:text-purple-600 ml-1" title="View Source Flow">
                                    <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                                </Link>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
