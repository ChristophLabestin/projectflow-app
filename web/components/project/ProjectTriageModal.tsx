import React, { useEffect, useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, endOfToday, format, isWithinInterval, parseISO, startOfToday } from 'date-fns';
import type { Project, Task, TaskStatus } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { updateTaskFields } from '../../services/domain/tasksService';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { Select, type SelectOption } from '../common/Select/Select';
import { DatePicker } from '../common/DateTime/DatePicker';
import './project-triage-modal.scss';

type TriageQueueId = 'overdue' | 'blocked' | 'dueSoon' | 'unassigned' | 'noDate' | 'urgent' | 'all';
type TriageSavingAction = 'reschedule-tomorrow' | 'reschedule-week' | 'reschedule-custom' | 'assign' | 'status-progress' | 'status-blocked' | 'done' | null;

type TriageTeamMember = {
    id: string;
    displayName: string;
    photoURL?: string;
    role: string;
};

type TriageTaskFlags = {
    overdue: boolean;
    blocked: boolean;
    dueSoon: boolean;
    unassigned: boolean;
    noDate: boolean;
    urgent: boolean;
};

interface ProjectTriageModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    tasks: Task[];
    teamMemberProfiles: TriageTeamMember[];
    canManageTasks: boolean;
    onTasksUpdated: (updates: Record<string, Partial<Task>>) => void;
}

const toDateKey = (value?: string) => {
    if (!value) return '';
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];

    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return format(parsed, 'yyyy-MM-dd');
};

