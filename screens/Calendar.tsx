
import React, { useState, useEffect, useMemo } from 'react';
import { format, isSameDay, startOfDay, addDays, isToday, startOfWeek, endOfWeek, eachDayOfInterval, isValid, parseISO, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { getUserTasks, getUserIssues, updateIssue, updateTask } from '../services/dataService';
import { Task, Issue } from '../types';
import { distributeTasks, ProposedSchedule } from '../utils/scheduler';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const Calendar = () => {
    const { theme } = useTheme();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [distributing, setDistributing] = useState(false);

    // View state
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [proposedSchedule, setProposedSchedule] = useState<ProposedSchedule[]>([]);

    // Unscheduled Sidebar Toggle
    const [isUnscheduledOpen, setIsUnscheduledOpen] = useState(true);

    // Alert State
    const [alertConfig, setAlertConfig] = useState<{ show: boolean, title: string, message: string, type: 'error' | 'success' | 'info' }>({
        show: false, title: '', message: '', type: 'info'
    });

    const showAlert = (title: string, message: string, type: 'error' | 'success' | 'info' = 'info') => {
        setAlertConfig({ show: true, title, message, type });
    };

    // Hover Tooltip State
    const [hoveredTask, setHoveredTask] = useState<{ item: Task | Issue, x: number, y: number } | null>(null);

    // Fetch data
    const refreshData = async () => {
        setLoading(true);
        try {
            const [fetchedTasks, fetchedIssues] = await Promise.all([
                getUserTasks(),
                getUserIssues()
            ]);
            console.log("Calendar: Fetched tasks", fetchedTasks.length);
            setTasks(fetchedTasks);
            setIssues(fetchedIssues);

            if (fetchedTasks.length === 0) {
                console.log("Debug: No tasks found. verifying current tenant...");
            }
        } catch (error: any) {
            console.error('Failed to fetch calendar data', error);
            showAlert('Error', `Error loading data: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    // Prep Auto-Schedule
    const prepareAutoSchedule = () => {
        const proposed = distributeTasks(tasks, issues);
        // Only show if there are changes
        const changes = proposed.filter(p => {
            const original = p.originalDate ? new Date(p.originalDate) : null;
            return !original || !isSameDay(original, p.newDate);
        });

        if (changes.length === 0) {
            showAlert('Optimized', 'Your schedule is already optimized! No changes needed.', 'success');
            return;
        }

        setProposedSchedule(changes);
        setShowScheduleModal(true);
    };

    // Apply Auto-Schedule
    const applyAutoSchedule = async () => {
        setDistributing(true);
        try {
            const updates = proposedSchedule.map(async (p) => {
                const dateStr = p.newDate.toISOString();

                if (p.type === 'task') {
                    // Find Task to get context
                    const task = tasks.find(t => t.id === p.taskId);
                    if (task) {
                        // Use dataService helper for correct path resolution
                        // We cast task as any or Task to access tenantId now that I added it to Type
                        await updateTask(task.id, { scheduledDate: dateStr }, task.projectId, task.tenantId);
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
        } catch (error: any) {
            console.error('Distribution failed', error);
            showAlert('Error', 'Failed to optimize schedule: ' + error.message, 'error');
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
            return isSameDay(d, date) && !t.isCompleted;
        });

        const dateIssues = issues.filter(i => {
            const d = getItemDate(i);
            if (!d || !isValid(d)) return false;
            return isSameDay(d, date) && i.status !== 'Resolved' && i.status !== 'Closed';
        });

        return [...dateTasks, ...dateIssues];
    };

    const unscheduledItems = useMemo(() => {
        const t = tasks.filter(t => !getItemDate(t) && !t.isCompleted);
        const i = issues.filter(issue => !getItemDate(issue) && issue.status !== 'Resolved' && issue.status !== 'Closed');
        return [...t, ...i];
    }, [tasks, issues]);

    // Layout classes based on view mode
    const gridCols = viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7'; // Both 7 cols
    const gridRows = viewMode === 'week' ? 'grid-rows-1' : 'auto-rows-fr';

    return (
        <div className="flex h-full overflow-hidden text-[var(--color-text-main)]">

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
                                ? `${format(days[0], 'MMM d')} - ${format(days[days.length - 1], 'MMM d, yyyy')}`
                                : format(viewDate, 'MMMM yyyy')
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
                                Week
                            </button>
                            <button
                                onClick={() => setViewMode('month')}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                Month
                            </button>
                        </div>

                        <button
                            onClick={prepareAutoSchedule}
                            disabled={distributing}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl hover:opacity-90 transition-all font-semibold disabled:opacity-50 shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[18px]">{distributing ? 'hourglass_top' : 'auto_fix_high'}</span>
                            <span className="hidden sm:inline">{distributing ? 'Optimizing...' : 'Smart Schedule'}</span>
                        </button>

                        <button
                            onClick={() => setIsUnscheduledOpen(!isUnscheduledOpen)}
                            className={`p-2 rounded-lg border transition-colors relative ${isUnscheduledOpen ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'bg-[var(--color-surface-card)] border-[var(--color-surface-border)]'}`}
                        >
                            <span className="material-symbols-outlined">inbox</span>
                            {unscheduledItems.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
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
                        const displayDate = format(day, 'd');
                        const displayDay = format(day, 'EEE');

                        return (
                            <div
                                key={day.toISOString()}
                                onClick={() => setSelectedDate(day)}
                                className={`
                                    flex flex-col transition-all cursor-pointer overflow-hidden
                                    ${!isCurrentMonth && viewMode === 'month' ? 'bg-[var(--color-surface-bg)] opacity-60' : 'bg-[var(--color-surface-card)]'}
                                    ${viewMode === 'week' ? 'min-h-[200px]' : 'min-h-[120px]'}
                                `}
                            >
                                {/* Date Header */}
                                <div className={`p-2 flex items-center justify-between shrink-0 ${isCurrent ? 'bg-[var(--color-primary)]/5' : ''}`}>
                                    <span className="text-xs font-medium uppercase text-[var(--color-text-muted)]">{viewMode === 'week' ? displayDay : ''}</span>
                                    <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${isCurrent ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-text-main)]'}`}>
                                        {displayDate}
                                    </div>
                                </div>

                                {/* Scrollable List Area */}
                                <div className="flex-1 overflow-y-auto p-2 min-h-0 custom-scrollbar">
                                    <div className="flex flex-col gap-2">
                                        {items.map(item => (
                                            <div
                                                key={item.id}
                                                className={`
                                                    group p-2 text-xs rounded border shadow-sm hover:shadow-md transition-all cursor-pointer relative
                                                    bg-white dark:bg-slate-800 border-[var(--color-surface-border)]
                                                    ${(item as any).status && !(item as any).isCompleted ? 'border-l-4 border-l-purple-500' : ''}
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
                                                <div className="font-semibold line-clamp-2 mb-1">{item.title}</div>
                                                <div className="flex items-center justify-between text-[var(--color-text-muted)]">
                                                    <div className="flex items-center gap-1">
                                                        <span className={`size-2 rounded-full ${item.priority === 'Urgent' ? 'bg-red-500' :
                                                            item.priority === 'High' ? 'bg-orange-500' :
                                                                item.priority === 'Medium' ? 'bg-yellow-500' :
                                                                    'bg-green-500'
                                                            }`}></span>
                                                        <span className='scale-75 origin-left'>
                                                            {/* Show Time if tasks have it, else just icon */}
                                                            {(item as Task).dueDate ? format(new Date((item as Task).dueDate!), 'HH:mm') : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Unscheduled Sidebar */}
            {isUnscheduledOpen && (
                <div className="w-80 border-l border-[var(--color-surface-border)] bg-[var(--color-surface-card)] flex flex-col shrink-0 transition-all">
                    <div className="p-4 border-b border-[var(--color-surface-border)] flex items-center justify-between">
                        <h3 className="font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-[var(--color-text-muted)]">inbox</span>
                            Unscheduled
                            <span className="bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded-full">{unscheduledItems.length}</span>
                        </h3>
                        <button onClick={() => setIsUnscheduledOpen(false)} className="hover:bg-[var(--color-surface-hover)] p-1 rounded">
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {unscheduledItems.length === 0 ? (
                            <div className="text-center py-10 text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-[48px] opacity-20 block mb-2">check_circle</span>
                                <p className="text-sm">All caught up!</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {unscheduledItems.map(item => (
                                    <div key={item.id} className="p-3 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl hover:shadow-sm transition-all text-sm group">
                                        <div className="font-medium mb-1 line-clamp-2">{item.title}</div>
                                        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                                            <div className="flex items-center gap-1">
                                                <span className={`w-1.5 h-1.5 rounded-full ${item.priority === 'Urgent' ? 'bg-red-500' :
                                                    item.priority === 'High' ? 'bg-orange-500' :
                                                        'bg-green-500'
                                                    }`}></span>
                                                {(item as any).status !== undefined ? 'Issue' : 'Task'}
                                            </div>
                                            <button className="opacity-0 group-hover:opacity-100 text-[var(--color-primary)] font-bold transition-opacity">
                                                Drag to Sched... (Soon)
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]">
                        <p className="text-xs text-[var(--color-text-muted)] text-center">
                            Use "Smart Schedule" to automatically assign dates to these items.
                        </p>
                    </div>
                </div>
            )}

            {/* Smart Schedule Modal */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh] animate-scale-up">
                        <div className="p-6 border-b border-[var(--color-surface-border)]">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-[var(--color-primary)]">auto_fix_high</span>
                                Optimized Schedule
                            </h3>
                            <p className="text-[var(--color-text-muted)] text-sm mt-1">
                                We found a better way to organize your tasks.
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="flex flex-col gap-3">
                                {proposedSchedule.slice(0, 10).map((change, idx) => {
                                    const isIssue = change.type === 'issue';
                                    const itemTitle = isIssue
                                        ? issues.find(i => i.id === change.taskId)?.title
                                        : tasks.find(t => t.id === change.taskId)?.title;

                                    return (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)]">
                                            <div className="flex-1 min-w-0 mr-3">
                                                <div className="font-medium truncate text-sm">{itemTitle || 'Unknown Item'}</div>
                                                <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                                                    <span>Unscheduled</span>
                                                    <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                                                    <span className="text-[var(--color-primary)] font-bold">{format(change.newDate, 'MMM d')}</span>
                                                </div>
                                            </div>
                                            <div className="text-xs font-bold text-[var(--color-text-muted)] px-2 py-1 rounded bg-[var(--color-surface-border)]/50">
                                                {change.reason}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-6 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] flex gap-3">
                            <button
                                onClick={() => setShowScheduleModal(false)}
                                className="flex-1 px-4 py-3 rounded-xl font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={applyAutoSchedule}
                                className="flex-1 px-4 py-3 rounded-xl font-bold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/20"
                            >
                                Apply Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Generic Alert Modal */}
            {alertConfig.show && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-up border border-[var(--color-surface-border)]">
                        <div className={`
                            w-12 h-12 rounded-full flex items-center justify-center mb-4
                            ${alertConfig.type === 'error' ? 'bg-red-100 text-red-600' :
                                alertConfig.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}
                        `}>
                            <span className="material-symbols-outlined text-2xl">
                                {alertConfig.type === 'error' ? 'error' :
                                    alertConfig.type === 'success' ? 'check_circle' : 'info'}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold mb-2">{alertConfig.title}</h3>
                        <p className="text-[var(--color-text-muted)] text-sm mb-6">
                            {alertConfig.message}
                        </p>
                        <button
                            onClick={() => setAlertConfig(prev => ({ ...prev, show: false }))}
                            className="w-full py-3 rounded-xl font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-main)] hover:brightness-95 transition-all"
                        >
                            Dismiss
                        </button>
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
                                        {hoveredTask.item.priority || 'Low'}
                                    </span>
                                    <span className="text-[10px] opacity-60">•</span>
                                    <span>
                                        {(hoveredTask.item as any).status !== undefined
                                            ? `Issue: ${(hoveredTask.item as Issue).status}`
                                            : `Task: ${(hoveredTask.item as Task).status || 'Open'}`
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
                                        ? format(new Date(hoveredTask.item.scheduledDate), 'MMM d, HH:mm')
                                        : (hoveredTask.item as Task).dueDate
                                            ? format(new Date((hoveredTask.item as Task).dueDate!), 'MMM d, HH:mm')
                                            : 'No date'
                                    }
                                </span>
                            </div>
                            {(hoveredTask.item as Task).assigneeId && (
                                <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                                    <span className="material-symbols-outlined text-[14px]">person</span>
                                    <span className="text-[10px]">Assigned</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calendar;
