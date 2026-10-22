import React, { useState, useEffect } from 'react';
import { Project, ProjectMember, ProjectRole } from '../../types';
import { Button } from '../common/Button/Button';
import { Select } from '../common/Select/Select';
import { Badge } from '../common/Badge/Badge';
import {
    updateMemberRole,
    removeMember,
} from '../../services/dataService';
import { resolveActiveTenantId } from '../../services/domain/authService';
import { getUserProfile } from '../../services/domain/usersService';
import { listInvitations, revokeInvitation, type WorkspaceInvitation } from '../../services/domain/workspacesService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { InviteToWorkspaceModal } from '../workspace/InviteToWorkspaceModal';
import { auth, db } from '../../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useConfirm, useToast } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';
import { getRoleDisplayInfo, getWorkspaceRoles } from '../../services/rolesService';
import { CustomRole } from '../../types';
import './project-team-manager.scss';
import { initialOf } from '../../utils/initials';

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
    const [inviteLinks, setInviteLinks] = useState<WorkspaceInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInviteOpen, setInviteOpen] = useState(false);
    const { activeWorkspace } = useWorkspace();
    const canInvite = canManage && (activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin');
    const [internalCustomRoles, setInternalCustomRoles] = useState<CustomRole[]>([]);
    const customRoles = passedRoles || internalCustomRoles;
    const confirm = useConfirm();
    const { showError, showSuccess } = useToast();
    const { t, dateFormat, dateLocale } = useLanguage();

    // Subscribe to project updates to get real-time member list
    useEffect(() => {
        if (!project.id) return;

        const resolvedTenant = project.tenantId || resolveActiveTenantId();
        const projectRef = doc(db, `tenants/${resolvedTenant}/projects`, project.id);

        const unsubscribe = onSnapshot(projectRef, async (snap) => {
            if (snap.exists()) {
                const data = snap.data() as Project;
                const projectMembers = [...(data.members || [])];
                // The project owner always appears as Owner (legacy string members default to Viewer).
                if (data.ownerId && !projectMembers.some((m) => (typeof m === 'string' ? m : m.userId) === data.ownerId)) {
                    projectMembers.unshift({ userId: data.ownerId, role: 'Owner' as ProjectRole, joinedAt: data.createdAt as any, invitedBy: 'System' });
                }

                // Fetch details for all members
                const enriched = await Promise.all(projectMembers.map(async (m) => {
                    const baseMember = typeof m === 'string'
                        ? { userId: m, role: 'Viewer' as ProjectRole, joinedAt: new Date(), invitedBy: 'System' }
                        : m;
                    const memberData = data.ownerId && baseMember.userId === data.ownerId
                        ? { ...baseMember, role: 'Owner' as ProjectRole }
                        : baseMember;

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
        if (!canInvite || !project.tenantId) return;
        try {
            const invitations = await listInvitations(project.tenantId);
            setInviteLinks(invitations.filter((invite) => invite.projectIds?.includes(project.id)));
        } catch (e) {
            console.error("Failed to load invitations", e);
        }
    };

    const loadCustomRoles = async () => {
        try {
            const roles = await getWorkspaceRoles(project.tenantId);
            setInternalCustomRoles(roles);

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
            showError(t('projectTeam.errors.updateRole'));
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!canManage) return;
        if (!await confirm(t('projectTeam.confirm.removeTitle'), t('projectTeam.confirm.removeMessage'))) return;

        try {
            await removeMember(project.id, userId, project.tenantId);
        } catch (e) {
            console.error("Failed to remove member", e);
            showError(t('projectTeam.errors.removeMember'));
        }
    };

    const handleRevokeLink = async (inviteId: string) => {
        if (!await confirm(t('projectTeam.confirm.revokeTitle'), t('projectTeam.confirm.revokeMessage'))) return;
        try {
            await revokeInvitation(project.tenantId || '', inviteId);
            loadInviteLinks();
        } catch (e) {
            console.error("Failed to revoke invitation", e);
            showError(t('projectTeam.errors.revokeInvite'));
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showSuccess(t('projectTeam.actions.copied'));
    };

    const legacySuffix = t('projectTeam.roles.legacySuffix');
    const baseRoleOptions = [
        { value: 'Owner', label: t('roles.owner') },
        ...customRoles.map(role => ({ value: role.id, label: role.name }))
    ];

    const getRoleOptions = (currentRole: string) => {
        const isLegacy = ['Viewer', 'Editor'].includes(currentRole) && !customRoles.find(r => r.id === currentRole);
        if (!isLegacy) return baseRoleOptions;
        return [{ value: currentRole, label: `${currentRole} (${legacySuffix})` }, ...baseRoleOptions];
    };

    const summaryCards = [
        {
            key: 'members',
            label: t('projectTeam.workbench.members'),
            value: String(members.length)
        },
        {
            key: 'invites',
            label: t('projectTeam.workbench.invites'),
            value: String(inviteLinks.length)
        },
        {
            key: 'access',
            label: t('projectTeam.workbench.access'),
            value: canManage ? t('projectTeam.workbench.manage') : t('projectTeam.workbench.view')
        }
    ];

    return (
        <div className="project-team">
            <div className="project-team__workbench">
                {summaryCards.map((card) => (
                    <div key={card.key} className="project-team__workbench-card">
                        <span className="project-team__workbench-label">{card.label}</span>
                        <span className="project-team__workbench-value">{card.value}</span>
                    </div>
                ))}
            </div>

            {/* Team Members List */}
            <section className="project-team__section">
                <div className="project-team__header">
                    <div>
                        <h3 className="project-team__title">{t('projectTeam.title')}</h3>
                        <p className="project-team__subtitle">{t('projectTeam.subtitle')}</p>
                    </div>
                </div>

                <div className="project-team__list-card">
                    {loading ? (
                        <div className="project-team__status">
                            <span className="material-symbols-outlined project-team__status-icon">progress_activity</span>
                        </div>
                    ) : members.length === 0 ? (
                        <div className="project-team__status project-team__status--empty">
                            <p>{t('projectTeam.empty')}</p>
                        </div>
                    ) : (
                        <div className="project-team__list">
                            {members.map((member) => {
                                const isSelf = auth.currentUser?.uid === member.userId;
                                const roleOptions = getRoleOptions(member.role);
                                const roleInfo = getRoleDisplayInfo(customRoles, member.role);

                                return (
                                    <div key={member.userId} className="project-team__member">
                                        <div className="project-team__member-info">
                                            <div className="project-team__avatar">
                                                {member.photoURL ? (
                                                    <img src={member.photoURL} alt={member.displayName} className="project-team__avatar-image" />
                                                ) : (
                                                    <span className="project-team__avatar-fallback">
                                                        {initialOf(member.displayName)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="project-team__member-meta">
                                                <p className="project-team__member-name">
                                                    {member.displayName}
                                                    {isSelf && (
                                                        <span className="project-team__member-you">
                                                            ({t('common.you')})
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="project-team__member-email">{member.email}</p>
                                            </div>
                                        </div>

                                        <div className="project-team__member-actions">
                                            {canManage && member.userId !== project.ownerId ? (
                                                <>
                                                    <Select
                                                        value={member.role}
                                                        onChange={(value) => handleRoleChange(member.userId, String(value))}
                                                        options={roleOptions}
                                                        className="project-team__role-select"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="project-team__remove"
                                                        onClick={() => handleRemoveMember(member.userId)}
                                                        aria-label={t('projectTeam.actions.remove')}
                                                    >
                                                        <span className="material-symbols-outlined">person_remove</span>
                                                    </Button>
                                                </>
                                            ) : (
                                                <Badge
                                                    variant="neutral"
                                                    className="project-team__role-badge"
                                                    style={{
                                                        backgroundColor: `${roleInfo.color}20`,
                                                        color: roleInfo.color,
                                                        borderColor: `${roleInfo.color}40`
                                                    }}
                                                >
                                                    {roleInfo.name}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* Invite Section — invitations add people to the workspace with access to this project */}
            {canManage && (
                <section className="project-team__section project-team__section--invite">
                    <div className="project-team__divider" />
                    <div className="project-team__header">
                        <div>
                            <h3 className="project-team__title">{t('projectTeam.invite.title')}</h3>
                            <p className="project-team__subtitle">
                                {canInvite ? t('projectTeam.invite.subtitle') : t('projectTeam.invite.adminOnly')}
                            </p>
                        </div>
                        {canInvite && (
                            <Button
                                variant="primary"
                                onClick={() => setInviteOpen(true)}
                                icon={<span className="material-symbols-outlined">person_add</span>}
                            >
                                {t('projectTeam.invite.cta')}
                            </Button>
                        )}
                    </div>

                    {inviteLinks.length > 0 && (
                        <div className="project-team__links">
                            <h4 className="project-team__links-title">{t('projectTeam.invite.active')}</h4>
                            <div className="project-team__links-list">
                                {inviteLinks.map(invite => (
                                    <div key={invite.id} className="project-team__link-row">
                                        <Badge variant="neutral" className="project-team__role-badge">
                                            {t(`workspace.role.${invite.role}`)}
                                        </Badge>
                                        <div className="project-team__link-meta">
                                            <span className="project-team__link-author">
                                                {invite.email || t('workspace.invite.kind.link')}
                                            </span>
                                            {invite.expiresAt && (
                                                <span className="project-team__link-expires">
                                                    {t('projectTeam.invite.expires').replace('{date}', format(new Date(invite.expiresAt), dateFormat, { locale: dateLocale }))}
                                                </span>
                                            )}
                                        </div>
                                        <div className="project-team__link-actions">
                                            <button
                                                type="button"
                                                onClick={() => copyToClipboard(`${window.location.origin}/invite/${invite.tenantId}/${invite.id}`)}
                                                className="project-team__link-action"
                                            >
                                                {t('projectTeam.invite.copyLink')}
                                            </button>
                                            <span className="project-team__link-separator" />
                                            <button
                                                type="button"
                                                onClick={() => handleRevokeLink(invite.id)}
                                                className="project-team__link-action project-team__link-action--danger"
                                            >
                                                {t('projectTeam.invite.revoke')}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <InviteToWorkspaceModal
                        isOpen={isInviteOpen}
                        onClose={() => setInviteOpen(false)}
                        projects={[project]}
                        initialProjectIds={[project.id]}
                        initialRole="Guest"
                        onCreated={loadInviteLinks}
                    />
                </section>
            )}
        </div>
    );
};
