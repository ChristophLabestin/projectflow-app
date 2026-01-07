import React, { useState, useEffect } from 'react';
import { Project, ProjectMember, ProjectRole } from '../../types';
import { Button } from '../common/Button/Button';
import { Select } from '../common/Select/Select';
import { Badge } from '../common/Badge/Badge';
import { TextInput } from '../common/Input/TextInput';
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
import { useConfirm, useToast } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';
import { getRoleDisplayInfo, getWorkspaceRoles } from '../../services/rolesService';
import { CustomRole } from '../../types';
import './project-team-manager.scss';

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
    const { showError, showSuccess } = useToast();
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

    const handleGenerateLink = async () => {
        if (!canManage) return;
        setIsGenerating(true);
        try {
            const link = await generateInviteLink(project.id, inviteRole, undefined, 72, project.tenantId); // 72 hours expiration
            setGeneratedLink(link);
            loadInviteLinks();
        } catch (e) {
            console.error("Failed to generate link", e);
            showError(t('projectTeam.errors.generateInvite'));
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

    const getInviteRoleOptions = () => {
        const isLegacy = ['Viewer', 'Editor'].includes(inviteRole) && !customRoles.find(r => r.id === inviteRole);
        if (!isLegacy) return baseRoleOptions;
        return [{ value: inviteRole, label: `${inviteRole} (${legacySuffix})` }, ...baseRoleOptions];
    };

    return (
        <div className="project-team">
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
                                                        {member.displayName?.charAt(0) || '?'}
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

            {/* Invite Section */}
            {canManage && (
                <section className="project-team__section project-team__section--invite">
                    <div className="project-team__divider" />
                    <div className="project-team__header">
                        <div>
                            <h3 className="project-team__title">{t('projectTeam.invite.title')}</h3>
                            <p className="project-team__subtitle">{t('projectTeam.invite.subtitle')}</p>
                        </div>
                    </div>

                    <div className="project-team__invite-card">
                        <div className="project-team__invite-row">
                            <Select
                                value={inviteRole}
                                onChange={(value) => setInviteRole(String(value))}
                                options={getInviteRoleOptions()}
                                className="project-team__invite-select"
                            />
                            <Button
                                variant="primary"
                                onClick={handleGenerateLink}
                                isLoading={isGenerating}
                                icon={<span className="material-symbols-outlined">link</span>}
                                className="project-team__invite-button"
                            >
                                {t('projectTeam.invite.generate')}
                            </Button>
                        </div>

                        {generatedLink && (
                            <div className="project-team__invite-link animate-fade-in">
                                <TextInput
                                    value={generatedLink}
                                    readOnly
                                    className="project-team__link-input"
                                />
                                <Button variant="secondary" onClick={() => copyToClipboard(generatedLink)}>
                                    {t('common.copy')}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Active Invite Links */}
                    {inviteLinks.length > 0 && (
                        <div className="project-team__links">
                            <h4 className="project-team__links-title">{t('projectTeam.invite.active')}</h4>
                            <div className="project-team__links-list">
                                {inviteLinks.map(link => {
                                    const roleInfo = getRoleDisplayInfo(customRoles, link.role);
                                    const expiresAt = new Date(link.expiresAt.toDate ? link.expiresAt.toDate() : link.expiresAt);
                                    return (
                                        <div key={link.id} className="project-team__link-row">
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
                                            <div className="project-team__link-meta">
                                                <span className="project-team__link-expires">
                                                    {t('projectTeam.invite.expires').replace('{date}', format(expiresAt, dateFormat, { locale: dateLocale }))}
                                                </span>
                                                <span className="project-team__link-author">
                                                    {t('projectTeam.invite.createdByYou')}
                                                </span>
                                            </div>
                                            <div className="project-team__link-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(`${window.location.origin}/join/${link.id}?projectId=${project.id}&tenantId=${project.tenantId}`)}
                                                    className="project-team__link-action"
                                                >
                                                    {t('projectTeam.invite.copyLink')}
                                                </button>
                                                <span className="project-team__link-separator" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRevokeLink(link.id)}
                                                    className="project-team__link-action project-team__link-action--danger"
                                                >
                                                    {t('projectTeam.invite.revoke')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};
