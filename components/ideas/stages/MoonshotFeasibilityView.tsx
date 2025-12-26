import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';

interface MoonshotFeasibilityViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface FeasibilityData {
    hypothesis: string;
    risks: {
        technical: string;
        market: string;
        regulatory: string;
    };
    expertReviews: {
        expertName: string;
        feedback: string;
        date: string;
    }[];
}

export const MoonshotFeasibilityView: React.FC<MoonshotFeasibilityViewProps> = ({ idea, onUpdate }) => {
    const data: FeasibilityData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    hypothesis: parsed.hypothesis || '',
                    risks: parsed.risks || { technical: '', market: '', regulatory: '' },
                    expertReviews: Array.isArray(parsed.expertReviews) ? parsed.expertReviews : [],
                    ...parsed
                };
            }
        } catch { }
        return {
            hypothesis: '',
            risks: { technical: '', market: '', regulatory: '' },
            expertReviews: []
        };
    })();

    const updateData = (updates: Partial<FeasibilityData>) => {
        const newData = { ...data, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const updateRisk = (type: keyof typeof data.risks, value: string) => {
        updateData({
            risks: {
                ...data.risks,
                [type]: value
            }
        });
    };

    const addExpertReview = () => {
        const newReview = { expertName: '', feedback: '', date: new Date().toISOString() };
        updateData({ expertReviews: [...data.expertReviews, newReview] });
    };

    const updateReview = (index: number, field: string, value: string) => {
        const newReviews = [...data.expertReviews];
        newReviews[index] = { ...newReviews[index], [field]: value };
        updateData({ expertReviews: newReviews });
    };

    const removeReview = (index: number) => {
        const newReviews = [...data.expertReviews];
        newReviews.splice(index, 1);
        updateData({ expertReviews: newReviews });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left Column: Core Hypothesis */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-50 pointer-events-none">
                    <span className="material-symbols-outlined text-[100px] text-[var(--color-surface-border)] rotate-12 -mr-6 -mt-6">science</span>
                </div>
                <div className="flex flex-col h-full relative z-10">
                    <div className="mb-6">
                        <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">Feasibility Study</h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">Define the core hypothesis</p>
                        <div className="h-1 w-10 bg-indigo-500 rounded-full mt-3" />
                    </div>

                    <div className="flex-1 flex flex-col">
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">Core Hypothesis</label>
                        <textarea
                            value={data.hypothesis}
                            onChange={(e) => updateData({ hypothesis: e.target.value })}
                            className="flex-1 w-full bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-4 py-3 focus:ring-1 focus:ring-indigo-500 outline-none text-sm resize-none leading-relaxed"
                            placeholder="If we build [X], then [Y] will happen because [Z]..."
                        />
                    </div>
                </div>
            </div>

            {/* Middle Column: Risk Matrix */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <div className="mb-4">
                    <h3 className="font-bold text-[var(--color-text-main)]">Risk Assessment</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Identify potential blockers</p>
                </div>

                <div className="space-y-4 overflow-y-auto pr-1">
                    <div>
                        <label className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">memory</span> Technical Risks
                        </label>
                        <textarea
                            value={data.risks.technical}
                            onChange={(e) => updateRisk('technical', e.target.value)}
                            rows={3}
                            className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 focus:ring-1 focus:ring-rose-500 outline-none resize-none"
                            placeholder="Is it physically/digitally possible?"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">storefront</span> Market Risks
                        </label>
                        <textarea
                            value={data.risks.market}
                            onChange={(e) => updateRisk('market', e.target.value)}
                            rows={3}
                            className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                            placeholder="Does anyone want this?"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">gavel</span> Regulatory / Legal
                        </label>
                        <textarea
                            value={data.risks.regulatory}
                            onChange={(e) => updateRisk('regulatory', e.target.value)}
                            rows={3}
                            className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 focus:ring-1 focus:ring-slate-500 outline-none resize-none"
                            placeholder="Are there legal barriers?"
                        />
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)]">
                    <Button
                        className="w-full h-12 text-base justify-between group bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:bg-[var(--color-text-main)]/90 shadow-lg hover:shadow-xl transition-all rounded-xl"
                        onClick={() => onUpdate({ stage: 'Prototype' })}
                    >
                        <span className="font-bold pl-1">Move to Prototype</span>
                        <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </div>
                    </Button>
                </div>
            </div>

            {/* Right Column: Expert Reviews */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-[var(--color-text-main)]">Expert Validation</h3>
                        <p className="text-xs text-[var(--color-text-muted)]">Consultations & Feedback</p>
                    </div>
                    <button
                        onClick={addExpertReview}
                        className="size-8 rounded-lg bg-[var(--color-surface-hover)] hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 p-1">
                    {data.expertReviews.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-[var(--color-surface-border)] rounded-xl text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">person_check</span>
                            <p className="text-sm">No reviews logged</p>
                        </div>
                    ) : (
                        data.expertReviews.map((review, index) => (
                            <div key={index} className="p-3 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)] hover:border-indigo-200 transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                    <input
                                        type="text"
                                        value={review.expertName}
                                        onChange={(e) => updateReview(index, 'expertName', e.target.value)}
                                        placeholder="Expert Name / Role"
                                        className="font-bold text-sm bg-transparent border-none p-0 focus:ring-0 text-[var(--color-text-main)] w-full mr-2"
                                    />
                                    <button
                                        onClick={() => removeReview(index)}
                                        className="text-[var(--color-text-muted)] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                </div>
                                <textarea
                                    value={review.feedback}
                                    onChange={(e) => updateReview(index, 'feedback', e.target.value)}
                                    placeholder="Key insights..."
                                    rows={2}
                                    className="w-full text-xs bg-transparent border-none p-0 focus:ring-0 text-[var(--color-text-muted)] resize-none"
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
