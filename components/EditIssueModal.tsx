import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Issue } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { MultiAssigneeSelector } from './MultiAssigneeSelector';
import { updateIssue } from '../services/dataService';

interface EditIssueModalProps {
    issue: Issue;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

export const EditIssueModal: React.FC<EditIssueModalProps> = ({ issue, isOpen, onClose, onUpdate }) => {
    const [title, setTitle] = useState(issue.title);
    const [description, setDescription] = useState(issue.description || '');
    const [assigneeIds, setAssigneeIds] = useState<string[]>(issue.assigneeIds || (issue.assigneeId ? [issue.assigneeId] : []));
    const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>(issue.assignedGroupIds || []);
    const [startDate, setStartDate] = useState(issue.startDate || '');
    const [dueDate, setDueDate] = useState(issue.dueDate || issue.scheduledDate || '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTitle(issue.title);
            setDescription(issue.description || '');
            setAssigneeIds(issue.assigneeIds || (issue.assigneeId ? [issue.assigneeId] : []));
            setAssignedGroupIds(issue.assignedGroupIds || []);
            setStartDate(issue.startDate || '');
            setDueDate(issue.dueDate || issue.scheduledDate || '');
        }
    }, [isOpen, issue]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateIssue(issue.id, {
                title,
                description,
                assigneeIds,
                assignedGroupIds,
                startDate: startDate || undefined,
                dueDate: dueDate || undefined
            }, issue.projectId, issue.tenantId);
            onUpdate();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-card rounded-xl shadow-2xl animate-scale-up border border-surface flex flex-col max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-surface flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-main">Edit Issue</h3>
                        <p className="text-sm text-muted mt-1">Update issue details. Changes will sync to GitHub if linked.</p>
                    </div>
                    <Button variant="ghost" onClick={onClose} size="sm">Close</Button>
                </div>

                <form onSubmit={handleSave} className="p-6">
                    <div className="flex flex-col gap-6">
                        <Input
                            label="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Issue title"
                            required
                            className="text-lg font-medium"
                        />

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Description</label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the issue..."
                                rows={8}
                                className="min-h-[200px]"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Assignees</label>
                            <MultiAssigneeSelector
                                projectId={issue.projectId}
                                assigneeIds={assigneeIds}
                                assignedGroupIds={assignedGroupIds}
                                onChange={setAssigneeIds}
                                onGroupChange={setAssignedGroupIds}
                            />
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-surface border border-surface text-sm text-main outline-none focus:border-[var(--color-accent)] transition-colors"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">Due Date</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-surface border border-surface text-sm text-main outline-none focus:border-[var(--color-accent)] transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-surface">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                        <Button type="submit" isLoading={loading} disabled={!title.trim()}>Save Changes</Button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
