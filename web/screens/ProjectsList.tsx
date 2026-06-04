import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
    getAllWorkspaceProjects,
    getProjectActivity,
    getProjectInitiatives,
    getProjectOverviewTemplates,
    getProjectTasks,
    saveProjectOverviewTemplate,
    deleteProjectOverviewTemplate,
    updateProjectFields,
    resetWorkspaceOverviewLayoutsToDefault,
    createProject,
    setWorkspaceFocusProject,
} from '../services/dataService';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Project, Member, Task, Milestone, Activity, Sprint, ProjectOverviewLayout, ProjectOverviewTemplate, ProjectOverviewTemplateVariant, ProjectModule, Initiative } from '../types';
import { Button } from '../components/common/Button/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/common/Badge/Badge';
import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import {
    calculateSpotlightScore,
    SpotlightReason,
    calculateProjectHealth,
    HealthStatus,
    ProjectHealth,
    isProjectExcludedFromHealth
} from '../services/healthService';
import { useAuth } from '../context/AuthContext';
import { Tenant } from '../types';
import { Modal } from '../components/common/Modal/Modal';
import { Select, type SelectOption } from '../components/common/Select/Select';
import { useConfirm, useToast, useUIState } from '../context/UIContext';
import { downloadFile } from '../utils/download';
import { ensureActiveTenantId, getActiveTenantId } from '../services/domain/authService';
import { getProjectMembers, getSharedProjects, getUserProjects, hydrateProjectAssets } from '../services/domain/projectsService';
import { getTenant } from '../services/domain/workspaceService';
import { getUserProfile } from '../services/domain/usersService';
import { isCompanyProject } from '../config/projectTemplates';
import { calculateCompanyLinkedProjectRollup } from '../utils/startupProjects';
import './projects-list.scss';

// --- Types ---
export type ProjectMetrics = {
    taskCount: number;
    taskCompleted: number;
};

type ProjectHealthInputs = {
    tasks: Task[];
    activity: Activity[];
    milestones: Milestone[];
    sprints: Sprint[];
    initiatives: Initiative[];
};

const EMPTY_PROJECT_HEALTH_INPUTS: ProjectHealthInputs = {
    tasks: [],
    activity: [],
    milestones: [],
    sprints: [],
    initiatives: []
};

const EMPTY_PROJECT_METRICS: ProjectMetrics = {
    taskCount: 0,
    taskCompleted: 0
};

const shouldLoadProjectInsights = (project: Project) => (
    !isCompanyProject(project) && (project.status === 'Active' || project.status === 'In Testing')
);

const yieldToBrowser = () => new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
        resolve();
        return;
    }
    window.setTimeout(resolve, 0);
});

const withProjectScope = <T extends { projectId?: string; tenantId?: string }>(
    items: T[],
    projectId: string,
    tenantId: string
): T[] => (
    items.map((item) => ({
        ...item,
        projectId,
        tenantId
    }))
);

const getProjectMilestonesForHealth = async (tenantId: string, projectId: string): Promise<Milestone[]> => {
    const snapshot = await getDocs(collection(db, 'tenants', tenantId, 'projects', projectId, 'milestones'));
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Milestone));
};

const getProjectSprintsForHealth = async (tenantId: string, projectId: string): Promise<Sprint[]> => {
    const snapshot = await getDocs(collection(db, 'tenants', tenantId, 'projects', projectId, 'sprints'));
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Sprint));
};

// --- Health Helpers (using healthService) ---
const getHealthColor = (status: HealthStatus): string => {
    switch (status) {
        case 'critical': return '#ef4444';   // Red-500
        case 'warning': return '#f59e0b';    // Amber-500  
        case 'normal': return '#3b82f6';     // Blue-500
        case 'healthy': return '#22c55e';    // Green-500
        case 'excellent': return '#10b981';  // Emerald-500
        case 'stalemate': return '#6b7280';  // Gray-500
        default: return '#6b7280';
    }
};

const getHealthLabel = (status: HealthStatus): string => {
    switch (status) {
        case 'critical': return 'Critical';
        case 'warning': return 'At Risk';
        case 'normal': return 'Normal';
        case 'healthy': return 'Healthy';
        case 'excellent': return 'Excellent';
        case 'stalemate': return 'Stalled';
        default: return 'Unknown';
    }
};

const getHealthBadgeVariant = (status: HealthStatus): 'error' | 'warning' | 'success' | 'neutral' => {
    switch (status) {
        case 'critical': return 'error';
        case 'warning': return 'warning';
        case 'healthy':
        case 'excellent': return 'success';
        default: return 'neutral';
    }
};

// --- Components ---

const TeamAvatars: React.FC<{ projectId: string; limit?: number }> = ({ projectId, limit = 3 }) => {
    const [members, setMembers] = useState<Member[]>([]);

    useEffect(() => {
        let mounted = true;
        getProjectMembers(projectId).then(ids => {
            if (!mounted) return;
            Promise.all(ids.map(id => getUserProfile(id))).then(profiles => {
                if (mounted) setMembers(profiles.filter((m): m is Member => !!m));
            });
        });
        return () => { mounted = false; };
    }, [projectId]);

    return (
        <div className="team-avatars">
            {members.slice(0, limit).map((m, i) => (
                <div key={m.uid || i} className="avatar-circle" title={m.displayName}>
                    {m.photoURL ? <img src={m.photoURL} alt={m.displayName} /> : <span>{m.displayName?.charAt(0)}</span>}
                </div>
            ))}
            {members.length > limit && (
                <div className="avatar-circle avatar-more">+{members.length - limit}</div>
            )}
        </div>
    );
};

// 1. Spotlight Hero
interface SpotlightHeroProps {
    project: Project;
    metrics: ProjectMetrics;
    healthStatus: HealthStatus;
    healthScore: number;
    reasons: SpotlightReason[];
    pendingTaskCount: number;
    completedTaskCount: number;
    nextMilestone?: Milestone;
    daysRemaining?: number;
    sprintCount?: number;
    descriptionFallback: string;
    onClick: () => void;
    mode?: 'spotlight' | 'focus';
}

