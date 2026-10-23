import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { subscribeProjectInitiatives, subscribeProjectTasks } from '../services/dataService';
import { addTask, deleteTask, getSubTasks, toggleTaskStatus, updateTaskFields } from '../services/domain/tasksService';
import { getProjectById } from '../services/domain/projectsService';
import { Initiative, Task, Project } from '../types';
import { Button } from '../components/common/Button/Button';
import { InitiativeCreateModal } from '../components/InitiativeCreateModal';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
import { useConfirm } from '../context/UIContext';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { parseDateValue } from '../utils/taskDates';
import { auth } from '../services/firebase';
import { TaskGroupList } from '../components/work/TaskGroupList';
import { TaskRow } from '../components/work/TaskRow';
import { groupTasks, summarizeDue, type WorkGroupBy } from '../components/work/workList';
import { useWorkMembers } from '../components/work/useWorkMembers';
import { useWorkSelection } from '../components/work/useWorkSelection';
import { WorkBulkBar } from '../components/work/WorkBulkBar';
import type { InlineMenuOption } from '../components/work/InlineMenu';
import { WorkMenuChip } from '../components/work/WorkMenuChip';
import { UNASSIGNED_VALUE } from '../components/work/workMenuOptions';
import { useAiScreenContext } from '../context/AiPanelContext';

const TaskCreateModal = lazy(() => import('../components/TaskCreateModal').then((module) => ({ default: module.TaskCreateModal })));


const GROUP_BY_ICONS: Record<WorkGroupBy, string> = { due: 'event', status: 'radio_button_checked', assignee: 'person' };

