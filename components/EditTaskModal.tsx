import React, { useState, useEffect } from 'react';
import { Task, Member } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { updateTaskFields, getUserProfile } from '../services/dataService';

interface EditTaskModalProps {
    task: Task;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
    projectMembers: string[]; // List of UIDs
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({ task, isOpen, onClose, onUpdate, projectMembers }) => {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || '');
    const [dueDate, setDueDate] = useState(task.dueDate || '');
    const [assigneeId, setAssigneeId] = useState(task.assigneeId || '');
    // We will try to resolve assignee names if possible, or just show IDs/generic for now if we don't have member details.
    // Ideally we pass member objects. For this iteration, let's assume we might just show "Member 1", "Member 2" or rely on a fetched map.
    // Wait, the prompt implies "fields for the task".
    // I will fetch member details roughly or just input/select if I can.

    // Simplification: Text input for assignee for now? Or Select if we have members. 
    // `projectMembers` is passed as UIDs. I'll fetch them on mount.
    const [memberDetails, setMemberDetails] = useState<{ uid: string, displayName: string }[]>([]);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTitle(task.title);
            setDescription(task.description || '');
            setDueDate(task.dueDate || '');
            setAssigneeId(task.assigneeId || '');

            // Fetch member details
            if (projectMembers.length) {
                Promise.all(projectMembers.map(uid => getUserProfile(uid).catch(() => null)))
                    .then(users => {
                        const valid = users.filter((u): u is any => !!u).map((u: any) => ({
                            uid: u.uid || u.id,
                            displayName: u.displayName || u.email || 'Unknown'
                        }));
                        setMemberDetails(valid);
                    });
            }
        }
    }, [isOpen, task, projectMembers]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateTaskFields(task.id, {
                title,
                description,
                dueDate,
                assigneeId
            }, task.projectId);
            onUpdate();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-[var(--color-surface-card)] rounded-xl shadow-2xl overflow-hidden animate-scale-up border border-[var(--color-surface-border)]">
                <div className="p-4 border-b border-[var(--color-surface-border)] flex justify-between items-center bg-[var(--color-surface-bg)]">
                    <h3 className="font-bold text-[var(--color-text-main)]">Edit Task</h3>
                    <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Title</label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Task title"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Description</label>
                        <textarea
                            className="w-full bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] text-[var(--color-text-main)] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-fade)] focus:border-[var(--color-primary)] transition-all min-h-[100px]"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the task..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Due Date</label>
                            <Input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Assignee</label>
                            <select
                                className="w-full h-[42px] bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] text-[var(--color-text-main)] rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-fade)] focus:border-[var(--color-primary)] transition-all"
                                value={assigneeId}
                                onChange={(e) => setAssigneeId(e.target.value)}
                            >
                                <option value="">Unassigned</option>
                                {memberDetails.map(m => (
                                    <option key={m.uid} value={m.uid}>{m.displayName}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                        <Button type="submit" loading={loading} disabled={!title.trim()}>Save Changes</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
