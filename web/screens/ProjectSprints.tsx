import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { differenceInCalendarDays, format } from 'date-fns';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import type { Member, Project, Sprint, Task, TaskStatus } from '../types';
import {
    addSprintMember,
    completeSprint,
    createSprint,
    deleteSprint,
    rejectJoinRequest,
    removeSprintMember,
    requestToJoinSprint,
    startSprint,
    subscribeProjectSprints,
    updateSprint
} from '../services/sprintService';
import { getUsersByIds, subscribeProjectTasks } from '../services/dataService';
import { getActiveTenantId } from '../services/domain/authService';
import { getProjectById } from '../services/domain/projectsService';
import { updateTaskFields } from '../services/domain/tasksService';
import { auth } from '../services/firebase';
import { SprintDetailsModal } from '../components/sprints/SprintDetailsModal';
import { Button } from '../components/common/Button/Button';
import { DatePicker } from '../components/common/DateTime/DatePicker';
import { ConfirmModal } from '../components/common/Modal/ConfirmModal';
import { InlineMenu, type InlineMenuOption } from '../components/work/InlineMenu';
import { useWorkMembers } from '../components/work/useWorkMembers';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/UIContext';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
import { parseDateValue } from '../utils/taskDates';

type View = 'current' | 'planning' | 'history';
type ColumnId = 'open' | 'progress' | 'review' | 'done';

const COLUMNS: { id: ColumnId; status: TaskStatus }[] = [
    { id: 'open', status: 'Open' },
    { id: 'progress', status: 'In Progress' },
    { id: 'review', status: 'Review' },
    { id: 'done', status: 'Done' }
];

const isDone = (task: Task) => task.isCompleted || task.status === 'Done';

const columnOf = (task: Task): ColumnId => {
    if (isDone(task)) return 'done';
    if (task.status === 'Review') return 'review';
    if (task.status === 'In Progress' || task.status === 'Blocked' || task.status === 'On Hold') return 'progress';
    return 'open';
};

