import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ProjectRole } from '../types';
import { ROLE_CAPABILITIES } from '../utils/permissions';

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInvite: (email: string, role: ProjectRole) => Promise<void>;
    projectTitle: string;
}

const ROLE_DESCRIPTIONS: Record<ProjectRole, { title: string; description: string; capabilities: string[] }> = {
    Owner: {
        title: 'Owner',
        description: 'Full control over the project',
        capabilities: ['Edit project settings', 'Delete project', 'Invite members', 'Manage all content'],
    },
    Editor: {
        title: 'Editor',
        description: 'Can create and manage content',
        capabilities: ['Create/edit tasks, ideas, and issues', 'Add comments', 'Cannot edit project settings'],
    },
    Viewer: {
        title: 'Viewer',
        description: 'Read-only access',
        capabilities: ['View all content', 'Add comments', 'Cannot create or edit'],
    },
};

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
    isOpen,
    onClose,
    onInvite,
    projectTitle,
}) => {
    const [email, setEmail] = useState('');
    const [selectedRole, setSelectedRole] = useState<ProjectRole>('Editor');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate email
        if (!email || !email.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }

        setIsLoading(true);
        try {
            await onInvite(email, selectedRole);
            setEmail('');
            setSelectedRole('Editor');
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to send invitation');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setEmail('');
        setSelectedRole('Editor');
        setError(null);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`Invite to ${projectTitle}`}
            size="md"
            footer={
                <>
                    <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} isLoading={isLoading}>
                        Send Invitation
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Input */}
                <div>
                    <label className="block text-sm font-bold text-[var(--color-text-main)] mb-2">
                        Email Address
                    </label>
                    <Input
                        type="email"
                        placeholder="colleague@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                    />
                    {error && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
                    )}
                </div>

                {/* Role Selection */}
                <div>
                    <label className="block text-sm font-bold text-[var(--color-text-main)] mb-3">
                        Role & Permissions
                    </label>
                    <div className="space-y-3">
                        {(['Editor', 'Viewer', 'Owner'] as ProjectRole[]).map((role) => {
                            const roleInfo = ROLE_DESCRIPTIONS[role];
                            return (
                                <label
                                    key={role}
                                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedRole === role
                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                            : 'border-[var(--color-surface-border)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-hover)]'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="role"
                                        value={role}
                                        checked={selectedRole === role}
                                        onChange={() => setSelectedRole(role)}
                                        className="mt-1 size-4 text-[var(--color-primary)] border-gray-300 focus:ring-[var(--color-primary)]"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-[var(--color-text-main)]">
                                                {roleInfo.title}
                                            </span>
                                            {role === 'Owner' && (
                                                <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                                                    Caution
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-[var(--color-text-muted)] mb-2">
                                            {roleInfo.description}
                                        </p>
                                        <ul className="space-y-1">
                                            {roleInfo.capabilities.map((cap, i) => (
                                                <li key={i} className="flex items-center gap-2 text-xs text-[var(--color-text-subtle)]">
                                                    <span className="material-symbols-outlined text-[12px] text-emerald-600 dark:text-emerald-400">
                                                        check_circle
                                                    </span>
                                                    {cap}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {selectedRole === 'Owner' && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
                        <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 mt-0.5">
                            warning
                        </span>
                        <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
                            <p className="font-bold mb-1">Sharing Ownership</p>
                            <p>
                                The new owner will have full control, including the ability to delete the project or remove you as a member.
                            </p>
                        </div>
                    </div>
                )}
            </form>
        </Modal>
    );
};
