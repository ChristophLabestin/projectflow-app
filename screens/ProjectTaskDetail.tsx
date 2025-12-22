import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useOutletContext, useSearchParams } from 'react-router-dom';
import { addSubTask, getProjectTasks, getSubTasks, getTaskById, toggleSubTaskStatus, toggleTaskStatus, deleteTask, getProjectMembers, updateTaskFields, deleteSubTask, updateSubtaskFields, subscribeTenantUsers, getProjectById } from '../services/dataService';
import { deleteField } from 'firebase/firestore';
import { SubTask, Task, Member, Project } from '../types';
import { CommentSection } from '../components/CommentSection';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { EditTaskModal } from '../components/EditTaskModal';
import { MultiAssigneeSelector } from '../components/MultiAssigneeSelector';
import { toMillis } from '../utils/time';
import { auth } from '../services/firebase';
import { DatePicker } from '../components/ui/DatePicker';

export const ProjectTaskDetail = () => {
    const { id, taskId } = useParams<{ id: string; taskId: string }>();
    const [searchParams] = useSearchParams();
    const tenantId = searchParams.get('tenant') || undefined;
    const navigate = useNavigate();
    const [task, setTask] = useState<Task | null>(null);
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
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
    const [copiedId, setCopiedId] = useState(false);

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
        try {
            let t = await getTaskById(taskId, id, tenantId);
            if (!t && id) {
                const projectTasks = await getProjectTasks(id, tenantId);
                t = projectTasks.find((task) => task.id === taskId) || null;
            }
            setTask(t);
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

    return (
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 animate-fade-in pb-20">
            {isEditModalOpen && task && (
                <EditTaskModal
                    task={task}
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onUpdate={loadData}
                    projectMembers={members}
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
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    task.status === 'In Progress' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                        task.status === 'On Hold' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                            'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                    }`}>
                                    <span className="material-symbols-outlined text-[14px] leading-none">
                                        {task.status === 'Done' ? 'check_circle' :
                                            task.status === 'On Hold' ? 'pause_circle' :
                                                'radio_button_unchecked'}
                                    </span>
                                    {task.status || 'Open'}
                                </span>
                                <PriorityBadge priority={task.priority} />
                            </div>

                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--color-text-main)] leading-[1.1] tracking-tight mb-8">
                                {task.title}
                            </h1>



                            <div className="flex flex-wrap items-center gap-6 text-sm">
                                <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-surface-border)]">
                                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">calendar_today</span>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] leading-none uppercase font-bold text-[var(--color-text-subtle)] mb-0.5">Due Date</span>
                                        <span className="text-[var(--color-text-main)] font-semibold whitespace-nowrap">
                                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}
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
                                    <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--color-primary)]/5 rounded-xl border border-[var(--color-primary)]/10">
                                        <span className="material-symbols-outlined text-[20px] text-[var(--color-primary)]">event_available</span>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] leading-none uppercase font-bold text-[var(--color-primary)] mb-0.5">Smart Scheduled</span>
                                            <span className="text-[var(--color-text-main)] font-semibold">
                                                {new Date(task.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
                            <div className="flex items-center gap-2 bg-[var(--color-surface-hover)] p-1 rounded-xl border border-[var(--color-surface-border)] w-full lg:w-fit">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="flex-1 lg:flex-none hover:bg-[var(--color-surface-card)]"
                                    icon={<span className="material-symbols-outlined text-[20px]">edit</span>}
                                >
                                    Edit
                                </Button>
                                <div className="w-[1px] h-4 bg-[var(--color-surface-border)]" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 lg:flex-none text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                </Button>
                            </div>

                            <Button
                                variant={task.isCompleted ? 'secondary' : 'primary'}
                                onClick={handleToggleTask}
                                size="lg"
                                className="shadow-lg shadow-primary/10 w-full lg:w-fit"
                                icon={<span className="material-symbols-outlined">{task.isCompleted ? 'check_circle' : 'check'}</span>}
                            >
                                {task.isCompleted ? 'Completed' : 'Mark as Done'}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-8 space-y-8">
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
                                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
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
                            hideHeader={true}
                            onCountChange={setCommentCount}
                        />
                    </div>
                </div>

                {/* Sidebar / Meta Column */}
                <div className="lg:col-span-4 space-y-6">

                    {/* Status Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Status</h3>
                        <Select
                            value={task.status || 'Open'}
                            onChange={(e) => {
                                const newStatus = e.target.value;
                                const isDone = newStatus === 'Done';

                                // Update local state immediately with both fields
                                setTask(prev => prev ? ({ ...prev, status: newStatus as any, isCompleted: isDone }) : null);

                                // Update backend
                                updateTaskFields(task.id, { status: newStatus as any, isCompleted: isDone }, id);
                            }}
                            className="w-full"
                        >
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="On Hold">On Hold</option>
                            <option value="Review">Review</option>
                            <option value="Blocked">Blocked</option>
                            <option value="Done">Done</option>
                        </Select>
                    </div>

                    {/* Schedule Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Schedule</h3>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-medium text-[var(--color-text-subtle)] uppercase">Due Date</label>
                                <DatePicker
                                    value={task.dueDate || ''}
                                    onChange={(date) => handleUpdateField('dueDate', date)}
                                    placeholder="Set due date"
                                    align="right"
                                />
                            </div>

                            {task.scheduledDate && (
                                <div className="pt-3 border-t border-[var(--color-surface-border)] flex flex-col gap-1.5">
                                    <label className="text-[11px] font-medium text-[var(--color-text-subtle)] uppercase">Smart Schedule</label>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-sm text-[var(--color-text-main)] font-medium">
                                            <span className="material-symbols-outlined text-[20px] text-[var(--color-primary)]">event_available</span>
                                            {new Date(task.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>

                                        <Link to={`/calendar`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 rounded-lg transition-colors whitespace-nowrap">
                                            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                                            View in Calendar
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Assignees Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Assignees</h3>
                        <MultiAssigneeSelector
                            projectId={id!}
                            assigneeIds={task.assigneeIds || (task.assigneeId ? [task.assigneeId] : [])}
                            onChange={handleUpdateAssignees}
                        />
                    </div>

                    {/* Priority Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Priority</h3>
                        <div className="flex flex-col gap-1">
                            {(['Low', 'Medium', 'High', 'Urgent'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => handleUpdateField('priority', p)}
                                    className={`
                                        flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all
                                        ${task.priority === p
                                            ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] shadow-sm'
                                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-2">
                                        <PriorityIcon priority={p} />
                                        {p}
                                    </div>
                                    {task.priority === p && <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Meta Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Task Details</h3>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Task ID</span>
                                <div className="group relative">
                                    <code className="block w-full text-[11px] font-mono text-[var(--color-text-main)] bg-[var(--color-surface-hover)] p-2 rounded-lg border border-[var(--color-surface-border)] break-all truncate hover:whitespace-normal transition-all cursor-pointer" title="Click to copy ID" onClick={() => {
                                        navigator.clipboard.writeText(task.id);
                                        setCopiedId(true);
                                        setTimeout(() => setCopiedId(false), 2000);
                                    }}>
                                        {task.id}
                                    </code>
                                    <span className={`absolute right-2 top-2 transition-all material-symbols-outlined text-[14px] ${copiedId ? 'text-emerald-500 scale-110' : 'opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)]'} pointer-events-none`}>
                                        {copiedId ? 'check_circle' : 'content_copy'}
                                    </span>
                                    {copiedId && (
                                        <span className="absolute -top-7 right-0 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-fade-in-up">
                                            Copied!
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Created</span>
                                    <span className="text-xs font-semibold text-[var(--color-text-main)] flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">history</span>
                                        {task.createdAt ? new Date(task.createdAt.toDate()).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                                    </span>
                                </div>

                                {task.ownerId && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Reporter</span>
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={allUsers.find(u => (u as any).id === task.ownerId || u.uid === task.ownerId)?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
                                                className="size-5 rounded-full border border-[var(--color-surface-border)]"
                                                alt=""
                                            />
                                            <span className="text-xs font-semibold text-[var(--color-text-main)]">
                                                {allUsers.find(u => (u as any).id === task.ownerId || u.uid === task.ownerId)?.displayName || 'Unknown User'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-3 border-t border-[var(--color-surface-border)] flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Completion</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${task.isCompleted ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                                        {task.isCompleted ? 'Finished' : 'Active'}
                                    </span>
                                </div>

                                {task.linkedIssueId && (
                                    <div className="pt-3 border-t border-[var(--color-surface-border)]">
                                        <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase block mb-1">Related Issue</span>
                                        <Link to={`/project/${id}/issues/${task.linkedIssueId}`} className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[16px]">bug_report</span>
                                            View Report
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

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
