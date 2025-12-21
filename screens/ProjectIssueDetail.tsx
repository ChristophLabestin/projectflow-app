import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getProjectById, subscribeProjectIssues, updateIssue, deleteIssue, addTask } from '../services/dataService';
import { Issue, Project } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { CommentSection } from '../components/CommentSection';
import { AssigneeSelector } from '../components/AssigneeSelector';
import { toMillis } from '../utils/time';

export const ProjectIssueDetail = () => {
    const { id, issueId } = useParams<{ id: string; issueId: string }>();
    const navigate = useNavigate();
    const [issue, setIssue] = useState<Issue | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id || !issueId) return;

        getProjectById(id).then(setProject);

        const unsub = subscribeProjectIssues(id, (issues) => {
            const found = issues.find(i => i.id === issueId);
            setIssue(found || null);
            setLoading(false);
        });
        return () => unsub();
    }, [id, issueId]);

    const [showConvertModal, setShowConvertModal] = useState(false);
    const [convertLoading, setConvertLoading] = useState(false);

    const handleUpdateStatus = async (newStatus: Issue['status']) => {
        if (!issue || !id) return;
        await updateIssue(issue.id, { status: newStatus }, id);
    };

    const handleAssign = async (uid: string, name?: string) => {
        if (!issue || !id) return;
        await updateIssue(issue.id, { assigneeId: uid, assignee: name || 'User' }, id);
    };

    const handleDelete = async () => {
        if (!issue || !id || !confirm('Delete this issue?')) return;
        await deleteIssue(issue.id, id);
        navigate(`/project/${id}/issues`);
    };

    const handleConvertToTask = async () => {
        if (!issue || !id) return;
        setConvertLoading(true);
        try {
            await addTask(
                id,
                issue.title,
                undefined,
                issue.assignee, // Legacy fallback
                issue.priority,
                {
                    description: `[From Issue] ${issue.description}`,
                    status: 'Open',
                    assigneeId: issue.assigneeId
                },
                project?.tenantId // Pass tenantId if available
            );
            // We should also update the task with the assigneeId if addTask doesn't handle it yet in signature
            // But addTask takes `assignee` string. 
            // Ideally we update it immediately after or fix addTask signature.
            // For now, relies on logic inside addTask or subsequent update.
            // Actually, let's just make sure we pass the right string.

            await updateIssue(issue.id, { status: 'Closed' }, id);
            navigate(`/project/${id}/tasks`);
        } catch (e) {
            console.error(e);
            alert("Failed to convert.");
        } finally {
            setConvertLoading(false);
            setShowConvertModal(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><span className="material-symbols-outlined animate-spin text-3xl text-gray-400">progress_activity</span></div>;
    if (!issue) return <div className="p-8">Issue not found.</div>;

    const priorityColors: Record<string, string> = {
        Urgent: 'bg-rose-100 text-rose-700 border-rose-200',
        High: 'bg-amber-100 text-amber-700 border-amber-200',
        Medium: 'bg-blue-100 text-blue-700 border-blue-200',
        Low: 'bg-slate-100 text-slate-600 border-slate-200'
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6 fade-in">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-1">
                        <Link to={`/project/${id}/issues`} className="hover:underline">Issues</Link>
                        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                        <span>{issue.id.slice(0, 6)}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-main)]">{issue.title}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${priorityColors[issue.priority] || 'bg-slate-100'}`}>
                            {issue.priority}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${issue.status === 'Open' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            issue.status === 'Resolved' ? 'bg-green-50 text-green-700 border-green-200' :
                                'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                            {issue.status}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)] ml-2">Reported {toMillis(issue.createdAt) ? new Date(toMillis(issue.createdAt)).toLocaleDateString() : ''}</span>
                    </div>
                </div>

                <div className="flex flex-col gap-2 items-end">
                    <Button variant="secondary" size="sm" onClick={() => setShowConvertModal(true)} icon={<span className="material-symbols-outlined">task_alt</span>}>Convert to Task</Button>
                    <Button variant="danger" size="sm" onClick={handleDelete} icon={<span className="material-symbols-outlined">delete</span>}>Delete</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="app-card p-6">
                        <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase mb-2">Description</h3>
                        <p className="text-[var(--color-text-main)] whitespace-pre-wrap leading-relaxed">
                            {issue.description || "No description provided."}
                        </p>
                    </div>

                    <div className="app-card overflow-hidden">
                        <CommentSection projectId={id || ''} targetId={issueId || ''} targetType="issue" />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="app-card p-4 space-y-4">
                        <h3 className="text-sm font-bold text-[var(--color-text-main)]">Actions</h3>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase ml-1">Status</label>
                            <select
                                value={issue.status}
                                onChange={(e) => handleUpdateStatus(e.target.value as any)}
                                className="w-full h-10 px-3 rounded-xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            >
                                <option>Open</option>
                                <option>In Progress</option>
                                <option>Resolved</option>
                                <option>Closed</option>
                            </select>
                        </div>

                        <AssigneeSelector
                            projectId={id || ''}
                            value={issue.assigneeId}
                            onChange={handleAssign}
                        />
                    </div>
                </div>
            </div>

            <Modal isOpen={showConvertModal} onClose={() => setShowConvertModal(false)} title="Convert to Task">
                <div className="space-y-4">
                    <p className="text-sm text-[var(--color-text-muted)]">
                        This will create a new task with the same title and description, and mark this issue as <strong>Closed</strong>.
                    </p>
                    <div className="bg-[var(--color-surface-hover)] p-3 rounded-lg text-sm border border-[var(--color-surface-border)]">
                        <p className="font-bold">{issue.title}</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">Assignee: {issue.assignee || 'Unassigned'}</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setShowConvertModal(false)}>Cancel</Button>
                        <Button onClick={handleConvertToTask} loading={convertLoading}>Convert Issue</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
