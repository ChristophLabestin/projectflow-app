import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { auth } from '../../../services/firebase';
import { AnalysisDashboard } from '../AnalysisDashboard';
import { generateRiskWinAnalysis } from '../../../services/geminiService';
import { updateIdea } from '../../../services/dataService';
import { Modal } from '../../ui/Modal';
import { InitiativeConversionModal } from '../InitiativeConversionModal';

interface ApprovalViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
    onConvert: (startDate?: string, dueDate?: string) => void;
    onReject?: (reason: string) => void;
    onRejectEntirely?: () => void;
}

export const ApprovalView: React.FC<ApprovalViewProps> = ({ idea, onUpdate, onConvert, onReject, onRejectEntirely }) => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'analysis' | 'brief'>('analysis');
    const [analyzing, setAnalyzing] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const [checklist, setChecklist] = useState({
        conceptClear: !!idea.concept,
        feasibilityChecked: (idea.analysis?.weaknesses?.length || 0) > 0,
        resourcesAvailable: false,
        timelineEstimated: false,
    });

    // Check if ready for approval
    const canApprove = checklist.conceptClear && checklist.feasibilityChecked && checklist.resourcesAvailable && checklist.timelineEstimated;

    const handleApprove = () => {
        onUpdate({
            stage: 'Approved',
            approvedBy: auth.currentUser?.uid,
            approvedAt: new Date().toISOString()
        });
    };

    const handleRunAnalysis = async () => {
        setAnalyzing(true);
        try {
            const result = await generateRiskWinAnalysis(idea);
            onUpdate({ riskWinAnalysis: result });
        } catch (e) {
            console.error(e);
        } finally {
            setAnalyzing(false);
        }
    };

    const isApproved = idea.stage === 'Approved' || idea.stage === 'Implemented';
    const isImplemented = idea.stage === 'Implemented';
    const isRejected = idea.stage === 'Rejected' || idea.stage === 'Archived';

    // Auto-calculate checklists based on data presence
    useEffect(() => {
        setChecklist({
            conceptClear: !!idea.concept && idea.concept.length > 50,
            feasibilityChecked: (idea.analysis?.weaknesses?.length || 0) > 0 || (idea.riskWinAnalysis !== undefined),
            resourcesAvailable: checklist.resourcesAvailable, // Keep manual override
            timelineEstimated: checklist.timelineEstimated, // Keep manual override, could check dueDate
        });
    }, [idea]);

    // Helper for status badge
    const StatusBadge = () => {
        if (isImplemented) return (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200 text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm">rocket_launch</span>
                Implemented
            </div>
        );
        if (isApproved) return (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm">verified</span>
                Approved
            </div>
        );
        return (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm">pending_actions</span>
                In Review
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col lg:flex-row gap-6">
            <InitiativeConversionModal
                idea={idea}
                isOpen={showConvertModal}
                onClose={() => setShowConvertModal(false)}
                onConfirm={(start, end) => {
                    onConvert(start, end);
                    setShowConvertModal(false);
                }}
            />

            {/* Left Panel: Content (Swappable) */}
            <div className="flex-1 min-h-0 bg-[var(--color-surface-paper)] rounded-2xl border border-[var(--color-surface-border)] shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] flex justify-between items-center">

                    {/* View Switcher */}
                    <div className="flex items-center p-1 bg-[var(--color-surface-paper)] rounded-lg border border-[var(--color-surface-border)]">
                        <button
                            onClick={() => setViewMode('analysis')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'analysis' ? 'bg-[var(--color-surface-active)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">analytics</span>
                            Analysis & Risks
                        </button>
                        <button
                            onClick={() => setViewMode('brief')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'brief' ? 'bg-[var(--color-surface-active)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">description</span>
                            Concept Brief
                        </button>
                    </div>

                    <StatusBadge />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--color-surface-paper)]">
                    {viewMode === 'analysis' && (
                        <AnalysisDashboard
                            analysis={idea.riskWinAnalysis}
                            loading={analyzing}
                            onRunAnalysis={handleRunAnalysis}
                        />
                    )}

                    {viewMode === 'brief' && (
                        <div className="p-8">
                            {idea.concept ? (
                                <div
                                    className="prose prose-sm dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: idea.concept }}
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-40 select-none py-20">
                                    <span className="material-symbols-outlined text-6xl mb-4">draft</span>
                                    <p className="text-lg italic font-serif">No concept drafted yet.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Approval Controls */}
            <div className="lg:w-96 shrink-0 flex flex-col gap-6 overflow-y-auto custom-scrollbar">

                {/* 1. Meta Summary */}
                <div className="bg-[var(--color-surface-paper)] p-5 rounded-2xl border border-[var(--color-surface-border)] shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">At a Glance</h3>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[var(--color-surface-bg)] p-3 rounded-xl border border-[var(--color-surface-border)]">
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold block mb-1">Impact</span>
                            <span className={`font-bold ${idea.impact === 'High' ? 'text-green-600' : idea.impact === 'Low' ? 'text-slate-500' : 'text-blue-600'}`}>
                                {idea.impact || 'N/A'}
                            </span>
                        </div>
                        <div className="bg-[var(--color-surface-bg)] p-3 rounded-xl border border-[var(--color-surface-border)]">
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold block mb-1">Effort</span>
                            <span className={`font-bold ${idea.effort === 'High' ? 'text-rose-600' : idea.effort === 'Low' ? 'text-green-600' : 'text-amber-600'}`}>
                                {idea.effort || 'N/A'}
                            </span>
                        </div>
                    </div>

                    {(idea.analysis?.strengths?.length || 0) > 0 && (
                        <div className="bg-[var(--color-surface-bg)] p-3 rounded-xl border border-[var(--color-surface-border)]">
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)] font-bold block mb-2">Key Strength</span>
                            <div className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-emerald-500 text-sm mt-0.5">check_circle</span>
                                <span className="text-xs text-[var(--color-text-main)] italic">"{idea.analysis!.strengths[0]}"</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Checklist & Actions */}
                <div className="bg-[var(--color-surface-paper)] p-5 rounded-2xl border border-[var(--color-surface-border)] shadow-sm flex-1 flex flex-col">
                    <h3 className="text-sm font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mb-4">Decision</h3>

                    {!isApproved && (
                        <div className="space-y-3 mb-6">
                            <div
                                onClick={() => setChecklist({ ...checklist, conceptClear: !checklist.conceptClear })}
                                className={`
                                    group flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer select-none
                                    ${checklist.conceptClear
                                        ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-400/30 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.15)]'
                                        : 'bg-[var(--color-surface-bg)] border-transparent hover:border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'
                                    }
                                `}
                            >
                                <div className={`
                                    mt-0.5 flex shrink-0 items-center justify-center size-5 rounded-full border-[1.5px] transition-all duration-200
                                    ${checklist.conceptClear
                                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm scale-110'
                                        : 'border-[var(--color-text-muted)] bg-transparent group-hover:border-emerald-400'
                                    }
                                `}>
                                    {checklist.conceptClear && <span className="material-symbols-outlined text-[14px] font-bold leading-none">check</span>}
                                </div>
                                <div className="flex-1">
                                    <span className={`block text-sm font-bold mb-0.5 transition-colors ${checklist.conceptClear ? 'text-emerald-950 dark:text-emerald-100' : 'text-[var(--color-text-main)]'}`}>
                                        Concept Validated
                                    </span>
                                    <span className={`block text-xs transition-colors ${checklist.conceptClear ? 'text-emerald-700 dark:text-emerald-300' : 'text-[var(--color-text-muted)]'}`}>
                                        Scope is clear & documented
                                    </span>
                                </div>
                            </div>

                            <div
                                onClick={() => setChecklist({ ...checklist, feasibilityChecked: !checklist.feasibilityChecked })}
                                className={`
                                    group flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer select-none
                                    ${checklist.feasibilityChecked
                                        ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-400/30 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.15)]'
                                        : 'bg-[var(--color-surface-bg)] border-transparent hover:border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'
                                    }
                                `}
                            >
                                <div className={`
                                    mt-0.5 flex shrink-0 items-center justify-center size-5 rounded-full border-[1.5px] transition-all duration-200
                                    ${checklist.feasibilityChecked
                                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm scale-110'
                                        : 'border-[var(--color-text-muted)] bg-transparent group-hover:border-emerald-400'
                                    }
                                `}>
                                    {checklist.feasibilityChecked && <span className="material-symbols-outlined text-[14px] font-bold leading-none">check</span>}
                                </div>
                                <div className="flex-1">
                                    <span className={`block text-sm font-bold mb-0.5 transition-colors ${checklist.feasibilityChecked ? 'text-emerald-950 dark:text-emerald-100' : 'text-[var(--color-text-main)]'}`}>
                                        Risks Assessed
                                    </span>
                                    <span className={`block text-xs transition-colors ${checklist.feasibilityChecked ? 'text-emerald-700 dark:text-emerald-300' : 'text-[var(--color-text-muted)]'}`}>
                                        SWOT analysis completed
                                    </span>
                                </div>
                            </div>

                            <div
                                onClick={() => setChecklist({ ...checklist, resourcesAvailable: !checklist.resourcesAvailable })}
                                className={`
                                    group flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer select-none
                                    ${checklist.resourcesAvailable
                                        ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-400/30 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.15)]'
                                        : 'bg-[var(--color-surface-bg)] border-transparent hover:border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'
                                    }
                                `}
                            >
                                <div className={`
                                    mt-0.5 flex shrink-0 items-center justify-center size-5 rounded-full border-[1.5px] transition-all duration-200
                                    ${checklist.resourcesAvailable
                                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm scale-110'
                                        : 'border-[var(--color-text-muted)] bg-transparent group-hover:border-emerald-400'
                                    }
                                `}>
                                    {checklist.resourcesAvailable && <span className="material-symbols-outlined text-[14px] font-bold leading-none">check</span>}
                                </div>
                                <div className="flex-1">
                                    <span className={`block text-sm font-bold mb-0.5 transition-colors ${checklist.resourcesAvailable ? 'text-emerald-950 dark:text-emerald-100' : 'text-[var(--color-text-main)]'}`}>
                                        Resourced
                                    </span>
                                    <span className={`block text-xs transition-colors ${checklist.resourcesAvailable ? 'text-emerald-700 dark:text-emerald-300' : 'text-[var(--color-text-muted)]'}`}>
                                        Team available to execute
                                    </span>
                                </div>
                            </div>


                            <div
                                onClick={() => setChecklist({ ...checklist, timelineEstimated: !checklist.timelineEstimated })}
                                className={`
                                    group flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer select-none
                                    ${checklist.timelineEstimated
                                        ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-400/30 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.15)]'
                                        : 'bg-[var(--color-surface-bg)] border-transparent hover:border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'
                                    }
                                `}
                            >
                                <div className={`
                                    mt-0.5 flex shrink-0 items-center justify-center size-5 rounded-full border-[1.5px] transition-all duration-200
                                    ${checklist.timelineEstimated
                                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm scale-110'
                                        : 'border-[var(--color-text-muted)] bg-transparent group-hover:border-emerald-400'
                                    }
                                `}>
                                    {checklist.timelineEstimated && <span className="material-symbols-outlined text-[14px] font-bold leading-none">check</span>}
                                </div>
                                <div className="flex-1">
                                    <span className={`block text-sm font-bold mb-0.5 transition-colors ${checklist.timelineEstimated ? 'text-emerald-950 dark:text-emerald-100' : 'text-[var(--color-text-main)]'}`}>
                                        Timeline Estimated
                                    </span>
                                    <span className={`block text-xs transition-colors ${checklist.timelineEstimated ? 'text-emerald-700 dark:text-emerald-300' : 'text-[var(--color-text-muted)]'}`}>
                                        Completion date set
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {isApproved && (
                        <div className="mb-6 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30 text-center">
                            <div className="size-12 bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-200 rounded-full flex items-center justify-center mx-auto mb-2">
                                <span className="material-symbols-outlined">thumb_up</span>
                            </div>
                            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Idea Approved</p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">Ready for development</p>
                        </div>
                    )}

                    <div className="mt-auto space-y-3">
                        {!isApproved && (
                            <div className="space-y-3 w-full">
                                <Button
                                    size="lg"
                                    variant="secondary"
                                    className="w-full h-12 text-base border-none hover:bg-[var(--color-surface-hover)]"
                                    onClick={() => navigate(`/project/${idea.projectId}/ideas`)}
                                >
                                    Decide Later
                                </Button>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        size="lg"
                                        variant="secondary"
                                        className="h-12 text-sm border-none bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 dark:text-rose-400"
                                        onClick={() => onRejectEntirely ? onRejectEntirely() : onUpdate({ stage: 'Rejected' })}
                                    >
                                        Reject
                                    </Button>
                                    <Button
                                        size="lg"
                                        variant="secondary"
                                        className="h-12 text-sm border-none bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 dark:text-amber-400"
                                        onClick={() => setShowRejectModal(true)}
                                    >
                                        Request Changes
                                    </Button>
                                </div>
                                <Button
                                    size="lg"
                                    className="w-full h-12 text-base shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                                    disabled={!canApprove}
                                    onClick={handleApprove}
                                    icon={<span className="material-symbols-outlined">check_circle</span>}
                                >
                                    Approve for Dev
                                </Button>
                            </div>
                        )}

                        {isApproved && !isImplemented && (
                            <Button
                                size="lg"
                                className="w-full h-12 text-base shadow-lg bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:bg-[var(--color-text-main)]/90 border-none"
                                onClick={() => setShowConvertModal(true)}
                            >
                                Convert to Initiative
                                <span className="material-symbols-outlined ml-2 text-sm">arrow_forward</span>
                            </Button>
                        )}

                        {isImplemented && (
                            <Button
                                size="lg"
                                variant="secondary"
                                className="w-full h-12"
                                onClick={() => window.open(`/project/${idea.projectId}/tasks/${idea.convertedTaskId}`, '_blank')}
                            >
                                View Linked Initiative
                                <span className="material-symbols-outlined ml-2 text-sm">open_in_new</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            {/* Rejection / Feedback Modal */}
            <Modal
                isOpen={showRejectModal}
                onClose={() => setShowRejectModal(false)}
                title="Request Changes"
                size="md"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Describe what needs to be changed before this idea can be approved. This feedback will be sent back to the idea refining stage.
                    </p>
                    <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="e.g. The scope is too large, please reduce..."
                        className="w-full h-32 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none text-sm"
                        autoFocus
                    />
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setShowRejectModal(false)}>Cancel</Button>
                        <Button
                            variant="primary"
                            className="bg-amber-600 hover:bg-amber-700 text-white border-none"
                            onClick={() => {
                                if (onReject) {
                                    onReject(rejectionReason);
                                } else {
                                    // Default behavior
                                    onUpdate({
                                        stage: 'Refining', // or whatever "Changes Requested" map to
                                        lastRejectionReason: rejectionReason
                                    });
                                }
                                setShowRejectModal(false);
                                setRejectionReason('');
                            }}
                            disabled={!rejectionReason.trim()}
                        >
                            Send Feedback
                        </Button>
                    </div>
                </div>
            </Modal>
        </div >
    );
};
