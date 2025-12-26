import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { subscribeProjectIssues, getProjectById, createIssue, subscribeTenantUsers } from '../services/dataService';
import { subscribeProjectGroups } from '../services/projectGroupService';
import { Issue, Project, Member, ProjectGroup } from '../types';
import { auth } from '../services/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { toMillis } from '../utils/time';
import { MultiAssigneeSelector } from '../components/MultiAssigneeSelector';
import { usePinnedTasks } from '../context/PinnedTasksContext';

export const ProjectIssues = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'Active' | 'Resolved' | 'All'>('Active');
    const [search, setSearch] = useState('');
    const [project, setProject] = useState<Project | null>(null);
    const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
    const [allUsers, setAllUsers] = useState<Member[]>([]);
    const { pinItem, unpinItem, isPinned } = usePinnedTasks();

    // Modal State
    const [showNewIssueModal, setShowNewIssueModal] = useState(false);

    // New Issue Form State
    const [newIssueTitle, setNewIssueTitle] = useState('');
    const [newIssueDescription, setNewIssueDescription] = useState('');
    const [newIssuePriority, setNewIssuePriority] = useState<Issue['priority']>('Medium');
    const [newIssueAssigneeIds, setNewIssueAssigneeIds] = useState<string[]>([]);
    const [newIssueGroupIds, setNewIssueGroupIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const user = auth.currentUser;

    useEffect(() => {
        if (!id) return;

        let mounted = true;
        let unsubIssues: (() => void) | undefined;
        let unsubUsers: (() => void) | undefined;

        getProjectById(id).then((foundProject) => {
            if (!mounted || !foundProject) {
                if (mounted) setLoading(false);
                return;
            }

            setProject(foundProject);

            unsubIssues = subscribeProjectIssues(id, (loadedIssues) => {
                if (mounted) {
                    setIssues(loadedIssues);
                    setLoading(false);
                }
                if (mounted) {
                    setIssues(loadedIssues);
                    setLoading(false);
                }
            }, foundProject.tenantId);

            const unsubGroups = subscribeProjectGroups(id, setProjectGroups, foundProject.tenantId);

            if (foundProject.tenantId) {
                unsubUsers = subscribeTenantUsers((users) => {
                    if (mounted) setAllUsers(users as Member[]);
                }, foundProject.tenantId);
            }
        }).catch((err) => {
            console.error("Failed to load project for issues", err);
            if (mounted) setLoading(false);
        });

        return () => {
            mounted = false;
            mounted = false;
            if (unsubIssues) unsubIssues();
            unsubGroups();
            if (unsubUsers) unsubUsers();
        };
    }, [id]);

    const handleCreateIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !id || !project || !newIssueTitle.trim()) return;

        setSubmitting(true);
        try {
            await createIssue(id, {
                title: newIssueTitle.trim(),
                description: newIssueDescription.trim(),
                priority: newIssuePriority,
                priority: newIssuePriority,
                assigneeIds: newIssueAssigneeIds,
                assignedGroupIds: newIssueGroupIds,
            }, project.tenantId);
            setShowNewIssueModal(false);
            resetForm();
        } catch (error) {
            console.error("Error creating issue:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setNewIssueTitle('');
        setNewIssueDescription('');
        setNewIssuePriority('Medium');
        setNewIssuePriority('Medium');
        setNewIssueAssigneeIds([]);
        setNewIssueGroupIds([]);
    }

    const filteredIssues = useMemo(() => {
        return issues.filter(i => {
            const matchesSearch = i.title.toLowerCase().includes(search.toLowerCase()) ||
                (i.description?.toLowerCase().includes(search.toLowerCase()));

            if (!matchesSearch) return false;

            if (filter === 'Active') return i.status !== 'Closed' && i.status !== 'Resolved';
            if (filter === 'Resolved') return i.status === 'Resolved' || i.status === 'Closed';
            return true;
        });
    }, [issues, filter, search]);

    const stats = useMemo(() => ({
        open: issues.filter(i => i.status === 'Open').length,
        inProgress: issues.filter(i => i.status === 'In Progress').length,
        resolved: issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length,
        urgent: issues.filter(i => (i.priority === 'Urgent' || i.priority === 'High') && i.status !== 'Closed' && i.status !== 'Resolved').length
    }), [issues]);

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-primary)] animate-spin text-4xl">progress_activity</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 fade-in max-w-5xl mx-auto pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="h2 text-[var(--color-text-main)]">Issues</h1>
                    <p className="text-[var(--color-text-muted)] text-sm">Track and resolve project bugs and improvements.</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Active', value: stats.open + stats.inProgress, icon: 'bug_report', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                    { label: 'Resolved', value: stats.resolved, icon: 'check_circle', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                    { label: 'Urgent', value: stats.urgent, icon: 'priority_high', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/10' },
                    { label: 'Total', value: issues.length, icon: 'analytics', color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/10' },
                ].map((stat, idx) => (
                    <Card key={idx} className="p-4 flex items-center gap-3">
                        <div className={`size-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                            <span className="material-symbols-outlined text-[20px]">{stat.icon}</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{stat.label}</p>
                            <p className="text-xl font-bold text-[var(--color-text-main)] leading-tight">{stat.value}</p>
                        </div>
                    </Card>
                ))}
            </div>

            <Card padding="none" className="overflow-visible">
                {/* Search & Filters */}
                <div className="p-4 border-b border-[var(--color-surface-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex bg-[var(--color-surface-hover)] rounded-lg p-1">
                        {(['Active', 'Resolved', 'All'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`
                                    px-4 py-1.5 rounded-md text-sm font-medium transition-all
                                    ${filter === f ? 'bg-[var(--color-surface-paper)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}
                                `}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search issues..."
                            className="w-full sm:w-64"
                            icon={<span className="material-symbols-outlined">search</span>}
                        />
                    </div>
                </div>

                {/* Issues List */}
                <div className="flex flex-col gap-2 p-2">
                    {filteredIssues.length === 0 ? (
                        <div className="p-16 text-center flex flex-col items-center justify-center text-[var(--color-text-muted)] border-2 border-dashed border-[var(--color-surface-border)] rounded-2xl m-2">
                            <div className="size-16 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-4xl opacity-20">bug_report</span>
                            </div>
                            <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-1">No issues found</h3>
                            <p className="text-sm">Try adjusting your filters or search terms.</p>
                        </div>
                    ) : (
                        filteredIssues.map(issue => (
                            <div
                                key={issue.id}
                                onClick={() => navigate(`/project/${id}/issues/${issue.id}`)}
                                className="group flex items-start gap-4 p-4 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer"
                            >
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded">
                                                    #{issue.id.slice(0, 6).toUpperCase()}
                                                </span>
                                                <span className={`text-sm font-semibold leading-tight group-hover:text-[var(--color-primary)] transition-colors ${issue.status === 'Closed' || issue.status === 'Resolved' ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'}`}>
                                                    {issue.title}
                                                </span>
                                            </div>
                                            {issue.description && (
                                                <p className="text-xs text-[var(--color-text-muted)] line-clamp-1">
                                                    {issue.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <Badge size="sm" variant={issue.status === 'Open' ? 'primary' : issue.status === 'Resolved' ? 'success' : 'secondary'}>
                                            <span className="material-symbols-outlined text-[12px] mr-1">
                                                {issue.status === 'Open' ? 'error' : issue.status === 'Resolved' ? 'check_circle' : 'cancel'}
                                            </span>
                                            {issue.status}
                                        </Badge>

                                        <PriorityBadge priority={issue.priority} />

                                        <div className="flex -space-x-2">
                                            {(issue.assigneeIds || []).slice(0, 3).map(uid => {
                                                const member = allUsers.find(u => u.uid === uid || (u as any).id === uid);
                                                return (
                                                    <img
                                                        key={uid}
                                                        src={member?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
                                                        className="size-5 rounded-full ring-2 ring-[var(--color-surface-bg)]"
                                                        title={member?.displayName || 'Unknown'}
                                                    />
                                                );
                                            })}
                                            {issue.assigneeIds && issue.assigneeIds.length > 3 && (
                                                <div className="size-5 rounded-full bg-[var(--color-surface-hover)] ring-2 ring-[var(--color-surface-bg)] flex items-center justify-center text-[8px] font-bold text-[var(--color-text-muted)]">
                                                    +{issue.assigneeIds.length - 3}
                                                </div>
                                            )}
                                            {(!issue.assigneeIds || issue.assigneeIds.length === 0) && !issue.assignee && (
                                                <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">person_off</span>
                                                </span>
                                            )}
                                            {issue.assignedGroupIds && issue.assignedGroupIds.length > 0 && (
                                                <div className="flex -space-x-2 ml-1">
                                                    {issue.assignedGroupIds.map(gid => {
                                                        const group = projectGroups.find(g => g.id === gid);
                                                        if (!group) return null;
                                                        return (
                                                            <div
                                                                key={gid}
                                                                className="size-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm ring-2 ring-[var(--color-surface-bg)]"
                                                                style={{ backgroundColor: group.color }}
                                                                title={`Group: ${group.name}`}
                                                            >
                                                                {group.name.substring(0, 1).toUpperCase()}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] ml-auto">
                                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                            {new Date(toMillis(issue.createdAt)).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                <div className={`flex items-center gap-2 self-center ${isPinned(issue.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isPinned(issue.id)) {
                                                unpinItem(issue.id);
                                            } else {
                                                pinItem({
                                                    id: issue.id,
                                                    type: 'issue',
                                                    title: issue.title,
                                                    projectId: id!,
                                                });
                                            }
                                        }}
                                        className={`
                                            p-1 rounded-full transition-all duration-200
                                            ${isPinned(issue.id)
                                                ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                                : 'text-[var(--color-text-subtle)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}
                                        `}
                                        title={isPinned(issue.id) ? "Unpin" : "Pin Issue"}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">{isPinned(issue.id) ? 'push_pin' : 'push_pin'}</span>
                                    </button>
                                    <span className="material-symbols-outlined text-[var(--color-text-subtle)]">chevron_right</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            {/* Create Issue Modal */}
            {showNewIssueModal && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-[var(--color-surface-border)] animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-[var(--color-text-main)]">Report New Issue</h2>
                            <button onClick={() => setShowNewIssueModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleCreateIssue} className="space-y-5">
                            <Input
                                label="Title"
                                value={newIssueTitle}
                                onChange={(e) => setNewIssueTitle(e.target.value)}
                                placeholder="Problem summary"
                                className="w-full"
                                required
                                autoFocus
                            />

                            <Textarea
                                label="Description"
                                value={newIssueDescription}
                                onChange={(e) => setNewIssueDescription(e.target.value)}
                                placeholder="Steps to reproduce, expected behavior, etc."
                                className="w-full min-h-[120px]"
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Select
                                    label="Priority"
                                    value={newIssuePriority}
                                    onChange={(e) => setNewIssuePriority(e.target.value as any)}
                                    className="w-full"
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                    <option value="Urgent">Urgent</option>
                                </Select>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase ml-1">Assignees</label>
                                    <MultiAssigneeSelector
                                        projectId={id!}
                                        assigneeIds={newIssueAssigneeIds}
                                        assignedGroupIds={newIssueGroupIds}
                                        onChange={setNewIssueAssigneeIds}
                                        onGroupChange={setNewIssueGroupIds}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 mt-2">
                                <Button type="button" variant="ghost" onClick={() => setShowNewIssueModal(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" isLoading={submitting}>
                                    Report Issue
                                </Button>
                            </div>
                        </form>
                    </div>
                </div >,
                document.body
            )}
        </div >
    );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
    const styles: Record<string, string> = {
        'Urgent': 'bg-rose-50 text-rose-700 border-rose-200',
        'High': 'bg-amber-50 text-amber-700 border-amber-200',
        'Medium': 'bg-blue-50 text-blue-700 border-blue-200',
        'Low': 'bg-slate-100 text-slate-700 border-slate-200',
    };

    const icons: Record<string, string> = {
        'Urgent': 'error',
        'High': 'keyboard_double_arrow_up',
        'Medium': 'drag_handle',
        'Low': 'keyboard_arrow_down',
    }

    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${styles[priority] || styles['Medium']}`}>
            <span className="material-symbols-outlined text-[12px]">{icons[priority]}</span>
            {priority}
        </span>
    );
};
