import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { subscribeProjectIssues, getProjectById, createIssue, subscribeTenantUsers, deleteIssue } from '../services/dataService';
import { subscribeProjectGroups } from '../services/projectGroupService';
import { Issue, Project, Member, ProjectGroup } from '../types';
import { auth } from '../services/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { MultiAssigneeSelector } from '../components/MultiAssigneeSelector';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { toMillis } from '../utils/time';
import { useConfirm } from '../context/UIContext';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { format } from 'date-fns';
import { useLanguage } from '../context/LanguageContext';

export const ProjectIssues = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { dateFormat, dateLocale, t } = useLanguage();
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'Active' | 'Resolved' | 'All'>('Active');
    const [search, setSearch] = useState('');
    const [project, setProject] = useState<Project | null>(null);
    const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
    const [allUsers, setAllUsers] = useState<Member[]>([]);
    const { pinItem, unpinItem, isPinned, focusItemId, setFocusItem } = usePinnedTasks();
    const confirm = useConfirm();
    const priorityLabels = useMemo(() => ({
        Low: t('tasks.priority.low'),
        Medium: t('tasks.priority.medium'),
        High: t('tasks.priority.high'),
        Urgent: t('tasks.priority.urgent')
    }), [t]);
    const statusLabels = useMemo(() => ({
        Open: t('projectIssues.status.open'),
        'In Progress': t('projectIssues.status.inProgress'),
        Resolved: t('projectIssues.status.resolved'),
        Closed: t('projectIssues.status.closed')
    }), [t]);
    const filterLabels = useMemo(() => ({
        Active: t('projectIssues.filters.active'),
        Resolved: t('projectIssues.filters.resolved'),
        All: t('projectIssues.filters.all')
    }), [t]);

    // Modal State
    const [showNewIssueModal, setShowNewIssueModal] = useState(false);

    // New Issue Form State
    const [newIssueTitle, setNewIssueTitle] = useState('');
    const [newIssueDescription, setNewIssueDescription] = useState('');
    const [newIssuePriority, setNewIssuePriority] = useState<Issue['priority']>('Medium');
    const [newIssueAssigneeIds, setNewIssueAssigneeIds] = useState<string[]>([]);
    const [newIssueGroupIds, setNewIssueGroupIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const user = auth.currentUser;
    const { can } = useProjectPermissions(project);

    useEffect(() => {
        if (!id) return;

        let mounted = true;
        let unsubIssues: (() => void) | undefined;
        let unsubUsers: (() => void) | undefined;
        let unsubGroups: (() => void) | undefined;

        getProjectById(id).then((foundProject) => {
            if (!mounted || !foundProject) {
                if (mounted) setLoading(false);
                return;
            }

            setProject(foundProject);

            unsubIssues = subscribeProjectIssues(id, (loadedIssues) => {
                if (mounted) {
                    setIssues(loadedIssues);
                    setLoading(false);
                }
            }, foundProject.tenantId);

            unsubGroups = subscribeProjectGroups(id, setProjectGroups, foundProject.tenantId);

            if (foundProject.tenantId) {
                unsubUsers = subscribeTenantUsers((users) => {
                    if (mounted) setAllUsers(users as Member[]);
                }, foundProject.tenantId);
            }
        }).catch((err) => {
            console.error("Failed to load project for issues", err);
            if (mounted) setLoading(false);
        });

        return () => {
            mounted = false;
            if (unsubIssues) unsubIssues();
            if (unsubGroups) unsubGroups();
            if (unsubUsers) unsubUsers();
        };
    }, [id]);

    const handleCreateIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !id || !project || !newIssueTitle.trim()) return;

        setSubmitting(true);
        try {
            await createIssue(id, {
                title: newIssueTitle.trim(),
                description: newIssueDescription.trim(),
                priority: newIssuePriority,
                assigneeIds: newIssueAssigneeIds,
                assignedGroupIds: newIssueGroupIds,
            }, project.tenantId);
            setShowNewIssueModal(false);
            resetForm();
        } catch (error) {
            console.error("Error creating issue:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (issueId: string) => {
        if (!can('canManageTasks')) return; // Assuming managing issues falls under managing tasks or similar
        if (!await confirm(t('projectIssues.confirm.delete.title'), t('projectIssues.confirm.delete.body'))) return;
        try {
            await deleteIssue(issueId);
        } catch (e) {
            console.error("Failed to delete issue:", e);
        }
    };

    const resetForm = () => {
        setNewIssueTitle('');
        setNewIssueDescription('');
        setNewIssuePriority('Medium');
        setNewIssueAssigneeIds([]);
        setNewIssueGroupIds([]);
    }

    const filteredIssues = useMemo(() => {
        return issues.filter(i => {
            const matchesSearch = i.title.toLowerCase().includes(search.toLowerCase()) ||
                (i.description?.toLowerCase().includes(search.toLowerCase()));

            if (!matchesSearch) return false;

            if (filter === 'Active') return i.status !== 'Closed' && i.status !== 'Resolved';
            if (filter === 'Resolved') return i.status === 'Resolved' || i.status === 'Closed';
            return true;
        });
    }, [issues, filter, search]);

    const stats = useMemo(() => {
        const total = issues.length;
        const open = issues.filter(i => i.status === 'Open').length;
        const inProgress = issues.filter(i => i.status === 'In Progress').length;
        const resolved = issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;
        const urgent = issues.filter(i => (i.priority === 'Urgent' || i.priority === 'High') && i.status !== 'Closed' && i.status !== 'Resolved').length;
        const progress = total > 0 ? Math.round((resolved / total) * 100) : 0;
        return { total, open, inProgress, resolved, urgent, progress };
    }, [issues]);

    const onboardingSteps = useMemo<OnboardingStep[]>(() => ([
        {
            id: 'header',
            targetId: 'project-issues-header',
            title: t('projectIssues.onboarding.header.title'),
            description: t('projectIssues.onboarding.header.description')
        },
        {
            id: 'stats',
            targetId: 'project-issues-stats',
            title: t('projectIssues.onboarding.stats.title'),
            description: t('projectIssues.onboarding.stats.description'),
            placement: 'top'
        },
        {
            id: 'controls',
            targetId: 'project-issues-controls',
            title: t('projectIssues.onboarding.controls.title'),
            description: t('projectIssues.onboarding.controls.description'),
            placement: 'top'
        },
        {
            id: 'list',
            targetId: 'project-issues-list',
            title: t('projectIssues.onboarding.list.title'),
            description: t('projectIssues.onboarding.list.description')
        }
    ]), [t]);

    const {
        onboardingActive,
        stepIndex,
        setStepIndex,
        skip,
        finish
    } = useOnboardingTour('project_issues', { stepCount: onboardingSteps.length, autoStart: true, enabled: !loading });

    const IssueCard = ({ issue }: { issue: Issue }) => {
        const isClosed = issue.status === 'Closed' || issue.status === 'Resolved';
        const priorityLabel = issue.priority ? (priorityLabels[issue.priority] || issue.priority) : '';
        const statusLabel = issue.status ? (statusLabels[issue.status] || issue.status) : t('projectIssues.status.unknown');

        return (
            <div
                onClick={() => navigate(`/project/${id}/issues/${issue.id}`)}
                className={`
                    group relative flex flex-col md:flex-row md:items-center gap-4 p-5 rounded-[24px] border transition-all duration-300 cursor-pointer
                    ${isClosed
                        ? 'bg-slate-50/50 dark:bg-white/[0.01] border-slate-100 dark:border-white/5 opacity-80'
                        : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-[var(--color-primary)]/30 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-0.5'
                    }
                `}
            >
                {/* Left: Status & Main Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`
                        flex-shrink-0 size-10 rounded-xl border flex items-center justify-center transition-all duration-300
                        ${isClosed
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                            : issue.priority === 'Urgent' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse'
                                : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-[var(--color-text-muted)]'}
                    `}>
                        <span className="material-symbols-outlined text-[20px]">
                            {isClosed ? 'check_circle' : 'bug_report'}
                        </span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                            <span className="text-xs font-mono font-bold text-[var(--color-text-muted)] opacity-60">
                                #{issue.id.slice(0, 4).toUpperCase()}
                            </span>
                            <h4 className={`text-lg font-bold truncate transition-all duration-300 ${isClosed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-main)] group-hover:text-[var(--color-primary)]'}`}>
                                {issue.title}
                            </h4>
                            {issue.priority && (
                                <div className={`
                                    flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border
                                    ${issue.priority === 'Urgent' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                        issue.priority === 'High' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                            issue.priority === 'Medium' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                'bg-slate-500/10 text-slate-500 border-slate-500/20'}
                                `}>
                                    <span className="material-symbols-outlined text-[14px]">
                                        {issue.priority === 'Urgent' ? 'error' :
                                            issue.priority === 'High' ? 'keyboard_double_arrow_up' :
                                                issue.priority === 'Medium' ? 'drag_handle' :
                                                    'keyboard_arrow_down'}
                                    </span>
                                    {priorityLabel}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mb-1">
                            {/* Status Pill */}
                            <div className={`
                                flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border transition-all duration-300
                                ${issue.status === 'Resolved' || issue.status === 'Closed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                                    issue.status === 'In Progress' ? 'bg-blue-600/15 text-blue-400 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)]' :
                                        issue.status === 'Open' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                            'bg-slate-500/5 text-slate-400 border-slate-500/10'}
                            `}>
                                <span className="material-symbols-outlined text-[13px]">
                                    {issue.status === 'Resolved' || issue.status === 'Closed' ? 'check_circle' :
                                        issue.status === 'In Progress' ? 'sync' :
                                            issue.status === 'Open' ? 'error_outline' :
                                                'circle'}
                                </span>
                                {statusLabel}
                            </div>

                            {/* Date */}
                            <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-text-muted)] opacity-70">
                                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                {format(new Date(toMillis(issue.createdAt)), dateFormat, { locale: dateLocale })}
                            </div>

                            {/* Assignees */}
                            {(issue.assignedGroupIds?.length > 0 || issue.assigneeIds?.length > 0) && (
                                <div className="flex -space-x-1.5 overflow-hidden py-1 pl-2 border-l border-black/5 dark:border-white/5">
                                    {(issue.assigneeIds || []).slice(0, 3).map(uid => {
                                        const member = allUsers.find(u => u.uid === uid || (u as any).id === uid);
                                        return (
                                            <img
                                                key={uid}
                                                src={member?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
                                                className="size-6 rounded-full ring-2 ring-white dark:ring-[#1E1E1E]"
                                                title={member?.displayName || t('projectIssues.assignee.unknown')}
                                            />
                                        );
                                    })}
                                    {issue.assignedGroupIds?.map(gid => {
                                        const group = projectGroups.find(g => g.id === gid);
                                        if (!group) return null;
                                        return (
                                            <div
                                                key={gid}
                                                className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#1E1E1E]"
                                                style={{ backgroundColor: group.color }}
                                                title={t('projectIssues.groupLabel').replace('{name}', group.name)}
                                            >
                                                {group.name.substring(0, 2).toUpperCase()}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex flex-col md:flex-row items-center gap-4 md:pl-6 md:border-l border-black/5 dark:border-white/5">
                    {can('canManageTasks') && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(issue.id); }}
                            className="size-10 rounded-xl bg-slate-100 dark:bg-white/5 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300 opacity-0 group-hover:opacity-100 flex items-center justify-center shrink-0"
                            title={t('projectIssues.actions.delete')}
                        >
                            <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isPinned(issue.id)) {
                                unpinItem(issue.id);
                            } else {
                                pinItem({
                                    id: issue.id,
                                    type: 'issue',
                                    title: issue.title,
                                    projectId: id!,
                                });
                            }
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setFocusItem(focusItemId === issue.id ? null : issue.id);
                        }}
                        className={`
                            size-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0
                            bg-slate-100 dark:bg-white/5
                            ${isPinned(issue.id) ? 'opacity-100 text-[var(--color-primary)]' : 'opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] shadow-sm'}
                        `}
                        title={isPinned(issue.id) ? t('projectIssues.actions.unpinTitle') : t('projectIssues.actions.pinTitle')}
                    >
                        <span className={`material-symbols-outlined text-xl transition-colors duration-300 ${focusItemId === issue.id ? 'text-amber-500' : ''}`}>
                            push_pin
                        </span>
                    </button>
                    <div className="size-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[var(--color-text-main)] transition-all duration-300 group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-text)] group-hover:translate-x-1 shrink-0">
                        <span className="material-symbols-outlined text-xl">east</span>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <>
            <div className="flex flex-col gap-8 fade-in max-w-6xl mx-auto pb-20 px-4 md:px-0">
                {/* Premium Header */}
                <div data-onboarding-id="project-issues-header" className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                    <div>
                        <h1 className="text-4xl font-black text-[var(--color-text-main)] tracking-tight mb-2">
                            {t('projectIssues.header.title')} <span className="text-[var(--color-primary)]">{t('projectIssues.header.titleEmphasis')}</span>
                        </h1>
                        <p className="text-[var(--color-text-muted)] text-lg font-medium opacity-80">
                            {project?.name
                                ? t('projectIssues.header.subtitleWithProject').replace('{project}', project.name)
                                : t('projectIssues.header.subtitleFallback')}
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowNewIssueModal(true)}
                        icon={<span className="material-symbols-outlined font-bold">bug_report</span>}
                        variant="primary"
                        size="lg"
                        className="shadow-2xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all px-8 py-4 rounded-2xl"
                    >
                        {t('projectIssues.actions.reportIssue')}
                    </Button>
                </div>

                {/* Stats Row */}
                <div data-onboarding-id="project-issues-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: t('projectIssues.stats.active'), val: stats.open + stats.inProgress, icon: 'bug_report', color: 'indigo' },
                        { label: t('projectIssues.stats.resolved'), val: stats.resolved, icon: 'check_circle', color: 'emerald', progress: stats.progress },
                        { label: t('projectIssues.stats.inProgress'), val: stats.inProgress, icon: 'sync', color: 'blue' },
                        { label: t('projectIssues.stats.urgent'), val: stats.urgent, icon: 'warning', color: 'rose' }
                    ].map((stat, idx) => (
                        <div key={idx} className={`p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-${stat.color}-100 dark:border-${stat.color}-500/20 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300`}>
                            <div className="absolute -right-2 -top-2 p-4 opacity-[0.05] group-hover:opacity-[0.15] group-hover:scale-110 transition-all duration-500">
                                <span className={`material-symbols-outlined text-8xl text-${stat.color}-500`}>{stat.icon}</span>
                            </div>
                            <div className="relative z-10">
                                <p className={`text-xs font-bold text-${stat.color}-600 dark:text-${stat.color}-400 uppercase tracking-[0.1em] mb-2`}>{stat.label}</p>
                                <div className="flex items-baseline gap-3">
                                    <p className="text-4xl font-black text-[var(--color-text-main)]">{stat.val}</p>
                                    {stat.progress !== undefined && (
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                            {stat.progress}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Interactive Controls Bar */}
                <div data-onboarding-id="project-issues-controls" className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 sticky top-6 z-20">
                    <div className="flex flex-wrap gap-2">
                        <div className="flex bg-white/60 dark:bg-black/40 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/5 ring-1 ring-black/5">
                            {(['Active', 'Resolved', 'All'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`
                                    relative flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize z-10
                                    ${filter === f
                                            ? 'text-[var(--color-primary)]'
                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}
                                `}
                                >
                                    {filter === f && (
                                        <div className="absolute inset-0 bg-white dark:bg-white/10 rounded-xl shadow-sm z-[-1] fade-in" />
                                    )}
                                    {filterLabels[f]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="relative group w-full lg:w-96 shadow-xl shadow-black/5">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('projectIssues.search.placeholder')}
                            className="w-full bg-white/60 dark:bg-black/40 backdrop-blur-2xl border-none ring-1 ring-black/5 dark:ring-white/10 focus:ring-2 focus:ring-[var(--color-primary)] rounded-2xl pl-12 pr-6 py-4 text-sm font-medium transition-all outline-none"
                        />
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">search</span>
                    </div>
                </div>

                {/* Issues List */}
                <div data-onboarding-id="project-issues-list" className="flex flex-col gap-4 min-h-[400px]">
                    {filteredIssues.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white/30 dark:bg-white/[0.02] border-2 border-dashed border-black/5 dark:border-white/5 rounded-[32px] fade-in">
                            <div className="size-24 bg-gradient-to-br from-rose-500/10 to-indigo-500/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-indigo-500/5">
                                <span className="material-symbols-outlined text-5xl text-rose-500 animate-pulse">bug_report</span>
                            </div>
                            <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">{t('projectIssues.empty.title')}</h3>
                            <p className="text-[var(--color-text-muted)] max-w-sm font-medium opacity-70">
                                {t('projectIssues.empty.description')}
                            </p>
                            <Button
                                variant="secondary"
                                className="mt-8 rounded-xl px-10"
                                onClick={() => setShowNewIssueModal(true)}
                            >
                                {t('projectIssues.actions.reportNew')}
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {filteredIssues.map(issue => (
                                <IssueCard key={issue.id} issue={issue} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Create Issue Modal */}
                {showNewIssueModal && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-[var(--color-surface-border)] animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-[var(--color-text-main)]">{t('projectIssues.modal.title')}</h2>
                                <button onClick={() => setShowNewIssueModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <form onSubmit={handleCreateIssue} className="space-y-5">
                                <Input
                                    label={t('projectIssues.modal.fields.title')}
                                    value={newIssueTitle}
                                    onChange={(e) => setNewIssueTitle(e.target.value)}
                                    placeholder={t('projectIssues.modal.fields.titlePlaceholder')}
                                    className="w-full"
                                    required
                                    autoFocus
                                />

                                <Textarea
                                    label={t('projectIssues.modal.fields.description')}
                                    value={newIssueDescription}
                                    onChange={(e) => setNewIssueDescription(e.target.value)}
                                    placeholder={t('projectIssues.modal.fields.descriptionPlaceholder')}
                                    className="w-full min-h-[120px]"
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <Select
                                        label={t('projectIssues.modal.fields.priority')}
                                        value={newIssuePriority}
                                        onChange={(e) => setNewIssuePriority(e.target.value as any)}
                                        className="w-full"
                                    >
                                        <option value="Low">{t('tasks.priority.low')}</option>
                                        <option value="Medium">{t('tasks.priority.medium')}</option>
                                        <option value="High">{t('tasks.priority.high')}</option>
                                        <option value="Urgent">{t('tasks.priority.urgent')}</option>
                                    </Select>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase ml-1">{t('projectIssues.modal.fields.assignees')}</label>
                                        <MultiAssigneeSelector
                                            projectId={id!}
                                            assigneeIds={newIssueAssigneeIds}
                                            assignedGroupIds={newIssueGroupIds}
                                            onChange={setNewIssueAssigneeIds}
                                            onGroupChange={setNewIssueGroupIds}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 mt-2">
                                    <Button type="button" variant="ghost" onClick={() => setShowNewIssueModal(false)}>
                                        {t('projectIssues.actions.cancel')}
                                    </Button>
                                    <Button type="submit" isLoading={submitting}>
                                        {t('projectIssues.actions.reportIssue')}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div >,
                    document.body
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
        </>
    );
};
