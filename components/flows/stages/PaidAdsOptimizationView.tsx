import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';
import { Link, useParams } from 'react-router-dom';

interface PaidAdsOptimizationViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const PaidAdsOptimizationView: React.FC<PaidAdsOptimizationViewProps> = ({ idea, onUpdate }) => {
    const { id: projectId } = useParams<{ id: string }>();
    const { adData, updateAdData } = usePaidAdsData(idea, onUpdate);
    const optimization = adData.optimization || {};
    const [hypothesisInput, setHypothesisInput] = useState('');

    const addHypothesis = () => {
        if (!hypothesisInput.trim()) return;
        const current = optimization.hypotheses || [];
        updateAdData({ optimization: { hypotheses: [...current, hypothesisInput.trim()] } });
        setHypothesisInput('');
    };

    const removeHypothesis = (index: number) => {
        const current = optimization.hypotheses || [];
        updateAdData({ optimization: { hypotheses: current.filter((_, i) => i !== index) } });
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">
                <div className="bg-gradient-to-br from-teal-100 via-emerald-50 to-white dark:from-teal-900/30 dark:via-emerald-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-teal-200 dark:border-teal-800/50 relative overflow-hidden shadow-xl shadow-teal-100 dark:shadow-none flex items-center justify-between">
                    <div className="relative z-10 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="px-3 py-1 bg-teal-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-teal-200 dark:shadow-none">
                                OPTIMIZATION
                            </div>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                            Scale & Iterate
                        </h1>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-teal-100/50 to-transparent dark:from-teal-900/20" />
                    <span className="material-symbols-outlined absolute right-10 -bottom-10 text-[180px] text-teal-500/10 rotate-12">auto_graph</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 space-y-6">
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Experiment Backlog</h3>
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={hypothesisInput}
                                    onChange={(e) => setHypothesisInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addHypothesis()}
                                    placeholder="Test hypothesis or variation..."
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                                />
                                <button
                                    onClick={addHypothesis}
                                    className="px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs uppercase tracking-widest"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                                {(optimization.hypotheses || []).map((item, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 group">
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{item}</span>
                                        <button onClick={() => removeHypothesis(index)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>
                                    </div>
                                ))}
                                {(optimization.hypotheses || []).length === 0 && (
                                    <div className="text-sm text-slate-400 italic">No tests planned yet.</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Learnings & Iteration Notes</h3>
                            <textarea
                                value={optimization.learnings || ''}
                                onChange={(e) => updateAdData({ optimization: { learnings: e.target.value } })}
                                placeholder="Document insights, performance drivers, and next steps..."
                                className="w-full min-h-[160px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 resize-none"
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                                <span className="material-symbols-outlined text-[150px] text-white -mr-10 -mt-10">trending_up</span>
                            </div>
                            <div className="relative z-10 space-y-6">
                                <h3 className="font-black text-white uppercase text-[11px] tracking-[.25em]">Scaling Plan</h3>
                                <textarea
                                    value={optimization.scalingPlan || ''}
                                    onChange={(e) => updateAdData({ optimization: { scalingPlan: e.target.value } })}
                                    placeholder="Budget ramps, geo expansion, new creatives..."
                                    className="w-full min-h-[140px] bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-xs font-medium text-white placeholder-white/30 focus:outline-none focus:border-teal-500 resize-none"
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm space-y-5">
                            <div>
                                <label className="text-[9px] font-black text-teal-600 uppercase tracking-[.25em] mb-2 block opacity-80">Reporting Cadence</label>
                                <select
                                    value={optimization.reportingCadence || 'Weekly'}
                                    onChange={(e) => updateAdData({ optimization: { reportingCadence: e.target.value } })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 appearance-none"
                                >
                                    {['Weekly', 'Bi-weekly', 'Monthly'].map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-teal-600 uppercase tracking-[.25em] mb-2 block opacity-80">Guardrails</label>
                                <input
                                    value={optimization.guardrails || ''}
                                    onChange={(e) => updateAdData({ optimization: { guardrails: e.target.value } })}
                                    placeholder="Max CPA, ROAS floor, frequency cap..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                                />
                            </div>
                        </div>

                        {idea.convertedCampaignId && projectId && (
                            <Link
                                to={`/project/${projectId}/marketing/ads/${idea.convertedCampaignId}`}
                                className="w-full inline-flex items-center justify-between h-14 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-teal-500/20 px-6"
                            >
                                <span>Open Campaign Dashboard</span>
                                <span className="material-symbols-outlined">analytics</span>
                            </Link>
                        )}

                        <Button
                            className="w-full h-12 rounded-2xl bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-800"
                            onClick={() => onUpdate({ stage: 'Live' })}
                        >
                            Back to Launch
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
