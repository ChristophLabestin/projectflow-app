import React, { useState, useEffect } from 'react';
import { Project, ProjectMember, ProjectRole } from '../../types';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import {
    updateMemberRole,
    removeMember,
    generateInviteLink,
    getProjectInviteLinks,
    revokeProjectInviteLink,
    getUserProfile,
    resolveTenantId
} from '../../services/dataService';
import { auth, db } from '../../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useConfirm } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';
import { getRoleDisplayInfo, getWorkspaceRoles } from '../../services/rolesService';
import { CustomRole } from '../../types';

interface ProjectTeamManagerProps {
    project: Project;
    canManage: boolean;
    customRoles?: CustomRole[];
    loadingRoles?: boolean;
}

interface EnrichedMember extends ProjectMember {
    displayName: string;
    email: string;
    photoURL?: string;
}

export const ProjectTeamManager: React.FC<ProjectTeamManagerProps> = ({ project, canManage, customRoles: passedRoles, loadingRoles }) => {
    const [members, setMembers] = useState<EnrichedMember[]>([]);
    const [inviteLinks, setInviteLinks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteRole, setInviteRole] = useState<ProjectRole | string>('Editor');
    const [generatedLink, setGeneratedLink] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [internalCustomRoles, setInternalCustomRoles] = useState<CustomRole[]>([]);
    const customRoles = passedRoles || internalCustomRoles;
    const confirm = useConfirm();
    const { t, dateFormat, dateLocale } = useLanguage();

    // Subscribe to project updates to get real-time member list
    useEffect(() => {
        if (!project.id) return;

        const resolvedTenant = project.tenantId || resolveTenantId();
        const projectRef = doc(db, `tenants/${resolvedTenant}/projects`, project.id);

        const unsubscribe = onSnapshot(projectRef, async (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Project;
                const projectMembers = data.members || [];

                // Fetch details for all members
                const enriched = await Promise.all(projectMembers.map(async (m) => {
                    const memberData = typeof m === 'string'
                        ? { userId: m, role: 'Viewer' as ProjectRole, joinedAt: new Date(), invitedBy: 'System' }
                        : m;

                    try {
                        const profile = await getUserProfile(memberData.userId, resolvedTenant);
                        return {
                            ...memberData,
                            displayName: profile?.displayName || t('projectTeam.unknownUser'),
                            email: profile?.email || '',
                            photoURL: profile?.photoURL
                        };
                    } catch (e) {
                        return {
                            ...memberData,
                            displayName: t('projectTeam.unknownUser'),
                            email: '',
                        };
                    }
                }));

                setMembers(enriched);
                setLoading(false);
            }
        });

        // Also fetch invite links and custom roles (if not passed)
        loadInviteLinks();
        if (!passedRoles) {
            loadCustomRoles();
        }

        return () => unsubscribe();
    }, [project.id, project.tenantId]);

    const loadInviteLinks = async () => {
        if (!canManage) return;
        try {
            const links = await getProjectInviteLinks(project.id, project.tenantId);
            setInviteLinks(links);
        } catch (e) {
            console.error("Failed to load invite links", e);
        }
    };

    const loadCustomRoles = async () => {
        try {
            const roles = await getWorkspaceRoles(project.tenantId);
            setInternalCustomRoles(roles);

            // Set default invite role if not already set or if it was 'Editor' (legacy default)
            const defaultRole = roles.find(r => r.isDefault);
            if (defaultRole && (inviteRole === 'Editor' || inviteRole === 'Viewer')) {
                setInviteRole(defaultRole.id);
            } else if (roles.length > 0 && (inviteRole === 'Editor' || inviteRole === 'Viewer')) {
                setInviteRole(roles[0].id);
            }
        } catch (e) {
            console.error("Failed to load custom roles", e);
        }
    };

    const handleRoleChange = async (userId: string, newRole: ProjectRole | string) => {
        if (!canManage) return;
        try {
            await updateMemberRole(project.id, userId, newRole, project.tenantId);
        } catch (e) {
            console.error("Failed to update role", e);
            alert(t('projectTeam.errors.updateRole'));
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!canManage) return;
        if (!await confirm(t('projectTeam.confirm.removeTitle'), t('projectTeam.confirm.removeMessage'))) return;

        try {
            await removeMember(project.id, userId, project.tenantId);
        } catch (e) {
            console.error("Failed to remove member", e);
            alert(t('projectTeam.errors.removeMember'));
        }
    };

    const handleGenerateLink = async () => {
        if (!canManage) return;
        setIsGenerating(true);
        try {
            const link = await generateInviteLink(project.id, inviteRole, undefined, 72, project.tenantId); // 72 hours expiration
            setGeneratedLink(link);
            loadInviteLinks();
        } catch (e) {
            console.error("Failed to generate link", e);
            alert(t('projectTeam.errors.generateInvite'));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRevokeLink = async (linkId: string) => {
        if (!await confirm(t('projectTeam.confirm.revokeTitle'), t('projectTeam.confirm.revokeMessage'))) return;
        try {
            await revokeProjectInviteLink(project.id, linkId, project.tenantId);
            loadInviteLinks();
        } catch (e) {
            console.error("Failed to revoke link", e);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Could show a toast here
        alert(t('projectTeam.actions.copied'));
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Team Members List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--color-text-main)]">{t('projectTeam.title')}</h3>
                        <p className="text-sm text-[var(--color-text-muted)]">{t('projectTeam.subtitle')}</p>
                    </div>
                </div>

                <div className="border border-[var(--color-surface-border)] rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                        </div>
                    ) : members.length === 0 ? (
                        <div className="p-8 text-center text-[var(--color-text-muted)]">
                            <p>{t('projectTeam.empty')}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--color-surface-border)]">
                            {members.map((member) => (
                                <div key={member.userId} className="p-4 flex items-center justify-between bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-hover)]/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                            {member.photoURL ? (
                                                <img src={member.photoURL} alt={member.displayName} className="size-full object-cover" />
                                            ) : (
                                                <span className="text-sm font-bold text-slate-500">{member.displayName?.charAt(0) || '?'}</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-[var(--color-text-main)]">{member.displayName} {auth.currentUser?.uid === member.userId && <span className="text-[var(--color-text-subtle)] text-xs font-normal">({t('common.you')})</span>}</p>
                                            <p className="text-xs text-[var(--color-text-muted)]">{member.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {canManage && member.userId !== project.ownerId ? (
                                            <>
                                                <Select
                                                    value={member.role}
                                                    onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                                                    className="w-32 h-9 text-xs"
                                                >
                                                    {/* If current role is legacy, show it as an option so it's not hidden/lost */}
                                                    {['Viewer', 'Editor'].includes(member.role) && !customRoles.find(r => r.id === member.role) && (
                                                        <option value={member.role}>{member.role} (Legacy)</option>
                                                    )}
                                                    <option value="Owner">{t('roles.owner', 'Owner')}</option>
                                                    {customRoles.map(role => (
                                                        <option key={role.id} value={role.id}>{role.name}</option>
                                                    ))}
                                                </Select>
                                                <button
                                                    onClick={() => handleRemoveMember(member.userId)}
                                                    className="p-1.5 text-[var(--color-text-subtle)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title={t('projectTeam.actions.remove')}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">person_remove</span>
                                                </button>
                                            </>
                                        ) : (
                                            <Badge
                                                style={{
                                                    backgroundColor: getRoleDisplayInfo(customRoles, member.role).color + '20',
                                                    color: getRoleDisplayInfo(customRoles, member.role).color,
                                                    borderColor: getRoleDisplayInfo(customRoles, member.role).color + '40'
                                                }}
                                                variant="outline"
                                            >
                                                {getRoleDisplayInfo(customRoles, member.role).name}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Invite Section */}
            {canManage && (
                <div className="space-y-4">
                    <div className="h-px bg-[var(--color-surface-border)]" />
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">{t('projectTeam.invite.title')}</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('projectTeam.invite.subtitle')}</p>
                        </div>
                    </div>

                    <div className="bg-[var(--color-surface-hover)]/30 border border-[var(--color-surface-border)] rounded-xl p-4 space-y-4">
                        <div className="flex gap-3">
                            <Select
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value)}
                                className="w-32"
                            >
                                <option value="Owner">{t('roles.owner', 'Owner')}</option>
                                {customRoles.map(role => (
                                    <option key={role.id} value={role.id}>{role.name}</option>
                                ))}
                            </Select>
                            <Button
                                variant="primary"
                                onClick={handleGenerateLink}
                                isLoading={isGenerating}
                                icon={<span className="material-symbols-outlined">link</span>}
                                className="whitespace-nowrap flex-1"
                            >
                                {t('projectTeam.invite.generate')}
                            </Button>
                        </div>

                        {generatedLink && (
                            <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                                <Input value={generatedLink} readOnly className="flex-1 font-mono text-xs" />
                                <Button variant="secondary" onClick={() => copyToClipboard(generatedLink)}>{t('common.copy')}</Button>
                            </div>
                        )}
                    </div>

                    {/* Active Invite Links */}
                    {inviteLinks.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-[var(--color-text-main)]">{t('projectTeam.invite.active')}</h4>
                            <div className="space-y-2">
                                {inviteLinks.map(link => (
                                    <div key={link.id} className="flex items-center justify-between p-3 border border-[var(--color-surface-border)] rounded-lg bg-[var(--color-surface-card)]">
                                        <Badge
                                            style={{
                                                backgroundColor: getRoleDisplayInfo(customRoles, link.role).color + '20',
                                                color: getRoleDisplayInfo(customRoles, link.role).color,
                                                borderColor: getRoleDisplayInfo(customRoles, link.role).color + '40'
                                            }}
                                            variant="outline"
                                        >
                                            {getRoleDisplayInfo(customRoles, link.role).name}
                                        </Badge>
                                        <div className="flex flex-col">
                                            <span className="text-xs text-[var(--color-text-muted)]">
                                                {t('projectTeam.invite.expires', 'Expires {date}').replace('{date}', format(new Date(link.expiresAt.toDate ? link.expiresAt.toDate() : link.expiresAt), dateFormat, { locale: dateLocale }))}
                                            </span>
                                            <span className="text-xs text-[var(--color-text-subtle)]">{t('projectTeam.invite.createdByYou', 'Created by you')}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => copyToClipboard(`${window.location.origin}/join/${link.id}?projectId=${project.id}&tenantId=${project.tenantId}`)}
                                                className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                                            >
                                                {t('projectTeam.invite.copyLink')}
                                            </button>
                                            <div className="w-px h-3 bg-[var(--color-surface-border)]" />
                                            <button
                                                onClick={() => handleRevokeLink(link.id)}
                                                className="text-xs font-medium text-red-500 hover:text-red-600 hover:underline"
                                            >
                                                {t('projectTeam.invite.revoke')}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
