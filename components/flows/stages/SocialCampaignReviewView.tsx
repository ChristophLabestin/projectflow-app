import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '../../ui/Button';
import { Idea, SocialCampaign, ApprovalEvent } from '../../../types';
import { generateRiskWinAnalysis } from '../../../services/geminiService';
import { getProjectMembers, getUserProfile, getSocialCampaign } from '../../../services/dataService';
import { Modal } from '../../ui/Modal';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialCampaignReviewViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
    mode?: 'idea' | 'campaign';
    isApproved?: boolean;
    onTransmit?: () => void;
    onApprove?: () => void;
    campaignStatus?: SocialCampaign['status'];
    onRejectEntirely?: () => void;
    onReject?: (reason?: string) => void;
    onPermanentReject?: (reason?: string) => void;
    onSubmit?: () => void;
}

const ReviewHero: React.FC<{ idea: Idea, viewMode: string }> = ({ idea, viewMode }) => {
    const { t } = useLanguage();
    return (
        <div className="relative w-full h-[400px] rounded-[2.5rem] overflow-hidden group">
        {/* Cinematic Background */}
        <div className="absolute inset-0 bg-slate-900">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-slate-900/80" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />

            {/* Animated Glow Orbs */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[120px] animate-pulse-slow" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-fuchsia-500/10 blur-[100px]" />
        </div>

        <div className="relative h-full flex flex-col justify-end p-10 md:p-14 z-10">
            {/* Status Pill */}
            <div className="mb-6 flex items-center gap-3">
                <div className={`px-4 py-1.5 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2 ${viewMode === 'approved' ? 'bg-emerald-500/20 text-emerald-300' :
                        viewMode === 'reviewer-pending' ? 'bg-blue-500/20 text-blue-300' :
                            'bg-white/10 text-slate-300'
                    }`}>
                    <div className={`size-2 rounded-full ${viewMode === 'approved' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' :
                            viewMode === 'reviewer-pending' ? 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)] animate-pulse' :
                                'bg-slate-400'
                        }`} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                        {viewMode === 'approved' ? t('flowStages.socialCampaignReview.hero.status.active') :
                            viewMode === 'reviewer-pending' ? t('flowStages.socialCampaignReview.hero.status.ready') : t('flowStages.socialCampaignReview.hero.status.draft')}
                    </span>
                </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-4 leading-[1.1] max-w-4xl drop-shadow-2xl">
                {idea.title}
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl font-medium leading-relaxed drop-shadow-lg">
                {idea.description}
            </p>
        </div>
    </div>
    );
};

const StrategyTimeline: React.FC<{ phases: any[] }> = ({ phases }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 dark:border-slate-800 shadow-xl col-span-1 lg:col-span-8">
            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-8">{t('flowStages.socialCampaignReview.timeline.title')}</h3>
            <div className="relative space-y-8">
                <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800" />
                {phases.map((phase, i) => (
                    <div key={i} className="relative flex gap-6 group cursor-default">
                        <div className="relative z-10 flex flex-col items-center">
                            <div className={`size-[54px] rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 ${i === 0 ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/25' :
                                    i === 1 ? 'bg-gradient-to-br from-fuchsia-500 to-pink-600 shadow-fuchsia-500/25' :
                                        'bg-gradient-to-br from-orange-500 to-amber-600 shadow-orange-500/25'
                                }`}>
                                <span className="font-black text-lg">{i + 1}</span>
                            </div>
                        </div>
                        <div className="flex-1 pt-1">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-500 transition-colors">{phase.name}</h4>
                                <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500">{phase.durationValue} {phase.durationUnit}</span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{phase.focus}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const IntelligenceCard: React.FC<{ idea: Idea, onAnalyze: () => void, analyzing: boolean }> = ({ idea, onAnalyze, analyzing }) => {
    const { t } = useLanguage();
    const score = idea.riskWinAnalysis?.successProbability || 0;

    return (
        <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl col-span-1 lg:col-span-4 relative overflow-hidden flex flex-col justify-between min-h-[400px]">
            {/* Background Data Stream */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10" />

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h3 className="font-black uppercase text-[11px] tracking-[.25em] text-indigo-300">{t('flowStages.socialCampaignReview.intelligence.title')}</h3>
                        <p className="text-[10px] font-bold text-slate-500 mt-1">{t('flowStages.socialCampaignReview.intelligence.subtitle')}</p>
                    </div>
                    <div className="size-8 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm">psychology</span>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center py-6">
                    <div className="relative size-40 flex items-center justify-center">
                        <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                            <circle className="text-slate-800 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent" />
                            <circle
                                className={`text-indigo-500 stroke-current transition-all duration-1000 ease-out ${score > 0 ? 'opacity-100' : 'opacity-0'}`}
                                strokeWidth="8"
                                strokeLinecap="round"
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                strokeDasharray="251.2"
                                strokeDashoffset={251.2 - (251.2 * score) / 100}
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-4xl font-black">{score}%</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('flowStages.socialCampaignReview.intelligence.successLabel')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative z-10">
                {idea.riskWinAnalysis ? (
                    <div className="space-y-3">
                        {idea.riskWinAnalysis.wins.slice(0, 2).map((win, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs font-medium text-emerald-300 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                                <span className="material-symbols-outlined text-sm">trending_up</span>
                                {win.title}
                            </div>
                        ))}
                    </div>
                ) : (
                    <Button onClick={onAnalyze} disabled={analyzing} className="w-full bg-indigo-600 hover:bg-indigo-500 py-6 rounded-xl font-black uppercase tracking-widest text-xs">
                        {analyzing ? t('flowStages.socialCampaignReview.intelligence.processing') : t('flowStages.socialCampaignReview.intelligence.run')}
                    </Button>
                )}
            </div>
        </div>
    );
};

const ActionDock: React.FC<{
    onApprove: () => void,
    onReject: () => void,
    onRequestChanges: () => void
}> = ({ onApprove, onReject, onRequestChanges }) => {
    const { t } = useLanguage();
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/20 dark:border-slate-700 shadow-2xl rounded-full p-2 pl-6 pr-2 flex items-center gap-6 z-50 animate-in slide-in-from-bottom-12 duration-500">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">
                {t('flowStages.socialCampaignReview.actions.label')}
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex gap-2">
                <Button variant="ghost" className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-xs px-4" onClick={onReject}>
                    {t('flowStages.socialCampaignReview.actions.reject')}
                </Button>
                <Button variant="ghost" className="rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 text-xs px-4" onClick={onRequestChanges}>
                    {t('flowStages.socialCampaignReview.actions.requestChanges')}
                </Button>
                <Button onClick={onApprove} className="rounded-full hover:scale-105 active:scale-95 transition-all text-xs font-bold px-6 shadow-lg shadow-emerald-500/20">
                    {t('flowStages.socialCampaignReview.actions.approve')}
                </Button>
            </div>
        </div>
    );
};

export const SocialCampaignReviewView: React.FC<SocialCampaignReviewViewProps> = ({
    idea,
    onUpdate,
    onApprove,
    onReject,
    onRejectEntirely,
    onPermanentReject,
    campaignStatus,
    onSubmit
}) => {
    const { t } = useLanguage();
    const [analyzing, setAnalyzing] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectType, setRejectType] = useState<'changes' | 'permanent'>('changes');
    const [rejectionReason, setRejectionReason] = useState('');

    const viewMode = useMemo(() => {
        if (campaignStatus === 'PendingReview') return 'reviewer-pending';
        if (campaignStatus === 'ChangesRequested') return 'creator-changes-requested';
        if (campaignStatus === 'Rejected') return 'rejected';
        if (campaignStatus === 'Concept' || !campaignStatus) return 'creator-draft';
        return 'approved';
    }, [campaignStatus]);

    const concept = useMemo(() => {
        try { return idea.concept && idea.concept.startsWith('{') ? JSON.parse(idea.concept) : {}; }
        catch { return {}; }
    }, [idea.concept]);

    const phases = useMemo(() => Array.isArray(concept.phases) ? concept.phases : [], [concept]);

    const handleRunAnalysis = async () => {
        setAnalyzing(true);
        try {
            const result = await generateRiskWinAnalysis(idea);
            onUpdate({ riskWinAnalysis: result });
        } catch (e) { console.error(e); }
        finally { setAnalyzing(false); }
    };

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 pb-32">
            <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">

                {/* Hero Section */}
                <ReviewHero idea={idea} viewMode={viewMode} />

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Strategy Timeline (Left Main) */}
                    <StrategyTimeline phases={phases} />

                    {/* AI Intelligence (Right Side) */}
                    <IntelligenceCard idea={idea} onAnalyze={handleRunAnalysis} analyzing={analyzing} />

                    {/* Creative DNA (Full Width or Split) */}
                    <div className="col-span-1 lg:col-span-12 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] p-8 border border-white/50 dark:border-slate-800 shadow-sm flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[300px]">
                            <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest mb-2">{t('flowStages.socialCampaignReview.dna.hookTitle')}</h4>
                            <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">"{concept.hook || t('flowStages.socialCampaignReview.dna.hookEmpty')}"</p>
                        </div>
                        <div className="w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />
                        <div className="flex-1 min-w-[300px]">
                            <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest mb-2">{t('flowStages.socialCampaignReview.dna.visualTitle')}</h4>
                            <p className="text-base font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{concept.visualDirection || t('flowStages.socialCampaignReview.dna.visualEmpty')}</p>
                        </div>
                        <div className="w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />
                        <div className="flex-1 min-w-[200px]">
                            <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest mb-2">{t('flowStages.socialCampaignReview.dna.platformsTitle')}</h4>
                            <div className="flex gap-2">
                                {(concept.platforms || []).map((p: any) => (
                                    <div key={p.id} className="size-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm">
                                        <div className="size-6"><PlatformIcon platform={p.id} /></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Action Dock (Only visible for reviewers) */}
            {viewMode === 'reviewer-pending' && (
                <ActionDock
                    onApprove={() => onApprove?.()}
                    onReject={() => {
                        setRejectType('permanent');
                        setShowRejectModal(true);
                    }}
                    onRequestChanges={() => {
                        setRejectType('changes');
                        setShowRejectModal(true);
                    }}
                />
            )}

            {/* Rejection Modal */}
            <Modal
                isOpen={showRejectModal}
                onClose={() => setShowRejectModal(false)}
                title={rejectType === 'changes' ? t('flowStages.socialCampaignReview.rejectModal.requestTitle') : t('flowStages.socialCampaignReview.rejectModal.abortTitle')}
                size="md"
            >
                <div className="space-y-6">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                        {rejectType === 'changes'
                            ? t('flowStages.socialCampaignReview.rejectModal.requestDescription')
                            : t('flowStages.socialCampaignReview.rejectModal.abortDescription')}
                    </p>
                    <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder={t('flowStages.socialCampaignReview.rejectModal.placeholder')}
                        className="w-full h-40 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-0 focus:ring-2 focus:ring-indigo-500/50 resize-none font-mono text-sm"
                        autoFocus
                    />
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setShowRejectModal(false)}>{t('flowStages.socialCampaignReview.rejectModal.cancel')}</Button>
                        <Button
                            className={rejectType === 'changes' ? "bg-amber-500 hover:bg-amber-600 text-white rounded-xl" : "bg-red-500 hover:bg-red-600 text-white rounded-xl"}
                            onClick={() => {
                                if (rejectType === 'changes' && onReject) onReject(rejectionReason);
                                if (rejectType === 'permanent' && onPermanentReject) onPermanentReject(rejectionReason);
                                setShowRejectModal(false);
                                setRejectionReason('');
                            }}
                            disabled={!rejectionReason.trim()}
                        >
                            {rejectType === 'changes' ? t('flowStages.socialCampaignReview.rejectModal.submitChanges') : t('flowStages.socialCampaignReview.rejectModal.submitAbort')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
