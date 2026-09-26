import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import type { Initiative, Project, ProjectReminder, Task } from '../../../../types';
import { DatePicker } from '../../../common/DateTime/DatePicker';
import { parseDateValue } from '../../../../utils/taskDates';

type ReminderSource = 'project' | 'task';

type DisplayReminder = ProjectReminder & {
    source: ReminderSource;
    task?: Task;
    isLegacyTaskReminder?: boolean;
};

type ProjectRemindersPanelProps = {
    project: Project;
    tasks: Task[];
    initiatives: Initiative[];
    canManage: boolean;
    dateFormat: string;
    dateLocale: Locale;
    onSaveProjectReminders: (reminders: ProjectReminder[]) => Promise<void>;
    onSaveTaskReminders: (task: Task, reminders: ProjectReminder[], reminderAt?: string | null) => Promise<void>;
    onOpenTask: (taskId: string) => void;
    onOpenInitiative: (initiativeId: string) => void;
    t: (key: string, fallback?: string) => string;
};

const makeReminderId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const parseReminderDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatReminderDate = (value: string, dateFormat: string, dateLocale: Locale) => {
    const date = parseReminderDate(value);
    if (!date) return value;
    const hasTime = value.includes('T') && !value.endsWith('T00:00');
    return hasTime
        ? `${format(date, dateFormat, { locale: dateLocale })} ${format(date, 'HH:mm')}`
        : format(date, dateFormat, { locale: dateLocale });
};

const getEarliestOpenReminderDate = (reminders: ProjectReminder[]) => {
    const next = reminders
        .filter((reminder) => !reminder.isCompleted)
        .map((reminder) => reminder.remindAt)
        .filter(Boolean)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
    return next || null;
};

