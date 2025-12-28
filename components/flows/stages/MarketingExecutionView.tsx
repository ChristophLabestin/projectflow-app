import React, { useState } from 'react';
import { Idea } from '../../../types';

import { Button } from '../../ui/Button';
import { DatePicker } from '../../ui/DatePicker';
import { useNavigate } from 'react-router-dom';

interface MarketingExecutionViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface ExecutionData {
    startDate: string;
    endDate: string;
    actualBudget: string;
    trackingLinks: string[];
    status: 'Pending' | 'Active' | 'Paused' | 'Completed';
}

export const MarketingExecutionView: React.FC<MarketingExecutionViewProps> = ({ idea, onUpdate }) => {
    const execution: ExecutionData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    startDate: parsed.startDate || '',
                    endDate: parsed.endDate || '',
                    actualBudget: parsed.actualBudget || '',
                    trackingLinks: Array.isArray(parsed.trackingLinks) ? parsed.trackingLinks : [],
                    status: parsed.marketingStatus || 'Pending',
                    ...parsed
                };
            }
        } catch { }
        return {
            startDate: '',
            endDate: '',
            actualBudget: '',
            trackingLinks: [],
            status: 'Pending'
        };
    })();

    const updateExecution = (updates: Partial<ExecutionData>) => {
        const newData = { ...execution, ...updates };
        if (updates.status !== undefined) {
            // @ts-ignore
            newData.marketingStatus = updates.status;
        }
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const addLink = () => updateExecution({ trackingLinks: [...execution.trackingLinks, ''] });

    const updateLink = (idx: number, val: string) => {
        const newLinks = [...execution.trackingLinks];
        newLinks[idx] = val;
        updateExecution({ trackingLinks: newLinks });
    };

    const navigate = useNavigate();

    // If converted, show specialized view
    if (idea.convertedCampaignId) {
        return (
            <div className="grid grid-cols-1 gap-6 h-full">
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-8 flex flex-col items-center justify-center text-center">
                    <div className="size-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-4xl text-green-600 dark:text-green-400">rocket_launch</span>
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">Campaign is Live!</h2>
                    <p className="text-[var(--color-text-muted)] max-w-md mb-8">
                        This flow is now being executed as a <strong>{idea.campaignType === 'email' ? 'Email Campaign' : 'Ad Campaign'}</strong> in the Marketing module.
                    </p>

                    <div className="flex gap-4">
                        <Button
                            className="bg-[var(--color-surface-bg)] text-[var(--color-text-main)] border border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]"
                            onClick={() => onUpdate({ convertedCampaignId: undefined })} // Allow disconnect for debugging/rollback
                        >
                            Disconnect
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20 px-8"
                            onClick={() => navigate(`/projects/${idea.projectId}/marketing/${idea.campaignType === 'email' ? 'email' : 'ads'}/${idea.convertedCampaignId}`)}
                        >
                            Go to Campaign Dashboard
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="col-span-1 lg:col-span-2 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">Execution Setup</h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">Launch and monitor</p>
                    </div>

                    <div className="flex bg-[var(--color-surface-bg)] rounded-lg p-1 border border-[var(--color-surface-border)]">
                        {['Pending', 'Active', 'Paused', 'Completed'].map(s => (
                            <button
                                key={s}
                                onClick={() => updateExecution({ status: s as any })}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${execution.status === s
                                    ? 'bg-white shadow text-cyan-600'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">Start Date</label>
                        <DatePicker
                            value={execution.startDate}
                            onChange={(date) => updateExecution({ startDate: date })}
                            className="w-full"
                            placeholder="Select start date"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">End Date</label>
                        <DatePicker
                            value={execution.endDate}
                            onChange={(date) => updateExecution({ endDate: date })}
                            className="w-full"
                            placeholder="Select end date"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Tracking Links (UTMs)</label>
                        <button onClick={addLink} className="text-xs text-cyan-600 font-medium hover:text-cyan-700">
                            + Add Link
                        </button>
                    </div>
                    {execution.trackingLinks.map((link, idx) => (
                        <div key={idx} className="flex gap-2">
                            <input
                                type="text"
                                value={link}
                                onChange={(e) => updateLink(idx, e.target.value)}
                                className="flex-1 text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                                placeholder="https://example.com?utm_source=email..."
                            />
                        </div>
                    ))}
                    {execution.trackingLinks.length === 0 && <p className="text-xs text-[var(--color-text-muted)] italic">Add tracking links to monitor performance.</p>}
                </div>

                <div className="mt-auto pt-6 border-t border-[var(--color-surface-border)] flex justify-end">
                    <Button
                        disabled={execution.status !== 'Completed'}
                        className={`h-10 text-sm gap-2 rounded-lg ${execution.status === 'Completed' ? 'bg-cyan-600 text-white' : 'bg-[var(--color-surface-disabled)] text-[var(--color-text-disabled)]'}`}
                        onClick={() => onUpdate({ stage: 'Analysis' })}
                    >
                        <span>Analyze Results</span>
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                    </Button>
                </div>
            </div>

            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <h3 className="font-bold text-[var(--color-text-main)] mb-4">Budget Control</h3>
                <div>
                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Approved Budget</label>
                    <div className="text-2xl font-mono font-bold text-[var(--color-text-main)] mb-4">$5,000.00</div>

                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Actual Spend</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
                        <input
                            type="text"
                            value={execution.actualBudget}
                            onChange={(e) => updateExecution({ actualBudget: e.target.value })}
                            placeholder="0.00"
                            className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg pl-8 pr-3 py-2.5 focus:ring-1 focus:ring-cyan-500 outline-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