const SpotlightHero: React.FC<SpotlightHeroProps> = ({
    project, metrics, healthStatus, healthScore, reasons,
    pendingTaskCount, completedTaskCount, nextMilestone,
    daysRemaining, descriptionFallback, onClick,
    sprintCount = 0,
    mode = 'spotlight'
}) => {
    const healthColor = getHealthColor(healthStatus);
    const primaryReason = reasons[0];

    const kickerText = mode === 'focus'
        ? `TEAM FOCUS • ${primaryReason?.text || 'TOP PRIORITY'}`
        : `SPOTLIGHT • ${primaryReason?.text || 'RECENTLY UPDATED'}`;

    const glowColor = mode === 'focus' ? '#6366f1' : healthColor; // Indigo for focus

    // Specialized "Dynamic Alert" based on health and reasons
    const renderAlert = () => {
        if (healthStatus === 'critical' || healthStatus === 'warning') {
            const overdueReason = reasons.find(r => r.key.includes('Overdue') || r.key.includes('overdue'));
            const count = overdueReason?.meta?.days || overdueReason?.meta?.count;

            return (
                <div className={`spotlight-alert-badge ${healthStatus}`}>
                    <span className="material-symbols-outlined pulse-icon">
                        {healthStatus === 'critical' ? 'gpp_maybe' : 'warning'}
                    </span>
                    <span className="alert-text">
                        {overdueReason ? overdueReason.text : `${healthStatus.toUpperCase()} HEALTH`}
                    </span>
                </div>
            );
        }

        if (healthStatus === 'stalemate') {
            return (
                <div className="spotlight-alert-badge stalemate">
                    <span className="material-symbols-outlined">pause_circle</span>
                    <span className="alert-text">STALLED</span>
                </div>
            );
        }

        return null;
    };

    return (
        <div
            className={`spotlight-hero status-${healthStatus} mode-${mode}`}
            onClick={onClick}
            style={{ '--spotlight-glow': glowColor } as React.CSSProperties}
        >
            {/* 1. Full Size Visual Background */}
            <div className="spotlight-visual-bg">
                {project.coverImage ? (
                    <img src={project.coverImage} alt={project.title} />
                ) : (
                    <div className="spotlight-placeholder" style={{ backgroundColor: getDeterministicColor(project.id) }}>
                        {project.title.substring(0, 2).toUpperCase()}
                    </div>
                )}
            </div>

            {/* 2. Immersive Gradient Overlay */}
            <div className="spotlight-gradient-overlay"></div>

            {/* 3. Content floating on top - 2 column grid */}
            <div className="spotlight-content">
                {/* Left Column: Main Info */}
                <div className="spotlight-main">
                    <div className="spotlight-top-row">
                        <div className="spotlight-kicker" style={{ color: glowColor }}>
                            {kickerText}
                        </div>
                        {renderAlert()}
                    </div>

                    <h1 className="hero-title-large">{project.title}</h1>
                    <p className="hero-desc">
                        {project.description || descriptionFallback}
                    </p>

                    {/* Secondary Reasons as Pills */}
                    {reasons.length > 1 && (
                        <div className="spotlight-reasons-pills">
                            {reasons.slice(1, 4).map((r, i) => (
                                <span key={i} className="reason-pill" title={r.text}>
                                    {r.text}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="spotlight-footer">
                        <div className="health-display">
                            <span className="health-score" style={{ color: glowColor }}>{healthScore}</span>
                            <div className="health-meta">
                                <span className="health-label" style={{ color: glowColor }}>{healthStatus.toUpperCase()} HEALTH</span>
                                <span className="task-label">{completedTaskCount} / {completedTaskCount + pendingTaskCount} TASKS COMPLETE</span>
                            </div>
                        </div>

                        {project.dueDate && (
                            <div className="due-date-box">
                                <span className="material-symbols-outlined">calendar_today</span>
                                <div className="due-date-info">
                                    <span className="due-label">Due Date</span>
                                    <span className="due-value">
                                        {new Date(project.dueDate).toLocaleDateString()}
                                        {healthStatus === 'critical' && reasons.some(r => r.key.includes('Overdue')) && (
                                            <span className="overdue-tag"> OVERDUE</span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Metrics + CTA */}
                <div className="spotlight-right">
                    <div className="meta-pillars">
                        <div className="pillar-unit">
                            <span className="pillar-label">Tasks</span>
                            <div className="pillar-value-row">
                                <span className="material-symbols-outlined icon">task_alt</span>
                                <span className="pillar-value">{completedTaskCount}/{completedTaskCount + pendingTaskCount}</span>
                            </div>
                            <span className="pillar-sub">Completed</span>
                        </div>

                        <div className="pillar-unit">
                            <span className="pillar-label">Milestone</span>
                            <div className="pillar-value-row">
                                <span className="material-symbols-outlined icon">flag</span>
                                <span className="pillar-value">{nextMilestone ? '1' : '—'}</span>
                            </div>
                            <span className="pillar-sub">{nextMilestone ? 'Upcoming' : 'No Milestones'}</span>
                        </div>

                        <div className="pillar-unit">
                            <span className="pillar-label">Progress</span>
                            <div className="pillar-value-row">
                                <span className="material-symbols-outlined icon" style={{ color: (project.progress || 0) >= 75 ? '#10b981' : (project.progress || 0) >= 40 ? '#f59e0b' : '#ef4444' }}>
                                    {(project.progress || 0) >= 75 ? 'trending_up' : (project.progress || 0) >= 40 ? 'trending_flat' : 'trending_down'}
                                </span>
                                <span className="pillar-value">{project.progress || 0}%</span>
                            </div>
                            <span className="pillar-sub">{(project.progress || 0) >= 75 ? 'On Track' : (project.progress || 0) >= 40 ? 'In Progress' : 'Getting Started'}</span>
                        </div>

                        <div className="pillar-unit">
                            <span className="pillar-label">Team</span>
                            <div className="pillar-value-row">
                                <span className="material-symbols-outlined icon">group</span>
                                <span className="pillar-value">{project.members?.length || 1}</span>
                            </div>
                            <span className="pillar-sub">Members</span>
                        </div>

                        <div className="pillar-unit">
                            <span className="pillar-label">Sprints</span>
                            <div className="pillar-value-row">
                                <span className="material-symbols-outlined icon">repeat</span>
                                <span className="pillar-value">{sprintCount}</span>
                            </div>
                            <span className="pillar-sub">Total Cycles</span>
                        </div>

                    </div>

                    <Button
                        variant="primary"
                        onClick={onClick}
                        className="spotlight-cta-btn"
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        Open Project
                    </Button>
                </div>
            </div>

            {/* Aurora effect on top for extra pop */}
            <div className="spotlight-aurora" style={{
                background: `conic-gradient(from 0deg at 50% 50%, ${glowColor}22 0deg, transparent 60deg, transparent 300deg, ${glowColor}22 360deg)`
            }} />
        </div>
    );
};



// 2. Rich Project Card
interface RichProjectCardProps {
    project: Project;
    metrics?: ProjectMetrics;
    healthStatus: HealthStatus;
    healthScore: number;
    isFocus?: boolean;
    canSetFocus?: boolean;
    onSetFocus?: () => void;
    companyLabel?: string;
    descriptionFallback: string;
    statusLabel: string;
    onClick: () => void;
}

const RichProjectCard: React.FC<RichProjectCardProps> = ({
    project,
    metrics,
    healthStatus,
    healthScore,
    isFocus,
    canSetFocus,
    onSetFocus,
    companyLabel,
    descriptionFallback,
    statusLabel,
    onClick
}) => {
    const healthColor = getHealthColor(healthStatus);

    return (
        <Card
            padding="none"
            className={`rich-card rich-card--${healthStatus} ${isFocus ? 'rich-card--focus' : ''}`}
            onClick={onClick}
        >
            {/* 1. Compact Cover with Overlapping Content */}
            <div className="rich-card__cover-wrapper">
                <div
                    className="rich-card__cover"
                    style={{
                        backgroundImage: project.coverImage
                            ? `url(${project.coverImage})`
                            : undefined,
                        backgroundColor: getDeterministicColor(project.id)
                    }}
                />

                {/* Badges (Top Right) */}
                <div className="rich-card__badges">
                    <div className="badge-pill">
                        <span className={`material-symbols-outlined icon-xs text-${getHealthBadgeVariant(healthStatus)}`}>
                            {healthStatus === 'critical' ? 'gpp_maybe' : 'check_circle'}
                        </span>
                        <span>{statusLabel}</span>
                    </div>
                </div>

                {/* Overlapping Bottom Content */}
                <div className="rich-card__overlay-content">
                    {/* Icon */}
                    <div className="rich-card__icon">
                        {project.squareIcon ? (
                            <img src={project.squareIcon} alt="icon" />
                        ) : project.icon ? (
                            <span>{project.icon}</span>
                        ) : (
                            <span className="material-symbols-outlined">dataset</span>
                        )}
                    </div>

                    {/* Title & Description */}
                    <div className="rich-card__header">
                        <h3 className="title">{project.title}</h3>
                        <p className="description">
                            {project.description || descriptionFallback}
                        </p>
                        {companyLabel && (
                            <span className="rich-card__company-context">
                                <span className="material-symbols-outlined">account_tree</span>
                                {companyLabel}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="rich-card__body">
                <div className="rich-card__metrics-grid">
                    {/* Health Score */}
                    <div className={`metric-single metric-single--health metric-single--${healthStatus}`}>
                        <span className="lbl">Health</span>
                        <span className="val">
                            <span className="health-score">{healthScore}</span>
                        </span>
                    </div>

                    {/* Progress */}
                    <div className="metric-single">
                        <span className="lbl">Progress</span>
                        <span className="val">
                            <span className="material-symbols-outlined">trending_up</span>
                            {project.progress || 0}%
                        </span>
                    </div>

                    {/* Tasks */}
                    <div className="metric-single">
                        <span className="lbl">Tasks</span>
                        <span className="val">
                            <span className="material-symbols-outlined">check_circle</span>
                            {metrics?.taskCompleted}/{metrics?.taskCount}
                        </span>
                    </div>

                    {/* Team */}
                    <div className="metric-single">
                        <span className="lbl">Team</span>
                        <span className="val">
                            <span className="material-symbols-outlined">group</span>
                            {project.members?.length || 1}
                        </span>
                    </div>

                </div>

                {/* Progress Bar */}
                <div className="rich-card__progress-section">
                    <div className="progress-header">
                        <span>Progress</span>
                        <span>{project.progress || 0}%</span>
                    </div>
                    <div className="rich-card__progress-mini">
                        <div
                            className="bar"
                            style={{
                                width: `${project.progress || 0}%`,
                                backgroundColor: healthColor
                            }}
                        />
                    </div>
                </div>

                {/* 5. Footer (2-Column Buttons) */}
                <div className="rich-card__footer">
                    {canSetFocus && onSetFocus ? (
                        <Button
                            variant="secondary"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSetFocus();
                            }}
                            icon={<span className="material-symbols-outlined">{isFocus ? 'push_pin' : 'keep'}</span>}
                        >
                            {isFocus ? 'Focused' : 'Focus'}
                        </Button>
                    ) : (
                        <div></div> // Spacer if cant focus
                    )}

                    <button className="btn-primary" onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}>
                        Open Project
                        <span className="material-symbols-outlined icon-sm">arrow_forward</span>
                    </button>
                </div>
            </div>
        </Card>
    );
};

// 3. Redesigned Compact List Row
const CompactProjectRow: React.FC<{
    project: Project;
    onClick: () => void;
    statusLabel: string;
    updatedFallback: string;
    companyLabel?: string;
}> = ({ project, onClick, statusLabel, updatedFallback, companyLabel }) => {
    const statusClass = `status-${project.status?.toLowerCase().replace(/\s+/g, '-') || 'backlog'}`;
    const lastUpdated = project.updatedAt?.seconds
        ? new Date(project.updatedAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : updatedFallback;

    return (
        <div
            className="compact-row"
            onClick={onClick}
            data-status={project.status}
        >
            {/* Icon with Status Dot */}
            <div className="compact-icon">
                {project.squareIcon ? (
                    <img src={project.squareIcon} alt="" />
                ) : project.icon ? (
                    <span>{project.icon}</span>
                ) : (
                    <span className="material-symbols-outlined">folder</span>
                )}
            </div>

            {/* Title + Meta Info */}
            <div className="compact-info">
                <span className="compact-title">{project.title}</span>
                <div className="compact-meta">
                    <span className="meta-item">
                        <span className="material-symbols-outlined">schedule</span>
                        {lastUpdated}
                    </span>
                    {project.dueDate && (
                        <span className="meta-item">
                            <span className="material-symbols-outlined">event</span>
                            {new Date(project.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                    )}
                    {companyLabel && (
                        <span className="meta-item compact-company-context">
                            <span className="material-symbols-outlined">account_tree</span>
                            {companyLabel}
                        </span>
                    )}
                </div>
            </div>

            {/* Right Section */}
            <div className="compact-right">
                <span className={`compact-badge ${statusClass}`}>
                    {statusLabel}
                </span>
            </div>

            {/* Arrow Indicator */}
            <div className="compact-arrow">
                <span className="material-symbols-outlined">chevron_right</span>
            </div>
        </div>
    );
};

const ProjectLifecycleSection: React.FC<{
    id?: string;
    title: string;
    description: string;
    projects: Project[];
    renderRow: (project: Project) => JSX.Element;
}> = ({ id, title, description, projects, renderRow }) => {
    if (projects.length === 0) return null;

    return (
        <section id={id} className="projects-lifecycle-section">
            <div className="projects-lifecycle-section__header">
                <div>
                    <h2 className="section-title">{title}</h2>
                    <p>{description}</p>
                </div>
            </div>
            <div className="compact-list">
                {projects.map(renderRow)}
            </div>
        </section>
    );
};

const CompanyProjectCard: React.FC<{
    companyProject: Project;
    linkedProjects: Project[];
    statusLabel: string;
    descriptionFallback: string;
    onOpenCompany: () => void;
    onOpenLinked: (projectId: string) => void;
    getLinkedStatusLabel: (status: Project['status']) => string;
}> = ({
    companyProject,
    linkedProjects,
    statusLabel,
    descriptionFallback,
    onOpenCompany,
    onOpenLinked,
    getLinkedStatusLabel
}) => {
    const { t } = useLanguage();
    const rollup = useMemo(
        () => calculateCompanyLinkedProjectRollup(linkedProjects),
        [linkedProjects]
    );
    const stage = companyProject.startupProfile?.formationStatus || 'idea';
    const stageLabel = t(`projectOverview.startup.stage.${stage}`);
    const linkedPreview = linkedProjects.slice(0, 5);
    const hiddenLinkedCount = Math.max(0, linkedProjects.length - linkedPreview.length);

    return (
        <article
            className="company-project-card"
            onClick={onOpenCompany}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenCompany();
                }
            }}
        >
            <div
                className="company-project-card__cover"
                style={{
                    backgroundImage: companyProject.coverImage ? `url(${companyProject.coverImage})` : undefined,
                    backgroundColor: getDeterministicColor(companyProject.id)
                }}
            >
                <div className="company-project-card__cover-overlay" />
                <div className="company-project-card__cover-top">
                    <span className="company-project-card__badge">
                        <span className="material-symbols-outlined">corporate_fare</span>
                        {t('projectSwitcher.companyProject')}
                    </span>
                    <span className="company-project-card__status">{statusLabel}</span>
                </div>
                <div className="company-project-card__cover-bottom">
                    <div className="company-project-card__icon">
                        {companyProject.squareIcon ? (
                            <img src={companyProject.squareIcon} alt="" />
                        ) : companyProject.icon ? (
                            <span>{companyProject.icon}</span>
                        ) : (
                            <span className="material-symbols-outlined">domain</span>
                        )}
                    </div>
                    <div className="company-project-card__heading">
                        <h3>{companyProject.title}</h3>
                        <p>{companyProject.description || descriptionFallback}</p>
                    </div>
                </div>
            </div>

            <div className="company-project-card__body">
                <div className="company-project-card__meta-row">
                    <span className="company-project-card__stage">
                        <span className="material-symbols-outlined">flag</span>
                        {stageLabel}
                    </span>
                    <span className="company-project-card__progress">
                        <span className="material-symbols-outlined">trending_up</span>
                        {companyProject.progress || 0}%
                    </span>
                </div>

                <div className="company-project-card__stats">
                    <div className="company-project-card__stat">
                        <span>{t('projectOverview.company.rollup.total')}</span>
                        <strong>{rollup.total}</strong>
                    </div>
                    <div className="company-project-card__stat">
                        <span>{t('projectOverview.company.rollup.active')}</span>
                        <strong className="is-success">{rollup.activeCount}</strong>
                    </div>
                    <div className="company-project-card__stat">
                        <span>{t('projectOverview.company.rollup.progress')}</span>
                        <strong>{rollup.averageProgress}%</strong>
                    </div>
                    <div className="company-project-card__stat">
                        <span>{t('projectOverview.company.rollup.risk')}</span>
                        <strong className={rollup.atRiskCount > 0 ? 'is-danger' : ''}>{rollup.atRiskCount}</strong>
                    </div>
                </div>

                <div className="company-project-card__workstreams">
                    <div className="company-project-card__workstreams-header">
                        <span className="material-symbols-outlined">account_tree</span>
                        <span>{t('projectOverview.company.linkedProjectsTitle')}</span>
                    </div>
                    {linkedPreview.length > 0 ? (
                        <div className="company-project-card__workstream-list">
                            {linkedPreview.map(linkedProject => {
                                const linkedProgress = linkedProject.progress || 0;
                                return (
                                    <button
                                        key={linkedProject.id}
                                        type="button"
                                        className="company-project-card__workstream"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onOpenLinked(linkedProject.id);
                                        }}
                                    >
                                        <span className="company-project-card__workstream-icon material-symbols-outlined">folder</span>
                                        <span className="company-project-card__workstream-copy">
                                            <strong>{linkedProject.title}</strong>
                                            <small>
                                                {t(`projectCompanyRoles.${linkedProject.companyProjectRole || 'other'}`)}
                                                {' · '}
                                                {getLinkedStatusLabel(linkedProject.status)}
                                            </small>
                                        </span>
                                        <span className="company-project-card__workstream-progress">
                                            <span className="company-project-card__workstream-track">
                                                <i style={{ width: `${linkedProgress}%` }} />
                                            </span>
                                            <strong>{linkedProgress}%</strong>
                                        </span>
                                    </button>
                                );
                            })}
                            {hiddenLinkedCount > 0 && (
                                <span className="company-project-card__workstream-more">
                                    +{hiddenLinkedCount}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="company-project-card__workstreams-empty">
                            <span className="material-symbols-outlined">hub</span>
                            <span>{t('projects.company.emptyLinked')}</span>
                        </div>
                    )}
                </div>

                <div className="company-project-card__footer">
                    <span>{t('projects.company.linkedCount').replace('{count}', String(linkedProjects.length))}</span>
                    <span className="company-project-card__cta">
                        {t('projectsList.actions.openProject')}
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </span>
                </div>
            </div>
        </article>
    );
};



// Helper to get consistent color from string
export const getDeterministicColor = (str: string) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const TEMPLATE_SOURCE_DEFAULT = 'default';
const TEMPLATE_SOURCE_BASE = 'base';

const PROJECT_STATUS_ORDER: Project['status'][] = [
    'Active',
    'In Testing',
    'Backlog',
    'Planning',
    'Review',
    'On Hold',
    'Completed',
    'Canceled',
    'Brainstorming'
];

const PROJECT_STATUS_I18N_KEYS: Partial<Record<Project['status'], string>> = {
    'Active': 'project.status.active',
    'In Testing': 'project.status.inTesting',
    'Backlog': 'project.status.backlog',
    'Planning': 'project.status.planning',
    'Review': 'project.status.review',
    'On Hold': 'project.status.onHold',
    'Completed': 'project.status.completed',
    'Canceled': 'project.status.canceled',
    'Brainstorming': 'project.status.brainstorming'
};

const PROJECT_IMPORT_EXAMPLE_URL = new URL('../assets/project-import-example.json', import.meta.url).toString();

const PROJECT_MODULE_OPTIONS: ProjectModule[] = [
    'tasks',
    'initiatives',
    'activity',
    'milestones',
    'social',
    'marketing',
    'accounting',
    'sprints'
];

const PROJECT_STATE_OPTIONS: NonNullable<Project['projectState']>[] = [
    'pre-release',
    'released',
    'not specified'
];

const DEFAULT_PROJECT_OVERVIEW_LAYOUT: ProjectOverviewLayout = {
    layoutVersion: 3,
    templateId: 'core',
    cards: [
        { id: 'contract', enabled: true, span: 12, placement: 'primary' },
        { id: 'snapshot', enabled: true, span: 12, placement: 'primary' },
        { id: 'executionTasks', enabled: true, span: 12, placement: 'primary' },
        { id: 'executionFlows', enabled: true, span: 6, placement: 'primary' },
        { id: 'executionIssues', enabled: true, span: 6, placement: 'primary' },
        { id: 'updates', enabled: true, span: 12, placement: 'primary' },
        { id: 'resources', enabled: true, span: 12, placement: 'primary' },
        { id: 'planning', enabled: true, span: 3, placement: 'secondary' },
        { id: 'milestones', enabled: true, span: 3, placement: 'secondary' },
        { id: 'aiInsights', enabled: true, span: 3, placement: 'secondary' },
        { id: 'team', enabled: true, span: 3, placement: 'secondary' },
        { id: 'metadata', enabled: true, span: 3, placement: 'secondary' },
        { id: 'controls', enabled: true, span: 3, placement: 'secondary' }
    ]
};

const cloneOverviewLayout = (layout: ProjectOverviewLayout): ProjectOverviewLayout => ({
    layoutVersion: layout.layoutVersion,
    templateId: layout.templateId,
    cards: layout.cards.map((card) => ({ ...card }))
});

type TemplateVariantForm = {
    enabled: boolean;
    sourceProjectId: string;
    layout: ProjectOverviewLayout;
};

type TemplateFormState = {
    name: string;
    description: string;
    autoApply: boolean;
    baseSourceProjectId: string;
    baseLayout: ProjectOverviewLayout;
    variants: Record<Project['status'], TemplateVariantForm>;
};

type ProjectImportItem = {
    title: string;
    description?: string;
    status?: Project['status'];
    dueDate?: string;
    startDate?: string;
    priority?: string;
    isPrivate?: boolean;
    links?: { title: string; url: string }[];
    externalResources?: { title: string; url: string; icon?: string }[];
    modules?: ProjectModule[];
    projectState?: Project['projectState'];
    coverImage?: string;
    squareIcon?: string;
    screenshots?: string[];
};

export const ProjectsList: React.FC = () => {
    const navigate = useNavigate();
    const { t, dateFormat, dateLocale, loadProjectOverviewTranslations } = useLanguage();
    const { isAuthReady } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [healthInputsByProject, setHealthInputsByProject] = useState<Record<string, ProjectHealthInputs>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [templates, setTemplates] = useState<ProjectOverviewTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templatesLoaded, setTemplatesLoaded] = useState(false);
    const templatesTenantIdRef = useRef<string | null>(null);
    const [templateSaving, setTemplateSaving] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importProjects, setImportProjects] = useState<ProjectImportItem[]>([]);
    const [importError, setImportError] = useState<string | null>(null);
    const [isImportingProjects, setIsImportingProjects] = useState(false);
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const createEmptyTemplateForm = (): TemplateFormState => ({
        name: '',
        description: '',
        autoApply: false,
        baseSourceProjectId: TEMPLATE_SOURCE_DEFAULT,
        baseLayout: cloneOverviewLayout(DEFAULT_PROJECT_OVERVIEW_LAYOUT),
        variants: PROJECT_STATUS_ORDER.reduce((acc, status) => {
            acc[status] = {
                enabled: false,
                sourceProjectId: TEMPLATE_SOURCE_BASE,
                layout: cloneOverviewLayout(DEFAULT_PROJECT_OVERVIEW_LAYOUT)
            };
            return acc;
        }, {} as Record<Project['status'], TemplateVariantForm>)
    });

    const [templateForm, setTemplateForm] = useState<TemplateFormState>(createEmptyTemplateForm);
    const [authUserId, setAuthUserId] = useState<string | null>(() => auth.currentUser?.uid ?? null);

    const { can, hasPermission, isOwner } = useWorkspacePermissions();
    const { showSuccess, showError, showInfo } = useToast();
    const confirm = useConfirm();
    const { openProjectCreateModal } = useUIState();
    const [focusProjectId, setFocusProjectId] = useState<string | null>(null);
    const canManageTemplates = hasPermission('tenant.settings.edit') || can('canManageWorkspace') || isOwner;
    const [overviewLayoutResetComplete, setOverviewLayoutResetComplete] = useState(false);
    const overviewLayoutResetRunningRef = useRef(false);
    const getProjectStatusLabel = useCallback((status: Project['status']) => {
        const labelKey = PROJECT_STATUS_I18N_KEYS[status];
        return labelKey ? t(labelKey) : String(status);
    }, [t]);

    useEffect(() => {
        void loadProjectOverviewTranslations();
    }, [loadProjectOverviewTranslations]);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setAuthUserId(user?.uid ?? null);
        });
        return () => unsubscribe();
    }, []);

    const projectLayoutOptions: SelectOption[] = useMemo(() => ([
        { value: TEMPLATE_SOURCE_DEFAULT, label: t('projects.templates.form.base.core') },
        ...projects.map((project) => ({
            value: project.id,
            label: `${project.title} • ${getProjectStatusLabel(project.status)}`
        }))
    ]), [getProjectStatusLabel, projects, t]);

    const variantLayoutOptions: SelectOption[] = useMemo(() => ([
        { value: TEMPLATE_SOURCE_BASE, label: t('projects.templates.form.variants.useBase') },
        { value: TEMPLATE_SOURCE_DEFAULT, label: t('projects.templates.form.variants.useCore') },
        ...projects.map((project) => ({
            value: project.id,
            label: `${project.title} • ${getProjectStatusLabel(project.status)}`
        }))
    ]), [getProjectStatusLabel, projects, t]);

    const getLayoutFromSource = (sourceId: string, baseLayout: ProjectOverviewLayout) => {
        if (sourceId === TEMPLATE_SOURCE_BASE) {
            return cloneOverviewLayout(baseLayout);
        }
        if (sourceId === TEMPLATE_SOURCE_DEFAULT) {
            return cloneOverviewLayout(DEFAULT_PROJECT_OVERVIEW_LAYOUT);
        }
        const sourceProject = projects.find((project) => project.id === sourceId);
        return cloneOverviewLayout(sourceProject?.overviewLayout || DEFAULT_PROJECT_OVERVIEW_LAYOUT);
    };

    const getLayoutCardLabels = (layout: ProjectOverviewLayout) => (
        layout.cards.filter((card) => card.enabled).map((card) => (
            t(`projectOverview.layout.cards.${card.id}.title`)
        ))
    );

    const resetImportState = () => {
        setImportFile(null);
        setImportProjects([]);
        setImportError(null);
        if (importInputRef.current) {
            importInputRef.current.value = '';
        }
    };

    const normalizeStatus = (value: unknown): Project['status'] | null => {
        if (typeof value !== 'string') return null;
        const normalized = value.trim().toLowerCase();
        return PROJECT_STATUS_ORDER.find((status) => status.toLowerCase() === normalized) || null;
    };

    const normalizeProjectState = (value: unknown): Project['projectState'] | undefined => {
        if (typeof value !== 'string') return undefined;
        const normalized = value.trim().toLowerCase();
        return PROJECT_STATE_OPTIONS.find((state) => state.toLowerCase() === normalized);
    };

    const normalizeModules = (value: unknown): ProjectModule[] | undefined => {
        if (!Array.isArray(value)) return undefined;
        const modules = value
            .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
            .map((entry) => PROJECT_MODULE_OPTIONS.find((option) => option.toLowerCase() === entry))
            .filter((entry): entry is ProjectModule => Boolean(entry));
        return modules.length ? modules : undefined;
    };

    const normalizeLinks = (value: unknown): ProjectImportItem['links'] => {
        if (!Array.isArray(value)) return undefined;
        const links = value
            .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                const data = entry as Record<string, unknown>;
                const title = typeof data.title === 'string' ? data.title.trim() : '';
                const url = typeof data.url === 'string' ? data.url.trim() : '';
                if (!title || !url) return null;
                return { title, url };
            })
            .filter((entry): entry is { title: string; url: string } => Boolean(entry));
        return links.length ? links : undefined;
    };

    const normalizeResources = (value: unknown): ProjectImportItem['externalResources'] => {
        if (!Array.isArray(value)) return undefined;
        const resources = value
            .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                const data = entry as Record<string, unknown>;
                const title = typeof data.title === 'string' ? data.title.trim() : '';
                const url = typeof data.url === 'string' ? data.url.trim() : '';
                const icon = typeof data.icon === 'string' ? data.icon.trim() : '';
                if (!title || !url) return null;
                return icon ? { title, url, icon } : { title, url };
            })
            .filter((entry): entry is { title: string; url: string; icon?: string } => Boolean(entry));
        return resources.length ? resources : undefined;
    };

    const normalizeScreenshots = (value: unknown): string[] | undefined => {
        if (!Array.isArray(value)) return undefined;
        const screenshots = value
            .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
            .filter(Boolean);
        return screenshots.length ? screenshots : undefined;
    };

    const normalizeDate = (value: unknown, field: 'startDate' | 'dueDate', index: number) => {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        if (Number.isNaN(Date.parse(trimmed))) {
            const fieldLabel = t(`projects.import.fields.${field}`);
            throw new Error(
                t('projects.import.errors.invalidDate')
                    .replace('{index}', String(index + 1))
                    .replace('{field}', fieldLabel)
            );
        }
        return trimmed;
    };

    const parseImportFile = async (file: File) => {
        const content = await file.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(content);
        } catch {
            throw new Error(t('projects.import.errors.invalidJson'));
        }

        const entries = Array.isArray(parsed)
            ? parsed
            : (parsed && typeof parsed === 'object' && 'projects' in parsed)
                ? (parsed as { projects?: unknown }).projects
                : null;

        if (!Array.isArray(entries)) {
            throw new Error(t('projects.import.errors.invalidFormat'));
        }

        if (entries.length === 0) {
            throw new Error(t('projects.import.errors.empty'));
        }

        return entries.map((entry, index) => {
            if (!entry || typeof entry !== 'object') {
                throw new Error(t('projects.import.errors.invalidEntry').replace('{index}', String(index + 1)));
            }

            const data = entry as Record<string, unknown>;
            const title = typeof data.title === 'string' ? data.title.trim() : '';
            if (!title) {
                throw new Error(t('projects.import.errors.missingTitle').replace('{index}', String(index + 1)));
            }

            const status = normalizeStatus(data.status);
            if (data.status !== undefined && !status) {
                throw new Error(
                    t('projects.import.errors.invalidStatus')
                        .replace('{index}', String(index + 1))
                        .replace('{status}', String(data.status))
                );
            }

            const projectState = normalizeProjectState(data.projectState);
            if (data.projectState !== undefined && !projectState) {
                throw new Error(
                    t('projects.import.errors.invalidProjectState')
                        .replace('{index}', String(index + 1))
                        .replace('{state}', String(data.projectState))
                );
            }

            const description = typeof data.description === 'string' ? data.description.trim() : '';

            return {
                title,
                description: description || '',
                status: status || 'Planning',
                dueDate: normalizeDate(data.dueDate, 'dueDate', index),
                startDate: normalizeDate(data.startDate, 'startDate', index),
                priority: typeof data.priority === 'string' ? data.priority.trim() : undefined,
                isPrivate: typeof data.isPrivate === 'boolean' ? data.isPrivate : undefined,
                links: normalizeLinks(data.links),
                externalResources: normalizeResources(data.externalResources),
                modules: normalizeModules(data.modules),
                projectState,
                coverImage: typeof data.coverImage === 'string' ? data.coverImage.trim() : undefined,
                squareIcon: typeof data.squareIcon === 'string' ? data.squareIcon.trim() : undefined,
                screenshots: normalizeScreenshots(data.screenshots)
            } satisfies ProjectImportItem;
        });
    };

    const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setImportFile(file);
        setImportError(null);

        if (!file.name.toLowerCase().endsWith('.json')) {
            setImportProjects([]);
            setImportError(t('projects.import.errors.invalidType'));
            return;
        }

        try {
            const parsedProjects = await parseImportFile(file);
            setImportProjects(parsedProjects);
            setImportError(null);
        } catch (error) {
            setImportProjects([]);
            setImportError(error instanceof Error ? error.message : t('projects.import.errors.failed'));
        }
    };

    const handleImportProjects = async () => {
        if (!importFile) {
            showError(t('projects.import.errors.noFile'));
            return;
        }

        if (importError) {
            showError(importError);
            return;
        }

        if (importProjects.length === 0) {
            showError(t('projects.import.errors.empty'));
            return;
        }

        const tenantId = getActiveTenantId();
        if (!tenantId) {
            showError(t('projects.import.errors.noTenant'));
            return;
        }

        setIsImportingProjects(true);
        let successCount = 0;
        let failedCount = 0;
        const sanitizeProjectData = (data: Partial<Project>) => (
            Object.entries(data).reduce((acc, [key, value]) => {
                if (value !== undefined) {
                    acc[key] = value;
                }
                return acc;
            }, {} as Partial<Project>)
        );

        for (const project of importProjects) {
            try {
                const projectData = sanitizeProjectData({
                    title: project.title,
                    description: project.description || '',
                    status: project.status || 'Planning',
                    dueDate: project.dueDate,
                    startDate: project.startDate,
                    priority: project.priority,
                    isPrivate: project.isPrivate,
                    links: project.links,
                    externalResources: project.externalResources,
                    modules: project.modules,
                    projectState: project.projectState
                });
                await createProject(
                    projectData,
                    project.coverImage,
                    project.squareIcon,
                    project.screenshots,
                    [],
                    tenantId
                );
                successCount += 1;
            } catch (error) {
                failedCount += 1;
                console.error('Failed to import project', project.title, error);
            }
        }

        if (successCount > 0) {
            showSuccess(t('projects.import.toast.success').replace('{count}', String(successCount)));
        }

        if (failedCount > 0) {
            const messageKey = successCount > 0
                ? 'projects.import.toast.partial'
                : 'projects.import.toast.failed';
            showError(
                t(messageKey)
                    .replace('{success}', String(successCount))
                    .replace('{failed}', String(failedCount))
            );
        }

        if (successCount > 0 && failedCount === 0) {
            setImportModalOpen(false);
            resetImportState();
        }

        try {
            const refreshedProjects = await getAllWorkspaceProjects();
            setProjects(refreshedProjects);
        } catch (error) {
            console.error('Failed to refresh projects after import', error);
        } finally {
            setIsImportingProjects(false);
        }
    };

    const handleOpenImportModal = () => {
        resetImportState();
        setImportModalOpen(true);
    };

    const handleCloseImportModal = () => {
        if (isImportingProjects) return;
        setImportModalOpen(false);
        resetImportState();
    };

    const handleDownloadImportExample = () => {
        void downloadFile(PROJECT_IMPORT_EXAMPLE_URL, 'project-import-example.json');
    };

    // Fetch Tenant Data for Focus Project
    useEffect(() => {
        const fetchTenant = async () => {
            const tid = getActiveTenantId();
            if (tid) {
                const tData = await getTenant(tid) as Tenant;
                if (tData) {
                    setFocusProjectId(tData.focusProjectId || null);
                }
            }
        };
        fetchTenant();
    }, []);

    useEffect(() => {
        if (canManageTemplates) return;
        setTemplatesLoading(false);
        setTemplatesLoaded(false);
        setTemplates([]);
        templatesTenantIdRef.current = null;
    }, [canManageTemplates]);

    useEffect(() => {
        if (!templateModalOpen || !canManageTemplates) return;
        const tenantId = getActiveTenantId() || null;
        if (!tenantId) {
            setTemplatesLoading(false);
            setTemplatesLoaded(false);
            setTemplates([]);
            templatesTenantIdRef.current = null;
            return;
        }
        if (templatesTenantIdRef.current === tenantId && templatesLoaded) return;
        let mounted = true;
        const loadTemplates = async () => {
            setTemplatesLoading(true);
            setTemplatesLoaded(false);
            try {
                const savedTemplates = await getProjectOverviewTemplates(tenantId);
                if (mounted) {
                    setTemplates(savedTemplates);
                    setTemplatesLoaded(true);
                    templatesTenantIdRef.current = tenantId;
                }
            } catch (error) {
                console.error("Failed to load project templates", error);
                showError(t('projects.templates.toast.loadFailed'));
                if (mounted) {
                    setTemplatesLoaded(true);
                }
            } finally {
                if (mounted) {
                    setTemplatesLoading(false);
                }
            }
        };
        loadTemplates();
        return () => { mounted = false; };
    }, [templateModalOpen, canManageTemplates, templatesLoaded, showError, t]);

    const resetTemplateForm = () => {
        setEditingTemplateId(null);
        setTemplateForm(createEmptyTemplateForm());
    };

    const buildTemplateForm = (template: ProjectOverviewTemplate): TemplateFormState => {
        const baseLayout = cloneOverviewLayout(template.baseLayout || DEFAULT_PROJECT_OVERVIEW_LAYOUT);
        const baseSourceProjectId = template.baseSourceProjectId || TEMPLATE_SOURCE_DEFAULT;
        const variantsList = template.variants || [];
        const variants = PROJECT_STATUS_ORDER.reduce((acc, status) => {
            const variant = variantsList.find((item) => item.status === status);
            acc[status] = {
                enabled: Boolean(variant?.enabled),
                sourceProjectId: variant?.sourceProjectId || TEMPLATE_SOURCE_BASE,
                layout: cloneOverviewLayout(variant?.layout || baseLayout)
            };
            return acc;
        }, {} as Record<Project['status'], TemplateVariantForm>);

        return {
            name: template.name,
            description: template.description || '',
            autoApply: Boolean(template.autoApply),
            baseSourceProjectId,
            baseLayout,
            variants
        };
    };

    const openTemplateEditor = (template?: ProjectOverviewTemplate) => {
        if (template) {
            setEditingTemplateId(template.id);
            setTemplateForm(buildTemplateForm(template));
        } else {
            resetTemplateForm();
        }
        setTemplateModalOpen(true);
    };

    const handleBaseSourceChange = (value: string) => {
        setTemplateForm((prev) => {
            const nextBaseLayout = getLayoutFromSource(value, prev.baseLayout);
            const nextVariants = { ...prev.variants };
            PROJECT_STATUS_ORDER.forEach((status) => {
                if (nextVariants[status].sourceProjectId === TEMPLATE_SOURCE_BASE) {
                    nextVariants[status] = {
                        ...nextVariants[status],
                        layout: cloneOverviewLayout(nextBaseLayout)
                    };
                }
            });
            return {
                ...prev,
                baseSourceProjectId: value,
                baseLayout: nextBaseLayout,
                variants: nextVariants
            };
        });
    };

    const handleVariantToggle = (status: Project['status']) => {
        setTemplateForm((prev) => ({
            ...prev,
            variants: {
                ...prev.variants,
                [status]: {
                    ...prev.variants[status],
                    enabled: !prev.variants[status].enabled
                }
            }
        }));
    };

    const handleVariantSourceChange = (status: Project['status'], value: string) => {
        setTemplateForm((prev) => ({
            ...prev,
            variants: {
                ...prev.variants,
                [status]: {
                    ...prev.variants[status],
                    sourceProjectId: value,
                    layout: getLayoutFromSource(value, prev.baseLayout)
                }
            }
        }));
    };

    const handleTemplateSave = async () => {
        if (!templateForm.name.trim()) {
            showError(t('projects.templates.toast.nameRequired'));
            return;
        }
        setTemplateSaving(true);
        try {
            if (templateForm.autoApply) {
                const autoApplyTemplates = templates.filter((template) => template.autoApply && template.id !== editingTemplateId);
                await Promise.all(autoApplyTemplates.map((template) => (
                    saveProjectOverviewTemplate({ ...template, autoApply: false }, template.tenantId)
                )));
                if (autoApplyTemplates.length > 0) {
                    setTemplates((prev) => prev.map((template) => (
                        template.id === editingTemplateId ? template : { ...template, autoApply: false }
                    )));
                }
            }

            const payload: Omit<ProjectOverviewTemplate, 'id'> = {
                name: templateForm.name.trim(),
                description: templateForm.description.trim(),
                autoApply: templateForm.autoApply,
                baseLayout: templateForm.baseLayout,
                baseSourceProjectId: templateForm.baseSourceProjectId === TEMPLATE_SOURCE_DEFAULT ? undefined : templateForm.baseSourceProjectId,
                variants: PROJECT_STATUS_ORDER.map((status) => {
                    const variant = templateForm.variants[status];
                    return {
                        status,
                        enabled: variant.enabled,
                        layout: variant.layout,
                        sourceProjectId: variant.sourceProjectId
                    } as ProjectOverviewTemplateVariant;
                })
            };

            const savedId = await saveProjectOverviewTemplate(
                {
                    ...(editingTemplateId ? { id: editingTemplateId } : {}),
                    ...payload
                },
                getActiveTenantId()
            );

            setTemplates((prev) => {
                const next = prev.filter((template) => template.id !== savedId);
                return [
                    {
                        id: savedId,
                        ...payload,
                        tenantId: getActiveTenantId()
                    },
                    ...next
                ];
            });

            setEditingTemplateId(savedId);
            showSuccess(t('projects.templates.toast.saved'));
        } catch (error) {
            console.error("Failed to save project template", error);
            showError(t('projects.templates.toast.saveFailed'));
        } finally {
            setTemplateSaving(false);
        }
    };

    const handleTemplateDelete = async (template: ProjectOverviewTemplate) => {
        if (!await confirm(
            t('projects.templates.confirm.delete.title'),
            t('projects.templates.confirm.delete.body').replace('{name}', template.name)
        )) {
            return;
        }
        try {
            await deleteProjectOverviewTemplate(template.id, template.tenantId);
            setTemplates((prev) => prev.filter((item) => item.id !== template.id));
            if (editingTemplateId === template.id) {
                resetTemplateForm();
            }
            showSuccess(t('projects.templates.toast.deleted'));
        } catch (error) {
            console.error("Failed to delete project template", error);
            showError(t('projects.templates.toast.deleteFailed'));
        }
    };

    const autoApplyTemplate = useMemo(() => (
        templates.find((template) => template.autoApply) || null
    ), [templates]);

    const isLayoutEqual = (a?: ProjectOverviewLayout, b?: ProjectOverviewLayout) => {
        if (!a || !b) return false;
        if ((a.layoutVersion || 0) !== (b.layoutVersion || 0)) return false;
        if (a.templateId !== b.templateId) return false;
        if (a.cards.length !== b.cards.length) return false;
        for (let i = 0; i < a.cards.length; i += 1) {
            const cardA = a.cards[i];
            const cardB = b.cards[i];
            if (cardA.id !== cardB.id) return false;
            if (cardA.enabled !== cardB.enabled) return false;
            if (cardA.span !== cardB.span) return false;
            if (cardA.placement !== cardB.placement) return false;
        }
        return true;
    };

    useEffect(() => {
        if (!autoApplyTemplate || !canManageTemplates) return;
        if (projects.length === 0) return;

        const templateId = autoApplyTemplate.id;
        const updates: Project[] = [];

        projects.forEach((project) => {
            const existingTemplateId = project.overviewLayout?.templateId;
            if (existingTemplateId && existingTemplateId !== 'core' && existingTemplateId !== templateId) {
                return;
            }
            const variants = autoApplyTemplate.variants || [];
            const variant = variants.find((item) => item.status === project.status && item.enabled);
            const layoutSource = variant?.layout || autoApplyTemplate.baseLayout;
            const desiredLayout: ProjectOverviewLayout = {
                ...cloneOverviewLayout(layoutSource),
                templateId
            };
            if (!isLayoutEqual(project.overviewLayout, desiredLayout)) {
                updates.push({ ...project, overviewLayout: desiredLayout });
            }
        });

        if (updates.length === 0) return;

        const applyUpdates = async () => {
            try {
                await Promise.all(updates.map((project) => (
                    updateProjectFields(project.id, { overviewLayout: project.overviewLayout }, undefined, project.tenantId)
                )));
                setProjects((prev) => prev.map((project) => {
                    const updated = updates.find((item) => item.id === project.id);
                    return updated ? { ...project, overviewLayout: updated.overviewLayout } : project;
                }));
            } catch (error) {
                console.error("Failed to auto-apply project templates", error);
            }
        };

        applyUpdates();
    }, [autoApplyTemplate, canManageTemplates, projects]);

    useEffect(() => {
        if (!canManageTemplates || overviewLayoutResetComplete) return;
        if (overviewLayoutResetRunningRef.current) return;
        if (projects.length === 0) return;
        const tenantId = getActiveTenantId();
        if (!tenantId) return;

        const migrationFlagKey = `pf-overview-layout-reset-2026-02-11:${tenantId}`;
        if (localStorage.getItem(migrationFlagKey) === 'done') {
            setOverviewLayoutResetComplete(true);
            return;
        }

        let cancelled = false;
        overviewLayoutResetRunningRef.current = true;

        const applyLayoutReset = async () => {
            try {
                const changedProjects = await resetWorkspaceOverviewLayoutsToDefault(tenantId);
                if (cancelled) return;

                if (changedProjects.length > 0) {
                    setProjects((prev) => prev.map((project) => {
                        const changed = changedProjects.find((item) => item.id === project.id);
                        return changed ? { ...project, overviewLayout: changed.overviewLayout } : project;
                    }));
                    showInfo(
                        t('projects.templates.toast.layoutReset')
                            .replace('{count}', String(changedProjects.length))
                    );
                }

                localStorage.setItem(migrationFlagKey, 'done');
            } catch (error) {
                console.error('Failed to reset project overview layouts', error);
                showError(t('projects.templates.toast.layoutResetFailed'));
            } finally {
                if (!cancelled) {
                    setOverviewLayoutResetComplete(true);
                }
                overviewLayoutResetRunningRef.current = false;
            }
        };

        void applyLayoutReset();

        return () => {
            cancelled = true;
        };
    }, [canManageTemplates, overviewLayoutResetComplete, projects, showError, showInfo, t]);

    const handleSetFocus = async (projectId: string) => {
        const tid = getActiveTenantId();
        if (tid) {
            // Toggle off if already focused
            const newFocusId = focusProjectId === projectId ? null : projectId;

            // Optimistic update
            setFocusProjectId(newFocusId);

            try {
                await setWorkspaceFocusProject(tid, newFocusId);
            } catch (error) {
                console.error("Failed to set focus project", error);
                setFocusProjectId(focusProjectId); // Revert on error
            }
        }
    };

    useEffect(() => {
        if (!isAuthReady) {
            setLoading(true);
            return;
        }

        if (!authUserId) {
            setProjects([]);
            setTasks([]);
            setMilestones([]);
            setSprints([]);
            setHealthInputsByProject({});
            setLoading(false);
            return;
        }

        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const resolvedTenantId = await ensureActiveTenantId();
                let allProjects: Project[] = [];
                // Skip asset hydration on the critical path. Cover/icon URLs each
                // require a Cloud Function round-trip; resolving them here blocked
                // the list from rendering until every project's assets returned.
                const [ownedProjects, sharedProjects] = await Promise.all([
                    getUserProjects(undefined, { hydrateAssets: false }).catch(() => []),
                    getSharedProjects({ hydrateAssets: false }).catch(() => [])
                ]);
                const dedupedProjects = new Map<string, Project>();
                [...ownedProjects, ...sharedProjects].forEach((project) => {
                    dedupedProjects.set(`${project.tenantId || 'none'}:${project.id}`, project);
                });
                allProjects = Array.from(dedupedProjects.values());

                if (allProjects.length === 0) {
                    try {
                        allProjects = await getAllWorkspaceProjects(resolvedTenantId, { hydrateAssets: false });
                    } catch (error) {
                        console.warn('Projects list workspace query failed', error);
                    }
                }

                if (!mounted) return;

                setProjects(allProjects);

                // Hydrate cover/icon image URLs in the background and patch them
                // in once resolved, so text content is interactive immediately.
                void (async () => {
                    try {
                        const toHydrate = allProjects.map((project) => (
                            project.tenantId ? project : { ...project, tenantId: resolvedTenantId }
                        ));
                        const hydrated = await hydrateProjectAssets(toHydrate, { includeScreenshots: false });
                        if (!mounted) return;
                        const hydratedById = new Map(
                            hydrated.map((project) => [`${project.tenantId || 'none'}:${project.id}`, project])
                        );
                        setProjects((prev) => prev.map((project) => (
                            hydratedById.get(`${project.tenantId || 'none'}:${project.id}`) || project
                        )));
                    } catch (error) {
                        console.warn('Background project asset hydration failed', error);
                    }
                })();
                setTasks([]);
                setMilestones([]);
                setSprints([]);
                setHealthInputsByProject({});
                setLoading(false);

                const insightProjects = allProjects.filter(shouldLoadProjectInsights);
                if (insightProjects.length === 0) {
                    return;
                }

                await yieldToBrowser();
                if (!mounted) return;

                const projectInputEntries = await Promise.all(
                    insightProjects.map(async (project): Promise<[string, ProjectHealthInputs]> => {
                        const tenantId = project.tenantId || resolvedTenantId;
                        const [
                            projectTasks,
                            projectActivity,
                            projectMilestones,
                            projectSprints,
                            projectInitiatives
                        ] = await Promise.all([
                            getProjectTasks(project.id, tenantId).catch(() => []),
                            getProjectActivity(project.id, tenantId).catch(() => []),
                            getProjectMilestonesForHealth(tenantId, project.id).catch(() => []),
                            getProjectSprintsForHealth(tenantId, project.id).catch(() => []),
                            getProjectInitiatives(project.id, tenantId).catch(() => [])
                        ]);

                        return [
                            project.id,
                            {
                                tasks: withProjectScope(projectTasks, project.id, tenantId),
                                activity: withProjectScope(projectActivity, project.id, tenantId),
                                milestones: withProjectScope(projectMilestones, project.id, tenantId),
                                sprints: withProjectScope(projectSprints, project.id, tenantId),
                                initiatives: withProjectScope(projectInitiatives, project.id, tenantId)
                            }
                        ];
                    })
                );
                const nextHealthInputsByProject = projectInputEntries.reduce<Record<string, ProjectHealthInputs>>((acc, [projectId, inputs]) => {
                    acc[projectId] = inputs;
                    return acc;
                }, {});
                const projectInputs = Object.values(nextHealthInputsByProject);

                if (mounted) {
                    setTasks(projectInputs.flatMap((entry) => entry.tasks));
                    setMilestones(projectInputs.flatMap((entry) => entry.milestones));
                    setSprints(projectInputs.flatMap((entry) => entry.sprints));
                    setHealthInputsByProject(nextHealthInputsByProject);
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();

        return () => { mounted = false; };
    }, [authUserId, isAuthReady]);

    const metricsByProject = useMemo(() => {
        const map: Record<string, ProjectMetrics> = {};
        const ensureMetrics = (projectId: string) => {
            if (!map[projectId]) {
                map[projectId] = { ...EMPTY_PROJECT_METRICS };
            }
            return map[projectId];
        };

        tasks.forEach((task) => {
            const metrics = ensureMetrics(task.projectId);
            metrics.taskCount += 1;
            if (task.isCompleted) {
                metrics.taskCompleted += 1;
            }
        });

        return map;
    }, [tasks]);

    const getMetrics = useCallback((projectId: string): ProjectMetrics => (
        metricsByProject[projectId] || EMPTY_PROJECT_METRICS
    ), [metricsByProject]);

    const filteredProjects = useMemo(() => {
        if (!authUserId) return [];
        return projects.filter(p => {
            if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        }).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    }, [projects, authUserId, search]);

    const companyProjects = useMemo(() =>
        filteredProjects.filter(isCompanyProject),
        [filteredProjects]);

    const ordinaryProjects = useMemo(() =>
        filteredProjects.filter(project => !isCompanyProject(project)),
        [filteredProjects]);

    const companyProjectLookup = useMemo(() => {
        const lookup = new Map<string, Project>();
        projects.filter(isCompanyProject).forEach(project => lookup.set(project.id, project));
        return lookup;
    }, [projects]);

    const linkedProjectsByCompany = useMemo(() => {
        const grouped = new Map<string, Project[]>();
        ordinaryProjects.forEach(project => {
            if (!project.companyProjectId) return;
            const current = grouped.get(project.companyProjectId) || [];
            current.push(project);
            grouped.set(project.companyProjectId, current);
        });
        return grouped;
    }, [ordinaryProjects]);

    const getCompanyContextLabel = useCallback((project: Project) => {
        if (!project.companyProjectId) return '';
        const companyProject = companyProjectLookup.get(project.companyProjectId);
        if (!companyProject) return '';
        return t('projects.company.partOf').replace('{company}', companyProject.title);
    }, [companyProjectLookup, t]);

    const activeList = useMemo(() =>
        ordinaryProjects.filter(p => p.status === 'Active' || p.status === 'In Testing'),
        [ordinaryProjects]);

    const pausedList = useMemo(() =>
        ordinaryProjects.filter(p => p.status === 'On Hold'),
        [ordinaryProjects]);

    const completedList = useMemo(() =>
        ordinaryProjects.filter(p => p.status === 'Completed'),
        [ordinaryProjects]);

    const canceledList = useMemo(() =>
        ordinaryProjects.filter(p => p.status === 'Canceled'),
        [ordinaryProjects]);

    const backlogList = useMemo(() =>
        ordinaryProjects.filter(p => (
            p.status !== 'Active'
            && p.status !== 'In Testing'
            && p.status !== 'On Hold'
            && p.status !== 'Completed'
            && p.status !== 'Canceled'
        )),
        [ordinaryProjects]);

    const lifecycleSectionCount = backlogList.length + pausedList.length + completedList.length + canceledList.length;

    // Manual Focus Project
    const manualFocusProject = useMemo(() => {
        if (!focusProjectId) return null;
        return activeList.find(p => p.id === focusProjectId); // Ensure user has access
    }, [focusProjectId, activeList]);

    const focusMilestones = useMemo(() =>
        manualFocusProject ? milestones.filter(m => m.projectId === manualFocusProject.id) : [],
        [manualFocusProject, milestones]);

    const focusSprints = useMemo(() =>
        manualFocusProject ? sprints.filter(s => s.projectId === manualFocusProject.id) : [],
        [manualFocusProject, sprints]);

    const nextFocusMilestone = useMemo(() => {
        const pending = focusMilestones.filter(m => m.status === 'Pending');
        if (pending.length === 0) return undefined;
        pending.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
        return pending[0];
    }, [focusMilestones]);

    // Compute the same project-scoped health payloads used by the overview page.
    const projectHealthMap = useMemo(() => {
        const healthMap: Record<string, ProjectHealth> = {};
        filteredProjects.forEach(project => {
            if (isProjectExcludedFromHealth(project)) return;
            const projectInputs = healthInputsByProject[project.id] || EMPTY_PROJECT_HEALTH_INPUTS;
            healthMap[project.id] = calculateProjectHealth(
                project,
                projectInputs.tasks,
                projectInputs.milestones,
                [],
                projectInputs.sprints,
                projectInputs.activity,
                [],
                projectInputs.initiatives,
                []
            );
        });
        return healthMap;
    }, [filteredProjects, healthInputsByProject]);

    // Calculate spotlight data for the manually focused project
    const manualFocusSpotlightData = useMemo(() => {
        if (!manualFocusProject) return null;
        if (isProjectExcludedFromHealth(manualFocusProject)) return null;
        const projectTasks = tasks.filter(t => t.projectId === manualFocusProject.id);
        const projectMilestones = milestones.filter(m => m.projectId === manualFocusProject.id);
        const projectSprints = sprints.filter(s => s.projectId === manualFocusProject.id);
        const projectInputs = healthInputsByProject[manualFocusProject.id] || EMPTY_PROJECT_HEALTH_INPUTS;

        const score = calculateSpotlightScore(manualFocusProject, projectTasks, projectMilestones, [], projectSprints);
        const health = projectHealthMap[manualFocusProject.id] || calculateProjectHealth(
            manualFocusProject,
            projectInputs.tasks,
            projectInputs.milestones,
            [],
            projectInputs.sprints,
            projectInputs.activity,
            [],
            projectInputs.initiatives,
            []
        );
        return {
            reasons: score.reasons,
            score: score.score,
            health: health
        };
    }, [manualFocusProject, tasks, projectHealthMap, milestones, sprints, healthInputsByProject]);

    // Spotlight Logic: Uses enhanced algorithm to select most critical/urgent project
    const spotlightData = useMemo(() => {
        if (activeList.length === 0) return null;

        // Calculate spotlight scores for all active projects
        const scores = activeList.map(project => {
            const projectTasks = tasks.filter(t => t.projectId === project.id);
            const projectMilestones = milestones.filter(m => m.projectId === project.id);
            const projectSprints = sprints.filter(s => s.projectId === project.id);

            const score = calculateSpotlightScore(project, projectTasks, projectMilestones, [], projectSprints);
            const health = projectHealthMap[project.id];
            return { project, score, health };
        });

        // Sort by score (highest first) and pick the winner
        scores.sort((a, b) => b.score.score - a.score.score);
        const winner = scores[0];

        if (!winner) return null;

        return {
            project: winner.project,
            reasons: winner.score.reasons,
            score: winner.score.score,
            health: winner.health,
            milestones: milestones.filter(m => m.projectId === winner.project.id),
            sprints: sprints.filter(s => s.projectId === winner.project.id)
        };
    }, [activeList, tasks, projectHealthMap, milestones, sprints]);

    const spotlightProject = spotlightData?.project || null;
    const spotlightProjectMilestones = useMemo(() =>
        spotlightProject ? milestones.filter(m => m.projectId === spotlightProject.id) : [],
        [spotlightProject, milestones]);

    const spotlightProjectSprints = useMemo(() =>
        spotlightProject ? sprints.filter(s => s.projectId === spotlightProject.id) : [],
        [spotlightProject, sprints]);

    const nextSpotlightMilestone = useMemo(() => {
        const pending = spotlightProjectMilestones.filter(m => m.status === 'Pending');
        if (pending.length === 0) return undefined;
        pending.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
        return pending[0];
    }, [spotlightProjectMilestones]);



    // Determine what to show in the "Focus/Spotlight" slot
    // Rule: Spotlight overrides Focus if they are DIFFERENT. 
    // Wait, prompt said: "Notice: If a project is in spotlight by the algorithm its not marked as focus. so that overwrites the focus but in firebase the focus state can still be saved for that project"
    // Interpretation: 
    // 1. Calculate Spotlight.
    // 2. Check Manual Focus.
    // 3. If Spotlight is same as Focus, show Spotlight (Focus is hidden/redundant).
    // 4. If Spotlight is different from Focus, show Spotlight AND Manual Focus (implicitly "have a similar card as the spotlight card but different").
    // Actually, usually "Focus" implies "Main Thing". If we have TWO "Main Things", we should show both if they differ.

    // Grid projects (Active minus spotlight minus manual focus)
    const gridProjects = useMemo(() =>
        activeList.filter(p => p.id !== spotlightProject?.id && p.id !== manualFocusProject?.id),
        [activeList, spotlightProject, manualFocusProject]);

    const onboardingSteps: OnboardingStep[] = [
        { id: 'spotlight', targetId: 'spotlight-hero', title: 'Spotlight', description: 'Your most critical project.' },
        { id: 'focus', targetId: 'focus-card', title: 'Team Focus', description: 'The project currently prioritized by the team.' },
        { id: 'grid', targetId: 'grid-area', title: 'Active Projects', description: 'Key metrics for your active work.' },
        { id: 'list', targetId: 'list-area', title: 'Lifecycle lists', description: 'Backlog, paused, completed, and canceled projects are separated.' },
    ];
    const { onboardingActive, stepIndex, setStepIndex, skip, finish } = useOnboardingTour('projects_rich', { stepCount: onboardingSteps.length, autoStart: true, enabled: !loading });

    const renderCompactProjectRow = (project: Project) => (
        <CompactProjectRow
            key={project.id}
            project={project}
            statusLabel={getProjectStatusLabel(project.status)}
            updatedFallback={t('projects.sections.updatedUnknown')}
            companyLabel={getCompanyContextLabel(project)}
            onClick={() => navigate(`/project/${project.id}`)}
        />
    );

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Workspace...</div>;

    return (
        <div className="rich-page">
            <div className="projects-header">
                <div className="projects-header-info">
                    <div className="projects-header-date">
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                        {format(new Date(), dateFormat, { locale: dateLocale })}
                    </div>
                    <h1 className="projects-header-title">Projects</h1>
                    <p className="projects-header-subtitle">Manage your team's work.</p>
                </div>
            </div>

            {/* Toolbar: Search & Actions */}
            <div className="projects-toolbar">
                <div className="search-pill">
                    <span className="material-symbols-outlined">search</span>
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="projects-toolbar__actions">
                    {canManageTemplates && (
                        <Button
                            variant="ghost"
                            icon={<span className="material-symbols-outlined">dashboard_customize</span>}
                            onClick={() => openTemplateEditor()}
                        >
                            {t('projects.templates.button')}
                        </Button>
                    )}
                    {can('canCreateProjects') && (
                        <Button
                            variant="secondary"
                            icon={<span className="material-symbols-outlined">upload</span>}
                            onClick={handleOpenImportModal}
                        >
                            {t('projects.import.button')}
                        </Button>
                    )}
                    {can('canCreateProjects') && (
                        <Button
                            variant="primary"
                            icon={<span className="material-symbols-outlined">add</span>}
                            onClick={openProjectCreateModal}
                        >
                            {t('projectsList.actions.createProject')}
                        </Button>
                    )}
                </div>
            </div>

            <div className="rich-content">
                {spotlightProject && spotlightData && !search && (
                    <div id="spotlight-hero" className="mb-12">
                        <SpotlightHero
                            project={spotlightProject}
                            metrics={getMetrics(spotlightProject.id)}
                            healthStatus={spotlightData.health?.status || 'normal'}
                            healthScore={spotlightData.health?.score || 50}
                            reasons={spotlightData.reasons}
                            pendingTaskCount={tasks.filter(t => t.projectId === spotlightProject.id && !t.isCompleted && t.status !== 'Done').length}
                            completedTaskCount={tasks.filter(t => t.projectId === spotlightProject.id && (t.isCompleted || t.status === 'Done')).length}
                            nextMilestone={nextSpotlightMilestone}
                            sprintCount={spotlightProjectSprints.length}
                            descriptionFallback={t('projectsList.spotlight.noDescription')}
                            onClick={() => navigate(`/project/${spotlightProject.id}`)}
                        />
                    </div>
                )}

                {/* Manual Focus Card (Only if different from spotlight) */}
                {manualFocusProject && manualFocusProject.id !== spotlightProject?.id && !search && (
                    <div id="focus-card" className="mb-12">
                        <SpotlightHero
                            project={manualFocusProject}
                            metrics={getMetrics(manualFocusProject.id)}
                            healthStatus={manualFocusSpotlightData?.health.status || 'normal'}
                            healthScore={manualFocusSpotlightData?.health.score || 50}
                            reasons={manualFocusSpotlightData?.reasons || []}
                            pendingTaskCount={getMetrics(manualFocusProject.id).taskCount - getMetrics(manualFocusProject.id).taskCompleted}
                            completedTaskCount={getMetrics(manualFocusProject.id).taskCompleted}
                            nextMilestone={nextFocusMilestone}
                            sprintCount={focusSprints.length}
                            descriptionFallback={t('projectsList.spotlight.noDescription')}
                            onClick={() => navigate(`/project/${manualFocusProject.id}`)}
                            mode="focus"
                        />
                    </div>
                )}

                {companyProjects.length > 0 && !search && (
                    <section id="company-projects" className="company-projects-section mb-12">
                        <div className="company-projects-section__header">
                            <h2 className="section-title">{t('projects.company.section.title').replace('{count}', String(companyProjects.length))}</h2>
                        </div>
                        <div className="company-projects-section__list">
                            {companyProjects.map(companyProject => {
                                const linkedProjects = linkedProjectsByCompany.get(companyProject.id) || [];
                                return (
                                    <CompanyProjectCard
                                        key={companyProject.id}
                                        companyProject={companyProject}
                                        linkedProjects={linkedProjects}
                                        statusLabel={getProjectStatusLabel(companyProject.status)}
                                        descriptionFallback={t('projectsList.card.defaultDescription')}
                                        onOpenCompany={() => navigate(`/project/${companyProject.id}`)}
                                        onOpenLinked={(projectId) => navigate(`/project/${projectId}`)}
                                        getLinkedStatusLabel={getProjectStatusLabel}
                                    />
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Health Warning Strip (Optional, if user wants repeated warnings, but Spotlight covers it mostly) */}
                {/* We can integrate it if multiple criticals exist? User asked for Spotlight Glow. */}

                {/* Active Grid */}
                {gridProjects.length > 0 && (
                    <div id="grid-area" className="mb-12">
                        <h2 className="section-title">
                            {t('projects.sections.active.title').replace('{count}', String(gridProjects.length))}
                        </h2>
                        <div className="rich-grid">
                            {gridProjects.map(p => {
                                const health = projectHealthMap[p.id];
                                return (
                                    <RichProjectCard
                                        key={p.id}
                                        project={p}
                                        metrics={getMetrics(p.id)}
                                        healthStatus={health?.status || 'normal'}
                                        healthScore={health?.score || 50}
                                        companyLabel={getCompanyContextLabel(p)}
                                        descriptionFallback={t('projectsList.card.defaultDescription')}
                                        statusLabel={getProjectStatusLabel(p.status)}
                                        onClick={() => navigate(`/project/${p.id}`)}
                                        isFocus={p.id === focusProjectId}
                                        canSetFocus={hasPermission('tenant.settings.edit')}
                                        onSetFocus={() => handleSetFocus(p.id)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Lifecycle Lists */}
                {lifecycleSectionCount > 0 && (
                    <div id="list-area" className="projects-lifecycle mb-12">
                        <ProjectLifecycleSection
                            title={t('projects.sections.backlog.title').replace('{count}', String(backlogList.length))}
                            description={t('projects.sections.backlog.description')}
                            projects={backlogList}
                            renderRow={renderCompactProjectRow}
                        />
                        <ProjectLifecycleSection
                            title={t('projects.sections.paused.title').replace('{count}', String(pausedList.length))}
                            description={t('projects.sections.paused.description')}
                            projects={pausedList}
                            renderRow={renderCompactProjectRow}
                        />
                        <ProjectLifecycleSection
                            title={t('projects.sections.completed.title').replace('{count}', String(completedList.length))}
                            description={t('projects.sections.completed.description')}
                            projects={completedList}
                            renderRow={renderCompactProjectRow}
                        />
                        <ProjectLifecycleSection
                            title={t('projects.sections.canceled.title').replace('{count}', String(canceledList.length))}
                            description={t('projects.sections.canceled.description')}
                            projects={canceledList}
                            renderRow={renderCompactProjectRow}
                        />
                    </div>
                )}

                {filteredProjects.length === 0 && (
                    <div className="empty-state">
                        <span className="material-symbols-outlined">folder_off</span>
                        <h3>No projects found</h3>
                    </div>
                )}
            </div>

            <Modal
                isOpen={templateModalOpen}
                onClose={() => setTemplateModalOpen(false)}
                title={t('projects.templates.title')}
                size="xl"
            >
                <div className="template-configurator">
                    <div className="template-configurator__layout">
                        <aside className="template-configurator__list">
                            <div className="template-configurator__list-header">
                                <div>
                                    <span className="template-configurator__list-title">{t('projects.templates.list.title')}</span>
                                    <span className="template-configurator__list-subtitle">{t('projects.templates.list.subtitle')}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={<span className="material-symbols-outlined">add</span>}
                                    onClick={resetTemplateForm}
                                >
                                    {t('projects.templates.create')}
                                </Button>
                            </div>

                            {(!templatesLoaded && templatesLoading) ? (
                                <div className="template-configurator__skeleton">
                                    <div className="template-skeleton-card" />
                                    <div className="template-skeleton-card" />
                                    <div className="template-skeleton-card" />
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="template-configurator__empty">
                                    <p>{t('projects.templates.empty')}</p>
                                    <span>{t('projects.templates.emptyHint')}</span>
                                </div>
                            ) : (
                                <div className="template-configurator__list-body">
                                    {templates.map((template) => {
                                        const baseLabels = getLayoutCardLabels(template.baseLayout || DEFAULT_PROJECT_OVERVIEW_LAYOUT);
                                        return (
                                            <div
                                                key={template.id}
                                                className={`template-card ${template.id === editingTemplateId ? 'is-active' : ''}`.trim()}
                                                onClick={() => openTemplateEditor(template)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        openTemplateEditor(template);
                                                    }
                                                }}
                                            >
                                                <div className="template-card__header">
                                                    <div>
                                                        <span className="template-card__title">{template.name}</span>
                                                        {template.description && (
                                                            <span className="template-card__description">{template.description}</span>
                                                        )}
                                                    </div>
                                                    {template.autoApply && (
                                                        <span className="template-badge">{t('projects.templates.default.badge')}</span>
                                                    )}
                                                </div>
                                                <div className="template-card__layout">
                                                    {baseLabels.slice(0, 4).map((label) => (
                                                        <span key={`${template.id}-${label}`} className="template-chip">{label}</span>
                                                    ))}
                                                    {baseLabels.length > 4 && (
                                                        <span className="template-chip template-chip--muted">
                                                            +{baseLabels.length - 4}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="template-card__actions">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<span className="material-symbols-outlined">edit</span>}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openTemplateEditor(template);
                                                        }}
                                                    >
                                                        {t('projects.templates.edit')}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<span className="material-symbols-outlined">delete</span>}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void handleTemplateDelete(template);
                                                        }}
                                                    >
                                                        {t('projects.templates.delete')}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </aside>

                        <section className="template-configurator__editor">
                            <div className="template-editor__header">
                                <div>
                                    <span className="template-editor__title">
                                        {editingTemplateId ? t('projects.templates.form.title.edit') : t('projects.templates.form.title.new')}
                                    </span>
                                    <span className="template-editor__subtitle">{t('projects.templates.form.subtitle')}</span>
                                </div>
                                {templateForm.autoApply && (
                                    <span className="template-badge template-badge--accent">
                                        {t('projects.templates.default.badge')}
                                    </span>
                                )}
                            </div>

                            <div className="template-editor__form">
                                <div className="template-field">
                                    <label>{t('projects.templates.form.name.label')}</label>
                                    <input
                                        type="text"
                                        value={templateForm.name}
                                        placeholder={t('projects.templates.form.name.placeholder')}
                                        onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
                                    />
                                </div>
                                <div className="template-field">
                                    <label>{t('projects.templates.form.description.label')}</label>
                                    <textarea
                                        rows={3}
                                        value={templateForm.description}
                                        placeholder={t('projects.templates.form.description.placeholder')}
                                        onChange={(event) => setTemplateForm((prev) => ({ ...prev, description: event.target.value }))}
                                    />
                                </div>
                                <div className="template-field template-field--toggle">
                                    <div>
                                        <label>{t('projects.templates.form.autoApply.label')}</label>
                                        <span>{t('projects.templates.form.autoApply.help')}</span>
                                    </div>
                                    <button
                                        type="button"
                                        className={`template-toggle ${templateForm.autoApply ? 'is-on' : ''}`.trim()}
                                        onClick={() => setTemplateForm((prev) => ({ ...prev, autoApply: !prev.autoApply }))}
                                        aria-pressed={templateForm.autoApply}
                                    >
                                        <span className="template-toggle__thumb" />
                                    </button>
                                </div>
                            </div>

                            <div className="template-editor__section">
                                <div className="template-section__header">
                                    <div>
                                        <h3>{t('projects.templates.form.base.title')}</h3>
                                        <p>{t('projects.templates.form.base.help')}</p>
                                    </div>
                                </div>
                                <Select
                                    value={templateForm.baseSourceProjectId}
                                    options={projectLayoutOptions}
                                    onChange={(value) => handleBaseSourceChange(String(value))}
                                />
                                <div className="template-layout-preview">
                                    {getLayoutCardLabels(templateForm.baseLayout).map((label) => (
                                        <span key={`base-${label}`} className="template-chip">{label}</span>
                                    ))}
                                </div>
                            </div>

                            <div className="template-editor__section">
                                <div className="template-section__header">
                                    <div>
                                        <h3>{t('projects.templates.form.variants.title')}</h3>
                                        <p>{t('projects.templates.form.variants.help')}</p>
                                    </div>
                                </div>
                                <div className="template-variants">
                                    {PROJECT_STATUS_ORDER.map((status) => {
                                        const variant = templateForm.variants[status];
                                        return (
                                            <div key={status} className={`template-variant ${variant.enabled ? 'is-enabled' : ''}`.trim()}>
                                                <div className="template-variant__info">
                                                    <span className="template-variant__status">{getProjectStatusLabel(status)}</span>
                                                    <span className="template-variant__hint">{t('projects.templates.form.variants.statusHint')}</span>
                                                </div>
                                                <div className="template-variant__controls">
                                                    <button
                                                        type="button"
                                                        className={`template-toggle ${variant.enabled ? 'is-on' : ''}`.trim()}
                                                        onClick={() => handleVariantToggle(status)}
                                                        aria-pressed={variant.enabled}
                                                    >
                                                        <span className="template-toggle__thumb" />
                                                    </button>
                                                    <Select
                                                        value={variant.sourceProjectId}
                                                        options={variantLayoutOptions}
                                                        onChange={(value) => handleVariantSourceChange(status, String(value))}
                                                        disabled={!variant.enabled}
                                                    />
                                                </div>
                                                {variant.enabled && (
                                                    <div className="template-layout-preview template-layout-preview--compact">
                                                        {getLayoutCardLabels(variant.layout).map((label) => (
                                                            <span key={`${status}-${label}`} className="template-chip">{label}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="template-editor__actions">
                                <Button variant="ghost" onClick={() => setTemplateModalOpen(false)}>
                                    {t('projects.templates.form.actions.cancel')}
                                </Button>
                                <Button variant="primary" isLoading={templateSaving} onClick={handleTemplateSave}>
                                    {templateSaving ? t('projects.templates.form.actions.saving') : t('projects.templates.form.actions.save')}
                                </Button>
                            </div>
                        </section>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={importModalOpen}
                onClose={handleCloseImportModal}
                title={t('projects.import.modal.title')}
                closeOnOutsideClick={!isImportingProjects}
                footer={(
                    <div className="project-import__footer">
                        <Button variant="ghost" onClick={handleCloseImportModal} disabled={isImportingProjects}>
                            {t('projects.import.modal.cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleImportProjects}
                            isLoading={isImportingProjects}
                            disabled={isImportingProjects || !importFile || Boolean(importError) || importProjects.length === 0}
                        >
                            {isImportingProjects ? t('projects.import.modal.importing') : t('projects.import.modal.import')}
                        </Button>
                    </div>
                )}
            >
                <div className="project-import">
                    <p className="project-import__subtitle">{t('projects.import.modal.subtitle')}</p>

                    <div className="project-import__example">
                        <span className="project-import__example-label">{t('projects.import.modal.exampleLabel')}</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<span className="material-symbols-outlined">download</span>}
                            onClick={handleDownloadImportExample}
                        >
                            {t('projects.import.modal.exampleButton')}
                        </Button>
                    </div>

                    <div
                        className={`project-import__dropzone ${importError ? 'has-error' : ''}`.trim()}
                        role="button"
                        tabIndex={0}
                        onClick={() => importInputRef.current?.click()}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                importInputRef.current?.click();
                            }
                        }}
                    >
                        <input
                            ref={importInputRef}
                            type="file"
                            accept=".json,application/json"
                            className="project-import__file-input"
                            onChange={handleImportFileChange}
                            disabled={isImportingProjects}
                        />
                        <span className="material-symbols-outlined">upload_file</span>
                        <div className="project-import__dropzone-text">
                            <span className="project-import__dropzone-title">
                                {importFile
                                    ? t('projects.import.modal.fileSelected').replace('{name}', importFile.name)
                                    : t('projects.import.modal.fileLabel')}
                            </span>
                            <span className="project-import__dropzone-subtitle">
                                {t('projects.import.modal.fileHint')}
                            </span>
                        </div>
                    </div>

                    {importProjects.length > 0 && (
                        <div className="project-import__summary">
                            {t('projects.import.modal.projectCount').replace('{count}', String(importProjects.length))}
                        </div>
                    )}

                    {importError && (
                        <div className="project-import__error">{importError}</div>
                    )}

                    <p className="project-import__format-hint">
                        {t('projects.import.modal.formatHint')}
                    </p>
                </div>
            </Modal>

            <OnboardingOverlay
                isOpen={onboardingActive}
                steps={onboardingSteps}
                stepIndex={stepIndex}
                onStepChange={setStepIndex}
                onFinish={finish}
                onSkip={skip}
            />
        </div>
    );
};
