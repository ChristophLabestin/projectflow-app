import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { useLanguage } from '../../../context/LanguageContext';

interface MoonshotGreenlightViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface GreenlightData {
    resourceReqs: {
        budget: string;
        personnel: string;
        timeline: string;
    };
    decision: 'GO' | 'NO-GO' | 'PIVOT' | 'PENDING';
    decisionNotes: string;
}

export const MoonshotGreenlightView: React.FC<MoonshotGreenlightViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const data: GreenlightData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    resourceReqs: parsed.resourceReqs || { budget: '', personnel: '', timeline: '' },
                    decision: parsed.decision || 'PENDING',
                    decisionNotes: parsed.decisionNotes || '',
                    ...parsed
                };
            }
        } catch { }
        return {
            resourceReqs: { budget: '', personnel: '', timeline: '' },
            decision: 'PENDING',
            decisionNotes: ''
        };
    })();

    const updateData = (updates: Partial<GreenlightData>) => {
        const newData = { ...data, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const updateResource = (field: keyof typeof data.resourceReqs, value: string) => {
        updateData({
            resourceReqs: {
                ...data.resourceReqs,
                [field]: value
            }
        });
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left Column: Summary & Resources */}
            <div className="col-span-1 lg:col-span-2 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6">
                <div className="mb-6">
                    <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">{t('flowStages.moonshotGreenlight.title')}</h2>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('flowStages.moonshotGreenlight.subtitle')}</p>
                    <div className="h-1 w-10 bg-lime-500 rounded-full mt-3" />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] space-y-2">
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">{t('flowStages.moonshotGreenlight.resources.budget')}</label>
                        <input
                            value={data.resourceReqs.budget}
                            onChange={(e) => updateResource('budget', e.target.value)}
                            placeholder={t('flowStages.moonshotGreenlight.resources.budgetPlaceholder')}
                            className="w-full bg-transparent border-none p-0 text-xl font-bold text-[var(--color-text-main)] placeholder-[var(--color-text-subtle)] focus:ring-0"
                        />
                    </div>
                    <div className="p-4 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] space-y-2">
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">{t('flowStages.moonshotGreenlight.resources.team')}</label>
                        <input
                            value={data.resourceReqs.personnel}
                            onChange={(e) => updateResource('personnel', e.target.value)}
                            placeholder={t('flowStages.moonshotGreenlight.resources.teamPlaceholder')}
                            className="w-full bg-transparent border-none p-0 text-xl font-bold text-[var(--color-text-main)] placeholder-[var(--color-text-subtle)] focus:ring-0"
                        />
                    </div>
                    <div className="col-span-2 p-4 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] space-y-2">
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">{t('flowStages.moonshotGreenlight.resources.timeline')}</label>
                        <input
                            value={data.resourceReqs.timeline}
                            onChange={(e) => updateResource('timeline', e.target.value)}
                            placeholder={t('flowStages.moonshotGreenlight.resources.timelinePlaceholder')}
                            className="w-full bg-transparent border-none p-0 text-xl font-bold text-[var(--color-text-main)] placeholder-[var(--color-text-subtle)] focus:ring-0"
                        />
                    </div>
                </div>

                <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-2">{t('flowStages.moonshotGreenlight.notes.label')}</label>
                    <textarea
                        value={data.decisionNotes}
                        onChange={(e) => updateData({ decisionNotes: e.target.value })}
                        className="flex-1 w-full bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl p-4 focus:ring-1 focus:ring-lime-500 outline-none resize-none leading-relaxed"
                        placeholder={t('flowStages.moonshotGreenlight.notes.placeholder')}
                    />
                </div>
            </div>

            {/* Right Column: The Big Button */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 items-center justify-center text-center relative overflow-hidden">
                {/* Background Glow based on decision */}
                <div className={`absolute inset-0 opacity-10 pointer-events-none transition-colors duration-500 ${data.decision === 'GO' ? 'bg-lime-500' :
                        data.decision === 'NO-GO' ? 'bg-rose-500' :
                            data.decision === 'PIVOT' ? 'bg-amber-500' : 'bg-transparent'
                    }`} />

                <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-8">{t('flowStages.moonshotGreenlight.verdict.title')}</h3>

                <div className="flex flex-col gap-4 w-full max-w-xs relative z-10">
                    <button
                        onClick={() => updateData({ decision: 'GO' })}
                        className={`p-6 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between group ${data.decision === 'GO'
                                ? 'bg-lime-500 border-lime-500 text-white shadow-lg scale-105'
                                : 'bg-white dark:bg-slate-800 border-lime-200 dark:border-lime-900/50 text-lime-600 dark:text-lime-400 hover:border-lime-400 hover:bg-lime-50 dark:hover:bg-lime-900/10'
                            }`}
                    >
                        <div className="text-left">
                            <span className="block text-2xl font-black tracking-tight">{t('flowStages.moonshotGreenlight.decision.go.label')}</span>
                            <span className="text-xs opacity-90">{t('flowStages.moonshotGreenlight.decision.go.subtitle')}</span>
                        </div>
                        <span className="material-symbols-outlined text-4xl">check_circle</span>
                    </button>

                    <button
                        onClick={() => updateData({ decision: 'PIVOT' })}
                        className={`p-4 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between group ${data.decision === 'PIVOT'
                                ? 'bg-amber-500 border-amber-500 text-white shadow-lg scale-105'
                                : 'bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10'
                            }`}
                    >
                        <div className="text-left">
                            <span className="block text-xl font-black tracking-tight">{t('flowStages.moonshotGreenlight.decision.pivot.label')}</span>
                            <span className="text-xs opacity-90">{t('flowStages.moonshotGreenlight.decision.pivot.subtitle')}</span>
                        </div>
                        <span className="material-symbols-outlined text-3xl">shuffle</span>
                    </button>

                    <button
                        onClick={() => updateData({ decision: 'NO-GO' })}
                        className={`p-4 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between group ${data.decision === 'NO-GO'
                                ? 'bg-rose-500 border-rose-500 text-white shadow-lg scale-105'
                                : 'bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10'
                            }`}
                    >
                        <div className="text-left">
                            <span className="block text-xl font-black tracking-tight">{t('flowStages.moonshotGreenlight.decision.noGo.label')}</span>
                            <span className="text-xs opacity-90">{t('flowStages.moonshotGreenlight.decision.noGo.subtitle')}</span>
                        </div>
                        <span className="material-symbols-outlined text-3xl">cancel</span>
                    </button>
                </div>

                {data.decision === 'GO' && (
                    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
                        <Button
                            className="bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:opacity-90 shadow-xl"
                            // Handle convert logic here or pass up
                            onClick={() => onUpdate({ stage: 'Approved' })} // Assuming Approved is a subsequent state or mapped
                        >
                            {t('flowStages.moonshotGreenlight.actions.initialize')}
                            <span className="material-symbols-outlined ml-2">rocket_launch</span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
