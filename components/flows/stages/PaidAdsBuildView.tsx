import React from 'react';
import { Idea, AdPlatform } from '../../../types';
import { Button } from '../../ui/Button';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';

interface PaidAdsBuildViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const PLATFORMS: AdPlatform[] = ['Meta', 'Google', 'LinkedIn', 'TikTok', 'Other'];

const CHECKLIST_ITEMS = [
    { id: 'pixel', label: 'Pixel / tag firing verified' },
    { id: 'events', label: 'Conversion events mapped' },
    { id: 'lp', label: 'Landing page QA complete' },
    { id: 'policy', label: 'Policy compliance check' },
    { id: 'naming', label: 'Campaign naming conventions set' },
    { id: 'budget_caps', label: 'Budget caps and pacing set' },
];

export const PaidAdsBuildView: React.FC<PaidAdsBuildViewProps> = ({ idea, onUpdate }) => {
    const { adData, updateAdData } = usePaidAdsData(idea, onUpdate);
    const setup = adData.setup || {};

    const togglePlatform = (platform: AdPlatform) => {
        const current = setup.platforms || [];
        const next = current.includes(platform)
            ? current.filter(p => p !== platform)
            : [...current, platform];
        updateAdData({ setup: { platforms: next } });
    };

    const toggleChecklist = (itemId: string) => {
        const current = setup.checklist || [];
        const next = current.includes(itemId)
            ? current.filter(i => i !== itemId)
            : [...current, itemId];
        updateAdData({ setup: { checklist: next } });
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">
                <div className="bg-gradient-to-br from-cyan-100 via-sky-50 to-white dark:from-cyan-900/30 dark:via-sky-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-cyan-200 dark:border-cyan-800/50 relative overflow-hidden shadow-xl shadow-cyan-100 dark:shadow-none flex items-center justify-between">
                    <div className="relative z-10 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="px-3 py-1 bg-cyan-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-cyan-200 dark:shadow-none">
                                BUILD & QA
                            </div>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                            Campaign Setup Checklist
                        </h1>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-cyan-100/50 to-transparent dark:from-cyan-900/20" />
                    <span className="material-symbols-outlined absolute right-10 -bottom-10 text-[180px] text-cyan-500/10 rotate-12">fact_check</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 space-y-6">
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Platform Mix</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {PLATFORMS.map(platform => {
                                    const selected = (setup.platforms || []).includes(platform);
                                    return (
                                        <button
                                            key={platform}
                                            onClick={() => togglePlatform(platform)}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all ${selected
                                                ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700 hover:border-cyan-300'
                                                }`}
                                        >
                                            <span className={`text-xs font-black uppercase tracking-wider block ${selected ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-900 dark:text-white'}`}>
                                                {platform}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Campaign Structure</h3>
                            <textarea
                                value={setup.campaignStructure || ''}
                                onChange={(e) => updateAdData({ setup: { campaignStructure: e.target.value } })}
                                placeholder="Account > Campaign > Ad Set > Ad naming, split tests, geo splits..."
                                className="w-full min-h-[160px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 resize-none"
                            />
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">QA Notes</h3>
                            <textarea
                                value={setup.qaNotes || ''}
                                onChange={(e) => updateAdData({ setup: { qaNotes: e.target.value } })}
                                placeholder="Creative approvals, policy concerns, ad copy checks..."
                                className="w-full min-h-[120px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 resize-none"
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                                <span className="material-symbols-outlined text-[150px] text-white -mr-10 -mt-10">settings</span>
                            </div>
                            <div className="relative z-10 space-y-6">
                                <h3 className="font-black text-white uppercase text-[11px] tracking-[.25em]">Tracking & UTMs</h3>
                                <div>
                                    <label className="text-[9px] font-black text-cyan-300 uppercase tracking-[.25em] mb-2 block opacity-80">Tracking Status</label>
                                    <select
                                        value={setup.trackingStatus || 'Not Started'}
                                        onChange={(e) => updateAdData({ setup: { trackingStatus: e.target.value as any } })}
                                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-cyan-500 appearance-none"
                                    >
                                        {['Not Started', 'In Progress', 'Verified'].map(status => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-cyan-300 uppercase tracking-[.25em] mb-2 block opacity-80">UTM Scheme</label>
                                    <input
                                        value={setup.utmScheme || ''}
                                        onChange={(e) => updateAdData({ setup: { utmScheme: e.target.value } })}
                                        placeholder="utm_source=...&utm_campaign=..."
                                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-xs font-medium text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">QA Checklist</h3>
                            <div className="space-y-3">
                                {CHECKLIST_ITEMS.map(item => {
                                    const checked = (setup.checklist || []).includes(item.id);
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => toggleChecklist(item.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${checked
                                                ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500/50'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700 hover:border-cyan-300'
                                                }`}
                                        >
                                            <span className={`material-symbols-outlined text-[18px] ${checked ? 'text-cyan-600 dark:text-cyan-300' : 'text-slate-400'}`}>
                                                {checked ? 'check_circle' : 'radio_button_unchecked'}
                                            </span>
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                className="w-full h-14 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-between px-6 group/btn border-none"
                                onClick={() => onUpdate({ stage: 'Review' })}
                            >
                                <span>Next Step</span>
                                <div className="flex items-center gap-2 group-hover/btn:translate-x-1 transition-transform">
                                    <span>Review</span>
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
