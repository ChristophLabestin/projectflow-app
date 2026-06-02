import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '../components/common/Button/Button';
import { DatePicker } from '../components/common/DateTime/DatePicker';
import { Card } from '../components/common/Card/Card';
import { Modal } from '../components/common/Modal/Modal';
import { Select, type SelectOption } from '../components/common/Select/Select';
import { MultiAssigneeSelector } from '../components/MultiAssigneeSelector';
import { CommentSection } from '../components/CommentSection';
import { InitiativeFeedbackModal } from '../components/InitiativeFeedbackModal';
import { InitiativeSettingsModal } from '../components/InitiativeSettingsModal';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { useLanguage } from '../context/LanguageContext';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { Initiative, Milestone, Project, Task } from '../types';
import { calculateInitiativeHealth } from '../services/healthService';
import { timeAgo, toDate } from '../utils/time';
import { getProjectById } from '../services/domain/projectsService';
import { getIdeaById } from '../services/domain/ideasService';
import {
    deleteInitiative,
    ensureProjectInitiativesMigrated,
    getInitiativeById,
    subscribeInitiativeTasks,
    subscribeProjectActivity,
    subscribeProjectMilestones,
    subscribeProjectTasks,
    updateInitiative,
    updateTaskInitiative
} from '../services/dataService';
import { useConfirm } from '../context/UIContext';

