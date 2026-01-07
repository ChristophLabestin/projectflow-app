import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useOutletContext, useSearchParams } from 'react-router-dom';
import { addSubTask, getProjectTasks, getSubTasks, getTaskById, toggleSubTaskStatus, toggleTaskStatus, deleteTask, getProjectMembers, updateTaskFields, deleteSubTask, updateSubtaskFields, subscribeTenantUsers, getProjectById, getIdeaById, subscribeTaskActivity, getProjectCategories, subscribeProjectMilestones, updateMilestone } from '../services/dataService';
import { deleteField } from 'firebase/firestore';
import { SubTask, Task, Member, Project, Activity, Milestone, TaskCategory } from '../types';
import { CommentSection } from '../components/CommentSection';
import { Button } from '../components/common/Button/Button';
import { TextInput } from '../components/common/Input/TextInput';
import { EditTaskModal } from '../components/EditTaskModal';
import { MultiAssigneeSelector } from '../components/MultiAssigneeSelector';
import { TaskDependenciesCard } from '../components/TaskDependenciesCard';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { ProjectLabelsModal } from '../components/ProjectLabelsModal';
import { toMillis, timeAgo } from '../utils/time';
import { activityIcon } from '../utils/activityHelpers';
import { auth } from '../services/firebase';
import { DatePicker } from '../components/common/DateTime/DatePicker';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { TaskStrategicContext } from '../components/tasks/TaskStrategicContext';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';
import { ConfirmModal } from '../components/common/Modal/ConfirmModal';

const TASK_STATUS_OPTIONS = ['Backlog', 'Open', 'In Progress', 'On Hold', 'Review', 'Blocked', 'Done'] as const;

const getTaskStatusStyle = (status?: string) => {
    if (status === 'Done') return 'task-detail__tone--success';
    if (status === 'In Progress') return 'task-detail__tone--primary';
    if (status === 'Review') return 'task-detail__tone--warning';
    if (status === 'Open' || status === 'Todo') return 'task-detail__tone--primary';
    if (status === 'Backlog') return 'task-detail__tone--neutral';
    if (status === 'On Hold') return 'task-detail__tone--warning';
    if (status === 'Blocked') return 'task-detail__tone--error';
    return 'task-detail__tone--neutral';
};

const getPriorityTone = (priority?: string) => {
    if (priority === 'Urgent') return 'task-detail__tone--error';
    if (priority === 'High') return 'task-detail__tone--warning';
    if (priority === 'Medium') return 'task-detail__tone--primary';
    if (priority === 'Low') return 'task-detail__tone--neutral';
    return 'task-detail__tone--neutral';
};

const getEffortTone = (effort?: string) => {
    if (effort === 'High') return 'task-detail__tone--warning';
    if (effort === 'Medium') return 'task-detail__tone--primary';
    if (effort === 'Low') return 'task-detail__tone--neutral';
    return 'task-detail__tone--neutral';
};

const getTaskStatusIcon = (status?: string) => {
    return status === 'Done' ? 'check_circle' :
        status === 'In Progress' ? 'sync' :
            status === 'Review' ? 'visibility' :
                status === 'Open' || status === 'Todo' ? 'play_circle' :
                    status === 'Backlog' ? 'inventory_2' :
                        status === 'On Hold' ? 'pause_circle' :
                            status === 'Blocked' ? 'dangerous' :
                                'circle';
};

