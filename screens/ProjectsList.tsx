import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useLanguage } from '../context/LanguageContext';
import { getAllWorkspaceProjects } from '../services/dataService';
import { auth } from '../services/firebase';
import { Project, Member, Milestone, Task, Issue } from '../types';
import { toMillis } from '../utils/time';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { getProjectMembers, subscribeProjectTasks, subscribeProjectMilestones, getUserProfile, subscribeProjectIssues, getWorkspaceGroups } from '../services/dataService';
import { calculateProjectHealth, ProjectHealth, calculateSpotlightScore, calculateWorkspaceHealth } from '../services/healthService';
import { HealthIndicator } from '../components/project/HealthIndicator';
import { getHealthFactorText, interpolate } from '../utils/healthLocalization';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';

const getProjectStatusLabel = (status: string, t: (key: string, fallback?: string) => string) => {
    const labels: Record<string, string> = {
        Active: t('dashboard.projectStatus.active'),
        Planning: t('dashboard.projectStatus.planning'),
        Brainstorming: t('dashboard.projectStatus.brainstorming'),
        Completed: t('dashboard.projectStatus.completed'),
        'On Hold': t('dashboard.projectStatus.onHold')
    };
    return labels[status] || status;
};

const MemberAvatars: React.FC<{ projectId: string }> = ({ projectId }) => {
    const { t } = useLanguage();
    const [members, setMembers] = useState<Member[]>([]);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const memberIds = await getProjectMembers(projectId);
                const memberPromises = memberIds.map(id => getUserProfile(id));
                const memberProfiles = await Promise.all(memberPromises);
                setMembers(memberProfiles.filter((m): m is Member => !!m));
            } catch (err) {
                console.error("Failed to fetch project members", err);
            }
        };
        fetchMembers();
    }, [projectId]);

    if (members.length === 0) return null;

    return (
        <div className="flex items-center -space-x-2">
            {members.slice(0, 3).map((member, i) => (
                <div
                    key={member.uid || i}
                    className="size-7 rounded-full border-2 border-[var(--color-surface-paper)] overflow-hidden bg-[var(--color-surface-hover)] shadow-sm"
                    title={member.displayName || t('projectsList.member')}
                >
                    {member.photoURL ? (
                        <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)]">
                            {(member.displayName || '?').charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            ))}
            {members.length > 3 && (
                <div className="size-7 rounded-full border-2 border-[var(--color-surface-paper)] bg-[var(--color-surface-hover)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] shadow-sm">
                    +{members.length - 3}
                </div>
            )}
        </div>
    );
};

