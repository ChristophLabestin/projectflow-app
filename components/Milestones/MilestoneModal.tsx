import React, { useState, useEffect } from 'react';
import { Milestone } from '../../types';
import { createMilestone, updateMilestone, projectSubCollection } from '../../services/dataService';
import { db } from '../../services/firebase';
import { getDocs, query, where, doc, updateDoc, collection } from 'firebase/firestore';

interface MilestoneModalProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
    milestone?: Milestone; // If provided, we are in edit mode
}

export const MilestoneModal = ({ projectId, isOpen, onClose, milestone }: MilestoneModalProps) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [status, setStatus] = useState<'Pending' | 'Achieved' | 'Missed'>('Pending');
    const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
    const [linkedInitiativeId, setLinkedInitiativeId] = useState<string>('');

    const [availableTasks, setAvailableTasks] = useState<any[]>([]);
    const [availableInitiatives, setAvailableInitiatives] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!projectId) return;

            // Fetch Tasks
            // Assuming tasks are in a subcollection of the project (via dataService helper)
            // or we can just use the projectSubCollection helper
            try {
                // We need to resolve tenantId. For now, assuming current user's tenant context or passed prop.
                // dataService usually handles resolution internally, but here we need direct access. 
                // Let's rely on dataService helpers if possible, or direct query if we have tenantId.
                // Actually, projectSubCollection requires tenantId. Milestones are fetching successfully?
                // Wait, createMilestone uses projectSubCollection(resolvedTenant...).
                // We don't have tenantId prop here. We might need to fetch it or rely on existing auth.
                // Let's use a simpler approach: get tasks via dataService if possible, or standard fetch.
                // Re-checking dataService... it has `subscribeProjectMilestones`.
                // Let's just use `collection(db, 'tenants', ..., 'projects', projectId, ...)` but we don't have tenantId easily.
                // Alternative: The parent component likely passes projectId.
                // IMPORTANT: The existing `createMilestone` resolves tenantId internally.
                // We cannot use `projectSubCollection` easily here without tenantId.
                // However, we can use `collectionGroup` but that's broad.
                // Let's assume we can pass tenantId or use a workaround.
                // Actually, let's look at `createMilestone` again. It calls `resolveTenantId(tenantId)`.
                // We can import `resolveTenantId` from dataService? No it is not exported.
                // Let's try to fetch using `collectionGroup` filtered by projectId for now, as it is safest without tenantId.

                const tasksQuery = query(collection(db, 'tasks'), where('projectId', '==', projectId));
                // Actually, tasks are subcollections. CollectionGroup is better.
                const tasksRef = collectionGroup(db, 'tasks');
                const qTasks = query(tasksRef, where('projectId', '==', projectId));
                const tasksSnap = await getDocs(qTasks);
                setAvailableTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })));

                // Fetch Initiatives (Ideas)
                const ideasRef = collectionGroup(db, 'ideas');
                const qIdeas = query(ideasRef, where('projectId', '==', projectId)); // Initiatives might be Ideas
                const ideasSnap = await getDocs(qIdeas);
                setAvailableInitiatives(ideasSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            } catch (e) {
                console.error("Error fetching dependencies", e);
            }
        };

        if (isOpen) {
            fetchData();
            if (milestone) {
                setTitle(milestone.title);
                setDescription(milestone.description || '');
                setDueDate(milestone.dueDate || '');
                setStatus(milestone.status);
                setLinkedTaskIds(milestone.linkedTaskIds || []);
                setLinkedInitiativeId(milestone.linkedInitiativeId || '');

            } else {
                // Reset for create mode
                setTitle('');
                setDescription('');
                setDueDate('');
                setStatus('Pending');
                setLinkedTaskIds([]);
                setLinkedInitiativeId('');

            }
        }
    }, [isOpen, milestone, projectId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (milestone) {
                await updateMilestone(projectId, milestone.id, {
                    title,
                    description,
                    dueDate,
                    status,
                    linkedTaskIds,
                    linkedInitiativeId
                });
            } else {
                await createMilestone(projectId, {
                    title,
                    description,
                    dueDate,
                    status,
                    linkedTaskIds,
                    linkedInitiativeId
                });
            }

            // Post-save: Update Linked Tasks Due Date Logic
            if (dueDate && linkedTaskIds.length > 0) {
                // We need to iterate and update. 
                // Optimized: We fetched availableTasks earlier. We can check them.
                // However, getting the task ref to update requires knowing its path or using general update mechanism.
                // Since we used collectionGroup to fetch, we have the docs. We can use their refs if we stored them, or re-query.
                // Simplest: re-query to get refs or just use dataService `updateTaskFields` if we can make it public or similar.
                // `updateDoc` takes a DocumentReference. 
                // Let's use the local `availableTasks` to find the ones we need to update, 
                // BUT we need their actual references. `availableTasks` maps only data/id usually.
                // Let's re-fetch the specific docs to get refs, or just use the IDs and `findTaskDoc` equivalent logic?
                // Wait, I can't easily get the ref without path.
                // But I used `collectionGroup` which returns QueryDocumentSnapshot, which has `.ref`!
                // Let's store the full docs in state or re-fetch properly.

                // Better: Fetch them again to be safe and get refs.
                const tasksRef = collectionGroup(db, 'tasks');
                const qTasks = query(tasksRef, where('projectId', '==', projectId), where('id', 'in', linkedTaskIds)); // 'id' field check might be redundant if documentId is used, but safe for custom id field.
                // Firestore 'in' has limit 10. `linkedTaskIds` might be large?
                // Let's simpler: Loop availableTasks (which we should store with refs maybe? no, state serialization issues).

                // Let's just fetch all project tasks again and filter.
                const allTasksQ = query(tasksRef, where('projectId', '==', projectId));
                const allTasksSnap = await getDocs(allTasksQ);

                const batchUpdates = [];
                allTasksSnap.forEach(docSnap => {
                    if (linkedTaskIds.includes(docSnap.id)) {
                        const taskData = docSnap.data();
                        if (!taskData.dueDate) {
                            // Task has no due date, update it!
                            batchUpdates.push(updateDoc(docSnap.ref, { dueDate }));
                        }
                    }
                });

                await Promise.all(batchUpdates);
            }

            onClose();
        } catch (error) {
            console.error('Failed to save milestone', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-up ring-1 ring-white/10">
                <div className="px-6 py-4 border-b border-[var(--color-surface-border)] flex items-center justify-between bg-[var(--color-surface-hover)]/30">
                    <h2 className="text-lg font-bold text-[var(--color-text-main)]">
                        {milestone ? 'Edit Milestone' : 'New Milestone'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
                            Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                            placeholder="e.g. MVP Release"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all resize-none h-24"
                            placeholder="Optional description..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
                            Due Date
                        </label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full px-3 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
                            Link Initiative
                        </label>
                        <select
                            value={linkedInitiativeId}
                            onChange={(e) => setLinkedInitiativeId(e.target.value)}
                            className="w-full px-3 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                        >
                            <option value="">No Initiative Linked</option>
                            {availableInitiatives.map(idea => (
                                <option key={idea.id} value={idea.id}>{idea.title}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
                            Link Tasks (Updates Due Date)
                        </label>
                        <div className="max-h-32 overflow-y-auto border border-[var(--color-surface-border)] rounded-lg bg-[var(--color-surface-bg)] p-2 space-y-1">
                            {availableTasks.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">No tasks found.</p>}
                            {availableTasks.map(task => (
                                <label key={task.id} className="flex items-center gap-2 p-1 hover:bg-[var(--color-surface-hover)] rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={linkedTaskIds.includes(task.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setLinkedTaskIds([...linkedTaskIds, task.id]);
                                            else setLinkedTaskIds(linkedTaskIds.filter(id => id !== task.id));
                                        }}
                                        className="rounded border-[var(--color-surface-border)] bg-transparent text-[var(--color-primary)]"
                                    />
                                    <span className="text-sm truncate text-[var(--color-text-main)]">{task.title}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {milestone && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
                                Status
                            </label>
                            <div className="flex bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg p-1">
                                {(['Pending', 'Achieved', 'Missed'] as const).map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setStatus(s)}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${status === s
                                            ? 'bg-[var(--color-surface-card)] text-[var(--color-text-main)] shadow-sm'
                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                            }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-lg text-sm font-bold shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                            {milestone ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
