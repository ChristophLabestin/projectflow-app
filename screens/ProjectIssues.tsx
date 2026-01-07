import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { subscribeProjectIssues, getProjectById, subscribeTenantUsers, deleteIssue } from '../services/dataService';
import { subscribeProjectGroups } from '../services/projectGroupService';
import { Issue, Project, Member, ProjectGroup } from '../types';
import { Button } from '../components/common/Button/Button';
import { Badge } from '../components/common/Badge/Badge';
import { TextInput } from '../components/common/Input/TextInput';
import { CreateIssueModal } from '../components/CreateIssueModal';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { toMillis } from '../utils/time';
import { useConfirm } from '../context/UIContext';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { format } from 'date-fns';
import { useLanguage } from '../context/LanguageContext';
import { useArrowReplacement } from '../hooks/useArrowReplacement';

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

    const handleSearchChange = useArrowReplacement((e) => setSearch(e.target.value));

    const [showNewIssueModal, setShowNewIssueModal] = useState(false);

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

    const handleDelete = async (issueId: string) => {
        if (!can('canManageTasks')) return; // Assuming managing issues falls under managing tasks or similar
        if (!await confirm(t('projectIssues.confirm.delete.title'), t('projectIssues.confirm.delete.body'))) return;
        try {
            await deleteIssue(issueId);
        } catch (e) {
            console.error("Failed to delete issue:", e);
        }
    };

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
        const priorityValue = issue.priority || 'Medium';
        const priorityLabel = priorityLabels[priorityValue] || priorityValue;
        const statusValue = issue.status || 'Open';
        const statusLabel = statusLabels[statusValue] || t('projectIssues.status.unknown');
        const statusKey = statusValue.toLowerCase().replace(' ', '-');
        const priorityKey = priorityValue.toLowerCase();
        const createdLabel = issue.createdAt
            ? format(new Date(toMillis(issue.createdAt)), dateFormat, { locale: dateLocale })
            : '-';

        return (
            <div
                onClick={() => navigate(`/project/${id}/issues/${issue.id}`)}
                className={`issue-card ${isClosed ? 'issue-card--closed' : ''}`}
            >
                <div className="issue-card__main">
                    <div className={`issue-card__status-icon issue-card__status-icon--${statusKey} ${isClosed ? 'is-closed' : ''}`}>
                        <span className="material-symbols-outlined">
                            {isClosed ? 'check_circle' : 'bug_report'}
                        </span>
                    </div>

                    <div className="issue-card__content">
                        <div className="issue-card__title-row">
                            <span className="issue-card__id">#{issue.id.slice(0, 4).toUpperCase()}</span>
                            <h4 className={`issue-card__title ${isClosed ? 'is-closed' : ''}`}>
                                {issue.title}
                            </h4>
                            {issue.priority && (
                                <Badge
                                    variant="neutral"
                                    className={`issue-card__badge issue-card__badge--priority issue-card__badge--${priorityKey}`}
                                >
                                    <span className="material-symbols-outlined">
                                        {priorityValue === 'Urgent' ? 'error' :
                                            priorityValue === 'High' ? 'keyboard_double_arrow_up' :
                                                priorityValue === 'Medium' ? 'drag_handle' :
                                                    'keyboard_arrow_down'}
                                    </span>
                                    {priorityLabel}
                                </Badge>
                            )}
                        </div>

                        <div className="issue-card__meta">
                            <Badge
                                variant="neutral"
                                className={`issue-card__badge issue-card__badge--status issue-card__badge--${statusKey}`}
                            >
                                <span className="material-symbols-outlined">
                                    {statusValue === 'Resolved' || statusValue === 'Closed' ? 'check_circle' :
                                        statusValue === 'In Progress' ? 'sync' :
                                            statusValue === 'Open' ? 'error_outline' :
                                                'circle'}
                                </span>
                                {statusLabel}
                            </Badge>

                            <div className="issue-card__date">
                                <span className="material-symbols-outlined">calendar_today</span>
                                {createdLabel}
                            </div>

                            {(issue.assignedGroupIds?.length > 0 || issue.assigneeIds?.length > 0) && (
                                <div className="issue-card__assignees">
                                    {(issue.assigneeIds || []).slice(0, 3).map(uid => {
                                        const member = allUsers.find(u => u.uid === uid || (u as any).id === uid);
                                        return (
                                            <img
                                                key={uid}
                                                src={member?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
                                                className="issue-card__avatar"
                                                title={member?.displayName || t('projectIssues.assignee.unknown')}
                                                alt=""
                                            />
                                        );
                                    })}
                                    {issue.assignedGroupIds?.map(gid => {
                                        const group = projectGroups.find(g => g.id === gid);
                                        if (!group) return null;
                                        return (
                                            <div
                                                key={gid}
                                                className="issue-card__group"
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

                <div className="issue-card__actions">
                    {can('canManageTasks') && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(issue.id); }}
                            className="issue-card__action issue-card__action--delete"
                            title={t('projectIssues.actions.delete')}
                        >
                            <span className="material-symbols-outlined">delete</span>
                        </button>
                    )}
                    <button
                        type="button"
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
                        className={`issue-card__action issue-card__action--pin ${isPinned(issue.id) ? 'is-pinned' : 'is-unpinned'}`}
                        title={isPinned(issue.id) ? t('projectIssues.actions.unpinTitle') : t('projectIssues.actions.pinTitle')}
                    >
                        <span className={`material-symbols-outlined ${focusItemId === issue.id ? 'issue-card__action-icon--focused' : ''}`}>
                            push_pin
                        </span>
                    </button>
                    <div className="issue-card__action issue-card__action--arrow" aria-hidden="true">
                        <span className="material-symbols-outlined">east</span>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return (
        <div className="issues-loading">
            <span className="material-symbols-outlined issues-loading__icon">rotate_right</span>
        </div>
    );

    return (
        <>
            <div className="project-issues-container">
                <div data-onboarding-id="project-issues-header" className="issues-header">
                    <div>
                        <h1>
                            {t('projectIssues.header.title')} <span>{t('projectIssues.header.titleEmphasis')}</span>
                        </h1>
                        <p className="issues-header__subtitle">
                            {project?.name
                                ? t('projectIssues.header.subtitleWithProject').replace('{project}', project.name)
                                : t('projectIssues.header.subtitleFallback')}
                        </p>
                    </div>
                    {can('canManageTasks') && (
                        <Button
                            onClick={() => setShowNewIssueModal(true)}
                            icon={<span className="material-symbols-outlined">bug_report</span>}
                            variant="primary"
                            size="lg"
                            className="issues-header__action"
                        >
                            {t('projectIssues.actions.reportIssue')}
                        </Button>
                    )}
                </div>

                <div data-onboarding-id="project-issues-stats" className="issues-stats-grid">
                    {[
                        { label: t('projectIssues.stats.active'), val: stats.open + stats.inProgress, icon: 'bug_report', color: 'indigo' },
                        { label: t('projectIssues.stats.resolved'), val: stats.resolved, icon: 'check_circle', color: 'emerald', progress: stats.progress },
                        { label: t('projectIssues.stats.inProgress'), val: stats.inProgress, icon: 'sync', color: 'blue' },
                        { label: t('projectIssues.stats.urgent'), val: stats.urgent, icon: 'warning', color: 'rose' }
                    ].map((stat, idx) => (
                        <div key={idx} className={`stat-card variant-${stat.color}`}>
                            <div className="bg-icon">
                                <span className="material-symbols-outlined">{stat.icon}</span>
                            </div>
                            <div className="content">
                                <p className="label">{stat.label}</p>
                                <div className="value-row">
                                    <p className="value">{stat.val}</p>
                                    {stat.progress !== undefined && (
                                        <Badge variant="neutral" className="badge">
                                            {stat.progress}%
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div data-onboarding-id="project-issues-controls" className="issues-controls-bar">
                    <div className="issues-controls-group">
                        <div className="control-group">
                            {(['Active', 'Resolved', 'All'] as const).map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    className={`control-btn ${filter === f ? 'active' : ''}`}
                                >
                                    {filterLabels[f]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="issues-search">
                        <TextInput
                            value={search}
                            onChange={handleSearchChange}
                            placeholder={t('projectIssues.search.placeholder')}
                            className="issues-search__input"
                            leftElement={<span className="material-symbols-outlined">search</span>}
                        />
                    </div>
                </div>

                <div data-onboarding-id="project-issues-list" className="issues-list">
                    {filteredIssues.length === 0 ? (
                        <div className="issues-empty">
                            <div className="issues-empty__icon">
                                <span className="material-symbols-outlined">bug_report</span>
                            </div>
                            <h3 className="issues-empty__title">{t('projectIssues.empty.title')}</h3>
                            <p className="issues-empty__description">
                                {t('projectIssues.empty.description')}
                            </p>
                            {can('canManageTasks') && (
                                <Button
                                    variant="secondary"
                                    className="issues-empty__action"
                                    onClick={() => setShowNewIssueModal(true)}
                                >
                                    {t('projectIssues.actions.reportNew')}
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="issue-list-grid">
                            {filteredIssues.map(issue => (
                                <IssueCard key={issue.id} issue={issue} />
                            ))}
                        </div>
                    )}
                </div>

                {showNewIssueModal && can('canManageTasks') && id && (
                    <CreateIssueModal
                        isOpen={showNewIssueModal}
                        onClose={() => setShowNewIssueModal(false)}
                        projectId={id}
                    />
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
