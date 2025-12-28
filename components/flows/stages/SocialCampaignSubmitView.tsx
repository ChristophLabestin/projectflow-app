import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Idea, SocialCampaign, ApprovalEvent, RiskWinAnalysis } from '../../../types';
import { getProjectMembers, getUserProfile, getSocialCampaign, updateCampaign } from '../../../services/dataService';
import { generateRiskWinAnalysis } from '../../../services/geminiService';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';

interface SocialCampaignSubmitViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
    campaignStatus?: SocialCampaign['status'];
    onSubmit?: () => void;
    onRejectEntirely?: () => void;
}

export const SocialCampaignSubmitView: React.FC<SocialCampaignSubmitViewProps> = ({
    idea,
    onUpdate,
    campaignStatus,
    onSubmit,
    onRejectEntirely
}) => {
    const navigate = useNavigate();
    const [teamMembers, setTeamMembers] = useState<Array<{ id: string; displayName: string; photoURL?: string }>>([]);
    const [campaignHistory, setCampaignHistory] = useState<ApprovalEvent[]>([]);
    const [analyzing, setAnalyzing] = useState(false);

    // Team Management State
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [tempAssignedIds, setTempAssignedIds] = useState<string[]>([]);

    // Checklist
    const [checklist, setChecklist] = useState({
        concept: { label: 'Concept & Creative Direction Approved', checked: false },
        strategy: { label: 'Channel Strategy & Targets Aligned', checked: false },
        legal: { label: 'Legal & Compliance Review Complete', checked: false },
        brand: { label: 'Brand Voice & Tone Verified', checked: false },
    });

    // Data Loading
    useEffect(() => {
        const loadMembers = async () => {
            if (!idea.projectId) return;
            try {
                const memberIds = await getProjectMembers(idea.projectId, idea.tenantId || 'public');
                const profiles = await Promise.all(memberIds.map(uid => getUserProfile(uid)));
                setTeamMembers(profiles.filter(p => p !== null).map(p => ({
                    id: p.uid, displayName: p.displayName, photoURL: p.photoURL
                })));
            } catch (e) { console.error(e) }
        };
        const loadHistory = async () => {
            if (idea.convertedCampaignId && idea.projectId) {
                try {
                    const c = await getSocialCampaign(idea.projectId, idea.convertedCampaignId);
                    if (c?.approvalHistory) setCampaignHistory(c.approvalHistory);
                    if (c?.assignedUserIds && (!idea.assignedUserIds || idea.assignedUserIds.length === 0)) {
                        onUpdate({ assignedUserIds: c.assignedUserIds });
                    }
                } catch (e) { console.error(e) }
            }
        };
        loadMembers();
        loadHistory();
    }, [idea.projectId, idea.convertedCampaignId, idea.tenantId]);

    const handleRunAnalysis = async () => {
        setAnalyzing(true);
        try {
            const result = await generateRiskWinAnalysis(idea);
            onUpdate({ riskWinAnalysis: result });
        } catch (e) { console.error(e); }
        finally { setAnalyzing(false); }
    };

    // Team Management Handlers
    const handleOpenTeamModal = () => {
        setTempAssignedIds(idea.assignedUserIds || []);
        setIsTeamModalOpen(true);
    };

    const handleToggleMember = (userId: string) => {
        setTempAssignedIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSaveTeam = () => {
        onUpdate({ assignedUserIds: tempAssignedIds });
        if (idea.convertedCampaignId && idea.projectId) {
            updateCampaign(idea.projectId, idea.convertedCampaignId, { assignedUserIds: tempAssignedIds });
        }
        setIsTeamModalOpen(false);
    };

    const concept = useMemo(() => {
        try { return idea.concept && idea.concept.startsWith('{') ? JSON.parse(idea.concept) : {}; }
        catch { return {}; }
    }, [idea.concept]);

    const platforms = useMemo(() => Array.isArray(concept.platforms) ? concept.platforms : [], [concept]);
    const phases = useMemo(() => Array.isArray(concept.phases) ? concept.phases : [], [concept]);
    const kpis = useMemo(() => Array.isArray(concept.kpis) ? concept.kpis : [], [concept]);
    const isSubmitted = campaignStatus === 'PendingReview' || idea.stage === 'PendingReview';
    const isChangesRequested = campaignStatus === 'ChangesRequested';

    const allChecked = Object.values(checklist).every(i => i.checked);
    const progressPercent = Math.round((Object.values(checklist).filter(i => i.checked).length / Object.keys(checklist).length) * 100);

    const analysis = idea.riskWinAnalysis;
    const latestFeedback = campaignHistory
        .filter(e => e.type === 'changes_requested' || e.type === 'rejection')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    const assignedMembers = teamMembers.filter(m => (idea.assignedUserIds || []).includes(m.id));

    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-emerald-500';
        if (score >= 5) return 'text-amber-500';
        return 'text-red-500';
    };

    const getScoreBarColor = (score: number) => {
        if (score >= 8) return 'bg-emerald-500';
        if (score >= 5) return 'bg-amber-500';
        return 'bg-red-500';
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">

                {/* Hero Header - Matching Strategy/Planning pattern */}
                <div className="bg-gradient-to-br from-emerald-100 via-teal-50 to-white dark:from-emerald-900/30 dark:via-teal-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-emerald-200 dark:border-emerald-800/50 relative overflow-hidden shadow-xl shadow-emerald-100 dark:shadow-none">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none">
                        <span className="material-symbols-outlined text-[200px] text-emerald-600 rotate-12 -translate-y-10 translate-x-10">rocket_launch</span>
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1">
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="px-3 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-emerald-200 dark:shadow-none">
                                        Submit Phase
                                    </div>
                                    <div className="h-[1px] w-8 bg-emerald-200 dark:bg-emerald-800 rounded-full" />
                                </div>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {isSubmitted ? 'Awaiting Approval' : 'Final Review'}
                                </h1>
                            </div>
                            <div className="max-w-3xl p-5 bg-white/70 dark:bg-slate-950/50 rounded-2xl border border-white dark:border-slate-800 shadow-lg shadow-emerald-100/50 dark:shadow-none backdrop-blur-md">
                                <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                    {isSubmitted
                                        ? <>Campaign is <span className="text-emerald-600 font-black">locked for review</span>. Awaiting approval from the board.</>
                                        : <>Verify <span className="text-emerald-600 font-black">all checkpoints</span> and run a strategic forecast before submitting for approval.</>}
                                </p>
                            </div>
                        </div>
                        {/* Quick Stats */}
                        <div className="flex gap-4">
                            <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/50 dark:border-slate-700/50 min-w-[80px]">
                                <div className="text-2xl font-black text-emerald-600">{platforms.length}</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Channels</div>
                            </div>
                            <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/50 dark:border-slate-700/50 min-w-[80px]">
                                <div className="text-2xl font-black text-emerald-600">{phases.length}</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Phases</div>
                            </div>
                            <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/50 dark:border-slate-700/50 min-w-[80px]">
                                <div className="text-2xl font-black text-emerald-600">{kpis.length}</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">KPIs</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feedback Banner */}
                {isChangesRequested && latestFeedback && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-6 rounded-3xl flex gap-5 items-start">
                        <div className="size-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 text-amber-600">
                            <span className="material-symbols-outlined text-2xl">feedback</span>
                        </div>
                        <div>
                            <h3 className="font-black text-amber-900 dark:text-amber-100 text-sm uppercase tracking-wider mb-2">Changes Requested</h3>
                            <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">"{latestFeedback.notes}"</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left Column: AI Report & Checklist (8 cols) */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* AI Intelligence Report (Expanded) */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                                        <span className="material-symbols-outlined">psychology</span>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">AI Intelligence Report</h3>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1">Strategic risk & opportunity analysis</p>
                                    </div>
                                </div>
                                {!isSubmitted && (
                                    <Button
                                        onClick={handleRunAnalysis}
                                        disabled={analyzing}
                                        className="h-9 px-4 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                    >
                                        <span className={`material-symbols-outlined text-[18px] ${analyzing ? 'animate-spin' : ''}`}>
                                            {analyzing ? 'progress_activity' : 'refresh'}
                                        </span>
                                        {analyzing ? 'Analyzing...' : 'Refresh Analysis'}
                                    </Button>
                                )}
                            </div>

                            {analysis ? (
                                <div className="p-6 md:p-8">
                                    {/* Top Level Metrics */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                        {/* Success Probability */}
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                <span className="material-symbols-outlined text-6xl">query_stats</span>
                                            </div>
                                            <div className="relative z-10">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Success Probability</div>
                                                <div className={`text-4xl font-black ${getScoreColor(analysis.successProbability / 10)} mb-3`}>
                                                    {analysis.successProbability}%
                                                </div>
                                                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className={`h-full ${getScoreBarColor(analysis.successProbability / 10)} transition-all duration-1000`} style={{ width: `${analysis.successProbability}%` }} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Market Fit */}
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50 flex flex-col justify-between">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Market Fit Score</div>
                                            <div className="flex items-end gap-2">
                                                <span className={`text-3xl font-black ${getScoreColor(analysis.marketFitScore)}`}>{analysis.marketFitScore}</span>
                                                <span className="text-sm font-bold text-slate-400 mb-1">/ 10</span>
                                            </div>
                                        </div>

                                        {/* Technical Feasibility */}
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50 flex flex-col justify-between">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Technical Feasibility</div>
                                            <div className="flex items-end gap-2">
                                                <span className={`text-3xl font-black ${getScoreColor(analysis.technicalFeasibilityScore)}`}>{analysis.technicalFeasibilityScore}</span>
                                                <span className="text-sm font-bold text-slate-400 mb-1">/ 10</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Risks */}
                                        <div>
                                            <h4 className="flex items-center gap-2 text-[11px] font-black text-red-500 uppercase tracking-widest mb-4">
                                                <span className="material-symbols-outlined text-lg">warning</span>
                                                Identified Risks
                                            </h4>
                                            <div className="space-y-3">
                                                {analysis.risks.map((risk, i) => (
                                                    <div key={i} className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-4">
                                                        <div className="flex items-start justify-between gap-3 mb-2">
                                                            <div className="font-bold text-red-900 dark:text-red-100 text-sm">{risk.title}</div>
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${risk.severity === 'High' ? 'bg-red-500 text-white' : risk.severity === 'Medium' ? 'bg-amber-500 text-white' : 'bg-slate-500 text-white'}`}>
                                                                {risk.severity}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-red-800/80 dark:text-red-200/80 leading-relaxed">
                                                            <span className="font-bold">Mitigation:</span> {risk.mitigation}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Wins */}
                                        <div>
                                            <h4 className="flex items-center gap-2 text-[11px] font-black text-emerald-500 uppercase tracking-widest mb-4">
                                                <span className="material-symbols-outlined text-lg">verified</span>
                                                Projected Wins
                                            </h4>
                                            <div className="space-y-3">
                                                {analysis.wins.map((win, i) => (
                                                    <div key={i} className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4">
                                                        <div className="flex items-start justify-between gap-3 mb-1">
                                                            <div className="font-bold text-emerald-900 dark:text-emerald-100 text-sm">{win.title}</div>
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300`}>
                                                                {win.impact} Impact
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {analysis.recommendation && (
                                                    <div className="mt-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">AI Recommendation</div>
                                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 italic">"{analysis.recommendation}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-12 text-center flex flex-col items-center justify-center">
                                    <div className="size-20 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6 shadow-sm">
                                        <span className="material-symbols-outlined text-4xl text-slate-300">query_stats</span>
                                    </div>
                                    <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2">No Analysis Available</h4>
                                    <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">Run a comprehensive AI forecast to analyze risks, market fit, and potential wins before submitting.</p>
                                    <Button onClick={handleRunAnalysis} disabled={analyzing} className="h-12 px-8 rounded-xl">
                                        {analyzing ? (
                                            <>
                                                <span className="animate-spin material-symbols-outlined mr-2">progress_activity</span>
                                                Analyzing Campaign...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined mr-2">play_arrow</span>
                                                Run AI Vision Analysis
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Campaign Manifesto */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-200 dark:shadow-none">
                                    <span className="material-symbols-outlined">description</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Campaign Manifesto</h3>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1">Core creative direction</p>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                    "{concept.bigIdea || idea.title}"
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {platforms.map((p: any) => (
                                        <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                            <div className="size-5"><PlatformIcon platform={p.id} /></div>
                                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{p.id}</span>
                                        </div>
                                    ))}
                                </div>
                                {concept.themes?.length > 0 && (
                                    <div className="flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-6">
                                        {concept.themes.map((t: string, i: number) => (
                                            <span key={i} className="px-3 py-1 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
                                                #{t}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Sidebar (4 cols) */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Pre-Flight Checklist Card */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-none">
                                        <span className="material-symbols-outlined">checklist</span>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Pre-Flight Checklist</h3>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1">Complete all items to unlock submission</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <span className={`text-2xl font-black ${allChecked ? 'text-emerald-500' : 'text-slate-400'}`}>{progressPercent}%</span>
                                    </div>
                                </div>
                            </div>

                            {!isSubmitted ? (
                                <div className="p-6 md:p-8">
                                    <div className="space-y-3 mb-8">
                                        {Object.entries(checklist).map(([key, item]) => (
                                            <div
                                                key={key}
                                                onClick={() => setChecklist(prev => ({ ...prev, [key]: { ...item, checked: !item.checked } }))}
                                                className={`flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all border-2 group ${item.checked
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500/20 dark:border-emerald-500/30'
                                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800'}`}
                                            >
                                                <div className={`size-6 rounded-lg border-2 flex items-center justify-center transition-all ${item.checked
                                                    ? 'bg-emerald-500 border-emerald-500'
                                                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 group-hover:border-emerald-400'}`}>
                                                    {item.checked && <span className="material-symbols-outlined text-[16px] text-white">check</span>}
                                                </div>
                                                <span className={`text-sm font-bold ${item.checked ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {item.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Submit Button */}
                                    <Button
                                        onClick={onSubmit}
                                        disabled={!allChecked}
                                        className={`w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 transition-all ${allChecked
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-200/50 dark:shadow-none hover:-translate-y-1'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                                    >
                                        <span className="material-symbols-outlined text-2xl">{allChecked ? 'rocket_launch' : 'lock'}</span>
                                        {allChecked ? 'Submit for Review' : 'Complete Checklist to Submit'}
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-12 text-center">
                                    <div className="inline-flex size-16 bg-amber-50 dark:bg-amber-900/30 rounded-2xl items-center justify-center mb-6 text-amber-500">
                                        <span className="material-symbols-outlined text-4xl">lock_clock</span>
                                    </div>
                                    <h4 className="font-bold text-slate-900 dark:text-white mb-2 text-lg">Locked for Review</h4>
                                    <p className="text-sm text-slate-500 mb-8">Campaign is with the approval board.</p>
                                    <Button onClick={() => navigate('/social')} className="h-12 w-full mb-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold uppercase tracking-wider text-xs">
                                        Back to Pipeline
                                    </Button>
                                    <Button onClick={onRejectEntirely} variant="ghost" className="text-xs text-slate-500 hover:text-red-600">
                                        <span className="material-symbols-outlined text-sm mr-2">undo</span>
                                        Retract Submission
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Mission Team */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Campaign Team</h3>
                                <button className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 uppercase tracking-widest" onClick={handleOpenTeamModal}>Manage</button>
                            </div>
                            <div className="space-y-3">
                                {assignedMembers.length > 0 ? assignedMembers.map(m => (
                                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <div className="size-8 rounded-full ring-2 ring-white dark:ring-slate-900 overflow-hidden bg-slate-200 relative">
                                            {m.photoURL ? <img src={m.photoURL} className="size-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-500">{m.displayName[0]}</span>}
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{m.displayName}</span>
                                    </div>
                                )) : (
                                    <div className="text-center py-4 text-xs text-slate-400 italic">No team assigned</div>
                                )}
                                <button
                                    className="w-full py-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all"
                                    onClick={handleOpenTeamModal}
                                >
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    Assign Member
                                </button>
                            </div>
                        </div>

                        {/* AI Token Usage */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">AI Resources</h3>
                                <span className="material-symbols-outlined text-base text-violet-500">auto_awesome</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                                <div className="flex items-end gap-2 mb-3">
                                    <span className="text-3xl font-black text-slate-900 dark:text-white">{(idea.aiTokensUsed || 0).toLocaleString()}</span>
                                    <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">tokens used</span>
                                </div>
                                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                                        style={{ width: `${Math.min(((idea.aiTokensUsed || 0) / 50000) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Team Management Modal */}
                <Modal
                    isOpen={isTeamModalOpen}
                    onClose={() => setIsTeamModalOpen(false)}
                    title="Campaign Team"
                    footer={
                        <>
                            <Button variant="ghost" onClick={() => setIsTeamModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveTeam}>Save Team</Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500 mb-4">Select team members responsible for this campaign.</p>
                        <div className="max-h-[300px] overflow-y-auto space-y-2">
                            {teamMembers.map(member => {
                                const isSelected = tempAssignedIds.includes(member.id);
                                return (
                                    <div
                                        key={member.id}
                                        onClick={() => handleToggleMember(member.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected
                                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                                            : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700 hover:border-emerald-200'}`}
                                    >
                                        <div className={`size-5 rounded border flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'bg-transparent border-slate-300'}`}>
                                            {isSelected && <span className="material-symbols-outlined text-white text-sm">check</span>}
                                        </div>
                                        <div className="size-8 rounded-full bg-slate-200 overflow-hidden relative">
                                            {member.photoURL ? <img src={member.photoURL} className="size-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-500">{member.displayName[0]}</span>}
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{member.displayName}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
};
