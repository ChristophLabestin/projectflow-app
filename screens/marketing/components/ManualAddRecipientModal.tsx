import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../context/UIContext';
import { createRecipient } from '../../../services/recipientService';
import { subscribeGroups } from '../../../services/groupService';
import { RecipientGroup } from '../../../types';

interface ManualAddRecipientModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
}

export const ManualAddRecipientModal: React.FC<ManualAddRecipientModalProps> = ({ isOpen, onClose, projectId }) => {
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say' | ''>('');
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [groups, setGroups] = useState<RecipientGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const { showSuccess, showError } = useToast();

    // Load groups
    useEffect(() => {
        if (!projectId || !isOpen) return;
        const unsub = subscribeGroups(projectId, setGroups);
        return () => unsub();
    }, [projectId, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Build recipient data without undefined values (Firebase doesn't accept undefined)
            const recipientData: any = {
                email,
                status: 'Subscribed' as const,
                source: 'Manual' as const
            };
            if (firstName.trim()) recipientData.firstName = firstName.trim();
            if (lastName.trim()) recipientData.lastName = lastName.trim();
            if (gender) recipientData.gender = gender;
            if (selectedGroupIds.length > 0) recipientData.groupIds = selectedGroupIds;

            await createRecipient(projectId, recipientData);

            showSuccess('Recipient added successfully');
            onClose();
            // Reset form
            setEmail('');
            setFirstName('');
            setLastName('');
            setGender('');
            setSelectedGroupIds([]);
        } catch (error: any) {
            console.error('Failed to add recipient:', error);
            showError(error?.message || 'Failed to add recipient');
        } finally {
            setLoading(false);
        }
    };

    const toggleGroup = (groupId: string) => {
        setSelectedGroupIds(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl w-full max-w-md shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="h4">Add Recipient</h2>
                    <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder="john@example.com"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="First Name"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                            placeholder="John"
                        />
                        <Input
                            label="Last Name"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                            placeholder="Doe"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Gender</label>
                        <select
                            className="w-full px-3 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] text-sm"
                            value={gender}
                            onChange={e => setGender(e.target.value as any)}
                        >
                            <option value="">Select Gender...</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="prefer_not_to_say">Prefer not to say</option>
                        </select>
                    </div>

                    {/* Group Selection */}
                    {groups.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Add to Groups</label>
                            <div className="flex flex-wrap gap-2">
                                {groups.map(group => {
                                    const isSelected = selectedGroupIds.includes(group.id);
                                    return (
                                        <button
                                            key={group.id}
                                            type="button"
                                            onClick={() => toggleGroup(group.id)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all border ${isSelected
                                                ? 'bg-[var(--color-primary)] text-black border-[var(--color-primary)]'
                                                : 'bg-[var(--color-surface-card)] text-[var(--color-text-main)] border-[var(--color-surface-border)] hover:border-[var(--color-primary)]'
                                                }`}
                                        >
                                            {isSelected && (
                                                <span className="material-symbols-outlined text-[14px]">check</span>
                                            )}
                                            {group.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="ghost" onClick={onClose} type="button">
                            Cancel
                        </Button>
                        <Button variant="primary" isLoading={loading} type="submit">
                            Add Recipient
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
