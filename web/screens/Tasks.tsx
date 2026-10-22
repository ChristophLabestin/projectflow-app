import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getUserProjects } from '../services/domain/projectsService';
import { addTask, getSubTasks, getUserTasks, toggleTaskStatus, updateTaskFields } from '../services/domain/tasksService';
import { isProjectIncludedInImportantSignals } from '../services/healthService';
import { auth } from '../services/firebase';
import type { Project, Task } from '../types';
import { Button } from '../components/common/Button/Button';
import { Select, type SelectOption } from '../components/common/Select/Select';
import { ProjectBoard } from '../components/ProjectBoard';
import { TaskGroupList } from '../components/work/TaskGroupList';
import { TaskRow } from '../components/work/TaskRow';
import { groupTasks, summarizeDue } from '../components/work/workList';
import { useWorkMembers } from '../components/work/useWorkMembers';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/UIContext';

const TaskCreateModal = lazy(() => import('../components/TaskCreateModal').then((module) => ({ default: module.TaskCreateModal })));

const QUICK_ADD_PROJECT_KEY = 'projectflow_quick_add_project';
const CLOSED_PROJECT_STATUSES = ['Completed', 'Canceled'];

const isTypingTarget = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    return !!element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName));
};

/**
 * My Work: every task assigned to the user in the active workspace, grouped by
 * what needs attention first (overdue → today → this week → later).
 */
