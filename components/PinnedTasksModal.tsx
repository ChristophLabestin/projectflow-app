import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePinnedTasks, PinnedItem } from '../context/PinnedTasksContext';
import { Task, SubTask, Project, Member, PersonalTask } from '../types';
import { getProjectById, getSubTasks, toggleTaskStatus, updateTaskFields, createSubTask, toggleSubTaskStatus, deleteSubTask, getUserProfile, updateSubtaskFields, deleteTask, addPersonalTask, deletePersonalTask, movePersonalTaskToProject, getUserProjects } from '../services/dataService';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { useConfirm } from '../context/UIContext';
import { CommentSection } from './CommentSection';
import { fetchCommitsReferencingIssue, GithubCommit } from '../services/githubService';
import { timeAgo, toMillis } from '../utils/time';
import { useLanguage } from '../context/LanguageContext';

const TASK_STATUS_OPTIONS = ['Backlog', 'Open', 'In Progress', 'On Hold', 'Blocked', 'Done'] as const;
const ISSUE_STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Closed'] as const;

type StatusKind = 'task' | 'issue';

const getStatusStyle = (status?: string, kind: StatusKind = 'task') => {
    if (kind === 'issue') {
        return status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
            status === 'Open' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                status === 'In Progress' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25' :
                    status === 'Closed' ? 'bg-slate-500/10 text-slate-500 border-slate-500/20' :
                        'bg-slate-500/5 text-slate-400 border-slate-500/10';
    }

    return status === 'Done' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
        status === 'In Progress' ? 'bg-blue-600/15 text-blue-400 border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.15)]' :
            status === 'Review' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' :
                status === 'Open' || status === 'Todo' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                    status === 'Backlog' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20 opacity-80' :
                        status === 'On Hold' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            status === 'Blocked' ? 'bg-rose-600/20 text-rose-500 border-rose-500/50' :
                                'bg-slate-500/5 text-slate-400 border-slate-500/10';
};

const getStatusIcon = (status?: string, kind: StatusKind = 'task') => {
    if (kind === 'issue') {
        return status === 'Resolved' ? 'check_circle' :
            status === 'Closed' ? 'cancel' :
                status === 'In Progress' ? 'sync' :
                    status === 'Open' ? 'error' :
                        'report';
    }

    return status === 'Done' ? 'check_circle' :
        status === 'In Progress' ? 'sync' :
            status === 'Review' ? 'visibility' :
                status === 'Open' || status === 'Todo' ? 'play_circle' :
                    status === 'Backlog' ? 'inventory_2' :
                        status === 'On Hold' ? 'pause_circle' :
                            status === 'Blocked' ? 'dangerous' :
                                'circle';
};



