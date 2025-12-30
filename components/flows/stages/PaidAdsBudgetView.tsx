import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { generateBudgetRecommendation } from '../../../services/geminiService';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';

interface PaidAdsBudgetViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const BID_STRATEGIES = [
    { id: 'Lowest Cost', label: 'Lowest Cost', description: 'Get most results for budget', icon: 'savings' },
    { id: 'Cost Cap', label: 'Cost Cap', description: 'Control cost per result', icon: 'price_check' },
    { id: 'Bid Cap', label: 'Bid Cap', description: 'Maximum bid per auction', icon: 'gavel' },
    { id: 'Target ROAS', label: 'Target ROAS', description: 'Optimize for return on ad spend', icon: 'trending_up' },
];

export const PaidAdsBudgetView: React.FC<PaidAdsBudgetViewProps> = ({ idea, onUpdate }) => {
    const { adData, updateBudget } = usePaidAdsData(idea, onUpdate);
    const [isAnalysing, setIsAnalysing] = useState(false);
    const [aiRecommendation, setAiRecommendation] = useState<{ recommendedBudget: number; rationale: string } | null>(null);

    const budget = adData.budget || {
        amount: 0,
        type: 'Daily',
        currency: 'USD',
        bidStrategy: 'Lowest Cost'
    };

    const handleGetRecommendation = async () => {
        setIsAnalysing(true);
        try {
            const objective = (adData.objective || 'General').toString();
            // Assuming 'Broad' as audience type for now or we could derive it from targeting
            const result = await generateBudgetRecommendation(objective, 'Broad');
            setAiRecommendation(result);
            if (result.recommendedBudget) {
                updateBudget({ amount: result.recommendedBudget });
            }
        } finally {
            setIsAnalysing(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">
                {/* Header */}
                <div className="bg-gradient-to-br from-emerald-100 via-teal-50 to-white dark:from-emerald-900/30 dark:via-teal-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-emerald-200 dark:border-emerald-800/50 relative overflow-hidden shadow-xl shadow-emerald-100 dark:shadow-none flex items-center justify-between">
                    <div className="relative z-10 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="px-3 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-emerald-200 dark:shadow-none">
                                BUDGET & SCHEDULE
                            </div>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                            Investment Planning
                        </h1>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-emerald-100/50 to-transparent dark:from-emerald-900/20" />
                    <span className="material-symbols-outlined absolute right-10 -bottom-10 text-[180px] text-emerald-500/10 rotate-12">payments</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Budget Config (7/12) */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Budget Allocation</h3>

                            <div className="space-y-8">
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1">
                                        <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-2 block opacity-80">Budget Type</label>
                                        <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                            {['Daily', 'Lifetime'].map((type) => (
                                                <button
                                                    key={type}
                                                    onClick={() => updateBudget({ type: type as 'Daily' | 'Lifetime' })}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${budget.type === type
                                                        ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                                        }`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] block opacity-80">Amount</label>
                                            {aiRecommendation && (
                                                <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">
                                                    CORA Recommended
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                                            <input
                                                type="text"
                                                value={budget.amount || ''}
                                                onChange={(e) => updateBudget({ amount: Number(e.target.value) })}
                                                placeholder="100.00"
                                                className="w-full text-lg font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-2 block opacity-80">Bid Strategy</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {BID_STRATEGIES.map((strategy) => (
                                            <button
                                                key={strategy.id}
                                                onClick={() => updateBudget({ bidStrategy: strategy.id })}
                                                className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left relative overflow-hidden ${budget.bidStrategy === strategy.id
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700 hover:border-emerald-300'
                                                    }`}
                                            >
                                                <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${budget.bidStrategy === strategy.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                    <span className="material-symbols-outlined text-[20px]">{strategy.icon}</span>
                                                </div>
                                                <div>
                                                    <span className={`text-xs font-black uppercase tracking-wider block mb-1 ${budget.bidStrategy === strategy.id ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
                                                        {strategy.label}
                                                    </span>
                                                    <span className="text-[10px] font-medium text-slate-400 block leading-tight">
                                                        {strategy.description}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Flight Dates</h3>
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex items-center">
                                    <span className="material-symbols-outlined text-slate-400 text-sm mx-2">schedule</span>
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 pr-2">
                                        {budget.startDate && budget.endDate
                                            ? `${Math.ceil((new Date(budget.endDate).getTime() - new Date(budget.startDate).getTime()) / (1000 * 60 * 60 * 24))} Days`
                                            : 'Duration TBD'
                                        }
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[.25em] mb-2 block">Start Date</label>
                                    <input
                                        type="date"
                                        value={budget.startDate || ''}
                                        onChange={(e) => updateBudget({ startDate: e.target.value })}
                                        className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-1 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[.25em] mb-2 block">End Date</label>
                                    <input
                                        type="date"
                                        value={budget.endDate || ''}
                                        onChange={(e) => updateBudget({ endDate: e.target.value })}
                                        className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-1 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[.25em] mb-2 block">Pacing</label>
                                <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 w-full md:w-fit">
                                    {['Standard', 'Accelerated'].map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => updateBudget({ pacing: p })}
                                            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${budget.pacing === p
                                                ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Summary Card (5/12) */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden h-full flex flex-col">
                            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                                <span className="material-symbols-outlined text-[150px] text-white -mr-10 -mt-10">receipt_long</span>
                            </div>

                            <div className="relative z-10 flex-1 flex flex-col">
                                <h3 className="font-black text-white uppercase text-[11px] tracking-[.25em] mb-8">Estimated Spend</h3>

                                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-2xl mb-8 backdrop-blur-md">
                                    <span className="text-4xl md:text-5xl font-black text-emerald-400 mb-2">
                                        ${budget.amount || '0'}
                                    </span>
                                    <span className="text-xs font-bold text-white/60 uppercase tracking-widest">
                                        {budget.type} Budget
                                    </span>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="flex justify-between items-center py-3 border-b border-white/10">
                                        <span className="text-xs font-bold text-white/60">Bid Strategy</span>
                                        <span className="text-xs font-bold text-white">{budget.bidStrategy || '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-white/10">
                                        <span className="text-xs font-bold text-white/60">Pacing</span>
                                        <span className="text-xs font-bold text-white">{budget.pacing || '-'}</span>
                                    </div>
                                </div>

                                <div className="mt-auto">
                                    <Button
                                        className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-between px-6 group/btn border-none"
                                        onClick={() => onUpdate({ stage: 'Build' })}
                                    >
                                        <span>Next: Build</span>
                                        <div className="flex items-center gap-2 group-hover/btn:translate-x-1 transition-transform">
                                            <span className="material-symbols-outlined">checklist</span>
                                            <span className="material-symbols-outlined">arrow_forward</span>
                                        </div>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 backdrop-blur-md">
                            <div className="flex items-start gap-4">
                                <div className="size-10 rounded-xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-emerald-500 shrink-0">
                                    <span className="material-symbols-outlined">auto_awesome</span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">CORA Insight</h4>
                                        <button
                                            onClick={handleGetRecommendation}
                                            disabled={isAnalysing}
                                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
                                        >
                                            {isAnalysing ? 'Analysing...' : 'Refresh'}
                                        </button>
                                    </div>
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {aiRecommendation ? (
                                            aiRecommendation.rationale
                                        ) : (
                                            "Click refresh to get a personalized budget recommendation based on your objective."
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
