import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { useLanguage } from '../../../context/LanguageContext';

interface MoonshotPrototypeViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface PrototypeData {
    specs: string;
    experiments: {
        id: string;
        title: string;
        result: 'Success' | 'Failure' | 'Inconclusive' | 'Pending';
        notes: string;
    }[];
    mediaLinks: string[]; // Simple string array for now
}

export const MoonshotPrototypeView: React.FC<MoonshotPrototypeViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const data: PrototypeData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    specs: parsed.specs || '',
                    experiments: Array.isArray(parsed.experiments) ? parsed.experiments : [],
                    mediaLinks: Array.isArray(parsed.mediaLinks) ? parsed.mediaLinks : [],
                    ...parsed
                };
            }
        } catch { }
        return {
            specs: '',
            experiments: [],
            mediaLinks: []
        };
    })();

    const updateData = (updates: Partial<PrototypeData>) => {
        const newData = { ...data, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const addExperiment = () => {
        const newExp = {
            id: crypto.randomUUID(),
            title: '',
            result: 'Pending' as const,
            notes: ''
        };
        updateData({ experiments: [...data.experiments, newExp] });
    };

    const updateExperiment = (index: number, updates: Partial<PrototypeData['experiments'][0]>) => {
        const newExps = [...data.experiments];
        newExps[index] = { ...newExps[index], ...updates };
        updateData({ experiments: newExps });
    };

    const removeExperiment = (index: number) => {
        const newExps = [...data.experiments];
        newExps.splice(index, 1);
        updateData({ experiments: newExps });
    }

    const getResultColor = (result: string) => {
        switch (result) {
            case 'Success': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
            case 'Failure': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
            case 'Inconclusive': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        }
    };
    const resultLabels: Record<PrototypeData['experiments'][0]['result'], string> = {
        Pending: t('flowStages.moonshotPrototype.results.pending'),
        Success: t('flowStages.moonshotPrototype.results.success'),
        Failure: t('flowStages.moonshotPrototype.results.failure'),
        Inconclusive: t('flowStages.moonshotPrototype.results.inconclusive'),
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left Column: Prototype Specs */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 relative">
                <div className="mb-4">
                    <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">{t('flowStages.moonshotPrototype.title')}</h2>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('flowStages.moonshotPrototype.subtitle')}</p>
                </div>

                <div className="flex-1 flex flex-col bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)] overflow-hidden focus-within:ring-1 focus-within:ring-fuchsia-500 transition-all">
                    <div className="bg-[var(--color-surface-paper)] px-4 py-2 border-b border-[var(--color-surface-border)] flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase">{t('flowStages.moonshotPrototype.specs.label')}</span>
                        <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">terminal</span>
                    </div>
                    <textarea
                        value={data.specs}
                        onChange={(e) => updateData({ specs: e.target.value })}
                        className="flex-1 w-full bg-transparent border-none p-4 focus:ring-0 resize-none font-mono text-sm leading-relaxed"
                        placeholder={t('flowStages.moonshotPrototype.specs.placeholder')}
                    />
                </div>

                <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)]">
                    <Button
                        className="w-full h-12 text-base justify-between group bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:bg-[var(--color-text-main)]/90 shadow-lg hover:shadow-xl transition-all rounded-xl"
                        onClick={() => onUpdate({ stage: 'Greenlight' })}
                    >
                        <span className="font-bold pl-1">{t('flowStages.moonshotPrototype.actions.advance')}</span>
                        <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </div>
                    </Button>
                </div>
            </div>

            {/* Middle & Right Column: Lab Journal */}
            <div className="col-span-1 lg:col-span-2 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-[var(--color-text-main)]">{t('flowStages.moonshotPrototype.journal.title')}</h3>
                        <p className="text-xs text-[var(--color-text-muted)]">{t('flowStages.moonshotPrototype.journal.subtitle')}</p>
                    </div>
                    <Button size="sm" onClick={addExperiment} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-none gap-2">
                        <span className="material-symbols-outlined text-[18px]">science</span>
                        {t('flowStages.moonshotPrototype.journal.add')}
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 p-1">
                    {data.experiments.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-[var(--color-surface-border)] rounded-xl text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">biotech</span>
                            <p className="text-sm">{t('flowStages.moonshotPrototype.journal.empty')}</p>
                        </div>
                    ) : (
                        data.experiments.map((exp, index) => (
                            <div key={exp.id} className="p-4 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)] hover:border-fuchsia-300 dark:hover:border-fuchsia-700 transition-all">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-3">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={exp.title}
                                            onChange={(e) => updateExperiment(index, { title: e.target.value })}
                                            placeholder={t('flowStages.moonshotPrototype.journal.titlePlaceholder')}
                                            className="font-bold text-sm bg-transparent border-none p-0 focus:ring-0 text-[var(--color-text-main)] w-full placeholder-[var(--color-text-subtle)]"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={exp.result}
                                            onChange={(e) => updateExperiment(index, { result: e.target.value as any })}
                                            className={`text-xs font-bold px-2 py-1 rounded-lg border-none focus:ring-0 cursor-pointer ${getResultColor(exp.result)}`}
                                        >
                                            {Object.entries(resultLabels).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => removeExperiment(index)}
                                            className="size-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    value={exp.notes}
                                    onChange={(e) => updateExperiment(index, { notes: e.target.value })}
                                    placeholder={t('flowStages.moonshotPrototype.journal.notesPlaceholder')}
                                    rows={2}
                                    className="w-full text-sm bg-transparent border-none p-0 focus:ring-0 text-[var(--color-text-muted)] resize-none"
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
