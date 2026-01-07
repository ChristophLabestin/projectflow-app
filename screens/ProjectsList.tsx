import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
    getAllWorkspaceProjects,
    getProjectMembers,
    getUserProfile,
    getUserTasks,
    getUserIdeas,
    getUserIssues,
    subscribeProjectMilestones,
    getProjectActivity
} from '../services/dataService';
import { subscribeProjectSprints } from '../services/sprintService';
import { collection, collectionGroup, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Project, Member, Task, Idea, Issue, Milestone, Activity, Sprint } from '../types';
import { Button } from '../components/common/Button/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/common/Badge/Badge';
import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { calculateSpotlightScore, SpotlightReason, calculateProjectHealth, HealthStatus, ProjectHealth } from '../services/healthService';
import { getTenant, setWorkspaceFocusProject, getActiveTenantId } from '../services/dataService';
import { Tenant } from '../types';
import './projects-list.scss';

// --- Types ---
export type ProjectMetrics = {
    taskCount: number;
    taskCompleted: number;
    flowCount: number;
    issueCount: number;
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
    criticalIssuesCount?: number;
    daysRemaining?: number;
    sprintCount?: number;
    onClick: () => void;
    mode?: 'spotlight' | 'focus';
}

const SpotlightHero: React.FC<SpotlightHeroProps> = ({
    project, metrics, healthStatus, healthScore, reasons,
    pendingTaskCount, completedTaskCount, nextMilestone,
    criticalIssuesCount = 0, daysRemaining, onClick,
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
                        {project.description || "The central hub for your team's work."}
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

                        <div className="pillar-unit">
                            <span className="pillar-label">Flows</span>
                            <div className="pillar-value-row">
                                <span className="material-symbols-outlined icon">lightbulb</span>
                                <span className="pillar-value">{metrics.flowCount || 0}</span>
                            </div>
                            <span className="pillar-sub">Ideas</span>
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
                        <span>{project.status || 'Active'}</span>
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
                            {project.description || "No description provided."}
                        </p>
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

                    {/* Flows */}
                    <div className="metric-single">
                        <span className="lbl">Flows</span>
                        <span className="val">
                            <span className="material-symbols-outlined">account_tree</span>
                            {metrics?.flowCount || 0}
                        </span>
                    </div>

                    {/* Issues */}
                    <div className="metric-single">
                        <span className="lbl">Issues</span>
                        <span className="val">
                            <span className="material-symbols-outlined">bug_report</span>
                            {metrics?.issueCount || 0}
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
                        <button
                            className={`btn-focus ${isFocus ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSetFocus();
                            }}
                        >
                            <span className="material-symbols-outlined">{isFocus ? 'push_pin' : 'keep'}</span>
                            {isFocus ? 'Focused' : 'Focus'}
                        </button>
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

// 3. Compact List Row
const CompactProjectRow: React.FC<{ project: Project; onClick: () => void }> = ({ project, onClick }) => {
    return (
        <div className="compact-row" onClick={onClick}>
            <div className="compact-status" title={project.status} />
            <span className="compact-key">{(project as any).key || 'PRJ'}</span>
            <span className="compact-title">{project.title}</span>
            <span className="compact-meta">{new Date(project.updatedAt?.seconds * 1000 || Date.now()).toLocaleDateString()}</span>
            <div className="compact-team">
                <TeamAvatars projectId={project.id} limit={2} />
            </div>
            <span className="compact-badge">{project.status}</span>
        </div>
    );
};

const ProjectStatsRow: React.FC<{ projects: Project[]; criticalCount: number; warningCount: number }> = ({ projects, criticalCount, warningCount }) => {
    const total = projects.length;
    const active = projects.filter(p => p.status === 'Active').length;
    const avgProgress = total > 0
        ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / total)
        : 0;

    return (
        <div className="stats-row-header">
            <div className="stat-card">
                <div className="stat-icon icon-blue"><span className="material-symbols-outlined">folder</span></div>
                <div className="stat-info">
                    <span className="stat-val">{total}</span>
                    <span className="stat-lbl">Total Projects</span>
                </div>
            </div>
            <div className="stat-card">
                <div className="stat-icon icon-green"><span className="material-symbols-outlined">bolt</span></div>
                <div className="stat-info">
                    <span className="stat-val">{active}</span>
                    <span className="stat-lbl">Active Work</span>
                </div>
            </div>
            <div className="stat-card">
                <div className="stat-icon icon-red"><span className="material-symbols-outlined">gpp_maybe</span></div>
                <div className="stat-info">
                    <span className="stat-val">{criticalCount}</span>
                    <span className="stat-lbl">Critical Issues</span>
                </div>
            </div>
            <div className="stat-card">
                <div className="stat-icon icon-purple"><span className="material-symbols-outlined">pie_chart</span></div>
                <div className="stat-info">
                    <span className="stat-val">{avgProgress}%</span>
                    <span className="stat-lbl">Avg. Completion</span>
                </div>
            </div>
        </div>
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

export const ProjectsList: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [ideas, setIdeas] = useState<Idea[]>([]); // Flows
    const [issues, setIssues] = useState<Issue[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const currentUser = auth.currentUser;
    const { can, hasPermission } = useWorkspacePermissions();
    const [focusProjectId, setFocusProjectId] = useState<string | null>(null);

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
        let mounted = true;
        const load = async () => {
            try {
                const [allProjects, allTasks, allIdeas, allIssues] = await Promise.all([
                    getAllWorkspaceProjects(),
                    getUserTasks(),
                    getUserIdeas(),
                    getUserIssues()
                ]);
                if (mounted) {
                    setProjects(allProjects);
                    setTasks(allTasks);
                    setIdeas(allIdeas);
                    setIssues(allIssues);
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();

        // Subscribe to all milestones and sprints in the workspace for current tenant
        const activeTenantId = getActiveTenantId();
        if (activeTenantId) {
            const milestonesQuery = query(collectionGroup(db, 'milestones'), where('tenantId', '==', activeTenantId));
            const sprintsQuery = query(collectionGroup(db, 'sprints'), where('tenantId', '==', activeTenantId));

            const unsubMilestones = onSnapshot(milestonesQuery, (snap) => {
                if (mounted) setMilestones(snap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)));
            });
            const unsubSprints = onSnapshot(sprintsQuery, (snap) => {
                if (mounted) setSprints(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sprint)));
            });

            return () => {
                mounted = false;
                unsubMilestones();
                unsubSprints();
            };
        }

        return () => { mounted = false; };
    }, []);

    // Helper to get metrics for a project
    const getMetrics = (projectId: string): ProjectMetrics => {
        const projectTasks = tasks.filter(t => t.projectId === projectId);
        return {
            taskCount: projectTasks.length,
            taskCompleted: projectTasks.filter(t => t.isCompleted).length,
            flowCount: ideas.filter(i => i.projectId === projectId).length,
            issueCount: issues.filter(i => i.projectId === projectId).length
        };
    };

    const filteredProjects = useMemo(() => {
        if (!currentUser) return [];
        return projects.filter(p => {
            const isMember = !p.isPrivate || p.ownerId === currentUser.uid || (p.memberIds || []).includes(currentUser.uid);
            if (!isMember) return false;
            if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        }).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    }, [projects, currentUser, search]);

    const activeList = useMemo(() =>
        filteredProjects.filter(p => p.status === 'Active'),
        [filteredProjects]);

    const inactiveList = useMemo(() =>
        filteredProjects.filter(p => p.status !== 'Active'),
        [filteredProjects]);

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

    // Compute health for all active projects
    const projectHealthMap = useMemo(() => {
        const healthMap: Record<string, ProjectHealth> = {};
        activeList.forEach(project => {
            const projectTasks = tasks.filter(t => t.projectId === project.id);
            const projectIssues = issues.filter(i => i.projectId === project.id);
            const projectMilestones = milestones.filter(m => m.projectId === project.id);
            const projectSprints = sprints.filter(s => s.projectId === project.id);
            healthMap[project.id] = calculateProjectHealth(project, projectTasks, projectMilestones, projectIssues, projectSprints);
        });
        return healthMap;
    }, [activeList, tasks, issues, milestones, sprints]);

    // Calculate spotlight data for the manually focused project
    const manualFocusSpotlightData = useMemo(() => {
        if (!manualFocusProject) return null;
        const projectTasks = tasks.filter(t => t.projectId === manualFocusProject.id);
        const projectIssues = issues.filter(i => i.projectId === manualFocusProject.id);
        const projectMilestones = milestones.filter(m => m.projectId === manualFocusProject.id);
        const projectSprints = sprints.filter(s => s.projectId === manualFocusProject.id);

        const score = calculateSpotlightScore(manualFocusProject, projectTasks, projectMilestones, projectIssues, projectSprints);
        const health = projectHealthMap[manualFocusProject.id] || calculateProjectHealth(manualFocusProject, projectTasks, projectMilestones, projectIssues, projectSprints);
        return {
            reasons: score.reasons,
            score: score.score,
            health: health
        };
    }, [manualFocusProject, tasks, issues, projectHealthMap, milestones, sprints]);

    // Count critical/warning projects
    const { criticalCount, warningCount } = useMemo(() => {
        let critical = 0;
        let warning = 0;
        Object.values(projectHealthMap).forEach(health => {
            if (health.status === 'critical') critical++;
            else if (health.status === 'warning') warning++;
        });
        return { criticalCount: critical, warningCount: warning };
    }, [projectHealthMap]);

    // Spotlight Logic: Uses enhanced algorithm to select most critical/urgent project
    const spotlightData = useMemo(() => {
        if (activeList.length === 0) return null;

        // Calculate spotlight scores for all active projects
        const scores = activeList.map(project => {
            const projectTasks = tasks.filter(t => t.projectId === project.id);
            const projectIssues = issues.filter(i => i.projectId === project.id);
            const projectMilestones = milestones.filter(m => m.projectId === project.id);
            const projectSprints = sprints.filter(s => s.projectId === project.id);

            const score = calculateSpotlightScore(project, projectTasks, projectMilestones, projectIssues, projectSprints);
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
    }, [activeList, tasks, issues, projectHealthMap, milestones, sprints]);

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
        { id: 'list', targetId: 'list-area', title: 'Backlog', description: 'Projects on hold or planning.' },
    ];
    const { onboardingActive, stepIndex, setStepIndex, skip, finish } = useOnboardingTour('projects_rich', { stepCount: onboardingSteps.length, autoStart: true, enabled: !loading });

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Workspace...</div>;

    return (
        <div className="rich-page">
            <header className="rich-header-container">
                <div className="rich-header-top">
                    <h1>Projects</h1>
                    <div className="header-actions">
                        <div className="search-pill">
                            <span className="material-symbols-outlined">search</span>
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        {can('canCreateProjects') && (
                            <Link to="/create"><Button variant="primary" icon={<span className="material-symbols-outlined">add</span>}>New Project</Button></Link>
                        )}
                    </div>
                </div>

                <ProjectStatsRow projects={filteredProjects} criticalCount={criticalCount} warningCount={warningCount} />
            </header>

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
                            criticalIssuesCount={getMetrics(manualFocusProject.id).issueCount}
                            sprintCount={focusSprints.length}
                            onClick={() => navigate(`/project/${manualFocusProject.id}`)}
                            mode="focus"
                        />
                    </div>
                )}

                {/* Health Warning Strip (Optional, if user wants repeated warnings, but Spotlight covers it mostly) */}
                {/* We can integrate it if multiple criticals exist? User asked for Spotlight Glow. */}

                {/* Active Grid */}
                {gridProjects.length > 0 && (
                    <div id="grid-area" className="mb-12">
                        <h2 className="section-title">Active Projects ({gridProjects.length})</h2>
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

                {/* Inactive List */}
                {(inactiveList.length > 0) && (
                    <div id="list-area" className="mb-12">
                        <h2 className="section-title">On Hold & Backlog ({inactiveList.length})</h2>
                        <div className="compact-list">
                            {inactiveList.map(p => (
                                <CompactProjectRow
                                    key={p.id}
                                    project={p}
                                    onClick={() => navigate(`/project/${p.id}`)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {filteredProjects.length === 0 && (
                    <div className="empty-state">
                        <span className="material-symbols-outlined">folder_off</span>
                        <h3>No projects found</h3>
                    </div>
                )}
            </div>

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
