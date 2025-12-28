import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useOutletContext, useSearchParams } from 'react-router-dom';
import { addSubTask, getProjectTasks, getSubTasks, getTaskById, toggleSubTaskStatus, toggleTaskStatus, deleteTask, getProjectMembers, updateTaskFields, deleteSubTask, updateSubtaskFields, subscribeTenantUsers, getProjectById, getIdeaById, subscribeTaskActivity, getProjectCategories, subscribeProjectMilestones, updateMilestone } from '../services/dataService';
import { deleteField } from 'firebase/firestore';
import { SubTask, Task, Member, Project, Activity, Milestone } from '../types';
import { CommentSection } from '../components/CommentSection';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { EditTaskModal } from '../components/EditTaskModal';
import { MultiAssigneeSelector } from '../components/MultiAssigneeSelector';
import { TaskDependenciesCard } from '../components/TaskDependenciesCard';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { ProjectLabelsModal } from '../components/ProjectLabelsModal';
import { toMillis, timeAgo } from '../utils/time';
import { auth } from '../services/firebase';
import { DatePicker } from '../components/ui/DatePicker';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { TaskStrategicContext } from '../components/tasks/TaskStrategicContext';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';

const activityIcon = (type?: Activity['type'], actionText?: string) => {
    const action = (actionText || '').toLowerCase();
    if (type === 'task') {
        if (action.includes('deleted') || action.includes('remove')) return { icon: 'delete', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
        if (action.includes('reopened')) return { icon: 'undo', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' };
        if (action.includes('completed') || action.includes('done')) return { icon: 'check_circle', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' };
        return { icon: 'add_task', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' };
    }
    if (type === 'issue') {
        if (action.includes('resolved') || action.includes('closed')) return { icon: 'check_circle', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' };
        if (action.includes('reopened')) return { icon: 'undo', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' };
        return { icon: 'bug_report', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
    }
    if (type === 'status') return { icon: 'swap_horiz', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/10' };
    if (type === 'report') return { icon: 'auto_awesome', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10' };
    if (type === 'comment') return { icon: 'chat_bubble', color: 'text-amber-600', bg: 'bg-amber-100' };
    if (type === 'file') return { icon: 'attach_file', color: 'text-slate-600', bg: 'bg-slate-100' };
    if (type === 'member') return { icon: 'person_add', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' };
    if (type === 'commit') return { icon: 'code', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (type === 'priority') return { icon: 'priority_high', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
    return { icon: 'more_horiz', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700/50' };
};

const TASK_STATUS_OPTIONS = ['Backlog', 'Open', 'In Progress', 'On Hold', 'Review', 'Blocked', 'Done'] as const;

const getTaskStatusStyle = (status?: string) => {
    return status === 'Done' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
        status === 'In Progress' ? 'bg-blue-600/15 text-blue-400 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)]' :
            status === 'Review' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.1)]' :
                status === 'Open' || status === 'Todo' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                    status === 'Backlog' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20 opacity-80' :
                        status === 'On Hold' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            status === 'Blocked' ? 'bg-rose-600/20 text-rose-500 border-rose-500/50 animate-pulse ring-1 ring-rose-500/20' :
                                'bg-slate-500/5 text-slate-400 border-slate-500/10';
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
    const { dateFormat, dateLocale } = useLanguage();
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

    const isProjectOwner = useMemo(() => {
        return project?.ownerId === auth.currentUser?.uid;
    }, [project?.ownerId]);

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
        setTask({ ...task, [field]: value });
        await updateTaskFields(task.id, { [field]: value }, id);
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
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary)]">progress_activity</span>
                </div>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <h3 className="text-xl font-bold text-[var(--color-text-main)]">Task not found</h3>
                <Link to={`/project/${id}/tasks`} className="btn-secondary">Return to Tasks</Link>
            </div>
        );
    }

    const currentStatus = task?.status || 'Open';

    return (
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-8 animate-fade-in pb-20">
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

            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-[var(--color-surface-border)]">
                        <div className="space-y-4 text-center">
                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">Delete Task?</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                Are you sure you want to delete <strong>"{task.title}"</strong>?
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                                <Button variant="danger" onClick={handleDeleteTask} isLoading={deleting}>Delete</Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {subTaskToDelete && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-[var(--color-surface-border)] animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-4 text-center">
                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">Delete Subtask?</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                This action cannot be undone.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="ghost" onClick={() => setSubTaskToDelete(null)}>Cancel</Button>
                                <Button variant="danger" onClick={confirmDeleteSubTask}>Delete</Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Header / Hero Section */}
            <header className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] border border-[var(--color-surface-border)] shadow-sm">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />

                <div className="relative px-6 py-8 md:px-10 md:py-10">


                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-4 flex-wrap">
                                {/* Project Context */}
                                {project && (
                                    <Link to={`/project/${project.id}`} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] rounded-full transition-all group">
                                        <div className="size-2 rounded-full bg-[var(--color-primary)]" />
                                        <span className="text-xs font-bold text-[var(--color-text-subtle)] group-hover:text-[var(--color-primary)] uppercase tracking-wide">{project.title}</span>
                                        <span className="material-symbols-outlined text-[14px] text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]">arrow_forward</span>
                                    </Link>
                                )}
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-[0.15em] uppercase border transition-all duration-300 ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                                    task.status === 'In Progress' ? 'bg-blue-600/15 text-blue-400 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)]' :
                                        task.status === 'Review' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.1)]' :
                                            task.status === 'Open' || task.status === 'Todo' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                                                task.status === 'Backlog' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20 opacity-80' :
                                                    task.status === 'On Hold' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                        task.status === 'Blocked' ? 'bg-rose-600/20 text-rose-500 border-rose-500/50 animate-pulse ring-1 ring-rose-500/20' :
                                                            'bg-slate-500/5 text-slate-400 border-slate-500/10'
                                    }`}>
                                    <span className="material-symbols-outlined text-[14px]">
                                        {task.status === 'Done' ? 'check_circle' :
                                            task.status === 'In Progress' ? 'sync' :
                                                task.status === 'Review' ? 'visibility' :
                                                    task.status === 'Open' || task.status === 'Todo' ? 'play_circle' :
                                                        task.status === 'Backlog' ? 'inventory_2' :
                                                            task.status === 'On Hold' ? 'pause_circle' :
                                                                task.status === 'Blocked' ? 'dangerous' :
                                                                    'circle'}
                                    </span>
                                    {task.status || 'Open'}
                                </span>
                                <PriorityBadge priority={task.priority} />
                                {task.convertedIdeaId && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                                        <span className="material-symbols-outlined text-[14px]">lightbulb</span>
                                        Strategic
                                    </div>
                                )}
                            </div>

                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--color-text-main)] leading-[1.1] tracking-tight mb-8">
                                {task.title}
                            </h1>



                            <div className="flex flex-wrap items-center gap-6 text-sm">
                                <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-surface-border)]">
                                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">calendar_today</span>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] leading-none uppercase font-bold text-[var(--color-text-subtle)] mb-0.5">
                                            {task.startDate && task.dueDate ? 'Timeline' : 'Due Date'}
                                        </span>
                                        <span className="text-[var(--color-text-main)] font-semibold whitespace-nowrap">
                                            {task.startDate ? (
                                                <>
                                                    {format(new Date(task.startDate), dateFormat, { locale: dateLocale })}
                                                    {' - '}
                                                    {task.dueDate ? format(new Date(task.dueDate), dateFormat, { locale: dateLocale }) : '...'}
                                                </>
                                            ) : (
                                                task.dueDate ? format(new Date(task.dueDate), dateFormat, { locale: dateLocale }) : 'No due date'
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {totalCount > 0 && (
                                    <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-surface-border)]">
                                        <div className="relative size-6 flex items-center justify-center">
                                            <svg className="size-full -rotate-90">
                                                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--color-surface-border)]" />
                                                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={2 * Math.PI * 10} strokeDashoffset={2 * Math.PI * 10 * (1 - progressPct / 100)} strokeLinecap="round" className="text-[var(--color-primary)] transition-all duration-700 ease-out" />
                                            </svg>
                                            <span className="absolute text-[8px] font-bold text-[var(--color-text-main)]">{Math.round(progressPct)}%</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] leading-none uppercase font-bold text-[var(--color-text-subtle)] mb-0.5">Subtasks</span>
                                            <span className="text-[var(--color-text-main)] font-semibold">{doneCount}/{totalCount}</span>
                                        </div>
                                    </div>
                                )}

                                {task.scheduledDate && (
                                    <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-surface-border)]">
                                        <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">event_available</span>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] leading-none uppercase font-bold text-[var(--color-text-subtle)] mb-0.5">Smart Scheduled</span>
                                            <span className="text-[var(--color-text-main)] font-semibold">
                                                {format(new Date(task.scheduledDate), dateFormat, { locale: dateLocale })}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="hidden md:flex items-center gap-3 ml-2">
                                    <div className="h-8 w-[1px] bg-[var(--color-surface-border)]" />
                                    <div className="flex -space-x-2">
                                        {(task.assigneeIds || [task.assigneeId]).filter(id => id).map((uid, i) => {
                                            const user = allUsers.find(u => (u as any).id === uid || u.uid === uid);
                                            return (
                                                <img
                                                    key={uid + i}
                                                    src={user?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
                                                    alt=""
                                                    className="size-8 rounded-full border-2 border-[var(--color-surface-card)] shadow-sm"
                                                    title={user?.displayName || 'Assignee'}
                                                />
                                            );
                                        })}
                                        {(!task.assigneeIds && !task.assigneeId) && (
                                            <div className="size-8 rounded-full border-2 border-dashed border-[var(--color-surface-border)] flex items-center justify-center text-[var(--color-text-subtle)]">
                                                <span className="material-symbols-outlined text-[16px]">person</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-stretch lg:items-end gap-3 lg:mb-1">
                            <Button
                                variant={task.isCompleted ? 'secondary' : 'primary'}
                                onClick={handleToggleTask}
                                size="lg"
                                className={`shadow-lg w-full lg:w-fit ${idea ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25 border-none text-white' : 'shadow-primary/10'}`}
                                icon={<span className="material-symbols-outlined">{task.isCompleted ? 'check_circle' : 'check'}</span>}
                            >
                                {task.isCompleted ? 'Completed' : 'Mark as Done'}
                            </Button>

                            <div className="flex items-center gap-2 bg-[var(--color-surface-hover)] p-1 rounded-xl border border-[var(--color-surface-border)] w-full lg:w-fit">
                                <Button
                                    variant="ghost"
                                    size="sm"
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
                                    className={`flex-1 lg:flex-none transition-all ${focusItemId === task.id
                                        ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 shadow-sm border border-amber-500/20'
                                        : isPinned(task.id)
                                            ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 shadow-sm'
                                            : 'hover:bg-[var(--color-surface-card)] text-[var(--color-text-muted)]'
                                        }`}
                                    icon={<span className={`material-symbols-outlined text-[20px] ${focusItemId === task.id ? 'fill-current' : ''}`}>
                                        {focusItemId === task.id ? 'push_pin' : 'push_pin'}
                                    </span>}
                                />
                                <div className="w-[1px] h-4 bg-[var(--color-surface-border)]" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="flex-1 lg:flex-none hover:bg-[var(--color-surface-card)]"
                                    icon={<span className="material-symbols-outlined text-[20px]">edit</span>}
                                />
                                <div className="w-[1px] h-4 bg-[var(--color-surface-border)]" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 lg:flex-none text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                </Button>
                                <div className="w-[1px] h-4 bg-[var(--color-surface-border)]" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowTaskModal(true)}
                                    className="flex-1 lg:flex-none hover:bg-[var(--color-surface-card)]"
                                    icon={<span className="material-symbols-outlined text-[20px]">add</span>}
                                >
                                    New Task
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Bar (Visual) */}
                    {task.startDate && task.dueDate && (
                        <div className="mt-8 relative pt-4">
                            <div className="flex justify-between text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mb-2">
                                <span>{format(new Date(task.startDate), dateFormat, { locale: dateLocale })}</span>
                                <span>{format(new Date(task.dueDate), dateFormat, { locale: dateLocale })}</span>
                            </div>
                            <div className="h-2 bg-[var(--color-surface-border)] rounded-full overflow-hidden relative">
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
                                            className={`h-full absolute top-0 left-0 rounded-full ${idea ? 'bg-indigo-500' : 'bg-[var(--color-primary)]'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </header>



            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Main Content */}
                <div className="xl:col-span-9 space-y-8">

                    {/* Top Meta Cards: Priority, Status, Assignee */}
                    {/* Top Meta Cards: Priority, Status, Effort, Assignee */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        {/* Priority Card - Compact with Custom Dropdown */}
                        <div className="app-card p-4 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)]">flag</span>
                                <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">Priority</span>
                            </div>
                            <div className="flex-1 flex items-center">
                                <div ref={priorityMenuRef} className="relative w-full">
                                    <button
                                        type="button"
                                        onClick={() => setPriorityMenuOpen((open) => !open)}
                                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-all hover:brightness-110 ${(() => {
                                            const p = task.priority || 'Low';
                                            const activeStyles: Record<string, string> = {
                                                'Low': 'bg-slate-500/10 text-slate-500 border-slate-500/20 shadow-sm',
                                                'Medium': 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-sm',
                                                'High': 'bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-sm',
                                                'Urgent': 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-sm'
                                            };
                                            return activeStyles[p] || activeStyles['Low'];
                                        })()}`}
                                    >
                                        <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide truncate">
                                            <PriorityIcon priority={task.priority || 'Low'} />
                                            {task.priority || 'Low'}
                                        </span>
                                        <span className={`material-symbols-outlined text-[18px] text-current opacity-70 transition-transform ${priorityMenuOpen ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>

                                    {priorityMenuOpen && (
                                        <div className="absolute left-0 top-full mt-2 w-full rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] shadow-lg p-2 space-y-1 z-20">
                                            {(['Low', 'Medium', 'High', 'Urgent'] as const).map((p) => {
                                                const activeStyles: Record<string, string> = {
                                                    'Low': 'bg-slate-500/10 text-slate-500 border-slate-500/20 shadow-sm',
                                                    'Medium': 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-sm',
                                                    'High': 'bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-sm',
                                                    'Urgent': 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-sm'
                                                };
                                                const isSelected = task.priority === p;

                                                return (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => {
                                                            setPriorityMenuOpen(false);
                                                            handleUpdateField('priority', p);
                                                        }}
                                                        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all ${isSelected ? 'ring-1 ring-[var(--color-primary)]/30' : 'hover:brightness-110 border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'
                                                            } ${isSelected ? activeStyles[p] : 'text-[var(--color-text-muted)]'}`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <PriorityIcon priority={p} />
                                                            {p}
                                                        </span>
                                                        {isSelected && (
                                                            <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>
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
                        <div className="app-card p-4 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)]">timelapse</span>
                                <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">Status</span>
                            </div>
                            <div className="flex-1 flex items-center">
                                <div ref={statusMenuRef} className="relative w-full">
                                    <button
                                        type="button"
                                        onClick={() => setStatusMenuOpen((open) => !open)}
                                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-all hover:brightness-110 ${getTaskStatusStyle(currentStatus)}`}
                                    >
                                        <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide truncate">
                                            <span className="material-symbols-outlined text-[16px]">
                                                {getTaskStatusIcon(currentStatus)}
                                            </span>
                                            {currentStatus}
                                        </span>
                                        <span className={`material-symbols-outlined text-[18px] text-current opacity-70 transition-transform ${statusMenuOpen ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>
                                    {statusMenuOpen && (
                                        <div className="absolute left-0 top-full mt-2 w-full rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] shadow-lg p-2 space-y-1 z-20">
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
                                                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all ${status === currentStatus
                                                        ? 'ring-1 ring-[var(--color-primary)]/30'
                                                        : 'hover:brightness-110'
                                                        } ${getTaskStatusStyle(status)}`}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[14px]">
                                                            {getTaskStatusIcon(status)}
                                                        </span>
                                                        {status}
                                                    </span>
                                                    {status === currentStatus && (
                                                        <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Effort Card (New) */}
                        <div className="app-card p-4 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)]">fitness_center</span>
                                <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">Effort</span>
                            </div>
                            <div className="flex-1 flex items-center">
                                <div ref={effortMenuRef} className="relative w-full">
                                    <button
                                        type="button"
                                        onClick={() => setEffortMenuOpen((open) => !open)}
                                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-all hover:brightness-110 ${(() => {
                                            const e = task.effort || 'None';
                                            const activeStyles: Record<string, string> = {
                                                'None': 'border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]',
                                                'Low': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-sm',
                                                'Medium': 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-sm',
                                                'High': 'bg-violet-500/10 text-violet-500 border-violet-500/20 shadow-sm'
                                            };
                                            return activeStyles[e] || activeStyles['None'];
                                        })()}`}
                                    >
                                        <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide truncate">
                                            {task.effort ? (
                                                <>
                                                    <EffortIcon effort={task.effort} />
                                                    {task.effort}
                                                </>
                                            ) : (
                                                <span className="text-[var(--color-text-muted)] italic text-[11px]">Set Effort...</span>
                                            )}
                                        </span>
                                        <span className={`material-symbols-outlined text-[18px] text-current opacity-70 transition-transform ${effortMenuOpen ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>

                                    {effortMenuOpen && (
                                        <div className="absolute left-0 top-full mt-2 w-full rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] shadow-lg p-2 space-y-1 z-20">
                                            {(['Low', 'Medium', 'High'] as const).map((e) => {
                                                const activeStyles: Record<string, string> = {
                                                    'Low': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-sm',
                                                    'Medium': 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-sm',
                                                    'High': 'bg-violet-500/10 text-violet-500 border-violet-500/20 shadow-sm'
                                                };
                                                const isSelected = task.effort === e;

                                                return (
                                                    <button
                                                        key={e}
                                                        type="button"
                                                        onClick={() => {
                                                            setEffortMenuOpen(false);
                                                            handleUpdateField('effort', e);
                                                        }}
                                                        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all ${isSelected ? 'ring-1 ring-[var(--color-primary)]/30' : 'hover:brightness-110 border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'
                                                            } ${isSelected ? activeStyles[e] : 'text-[var(--color-text-muted)]'}`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <EffortIcon effort={e} />
                                                            {e}
                                                        </span>
                                                        {isSelected && (
                                                            <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>
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
                        <div className="app-card p-4 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)]">group</span>
                                <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">Assignees & Groups</span>
                            </div>
                            <div className="flex-1 flex items-center justify-start">
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
                    <div className="p-0">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-3 flex items-center gap-2 tracking-wider">
                            <span className="material-symbols-outlined text-[16px]">description</span>
                            Description
                        </h3>
                        <div className="app-card p-6 min-h-[120px]">
                            {task.description ? (
                                <div className="prose prose-sm max-w-none text-[var(--color-text-main)]">
                                    <p className="whitespace-pre-wrap leading-relaxed">{task.description}</p>
                                </div>
                            ) : (
                                <p className="text-[var(--color-text-muted)] italic">No description provided.</p>
                            )}
                        </div>


                    </div>

                    {/* Subtasks */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase flex items-center gap-2 tracking-wider">
                                    <span className="material-symbols-outlined text-[16px]">checklist</span>
                                    Subtasks
                                </h3>
                                {totalCount > 0 && (
                                    <span className="bg-[var(--color-surface-hover)] text-[var(--color-text-main)] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {totalCount}
                                    </span>
                                )}
                            </div>

                            {totalCount > 0 && (
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[var(--color-primary)] transition-all duration-500 rounded-full"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-[var(--color-text-muted)]">{Math.round(progressPct)}%</span>
                                </div>
                            )}
                        </div>

                        <div className="app-card overflow-hidden">

                            <div className="divide-y divide-[var(--color-surface-border)]">
                                {subTasks.map(sub => (
                                    <div key={sub.id} className="group flex items-center gap-3 p-3 hover:bg-[var(--color-surface-hover)] transition-colors">
                                        <button
                                            onClick={() => handleToggleSubTask(sub.id, sub.isCompleted)}
                                            className={`size-5 rounded border flex items-center justify-center transition-all ${sub.isCompleted
                                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-primary-text)]'
                                                : 'border-[var(--color-text-muted)] text-transparent hover:border-[var(--color-primary)]'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                        </button>
                                        <span className={`flex-1 text-sm ${sub.isCompleted ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-main)]'}`}>
                                            {sub.title}
                                        </span>

                                        {/* Subtask Assignee Selector */}
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveSubAssignMenu(activeSubAssignMenu === sub.id ? null : sub.id);
                                                }}
                                                className={`
                                                    size-7 rounded-full border border-dashed flex items-center justify-center transition-all bg-cover bg-center
                                                    ${sub.assigneeId ? 'border-transparent' : 'border-[var(--color-surface-border)] text-[var(--color-text-subtle)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}
                                                `}
                                                style={{
                                                    backgroundImage: sub.assigneeId ? `url(${allUsers.find(u => (u as any).id === sub.assigneeId)?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'})` : 'none'
                                                }}
                                                title={sub.assigneeId ? `Assigned to ${allUsers.find(u => (u as any).id === sub.assigneeId)?.displayName}` : 'Assign user'}
                                            >
                                                {!sub.assigneeId && <span className="material-symbols-outlined text-[16px]">person_add</span>}
                                            </button>

                                            {activeSubAssignMenu === sub.id && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setActiveSubAssignMenu(null)}></div>
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <div className="p-2 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]">
                                                            <p className="px-2 text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">Assign to Task Member</p>
                                                        </div>
                                                        <div className="max-h-60 overflow-y-auto p-1">
                                                            <button
                                                                onClick={() => handleUpdateSubTaskAssignee(sub.id, null)}
                                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-lg transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">person_remove</span>
                                                                Unassign
                                                            </button>
                                                            {taskAssignees.map(uid => {
                                                                const user = allUsers.find(u => (u as any).id === uid || u.uid === uid);
                                                                return (
                                                                    <button
                                                                        key={uid}
                                                                        onClick={() => handleUpdateSubTaskAssignee(sub.id, uid)}
                                                                        className={`
                                                                            w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors
                                                                            ${sub.assigneeId === uid ? 'bg-[var(--color-primary-fade)] text-[var(--color-primary)]' : 'text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}
                                                                        `}
                                                                    >
                                                                        <img src={user?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'} alt="" className="size-5 rounded-full" />
                                                                        <span className="truncate">{user?.displayName || user?.email || uid.slice(0, 8)}</span>
                                                                        {sub.assigneeId === uid && <span className="material-symbols-outlined text-[14px] ml-auto">check</span>}
                                                                    </button>
                                                                );
                                                            })}
                                                            {taskAssignees.length === 0 && (
                                                                <p className="p-3 text-[10px] text-[var(--color-text-muted)] italic text-center">No users assigned to parent task</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleDeleteSubTask(sub.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--color-text-subtle)] hover:text-rose-500 rounded-lg transition-all"
                                            title="Delete subtask"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="p-3 bg-[var(--color-surface-bg)] border-t border-[var(--color-surface-border)]">
                                <form onSubmit={handleAddSubTask} className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            value={newSubTitle}
                                            onChange={(e) => setNewSubTitle(e.target.value)}
                                            placeholder="Add subtask..."
                                            className="w-full bg-transparent border-none focus:ring-0"
                                            icon={<span className="material-symbols-outlined text-[18px]">add</span>}
                                            disabled={adding}
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        variant="secondary"
                                        disabled={!newSubTitle.trim() || adding}
                                        isLoading={adding}
                                    >
                                        Add
                                    </Button>
                                </form>
                            </div>
                        </div>
                    </div>


                    {/* Strategic Context (Moved here) */}
                    {task.convertedIdeaId && (
                        <div className="animate-fade-in-up">
                            <TaskStrategicContext projectId={id!} convertedIdeaId={task.convertedIdeaId} ideaData={idea} />
                        </div>
                    )}

                    {/* Comments */}
                    <div>
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-3 flex items-center gap-2 tracking-wider">
                            <span className="material-symbols-outlined text-[16px]">chat</span>
                            Discussion ({commentCount})
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
                <div className="xl:col-span-3 space-y-6">
                    {/* Controls Card */}
                    <div className="space-y-4">

                        {/* Timeline Card */}
                        <div className="app-card p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)]">event_note</span>
                                <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">Timeline</span>
                            </div>
                            <div className="space-y-4 px-1">
                                <div>
                                    <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider block mb-1">Start Date</span>
                                    <DatePicker
                                        value={task.startDate || ''}
                                        onChange={(date) => handleUpdateField('startDate', date)}
                                        placeholder="Set start date"
                                        className="w-full text-sm border-none p-0 h-auto bg-transparent focus:ring-0 text-[var(--color-text-main)] font-semibold"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider block mb-1">Due Date</span>
                                    <DatePicker
                                        value={task.dueDate || ''}
                                        onChange={(date) => handleUpdateField('dueDate', date)}
                                        placeholder="Set due date"
                                        className="w-full text-sm border-none p-0 h-auto bg-transparent focus:ring-0 text-[var(--color-text-main)] font-semibold"
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
                        <div className="app-card p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">Labels</span>
                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)]">sell</span>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-3">
                                {(() => {
                                    const taskCats = Array.isArray(task.category) ? task.category : [task.category || ''];
                                    const filteredCats = taskCats.filter(Boolean);

                                    if (filteredCats.length === 0) {
                                        return <span className="text-xs text-[var(--color-text-muted)] italic px-1">No labels</span>;
                                    }

                                    return filteredCats.map(catName => {
                                        const catData = allCategories.find(c => c.name === catName);
                                        const color = catData?.color || '#64748b';
                                        return (
                                            <span
                                                key={catName}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all"
                                                style={{
                                                    backgroundColor: `${color}10`,
                                                    color: color,
                                                    borderColor: `${color}30`
                                                }}
                                            >
                                                {catName}
                                                <button
                                                    onClick={() => {
                                                        const newCats = filteredCats.filter(c => c !== catName);
                                                        handleUpdateField('category', newCats.length > 0 ? newCats : null);
                                                    }}
                                                    className="hover:opacity-70 transition-opacity flex items-center justify-center p-0.5"
                                                    style={{ color: color }}
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                                </button>
                                            </span>
                                        );
                                    });
                                })()}
                            </div>

                            <div className="relative group/label">
                                <button className="w-full py-2 px-3 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] text-[10px] font-bold text-[var(--color-text-main)] uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[var(--color-surface-card)] transition-all">
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                    Add Label
                                </button>

                                <div className="absolute right-0 bottom-full mb-2 w-48 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl shadow-2xl py-2 opacity-0 invisible group-hover/label:opacity-100 group-hover/label:visible transition-all z-20">
                                    <div className="px-3 py-1 mb-1 border-b border-[var(--color-surface-border)]">
                                        <button
                                            onClick={() => setShowLabelsModal(true)}
                                            className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-sm">settings</span>
                                            Manage Labels
                                        </button>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar px-1">
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
                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[var(--color-surface-hover)] text-xs font-semibold text-[var(--color-text-main)] transition-colors text-left"
                                                >
                                                    <div className="size-2 rounded-full" style={{ backgroundColor: cat.color || '#64748b' }} />
                                                    <span className="flex-1">{cat.name}</span>
                                                    {isSelected && <span className="material-symbols-outlined text-sm text-[var(--color-accent)]">check</span>}
                                                </button>
                                            );
                                        })}
                                        {allCategories.length === 0 && (
                                            <div className="px-3 py-4 text-[10px] text-[var(--color-text-muted)] italic text-center">
                                                No labels defined
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Strategic Value Card */}
                    {idea && (
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none" />
                            <div className="relative">
                                <h3 className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px]">stars</span>
                                    Strategic Value
                                </h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                                        <span className="text-[10px] uppercase text-indigo-200 font-bold block mb-1">Impact</span>
                                        <span className="text-lg font-black">{idea.impact || 'N/A'}</span>
                                    </div>
                                    <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                                        <span className="text-[10px] uppercase text-indigo-200 font-bold block mb-1">Effort</span>
                                        <span className="text-lg font-black">{idea.effort || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-indigo-100 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-md">
                                    <span className="material-symbols-outlined text-[16px]">category</span>
                                    {idea.type}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Consolidated Details Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Details</h3>
                        <div className="space-y-5">
                            {/* Task ID */}
                            <div className="flex items-center justify-between group">
                                <span className="text-[11px] font-bold text-[var(--color-text-subtle)] uppercase">ID</span>
                                <div className="relative">
                                    <button
                                        className="text-[11px] font-mono text-[var(--color-text-subtle)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                                        onClick={() => {
                                            navigator.clipboard.writeText(task.id);
                                            setCopiedId(true);
                                            setTimeout(() => setCopiedId(false), 2000);
                                        }}
                                    >
                                        {task.id}
                                        <span className="material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-100 transition-opacity">
                                            {copiedId ? 'check' : 'content_copy'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Linked Milestone Card */}
                            <div className="pt-3 border-t border-[var(--color-surface-border)]">
                                <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase block mb-2">Milestone</span>

                                {linkedMilestone ? (
                                    <div className="group relative">
                                        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 transition-all">
                                            <div className="size-8 rounded bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                                <span className="material-symbols-outlined text-[16px]">flag</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="block text-xs font-bold text-emerald-900 dark:text-emerald-100 truncate">{linkedMilestone.title}</span>
                                                {linkedMilestone.dueDate && (
                                                    <span className="block text-[10px] text-emerald-600 dark:text-emerald-400">
                                                        Due {format(new Date(linkedMilestone.dueDate), dateFormat, { locale: dateLocale })}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleUnlinkMilestone(linkedMilestone.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/50 rounded transition-all text-emerald-600"
                                                title="Unlink Milestone"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">link_off</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <button
                                            onClick={() => setActiveMilestoneMenu(!activeMilestoneMenu)}
                                            className="w-full flex items-center justify-center gap-2 p-2 border border-dashed border-[var(--color-surface-border)] rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] transition-all text-xs font-medium"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">add_link</span>
                                            Link to Milestone
                                        </button>

                                        {activeMilestoneMenu && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setActiveMilestoneMenu(false)} />
                                                <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-xl z-50 p-1 max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
                                                    {milestones.filter(m => m.status === 'Pending').length === 0 ? (
                                                        <div className="p-3 text-center text-[10px] text-[var(--color-text-muted)] italic">No pending milestones</div>
                                                    ) : (
                                                        milestones.filter(m => m.status === 'Pending').map(m => (
                                                            <button
                                                                key={m.id}
                                                                onClick={() => handleLinkMilestone(m.id)}
                                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors text-left"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px] text-[var(--color-text-subtle)]">flag</span>
                                                                <span className="truncate flex-1">{m.title}</span>
                                                                {m.dueDate && <span className="text-[10px] text-[var(--color-text-muted)]">{format(new Date(m.dueDate), 'MMM d', { locale: dateLocale })}</span>}
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
                                <div className="pt-3 border-t border-[var(--color-surface-border)]">
                                    <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase block mb-2">Origin</span>
                                    <Link
                                        to={`/project/${id}/flows/${task.convertedIdeaId}`}
                                        className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 group hover:border-indigo-200 dark:hover:border-indigo-500/40 transition-all"
                                    >
                                        <div className="size-6 rounded bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                            <span className="material-symbols-outlined text-[14px]">lightbulb</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="block text-xs font-bold text-indigo-900 dark:text-indigo-100 truncate">Strategic Flow</span>
                                            <span className="block text-[10px] text-indigo-600 dark:text-indigo-400">View source</span>
                                        </div>
                                        <span className="material-symbols-outlined text-[16px] text-indigo-400 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                                    </Link>
                                </div>
                            )}

                            {/* Related Issue Link */}
                            {task.linkedIssueId && (
                                <div className="pt-3 border-t border-[var(--color-surface-border)]">
                                    <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase block mb-2">Reference</span>
                                    <Link
                                        to={`/project/${id}/issues/${task.linkedIssueId}`}
                                        className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 group hover:border-rose-200 dark:hover:border-rose-500/40 transition-all"
                                    >
                                        <div className="size-6 rounded bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                            <span className="material-symbols-outlined text-[14px]">bug_report</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="block text-xs font-bold text-rose-900 dark:text-rose-100 truncate">Related Issue</span>
                                            <span className="block text-[10px] text-rose-600 dark:text-rose-400">View report</span>
                                        </div>
                                        <span className="material-symbols-outlined text-[16px] text-rose-400 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                                    </Link>
                                </div>
                            )}

                            {/* Timestamps */}
                            <div className="pt-3 border-t border-[var(--color-surface-border)] space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Created</span>
                                    <div className="text-right">
                                        <span className="block text-xs font-medium text-[var(--color-text-main)]">
                                            {task.createdAt ? format(new Date(toMillis(task.createdAt)), dateFormat, { locale: dateLocale }) : '-'}
                                        </span>
                                        {task.createdBy && (
                                            <span className="text-[10px] text-[var(--color-text-muted)] flex items-center justify-end gap-1">
                                                by {allUsers.find(u => (u as any).id === task.createdBy)?.displayName?.split(' ')[0] || 'Unknown'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {task.isCompleted && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Completed</span>
                                        <div className="text-right">
                                            <span className="block text-xs font-medium text-[var(--color-text-main)]">
                                                {task.completedAt ? format(new Date(toMillis(task.completedAt)), dateFormat, { locale: dateLocale }) : 'Just now'}
                                            </span>
                                            {task.completedBy && (
                                                <span className="text-[10px] text-[var(--color-text-muted)] flex items-center justify-end gap-1">
                                                    by {allUsers.find(u => (u as any).id === task.completedBy)?.displayName?.split(' ')[0] || 'Unknown'}
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
                        <div className="pt-4 border-t border-[var(--color-surface-border)]">
                            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-4 flex items-center gap-2 tracking-wider">
                                <span className="material-symbols-outlined text-[16px]">history</span>
                                Activity
                            </h3>
                            <div className="relative pl-4 space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {/* Vertical line */}
                                <div className="absolute left-[19px] top-2 bottom-2 w-[2px] bg-[var(--color-surface-border)]" />

                                {activities.map((item) => {
                                    const { icon, color, bg } = activityIcon(item.type, item.action);
                                    return (
                                        <div key={item.id} className="relative flex gap-3 group">
                                            <div className={`
                                                relative z-10 size-8 rounded-full border-2 border-[var(--color-surface-bg)] flex items-center justify-center shrink-0
                                                ${bg} ${color}
                                            `}>
                                                <span className="material-symbols-outlined text-[16px]">{icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0 py-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-sm font-medium text-[var(--color-text-main)] truncate">
                                                        {item.user}
                                                    </span>
                                                    <span className="text-xs text-[var(--color-text-subtle)]">
                                                        {timeAgo(item.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
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
    const colors: Record<string, string> = {
        'Urgent': 'text-rose-500',
        'High': 'text-orange-500',
        'Medium': 'text-blue-500',
        'Low': 'text-slate-500',
    };
    return <span className={`material-symbols-outlined text-[18px] ${colors[priority]}`}>{icons[priority]}</span>;
}

const EffortIcon = ({ effort }: { effort: string }) => {
    const icons: Record<string, string> = {
        'High': 'fitness_center',
        'Medium': 'bolt',
        'Low': 'spa',
    };
    const colors: Record<string, string> = {
        'High': 'text-violet-500',
        'Medium': 'text-blue-500',
        'Low': 'text-emerald-500',
    };
    return <span className={`material-symbols-outlined text-[18px] ${colors[effort] || 'text-[var(--color-text-muted)]'}`}>{icons[effort] || 'circle'}</span>;
}

const PriorityBadge = ({ priority }: { priority: string }) => {
    const styles: Record<string, string> = {
        'Urgent': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
        'High': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        'Medium': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        'Low': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    };

    const icons: Record<string, string> = {
        'Urgent': 'error',
        'High': 'keyboard_double_arrow_up',
        'Medium': 'drag_handle',
        'Low': 'keyboard_arrow_down',
    }

    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${styles[priority] || styles['Medium']}`}>
            <span className="material-symbols-outlined text-[14px]">{icons[priority]}</span>
            {priority}
        </span>
    );
};