/** Parse task/sprint dates; anything unparseable becomes null instead of an Invalid Date. */
const toDate = (value: unknown): Date | null => {
    if (value === null || value === undefined || value === '') return null;
    const date = parseDateValue(value as any);
    return date && !Number.isNaN(date.getTime()) ? date : null;
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';

/** Time and scope progress of a sprint, plus a simple on-track signal. */
const sprintStats = (sprint: Sprint, sprintTasks: Task[]) => {
    const start = toDate(sprint.startDate);
    const end = toDate(sprint.endDate);
    const total = sprintTasks.length;
    const done = sprintTasks.filter(isDone).length;
    const scope = total ? done / total : 0;
    let time = 0;
    let daysLeft: number | null = null;
    let totalDays: number | null = null;
    if (start && end) {
        totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
        const elapsed = Math.min(totalDays, Math.max(0, differenceInCalendarDays(new Date(), start) + 1));
        time = elapsed / totalDays;
        daysLeft = differenceInCalendarDays(end, new Date());
    }
    // Behind when the share of finished work trails the share of elapsed time by more than 15 points.
    const behind = total > 0 && time - scope > 0.15;
    return { total, done, scope, time, daysLeft, totalDays, behind };
};

export const ProjectSprints: React.FC = () => {
    const { id: projectId = '' } = useParams<{ id: string }>();
    const { setTaskTitle } = useOutletContext<{ setTaskTitle: (title: string | null) => void }>();
    const { t, dateLocale } = useLanguage();
    const { showError, showSuccess } = useToast();
    const navigate = useNavigate();
    const tenantId = getActiveTenantId() || undefined;
    const currentUser = auth.currentUser;

    const [project, setProject] = useState<Project | null>(null);
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projectMembers, setProjectMembers] = useState<Member[]>([]);
    const [view, setView] = useState<View>('current');
    const [formSprint, setFormSprint] = useState<Sprint | 'new' | null>(null);
    const [completing, setCompleting] = useState<Sprint | null>(null);
    const [deleting, setDeleting] = useState<Sprint | null>(null);
    const [membersSprintId, setMembersSprintId] = useState<string | null>(null);
    const [backlogSearch, setBacklogSearch] = useState('');
    const [dragOver, setDragOver] = useState<string | null>(null);

    const { can } = useProjectPermissions(project);
    const canManage = can('canManageTasks');
    const workMembers = useWorkMembers(tenantId);

    useEffect(() => {
        setTaskTitle(t('nav.sprints'));
        return () => setTaskTitle(null);
    }, [setTaskTitle, t]);

    useEffect(() => {
        if (!projectId) return;
        getProjectById(projectId, tenantId).then(async (loaded) => {
            setProject(loaded);
            const ids = loaded?.memberIds?.length
                ? loaded.memberIds
                : (loaded?.members as any[] | undefined)?.map((member) => (typeof member === 'string' ? member : member.uid || member.userId)) || [];
            if (ids.length) setProjectMembers(await getUsersByIds([...new Set(ids)] as string[], tenantId));
        }).catch((error) => console.error('Failed to load project', error));
        const unsubSprints = subscribeProjectSprints(projectId, setSprints, tenantId);
        const unsubTasks = subscribeProjectTasks(projectId, setTasks, tenantId);
        return () => { unsubSprints(); unsubTasks(); };
    }, [projectId, tenantId]);

    const activeSprint = sprints.find((sprint) => sprint.status === 'Active') || null;
    const plannedSprints = useMemo(
        () => sprints.filter((sprint) => sprint.status === 'Planning').sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))),
        [sprints]
    );
    const completedSprints = useMemo(
        () => sprints.filter((sprint) => sprint.status === 'Completed' || sprint.status === 'Archived').sort((a, b) => String(b.endDate).localeCompare(String(a.endDate))),
        [sprints]
    );
    const tasksBySprint = useMemo(() => {
        const map = new Map<string, Task[]>();
        tasks.forEach((task) => {
            if (!task.sprintId) return;
            map.set(task.sprintId, [...(map.get(task.sprintId) || []), task]);
        });
        return map;
    }, [tasks]);
    const backlog = useMemo(() => {
        const liveSprintIds = new Set(sprints.filter((sprint) => sprint.status === 'Active' || sprint.status === 'Planning').map((sprint) => sprint.id));
        const search = backlogSearch.trim().toLowerCase();
        return tasks.filter((task) => !isDone(task)
            && (!task.sprintId || !liveSprintIds.has(task.sprintId))
            && (!search || task.title.toLowerCase().includes(search)));
    }, [tasks, sprints, backlogSearch]);

    const shortDate = (value: unknown) => {
        const date = toDate(value);
        return date ? format(date, dateLocale?.code?.startsWith('de') ? 'd. MMM' : 'MMM d', { locale: dateLocale }) : '–';
    };
    const range = (sprint: Sprint) => `${shortDate(sprint.startDate)} – ${shortDate(sprint.endDate)}`;
    const memberName = (uid: string) => workMembers.find((member) => member.uid === uid)?.displayName || '';

    // --- Mutations ---------------------------------------------------------------
    const runInFlightRef = useRef(false);
    const run = async (action: () => Promise<unknown>, success?: string) => {
        if (runInFlightRef.current) return;
        runInFlightRef.current = true;
        try {
            await action();
            if (success) showSuccess(success);
        } catch (error: any) {
            console.error(error);
            showError(error?.message || t('sprintsV2.errors.generic'));
        } finally {
            runInFlightRef.current = false;
        }
    };

    const moveTask = (taskId: string, sprintId: string | null) =>
        run(() => updateTaskFields(taskId, { sprintId: sprintId || null } as any, projectId, tenantId));

    const setColumn = (task: Task, column: ColumnId) => {
        const target = COLUMNS.find((entry) => entry.id === column)!;
        if (columnOf(task) === column) return;
        void run(() => updateTaskFields(task.id, { status: target.status, isCompleted: column === 'done' } as any, projectId, tenantId));
    };

    const handleSaveSprint = async (data: { name: string; goal: string; startDate: string; endDate: string }) => {
        if (formSprint && formSprint !== 'new') {
            await run(() => updateSprint(projectId, formSprint.id, data, tenantId), t('sprintsV2.toast.saved'));
        } else {
            await run(() => createSprint(projectId, { ...data, status: 'Planning', createdBy: currentUser?.uid } as Partial<Sprint>, tenantId), t('sprintsV2.toast.created'));
        }
        setFormSprint(null);
    };

    const handleStart = (sprint: Sprint) => {
        if (activeSprint) {
            showError(t('sprintsV2.errors.alreadyActive').replace('{name}', activeSprint.name));
            return;
        }
        // Starting early moves the start to today; the planned end stays.
        const plannedStart = toDate(sprint.startDate);
        const startValue = !plannedStart || plannedStart > new Date() ? new Date().toISOString() : sprint.startDate;
        void run(() => startSprint(projectId, sprint.id, startValue, sprint.endDate, tenantId), t('sprintsV2.toast.started').replace('{name}', sprint.name));
        setView('current');
    };

    const handleComplete = async (destination: string | null) => {
        if (!completing) return;
        const unfinished = (tasksBySprint.get(completing.id) || []).filter((task) => !isDone(task));
        await run(async () => {
            // Unfinished work moves on (next sprint or backlog) instead of staying in a closed sprint.
            await Promise.all(unfinished.map((task) => updateTaskFields(task.id, { sprintId: destination } as any, projectId, tenantId)));
            await completeSprint(projectId, completing.id, tenantId);
        }, t('sprintsV2.toast.completed').replace('{name}', completing.name));
        setCompleting(null);
    };

    const handleDelete = async () => {
        if (!deleting) return;
        const sprintTasks = tasksBySprint.get(deleting.id) || [];
        await run(async () => {
            await Promise.all(sprintTasks.map((task) => updateTaskFields(task.id, { sprintId: null } as any, projectId, tenantId)));
            await deleteSprint(projectId, deleting.id, tenantId);
        }, t('sprintsV2.toast.deleted'));
        setDeleting(null);
    };

    const dropHandlers = (key: string, onDropTask: (taskId: string) => void) => ({
        onDragOver: (event: React.DragEvent) => {
            if (!canManage) return;
            event.preventDefault();
            if (dragOver !== key) setDragOver(key);
        },
        onDragLeave: (event: React.DragEvent) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(null);
        },
        onDrop: (event: React.DragEvent) => {
            event.preventDefault();
            setDragOver(null);
            const taskId = event.dataTransfer.getData('text/plain');
            if (taskId) onDropTask(taskId);
        }
    });

    const moveOptions = (task: Task): InlineMenuOption[] => [
        ...(task.sprintId ? [{ value: '__backlog__', label: t('sprintsV2.planning.toBacklog'), leading: <span className="material-symbols-outlined">inventory_2</span> }] : []),
        ...[activeSprint, ...plannedSprints]
            .filter((sprint): sprint is Sprint => Boolean(sprint) && sprint!.id !== task.sprintId)
            .map((sprint) => ({ value: sprint.id, label: sprint.name, leading: <span className="material-symbols-outlined">{sprint.status === 'Active' ? 'directions_run' : 'event_upcoming'}</span> }))
    ];

    // --- Pieces --------------------------------------------------------------------
    const renderTaskCard = (task: Task, compact = false) => {
        const due = toDate(task.dueDate);
        const overdue = due && !isDone(task) && differenceInCalendarDays(due, new Date()) < 0;
        const assignees = (task.assigneeIds?.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : []).slice(0, 2);
        const options = canManage ? moveOptions(task) : [];
        return (
            <article
                key={task.id}
                className={`sprint-card ${compact ? 'sprint-card--compact' : ''} ${isDone(task) ? 'is-done' : ''}`.trim()}
                draggable={canManage}
                onDragStart={(event) => { event.dataTransfer.setData('text/plain', task.id); event.dataTransfer.effectAllowed = 'move'; }}
            >
                <button type="button" className="sprint-card__title" onClick={() => navigate(`/project/${projectId}/tasks/${task.id}`)}>
                    {task.title}
                </button>
                <div className="sprint-card__meta">
                    {task.status === 'Blocked' && <span className="sprint-card__flag">{t('tasks.status.blocked')}</span>}
                    {task.priority && task.priority !== 'Medium' && (
                        <span className={`sprint-card__priority sprint-card__priority--${task.priority.toLowerCase()}`}>{t(`tasks.priority.${task.priority.toLowerCase()}`)}</span>
                    )}
                    {due && <span className={`sprint-card__due ${overdue ? 'is-overdue' : ''}`}>{shortDate(task.dueDate)}</span>}
                    <span className="sprint-card__spacer" />
                    {assignees.map((uid) => (
                        <span key={uid} className="sprint-card__avatar" title={memberName(uid)}>{initials(memberName(uid) || '?')}</span>
                    ))}
                    {options.length > 0 && (
                        <InlineMenu
                            label={t('sprintsV2.planning.moveTo')}
                            triggerClassName="sprint-card__move"
                            trigger={<span className="material-symbols-outlined">drive_file_move</span>}
                            options={options}
                            onSelect={(value) => void moveTask(task.id, value === '__backlog__' ? null : value)}
                            width={220}
                        />
                    )}
                </div>
            </article>
        );
    };

    const renderSprintMenu = (sprint: Sprint) => (
        <InlineMenu
            label={t('sprintsV2.actions.more')}
            triggerClassName="sprint-icon-btn"
            trigger={<span className="material-symbols-outlined">more_horiz</span>}
            options={[
                { value: 'edit', label: t('sprintsV2.actions.edit'), leading: <span className="material-symbols-outlined">edit</span> },
                { value: 'members', label: t('sprintsV2.actions.members'), leading: <span className="material-symbols-outlined">group</span> },
                { value: 'delete', label: t('sprintsV2.actions.delete'), leading: <span className="material-symbols-outlined">delete</span>, dividerBefore: true }
            ]}
            onSelect={(value) => {
                if (value === 'edit') setFormSprint(sprint);
                else if (value === 'members') setMembersSprintId(sprint.id);
                else setDeleting(sprint);
            }}
            width={200}
        />
    );

    // --- Views -----------------------------------------------------------------------
    const renderCurrent = () => {
        if (!activeSprint) {
            const next = plannedSprints[0];
            return (
                <div className="sprints-empty">
                    <span className="material-symbols-outlined" aria-hidden="true">directions_run</span>
                    <h2>{t('sprintsV2.current.emptyTitle')}</h2>
                    <p>{next ? t('sprintsV2.current.emptyNext').replace('{name}', next.name) : t('sprintsV2.current.emptyHint')}</p>
                    {canManage && (next
                        ? <Button variant="primary" onClick={() => handleStart(next)}>{t('sprintsV2.actions.startNamed').replace('{name}', next.name)}</Button>
                        : <Button variant="primary" onClick={() => setFormSprint('new')}>{t('sprintsV2.actions.plan')}</Button>)}
                </div>
            );
        }
        const sprintTasks = tasksBySprint.get(activeSprint.id) || [];
        const stats = sprintStats(activeSprint, sprintTasks);
        const assigneeIds = [...new Set(sprintTasks.flatMap((task) => task.assigneeIds || (task.assigneeId ? [task.assigneeId] : [])))];
        return (
            <>
                <section className="sprint-hero">
                    <div className="sprint-hero__main">
                        <div className="sprint-hero__title-row">
                            <h2 className="sprint-hero__title">{activeSprint.name}</h2>
                            <span className={`sprint-pace ${stats.behind ? 'is-behind' : 'is-ok'}`}>
                                <span className="sprint-pace__dot" aria-hidden="true" />
                                {stats.total === 0 ? t('sprintsV2.pace.empty') : stats.behind ? t('sprintsV2.pace.behind') : t('sprintsV2.pace.onTrack')}
                            </span>
                        </div>
                        {activeSprint.goal
                            ? <p className="sprint-hero__goal">{activeSprint.goal}</p>
                            : canManage && <button type="button" className="sprint-hero__goal sprint-hero__goal--empty" onClick={() => setFormSprint(activeSprint)}>{t('sprintsV2.current.addGoal')}</button>}
                        <div className="sprint-hero__meta">
                            <span><span className="material-symbols-outlined" aria-hidden="true">calendar_today</span>{range(activeSprint)}</span>
                            {stats.daysLeft !== null && (
                                <span className={stats.daysLeft < 0 ? 'is-overdue' : ''}>
                                    {stats.daysLeft < 0
                                        ? t('sprintsV2.current.overdueBy').replace('{days}', String(-stats.daysLeft))
                                        : t('sprintsV2.current.daysLeft').replace('{days}', String(stats.daysLeft))}
                                </span>
                            )}
                            {assigneeIds.length > 0 && (
                                <span className="sprint-hero__people">
                                    {assigneeIds.slice(0, 5).map((uid) => <span key={uid} className="sprint-card__avatar" title={memberName(uid)}>{initials(memberName(uid) || '?')}</span>)}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="sprint-hero__progress">
                        <div className="sprint-meter">
                            <div className="sprint-meter__label"><span>{t('sprintsV2.current.work')}</span><strong>{stats.done}/{stats.total}</strong></div>
                            <div className="sprint-meter__track"><span className="sprint-meter__fill" style={{ width: `${Math.round(stats.scope * 100)}%` }} /></div>
                        </div>
                        <div className="sprint-meter sprint-meter--time">
                            <div className="sprint-meter__label">
                                <span>{t('sprintsV2.current.time')}</span>
                                <strong>{stats.totalDays ? `${Math.round(stats.time * stats.totalDays)}/${stats.totalDays} ${t('sprintsV2.current.days')}` : '–'}</strong>
                            </div>
                            <div className="sprint-meter__track"><span className="sprint-meter__fill" style={{ width: `${Math.round(stats.time * 100)}%` }} /></div>
                        </div>
                    </div>
                    {canManage && (
                        <div className="sprint-hero__actions">
                            <Button variant="secondary" onClick={() => setCompleting(activeSprint)}>{t('sprintsV2.actions.complete')}</Button>
                            {renderSprintMenu(activeSprint)}
                        </div>
                    )}
                </section>

                {sprintTasks.length === 0 ? (
                    <div className="sprints-empty sprints-empty--inline">
                        <p>{t('sprintsV2.current.noTasks')}</p>
                        <Button variant="secondary" onClick={() => setView('planning')}>{t('sprintsV2.current.openPlanning')}</Button>
                    </div>
                ) : (
                    <div className="sprint-board">
                        {COLUMNS.map((column) => {
                            const columnTasks = sprintTasks.filter((task) => columnOf(task) === column.id);
                            return (
                                <section
                                    key={column.id}
                                    className={`sprint-board__column sprint-board__column--${column.id} ${dragOver === column.id ? 'is-drop-target' : ''}`.trim()}
                                    {...dropHandlers(column.id, (taskId) => {
                                        const task = sprintTasks.find((entry) => entry.id === taskId);
                                        if (task) setColumn(task, column.id);
                                    })}
                                >
                                    <header className="sprint-board__head">
                                        <span className="sprint-board__dot" aria-hidden="true" />
                                        {t(`sprintsV2.columns.${column.id}`)}
                                        <span className="sprint-board__count">{columnTasks.length}</span>
                                    </header>
                                    <div className="sprint-board__list">
                                        {columnTasks.map((task) => renderTaskCard(task))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </>
        );
    };

    const renderPlanning = () => {
        const lanes = [activeSprint, ...plannedSprints].filter(Boolean) as Sprint[];
        return (
            <div className="sprint-planning">
                <section className={`sprint-lane sprint-lane--backlog ${dragOver === '__backlog__' ? 'is-drop-target' : ''}`.trim()} {...dropHandlers('__backlog__', (taskId) => void moveTask(taskId, null))}>
                    <header className="sprint-lane__head">
                        <div>
                            <h3 className="sprint-lane__title">{t('sprintsV2.planning.backlog')}</h3>
                            <p className="sprint-lane__meta">{t('sprintsV2.planning.backlogHint')}</p>
                        </div>
                        <span className="sprint-board__count">{backlog.length}</span>
                    </header>
                    <label className="sprint-search">
                        <span className="material-symbols-outlined" aria-hidden="true">search</span>
                        <input value={backlogSearch} onChange={(event) => setBacklogSearch(event.target.value)} placeholder={t('sprintsV2.planning.search')} />
                    </label>
                    <div className="sprint-lane__list">
                        {backlog.length === 0
                            ? <p className="sprint-lane__empty">{t('sprintsV2.planning.backlogEmpty')}</p>
                            : backlog.map((task) => renderTaskCard(task, true))}
                    </div>
                </section>

                <div className="sprint-planning__sprints">
                    {lanes.length === 0 && (
                        <div className="sprints-empty sprints-empty--inline">
                            <p>{t('sprintsV2.planning.noSprints')}</p>
                            {canManage && <Button variant="primary" onClick={() => setFormSprint('new')}>{t('sprintsV2.actions.plan')}</Button>}
                        </div>
                    )}
                    {lanes.map((sprint) => {
                        const sprintTasks = (tasksBySprint.get(sprint.id) || []);
                        const open = sprintTasks.filter((task) => !isDone(task));
                        return (
                            <section
                                key={sprint.id}
                                className={`sprint-lane ${dragOver === sprint.id ? 'is-drop-target' : ''}`.trim()}
                                {...dropHandlers(sprint.id, (taskId) => void moveTask(taskId, sprint.id))}
                            >
                                <header className="sprint-lane__head">
                                    <div>
                                        <h3 className="sprint-lane__title">
                                            {sprint.name}
                                            {sprint.status === 'Active' && <span className="sprint-status">{t('sprintsV2.status.active')}</span>}
                                        </h3>
                                        <p className="sprint-lane__meta">
                                            {range(sprint)} · {t('sprintsV2.planning.taskCount').replace('{count}', String(sprintTasks.length))}
                                            {sprint.goal ? ` · ${sprint.goal}` : ''}
                                        </p>
                                    </div>
                                    {canManage && (
                                        <div className="sprint-lane__actions">
                                            {sprint.status === 'Planning' && (
                                                <Button size="sm" variant="secondary" onClick={() => handleStart(sprint)} disabled={Boolean(activeSprint)}>
                                                    {t('sprintsV2.actions.start')}
                                                </Button>
                                            )}
                                            {renderSprintMenu(sprint)}
                                        </div>
                                    )}
                                </header>
                                <div className="sprint-lane__list">
                                    {open.length === 0
                                        ? <p className="sprint-lane__empty">{t('sprintsV2.planning.dropHere')}</p>
                                        : open.map((task) => renderTaskCard(task, true))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderHistory = () => (
        completedSprints.length === 0 ? (
            <div className="sprints-empty sprints-empty--inline"><p>{t('sprintsV2.history.empty')}</p></div>
        ) : (
            <div className="sprint-history">
                {completedSprints.map((sprint) => {
                    const sprintTasks = tasksBySprint.get(sprint.id) || [];
                    const done = sprintTasks.filter(isDone).length;
                    const rate = sprintTasks.length ? Math.round((done / sprintTasks.length) * 100) : 0;
                    return (
                        <article key={sprint.id} className="sprint-history__row">
                            <div className="sprint-history__main">
                                <strong>{sprint.name}</strong>
                                <span>{range(sprint)}{sprint.goal ? ` · ${sprint.goal}` : ''}</span>
                            </div>
                            <div className="sprint-history__rate">
                                <div className="sprint-meter__track"><span className="sprint-meter__fill" style={{ width: `${rate}%` }} /></div>
                                <span>{t('sprintsV2.history.done').replace('{done}', String(done)).replace('{total}', String(sprintTasks.length))}</span>
                            </div>
                            {canManage && renderSprintMenu(sprint)}
                        </article>
                    );
                })}
            </div>
        )
    );

    const membersSprint = sprints.find((sprint) => sprint.id === membersSprintId) || null;
    const nextForCompletion = completing ? plannedSprints.find((sprint) => sprint.id !== completing.id) || null : null;
    const unfinishedCount = completing ? (tasksBySprint.get(completing.id) || []).filter((task) => !isDone(task)).length : 0;

    return (
        <div className="sprints-page">
            <header className="sprints-page__head">
                <div className="sprints-page__tabs" role="tablist" aria-label={t('nav.sprints')}>
                    {(['current', 'planning', 'history'] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            role="tab"
                            aria-selected={view === option}
                            className={`sprints-page__tab ${view === option ? 'is-active' : ''}`.trim()}
                            onClick={() => setView(option)}
                        >
                            {t(`sprintsV2.views.${option}`)}
                            {option === 'planning' && plannedSprints.length > 0 && <span className="sprints-page__tab-count">{plannedSprints.length}</span>}
                        </button>
                    ))}
                </div>
                {canManage && (
                    <Button variant="primary" onClick={() => setFormSprint('new')} icon={<span className="material-symbols-outlined">add</span>}>
                        {t('sprintsV2.actions.new')}
                    </Button>
                )}
            </header>

            {view === 'current' && renderCurrent()}
            {view === 'planning' && renderPlanning()}
            {view === 'history' && renderHistory()}

            {formSprint && (
                <SprintFormDialog
                    sprint={formSprint === 'new' ? null : formSprint}
                    suggestedStart={plannedSprints.length ? toDate(plannedSprints[plannedSprints.length - 1].endDate) : toDate(activeSprint?.endDate)}
                    nextNumber={Math.max(sprints.length, ...sprints.map((sprint) => Number(/(\d+)\s*$/.exec(sprint.name)?.[1] || 0))) + 1}
                    onCancel={() => setFormSprint(null)}
                    onSave={handleSaveSprint}
                />
            )}

            {completing && (
                <CompleteSprintDialog
                    sprint={completing}
                    unfinished={unfinishedCount}
                    nextSprint={nextForCompletion}
                    onCancel={() => setCompleting(null)}
                    onConfirm={handleComplete}
                />
            )}

            <ConfirmModal
                isOpen={Boolean(deleting)}
                onClose={() => setDeleting(null)}
                onConfirm={() => void handleDelete()}
                title={t('sprintsV2.delete.title')}
                message={t('sprintsV2.delete.message').replace('{name}', deleting?.name || '')}
                confirmLabel={t('sprintsV2.actions.delete')}
                variant="danger"
            />

            {membersSprint && (
                <SprintDetailsModal
                    isOpen
                    onClose={() => setMembersSprintId(null)}
                    sprint={membersSprint}
                    tasks={tasksBySprint.get(membersSprint.id) || []}
                    currentUserId={currentUser?.uid || ''}
                    projectMembers={projectMembers}
                    onEdit={(sprint) => { setMembersSprintId(null); setFormSprint(sprint); }}
                    onDelete={() => { setMembersSprintId(null); setDeleting(membersSprint); }}
                    onAddMember={(uid) => void run(() => addSprintMember(projectId, membersSprint.id, uid, tenantId))}
                    onRemoveMember={(uid) => void run(() => removeSprintMember(projectId, membersSprint.id, uid, tenantId))}
                    onJoinRequest={() => currentUser && void run(() => requestToJoinSprint(projectId, membersSprint.id, currentUser.uid, tenantId))}
                    onApproveRequest={(uid) => void run(() => addSprintMember(projectId, membersSprint.id, uid, tenantId))}
                    onRejectRequest={(uid) => void run(() => rejectJoinRequest(projectId, membersSprint.id, uid, tenantId))}
                    canManageTeam={canManage}
                />
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const DialogShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return createPortal(
        <div className="sprint-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="sprint-dialog__panel">
                <h2 className="sprint-dialog__title">{title}</h2>
                {children}
            </div>
        </div>,
        document.body
    );
};

const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };

const SprintFormDialog: React.FC<{
    sprint: Sprint | null;
    suggestedStart: Date | null;
    /** Continues the team's numbering, e.g. "Sprint 13" after "Sprint 12". */
    nextNumber: number;
    onCancel: () => void;
    onSave: (data: { name: string; goal: string; startDate: string; endDate: string }) => Promise<void>;
}> = ({ sprint, suggestedStart, nextNumber, onCancel, onSave }) => {
    const { t } = useLanguage();
    const defaultStart = sprint ? toDate(sprint.startDate) : (suggestedStart && suggestedStart > new Date() ? addDays(suggestedStart, 1) : new Date());
    const [name, setName] = useState(sprint?.name || t('sprintsV2.form.defaultName').replace('{n}', String(nextNumber)));
    const [goal, setGoal] = useState(sprint?.goal || '');
    const [start, setStart] = useState<Date | null>(defaultStart);
    const [end, setEnd] = useState<Date | null>(sprint ? toDate(sprint.endDate) : addDays(defaultStart || new Date(), 13));
    const [saving, setSaving] = useState(false);
    const invalid = !name.trim() || !start || !end || end < start;

    const presetWeeks = (weeks: number) => start && setEnd(addDays(start, weeks * 7 - 1));

    return (
        <DialogShell title={sprint ? t('sprintsV2.form.editTitle') : t('sprintsV2.form.newTitle')} onClose={onCancel}>
            <label className="sprint-dialog__field">
                <span>{t('sprintsV2.form.name')}</span>
                <input className="sprint-dialog__input" value={name} onChange={(event) => setName(event.target.value)} autoFocus maxLength={80} />
            </label>
            <label className="sprint-dialog__field">
                <span>{t('sprintsV2.form.goal')}</span>
                <input className="sprint-dialog__input" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder={t('sprintsV2.form.goalPlaceholder')} maxLength={200} />
            </label>
            <div className="sprint-dialog__dates">
                <DatePicker label={t('sprintsV2.form.start')} value={start} onChange={setStart} />
                <DatePicker label={t('sprintsV2.form.end')} value={end} onChange={setEnd} minDate={start || undefined} />
            </div>
            <div className="sprint-dialog__presets">
                {[1, 2, 3].map((weeks) => (
                    <button key={weeks} type="button" className="sprint-dialog__preset" onClick={() => presetWeeks(weeks)}>
                        {t('sprintsV2.form.weeks').replace('{n}', String(weeks))}
                    </button>
                ))}
            </div>
            <footer className="sprint-dialog__foot">
                <button type="button" className="sprint-dialog__cancel" onClick={onCancel}>{t('common.cancel')}</button>
                <Button
                    variant="primary"
                    isLoading={saving}
                    disabled={invalid}
                    onClick={async () => {
                        if (invalid) return;
                        setSaving(true);
                        await onSave({ name: name.trim(), goal: goal.trim(), startDate: start!.toISOString(), endDate: end!.toISOString() });
                        setSaving(false);
                    }}
                >
                    {sprint ? t('sprintsV2.form.save') : t('sprintsV2.form.create')}
                </Button>
            </footer>
        </DialogShell>
    );
};

const CompleteSprintDialog: React.FC<{
    sprint: Sprint;
    unfinished: number;
    nextSprint: Sprint | null;
    onCancel: () => void;
    onConfirm: (destination: string | null) => Promise<void>;
}> = ({ sprint, unfinished, nextSprint, onCancel, onConfirm }) => {
    const { t } = useLanguage();
    const [destination, setDestination] = useState<string | null>(nextSprint?.id || null);
    const [busy, setBusy] = useState(false);
    return (
        <DialogShell title={t('sprintsV2.complete.title').replace('{name}', sprint.name)} onClose={onCancel}>
            <p className="sprint-dialog__text">
                {unfinished === 0 ? t('sprintsV2.complete.allDone') : t('sprintsV2.complete.unfinished').replace('{count}', String(unfinished))}
            </p>
            {unfinished > 0 && (
                <div className="sprint-dialog__choices" role="radiogroup">
                    {nextSprint && (
                        <button type="button" role="radio" aria-checked={destination === nextSprint.id} className={`sprint-dialog__choice ${destination === nextSprint.id ? 'is-active' : ''}`} onClick={() => setDestination(nextSprint.id)}>
                            <span className="material-symbols-outlined" aria-hidden="true">event_upcoming</span>
                            {t('sprintsV2.complete.toNext').replace('{name}', nextSprint.name)}
                        </button>
                    )}
                    <button type="button" role="radio" aria-checked={destination === null} className={`sprint-dialog__choice ${destination === null ? 'is-active' : ''}`} onClick={() => setDestination(null)}>
                        <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
                        {t('sprintsV2.complete.toBacklog')}
                    </button>
                </div>
            )}
            <footer className="sprint-dialog__foot">
                <button type="button" className="sprint-dialog__cancel" onClick={onCancel}>{t('common.cancel')}</button>
                <Button variant="primary" isLoading={busy} onClick={async () => { setBusy(true); await onConfirm(destination); setBusy(false); }}>
                    {t('sprintsV2.actions.complete')}
                </Button>
            </footer>
        </DialogShell>
    );
};
