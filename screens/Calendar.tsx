
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isSameDay, startOfDay, addDays, isToday, startOfWeek, endOfWeek, eachDayOfInterval, isValid, parseISO, startOfMonth, endOfMonth, isSameMonth, isAfter } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';
import { getUserTasks, getUserIssues, updateIssue, updateTask, getUnassignedTasks, getUsersTasks } from '../services/dataService';
import { Task, Issue } from '../types';
import { distributeTasks, ProposedSchedule } from '../utils/scheduler';
import { updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

export const Calendar = () => {
    const { theme } = useTheme();
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
    const getErrorMessage = (error: any) => error?.message || t('calendar.errors.unknown');

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

    const handleDragLeave = (e: React.DragEvent) => {
        // Optional: clear active state if leaving the grid entirely? 
        // For individual cells, we might want to clear only if leaving that specific cell, 
        // but React events bubble. Simplest is to clear dragActiveDate on Drop or end.
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

    // Layout classes based on view mode
    const gridCols = viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7'; // Both 7 cols
    const gridRows = viewMode === 'week' ? 'grid-rows-1' : 'auto-rows-fr';



    return (
        <div className="relative h-full overflow-hidden text-[var(--color-text-main)]">
            {/* Loading Overlay */}
            <div className={`
                absolute inset-0 z-[100] flex items-center justify-center bg-[var(--color-surface-bg)] transition-opacity duration-700 ease-in-out pointer-events-none
                ${loading ? 'opacity-100 pointer-events-auto' : 'opacity-0'}
            `}>
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-[var(--color-primary)]/20 rounded-full blur-xl animate-pulse"></div>
                        <span className="material-symbols-outlined animate-spin text-5xl text-[var(--color-primary)] relative z-10">
                            progress_activity
                        </span>
                    </div>
                    <p className="text-[var(--color-text-muted)] font-medium animate-pulse">{t('calendar.loading')}</p>
                </div>
            </div>

            {/* Main Content Container (now wrapped to handle relative positioning context if needed, though parent is relative) */}
            <div className="flex h-full w-full overflow-hidden">

                {/* Main Calendar Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <header className="flex items-center justify-between p-4 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-card)] shrink-0">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setViewDate(d => viewMode === 'week' ? addDays(d, -7) : addDays(startOfMonth(d), -1))} className="p-2 hover:bg-[var(--color-surface-hover)] rounded-full transition-colors">
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <h2 className="text-xl font-bold min-w-[200px] text-center">
                                {viewMode === 'week'
                                    ? `${format(days[0], 'MMM d', { locale: dateLocale })} - ${format(days[days.length - 1], 'MMM d, yyyy', { locale: dateLocale })}`
                                    : format(viewDate, 'MMMM yyyy', { locale: dateLocale })
                                }
                            </h2>
                            <button onClick={() => setViewDate(d => viewMode === 'week' ? addDays(d, 7) : addDays(endOfMonth(d), 1))} className="p-2 hover:bg-[var(--color-surface-hover)] rounded-full transition-colors">
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex bg-[var(--color-surface-bg)] rounded-lg p-1 border border-[var(--color-surface-border)]">
                                <button
                                    onClick={() => setViewMode('week')}
                                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === 'week' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    {t('calendar.view.week')}
                                </button>
                                <button
                                    onClick={() => setViewMode('month')}
                                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    {t('calendar.view.month')}
                                </button>
                            </div>

                            <button
                                onClick={prepareAutoSchedule}
                                disabled={distributing}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-xl hover:opacity-90 transition-all font-semibold disabled:opacity-50 shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">{distributing ? 'hourglass_top' : 'auto_fix_high'}</span>
                                <span className="hidden sm:inline">{distributing ? t('calendar.actions.optimizing') : t('calendar.actions.smartSchedule')}</span>
                            </button>

                            <button
                                onClick={() => setIsUnscheduledOpen(!isUnscheduledOpen)}
                                className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all relative ${isUnscheduledOpen ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}`}
                            >
                                <span className="material-symbols-outlined text-[20px]">inbox</span>
                                {unscheduledItems.length > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-[var(--color-surface-bg)]">
                                        {unscheduledItems.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </header>

                    {/* Grid */}
                    <div className={`flex-1 grid ${gridCols} ${gridRows} overflow-hidden bg-[var(--color-surface-border)] gap-[1px]`}>
                        {days.map(day => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isCurrent = isToday(day);
                            const isCurrentMonth = isSameMonth(day, viewDate);

                            const items = getItemsForDate(day);
                            const displayDate = format(day, 'd', { locale: dateLocale });
                            const displayDay = format(day, 'EEE', { locale: dateLocale });

                            return (
                                <div
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDate(day)}
                                    onDragOver={(e) => handleDragOver(e, day.toISOString())}
                                    onDrop={(e) => handleDropOnDay(e, day)}
                                    className={`
                                    flex flex-col transition-all cursor-pointer overflow-hidden
                                    ${!isCurrentMonth && viewMode === 'month' ? 'bg-[var(--color-surface-bg)] opacity-60' : 'bg-[var(--color-surface-card)]'}
                                    ${viewMode === 'week' ? 'min-h-[200px]' : 'min-h-[120px]'}
                                    ${dragActiveDate === day.toISOString() ? 'ring-2 ring-inset ring-[var(--color-primary)] bg-[var(--color-primary)]/5' : ''}
                                `}
                                >
                                    {/* Date Header */}
                                    <div className={`p-2 flex items-center justify-between shrink-0 ${isCurrent ? 'bg-[var(--color-primary)]/5' : ''}`}>
                                        <span className="text-xs font-medium uppercase text-[var(--color-text-muted)]">{viewMode === 'week' ? displayDay : ''}</span>
                                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${isCurrent ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] shadow-sm' : 'text-[var(--color-text-main)]'}`}>
                                            {displayDate}
                                        </div>
                                    </div>

                                    {/* Scrollable List Area */}
                                    <div className="flex-1 overflow-y-auto p-2 min-h-0 custom-scrollbar">
                                        <div className="flex flex-col gap-2">
                                            {items.map(item => {
                                                // Issues have 'reporter' field, tasks don't
                                                const itemType = 'reporter' in item ? 'issue' : 'task';
                                                return (
                                                    <div
                                                        key={item.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, item, itemType)}
                                                        onClick={(e) => handleItemClick(e, item, itemType)}
                                                        className={`
                                                    group p-2 text-xs rounded border shadow-sm hover:shadow-md transition-all cursor-pointer relative
                                                    bg-white dark:bg-slate-800 border-[var(--color-surface-border)]
                                                    ${(item as any).status && !(item as any).isCompleted ? 'border-l-4 border-l-purple-500' : ''}
                                                    active:cursor-grabbing hover:scale-[1.02]
                                                `}
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
                                                        <div className="font-semibold line-clamp-2 mb-1 pr-5">{item.title}</div>
                                                        <div className="flex items-center justify-between text-[var(--color-text-muted)]">
                                                            <div className="flex items-center gap-1">
                                                                <span className={`size-2 rounded-full ${item.priority === 'Urgent' ? 'bg-red-500' :
                                                                    item.priority === 'High' ? 'bg-orange-500' :
                                                                        item.priority === 'Medium' ? 'bg-yellow-500' :
                                                                            'bg-green-500'
                                                                    }`}></span>
                                                                <span className='scale-75 origin-left'>
                                                                    {(item as Task).dueDate ? format(new Date((item as Task).dueDate!), 'HH:mm', { locale: dateLocale }) : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {/* Unschedule Button */}
                                                        <button
                                                            onClick={(e) => handleUnschedule(e, item, itemType)}
                                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--color-surface-hover)] transition-opacity"
                                                            title={t('calendar.actions.unschedule')}
                                                        >
                                                            <span className="material-symbols-outlined text-[14px] text-[var(--color-text-muted)]">event_busy</span>
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Unscheduled Sidebar */}
                {isUnscheduledOpen && (
                    <div
                        className={`w-80 border-l border-[var(--color-surface-border)] bg-[var(--color-surface-card)] flex flex-col shrink-0 transition-all relative ${dragOverInbox ? 'ring-2 ring-inset ring-[var(--color-primary)] bg-[var(--color-primary)]/5' : ''}`}
                        onDragOver={handleDragOverInbox}
                        onDragLeave={handleDragLeaveInbox}
                        onDrop={handleDropOnUnscheduled}
                    >
                        {/* Drop zone visual overlay */}
                        {dragOverInbox && (
                            <div className="absolute inset-0 pointer-events-none bg-[var(--color-primary)]/10 flex items-center justify-center z-10">
                                <div className="text-[var(--color-primary)] font-bold text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined">inbox</span>
                                    {t('calendar.unassigned.dropHint')}
                                </div>
                            </div>
                        )}
                        <div className="p-4 border-b border-[var(--color-surface-border)] flex items-center justify-between">
                            <h3 className="font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-[var(--color-text-muted)]">inbox</span>
                                {t('calendar.unassigned.title')}
                                <span className="bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded-full">{unscheduledItems.length}</span>
                            </h3>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={unscheduleFutureItems}
                                    className="p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                                    title={t('calendar.actions.unscheduleFuture')}
                                >
                                    <span className="material-symbols-outlined text-[18px]">event_busy</span>
                                </button>
                                <button
                                    onClick={clearUnassignedFromCalendar}
                                    className="p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                                    title={t('calendar.actions.clearUnassigned')}
                                >
                                    <span className="material-symbols-outlined text-[18px]">playlist_remove</span>
                                </button>
                                <button onClick={() => setIsUnscheduledOpen(false)} className="hover:bg-[var(--color-surface-hover)] p-1 rounded">
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {unscheduledItems.length === 0 ? (
                                <div className="text-center py-10 text-[var(--color-text-muted)]">
                                    <span className="material-symbols-outlined text-[48px] opacity-20 block mb-2">check_circle</span>
                                    <p className="text-sm">{t('calendar.unassigned.empty')}</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {unscheduledItems.map(item => (
                                        <div
                                            key={item.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, item, 'reporter' in item ? 'issue' : 'task')}
                                            onClick={(e) => handleItemClick(e, item, 'reporter' in item ? 'issue' : 'task')}
                                            className="p-3 bg-[var(--color-surface-bg)] rounded-xl transition-all text-sm group cursor-grab active:cursor-grabbing hover:bg-[var(--color-surface-hover)] hover:translate-y-[-2px] hover:shadow-md"
                                        >
                                            <div className="font-medium mb-1 line-clamp-2">{item.title}</div>
                                            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                                                <div className="flex items-center gap-1">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${item.priority === 'Urgent' ? 'bg-red-500' :
                                                        item.priority === 'High' ? 'bg-orange-500' :
                                                            'bg-green-500'
                                                        }`}></span>
                                                    {'reporter' in item ? t('calendar.item.issue') : t('calendar.item.task')}
                                                </div>
                                                <button className="opacity-0 group-hover:opacity-100 text-[var(--color-primary)] font-bold transition-opacity">
                                                    {t('calendar.unassigned.dragToSchedule')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]">
                            <p className="text-xs text-[var(--color-text-muted)] text-center">
                                {t('calendar.unassigned.helper').replace('{action}', t('calendar.actions.smartSchedule'))}
                            </p>
                        </div>
                    </div>
                )}

                {/* Smart Schedule Modal */}
                {showScheduleModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-scale-up border-[3px] border-[var(--color-surface-border)]">
                            <div className="p-6 border-b border-[var(--color-surface-border)] flex items-center justify-between bg-[var(--color-surface-bg)]/50">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-3 text-[var(--color-text-main)]">
                                        <div className="p-2 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                                            <span className="material-symbols-outlined text-[24px]">auto_fix_high</span>
                                        </div>
                                        {t('calendar.modal.title')}
                                    </h3>
                                    <p className="text-[var(--color-text-muted)] text-sm mt-1 ml-14">
                                        {t('calendar.modal.subtitle').replace('{count}', String(selectedChanges.size))}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSelectedChanges(new Set(proposedSchedule.map(p => p.taskId)))}
                                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[var(--color-surface-hover)] text-[var(--color-text-main)] rounded-lg hover:bg-[var(--color-surface-border)] transition-colors"
                                    >
                                        {t('calendar.modal.selectAll')}
                                    </button>
                                    <button
                                        onClick={() => setSelectedChanges(new Set())}
                                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-transparent text-[var(--color-text-muted)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors border border-[var(--color-surface-border)] hover:border-[var(--color-text-muted)]"
                                    >
                                        {t('calendar.modal.deselectAll')}
                                    </button>
                                </div>
                            </div>

                            {/* Table Header */}
                            <div className="bg-[var(--color-surface-bg)] border-b border-[var(--color-surface-border)] px-6 py-3 grid grid-cols-[24px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] gap-6 items-center text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                                <div className="w-6 flex justify-center">
                                    <span className="material-symbols-outlined text-[18px]">check_box</span>
                                </div>
                                <div>{t('calendar.modal.headers.taskDetails')}</div>
                                <div>{t('calendar.modal.headers.assignee')}</div>
                                <div>{t('calendar.modal.headers.scheduleChange')}</div>
                                <div className="text-right">{t('calendar.modal.headers.action')}</div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--color-surface-bg)]/30">
                                {proposedSchedule.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-muted)]">
                                        <span className="material-symbols-outlined text-5xl mb-4 opacity-20">check_circle</span>
                                        <p className="text-lg font-medium">{t('calendar.modal.empty.title')}</p>
                                        <p className="text-sm opacity-60">{t('calendar.modal.empty.subtitle')}</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col">
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

                                            // Priority & Status colors
                                            const priority = (item as any)?.priority || 'Medium';
                                            const priorityColor = priority === 'Urgent' ? 'bg-red-500' :
                                                priority === 'High' ? 'bg-orange-500' :
                                                    priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500';

                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => {
                                                        const next = new Set(selectedChanges);
                                                        if (isSelected) next.delete(change.taskId);
                                                        else next.add(change.taskId);
                                                        setSelectedChanges(next);
                                                    }}
                                                    className={`
                                                    px-6 py-4 grid grid-cols-[24px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] gap-6 items-center border-b border-[var(--color-surface-border)] cursor-pointer transition-all duration-200 group
                                                    ${isSelected
                                                            ? 'bg-[var(--color-primary)]/5 hover:bg-[var(--color-primary)]/10'
                                                            : 'bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-hover)] opacity-75 hover:opacity-100'}
                                                `}
                                                >
                                                    {/* Checkbox Column */}
                                                    <div className="w-6 flex justify-center">
                                                        <div className={`
                                                        size-6 rounded-lg flex items-center justify-center transition-all duration-200 border
                                                        ${isSelected
                                                                ? 'bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-500/30 scale-100'
                                                                : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] group-hover:border-[var(--color-text-muted)] scale-90'}
                                                    `}>
                                                            {isSelected && <span className="material-symbols-outlined text-[16px] text-white font-bold">check</span>}
                                                        </div>
                                                    </div>

                                                    {/* Task / Issue Column */}
                                                    <div className="min-w-0 pr-4">
                                                        <div className="font-semibold text-[var(--color-text-main)] truncate text-sm mb-1 flex items-center gap-2">
                                                            <span className={`material-symbols-outlined text-[18px] shrink-0 ${isIssue ? 'text-purple-500' : 'text-blue-500'}`}>
                                                                {isIssue ? 'bug_report' : 'check_circle'}
                                                            </span>
                                                            <span className="truncate">{itemTitle || t('calendar.modal.unknownItem')}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1.5 ml-6">
                                                            <span className={`h-1.5 w-1.5 rounded-full ${priorityColor}`}></span>
                                                            <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide opacity-80">{t('calendar.modal.priority').replace('{priority}', priorityLabels[priority as keyof typeof priorityLabels] || priority)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Assignee Column */}
                                                    <div>
                                                        <div className={`
                                                        px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 border
                                                        ${isUnassigned
                                                                ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                                                                : 'bg-[var(--color-surface-bg)] text-[var(--color-text-muted)] border-[var(--color-surface-border)]'}
                                                    `}>
                                                            <span className="material-symbols-outlined text-[14px] shrink-0">
                                                                {isUnassigned ? 'person_add' : 'person'}
                                                            </span>
                                                            <span className="truncate max-w-[120px] block font-medium">
                                                                {assignee}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Schedule Change Column */}
                                                    <div className="flex flex-col justify-center">
                                                        <div className="flex items-center gap-3 text-sm">
                                                            <span className={`font-medium ${change.originalDate ? 'text-[var(--color-text-muted)] line-through opacity-70' : 'text-[var(--color-text-muted)] italic'}`}>
                                                                {change.originalDate ? format(new Date(change.originalDate), 'MMM d', { locale: dateLocale }) : t('calendar.modal.unscheduled')}
                                                            </span>
                                                            <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)] opacity-50">arrow_forward</span>
                                                            <span className="font-bold text-[var(--color-primary)]">
                                                                {format(change.newDate, 'MMM d', { locale: dateLocale })}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-[var(--color-text-muted)] mt-1 opacity-70 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">info</span>
                                                            {change.reason}
                                                        </div>
                                                    </div>

                                                    {/* Action Column */}
                                                    <div className="text-right">
                                                        {isUnassigned ? (
                                                            <span className={`
                                                            inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm transition-all border
                                                            ${isSelected
                                                                    ? 'bg-orange-500/10 text-orange-600 border-orange-500/20 shadow-orange-500/10'
                                                                    : 'bg-[var(--color-surface-border)] text-[var(--color-text-muted)] border-transparent opacity-50'}
                                                        `}>
                                                                {t('calendar.modal.assignAndSchedule')}
                                                            </span>
                                                        ) : (
                                                            <span className={`
                                                            inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm transition-all border
                                                            ${isSelected
                                                                    ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 shadow-indigo-500/10'
                                                                    : 'bg-[var(--color-surface-border)] text-[var(--color-text-muted)] border-transparent opacity-50'}
                                                        `}>
                                                                {t('calendar.modal.reschedule')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-card)] flex justify-end gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.2)] z-10">
                                <button
                                    onClick={() => setShowScheduleModal(false)}
                                    className="px-6 py-3 rounded-xl font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] transition-all"
                                >
                                    {t('calendar.actions.cancel')}
                                </button>
                                <button
                                    onClick={applyAutoSchedule}
                                    disabled={proposedSchedule.length === 0 || selectedChanges.size === 0}
                                    className="px-8 py-3 rounded-xl font-bold bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {selectedChanges.size > 0 && <span className="flex items-center justify-center bg-white/20 text-[var(--color-primary-text)] w-5 h-5 rounded-full text-[10px]">{selectedChanges.size}</span>}
                                    <span>{t('calendar.actions.startSchedule')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}


                {/* Hover Tooltip */}
                {hoveredTask && (
                    <div
                        className="fixed z-[70] pointer-events-none animate-fade-in"
                        style={{
                            left: `${hoveredTask.x}px`,
                            top: `${hoveredTask.y}px`,
                            maxWidth: '320px'
                        }}
                    >
                        <div className="bg-[var(--color-surface-card)] rounded-xl shadow-2xl border border-[var(--color-surface-border)] p-4 backdrop-blur-sm">
                            <div className="flex items-start gap-3 mb-3">
                                <div className={`
                                p-2 rounded-lg shrink-0
                                ${(hoveredTask.item as any).status ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}
                            `}>
                                    <span className="material-symbols-outlined text-[18px]">
                                        {(hoveredTask.item as any).status !== undefined ? 'bug_report' : 'check_circle'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm mb-1 line-clamp-2">{hoveredTask.item.title}</h4>
                                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${hoveredTask.item.priority === 'Urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                            hoveredTask.item.priority === 'High' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                hoveredTask.item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            }`}>
                                            {priorityLabels[(hoveredTask.item.priority || 'Low') as keyof typeof priorityLabels] || hoveredTask.item.priority || t('tasks.priority.low')}
                                        </span>
                                        <span className="text-[10px] opacity-60">•</span>
                                        <span>
                                            {(hoveredTask.item as any).status !== undefined
                                                ? t('calendar.tooltip.issue').replace('{status}', (hoveredTask.item as Issue).status || t('tasks.status.open'))
                                                : t('calendar.tooltip.task').replace('{status}', (hoveredTask.item as Task).status || t('tasks.status.open'))
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Description if available */}
                            {((hoveredTask.item as Task).description || (hoveredTask.item as Issue).description) && (
                                <p className="text-xs text-[var(--color-text-muted)] line-clamp-3 mb-3 leading-relaxed">
                                    {(hoveredTask.item as Task).description || (hoveredTask.item as Issue).description}
                                </p>
                            )}

                            <div className="flex items-center justify-between text-xs pt-3 border-t border-[var(--color-surface-border)]">
                                <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
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
                                    <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                                        <span className="material-symbols-outlined text-[14px]">person</span>
                                        <span className="text-[10px]">{t('calendar.tooltip.assigned')}</span>
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
