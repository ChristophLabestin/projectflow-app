import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { generatePaidAdsRiskAnalysis } from '../../../services/geminiService';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';

interface PaidAdsReviewViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const PaidAdsReviewView: React.FC<PaidAdsReviewViewProps> = ({ idea, onUpdate }) => {
    const { adData } = usePaidAdsData(idea, onUpdate);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [riskAnalysis, setRiskAnalysis] = useState<{ wins: string[]; risks: string[]; score: number } | null>(null);

    const handleAnalyzeRisks = async () => {
        setIsAnalyzing(true);
        try {
            const campaignDetails = `
                Campaign Title: ${idea.title}
                Objective: ${adData.objective || 'Not defined'}
                Mission Statement: ${adData.missionStatement || 'Not defined'}
                Target Audience: ${JSON.stringify(adData.targeting || {})}
                Budget: ${adData.budget?.amount || '0'} ${adData.budget?.currency || 'USD'} (${adData.budget?.type || 'Daily'})
                Ad Copy: ${adData.creative?.headline1 || ''} - ${adData.creative?.primaryText || ''}
            `;
            const analysis = await generatePaidAdsRiskAnalysis(campaignDetails);
            setRiskAnalysis(analysis);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const creative = adData.creative || {};
    const targeting = adData.targeting || {};
    const budget = adData.budget || { amount: 0, type: 'Daily', bidStrategy: 'Lowest Cost' };
    const completeness = adData.completeness || 0;

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 pb-32">
            <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">

                {/* Hero Section */}
                <div className="relative w-full h-[350px] rounded-[2.5rem] overflow-hidden group">
                    <div className="absolute inset-0 bg-slate-900">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-purple-900/20 to-slate-900/80" />
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-violet-500/10 blur-[120px] animate-pulse-slow" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-fuchsia-500/10 blur-[100px]" />
                    </div>

                    <div className="relative h-full flex flex-col justify-end p-10 md:p-14 z-10">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="px-4 py-1.5 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2 bg-white/10 text-slate-300">
                                <div className="size-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Ready to Launch</span>
                            </div>
                            <div className="px-4 py-1.5 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2 bg-white/10 text-slate-300">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{completeness}% Complete</span>
                            </div>
                        </div>

                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4 leading-[1.1] max-w-4xl drop-shadow-2xl">
                            {adData.objective ? `Campaign: ${adData.objective} Drive` : 'Untitled Campaign'}
                        </h1>
                        <p className="text-lg text-slate-300 max-w-2xl font-medium leading-relaxed drop-shadow-lg">
                            Targeting <span className="text-white">{adData.missionStatement || 'Audience'}</span> with a <span className="text-white">${budget.amount}</span> {budget.type} budget.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Creative Overview (Left Main) */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 dark:border-slate-800 shadow-xl">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-8">Creative & Copy</h3>

                            <div className="flex flex-col md:flex-row gap-8">
                                <div className="w-full md:w-[320px] shrink-0">
                                    {/* Mock Ad Card */}
                                    <div className="bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-100 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                                        <div className="p-3 flex items-center gap-2 border-b border-slate-100">
                                            <div className="size-8 rounded-full bg-slate-200" />
                                            <div className="flex-1 space-y-1">
                                                <div className="h-2 w-20 bg-slate-200 rounded" />
                                                <div className="h-1.5 w-12 bg-slate-100 rounded" />
                                            </div>
                                        </div>
                                        <div className="aspect-square bg-slate-100 flex items-center justify-center text-slate-300 relative overflow-hidden group">
                                            {creative.visualConcept ? (
                                                <div className="absolute inset-0 p-6 flex items-center justify-center text-center text-xs font-medium text-slate-500 bg-slate-50">
                                                    {creative.visualConcept}
                                                </div>
                                            ) : (
                                                <span className="material-symbols-outlined text-4xl">image</span>
                                            )}
                                        </div>
                                        <div className="p-4 bg-slate-50 border-t border-slate-100">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{creative.headline1 || 'Headline Here'}</div>
                                            <div className="text-xs font-medium text-slate-600 line-clamp-2 mb-3">{creative.primaryText || 'Primary text goes here...'}</div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Sponsored</span>
                                                <button className="px-4 py-1.5 bg-slate-200 text-[10px] font-black text-slate-700 rounded uppercase hover:bg-slate-300 transition-colors">{creative.cta || 'Learn More'}</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Headline</div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{creative.headline1 || 'Not set'}</div>
                                        </div>
                                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CTA</div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{creative.cta || 'Not set'}</div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Primary Text</div>
                                        <div className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{creative.primaryText || 'Not set'}</div>
                                    </div>
                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Testing Variations ({creative.variations?.length || 0})</div>
                                        <div className="flex flex-wrap gap-2">
                                            {creative.variations?.map((v: string, i: number) => (
                                                <span key={i} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    {v}
                                                </span>
                                            ))}
                                            {(!creative.variations || creative.variations.length === 0) && <span className="text-xs text-slate-400 italic">No variations</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Win/Risk Analysis Card - New Feature */}
                        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 dark:border-slate-800 shadow-xl relative overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Pre-Flight Analysis</h3>
                                <button
                                    onClick={handleAnalyzeRisks}
                                    disabled={isAnalyzing}
                                    className="text-[10px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 flex items-center gap-1 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <span className={`material-symbols-outlined text-[14px] ${isAnalyzing ? 'animate-spin' : ''}`}>
                                        {isAnalyzing ? 'sync' : 'auto_awesome'}
                                    </span>
                                    {isAnalyzing ? 'Analyzing...' : 'Run Prediction'}
                                </button>
                            </div>

                            {riskAnalysis ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-4">
                                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                            Winning Probabilities
                                        </h4>
                                        <ul className="space-y-3">
                                            {riskAnalysis.wins.map((win, idx) => (
                                                <li key={idx} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    <span className="text-emerald-500 font-bold">•</span>
                                                    {win}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-4">
                                            <span className="material-symbols-outlined text-[18px]">warning</span>
                                            Potential Risks
                                        </h4>
                                        <ul className="space-y-3">
                                            {riskAnalysis.risks.map((risk, idx) => (
                                                <li key={idx} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    <span className="text-amber-500 font-bold">•</span>
                                                    {risk}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="md:col-span-2 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="text-xs font-bold text-slate-500">Predicted Success Score</div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-32 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${paramsScoreColor(riskAnalysis.score)}`}
                                                    style={{ width: `${riskAnalysis.score}%` }}
                                                />
                                            </div>
                                            <span className="font-black text-slate-900 dark:text-white">{riskAnalysis.score}/100</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 flex flex-col items-center justify-center text-center opacity-60">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">analytics</span>
                                    <p className="text-sm font-medium text-slate-500 max-w-xs">Run a predictive analysis to see AI-generated wins and risks for this campaign.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Strategy & Config */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Strategy Brief */}
                        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 dark:border-slate-800 shadow-xl relative overflow-hidden">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Strategy Brief</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1">Offer</div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">{adData.offer || 'Not defined'}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1">Funnel Stage</div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">{adData.funnelStage || 'Not set'}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1">Conversion Event</div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">{adData.conversionEvent || 'Not set'}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1">Landing Page</div>
                                    <div className="text-xs font-medium text-slate-600 dark:text-slate-300 break-all">{adData.landingPage || 'Not set'}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1">Platforms</div>
                                    <div className="flex flex-wrap gap-2">
                                        {(adData.setup?.platforms || []).length > 0 ? (
                                            adData.setup?.platforms?.map((platform) => (
                                                <span key={platform} className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                                    {platform}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400">Not set</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1">Tracking Status</div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">{adData.setup?.trackingStatus || 'Not set'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Target Card */}
                        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 dark:border-slate-800 shadow-xl relative overflow-hidden">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Targeting Profile</h3>
                            <div className="space-y-4 relative z-10">
                                <div>
                                    <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1">Core Audience</div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{adData.missionStatement || 'Not defined'}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1">Locations</div>
                                    <div className="flex flex-wrap gap-2">
                                        {targeting.locations?.map((l: string) => (
                                            <span key={l} className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">{l}</span>
                                        ))}
                                        {(!targeting.locations || targeting.locations.length === 0) && <span className="text-xs text-slate-400">All Locations</span>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1">Age</div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{targeting.ageMin && targeting.ageMax ? `${targeting.ageMin} - ${targeting.ageMax}` : 'All Ages'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-1">Genders</div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{targeting.genders?.join(', ') || 'All'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Budget Card */}
                        <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden flex flex-col">
                            <h3 className="font-black uppercase text-[11px] tracking-[.25em] mb-6 text-emerald-400">Investment</h3>

                            <div className="text-center mb-8">
                                <div className="text-4xl font-black text-white">${budget.amount || '0'}</div>
                                <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{budget.type} Limit</div>
                            </div>

                            <div className="space-y-4 relative z-10">
                                <div className="flex justify-between items-center py-2 border-b border-white/10">
                                    <span className="text-xs text-white/60">Bid Strategy</span>
                                    <span className="text-xs font-bold">{budget.bidStrategy || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-white/10">
                                    <span className="text-xs text-white/60">Success KPI</span>
                                    <span className="text-xs font-bold text-emerald-400">{adData.targetKPIs || '-'}</span>
                                </div>
                            </div>

                            <div className="mt-8">
                                <Button
                                    className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black uppercase tracking-widest text-xs border-none"
                                    onClick={() => onUpdate({ stage: 'Live' })}
                                >
                                    Publish Campaign
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Edit Dock */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/20 dark:border-slate-700 shadow-2xl rounded-full p-2 pl-6 pr-2 flex items-center gap-6 z-50">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">
                    Quick Edit
                </div>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="flex gap-2">
                    <Button variant="ghost" className="rounded-full text-xs px-4 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onUpdate({ stage: 'Targeting' })}>Targeting</Button>
                    <Button variant="ghost" className="rounded-full text-xs px-4 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onUpdate({ stage: 'Budget' })}>Budget</Button>
                    <Button variant="ghost" className="rounded-full text-xs px-4 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onUpdate({ stage: 'Creative' })}>Creative</Button>
                    <Button variant="ghost" className="rounded-full text-xs px-4 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onUpdate({ stage: 'Build' })}>Build</Button>
                </div>
            </div>

        </div>
    );
};

function paramsScoreColor(score: number) {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
}
