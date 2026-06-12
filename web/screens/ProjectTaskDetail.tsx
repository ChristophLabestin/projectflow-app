import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import '../src/styles/components/_project-task-detail.scss';
import { getProjectCategories, subscribeProjectMilestones, updateMilestone } from '../services/domain/projectMetaService';
import { getProjectById, getProjectMembers } from '../services/domain/projectsService';
import { addSubTask, deleteSubTask, deleteTask, getProjectTasks, getSubTasks, getTaskById, subscribeTaskActivity, toggleSubTaskStatus, toggleTaskStatus, updateSubtaskFields, updateTaskFields } from '../services/domain/tasksService';
import { subscribeTenantUsers } from '../services/domain/workspaceMembersService';
import { deleteField } from 'firebase/firestore';
import { SubTask, Task, Member, Project, Activity, Milestone, TaskCategory } from '../types';
import { CommentSection } from '../components/CommentSection';
import { Button } from '../components/common/Button/Button';
import { TextInput } from '../components/common/Input/TextInput';
import { TextArea } from '../components/common/Input/TextArea';
import { EditTaskModal } from '../components/EditTaskModal';
import { MultiAssigneeSelector } from '../components/MultiAssigneeSelector';
import { TaskRelationshipsPanel } from '../components/TaskRelationshipsPanel';
import { ProjectLabelsModal } from '../components/ProjectLabelsModal';
import { toMillis, timeAgo } from '../utils/time';
import { activityIcon } from '../utils/activityHelpers';
import { auth } from '../services/firebase';
import { DatePicker } from '../components/common/DateTime/DatePicker';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';
import { ConfirmModal } from '../components/common/Modal/ConfirmModal';
import { getInitiativeById } from '../services/dataService';
import { AdvancedEditorRuntime } from '../components/editor/AdvancedEditorRuntime';

const TaskCreateModal = lazy(() => import('../components/TaskCreateModal').then((module) => ({ default: module.TaskCreateModal })));

const TASK_STATUS_OPTIONS = ['Backlog', 'Open', 'In Progress', 'On Hold', 'Review', 'Blocked', 'Done'] as const;

const safeDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

const getTaskStatusStyle = (status: string) => {
    const map: Record<string, string> = {
        Backlog: 'task-detail__status--backlog',
        Open: 'task-detail__status--open',
        Todo: 'task-detail__status--open',
        'In Progress': 'task-detail__status--in-progress',
        Review: 'task-detail__status--review',
        Done: 'task-detail__status--done',
        Completed: 'task-detail__status--done',
        Blocked: 'task-detail__status--blocked',
        Canceled: 'task-detail__status--blocked',
    };
    return map[status] || 'task-detail__status--backlog';
};

const getTaskStatusIcon = (status: string) => {
    const map: Record<string, string> = {
        Backlog: 'inbox',
        Open: 'circle',
        Todo: 'circle',
        'In Progress': 'timelapse',
        'On Hold': 'pause_circle',
        Review: 'preview',
        Blocked: 'block',
        Done: 'check_circle',
    };
    return map[status] || 'circle';
};