const TaskDetailView = ({ itemId, onClose, onComplete }: { itemId: string; onClose?: () => void; onComplete?: (id: string) => void }) => {
    const [item, setItem] = useState<Task | any | null>(null);
    const [itemType, setItemType] = useState<'task' | 'issue' | 'personal-task'>('task');
    const [subtasks, setSubtasks] = useState<SubTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [project, setProject] = useState<Project | null>(null);
    const [relatedCommits, setRelatedCommits] = useState<GithubCommit[]>([]);
    const [loadingCommits, setLoadingCommits] = useState(false);
    const [commentCount, setCommentCount] = useState(0);
    const [isDescExpanded, setIsDescExpanded] = useState(() => {
        const saved = localStorage.getItem(`pinned_desc_expanded_${itemId}`);
        return saved === 'true';
    });
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [showCompletedSubtasks, setShowCompletedSubtasks] = useState(false);
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [descValue, setDescValue] = useState("");
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
    const statusMenuRef = useRef<HTMLDivElement | null>(null);

    const { pinnedItems, unpinItem } = usePinnedTasks();
    const confirm = useConfirm();
    const { t } = useLanguage();

    const taskStatusLabels: Record<string, string> = {
        Backlog: t('tasks.status.backlog'),
        Open: t('tasks.status.open'),
        'In Progress': t('tasks.status.inProgress'),
        'On Hold': t('tasks.status.onHold'),
        Blocked: t('tasks.status.blocked'),
        Done: t('tasks.status.done'),
        Review: t('tasks.status.review'),
        Todo: t('tasks.status.todo')
    };
    const issueStatusLabels: Record<string, string> = {
        Open: t('projectIssues.status.open'),
        'In Progress': t('projectIssues.status.inProgress'),
        Resolved: t('projectIssues.status.resolved'),
        Closed: t('projectIssues.status.closed')
    };
    const getStatusLabel = (status: string, kind: StatusKind) => (
        kind === 'issue'
            ? issueStatusLabels[status] || status
            : taskStatusLabels[status] || status
    );



    useEffect(() => {
        localStorage.setItem(`pinned_desc_expanded_${itemId}`, isDescExpanded.toString());
    }, [isDescExpanded, itemId]);

    useEffect(() => {
        if (!statusMenuOpen) return;
        const handleClick = (event: MouseEvent) => {
            if (!statusMenuRef.current?.contains(event.target as Node)) {
                setStatusMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [statusMenuOpen]);


    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                // Get pinned item from context (not localStorage)
                const current = pinnedItems.find(i => i.id === itemId);

                if (!current) {
                    setLoading(false);
                    return;
                }
                setItemType(current.type);

                // Fetch Personal Task
                if (current.type === 'personal-task') {
                    const user = auth.currentUser;
                    if (user) {
                        // We need tenantId. PinnedItem might not have it.
                        // But we can try to resolve it or fetch user profile to get default tenant.
                        // Or try to guess.
                        // Actually dataService functions usually resolve it.
                        // But here we constructs path manually? No, let's use dataService logic if possible?
                        // We can't use internal helpers.
                        // Let's assume standard path with current user tenant?
                        // Getting global tenantId from somewhere?
                        // We can try to use `getPersonalTasks` but that gets all.
                        // Let's try to get one doc.
                        // We need tenantId.
                        // Let's try to get profile first to get lastTenantId or similar.
                        // Or if we have project context... PERSONAL tasks don't have project.
                        // Let's assume the user is in the correct tenant context or use a hack to find it.
                        // Actually, we can iterate known tenants? No.
                        // Let's assume the current loaded project (if any) gives a hint, or auth profile.

                        // Hack: we don't have easy `getPersonalTask(id)` exported.
                        // Let's fetch all personal tasks and find it? It's inefficient but safe.
                        const { getPersonalTasks } = await import('../services/dataService');
                        const allPersonal = await getPersonalTasks();
                        const found = allPersonal.find(t => t.id === itemId);
                        if (found && mounted) {
                            setItem(found);
                            // Also set description
                            setDescValue(found.description || "");
                        }
                    }
                }
                // Fetch Project Task / Issue
                else if (current.projectId) {
                    const projectData = await getProjectById(current.projectId);
                    if (projectData) {
                        setProject(projectData);
                        const collectionName = current.type === 'issue' ? 'issues' : 'tasks';
                        const itemRef = doc(db, `tenants/${projectData.tenantId}/projects/${projectData.id}/${collectionName}/${itemId}`);
                        const snap = await getDoc(itemRef);
                        if (snap.exists() && mounted) {
                            setItem({ id: snap.id, ...snap.data() });
                        }
                    }
                }

                // Fetch Subtasks (only for tasks)
                if (current.type === 'task') {
                    const subs = await getSubTasks(itemId);
                    if (mounted) setSubtasks(subs);
                }

                // Set description initial value if not already set by personal task load
                if (current.type !== 'personal-task' && mounted) {
                    // We set it inside the if block for project data, but let's be safe
                    // actually setDescValue is called after setItem usually?
                    // We need to wait for `setItem`.
                    // The logic above sets item asynchronously.
                    // The original code set it from `current.description`.
                    // Let's keep that fallback.
                    setDescValue(current.description || "");
                }

                // If we fetched fresh data, update description from that
                // (This creates a race or need to use useEffect on item? No, let's just rely on fresh fetch)

            } catch (e) {
                console.error(e);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [itemId]);

    // Effect to check verified completion status after load
    useEffect(() => {
        if (!loading && item && onComplete) {
            if (itemType === 'task' && (item as Task).isCompleted) {
                onComplete(item.id);
            }
            if (itemType === 'personal-task' && (item as PersonalTask).isCompleted) {
                onComplete(item.id);
            }
            if (itemType === 'issue' && ((item as any).status === 'Resolved' || (item as any).status === 'Closed')) {
                onComplete(item.id);
            }
        }
    }, [loading, item, itemType, onComplete]);

    useEffect(() => {
        if (itemType === 'issue' && item?.githubIssueNumber && project?.githubRepo) {
            const fetchCommits = async () => {
                setLoadingCommits(true);
                try {
                    const user = auth.currentUser;
                    let token = project.githubToken;
                    if (!token && user?.uid) {
                        const profile = await getUserProfile(user.uid, project.tenantId);
                        token = profile?.githubToken;
                    }

                    const commits = await fetchCommitsReferencingIssue(
                        project.githubRepo!,
                        token,
                        item.githubIssueNumber!
                    );
                    setRelatedCommits(commits);
                } catch (err) {
                    console.error("Failed to fetch related commits", err);
                } finally {
                    setLoadingCommits(false);
                }
            };
            fetchCommits();
        }
    }, [itemType, item?.githubIssueNumber, project?.githubRepo]);


    const handleToggleCompletion = async () => {
        if (!item) return;

        if (itemType === 'task') {
            const t = item as Task;
            const newStatus = !t.isCompleted;
            setItem(prev => prev ? { ...prev, isCompleted: newStatus } : null);
            await toggleTaskStatus(t.id, newStatus, t.projectId);
            if (newStatus && onComplete) {
                onComplete(t.id);
            }
        } else if (itemType === 'personal-task') {
            const t = item as PersonalTask;
            const newStatus = !t.isCompleted;
            setItem(prev => prev ? { ...prev, isCompleted: newStatus } : null);
            const { togglePersonalTaskStatus } = await import('../services/dataService');
            await togglePersonalTaskStatus(t.id, newStatus, t.tenantId);
            if (newStatus && onComplete) {
                onComplete(t.id);
            }
        } else {
            const i = item as any; // Issue
            const isResolved = i.status === 'Resolved' || i.status === 'Closed';
            const newStatus = isResolved ? 'Open' : 'Resolved';
            setItem(prev => prev ? { ...prev, status: newStatus } : null);

            const { updateIssue } = await import('../services/dataService');
            // Optimistic update done, now server
            if (project) {
                await updateIssue(project.id, i.id, { status: newStatus }, project.tenantId);
            }

            if ((newStatus === 'Resolved' || newStatus === 'Closed') && onComplete) {
                onComplete(item.id);
            }
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!item) return;

        if (itemType === 'task') {
            const isDone = newStatus === 'Done';
            setItem(prev => prev ? ({ ...prev, status: newStatus as any, isCompleted: isDone }) : null);
            await updateTaskFields(item.id, { status: newStatus as any, isCompleted: isDone });
            if (isDone && onComplete) {
                onComplete(item.id);
            }
        } else if (itemType === 'issue') {
            setItem(prev => prev ? { ...prev, status: newStatus } : null);
            const { updateIssue } = await import('../services/dataService');
            if (project) {
                await updateIssue(project.id, item.id, { status: newStatus }, project.tenantId);
            }
            if ((newStatus === 'Resolved' || newStatus === 'Closed') && onComplete) {
                onComplete(item.id);
            }
        }
    };

    const handleToggleSubtask = async (subId: string, current: boolean) => {
        setSubtasks(prev => prev.map(s => s.id === subId ? { ...s, isCompleted: !current } : s));
        await toggleSubTaskStatus(subId, current, item?.id);
    };

    const handleSaveSubtaskTitle = async (subId: string, newTitle: string) => {
        if (!newTitle.trim()) return;
        setSubtasks(prev => prev.map(s => s.id === subId ? { ...s, title: newTitle } : s));
        setEditingSubtaskId(null);
        await updateSubtaskFields(subId, { title: newTitle }, item.id, item.projectId);
    };

    const handleAddSubtask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSubtaskTitle.trim() || !item) return;
        try {
            // Optimistic update?
            const tempId = 'temp_' + Date.now();
            const newSub: SubTask = {
                id: tempId,
                taskId: item.id,
                title: newSubtaskTitle,
                isCompleted: false,
                ownerId: item.ownerId, // approximate
                projectId: item.projectId
            };
            setSubtasks(prev => [...prev, newSub]);
            setNewSubtaskTitle('');

            const realId = await createSubTask(item.projectId, item.id, newSubtaskTitle);
            setSubtasks(prev => prev.map(s => s.id === tempId ? { ...s, id: realId } : s));
        } catch (e) {
            console.error(e);
        }
    };

    const handleSaveDescription = async () => {
        if (!item) return;

        try {
            if (itemType === 'task') {
                await updateTaskFields(item.id, { description: descValue });
            } else if (itemType === 'personal-task') {
                const { updatePersonalTask } = await import('../services/dataService');
                await updatePersonalTask(item.id, { description: descValue }, item.tenantId);
            } else {
                const { updateIssue } = await import('../services/dataService');
                await updateIssue(item.projectId, item.id, { description: descValue });
            }
            setItem(prev => prev ? { ...prev, description: descValue } : null);
            setIsEditingDesc(false);
        } catch (e) {
            console.error("Failed to save description", e);
        }
    };

    const isCompleted = itemType === 'task' ? (item as Task)?.isCompleted : (item as any)?.status === 'Resolved' || (item as any)?.status === 'Closed';
    const statusKind: StatusKind = itemType === 'issue' ? 'issue' : 'task';
    const currentStatus = item?.status || 'Open';

    if (loading) return <div className="p-8 text-center text-[var(--color-text-subtle)]">{t('pinnedTasks.loading')}</div>;
    if (!item) {
        const pinnedItem = pinnedItems.find(i => i.id === itemId);
        if (pinnedItem) {
            return (
                <div className="flex flex-col items-center justify-center p-8 h-full text-center">
                    <div className="w-16 h-16 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-3xl text-[var(--color-text-muted)]">sentiment_dissatisfied</span>
                    </div>
                    <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-2">{t('pinnedTasks.errors.unavailableTitle')}</h3>
                    <p className="text-sm text-[var(--color-text-subtle)] mb-6 max-w-[250px]">
                        {t('pinnedTasks.errors.unavailableBody')}
                    </p>
                    <div className="bg-[var(--color-surface-hover)] p-4 rounded-xl mb-6 w-full max-w-[300px] border border-[var(--color-surface-border)]">
                        <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t('pinnedTasks.errors.pinnedAs')}</p>
                        <p className="font-medium text-[var(--color-text-main)] truncate">{pinnedItem.title}</p>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            unpinItem(itemId);
                            if (onClose) onClose();
                        }}
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    >
                        <span className="material-symbols-outlined text-lg mr-2">keep_off</span>
                        {t('pinnedTasks.actions.unpinBroken')}
                    </Button>
                </div>
            );
        }
        return <div className="p-8 text-center text-[var(--color-text-subtle)]">{t('pinnedTasks.empty.itemNotFound')}</div>;
    }

    return (
        <div className="pinned-tasks-modal-container flex flex-col h-full animate-fade-in">
            {/* Header (Title Only - Actions moved to Parent) */}
            <div className="pinned-header">
                <button
                    onClick={handleToggleCompletion}
                    className={`completion-toggle ${isCompleted ? (itemType === 'task' ? 'completed-task' : 'completed') : ''}`}
                    title={itemType === 'task' ? t('pinnedTasks.actions.markComplete') : t('pinnedTasks.actions.markResolved')}
                >
                    <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                </button>
                <div className="title-area">
                    <h3 className={isCompleted ? 'completed' : ''}>
                        {item.title}
                    </h3>
                    <div className="meta-badges">
                        {item.priority && <PriorityBadge priority={item.priority} />}
                        {(itemType === 'task' || itemType === 'issue') && (
                            <div ref={statusMenuRef} className="status-dropdown">
                                <button
                                    type="button"
                                    onClick={() => setStatusMenuOpen((open) => !open)}
                                    className={`trigger-btn ${getStatusStyle(currentStatus, statusKind)}`}
                                >
                                    <span className="material-symbols-outlined text-[11px]">
                                        {getStatusIcon(currentStatus, statusKind)}
                                    </span>
                                    <span>{getStatusLabel(currentStatus, statusKind)}</span>
                                    <span className={`material-symbols-outlined text-[10px] chevron ${statusMenuOpen ? 'open' : ''}`}>expand_more</span>
                                </button>
                                {statusMenuOpen && (
                                    <div className="menu">
                                        {(itemType === 'task' ? TASK_STATUS_OPTIONS : ISSUE_STATUS_OPTIONS).map((status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => {
                                                    setStatusMenuOpen(false);
                                                    handleStatusChange(status);
                                                }}
                                                className={status === currentStatus ? 'bg-[var(--color-surface-hover)]' : ''}
                                            >
                                                <span className="material-symbols-outlined text-[12px]">
                                                    {getStatusIcon(status, statusKind)}
                                                </span>
                                                <span>{getStatusLabel(status, statusKind)}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Description Section */}
            {/* Description Section */}
            {/* Description Section */}
            {(item.description || itemType === 'task' || itemType === 'personal-task' || isEditingDesc) && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            onClick={() => setIsDescExpanded(!isDescExpanded)}
                            className="section-header-btn"
                        >
                            <span className="material-symbols-outlined text-[16px]">description</span>
                            {t('pinnedTasks.sections.description')}
                            <span className="material-symbols-outlined text-[14px]">
                                {isDescExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                        </button>
                        {!isEditingDesc && (
                            <button
                                onClick={() => { setIsEditingDesc(true); setIsDescExpanded(true); }}
                                className="text-[10px] text-[var(--color-primary)] hover:underline font-medium"
                            >
                                {t('pinnedTasks.actions.edit')}
                            </button>
                        )}
                    </div>

                    {isDescExpanded && (
                        isEditingDesc ? (
                            <div className="space-y-2">
                                <textarea
                                    value={descValue}
                                    onChange={(e) => setDescValue(e.target.value)}
                                    className="w-full h-24 p-3 text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none resize-none"
                                    placeholder={t('pinnedTasks.placeholder.description')}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => {
                                            setIsEditingDesc(false);
                                            setDescValue(item.description || "");
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
                                    >
                                        {t('pinnedTasks.actions.cancel')}
                                    </button>
                                    <button
                                        onClick={handleSaveDescription}
                                        className="px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
                                    >
                                        {t('pinnedTasks.actions.save')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="description-box"
                                onClick={() => setIsEditingDesc(true)}
                                title={t('pinnedTasks.description.clickToEdit')}
                            >
                                {item.description || <span className="italic opacity-50">{t('pinnedTasks.description.empty')}</span>}
                                <div className="edit-icon">
                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                </div>
                            </div>
                        )
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                {/* Subtasks (Only for Tasks) */}
                {itemType === 'task' ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="section-header-btn cursor-default">{t('pinnedTasks.sections.subtasks')}</h4>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowCompletedSubtasks(!showCompletedSubtasks)}
                                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${showCompletedSubtasks ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    {showCompletedSubtasks ? t('pinnedTasks.subtasks.hideDone') : t('pinnedTasks.subtasks.showAll')}
                                </button>
                                <span className="text-xs font-medium bg-[var(--color-surface-hover)] px-2 py-0.5 rounded-full text-[var(--color-text-muted)]">
                                    {subtasks.filter(s => s.isCompleted).length}/{subtasks.length}
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleAddSubtask} className="mb-3 flex items-center gap-2 group">
                            <span className="material-symbols-outlined text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)]">add</span>
                            <input
                                type="text"
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                placeholder={t('pinnedTasks.placeholder.addSubtask')}
                                className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm placeholder-[var(--color-text-subtle)]"
                            />
                        </form>

                        <div className="subtasks-list">
                            {subtasks.filter(sub => showCompletedSubtasks || !sub.isCompleted).map(sub => (
                                <div key={sub.id} className="subtask-row group">
                                    <button
                                        onClick={() => handleToggleSubtask(sub.id, sub.isCompleted)}
                                        className={`check-box ${sub.isCompleted ? 'completed' : ''}`}
                                    >
                                        <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                                    </button>

                                    <div className="content">
                                        {editingSubtaskId === sub.id ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                defaultValue={sub.title}
                                                onBlur={(e) => handleSaveSubtaskTitle(sub.id, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveSubtaskTitle(sub.id, e.currentTarget.value);
                                                    if (e.key === 'Escape') setEditingSubtaskId(null);
                                                }}
                                            />
                                        ) : (
                                            <span
                                                onClick={() => setEditingSubtaskId(sub.id)}
                                                className={sub.isCompleted ? 'completed' : ''}
                                            >
                                                {sub.title}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        onClick={async () => {
                                            if (await confirm(t('pinnedTasks.confirm.deleteSubtask.title'), t('pinnedTasks.confirm.deleteSubtask.body'))) {
                                                setSubtasks(prev => prev.filter(s => s.id !== sub.id));
                                                await deleteSubTask(sub.id, item.id, item.projectId);
                                            }
                                        }}
                                        className="delete-btn"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : itemType === 'personal-task' ? null : (
                    <div className="space-y-6">
                        {/* Discussion / Comments for Issues */}
                        <div>
                            <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-3 flex items-center gap-2 tracking-wider">
                                <span className="material-symbols-outlined text-[16px]">chat</span>
                                {t('pinnedTasks.sections.discussion').replace('{count}', String(commentCount))}
                            </h4>
                            <div className="scale-95 origin-top">
                                <CommentSection
                                    projectId={project?.id || ''}
                                    targetId={itemId}
                                    targetType="issue"
                                    tenantId={project?.tenantId}
                                    isProjectOwner={project?.ownerId === auth.currentUser?.uid}
                                    targetTitle={item?.title}
                                    hideHeader={true}
                                    onCountChange={setCommentCount}
                                />
                            </div>
                        </div>

                        {/* GitHub reference for Issues */}
                        {item.githubIssueNumber && (
                            <div className="pt-4 border-t border-[var(--color-surface-border)]">
                                <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-3 flex items-center gap-2 tracking-wider">
                                    <span className="material-symbols-outlined text-[16px] text-indigo-500">terminal</span>
                                    {t('pinnedTasks.sections.githubReference')}
                                </h4>
                                <a
                                    href={item.githubIssueUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] hover:border-indigo-500/50 transition-all group mb-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)]">open_in_new</span>
                                        <span className="text-xs font-bold text-[var(--color-text-main)]">
                                            {t('pinnedTasks.github.issueLabel').replace('{number}', String(item.githubIssueNumber))}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-[var(--color-text-muted)]">{t('pinnedTasks.github.viewOnGithub')}</span>
                                </a>

                                {loadingCommits ? (
                                    <div className="flex items-center gap-2 py-2">
                                        <span className="material-symbols-outlined animate-spin text-[14px] text-[var(--color-primary)]">progress_activity</span>
                                        <span className="text-[10px] text-[var(--color-text-muted)]">{t('pinnedTasks.github.searchingCommits')}</span>
                                    </div>
                                ) : relatedCommits.length > 0 && (
                                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                                        {relatedCommits.map(commit => (
                                            <a
                                                key={commit.sha}
                                                href={commit.html_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block p-2 rounded-lg border border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)] transition-all"
                                            >
                                                <p className="text-[10px] font-medium text-[var(--color-text-main)] line-clamp-1">
                                                    {commit.commit.message}
                                                </p>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-[9px] text-[var(--color-text-muted)]">@{commit.author?.login}</span>
                                                    <span className="text-[9px] font-mono text-[var(--color-text-subtle)]">{commit.sha.slice(0, 7)}</span>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}


            </div>

        </div>
    );
};

export const PinnedTasksModal = () => {
    const { isModalOpen, toggleModal, pinnedItems, focusItemId, unpinItem, setFocusItem, pinItem } = usePinnedTasks();
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [isCompactMode, setIsCompactMode] = useState(false);
    const [completingItems, setCompletingItems] = useState<string[]>([]);
    const [addingItems, setAddingItems] = useState<string[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [pinnedFilter, setPinnedFilter] = useState<'all' | 'task' | 'issue'>('all');
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { t } = useLanguage();

    const itemTypeLabels: Record<string, string> = {
        task: t('pinnedTasks.types.task'),
        issue: t('pinnedTasks.types.issue'),
        'personal-task': t('pinnedTasks.types.personalTask')
    };
    const priorityLabels: Record<string, string> = {
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low')
    };
    const filterLabels = {
        all: t('pinnedTasks.tabs.all'),
        task: t('pinnedTasks.tabs.tasks'),
        issue: t('pinnedTasks.tabs.issues')
    };
    const pressEnterHint = t('pinnedTasks.hint.pressEnter');
    const [pressEnterPrefix, pressEnterSuffix] = pressEnterHint.split('{key}');

    // Draggable position and size state for compact mode
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ width: 400, height: 400 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Reset position when entering compact mode
    useEffect(() => {
        if (isCompactMode) {
            setPosition({
                x: window.innerWidth - 424,
                y: window.innerHeight - 424
            });
            setSize({ width: 400, height: 400 });
        }
    }, [isCompactMode]);

    // Default selection: Focus item if exists, else first pinned item
    useEffect(() => {
        if (isModalOpen) {
            if (focusItemId && pinnedItems.some(i => i.id === focusItemId)) {
                setSelectedItemId(focusItemId);
            } else if (pinnedItems.length > 0) {
                setSelectedItemId(pinnedItems[0].id);
            } else {
                setSelectedItemId(null);
            }
        }
    }, [isModalOpen, focusItemId, pinnedItems.length]);

    // Drag handlers
    const handleDragStart = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    // Resize handlers - direction can be 'se', 'e', 'w', 's', 'n'
    const [resizeDirection, setResizeDirection] = useState<string | null>(null);

    const handleResizeStart = (e: React.MouseEvent, direction: string) => {
        e.stopPropagation();
        setIsResizing(true);
        setResizeDirection(direction);
        setDragOffset({
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleItemCompletion = (itemId: string) => {
        // Prevent duplicate trigger
        if (completingItems.includes(itemId)) return;

        setCompletingItems(prev => [...prev, itemId]);

        // Wait for animation then unpin
        setTimeout(() => {
            unpinItem(itemId);
            setCompletingItems(prev => prev.filter(id => id !== itemId));
            if (selectedItemId === itemId) {
                setSelectedItemId(null);
            }
        }, 500);
    };

    const handleCreatePersonalTask = async () => {
        if (!newTaskTitle.trim()) return;

        setIsCreatingTask(true);
        try {
            const taskId = await addPersonalTask(newTaskTitle);

            // Pin the new task immediately
            const newTaskItem: PinnedItem = {
                id: taskId,
                type: 'personal-task',
                title: newTaskTitle,
                projectId: '', // No project for personal tasks
                priority: 'Medium'
            };

            // Trigger animation
            setAddingItems(prev => [...prev, taskId]);

            pinItem(newTaskItem);

            setNewTaskTitle("");
            // Optionally select it?
            setSelectedItemId(taskId);

            // Access to remove animation class after it plays
            setTimeout(() => {
                setAddingItems(prev => prev.filter(id => id !== taskId));
            }, 500);
        } catch (e) {
            console.error("Failed to create personal task", e);
        } finally {
            setIsCreatingTask(false);
        }
    };

    const handleDeleteTask = async (e: React.MouseEvent, item: PinnedItem) => {
        e.stopPropagation(); // Prevent selection
        if (await confirm(t('pinnedTasks.confirm.delete.title'), t('pinnedTasks.confirm.delete.body'))) {
            try {
                if (item.type === 'personal-task') {
                    await deletePersonalTask(item.id);
                } else {
                    await deleteTask(item.id, item.projectId);
                }
                unpinItem(item.id);
                if (selectedItemId === item.id) setSelectedItemId(null);
            } catch (error) {
                console.error("Failed to delete task", error);
            }
        }
    };

    useEffect(() => {
        if (!isDragging && !isResizing) return;

        // Prevent text selection while dragging/resizing
        document.body.style.userSelect = 'none';
        document.body.style.cursor = isDragging ? 'grabbing' :
            resizeDirection === 'e' || resizeDirection === 'w' ? 'ew-resize' :
                resizeDirection === 'n' || resizeDirection === 's' ? 'ns-resize' :
                    resizeDirection === 'se' ? 'se-resize' :
                        resizeDirection === 'sw' ? 'sw-resize' :
                            resizeDirection === 'ne' ? 'ne-resize' :
                                resizeDirection === 'nw' ? 'nw-resize' : 'default';

        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault(); // Prevent text selection

            if (isDragging) {
                setPosition({
                    x: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.x)),
                    y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y))
                });
            }
            if (isResizing && resizeDirection) {
                const deltaX = e.clientX - dragOffset.x;
                const deltaY = e.clientY - dragOffset.y;

                let newWidth = size.width;
                let newHeight = size.height;
                let newX = position.x;
                let newY = position.y;

                // Horizontal resize from right
                if (resizeDirection.includes('e')) {
                    newWidth = Math.max(320, size.width + deltaX);
                }
                // Horizontal resize from left
                if (resizeDirection.includes('w')) {
                    const potentialWidth = size.width - deltaX;
                    if (potentialWidth >= 320) {
                        newWidth = potentialWidth;
                        newX = position.x + deltaX;
                    }
                }
                // Vertical resize from bottom
                if (resizeDirection.includes('s')) {
                    newHeight = Math.max(250, size.height + deltaY);
                }
                // Vertical resize from top
                if (resizeDirection.includes('n')) {
                    const potentialHeight = size.height - deltaY;
                    if (potentialHeight >= 250) {
                        newHeight = potentialHeight;
                        newY = position.y + deltaY;
                    }
                }

                setSize({ width: newWidth, height: newHeight });
                setPosition({ x: newX, y: newY });
                setDragOffset({ x: e.clientX, y: e.clientY });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
            setResizeDirection(null);
            // Restore text selection
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            // Cleanup in case of unmount during drag
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging, isResizing, dragOffset, resizeDirection, size, position]);

    if (!isModalOpen) return null;

    // Compact floating mode - draggable and resizable
    if (isCompactMode && selectedItemId) {
        return (
            <div
                className="fixed z-50 bg-[var(--color-surface-card)] rounded-2xl shadow-2xl border border-[var(--color-surface-border)] flex flex-col overflow-hidden"
                style={{
                    left: position.x,
                    top: position.y,
                    width: size.width,
                    height: size.height
                }}
            >
                {/* Compact Header - Draggable */}
                <div
                    className={`flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleDragStart}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">drag_indicator</span>
                        <span className="material-symbols-outlined text-[18px] text-amber-500">center_focus_strong</span>
                        <span className="text-sm font-semibold text-[var(--color-text-main)] truncate">
                            {pinnedItems.find(i => i.id === selectedItemId)?.title || t('pinnedTasks.header.focusFallback')}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {/* Compact Actions */}
                        {selectedItemId && (
                            <>
                                <button
                                    onClick={() => {
                                        const item = pinnedItems.find(i => i.id === selectedItemId);
                                        if (item && item.projectId) {
                                            toggleModal();
                                            navigate(`/project/${item.projectId}/${item.type === 'issue' ? 'issues' : 'tasks'}/${item.id}`);
                                        }
                                    }}
                                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)] transition-colors"
                                    title={t('pinnedTasks.actions.openDetail')}
                                >
                                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                </button>
                                <button
                                    onClick={() => setFocusItem(focusItemId === selectedItemId ? null : selectedItemId)}
                                    className={`p-1.5 rounded-lg transition-colors ${focusItemId === selectedItemId ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}`}
                                    title={t('pinnedTasks.actions.toggleFocus')}
                                >
                                    <span className="material-symbols-outlined text-[18px]">{focusItemId === selectedItemId ? 'center_focus_strong' : 'center_focus_weak'}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        unpinItem(selectedItemId);
                                        if (pinnedItems.length <= 1) toggleModal();
                                    }}
                                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 transition-colors"
                                    title={t('pinnedTasks.actions.unpin')}
                                >
                                    <span className="material-symbols-outlined text-[18px]">keep_off</span>
                                </button>
                                <div className="w-[1px] h-4 bg-[var(--color-surface-border)] mx-1" />
                            </>
                        )}
                        <button
                            onClick={() => setIsCompactMode(false)}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)] transition-colors"
                            title={t('pinnedTasks.actions.expand')}
                        >
                            <span className="material-symbols-outlined text-[18px]">open_in_full</span>
                        </button>
                        <button
                            onClick={toggleModal}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 transition-colors"
                            title={t('pinnedTasks.actions.close')}
                        >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                </div>

                {/* Compact Content */}
                <div className="flex-1 p-4 overflow-y-auto">
                    <TaskDetailView
                        itemId={selectedItemId}
                        key={selectedItemId}
                        onComplete={handleItemCompletion}
                    />
                </div>

                {/* Edge Resize Handles */}
                {/* Right edge */}
                <div
                    className="absolute top-4 right-0 bottom-4 w-2 cursor-ew-resize hover:bg-[var(--color-primary)]/20 transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'e')}
                />
                {/* Left edge */}
                <div
                    className="absolute top-4 left-0 bottom-4 w-2 cursor-ew-resize hover:bg-[var(--color-primary)]/20 transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'w')}
                />
                {/* Bottom edge */}
                <div
                    className="absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize hover:bg-[var(--color-primary)]/20 transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 's')}
                />

                {/* Corner Resize Handles */}
                {/* Bottom Right */}
                <div
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                    onMouseDown={(e) => handleResizeStart(e, 'se')}
                >
                    <span className="material-symbols-outlined text-[12px] text-[var(--color-text-subtle)] rotate-[-45deg]">drag_handle</span>
                </div>
                {/* Bottom Left */}
                <div
                    className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize"
                    onMouseDown={(e) => handleResizeStart(e, 'sw')}
                />
                {/* Top Right */}
                <div
                    className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize"
                    onMouseDown={(e) => handleResizeStart(e, 'ne')}
                />
                {/* Top Left */}
                <div
                    className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize"
                    onMouseDown={(e) => handleResizeStart(e, 'nw')}
                />
            </div>
        );
    }

    // Full modal mode
    return (
        <div className="modal-overlay task-modal center-aligned" onClick={toggleModal}>
            <div
                className="pinned-tasks-layout"
                onClick={(e) => e.stopPropagation()}
                style={{ resize: 'both', overflow: 'hidden' }}
            >
                {/* Header Bar with close button */}
                <div className="modal-actions-header">
                    {selectedItemId && (
                        <>
                            <button
                                onClick={() => {
                                    const item = pinnedItems.find(i => i.id === selectedItemId);
                                    if (item && item.projectId) {
                                        toggleModal();
                                        navigate(`/project/${item.projectId}/${item.type === 'issue' ? 'issues' : 'tasks'}/${item.id}`);
                                    }
                                }}
                                className="action-btn"
                                title={t('pinnedTasks.actions.openDetail')}
                            >
                                <span className="material-symbols-outlined text-[18px] leading-none flex items-center justify-center">open_in_new</span>
                            </button>
                            <button
                                onClick={() => setFocusItem(focusItemId === selectedItemId ? null : selectedItemId)}
                                className={`action-btn ${focusItemId === selectedItemId ? 'active' : ''}`}
                                title={focusItemId === selectedItemId ? t('pinnedTasks.actions.unsetFocus') : t('pinnedTasks.actions.setFocus')}
                            >
                                <span className="material-symbols-outlined text-[18px] leading-none">{focusItemId === selectedItemId ? 'center_focus_strong' : 'center_focus_weak'}</span>
                            </button>
                            <button
                                onClick={() => {
                                    unpinItem(selectedItemId);
                                }}
                                className="action-btn danger"
                                title={t('pinnedTasks.actions.unpin')}
                            >
                                <span className="material-symbols-outlined text-[18px] leading-none">keep_off</span>
                            </button>
                            <div className="divider" />
                            <button
                                onClick={() => setIsCompactMode(true)}
                                className="action-btn"
                                title={t('pinnedTasks.actions.compactMode')}
                            >
                                <span className="material-symbols-outlined text-[18px] leading-none">picture_in_picture_alt</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={toggleModal}
                        className="action-btn danger"
                        title={t('pinnedTasks.actions.closeEsc')}
                    >
                        <span className="material-symbols-outlined text-[18px] leading-none">close</span>
                    </button>
                </div>

                {/* Sidebar List */}
                <div className="sidebar">
                    <div className="sidebar-header">
                        <h2>
                            <span className="material-symbols-outlined text-[var(--color-primary)]">push_pin</span>
                            {t('pinnedTasks.header.quickAccess')}
                        </h2>
                        <span className="shortcut-badge">⌘+Shift+F</span>
                    </div>

                    {/* Filter Tabs */}
                    <div className="filter-tabs">
                        {(['all', 'task', 'issue'] as const).map(tab => {
                            const count = tab === 'all' ? pinnedItems.length : pinnedItems.filter(i => i.type === tab || (tab === 'task' && i.type === 'personal-task')).length;
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setPinnedFilter(tab)}
                                    className={pinnedFilter === tab ? 'active' : ''}
                                >
                                    {filterLabels[tab]} ({count})
                                </button>
                            );
                        })}
                    </div>

                    <div className="pinned-list">
                        {pinnedItems.filter(i => pinnedFilter === 'all' || i.type === pinnedFilter || (pinnedFilter === 'task' && i.type === 'personal-task')).length === 0 && (
                            <div className="text-center p-8 text-[var(--color-text-muted)] text-sm">
                                {pinnedFilter === 'all'
                                    ? t('pinnedTasks.empty.all')
                                    : pinnedFilter === 'task'
                                        ? t('pinnedTasks.empty.tasks')
                                        : t('pinnedTasks.empty.issues')}
                            </div>
                        )}

                        {pinnedItems.filter(i => pinnedFilter === 'all' || i.type === pinnedFilter || (pinnedFilter === 'task' && i.type === 'personal-task')).map(item => {
                            const isFocus = item.id === focusItemId;
                            const isSelected = item.id === selectedItemId;
                            const isIssue = item.type === 'issue';
                            const isCompleting = completingItems.includes(item.id);
                            const isAdding = addingItems.includes(item.id);

                            // Skip rendering if completing (handled by state removal in logic, but visual hide here)
                            if (isCompleting) return null;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedItemId(item.id)}
                                    className={`pinned-item-btn ${isSelected ? 'selected' : ''} ${isAdding ? 'adding' : ''}`}
                                >
                                    <div className={`icon-box ${isFocus ? 'focused' : ''}`}>
                                        <span className={`material-symbols-outlined text-[18px] ${!isFocus ? (isIssue ? 'text-indigo-500' : 'text-cyan-500') : ''}`}>
                                            {isIssue ? 'bug_report' : 'task_alt'}
                                        </span>
                                        {isFocus && <div className="indicator-dot" />}
                                    </div>
                                    <div className="item-content">
                                        <p className={`item-title ${isFocus ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                                            {item.title}
                                        </p>
                                        <div className="item-meta">
                                            <span className="badge" style={{
                                                backgroundColor: isFocus ? 'rgba(245, 158, 11, 0.1)' : (isIssue ? 'rgba(99, 102, 241, 0.1)' : 'rgba(6, 182, 212, 0.1)'),
                                                color: isFocus ? '#d97706' : (isIssue ? '#4f46e5' : '#0891b2')
                                            }}>
                                                {itemTypeLabels[item.type] || item.type}
                                            </span>

                                            {item.priority && (
                                                <span className="text-[9px] font-medium text-[var(--color-text-muted)]">
                                                    • {priorityLabels[item.priority] || item.priority}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Delete Button (Hover) */}
                                    <div
                                        className="delete-action"
                                        onClick={(e) => handleDeleteTask(e, item)}
                                        title={t('pinnedTasks.actions.delete')}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Add Personal Task Input */}
                    <div className="add-personal-task-section">
                        {isCreatingTask && (
                            <div className="progress-bar">
                                <div className="bar" />
                            </div>
                        )}

                        <div className="input-wrapper group">
                            <input
                                type="text"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreatePersonalTask();
                                }}
                                placeholder={t('pinnedTasks.placeholder.addPersonalTask')}
                                disabled={isCreatingTask}
                            />
                            <div className="icon-container">
                                {isCreatingTask ? (
                                    <div className="size-4 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" />
                                ) : (
                                    <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">
                                        add_circle
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--color-text-subtle)] px-2 flex justify-between items-center">
                            <span>
                                {pressEnterPrefix}
                                <kbd className="font-mono bg-[var(--color-surface-card)] px-1 rounded">Enter</kbd>
                                {pressEnterSuffix}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main Content (Clipboard) */}
                <div className="main-content-area">
                    {selectedItemId && !completingItems.includes(selectedItemId) ? (
                        <TaskDetailView
                            itemId={selectedItemId}
                            key={selectedItemId}
                            onComplete={handleItemCompletion}
                        />
                    ) : (
                        <div className="empty-state">
                            <span className="material-symbols-outlined icon">checklist</span>
                            <p>{t('pinnedTasks.empty.selectItem')}</p>
                        </div>
                    )}
                </div>

                {/* Close Button Mobile - Removed */}
            </div>
        </div>
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
    const { t } = useLanguage();
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

    const priorityLabels: Record<string, string> = {
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low')
    };

    return (
        <span className={`flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles[priority] || styles['Medium']}`}>
            <span className="material-symbols-outlined text-[11px]">{icons[priority] || 'drag_handle'}</span>
            <span>{priorityLabels[priority] || priority}</span>
        </span>
    );
};
