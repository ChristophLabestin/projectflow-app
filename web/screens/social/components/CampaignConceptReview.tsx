import React, { useMemo, useState } from 'react';
import { SocialCampaign } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Textarea } from '../../../components/ui/Textarea';
import { PlatformIcon } from './PlatformIcon';
import { useLanguage } from '../../../context/LanguageContext';

interface CampaignConceptReviewProps {
    campaign: SocialCampaign;
    onApprove: () => void;
    onReject: (reason?: string) => void;
    onRejectEntirely: () => void;
}

/**
 * Lightweight concept-review surface for a SocialCampaign in `Concept` status.
 * Reads the concept fields (bigIdea, hook, visualDirection, mood, phases, kpis,
 * risks, wins, analysis) directly off the campaign and exposes
 * Approve / Request Changes / Reject actions that transition the campaign.
 */
export const CampaignConceptReview: React.FC<CampaignConceptReviewProps> = ({
    campaign,
    onApprove,
    onReject,
    onRejectEntirely
}) => {
    const { t } = useLanguage();
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectType, setRejectType] = useState<'changes' | 'permanent'>('changes');
    const [rejectionReason, setRejectionReason] = useState('');

    const phases = useMemo(() => campaign.phases || [], [campaign.phases]);
    const platforms = useMemo(() => campaign.platforms || [], [campaign.platforms]);
    const score = campaign.analysis?.successProbability || 0;
    const wins = campaign.wins || [];

    const rejectModalTitle = rejectType === 'changes'
        ? t('social.review.rejectModal.requestTitle')
        : t('social.review.rejectModal.rejectTitle');
    const rejectModalDescription = rejectType === 'changes'
        ? t('social.review.rejectModal.requestDescription')
        : t('social.review.rejectModal.rejectDescription');
    const rejectSubmitLabel = rejectType === 'changes'
        ? t('social.review.rejectModal.sendRequest')
        : t('social.review.rejectModal.confirmReject');

    const handleSubmitReject = () => {
        if (rejectType === 'changes') onReject(rejectionReason);
        if (rejectType === 'permanent') onRejectEntirely();
        setShowRejectModal(false);
        setRejectionReason('');
    };

    return (
        <div className="min-h-full w-full pb-28">
            <div className="max-w-5xl mx-auto px-6 pt-6 space-y-6">
                {/* Hero */}
                <div className="bg-card border border-surface rounded-2xl p-6">
                    <div className="inline-flex items-center gap-2 mb-3">
                        <span className="size-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                            {t('flowStages.socialCampaignReview.hero.status.draft')}
                        </span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-main">{campaign.name}</h1>
                    {campaign.description && (
                        <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-3">{campaign.description}</p>
                    )}
                    {campaign.lastRejectionReason && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                            <span className="font-bold uppercase tracking-wider mr-2">
                                {t('social.review.actions.requestChanges')}
                            </span>
                            {campaign.lastRejectionReason}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Strategy DNA */}
                    <div className="lg:col-span-2 bg-card border border-surface rounded-2xl p-6 space-y-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted">
                            {t('social.review.strategyIntent')}
                        </div>
                        <div className="space-y-2">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                {t('social.review.coreFlow')}
                            </div>
                            <h2 className="text-xl md:text-2xl font-bold text-main">
                                "{campaign.bigIdea || campaign.description || t('social.review.coreFlowFallback')}"
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-surface">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                                    {t('social.review.hookLabel')}
                                </div>
                                <p className="text-sm font-medium italic text-main leading-relaxed">
                                    "{campaign.hook || t('social.review.hookFallback')}"
                                </p>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                                        {t('social.review.visualDirection')}
                                    </div>
                                    <p className="text-sm text-muted leading-relaxed">
                                        {campaign.visualDirection || t('social.review.visualDirectionFallback')}
                                    </p>
                                </div>
                                {campaign.mood && (
                                    <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-hover border border-surface text-muted">
                                        {campaign.mood}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="pt-4 border-t border-surface">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                                {t('social.review.stats.platforms')}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {platforms.length ? platforms.map((p) => (
                                    <div key={p} className="size-9 rounded-xl bg-surface border border-surface flex items-center justify-center">
                                        <div className="size-5"><PlatformIcon platform={p} /></div>
                                    </div>
                                )) : (
                                    <span className="text-xs text-muted">{t('social.review.noPlatforms')}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Intelligence */}
                    <div className="bg-card border border-surface rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="text-xs font-bold uppercase tracking-wider text-muted">
                                {t('flowStages.socialCampaignReview.intelligence.title')}
                            </div>
                            <span className="material-symbols-outlined text-primary">psychology</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative size-20 shrink-0">
                                <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                                    <circle className="text-[var(--color-surface-border)] stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent" />
                                    <circle
                                        className="text-success stroke-current transition-all duration-700"
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
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-base font-bold text-main">{score}%</span>
                                </div>
                            </div>
                            <div className="text-xs text-muted">
                                {t('flowStages.socialCampaignReview.intelligence.successLabel')}
                            </div>
                        </div>
                        {wins.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-surface">
                                {wins.slice(0, 3).map((win, index) => (
                                    <div key={index} className="flex items-center gap-2 text-xs text-main">
                                        <span className="material-symbols-outlined text-success text-[16px]">trending_up</span>
                                        {win.title}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Timeline */}
                <div className="bg-card border border-surface rounded-2xl p-6 space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted">
                        {t('flowStages.socialCampaignReview.timeline.title')}
                    </div>
                    {phases.length ? (
                        <div className="space-y-3">
                            {phases.map((phase, index) => (
                                <div key={phase.id || index} className="grid grid-cols-[3rem_1fr] gap-4 items-start">
                                    <div className="size-11 rounded-2xl bg-primary text-white text-sm font-bold flex items-center justify-center shadow-sm">
                                        {index + 1}
                                    </div>
                                    <div className="rounded-2xl border border-surface bg-surface p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <h4 className="text-base font-bold text-main">{phase.name}</h4>
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-surface bg-card text-muted">
                                                {phase.durationValue} {phase.durationUnit}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-muted leading-relaxed">{phase.focus}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-muted bg-surface border border-dashed border-surface rounded-lg p-4 text-center">
                            {t('social.review.noPhases')}
                        </div>
                    )}
                </div>

                {/* Risks */}
                {campaign.risks && campaign.risks.length > 0 && (
                    <div className="bg-card border border-surface rounded-2xl p-6 space-y-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted">
                            {t('social.review.riskMitigation')}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {campaign.risks.slice(0, 4).map((risk, i) => (
                                <div key={i} className="rounded-xl border border-surface bg-surface p-4">
                                    <div className="flex items-start gap-3 mb-3">
                                        <span className="material-symbols-outlined text-warning text-lg">warning</span>
                                        <div className="text-sm font-semibold text-main leading-tight">{risk.title}</div>
                                    </div>
                                    <div className="rounded-lg border border-surface bg-card p-3">
                                        <p className="text-xs text-muted leading-relaxed">
                                            <span className="font-bold text-success uppercase text-[10px] mr-2">
                                                {t('social.review.mitigationLabel')}
                                            </span>
                                            {risk.mitigation || t('social.review.noMitigation')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* KPIs */}
                {campaign.kpis && campaign.kpis.length > 0 && (
                    <div className="bg-card border border-surface rounded-2xl p-6 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                            <span className="material-symbols-outlined text-[16px]">monitoring</span>
                            {t('social.review.successMetrics')}
                        </div>
                        <div className="space-y-2">
                            {campaign.kpis.map((kpi, index) => (
                                <div
                                    key={kpi.id || `${kpi.metric}-${index}`}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-surface bg-surface px-3 py-2 text-sm"
                                >
                                    <span className="font-medium text-main">{kpi.metric || t('social.review.metricFallback')}</span>
                                    {kpi.target ? (
                                        <span className="text-xs font-semibold text-muted">{kpi.target}</span>
                                    ) : (
                                        <span className="text-xs text-subtle">{t('social.review.targetTbd')}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Action Dock */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                <div className="flex items-center gap-2 bg-card border border-surface shadow-lg rounded-full p-2 pl-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted hidden sm:block">
                        {t('social.review.actions.label')}
                    </span>
                    <div className="h-4 w-px bg-surface-border hidden sm:block" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-error hover:text-error hover:bg-red-50"
                        onClick={() => {
                            setRejectType('permanent');
                            setShowRejectModal(true);
                        }}
                    >
                        {t('social.review.actions.reject')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-warning hover:text-warning hover:bg-amber-50"
                        onClick={() => {
                            setRejectType('changes');
                            setShowRejectModal(true);
                        }}
                    >
                        {t('social.review.actions.requestChanges')}
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        className="rounded-full group hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-xl hover:shadow-emerald-500/30"
                        onClick={onApprove}
                        icon={<span className="material-symbols-outlined text-[18px]">rocket_launch</span>}
                    >
                        {t('social.review.actions.approve')}
                    </Button>
                </div>
            </div>

            <Modal
                isOpen={showRejectModal}
                onClose={() => setShowRejectModal(false)}
                title={rejectModalTitle}
                size="md"
            >
                <div className="space-y-6">
                    <div className="bg-surface border border-surface p-4 rounded-lg">
                        <p className="text-sm text-muted">{rejectModalDescription}</p>
                    </div>
                    <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder={t('social.review.rejectModal.placeholder')}
                        className="min-h-[140px] resize-none"
                        autoFocus
                    />
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
                            {t('social.review.rejectModal.cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            className={rejectType === 'changes'
                                ? 'bg-[var(--color-warning)] text-white hover:opacity-90'
                                : 'bg-[var(--color-error)] text-white hover:opacity-90'}
                            onClick={handleSubmitReject}
                            disabled={rejectType === 'changes' && !rejectionReason.trim()}
                        >
                            {rejectSubmitLabel}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