export const ProjectTaskDetail = () => {
    const { id, taskId } = useParams<{ id: string; taskId: string }>();
    const [searchParams] = useSearchParams();
    const tenantId = searchParams.get('tenant') || undefined;
    const navigate = useNavigate();
    const { dateFormat, dateLocale, t } = useLanguage();
    const [task, setTask] = useState<Task | null>(null);
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [initiative, setInitiative] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [newSubTitle, setNewSubTitle] = useState('');
    const [savingStatus, setSavingStatus] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [members, setMembers] = useState<string[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [subTaskToDelete, setSubTaskToDelete] = useState<string | null>(null);
    const [deletingSubTask, setDeletingSubTask] = useState(false);
    const [allUsers, setAllUsers] = useState<Member[]>([]);
    const [activeSubAssignMenu, setActiveSubAssignMenu] = useState<string | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [commentCount, setCommentCount] = useState(0);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showLabelsModal, setShowLabelsModal] = useState(false);
    const [allCategories, setAllCategories] = useState<TaskCategory[]>([]);
    const [copiedId, setCopiedId] = useState(false);
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
    const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [activeMilestoneMenu, setActiveMilestoneMenu] = useState(false);
    const [nextStepDraft, setNextStepDraft] = useState('');
    const [blockerNoteDraft, setBlockerNoteDraft] = useState('');
    const [quickLogDraft, setQuickLogDraft] = useState('');
    const [savingWorkbenchField, setSavingWorkbenchField] = useState<string | null>(null);
    const statusMenuRef = useRef<HTMLDivElement | null>(null);
    const priorityMenuRef = useRef<HTMLDivElement | null>(null);
    const { pinItem, unpinItem, isPinned, focusItemId, focusState, startFocusItem, snoozeFocusItem, blockFocusItem, completeFocusItem } = usePinnedTasks();

    const buildPinnedTaskItem = () => {
        if (!task || !id) return null;
        return {
            id: task.id,
            type: 'task' as const,
            title: task.title,
            projectId: id,
            tenantId: task.tenantId,
            priority: task.priority,
            isCompleted: task.isCompleted
        };
    };

    const handleStartTaskFocus = () => {
        const pinnedTask = buildPinnedTaskItem();
        if (!pinnedTask) return;
        startFocusItem(pinnedTask);
    };

    const handleTogglePinnedTask = () => {
        const pinnedTask = buildPinnedTaskItem();
        if (!pinnedTask) return;

        if (isPinned(pinnedTask.id)) {
            unpinItem(pinnedTask.id);
            return;
        }

        pinItem(pinnedTask);
    };

    const statusLabels = useMemo(() => ({
        Backlog: t('tasks.status.backlog'),
        Open: t('tasks.status.open'),
        Todo: t('tasks.status.todo'),
        'In Progress': t('tasks.status.inProgress'),
        'On Hold': t('tasks.status.onHold'),
        Review: t('tasks.status.review'),
        Blocked: t('tasks.status.blocked'),
        Done: t('tasks.status.done'),
    }), [t]);

    const priorityLabels = useMemo(() => ({
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low'),
    }), [t]);

    const isProjectOwner = useMemo(() => {
        return project?.ownerId === auth.currentUser?.uid;
    }, [project?.ownerId]);

    const displayedActivities = useMemo(() => {
        return activities.reduce((acc: Activity[], current) => {
            if (acc.length === 0) return [current];

            const last = acc[acc.length - 1];
            const timeDiff = toMillis(last.createdAt) - toMillis(current.createdAt);
            const isSameUser = last.user === current.user;
            const isSameAction = last.action === current.action;
            const isSameType = last.type === current.type;
            const isCloseInTime = Math.abs(timeDiff) < 5 * 60 * 1000;

            if (isSameUser && isSameAction && isSameType && isCloseInTime) {
                return acc;
            }

            return [...acc, current];
        }, []);
    }, [activities]);

    const doneCount = subTasks.filter(s => s.isCompleted).length;
    const totalCount = subTasks.length;
    const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

    const taskAssignees = useMemo(() => {
        if (!task) return [];
        const ids: string[] = [];
        if (task.assigneeIds && task.assigneeIds.length > 0) {
            ids.push(...task.assigneeIds);
        }
        if (task.assigneeId && !ids.includes(task.assigneeId)) {
            ids.push(task.assigneeId);
        }
        return ids;
    }, [task]);

    const activeTenantId = task?.tenantId || project?.tenantId || tenantId;

    const loadData = async () => {
        if (!taskId) return;
        setLoading(true);
        setTask(null);
        setSubTasks([]);
        setProject(null);
        setMembers([]);
        setError(null);
        try {
            const loadedProject = id ? await getProjectById(id, tenantId) : null;
            const resolvedTenantId = loadedProject?.tenantId || tenantId;
            setProject(loadedProject);

            let loadedTask = await getTaskById(taskId, id, resolvedTenantId);
            if (!loadedTask && id) {
                const projectTasks = await getProjectTasks(id, resolvedTenantId);
                loadedTask = projectTasks.find((candidate) => candidate.id === taskId) || null;
            }
            if (loadedTask?.legacyInitiativeRoot && loadedTask.initiativeId && id) {
                navigate(`/project/${id}/initiatives/${loadedTask.initiativeId}${resolvedTenantId ? `?tenant=${resolvedTenantId}` : ''}`, { replace: true });
                return;
            }
            setTask(loadedTask);

            const taskTenantId = loadedTask?.tenantId || resolvedTenantId;

            if (loadedTask?.initiativeId && id) {
                getInitiativeById(loadedTask.initiativeId, id, taskTenantId).then(setInitiative).catch(e => console.error('Failed to load initiative', e));
            } else {
                setInitiative(null);
            }

            const subs = await getSubTasks(taskId, id, taskTenantId);
            setSubTasks(subs);

            if (id) {
                const projectMembers = await getProjectMembers(id, taskTenantId);
                setMembers(projectMembers);
            }
        } catch (err) {
            console.error('Failed to load task', err);
            setError('Failed to load task details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [taskId, id, tenantId, navigate]);

    useEffect(() => {
        if (!task) return;
        setNextStepDraft(task.nextStep || '');
        setBlockerNoteDraft(task.blockerNote || '');
        setQuickLogDraft(task.lastWorkbenchNote || '');
    }, [task?.id, task?.nextStep, task?.blockerNote, task?.lastWorkbenchNote]);

    useEffect(() => {
        if (!statusMenuOpen && !priorityMenuOpen) return;
        const handleClick = (event: MouseEvent) => {
            if (statusMenuOpen && !statusMenuRef.current?.contains(event.target as Node)) {
                setStatusMenuOpen(false);
            }
            if (priorityMenuOpen && !priorityMenuRef.current?.contains(event.target as Node)) {
                setPriorityMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [statusMenuOpen, priorityMenuOpen]);

    useEffect(() => {
        if (!task?.tenantId) return;

        const unsubUsers = subscribeTenantUsers((users) => {
            setAllUsers(users as Member[]);
        }, task.tenantId);

        return () => {
            unsubUsers();
        };
    }, [task?.tenantId]);

    useEffect(() => {
        if (!taskId || !id || !activeTenantId) return;
        const unsub = subscribeTaskActivity(id, taskId, (data) => {
            setActivities(data);
        }, activeTenantId);

        const unsubMilestones = subscribeProjectMilestones(id, (data) => {
            setMilestones(data);
        }, activeTenantId);

        return () => {
            unsub();
            unsubMilestones();
        };
    }, [taskId, id, activeTenantId]);

    useEffect(() => {
        if (!id) return;
        getProjectCategories(id, activeTenantId).then(setAllCategories).catch(console.error);
    }, [activeTenantId, id]);

    const refreshSubs = async () => {
        if (!taskId) return;
        const subs = await getSubTasks(taskId, id, activeTenantId);
        setSubTasks(subs);
    };

    const handleAddSubTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!taskId || !newSubTitle.trim()) return;
        setAdding(true);
        try {
            await addSubTask(taskId, newSubTitle.trim(), id, activeTenantId);
            setNewSubTitle('');
            await refreshSubs();
        } catch (err) {
            console.error('Failed to add subtask', err);
            setError('Failed to add subtask. Please try again.');
        } finally {
            setAdding(false);
        }
    };

    const handleToggleSubTask = async (subId: string, currentStatus: boolean) => {
        setSubTasks(prev => prev.map(s => s.id === subId ? { ...s, isCompleted: !currentStatus } : s));
        await toggleSubTaskStatus(subId, currentStatus, taskId, id, activeTenantId);
    };

    const handleDeleteSubTask = (subId: string) => {
        setError(null);
        setActiveSubAssignMenu(null);
        setActiveMilestoneMenu(false);
        setSubTaskToDelete(subId);
    };

    const confirmDeleteSubTask = async () => {
        if (!subTaskToDelete || !task) return;
        setDeletingSubTask(true);
        setError(null);
        try {
            await deleteSubTask(subTaskToDelete, task.id, id, activeTenantId);
            setSubTaskToDelete(null);
            void loadData();
        } catch (err) {
            console.error('Failed to delete subtask', err);
            setError(t('taskDetail.subtasks.deleteError'));
        } finally {
            setDeletingSubTask(false);
        }
    };

    const handleUpdateSubTaskAssignee = async (subId: string, userId: string | null) => {
        setSubTasks(prev => prev.map(s => s.id === subId ? { ...s, assigneeId: userId || undefined } : s));
        try {
            await updateSubtaskFields(subId, { assigneeId: userId || deleteField() }, taskId, id, activeTenantId);
        } catch (err) {
            console.error('Failed to update subtask assignee', err);
        }
        setActiveSubAssignMenu(null);
    };

    const handleToggleTask = async () => {
        if (!task) return;
        setSavingStatus(true);
        const newStatus = !task.isCompleted;
        setTask({ ...task, isCompleted: newStatus, status: newStatus ? 'Done' : 'In Progress' });
        try {
            await toggleTaskStatus(task.id, task.isCompleted, id, activeTenantId);
            await updateTaskFields(task.id, { status: newStatus ? 'Done' : 'In Progress' }, id, activeTenantId);
            if (newStatus) {
                completeFocusItem(task.id);
            }
        } finally {
            setSavingStatus(false);
        }
    };

    const handleDeleteTask = async () => {
        if (!task || !taskId) return;
        setDeleting(true);
        try {
            await deleteTask(taskId, id, activeTenantId);
            navigate(`/project/${id}/tasks`);
        } catch (err) {
            console.error('Failed to delete task', err);
            setError('Failed to delete task.');
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleUpdateField = async (field: keyof Task, value: any) => {
        if (!task) return;
        let nextValue = value;
        if ((field === 'startDate' || field === 'dueDate' || field === 'reminderAt') && value instanceof Date) {
            nextValue = format(value, 'yyyy-MM-dd');
        } else if ((field === 'startDate' || field === 'dueDate' || field === 'reminderAt') && value === null) {
            nextValue = null;
        }
        setTask({ ...task, [field]: nextValue || undefined });
        await updateTaskFields(task.id, { [field]: nextValue } as Partial<Task>, id, activeTenantId);
    };

    const saveWorkbenchText = async (field: keyof Pick<Task, 'nextStep' | 'blockerNote' | 'lastWorkbenchNote'>, value: string) => {
        if (!task) return;
        setSavingWorkbenchField(field);
        const trimmed = value.trim();
        try {
            setTask(prev => prev ? { ...prev, [field]: trimmed || undefined } : prev);
            await updateTaskFields(task.id, { [field]: trimmed || null } as Partial<Task>, id, activeTenantId);
        } finally {
            setSavingWorkbenchField(null);
        }
    };

    const handleSetBlocked = async () => {
        if (!task) return;
        const note = blockerNoteDraft.trim();
        setTask(prev => prev ? { ...prev, status: 'Blocked', blockerNote: note || prev.blockerNote } : prev);
        await updateTaskFields(task.id, {
            status: 'Blocked',
            isCompleted: false,
            blockerNote: note || task.blockerNote || ''
        }, id, activeTenantId);
        const pinnedTask = buildPinnedTaskItem();
        if (pinnedTask) {
            startFocusItem(pinnedTask);
            blockFocusItem();
        }
    };

    const handleClearBlocked = async () => {
        if (!task) return;
        const nextStatus = task.isCompleted ? 'Done' : 'In Progress';
        setBlockerNoteDraft('');
        setTask(prev => prev ? { ...prev, status: nextStatus, blockerNote: undefined } : prev);
        await updateTaskFields(task.id, {
            status: nextStatus,
            blockerNote: null
        }, id, activeTenantId);
    };

    const handleUpdateAssignees = async (ids: string[]) => {
        if (!task) return;
        const primaryAssignee = ids.length > 0 ? ids[0] : '';
        const updates: Partial<Task> = {
            assigneeIds: ids,
            assigneeId: primaryAssignee,
        };
        setTask(prev => prev ? { ...prev, ...updates } : null);
        await updateTaskFields(task.id, updates, id, activeTenantId);
    };

    const handleUpdateAssignedGroups = async (groupIds: string[]) => {
        if (!task || !id) return;
        setTask(prev => prev ? { ...prev, assignedGroupIds: groupIds } : null);
        await updateTaskFields(task.id, { assignedGroupIds: groupIds }, id, activeTenantId);
    };

    const handleLinkMilestone = async (milestoneId: string) => {
        if (!id || !task) return;
        const milestone = milestones.find(m => m.id === milestoneId);
        if (!milestone) return;

        const currentTasks = milestone.linkedTaskIds || [];
        if (!currentTasks.includes(task.id)) {
            await updateMilestone(id, milestoneId, {
                linkedTaskIds: [...currentTasks, task.id]
            }, activeTenantId);
        }
        setActiveMilestoneMenu(false);
    };

    const handleUnlinkMilestone = async (milestoneId: string) => {
        if (!id || !task) return;
        const milestone = milestones.find(m => m.id === milestoneId);
        if (!milestone) return;

        const currentTasks = milestone.linkedTaskIds || [];
        await updateMilestone(id, milestoneId, {
            linkedTaskIds: currentTasks.filter(tid => tid !== task.id)
        }, activeTenantId);
    };

    const linkedMilestone = useMemo(() => {
        if (!task) return null;
        return milestones.find(m => m.linkedTaskIds?.includes(task.id));
    }, [milestones, task]);

    const { setTaskTitle } = useOutletContext<{ setTaskTitle: (title: string) => void }>();

    useEffect(() => {
        if (task) {
            setTaskTitle(task.title);
        }
    }, [task, setTaskTitle]);

    if (loading) {
        return (
            <div className="task-detail__loading">
                <span className="task-detail__spinner" aria-hidden="true" />
            </div>
        );
    }

    if (!task) {
        return (
            <div className="task-detail__empty">
                <h3 className="task-detail__empty-title">{t('taskDetail.notFound.title')}</h3>
                <Button variant="secondary" onClick={() => navigate(`/project/${id}/tasks`)}>
                    {t('taskDetail.notFound.action')}
                </Button>
            </div>
        );
    }

    const currentStatus = task.status || 'Open';
    const currentStatusLabel = statusLabels[currentStatus as keyof typeof statusLabels] || t('tasks.status.unknown');
    const activeFocus = focusItemId === task.id || focusState?.itemId === task.id;
    const tenantQuery = activeTenantId ? `?tenant=${activeTenantId}` : '';
    const reminderDate = safeDate(task.reminderAt);
    const dueDate = safeDate(task.dueDate);
    const startDate = safeDate(task.startDate);
    const isBlocked = currentStatus === 'Blocked';
    const taskCats = Array.isArray(task.category) ? task.category : [task.category || ''];
    const filteredCats = taskCats.filter(Boolean);

    return (
        <div className="task-detail">
            {isEditModalOpen && task && (
                <EditTaskModal
                    task={task}
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onUpdate={loadData}
                    projectMembers={members}
                />
            )}

            {showLabelsModal && (
                <ProjectLabelsModal
                    isOpen={showLabelsModal}
                    onClose={() => setShowLabelsModal(false)}
                    projectId={id!}
                    onLabelsChange={async () => {
                        const cats = await getProjectCategories(id!, activeTenantId);
                        setAllCategories(cats);
                    }}
                />
            )}

            {showTaskModal && (
                <Suspense fallback={null}>
                    <TaskCreateModal
                        isOpen={showTaskModal}
                        onClose={() => setShowTaskModal(false)}
                        projectId={id!}
                        onSuccess={() => setShowTaskModal(false)}
                    />
                </Suspense>
            )}

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteTask}
                title={t('taskDetail.confirm.delete.title')}
                message={t('taskDetail.confirm.delete.message').replace('{title}', task.title)}
                confirmLabel={t('taskDetail.confirm.delete.confirm')}
                cancelLabel={t('common.cancel')}
                variant="danger"
                isLoading={deleting}
            />

            <ConfirmModal
                isOpen={Boolean(subTaskToDelete)}
                onClose={() => setSubTaskToDelete(null)}
                onConfirm={confirmDeleteSubTask}
                title={t('taskDetail.confirm.deleteSubtask.title')}
                message={t('taskDetail.confirm.deleteSubtask.message')}
                confirmLabel={t('taskDetail.confirm.deleteSubtask.confirm')}
                cancelLabel={t('common.cancel')}
                variant="danger"
                isLoading={deletingSubTask}
            />

            {error && (
                <div className="task-detail__error" role="alert">
                    <span className="material-symbols-outlined">error</span>
                    {error}
                </div>
            )}

            <div className="task-detail__grid">
                <main className="task-detail__main">
                    <header className="task-detail__header">
                        <div className="task-detail__header-top">
                            <div className="task-detail__breadcrumb">
                                {project && (
                                    <Link to={`/project/${project.id}${tenantQuery}`} className="task-detail__breadcrumb-link">
                                        <span className="material-symbols-outlined">west</span>
                                        {project.title}
                                    </Link>
                                )}
                                <span className="task-detail__breadcrumb-current">{t('breadcrumbs.taskDetails')}</span>
                            </div>

                            <div className="task-detail__quick-actions">
                                <button type="button" className="task-detail__icon-button" data-state={activeFocus ? 'focused' : isPinned(task.id) ? 'pinned' : 'default'} onClick={handleTogglePinnedTask} aria-label={t('taskDetail.actions.togglePin')}>
                                    <span className="material-symbols-outlined">push_pin</span>
                                </button>
                                <button type="button" className="task-detail__icon-button" onClick={() => setIsEditModalOpen(true)} aria-label={t('common.edit')}>
                                    <span className="material-symbols-outlined">edit</span>
                                </button>
                                <button type="button" className="task-detail__icon-button task-detail__icon-button--danger" onClick={() => setShowDeleteConfirm(true)} aria-label={t('taskDetail.confirm.delete.confirm')}>
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        </div>

                        <div className="task-detail__title-group">
                            <h1 className="task-detail__title">{task.title}</h1>
                        </div>
                    </header>

                    <div className="task-detail__focus-banner" data-blocked={isBlocked ? 'true' : 'false'}>
                        <div className="task-detail__focus-main">
                            <span className="material-symbols-outlined">{isBlocked ? 'dangerous' : 'center_focus_strong'}</span>
                            <div>
                                <h2>{isBlocked ? t('taskDetail.workbench.blockedTitle') : t('taskDetail.workbench.readyTitle')}</h2>
                                <p>{isBlocked ? (task.blockerNote || t('taskDetail.workbench.blockedEmpty')) : (task.nextStep || t('taskDetail.workbench.nextStepEmpty'))}</p>
                            </div>
                        </div>
                        <div className="task-detail__focus-actions">
                            <Button variant={activeFocus ? 'secondary' : 'primary'} onClick={handleStartTaskFocus} size="sm" icon={<span className="material-symbols-outlined">{activeFocus ? 'center_focus_strong' : 'center_focus_weak'}</span>}>
                                {activeFocus ? t('taskDetail.actions.currentFocus') : t('taskDetail.actions.setFocusTask')}
                            </Button>
                            {isBlocked ? (
                                <Button variant="secondary" onClick={handleClearBlocked} size="sm" icon={<span className="material-symbols-outlined">lock_open</span>}>
                                    {t('taskDetail.workbench.clearBlocker')}
                                </Button>
                            ) : (
                                <Button variant="ghost" onClick={handleSetBlocked} size="sm" icon={<span className="material-symbols-outlined">block</span>}>
                                    {t('taskDetail.workbench.markBlocked')}
                                </Button>
                            )}
                        </div>
                    </div>

                    <section className="task-detail__section">
                        <div className="task-detail__section-header">
                            <h3 className="task-detail__section-title">
                                <span className="material-symbols-outlined">description</span>
                                {t('taskDetail.description.label')}
                            </h3>
                        </div>
                        {task.description ? (
                            <AdvancedEditorRuntime initialContent={task.description} editable={false} />
                        ) : (
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', fontStyle: 'italic', margin: 0, padding: '12px 0' }}>
                                {t('taskDetail.description.empty')}
                            </p>
                        )}
                    </section>

                    <section className="task-detail__section">
                        <div className="task-detail__section-header">
                            <h3 className="task-detail__section-title">
                                <span className="material-symbols-outlined">checklist</span>
                                {t('taskDetail.subtasks.label')}
                            </h3>
                            {totalCount > 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600 }}>{doneCount}/{totalCount} ({progressPct}%)</span>}
                        </div>

                        <form onSubmit={handleAddSubTask} className="task-detail__subtask-form-row">
                            <TextInput
                                value={newSubTitle}
                                onChange={(event) => setNewSubTitle(event.target.value)}
                                placeholder={t('taskDetail.subtasks.addPlaceholder')}
                                className="task-detail__subtask-input"
                                leftElement={<span className="material-symbols-outlined">add</span>}
                                disabled={adding}
                            />
                            <Button type="submit" size="sm" variant="secondary" disabled={!newSubTitle.trim() || adding} isLoading={adding}>
                                {t('common.add')}
                            </Button>
                        </form>

                        <div className="task-detail__subtasks-list" style={{ marginTop: '4px' }}>
                            {subTasks.length === 0 && (
                                <div className="task-detail__empty-inline">
                                    <span className="material-symbols-outlined">splitscreen_add</span>
                                    {t('taskDetail.workbench.progressEmpty')}
                                </div>
                            )}
                            {subTasks.map(sub => (
                                <div key={sub.id} className="task-detail__subtask" data-complete={sub.isCompleted ? 'true' : 'false'}>
                                    <button type="button" onClick={() => handleToggleSubTask(sub.id, sub.isCompleted)} className="task-detail__subtask-toggle" aria-label={sub.isCompleted ? t('common.reopen') : t('common.complete')}>
                                        <span className="material-symbols-outlined">check</span>
                                    </button>
                                    <span className="task-detail__subtask-title">{sub.title}</span>
                                    <div className="task-detail__subtask-assignee">
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setActiveSubAssignMenu(activeSubAssignMenu === sub.id ? null : sub.id);
                                            }}
                                            className="task-detail__subtask-avatar"
                                            data-assigned={sub.assigneeId ? 'true' : 'false'}
                                            style={{
                                                backgroundImage: sub.assigneeId ? `url(${allUsers.find(u => (u as any).id === sub.assigneeId)?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'})` : 'none'
                                            }}
                                            title={sub.assigneeId ? t('taskDetail.subtasks.assignedTo').replace('{name}', allUsers.find(u => (u as any).id === sub.assigneeId)?.displayName || '') : t('taskDetail.subtasks.assign')}
                                        >
                                            {!sub.assigneeId && <span className="material-symbols-outlined">person_add</span>}
                                        </button>

                                        {activeSubAssignMenu === sub.id && (
                                            <>
                                                <div className="task-detail__overlay" onClick={() => setActiveSubAssignMenu(null)} />
                                                <div className="task-detail__menu task-detail__menu--compact task-detail__menu--right">
                                                    <div className="task-detail__menu-header">
                                                        <p className="task-detail__menu-title">{t('taskDetail.subtasks.assignTitle')}</p>
                                                    </div>
                                                    <div className="task-detail__menu-body">
                                                        <button type="button" onClick={() => handleUpdateSubTaskAssignee(sub.id, null)} className="task-detail__menu-item task-detail__menu-item--danger">
                                                            <span className="material-symbols-outlined task-detail__menu-icon">person_remove</span>
                                                            {t('taskDetail.subtasks.unassign')}
                                                        </button>
                                                        {taskAssignees.map(uid => {
                                                            const user = allUsers.find(u => (u as any).id === uid || u.uid === uid);
                                                            return (
                                                                <button key={uid} type="button" onClick={() => handleUpdateSubTaskAssignee(sub.id, uid)} className={`task-detail__menu-item ${sub.assigneeId === uid ? 'task-detail__menu-item--selected' : ''}`}>
                                                                    <img src={user?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'} alt="" className="task-detail__menu-avatar" />
                                                                    <span className="task-detail__menu-text">{user?.displayName || user?.email || uid.slice(0, 8)}</span>
                                                                    {sub.assigneeId === uid && <span className="material-symbols-outlined task-detail__menu-check">check</span>}
                                                                </button>
                                                            );
                                                        })}
                                                        {taskAssignees.length === 0 && <p className="task-detail__menu-empty">{t('taskDetail.subtasks.noneAssigned')}</p>}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <button type="button" onClick={() => handleDeleteSubTask(sub.id)} className="task-detail__subtask-delete" title={t('taskDetail.subtasks.delete')}>
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="task-detail__section">
                        <div className="task-detail__section-header">
                            <h3 className="task-detail__section-title">
                                <span className="material-symbols-outlined">chat</span>
                                {t('taskDetail.comments.title').replace('{count}', String(commentCount))}
                            </h3>
                        </div>
                        <CommentSection
                            projectId={id!}
                            targetId={taskId!}
                            targetType="task"
                            tenantId={task?.tenantId}
                            isProjectOwner={isProjectOwner}
                            targetTitle={task?.title}
                            hideHeader={true}
                            onCountChange={setCommentCount}
                        />
                    </section>
                </main>

                <aside className="task-detail__sidebar">
                    <div className="task-detail__sidebar-section" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--color-surface-border)' }}>
                        <Button
                            variant={task.isCompleted ? 'secondary' : 'primary'}
                            onClick={handleToggleTask}
                            size="md"
                            isLoading={savingStatus}
                            icon={<span className="material-symbols-outlined">{task.isCompleted ? 'check_circle' : 'check'}</span>}
                            style={{ width: '100%', justifyContent: 'center', minHeight: '44px' }}
                        >
                            {task.isCompleted ? t('taskDetail.actions.completed') : t('taskDetail.actions.markDone')}
                        </Button>
                    </div>

                    <div className="task-detail__sidebar-section">
                        <span className="task-detail__sidebar-label">{t('taskDetail.status.label')}</span>
                        <div ref={statusMenuRef} className="task-detail__select">
                            <button type="button" onClick={() => setStatusMenuOpen((open) => !open)} className={`task-detail__select-trigger`} data-open={statusMenuOpen ? 'true' : 'false'}>
                                <span className="task-detail__select-value" style={{ color: `var(--color-${task.isCompleted ? 'success' : 'primary'})` }}>
                                    <span className="material-symbols-outlined">{getTaskStatusIcon(currentStatus)}</span>
                                    {currentStatusLabel}
                                </span>
                                <span className="material-symbols-outlined task-detail__select-chevron">expand_more</span>
                            </button>
                            {statusMenuOpen && (
                                <div className="task-detail__select-menu">
                                    {TASK_STATUS_OPTIONS.map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => {
                                                setStatusMenuOpen(false);
                                                const isDone = status === 'Done';
                                                setTask(prev => prev ? ({ ...prev, status: status as Task['status'], isCompleted: isDone }) : null);
                                                void updateTaskFields(task.id, { status: status as Task['status'], isCompleted: isDone }, id, activeTenantId);
                                            }}
                                            className={`task-detail__select-item ${getTaskStatusStyle(status)} ${status === currentStatus ? 'task-detail__select-item--selected' : ''}`}
                                        >
                                            <span className="task-detail__select-item-label">
                                                <span className="material-symbols-outlined">{getTaskStatusIcon(status)}</span>
                                                {statusLabels[status] || status}
                                            </span>
                                            {status === currentStatus && <span className="material-symbols-outlined task-detail__select-item-check">check</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="task-detail__sidebar-section">
                        <span className="task-detail__sidebar-label">{t('taskDetail.priority.label')}</span>
                        <div ref={priorityMenuRef} className="task-detail__select">
                            <button type="button" onClick={() => setPriorityMenuOpen((open) => !open)} className="task-detail__select-trigger" data-open={priorityMenuOpen ? 'true' : 'false'}>
                                <span className="task-detail__select-value">
                                    <PriorityIcon priority={task.priority || 'Low'} />
                                    {priorityLabels[task.priority as keyof typeof priorityLabels] || task.priority || t('tasks.priority.low')}
                                </span>
                                <span className="material-symbols-outlined task-detail__select-chevron">expand_more</span>
                            </button>
                            {priorityMenuOpen && (
                                <div className="task-detail__select-menu">
                                    {(['Low', 'Medium', 'High', 'Urgent'] as const).map((priority) => {
                                        const selected = task.priority === priority;
                                        const priorityToneClass = priority === 'Urgent' ? 'task-detail__priority--urgent' : priority === 'High' ? 'task-detail__priority--high' : priority === 'Medium' ? 'task-detail__priority--medium' : 'task-detail__priority--low';
                                        return (
                                            <button
                                                key={priority}
                                                type="button"
                                                onClick={() => {
                                                    setPriorityMenuOpen(false);
                                                    void handleUpdateField('priority', priority);
                                                }}
                                                className={`task-detail__select-item ${priorityToneClass} ${selected ? 'task-detail__select-item--selected' : ''}`}
                                            >
                                                <span className="task-detail__select-item-label">
                                                    <PriorityIcon priority={priority} />
                                                    {priorityLabels[priority]}
                                                </span>
                                                {selected && <span className="material-symbols-outlined task-detail__select-item-check">check</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="task-detail__sidebar-section">
                        <span className="task-detail__sidebar-label">{t('taskDetail.assignees.label')}</span>
                        <MultiAssigneeSelector
                            projectId={id!}
                            assigneeIds={task.assigneeIds || (task.assigneeId ? [task.assigneeId] : [])}
                            assignedGroupIds={task.assignedGroupIds || []}
                            onChange={handleUpdateAssignees}
                            onGroupChange={handleUpdateAssignedGroups}
                        />
                    </div>

                    <div className="task-detail__sidebar-section">
                        <span className="task-detail__sidebar-label">{t('taskDetail.timeline.label')}</span>
                        <div className="task-detail__date-grid">
                            <DatePicker value={startDate} onChange={(date) => handleUpdateField('startDate', date)} placeholder={t('taskDetail.timeline.startPlaceholder')} />
                            <DatePicker value={dueDate} onChange={(date) => handleUpdateField('dueDate', date)} placeholder={t('taskDetail.timeline.duePlaceholder')} />
                            <DatePicker value={reminderDate} onChange={(date) => handleUpdateField('reminderAt', date)} placeholder={t('taskDetail.workbench.reminderPlaceholder')} />
                        </div>
                    </div>

                    <div className="task-detail__sidebar-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="task-detail__sidebar-label">{t('taskDetail.labels.title')}</span>
                            <button type="button" className="task-detail__text-button" onClick={() => setShowLabelsModal(true)}>
                                {t('taskDetail.labels.manage')}
                            </button>
                        </div>
                        <div className="task-detail__labels-list">
                            {filteredCats.length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{t('taskDetail.labels.empty')}</span>}
                            {filteredCats.map(catName => {
                                const catData = allCategories.find(c => c.name === catName);
                                const color = catData?.color || 'var(--color-text-muted)';
                                return (
                                    <span key={catName} className="task-detail__label-pill" style={{ color }}>
                                        <span className="task-detail__label-dot" style={{ backgroundColor: color }} />
                                        <span>{catName}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = filteredCats.filter(c => c !== catName);
                                                void handleUpdateField('category', next.length > 0 ? next : null);
                                            }}
                                            className="task-detail__label-remove"
                                            style={{ color }}
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                        <div className="task-detail__label-control">
                            <button type="button" className="task-detail__inline-action">
                                <span className="material-symbols-outlined">add</span>
                                {t('taskDetail.labels.add')}
                            </button>
                            <div className="task-detail__menu task-detail__menu--floating task-detail__menu--right task-detail__menu--hover">
                                <div className="task-detail__menu-body">
                                    {allCategories.map(cat => {
                                        const isSelected = filteredCats.includes(cat.name);
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => {
                                                    const current = Array.isArray(task.category) ? task.category : (task.category ? [task.category] : []);
                                                    const next = isSelected ? current.filter(c => c !== cat.name) : [...current, cat.name];
                                                    void handleUpdateField('category', next.length > 0 ? next : null);
                                                }}
                                                className={`task-detail__menu-item ${isSelected ? 'task-detail__menu-item--selected' : ''}`}
                                            >
                                                <span className="task-detail__menu-dot" style={{ backgroundColor: cat.color || 'var(--color-text-muted)' }} />
                                                <span className="task-detail__menu-text">{cat.name}</span>
                                                {isSelected && <span className="material-symbols-outlined task-detail__menu-check">check</span>}
                                            </button>
                                        );
                                    })}
                                    {allCategories.length === 0 && <div className="task-detail__menu-empty">{t('taskDetail.labels.noneDefined')}</div>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="task-detail__sidebar-section">
                        <span className="task-detail__sidebar-label">{t('taskDetail.details.milestone')}</span>
                        {linkedMilestone ? (
                            <div className="task-detail__linked-row">
                                <span className="material-symbols-outlined">flag</span>
                                <div>
                                    <strong>{linkedMilestone.title}</strong>
                                    {linkedMilestone.dueDate && <small>{t('taskDetail.details.milestone.duePrefix').replace('{date}', format(new Date(linkedMilestone.dueDate), dateFormat, { locale: dateLocale }))}</small>}
                                </div>
                                <button type="button" onClick={() => handleUnlinkMilestone(linkedMilestone.id)} title={t('taskDetail.details.milestone.unlink')} style={{ background: 'transparent', border: 0, color: 'var(--color-text-subtle)', cursor: 'pointer' }}>
                                    <span className="material-symbols-outlined">link_off</span>
                                </button>
                            </div>
                        ) : (
                            <div className="task-detail__label-control">
                                <button type="button" onClick={() => setActiveMilestoneMenu(!activeMilestoneMenu)} className="task-detail__inline-action">
                                    <span className="material-symbols-outlined">add_link</span>
                                    {t('taskDetail.details.milestone.link')}
                                </button>
                                {activeMilestoneMenu && (
                                    <>
                                        <div className="task-detail__overlay" onClick={() => setActiveMilestoneMenu(false)} />
                                        <div className="task-detail__menu task-detail__menu--floating">
                                            {milestones.filter(m => m.status === 'Pending').length === 0 ? (
                                                <div className="task-detail__menu-empty">{t('taskDetail.details.milestone.nonePending')}</div>
                                            ) : (
                                                milestones.filter(m => m.status === 'Pending').map(m => (
                                                    <button key={m.id} type="button" onClick={() => handleLinkMilestone(m.id)} className="task-detail__menu-item">
                                                        <span className="material-symbols-outlined task-detail__menu-icon">flag</span>
                                                        <span className="task-detail__menu-text">{m.title}</span>
                                                        {m.dueDate && <span className="task-detail__menu-meta">{format(new Date(m.dueDate), 'MMM d', { locale: dateLocale })}</span>}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="task-detail__sidebar-section" style={{ padding: 0 }}>
                        <TaskRelationshipsPanel
                            projectId={id!}
                            task={task}
                            tenantId={activeTenantId}
                            onTaskChange={(updates) => setTask(prev => prev ? { ...prev, ...updates } : prev)}
                        />
                    </div>

                    <div className="task-detail__sidebar-section">
                        <span className="task-detail__sidebar-label">{t('taskDetail.workbench.context')}</span>
                        <div className="task-detail__link-stack">
                            {initiative && (
                                <Link to={`/project/${id}/initiatives/${initiative.id}${tenantQuery}`} className="task-detail__linked-row">
                                    <span className="material-symbols-outlined">rocket_launch</span>
                                    <div>
                                        <strong>{initiative.title}</strong>
                                        <small>{t('taskDetail.details.initiativeAction')}</small>
                                    </div>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-subtle)' }}>arrow_forward</span>
                                </Link>
                            )}
                            {task.convertedIdeaId && (
                                <div className="task-detail__linked-row task-detail__linked-row--static">
                                    <span className="material-symbols-outlined">lightbulb</span>
                                    <div>
                                        <strong>{t('taskDetail.details.origin.label')}</strong>
                                        <small>{t('taskDetail.workbench.legacyReference')}</small>
                                    </div>
                                </div>
                            )}
                            {task.linkedIssueId && (
                                <div className="task-detail__linked-row task-detail__linked-row--static">
                                    <span className="material-symbols-outlined">bug_report</span>
                                    <div>
                                        <strong>{t('taskDetail.details.reference.label')}</strong>
                                        <small>{t('taskDetail.workbench.legacyReference')}</small>
                                    </div>
                                </div>
                            )}
                            {!initiative && !task.convertedIdeaId && !task.linkedIssueId && (
                                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>{t('taskDetail.workbench.contextEmpty')}</p>
                            )}
                        </div>
                    </div>

                    <div className="task-detail__sidebar-section task-detail__details-list">
                        <div className="task-detail__detail-row">
                            <span>{t('taskDetail.details.id')}</span>
                            <button
                                type="button"
                                className="task-detail__id-button"
                                onClick={() => {
                                    void navigator.clipboard.writeText(task.id);
                                    setCopiedId(true);
                                    setTimeout(() => setCopiedId(false), 2000);
                                }}
                            >
                                {task.id}
                                <span className="material-symbols-outlined">{copiedId ? 'check' : 'content_copy'}</span>
                            </button>
                        </div>
                        <DetailMeta label={t('taskDetail.details.created')} value={task.createdAt ? format(new Date(toMillis(task.createdAt)), dateFormat, { locale: dateLocale }) : '-'} />
                        {task.createdBy && <DetailMeta label={t('taskDetail.details.by').replace('{name}', '')} value={allUsers.find(u => (u as any).id === task.createdBy)?.displayName || t('taskDetail.details.unknownUser')} />}
                        {task.isCompleted && <DetailMeta label={t('taskDetail.details.completed')} value={task.completedAt ? format(new Date(toMillis(task.completedAt)), dateFormat, { locale: dateLocale }) : t('taskDetail.details.justNow')} />}
                    </div>

                    {displayedActivities.length > 0 && (
                        <div className="task-detail__sidebar-section" style={{ paddingTop: '16px', borderTop: '1px solid var(--color-surface-border)' }}>
                            <span className="task-detail__sidebar-label">{t('taskDetail.activity.title')}</span>
                            <ActivityList activities={displayedActivities.slice(0, 4)} compact />
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};

const DetailMeta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="task-detail__detail-row">
        <span>{label}</span>
        <strong>{value}</strong>
    </div>
);

const ActivityList: React.FC<{ activities: Activity[]; compact: boolean }> = ({ activities, compact }) => {
    const { t } = useLanguage();

    if (activities.length === 0) {
        return (
            <div className="task-detail__empty-inline">
                <span className="material-symbols-outlined">history</span>
                {t('taskDetail.workbench.historyEmpty')}
            </div>
        );
    }

    return (
        <div className="task-detail__activity-list">
            {activities.map((item) => {
                const { icon, color, bg } = activityIcon(item.type, item.action);
                return (
                    <div key={item.id} className="task-detail__activity-item">
                        <div className="task-detail__activity-icon" style={{ backgroundColor: bg, color }}>
                            <span className="material-symbols-outlined">{icon}</span>
                        </div>
                        <div className="task-detail__activity-content">
                            <div>
                                <strong>{item.user}</strong> <span>{item.action}</span>
                            </div>
                            <time>{timeAgo(item.createdAt)}</time>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const PriorityIcon = ({ priority }: { priority: string }) => {
    const icons: Record<string, string> = {
        Urgent: 'error',
        High: 'keyboard_double_arrow_up',
        Medium: 'drag_handle',
        Low: 'keyboard_arrow_down',
    };
    return (
        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: `var(--priority-${priority.toLowerCase()})` }}>
            {icons[priority]}
        </span>
    );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
    const { t } = useLanguage();
    const icons: Record<string, string> = {
        Urgent: 'error',
        High: 'keyboard_double_arrow_up',
        Medium: 'drag_handle',
        Low: 'keyboard_arrow_down',
    };

    const priorityLabels: Record<string, string> = {
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low'),
    };

    const toneClass = priority === 'Urgent' ? 'task-detail__priority--urgent' :
                      priority === 'High' ? 'task-detail__priority--high' :
                      priority === 'Medium' ? 'task-detail__priority--medium' :
                      'task-detail__priority--low';

    return (
        <span className={`task-detail__priority-pill ${toneClass}`}>
            <span className="material-symbols-outlined">{icons[priority]}</span>
            {priorityLabels[priority] || priority}
        </span>
    );
};
