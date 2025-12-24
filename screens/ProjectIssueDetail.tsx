import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { getProjectById, subscribeProjectIssues, updateIssue, deleteIssue, addTask, getIssueById, getUserProfile, subscribeTenantUsers } from '../services/dataService';
import { Issue, Project } from '../types';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { CommentSection } from '../components/CommentSection';
import { MultiAssigneeSelector } from '../components/MultiAssigneeSelector';
import { fetchCommitsReferencingIssue, GithubCommit } from '../services/githubService';
import { toMillis, timeAgo } from '../utils/time';
import { auth } from '../services/firebase';
import { EditIssueModal } from '../components/EditIssueModal';

export const ProjectIssueDetail = () => {
    const { id, issueId } = useParams<{ id: string; issueId: string }>();
    const navigate = useNavigate();
    const [issue, setIssue] = useState<Issue | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [convertLoading, setConvertLoading] = useState(false);
    const [relatedCommits, setRelatedCommits] = useState<GithubCommit[]>([]);
    const [loadingCommits, setLoadingCommits] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [commentCount, setCommentCount] = useState(0);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [copiedId, setCopiedId] = useState(false);

    const isProjectOwner = useMemo(() => {
        return project?.ownerId === auth.currentUser?.uid;
    }, [project?.ownerId]);

    const { setTaskTitle } = useOutletContext<{ setTaskTitle: (title: string) => void }>();

    const loadIssue = async () => {
        if (!id || !issueId) return;
        try {
            const proj = await getProjectById(id);
            setProject(proj);
            const tId = proj?.tenantId;
            const directIssue = await getIssueById(issueId, id, tId);
            if (directIssue) {
                setIssue(directIssue);
                setLoading(false);
            }
        } catch (err) {
            console.error("Failed to load issue", err);
        }
    };

    useEffect(() => {
        if (!id || !issueId) return;

        let mounted = true;
        let unsub: (() => void) | undefined;

        const load = async () => {
            try {
                // First get the project to find the correct tenant
                const proj = await getProjectById(id);
                if (!mounted) return;
                setProject(proj);

                const tId = proj?.tenantId;

                // Subscribe to issues with the correct tenant
                unsub = subscribeProjectIssues(id, (issues) => {
                    if (!mounted) return;
                    const found = issues.find(i => i.id === issueId);
                    setIssue(found || null);
                    setLoading(false);
                }, tId);

                // Fallback: if subscription doesn't find it immediately (e.g. cold start), try direct fetch
                if (!issue) {
                    const directIssue = await getIssueById(issueId, id, tId);
                    if (mounted && directIssue) {
                        setIssue(directIssue);
                        setLoading(false);
                    }
                }
            } catch (err) {
                console.error("Failed to load issue detail", err);
                if (mounted) setLoading(false);
            }
        };

        load();

        return () => {
            mounted = false;
            if (unsub) unsub();
        };
    }, [id, issueId]);

    useEffect(() => {
        if (issue) {
            setTaskTitle(issue.title);
        }
    }, [issue, setTaskTitle]);

    useEffect(() => {
        if (!project?.tenantId) return;
        const unsub = subscribeTenantUsers((users) => {
            setAllUsers(users);
        }, project.tenantId);
        return () => unsub();
    }, [project?.tenantId]);

    useEffect(() => {
        if (issue?.githubIssueNumber && project?.githubRepo) {
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
                        issue.githubIssueNumber!
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
    }, [issue?.githubIssueNumber, project?.githubRepo]);

    const handleUpdateStatus = async (newStatus: Issue['status']) => {
        if (!issue || !id) return;
        await updateIssue(issue.id, { status: newStatus }, id, project?.tenantId);
    };

    const handleUpdateField = async (field: keyof Issue, value: any) => {
        if (!issue || !id) return;
        await updateIssue(issue.id, { [field]: value }, id, project?.tenantId);
    };

    const handleUpdateAssignees = async (ids: string[]) => {
        if (!issue || !id) return;
        const primaryId = ids.length > 0 ? ids[0] : '';
        await updateIssue(issue.id, { assigneeIds: ids, assigneeId: primaryId }, id, project?.tenantId);
    };

    const handleDelete = async () => {
        if (!issue || !id) return;
        setDeleting(true);
        try {
            await deleteIssue(issue.id, id, project?.tenantId);
            navigate(`/project/${id}/issues`);
        } catch (err) {
            console.error('Failed to delete issue', err);
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleConvertToTask = async () => {
        if (!issue || !id) return;
        setConvertLoading(true);
        try {
            const taskId = await addTask(
                id,
                issue.title,
                undefined,
                issue.assignee,
                issue.priority,
                {
                    description: `[From Issue] ${issue.description}`,
                    status: 'Open',
                    assigneeId: issue.assigneeId,
                    assigneeIds: issue.assigneeIds,
                    linkedIssueId: issue.id
                },
                project?.tenantId
            );

            await updateIssue(issue.id, {
                status: 'Closed',
                linkedTaskId: taskId
            }, id, project?.tenantId);

            navigate(`/project/${id}/tasks`);
        } catch (e) {
            console.error(e);
        } finally {
            setConvertLoading(false);
            setShowConvertModal(false);
        }
    };

    const { pinItem, unpinItem, isPinned } = usePinnedTasks();

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary)]">progress_activity</span>
                </div>
            </div>
        );
    }

    if (!issue) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <h3 className="text-xl font-bold text-[var(--color-text-main)]">Issue not found</h3>
                <Link to={`/project/${id}/issues`} className="btn-secondary">Return to Issues</Link>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 animate-fade-in pb-20">
            {isEditModalOpen && issue && (
                <EditIssueModal
                    issue={issue}
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onUpdate={loadIssue}
                />
            )}

            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-[var(--color-surface-border)]">
                        <div className="space-y-4 text-center">
                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">Delete Issue?</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                Are you sure you want to delete <strong>"{issue.title}"</strong>? This action cannot be undone.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                                <Button variant="danger" onClick={handleDelete} isLoading={deleting}>Delete</Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showConvertModal && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[var(--color-surface-border)]">
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-[var(--color-text-main)]">Convert to Task</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                This will create a new task with the same title and description, and mark this issue as <strong>Closed</strong>.
                            </p>
                            <div className="bg-[var(--color-surface-hover)] p-4 rounded-xl text-sm border border-[var(--color-surface-border)]">
                                <p className="font-bold text-[var(--color-text-main)]">{issue.title}</p>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1.5 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[14px]">group</span>
                                    {issue.assigneeIds && issue.assigneeIds.length > 0
                                        ? `${issue.assigneeIds.length} Assignees`
                                        : `Assignee: ${issue.assignee || 'Unassigned'}`}
                                </p>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="ghost" onClick={() => setShowConvertModal(false)}>Cancel</Button>
                                <Button onClick={handleConvertToTask} isLoading={convertLoading}>Convert Issue</Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Header / Hero Section */}
            <header className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] border border-[var(--color-surface-border)] shadow-sm">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />

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
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${issue.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    issue.status === 'Open' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                        'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                    }`}>
                                    <span className="material-symbols-outlined text-[14px] leading-none">
                                        {issue.status === 'Resolved' ? 'check_circle' :
                                            issue.status === 'Closed' ? 'cancel' :
                                                'error'}
                                    </span>
                                    {issue.status || 'Open'}
                                </span>
                                <PriorityBadge priority={issue.priority} />
                            </div>

                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--color-text-main)] leading-[1.1] tracking-tight mb-8">
                                {issue.title}
                            </h1>

                            <div className="flex flex-wrap items-center gap-6 text-sm">
                                <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-surface-border)]">
                                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">calendar_today</span>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] leading-none uppercase font-bold text-[var(--color-text-subtle)] mb-0.5">Reported</span>
                                        <span className="text-[var(--color-text-main)] font-semibold whitespace-nowrap">
                                            {issue.createdAt ? new Date(toMillis(issue.createdAt)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                                        </span>
                                    </div>
                                </div>

                                <div className="hidden md:flex items-center gap-3 ml-2">
                                    <div className="h-8 w-[1px] bg-[var(--color-surface-border)]" />
                                    <div className="flex -space-x-2">
                                        {(issue.assigneeIds || (issue.assigneeId ? [issue.assigneeId] : [])).filter(id => id).map((uid, i) => {
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
                                        {((!issue.assigneeIds || issue.assigneeIds.length === 0) && !issue.assigneeId) && (
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
                                    onClick={() => {
                                        if (isPinned(issue.id)) {
                                            unpinItem(issue.id);
                                        } else {
                                            pinItem({
                                                id: issue.id,
                                                type: 'issue',
                                                title: issue.title,
                                                projectId: id!,
                                                priority: issue.priority,
                                            });
                                        }
                                    }}
                                    className={`flex-1 lg:flex-none ${isPinned(issue.id) ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'hover:bg-[var(--color-surface-card)]'}`}
                                    icon={<span className="material-symbols-outlined text-[20px]">push_pin</span>}
                                >
                                    {isPinned(issue.id) ? 'Pinned' : 'Pin'}
                                </Button>
                                <div className="w-[1px] h-4 bg-[var(--color-surface-border)]" />
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
                                variant="primary"
                                onClick={() => setShowConvertModal(true)}
                                size="lg"
                                className="shadow-lg shadow-indigo-500/10 w-full lg:w-fit"
                                icon={<span className="material-symbols-outlined">task_alt</span>}
                            >
                                Convert to Task
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
                            {issue.description ? (
                                <div className="prose prose-sm max-w-none text-[var(--color-text-main)]">
                                    <p className="whitespace-pre-wrap leading-relaxed">{issue.description}</p>
                                </div>
                            ) : (
                                <p className="text-[var(--color-text-muted)] italic">No description provided.</p>
                            )}
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
                            targetId={issueId!}
                            targetType="issue"
                            tenantId={project?.tenantId}
                            isProjectOwner={isProjectOwner}
                            hideHeader={true}
                            onCountChange={setCommentCount}
                        />
                    </div>
                </div>

                {/* Sidebar / Meta Column */}
                <div className="lg:col-span-4 space-y-6">

                    {/* GitHub Integration Card */}
                    {issue.githubIssueNumber && (
                        <div className="app-card overflow-hidden">
                            <div className="p-4 flex items-center justify-between border-b border-[var(--color-surface-border)]">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[20px] text-indigo-500">terminal</span>
                                    <h3 className="text-sm font-bold text-[var(--color-text-main)] tracking-wide uppercase">GitHub Reference</h3>
                                </div>
                                <Badge variant="success" className="bg-emerald-500/20 text-emerald-400 border-none text-[10px]">SYNCED</Badge>
                            </div>
                            <div className="p-5 space-y-6">
                                <div>
                                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Linked Issue</p>
                                    <a
                                        href={issue.githubIssueUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] hover:border-[var(--color-primary)] transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 bg-white dark:bg-zinc-800 rounded-lg flex items-center justify-center border border-[var(--color-surface-border)]">
                                                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-[var(--color-text-main)]">Issue #{issue.githubIssueNumber}</p>
                                                <p className="text-[10px] text-[var(--color-text-muted)]">View on GitHub</p>
                                            </div>
                                        </div>
                                        <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)] group-hover:text-[var(--color-primary)] transition-colors">chevron_right</span>
                                    </a>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Related Commits</p>
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                                            {relatedCommits.length} Found
                                        </span>
                                    </div>

                                    {loadingCommits ? (
                                        <div className="flex items-center gap-2 py-2">
                                            <span className="material-symbols-outlined animate-spin text-[16px] text-[var(--color-primary)]">progress_activity</span>
                                            <span className="text-[11px] text-[var(--color-text-muted)]">Searching repository...</span>
                                        </div>
                                    ) : relatedCommits.length > 0 ? (
                                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                                            {relatedCommits.map(commit => (
                                                <a
                                                    key={commit.sha}
                                                    href={commit.html_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block p-2.5 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-paper)] hover:bg-[var(--color-surface-hover)] transition-all group"
                                                >
                                                    <p className="text-[11px] font-medium text-[var(--color-text-main)] line-clamp-1 group-hover:text-[var(--color-primary)]">
                                                        {commit.commit.message}
                                                    </p>
                                                    <div className="flex items-center justify-between mt-1.5">
                                                        <div className="flex items-center gap-1.5">
                                                            {commit.author?.avatar_url && (
                                                                <img src={commit.author.avatar_url} className="size-4 rounded-full border border-[var(--color-surface-border)]" alt="" />
                                                            )}
                                                            <span className="text-[9px] text-[var(--color-text-muted)]">@{commit.author?.login || 'unknown'}</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] font-mono text-[var(--color-text-subtle)]">{commit.sha.slice(0, 7)}</span>
                                                            <span className="text-[8px] text-[var(--color-text-subtle)]">{timeAgo(commit.commit.author.date)}</span>
                                                        </div>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-4 text-center bg-[var(--color-surface-hover)]/50 rounded-xl border border-dashed border-[var(--color-surface-border)]">
                                            <p className="text-[10px] text-[var(--color-text-muted)]">No commits found referencing this issue.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Status Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Status</h3>
                        <div className="relative">
                            <Select
                                value={issue.status}
                                onChange={(e) => handleUpdateStatus(e.target.value as any)}
                                className="w-full"
                            >
                                <option value="Open">Open</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Resolved">Resolved</option>
                                <option value="Closed">Closed</option>
                            </Select>
                        </div>
                    </div>

                    {/* Assignees Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Assignees</h3>
                        <MultiAssigneeSelector
                            projectId={id!}
                            assigneeIds={issue.assigneeIds || (issue.assigneeId ? [issue.assigneeId] : [])}
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
                                        ${issue.priority === p
                                            ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] shadow-sm'
                                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-2">
                                        <PriorityIcon priority={p} />
                                        {p}
                                    </div>
                                    {issue.priority === p && <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Meta Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Issue Details</h3>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Issue ID</span>
                                <div className="group relative">
                                    <code className="block w-full text-[11px] font-mono text-[var(--color-text-main)] bg-[var(--color-surface-hover)] p-2 rounded-lg border border-[var(--color-surface-border)] break-all truncate hover:whitespace-normal transition-all cursor-pointer" title="Click to copy ID" onClick={() => {
                                        navigator.clipboard.writeText(issue.id);
                                        setCopiedId(true);
                                        setTimeout(() => setCopiedId(false), 2000);
                                    }}>
                                        {issue.id}
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
                                    <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Reported</span>
                                    <span className="text-xs font-semibold text-[var(--color-text-main)] flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">history</span>
                                        {issue.createdAt ? new Date(toMillis(issue.createdAt)).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                                    </span>
                                </div>

                                {issue.ownerId && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Reporter</span>
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={allUsers.find(u => (u as any).id === issue.ownerId || u.uid === issue.ownerId)?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
                                                className="size-5 rounded-full border border-[var(--color-surface-border)]"
                                                alt=""
                                            />
                                            <span className="text-xs font-semibold text-[var(--color-text-main)]">
                                                {allUsers.find(u => (u as any).id === issue.ownerId || u.uid === issue.ownerId)?.displayName || 'Unknown User'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-3 border-t border-[var(--color-surface-border)] flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Status</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${issue.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                        issue.status === 'Open' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                            'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                        }`}>
                                        {issue.status}
                                    </span>
                                </div>

                                {issue.linkedTaskId && (
                                    <div className="pt-3 border-t border-[var(--color-surface-border)]">
                                        <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase block mb-1">Related Task</span>
                                        <Link to={`/project/${id}/tasks/${issue.linkedTaskId}`} className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[16px]">task_alt</span>
                                            View Task
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
