import React, { useMemo, useState } from 'react';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { Modal } from '../../common/Modal/Modal';
import { TextArea } from '../../common/Input/TextArea';
import { Idea, SocialCampaign } from '../../../types';
import { generateRiskWinAnalysis } from '../../../services/geminiService';
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

const TIMELINE_TONES = ['primary', 'warning', 'success', 'neutral', 'danger'] as const;

const getTimelineTone = (index: number) => TIMELINE_TONES[index % TIMELINE_TONES.length];

const ReviewHero: React.FC<{ idea: Idea; viewMode: string }> = ({ idea, viewMode }) => {
    const { t } = useLanguage();
    const statusLabel = viewMode === 'approved'
        ? t('flowStages.socialCampaignReview.hero.status.active')
        : viewMode === 'reviewer-pending'
            ? t('flowStages.socialCampaignReview.hero.status.ready')
            : t('flowStages.socialCampaignReview.hero.status.draft');

    return (
        <Card className="flow-social-campaign-review__hero">
            <div className="flow-social-campaign-review__hero-content">
                <div className="flow-social-campaign-review__status" data-status={viewMode}>
                    <span className="flow-social-campaign-review__status-dot" data-status={viewMode} />
                    <span className="flow-social-campaign-review__status-text">{statusLabel}</span>
                </div>
                <h1 className="flow-social-campaign-review__title">{idea.title}</h1>
                {idea.description && (
                    <p className="flow-social-campaign-review__description">{idea.description}</p>
                )}
            </div>
        </Card>
    );
};

