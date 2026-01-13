
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isSameDay, addDays, isToday, startOfWeek, endOfWeek, eachDayOfInterval, isValid, startOfMonth, endOfMonth, isSameMonth, isAfter } from 'date-fns';
import { Button } from '../components/common/Button/Button';
import { Modal } from '../components/common/Modal/Modal';
import { useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';
import { getUserTasks, getUserIssues, updateIssue, updateTask, getUnassignedTasks, getUsersTasks } from '../services/dataService';
import { Task, Issue } from '../types';
import { distributeTasks, ProposedSchedule } from '../utils/scheduler';
import { auth } from '../services/firebase';

export const Calendar = () => {
    const { t, dateLocale } = useLanguage();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [unassignedTasks, setUnassignedTasks] = useState<Task[]>([]);
    const [tempTeamTasks, setTempTeamTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [distributing, setDistributing] = useState(false);

    // View state
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [proposedSchedule, setProposedSchedule] = useState<ProposedSchedule[]>([]);
    const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());

    // Unscheduled Sidebar Toggle
    const [isUnscheduledOpen, setIsUnscheduledOpen] = useState(true);

    const { showError, showSuccess, showToast } = useToast();
    const priorityLabels = useMemo(() => ({
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low')
    }), [t]);
    const scheduleReasonLabels = useMemo(() => ({
        Overdue: t('calendar.modal.reasons.overdue'),
        'Global Optimization': t('calendar.modal.reasons.optimization')
    }), [t]);
    const getErrorMessage = (error: any) => error?.message || t('calendar.errors.unknown');
    const getScheduleReason = (reason?: string) => {
        if (!reason) return '';
        return scheduleReasonLabels[reason as keyof typeof scheduleReasonLabels] || reason;
    };
    const getPriorityTone = (priority?: string) => {
        switch (priority) {
            case 'Urgent':
                return 'urgent';
            case 'High':
                return 'high';
            case 'Medium':
                return 'medium';
            default:
                return 'low';
        }
    };

    // Drag and Drop State & Handlers
    const [dragActiveDate, setDragActiveDate] = useState<string | null>(null);
    const [dragOverInbox, setDragOverInbox] = useState(false);

    const handleDragStart = (e: React.DragEvent, item: Task | Issue, type: 'task' | 'issue') => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            id: item.id,
            type,
            projectId: item.projectId,
            tenantId: item.tenantId,
            path: (item as any).path
        }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, dateStr?: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverInbox(false); // Clear inbox highlight when over calendar
        if (dateStr && dragActiveDate !== dateStr) {
            setDragActiveDate(dateStr);
        }
    };

    const handleDragOverInbox = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragActiveDate(null); // Clear date highlight
        setDragOverInbox(true);
    };

    const handleDragLeaveInbox = (e: React.DragEvent) => {
        // Only clear if actually leaving the inbox container
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setDragOverInbox(false);
        }
    };

    const handleDropOnDay = async (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        setDragActiveDate(null);

        try {
            const data = e.dataTransfer.getData('application/json');
            if (!data) return;

            const parsed = JSON.parse(data);
            const { id, type, projectId, tenantId, path } = parsed;
            const newDateStr = date.toISOString();
            const currUser = auth.currentUser;

            const updates: any = { scheduledDate: newDateStr };

            // If it's a task and moves from inbox (unassigned) to calendar, assign it to current user
            if (type === 'task' && currUser) {
                const isUnassigned = unassignedTasks.some(t => t.id === id);
                if (isUnassigned) {
                    updates.assignee = currUser.displayName || currUser.email;
                    updates.assigneeIds = [currUser.uid];
                }
            }

            if (type === 'task') {
                await updateTask(id, updates, projectId, tenantId, path);
            } else {
                await updateIssue(id, updates, projectId, tenantId, path);
            }

            // Optimistic update or refresh
            refreshData();

        } catch (error: any) {
            console.error("Drop failed", error);
            showError(t('calendar.errors.moveItem').replace('{error}', getErrorMessage(error)));
        }
    };

    const handleDropOnUnscheduled = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverInbox(false);
        setDragActiveDate(null);
        try {
            const data = e.dataTransfer.getData('application/json');
            if (!data) return;

            const parsed = JSON.parse(data);
            const { id, type, projectId, tenantId, path } = parsed;

            console.log("Dropping item to inbox", { id, type, projectId, tenantId, path });

            if (!id || !projectId) {
                if (!path) throw new Error("Missing item ID or Project ID and path");
            }

            if (type === 'task') {
                await updateTask(id, { scheduledDate: null }, projectId, tenantId, path);
            } else {
                await updateIssue(id, { scheduledDate: null }, projectId, tenantId, path);
            }

            refreshData();
        } catch (error: any) {
            console.error("Drop to unscheduled failed", error);
            showError(t('calendar.errors.unscheduleItem').replace('{error}', getErrorMessage(error)));
        }
    };

    // Clear all unassigned tasks from calendar (move them to inbox)
    const clearUnassignedFromCalendar = async () => {
        try {
            // Find scheduled tasks that have no assignee
            const unassignedScheduled = tasks.filter(t =>
                t.scheduledDate &&
                !t.assigneeId &&
                (!t.assigneeIds || t.assigneeIds.length === 0) &&
                !t.isCompleted
            );

            if (unassignedScheduled.length === 0) {
                showToast(t('calendar.info.noUnassignedToClear'));
                return;
            }

            await Promise.all(unassignedScheduled.map(task =>
                updateTask(task.id, { scheduledDate: null }, task.projectId, (task as any).tenantId, (task as any).path)
            ));

            showSuccess(t('calendar.success.unassignedCleared').replace('{count}', String(unassignedScheduled.length)));
            refreshData();
        } catch (error: any) {
            console.error("Failed to clear unassigned tasks", error);
            showError(t('calendar.errors.clearUnassigned').replace('{error}', getErrorMessage(error)));
        }
    };

    // Unschedule all future items (strictly after now)
    const unscheduleFutureItems = async () => {
        try {
            const now = new Date();
            const futureTasks = tasks.filter(t => t.scheduledDate && isAfter(new Date(t.scheduledDate), now) && !t.isCompleted);
            const futureIssues = issues.filter(i => i.scheduledDate && isAfter(new Date(i.scheduledDate), now) && i.status !== 'Resolved' && i.status !== 'Closed');

            const allFuture = [...futureTasks, ...futureIssues];

            if (allFuture.length === 0) {
                showToast(t('calendar.info.noFutureItems'));
                return;
            }

            await Promise.all(allFuture.map(item => {
                const isTask = !('reporter' in item);
                const tenantId = (item as any).tenantId;
                const path = (item as any).path;
                if (isTask) {
                    return updateTask(item.id, { scheduledDate: null }, item.projectId, tenantId, path);
                } else {
                    return updateIssue(item.id, { scheduledDate: null }, item.projectId, tenantId, path);
                }
            }));

            showSuccess(t('calendar.success.futureUnscheduled').replace('{count}', String(allFuture.length)));
            refreshData();
        } catch (error: any) {
            console.error("Failed to unschedule future items", error);
            showError(t('calendar.errors.unscheduleFuture').replace('{error}', getErrorMessage(error)));
        }
    };

    const handleItemClick = (e: React.MouseEvent, item: Task | Issue, type: 'task' | 'issue') => {
        e.stopPropagation();
        const tenantId = (item as any).tenantId;
        if (type === 'task') {
            navigate(`/project/${item.projectId}/tasks/${item.id}${tenantId ? `?tenant=${tenantId}` : ''}`);
        } else {
            navigate(`/project/${item.projectId}/issues/${item.id}${tenantId ? `?tenant=${tenantId}` : ''}`);
        }
    };

    const handleUnschedule = async (e: React.MouseEvent, item: Task | Issue, type: 'task' | 'issue') => {
        e.stopPropagation();
        e.preventDefault();
        try {
            const tenantId = (item as any).tenantId;
            const path = (item as any).path;
            if (type === 'task') {
                await updateTask(item.id, { scheduledDate: null }, item.projectId, tenantId, path);
            } else {
                await updateIssue(item.id, { scheduledDate: null }, item.projectId, tenantId, path);
            }
            refreshData();
        } catch (error: any) {
            console.error("Failed to unschedule", error);
            showError(t('calendar.errors.unscheduleItem').replace('{error}', getErrorMessage(error)));
        }
    };

    // Hover Tooltip State
    const [hoveredTask, setHoveredTask] = useState<{ item: Task | Issue, x: number, y: number } | null>(null);

    // Fetch data
    const refreshData = async () => {
        setLoading(true);
        try {
            const [fetchedTasks, fetchedIssues, fetchedUnassigned] = await Promise.all([
                getUserTasks(),
                getUserIssues(),
                getUnassignedTasks()
            ]);
            console.log("Calendar: Fetched tasks", fetchedTasks.length);
            setTasks(fetchedTasks);
            setIssues(fetchedIssues);
            setUnassignedTasks(fetchedUnassigned);

            if (fetchedTasks.length === 0) {
                console.log("Debug: No tasks found. verifying current tenant...");
            }
        } catch (error: any) {
            console.error('Failed to fetch calendar data', error);
            showError(t('calendar.errors.loadingData').replace('{error}', getErrorMessage(error)));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    // Prep Auto-Schedule
    const prepareAutoSchedule = async () => {
        setDistributing(true);
        try {
            // Find all unique co-assignees from current tasks and issues
            const coAssignees = new Set<string>();
            tasks.forEach(t => {
                if (t.assigneeId) coAssignees.add(t.assigneeId);
                if (t.assigneeIds) t.assigneeIds.forEach(id => coAssignees.add(id));
            });
            issues.forEach(i => {
                if (i.assigneeId) coAssignees.add(i.assigneeId);
                if (i.assigneeIds) i.assigneeIds.forEach(id => coAssignees.add(id));
            });

            // Remove current user
            const currUser = auth.currentUser;
            if (currUser) coAssignees.delete(currUser.uid);

            // Fetch team tasks to perform global optimization
            const teamTasks = coAssignees.size > 0
                ? await getUsersTasks(Array.from(coAssignees))
                : [];

            setTempTeamTasks(teamTasks);

            // Reschedule only assigned items by default, but include unassigned ones in the pool as candidates
            const unassignedToInclude = unassignedTasks.filter(t => !t.scheduledDate && !t.isCompleted);
            const schedulingPoolTasks = [...tasks, ...unassignedToInclude];

            const proposed = distributeTasks(schedulingPoolTasks, issues, undefined, teamTasks);

            // Only show if there are changes
            const changes = proposed.filter(p => {
                const original = p.originalDate ? new Date(p.originalDate) : null;
                return !original || !isSameDay(original, p.newDate);
            });

            if (changes.length === 0) {
                showSuccess(t('calendar.info.scheduleOptimized'));
                return;
            }

            setProposedSchedule(changes);
            setSelectedChanges(new Set(changes.map(c => c.taskId)));
            setShowScheduleModal(true);
        } catch (error: any) {
            console.error("Failed to prepare schedule", error);
            showError(t('calendar.errors.prepareSchedule').replace('{error}', getErrorMessage(error)));
        } finally {
            setDistributing(false);
        }
    };

    // Apply Auto-Schedule
    const applyAutoSchedule = async () => {
        setDistributing(true);
        try {
            const updates = proposedSchedule
                .filter(p => selectedChanges.has(p.taskId))
                .map(async (p) => {
                    const dateStr = p.newDate.toISOString();
                    const currUser = auth.currentUser;

                    if (p.type === 'task') {
                        // Search personal, team, AND unassigned tasks
                        const task = tasks.find(t => t.id === p.taskId) ||
                            tempTeamTasks.find(t => t.id === p.taskId) ||
                            unassignedTasks.find(t => t.id === p.taskId);

                        if (task) {
                            const updates: any = { scheduledDate: dateStr };

                            // If it was unassigned, assign it to current user
                            const isUnassigned = unassignedTasks.some(t => t.id === task.id);
                            if (isUnassigned && currUser) {
                                updates.assignee = currUser.displayName || currUser.email;
                                updates.assigneeIds = [currUser.uid];
                            }

                            await updateTask(task.id, updates, task.projectId, task.tenantId);
                        }
                    } else if (p.type === 'issue') {
                        const issue = issues.find(i => i.id === p.taskId);
                        if (issue) {
                            await updateIssue(issue.id, { scheduledDate: dateStr }, issue.projectId, issue.tenantId);
                        }
                    }
                });

            await Promise.all(updates);
            await refreshData();
            setShowScheduleModal(false);
            setTempTeamTasks([]);
            showSuccess(t('calendar.success.optimized'));
        } catch (error: any) {
            console.error('Distribution failed', error);
            showError(t('calendar.errors.optimizeSchedule').replace('{error}', getErrorMessage(error)));
            // Keep modal open so they don't lose context? Or close it?
            // Usually close or let them try again. Let's keep modal open if we failed?
            // Actually simplest is close logic modal, show error alert.
            setShowScheduleModal(false);
        } finally {
            setDistributing(false);
        }
    };

    // Render helpers
    const getDaysGrid = () => {
        if (viewMode === 'week') {
            return eachDayOfInterval({
                start: startOfWeek(viewDate, { weekStartsOn: 1 }),
                end: endOfWeek(viewDate, { weekStartsOn: 1 })
            });
        } else {
            // Month View
            const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
            const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end });
        }
    };

    const days = getDaysGrid();

    // Helper to determine effective date for display
    const getItemDate = (item: Task | Issue): Date | null => {
        if (item.scheduledDate) return new Date(item.scheduledDate);
        // Fallback for Tasks only usually, but if Issues purely rely on scheduledDate they won't show
        if ((item as Task).dueDate) return new Date((item as Task).dueDate!);
        return null;
    };

    const getItemsForDate = (date: Date) => {
        const dateTasks = tasks.filter(t => {
            const d = getItemDate(t);
            if (!d || !isValid(d)) return false;
            // Only show tasks with Open or In Progress status, and not completed
            const status = t.status || 'Open';
            if (status !== 'Open' && status !== 'In Progress') return false;
            return isSameDay(d, date) && !t.isCompleted;
        });

        const dateIssues = issues.filter(i => {
            const d = getItemDate(i);
            if (!d || !isValid(d)) return false;
            // Only show issues with Open or In Progress status
            return isSameDay(d, date) && (i.status === 'Open' || i.status === 'In Progress');
        });

        return [...dateTasks, ...dateIssues];
    };

    const unscheduledItems = useMemo(() => {
        // Personal unscheduled tasks/issues
        const personalTasks = tasks.filter(t => !getItemDate(t) && !t.isCompleted);
        const personalIssues = issues.filter(issue => !getItemDate(issue) && issue.status !== 'Resolved' && issue.status !== 'Closed');

        // Unassigned tasks from projects (avoid duplicates with personal tasks)
        const personalTaskIds = new Set(personalTasks.map(t => t.id));
        const unassignedUnscheduled = unassignedTasks.filter(t => !getItemDate(t) && !t.isCompleted && !personalTaskIds.has(t.id));

        return [...personalTasks, ...personalIssues, ...unassignedUnscheduled];
    }, [tasks, issues, unassignedTasks]);

    return (
        <div className="calendar-page">
            <div className={`calendar-loading ${loading ? 'is-visible' : ''}`}>
                <div className="calendar-loading__content">
                    <div className="calendar-loading__icon-wrap">
                        <span className="calendar-loading__glow" />
                        <span className="material-symbols-outlined calendar-loading__icon">progress_activity</span>
                    </div>
                    <p className="calendar-loading__text">{t('calendar.loading')}</p>
                </div>
            </div>

            <div className="calendar-page__layout">

                <section className="calendar-main">
                    <header className="calendar-header">
                        <div className="calendar-header__nav">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="calendar-header__nav-btn"
                                onClick={() => setViewDate(d => viewMode === 'week' ? addDays(d, -7) : addDays(startOfMonth(d), -1))}
                            >
                                <span className="material-symbols-outlined">chevron_left</span>
                            </Button>
                            <h2 className="calendar-header__title">
                                {viewMode === 'week'
                                    ? `${format(days[0], 'MMM d', { locale: dateLocale })} - ${format(days[days.length - 1], 'MMM d, yyyy', { locale: dateLocale })}`
                                    : format(viewDate, 'MMMM yyyy', { locale: dateLocale })
                                }
                            </h2>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="calendar-header__nav-btn"
                                onClick={() => setViewDate(d => viewMode === 'week' ? addDays(d, 7) : addDays(endOfMonth(d), 1))}
                            >
                                <span className="material-symbols-outlined">chevron_right</span>
                            </Button>
                        </div>

                        <div className="calendar-header__controls">
                            <div className="calendar-view-toggle">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewMode('week')}
                                    className={`calendar-view-toggle__button ${viewMode === 'week' ? 'is-active' : ''}`}
                                >
                                    {t('calendar.view.week')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewMode('month')}
                                    className={`calendar-view-toggle__button ${viewMode === 'month' ? 'is-active' : ''}`}
                                >
                                    {t('calendar.view.month')}
                                </Button>
                            </div>

                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={prepareAutoSchedule}
                                disabled={distributing}
                                className="calendar-header__schedule-btn"
                                icon={<span className="material-symbols-outlined">{distributing ? 'hourglass_top' : 'auto_fix_high'}</span>}
                            >
                                <span className="calendar-header__schedule-label">
                                    {distributing ? t('calendar.actions.optimizing') : t('calendar.actions.smartSchedule')}
                                </span>
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsUnscheduledOpen(!isUnscheduledOpen)}
                                className={`calendar-header__inbox-btn ${isUnscheduledOpen ? 'is-active' : ''}`}
                            >
                                <span className="material-symbols-outlined">inbox</span>
                                {unscheduledItems.length > 0 && (
                                    <span className="calendar-header__badge">{unscheduledItems.length}</span>
                                )}
                            </Button>
                        </div>
                    </header>

                    <div className={`calendar-grid calendar-grid--${viewMode}`}>
                        {days.map(day => {
                            const dayKey = day.toISOString();
                            const isSelected = isSameDay(day, selectedDate);
                            const isCurrent = isToday(day);
                            const isCurrentMonth = isSameMonth(day, viewDate);

                            const items = getItemsForDate(day);
                            const displayDate = format(day, 'd', { locale: dateLocale });
                            const displayDay = viewMode === 'week' ? format(day, 'EEE', { locale: dateLocale }) : '';

                            const dayClasses = [
                                'calendar-day',
                                isCurrent ? 'calendar-day--today' : '',
                                isSelected ? 'calendar-day--selected' : '',
                                dragActiveDate === dayKey ? 'calendar-day--drag' : '',
                                !isCurrentMonth && viewMode === 'month' ? 'calendar-day--muted' : ''
                            ]
                                .filter(Boolean)
                                .join(' ');

                            return (
                                <div
                                    key={dayKey}
                                    onClick={() => setSelectedDate(day)}
                                    onDragOver={(e) => handleDragOver(e, dayKey)}
                                    onDrop={(e) => handleDropOnDay(e, day)}
                                    className={dayClasses}
                                >
                                    <div className="calendar-day__header">
                                        <span className="calendar-day__weekday">{displayDay}</span>
                                        <span className="calendar-day__date">{displayDate}</span>
                                    </div>

                                    <div className="calendar-day__list">
                                        {items.map(item => {
                                            const itemType = 'reporter' in item ? 'issue' : 'task';
                                            const priorityTone = getPriorityTone((item as Task).priority);
                                            return (
                                                <div
                                                    key={item.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, item, itemType)}
                                                    onClick={(e) => handleItemClick(e, item, itemType)}
                                                    className={`calendar-item calendar-item--${itemType}`}
                                                    onMouseEnter={(e) => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setHoveredTask({
                                                            item,
                                                            x: rect.right + 8,
                                                            y: rect.top
                                                        });
                                                    }}
                                                    onMouseLeave={() => setHoveredTask(null)}
                                                >
                                                    <div className="calendar-item__title">{item.title}</div>
                                                    <div className="calendar-item__meta">
                                                        <span className={`calendar-priority-dot calendar-priority-dot--${priorityTone}`} />
                                                        {(item as Task).dueDate && (
                                                            <span className="calendar-item__time">
                                                                {format(new Date((item as Task).dueDate!), 'HH:mm', { locale: dateLocale })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleUnschedule(e, item, itemType)}
                                                        className="calendar-item__action"
                                                        title={t('calendar.actions.unschedule')}
                                                    >
                                                        <span className="material-symbols-outlined">event_busy</span>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {isUnscheduledOpen && (
                    <aside
                        className={`calendar-sidebar ${dragOverInbox ? 'calendar-sidebar--drag' : ''}`}
                        onDragOver={handleDragOverInbox}
                        onDragLeave={handleDragLeaveInbox}
                        onDrop={handleDropOnUnscheduled}
                    >
                        {dragOverInbox && (
                            <div className="calendar-sidebar__drop">
                                <div className="calendar-sidebar__drop-content">
                                    <span className="material-symbols-outlined">inbox</span>
                                    <span>{t('calendar.unassigned.dropHint')}</span>
                                </div>
                            </div>
                        )}
                        <div className="calendar-sidebar__header">
                            <div className="calendar-sidebar__title">
                                <span className="material-symbols-outlined">inbox</span>
                                <span>{t('calendar.unassigned.title')}</span>
                                <span className="calendar-sidebar__count">{unscheduledItems.length}</span>
                            </div>
                            <div className="calendar-sidebar__actions">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={unscheduleFutureItems}
                                    className="calendar-sidebar__action"
                                    title={t('calendar.actions.unscheduleFuture')}
                                >
                                    <span className="material-symbols-outlined">event_busy</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={clearUnassignedFromCalendar}
                                    className="calendar-sidebar__action"
                                    title={t('calendar.actions.clearUnassigned')}
                                >
                                    <span className="material-symbols-outlined">playlist_remove</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsUnscheduledOpen(false)}
                                    className="calendar-sidebar__action"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </Button>
                            </div>
                        </div>

                        <div className="calendar-sidebar__body">
                            {unscheduledItems.length === 0 ? (
                                <div className="calendar-sidebar__empty">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    <p>{t('calendar.unassigned.empty')}</p>
                                </div>
                            ) : (
                                <div className="calendar-sidebar__list">
                                    {unscheduledItems.map(item => {
                                        const itemType = 'reporter' in item ? 'issue' : 'task';
                                        const priorityTone = getPriorityTone((item as Task).priority);
                                        return (
                                            <div
                                                key={item.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, item, itemType)}
                                                onClick={(e) => handleItemClick(e, item, itemType)}
                                                className="calendar-unscheduled-card"
                                            >
                                                <div className="calendar-unscheduled-card__title">{item.title}</div>
                                                <div className="calendar-unscheduled-card__meta">
                                                    <div className="calendar-unscheduled-card__type">
                                                        <span className={`calendar-priority-dot calendar-priority-dot--${priorityTone}`} />
                                                        <span>{itemType === 'issue' ? t('calendar.item.issue') : t('calendar.item.task')}</span>
                                                    </div>
                                                    <button type="button" className="calendar-unscheduled-card__hint">
                                                        {t('calendar.unassigned.dragToSchedule')}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="calendar-sidebar__footer">
                            <p>
                                {t('calendar.unassigned.helper').replace('{action}', t('calendar.actions.smartSchedule'))}
                            </p>
                        </div>
                    </aside>
                )}

            <Modal
                isOpen={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                size="xl"
                title={t('calendar.modal.title')}
                footer={(
                    <>
                        <Button variant="ghost" onClick={() => setShowScheduleModal(false)}>
                            {t('calendar.actions.cancel')}
                        </Button>
                        <Button
                            onClick={applyAutoSchedule}
                            disabled={proposedSchedule.length === 0 || selectedChanges.size === 0}
                            className="calendar-schedule__apply"
                        >
                            {selectedChanges.size > 0 && (
                                <span className="calendar-schedule__apply-count">{selectedChanges.size}</span>
                            )}
                            {t('calendar.actions.startSchedule')}
                        </Button>
                    </>
                )}
            >
                <div className="calendar-schedule">
                    <div className="calendar-schedule__toolbar">
                        <p className="calendar-schedule__subtitle">
                            {t('calendar.modal.subtitle').replace('{count}', String(selectedChanges.size))}
                        </p>
                        <div className="calendar-schedule__toolbar-actions">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedChanges(new Set(proposedSchedule.map(p => p.taskId)))}
                            >
                                {t('calendar.modal.selectAll')}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedChanges(new Set())}
                            >
                                {t('calendar.modal.deselectAll')}
                            </Button>
                        </div>
                    </div>

                    <div className="calendar-schedule__table">
                        <div className="calendar-schedule__header-row">
                            <div className="calendar-schedule__header-check">
                                <span className="material-symbols-outlined">check_box</span>
                            </div>
                            <div>{t('calendar.modal.headers.taskDetails')}</div>
                            <div>{t('calendar.modal.headers.assignee')}</div>
                            <div>{t('calendar.modal.headers.scheduleChange')}</div>
                            <div className="calendar-schedule__header-action">{t('calendar.modal.headers.action')}</div>
                        </div>

                        {proposedSchedule.length === 0 ? (
                            <div className="calendar-schedule__empty">
                                <span className="material-symbols-outlined">check_circle</span>
                                <p className="calendar-schedule__empty-title">{t('calendar.modal.empty.title')}</p>
                                <p className="calendar-schedule__empty-subtitle">{t('calendar.modal.empty.subtitle')}</p>
                            </div>
                        ) : (
                            <div className="calendar-schedule__rows">
                                {proposedSchedule.map((change, idx) => {
                                    const isIssue = change.type === 'issue';
                                    const isUnassigned = unassignedTasks.some(t => t.id === change.taskId);
                                    const item = isIssue
                                        ? issues.find(i => i.id === change.taskId)
                                        : tasks.find(t => t.id === change.taskId) ||
                                        tempTeamTasks.find(t => t.id === change.taskId) ||
                                        unassignedTasks.find(t => t.id === change.taskId);

                                    const itemTitle = item?.title;
                                    const assignee = isUnassigned ? t('calendar.assignee.unassigned') : ((item as any)?.assignee || t('calendar.assignee.me'));
                                    const isSelected = selectedChanges.has(change.taskId);

                                    const priority = (item as any)?.priority || 'Medium';
                                    const priorityTone = getPriorityTone(priority);

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                const next = new Set(selectedChanges);
                                                if (isSelected) next.delete(change.taskId);
                                                else next.add(change.taskId);
                                                setSelectedChanges(next);
                                            }}
                                            className={`calendar-schedule__row ${isSelected ? 'calendar-schedule__row--selected' : ''}`}
                                        >
                                            <div className="calendar-schedule__checkbox-cell">
                                                <div className={`calendar-schedule__checkbox ${isSelected ? 'is-selected' : ''}`}>
                                                    {isSelected && <span className="material-symbols-outlined">check</span>}
                                                </div>
                                            </div>

                                            <div className="calendar-schedule__details">
                                                <div className="calendar-schedule__item-title">
                                                    <span className={`material-symbols-outlined calendar-schedule__item-icon calendar-schedule__item-icon--${isIssue ? 'issue' : 'task'}`}>
                                                        {isIssue ? 'bug_report' : 'check_circle'}
                                                    </span>
                                                    <span className="calendar-schedule__item-text">{itemTitle || t('calendar.modal.unknownItem')}</span>
                                                </div>
                                                <div className="calendar-schedule__item-meta">
                                                    <span className={`calendar-priority-dot calendar-priority-dot--${priorityTone}`} />
                                                    <span className="calendar-schedule__priority">
                                                        {t('calendar.modal.priority').replace('{priority}', priorityLabels[priority as keyof typeof priorityLabels] || priority)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="calendar-schedule__assignee">
                                                <div className={`calendar-schedule__assignee-pill ${isUnassigned ? 'is-unassigned' : ''}`}>
                                                    <span className="material-symbols-outlined">
                                                        {isUnassigned ? 'person_add' : 'person'}
                                                    </span>
                                                    <span>{assignee}</span>
                                                </div>
                                            </div>

                                            <div className="calendar-schedule__change">
                                                <div className="calendar-schedule__dates">
                                                    <span className={`calendar-schedule__date ${change.originalDate ? 'is-original' : 'is-unscheduled'}`}>
                                                        {change.originalDate ? format(new Date(change.originalDate), 'MMM d', { locale: dateLocale }) : t('calendar.modal.unscheduled')}
                                                    </span>
                                                    <span className="material-symbols-outlined calendar-schedule__arrow">arrow_forward</span>
                                                    <span className="calendar-schedule__date calendar-schedule__date--new">
                                                        {format(change.newDate, 'MMM d', { locale: dateLocale })}
                                                    </span>
                                                </div>
                                                <div className="calendar-schedule__reason">
                                                    <span className="material-symbols-outlined">info</span>
                                                    <span>{getScheduleReason(change.reason)}</span>
                                                </div>
                                            </div>

                                            <div className="calendar-schedule__action">
                                                <span className={`calendar-schedule__action-tag ${isUnassigned ? 'is-unassigned' : 'is-assigned'} ${isSelected ? 'is-selected' : ''}`}>
                                                    {isUnassigned ? t('calendar.modal.assignAndSchedule') : t('calendar.modal.reschedule')}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {hoveredTask && (
                    <div
                        className="calendar-tooltip"
                        style={{
                            left: `${hoveredTask.x}px`,
                            top: `${hoveredTask.y}px`,
                            maxWidth: '320px'
                        }}
                    >
                        <div className="calendar-tooltip__card">
                            <div className="calendar-tooltip__header">
                                <div className={`calendar-tooltip__icon ${'reporter' in hoveredTask.item ? 'calendar-tooltip__icon--issue' : 'calendar-tooltip__icon--task'}`}>
                                    <span className="material-symbols-outlined">
                                        {'reporter' in hoveredTask.item ? 'bug_report' : 'check_circle'}
                                    </span>
                                </div>
                                <div className="calendar-tooltip__body">
                                    <h4 className="calendar-tooltip__title">{hoveredTask.item.title}</h4>
                                    <div className="calendar-tooltip__meta">
                                        <span className={`calendar-priority calendar-priority--${getPriorityTone((hoveredTask.item as Task).priority)}`}>
                                            {priorityLabels[(hoveredTask.item.priority || 'Low') as keyof typeof priorityLabels] || hoveredTask.item.priority || t('tasks.priority.low')}
                                        </span>
                                        <span className="calendar-tooltip__separator" />
                                        <span className="calendar-tooltip__status">
                                            {'reporter' in hoveredTask.item
                                                ? t('calendar.tooltip.issue').replace('{status}', (hoveredTask.item as Issue).status || t('tasks.status.open'))
                                                : t('calendar.tooltip.task').replace('{status}', (hoveredTask.item as Task).status || t('tasks.status.open'))
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Description if available */}
                            {((hoveredTask.item as Task).description || (hoveredTask.item as Issue).description) && (
                                <p className="calendar-tooltip__description">
                                    {(hoveredTask.item as Task).description || (hoveredTask.item as Issue).description}
                                </p>
                            )}

                            <div className="calendar-tooltip__footer">
                                <div className="calendar-tooltip__meta-item">
                                    <span className="material-symbols-outlined calendar-tooltip__meta-icon">schedule</span>
                                    <span>
                                        {hoveredTask.item.scheduledDate
                                            ? format(new Date(hoveredTask.item.scheduledDate), 'MMM d, HH:mm', { locale: dateLocale })
                                            : (hoveredTask.item as Task).dueDate
                                                ? format(new Date((hoveredTask.item as Task).dueDate!), 'MMM d, HH:mm', { locale: dateLocale })
                                                : t('calendar.tooltip.noDate')
                                        }
                                    </span>
                                </div>
                                {((hoveredTask.item as Task).assigneeIds?.length > 0 || (hoveredTask.item as Task).assigneeId) && (
                                    <div className="calendar-tooltip__meta-item">
                                        <span className="material-symbols-outlined calendar-tooltip__meta-icon">person</span>
                                        <span className="calendar-tooltip__meta-label">{t('calendar.tooltip.assigned')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Calendar;
