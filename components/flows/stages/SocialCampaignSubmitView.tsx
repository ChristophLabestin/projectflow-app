import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { Modal } from '../../common/Modal/Modal';
import { Idea, SocialCampaign, ApprovalEvent, RiskWinAnalysis } from '../../../types';
import { getProjectMembers, getUserProfile, getSocialCampaign, updateCampaign } from '../../../services/dataService';
import { generateRiskWinAnalysis } from '../../../services/geminiService';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { useLanguage } from '../../../context/LanguageContext';

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
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [teamMembers, setTeamMembers] = useState<Array<{ id: string; displayName: string; photoURL?: string }>>([]);
    const [campaignHistory, setCampaignHistory] = useState<ApprovalEvent[]>([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [tempAssignedIds, setTempAssignedIds] = useState<string[]>([]);

    const [checklist, setChecklist] = useState({
        concept: { labelKey: 'flowStages.socialCampaignSubmit.checklist.concept', checked: false },
        strategy: { labelKey: 'flowStages.socialCampaignSubmit.checklist.strategy', checked: false },
        legal: { labelKey: 'flowStages.socialCampaignSubmit.checklist.legal', checked: false },
        brand: { labelKey: 'flowStages.socialCampaignSubmit.checklist.brand', checked: false },
    });

    useEffect(() => {
        const loadMembers = async () => {
            if (!idea.projectId) return;
            try {
                const memberIds = await getProjectMembers(idea.projectId, idea.tenantId || 'public');
                const profiles = await Promise.all(memberIds.map(uid => getUserProfile(uid)));
                setTeamMembers(profiles.filter(profile => profile !== null).map(profile => ({
                    id: profile.uid,
                    displayName: profile.displayName,
                    photoURL: profile.photoURL
                })));
            } catch (e) {
                console.error(e);
            }
        };
        const loadHistory = async () => {
            if (idea.convertedCampaignId && idea.projectId) {
                try {
                    const campaign = await getSocialCampaign(idea.projectId, idea.convertedCampaignId);
                    if (campaign?.approvalHistory) setCampaignHistory(campaign.approvalHistory);
                    if (campaign?.assignedUserIds && (!idea.assignedUserIds || idea.assignedUserIds.length === 0)) {
                        onUpdate({ assignedUserIds: campaign.assignedUserIds });
                    }
                } catch (e) {
                    console.error(e);
                }
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
        } catch (e) {
            console.error(e);
        } finally {
            setAnalyzing(false);
        }
    };

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
        try {
            return idea.concept && idea.concept.startsWith('{') ? JSON.parse(idea.concept) : {};
        } catch {
            return {};
        }
    }, [idea.concept]);

    const platforms = useMemo(() => Array.isArray(concept.platforms) ? concept.platforms : [], [concept]);
    const phases = useMemo(() => Array.isArray(concept.phases) ? concept.phases : [], [concept]);
    const kpis = useMemo(() => Array.isArray(concept.kpis) ? concept.kpis : [], [concept]);
    const isSubmitted = campaignStatus === 'PendingReview' || idea.stage === 'PendingReview';
    const isChangesRequested = campaignStatus === 'ChangesRequested';

    const allChecked = Object.values(checklist).every(item => item.checked);
    const progressPercent = Math.round((Object.values(checklist).filter(item => item.checked).length / Object.keys(checklist).length) * 100);

    const analysis = idea.riskWinAnalysis as RiskWinAnalysis | undefined;
    const latestFeedback = campaignHistory
        .filter(event => event.type === 'changes_requested' || event.type === 'rejection')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    const assignedMembers = teamMembers.filter(member => (idea.assignedUserIds || []).includes(member.id));

    const getScoreTone = (score: number) => {
        if (score >= 8) return 'high';
        if (score >= 5) return 'medium';
        return 'low';
    };

    const severityLabels: Record<string, string> = {
        High: t('flowStages.socialCampaignSubmit.analysis.severity.high'),
        Medium: t('flowStages.socialCampaignSubmit.analysis.severity.medium'),
        Low: t('flowStages.socialCampaignSubmit.analysis.severity.low'),
    };
    return (
        <div className="flow-social-campaign-submit">
            <div className="flow-social-campaign-submit__container">
                <div className="flow-social-campaign-submit__hero">
                    <div className="flow-social-campaign-submit__hero-glow">
                        <span className="material-symbols-outlined">rocket_launch</span>
                    </div>
                    <div className="flow-social-campaign-submit__hero-content">
                        <div className="flow-social-campaign-submit__badge">
                            {t('flowStages.socialCampaignSubmit.hero.badge')}
                        </div>
                        <h1 className="flow-social-campaign-submit__title">
                            {isSubmitted
                                ? t('flowStages.socialCampaignSubmit.hero.titleSubmitted')
                                : t('flowStages.socialCampaignSubmit.hero.title')}
                        </h1>
                        <div className="flow-social-campaign-submit__hero-summary">
                            <p>
                                {isSubmitted
                                    ? <>{t('flowStages.socialCampaignSubmit.hero.submittedPrefix')} <span>{t('flowStages.socialCampaignSubmit.hero.submittedEmphasis')}</span> {t('flowStages.socialCampaignSubmit.hero.submittedSuffix')}</>
                                    : <>{t('flowStages.socialCampaignSubmit.hero.reviewPrefix')} <span>{t('flowStages.socialCampaignSubmit.hero.reviewEmphasis')}</span> {t('flowStages.socialCampaignSubmit.hero.reviewSuffix')}</>}
                            </p>
                        </div>
                    </div>
                    <div className="flow-social-campaign-submit__hero-stats">
                        <div className="flow-social-campaign-submit__stat">
                            <strong>{platforms.length}</strong>
                            <span>{t('flowStages.socialCampaignSubmit.hero.stats.channels')}</span>
                        </div>
                        <div className="flow-social-campaign-submit__stat">
                            <strong>{phases.length}</strong>
                            <span>{t('flowStages.socialCampaignSubmit.hero.stats.phases')}</span>
                        </div>
                        <div className="flow-social-campaign-submit__stat">
                            <strong>{kpis.length}</strong>
                            <span>{t('flowStages.socialCampaignSubmit.hero.stats.kpis')}</span>
                        </div>
                    </div>
                </div>

                {isChangesRequested && latestFeedback && (
                    <Card className="flow-social-campaign-submit__feedback">
                        <div className="flow-social-campaign-submit__feedback-icon">
                            <span className="material-symbols-outlined">feedback</span>
                        </div>
                        <div>
                            <h3>{t('flowStages.socialCampaignSubmit.feedback.title')}</h3>
                            <p>"{latestFeedback.notes}"</p>
                        </div>
                    </Card>
                )}

                <div className="flow-social-campaign-submit__layout">
                    <div className="flow-social-campaign-submit__main">
                        <Card className="flow-social-campaign-submit__panel">
                            <div className="flow-social-campaign-submit__panel-header">
                                <div>
                                    <h3>{t('flowStages.socialCampaignSubmit.analysis.title')}</h3>
                                    <p>{t('flowStages.socialCampaignSubmit.analysis.subtitle')}</p>
                                </div>
                                {!isSubmitted && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleRunAnalysis}
                                        isLoading={analyzing}
                                        icon={<span className="material-symbols-outlined">refresh</span>}
                                    >
                                        {analyzing
                                            ? t('flowStages.socialCampaignSubmit.analysis.refreshing')
                                            : t('flowStages.socialCampaignSubmit.analysis.refresh')}
                                    </Button>
                                )}
                            </div>

                            {analysis ? (
                                <div className="flow-social-campaign-submit__analysis">
                                    <div className="flow-social-campaign-submit__metrics">
                                        <div className="flow-social-campaign-submit__metric" data-tone={getScoreTone(analysis.successProbability / 10)}>
                                            <span>{t('flowStages.socialCampaignSubmit.analysis.successProbability')}</span>
                                            <strong>{analysis.successProbability}%</strong>
                                            <div className="flow-social-campaign-submit__progress">
                                                <div style={{ width: `${analysis.successProbability}%` }} />
                                            </div>
                                        </div>
                                        <div className="flow-social-campaign-submit__metric" data-tone={getScoreTone(analysis.marketFitScore)}>
                                            <span>{t('flowStages.socialCampaignSubmit.analysis.marketFit')}</span>
                                            <strong>{analysis.marketFitScore} / 10</strong>
                                        </div>
                                        <div className="flow-social-campaign-submit__metric" data-tone={getScoreTone(analysis.technicalFeasibilityScore)}>
                                            <span>{t('flowStages.socialCampaignSubmit.analysis.feasibility')}</span>
                                            <strong>{analysis.technicalFeasibilityScore} / 10</strong>
                                        </div>
                                    </div>

                                    <div className="flow-social-campaign-submit__analysis-grid">
                                        <div>
                                            <h4>{t('flowStages.socialCampaignSubmit.analysis.risks')}</h4>
                                            <div className="flow-social-campaign-submit__list">
                                                {analysis.risks.map((risk, index) => (
                                                    <div key={index} className="flow-social-campaign-submit__list-item" data-level={risk.severity.toLowerCase()}>
                                                        <div>
                                                            <strong>{risk.title}</strong>
                                                            {risk.mitigation && <p>{risk.mitigation}</p>}
                                                        </div>
                                                        <span className="flow-social-campaign-submit__pill">
                                                            {severityLabels[risk.severity] || risk.severity}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <h4>{t('flowStages.socialCampaignSubmit.analysis.wins')}</h4>
                                            <div className="flow-social-campaign-submit__list">
                                                {analysis.wins.map((win, index) => (
                                                    <div key={index} className="flow-social-campaign-submit__list-item" data-level={win.impact.toLowerCase()}>
                                                        <div>
                                                            <strong>{win.title}</strong>
                                                        </div>
                                                        <span className="flow-social-campaign-submit__pill">
                                                            {t(`flowStages.socialCampaignSubmit.analysis.severity.${win.impact.toLowerCase()}`)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {analysis.recommendation && (
                                        <div className="flow-social-campaign-submit__recommendation">
                                            <span>{t('flowStages.socialCampaignSubmit.analysis.recommendation')}</span>
                                            <p>"{analysis.recommendation}"</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flow-social-campaign-submit__analysis-empty">
                                    <span className="material-symbols-outlined">query_stats</span>
                                    <h4>{t('flowStages.socialCampaignSubmit.analysis.empty.title')}</h4>
                                    <p>{t('flowStages.socialCampaignSubmit.analysis.empty.subtitle')}</p>
                                    <Button onClick={handleRunAnalysis} isLoading={analyzing}>
                                        {analyzing
                                            ? t('flowStages.socialCampaignSubmit.analysis.empty.loading')
                                            : t('flowStages.socialCampaignSubmit.analysis.empty.action')}
                                    </Button>
                                </div>
                            )}
                        </Card>

                        <Card className="flow-social-campaign-submit__panel">
                            <div className="flow-social-campaign-submit__panel-header">
                                <div>
                                    <h3>{t('flowStages.socialCampaignSubmit.manifesto.title')}</h3>
                                    <p>{t('flowStages.socialCampaignSubmit.manifesto.subtitle')}</p>
                                </div>
                            </div>
                            <div className="flow-social-campaign-submit__manifesto">
                                <p>"{concept.bigIdea || idea.title}"</p>
                                <div className="flow-social-campaign-submit__platforms">
                                    {platforms.map((platform: any) => (
                                        <div key={platform.id} className="flow-social-campaign-submit__platform">
                                            <PlatformIcon platform={platform.id} />
                                            <span>{platform.id}</span>
                                        </div>
                                    ))}
                                </div>
                                {concept.themes?.length > 0 && (
                                    <div className="flow-social-campaign-submit__themes">
                                        {concept.themes.map((theme: string, index: number) => (
                                            <span key={index}>#{theme}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                    <div className="flow-social-campaign-submit__sidebar">
                        <Card className="flow-social-campaign-submit__panel flow-social-campaign-submit__checklist">
                            <div className="flow-social-campaign-submit__panel-header">
                                <div>
                                    <h3>{t('flowStages.socialCampaignSubmit.checklist.title')}</h3>
                                    <p>{t('flowStages.socialCampaignSubmit.checklist.subtitle')}</p>
                                </div>
                                <div className="flow-social-campaign-submit__progress-label">
                                    <strong>{progressPercent}%</strong>
                                </div>
                            </div>

                            {!isSubmitted ? (
                                <>
                                    <div className="flow-social-campaign-submit__checklist-list">
                                        {Object.entries(checklist).map(([key, item]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                className={`flow-social-campaign-submit__check-item ${item.checked ? 'is-checked' : ''}`}
                                                onClick={() => setChecklist(prev => ({
                                                    ...prev,
                                                    [key]: { ...item, checked: !item.checked }
                                                }))}
                                                aria-pressed={item.checked}
                                            >
                                                <span className="flow-social-campaign-submit__check-icon">
                                                    {item.checked && <span className="material-symbols-outlined">check</span>}
                                                </span>
                                                <span>{t(item.labelKey)}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <Button
                                        onClick={onSubmit}
                                        disabled={!allChecked}
                                        className="flow-social-campaign-submit__submit"
                                        icon={<span className="material-symbols-outlined">rocket_launch</span>}
                                    >
                                        {allChecked
                                            ? t('flowStages.socialCampaignSubmit.checklist.submit')
                                            : t('flowStages.socialCampaignSubmit.checklist.submitLocked')}
                                    </Button>
                                </>
                            ) : (
                                <div className="flow-social-campaign-submit__locked">
                                    <span className="material-symbols-outlined">lock_clock</span>
                                    <h4>{t('flowStages.socialCampaignSubmit.locked.title')}</h4>
                                    <p>{t('flowStages.socialCampaignSubmit.locked.subtitle')}</p>
                                    <Button
                                        variant="secondary"
                                        onClick={() => navigate('/social')}
                                    >
                                        {t('flowStages.socialCampaignSubmit.locked.back')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={onRejectEntirely}
                                        className="flow-social-campaign-submit__retract"
                                        icon={<span className="material-symbols-outlined">undo</span>}
                                    >
                                        {t('flowStages.socialCampaignSubmit.locked.retract')}
                                    </Button>
                                </div>
                            )}
                        </Card>

                        <Card className="flow-social-campaign-submit__panel flow-social-campaign-submit__team">
                            <div className="flow-social-campaign-submit__panel-header">
                                <div>
                                    <h3>{t('flowStages.socialCampaignSubmit.team.title')}</h3>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleOpenTeamModal}
                                >
                                    {t('flowStages.socialCampaignSubmit.team.manage')}
                                </Button>
                            </div>
                            <div className="flow-social-campaign-submit__team-list">
                                {assignedMembers.length > 0 ? assignedMembers.map(member => (
                                    <div key={member.id} className="flow-social-campaign-submit__team-member">
                                        <div className="flow-social-campaign-submit__avatar">
                                            {member.photoURL ? (
                                                <img src={member.photoURL} alt={member.displayName} />
                                            ) : (
                                                <span>{member.displayName[0]}</span>
                                            )}
                                        </div>
                                        <span>{member.displayName}</span>
                                    </div>
                                )) : (
                                    <p className="flow-social-campaign-submit__empty">{t('flowStages.socialCampaignSubmit.team.empty')}</p>
                                )}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleOpenTeamModal}
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('flowStages.socialCampaignSubmit.team.add')}
                                </Button>
                            </div>
                        </Card>

                        <Card className="flow-social-campaign-submit__panel flow-social-campaign-submit__tokens">
                            <div className="flow-social-campaign-submit__panel-header">
                                <div>
                                    <h3>{t('flowStages.socialCampaignSubmit.aiResources.title')}</h3>
                                </div>
                                <span className="material-symbols-outlined">auto_awesome</span>
                            </div>
                            <div className="flow-social-campaign-submit__tokens-body">
                                <strong>{(idea.aiTokensUsed || 0).toLocaleString()}</strong>
                                <span>{t('flowStages.socialCampaignSubmit.aiResources.tokens')}</span>
                                <div className="flow-social-campaign-submit__progress">
                                    <div style={{ width: `${Math.min(((idea.aiTokensUsed || 0) / 50000) * 100, 100)}%` }} />
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isTeamModalOpen}
                onClose={() => setIsTeamModalOpen(false)}
                title={t('flowStages.socialCampaignSubmit.team.modal.title')}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsTeamModalOpen(false)}>{t('flowStages.socialCampaignSubmit.team.modal.cancel')}</Button>
                        <Button onClick={handleSaveTeam}>{t('flowStages.socialCampaignSubmit.team.modal.save')}</Button>
                    </>
                }
            >
                <div className="flow-social-campaign-submit__team-modal">
                    <p>{t('flowStages.socialCampaignSubmit.team.modal.subtitle')}</p>
                    <div className="flow-social-campaign-submit__team-options">
                        {teamMembers.map(member => {
                            const isSelected = tempAssignedIds.includes(member.id);
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    className={`flow-social-campaign-submit__team-option ${isSelected ? 'is-selected' : ''}`}
                                    onClick={() => handleToggleMember(member.id)}
                                >
                                    <span className="flow-social-campaign-submit__team-check">
                                        {isSelected && <span className="material-symbols-outlined">check</span>}
                                    </span>
                                    <div className="flow-social-campaign-submit__avatar">
                                        {member.photoURL ? (
                                            <img src={member.photoURL} alt={member.displayName} />
                                        ) : (
                                            <span>{member.displayName[0]}</span>
                                        )}
                                    </div>
                                    <span>{member.displayName}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </Modal>
        </div>
    );
};