export const Tasks = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { showError } = useToast();
    const members = useWorkMembers();
    const quickInputRef = useRef<HTMLInputElement>(null);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [subtaskStats, setSubtaskStats] = useState<Record<string, { done: number; total: number }>>({});
    const [savingId, setSavingId] = useState<string | null>(null);

    const [view, setView] = useState<'list' | 'board'>('list');
    const [search, setSearch] = useState('');
    const [projectFilter, setProjectFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [showCompleted, setShowCompleted] = useState(false);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [quickTitle, setQuickTitle] = useState('');
    const [quickProjectId, setQuickProjectId] = useState('');
    const [quickAdding, setQuickAdding] = useState(false);

    const refreshTasks = useCallback(async () => {
        setTasks(await getUserTasks());
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const [taskData, projectData] = await Promise.all([getUserTasks(), getUserProjects()]);
                setTasks(taskData);
                setProjects(projectData.filter(isProjectIncludedInImportantSignals));
            } catch (error) {
                console.error('Failed to fetch tasks', error);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Quick add targets the last used project if it is still active, otherwise
    // the most recently updated active project — never a closed one.
    const activeProjects = useMemo(
        () => projects.filter((project) => !CLOSED_PROJECT_STATUSES.includes(project.status)),
        [projects]
    );
    useEffect(() => {
        if (!activeProjects.length || activeProjects.some((project) => project.id === quickProjectId)) return;
        const remembered = localStorage.getItem(QUICK_ADD_PROJECT_KEY);
        setQuickProjectId(activeProjects.find((project) => project.id === remembered)?.id || activeProjects[0].id);
    }, [activeProjects, quickProjectId]);

    // "N" focuses quick add from anywhere on the page.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
            event.preventDefault();
            quickInputRef.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const handleQuickAdd = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!quickTitle.trim() || !quickProjectId || quickAdding) return;
        setQuickAdding(true);
        try {
            const project = projects.find((entry) => entry.id === quickProjectId);
            await addTask(quickProjectId, quickTitle.trim(), undefined, undefined, 'Medium', undefined, project?.tenantId);
            localStorage.setItem(QUICK_ADD_PROJECT_KEY, quickProjectId);
            await refreshTasks();
            setQuickTitle('');
        } catch (error) {
            console.error('Quick add failed', error);
            showError(t('work.quickAdd.error'));
        } finally {
            setQuickAdding(false);
        }
    };

    const handleToggle = useCallback(async (task: Task) => {
        const wasCompleted = task.isCompleted;
        setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, isCompleted: !wasCompleted, status: wasCompleted ? 'Open' : 'Done' } : item)));
        try {
            await toggleTaskStatus(task.id, wasCompleted, task.projectId, task.tenantId);
        } catch (error) {
            console.error(error);
            setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
            showError(t('work.update.error'));
        }
    }, [showError, t]);

    const handleUpdate = useCallback(async (task: Task, updates: Partial<Task>) => {
        setSavingId(task.id);
        setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, ...updates } : item)));
        try {
            await updateTaskFields(task.id, updates, task.projectId, task.tenantId);
        } catch (error) {
            console.error(error);
            setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
            showError(t('work.update.error'));
        } finally {
            setSavingId((current) => (current === task.id ? null : current));
        }
    }, [showError, t]);

    const openTask = useCallback((task: Task) => {
        navigate(`/project/${task.projectId}/tasks/${task.id}`);
    }, [navigate]);

    const projectTitleById = useMemo(
        () => Object.fromEntries(projects.map((project) => [project.id, project.title])),
        [projects]
    );

    const visibleTasks = useMemo(() => {
        const query = search.trim().toLowerCase();
        return tasks.filter((task) => {
            if (!showCompleted && task.isCompleted) return false;
            if (query && !task.title.toLowerCase().includes(query)) return false;
            if (projectFilter !== 'all' && task.projectId !== projectFilter) return false;
            if (priorityFilter !== 'all' && (task.priority || 'Medium') !== priorityFilter) return false;
            return true;
        });
    }, [tasks, search, showCompleted, projectFilter, priorityFilter]);

    const groups = useMemo(
        () => groupTasks(visibleTasks, { groupBy: 'due', t, members, currentUserId: auth.currentUser?.uid }),
        [visibleTasks, t, members]
    );
    const summary = useMemo(() => summarizeDue(tasks), [tasks]);

    // Subtask progress for the first open rows (bounded to keep reads cheap).
    useEffect(() => {
        const candidates = visibleTasks.filter((task) => !task.isCompleted).slice(0, 40);
        if (!candidates.length) return;
        let alive = true;
        Promise.all(candidates.map(async (task) => {
            const subs = await getSubTasks(task.id, task.projectId, task.tenantId);
            return [task.id, { done: subs.filter((sub) => sub.isCompleted).length, total: subs.length }] as const;
        }))
            .then((entries) => { if (alive) setSubtaskStats(Object.fromEntries(entries)); })
            .catch((error) => console.warn(error));
        return () => { alive = false; };
    }, [visibleTasks]);

    const projectOptions = useMemo<SelectOption[]>(() => ([
        { value: 'all', label: t('work.filter.allProjects') },
        ...projects.map((project) => ({ value: project.id, label: project.title }))
    ]), [projects, t]);
    const quickProjectOptions = useMemo<SelectOption[]>(
        () => activeProjects.map((project) => ({ value: project.id, label: project.title })),
        [activeProjects]
    );
    const priorityOptions = useMemo<SelectOption[]>(() => ([
        { value: 'all', label: t('work.filter.anyPriority') },
        ...['Urgent', 'High', 'Medium', 'Low'].map((value) => ({ value, label: t(`work.priority.${value}`) }))
    ]), [t]);

    const summaryParts = [
        summary.overdue ? { tone: 'danger', text: t('work.summary.overdue').replace('{count}', String(summary.overdue)) } : null,
        summary.today ? { tone: 'warning', text: t('work.summary.today').replace('{count}', String(summary.today)) } : null,
        summary.week ? { tone: 'neutral', text: t('work.summary.week').replace('{count}', String(summary.week)) } : null
    ].filter(Boolean) as { tone: string; text: string }[];

    if (loading) {
        return (
            <div className="work-page work-page--loading" aria-busy="true">
                <span className="material-symbols-outlined work-page__spinner">progress_activity</span>
            </div>
        );
    }

    const hasFilters = !!search || projectFilter !== 'all' || priorityFilter !== 'all';

    return (
        <div className="work-page">
            <header className="work-page__header">
                <div>
                    <h1 className="work-page__title">{t('work.my.title')}</h1>
                    <p className="work-page__summary">
                        {summaryParts.length ? summaryParts.map((part, index) => (
                            <React.Fragment key={part.text}>
                                {index > 0 && <span className="work-page__dot" aria-hidden="true">·</span>}
                                <span className={`work-page__summary-item work-page__summary-item--${part.tone}`}>{part.text}</span>
                            </React.Fragment>
                        )) : t('work.summary.clear')}
                    </p>
                </div>
                <Button variant="secondary" icon={<span className="material-symbols-outlined">edit_note</span>} onClick={() => setShowCreateModal(true)}>
                    {t('work.newDetailed')}
                </Button>
            </header>

            <form className="work-quick-add" onSubmit={handleQuickAdd}>
                <span className="material-symbols-outlined work-quick-add__icon" aria-hidden="true">add</span>
                <input
                    ref={quickInputRef}
                    className="work-quick-add__input"
                    value={quickTitle}
                    onChange={(event) => setQuickTitle(event.target.value)}
                    placeholder={t('work.quickAdd.placeholder')}
                    aria-label={t('work.quickAdd.label')}
                    disabled={!quickProjectOptions.length}
                />
                {quickProjectOptions.length > 0 && (
                    <Select
                        value={quickProjectId}
                        onChange={(value) => setQuickProjectId(String(value))}
                        options={quickProjectOptions}
                        className="work-quick-add__project"
                    />
                )}
                <kbd className="work-quick-add__hint" aria-hidden="true">N</kbd>
                <Button type="submit" size="sm" isLoading={quickAdding} disabled={!quickTitle.trim() || !quickProjectId}>
                    {t('work.quickAdd.submit')}
                </Button>
            </form>

            <div className="work-toolbar">
                <label className="work-toolbar__search">
                    <span className="material-symbols-outlined" aria-hidden="true">search</span>
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('work.filter.search')}
                        aria-label={t('work.filter.search')}
                    />
                </label>
                <Select value={projectFilter} onChange={(value) => setProjectFilter(String(value))} options={projectOptions} className="work-toolbar__select" />
                <Select value={priorityFilter} onChange={(value) => setPriorityFilter(String(value))} options={priorityOptions} className="work-toolbar__select" />
                <button
                    type="button"
                    className={`work-chip ${showCompleted ? 'is-active' : ''}`}
                    aria-pressed={showCompleted}
                    onClick={() => setShowCompleted((value) => !value)}
                >
                    <span className="material-symbols-outlined" aria-hidden="true">done_all</span>
                    {t('work.filter.showCompleted')}
                </button>
                <div className="work-toolbar__views" role="group" aria-label={t('work.view.label')}>
                    {(['list', 'board'] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            className={`work-toolbar__view ${view === option ? 'is-active' : ''}`}
                            aria-pressed={view === option}
                            aria-label={t(`work.view.${option}`)}
                            title={t(`work.view.${option}`)}
                            onClick={() => setView(option)}
                        >
                            <span className="material-symbols-outlined">{option === 'list' ? 'view_agenda' : 'view_kanban'}</span>
                        </button>
                    ))}
                </div>
            </div>

            {view === 'list' ? (
                <TaskGroupList
                    groups={groups}
                    storageKey="projectflow.work.my.collapsed"
                    toggleLabel={(label, collapsed) => t(collapsed ? 'work.group.expand' : 'work.group.collapse').replace('{group}', label)}
                    renderRow={(task) => (
                        <TaskRow
                            task={task}
                            members={members}
                            projectTitle={projectTitleById[task.projectId]}
                            subtasks={subtaskStats[task.id]}
                            canEdit
                            saving={savingId === task.id}
                            onToggleComplete={handleToggle}
                            onUpdate={handleUpdate}
                            onOpen={openTask}
                        />
                    )}
                    empty={(
                        <div className="work-empty">
                            <span className="material-symbols-outlined" aria-hidden="true">{hasFilters ? 'filter_alt_off' : 'task_alt'}</span>
                            <p className="work-empty__title">{t(hasFilters ? 'work.empty.filteredTitle' : 'work.empty.title')}</p>
                            <p className="work-empty__text">{t(hasFilters ? 'work.empty.filteredText' : 'work.empty.text')}</p>
                        </div>
                    )}
                />
            ) : (
                <ProjectBoard
                    tasks={visibleTasks}
                    renderTask={(task) => (
                        <button type="button" className="work-board-card" onClick={() => openTask(task)}>
                            <span className="work-board-card__title">{task.title}</span>
                            <span className="work-board-card__meta">{projectTitleById[task.projectId]}</span>
                        </button>
                    )}
                    stickyOffset="0px"
                />
            )}

            {showCreateModal && (
                <Suspense fallback={null}>
                    <TaskCreateModal
                        projectId={projectFilter !== 'all' ? projectFilter : quickProjectId || (activeProjects[0]?.id || '')}
                        onClose={() => setShowCreateModal(false)}
                        onCreated={async () => {
                            await refreshTasks();
                            setShowCreateModal(false);
                        }}
                    />
                </Suspense>
            )}
        </div>
    );
};
