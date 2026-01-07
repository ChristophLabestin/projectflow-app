import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Modal } from '../../common/Modal/Modal';
import { TextArea } from '../../common/Input/TextArea';
import { auth } from '../../../services/firebase';
import { AnalysisDashboard } from '../AnalysisDashboard';
import { generateRiskWinAnalysis } from '../../../services/geminiService';
import { InitiativeConversionModal } from '../InitiativeConversionModal';
import { useLanguage } from '../../../context/LanguageContext';

interface ApprovalViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
    onConvert: (startDate?: string, dueDate?: string) => void;
    onReject?: (reason: string) => void;
    onRejectEntirely?: () => void;
}

export const ApprovalView: React.FC<ApprovalViewProps> = ({ idea, onUpdate, onConvert, onReject, onRejectEntirely }) => {
    const navigate = useNavigate();
    const { t } = useLanguage();
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

    useEffect(() => {
        setChecklist({
            conceptClear: !!idea.concept && idea.concept.length > 50,
            feasibilityChecked: (idea.analysis?.weaknesses?.length || 0) > 0 || (idea.riskWinAnalysis !== undefined),
            resourcesAvailable: checklist.resourcesAvailable,
            timelineEstimated: checklist.timelineEstimated,
        });
    }, [idea]);

    const StatusBadge = () => {
        const status = isImplemented ? 'implemented' : isApproved ? 'approved' : 'review';
        const label = isImplemented
            ? t('flows.stage.implemented')
            : isApproved
                ? t('flows.stage.approved')
                : t('flows.stage.inReview');
        const icon = isImplemented ? 'rocket_launch' : isApproved ? 'verified' : 'pending_actions';

        return (
            <div className="flow-approval__status" data-status={status}>
                <span className="material-symbols-outlined">{icon}</span>
                <span>{label}</span>
            </div>
        );
    };

    const impactLabel = idea.impact ? t(`flowStages.approval.level.${idea.impact.toLowerCase()}`) : t('flowStages.approval.na');
    const effortLabel = idea.effort ? t(`flowStages.approval.level.${idea.effort.toLowerCase()}`) : t('flowStages.approval.na');
    const impactLevel = idea.impact ? idea.impact.toLowerCase() : 'none';
    const effortLevel = idea.effort ? idea.effort.toLowerCase() : 'none';

    return (
        <div className="flow-approval">
            <InitiativeConversionModal
                idea={idea}
                isOpen={showConvertModal}
                onClose={() => setShowConvertModal(false)}
                onConfirm={(start, end) => {
                    onConvert(start, end);
                    setShowConvertModal(false);
                }}
            />

            <div className="flow-approval__layout">
                <div className="flow-approval__main">
                    <div className="flow-approval__panel">
                        <div className="flow-approval__panel-header">
                            <div className="flow-approval__view-toggle">
                                <button
                                    type="button"
                                    className={`flow-approval__view-button ${viewMode === 'analysis' ? 'is-active' : ''}`}
                                    onClick={() => setViewMode('analysis')}
                                    aria-pressed={viewMode === 'analysis'}
                                >
                                    <span className="material-symbols-outlined">analytics</span>
                                    {t('flowStages.approval.views.analysis')}
                                </button>
                                <button
                                    type="button"
                                    className={`flow-approval__view-button ${viewMode === 'brief' ? 'is-active' : ''}`}
                                    onClick={() => setViewMode('brief')}
                                    aria-pressed={viewMode === 'brief'}
                                >
                                    <span className="material-symbols-outlined">description</span>
                                    {t('flowStages.approval.views.brief')}
                                </button>
                            </div>

                            <StatusBadge />
                        </div>

                        <div className="flow-approval__panel-body">
                            {viewMode === 'analysis' && (
                                <AnalysisDashboard
                                    analysis={idea.riskWinAnalysis}
                                    loading={analyzing}
                                    onRunAnalysis={handleRunAnalysis}
                                />
                            )}

                            {viewMode === 'brief' && (
                                <div className="flow-approval__brief">
                                    {idea.concept ? (
                                        <div
                                            className="prose flow-approval__brief-content"
                                            dangerouslySetInnerHTML={{ __html: idea.concept }}
                                        />
                                    ) : (
                                        <div className="flow-approval__brief-empty">
                                            <span className="material-symbols-outlined">draft</span>
                                            <p>{t('flowStages.approval.brief.empty')}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flow-approval__sidebar">
                    <div className="flow-approval__panel flow-approval__summary">
                        <h3 className="flow-approval__panel-title">{t('flowStages.approval.summary.title')}</h3>

                        <div className="flow-approval__metrics">
                            <div className="flow-approval__metric" data-kind="impact" data-level={impactLevel}>
                                <span className="flow-approval__metric-label">{t('flowStages.approval.summary.impact')}</span>
                                <span className="flow-approval__metric-value">{impactLabel}</span>
                            </div>
                            <div className="flow-approval__metric" data-kind="effort" data-level={effortLevel}>
                                <span className="flow-approval__metric-label">{t('flowStages.approval.summary.effort')}</span>
                                <span className="flow-approval__metric-value">{effortLabel}</span>
                            </div>
                        </div>

                        {(idea.analysis?.strengths?.length || 0) > 0 && (
                            <div className="flow-approval__strength">
                                <span className="flow-approval__strength-label">{t('flowStages.approval.summary.keyStrength')}</span>
                                <div className="flow-approval__strength-body">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    <span>"{idea.analysis!.strengths[0]}"</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flow-approval__panel flow-approval__decision">
                        <h3 className="flow-approval__panel-title">{t('flowStages.approval.decision.title')}</h3>

                        {!isApproved && (
                            <div className="flow-approval__checklist">
                                <button
                                    type="button"
                                    className={`flow-approval__checklist-item ${checklist.conceptClear ? 'is-checked' : ''}`}
                                    onClick={() => setChecklist({ ...checklist, conceptClear: !checklist.conceptClear })}
                                    aria-pressed={checklist.conceptClear}
                                >
                                    <span className="flow-approval__check-icon">
                                        <span className="material-symbols-outlined">check</span>
                                    </span>
                                    <span className="flow-approval__check-text">
                                        <span className="flow-approval__check-title">{t('flowStages.approval.checklist.concept.title')}</span>
                                        <span className="flow-approval__check-subtitle">{t('flowStages.approval.checklist.concept.subtitle')}</span>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={`flow-approval__checklist-item ${checklist.feasibilityChecked ? 'is-checked' : ''}`}
                                    onClick={() => setChecklist({ ...checklist, feasibilityChecked: !checklist.feasibilityChecked })}
                                    aria-pressed={checklist.feasibilityChecked}
                                >
                                    <span className="flow-approval__check-icon">
                                        <span className="material-symbols-outlined">check</span>
                                    </span>
                                    <span className="flow-approval__check-text">
                                        <span className="flow-approval__check-title">{t('flowStages.approval.checklist.risks.title')}</span>
                                        <span className="flow-approval__check-subtitle">{t('flowStages.approval.checklist.risks.subtitle')}</span>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={`flow-approval__checklist-item ${checklist.resourcesAvailable ? 'is-checked' : ''}`}
                                    onClick={() => setChecklist({ ...checklist, resourcesAvailable: !checklist.resourcesAvailable })}
                                    aria-pressed={checklist.resourcesAvailable}
                                >
                                    <span className="flow-approval__check-icon">
                                        <span className="material-symbols-outlined">check</span>
                                    </span>
                                    <span className="flow-approval__check-text">
                                        <span className="flow-approval__check-title">{t('flowStages.approval.checklist.resources.title')}</span>
                                        <span className="flow-approval__check-subtitle">{t('flowStages.approval.checklist.resources.subtitle')}</span>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={`flow-approval__checklist-item ${checklist.timelineEstimated ? 'is-checked' : ''}`}
                                    onClick={() => setChecklist({ ...checklist, timelineEstimated: !checklist.timelineEstimated })}
                                    aria-pressed={checklist.timelineEstimated}
                                >
                                    <span className="flow-approval__check-icon">
                                        <span className="material-symbols-outlined">check</span>
                                    </span>
                                    <span className="flow-approval__check-text">
                                        <span className="flow-approval__check-title">{t('flowStages.approval.checklist.timeline.title')}</span>
                                        <span className="flow-approval__check-subtitle">{t('flowStages.approval.checklist.timeline.subtitle')}</span>
                                    </span>
                                </button>
                            </div>
                        )}

                        {isApproved && (
                            <div className="flow-approval__notice">
                                <div className="flow-approval__notice-icon">
                                    <span className="material-symbols-outlined">thumb_up</span>
                                </div>
                                <div>
                                    <p className="flow-approval__notice-title">{t('flowStages.approval.approved.title')}</p>
                                    <p className="flow-approval__notice-subtitle">{t('flowStages.approval.approved.subtitle')}</p>
                                </div>
                            </div>
                        )}

                        <div className="flow-approval__actions">
                            {!isApproved && (
                                <div className="flow-approval__action-stack">
                                    <Button
                                        size="lg"
                                        variant="secondary"
                                        className="flow-approval__button"
                                        onClick={() => navigate(`/project/${idea.projectId}/flows`)}
                                    >
                                        {t('flowStages.approval.actions.decideLater')}
                                    </Button>

                                    <div className="flow-approval__action-row">
                                        <Button
                                            size="lg"
                                            variant="secondary"
                                            className="flow-approval__button flow-approval__button--danger"
                                            onClick={() => onRejectEntirely ? onRejectEntirely() : onUpdate({ stage: 'Rejected' })}
                                        >
                                            {t('flowStages.approval.actions.reject')}
                                        </Button>
                                        <Button
                                            size="lg"
                                            variant="secondary"
                                            className="flow-approval__button flow-approval__button--warning"
                                            onClick={() => setShowRejectModal(true)}
                                        >
                                            {t('flowStages.approval.actions.requestChanges')}
                                        </Button>
                                    </div>

                                    <Button
                                        size="lg"
                                        className="flow-approval__approve"
                                        disabled={!canApprove}
                                        onClick={handleApprove}
                                        icon={<span className="material-symbols-outlined">check_circle</span>}
                                    >
                                        {t('flowStages.approval.actions.approve')}
                                    </Button>
                                </div>
                            )}

                            {isApproved && !isImplemented && (
                                <Button
                                    size="lg"
                                    className="flow-approval__convert"
                                    onClick={() => setShowConvertModal(true)}
                                    icon={<span className="material-symbols-outlined">arrow_forward</span>}
                                    iconPosition="right"
                                >
                                    {t('flowStages.approval.actions.convert')}
                                </Button>
                            )}

                            {isImplemented && (
                                <Button
                                    size="lg"
                                    variant="secondary"
                                    className="flow-approval__button"
                                    onClick={() => window.open(`/project/${idea.projectId}/tasks/${idea.convertedTaskId}`, '_blank')}
                                    icon={<span className="material-symbols-outlined">open_in_new</span>}
                                    iconPosition="right"
                                >
                                    {t('flowStages.approval.actions.viewInitiative')}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={showRejectModal}
                onClose={() => setShowRejectModal(false)}
                title={t('flowStages.approval.feedback.title')}
                size="md"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowRejectModal(false)}>{t('common.cancel')}</Button>
                        <Button
                            variant="primary"
                            className="flow-approval__feedback-submit"
                            onClick={() => {
                                if (onReject) {
                                    onReject(rejectionReason);
                                } else {
                                    onUpdate({
                                        stage: 'Refining',
                                        lastRejectionReason: rejectionReason
                                    });
                                }
                                setShowRejectModal(false);
                                setRejectionReason('');
                            }}
                            disabled={!rejectionReason.trim()}
                        >
                            {t('flowStages.approval.feedback.send')}
                        </Button>
                    </>
                }
            >
                <div className="flow-approval__feedback">
                    <p>{t('flowStages.approval.feedback.description')}</p>
                    <TextArea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder={t('flowStages.approval.feedback.placeholder')}
                        className="flow-approval__feedback-field"
                        autoFocus
                    />
                </div>
            </Modal>
        </div>
    );
};
