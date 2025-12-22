import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';

interface GroupCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, description: string, color: string) => Promise<void>;
}

export const GroupCreateModal: React.FC<GroupCreateModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#3b82f6'); // Default Blue
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        try {
            setLoading(true);
            await onCreate(name, description, color);
            onClose();
            setName('');
            setDescription('');
            setColor('#3b82f6');
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const colors = [
        '#ef4444', // Red
        '#f97316', // Orange
        '#f59e0b', // Amber
        '#10b981', // Emerald
        '#3b82f6', // Blue
        '#6366f1', // Indigo
        '#8b5cf6', // Violet
        '#ec4899', // Pink
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Group">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                    label="Group Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Designers, Backend Team"
                    required
                />

                <Textarea
                    label="Description (Optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this group for?"
                />

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-[var(--color-text-secondary)]">Group Color</label>
                    <div className="flex gap-2 flex-wrap">
                        {colors.map(c => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setColor(c)}
                                className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'border-[var(--color-text-main)] scale-110' : 'border-transparent hover:scale-105'
                                    }`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={loading || !name.trim()}>
                        {loading ? 'Creating...' : 'Create Group'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