export const ProjectTaskDetail = () => {
    const { id, taskId } = useParams<{ id: string; taskId: string }>();
    const [searchParams] = useSearchParams();
    const tenantId = searchParams.get('tenant') || undefined;
    const navigate = useNavigate();
    const { dateFormat, dateLocale, t } = useLanguage();
    const [task, setTask] = useState<Task | null>(null);
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [idea, setIdea] = useState<any | null>(null); // Store original idea
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
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [activeMilestoneMenu, setActiveMilestoneMenu] = useState(false);
    const statusMenuRef = useRef<HTMLDivElement | null>(null);
    const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
    const priorityMenuRef = useRef<HTMLDivElement | null>(null);
    const [effortMenuOpen, setEffortMenuOpen] = useState(false);
    const effortMenuRef = useRef<HTMLDivElement | null>(null);
    const { pinItem, unpinItem, isPinned, focusItemId, setFocusItem } = usePinnedTasks();

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

    const effortLabels = useMemo(() => ({
        Low: t('taskDetail.effort.low'),
        Medium: t('taskDetail.effort.medium'),
        High: t('taskDetail.effort.high'),
    }), [t]);

    const flowTypeLabels = useMemo(() => ({
        Feature: t('flows.type.feature'),
        Product: t('flows.type.product'),
        Marketing: t('flows.type.marketing'),
        Social: t('flows.type.social'),
        Moonshot: t('flows.type.moonshot'),
        Optimization: t('flows.type.optimization'),
        SocialCampaign: t('flows.type.socialCampaign'),
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
            const isCloseInTime = Math.abs(timeDiff) < 5 * 60 * 1000; // 5 minutes

            if (isSameUser && isSameAction && isSameType && isCloseInTime) {
                return acc;
            }

            return [...acc, current];
        }, []);
    }, [activities]);


    const doneCount = subTasks.filter(s => s.isCompleted).length;
    const totalCount = subTasks.length;
    const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

    // Compute the list of assignee IDs (handles both legacy assigneeId and new assigneeIds)
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

    const loadData = async () => {
        if (!taskId) return;
        setLoading(true);
        setTask(null);
        setSubTasks([]);
        setProject(null);
        setMembers([]);
        setError(null);
        try {
            let t = await getTaskById(taskId, id, tenantId);
            if (!t && id) {
                const projectTasks = await getProjectTasks(id, tenantId);
                t = projectTasks.find((task) => task.id === taskId) || null;
            }
            setTask(t);

            // Fetch linked idea if it exists
            if (t?.convertedIdeaId && id) {
                getIdeaById(t.convertedIdeaId, id).then(setIdea).catch(e => console.error("Failed to load strategic flow", e));
            }

            const subs = await getSubTasks(taskId, id, tenantId);
            setSubTasks(subs);

            if (id) {
                const m = await getProjectMembers(id, tenantId);
                setMembers(m);

                const proj = await getProjectById(id, tenantId);
                setProject(proj);
            }
        } catch (err) {
            console.error('Failed to load task', err);
            setError('Failed to load task details.');
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        loadData();
    }, [taskId, id]);

    useEffect(() => {
        if (!statusMenuOpen && !priorityMenuOpen && !effortMenuOpen) return;
        const handleClick = (event: MouseEvent) => {
            if (statusMenuOpen && !statusMenuRef.current?.contains(event.target as Node)) {
                setStatusMenuOpen(false);
            }
            if (priorityMenuOpen && !priorityMenuRef.current?.contains(event.target as Node)) {
                setPriorityMenuOpen(false);
            }
            if (effortMenuOpen && !effortMenuRef.current?.contains(event.target as Node)) {
                setEffortMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [statusMenuOpen, priorityMenuOpen, effortMenuOpen]);

    // Subscribe to workspace users once we have the task's tenantId
    useEffect(() => {
        if (!task?.tenantId) return;

        const unsubUsers = subscribeTenantUsers((users) => {
            setAllUsers(users as Member[]);
        }, task.tenantId);

        return () => {
            unsubUsers();
        };
    }, [task?.tenantId]);

    // Subscribe to task activity
    useEffect(() => {
        if (!taskId || !id) return;
        const unsub = subscribeTaskActivity(id, taskId, (data) => {
            setActivities(data);
        }, tenantId);

        // Subscribe to Milestones
        const unsubMilestones = subscribeProjectMilestones(id, (data) => {
            setMilestones(data);
        }, tenantId);

        return () => {
            unsub();
            unsubMilestones();
        };
    }, [taskId, id, tenantId]);

    const refreshSubs = async () => {
        if (!taskId) return;
        const subs = await getSubTasks(taskId, id);
        setSubTasks(subs);
    };

    const handleAddSubTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!taskId || !newSubTitle.trim()) return;
        setAdding(true);
        try {
            await addSubTask(taskId, newSubTitle.trim(), id);
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
        await toggleSubTaskStatus(subId, currentStatus, taskId, id);
    };

    const handleDeleteSubTask = (subId: string) => {
        setSubTaskToDelete(subId);
    };

    const confirmDeleteSubTask = async () => {
        if (!subTaskToDelete || !task) return;
        try {
            await deleteSubTask(subTaskToDelete, task.id, id);
            setSubTaskToDelete(null);
            loadData();
        } catch (error) {
            console.error("Failed to delete subtask", error);
        }
    };

    const handleUpdateSubTaskAssignee = async (subId: string, userId: string | null) => {
        setSubTasks(prev => prev.map(s => s.id === subId ? { ...s, assigneeId: userId || undefined } : s));
        try {
            await updateSubtaskFields(subId, { assigneeId: userId || deleteField() }, taskId, id);
        } catch (error) {
            console.error("Failed to update subtask assignee", error);
        }
        setActiveSubAssignMenu(null);
    };

    const handleToggleTask = async () => {
        if (!task) return;
        setSavingStatus(true);
        const newStatus = !task.isCompleted;
        setTask({ ...task, isCompleted: newStatus, status: newStatus ? 'Done' : 'In Progress' });
        try {
            await toggleTaskStatus(task.id, task.isCompleted, id);
            if (newStatus) {
                await updateTaskFields(task.id, { status: 'Done' }, id);
            } else {
                await updateTaskFields(task.id, { status: 'In Progress' }, id);
            }
        } finally {
            setSavingStatus(false);
        }
    };

    const handleDeleteTask = async () => {
        if (!task || !taskId) return;
        setDeleting(true);
        try {
            await deleteTask(taskId, id);
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
        if ((field === 'startDate' || field === 'dueDate') && value instanceof Date) {
            nextValue = format(value, 'yyyy-MM-dd');
        } else if ((field === 'startDate' || field === 'dueDate') && value === null) {
            nextValue = '';
        }
        setTask({ ...task, [field]: nextValue });
        await updateTaskFields(task.id, { [field]: nextValue }, id);
    };

    useEffect(() => {
        if (!id) return;
        getProjectCategories(id).then(setAllCategories).catch(console.error);
    }, [id]);

    const handleUpdateAssignees = async (ids: string[]) => {
        if (!task) return;
        const primaryAssignee = ids.length > 0 ? ids[0] : '';
        const updates: Partial<Task> = {
            assigneeIds: ids,
            assigneeId: primaryAssignee,
        };
        setTask(prev => prev ? { ...prev, ...updates } : null);
        await updateTaskFields(task.id, updates, id);
    };

    const handleUpdateAssignedGroups = async (groupIds: string[]) => {
        if (!task || !id) return;
        setTask(prev => prev ? { ...prev, assignedGroupIds: groupIds } : null);
        await updateTaskFields(task.id, { assignedGroupIds: groupIds }, id);
    };

    const handleUpdateDependencies = async (dependencyIds: string[]) => {
        if (!task || !id) return;
        setTask(prev => prev ? { ...prev, dependencies: dependencyIds } : null);
        await updateTaskFields(task.id, { dependencies: dependencyIds }, id);
    };

    const handleLinkMilestone = async (milestoneId: string) => {
        if (!id || !task) return;
        const milestone = milestones.find(m => m.id === milestoneId);
        if (!milestone) return;

        const currentTasks = milestone.linkedTaskIds || [];
        // Prevent duplicates
        if (!currentTasks.includes(task.id)) {
            await updateMilestone(id, milestoneId, {
                linkedTaskIds: [...currentTasks, task.id]
            }, tenantId);
        }
        setActiveMilestoneMenu(false);
        // If task has no due date, inherit? This is done in modal but nice to have here too?
        // Prompt didn't ask explicitly for it here but consistency is good.
        // Let's stick to simple linking as per request "card... to link...".
    };

    const handleUnlinkMilestone = async (milestoneId: string) => {
        if (!id || !task) return;
        const milestone = milestones.find(m => m.id === milestoneId);
        if (!milestone) return;

        const currentTasks = milestone.linkedTaskIds || [];
        await updateMilestone(id, milestoneId, {
            linkedTaskIds: currentTasks.filter(tid => tid !== task.id)
        }, tenantId);
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
                <span className="material-symbols-outlined task-detail__loading-icon">progress_activity</span>
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

    const currentStatus = task?.status || 'Open';
    const currentStatusLabel = statusLabels[currentStatus as keyof typeof statusLabels] || t('tasks.status.unknown');

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
                        const cats = await getProjectCategories(id!);
                        setAllCategories(cats);
                    }}
                />
            )}

            {showTaskModal && (
                <TaskCreateModal
                    isOpen={showTaskModal}
                    onClose={() => setShowTaskModal(false)}
                    projectId={id!}
                    onSuccess={() => {
                        setShowTaskModal(false);
                        // Refresh if needed, but since it's a new task it won't affect this page's task data
                    }}
                />
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
            />

            {/* Header / Hero Section */}
            <header className="task-detail__hero">
                <div className="task-detail__hero-glow" />

                <div className="task-detail__hero-content">


                    <div className="task-detail__hero-layout">
                        <div className="task-detail__hero-main">
                            <div className="task-detail__badges">
                                {/* Project Context */}
                                {project && (
                                    <Link to={`/project/${project.id}`} className="task-detail__project-link">
                                        <span className="task-detail__project-dot" />
                                        <span className="task-detail__project-text">{project.title}</span>
                                        <span className="material-symbols-outlined task-detail__project-icon">arrow_forward</span>
                                    </Link>
                                )}
                                <span className={`task-detail__status-pill ${getTaskStatusStyle(task.status)}`}>
                                    <span className="material-symbols-outlined task-detail__status-icon">
                                        {getTaskStatusIcon(task.status)}
                                    </span>
                                    {currentStatusLabel}
                                </span>
                                <PriorityBadge priority={task.priority || 'Low'} />
                                {task.convertedIdeaId && (
                                    <span className="task-detail__strategic-pill">
                                        <span className="material-symbols-outlined task-detail__strategic-icon">lightbulb</span>
                                        {t('taskDetail.badges.strategic')}
                                    </span>
                                )}
                            </div>

                            <h1 className="task-detail__title">
                                {task.title}
                            </h1>



                            <div className="task-detail__meta-row">
                                <div className="task-detail__meta-card">
                                    <span className="material-symbols-outlined task-detail__meta-icon">calendar_today</span>
                                    <div className="task-detail__meta-body">
                                        <span className="task-detail__meta-label">
                                            {task.startDate && task.dueDate ? t('taskDetail.timeline.label') : t('taskDetail.timeline.dueDate')}
                                        </span>
                                        <span className="task-detail__meta-value">
                                            {task.startDate ? (
                                                <>
                                                    {format(new Date(task.startDate), dateFormat, { locale: dateLocale })}
                                                    {' - '}
                                                    {task.dueDate ? format(new Date(task.dueDate), dateFormat, { locale: dateLocale }) : '...'}
                                                </>
                                            ) : (
                                                task.dueDate ? format(new Date(task.dueDate), dateFormat, { locale: dateLocale }) : t('taskDetail.timeline.noDueDate')
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {totalCount > 0 && (
                                    <div className="task-detail__meta-card">
                                        <div className="task-detail__progress">
                                            <svg className="task-detail__progress-ring" viewBox="0 0 24 24">
                                                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" className="task-detail__progress-track" />
                                                <circle
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    strokeDasharray={2 * Math.PI * 10}
                                                    strokeDashoffset={2 * Math.PI * 10 * (1 - progressPct / 100)}
                                                    strokeLinecap="round"
                                                    className="task-detail__progress-value"
                                                />
                                            </svg>
                                            <span className="task-detail__progress-label">{Math.round(progressPct)}%</span>
                                        </div>
                                        <div className="task-detail__meta-body">
                                            <span className="task-detail__meta-label">{t('taskDetail.subtasks.label')}</span>
                                            <span className="task-detail__meta-value">{doneCount}/{totalCount}</span>
                                        </div>
                                    </div>
                                )}

                                {task.scheduledDate && (
                                    <div className="task-detail__meta-card">
                                        <span className="material-symbols-outlined task-detail__meta-icon">event_available</span>
                                        <div className="task-detail__meta-body">
                                            <span className="task-detail__meta-label">{t('taskDetail.timeline.smartScheduled')}</span>
                                            <span className="task-detail__meta-value">
                                                {format(new Date(task.scheduledDate), dateFormat, { locale: dateLocale })}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="task-detail__assignees">
                                    <span className="task-detail__assignees-divider" />
                                    <div className="task-detail__assignee-stack">
                                        {(task.assigneeIds || [task.assigneeId]).filter(id => id).map((uid, i) => {
                                            const user = allUsers.find(u => (u as any).id === uid || u.uid === uid);
                                            return (
                                                <img
                                                    key={uid + i}
                                                    src={user?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
                                                    alt=""
                                                    className="task-detail__assignee"
                                                    title={user?.displayName || t('taskDetail.assignees.fallback')}
                                                />
                                            );
                                        })}
                                        {(!task.assigneeIds && !task.assigneeId) && (
                                            <div className="task-detail__assignee task-detail__assignee--placeholder">
                                                <span className="material-symbols-outlined">person</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="task-detail__actions">
                            <Button
                                variant={task.isCompleted ? 'secondary' : 'primary'}
                                onClick={handleToggleTask}
                                size="lg"
                                className="task-detail__primary-action"
                                icon={<span className="material-symbols-outlined task-detail__action-icon">{task.isCompleted ? 'check_circle' : 'check'}</span>}
                            >
                                {task.isCompleted ? t('taskDetail.actions.completed') : t('taskDetail.actions.markDone')}
                            </Button>

                            <div className="task-detail__action-toolbar">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        if (isPinned(task.id)) {
                                            if (focusItemId === task.id) {
                                                // If already focused, just unpin (which also un-focuses)
                                                unpinItem(task.id);
                                            } else {
                                                // If pinned but not focused, set it as focus
                                                setFocusItem(task.id);
                                            }
                                        } else {
                                            // Pin and set as focus
                                            pinItem({
                                                id: task.id,
                                                type: 'task',
                                                title: task.title,
                                                projectId: id!,
                                                priority: task.priority,
                                                isCompleted: task.isCompleted
                                            });
                                            setFocusItem(task.id);
                                        }
                                    }}
                                    onContextMenu={(e) => {
                                        if (isPinned(task.id)) {
                                            e.preventDefault();
                                            unpinItem(task.id);
                                        }
                                    }}
                                    className="task-detail__action-button"
                                    data-state={focusItemId === task.id ? 'focused' : isPinned(task.id) ? 'pinned' : 'default'}
                                    icon={<span className="material-symbols-outlined task-detail__action-icon">push_pin</span>}
                                />
                                <span className="task-detail__action-divider" />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="task-detail__action-button"
                                    icon={<span className="material-symbols-outlined task-detail__action-icon">edit</span>}
                                />
                                <span className="task-detail__action-divider" />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="task-detail__action-button task-detail__action-button--danger"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    <span className="material-symbols-outlined task-detail__action-icon">delete</span>
                                </Button>
                                <span className="task-detail__action-divider" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowTaskModal(true)}
                                    className="task-detail__action-button task-detail__action-button--wide"
                                    icon={<span className="material-symbols-outlined task-detail__action-icon">add</span>}
                                >
                                    {t('taskDetail.actions.newTask')}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Bar (Visual) */}
                    {task.startDate && task.dueDate && (
                        <div className="task-detail__timeline">
                            <div className="task-detail__timeline-labels">
                                <span>{format(new Date(task.startDate), dateFormat, { locale: dateLocale })}</span>
                                <span>{format(new Date(task.dueDate), dateFormat, { locale: dateLocale })}</span>
                            </div>
                            <div className="task-detail__timeline-track">
                                {/* Visual calculation for progress based on today vs start/end */}
                                {(() => {
                                    const start = new Date(task.startDate).getTime();
                                    const end = new Date(task.dueDate).getTime();
                                    const now = new Date().getTime();
                                    const total = end - start;
                                    const elapsed = now - start;
                                    const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                                    return (
                                        <div
                                            className="task-detail__timeline-progress"
                                            style={{ width: `${pct}%` }}
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </header>



            <div className="task-detail__layout">
                {/* Main Content */}
                <div className="task-detail__main">

                    {/* Top Meta Cards: Priority, Status, Assignee */}
                    {/* Top Meta Cards: Priority, Status, Effort, Assignee */}
                    <div className="task-detail__meta-grid">
                        {/* Priority Card - Compact with Custom Dropdown */}
                        <div className="app-card task-detail__card">
                            <div className="task-detail__card-header">
                                <span className="material-symbols-outlined task-detail__card-icon">flag</span>
                                <span className="task-detail__card-label">{t('taskDetail.priority.label')}</span>
                            </div>
                            <div className="task-detail__card-body">
                                <div ref={priorityMenuRef} className="task-detail__select">
                                    <button
                                        type="button"
                                        onClick={() => setPriorityMenuOpen((open) => !open)}
                                        className={`task-detail__select-trigger ${getPriorityTone(task.priority || 'Low')}`}
                                        data-open={priorityMenuOpen ? 'true' : 'false'}
                                    >
                                        <span className="task-detail__select-value">
                                            <PriorityIcon priority={task.priority || 'Low'} />
                                            {priorityLabels[task.priority as keyof typeof priorityLabels] || task.priority || t('tasks.priority.low')}
                                        </span>
                                        <span className="material-symbols-outlined task-detail__select-chevron">
                                            expand_more
                                        </span>
                                    </button>

                                    {priorityMenuOpen && (
                                        <div className="task-detail__select-menu">
                                            {(['Low', 'Medium', 'High', 'Urgent'] as const).map((p) => {
                                                const isSelected = task.priority === p;

                                                return (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => {
                                                            setPriorityMenuOpen(false);
                                                            handleUpdateField('priority', p);
                                                        }}
                                                        className={`task-detail__select-item ${getPriorityTone(p)} ${isSelected ? 'task-detail__select-item--selected' : ''}`}
                                                    >
                                                        <span className="task-detail__select-item-label">
                                                            <PriorityIcon priority={p} />
                                                            {priorityLabels[p]}
                                                        </span>
                                                        {isSelected && (
                                                            <span className="material-symbols-outlined task-detail__select-item-check">check</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Status Card */}
                        <div className="app-card task-detail__card">
                            <div className="task-detail__card-header">
                                <span className="material-symbols-outlined task-detail__card-icon">timelapse</span>
                                <span className="task-detail__card-label">{t('taskDetail.status.label')}</span>
                            </div>
                            <div className="task-detail__card-body">
                                <div ref={statusMenuRef} className="task-detail__select">
                                    <button
                                        type="button"
                                        onClick={() => setStatusMenuOpen((open) => !open)}
                                        className={`task-detail__select-trigger ${getTaskStatusStyle(currentStatus)}`}
                                        data-open={statusMenuOpen ? 'true' : 'false'}
                                    >
                                        <span className="task-detail__select-value">
                                            <span className="material-symbols-outlined task-detail__select-icon">
                                                {getTaskStatusIcon(currentStatus)}
                                            </span>
                                            {currentStatusLabel}
                                        </span>
                                        <span className="material-symbols-outlined task-detail__select-chevron">
                                            expand_more
                                        </span>
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
                                                        setTask(prev => prev ? ({ ...prev, status: status as any, isCompleted: isDone }) : null);
                                                        updateTaskFields(task.id, { status: status as any, isCompleted: isDone }, id);
                                                    }}
                                                    className={`task-detail__select-item ${getTaskStatusStyle(status)} ${status === currentStatus ? 'task-detail__select-item--selected' : ''}`}
                                                >
                                                    <span className="task-detail__select-item-label">
                                                        <span className="material-symbols-outlined task-detail__select-icon">
                                                            {getTaskStatusIcon(status)}
                                                        </span>
                                                        {statusLabels[status as keyof typeof statusLabels] || status}
                                                    </span>
                                                    {status === currentStatus && (
                                                        <span className="material-symbols-outlined task-detail__select-item-check">check</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Effort Card (New) */}
                        <div className="app-card task-detail__card">
                            <div className="task-detail__card-header">
                                <span className="material-symbols-outlined task-detail__card-icon">fitness_center</span>
                                <span className="task-detail__card-label">{t('taskDetail.effort.label')}</span>
                            </div>
                            <div className="task-detail__card-body">
                                <div ref={effortMenuRef} className="task-detail__select">
                                    <button
                                        type="button"
                                        onClick={() => setEffortMenuOpen((open) => !open)}
                                        className={`task-detail__select-trigger ${getEffortTone(task.effort || 'None')}`}
                                        data-open={effortMenuOpen ? 'true' : 'false'}
                                    >
                                        <span className="task-detail__select-value">
                                            {task.effort ? (
                                                <>
                                                    <EffortIcon effort={task.effort} />
                                                    {effortLabels[task.effort as keyof typeof effortLabels] || task.effort}
                                                </>
                                            ) : (
                                                <span className="task-detail__select-placeholder">{t('taskDetail.effort.placeholder')}</span>
                                            )}
                                        </span>
                                        <span className="material-symbols-outlined task-detail__select-chevron">
                                            expand_more
                                        </span>
                                    </button>

                                    {effortMenuOpen && (
                                        <div className="task-detail__select-menu">
                                            {(['Low', 'Medium', 'High'] as const).map((e) => {
                                                const isSelected = task.effort === e;

                                                return (
                                                    <button
                                                        key={e}
                                                        type="button"
                                                        onClick={() => {
                                                            setEffortMenuOpen(false);
                                                            handleUpdateField('effort', e);
                                                        }}
                                                        className={`task-detail__select-item ${getEffortTone(e)} ${isSelected ? 'task-detail__select-item--selected' : ''}`}
                                                    >
                                                        <span className="task-detail__select-item-label">
                                                            <EffortIcon effort={e} />
                                                            {effortLabels[e]}
                                                        </span>
                                                        {isSelected && (
                                                            <span className="material-symbols-outlined task-detail__select-item-check">check</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Assignees Card */}
                        <div className="app-card task-detail__card">
                            <div className="task-detail__card-header">
                                <span className="material-symbols-outlined task-detail__card-icon">group</span>
                                <span className="task-detail__card-label">{t('taskDetail.assignees.label')}</span>
                            </div>
                            <div className="task-detail__card-body task-detail__assignee-card">
                                <MultiAssigneeSelector
                                    projectId={id!}
                                    assigneeIds={task.assigneeIds || (task.assigneeId ? [task.assigneeId] : [])}
                                    assignedGroupIds={task.assignedGroupIds || []}
                                    onChange={handleUpdateAssignees}
                                    onGroupChange={handleUpdateAssignedGroups}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="task-detail__section">
                        <h3 className="task-detail__section-title">
                            <span className="material-symbols-outlined task-detail__section-icon">description</span>
                            {t('taskDetail.description.label')}
                        </h3>
                        <div className="app-card task-detail__card task-detail__card--roomy task-detail__description-card">
                            {task.description ? (
                                <div className="prose task-detail__description-text">
                                    <p className="task-detail__description-paragraph">{task.description}</p>
                                </div>
                            ) : (
                                <p className="task-detail__empty-text">{t('taskDetail.description.empty')}</p>
                            )}
                        </div>


                    </div>

                    {/* Subtasks */}
                    <div className="task-detail__section">
                        <div className="task-detail__subtasks-header">
                            <div className="task-detail__subtasks-title">
                                <h3 className="task-detail__section-title">
                                    <span className="material-symbols-outlined task-detail__section-icon">checklist</span>
                                    {t('taskDetail.subtasks.label')}
                                </h3>
                                {totalCount > 0 && (
                                    <span className="task-detail__subtasks-count">
                                        {totalCount}
                                    </span>
                                )}
                            </div>

                            {totalCount > 0 && (
                                <div className="task-detail__subtasks-progress">
                                    <div className="task-detail__subtasks-bar">
                                        <div
                                            className="task-detail__subtasks-bar-fill"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>
                                    <span className="task-detail__subtasks-progress-label">{Math.round(progressPct)}%</span>
                                </div>
                            )}
                        </div>

                        <div className="app-card task-detail__card task-detail__card--flush">

                            <div className="task-detail__subtasks-list">
                                {subTasks.map(sub => (
                                    <div key={sub.id} className="task-detail__subtask" data-complete={sub.isCompleted ? 'true' : 'false'}>
                                        <button
                                            onClick={() => handleToggleSubTask(sub.id, sub.isCompleted)}
                                            className="task-detail__subtask-toggle"
                                        >
                                            <span className="material-symbols-outlined task-detail__subtask-toggle-icon">check</span>
                                        </button>
                                        <span className="task-detail__subtask-title">
                                            {sub.title}
                                        </span>

                                        {/* Subtask Assignee Selector */}
                                        <div className="task-detail__subtask-assignee">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveSubAssignMenu(activeSubAssignMenu === sub.id ? null : sub.id);
                                                }}
                                                className="task-detail__subtask-avatar"
                                                data-assigned={sub.assigneeId ? 'true' : 'false'}
                                                style={{
                                                    backgroundImage: sub.assigneeId ? `url(${allUsers.find(u => (u as any).id === sub.assigneeId)?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'})` : 'none'
                                                }}
                                                title={sub.assigneeId ? t('taskDetail.subtasks.assignedTo').replace('{name}', allUsers.find(u => (u as any).id === sub.assigneeId)?.displayName || '') : t('taskDetail.subtasks.assign')}
                                            >
                                                {!sub.assigneeId && <span className="material-symbols-outlined task-detail__subtask-avatar-icon">person_add</span>}
                                            </button>

                                            {activeSubAssignMenu === sub.id && (
                                                <>
                                                    <div className="task-detail__overlay" onClick={() => setActiveSubAssignMenu(null)}></div>
                                                    <div className="task-detail__menu task-detail__menu--compact task-detail__menu--right">
                                                        <div className="task-detail__menu-header">
                                                            <p className="task-detail__menu-title">{t('taskDetail.subtasks.assignTitle')}</p>
                                                        </div>
                                                        <div className="task-detail__menu-body">
                                                            <button
                                                                onClick={() => handleUpdateSubTaskAssignee(sub.id, null)}
                                                                className="task-detail__menu-item task-detail__menu-item--danger"
                                                            >
                                                                <span className="material-symbols-outlined task-detail__menu-icon">person_remove</span>
                                                                {t('taskDetail.subtasks.unassign')}
                                                            </button>
                                                            {taskAssignees.map(uid => {
                                                                const user = allUsers.find(u => (u as any).id === uid || u.uid === uid);
                                                                return (
                                                                    <button
                                                                        key={uid}
                                                                        onClick={() => handleUpdateSubTaskAssignee(sub.id, uid)}
                                                                        className={`task-detail__menu-item ${sub.assigneeId === uid ? 'task-detail__menu-item--selected' : ''}`}
                                                                    >
                                                                        <img src={user?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'} alt="" className="task-detail__menu-avatar" />
                                                                        <span className="task-detail__menu-text">{user?.displayName || user?.email || uid.slice(0, 8)}</span>
                                                                        {sub.assigneeId === uid && <span className="material-symbols-outlined task-detail__menu-check">check</span>}
                                                                    </button>
                                                                );
                                                            })}
                                                            {taskAssignees.length === 0 && (
                                                                <p className="task-detail__menu-empty">{t('taskDetail.subtasks.noneAssigned')}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleDeleteSubTask(sub.id)}
                                            className="task-detail__subtask-delete"
                                            title={t('taskDetail.subtasks.delete')}
                                        >
                                            <span className="material-symbols-outlined task-detail__subtask-delete-icon">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="task-detail__subtask-form">
                                <form onSubmit={handleAddSubTask} className="task-detail__subtask-form-row">
                                    <TextInput
                                        value={newSubTitle}
                                        onChange={(e) => setNewSubTitle(e.target.value)}
                                        placeholder={t('taskDetail.subtasks.addPlaceholder')}
                                        className="task-detail__subtask-input"
                                        leftElement={<span className="material-symbols-outlined">add</span>}
                                        disabled={adding}
                                    />
                                    <Button
                                        type="submit"
                                        size="sm"
                                        variant="secondary"
                                        disabled={!newSubTitle.trim() || adding}
                                        isLoading={adding}
                                    >
                                        {t('common.add')}
                                    </Button>
                                </form>
                            </div>
                        </div>
                    </div>


                    {/* Strategic Context (Moved here) */}
                    {task.convertedIdeaId && (
                        <div className="task-detail__strategic-context">
                            <TaskStrategicContext projectId={id!} convertedIdeaId={task.convertedIdeaId} ideaData={idea} />
                        </div>
                    )}

                    {/* Comments */}
                    <div className="task-detail__section">
                        <h3 className="task-detail__section-title">
                            <span className="material-symbols-outlined task-detail__section-icon">chat</span>
                            {t('taskDetail.comments.title').replace('{count}', String(commentCount))}
                        </h3>
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
                    </div>


                </div>
                {/* Side Details Column */}
                <div className="task-detail__sidebar">
                    {/* Controls Card */}
                    <div className="task-detail__sidebar-stack">

                        {/* Timeline Card */}
                        <div className="app-card task-detail__card">
                            <div className="task-detail__card-header">
                                <span className="material-symbols-outlined task-detail__card-icon">event_note</span>
                                <span className="task-detail__card-label">{t('taskDetail.timeline.label')}</span>
                            </div>
                            <div className="task-detail__timeline-fields">
                                <div className="task-detail__field">
                                    <span className="task-detail__field-label">{t('taskDetail.timeline.startDate')}</span>
                                    <DatePicker
                                        value={task.startDate ? new Date(task.startDate) : null}
                                        onChange={(date) => handleUpdateField('startDate', date)}
                                        placeholder={t('taskDetail.timeline.startPlaceholder')}
                                    />
                                </div>
                                <div className="task-detail__field">
                                    <span className="task-detail__field-label">{t('taskDetail.timeline.dueDate')}</span>
                                    <DatePicker
                                        value={task.dueDate ? new Date(task.dueDate) : null}
                                        onChange={(date) => handleUpdateField('dueDate', date)}
                                        placeholder={t('taskDetail.timeline.duePlaceholder')}
                                    />
                                </div>
                            </div>
                        </div>


                        {/* Dependencies Card */}
                        <TaskDependenciesCard
                            projectId={id!}
                            currentTaskId={task.id}
                            dependencies={task.dependencies || []}
                            onUpdate={handleUpdateDependencies}
                        />

                        {/* Labels Card */}
                        <div className="app-card task-detail__card task-detail__labels-card">
                            <div className="task-detail__labels-header">
                                <span className="task-detail__labels-title">{t('taskDetail.labels.title')}</span>
                                <span className="material-symbols-outlined task-detail__labels-icon">sell</span>
                            </div>

                            <div className="task-detail__labels-list">
                                {(() => {
                                    const taskCats = Array.isArray(task.category) ? task.category : [task.category || ''];
                                    const filteredCats = taskCats.filter(Boolean);

                                    if (filteredCats.length === 0) {
                                        return <span className="task-detail__labels-empty">{t('taskDetail.labels.empty')}</span>;
                                    }

                                    return filteredCats.map(catName => {
                                        const catData = allCategories.find(c => c.name === catName);
                                        const color = catData?.color || '#64748b';
                                        return (
                                            <span
                                                key={catName}
                                                className="task-detail__label-pill"
                                                style={{
                                                    backgroundColor: `${color}10`,
                                                    color: color
                                                }}
                                            >
                                                <span className="task-detail__label-text">{catName}</span>
                                                <button
                                                    onClick={() => {
                                                        const newCats = filteredCats.filter(c => c !== catName);
                                                        handleUpdateField('category', newCats.length > 0 ? newCats : null);
                                                    }}
                                                    className="task-detail__label-remove"
                                                    style={{ color: color }}
                                                >
                                                    <span className="material-symbols-outlined task-detail__label-remove-icon">close</span>
                                                </button>
                                            </span>
                                        );
                                    });
                                })()}
                            </div>

                            <div className="task-detail__label-control">
                                <button className="task-detail__label-add">
                                    <span className="material-symbols-outlined task-detail__label-add-icon">add</span>
                                    {t('taskDetail.labels.add')}
                                </button>

                                <div className="task-detail__menu task-detail__menu--floating task-detail__menu--right task-detail__menu--hover">
                                    <div className="task-detail__menu-header">
                                        <button
                                            onClick={() => setShowLabelsModal(true)}
                                            className="task-detail__menu-item task-detail__menu-item--primary"
                                        >
                                            <span className="material-symbols-outlined task-detail__menu-icon">settings</span>
                                            {t('taskDetail.labels.manage')}
                                        </button>
                                    </div>
                                    <div className="task-detail__menu-body">
                                        {allCategories.map(cat => {
                                            const taskCats = Array.isArray(task.category) ? task.category : [task.category || ''];
                                            const isSelected = taskCats.includes(cat.name);

                                            return (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => {
                                                        const current = Array.isArray(task.category) ? task.category : (task.category ? [task.category] : []);
                                                        const next = isSelected ? current.filter(c => c !== cat.name) : [...current, cat.name];
                                                        handleUpdateField('category', next.length > 0 ? next : null);
                                                    }}
                                                    className={`task-detail__menu-item ${isSelected ? 'task-detail__menu-item--selected' : ''}`}
                                                >
                                                    <span className="task-detail__menu-dot" style={{ backgroundColor: cat.color || '#64748b' }} />
                                                    <span className="task-detail__menu-text">{cat.name}</span>
                                                    {isSelected && <span className="material-symbols-outlined task-detail__menu-check">check</span>}
                                                </button>
                                            );
                                        })}
                                        {allCategories.length === 0 && (
                                            <div className="task-detail__menu-empty">
                                                {t('taskDetail.labels.noneDefined')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Strategic Value Card */}
                    {idea && (
                        <div className="task-detail__strategic-card">
                            <div className="task-detail__strategic-glow" />
                            <div className="task-detail__strategic-content">
                                <h3 className="task-detail__strategic-title">
                                    <span className="material-symbols-outlined task-detail__strategic-icon">stars</span>
                                    {t('taskDetail.strategic.title')}
                                </h3>
                                <div className="task-detail__strategic-grid">
                                    <div className="task-detail__strategic-metric">
                                        <span className="task-detail__strategic-label">{t('taskDetail.strategic.impact')}</span>
                                        <span className="task-detail__strategic-value">{idea.impact || t('taskDetail.strategic.na')}</span>
                                    </div>
                                    <div className="task-detail__strategic-metric">
                                        <span className="task-detail__strategic-label">{t('taskDetail.strategic.effort')}</span>
                                        <span className="task-detail__strategic-value">{idea.effort || t('taskDetail.strategic.na')}</span>
                                    </div>
                                </div>
                                <div className="task-detail__strategic-type">
                                    <span className="material-symbols-outlined task-detail__strategic-type-icon">category</span>
                                    {flowTypeLabels[idea.type as keyof typeof flowTypeLabels] || idea.type}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Consolidated Details Card */}
                    <div className="app-card task-detail__card task-detail__card--roomy">
                        <h3 className="task-detail__details-title">{t('taskDetail.details.title')}</h3>
                        <div className="task-detail__details-body">
                            {/* Task ID */}
                            <div className="task-detail__detail-row">
                                <span className="task-detail__detail-label">{t('taskDetail.details.id')}</span>
                                <div className="task-detail__detail-value">
                                    <button
                                        className="task-detail__id-button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(task.id);
                                            setCopiedId(true);
                                            setTimeout(() => setCopiedId(false), 2000);
                                        }}
                                    >
                                        {task.id}
                                        <span className="material-symbols-outlined task-detail__id-icon">
                                            {copiedId ? 'check' : 'content_copy'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Linked Milestone Card */}
                            <div className="task-detail__detail-section">
                                <span className="task-detail__detail-label">{t('taskDetail.details.milestone')}</span>

                                {linkedMilestone ? (
                                    <div className="task-detail__milestone">
                                        <div className="task-detail__milestone-card">
                                            <div className="task-detail__milestone-icon">
                                                <span className="material-symbols-outlined">flag</span>
                                            </div>
                                            <div className="task-detail__milestone-body">
                                                <span className="task-detail__milestone-title">{linkedMilestone.title}</span>
                                                {linkedMilestone.dueDate && (
                                                    <span className="task-detail__milestone-date">
                                                        {t('taskDetail.details.milestone.duePrefix').replace('{date}', format(new Date(linkedMilestone.dueDate), dateFormat, { locale: dateLocale }))}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleUnlinkMilestone(linkedMilestone.id)}
                                                className="task-detail__milestone-unlink"
                                                title={t('taskDetail.details.milestone.unlink')}
                                            >
                                                <span className="material-symbols-outlined task-detail__milestone-unlink-icon">link_off</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="task-detail__milestone">
                                        <button
                                            onClick={() => setActiveMilestoneMenu(!activeMilestoneMenu)}
                                            className="task-detail__milestone-add"
                                        >
                                            <span className="material-symbols-outlined task-detail__milestone-add-icon">add_link</span>
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
                                                            <button
                                                                key={m.id}
                                                                onClick={() => handleLinkMilestone(m.id)}
                                                                className="task-detail__menu-item"
                                                            >
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

                            {/* Strategic Origin Link */}
                            {task.convertedIdeaId && (
                                <div className="task-detail__detail-section">
                                    <span className="task-detail__detail-label">{t('taskDetail.details.origin')}</span>
                                    <Link
                                        to={`/project/${id}/flows/${task.convertedIdeaId}`}
                                        className="task-detail__detail-link"
                                    >
                                        <div className="task-detail__detail-link-icon">
                                            <span className="material-symbols-outlined">lightbulb</span>
                                        </div>
                                        <div className="task-detail__detail-link-body">
                                            <span className="task-detail__detail-link-title">{t('taskDetail.details.origin.label')}</span>
                                            <span className="task-detail__detail-link-subtitle">{t('taskDetail.details.origin.action')}</span>
                                        </div>
                                        <span className="material-symbols-outlined task-detail__detail-link-arrow">arrow_forward</span>
                                    </Link>
                                </div>
                            )}

                            {/* Related Issue Link */}
                            {task.linkedIssueId && (
                                <div className="task-detail__detail-section">
                                    <span className="task-detail__detail-label">{t('taskDetail.details.reference')}</span>
                                    <Link
                                        to={`/project/${id}/issues/${task.linkedIssueId}`}
                                        className="task-detail__detail-link"
                                    >
                                        <div className="task-detail__detail-link-icon">
                                            <span className="material-symbols-outlined">bug_report</span>
                                        </div>
                                        <div className="task-detail__detail-link-body">
                                            <span className="task-detail__detail-link-title">{t('taskDetail.details.reference.label')}</span>
                                            <span className="task-detail__detail-link-subtitle">{t('taskDetail.details.reference.action')}</span>
                                        </div>
                                        <span className="material-symbols-outlined task-detail__detail-link-arrow">arrow_forward</span>
                                    </Link>
                                </div>
                            )}

                            {/* Timestamps */}
                            <div className="task-detail__detail-section task-detail__detail-section--stack">
                                <div className="task-detail__detail-row">
                                    <span className="task-detail__detail-label">{t('taskDetail.details.created')}</span>
                                    <div className="task-detail__detail-meta">
                                        <span className="task-detail__detail-date">
                                            {task.createdAt ? format(new Date(toMillis(task.createdAt)), dateFormat, { locale: dateLocale }) : '-'}
                                        </span>
                                        {task.createdBy && (
                                            <span className="task-detail__detail-by">
                                                {t('taskDetail.details.by').replace('{name}', allUsers.find(u => (u as any).id === task.createdBy)?.displayName?.split(' ')[0] || t('taskDetail.details.unknownUser'))}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {task.isCompleted && (
                                    <div className="task-detail__detail-row">
                                        <span className="task-detail__detail-label">{t('taskDetail.details.completed')}</span>
                                        <div className="task-detail__detail-meta">
                                            <span className="task-detail__detail-date">
                                                {task.completedAt ? format(new Date(toMillis(task.completedAt)), dateFormat, { locale: dateLocale }) : t('taskDetail.details.justNow')}
                                            </span>
                                            {task.completedBy && (
                                                <span className="task-detail__detail-by">
                                                    {t('taskDetail.details.by').replace('{name}', allUsers.find(u => (u as any).id === task.completedBy)?.displayName?.split(' ')[0] || t('taskDetail.details.unknownUser'))}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Activity Feed (Moved to Sidebar) */}
                    {activities.length > 0 && (
                        <div className="task-detail__activity">
                            <h3 className="task-detail__activity-title">
                                <span className="material-symbols-outlined task-detail__activity-icon">history</span>
                                {t('taskDetail.activity.title')}
                            </h3>
                            <div className="task-detail__activity-list">
                                {/* Vertical line */}
                                <div className="task-detail__activity-line" />

                                {displayedActivities.slice(0, 4).map((item) => {


                                    const { icon, color, bg } = activityIcon(item.type, item.action);
                                    return (
                                        <div key={item.id} className="task-detail__activity-item">
                                            <div
                                                className="task-detail__activity-badge"
                                                style={{ backgroundColor: bg, color }}
                                            >
                                                <span className="material-symbols-outlined">{icon}</span>
                                            </div>
                                            <div className="task-detail__activity-body">
                                                <div className="task-detail__activity-meta">
                                                    <span className="task-detail__activity-user">
                                                        {item.user}
                                                    </span>
                                                    <span className="task-detail__activity-time">
                                                        {timeAgo(item.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="task-detail__activity-text">
                                                    {item.action}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>







        </div >

    );
};

const PriorityIcon = ({ priority }: { priority: string }) => {
    const icons: Record<string, string> = {
        'Urgent': 'error',
        'High': 'keyboard_double_arrow_up',
        'Medium': 'drag_handle',
        'Low': 'keyboard_arrow_down',
    };
    return (
        <span className="material-symbols-outlined task-detail__priority-icon" data-priority={priority.toLowerCase()}>
            {icons[priority]}
        </span>
    );
};

const EffortIcon = ({ effort }: { effort: string }) => {
    const icons: Record<string, string> = {
        'High': 'fitness_center',
        'Medium': 'bolt',
        'Low': 'spa',
    };
    return (
        <span className="material-symbols-outlined task-detail__effort-icon" data-effort={effort.toLowerCase()}>
            {icons[effort] || 'circle'}
        </span>
    );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
    const { t } = useLanguage();
    const icons: Record<string, string> = {
        'Urgent': 'error',
        'High': 'keyboard_double_arrow_up',
        'Medium': 'drag_handle',
        'Low': 'keyboard_arrow_down',
    }

    const priorityLabels: Record<string, string> = {
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low'),
    };

    return (
        <span className={`task-detail__priority-pill ${getPriorityTone(priority)}`}>
            <span className="material-symbols-outlined task-detail__priority-icon">{icons[priority]}</span>
            {priorityLabels[priority] || priority}
        </span>
    );
};
