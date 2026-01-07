import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { Idea, SocialCampaign } from '../../../types';
import { getProjectMembers, getUserProfile, getSocialCampaign } from '../../../services/dataService';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { format } from 'date-fns';
import { dateLocale, dateFormat } from '../../../utils/activityHelpers';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialCampaignApprovedViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const SocialCampaignApprovedView: React.FC<SocialCampaignApprovedViewProps> = ({
    idea,
    onUpdate,
}) => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [teamMembers, setTeamMembers] = useState<Array<{ id: string; displayName: string; photoURL?: string }>>([]);
    const [linkedCampaign, setLinkedCampaign] = useState<SocialCampaign | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!idea.projectId) return;
            try {
                const memberIds = await getProjectMembers(idea.projectId, idea.tenantId || 'public');
                const profiles = await Promise.all(memberIds.map(uid => getUserProfile(uid)));
                setTeamMembers(profiles.filter(profile => profile !== null).map(profile => ({
                    id: profile.uid,
                    displayName: profile.displayName,
                    photoURL: profile.photoURL
                })));

                if (idea.convertedCampaignId) {
                    const campaign = await getSocialCampaign(idea.projectId, idea.convertedCampaignId);
                    if (campaign) setLinkedCampaign(campaign);
                }
            } catch (e) {
                console.error(e);
            }
        };
        loadData();
    }, [idea.projectId, idea.convertedCampaignId, idea.tenantId]);

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
    const audienceSegments = useMemo(() => Array.isArray(concept.audienceSegments) ? concept.audienceSegments : [], [concept]);

    const assignedMembers = teamMembers.filter(member => (idea.assignedUserIds || []).includes(member.id));
    const analysis = idea.riskWinAnalysis;

    const approvedDate = idea.approvedAt ? format(new Date(idea.approvedAt), dateFormat, { locale: dateLocale }) : null;
    const approvedSummaryTemplate = t('flowStages.socialCampaignApproved.hero.summary');
    const [approvedSummaryBefore, approvedSummaryAfter] = approvedSummaryTemplate.split('{title}');
    const approvedOn = approvedDate
        ? t('flowStages.socialCampaignApproved.hero.approvedOn').replace('{date}', approvedDate)
        : null;

    const getScoreTone = (score: number) => {
        if (score >= 8) return 'high';
        if (score >= 5) return 'medium';
        return 'low';
    };
    return (
        <div className="flow-social-campaign-approved">
            <div className="flow-social-campaign-approved__container">
                <div className="flow-social-campaign-approved__hero">
                    <div className="flow-social-campaign-approved__hero-glow">
                        <span className="material-symbols-outlined">verified</span>
                    </div>
                    <div className="flow-social-campaign-approved__hero-content">
                        <div className="flow-social-campaign-approved__badge">
                            <span className="material-symbols-outlined">check_circle</span>
                            {t('flowStages.socialCampaignApproved.hero.badge')}
                        </div>
                        <h1 className="flow-social-campaign-approved__title">{t('flowStages.socialCampaignApproved.hero.title')}</h1>
                        <div className="flow-social-campaign-approved__hero-summary">
                            <p>
                                {approvedSummaryBefore}
                                <span>"{concept.bigIdea || idea.title}"</span>
                                {approvedSummaryAfter}
                                {approvedOn && <em>{approvedOn}</em>}
                            </p>
                        </div>
                    </div>
                    <div className="flow-social-campaign-approved__hero-stats">
                        <div className="flow-social-campaign-approved__stat">
                            <strong>{platforms.length}</strong>
                            <span>{t('flowStages.socialCampaignApproved.hero.stats.channels')}</span>
                        </div>
                        <div className="flow-social-campaign-approved__stat">
                            <strong>{phases.length}</strong>
                            <span>{t('flowStages.socialCampaignApproved.hero.stats.phases')}</span>
                        </div>
                        <div className="flow-social-campaign-approved__stat">
                            <strong>{kpis.length}</strong>
                            <span>{t('flowStages.socialCampaignApproved.hero.stats.kpis')}</span>
                        </div>
                    </div>
                </div>

                <div className="flow-social-campaign-approved__layout">
                    <div className="flow-social-campaign-approved__main">
                        <Card className="flow-social-campaign-approved__panel">
                            <div className="flow-social-campaign-approved__panel-header">
                                <h3>{t('flowStages.socialCampaignApproved.manifesto.title')}</h3>
                                <p>{t('flowStages.socialCampaignApproved.manifesto.subtitle')}</p>
                            </div>
                            <div className="flow-social-campaign-approved__manifesto">
                                <p>"{concept.bigIdea || idea.title}"</p>
                                {concept.hook && <span>{concept.hook}</span>}
                                <div className="flow-social-campaign-approved__platforms">
                                    {platforms.map((platform: any) => (
                                        <div key={platform.id} className="flow-social-campaign-approved__platform">
                                            <PlatformIcon platform={platform.id} />
                                            <span>{platform.id}</span>
                                        </div>
                                    ))}
                                </div>
                                {concept.themes?.length > 0 && (
                                    <div className="flow-social-campaign-approved__themes">
                                        {concept.themes.map((theme: string, index: number) => (
                                            <span key={index}>#{theme}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>

                        {phases.length > 0 && (
                            <Card className="flow-social-campaign-approved__panel">
                                <div className="flow-social-campaign-approved__panel-header">
                                    <h3>{t('flowStages.socialCampaignApproved.phases.title')}</h3>
                                    <p>{t('flowStages.socialCampaignApproved.phases.subtitle')}</p>
                                </div>
                                <div className="flow-social-campaign-approved__phase-list">
                                    {phases.map((phase: any, index: number) => (
                                        <div key={index} className="flow-social-campaign-approved__phase">
                                            <div className="flow-social-campaign-approved__phase-index">{index + 1}</div>
                                            <div>
                                                <h4>{phase.name}</h4>
                                                {phase.description && <p>{phase.description}</p>}
                                                {(phase.startDate || phase.endDate) && (
                                                    <span>
                                                        <span className="material-symbols-outlined">calendar_month</span>
                                                        {phase.startDate && format(new Date(phase.startDate), 'MMM d', { locale: dateLocale })}
                                                        {phase.startDate && phase.endDate && ' - '}
                                                        {phase.endDate && format(new Date(phase.endDate), 'MMM d', { locale: dateLocale })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}

                        {kpis.length > 0 && (
                            <Card className="flow-social-campaign-approved__panel">
                                <div className="flow-social-campaign-approved__panel-header">
                                    <h3>{t('flowStages.socialCampaignApproved.kpis.title')}</h3>
                                    <p>{t('flowStages.socialCampaignApproved.kpis.subtitle')}</p>
                                </div>
                                <div className="flow-social-campaign-approved__kpis">
                                    {kpis.map((kpi: any, index: number) => (
                                        <div key={index} className="flow-social-campaign-approved__kpi">
                                            <div>
                                                <strong>{kpi.name}</strong>
                                                {kpi.description && <p>{kpi.description}</p>}
                                            </div>
                                            {kpi.target && (
                                                <span>{t('flowStages.socialCampaignApproved.kpis.target').replace('{target}', kpi.target)}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}

                        {analysis && (
                            <Card className="flow-social-campaign-approved__panel">
                                <div className="flow-social-campaign-approved__panel-header">
                                    <h3>{t('flowStages.socialCampaignApproved.analysis.title')}</h3>
                                    <p>{t('flowStages.socialCampaignApproved.analysis.subtitle')}</p>
                                </div>
                                <div className="flow-social-campaign-approved__analysis">
                                    <div className="flow-social-campaign-approved__metrics">
                                        <div className="flow-social-campaign-approved__metric" data-tone={getScoreTone(analysis.successProbability / 10)}>
                                            <span>{t('flowStages.socialCampaignApproved.analysis.successRate')}</span>
                                            <strong>{analysis.successProbability}%</strong>
                                        </div>
                                        <div className="flow-social-campaign-approved__metric" data-tone={getScoreTone(analysis.marketFitScore)}>
                                            <span>{t('flowStages.socialCampaignApproved.analysis.marketFit')}</span>
                                            <strong>{analysis.marketFitScore}/10</strong>
                                        </div>
                                        <div className="flow-social-campaign-approved__metric" data-tone={getScoreTone(analysis.technicalFeasibilityScore)}>
                                            <span>{t('flowStages.socialCampaignApproved.analysis.feasibility')}</span>
                                            <strong>{analysis.technicalFeasibilityScore}/10</strong>
                                        </div>
                                    </div>
                                    {analysis.recommendation && (
                                        <div className="flow-social-campaign-approved__recommendation">
                                            <span>{t('flowStages.socialCampaignApproved.analysis.recommendation')}</span>
                                            <p>"{analysis.recommendation}"</p>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )}
                    </div>

                    <div className="flow-social-campaign-approved__sidebar">
                        <Card className="flow-social-campaign-approved__panel flow-social-campaign-approved__status">
                            <div className="flow-social-campaign-approved__status-icon">
                                <span className="material-symbols-outlined">verified</span>
                            </div>
                            <h4>{t('flowStages.socialCampaignApproved.status.title')}</h4>
                            <p>{t('flowStages.socialCampaignApproved.status.subtitle')}</p>
                            {linkedCampaign && (
                                <Button
                                    onClick={() => navigate(`/project/${idea.projectId}/social/campaigns/${linkedCampaign.id}`)}
                                    icon={<span className="material-symbols-outlined">open_in_new</span>}
                                    iconPosition="right"
                                >
                                    {t('flowStages.socialCampaignApproved.status.viewDashboard')}
                                </Button>
                            )}
                        </Card>

                        <Card className="flow-social-campaign-approved__panel flow-social-campaign-approved__team">
                            <div className="flow-social-campaign-approved__panel-header">
                                <h3>{t('flowStages.socialCampaignApproved.team.title')}</h3>
                                <span>{t('flowStages.socialCampaignApproved.team.count').replace('{count}', `${assignedMembers.length}`)}</span>
                            </div>
                            <div className="flow-social-campaign-approved__team-list">
                                {assignedMembers.length > 0 ? assignedMembers.map(member => (
                                    <div key={member.id} className="flow-social-campaign-approved__team-member">
                                        <div className="flow-social-campaign-approved__avatar">
                                            {member.photoURL ? (
                                                <img src={member.photoURL} alt={member.displayName} />
                                            ) : (
                                                <span>{member.displayName[0]}</span>
                                            )}
                                        </div>
                                        <span>{member.displayName}</span>
                                    </div>
                                )) : (
                                    <p className="flow-social-campaign-approved__empty">{t('flowStages.socialCampaignApproved.team.empty')}</p>
                                )}
                            </div>
                        </Card>

                        {audienceSegments.length > 0 && (
                            <Card className="flow-social-campaign-approved__panel flow-social-campaign-approved__audience">
                                <div className="flow-social-campaign-approved__panel-header">
                                    <h3>{t('flowStages.socialCampaignApproved.audience.title')}</h3>
                                </div>
                                <div className="flow-social-campaign-approved__audience-list">
                                    {audienceSegments.map((segment: any, index: number) => (
                                        <div key={index} className="flow-social-campaign-approved__audience-item">
                                            <strong>{segment.name || segment}</strong>
                                            {segment.description && <p>{segment.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}

                        <Card className="flow-social-campaign-approved__panel flow-social-campaign-approved__tokens">
                            <div className="flow-social-campaign-approved__panel-header">
                                <h3>{t('flowStages.socialCampaignApproved.aiResources.title')}</h3>
                                <span className="material-symbols-outlined">auto_awesome</span>
                            </div>
                            <div className="flow-social-campaign-approved__tokens-body">
                                <strong>{(idea.aiTokensUsed || 0).toLocaleString()}</strong>
                                <span>{t('flowStages.socialCampaignApproved.aiResources.tokens')}</span>
                                <div className="flow-social-campaign-approved__progress">
                                    <div style={{ width: `${Math.min(((idea.aiTokensUsed || 0) / 50000) * 100, 100)}%` }} />
                                </div>
                            </div>
                        </Card>

                        <Card className="flow-social-campaign-approved__panel flow-social-campaign-approved__actions">
                            <h3>{t('flowStages.socialCampaignApproved.actions.title')}</h3>
                            <div className="flow-social-campaign-approved__actions-list">
                                <Button
                                    variant="secondary"
                                    onClick={() => navigate('/social')}
                                    icon={<span className="material-symbols-outlined">arrow_back</span>}
                                >
                                    {t('flowStages.socialCampaignApproved.actions.back')}
                                </Button>
                                {linkedCampaign && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => navigate(`/project/${idea.projectId}/social/campaigns/${linkedCampaign.id}/calendar`)}
                                        icon={<span className="material-symbols-outlined">calendar_month</span>}
                                    >
                                        {t('flowStages.socialCampaignApproved.actions.calendar')}
                                    </Button>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};