export const ProjectInitiativeDetail = () => {
    const { id: projectId, initiativeId } = useParams<{ id: string; initiativeId: string }>();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { setTaskTitle } = useOutletContext<{ setTaskTitle: (title: string | null) => void }>();
    const { t, dateFormat, dateLocale } = useLanguage();
    const [project, setProject] = useState<Project | null>(null);
    const [initiative, setInitiative] = useState<Initiative | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [activity, setActivity] = useState<any[]>([]);
    const [sourceIdea, setSourceIdea] = useState<any | null>(null);
    const [attachTaskId, setAttachTaskId] = useState('');
    const [commentCount, setCommentCount] = useState(0);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showTaskCreateModal, setShowTaskCreateModal] = useState(false);
    const [showAttachTaskModal, setShowAttachTaskModal] = useState(false);
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
    const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
    const statusMenuRef = useRef<HTMLDivElement>(null);
    const priorityMenuRef = useRef<HTMLDivElement>(null);
    const { can, hasPermission } = useProjectPermissions(project);
    const { focusItemId, startFocusItem } = usePinnedTasks();
    const canManageInitiative = can('canManageTasks') || hasPermission('project.initiatives.edit');
    const canManageInitiativeTasks = can('canManageTasks') || hasPermission('project.initiatives.manageTasks');

    const initiativeStatusLabels = useMemo<Record<string, string>>(() => ({
        Planning: t('initiatives.status.planning'),
        Open: t('initiatives.status.open'),
        'In Progress': t('initiatives.status.inProgress'),
        Review: t('initiatives.status.review'),
        'On Hold': t('initiatives.status.onHold'),
        Blocked: t('initiatives.status.blocked'),
        Done: t('initiatives.status.done')
    }), [t]);

    const priorityLabels = useMemo<Record<string, string>>(() => ({
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low')
    }), [t]);

    const healthLabels = useMemo<Record<string, string>>(() => ({
        'On Track': t('initiatives.health.onTrack'),
        'At Risk': t('initiatives.health.atRisk'),
        'Off Track': t('initiatives.health.offTrack')
    }), [t]);

    const taskStatusLabels = useMemo<Record<string, string>>(() => ({
        Backlog: t('tasks.status.backlog'),
        Todo: t('tasks.status.todo'),
        Open: t('tasks.status.open'),
        'In Progress': t('tasks.status.inProgress'),
        Review: t('tasks.status.review'),
        'On Hold': t('tasks.status.onHold'),
        Blocked: t('tasks.status.blocked'),
        Done: t('tasks.status.done')
    }), [t]);

    const initiativeStatusOptions = useMemo<Initiative['status'][]>(() => ([
        'Planning',
        'Open',
        'In Progress',
        'Review',
        'On Hold',
        'Blocked',
        'Done'
    ]), []);

    const handleStartInitiativeFocus = () => {
        if (!initiative || !projectId) return;
        startFocusItem({
            id: initiative.id,
            type: 'initiative',
            title: initiative.title,
            projectId,
            tenantId: initiative.tenantId || project?.tenantId,
            priority: initiative.priority,
            isCompleted: initiative.status === 'Done'
        });
    };

    useEffect(() => {
        if (!statusMenuOpen && !priorityMenuOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            if (statusMenuOpen && !statusMenuRef.current?.contains(target)) {
                setStatusMenuOpen(false);
            }
            if (priorityMenuOpen && !priorityMenuRef.current?.contains(target)) {
                setPriorityMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [priorityMenuOpen, statusMenuOpen]);

    useEffect(() => {
        if (initiative?.title) {
            setTaskTitle(initiative.title);
            return () => setTaskTitle(null);
        }
        setTaskTitle(t('nav.initiatives'));
        return () => setTaskTitle(null);
    }, [initiative?.title, setTaskTitle, t]);

    useEffect(() => {
        if (!projectId || !initiativeId) return;

        let unsubInitiativeTasks = () => undefined;
        let unsubAllTasks = () => undefined;
        let unsubMilestones = () => undefined;
        let unsubActivity = () => undefined;

        void getProjectById(projectId).then((nextProject) => {
            setProject(nextProject);
            if (!nextProject) {
                return;
            }

            void ensureProjectInitiativesMigrated(projectId, nextProject.tenantId).catch((error) => {
                console.error('Failed to ensure initiative migration', error);
            });

            void getInitiativeById(initiativeId, projectId, nextProject.tenantId).then((item) => {
                setInitiative(item);
                if (item) {
                    if (item.originIdeaId) {
                        void getIdeaById(item.originIdeaId, projectId, nextProject.tenantId).then(setSourceIdea).catch(console.error);
                    }
                }
            });

            unsubInitiativeTasks = subscribeInitiativeTasks(projectId, initiativeId, setTasks, nextProject.tenantId);
            unsubAllTasks = subscribeProjectTasks(projectId, setAllTasks, nextProject.tenantId);
            unsubMilestones = subscribeProjectMilestones(projectId, setMilestones, nextProject.tenantId);
            unsubActivity = subscribeProjectActivity(projectId, (items) => {
                setActivity(items.filter((entry) => entry.relatedId === initiativeId).slice(0, 12));
            }, nextProject.tenantId);
        }).catch((error) => {
            console.error('Failed to load initiative detail', error);
        });

        return () => {
            unsubInitiativeTasks();
            unsubAllTasks();
            unsubMilestones();
            unsubActivity();
        };
    }, [projectId, initiativeId]);

    const linkedMilestones = useMemo(
        () => milestones.filter((milestone) => (
            milestone.linkedInitiativeId === initiativeId
            || (initiative?.originIdeaId && milestone.linkedInitiativeId === initiative.originIdeaId)
        )),
        [initiative?.originIdeaId, initiativeId, milestones]
    );

    const initiativeHealth = useMemo(
        () => initiative ? calculateInitiativeHealth(initiative, tasks, activity, linkedMilestones) : null,
        [activity, initiative, linkedMilestones, tasks]
    );

    const completedTaskCount = useMemo(
        () => tasks.filter((task) => task.isCompleted || task.status === 'Done').length,
        [tasks]
    );

    const blockedTaskCount = useMemo(
        () => tasks.filter((task) => task.status === 'Blocked').length,
        [tasks]
    );

    const activeTaskCount = useMemo(
        () => Math.max(tasks.length - completedTaskCount, 0),
        [completedTaskCount, tasks.length]
    );

    const progress = useMemo(() => {
        if (tasks.length === 0) return 0;
        return Math.round((completedTaskCount / tasks.length) * 100);
    }, [completedTaskCount, tasks.length]);

    const feedbackTasks = useMemo(
        () => tasks.filter((task) => Boolean(task.feedbackSubmission)),
        [tasks]
    );

    const feedbackAttachmentCount = useMemo(
        () => feedbackTasks.reduce((sum, task) => sum + (task.feedbackSubmission?.attachments?.length || 0), 0),
        [feedbackTasks]
    );

    const feedbackVisibleFieldCount = useMemo(
        () => initiative?.feedbackForm?.fields?.filter((field) => field.enabled !== false).length || 0,
        [initiative?.feedbackForm?.fields]
    );

    const availableTasks = useMemo(
        () => allTasks.filter((task) => !task.initiativeId || task.initiativeId === initiativeId),
        [allTasks, initiativeId]
    );

    const attachableTasks = useMemo(
        () => availableTasks.filter((task) => task.initiativeId !== initiative?.id),
        [availableTasks, initiative?.id]
    );

    const attachTaskOptions = useMemo<SelectOption[]>(
        () => attachableTasks.map((task) => ({ value: task.id, label: task.title })),
        [attachableTasks]
    );

    const formatDisplayDate = (value?: any) => {
        const date = toDate(value);
        if (!date) return null;
        return format(date, dateFormat, { locale: dateLocale });
    };

    const initiativeHeroFacts = [
        {
            icon: 'calendar_today',
            label: t('taskDetail.timeline.label'),
            value: initiative?.startDate && initiative?.dueDate
                ? `${formatDisplayDate(initiative.startDate)} – ${formatDisplayDate(initiative.dueDate)}`
                : formatDisplayDate(initiative?.startDate || initiative?.dueDate) || t('taskDetail.timeline.noDueDate')
        },
        {
            icon: 'update',
            label: t('initiatives.detail.lastUpdated'),
            value: initiative?.updatedAt ? timeAgo(initiative.updatedAt) : t('initiatives.detail.noActivity')
        },
        {
            icon: 'task_alt',
            label: t('initiatives.summary.workItems'),
            value: String(tasks.length)
        }
    ];

    const getTone = (value?: string) => {
        if (value === 'Done' || value === 'On Track') return 'success';
        if (value === 'In Progress' || value === 'Open') return 'primary';
        if (value === 'Review' || value === 'On Hold' || value === 'At Risk') return 'warning';
        if (value === 'Blocked' || value === 'Off Track') return 'error';
        // Priority levels get their own dedicated tones
        if (value === 'Urgent') return 'urgent';
        if (value === 'High') return 'high';
        if (value === 'Medium') return 'medium';
        if (value === 'Low') return 'low';
        return 'neutral';
    };

    const getInitiativeStatusIcon = (value?: Initiative['status']) => {
        switch (value) {
            case 'Planning':
                return 'architecture';
            case 'Open':
                return 'radio_button_checked';
            case 'In Progress':
                return 'timelapse';
            case 'Review':
                return 'rate_review';
            case 'On Hold':
                return 'pause_circle';
            case 'Blocked':
                return 'block';
            case 'Done':
                return 'task_alt';
            default:
                return 'track_changes';
        }
    };

    const getPriorityIcon = (value?: Task['priority']) => {
        switch (value) {
            case 'Urgent':
                return 'priority_high';
            case 'High':
                return 'keyboard_double_arrow_up';
            case 'Medium':
                return 'drag_handle';
            case 'Low':
                return 'keyboard_double_arrow_down';
            default:
                return 'flag';
        }
    };

    const getHealthIcon = (value?: Initiative['health']) => {
        switch (value) {
            case 'On Track':
                return 'check_circle';
            case 'At Risk':
                return 'warning';
            case 'Off Track':
                return 'error';
            default:
                return 'monitoring';
        }
    };

    if (!initiative || !projectId) {
        return (
            <div className="initiative-detail__empty">
                <span className="material-symbols-outlined initiative-detail__empty-icon">rocket_launch</span>
                <h2>{t('initiatives.detail.missingTitle')}</h2>
                <p>{t('initiatives.detail.missingDescription')}</p>
            </div>
        );
    }

    const applyInitiativeUpdates = async (updates: Partial<Initiative>) => {
        const previousInitiative = initiative;

        setInitiative((current) => current ? ({
            ...current,
            ...updates
        }) : current);

        try {
            await updateInitiative(initiative.id, updates, projectId, project?.tenantId);
        } catch (error) {
            console.error('Failed to update initiative', error);
            setInitiative(previousInitiative);
            throw error;
        }
    };

    const handleSaveSettings = async (updates: Partial<Initiative>) => {
        await applyInitiativeUpdates(updates);
    };

    const handleAttachTask = async () => {
        if (!attachTaskId || !projectId) return;
        await updateTaskInitiative(attachTaskId, initiative.id, projectId, project?.tenantId);
        setAttachTaskId('');
        setShowAttachTaskModal(false);
    };

    const handleDelete = async () => {
        if (!projectId) return;
        const confirmed = await confirm(
            t('initiatives.detail.deleteTitle'),
            t('initiatives.detail.deleteMessage').replace('{title}', initiative.title)
        );
        if (!confirmed) return;
        await deleteInitiative(initiative.id, projectId, project?.tenantId);
        navigate(`/project/${projectId}/initiatives${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`);
    };

    return (
        <div className="initiative-detail">
            <header className="initiative-detail__hero">
                <div className="initiative-detail__hero-glow" />
                <div className="initiative-detail__hero-content">
                    <div className="initiative-detail__hero-layout">
                        <div className="initiative-detail__hero-main">
                            <div className="initiative-detail__badge-row">
                                <Link to={`/project/${projectId}/initiatives`} className="initiative-detail__nav-pill">
                                    <span className="material-symbols-outlined">west</span>
                                    {t('initiatives.list.title')}
                                </Link>
                                <Link to={`/project/${projectId}`} className="initiative-detail__nav-pill">
                                    <span className="material-symbols-outlined">deployed_code</span>
                                    {project?.title || t('nav.initiatives')}
                                </Link>
                                {sourceIdea && (
                                    <Link to={`/project/${projectId}/flows/${sourceIdea.id}`} className="initiative-detail__nav-pill">
                                        <span className="material-symbols-outlined">emoji_objects</span>
                                        {t('initiatives.detail.fromFlow')}
                                    </Link>
                                )}
                                <span className={`initiative-detail__pill initiative-detail__pill--${getTone(initiative.status)}`}>
                                    <span className="material-symbols-outlined">track_changes</span>
                                    {initiativeStatusLabels[initiative.status] || initiative.status}
                                </span>
                                {initiative.priority && (
                                    <span className={`initiative-detail__pill initiative-detail__pill--${getTone(initiative.priority)}`}>
                                        <span className="material-symbols-outlined">flag</span>
                                        {priorityLabels[initiative.priority] || initiative.priority}
                                    </span>
                                )}
                                {initiativeHealth && (
                                    <span className={`initiative-detail__pill initiative-detail__pill--${getTone(initiativeHealth.status)}`}>
                                        <span className="material-symbols-outlined">{getHealthIcon(initiativeHealth.status)}</span>
                                        {healthLabels[initiativeHealth.status] || initiativeHealth.status}
                                    </span>
                                )}
                            </div>

                            <h1 className="initiative-detail__title">{initiative.title}</h1>

                            <div className="initiative-detail__facts">
                                {initiativeHeroFacts.map((fact) => (
                                    <div key={fact.label} className="initiative-detail__fact">
                                        <span className="material-symbols-outlined initiative-detail__fact-icon">{fact.icon}</span>
                                        <div className="initiative-detail__fact-copy">
                                            <span className="initiative-detail__fact-value">{fact.value}</span>
                                            <span className="initiative-detail__fact-label">{fact.label}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="initiative-detail__hero-actions">
                            {canManageInitiative && (
                                <>
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        className="initiative-detail__primary-action"
                                        onClick={() => setShowSettingsModal(true)}
                                        icon={<span className="material-symbols-outlined initiative-detail__action-icon">edit</span>}
                                    >
                                        {t('initiatives.detail.editAction')}
                                    </Button>
                                    <div className="initiative-detail__action-toolbar">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleStartInitiativeFocus}
                                            className="initiative-detail__action-button"
                                            data-state={focusItemId === initiative.id ? 'focused' : 'default'}
                                        >
                                            <span className="material-symbols-outlined initiative-detail__action-icon">
                                                {focusItemId === initiative.id ? 'center_focus_strong' : 'center_focus_weak'}
                                            </span>
                                        </Button>
                                        <span className="initiative-detail__action-divider" />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleDelete}
                                            className="initiative-detail__action-button initiative-detail__action-button--danger"
                                            aria-label={t('common.delete')}
                                        >
                                            <span className="material-symbols-outlined initiative-detail__action-icon">delete</span>
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                </div>
            </header>

            <div className="initiative-detail__layout">
                <section className="initiative-detail__main">
                    <div className="initiative-detail__meta-grid">
                        <div className="app-card initiative-detail__card">
                            <div className="initiative-detail__card-header">
                                <span className="material-symbols-outlined initiative-detail__card-icon">flag</span>
                                <span className="initiative-detail__card-label">{t('taskDetail.priority.label')}</span>
                            </div>
                            <div className="initiative-detail__card-body">
                                {canManageInitiative ? (
                                    <div ref={priorityMenuRef} className="initiative-detail__select">
                                        <button
                                            type="button"
                                            onClick={() => setPriorityMenuOpen((open) => !open)}
                                            className={`initiative-detail__select-trigger initiative-detail__select-trigger--${getTone(initiative.priority)}`}
                                            data-open={priorityMenuOpen ? 'true' : 'false'}
                                        >
                                            <span className="initiative-detail__select-value">
                                                <span className="material-symbols-outlined initiative-detail__select-icon">
                                                    {getPriorityIcon(initiative.priority)}
                                                </span>
                                                {initiative.priority ? (priorityLabels[initiative.priority] || initiative.priority) : t('projectDetails.notSet')}
                                            </span>
                                            <span className="material-symbols-outlined initiative-detail__select-chevron">expand_more</span>
                                        </button>
                                        {priorityMenuOpen && (
                                            <div className="initiative-detail__select-menu">
                                                {(['Low', 'Medium', 'High', 'Urgent'] as const).map((priority) => (
                                                    <button
                                                        key={priority}
                                                        type="button"
                                                        onClick={() => {
                                                            setPriorityMenuOpen(false);
                                                            void applyInitiativeUpdates({ priority });
                                                        }}
                                                        className={`initiative-detail__select-item initiative-detail__select-item--${getTone(priority)} ${initiative.priority === priority ? 'initiative-detail__select-item--selected' : ''}`}
                                                    >
                                                        <span className="initiative-detail__select-item-label">
                                                            <span className="material-symbols-outlined initiative-detail__select-icon">
                                                                {getPriorityIcon(priority)}
                                                            </span>
                                                            {priorityLabels[priority]}
                                                        </span>
                                                        {initiative.priority === priority && (
                                                            <span className="material-symbols-outlined initiative-detail__select-item-check">check</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className={`initiative-detail__static-pill initiative-detail__static-pill--${getTone(initiative.priority)}`}>
                                        <span className="material-symbols-outlined initiative-detail__select-icon">{getPriorityIcon(initiative.priority)}</span>
                                        {initiative.priority ? (priorityLabels[initiative.priority] || initiative.priority) : t('projectDetails.notSet')}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="app-card initiative-detail__card">
                            <div className="initiative-detail__card-header">
                                <span className="material-symbols-outlined initiative-detail__card-icon">timelapse</span>
                                <span className="initiative-detail__card-label">{t('taskDetail.status.label')}</span>
                            </div>
                            <div className="initiative-detail__card-body">
                                {canManageInitiative ? (
                                    <div ref={statusMenuRef} className="initiative-detail__select">
                                        <button
                                            type="button"
                                            onClick={() => setStatusMenuOpen((open) => !open)}
                                            className={`initiative-detail__select-trigger initiative-detail__select-trigger--${getTone(initiative.status)}`}
                                            data-open={statusMenuOpen ? 'true' : 'false'}
                                        >
                                            <span className="initiative-detail__select-value">
                                                <span className="material-symbols-outlined initiative-detail__select-icon">
                                                    {getInitiativeStatusIcon(initiative.status)}
                                                </span>
                                                {initiativeStatusLabels[initiative.status] || initiative.status}
                                            </span>
                                            <span className="material-symbols-outlined initiative-detail__select-chevron">expand_more</span>
                                        </button>
                                        {statusMenuOpen && (
                                            <div className="initiative-detail__select-menu">
                                                {initiativeStatusOptions.map((status) => (
                                                    <button
                                                        key={status}
                                                        type="button"
                                                        onClick={() => {
                                                            setStatusMenuOpen(false);
                                                            void applyInitiativeUpdates({ status });
                                                        }}
                                                        className={`initiative-detail__select-item initiative-detail__select-item--${getTone(status)} ${initiative.status === status ? 'initiative-detail__select-item--selected' : ''}`}
                                                    >
                                                        <span className="initiative-detail__select-item-label">
                                                            <span className="material-symbols-outlined initiative-detail__select-icon">
                                                                {getInitiativeStatusIcon(status)}
                                                            </span>
                                                            {initiativeStatusLabels[status] || status}
                                                        </span>
                                                        {initiative.status === status && (
                                                            <span className="material-symbols-outlined initiative-detail__select-item-check">check</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className={`initiative-detail__static-pill initiative-detail__static-pill--${getTone(initiative.status)}`}>
                                        <span className="material-symbols-outlined initiative-detail__select-icon">{getInitiativeStatusIcon(initiative.status)}</span>
                                        {initiativeStatusLabels[initiative.status] || initiative.status}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Assignees Card */}
                        <div className="app-card initiative-detail__card">
                            <div className="initiative-detail__card-header">
                                <span className="material-symbols-outlined initiative-detail__card-icon">group</span>
                                <span className="initiative-detail__card-label">{t('taskDetail.assignees.label')}</span>
                            </div>
                            <div className="initiative-detail__card-body initiative-detail__assignee-card">
                                <MultiAssigneeSelector
                                    projectId={projectId!}
                                    assigneeIds={initiative.assigneeIds || []}
                                    assignedGroupIds={initiative.assignedGroupIds || []}
                                    onChange={(ids) => void applyInitiativeUpdates({ assigneeIds: ids })}
                                    onGroupChange={(ids) => void applyInitiativeUpdates({ assignedGroupIds: ids })}
                                />
                            </div>
                        </div>
                    </div>

                    <Card className={`initiative-detail__panel initiative-detail__panel--feedback ${initiative.feedbackForm?.enabled ? 'is-enabled' : 'is-disabled'}`}>
                        <div className="initiative-detail__feedback-header">
                            <div className="initiative-detail__feedback-route">
                                <span className="material-symbols-outlined">
                                    {initiative.feedbackForm?.enabled ? 'campaign' : 'forum'}
                                </span>
                                <div>
                                    <div className="initiative-detail__feedback-title-row">
                                        <h2>{t('initiatives.feedback.sectionTitle')}</h2>
                                        <span className={`initiative-detail__feedback-status ${initiative.feedbackForm?.enabled ? 'is-enabled' : 'is-disabled'}`}>
                                            {initiative.feedbackForm?.enabled
                                                ? t('initiatives.feedback.status.enabled')
                                                : t('initiatives.feedback.status.disabled')}
                                        </span>
                                    </div>
                                    <strong>
                                        {initiative.feedbackForm?.enabled
                                            ? t('initiatives.feedback.route.enabledTitle')
                                            : t('initiatives.feedback.route.disabledTitle')}
                                    </strong>
                                </div>
                            </div>

                            <div className="initiative-detail__feedback-metrics" aria-label={t('initiatives.feedback.title')}>
                                <div className="initiative-detail__feedback-metric">
                                    <span className="initiative-detail__feedback-metric-value">{feedbackTasks.length}</span>
                                    <span className="initiative-detail__feedback-metric-label">{t('initiatives.feedback.stats.entries')}</span>
                                </div>
                                <div className="initiative-detail__feedback-metric">
                                    <span className="initiative-detail__feedback-metric-value">{feedbackAttachmentCount}</span>
                                    <span className="initiative-detail__feedback-metric-label">{t('initiatives.feedback.stats.images')}</span>
                                </div>
                                <div className="initiative-detail__feedback-metric">
                                    <span className="initiative-detail__feedback-metric-value">{feedbackVisibleFieldCount}</span>
                                    <span className="initiative-detail__feedback-metric-label">{t('initiatives.feedback.stats.fields')}</span>
                                </div>
                            </div>
                            <div className="initiative-detail__feedback-actions">
                                {initiative.feedbackForm?.enabled ? (
                                    <>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={<span className="material-symbols-outlined">forum</span>}
                                            onClick={() => document.getElementById('initiative-work-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                        >
                                            {t('initiatives.feedback.entriesAction').replace('{count}', String(feedbackTasks.length))}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon={<span className="material-symbols-outlined">tune</span>}
                                            onClick={() => setShowFeedbackModal(true)}
                                        >
                                            {t('initiatives.feedback.editAction')}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        icon={<span className="material-symbols-outlined">add_link</span>}
                                        onClick={() => setShowFeedbackModal(true)}
                                    >
                                        {t('initiatives.feedback.enableAction')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>

                    <Card className="initiative-detail__panel initiative-detail__panel--summary">
                        <div className="initiative-detail__section-header">
                            <div>
                                <span className="initiative-detail__section-eyebrow">{t('initiatives.detail.dashboardTitle')}</span>
                                <h2>{t('initiatives.detail.summaryTitle')}</h2>
                            </div>
                            {canManageInitiative && (
                                <Button variant="secondary" size="sm" onClick={() => setShowSettingsModal(true)}>
                                    {t('initiatives.detail.editAction')}
                                </Button>
                            )}
                        </div>

                        <div className="initiative-detail__summary-layout">
                            <div className="initiative-detail__summary-block initiative-detail__summary-block--wide">
                                <div className="initiative-detail__subsection-title">
                                    <span className="material-symbols-outlined">notes</span>
                                    <span>{t('initiatives.fields.description')}</span>
                                </div>
                                <div className="initiative-detail__summary-content">
                                    <p className={`initiative-detail__summary-copy ${!initiative.description ? 'is-empty' : ''}`}>
                                        {initiative.description || t('initiatives.detail.noDescription')}
                                    </p>
                                </div>
                            </div>

                            <div className="initiative-detail__summary-block">
                                <div className="initiative-detail__subsection-title">
                                    <span className="material-symbols-outlined">checklist</span>
                                    <span>{t('initiatives.fields.successMetric')}</span>
                                </div>
                                <div className="initiative-detail__summary-content">
                                    <p className={`initiative-detail__summary-copy ${!initiative.successMetric ? 'is-empty' : ''}`}>
                                        {initiative.successMetric || t('initiatives.detail.noSuccessMetric')}
                                    </p>
                                </div>
                            </div>

                            <div className="initiative-detail__summary-block">
                                <div className="initiative-detail__subsection-title">
                                    <span className="material-symbols-outlined">rocket_launch</span>
                                    <span>{t('initiatives.fields.outcome')}</span>
                                </div>
                                <div className="initiative-detail__summary-content">
                                    <p className={`initiative-detail__summary-copy ${!initiative.outcome ? 'is-empty' : ''}`}>
                                        {initiative.outcome || t('initiatives.detail.noOutcome')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="initiative-detail__panel initiative-detail__panel--work" id="initiative-work-panel">
                        <div className="initiative-detail__work-header">
                            <div className="initiative-detail__subtasks-title">
                                <h3 className="initiative-detail__section-title">
                                    <span className="material-symbols-outlined initiative-detail__section-icon">checklist</span>
                                    {t('initiatives.detail.workTitle')}
                                </h3>
                                {tasks.length > 0 && (
                                    <span className="initiative-detail__subtasks-count">{tasks.length}</span>
                                )}
                            </div>

                            <div className="initiative-detail__subtasks-progress">
                                <div className="initiative-detail__subtasks-bar">
                                    <div
                                        className="initiative-detail__subtasks-bar-fill"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <span className="initiative-detail__subtasks-progress-label">{Math.round(progress)}%</span>
                            </div>
                        </div>

                        <div className="initiative-detail__tasks-card">
                            {canManageInitiativeTasks && (
                                <div className="initiative-detail__tasks-actions">
                                    <Button variant="primary" size="sm" onClick={() => setShowTaskCreateModal(true)}>
                                        {t('initiatives.detail.createTask')}
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => setShowAttachTaskModal(true)}>
                                        {t('initiatives.detail.attachTask')}
                                    </Button>
                                </div>
                            )}

                            <div className="initiative-detail__task-list">
                                {tasks.length === 0 ? (
                                    <p className="initiative-detail__state initiative-detail__tasks-empty">{t('initiatives.detail.noTasks')}</p>
                                ) : tasks.map((task) => (
                                    <div key={task.id} className={`initiative-detail__task-row ${task.isCompleted || task.status === 'Done' ? 'is-done' : ''}`}>
                                        <div className="initiative-detail__task-row-main">
                                            <div className={`initiative-detail__task-check ${task.isCompleted || task.status === 'Done' ? 'is-done' : ''}`}>
                                                <span className="material-symbols-outlined">
                                                    {task.isCompleted || task.status === 'Done' ? 'check' : ''}
                                                </span>
                                            </div>
                                            <Link
                                                to={`/project/${projectId}/tasks/${task.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`}
                                                className="initiative-detail__task-link"
                                            >
                                                <div className="initiative-detail__task-copy">
                                                    <div className="initiative-detail__task-title-row">
                                                        <strong className={`initiative-detail__task-title ${task.isCompleted || task.status === 'Done' ? 'is-done' : ''}`}>{task.title}</strong>
                                                        <div className="initiative-detail__task-meta">
                                                            <span className={`initiative-detail__task-pill initiative-detail__task-pill--${getTone(task.status)}`}>
                                                                {taskStatusLabels[task.status || 'Open'] || task.status || t('tasks.status.open')}
                                                            </span>
                                                            {task.priority && (
                                                                <span className={`initiative-detail__task-pill initiative-detail__task-pill--${getTone(task.priority)}`}>
                                                                    {priorityLabels[task.priority] || task.priority}
                                                                </span>
                                                            )}
                                                            {task.dueDate && (
                                                                <span className="initiative-detail__task-pill initiative-detail__task-pill--neutral">
                                                                    {formatDisplayDate(task.dueDate)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        </div>
                                        {canManageInitiativeTasks && (
                                            <div className="initiative-detail__task-row-actions">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => updateTaskInitiative(task.id, null, projectId, project?.tenantId)}
                                                >
                                                    {t('initiatives.detail.detachTask')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    <section className="initiative-detail__section">
                        <h3 className="initiative-detail__section-title">
                            <span className="material-symbols-outlined initiative-detail__section-icon">chat</span>
                            {t('taskDetail.comments.title').replace('{count}', String(commentCount))}
                        </h3>
                        <CommentSection
                            projectId={projectId}
                            targetId={initiative.id}
                            targetType="initiative"
                            tenantId={project?.tenantId}
                            targetTitle={initiative.title}
                            hideHeader
                            onCountChange={setCommentCount}
                        />
                    </section>
                </section>

                <aside className="initiative-detail__sidebar">
                    <Button
                        variant={focusItemId === initiative.id ? 'secondary' : 'primary'}
                        size="md"
                        className="initiative-detail__focus-action initiative-detail__focus-action--sidebar"
                        data-state={focusItemId === initiative.id ? 'focused' : 'default'}
                        onClick={handleStartInitiativeFocus}
                        icon={<span className="material-symbols-outlined initiative-detail__action-icon">{focusItemId === initiative.id ? 'center_focus_strong' : 'center_focus_weak'}</span>}
                    >
                        {focusItemId === initiative.id ? t('initiatives.detail.currentFocus') : t('initiatives.detail.setFocusTask')}
                    </Button>

                    <Card className="initiative-detail__panel initiative-detail__panel--sidebar">
                        <div className="initiative-detail__section-header">
                            <div>
                                <span className="initiative-detail__section-eyebrow">{t('initiatives.detail.dashboardTitle')}</span>
                                <h2>{t('taskDetail.timeline.label')}</h2>
                            </div>
                        </div>
                        <div className="initiative-detail__info-list">
                            <div className="initiative-detail__timeline-field">
                                <span className="initiative-detail__timeline-label">{t('taskDetail.timeline.startDate')}</span>
                                <DatePicker
                                    value={initiative.startDate ? new Date(initiative.startDate) : null}
                                    onChange={(date) => void applyInitiativeUpdates({ startDate: date ? format(date, 'yyyy-MM-dd') : '' })}
                                    disabled={!canManageInitiative}
                                />
                            </div>
                            <div className="initiative-detail__timeline-field">
                                <span className="initiative-detail__timeline-label">{t('taskDetail.timeline.dueDate')}</span>
                                <DatePicker
                                    value={initiative.dueDate ? new Date(initiative.dueDate) : null}
                                    onChange={(date) => void applyInitiativeUpdates({ dueDate: date ? format(date, 'yyyy-MM-dd') : '' })}
                                    disabled={!canManageInitiative}
                                />
                            </div>
                        </div>
                    </Card>

                    <Card className="initiative-detail__panel initiative-detail__panel--sidebar">
                        <div className="initiative-detail__section-header">
                            <div>
                                <span className="initiative-detail__section-eyebrow">{t('initiatives.detail.dashboardTitle')}</span>
                                <h2>{t('initiatives.detail.progressTitle')}</h2>
                            </div>
                        </div>
                        <div className="initiative-detail__info-list">
                            <div className="initiative-detail__info-row">
                                <span>{t('initiatives.summary.workItems')}</span>
                                <strong>{tasks.length}</strong>
                            </div>
                            <div className="initiative-detail__info-row">
                                <span>{t('initiatives.detail.activeTasks')}</span>
                                <strong>{activeTaskCount}</strong>
                            </div>
                            <div className="initiative-detail__info-row">
                                <span>{t('initiatives.summary.completed')}</span>
                                <strong>{completedTaskCount}</strong>
                            </div>
                            <div className="initiative-detail__info-row">
                                <span>{t('initiatives.summary.blocked')}</span>
                                <strong>{blockedTaskCount}</strong>
                            </div>
                        </div>
                    </Card>

                    <Card className="initiative-detail__panel initiative-detail__panel--sidebar">
                        <div className="initiative-detail__section-header">
                            <div>
                                <span className="initiative-detail__section-eyebrow">{t('initiatives.detail.contextTitle')}</span>
                                <h2>{t('initiatives.detail.detailsTitle')}</h2>
                            </div>
                        </div>
                        <div className="initiative-detail__info-list">
                            <div className="initiative-detail__info-row">
                                <span>{t('initiatives.detail.projectLabel')}</span>
                                <Link to={`/project/${projectId}`} className="initiative-detail__inline-link">
                                    {project?.title || t('nav.initiatives')}
                                </Link>
                            </div>
                            <div className="initiative-detail__info-row">
                                <span>{t('initiatives.detail.sourceLabel')}</span>
                                {sourceIdea ? (
                                    <Link to={`/project/${projectId}/flows/${sourceIdea.id}`} className="initiative-detail__inline-link">
                                        {t('initiatives.detail.fromFlow')}
                                    </Link>
                                ) : (
                                    <strong>{t('initiatives.detail.sourceManual')}</strong>
                                )}
                            </div>
                        </div>
                    </Card>

                    <Card className="initiative-detail__panel initiative-detail__panel--sidebar">
                        <div className="initiative-detail__section-header">
                            <div>
                                <span className="initiative-detail__section-eyebrow">{t('initiatives.detail.milestonesTitle')}</span>
                                <h2>{t('initiatives.detail.milestonesTitle')}</h2>
                            </div>
                        </div>
                        {linkedMilestones.length === 0 ? (
                            <p className="initiative-detail__state">{t('initiatives.detail.noMilestones')}</p>
                        ) : (
                            <div className="initiative-detail__milestones">
                                {linkedMilestones.map((milestone) => (
                                    <div key={milestone.id} className="initiative-detail__milestone-card">
                                        <span className="material-symbols-outlined initiative-detail__milestone-icon">flag</span>
                                        <div className="initiative-detail__milestone-copy">
                                            <strong>{milestone.title}</strong>
                                            <span>{formatDisplayDate(milestone.dueDate) || t('taskDetail.timeline.noDueDate')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card className="initiative-detail__panel initiative-detail__panel--sidebar">
                        <div className="initiative-detail__section-header">
                            <div>
                                <span className="initiative-detail__section-eyebrow">{t('initiatives.detail.activityTitle')}</span>
                                <h2>{t('initiatives.detail.activityTitle')}</h2>
                            </div>
                        </div>
                        {activity.length === 0 ? (
                            <p className="initiative-detail__state">{t('initiatives.detail.noActivity')}</p>
                        ) : (
                            <div className="initiative-detail__activity-list">
                                {activity.map((entry) => (
                                    <div key={entry.id} className="initiative-detail__activity-row">
                                        <span className="material-symbols-outlined initiative-detail__activity-icon">
                                            {entry.type === 'comment' ? 'chat' :
                                                entry.type === 'status' ? 'track_changes' :
                                                    entry.type === 'priority' ? 'flag' :
                                                        entry.type === 'initiative' ? 'rocket_launch' :
                                                            entry.type === 'issue' ? 'bug_report' : 'bolt'}
                                        </span>
                                        <div className="initiative-detail__activity-copy">
                                            <strong>{entry.action}</strong>
                                            <span>{entry.user}</span>
                                        </div>
                                        {entry.createdAt && (
                                            <span className="initiative-detail__activity-time">{timeAgo(entry.createdAt)}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </aside>
            </div>

            <InitiativeSettingsModal
                isOpen={showSettingsModal}
                initiative={initiative}
                onClose={() => setShowSettingsModal(false)}
                onSave={handleSaveSettings}
            />

            <InitiativeFeedbackModal
                isOpen={showFeedbackModal}
                tenantId={project?.tenantId}
                projectId={projectId}
                initiative={initiative}
                onClose={() => setShowFeedbackModal(false)}
                onSaved={(feedbackForm) => {
                    setInitiative((current) => current ? { ...current, feedbackForm } : current);
                    setShowFeedbackModal(false);
                }}
            />

            {showTaskCreateModal && (
                <TaskCreateModal
                    projectId={projectId}
                    tenantId={project?.tenantId}
                    initialTaskFields={{ initiativeId: initiative.id }}
                    onClose={() => setShowTaskCreateModal(false)}
                    onCreated={() => setShowTaskCreateModal(false)}
                />
            )}

            <Modal
                isOpen={showAttachTaskModal}
                onClose={() => {
                    setShowAttachTaskModal(false);
                    setAttachTaskId('');
                }}
                title={t('initiatives.detail.attachTask')}
                size="md"
                footer={(
                    <>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setShowAttachTaskModal(false);
                                setAttachTaskId('');
                            }}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => void handleAttachTask()}
                            disabled={!attachTaskId}
                        >
                            {t('initiatives.detail.attachTask')}
                        </Button>
                    </>
                )}
            >
                <div className="initiative-detail__attach-modal">
                    <Select
                        value={attachTaskId || null}
                        onChange={(value) => setAttachTaskId(String(value))}
                        options={attachTaskOptions}
                        placeholder={t('initiatives.detail.attachPlaceholder')}
                    />
                    {attachTaskOptions.length === 0 && (
                        <p className="initiative-detail__state">{t('initiatives.detail.noAttachableTasks')}</p>
                    )}
                </div>
            </Modal>
        </div>
    );
};
