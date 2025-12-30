import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { suggestObjective, rewriteText } from '../../../services/geminiService';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';

interface PaidAdsBriefViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const OBJECTIVES = [
    { id: 'Traffic', label: 'Traffic', icon: 'link', description: 'Drive website visits' },
    { id: 'Leads', label: 'Lead Generation', icon: 'person_add', description: 'Collect leads' },
    { id: 'Sales', label: 'Sales', icon: 'shopping_cart', description: 'Drive conversions' },
    { id: 'Brand Awareness', label: 'Brand Awareness', icon: 'visibility', description: 'Maximize reach' },
    { id: 'Engagement', label: 'Engagement', icon: 'favorite', description: 'Increase interactions' },
    { id: 'Video Views', label: 'Video Views', icon: 'play_circle', description: 'Promote video content' },
    { id: 'App Installs', label: 'App Installs', icon: 'download', description: 'Drive installs' },
];

const FUNNEL_STAGES = [
    { id: 'Awareness', label: 'Awareness' },
    { id: 'Consideration', label: 'Consideration' },
    { id: 'Conversion', label: 'Conversion' },
    { id: 'Retention', label: 'Retention' },
];

export const PaidAdsBriefView: React.FC<PaidAdsBriefViewProps> = ({ idea, onUpdate }) => {
    const { adData, updateAdData, updateBudget } = usePaidAdsData(idea, onUpdate);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isRewriting, setIsRewriting] = useState(false);

    const handleSuggestObjective = async () => {
        setIsSuggesting(true);
        try {
            const suggestion = await suggestObjective(idea.title, idea.description || adData.missionStatement || '');
            if (suggestion) {
                updateAdData({ objective: suggestion });
            }
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleRewriteAudience = async () => {
        if (!adData.missionStatement) return;
        setIsRewriting(true);
        try {
            const rewritten = await rewriteText(adData.missionStatement, 'Professional');
            updateAdData({ missionStatement: rewritten });
        } finally {
            setIsRewriting(false);
        }
    };

    const missionText = (
        <div className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
            "Running a <span className="text-violet-500 font-black">Paid Ad Campaign</span> promoting <span className="text-violet-500 font-black">{adData.offer || 'your offer'}</span> targeting <span className="text-violet-500 font-black">{adData.missionStatement || 'your ideal audience'}</span> with a budget of <span className="text-violet-500 font-black">{adData.budget?.amount ? `$${adData.budget.amount}` : 'TBD'}</span> to drive <span className="text-violet-500 font-black">{adData.objective || 'results'}</span>."
        </div>
    );

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">

                {/* Campaign Mission Hero */}
                <div className="bg-gradient-to-br from-violet-100 via-purple-50 to-white dark:from-violet-900/30 dark:via-purple-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-violet-200 dark:border-violet-800/50 relative overflow-hidden shadow-xl shadow-violet-100 dark:shadow-none">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none">
                        <span className="material-symbols-outlined text-[200px] text-violet-600 rotate-12 -translate-y-10 translate-x-10">campaign</span>
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1">
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="px-3 py-1 bg-violet-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-violet-200 dark:shadow-none">
                                        PAID ADS
                                    </div>
                                    <div className="h-[1px] w-8 bg-violet-200 dark:bg-violet-800 rounded-full" />
                                </div>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                    Campaign Brief
                                </h1>
                            </div>
                            <div className="max-w-3xl p-5 bg-white/70 dark:bg-slate-950/50 rounded-2xl border border-white dark:border-slate-800 shadow-lg shadow-violet-100/50 dark:shadow-none backdrop-blur-md">
                                {missionText}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Objective & Strategy (7/12) */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="flex items-center gap-3 px-2">
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Strategy Core</h2>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm relative overflow-hidden">
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Primary Objective</h3>
                                    <button
                                        onClick={handleSuggestObjective}
                                        disabled={isSuggesting}
                                        className="text-[10px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 flex items-center gap-1 bg-violet-50 dark:bg-violet-900/20 px-2 py-1 rounded-lg transition-colors"
                                    >
                                        <span className={`material-symbols-outlined text-[14px] ${isSuggesting ? 'animate-spin' : ''}`}>
                                            {isSuggesting ? 'sync' : 'auto_awesome'}
                                        </span>
                                        {isSuggesting ? 'Analyzing...' : 'Suggest for me'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {OBJECTIVES.map((obj) => (
                                        <button
                                            key={obj.id}
                                            onClick={() => updateAdData({ objective: obj.id })}
                                            className={`text-left p-4 rounded-2xl border-2 transition-all relative group overflow-hidden ${adData.objective === obj.id
                                                ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-500/50 shadow-lg shadow-violet-500/10'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md'
                                                }`}
                                        >
                                            <div className={`mb-3 size-10 rounded-xl flex items-center justify-center transition-colors ${adData.objective === obj.id ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 group-hover:text-violet-600'}`}>
                                                <span className="material-symbols-outlined text-[20px]">{obj.icon}</span>
                                            </div>
                                            <span className={`text-[11px] font-black uppercase tracking-wider block mb-1 ${adData.objective === obj.id ? 'text-violet-700 dark:text-violet-300' : 'text-slate-900 dark:text-white'}`}>
                                                {obj.label}
                                            </span>
                                            <span className="text-[10px] font-medium text-slate-400 block leading-tight">
                                                {obj.description}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm relative">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Targeting & KPIs</h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[9px] font-black text-violet-600 uppercase tracking-[.25em] opacity-80">Who is the audience?</label>
                                        {adData.missionStatement && (
                                            <button
                                                onClick={handleRewriteAudience}
                                                disabled={isRewriting}
                                                className="text-[10px] font-bold text-slate-400 hover:text-violet-500 flex items-center gap-1 transition-colors"
                                            >
                                                <span className={`material-symbols-outlined text-[12px] ${isRewriting ? 'animate-spin' : ''}`}>
                                                    {isRewriting ? 'sync' : 'magic_button'}
                                                </span>
                                                Magic Rewrite
                                            </button>
                                        )}
                                    </div>
                                    <textarea
                                        value={adData.missionStatement || ''}
                                        onChange={(e) => updateAdData({ missionStatement: e.target.value })}
                                        placeholder="Describe your ideal customer avatar..."
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 min-h-[100px] resize-none focus:ring-4 focus:ring-violet-500/5 transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[9px] font-black text-violet-600 uppercase tracking-[.25em] mb-2 block opacity-80">Success KPI</label>
                                        <input
                                            value={adData.targetKPIs || ''}
                                            onChange={(e) => updateAdData({ targetKPIs: e.target.value })}
                                            placeholder="e.g. CPA < $20"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-violet-600 uppercase tracking-[.25em] mb-2 block opacity-80">Competitors</label>
                                        <input
                                            value={adData.competitors || ''}
                                            onChange={(e) => updateAdData({ competitors: e.target.value })}
                                            placeholder="Names or URLs..."
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm relative">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Offer & Funnel</h3>
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[9px] font-black text-violet-600 uppercase tracking-[.25em] mb-2 block opacity-80">Primary Offer</label>
                                        <input
                                            value={adData.offer || ''}
                                            onChange={(e) => updateAdData({ offer: e.target.value })}
                                            placeholder="What are you promoting?"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-violet-600 uppercase tracking-[.25em] mb-2 block opacity-80">Funnel Stage</label>
                                        <select
                                            value={adData.funnelStage || 'Awareness'}
                                            onChange={(e) => updateAdData({ funnelStage: e.target.value as any })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 appearance-none"
                                        >
                                            {FUNNEL_STAGES.map(stage => (
                                                <option key={stage.id} value={stage.id}>{stage.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[9px] font-black text-violet-600 uppercase tracking-[.25em] mb-2 block opacity-80">Landing Page</label>
                                        <input
                                            value={adData.landingPage || ''}
                                            onChange={(e) => updateAdData({ landingPage: e.target.value })}
                                            placeholder="https://..."
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-violet-600 uppercase tracking-[.25em] mb-2 block opacity-80">Primary Conversion</label>
                                        <input
                                            value={adData.conversionEvent || ''}
                                            onChange={(e) => updateAdData({ conversionEvent: e.target.value })}
                                            placeholder="Purchase, Sign-up, Demo..."
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-violet-600 uppercase tracking-[.25em] mb-2 block opacity-80">Brand Guardrails</label>
                                    <textarea
                                        value={adData.brandGuardrails || ''}
                                        onChange={(e) => updateAdData({ brandGuardrails: e.target.value })}
                                        placeholder="Tone, claims to avoid, compliance notes..."
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 min-h-[100px] resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Key Details (5/12) */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="flex items-center gap-3 px-2">
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Parameters</h2>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        </div>

                        <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden group">
                            {/* Abstract Shapes */}
                            <div className="absolute top-[-50%] right-[-50%] w-[300px] h-[300px] rounded-full bg-violet-500/30 blur-[80px] group-hover:bg-violet-500/40 transition-all duration-1000" />
                            <div className="absolute bottom-[-20%] left-[-20%] w-[200px] h-[200px] rounded-full bg-indigo-500/20 blur-[60px]" />

                            <div className="relative z-10 space-y-8">
                                <div>
                                    <h3 className="font-black text-white uppercase text-[11px] tracking-[.25em] mb-4 opacity-80">Investment</h3>
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1 border border-white/10 flex items-center">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-violet-300">
                                            <span className="material-symbols-outlined">attach_money</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={adData.budget?.amount || ''}
                                            onChange={(e) => updateBudget({ amount: Number(e.target.value) })}
                                            placeholder="0.00"
                                            className="flex-1 bg-transparent border-none px-4 text-2xl font-black text-white placeholder-white/20 focus:ring-0"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-black text-white uppercase text-[11px] tracking-[.25em] mb-4 opacity-80">Timeline</h3>
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1 border border-white/10 flex items-center">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-violet-300">
                                            <span className="material-symbols-outlined">calendar_month</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={adData.duration || ''}
                                            onChange={(e) => updateAdData({ duration: e.target.value })}
                                            placeholder="Duration..."
                                            className="flex-1 bg-transparent border-none px-4 text-sm font-bold text-white placeholder-white/20 focus:ring-0"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/10">
                                    <Button
                                        className="w-full h-14 rounded-2xl bg-white text-slate-900 hover:bg-violet-50 font-black uppercase tracking-widest text-xs shadow-lg shadow-black/20 flex items-center justify-between px-6 group/btn"
                                        onClick={() => onUpdate({ stage: 'Research' })}
                                    >
                                        <span>Next Step</span>
                                        <div className="flex items-center gap-2 group-hover/btn:translate-x-1 transition-transform">
                                            <span>Research</span>
                                            <span className="material-symbols-outlined">arrow_forward</span>
                                        </div>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 rounded-3xl border border-violet-100 dark:border-violet-900/30 bg-violet-50/50 dark:bg-violet-900/10 backdrop-blur-md">
                            <div className="flex items-start gap-4">
                                <div className="size-10 rounded-xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-violet-500 shrink-0">
                                    <span className="material-symbols-outlined">tips_and_updates</span>
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-violet-700 dark:text-violet-300 uppercase tracking-wider mb-1">Pro Tip</h4>
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                                        Defining a sharp CPA target early helps CORA optimize your budget allocation in the next steps.
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