const dateKeyToDate = (value?: string) => {
    const key = toDateKey(value);
    if (!key) return null;

    const parsed = parseISO(key);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isOpenTask = (task: Task) => !task.legacyInitiativeRoot && !task.isCompleted && task.status !== 'Done';

const hasPersonAssignee = (task: Task) => Boolean(
    task.assigneeId
    || (Array.isArray(task.assigneeIds) && task.assigneeIds.length > 0)
    || (task.assignee && task.assignee.trim().length > 0)
);

const getTaskFlags = (task: Task, today: Date, dueSoonEnd: Date): TriageTaskFlags => {
    const dueDate = dateKeyToDate(task.dueDate);
    const overdue = Boolean(dueDate && dueDate < today);
    const dueSoon = Boolean(dueDate && isWithinInterval(dueDate, { start: today, end: dueSoonEnd }) && !overdue);
    const blocked = task.status === 'Blocked';
    const unassigned = !hasPersonAssignee(task) && (!task.assignedGroupIds || task.assignedGroupIds.length === 0);
    const noDate = !dueDate;
    const urgent = task.priority === 'Urgent' || task.priority === 'High';

    return { overdue, blocked, dueSoon, unassigned, noDate, urgent };
};

export const ProjectTriageModal: React.FC<ProjectTriageModalProps> = ({
    isOpen,
    onClose,
    project,
    tasks,
    teamMemberProfiles,
    canManageTasks,
    onTasksUpdated
}) => {
    const { t, dateFormat, dateLocale } = useLanguage();
    const { showSuccess, showError } = useToast();
    const today = useMemo(() => startOfToday(), []);
    const dueSoonEnd = useMemo(() => addDays(endOfToday(), 7), []);
    const tomorrowKey = useMemo(() => format(addDays(today, 1), 'yyyy-MM-dd'), [today]);
    const nextWeekKey = useMemo(() => format(addDays(today, 7), 'yyyy-MM-dd'), [today]);
    const [activeQueue, setActiveQueue] = useState<TriageQueueId>('overdue');
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
    const [customDueDate, setCustomDueDate] = useState<Date | null>(() => addDays(today, 1));
    const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
    const [savingAction, setSavingAction] = useState<TriageSavingAction>(null);

    const memberLookup = useMemo(() => (
        new Map(teamMemberProfiles.map((member) => [member.id, member]))
    ), [teamMemberProfiles]);

    const openTasks = useMemo(() => (
        tasks.filter(isOpenTask)
    ), [tasks]);

    const taskFlags = useMemo(() => (
        new Map(openTasks.map((task) => [task.id, getTaskFlags(task, today, dueSoonEnd)]))
    ), [dueSoonEnd, openTasks, today]);

    const queueCounts = useMemo<Record<TriageQueueId, number>>(() => {
        const counts: Record<TriageQueueId, number> = {
            overdue: 0,
            blocked: 0,
            dueSoon: 0,
            unassigned: 0,
            noDate: 0,
            urgent: 0,
            all: openTasks.length
        };

        openTasks.forEach((task) => {
            const flags = taskFlags.get(task.id);
            if (!flags) return;
            if (flags.overdue) counts.overdue += 1;
            if (flags.blocked) counts.blocked += 1;
            if (flags.dueSoon) counts.dueSoon += 1;
            if (flags.unassigned) counts.unassigned += 1;
            if (flags.noDate) counts.noDate += 1;
            if (flags.urgent) counts.urgent += 1;
        });

        return counts;
    }, [openTasks, taskFlags]);

    const defaultQueue = useMemo<TriageQueueId>(() => {
        if (queueCounts.overdue > 0) return 'overdue';
        if (queueCounts.blocked > 0) return 'blocked';
        if (queueCounts.unassigned > 0) return 'unassigned';
        if (queueCounts.dueSoon > 0) return 'dueSoon';
        if (queueCounts.noDate > 0) return 'noDate';
        if (queueCounts.urgent > 0) return 'urgent';
        return 'all';
    }, [queueCounts]);

    useEffect(() => {
        if (!isOpen) return;
        setActiveQueue(defaultQueue);
        setSelectedTaskIds(new Set());
        setCustomDueDate(addDays(today, 1));
        setSelectedAssigneeId('');
    }, [defaultQueue, isOpen, today]);

    const triageScore = (task: Task) => {
        const flags = taskFlags.get(task.id);
        if (!flags) return 0;
        let score = 0;
        if (flags.blocked) score += 120;
        if (flags.overdue) score += 100;
        if (flags.urgent) score += 70;
        if (flags.unassigned) score += 45;
        if (flags.noDate) score += 35;
        if (flags.dueSoon) score += 25;
        return score;
    };

    const visibleTasks = useMemo(() => (
        openTasks
            .filter((task) => {
                if (activeQueue === 'all') return true;
                return taskFlags.get(task.id)?.[activeQueue] === true;
            })
            .sort((a, b) => {
                const scoreDiff = triageScore(b) - triageScore(a);
                if (scoreDiff !== 0) return scoreDiff;
                const aDue = dateKeyToDate(a.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
                const bDue = dateKeyToDate(b.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
                return aDue - bDue || a.title.localeCompare(b.title);
            })
    ), [activeQueue, openTasks, taskFlags]);

    const selectedTasks = useMemo(() => (
        openTasks.filter((task) => selectedTaskIds.has(task.id))
    ), [openTasks, selectedTaskIds]);

    const visibleTaskIds = useMemo(() => visibleTasks.map((task) => task.id), [visibleTasks]);
    const allVisibleSelected = visibleTaskIds.length > 0 && visibleTaskIds.every((taskId) => selectedTaskIds.has(taskId));
    const selectedCount = selectedTasks.length;

    const queueOptions: Array<{ id: TriageQueueId; icon: string; label: string; count: number }> = [
        { id: 'overdue', icon: 'event_busy', label: t('projectOverview.triage.queues.overdue'), count: queueCounts.overdue },
        { id: 'blocked', icon: 'block', label: t('projectOverview.triage.queues.blocked'), count: queueCounts.blocked },
        { id: 'dueSoon', icon: 'event_upcoming', label: t('projectOverview.triage.queues.dueSoon'), count: queueCounts.dueSoon },
        { id: 'unassigned', icon: 'person_search', label: t('projectOverview.triage.queues.unassigned'), count: queueCounts.unassigned },
        { id: 'noDate', icon: 'event_note', label: t('projectOverview.triage.queues.noDate'), count: queueCounts.noDate },
        { id: 'urgent', icon: 'priority_high', label: t('projectOverview.triage.queues.urgent'), count: queueCounts.urgent },
        { id: 'all', icon: 'select_all', label: t('projectOverview.triage.queues.all'), count: queueCounts.all }
    ];

    const activeQueueOption = queueOptions.find((queue) => queue.id === activeQueue) || queueOptions[0];
    const visibleQueueOptions = queueOptions.filter((queue) => (
        queue.id === 'all' || queue.count > 0 || queue.id === activeQueue
    ));

    const assigneeOptions: SelectOption[] = teamMemberProfiles.map((member) => ({
        value: member.id,
        label: member.displayName
    }));

    const teamLoad = useMemo(() => (
        teamMemberProfiles
            .map((member) => {
                const assignedTasks = openTasks.filter((task) => (
                    task.assigneeId === member.id || task.assigneeIds?.includes(member.id)
                ));
                const overdueCount = assignedTasks.filter((task) => taskFlags.get(task.id)?.overdue).length;
                return {
                    member,
                    openCount: assignedTasks.length,
                    overdueCount
                };
            })
            .sort((a, b) => a.openCount - b.openCount || a.member.displayName.localeCompare(b.member.displayName))
    ), [openTasks, taskFlags, teamMemberProfiles]);

    const suggestedAssignee = teamLoad[0]?.member;

    const selectTask = (taskId: string) => {
        setSelectedTaskIds((current) => {
            const next = new Set(current);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    };

    const toggleVisibleSelection = () => {
        setSelectedTaskIds((current) => {
            const next = new Set(current);
            if (allVisibleSelected) {
                visibleTaskIds.forEach((taskId) => next.delete(taskId));
            } else {
                visibleTaskIds.forEach((taskId) => next.add(taskId));
            }
            return next;
        });
    };

    const clearSelection = () => setSelectedTaskIds(new Set());

    const applyToSelected = async (
        action: Exclude<TriageSavingAction, null>,
        buildUpdates: (task: Task) => Partial<Task>,
        successKey: string
    ) => {
        if (!canManageTasks || selectedTasks.length === 0 || savingAction) return;

        setSavingAction(action);
        try {
            const updatesByTask = Object.fromEntries(
                selectedTasks.map((task) => [task.id, buildUpdates(task)])
            ) as Record<string, Partial<Task>>;

            await Promise.all(selectedTasks.map((task) => (
                updateTaskFields(task.id, updatesByTask[task.id], project.id, project.tenantId)
            )));

            onTasksUpdated(updatesByTask);
            setSelectedTaskIds(new Set());
            showSuccess(t(successKey).replace('{count}', String(selectedTasks.length)));
        } catch (error) {
            console.error('Failed to apply project triage update', error);
            showError(t('projectOverview.triage.toast.error'));
        } finally {
            setSavingAction(null);
        }
    };

    const applyDueDate = (dateKey: string, action: Exclude<TriageSavingAction, null>) => {
        void applyToSelected(action, () => ({ dueDate: dateKey }), 'projectOverview.triage.toast.updatedDates');
    };

    const applyAssignee = () => {
        const member = memberLookup.get(selectedAssigneeId);
        if (!member) return;

        void applyToSelected(
            'assign',
            () => ({
                assigneeId: member.id,
                assigneeIds: [member.id],
                assignee: member.displayName
            }),
            'projectOverview.triage.toast.assigned'
        );
    };

    const applyStatusValue = (status: TaskStatus, action: Exclude<TriageSavingAction, null>, successKey = 'projectOverview.triage.toast.status') => {
        const isDone = status === 'Done';
        void applyToSelected(
            action,
            () => ({
                status,
                isCompleted: isDone
            }),
            successKey
        );
    };

    const markDone = () => {
        applyStatusValue(
            'Done',
            'done',
            'projectOverview.triage.toast.done'
        );
    };

    const getTaskReason = (task: Task) => {
        const flags = taskFlags.get(task.id);
        if (flags?.blocked) return { label: t('projectOverview.triage.queues.blocked'), tone: 'danger' };
        if (flags?.overdue) return { label: t('projectOverview.triage.queues.overdue'), tone: 'danger' };
        if (flags?.urgent) return { label: t('projectOverview.triage.queues.urgent'), tone: 'warning' };
        if (flags?.unassigned) return { label: t('projectOverview.triage.queues.unassigned'), tone: 'warning' };
        if (flags?.noDate) return { label: t('projectOverview.triage.queues.noDate'), tone: 'neutral' };
        if (flags?.dueSoon) return { label: t('projectOverview.triage.queues.dueSoon'), tone: 'primary' };
        return { label: t('projectOverview.triage.queues.all'), tone: 'neutral' };
    };

    const getAssigneeLabel = (task: Task) => {
        const ids = [
            ...(task.assigneeId ? [task.assigneeId] : []),
            ...(Array.isArray(task.assigneeIds) ? task.assigneeIds : [])
        ].filter((value, index, array) => value && array.indexOf(value) === index);

        const names = ids
            .map((assigneeId) => memberLookup.get(assigneeId)?.displayName)
            .filter(Boolean) as string[];

        if (names.length > 0) {
            return names.length === 1
                ? names[0]
                : t('projectOverview.triage.task.multiAssignee').replace('{name}', names[0]).replace('{count}', String(names.length - 1));
        }

        return task.assignee || t('projectOverview.triage.task.unassigned');
    };

    const getDueLabel = (task: Task) => {
        const dueDate = dateKeyToDate(task.dueDate);
        if (!dueDate) return t('projectOverview.triage.task.noDate');

        const dayDiff = differenceInCalendarDays(dueDate, today);
        const formattedDate = format(dueDate, dateFormat, { locale: dateLocale });

        if (dayDiff < 0) {
            return t('projectOverview.triage.task.daysOverdue')
                .replace('{count}', String(Math.abs(dayDiff)))
                .replace('{date}', formattedDate);
        }

        if (dayDiff === 0) {
            return t('projectOverview.triage.task.dueToday');
        }

        return t('projectOverview.triage.task.dueDate').replace('{date}', formattedDate);
    };

    const getDueTone = (task: Task) => {
        const flags = taskFlags.get(task.id);
        if (flags?.overdue) return 'danger';
        if (flags?.dueSoon) return 'warning';
        if (flags?.noDate) return 'neutral';
        return 'primary';
    };

    const actionDisabled = !canManageTasks || selectedCount === 0 || Boolean(savingAction);

    const hasSelection = selectedCount > 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('projectOverview.triage.title')}
            size="full"
            closeOnOutsideClick={!savingAction}
            footer={
                <div className="project-triage-modal__footer">
                    <span className="project-triage-modal__footer-summary">
                        <span className="material-symbols-outlined" aria-hidden="true">checklist</span>
                        {hasSelection
                            ? t('projectOverview.triage.footerSelection').replace('{count}', String(selectedCount))
                            : t('projectOverview.triage.summaryOpen').replace('{count}', String(queueCounts.all))}
                    </span>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={onClose}
                        disabled={Boolean(savingAction)}
                    >
                        {t('common.close', 'Close')}
                    </Button>
                </div>
            }
        >
            <div className="project-triage-modal">
                {!canManageTasks && (
                    <div className="project-triage-modal__readonly">
                        <span className="material-symbols-outlined">lock</span>
                        {t('projectOverview.triage.readonly')}
                    </div>
                )}

                <div className="project-triage-modal__filters" role="tablist" aria-label={t('projectOverview.triage.queueLabel')}>
                    {visibleQueueOptions.map((queue) => (
                        <button
                            key={queue.id}
                            type="button"
                            role="tab"
                            aria-selected={activeQueue === queue.id}
                            className={`project-triage-modal__filter ${activeQueue === queue.id ? 'is-active' : ''}`}
                            onClick={() => setActiveQueue(queue.id)}
                        >
                            <span className="project-triage-modal__filter-icon material-symbols-outlined" aria-hidden="true">{queue.icon}</span>
                            <span className="project-triage-modal__filter-label">{queue.label}</span>
                            <span className="project-triage-modal__filter-count">{queue.count}</span>
                        </button>
                    ))}
                </div>

                <div className={`project-triage-modal__workspace ${hasSelection ? 'has-selection' : ''}`}>
                    <section className="project-triage-modal__queue-panel">
                        <header className="project-triage-modal__queue-header">
                            <div className="project-triage-modal__queue-title">
                                <h3>{activeQueueOption.label}</h3>
                                <p>{t('projectOverview.triage.visibleCount').replace('{count}', String(visibleTasks.length))}</p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={toggleVisibleSelection}
                                disabled={visibleTasks.length === 0 || !canManageTasks}
                            >
                                {allVisibleSelected ? t('projectOverview.triage.actions.deselectVisible') : t('projectOverview.triage.actions.selectVisible')}
                            </Button>
                        </header>

                        <div className="project-triage-modal__table" role="table" aria-label={t('projectOverview.triage.queueLabel')}>
                            {visibleTasks.length === 0 ? (
                                <div className="project-triage-modal__empty">
                                    <span className="material-symbols-outlined">task_alt</span>
                                    <strong>{t('projectOverview.triage.emptyTitle')}</strong>
                                    <p>{t('projectOverview.triage.empty')}</p>
                                </div>
                            ) : (
                                <div className="project-triage-modal__task-list">
                                    {visibleTasks.map((task) => {
                                        const checked = selectedTaskIds.has(task.id);
                                        const reason = getTaskReason(task);
                                        return (
                                            <label key={task.id} className={`project-triage-modal__task-row ${checked ? 'is-selected' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => selectTask(task.id)}
                                                    disabled={!canManageTasks || Boolean(savingAction)}
                                                />
                                                <span className="project-triage-modal__task-check">
                                                    <span className="material-symbols-outlined">check</span>
                                                </span>
                                                <span className="project-triage-modal__task-main">
                                                    <span className="project-triage-modal__task-title">{task.title}</span>
                                                    <span className="project-triage-modal__task-meta">
                                                        <span className={`project-triage-modal__reason is-${reason.tone}`}>{reason.label}</span>
                                                        <span className={`project-triage-modal__due is-${getDueTone(task)}`}>
                                                            <span className="material-symbols-outlined" aria-hidden="true">event</span>
                                                            {getDueLabel(task)}
                                                        </span>
                                                        <span className="project-triage-modal__owner">
                                                            <span className="material-symbols-outlined" aria-hidden="true">person</span>
                                                            {getAssigneeLabel(task)}
                                                        </span>
                                                    </span>
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="project-triage-modal__decision-panel" aria-label={t('projectOverview.triage.bulkLabel')}>
                        <header className="project-triage-modal__decision-header">
                            <div className="project-triage-modal__decision-count">
                                <strong>{selectedCount}</strong>
                                <span>{t('projectOverview.triage.actions.title')}</span>
                            </div>
                            {hasSelection && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearSelection}
                                    disabled={!canManageTasks || Boolean(savingAction)}
                                >
                                    {t('projectOverview.triage.actions.clearSelection')}
                                </Button>
                            )}
                        </header>

                        {!hasSelection ? (
                            <div className="project-triage-modal__decision-empty">
                                <span className="material-symbols-outlined" aria-hidden="true">ads_click</span>
                                <p>{t('projectOverview.triage.selectionEmpty')}</p>
                            </div>
                        ) : (
                            <div className="project-triage-modal__decision-body">
                                <section className="project-triage-modal__decision-section">
                                    <div className="project-triage-modal__decision-heading">
                                        <span className="material-symbols-outlined" aria-hidden="true">event_repeat</span>
                                        <strong>{t('projectOverview.triage.actions.rescheduleTitle')}</strong>
                                    </div>
                                    <div className="project-triage-modal__quick-grid">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => applyDueDate(tomorrowKey, 'reschedule-tomorrow')}
                                            isLoading={savingAction === 'reschedule-tomorrow'}
                                            disabled={actionDisabled}
                                        >
                                            {t('projectOverview.triage.actions.tomorrow')}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => applyDueDate(nextWeekKey, 'reschedule-week')}
                                            isLoading={savingAction === 'reschedule-week'}
                                            disabled={actionDisabled}
                                        >
                                            {t('projectOverview.triage.actions.nextWeek')}
                                        </Button>
                                    </div>
                                    <div className="project-triage-modal__date-action">
                                        <DatePicker
                                            label={t('projectOverview.triage.actions.customDate')}
                                            value={customDueDate}
                                            onChange={setCustomDueDate}
                                            placeholder={t('projectOverview.controls.duePlaceholder')}
                                            disabled={!canManageTasks || selectedCount === 0}
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => customDueDate && applyDueDate(format(customDueDate, 'yyyy-MM-dd'), 'reschedule-custom')}
                                            isLoading={savingAction === 'reschedule-custom'}
                                            disabled={actionDisabled || !customDueDate}
                                        >
                                            {t('projectOverview.triage.actions.applyDate')}
                                        </Button>
                                    </div>
                                </section>

                                <section className="project-triage-modal__decision-section">
                                    <div className="project-triage-modal__decision-heading">
                                        <span className="material-symbols-outlined" aria-hidden="true">person_add</span>
                                        <strong>{t('projectOverview.triage.actions.assignTitle')}</strong>
                                    </div>
                                    {teamMemberProfiles.length === 0
                                        ? <p className="project-triage-modal__decision-note">{t('projectOverview.triage.noTeam')}</p>
                                        : (
                                            <>
                                                <Select
                                                    value={selectedAssigneeId || null}
                                                    options={assigneeOptions}
                                                    placeholder={suggestedAssignee
                                                        ? t('projectOverview.triage.actions.assignPlaceholderWithSuggestion').replace('{name}', suggestedAssignee.displayName)
                                                        : t('projectOverview.triage.actions.assignPlaceholder')}
                                                    onChange={(value) => setSelectedAssigneeId(String(value))}
                                                    disabled={!canManageTasks || selectedCount === 0}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={applyAssignee}
                                                    isLoading={savingAction === 'assign'}
                                                    disabled={actionDisabled || !selectedAssigneeId}
                                                >
                                                    {t('projectOverview.triage.actions.assign')}
                                                </Button>
                                            </>
                                        )}
                                </section>

                                <section className="project-triage-modal__decision-section">
                                    <div className="project-triage-modal__decision-heading">
                                        <span className="material-symbols-outlined" aria-hidden="true">flag</span>
                                        <strong>{t('projectOverview.triage.actions.statusTitle')}</strong>
                                    </div>
                                    <div className="project-triage-modal__status-grid">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => applyStatusValue('In Progress', 'status-progress')}
                                            isLoading={savingAction === 'status-progress'}
                                            disabled={actionDisabled}
                                        >
                                            {t('projectOverview.triage.actions.markInProgress')}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => applyStatusValue('Blocked', 'status-blocked')}
                                            isLoading={savingAction === 'status-blocked'}
                                            disabled={actionDisabled}
                                        >
                                            {t('projectOverview.triage.actions.markBlocked')}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="primary"
                                            size="sm"
                                            onClick={markDone}
                                            isLoading={savingAction === 'done'}
                                            disabled={actionDisabled}
                                        >
                                            {t('projectOverview.triage.actions.markDone')}
                                        </Button>
                                    </div>
                                </section>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </Modal>
    );
};
