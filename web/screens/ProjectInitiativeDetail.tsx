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
                setSourceIdea(null);
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
            <div className="initiative-detail__header">
                <div className="initiative-detail__header-top">
                    <div className="initiative-detail__breadcrumb">
                        <Link to={`/project/${projectId}/initiatives`} className="initiative-detail__breadcrumb-link">
                            <span className="material-symbols-outlined">west</span>
                            {t('initiatives.list.title')}
                        </Link>
                        <span>/</span>
                        <Link to={`/project/${projectId}`} className="initiative-detail__breadcrumb-link">
                            {project?.title || t('nav.initiatives')}
                        </Link>
                        {sourceIdea && (
                            <>
                                <span>/</span>
                                <Link to={`/project/${projectId}/flows/${sourceIdea.id}`} className="initiative-detail__breadcrumb-link">
                                    {t('initiatives.detail.fromFlow')}
                                </Link>
                            </>
                        )}
                        <span>/</span>
                        <span className="initiative-detail__breadcrumb-current">
                            {initiative.title}
                        </span>
                    </div>

                    <div className="initiative-detail__quick-actions">
                        <button
                            type="button"
                            className="initiative-detail__icon-button"
                            onClick={handleStartInitiativeFocus}
                            data-state={focusItemId === initiative.id ? 'focused' : 'default'}
                            title={focusItemId === initiative.id ? t('initiatives.detail.currentFocus') : t('initiatives.detail.setFocusTask')}
                        >
                            <span className="material-symbols-outlined">
                                {focusItemId === initiative.id ? 'center_focus_strong' : 'center_focus_weak'}
                            </span>
                        </button>
                        {canManageInitiative && (
                            <button
                                type="button"
                                className="initiative-detail__icon-button initiative-detail__icon-button--danger"
                                onClick={handleDelete}
                                title={t('common.delete')}
                            >
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="initiative-detail__title-group">
                    <h1 className="initiative-detail__title">{initiative.title}</h1>
                </div>
            </div>

            <div className="initiative-detail__grid">
                <div className="initiative-detail__main">
                    {/* Description & Summary Panel */}
                    <div className="initiative-detail__section">
                        <div className="initiative-detail__section-header">
                            <h2 className="initiative-detail__section-title">
                                <span className="material-symbols-outlined">notes</span>
                                {t('initiatives.detail.summaryTitle')}
                            </h2>
                            {canManageInitiative && (
                                <Button variant="ghost" size="sm" onClick={() => setShowSettingsModal(true)}>
                                    <span className="material-symbols-outlined">edit</span>
                                </Button>
                            )}
                        </div>
                        <div className="initiative-detail__editor-box">
                            <div>
                                <h4>{t('initiatives.fields.description')}</h4>
                                <p className={!initiative.description ? 'is-empty' : ''}>
                                    {initiative.description || t('initiatives.detail.noDescription')}
                                </p>
                            </div>
                            {initiative.successMetric && (
                                <div>
                                    <h4>{t('initiatives.fields.successMetric')}</h4>
                                    <p>{initiative.successMetric}</p>
                                </div>
                            )}
                            {initiative.outcome && (
                                <div>
                                    <h4>{t('initiatives.fields.outcome')}</h4>
                                    <p>{initiative.outcome}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Feedback Form Panel */}
                    <div className="initiative-detail__section">
                        <div className="initiative-detail__section-header">
                            <h2 className="initiative-detail__section-title">
                                <span className="material-symbols-outlined">campaign</span>
                                {t('initiatives.feedback.sectionTitle')}
                            </h2>
                            <div className="initiative-detail__quick-actions">
                                {initiative.feedbackForm?.enabled && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => document.getElementById('initiative-work-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                        className="initiative-detail__icon-button"
                                        title={t('initiatives.feedback.entriesAction').replace('{count}', String(feedbackTasks.length))}
                                    >
                                        <span className="material-symbols-outlined">forum</span>
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowFeedbackModal(true)}
                                    className="initiative-detail__icon-button"
                                    title={t('initiatives.feedback.editAction')}
                                >
                                    <span className="material-symbols-outlined">{initiative.feedbackForm?.enabled ? 'tune' : 'add'}</span>
                                </Button>
                            </div>
                        </div>
                        <div className="initiative-detail__editor-box" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '24px', color: initiative.feedbackForm?.enabled ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                    {initiative.feedbackForm?.enabled ? 'check_circle' : 'cancel'}
                                </span>
                                <div>
                                    <p style={{ fontWeight: 600, margin: 0 }}>
                                        {initiative.feedbackForm?.enabled
                                            ? t('initiatives.feedback.status.enabled')
                                            : t('initiatives.feedback.status.disabled')}
                                    </p>
                                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                        {initiative.feedbackForm?.enabled
                                            ? t('initiatives.feedback.route.enabledTitle')
                                            : t('initiatives.feedback.route.disabledTitle')}
                                    </span>
                                </div>
                            </div>
                            {initiative.feedbackForm?.enabled && (
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <strong style={{ display: 'block', fontSize: '16px' }}>{feedbackTasks.length}</strong>
                                        <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)', textTransform: 'uppercase' }}>{t('initiatives.feedback.stats.entries')}</span>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <strong style={{ display: 'block', fontSize: '16px' }}>{feedbackAttachmentCount}</strong>
                                        <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)', textTransform: 'uppercase' }}>{t('initiatives.feedback.stats.images')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tasks Work Panel */}
                    <div className="initiative-detail__section" id="initiative-work-panel">
                        <div className="initiative-detail__section-header">
                            <h2 className="initiative-detail__section-title">
                                <span className="material-symbols-outlined">checklist</span>
                                {t('initiatives.detail.workTitle')}
                                {tasks.length > 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>({tasks.length})</span>}
                            </h2>
                            {tasks.length > 0 && (
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                    {Math.round(progress)}%
                                </div>
                            )}
                        </div>
                        
                        {canManageInitiativeTasks && (
                            <div className="initiative-detail__tasks-actions">
                                <Button variant="secondary" size="sm" onClick={() => setShowTaskCreateModal(true)}>
                                    <span className="material-symbols-outlined">add</span> {t('initiatives.detail.createTask')}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setShowAttachTaskModal(true)}>
                                    <span className="material-symbols-outlined">link</span> {t('initiatives.detail.attachTask')}
                                </Button>
                            </div>
                        )}

                        <div className="initiative-detail__task-list">
                            {tasks.length === 0 ? (
                                <div className="initiative-detail__editor-box" style={{ textAlign: 'center', padding: '32px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>list_alt</span>
                                    <p className="is-empty">{t('initiatives.detail.noTasks')}</p>
                                </div>
                            ) : tasks.map((task) => (
                                <div key={task.id} className={`initiative-detail__task-row ${task.isCompleted || task.status === 'Done' ? 'is-done' : ''}`}>
                                    <div className="initiative-detail__task-row-main">
                                        <div className={`initiative-detail__task-check ${task.isCompleted || task.status === 'Done' ? 'is-done' : ''}`}>
                                            <span className="material-symbols-outlined">check</span>
                                        </div>
                                        <Link
                                            to={`/project/${projectId}/tasks/${task.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`}
                                            className="initiative-detail__task-link"
                                        >
                                            <div className="initiative-detail__task-title-row">
                                                <h4 className={`initiative-detail__task-title ${task.isCompleted || task.status === 'Done' ? 'is-done' : ''}`}>
                                                    {task.title}
                                                </h4>
                                                <div className="initiative-detail__task-meta">
                                                    <span className={`initiative-detail__task-pill initiative-detail__status--${(task.status || 'Open').toLowerCase()}`}>
                                                        {taskStatusLabels[task.status || 'Open'] || task.status || t('tasks.status.open')}
                                                    </span>
                                                    {task.priority && (
                                                        <span className={`initiative-detail__task-pill initiative-detail__priority--${(task.priority).toLowerCase()}`}>
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
                                        </Link>
                                    </div>
                                    {canManageInitiativeTasks && (
                                        <button
                                            type="button"
                                            className="initiative-detail__icon-button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                updateTaskInitiative(task.id, null, projectId, project?.tenantId);
                                            }}
                                            title={t('initiatives.detail.detachTask')}
                                        >
                                            <span className="material-symbols-outlined">link_off</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="initiative-detail__section">
                        <h2 className="initiative-detail__section-title" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--color-surface-border)' }}>
                            <span className="material-symbols-outlined">forum</span>
                            {t('taskDetail.comments.title').replace('{count}', String(commentCount))}
                        </h2>
                        <CommentSection
                            projectId={projectId}
                            targetId={initiative.id}
                            targetType="initiative"
                            tenantId={project?.tenantId}
                            targetTitle={initiative.title}
                            hideHeader
                            onCountChange={setCommentCount}
                        />
                    </div>
                </div>

                <div className="initiative-detail__sidebar">
                    <div className="initiative-detail__sidebar-section">
                        <span className="initiative-detail__sidebar-label">{t('taskDetail.status.label')}</span>
                        {canManageInitiative ? (
                            <div ref={statusMenuRef} className="initiative-detail__select">
                                <button
                                    type="button"
                                    onClick={() => setStatusMenuOpen((open) => !open)}
                                    className="initiative-detail__select-trigger"
                                    data-open={statusMenuOpen ? 'true' : 'false'}
                                >
                                    <span className={`initiative-detail__select-value initiative-detail__status--${(initiative.status || 'Open').toLowerCase()}`}>
                                        <span className="material-symbols-outlined">
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
                                                className={`initiative-detail__select-item ${initiative.status === status ? 'initiative-detail__select-item--selected' : ''}`}
                                            >
                                                <span className={`initiative-detail__select-item-label initiative-detail__status--${status.toLowerCase()}`}>
                                                    <span className="material-symbols-outlined">
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
                            <div className={`initiative-detail__select-trigger initiative-detail__status--${(initiative.status || 'Open').toLowerCase()}`}>
                                <span className="initiative-detail__select-value">
                                    <span className="material-symbols-outlined">{getInitiativeStatusIcon(initiative.status)}</span>
                                    {initiativeStatusLabels[initiative.status] || initiative.status}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="initiative-detail__sidebar-section">
                        <span className="initiative-detail__sidebar-label">{t('taskDetail.priority.label')}</span>
                        {canManageInitiative ? (
                            <div ref={priorityMenuRef} className="initiative-detail__select">
                                <button
                                    type="button"
                                    onClick={() => setPriorityMenuOpen((open) => !open)}
                                    className="initiative-detail__select-trigger"
                                    data-open={priorityMenuOpen ? 'true' : 'false'}
                                >
                                    <span className={`initiative-detail__select-value initiative-detail__priority--${(initiative.priority || 'Medium').toLowerCase()}`}>
                                        <span className="material-symbols-outlined">
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
                                                className={`initiative-detail__select-item ${initiative.priority === priority ? 'initiative-detail__select-item--selected' : ''}`}
                                            >
                                                <span className={`initiative-detail__select-item-label initiative-detail__priority--${priority.toLowerCase()}`}>
                                                    <span className="material-symbols-outlined">
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
                            <div className={`initiative-detail__select-trigger initiative-detail__priority--${(initiative.priority || 'Medium').toLowerCase()}`}>
                                <span className="initiative-detail__select-value">
                                    <span className="material-symbols-outlined">{getPriorityIcon(initiative.priority)}</span>
                                    {initiative.priority ? (priorityLabels[initiative.priority] || initiative.priority) : t('projectDetails.notSet')}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="initiative-detail__sidebar-section">
                        <span className="initiative-detail__sidebar-label">{t('taskDetail.assignees.label')}</span>
                        <MultiAssigneeSelector
                            projectId={projectId!}
                            assigneeIds={initiative.assigneeIds || []}
                            assignedGroupIds={initiative.assignedGroupIds || []}
                            onChange={(ids) => void applyInitiativeUpdates({ assigneeIds: ids })}
                            onGroupChange={(ids) => void applyInitiativeUpdates({ assignedGroupIds: ids })}
                        />
                    </div>

                    <div className="initiative-detail__sidebar-section">
                        <span className="initiative-detail__sidebar-label">{t('taskDetail.timeline.label')}</span>
                        <div className="initiative-detail__date-grid">
                            <DatePicker
                                value={initiative.startDate ? new Date(initiative.startDate) : null}
                                onChange={(date) => void applyInitiativeUpdates({ startDate: date ? format(date, 'yyyy-MM-dd') : '' })}
                                disabled={!canManageInitiative}
                                placeholder={t('taskDetail.timeline.startDate')}
                            />
                            <DatePicker
                                value={initiative.dueDate ? new Date(initiative.dueDate) : null}
                                onChange={(date) => void applyInitiativeUpdates({ dueDate: date ? format(date, 'yyyy-MM-dd') : '' })}
                                disabled={!canManageInitiative}
                                placeholder={t('taskDetail.timeline.dueDate')}
                            />
                        </div>
                    </div>
                </div>
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
