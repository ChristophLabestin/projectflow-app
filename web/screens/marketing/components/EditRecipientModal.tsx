import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../context/UIContext';
import { updateRecipient } from '../../../services/recipientService';
import { subscribeGroups } from '../../../services/groupService';
import { Recipient, RecipientGroup } from '../../../types';

interface EditRecipientModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    recipient: Recipient | null;
}

export const EditRecipientModal: React.FC<EditRecipientModalProps> = ({ isOpen, onClose, projectId, recipient }) => {
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say' | ''>('');
    const [status, setStatus] = useState<'Subscribed' | 'Unsubscribed' | 'Bounced'>('Subscribed');
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

    // Populate form when recipient changes
    useEffect(() => {
        if (recipient) {
            setEmail(recipient.email);
            setFirstName(recipient.firstName || '');
            setLastName(recipient.lastName || '');
            setGender(recipient.gender || '');
            setStatus(recipient.status);
            setSelectedGroupIds(recipient.groupIds || []);
        }
    }, [recipient]);

    if (!isOpen || !recipient) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Build update data without undefined values
            const updateData: any = { email, status };
            if (firstName.trim()) updateData.firstName = firstName.trim();
            if (lastName.trim()) updateData.lastName = lastName.trim();
            if (gender) updateData.gender = gender;
            if (selectedGroupIds.length > 0) updateData.groupIds = selectedGroupIds;

            await updateRecipient(projectId, recipient.id, updateData);

            showSuccess('Recipient updated');
            onClose();
        } catch (error: any) {
            console.error('Failed to update recipient:', error);
            showError(error?.message || 'Failed to update recipient');
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
            <div className="bg-card border border-surface rounded-xl w-full max-w-md shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="h4">Edit Recipient</h2>
                    <button onClick={onClose} className="text-muted hover:text-main">
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Gender</label>
                            <select
                                className="w-full px-3 py-2 bg-surface border border-surface rounded-lg focus:outline-none focus:border-primary text-sm"
                                value={gender}
                                onChange={e => setGender(e.target.value as any)}
                            >
                                <option value="">Select...</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                                <option value="prefer_not_to_say">Prefer not to say</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Status</label>
                            <select
                                className="w-full px-3 py-2 bg-surface border border-surface rounded-lg focus:outline-none focus:border-primary text-sm"
                                value={status}
                                onChange={e => setStatus(e.target.value as any)}
                            >
                                <option value="Subscribed">Subscribed</option>
                                <option value="Unsubscribed">Unsubscribed</option>
                                <option value="Bounced">Bounced</option>
                            </select>
                        </div>
                    </div>

                    {/* Group Selection */}
                    {groups.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Groups</label>
                            <div className="flex flex-wrap gap-2">
                                {groups.map(group => {
                                    const isSelected = selectedGroupIds.includes(group.id);
                                    return (
                                        <button
                                            key={group.id}
                                            type="button"
                                            onClick={() => toggleGroup(group.id)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border-2 ${isSelected
                                                    ? 'text-white border-transparent'
                                                    : 'bg-transparent border-surface text-muted hover:border-muted'
                                                }`}
                                            style={isSelected ? { backgroundColor: group.color || '#6366f1', borderColor: group.color || '#6366f1' } : {}}
                                        >
                                            {isSelected && (
                                                <span className="material-symbols-outlined text-[14px]">check</span>
                                            )}
                                            <span
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: group.color || '#6366f1', display: isSelected ? 'none' : 'block' }}
                                            />
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
                            Save Changes
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
