import React from 'react';
import { Idea, RiskWinAnalysis } from '../../../types';
import { Button } from '../ui/Button';

interface AnalysisDashboardProps {
    analysis?: RiskWinAnalysis;
    onRunAnalysis: () => void;
    loading: boolean;
}

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ analysis, onRunAnalysis, loading }) => {
    const [loadingStage, setLoadingStage] = React.useState(0);

    React.useEffect(() => {
        if (!loading) return;
        const interval = setInterval(() => {
            setLoadingStage(prev => (prev + 1) % 4);
        }, 1500);
        return () => clearInterval(interval);
    }, [loading]);

    if (loading) {
        const stages = [
            "Analyzing Market Potential...",
            "Evaluating Technical Feasibility...",
            "Identifying Risk Factors...",
            "Synthesizing Strategic Verdict..."
        ];

        return (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
                <div className="relative size-24 mb-8">
                    {/* Pulsing rings */}
                    <div className="absolute inset-0 rounded-full border-4 border-violet-500/30 animate-ping delay-75"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-violet-500/20 animate-ping delay-150"></div>
                    <div className="absolute inset-0 rounded-full bg-violet-500/10 flex items-center justify-center backdrop-blur-sm border border-violet-500/30 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                        <span className="material-symbols-outlined text-5xl text-violet-500 animate-pulse">psychology</span>
                    </div>
                </div>

                <h3 className="text-xl font-bold text-violet-900 dark:text-violet-100 mb-2 transition-all duration-300 min-h-[30px]">
                    {stages[loadingStage]}
                </h3>
                <p className="text-muted text-sm max-w-xs mx-auto">
                    CORA is simulating a VC & CTO review of your concept.
                </p>

                {/* Progress bar visual */}
                <div className="w-64 h-1.5 bg-surface-hover rounded-full mt-8 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-[loading_2s_ease-in-out_infinite] w-1/3 rounded-full relative left-0"></div>
                </div>
                <style>{`
                    @keyframes loading {
                        0% { left: -30%; width: 30%; }
                        50% { width: 60%; }
                        100% { left: 100%; width: 30%; }
                    }
                `}</style>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-60">
                <div className="size-20 bg-surface-hover rounded-full flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-4xl text-subtle">analytics</span>
                </div>
                <h3 className="text-xl font-bold text-main mb-2">No Analysis Yet</h3>
                <p className="text-muted max-w-md mb-8">
                    Run CORA analysis to estimate success probability, identify risks, and uncover potential wins.
                </p>
                <Button variant="primary" size="lg" onClick={onRunAnalysis} loading={loading} icon={<span className="material-symbols-outlined">network_intelligence</span>}>
                    Run Risk/Win Analysis
                </Button>
            </div>
        );
    }

    const { successProbability, marketFitScore, technicalFeasibilityScore, risks, wins, recommendation } = analysis;

    // Color helpers
    const getScoreColor = (score: number, max: number = 10) => {
        const percentage = (score / max) * 100;
        if (percentage >= 80) return 'bg-emerald-500 text-emerald-600';
        if (percentage >= 50) return 'bg-amber-500 text-amber-600';
        return 'bg-rose-500 text-rose-600';
    };

    const getSeverityColor = (level: string) => {
        switch (level) {
            case 'High': return 'text-rose-600 bg-rose-50 dark:bg-rose-900/20';
            case 'Medium': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
            case 'Low': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
            default: return 'text-slate-600 bg-slate-50';
        }
    };

    return (
        <div className="p-6 space-y-8 animate-in fade-in duration-500">
            {/* Top Row: Probability & Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Success Probability Gauge */}
                <div className="bg-surface-paper border border-surface rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Success Probability</h4>
                    <div className="relative size-32 flex items-center justify-center">
                        <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                            {/* Background Circle */}
                            <path className="text-[var(--color-surface-hover)]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                            {/* Value Circle */}
                            <path
                                className={successProbability >= 70 ? 'text-emerald-500' : successProbability >= 40 ? 'text-amber-500' : 'text-rose-500'}
                                strokeDasharray={`${successProbability}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-main">{successProbability}%</span>
                        </div>
                    </div>
                </div>

                {/* 2. Market Fit Score */}
                <div className="bg-surface-paper border border-surface rounded-2xl p-6 flex flex-col justify-between">
                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Market Fit</h4>
                    <div className="flex-1 flex flex-col justify-end gap-2">
                        <div className="flex items-end justify-between mb-1">
                            <span className="text-4xl font-bold text-main">{marketFitScore}<span className="text-lg text-muted font-normal">/10</span></span>
                            <span className="material-symbols-outlined text-4xl text-[var(--color-surface-border)] opacity-20">storefront</span>
                        </div>
                        <div className="h-3 w-full bg-surface-hover rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${getScoreColor(marketFitScore)}`} style={{ width: `${(marketFitScore / 10) * 100}%` }} />
                        </div>
                    </div>
                </div>

                {/* 3. Feasibility Score */}
                <div className="bg-surface-paper border border-surface rounded-2xl p-6 flex flex-col justify-between">
                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Tech Feasibility</h4>
                    <div className="flex-1 flex flex-col justify-end gap-2">
                        <div className="flex items-end justify-between mb-1">
                            <span className="text-4xl font-bold text-main">{technicalFeasibilityScore}<span className="text-lg text-muted font-normal">/10</span></span>
                            <span className="material-symbols-outlined text-4xl text-[var(--color-surface-border)] opacity-20">code</span>
                        </div>
                        <div className="h-3 w-full bg-surface-hover rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${getScoreColor(technicalFeasibilityScore)}`} style={{ width: `${(technicalFeasibilityScore / 10) * 100}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Recommendation Banner */}
            <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 p-4 rounded-xl flex gap-4 items-start">
                <span className="material-symbols-outlined text-violet-600 mt-0.5">psychology_alt</span>
                <div>
                    <h4 className="text-sm font-bold text-violet-900 dark:text-violet-300 mb-1">CORA Verdict</h4>
                    <p className="text-sm text-main italic">"{recommendation}"</p>
                </div>
            </div>

            {/* Risks vs Wins */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Risks */}
                <div>
                    <h4 className="text-sm font-bold text-subtle uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">warning</span> Major Risks
                    </h4>
                    <div className="space-y-3">
                        {risks.map((risk, i) => (
                            <div key={i} className="p-3 rounded-xl border border-surface bg-surface flex gap-3 items-start">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${getSeverityColor(risk.severity)}`}>
                                    {risk.severity}
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-main leading-tight mb-1">{risk.title}</p>
                                    {risk.mitigation && <p className="text-xs text-muted">Tip: {risk.mitigation}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Wins */}
                <div>
                    <h4 className="text-sm font-bold text-subtle uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">trophy</span> Potential Wins
                    </h4>
                    <div className="space-y-3">
                        {wins.map((win, i) => (
                            <div key={i} className="p-3 rounded-xl border border-surface bg-surface flex gap-3 items-start">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${getSeverityColor(win.impact)}`}>
                                    {win.impact}
                                </span>
                                <p className="text-sm font-bold text-main leading-tight pt-0.5">{win.title}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