export const ProjectRemindersPanel: React.FC<ProjectRemindersPanelProps> = ({
    project,
    tasks,
    initiatives,
    canManage,
    dateFormat,
    dateLocale,
    onSaveProjectReminders,
    onSaveTaskReminders,
    onOpenTask,
    onOpenInitiative,
    t
}) => {
    const [title, setTitle] = useState('');
    const [remindDate, setRemindDate] = useState<Date | null>(null);
    const [linkTarget, setLinkTarget] = useState('project');
    const [open, setOpen] = useState(false);
    const [composerOpen, setComposerOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (event: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpen(false);
                setComposerOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const taskLookup = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
    const initiativeLookup = useMemo(() => new Map(initiatives.map((initiative) => [initiative.id, initiative])), [initiatives]);

    const reminders = useMemo<DisplayReminder[]>(() => {
        const projectReminders = (project.reminders || []).map((reminder) => ({
            ...reminder,
            source: 'project' as const
        }));
        const taskReminders = tasks.flatMap((task) => {
            const current = (task.reminders || []).map((reminder) => ({
                ...reminder,
                source: 'task' as const,
                task
            }));
            if (!task.reminderAt || current.some((reminder) => reminder.remindAt === task.reminderAt && !reminder.isCompleted)) {
                return current;
            }
            return [
                ...current,
                {
                    id: `legacy-${task.id}`,
                    title: t('projectOverview.reminders.legacyTaskTitle', 'Task reminder'),
                    remindAt: task.reminderAt,
                    linkedType: 'task' as const,
                    linkedId: task.id,
                    linkedTitle: task.title,
                    isCompleted: false,
                    source: 'task' as const,
                    task,
                    isLegacyTaskReminder: true
                }
            ];
        });
        return [...projectReminders, ...taskReminders]
            .filter((reminder) => reminder.remindAt)
            .sort((a, b) => {
                if (Boolean(a.isCompleted) !== Boolean(b.isCompleted)) return a.isCompleted ? 1 : -1;
                return parseDateValue(a.remindAt).getTime() - parseDateValue(b.remindAt).getTime();
            });
    }, [project.reminders, tasks, t]);

    const visibleReminders = reminders.slice(0, 8);
    const openCount = reminders.filter((reminder) => !reminder.isCompleted).length;
    const dueCount = reminders.filter((reminder) => {
        const date = parseReminderDate(reminder.remindAt);
        return Boolean(date && date.getTime() <= Date.now() && !reminder.isCompleted);
    }).length;

    const saveTaskReminderList = async (task: Task, nextReminders: ProjectReminder[], explicitReminderAt?: string | null) => {
        await onSaveTaskReminders(task, nextReminders, explicitReminderAt === undefined ? getEarliestOpenReminderDate(nextReminders) : explicitReminderAt);
    };

    const handleAdd = async () => {
        if (!canManage || !remindDate) return;
        setSaving(true);
        try {
            const [targetType, targetId] = linkTarget.split(':');
            const linkedTask = targetType === 'task' && targetId ? taskLookup.get(targetId) : undefined;
            const linkedInitiative = targetType === 'initiative' && targetId ? initiativeLookup.get(targetId) : undefined;
            const reminderTitle = title.trim() || t('projectOverview.reminders.defaultTitle', 'Follow up');
            const reminder: ProjectReminder = {
                id: makeReminderId(),
                title: reminderTitle,
                remindAt: format(remindDate, 'yyyy-MM-dd'),
                linkedType: linkedTask ? 'task' : linkedInitiative ? 'initiative' : 'project',
                linkedId: linkedTask?.id || linkedInitiative?.id || project.id,
                linkedTitle: linkedTask?.title || linkedInitiative?.title || project.title,
                isCompleted: false,
                createdAt: new Date().toISOString()
            };

            if (linkedTask) {
                await saveTaskReminderList(linkedTask, [...(linkedTask.reminders || []), reminder]);
            } else {
                await onSaveProjectReminders([...(project.reminders || []), reminder]);
            }

            setTitle('');
            setRemindDate(null);
            setLinkTarget('project');
            setComposerOpen(false);
        } finally {
            setSaving(false);
        }
    };

    const updateReminder = async (reminder: DisplayReminder, updates: Partial<ProjectReminder>) => {
        if (!canManage) return;
        if (reminder.source === 'task' && reminder.task) {
            if (reminder.isLegacyTaskReminder) {
                await saveTaskReminderList(reminder.task, reminder.task.reminders || [], updates.isCompleted ? null : reminder.remindAt);
                return;
            }
            const next = (reminder.task.reminders || []).map((item) => (
                item.id === reminder.id ? { ...item, ...updates } : item
            ));
            await saveTaskReminderList(reminder.task, next);
            return;
        }
        const next = (project.reminders || []).map((item) => (
            item.id === reminder.id ? { ...item, ...updates } : item
        ));
        await onSaveProjectReminders(next);
    };

    const deleteReminder = async (reminder: DisplayReminder) => {
        if (!canManage) return;
        if (reminder.source === 'task' && reminder.task) {
            if (reminder.isLegacyTaskReminder) {
                await saveTaskReminderList(reminder.task, reminder.task.reminders || [], null);
                return;
            }
            const next = (reminder.task.reminders || []).filter((item) => item.id !== reminder.id);
            await saveTaskReminderList(reminder.task, next);
            return;
        }
        await onSaveProjectReminders((project.reminders || []).filter((item) => item.id !== reminder.id));
    };

    return (
        <div className="po-reminders" ref={rootRef}>
            <button
                type="button"
                className={`po-reminders__trigger ${dueCount > 0 ? 'has-due' : ''}`.trim()}
                onClick={() => setOpen((current) => !current)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={t('projectOverview.reminders.title', 'Reminders')}
                title={t('projectOverview.reminders.title', 'Reminders')}
            >
                <span className="material-symbols-outlined">notifications</span>
                {openCount > 0 && <span className="po-reminders__trigger-count">{openCount}</span>}
            </button>

            {open && (
                <div className="po-reminders__popover" role="dialog" aria-label={t('projectOverview.reminders.title', 'Reminders')}>
                    <div className="po-reminders__header">
                        <div>
                            <span className="po-reminders__eyebrow">{t('projectOverview.reminders.eyebrow', 'Follow-ups')}</span>
                            <h2>{t('projectOverview.reminders.title', 'Reminders')}</h2>
                        </div>
                        <div className="po-reminders__stats" aria-label={t('projectOverview.reminders.stats', 'Reminder status')}>
                            <span>{t('projectOverview.reminders.openCount', '{count} open').replace('{count}', String(openCount))}</span>
                            {dueCount > 0 && <strong>{t('projectOverview.reminders.dueCount', '{count} due').replace('{count}', String(dueCount))}</strong>}
                            {canManage && (
                                <button
                                    type="button"
                                    className="po-reminders__add"
                                    onClick={() => setComposerOpen((current) => !current)}
                                    aria-expanded={composerOpen}
                                >
                                    <span className="material-symbols-outlined">{composerOpen ? 'close' : 'add'}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {canManage && composerOpen && (
                        <div className="po-reminders__form">
                            <input
                                type="text"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder={t('projectOverview.reminders.titlePlaceholder', 'e.g. Ask customer about approval')}
                            />
                            <DatePicker
                                value={remindDate}
                                onChange={setRemindDate}
                                placeholder={t('projectOverview.reminders.dateLabel', 'Reminder date')}
                            />
                            <select value={linkTarget} onChange={(event) => setLinkTarget(event.target.value)} aria-label={t('projectOverview.reminders.linkLabel', 'Link reminder')}>
                                <option value="project">{t('projectOverview.reminders.linkProject', 'Project')}</option>
                                {tasks.map((task) => (
                                    <option key={task.id} value={`task:${task.id}`}>
                                        {t('projectOverview.reminders.linkTaskPrefix', 'Task')}: {task.title}
                                    </option>
                                ))}
                                {initiatives.map((initiative) => (
                                    <option key={initiative.id} value={`initiative:${initiative.id}`}>
                                        {t('projectOverview.reminders.linkInitiativePrefix', 'Initiative')}: {initiative.title}
                                    </option>
                                ))}
                            </select>
                            <button type="button" onClick={() => void handleAdd()} disabled={!remindDate || saving}>
                                <span className="material-symbols-outlined">add_alert</span>
                                <span>{t('projectOverview.reminders.add', 'Add')}</span>
                            </button>
                        </div>
                    )}

                    {visibleReminders.length > 0 ? (
                        <div className="po-reminders__list">
                            {visibleReminders.map((reminder) => {
                                const date = parseReminderDate(reminder.remindAt);
                                const isDue = Boolean(date && date.getTime() <= Date.now() && !reminder.isCompleted);
                                const linkTitle = reminder.linkedType === 'task' && reminder.linkedId
                                    ? (taskLookup.get(reminder.linkedId)?.title || reminder.linkedTitle)
                                    : reminder.linkedType === 'initiative' && reminder.linkedId
                                        ? (initiativeLookup.get(reminder.linkedId)?.title || reminder.linkedTitle)
                                        : reminder.linkedTitle;

                                return (
                                    <article key={`${reminder.source}-${reminder.id}`} className={`po-reminders__item ${reminder.isCompleted ? 'is-done' : ''} ${isDue ? 'is-due' : ''}`.trim()}>
                                        {canManage && (
                                            <button
                                                type="button"
                                                className="po-reminders__check"
                                                aria-label={reminder.isCompleted ? t('projectOverview.reminders.reopen', 'Reopen reminder') : t('projectOverview.reminders.complete', 'Complete reminder')}
                                                onClick={() => void updateReminder(reminder, {
                                                    isCompleted: !reminder.isCompleted,
                                                    completedAt: reminder.isCompleted ? '' : new Date().toISOString()
                                                })}
                                            >
                                                <span className="material-symbols-outlined">{reminder.isCompleted ? 'check' : 'radio_button_unchecked'}</span>
                                            </button>
                                        )}
                                        <div className="po-reminders__copy">
                                            <strong>{reminder.title}</strong>
                                            <span>
                                                {formatReminderDate(reminder.remindAt, dateFormat, dateLocale)}
                                                {isDue ? ` · ${t('projectOverview.reminders.dueNow', 'due')}` : ''}
                                            </span>
                                        </div>
                                        {linkTitle && reminder.linkedType !== 'project' && reminder.linkedId && (
                                            <button
                                                type="button"
                                                className="po-reminders__link"
                                                onClick={() => {
                                                    if (reminder.linkedType === 'task') onOpenTask(reminder.linkedId!);
                                                    if (reminder.linkedType === 'initiative') onOpenInitiative(reminder.linkedId!);
                                                }}
                                            >
                                                <span className="material-symbols-outlined">{reminder.linkedType === 'task' ? 'task_alt' : 'conversion_path'}</span>
                                                <span>{linkTitle}</span>
                                            </button>
                                        )}
                                        {canManage && (
                                            <button
                                                type="button"
                                                className="po-reminders__delete"
                                                aria-label={t('projectOverview.reminders.delete', 'Delete reminder')}
                                                onClick={() => void deleteReminder(reminder)}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="po-reminders__empty">
                            <span className="material-symbols-outlined">notifications_active</span>
                            <p>{t('projectOverview.reminders.empty', 'No reminders yet')}</p>
                            {canManage && (
                                <button type="button" onClick={() => setComposerOpen(true)}>
                                    {t('projectOverview.reminders.add', 'Add')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
