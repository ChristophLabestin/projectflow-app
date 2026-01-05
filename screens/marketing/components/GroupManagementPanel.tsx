import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../context/UIContext';
import { RecipientGroup } from '../../../types';
import { subscribeGroups, createGroup, updateGroup, deleteGroup } from '../../../services/groupService';
import { useConfirm } from '../../../context/UIContext';

interface GroupManagementPanelProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    onImportClick: () => void;
}

// Color presets for groups
const GROUP_COLORS = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6'
];

export const GroupManagementPanel: React.FC<GroupManagementPanelProps> = ({
    isOpen,
    onClose,
    projectId,
    onImportClick
}) => {
    const [groups, setGroups] = useState<RecipientGroup[]>([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');
    const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editColor, setEditColor] = useState('');
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();

    useEffect(() => {
        if (!projectId || !isOpen) return;
        const unsub = subscribeGroups(projectId, setGroups);
        return () => unsub();
    }, [projectId, isOpen]);

    if (!isOpen) return null;

    const handleCreate = async () => {
        if (!newGroupName.trim()) return;
        setCreating(true);
        try {
            const groupData: { name: string; color: string; description?: string } = {
                name: newGroupName.trim(),
                color: newGroupColor
            };
            // Only add description if it has content (Firebase doesn't accept undefined)
            if (newGroupDescription.trim()) {
                groupData.description = newGroupDescription.trim();
            }
            await createGroup(projectId, groupData);
            setNewGroupName('');
            setNewGroupDescription('');
            setNewGroupColor(GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]);
            showSuccess('Group created');
        } catch (e: any) {
            console.error('Failed to create group:', e);
            showError(e?.message || 'Failed to create group');
        } finally {
            setCreating(false);
        }
    };

    const startEditing = (group: RecipientGroup) => {
        setEditingId(group.id);
        setEditName(group.name);
        setEditDescription(group.description || '');
        setEditColor(group.color || GROUP_COLORS[0]);
    };

    const handleUpdate = async () => {
        if (!editingId || !editName.trim()) return;
        try {
            const updateData: { name: string; color: string; description?: string } = {
                name: editName.trim(),
                color: editColor
            };
            if (editDescription.trim()) {
                updateData.description = editDescription.trim();
            }
            await updateGroup(projectId, editingId, updateData);
            setEditingId(null);
            showSuccess('Group updated');
        } catch (e: any) {
            console.error('Failed to update group:', e);
            showError(e?.message || 'Failed to update group');
        }
    };

    const handleDelete = async (group: RecipientGroup) => {
        const confirmed = await confirm('Delete Group', `Are you sure you want to delete "${group.name}"? Recipients in this group will not be deleted.`);

        if (!confirmed) return;

        try {
            await deleteGroup(projectId, group.id);
            showSuccess('Group deleted');
        } catch (e) {
            showError('Failed to delete group');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-card border border-surface rounded-xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-surface">
                    <h2 className="h4">Manage Groups</h2>
                    <button onClick={onClose} className="text-muted hover:text-main">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Create New Group */}
                    <div className="p-4 bg-surface rounded-xl border border-surface">
                        <h3 className="font-medium mb-3">Create New Group</h3>
                        <div className="space-y-3">
                            <Input
                                placeholder="Group name"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                            />
                            <Input
                                placeholder="Description (optional)"
                                value={newGroupDescription}
                                onChange={(e) => setNewGroupDescription(e.target.value)}
                            />
                            <div>
                                <label className="block text-sm font-medium mb-2">Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {GROUP_COLORS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewGroupColor(color)}
                                            className={`w-6 h-6 rounded-full transition-transform ${newGroupColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                                                }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <Button variant="primary" onClick={handleCreate} isLoading={creating} className="w-full">
                                Create Group
                            </Button>
                        </div>
                    </div>

                    {/* Group List */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-medium">Groups ({groups.length})</h3>
                            <Button variant="secondary" size="sm" onClick={onImportClick}>
                                <span className="material-symbols-outlined mr-1 text-[16px]">upload</span>
                                Import
                            </Button>
                        </div>

                        {groups.length === 0 ? (
                            <p className="text-center text-muted py-8">
                                No groups yet. Create one above or import from CSV.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {groups.map(group => (
                                    <div
                                        key={group.id}
                                        className="p-3 bg-surface rounded-lg border border-surface group"
                                    >
                                        {editingId === group.id ? (
                                            // Edit Mode
                                            <div className="space-y-2">
                                                <Input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    placeholder="Group name"
                                                />
                                                <Input
                                                    value={editDescription}
                                                    onChange={(e) => setEditDescription(e.target.value)}
                                                    placeholder="Description"
                                                />
                                                <div className="flex flex-wrap gap-1">
                                                    {GROUP_COLORS.map(color => (
                                                        <button
                                                            key={color}
                                                            type="button"
                                                            onClick={() => setEditColor(color)}
                                                            className={`w-5 h-5 rounded-full ${editColor === color ? 'ring-2 ring-offset-1 ring-primary' : ''
                                                                }`}
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="primary" size="sm" onClick={handleUpdate}>Save</Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            // View Mode
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-4 h-4 rounded-full shrink-0"
                                                        style={{ backgroundColor: group.color || GROUP_COLORS[0] }}
                                                    />
                                                    <div>
                                                        <p className="font-medium text-sm">{group.name}</p>
                                                        {group.description && (
                                                            <p className="text-xs text-muted">{group.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => startEditing(group)}
                                                        className="p-1 text-muted hover:text-main transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(group)}
                                                        className="p-1 text-muted hover:text-red-500 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
