import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { ProjectRole, WorkspaceRole } from '../types';

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerateLink: (role: any, maxUses?: number, expiresInHours?: number) => Promise<string>;
    projectTitle: string;
    isWorkspace?: boolean;
}

const PROJECT_ROLE_DESCRIPTIONS: Record<ProjectRole, { title: string; description: string; capabilities: string[] }> = {
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

const WORKSPACE_ROLE_DESCRIPTIONS: Record<WorkspaceRole, { title: string; description: string; capabilities: string[] }> = {
    Owner: {
        title: 'Workspace Owner',
        description: 'Full administrative access',
        capabilities: ['Manage billing', 'Delete workspace', 'Manage all members', 'Create projects'],
    },
    Admin: {
        title: 'Admin',
        description: 'Can manage members and projects',
        capabilities: ['Invite members', 'Create projects', 'Manage groups', 'Manage settings'],
    },
    Member: {
        title: 'Member',
        description: 'Standard access',
        capabilities: ['Create projects (if allowed)', 'View projects', 'Join projects'],
    },
    Guest: {
        title: 'Guest',
        description: 'Limited access',
        capabilities: ['View assigned items only', 'Cannot create projects'],
    }
};

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
    isOpen,
    onClose,
    onGenerateLink,
    projectTitle,
    isWorkspace
}) => {
    const [selectedRole, setSelectedRole] = useState<string>(isWorkspace ? 'Member' : 'Editor');
    const [maxUses, setMaxUses] = useState<string>('');
    const [expiresIn, setExpiresIn] = useState<string>('24');
    const [generatedLink, setGeneratedLink] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Reset default role when mode changes
    React.useEffect(() => {
        if (isOpen) {
            setSelectedRole(isWorkspace ? 'Member' : 'Editor');
            setGeneratedLink('');
            setMaxUses('');
            setExpiresIn('24');
            setError(null);
            setCopied(false);
        }
    }, [isOpen, isWorkspace]);

    const handleGenerateLink = async () => {
        setError(null);
        setIsLoading(true);
        try {
            const maxUsesNum = maxUses ? parseInt(maxUses) : undefined;
            const expiresInNum = parseInt(expiresIn);
            const link = await onGenerateLink(selectedRole, maxUsesNum, expiresInNum);
            setGeneratedLink(link);
        } catch (err: any) {
            setError(err.message || 'Failed to generate invite link');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(generatedLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleClose = () => {
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`Invite to ${projectTitle}`}
            size="md"
            footer={
                generatedLink ? (
                    <Button onClick={handleClose}>Done</Button>
                ) : (
                    <>
                        <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button onClick={handleGenerateLink} isLoading={isLoading}>
                            Generate Invite Link
                        </Button>
                    </>
                )
            }
        >
            {!generatedLink ? (
                <div className="space-y-6">
                    {/* Role Selection */}
                    <div>
                        <label className="block text-sm font-bold text-[var(--color-text-main)] mb-3">
                            Role & Permissions
                        </label>
                        <div className="space-y-3">
                            {isWorkspace ? (
                                (['Admin', 'Member', 'Guest'] as WorkspaceRole[]).map((role) => {
                                    const roleInfo = WORKSPACE_ROLE_DESCRIPTIONS[role];
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
                                                className="mt-1 size-4 text-[var(--color-primary)] border-[var(--color-surface-border)] focus:ring-[var(--color-primary)]"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-[var(--color-text-main)]">
                                                        {roleInfo.title}
                                                    </span>
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
                                })
                            ) : (
                                (['Editor', 'Viewer', 'Owner'] as ProjectRole[]).map((role) => {
                                    const roleInfo = PROJECT_ROLE_DESCRIPTIONS[role];
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
                                                className="mt-1 size-4 text-[var(--color-primary)] border-[var(--color-surface-border)] focus:ring-[var(--color-primary)]"
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
                                })
                            )}
                        </div>
                    </div>

                    {/* Link Settings */}
                    <div className="space-y-4 p-4 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-surface-border)]">
                        <h4 className="text-sm font-bold text-[var(--color-text-main)] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">settings</span>
                            Link Settings
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                                    Max Uses
                                </label>
                                <Input
                                    type="number"
                                    min="1"
                                    placeholder="Unlimited"
                                    value={maxUses}
                                    onChange={(e) => setMaxUses(e.target.value)}
                                />
                                <p className="text-xs text-[var(--color-text-subtle)] mt-1">Leave empty for unlimited</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                                    Expires In (hours)
                                </label>
                                <Select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}>
                                    <option value="1">1 hour</option>
                                    <option value="6">6 hours</option>
                                    <option value="24">24 hours</option>
                                    <option value="72">3 days</option>
                                    <option value="168">7 days</option>
                                    <option value="720">30 days</option>
                                    <option value="8760">1 year</option>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {selectedRole === 'Owner' && !isWorkspace && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
                            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 mt-0.5">
                                warning
                            </span>
                            <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
                                <p className="font-bold mb-1">Sharing Ownership</p>
                                <p>
                                    Anyone with this link will become an owner with full control, including the ability to delete the project or remove you.
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            {error}
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-start gap-3">
                        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-2xl">
                            check_circle
                        </span>
                        <div className="flex-1">
                            <p className="font-bold text-emerald-900 dark:text-emerald-100 mb-1">Invite Link Created!</p>
                            <p className="text-sm text-emerald-800 dark:text-emerald-200">
                                Share this link to invite members as <span className="font-bold">{selectedRole}</span>
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                            Invite Link
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-1 px-4 py-3 bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] rounded-lg font-mono text-sm text-[var(--color-text-main)] truncate">
                                {generatedLink}
                            </div>
                            <Button
                                variant="secondary"
                                onClick={handleCopyLink}
                                icon={<span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>}
                            >
                                {copied ? 'Copied!' : 'Copy'}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 p-4 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-surface-border)]">
                        <div>
                            <p className="text-xs text-[var(--color-text-muted)] mb-1">Role</p>
                            <p className="font-semibold text-sm">{selectedRole}</p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--color-text-muted)] mb-1">Max Uses</p>
                            <p className="font-semibold text-sm">{maxUses || 'Unlimited'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--color-text-muted)] mb-1">Expires In</p>
                            <p className="font-semibold text-sm">{expiresIn}h</p>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};
