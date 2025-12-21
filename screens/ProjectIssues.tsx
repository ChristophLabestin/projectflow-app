import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Issue } from '../types';
import { createIssue, subscribeProjectIssues, updateIssue, deleteIssue, addTask } from '../services/dataService';
import { Badge } from '../components/ui/Badge';
import { toMillis } from '../utils/time';
import { Link } from 'react-router-dom';
import { AssigneeSelector } from '../components/AssigneeSelector';

export const ProjectIssues = () => {
    const { id } = useParams<{ id: string }>();
    const [issues, setIssues] = useState<Issue[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [priority, setPriority] = useState<Issue['priority']>('Medium');
    const [status, setStatus] = useState<Issue['status']>('Open');
    const [assigneeId, setAssigneeId] = useState('');
    const [assigneeName, setAssigneeName] = useState('');

    useEffect(() => {
        if (!id) return;
        const unsub = subscribeProjectIssues(id, setIssues);
        return () => unsub();
    }, [id]);

    const handleSubmit = async () => {
        if (!id || !title) return;
        setLoading(true);
        try {
            await createIssue(id, {
                title,
                description: desc,
                priority,
                status,
                assignee: assigneeName,
                assigneeId
            });
            setShowModal(false);
            resetForm();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDesc('');
        setPriority('Medium');
        setStatus('Open');
        setStatus('Open');
        setAssigneeId('');
        setAssigneeName('');
    };

    const handleStatusChange = async (issue: Issue, newStatus: Issue['status']) => {
        if (!id) return;
        await updateIssue(issue.id, { status: newStatus }, id);
    };

    const handleDelete = async (issueId: string) => {
        if (!id || !confirm('Delete this issue?')) return;
        await deleteIssue(issueId, id);
    };

    const handleConvertToTask = async (issue: Issue) => {
        if (!id || !confirm(`Convert "${issue.title}" to a task? This will close the issue.`)) return;
        try {
            await addTask(id, issue.title, undefined, issue.assignee, issue.priority, {
                description: `[From Issue] ${issue.description}`,
                status: 'Open'
            });
            await updateIssue(issue.id, { status: 'Closed' }, id);
            // Optional: Notification or toast here
        } catch (e) {
            console.error("Failed to convert issue", e);
            alert("Failed to convert issue to task.");
        }
    };

    const getPriorityBadgeVariant = (p: string) => {
        if (p === 'Urgent') return 'error';
        if (p === 'High') return 'warning';
        if (p === 'Medium') return 'default';
        return 'success';
    };

    const getStatusBadgeVariant = (s: string) => {
        if (s === 'Open') return 'primary';
        if (s === 'In Progress') return 'warning';
        if (s === 'Resolved') return 'success';
        return 'secondary';
    };

    const openCount = issues.filter(i => i.status === 'Open').length;
    const progressCount = issues.filter(i => i.status === 'In Progress').length;
    const resolvedCount = issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;

    return (
        <div className="max-w-6xl mx-auto space-y-6 fade-in p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="h2 text-[var(--color-text-main)]">Issues</h1>
                    <p className="text-[var(--color-text-muted)]">Track, prioritize, and resolve project bugs.</p>
                </div>
                <Button onClick={() => setShowModal(true)} icon={<span className="material-symbols-outlined">add</span>}>Report Issue</Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card padding="sm" className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-[var(--color-text-muted)] uppercase">Open</p>
                        <p className="text-3xl font-bold text-blue-600">{openCount}</p>
                    </div>
                    <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <span className="material-symbols-outlined">bug_report</span>
                    </div>
                </Card>
                <Card padding="sm" className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-[var(--color-text-muted)] uppercase">In Progress</p>
                        <p className="text-3xl font-bold text-amber-600">{progressCount}</p>
                    </div>
                    <div className="size-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                        <span className="material-symbols-outlined">pending_actions</span>
                    </div>
                </Card>
                <Card padding="sm" className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-[var(--color-text-muted)] uppercase">Resolved</p>
                        <p className="text-3xl font-bold text-emerald-600">{resolvedCount}</p>
                    </div>
                    <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <span className="material-symbols-outlined">check_circle</span>
                    </div>
                </Card>
            </div>

            {issues.length === 0 ? (
                <Card className="p-12 text-center border-dashed flex flex-col items-center justify-center gap-4">
                    <div className="size-16 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-[var(--color-text-subtle)]">bug_report</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[var(--color-text-main)]">No issues yet</h3>
                        <p className="text-[var(--color-text-muted)]">Everything seems to be running smoothly.</p>
                    </div>
                    <Button variant="secondary" onClick={() => setShowModal(true)}>Report Issue</Button>
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--color-surface-border)] bg-[var(--color-surface-hover)]">
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Issue</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Priority</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Assignee</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-surface-border)] bg-[var(--color-surface-bg)]">
                                {issues.map((issue) => (
                                    <tr key={issue.id} className="hover:bg-[var(--color-surface-hover)] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <Link to={`/project/${id}/issues/${issue.id}`} className="font-semibold text-[var(--color-text-main)] hover:text-[var(--color-primary)] hover:underline">
                                                    {issue.title}
                                                </Link>
                                                <span className="text-xs text-[var(--color-text-muted)] line-clamp-1">{issue.description || 'No description'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <select
                                                className="text-xs font-medium rounded-full px-2 py-1 border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none cursor-pointer hover:bg-[var(--color-surface-hover)]"
                                                value={issue.status}
                                                onChange={(e) => handleStatusChange(issue, e.target.value as any)}
                                            >
                                                <option>Open</option>
                                                <option>In Progress</option>
                                                <option>Resolved</option>
                                                <option>Closed</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge size="sm" variant={getPriorityBadgeVariant(issue.priority)}>{issue.priority}</Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-muted)]">
                                            {issue.assignee ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="size-6 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-xs font-bold">
                                                        {issue.assignee.charAt(0)}
                                                    </div>
                                                    <span>{issue.assignee}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[var(--color-text-subtle)]">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-[var(--color-text-muted)]">
                                            {new Date(toMillis(issue.createdAt)).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleConvertToTask(issue)}
                                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] p-1"
                                                    title="Convert to Task"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">task_alt</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(issue.id)}
                                                    className="text-[var(--color-text-muted)] hover:text-rose-600 p-1"
                                                    title="Delete Issue"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Report New Issue">
                <div className="space-y-4">
                    <Input label="Issue Title" placeholder="What's the problem?" value={title} onChange={e => setTitle(e.target.value)} autoFocus />

                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Priority" value={priority} onChange={e => setPriority(e.target.value as any)}>
                            <option>Low</option>
                            <option>Medium</option>
                            <option>High</option>
                            <option>Urgent</option>
                        </Select>
                        <Select label="Status" value={status} onChange={e => setStatus(e.target.value as any)}>
                            <option>Open</option>
                            <option>In Progress</option>
                            <option>Resolved</option>
                            <option>Closed</option>
                        </Select>
                    </div>

                    <AssigneeSelector
                        projectId={id || ''}
                        value={assigneeId}
                        onChange={(uid, name) => { setAssigneeId(uid); setAssigneeName(name || ''); }}
                    />

                    <Textarea
                        label="Description"
                        placeholder="Describe the issue in detail..."
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        rows={5}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} loading={loading}>Create Issue</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
