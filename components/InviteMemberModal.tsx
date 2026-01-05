import React, { useState, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { ProjectRole, WorkspaceRole, CustomRole } from '../types';

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerateLink: (role: any, maxUses?: number, expiresInHours?: number) => Promise<string>;
    onSendEmail?: (email: string, role: string) => Promise<void>;
    projectTitle?: string;
    isWorkspace?: boolean;
    customRoles?: CustomRole[];
}

const PERMISSION_LABELS: Record<string, string> = {
    canManageProjects: 'Manage Projects',
    canManageMembers: 'Manage Members',
    canManageSettings: 'Manage Settings',
    canCreateProjects: 'Create Projects',
    canViewAllProjects: 'View All Projects'
};

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
    isOpen,
    onClose,
    onGenerateLink,
    onSendEmail,
    projectTitle = 'Workspace',
    isWorkspace,
    customRoles = []
}) => {
    const [activeTab, setActiveTab] = useState<'link' | 'email'>('link');
    const [selectedRole, setSelectedRole] = useState<string>(() => {
        const defaultRole = customRoles.find(r => r.isDefault)?.id || customRoles[0]?.id || '';
        return defaultRole;
    });
    const [maxUses, setMaxUses] = useState<string>('');
    const [expiresIn, setExpiresIn] = useState<string>('24');
    const [generatedLink, setGeneratedLink] = useState<string>('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Reset default role and state when mode changes
    React.useEffect(() => {
        if (isOpen) {
            // Try to find a default role or use the first available one
            const defaultRole = customRoles.find(r => r.isDefault)?.id || customRoles[0]?.id || '';
            setSelectedRole(defaultRole);
            setGeneratedLink('');
            setMaxUses('');
            setExpiresIn('24');
            setEmail('');
            setError(null);
            setSuccessMessage(null);
            setCopied(false);
            setActiveTab('link');
        }
    }, [isOpen, isWorkspace, customRoles]);

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

    const handleSendEmail = async () => {
        if (!email || !email.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }
        if (!onSendEmail) {
            setError('Email invitations are not configured for this context.');
            return;
        }

        setError(null);
        setIsLoading(true);
        try {
            await onSendEmail(email, selectedRole);
            setSuccessMessage(`Invitation sent to ${email}`);
            setEmail('');
        } catch (err: any) {
            setError(err.message || 'Failed to send invitation');
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

    // Helper to get role details for display
    const getRoleInfo = (roleId: string) => {
        const custom = customRoles.find(r => r.id === roleId);
        if (custom) {
            return {
                title: custom.name,
                description: custom.description || 'Custom Role',
                capabilities: custom.permissions.map(p => PERMISSION_LABELS[p] || p),
                color: custom.color
            };
        }
        return { title: 'Unknown Role', description: '', capabilities: [], color: '#6b7280' };
    };

    const currentRoleInfo = getRoleInfo(selectedRole);

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`Invite to ${projectTitle}`}
            size="xl"
            footer={
                generatedLink || successMessage ? (
                    <Button onClick={handleClose}>Done</Button>
                ) : (
                    <>
                        <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        {activeTab === 'link' ? (
                            <Button onClick={handleGenerateLink} isLoading={isLoading}>
                                Generate Invite Link
                            </Button>
                        ) : (
                            <Button onClick={handleSendEmail} isLoading={isLoading} disabled={!email}>
                                Send Invitation
                            </Button>
                        )}
                    </>
                )
            }
        >
            <div className="flex flex-col h-[500px]">
                {/* Tabs */}
                <div className="flex border-b border-[var(--color-surface-border)] mb-4 shrink-0">
                    <button
                        className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'link'
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                            }`}
                        onClick={() => { setActiveTab('link'); setError(null); setSuccessMessage(null); }}
                    >
                        Invite via Link
                    </button>
                    <button
                        className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'email'
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                            }`}
                        onClick={() => { setActiveTab('email'); setError(null); setSuccessMessage(null); }}
                    >
                        Invite via Email
                    </button>
                </div>

                {!generatedLink && !successMessage ? (
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 overflow-hidden">
                        {/* Left Column: Role Selection */}
                        <div className="flex flex-col min-h-0">
                            <label className="block text-sm font-bold text-[var(--color-text-main)] mb-3 shrink-0">
                                Role
                            </label>
                            <div className="space-y-2 overflow-y-auto pr-2 pb-2">
                                {/* Custom Roles */}
                                {customRoles.map(role => (
                                    <label
                                        key={role.id}
                                        className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedRole === role.id
                                            ? 'bg-gray-50 dark:bg-white/5 shadow-sm'
                                            : 'border-[var(--color-surface-border)] hover:border-gray-300 dark:hover:border-white/20'
                                            }`}
                                        style={{ borderColor: selectedRole === role.id ? role.color : undefined }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name="role"
                                                value={role.id}
                                                checked={selectedRole === role.id}
                                                onChange={() => setSelectedRole(role.id)}
                                                className="size-4 border-[var(--color-surface-border)] focus:ring-0"
                                                style={{ color: role.color }}
                                            />
                                            <span className="font-bold text-[var(--color-text-main)]" style={{ color: selectedRole === role.id ? role.color : undefined }}>{role.name}</span>
                                        </div>
                                        <p className="text-xs text-[var(--color-text-muted)] mt-1 ml-7 opacity-80">{role.description || (isWorkspace ? 'Custom workspace role' : 'Custom project role')}</p>
                                    </label>
                                ))}

                                {customRoles.length === 0 && (
                                    <div className="p-8 text-center bg-[var(--color-surface-hover)] rounded-xl border border-dashed border-[var(--color-surface-border)]">
                                        <p className="text-sm text-[var(--color-text-muted)]">No custom roles defined.</p>
                                        <p className="text-xs text-[var(--color-text-subtle)] mt-1">Please manage roles in settings first.</p>
                                    </div>
                                )}

                            </div>
                        </div>

                        {/* Right Column: Details & Settings */}
                        <div className="flex flex-col gap-6 overflow-y-auto pr-2 pb-2">
                            {/* Role Capabilities */}
                            <div className="p-4 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-surface-border)]">
                                <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentRoleInfo.color }}></span>
                                    Permissions
                                </h4>
                                <ul className="space-y-2">
                                    {currentRoleInfo.capabilities.map((cap, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-subtle)]">
                                            <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                check_circle
                                            </span>
                                            {cap}
                                        </li>
                                    ))}
                                    {currentRoleInfo.capabilities.length === 0 && (
                                        <li className="text-sm text-[var(--color-text-muted)] italic">No specific permissions listed.</li>
                                    )}
                                </ul>
                            </div>

                            {/* Link Settings or Email Input */}
                            {activeTab === 'link' ? (
                                <div className="space-y-4">
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
                                            <p className="text-[10px] text-[var(--color-text-subtle)] mt-1">Empty = Unlimited</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                                                Expires In
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
                            ) : (
                                <div>
                                    <label className="block text-sm font-bold text-[var(--color-text-main)] mb-2">
                                        Email Address
                                    </label>
                                    <Input
                                        type="email"
                                        placeholder="colleague@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoFocus
                                    />
                                    <p className="text-xs text-[var(--color-text-subtle)] mt-2">
                                        An invitation email will be sent to this address with a unique link.
                                    </p>
                                </div>
                            )}

                            {/* Warning removed as ownership management is now part of the custom permission system */}

                            {error && (
                                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                    {error}
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {generatedLink ? (
                            <>
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-start gap-3">
                                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-2xl">
                                        check_circle
                                    </span>
                                    <div className="flex-1">
                                        <p className="font-bold text-emerald-900 dark:text-emerald-100 mb-1">Invite Link Created!</p>
                                        <p className="text-sm text-emerald-800 dark:text-emerald-200">
                                            Share this link to invite members as <span className="font-bold" style={{ color: currentRoleInfo.color }}>{currentRoleInfo.title}</span>
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
                            </>
                        ) : (
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-center gap-3">
                                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-2xl">
                                    send
                                </span>
                                <div>
                                    <p className="font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                                        Invitation Sent!
                                    </p>
                                    <p className="text-sm text-emerald-800 dark:text-emerald-200">
                                        {successMessage}
                                    </p>
                                </div>
                            </div>
                        )}

                        {!successMessage && (
                            <div className="grid grid-cols-3 gap-3 p-4 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-surface-border)]">
                                <div>
                                    <p className="text-xs text-[var(--color-text-muted)] mb-1">Role</p>
                                    <p className="font-semibold text-sm" style={{ color: currentRoleInfo.color }}>{currentRoleInfo.title}</p>
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
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};
