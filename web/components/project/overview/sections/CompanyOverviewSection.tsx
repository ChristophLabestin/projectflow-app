import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { Badge } from '../../../common/Badge/Badge';
import type { Initiative, Milestone, Project, StartupTrackId, Task } from '../../../../types';
import { isCompanyProject, STARTUP_TRACK_DEFINITIONS } from '../../../../config/projectTemplates';
import {
    calculateCompanyLinkedProjectRollup,
    calculateStartupReadinessSnapshot,
    getStartupStageKey
} from '../../../../utils/startupProjects';
// Reuse the existing company/startup styles (class names project-overview__company-*).
import '../../../../src/styles/components/_project-overview.scss';

const STARTUP_STAGE_STEPPER: Array<NonNullable<NonNullable<Project['startupProfile']>['formationStatus']>> = [
    'idea', 'validating', 'preparing', 'filed', 'registered', 'operating'
];

const STARTUP_TRACK_DISPLAY_ORDER: StartupTrackId[] = [
    'validation', 'legal_formation', 'finance_accounting', 'compliance', 'product_delivery', 'marketing_sales', 'funding', 'operations'
];
const STARTUP_TRACK_DEFINITION_BY_ID = new Map(STARTUP_TRACK_DEFINITIONS.map((d) => [d.id, d]));

const parse = (value?: string) => (value ? new Date(value) : null);
const isOpen = (task: Task) => !task.legacyInitiativeRoot && !task.isCompleted && task.status !== 'Done';

export type CompanyOverviewSectionProps = {
    project: Project;
    tasks: Task[];
    milestones: Milestone[];
    initiatives: Initiative[];
    linkedCompanyProjects: Project[];
    dateFormat: string;
    dateLocale: Locale;
    statusLabels: Record<string, string>;
    priorityLabels: Record<string, string>;
    onEditBrief: () => void;
    t: (key: string, fallback?: string) => string;
};

