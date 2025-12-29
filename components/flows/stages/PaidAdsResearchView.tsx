import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';

interface PaidAdsResearchViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const PaidAdsResearchView: React.FC<PaidAdsResearchViewProps> = ({ idea, onUpdate }) => {
    const { adData, updateAdData } = usePaidAdsData(idea, onUpdate);
    const research = adData.research || {};
    const [angleInput, setAngleInput] = useState('');

    const addAngle = () => {
        if (!angleInput.trim()) return;
        const current = research.angleIdeas || [];
        updateAdData({ research: { angleIdeas: [...current, angleInput.trim()] } });
        setAngleInput('');
    };

    const removeAngle = (index: number) => {
        const current = research.angleIdeas || [];
        updateAdData({ research: { angleIdeas: current.filter((_, i) => i !== index) } });
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">
                <div className="bg-gradient-to-br from-sky-100 via-blue-50 to-white dark:from-sky-900/30 dark:via-blue-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-sky-200 dark:border-sky-800/50 relative overflow-hidden shadow-xl shadow-sky-100 dark:shadow-none flex items-center justify-between">
                    <div className="relative z-10 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="px-3 py-1 bg-sky-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-sky-200 dark:shadow-none">
                                RESEARCH
                            </div>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                            Market & Competitor Intel
                        </h1>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-sky-100/50 to-transparent dark:from-sky-900/20" />
                    <span className="material-symbols-outlined absolute right-10 -bottom-10 text-[180px] text-sky-500/10 rotate-12">travel_explore</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 space-y-6">
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Market Insights</h3>
                            <textarea
                                value={research.marketInsights || ''}
                                onChange={(e) => updateAdData({ research: { marketInsights: e.target.value } })}
                                placeholder="Category trends, demand signals, seasonal spikes..."
                                className="w-full min-h-[140px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 resize-none"
                            />
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Competitor Notes</h3>
                            <textarea
                                value={research.competitorNotes || ''}
                                onChange={(e) => updateAdData({ research: { competitorNotes: e.target.value } })}
                                placeholder="Winning angles, positioning gaps, pricing pressure..."
                                className="w-full min-h-[140px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 resize-none"
                            />
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Customer Objections</h3>
                            <textarea
                                value={research.customerPainPoints || ''}
                                onChange={(e) => updateAdData({ research: { customerPainPoints: e.target.value } })}
                                placeholder="Friction points, hesitations, deal-breakers..."
                                className="w-full min-h-[120px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 resize-none"
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Proof Points</h3>
                            <textarea
                                value={research.proofPoints || ''}
                                onChange={(e) => updateAdData({ research: { proofPoints: e.target.value } })}
                                placeholder="Testimonials, results, benchmarks, case studies..."
                                className="w-full min-h-[140px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 resize-none"
                            />
                        </div>

                        <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                                <span className="material-symbols-outlined text-[150px] text-white -mr-10 -mt-10">bolt</span>
                            </div>
                            <div className="relative z-10 space-y-4">
                                <h3 className="font-black text-white uppercase text-[11px] tracking-[.25em]">Angle Ideas</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={angleInput}
                                        onChange={(e) => setAngleInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addAngle()}
                                        placeholder="Add an angle..."
                                        className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-500"
                                    />
                                    <button
                                        onClick={addAngle}
                                        className="px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold"
                                    >
                                        <span className="material-symbols-outlined text-sm">add</span>
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                                    {(research.angleIdeas || []).map((angle, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 group">
                                            <span className="text-xs text-slate-200 leading-tight">{angle}</span>
                                            <button onClick={() => removeAngle(index)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                className="w-full h-14 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-sky-500/20 flex items-center justify-between px-6 group/btn border-none"
                                onClick={() => onUpdate({ stage: 'Creative' })}
                            >
                                <span>Next Step</span>
                                <div className="flex items-center gap-2 group-hover/btn:translate-x-1 transition-transform">
                                    <span>Creative</span>
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </div>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