const ProjectCard: React.FC<{
    project: Project;
    health: ProjectHealth;
    isSpotlighted?: boolean;
}> = ({ project, health, isSpotlighted = false }) => {
    const { dateFormat, t, dateLocale } = useLanguage();
    const healthState = health.status === 'excellent' || health.status === 'healthy' ? 'success' :
        health.status === 'warning' ? 'warning' :
            health.status === 'critical' ? 'critical' : 'normal';
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const isBrainstorming = project.status === 'Brainstorming' || project.status === 'Planning';
    const isCompleted = project.status === 'Completed';
    const statusLabel = getProjectStatusLabel(project.status, t);
    const primaryFactorLabel = health.factors[0] ? getHealthFactorText(health.factors[0], t).label : '';

    useEffect(() => {
        return subscribeProjectTasks(project.id, setTasks, project.tenantId);
    }, [project.id, project.tenantId]);

    const progress = useMemo(() => {
        if (tasks.length === 0) return project.progress || 0;
        const completedCount = tasks.filter(t => t.isCompleted || t.status === 'Done').length;
        return Math.round((completedCount / tasks.length) * 100);
    }, [tasks, project.progress]);

    let icon = 'folder';
    let iconColorClass = 'text-indigo-500';
    let segClass = 'active-indigo';

    if (isBrainstorming) {
        icon = 'lightbulb';
        iconColorClass = 'text-amber-500';
        segClass = 'active-amber';
    } else if (isCompleted) {
        icon = 'check_circle';
        iconColorClass = 'text-emerald-500';
        segClass = 'active-emerald';
    }

    if (healthState === 'critical') {
        segClass = 'active-rose';
    } else if (healthState === 'warning') {
        segClass = 'active-amber';
    }

    const healthRingClass = healthState === 'critical' ? 'health-ring-critical animate-pulse-ring' :
        healthState === 'warning' ? 'health-ring-warning animate-pulse-ring' :
            healthState === 'success' ? 'health-ring-success' : '';

    const borderClass = healthState === 'critical' ? 'ring-1 ring-rose-500/50' :
        healthState === 'warning' ? 'ring-1 ring-amber-500/50' :
            healthState === 'success' ? 'ring-1 ring-emerald-500/30' : '';

    const shadowClass = healthState === 'critical' ? 'shadow-[0_10px_40px_-10px_rgba(244,63,94,0.4)]' :
        healthState === 'warning' ? 'shadow-[0_10px_40px_-10px_rgba(245,158,11,0.4)]' :
            healthState === 'success' ? 'shadow-[0_10px_40px_-10px_rgba(16,185,129,0.3)]' :
                'shadow-xl';

    return (
        <div onClick={() => navigate(`/project/${project.id}`)} className="cursor-pointer h-full group perspective-1000">
            <div className={`glass-card h-full flex flex-col relative rounded-3xl overflow-hidden transition-all duration-700 group-hover:-translate-y-2 group-hover:rotate-x-1 hover:shadow-2xl sweep-effect ${borderClass} ${shadowClass}`}>

                {/* Dynamic Background Glow - Subtle & Focused on Algorithm-Marked Projects */}
                {(healthState !== 'normal' || isSpotlighted) && (
                    <div className={`absolute -top-24 -right-24 size-64 rounded-full blur-[100px] opacity-10 transition-all duration-700 group-hover:opacity-20 ${healthState === 'critical' ? 'bg-rose-500/40' :
                        healthState === 'warning' ? 'bg-amber-500/40' :
                            healthState === 'success' ? 'bg-emerald-500/40' : 'bg-indigo-500/40'
                        }`} />
                )}

                {project.coverImage ? (
                    <div className="h-40 w-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface-card)] via-transparent to-transparent z-10" />
                        <img src={project.coverImage} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="" />
                    </div>
                ) : (
                    <div className="h-20 w-full" />
                )}

                <div className="px-6 pb-6 flex flex-col flex-1 relative z-20">
                    {/* Floating Icon Header */}
                    <div className="flex justify-between items-end -mt-10 mb-4">
                        <div className={`size-16 rounded-2xl flex items-center justify-center bg-white dark:bg-slate-800 shadow-2xl border-2 border-white dark:border-slate-700 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 ${healthRingClass}`}>
                            {project.squareIcon ? (
                                <img src={project.squareIcon} alt="" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                                <span className={`material-symbols-outlined text-4xl ${iconColorClass}`}>{icon}</span>
                            )}
                        </div>
                        <div className="pb-1">
                            <Badge variant={isCompleted ? 'success' : isBrainstorming ? 'secondary' : 'primary'} className="font-black text-[10px] tracking-widest uppercase px-3 py-1 glass-card border-white/20 shadow-lg">
                                {statusLabel}
                            </Badge>
                        </div>
                    </div>

                    <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                            {health.status === 'critical' && (
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter flex items-center gap-1 animate-pulse">
                                    <span className="material-symbols-outlined text-xs">priority_high</span> {t('projectsList.health.critical')}: {primaryFactorLabel || t('projectsList.health.needsAttention')}
                                </span>
                            )}
                            <div className="flex items-center justify-between gap-4">
                                <h3 className="text-2xl font-black text-[var(--color-text-main)] transition-all duration-500 group-hover:translate-x-1 group-hover:text-[var(--color-primary)] tracking-tight leading-none truncate">
                                    {project.title}
                                </h3>
                                <HealthIndicator health={health} size="sm" showLabel={false} />
                            </div>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 leading-relaxed font-medium min-h-[3rem]">
                            {project.description || t('projectsList.card.defaultDescription')}
                        </p>
                    </div>

                    {/* Advanced Progress Terminal */}
                    <div className="mt-6 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-[var(--color-text-subtle)] uppercase tracking-widest">{t('projectsList.metrics.efficiency')}</span>
                                <span className={`text-sm font-black ${iconColorClass}`}>{progress}%</span>
                            </div>
                            {project.dueDate && (
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black text-[var(--color-text-subtle)] uppercase tracking-widest text-right">{t('projectsList.metrics.deadline')}</span>
                                    <span className="text-xs font-bold text-[var(--color-text-main)] bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-md border border-white/10">{format(new Date(project.dueDate), dateFormat, { locale: dateLocale })}</span>
                                </div>
                            )}
                        </div>

                        {/* Segmented Progress Bar */}
                        <div className="segmented-progress">
                            {Array.from({ length: 12 }).map((_, i) => {
                                const step = 100 / 12;
                                const isActive = progress > (i * step);
                                return (
                                    <div
                                        key={i}
                                        className={`progress-segment ${isActive ? segClass : 'opacity-20'}`}
                                        style={{ transitionDelay: `${i * 30}ms` }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Tactical Footer */}
                <div className="px-6 py-4 bg-white/30 dark:bg-black/20 backdrop-blur-md border-t border-white/10 flex items-center justify-between mt-auto">
                    <MemberAvatars projectId={project.id} />
                    <button className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase py-2 px-4 rounded-xl bg-[var(--color-text-main)] text-[var(--color-surface-card)] shadow-lg transition-all duration-500 group-hover:gap-4 group-hover:scale-105 active:scale-95">
                        {t('projectsList.actions.launch')} <span className="material-symbols-outlined text-lg">rocket_launch</span>
                    </button>
                </div>
            </div>
        </div>
    );
};


const ProjectSpotlight: React.FC<{ project: Project; health: ProjectHealth; spotlightReason?: string }> = ({ project, health, spotlightReason }) => {
    const { dateFormat, t, dateLocale } = useLanguage();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);

    // Convert health status to legacy states for theme selection
    const state = health.status === 'excellent' || health.status === 'healthy' ? 'success' :
        health.status === 'warning' ? 'warning' :
            health.status === 'critical' ? 'critical' : 'normal';
    const primaryFactorDescription = health.factors[0]
        ? getHealthFactorText(health.factors[0], t).description
        : '';

    useEffect(() => {
        return subscribeProjectTasks(project.id, setTasks, project.tenantId);
    }, [project.id, project.tenantId]);

    const { progress, doneCount, pendingCount } = useMemo(() => {
        if (tasks.length === 0) return { progress: project.progress || 0, doneCount: 0, pendingCount: 0 };
        const done = tasks.filter(t => t.isCompleted || t.status === 'Done').length;
        return {
            progress: Math.round((done / tasks.length) * 100),
            doneCount: done,
            pendingCount: tasks.length - done
        };
    }, [tasks, project.progress]);

    // Theme configuration based on state
    const themes = {
        critical: {
            badge: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30',
            badgeIcon: 'warning',
            badgeText: t('projectsList.spotlight.badge.urgent'),
            statusDot: 'bg-rose-500',
            gradient: 'from-rose-50 to-red-50 dark:from-rose-900 dark:via-red-900 dark:to-slate-900',
            progressBar: 'from-rose-500 via-red-500 to-orange-500',
            border: 'border-rose-200 dark:border-rose-500/20',
            shadow: 'shadow-[0_15px_50px_-12px_rgba(244,63,94,0.6)]'
        },
        warning: {
            badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
            badgeIcon: 'schedule',
            badgeText: t('projectsList.spotlight.badge.deadlineSoon'),
            statusDot: 'bg-amber-500',
            gradient: 'from-amber-50 to-orange-50 dark:from-amber-900 dark:via-orange-900 dark:to-slate-900',
            progressBar: 'from-amber-500 via-orange-500 to-yellow-500',
            border: 'border-amber-200 dark:border-amber-500/20',
            shadow: 'shadow-[0_15px_50px_-12px_rgba(245,158,11,0.6)]'
        },
        success: {
            badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
            badgeIcon: 'check_circle',
            badgeText: t('projectsList.spotlight.badge.almostDone'),
            statusDot: 'bg-emerald-500',
            gradient: 'from-emerald-50 to-green-50 dark:from-emerald-900 dark:via-green-900 dark:to-slate-900',
            progressBar: 'from-emerald-500 via-green-500 to-teal-500',
            border: 'border-emerald-200 dark:border-emerald-500/20',
            shadow: 'shadow-[0_15px_50px_-12px_rgba(16,185,129,0.5)]'
        },
        normal: {
            badge: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-white/10 dark:text-white dark:border-white/20',
            badgeIcon: 'auto_awesome',
            badgeText: t('projectsList.spotlight.badge.spotlight'),
            statusDot: 'bg-emerald-500',
            gradient: 'from-indigo-50 to-purple-50 dark:from-indigo-900 dark:via-purple-900 dark:to-slate-900',
            progressBar: 'from-indigo-500 via-purple-500 to-pink-500',
            border: 'border-slate-200 dark:border-transparent',
            shadow: 'shadow-[0_15px_40px_-10px_rgba(99,102,241,0.5)]'
        },
    };

    const theme = themes[state];

    return (
        <div
            className={`w-full relative z-10 rounded-3xl ${theme.shadow} group cursor-pointer transition-all duration-500 hover:scale-[1.01]`}
            onClick={() => navigate(`/project/${project.id}`)}
        >
            <div className={`w-full relative rounded-3xl overflow-hidden border ${theme.border} transform-gpu [backface-visibility:hidden] [mask-image:linear-gradient(white,white)] isolate bg-white dark:bg-[var(--color-surface-card)]`}>
                {/* Background */}
                <div className="absolute inset-0 z-0">
                    {project.coverImage ? (
                        <>
                            <img
                                src={project.coverImage}
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                alt=""
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent dark:hidden" />
                        </>
                    ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${theme.gradient}`} />
                    )}
                    <div className="hidden dark:block absolute inset-0 bg-slate-950/40 mix-blend-multiply" />
                    <div className="hidden dark:block absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
                </div>

                <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row gap-8 items-start min-h-[320px]">
                    <div className="flex-1 space-y-5">
                        <div className="flex items-center gap-3">
                            <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 backdrop-blur-md ${theme.badge}`}>
                                <span className="material-symbols-outlined text-sm">{theme.badgeIcon}</span>
                                {theme.badgeText}
                            </div>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-white/80 uppercase tracking-wider backdrop-blur-sm px-2 py-1 rounded-full">
                                <span className={`size-2 rounded-full ${theme.statusDot} animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]`} />
                                {health.status === 'critical'
                                    ? t('projectsList.spotlight.status.actionRequired')
                                    : health.status === 'warning'
                                        ? t('projectsList.spotlight.status.attentionNeeded')
                                        : health.status === 'excellent'
                                            ? t('projectsList.spotlight.status.peakPerformance')
                                            : t('projectsList.spotlight.status.activeNow')}
                            </span>
                        </div>

                        <div className="flex items-center gap-4 mb-2">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]">{t('projectsList.spotlight.reasonLabel')}</div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                                    {spotlightReason || primaryFactorDescription || t('projectsList.spotlight.defaultReason')}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 max-w-2xl">
                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tighter leading-[0.9] drop-shadow-sm">
                                {project.title}
                            </h2>
                            <p className="text-lg text-slate-600 dark:text-white/80 line-clamp-2 leading-relaxed font-medium max-w-xl">
                                {project.description || t('projectsList.spotlight.noDescription')}
                            </p>
                        </div>

                        {/* Chips / Tags */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            {/* Deadline Chip - Highlighted if urgent */}
                            <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${state === 'critical' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300' :
                                state === 'warning' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                                    'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70'
                                }`}>
                                <span className="material-symbols-outlined text-sm">schedule</span>
                                {project.dueDate ? format(new Date(project.dueDate), dateFormat, { locale: dateLocale }) : t('projectsList.spotlight.noDeadline')}
                            </div>

                            {/* Priority Chip */}
                            {(() => {
                                const priority = project.priority || 'Medium';
                                const priorityLabels: Record<string, string> = {
                                    High: t('tasks.priority.high'),
                                    Medium: t('tasks.priority.medium'),
                                    Low: t('tasks.priority.low')
                                };
                                const priorityLabel = priorityLabels[priority] || priority;
                                const priorityStyles = {
                                    'High': 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300',
                                    'Medium': 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
                                    'Low': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
                                };
                                const style = priorityStyles[priority as keyof typeof priorityStyles] || priorityStyles['Medium'];
                                return (
                                    <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${style}`}>
                                        <span className="material-symbols-outlined text-sm">flag</span>
                                        {priorityLabel}
                                    </div>
                                );
                            })()}

                            {/* Team Avatars */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-white/50 uppercase tracking-wider">{t('projectsList.spotlight.team')}</span>
                                <MemberAvatars projectId={project.id} />
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-auto flex flex-col gap-4 min-w-[300px] backdrop-blur-xl bg-white/60 dark:bg-white/5 p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg">
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-white/60 uppercase tracking-wider">{t('projectsList.spotlight.progress')}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{progress}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-2 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full bg-gradient-to-r ${theme.progressBar} shadow-sm relative`}
                                    style={{ width: `${progress}%` }}
                                >
                                    <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/50" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-white/5">
                            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5">
                                <span className="block text-2xl font-bold text-slate-800 dark:text-white">{pendingCount}</span>
                                <span className="text-[10px] text-slate-500 dark:text-white/50 uppercase font-bold">{t('projectsList.spotlight.pending')}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5">
                                <span className="block text-2xl font-bold text-emerald-600 dark:text-emerald-400">{doneCount}</span>
                                <span className="text-[10px] text-slate-500 dark:text-white/50 uppercase font-bold">{t('projectsList.spotlight.done')}</span>
                            </div>
                        </div>

                        <Button
                            size="lg"
                            className={`w-full h-12 rounded-xl border-none font-bold text-sm shadow-xl mt-1 ${state === 'critical' ? 'bg-rose-600 text-white hover:bg-rose-700' :
                                state === 'warning' ? 'bg-amber-500 text-white hover:bg-amber-600' :
                                    'bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:opacity-90'
                                }`}
                            icon={<span className="material-symbols-outlined text-lg">arrow_forward</span>}
                        >
                            {state === 'critical'
                                ? t('projectsList.actions.takeAction')
                                : state === 'warning'
                                    ? t('projectsList.actions.reviewNow')
                                    : t('projectsList.actions.openProject')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};


export const ProjectsList = () => {
    const { dateFormat, t, dateLocale } = useLanguage();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSuggestion, setShowSuggestion] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'planning' | 'completed'>('all');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<'activity' | 'recent' | 'due' | 'progress'>('activity');

    const currentUser = auth.currentUser;
    const { can, isOwner } = useWorkspacePermissions();
    const [userGroupIds, setUserGroupIds] = useState<string[]>([]);

    // Fetch user's allowed groups directly from WorkspaceGroups to be safe
    useEffect(() => {
        if (!currentUser) return;
        getWorkspaceGroups().then(groups => {
            const myGroups = groups.filter(g => g.memberIds.includes(currentUser.uid)).map(g => g.id);
            setUserGroupIds(myGroups);
        }).catch(err => console.warn('Failed to fetch groups', err));
    }, [currentUser]);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                // Fetch ALL projects in the tenant
                const allProjects = await getAllWorkspaceProjects();

                // Filter checks happen in render/memo, but we can also filter here if we want to secure "projects" state
                // However, "projects" is used for "allProjects" calculation.
                // We should filter it before setting state or in the useMemo.
                setProjects(allProjects);
            } catch (error) {
                console.error('Failed to fetch projects', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    // State for milestones, tasks and issues per project (for advanced health scoring)
    const [projectMilestones, setProjectMilestones] = useState<Record<string, Milestone[]>>({});
    const [projectTasks, setProjectTasks] = useState<Record<string, Task[]>>({});
    const [projectIssues, setProjectIssues] = useState<Record<string, Issue[]>>({});

    // Subscribe to milestones and tasks for all projects in myProjects
    useEffect(() => {
        if (!currentUser || projects.length === 0) return;

        const myProjectIds = projects
            .filter(p => p.ownerId === currentUser.uid || (p.memberIds || []).includes(currentUser.uid))
            .filter(p => p.status !== 'Completed')
            .map(p => ({ id: p.id, tenantId: p.tenantId }));

        const unsubscribes: (() => void)[] = [];

        // Subscribe to milestones for each project
        myProjectIds.forEach(({ id, tenantId }) => {
            const unsubMilestones = subscribeProjectMilestones(id, (milestones) => {
                setProjectMilestones(prev => ({ ...prev, [id]: milestones }));
            }, tenantId);
            unsubscribes.push(unsubMilestones);

            const unsubTasks = subscribeProjectTasks(id, (tasks) => {
                setProjectTasks(prev => ({ ...prev, [id]: tasks }));
            }, tenantId);
            unsubscribes.push(unsubTasks);

            const unsubIssues = subscribeProjectIssues(id, (issues) => {
                setProjectIssues(prev => ({ ...prev, [id]: issues }));
            }, tenantId);
            unsubscribes.push(unsubIssues);
        });

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [projects, currentUser]);

    // Split projects into "My Projects" and "Other Projects"
    const { myProjects, otherProjects } = useMemo(() => {
        if (!currentUser) return { myProjects: [], otherProjects: [] };

        const my: Project[] = [];
        const other: Project[] = [];

        projects.forEach(p => {
            const isMember = p.ownerId === currentUser.uid || (p.memberIds || []).includes(currentUser.uid);

            // Private Project Check: Only visible to members/owner
            if (p.isPrivate) {
                if (isMember) {
                    my.push(p);
                }
                return;
            }

            // Visibility Check
            if (p.visibilityGroupIds && p.visibilityGroupIds.length > 0) {
                if (!isOwner && !p.visibilityGroupIds.some(id => userGroupIds.includes(id))) {
                    return; // Skip hidden projects
                }
            } else if (p.visibilityGroupId) {
                if (!isOwner && !userGroupIds.includes(p.visibilityGroupId)) {
                    return; // Skip hidden projects
                }
            }

            if (isMember) {
                my.push(p);
            } else {
                other.push(p);
            }
        });

        return { myProjects: my, otherProjects: other };
    }, [projects, currentUser, isOwner, userGroupIds]);

    // Filtering logic for My Projects
    const filteredMyProjects = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        const matchesFilter = (project: Project) => {
            if (filter === 'active') return project.status === 'Active';
            if (filter === 'planning') return project.status === 'Brainstorming' || project.status === 'Planning';
            if (filter === 'completed') return project.status === 'Completed';
            return true;
        };

        const matchesSearch = (project: Project) => {
            if (!normalizedSearch) return true;
            return [project.title, project.description].some((value) => (value || '').toLowerCase().includes(normalizedSearch));
        };

        return [...myProjects]
            .filter((project) => matchesFilter(project) && matchesSearch(project))
            .sort((a, b) => {
                if (sort === 'progress') return (b.progress || 0) - (a.progress || 0);
                if (sort === 'due') {
                    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
                    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
                    return aDue - bDue;
                }
                if (sort === 'recent') {
                    return toMillis(b.createdAt) - toMillis(a.createdAt);
                }
                // Default: activity (updatedAt)
                const aUpdated = a.updatedAt ? toMillis(a.updatedAt) : toMillis(a.createdAt);
                const bUpdated = b.updatedAt ? toMillis(b.updatedAt) : toMillis(b.createdAt);
                return bUpdated - aUpdated;
            });
    }, [myProjects, filter, search, sort]);

    // Advanced Intelligent Spotlight and Health Selection
    const { featuredProject, spotlightHealth, projectHealthMap, spotlightReason, workspaceHealth } = useMemo(() => {
        if (myProjects.length === 0) return { featuredProject: null, spotlightHealth: null, projectHealthMap: {} as Record<string, ProjectHealth>, spotlightReason: '', workspaceHealth: null };

        const healthMap: Record<string, ProjectHealth> = {};

        // Calculate health for all projects
        myProjects.forEach(project => {
            healthMap[project.id] = calculateProjectHealth(
                project,
                projectTasks[project.id] || [],
                projectMilestones[project.id] || [],
                projectIssues[project.id] || []
            );
        });

        const activeSubscribedProjects = myProjects.filter(p => p.status !== 'Completed');

        if (activeSubscribedProjects.length === 0) {
            return {
                featuredProject: myProjects[0],
                spotlightHealth: healthMap[myProjects[0].id],
                projectHealthMap: healthMap,
                spotlightReason: t('projectsList.spotlight.onlyAvailable')
            };
        }

        // Spotlight Selection: Strict Deadline/Urgency Priority
        let maxScore = -9999;
        let winner: Project | null = null;
        let winnerReason = '';
        let winnerReasonKey: string | undefined;
        let winnerReasonMeta: Record<string, number | string> | undefined;

        activeSubscribedProjects.forEach(p => {
            const { score, reason, reasonKey, reasonMeta } = calculateSpotlightScore(
                p,
                projectTasks[p.id] || [],
                projectMilestones[p.id] || [],
                projectIssues[p.id] || []
            );
            if (score > maxScore) {
                maxScore = score;
                winner = p;
                winnerReason = reason;
                winnerReasonKey = reasonKey;
                winnerReasonMeta = reasonMeta;
            }
        });

        const selectedWinner = winner || activeSubscribedProjects[0];

        const workspaceHealth = calculateWorkspaceHealth(activeSubscribedProjects, healthMap);

        return {
            featuredProject: selectedWinner,
            spotlightHealth: healthMap[selectedWinner.id],
            projectHealthMap: healthMap,
            spotlightReason: winnerReasonKey
                ? interpolate(
                    t(winnerReasonKey, winnerReason || t('projectsList.spotlight.defaultReason')),
                    winnerReasonMeta
                )
                : (winnerReason || t('projectsList.spotlight.defaultReason')),
            workspaceHealth
        };
    }, [myProjects, projectMilestones, projectTasks, projectIssues, t]);

    const filterCounts = {
        all: myProjects.length,
        active: myProjects.filter((p) => p.status === 'Active').length,
        planning: myProjects.filter((p) => p.status === 'Brainstorming' || p.status === 'Planning').length,
        completed: myProjects.filter((p) => p.status === 'Completed').length
    };

    const filterLabels = useMemo(() => ({
        all: t('projectsList.filters.all'),
        active: t('projectsList.filters.active'),
        planning: t('projectsList.filters.planning'),
        completed: t('projectsList.filters.completed')
    }), [t]);

    const onboardingSteps = useMemo<OnboardingStep[]>(() => ([
        {
            id: 'header',
            targetId: 'projects-list-header',
            title: t('projectsList.onboarding.header.title'),
            description: t('projectsList.onboarding.header.description')
        },
        {
            id: 'spotlight',
            targetId: 'projects-list-spotlight',
            title: t('projectsList.onboarding.spotlight.title'),
            description: t('projectsList.onboarding.spotlight.description'),
            placement: 'top'
        },
        {
            id: 'filters',
            targetId: 'projects-list-toolbar',
            title: t('projectsList.onboarding.filters.title'),
            description: t('projectsList.onboarding.filters.description'),
            placement: 'top'
        },
        {
            id: 'cards',
            targetId: 'projects-list-grid',
            title: t('projectsList.onboarding.cards.title'),
            description: t('projectsList.onboarding.cards.description'),
            placement: 'top'
        },
        {
            id: 'other-projects',
            targetId: 'projects-list-other',
            title: t('projectsList.onboarding.other.title'),
            description: t('projectsList.onboarding.other.description')
        }
    ]), [t]);

    const {
        onboardingActive,
        stepIndex,
        setStepIndex,
        skip,
        finish
    } = useOnboardingTour('projects_list', { stepCount: onboardingSteps.length, autoStart: true, enabled: !loading });


    if (loading) return (
        <div className="flex items-center justify-center p-12" >
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div >
    );

    return (
        <>
            <div className="space-y-6 pb-12 fade-in">
                {/* Split Header with stats and actions matched to Dashboard */}
                <div data-onboarding-id="projects-list-header" className="flex flex-col md:flex-row justify-between gap-8 mb-6 mt-0">
                    {/* Left Side: Title */}
                    <div className="flex flex-col justify-end">
                        <div className="flex items-center gap-2 text-[var(--color-primary)] font-bold uppercase tracking-wider text-xs mb-2">
                            <span className="material-symbols-outlined text-sm">domain</span>
                            {t('nav.workspace')}
                        </div>
                        {/* Typography matched to Dashboard */}
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--color-text-main)] tracking-tight mb-2">
                            {t('nav.projects')}
                        </h1>
                        <p className="text-[var(--color-text-muted)] font-medium max-w-xl">
                            {t('projectsList.header.subtitle')}
                        </p>
                    </div>

                    {/* Right Side: Stats Only */}
                    <div className="flex flex-row items-end gap-4">
                        {/* Stats Boxes - Matched to Dashboard.tsx kpi style */}
                        <div className="flex-1 min-w-[100px] p-4 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-3xl font-black text-[var(--color-text-main)]">{filterCounts.active}</div>
                            <div className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mt-1 flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                {t('dashboard.projectStatus.active')}
                            </div>
                        </div>

                        <div className="flex-1 min-w-[100px] p-4 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-3xl font-black text-[var(--color-text-main)]">{filterCounts.planning}</div>
                            <div className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mt-1 flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-amber-500" />
                                {t('dashboard.projectStatus.planning')}
                            </div>
                        </div>

                        {workspaceHealth && (
                            <div className="flex-1 min-w-max p-4 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-sm hover:shadow-md transition-shadow">
                                <div className={`text-3xl font-black ${workspaceHealth.status === 'critical' ? 'text-rose-500' :
                                    workspaceHealth.status === 'warning' ? 'text-amber-500' :
                                        workspaceHealth.status === 'excellent' ? 'text-emerald-500' :
                                            workspaceHealth.status === 'healthy' ? 'text-emerald-600' :
                                                'text-indigo-500'
                                    }`}>{workspaceHealth.score}</div>
                                <div className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mt-1 flex items-center gap-1 whitespace-nowrap">
                                    <span className={`size-1.5 rounded-full ${workspaceHealth.status === 'critical' ? 'bg-rose-500' :
                                        workspaceHealth.status === 'warning' ? 'bg-amber-500' :
                                            workspaceHealth.status === 'excellent' ? 'bg-emerald-500' :
                                                workspaceHealth.status === 'healthy' ? 'bg-emerald-600' :
                                                    'bg-indigo-500'
                                        }`} />
                                    {t('projectsList.header.avgHealth')}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Featured Section (Spotlight) */}
                {featuredProject && filter === 'all' && !search && spotlightHealth && (
                    <div data-onboarding-id="projects-list-spotlight">
                        <ProjectSpotlight project={featuredProject} health={spotlightHealth} spotlightReason={spotlightReason} />
                    </div>
                )}

                {showSuggestion && featuredProject && spotlightHealth && (
                    <div className={`border rounded-xl px-3 pb-3 relative z-0 overflow-hidden backdrop-blur-sm group -mt-4 pt-3 ${spotlightHealth.status === 'critical' ? 'bg-gradient-to-r from-rose-500/10 to-red-500/5 border-rose-200 dark:border-rose-500/20' :
                        spotlightHealth.status === 'warning' ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-amber-200 dark:border-amber-500/20' :
                            spotlightHealth.status === 'excellent' || spotlightHealth.status === 'healthy' ? 'bg-gradient-to-r from-emerald-500/10 to-green-500/5 border-emerald-200 dark:border-emerald-500/20' :
                                'bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border-[var(--color-surface-border)]'
                        }`}>
                        <div className="flex items-center gap-3">
                            <div className={`size-8 rounded-lg shadow-sm flex items-center justify-center flex-shrink-0 ${spotlightHealth.status === 'critical' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-500' :
                                spotlightHealth.status === 'warning' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-500' :
                                    spotlightHealth.status === 'excellent' || spotlightHealth.status === 'healthy' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500' :
                                        'bg-[var(--color-surface-card)] text-indigo-500'
                                }`}>
                                <span className="material-symbols-outlined text-lg">
                                    {spotlightHealth.status === 'critical' ? 'priority_high' : spotlightHealth.status === 'warning' ? 'schedule' : spotlightHealth.status === 'excellent' || spotlightHealth.status === 'healthy' ? 'check_circle' : 'auto_awesome'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">smart_toy</span>
                                        {t('projectsList.suggestion.label')}
                                    </span>
                                    <span className="text-sm text-[var(--color-text-main)] font-medium">
                                        {spotlightHealth.status === 'critical'
                                            ? <><span className="text-rose-600 dark:text-rose-400">⚠️</span> {t('projectsList.suggestion.critical').replace('{title}', featuredProject.title)}</>
                                            : spotlightHealth.status === 'warning'
                                                ? <><span className="text-amber-600 dark:text-amber-400">⏰</span> {t('projectsList.suggestion.warning').replace('{title}', featuredProject.title)}</>
                                                : spotlightHealth.status === 'excellent' || spotlightHealth.status === 'healthy'
                                                    ? <><span className="text-emerald-600 dark:text-emerald-400">🎉</span> {t('projectsList.suggestion.healthy').replace('{title}', featuredProject.title)}</>
                                                    : <>{t('projectsList.suggestion.focus').replace('{title}', featuredProject.title)}</>
                                        }
                                    </span>
                                    {spotlightHealth.factors && spotlightHealth.factors.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1">
                                            {spotlightHealth.factors.slice(0, 4).map((factor) => {
                                                const { label } = getHealthFactorText(factor, t);
                                                return (
                                                    <span
                                                        key={factor.id}
                                                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${factor.type === 'negative' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300' :
                                                            factor.type === 'neutral' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                                                                factor.type === 'positive' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                                                                    'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                                            }`}
                                                    >
                                                        {label}
                                                    </span>
                                                );
                                            })}
                                            {spotlightHealth.factors.length > 4 && (
                                                <span className="text-[10px] text-[var(--color-text-subtle)]">
                                                    {t('projectsList.suggestion.more').replace('{count}', String(spotlightHealth.factors.length - 4))}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => setShowSuggestion(false)} className="text-[var(--color-text-subtle)] hover:text-[var(--color-text-main)] transition-colors p-1 -m-1 flex-shrink-0">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-8">
                    {/* My Projects Toolbar */}
                    <div data-onboarding-id="projects-list-toolbar" className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-[var(--color-surface-border)]/50">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                            {(['all', 'active', 'planning', 'completed'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`
                                    px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize whitespace-nowrap flex items-center gap-2
                                    ${filter === f
                                            ? 'bg-[var(--color-text-main)] text-[var(--color-surface-paper)] shadow-md'
                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}
                                `}
                                >
                                    {filterLabels[f]}
                                    <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold ${filter === f ? 'bg-white/20' : 'bg-[var(--color-surface-border)]'}`}>
                                        {f === 'planning' ? filterCounts.planning : (filterCounts as any)[f]}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-4 w-full lg:w-auto">
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('projectsList.search.placeholder')}
                                className="w-full"
                                icon="search"
                            />
                            <Select
                                value={sort}
                                onChange={(e) => setSort(e.target.value as any)}
                                className="w-full lg:w-40"
                            >
                                <option value="activity">{t('projectsList.sort.activity')}</option>
                                <option value="recent">{t('projectsList.sort.recent')}</option>
                                <option value="due">{t('projectsList.sort.due')}</option>
                                <option value="progress">{t('projectsList.sort.progress')}</option>
                            </Select>

                            {/* Action Button - Integrated into Toolbar */}
                            {can('canCreateProjects') && (
                                <Link to="/create">
                                    <Button
                                        size="lg"
                                        className="h-10 px-6 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 border-none font-bold text-sm shadow-xl hover:shadow-2xl transition-all whitespace-nowrap"
                                        icon={<span className="material-symbols-outlined text-lg">add</span>}
                                    >
                                        {t('projectsList.actions.newProject')}
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* My Projects Grid */}
                    <div data-onboarding-id="projects-list-grid">
                        {filteredMyProjects.length === 0 ? (
                            <div className="text-center py-20 border-2 border-dashed border-[var(--color-surface-border)] rounded-xl">
                                <span className="material-symbols-outlined text-4xl text-[var(--color-text-subtle)] mb-4">folder_off</span>
                                <h3 className="text-lg font-bold text-[var(--color-text-main)]">{t('projectsList.empty.title')}</h3>
                                <p className="text-[var(--color-text-muted)] mb-4">{t('projectsList.empty.description')}</p>
                                {can('canCreateProjects') && (
                                    <Link to="/create">
                                        <Button variant="secondary">{t('projectsList.actions.createProject')}</Button>
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {filteredMyProjects.map((p) => (
                                    <ProjectCard
                                        key={p.id}
                                        project={p}
                                        health={projectHealthMap[p.id] || { score: 0, status: 'normal', factors: [], recommendations: [], trend: 'stable', lastUpdated: Date.now() }}
                                        isSpotlighted={p.id === featuredProject?.id}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Other Projects List View */}
                {
                    otherProjects.length > 0 && (
                        <div data-onboarding-id="projects-list-other" className="pt-10 space-y-6">
                            <div className="flex items-center justify-between border-b border-[var(--color-surface-border)] pb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-[var(--color-text-main)]">{t('projectsList.other.title')}</h2>
                                    <p className="text-sm text-[var(--color-text-muted)]">{t('projectsList.other.subtitle')}</p>
                                </div>
                            </div>

                            <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)] overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-[var(--color-surface-hover)] text-xs text-[var(--color-text-subtle)] uppercase tracking-wider font-semibold border-b border-[var(--color-surface-border)]">
                                        <tr>
                                            <th className="px-6 py-4">{t('projectsList.other.table.project')}</th>
                                            <th className="px-6 py-4">{t('projectsList.other.table.status')}</th>
                                            <th className="px-6 py-4">{t('projectsList.other.table.members')}</th>
                                            <th className="px-6 py-4">{t('projectsList.other.table.created')}</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-surface-border)]">
                                        {otherProjects.map(project => (
                                            <tr key={project.id} className="hover:bg-[var(--color-surface-hover)] transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                                            {project.squareIcon ? (
                                                                <img src={project.squareIcon} alt="" className="w-full h-full object-cover rounded-lg" />
                                                            ) : (
                                                                <span className="material-symbols-outlined">folder</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-[var(--color-text-main)]">{project.title}</div>
                                                            <div className="text-xs text-[var(--color-text-muted)] line-clamp-1 max-w-xs">{project.description}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={project.status === 'Active' ? 'success' : 'secondary'} size="sm">
                                                        {getProjectStatusLabel(project.status, t)}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <MemberAvatars projectId={project.id} />
                                                </td>
                                                <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">
                                                    {format(new Date(toMillis(project.createdAt)), dateFormat, { locale: dateLocale })}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => window.location.href = `/project/${project.id}`}
                                                        icon={<span className="material-symbols-outlined">visibility</span>}
                                                    >
                                                        {t('projectsList.actions.view')}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                }
            </div>
            <OnboardingOverlay
                isOpen={onboardingActive}
                steps={onboardingSteps}
                stepIndex={stepIndex}
                onStepChange={setStepIndex}
                onFinish={finish}
                onSkip={skip}
            />
        </>
    );
};
