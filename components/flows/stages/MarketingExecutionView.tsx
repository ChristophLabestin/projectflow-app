import React, { useState } from 'react';
import { Idea } from '../../../types';

import { Button } from '../../ui/Button';
import { DatePicker } from '../../ui/DatePicker';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';

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
    const { t } = useLanguage();
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
    const statusLabels: Record<ExecutionData['status'], string> = {
        Pending: t('flowStages.marketingExecution.status.pending'),
        Active: t('flowStages.marketingExecution.status.active'),
        Paused: t('flowStages.marketingExecution.status.paused'),
        Completed: t('flowStages.marketingExecution.status.completed'),
    };
    const statusOptions: ExecutionData['status'][] = ['Pending', 'Active', 'Paused', 'Completed'];

    // If converted, show specialized view
    if (idea.convertedCampaignId) {
        const campaignTypeLabel = idea.campaignType === 'email'
            ? t('flowStages.marketingExecution.campaignType.email')
            : t('flowStages.marketingExecution.campaignType.ad');
        return (
            <div className="grid grid-cols-1 gap-6 h-full">
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-surface shadow-sm p-8 flex flex-col items-center justify-center text-center">
                    <div className="size-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-4xl text-green-600 dark:text-green-400">rocket_launch</span>
                    </div>
                    <h2 className="text-2xl font-bold text-main mb-2">{t('flowStages.marketingExecution.live.title')}</h2>
                    <p className="text-muted max-w-md mb-8">
                        {t('flowStages.marketingExecution.live.description').replace('{type}', campaignTypeLabel)}
                    </p>

                    <div className="flex gap-4">
                        <Button
                            className="bg-surface text-main border border-surface hover:bg-surface-hover"
                            onClick={() => onUpdate({ convertedCampaignId: undefined })} // Allow disconnect for debugging/rollback
                        >
                            {t('flowStages.marketingExecution.live.actions.disconnect')}
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20 px-8"
                            onClick={() => navigate(`/projects/${idea.projectId}/marketing/${idea.campaignType === 'email' ? 'email' : 'ads'}/${idea.convertedCampaignId}`)}
                        >
                            {t('flowStages.marketingExecution.live.actions.viewDashboard')}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="col-span-1 lg:col-span-2 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-surface shadow-sm p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-extrabold text-main tracking-tight">{t('flowStages.marketingExecution.title')}</h2>
                        <p className="text-xs text-muted mt-1">{t('flowStages.marketingExecution.subtitle')}</p>
                    </div>

                    <div className="flex bg-surface rounded-lg p-1 border border-surface">
                        {statusOptions.map((status) => (
                            <button
                                key={status}
                                onClick={() => updateExecution({ status })}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${execution.status === status
                                    ? 'bg-white shadow text-cyan-600'
                                    : 'text-muted hover:text-main'}`}
                            >
                                {statusLabels[status]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">{t('flowStages.marketingExecution.startDate')}</label>
                        <DatePicker
                            value={execution.startDate}
                            onChange={(date) => updateExecution({ startDate: date })}
                            className="w-full"
                            placeholder={t('flowStages.marketingExecution.startDatePlaceholder')}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">{t('flowStages.marketingExecution.endDate')}</label>
                        <DatePicker
                            value={execution.endDate}
                            onChange={(date) => updateExecution({ endDate: date })}
                            className="w-full"
                            placeholder={t('flowStages.marketingExecution.endDatePlaceholder')}
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-muted uppercase tracking-wider">{t('flowStages.marketingExecution.tracking.label')}</label>
                        <button onClick={addLink} className="text-xs text-cyan-600 font-medium hover:text-cyan-700">
                            {t('flowStages.marketingExecution.tracking.add')}
                        </button>
                    </div>
                    {execution.trackingLinks.map((link, idx) => (
                        <div key={idx} className="flex gap-2">
                            <input
                                type="text"
                                value={link}
                                onChange={(e) => updateLink(idx, e.target.value)}
                                className="flex-1 text-sm bg-surface border border-surface rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
                                placeholder={t('flowStages.marketingExecution.tracking.placeholder')}
                            />
                        </div>
                    ))}
                    {execution.trackingLinks.length === 0 && <p className="text-xs text-muted italic">{t('flowStages.marketingExecution.tracking.empty')}</p>}
                </div>

                <div className="mt-auto pt-6 border-t border-surface flex justify-end">
                    <Button
                        disabled={execution.status !== 'Completed'}
                        className={`h-10 text-sm gap-2 rounded-lg ${execution.status === 'Completed' ? 'bg-cyan-600 text-white' : 'bg-[var(--color-surface-disabled)] text-[var(--color-text-disabled)]'}`}
                        onClick={() => onUpdate({ stage: 'Analysis' })}
                    >
                        <span>{t('flowStages.marketingExecution.actions.analyze')}</span>
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                    </Button>
                </div>
            </div>

            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-surface shadow-sm p-6 overflow-hidden">
                <h3 className="font-bold text-main mb-4">{t('flowStages.marketingExecution.budget.title')}</h3>
                <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">{t('flowStages.marketingExecution.budget.approved')}</label>
                    <div className="text-2xl font-mono font-bold text-main mb-4">$5,000.00</div>

                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">{t('flowStages.marketingExecution.budget.actual')}</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                        <input
                            type="text"
                            value={execution.actualBudget}
                            onChange={(e) => updateExecution({ actualBudget: e.target.value })}
                            placeholder={t('flowStages.marketingExecution.budget.placeholder')}
                            className="w-full text-sm bg-surface border border-surface rounded-lg pl-8 pr-3 py-2.5 focus:ring-1 focus:ring-cyan-500 outline-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