export const CompanyOverviewSection: React.FC<CompanyOverviewSectionProps> = ({
    project,
    tasks,
    milestones,
    initiatives,
    linkedCompanyProjects,
    dateFormat,
    dateLocale,
    statusLabels,
    priorityLabels,
    onEditBrief,
    t
}) => {
    if (!isCompanyProject(project)) return null;
    const startupReadiness = calculateStartupReadinessSnapshot(project, tasks, milestones, initiatives);
    if (!startupReadiness) return null;

    const linkedProjectRollup = calculateCompanyLinkedProjectRollup(linkedCompanyProjects);
    const linkedPreview = linkedCompanyProjects.slice(0, 6);
    const projectStatusLabel = (status: string) => statusLabels[status] || t(`status.${status}`, status);

    const startupBriefingMissingItems = [
        !project.startupProfile?.targetCustomer?.trim() ? t('projectOverview.startup.briefing.field.targetCustomer') : '',
        !project.startupProfile?.businessModel ? t('projectOverview.startup.briefing.field.businessModel') : '',
        !project.startupProfile?.jurisdictionCountry?.trim() ? t('projectOverview.startup.briefing.field.jurisdiction') : '',
        project.startupProfile?.regulatedIndustryStatus !== 'yes' && project.startupProfile?.regulatedIndustryStatus !== 'no'
            ? t('projectOverview.startup.briefing.field.regulatoryRisk') : ''
    ].filter(Boolean);
    const showStartupBriefingPrompt = startupBriefingMissingItems.length > 0;

    const configuredTrackIds = project.startupProfile?.selectedTrackIds?.length
        ? project.startupProfile.selectedTrackIds
        : STARTUP_TRACK_DISPLAY_ORDER.filter((id) => id !== 'funding' && id !== 'compliance');
    const trackIds = STARTUP_TRACK_DISPLAY_ORDER.filter((id) =>
        configuredTrackIds.includes(id) || typeof startupReadiness.trackProgress?.[id] === 'number');
    const startupTrackSummaries = trackIds.map((trackId) => {
        const definition = STARTUP_TRACK_DEFINITION_BY_ID.get(trackId);
        const trackTasks = tasks.filter((task) => !task.legacyInitiativeRoot && task.templateTrack === trackId);
        const doneTrackTasks = trackTasks.filter((task) => task.isCompleted || task.status === 'Done');
        const readinessProgress = startupReadiness.trackProgress?.[trackId];
        const progressValue = typeof readinessProgress === 'number'
            ? readinessProgress
            : trackTasks.length > 0 ? Math.round((doneTrackTasks.length / trackTasks.length) * 100) : 0;
        return { id: trackId, icon: definition?.icon || 'track_changes', labelKey: definition?.labelKey || `startupTracks.${trackId}.label`, progress: progressValue };
    });

    const launchPercent = Math.round((startupReadiness.formationPercent + startupReadiness.financePercent + startupReadiness.marketingPercent + startupReadiness.compliancePercent) / 4);
    const readinessMetrics = [
        { id: 'formation', icon: 'flag', label: t('projectOverview.startup.formationReadiness'), value: startupReadiness.formationPercent },
        { id: 'finance', icon: 'account_balance_wallet', label: t('projectOverview.startup.financeReadiness'), value: startupReadiness.financePercent },
        { id: 'compliance', icon: 'verified_user', label: t('projectOverview.startup.complianceReadiness'), value: startupReadiness.compliancePercent },
        { id: 'market', icon: 'campaign', label: t('projectOverview.startup.marketReadiness'), value: startupReadiness.marketingPercent }
    ];
    const startupPhase = startupReadiness.phase || 'discover';
    const phaseMeta = {
        readinessTitle: t(`projectOverview.startup.phase.${startupPhase}.readinessTitle`),
        readinessSubtitle: t(`projectOverview.startup.phase.${startupPhase}.readinessSubtitle`),
        meterLabel: t(`projectOverview.startup.phase.${startupPhase}.meterLabel`).replace('{percent}', String(launchPercent))
    };

    const jurisdictionLabel = [project.startupProfile?.jurisdictionCountry, project.startupProfile?.jurisdictionRegion].filter(Boolean).join(' / ')
        || t('projectOverview.company.contextMissing');
    const sourceReviewDate = parse(project.startupProfile?.jurisdictionSourcesReviewedAt);
    const contextItems = [
        { id: 'stage', icon: 'psychiatry', label: t('projectOverview.startup.stage'), value: t(getStartupStageKey(startupReadiness.stage)) },
        { id: 'jurisdiction', icon: 'account_balance', label: t('projectOverview.startup.jurisdiction'), value: jurisdictionLabel },
        { id: 'customer', icon: 'groups', label: t('projectOverview.startup.targetCustomer'), value: project.startupProfile?.targetCustomer || t('projectOverview.company.contextMissing') },
        { id: 'sources', icon: 'event_available', label: t('projectOverview.startup.sourceReview'), value: sourceReviewDate ? format(sourceReviewDate, dateFormat, { locale: dateLocale }) : t('projectOverview.company.contextMissing') }
    ];

    const founderAction = startupReadiness.nextFounderAction || null;
    const founderActionDue = founderAction ? parse(founderAction.dueDate) : null;
    const founderActionMeta = founderAction
        ? founderActionDue ? format(founderActionDue, dateFormat, { locale: dateLocale })
            : (founderAction.status ? statusLabels[founderAction.status] || founderAction.status : priorityLabels[founderAction.priority || 'Medium'])
        : '';
    const primaryAction = showStartupBriefingPrompt
        ? { mode: 'briefing' as const, icon: 'edit_note', title: t('projectOverview.startup.action.briefingTitle'), meta: t('projectOverview.startup.action.briefingMeta').replace('{count}', String(startupBriefingMissingItems.length)), actionLabel: t('projectOverview.startup.briefing.action') }
        : founderAction
            ? { mode: 'task' as const, icon: founderAction.status === 'Blocked' ? 'block' : 'task_alt', title: founderAction.title, meta: founderActionMeta || t('projectOverview.startup.action.taskMeta'), actionLabel: t('projectOverview.startup.action.openTask') }
            : { mode: 'clear' as const, icon: 'check_circle', title: t('projectOverview.startup.noNextAction'), meta: t('projectOverview.startup.action.clearMeta'), actionLabel: t('projectOverview.startup.briefing.editAction') };

    const launchGateVariant = startupReadiness.launchGate === 'ready' ? 'success' : startupReadiness.launchGate === 'blocked' ? 'error' : 'warning';

    const renderActionCard = () => (
        <div className={`project-overview__company-card project-overview__company-action is-${primaryAction.mode}`}>
            <div className="project-overview__company-action-icon"><span className="material-symbols-outlined">{primaryAction.icon}</span></div>
            <div className="project-overview__company-action-copy">
                <span>{t('projectOverview.startup.nextFounderAction')}</span>
                <h2>{primaryAction.title}</h2>
                <p>{primaryAction.meta}</p>
            </div>
            {primaryAction.mode === 'task' && founderAction ? (
                <Link to={`/project/${project.id}/tasks/${founderAction.id}`} className="project-overview__company-action-button">
                    <span className="material-symbols-outlined">arrow_forward</span>{primaryAction.actionLabel}
                </Link>
            ) : (
                <button type="button" className="project-overview__company-action-button" onClick={onEditBrief}>
                    <span className="material-symbols-outlined">{primaryAction.mode === 'clear' ? 'fact_check' : 'edit_note'}</span>{primaryAction.actionLabel}
                </button>
            )}
        </div>
    );

    const renderReadinessCard = () => (
        <div className="project-overview__company-card project-overview__company-readiness">
            <div className="project-overview__company-readiness-header">
                <div><h2>{phaseMeta.readinessTitle}</h2><p>{phaseMeta.readinessSubtitle}</p></div>
                <div className="project-overview__company-readiness-header-actions">
                    <span className="project-overview__company-readiness-percent">{launchPercent}%</span>
                    <button type="button" className="project-overview__company-context-action-icon" onClick={onEditBrief} title={t('projectOverview.startup.briefing.manageChecklist')} aria-label={t('projectOverview.startup.briefing.manageChecklist')}>
                        <span className="material-symbols-outlined">checklist</span>
                    </button>
                </div>
            </div>
            <div className="project-overview__company-launch-meter">
                <div className="project-overview__company-launch-meter-label"><span>{phaseMeta.meterLabel}</span></div>
                <div className="project-overview__company-launch-meter-track"><i style={{ width: `${launchPercent}%` }} /></div>
            </div>
            <div className="project-overview__company-readiness-grid">
                {readinessMetrics.map((metric) => (
                    <div key={metric.id} className="project-overview__company-readiness-tile">
                        <div className="project-overview__company-readiness-tile-header">
                            <span className="material-symbols-outlined">{metric.icon}</span><strong>{metric.label}</strong><em>{metric.value}%</em>
                        </div>
                        <div className="project-overview__company-readiness-tile-track"><i style={{ width: `${metric.value}%` }} /></div>
                    </div>
                ))}
            </div>
            {startupTrackSummaries.length > 0 && (
                <div className="project-overview__company-readiness-grid">
                    {startupTrackSummaries.map((track) => (
                        <div key={track.id} className="project-overview__company-readiness-tile">
                            <div className="project-overview__company-readiness-tile-header">
                                <span className="material-symbols-outlined">{track.icon}</span><strong>{t(track.labelKey)}</strong><em>{track.progress}%</em>
                            </div>
                            <div className="project-overview__company-readiness-tile-track"><i style={{ width: `${track.progress}%` }} /></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderContextCard = () => (
        <div className="project-overview__company-card project-overview__company-context-card">
            <div className="project-overview__company-section-header">
                <h2><span className="material-symbols-outlined">domain</span>{t('projectOverview.company.contextTitle')}</h2>
                <button type="button" className="project-overview__company-context-action-icon" onClick={onEditBrief} title={t('projectOverview.startup.briefing.editAction')}>
                    <span className="material-symbols-outlined">edit</span>
                </button>
            </div>
            <div className="project-overview__company-context-list">
                {contextItems.map((item) => (
                    <div key={item.id} className="project-overview__company-context-item">
                        <span className="material-symbols-outlined">{item.icon}</span>
                        <div><small>{item.label}</small><strong>{item.value}</strong></div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderLinkedProjectsCard = () => (
        <div className="project-overview__company-card project-overview__company-linked">
            <div className="project-overview__company-section-header">
                <h2><span className="material-symbols-outlined">account_tree</span>{t('projectOverview.company.linkedProjectsTitle')}</h2>
                {linkedProjectRollup && (
                    <span className="project-overview__company-linked-badge">{t('projectOverview.company.linkedSummary').replace('{active}', String(linkedProjectRollup.activeCount)).replace('{risk}', String(linkedProjectRollup.atRiskCount))}</span>
                )}
            </div>
            {linkedProjectRollup && (
                <div className="project-overview__company-rollup">
                    <div className="project-overview__company-rollup-stat"><span>{t('projectOverview.company.rollup.total')}</span><strong>{linkedProjectRollup.total}</strong></div>
                    <div className="project-overview__company-rollup-stat"><span>{t('projectOverview.company.rollup.active')}</span><strong className="is-success">{linkedProjectRollup.activeCount}</strong></div>
                    <div className="project-overview__company-rollup-stat"><span>{t('projectOverview.company.rollup.progress')}</span><strong>{linkedProjectRollup.averageProgress}%</strong></div>
                    <div className="project-overview__company-rollup-stat"><span>{t('projectOverview.company.rollup.risk')}</span><strong className={linkedProjectRollup.atRiskCount > 0 ? 'is-danger' : ''}>{linkedProjectRollup.atRiskCount}</strong></div>
                </div>
            )}
            {linkedPreview.length > 0 ? (
                <div className="project-overview__company-linked-list">
                    {linkedPreview.map((linkedProject) => {
                        const linkedProgress = linkedProject.progress || 0;
                        return (
                            <Link key={linkedProject.id} to={`/project/${linkedProject.id}`} className="project-overview__company-linked-row">
                                <div className="project-overview__company-linked-row-main">
                                    <span className="project-overview__company-linked-icon material-symbols-outlined">folder</span>
                                    <div className="project-overview__company-linked-title-wrap">
                                        <span className="project-overview__company-linked-title">{linkedProject.title}</span>
                                        <small>{t(`projectCompanyRoles.${linkedProject.companyProjectRole || 'other'}`)}</small>
                                    </div>
                                </div>
                                <div className="project-overview__company-linked-row-meta">
                                    <Badge variant={linkedProject.status === 'Active' ? 'success' : linkedProject.status === 'In Testing' ? 'warning' : 'neutral'}>
                                        {projectStatusLabel(linkedProject.status)}
                                    </Badge>
                                    <div className="project-overview__company-linked-progress">
                                        <div className="project-overview__company-linked-progress-track"><i style={{ width: `${linkedProgress}%` }} /></div>
                                        <strong>{linkedProgress}%</strong>
                                    </div>
                                    <span className="material-symbols-outlined chevron">chevron_right</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="project-overview__company-linked-empty">
                    <span className="material-symbols-outlined">hub</span>
                    <strong>{t('projectOverview.company.emptyLinkedTitle')}</strong>
                    <p>{t('projectOverview.company.emptyLinkedDescription')}</p>
                </div>
            )}
        </div>
    );

    const currentIndex = STARTUP_STAGE_STEPPER.indexOf(startupReadiness.stage || 'idea');

    return (
        <section className="project-overview__company-command">
            <div className="project-overview__company-command-header-wrapper">
                <div className="project-overview__company-command-header">
                    <div className="project-overview__company-command-titles">
                        <span>{t('projectOverview.company.commandTitle')}</span>
                        <h2>{t('projectOverview.company.commandMeta').replace('{tracks}', String(startupTrackSummaries.length)).replace('{linked}', String(linkedCompanyProjects.length))}</h2>
                    </div>
                    {startupPhase !== 'operate' && (
                        <div className="project-overview__company-command-badge">
                            <Badge variant={launchGateVariant}>{t(`projectOverview.startup.launchGate.${startupReadiness.launchGate}`)}</Badge>
                        </div>
                    )}
                </div>
                <div className="project-overview__company-stage" role="list" aria-label={t('projectOverview.startup.stage')}>
                    {STARTUP_STAGE_STEPPER.map((stage, index) => {
                        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
                        return (
                            <div key={stage} role="listitem" aria-current={state === 'current' ? 'step' : undefined} className={`project-overview__company-stage-step is-${state}`}>
                                <span className="project-overview__company-stage-dot">
                                    {state === 'done' ? <span className="material-symbols-outlined">check</span> : index + 1}
                                </span>
                                <span className="project-overview__company-stage-label">{t(getStartupStageKey(stage))}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={`project-overview__company-dashboard is-phase-${startupPhase}`}>
                {startupPhase === 'operate' ? (
                    <>
                        <div className="project-overview__company-main-panel">{renderLinkedProjectsCard()}</div>
                        <div className="project-overview__company-side-panel">{renderReadinessCard()}{renderActionCard()}{renderContextCard()}</div>
                    </>
                ) : (
                    <>
                        <div className="project-overview__company-main-panel">{renderReadinessCard()}{renderActionCard()}</div>
                        <div className="project-overview__company-side-panel">{renderContextCard()}{linkedCompanyProjects.length > 0 && renderLinkedProjectsCard()}</div>
                    </>
                )}
            </div>
        </section>
    );
};