const StrategyTimeline: React.FC<{ phases: any[] }> = ({ phases }) => {
    const { t } = useLanguage();
    return (
        <Card className="flow-social-campaign-review__timeline">
            <div className="flow-social-campaign-review__timeline-header">
                <h3>{t('flowStages.socialCampaignReview.timeline.title')}</h3>
            </div>
            <div className="flow-social-campaign-review__timeline-list">
                {phases.map((phase, index) => {
                    const tone = getTimelineTone(index);
                    return (
                        <div key={phase.id || index} className="flow-social-campaign-review__timeline-item" data-tone={tone}>
                            <div className="flow-social-campaign-review__timeline-index">{index + 1}</div>
                            <div className="flow-social-campaign-review__timeline-body">
                                <div className="flow-social-campaign-review__timeline-row">
                                    <h4>{phase.name}</h4>
                                    <span className="flow-social-campaign-review__timeline-duration">
                                        {phase.durationValue} {phase.durationUnit}
                                    </span>
                                </div>
                                <p>{phase.focus}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

const IntelligenceCard: React.FC<{ idea: Idea; onAnalyze: () => void; analyzing: boolean }> = ({
    idea,
    onAnalyze,
    analyzing
}) => {
    const { t } = useLanguage();
    const score = idea.riskWinAnalysis?.successProbability || 0;

    return (
        <Card className="flow-social-campaign-review__intelligence">
            <div className="flow-social-campaign-review__intelligence-header">
                <div>
                    <span className="flow-social-campaign-review__eyebrow">
                        {t('flowStages.socialCampaignReview.intelligence.title')}
                    </span>
                    <p className="flow-social-campaign-review__subtext">
                        {t('flowStages.socialCampaignReview.intelligence.subtitle')}
                    </p>
                </div>
                <span className="material-symbols-outlined flow-social-campaign-review__intelligence-icon">psychology</span>
            </div>

            <div className="flow-social-campaign-review__score">
                <div className="flow-social-campaign-review__score-ring">
                    <svg viewBox="0 0 100 100">
                        <circle
                            className="flow-social-campaign-review__ring-base"
                            strokeWidth="8"
                            cx="50"
                            cy="50"
                            r="40"
                            fill="transparent"
                        />
                        <circle
                            className={`flow-social-campaign-review__ring-progress ${score > 0 ? 'is-visible' : ''}`}
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
                    <div className="flow-social-campaign-review__score-label">
                        <strong>{score}%</strong>
                        <span>{t('flowStages.socialCampaignReview.intelligence.successLabel')}</span>
                    </div>
                </div>
            </div>

            <div className="flow-social-campaign-review__intelligence-footer">
                {idea.riskWinAnalysis ? (
                    <div className="flow-social-campaign-review__win-list">
                        {idea.riskWinAnalysis.wins.slice(0, 2).map((win, index) => (
                            <div key={index} className="flow-social-campaign-review__win">
                                <span className="material-symbols-outlined">trending_up</span>
                                {win.title}
                            </div>
                        ))}
                    </div>
                ) : (
                    <Button
                        onClick={onAnalyze}
                        disabled={analyzing}
                        size="lg"
                        className="flow-social-campaign-review__analyze"
                    >
                        {analyzing
                            ? t('flowStages.socialCampaignReview.intelligence.processing')
                            : t('flowStages.socialCampaignReview.intelligence.run')}
                    </Button>
                )}
            </div>
        </Card>
    );
};

const ActionDock: React.FC<{
    onApprove: () => void;
    onReject: () => void;
    onRequestChanges: () => void;
}> = ({ onApprove, onReject, onRequestChanges }) => {
    const { t } = useLanguage();
    return (
        <div className="flow-social-campaign-review__dock">
            <div className="flow-social-campaign-review__dock-label">
                {t('flowStages.socialCampaignReview.actions.label')}
            </div>
            <div className="flow-social-campaign-review__dock-divider" />
            <div className="flow-social-campaign-review__dock-actions">
                <Button
                    size="sm"
                    variant="ghost"
                    className="flow-social-campaign-review__dock-button"
                    onClick={onReject}
                >
                    {t('flowStages.socialCampaignReview.actions.reject')}
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    className="flow-social-campaign-review__dock-button"
                    onClick={onRequestChanges}
                >
                    {t('flowStages.socialCampaignReview.actions.requestChanges')}
                </Button>
                <Button
                    size="sm"
                    className="flow-social-campaign-review__dock-button"
                    onClick={onApprove}
                >
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
        try {
            return idea.concept && idea.concept.startsWith('{') ? JSON.parse(idea.concept) : {};
        } catch {
            return {};
        }
    }, [idea.concept]);

    const phases = useMemo(() => (Array.isArray(concept.phases) ? concept.phases : []), [concept]);

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

    const rejectModalTitle = rejectType === 'changes'
        ? t('flowStages.socialCampaignReview.rejectModal.requestTitle')
        : t('flowStages.socialCampaignReview.rejectModal.abortTitle');
    const rejectModalDescription = rejectType === 'changes'
        ? t('flowStages.socialCampaignReview.rejectModal.requestDescription')
        : t('flowStages.socialCampaignReview.rejectModal.abortDescription');
    const rejectSubmitLabel = rejectType === 'changes'
        ? t('flowStages.socialCampaignReview.rejectModal.submitChanges')
        : t('flowStages.socialCampaignReview.rejectModal.submitAbort');

    const modalFooter = (
        <>
            <Button variant="ghost" onClick={() => setShowRejectModal(false)}>
                {t('flowStages.socialCampaignReview.rejectModal.cancel')}
            </Button>
            <Button
                variant={rejectType === 'changes' ? 'secondary' : 'danger'}
                onClick={() => {
                    if (rejectType === 'changes' && onReject) onReject(rejectionReason);
                    if (rejectType === 'permanent' && onPermanentReject) onPermanentReject(rejectionReason);
                    setShowRejectModal(false);
                    setRejectionReason('');
                }}
                disabled={!rejectionReason.trim()}
            >
                {rejectSubmitLabel}
            </Button>
        </>
    );

    return (
        <div className="flow-social-campaign-review">
            <div className="flow-social-campaign-review__container">
                <ReviewHero idea={idea} viewMode={viewMode} />

                <div className="flow-social-campaign-review__grid">
                    <StrategyTimeline phases={phases} />
                    <IntelligenceCard idea={idea} onAnalyze={handleRunAnalysis} analyzing={analyzing} />

                    <Card className="flow-social-campaign-review__dna">
                        <div className="flow-social-campaign-review__dna-grid">
                            <div className="flow-social-campaign-review__dna-block">
                                <h4>{t('flowStages.socialCampaignReview.dna.hookTitle')}</h4>
                                <p>"{concept.hook || t('flowStages.socialCampaignReview.dna.hookEmpty')}"</p>
                            </div>
                            <div className="flow-social-campaign-review__dna-block">
                                <h4>{t('flowStages.socialCampaignReview.dna.visualTitle')}</h4>
                                <p>{concept.visualDirection || t('flowStages.socialCampaignReview.dna.visualEmpty')}</p>
                            </div>
                            <div className="flow-social-campaign-review__dna-block">
                                <h4>{t('flowStages.socialCampaignReview.dna.platformsTitle')}</h4>
                                <div className="flow-social-campaign-review__platforms">
                                    {(concept.platforms || []).map((platform: any) => (
                                        <div key={platform.id} className="flow-social-campaign-review__platform">
                                            <PlatformIcon platform={platform.id} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

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

            <Modal
                isOpen={showRejectModal}
                onClose={() => setShowRejectModal(false)}
                title={rejectModalTitle}
                size="md"
                footer={modalFooter}
            >
                <div className="flow-social-campaign-review__reject-body">
                    <p>{rejectModalDescription}</p>
                    <TextArea
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        placeholder={t('flowStages.socialCampaignReview.rejectModal.placeholder')}
                        className="flow-social-campaign-review__reject-input"
                        autoFocus
                    />
                </div>
            </Modal>
        </div>
    );
};
