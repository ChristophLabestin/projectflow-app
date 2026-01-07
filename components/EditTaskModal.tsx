import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Task } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { MultiAssigneeSelector } from './MultiAssigneeSelector';
import { updateTaskFields } from '../services/dataService';

interface EditTaskModalProps {
    task: Task;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
    projectMembers: string[]; // List of UIDs (kept for signature compatibility)
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({ task, isOpen, onClose, onUpdate }) => {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || '');
    const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []));
    const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>(task.assignedGroupIds || []);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTitle(task.title);
            setDescription(task.description || '');
            setAssigneeIds(task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []));
            setAssignedGroupIds(task.assignedGroupIds || []);
        }
    }, [isOpen, task]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateTaskFields(task.id, {
                title,
                description,
                assigneeIds,
                assignedGroupIds,
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

    return createPortal(
        <div className="modal-overlay task-modal center-aligned" onClick={onClose}>
            <div
                className="modal-content max-w-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="edit-task-header">
                    <div>
                        <h3>Edit Task</h3>
                        <p>Update task details and assignments.</p>
                    </div>
                    <Button variant="ghost" onClick={onClose} size="sm">Close</Button>
                </div>

                <form onSubmit={handleSave} className="edit-task-form">
                    <div className="form-group">
                        <Input
                            label="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Task title"
                            required
                            className="text-lg font-medium"
                        />

                        <div className="field-wrapper">
                            <label>Description</label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the task..."
                                rows={8}
                                className="min-h-[200px]"
                            />
                        </div>

                        <div className="field-wrapper">
                            <label>Assignees</label>
                            <MultiAssigneeSelector
                                projectId={task.projectId}
                                assigneeIds={assigneeIds}
                                assignedGroupIds={assignedGroupIds}
                                onChange={setAssigneeIds}
                                onGroupChange={setAssignedGroupIds}
                            />
                        </div>

                    </div>

                    <div className="edit-task-footer">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                        <Button type="submit" isLoading={loading} disabled={!title.trim()}>Save Changes</Button>
                    </div>
                </form>
            </div >
        </div >,
        document.body
    );
};