export const ProjectTasks = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInitiativeModal, setShowInitiativeModal] = useState(false);
    const [subtaskStats, setSubtaskStats] = useState<Record<string, { done: number; total: number }>>({});
    const [view, setView] = useState<'list' | 'grid'>('list');
    const [sortBy] = useState<'priority' | 'dueDate' | 'title' | 'createdAt'>('dueDate');
    const [savingInlineTaskId, setSavingInlineTaskId] = useState<string | null>(null);
    const [bulkUpdating, setBulkUpdating] = useState(false);
    const [groupBy, setGroupBy] = useState<WorkGroupBy>(() => {
        const stored = localStorage.getItem('projectflow.work.project.groupBy');
        return stored === 'status' || stored === 'assignee' ? stored : 'due';
    });
    const [quickTitle, setQuickTitle] = useState('');
    const [quickAdding, setQuickAdding] = useState(false);
    const quickInputRef = useRef<HTMLInputElement>(null);
    const location = useLocation();
    const confirm = useConfirm();

    // Permissions
    const { can } = useProjectPermissions(project);
    const members = useWorkMembers(project?.tenantId);
    const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
    const selection = useWorkSelection({ enabled: can('canManageTasks'), availableIds: taskIds });
    const { selectedIds, isSelecting, selectionMode, setSelectionMode, setMany, clear: clearSelection } = selection;
    const toggleSelect = (taskId: string, options?: { range?: boolean }) => selection.toggle(taskId, options);
    const { t } = useLanguage();

    useEffect(() => {
        if (!id) return;
        setLoading(true);

        let unsub: (() => void) | undefined;

        // Fetch project metadata first to get tenantId
        getProjectById(id).then((p) => {
            setProject(p);
            if (!p) {
                setLoading(false);
                return;
            }

            // Subscribe to tasks with the correct tenantId
            unsub = subscribeProjectTasks(id, (taskData) => {
                setTasks(taskData);
                setLoading(false);
            }, p.tenantId);
            const unsubInitiatives = subscribeProjectInitiatives(id, setInitiatives, p.tenantId);

            // Chain unsubscribe
            const oldUnsub = unsub;
            unsub = () => {
                if (oldUnsub) oldUnsub();
                unsubInitiatives();
            };
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });

        return () => {
            if (unsub) unsub();
        };
    }, [id]);

    useEffect(() => {
        const loadSubtaskStats = async () => {
            if (!tasks.length) return;
            try {
                const entries = await Promise.all(tasks.map(async (t) => {
                    const subs = await getSubTasks(t.id, id, t.tenantId || project?.tenantId);
                    const done = subs.filter(s => s.isCompleted).length;
                    return [t.id, { done, total: subs.length }] as const;
                }));
                setSubtaskStats(Object.fromEntries(entries));
            } catch (err) {
                console.warn(err);
            }
        };
        loadSubtaskStats();
    }, [id, project?.tenantId, tasks]);

    useEffect(() => {
        if (new URLSearchParams(location.search).get('newTask') === '1') {
            // Only show if user can manage tasks, but we need to wait for project/permissions to load.
            // Ideally we'd check can('canManageTasks') here but it might be premature. 
            // We'll let the user try but hide the modal content or close it if permission denied?
            // Better: update the state only if permitted.
            setShowCreateModal(true);
        }
    }, [location.search]);

    const handleToggle = async (task: Task) => {
        if (!can('canManageTasks')) return;
        const currentStatus = task.isCompleted;
        // Optimistic
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, isCompleted: !currentStatus } : t));
        await toggleTaskStatus(task.id, currentStatus, id, task.tenantId || project?.tenantId);
    };

    const updateTaskInline = async (task: Task, updates: Partial<Task>) => {
        if (!id || !can('canManageTasks')) return;

        const previousTask = { ...task };
        setSavingInlineTaskId(task.id);
        setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, ...updates } : item)));

        try {
            await updateTaskFields(task.id, updates, id, project?.tenantId);
        } catch (err) {
            console.error(err);
            setTasks((prev) => prev.map((item) => (item.id === task.id ? previousTask : item)));
            setError(t('projectTasks.error.inlineUpdate'));
        } finally {
            setSavingInlineTaskId((current) => (current === task.id ? null : current));
        }
    };

    const handleQuickAdd = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!id || !quickTitle.trim() || quickAdding || !can('canManageTasks')) return;
        setQuickAdding(true);
        try {
            await addTask(id, quickTitle.trim(), undefined, undefined, 'Medium', undefined, project?.tenantId);
            setQuickTitle('');
        } catch (err) {
            console.error(err);
            setError(t('work.quickAdd.error'));
        } finally {
            setQuickAdding(false);
        }
    };

    // "N" focuses quick add from anywhere on the page.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
            if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey || typing) return;
            event.preventDefault();
            quickInputRef.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const changeGroupBy = (next: WorkGroupBy) => {
        setGroupBy(next);
        localStorage.setItem('projectflow.work.project.groupBy', next);
    };

    const priorityMap: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

    const bulkInitiativeOptions = useMemo<InlineMenuOption[]>(
        () => [
            { value: '__none__', label: t('projectTasks.pill.initiativeNone') },
            ...initiatives.map((initiative) => ({ value: initiative.id, label: initiative.title }))
        ],
        [initiatives, t]
    );

    const initiativeLookup = useMemo(
        () => Object.fromEntries(initiatives.map((initiative) => [initiative.id, initiative])),
        [initiatives]
    );

    const filteredTasks = useMemo(() => {
        const filtered = tasks.filter(t => {
            if (filter === 'active' && t.isCompleted) return false;
            if (filter === 'completed' && !t.isCompleted) return false;
            if (search) {
                const normalizedSearch = search.toLowerCase();
                const initiativeTitle = t.initiativeId ? initiativeLookup[t.initiativeId]?.title || '' : '';
                const categories = Array.isArray(t.category) ? t.category : [t.category].filter(Boolean);
                const haystack = [
                    t.title,
                    t.description || '',
                    t.status || '',
                    t.priority || '',
                    initiativeTitle,
                    ...categories
                ].join(' ').toLowerCase();
                if (!haystack.includes(normalizedSearch)) return false;
            }
            return true;
        });

        // Apply sorting
        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'priority': {
                    const pA = priorityMap[a.priority || 'Medium'] || 0;
                    const pB = priorityMap[b.priority || 'Medium'] || 0;
                    if (pA !== pB) return pB - pA; // Descending (Urgent first)
                    // Secondary sort by due date
                    const dateA = a.dueDate ? parseDateValue(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    const dateB = b.dueDate ? parseDateValue(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    return dateA - dateB;
                }
                case 'dueDate': {
                    const dateA = a.dueDate ? parseDateValue(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    const dateB = b.dueDate ? parseDateValue(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                    return dateA - dateB; // Ascending (soonest first)
                }
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'createdAt': {
                    const createdA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
                    const createdB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
                    return createdB - createdA; // Descending (newest first)
                }
                default:
                    return 0;
            }
        });
    }, [tasks, filter, search, sortBy, initiativeLookup]);

    const visibleTaskIds = filteredTasks.map((task) => task.id);
    const selectedTasks = tasks.filter((task) => selectedIds.has(task.id));
    const selectedVisibleCount = visibleTaskIds.filter((taskId) => selectedIds.has(taskId)).length;

    // In-app AI (⌘J): what is on screen and what is selected.
    useAiScreenContext({
        surface: 'list',
        view: { items: filteredTasks.slice(0, 50).map((task) => ({ id: task.id, title: task.title })) },
        selection: selectedIds.size ? { ids: Array.from(selectedIds).slice(0, 50) } : undefined
    });
    const allVisibleSelected = visibleTaskIds.length > 0 && selectedVisibleCount === visibleTaskIds.length;

    const toggleSelectAllVisible = () => setMany(visibleTaskIds, !allVisibleSelected);

    const applyBulkUpdate = async (updatesForTask: (task: Task) => Partial<Task>) => {
        if (!id || !selectedTasks.length || !can('canManageTasks')) return;
        const previousTasks = tasks;
        const selectedTaskIds = new Set(selectedTasks.map((task) => task.id));
        setBulkUpdating(true);
        setTasks((current) => current.map((task) => (
            selectedTaskIds.has(task.id) ? { ...task, ...updatesForTask(task) } : task
        )));

        try {
            await Promise.all(selectedTasks.map((task) => (
                updateTaskFields(task.id, updatesForTask(task), id, task.tenantId || project?.tenantId)
            )));
        } catch (e) {
            console.error(e);
            setTasks(previousTasks);
            setError(t('projectTasks.error.bulkUpdate'));
        } finally {
            setBulkUpdating(false);
        }
    };

    const handleBulkStatusChange = (value: string) => {
        const status = value as Task['status'];
        void applyBulkUpdate(() => ({ status, isCompleted: status === 'Done' }));
    };

    const handleBulkPriorityChange = (value: string) => {
        const priority = value as Task['priority'];
        void applyBulkUpdate(() => ({ priority }));
    };

    const handleBulkDueChange = (dueDate: string) => {
        void applyBulkUpdate(() => ({ dueDate }));
    };

    const handleBulkAssigneeChange = (uid: string) => {
        void applyBulkUpdate(() => (
            uid === UNASSIGNED_VALUE ? { assigneeId: '', assigneeIds: [] } : { assigneeId: uid, assigneeIds: [uid] }
        ));
    };

    const handleBulkInitiativeChange = (value: string) => {
        const initiativeId = value === '__none__' ? '' : String(value);
        void applyBulkUpdate((task) => (
            task.legacyInitiativeRoot ? {} : { initiativeId }
        ));
    };

    const handleBulkDelete = async () => {
        if (!selectedIds.size) return;
        if (!can('canManageTasks')) return;
        if (!await confirm({
            title: t('projectTasks.confirm.bulkDelete.title'),
            message: t('projectTasks.confirm.bulkDelete.body').replace('{count}', String(selectedIds.size)),
            confirmText: t('common.delete'),
            variant: 'danger'
        })) return;
        try {
            await Promise.all(Array.from(selectedIds).map((taskId: string) => {
                const task = tasks.find((item) => item.id === taskId);
                return deleteTask(taskId, id, task?.tenantId || project?.tenantId);
            }));
            clearSelection();
        } catch (e) {
            console.error(e);
            setError(t('projectTasks.error.bulkDelete'));
        }
    };

    const onboardingSteps = useMemo<OnboardingStep[]>(() => ([
        {
            id: 'header',
            targetId: 'project-tasks-header',
            title: t('projectTasks.onboarding.header.title'),
            description: t('projectTasks.onboarding.header.description')
        },
        {
            id: 'stats',
            targetId: 'project-tasks-stats',
            title: t('projectTasks.onboarding.stats.title'),
            description: t('projectTasks.onboarding.stats.description'),
            placement: 'top'
        },
        {
            id: 'controls',
            targetId: 'project-tasks-controls',
            title: t('projectTasks.onboarding.controls.title'),
            description: t('projectTasks.onboarding.controls.description'),
            placement: 'top'
        },
        {
            id: 'tasks',
            targetId: 'project-tasks-view',
            title: t('projectTasks.onboarding.tasks.title'),
            description: t('projectTasks.onboarding.tasks.description')
        }
    ]), [t]);

    const {
        onboardingActive,
        stepIndex,
        setStepIndex,
        skip,
        finish
    } = useOnboardingTour('project_tasks', { stepCount: onboardingSteps.length, autoStart: true, enabled: !loading });

    const groups = useMemo(
        () => groupTasks(filteredTasks, { groupBy, t, members, currentUserId: auth.currentUser?.uid }),
        [filteredTasks, groupBy, t, members]
    );
    const dueSummary = useMemo(() => summarizeDue(tasks), [tasks]);
    const summaryParts = [
        dueSummary.overdue ? { tone: 'danger', text: t('work.summary.overdue').replace('{count}', String(dueSummary.overdue)) } : null,
        dueSummary.today ? { tone: 'warning', text: t('work.summary.today').replace('{count}', String(dueSummary.today)) } : null,
        dueSummary.week ? { tone: 'neutral', text: t('work.summary.week').replace('{count}', String(dueSummary.week)) } : null
    ].filter(Boolean) as { tone: string; text: string }[];

    if (loading) return (
        <div className="workstream-page workstream-page--tasks">
            <div className="workstream-page__loading">
                <span className="material-symbols-outlined workstream-page__loading-icon">progress_activity</span>
            </div>
        </div>
    );

    return (
        <>
            <div className="work-page work-page--project">

                <header data-onboarding-id="project-tasks-header" className="work-page__header">
                    <div>
                        {project?.title && <p className="work-page__eyebrow">{project.title}</p>}
                        <h1 className="work-page__title">{t('work.project.title')}</h1>
                        <p className="work-page__summary">
                            {summaryParts.length ? summaryParts.map((part, index) => (
                                <React.Fragment key={part.text}>
                                    {index > 0 && <span className="work-page__dot" aria-hidden="true">·</span>}
                                    <span className={`work-page__summary-item work-page__summary-item--${part.tone}`}>{part.text}</span>
                                </React.Fragment>
                            )) : t('work.summary.clear')}
                        </p>
                    </div>
                    {can('canManageTasks') && (
                        <div className="workstream-page__actions">
                            <Button
                                onClick={() => setShowInitiativeModal(true)}
                                icon={<span className="material-symbols-outlined">rocket_launch</span>}
                                variant="ghost"
                            >
                                {t('initiatives.create.action')}
                            </Button>
                            <Button
                                onClick={() => setShowCreateModal(true)}
                                icon={<span className="material-symbols-outlined">edit_note</span>}
                                variant="secondary"
                            >
                                {t('work.newDetailed')}
                            </Button>
                        </div>
                    )}
                </header>

                {can('canManageTasks') && (
                    <form className="work-quick-add" onSubmit={handleQuickAdd}>
                        <span className="material-symbols-outlined work-quick-add__icon" aria-hidden="true">add</span>
                        <input
                            ref={quickInputRef}
                            className="work-quick-add__input"
                            value={quickTitle}
                            onChange={(event) => setQuickTitle(event.target.value)}
                            placeholder={t('work.quickAdd.placeholder')}
                            aria-label={t('work.quickAdd.label')}
                        />
                        <kbd className="work-quick-add__hint" aria-hidden="true">N</kbd>
                        <Button type="submit" size="sm" isLoading={quickAdding} disabled={!quickTitle.trim()}>
                            {t('work.quickAdd.submit')}
                        </Button>
                    </form>
                )}

                <div data-onboarding-id="project-tasks-controls" className="work-toolbar">
                    <label className="work-toolbar__search">
                        <span className="material-symbols-outlined" aria-hidden="true">search</span>
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t('work.filter.search')}
                            aria-label={t('work.filter.search')}
                        />
                    </label>
                    <WorkMenuChip
                        label={`${t('work.filter.groupBy')}: ${t(`work.groupBy.${groupBy}`)}`}
                        icon={GROUP_BY_ICONS[groupBy]}
                        prefix={t('work.filter.groupBy')}
                        valueLabel={t(`work.groupBy.${groupBy}`)}
                        options={(['due', 'status', 'assignee'] as const).map((option) => ({
                            value: option,
                            label: t(`work.groupBy.${option}`),
                            leading: <span className="material-symbols-outlined">{GROUP_BY_ICONS[option]}</span>
                        }))}
                        value={groupBy}
                        onSelect={(value) => changeGroupBy(value as WorkGroupBy)}
                        width={200}
                    />
                    <button
                        type="button"
                        className={`work-chip ${filter !== 'active' ? 'is-active' : ''}`}
                        aria-pressed={filter !== 'active'}
                        onClick={() => setFilter((current) => (current === 'active' ? 'all' : 'active'))}
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">done_all</span>
                        {t('work.filter.showCompleted')}
                    </button>
                    {can('canManageTasks') && (
                        <button
                            type="button"
                            className={`work-chip ${isSelecting ? 'is-active' : ''}`}
                            aria-pressed={isSelecting}
                            onClick={() => (isSelecting ? clearSelection() : setSelectionMode(true))}
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">{isSelecting ? 'close' : 'check_box'}</span>
                            {t(isSelecting ? 'work.bulk.done' : 'work.bulk.select')}
                        </button>
                    )}
                    <div className="work-toolbar__views" role="group" aria-label={t('work.view.label')}>
                        {(['list', 'grid'] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setView(option)}
                                className={`work-toolbar__view ${view === option ? 'is-active' : ''}`}
                                aria-pressed={view === option}
                                title={t(`work.view.${option}`)}
                                aria-label={t(`work.view.${option}`)}
                            >
                                <span className="material-symbols-outlined">{option === 'list' ? 'view_agenda' : 'grid_view'}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div data-onboarding-id="project-tasks-view" className="work-page__body" ref={selection.listRef}>
                    <TaskGroupList
                        groups={groups}
                        layout={view}
                        storageKey={`projectflow.work.project.${groupBy}.collapsed`}
                        toggleLabel={(label, collapsed) => t(collapsed ? 'work.group.expand' : 'work.group.collapse').replace('{group}', label)}
                        selection={can('canManageTasks') ? {
                            active: isSelecting,
                            isSelected: (task) => selectedIds.has(task.id),
                            onToggleGroup: (groupTasks, selected) => setMany(groupTasks.map((task) => task.id), selected),
                            label: (group) => t('work.bulk.selectGroup').replace('{group}', group)
                        } : undefined}
                        renderRow={(task) => (
                            <TaskRow
                                task={task}
                                variant={view === 'grid' ? 'card' : 'row'}
                                members={members}
                                initiativeTitle={task.initiativeId ? initiativeLookup[task.initiativeId]?.title : undefined}
                                subtasks={subtaskStats[task.id]}
                                canEdit={can('canManageTasks')}
                                saving={savingInlineTaskId === task.id}
                                selectable={can('canManageTasks')}
                                selected={selectedIds.has(task.id)}
                                selectOnClick={selectionMode}
                                onSelectChange={(entry, options) => toggleSelect(entry.id, options)}
                                onToggleComplete={handleToggle}
                                onUpdate={updateTaskInline}
                                onOpen={(entry) => navigate(`/project/${id}/tasks/${entry.id}`)}
                            />
                            )}
                            empty={(
                                <div className="work-empty">
                                    <span className="material-symbols-outlined" aria-hidden="true">{search ? 'filter_alt_off' : 'task_alt'}</span>
                                    <p className="work-empty__title">{t(search ? 'work.empty.filteredTitle' : 'projectTasks.empty.title')}</p>
                                    <p className="work-empty__text">{t(search ? 'work.empty.filteredText' : 'projectTasks.empty.description')}</p>
                                </div>
                            )}
                        />
                </div>

                {isSelecting && (
                    <WorkBulkBar
                        count={selectedIds.size}
                        busy={bulkUpdating}
                        members={members}
                        allVisibleSelected={allVisibleSelected}
                        onToggleAllVisible={toggleSelectAllVisible}
                        onStatus={handleBulkStatusChange}
                        onPriority={handleBulkPriorityChange}
                        onDue={handleBulkDueChange}
                        onAssignee={handleBulkAssigneeChange}
                        initiativeOptions={bulkInitiativeOptions.length > 1 ? bulkInitiativeOptions : undefined}
                        onInitiative={handleBulkInitiativeChange}
                        onDelete={handleBulkDelete}
                        onClose={clearSelection}
                    />
                )}

                {/* Check permission before showing modal */}
                {showCreateModal && id && can('canManageTasks') && (
                    <Suspense fallback={null}>
                        <TaskCreateModal
                            projectId={id}
                            onClose={() => setShowCreateModal(false)}
                            onCreated={(updated) => {
                                setTasks(updated);
                                setShowCreateModal(false);
                            }}
                        />
                    </Suspense>
                )}

                {showInitiativeModal && id && can('canManageTasks') && (
                    <InitiativeCreateModal
                        isOpen={showInitiativeModal}
                        projectId={id}
                        tenantId={project?.tenantId}
                        onClose={() => setShowInitiativeModal(false)}
                        onCreated={(initiativeId) => {
                            setShowInitiativeModal(false);
                            navigate(`/project/${id}/initiatives/${initiativeId}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`);
                        }}
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
