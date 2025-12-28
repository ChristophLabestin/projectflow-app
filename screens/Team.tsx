import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import {
    getActiveTenantId,
    subscribeTenantUsers,
    subscribeTenantProjects,
    subscribeWorkspaceGroups,
    generateWorkspaceInviteLink,
    updateUserRole,
    createWorkspaceGroup,
    deleteWorkspaceGroup,
    addUserToGroup,
    removeUserFromGroup,
    removeMember,
    removeUserFromWorkspace,
    getSharedProjects,
    getUserProfile,
    updateProjectMemberRole,
    getWorkspaceInviteLinks,
    revokeWorkspaceInviteLink,
    getProjectInviteLinks,
    revokeProjectInviteLink
} from '../services/dataService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { GroupCreateModal } from '../components/GroupCreateModal';
import { Badge } from '../components/ui/Badge';
import { Project, WorkspaceGroup, WorkspaceRole, Member, ProjectRole } from '../types';
import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { useConfirm, useToast } from '../context/UIContext';
import { toMillis } from '../utils/time';
import { useLanguage } from '../context/LanguageContext';

// Helper to align local types if needed, or just use Member
interface TeamMember extends Member {
    id: string; // docId convenience
    groupIds?: string[]; // Add groupIds to TeamMember interface
}

export const Team = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<TeamMember[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
    const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
    const [inviteLinks, setInviteLinks] = useState<any[]>([]); // Using any for now, matches dataService return
    const [externalUsers, setExternalUsers] = useState<Record<string, TeamMember>>({});
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showGroupCreateModal, setShowGroupCreateModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'projects' | 'groups' | 'members' | 'invites'>('projects');

    // For adding members to groups
    const [selectedUserForGroup, setSelectedUserForGroup] = useState<Record<string, string>>({});
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedLinkId(id);
        setTimeout(() => setCopiedLinkId(null), 2000);
    };

    const tenantId = useMemo(() => getActiveTenantId() || auth.currentUser?.uid || '', []);

    // Permission Hook
    const { can, isOwner, isAdmin, role: myRole } = useWorkspacePermissions();
    const { t, language } = useLanguage();
    const locale = language === 'de' ? 'de-DE' : 'en-US';

    const confirm = useConfirm();
    const { showError, showSuccess } = useToast();

    useEffect(() => {
        if (!tenantId) return;

        const unsubUsers = subscribeTenantUsers((data) => {
            // Map id to uid if missing, ensure type safety
            const mapped = data.map(d => ({
                ...d,
                uid: d.id,
                role: d.role || 'Member',
                groupIds: d.groupIds || []
            })) as TeamMember[];

            // Filter out Guests (project-only members) from the main workspace list
            setUsers(mapped);
        }, tenantId);

        const unsubProjects = subscribeTenantProjects(setProjects, tenantId);

        const unsubGroups = subscribeWorkspaceGroups(setGroups, tenantId);

        // Fetch Shared Projects (from other workspaces)
        getSharedProjects().then(setSharedProjects).catch(err => console.error("Failed to fetch shared projects", err));

        return () => {
            unsubUsers();
            unsubProjects();
            unsubGroups();
        };
        if (activeTab === 'invites' && (isAdmin || isOwner)) {
            getWorkspaceInviteLinks(tenantId).then(setInviteLinks).catch(console.error);
        }
    }, [tenantId, activeTab, isAdmin, isOwner]);

    // Fetch details for external users (members of shared projects not in this workspace)
    useEffect(() => {
        const allProjectMembers = [...projects, ...sharedProjects].flatMap(p => {
            const members = p.members || [];
            return members.map(m => ({
                id: typeof m === 'string' ? m : m.userId,
                tenantId: p.tenantId
            }));
        });

        // ... rest of existing external user fetch logic ...
        // Keeping it collapsed for now as I only need to insert the invite fetch above it.
        // But wait, replace_file_content replaces the whole block. I should be careful not to delete code.
        // Let's just insert the invite fetch effect above the existing one.

        // Actually, looking at the previous view_file, the external user effect starts around line 89.
        // I will target the space before it.
    }, [tenantId]); // This is closing the FIRST effect (users/projects subscription)

    // Effect for fetching invites (Workspace + Assigned Projects)
    useEffect(() => {
        if (!tenantId) return;
        if (activeTab === 'invites' && (isAdmin || isOwner)) {
            const fetchAllInvites = async () => {
                // 1. Fetch Workspace Invites
                const wsLinks = await getWorkspaceInviteLinks(tenantId).catch(e => []);
                const wsLinksWithMeta = wsLinks.map(l => ({ ...l, type: 'workspace' }));

                // 2. Fetch Project Invites (for all projects I have access to)
                // Note: Only admins/owners typically see *all* projects, members only see theirs.
                // Depending on requirements, we might want to show invites for projects the user manages.
                // Assuming Admin/Owner permission check above covers intent for now.
                const projPromises = projects.map(async (p) => {
                    try {
                        const pLinks = await getProjectInviteLinks(p.id, tenantId);
                        return pLinks.map(l => ({ ...l, type: 'project', projectName: p.title, projectId: p.id }));
                    } catch (e) {
                        return [];
                    }
                });
                const projLinksArrays = await Promise.all(projPromises);
                const allProjLinks = projLinksArrays.flat();

                // 3. Merge & Sort
                const allLinks = [...wsLinksWithMeta, ...allProjLinks].sort((a, b) =>
                    toMillis(b.createdAt) - toMillis(a.createdAt)
                );

                setInviteLinks(allLinks);
            };

            fetchAllInvites();
        }
    }, [tenantId, activeTab, isAdmin, isOwner, projects]);

    const handleRevokeLink = async (link: any) => {
        if (!await confirm(t('team.invites.confirmRevoke.title'), t('team.invites.confirmRevoke.message'))) return;
        try {
            if (link.type === 'workspace') {
                await revokeWorkspaceInviteLink(link.id, tenantId);
            } else if (link.type === 'project' && link.projectId) {
                await revokeProjectInviteLink(link.projectId, link.id, tenantId);
            }

            showSuccess(t('team.invites.toast.revoked'));

            // Re-fetch to refresh list
            // (We could duplicate the fetch logic or extract it to a function, but triggering effect via a transient state might be cleaner or just copy-paste for now for simplicity)
            // Ideally trigger a re-run of the effect. For now, let's just re-call the logic or depend on a 'refresh' toggle.
            // Simplified: re-calling the internal logic is hard without extraction.
            // I'll extract `loadInvites` to a useCallback in next step if needed, or just force update via simple state toggle. 
            // Actually, for this replacement, I'll just clear the list and let the effect run? No, dependency loop.
            // Let's just manually re-run the fetch logic here locally for now as validation. Be careful with code duplication. 
            // Better: update state locally to remove the item immediately for instant feedback.
            setInviteLinks(prev => prev.filter(l => l.id !== link.id));

        } catch (err: any) {
            showError(err.message || t('team.invites.toast.revokeError'));
        }
    };

    // Fetch details for external users (members of shared projects not in this workspace)
    useEffect(() => {
        const allProjectMembers = [...projects, ...sharedProjects].flatMap(p => {
            const members = p.members || [];
            return members.map(m => ({
                id: typeof m === 'string' ? m : m.userId,
                tenantId: p.tenantId
            }));
        });

        // Filter out users we already have (either in 'users' state or already in 'externalUsers')
        const currentLocalIds = new Set(users.map(u => u.id));
        const needed = allProjectMembers.filter(m => !currentLocalIds.has(m.id) && !externalUsers[m.id]);

        // Dedup by ID
        const uniqueNeeded = Array.from(new Map(needed.map(m => [m.id, m])).values());

        if (uniqueNeeded.length === 0) return;

        const fetchExternal = async () => {
            const results: Record<string, TeamMember> = { ...externalUsers };
            let changed = false;

            for (const { id, tenantId } of uniqueNeeded) {
                if (!tenantId) continue;
                try {
                    const profile = await getUserProfile(id, tenantId);
                    if (profile) {
                        results[id] = { ...profile, id } as TeamMember;
                        changed = true;
                    }
                } catch (err) {
                    console.error(`Failed to fetch profile for ${id} in tenant ${tenantId}`, err);
                }
            }

            if (changed) {
                setExternalUsers(results);
            }
        };

        fetchExternal();
    }, [projects, sharedProjects, users]);

    // Derived Data for Projects View
    const { projectGroups, workspaceUsers } = useMemo(() => {
        const assignedUserIds = new Set<string>();
        const allProjects = [...projects, ...sharedProjects];

        const groups = allProjects.map(project => {
            const memberIds = (project.members || []).map((m: any) =>
                typeof m === 'string' ? m : m.userId
            );

            const projectUsers = memberIds
                .map(id => users.find(u => u.id === id) || externalUsers[id])
                .filter((u): u is TeamMember => !!u);

            return {
                project,
                users: projectUsers
            };
        });

        const relevantGroups = groups.filter(g => g.users.length > 0);
        relevantGroups.forEach(g => {
            g.users.forEach(u => {
                // Only mark as assigned if it matches a local workspace user
                if (users.find(local => local.id === u.id)) {
                    assignedUserIds.add(u.id);
                }
            });
        });

        const unassigned = users.filter(u => !assignedUserIds.has(u.id));

        return { projectGroups: relevantGroups, workspaceUsers: unassigned };
    }, [users, projects, sharedProjects, externalUsers]);

    const roleLabels: Record<string, string> = {
        Owner: t('roles.owner'),
        Admin: t('roles.admin'),
        Member: t('roles.member'),
        Guest: t('roles.guest'),
        Editor: t('roles.editor'),
        Viewer: t('roles.viewer')
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        if (!can('canManageMembers')) return;
        try {
            await updateUserRole(userId, newRole as WorkspaceRole, tenantId);
        } catch (error) {
            console.error("Failed to update role", error);
            showError(t('team.members.errors.updateRole'));
        }
    };

    const handleCreateGroup = async (name: string, description: string, color: string) => {
        try {
            await createWorkspaceGroup(name, color, description, tenantId);
            showSuccess(t('team.groups.toast.created'));
        } catch (error) {
            console.error(error);
            showError(t('team.groups.toast.createError'));
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!await confirm(t('team.groups.confirmDelete.title'), t('team.groups.confirmDelete.message'))) return;
        try {
            await deleteWorkspaceGroup(groupId, tenantId);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddMemberToGroup = async (groupId: string) => {
        const userId = selectedUserForGroup[groupId];
        if (!userId) return;
        try {
            await addUserToGroup(userId, groupId, tenantId);
            setSelectedUserForGroup(prev => ({ ...prev, [groupId]: '' }));
        } catch (error) {
            console.error(error);
        }
    };

    const handleRemoveMemberFromGroup = async (groupId: string, userId: string) => {
        if (!await confirm(t('team.groups.confirmRemoveMember.title'), t('team.groups.confirmRemoveMember.message'))) return;
        try {
            await removeUserFromGroup(userId, groupId, tenantId);
        } catch (error) {
            console.error(error);
        }
    };

    const handleRemoveFromProject = async (projectId: string, userId: string, projectTenantId?: string) => {
        if (!await confirm(t('team.projects.confirmRemove.title'), t('team.projects.confirmRemove.message'))) return;
        try {
            await removeMember(projectId, userId, projectTenantId || tenantId);
            showSuccess(t('team.projects.toast.removed'));
        } catch (error: any) {
            console.error("Failed to remove member from project:", error);
            showError(error.message || t('team.projects.toast.removeError'));
        }
    };

    const handleRemoveFromWorkspace = async (userId: string) => {
        if (!await confirm(t('team.members.confirmRemove.title'), t('team.members.confirmRemove.message'))) return;
        try {
            await removeUserFromWorkspace(userId, tenantId);
            showSuccess(t('team.members.toast.removed'));
        } catch (error: any) {
            console.error("Failed to remove user from workspace:", error);
            showError(error.message || t('team.members.toast.removeError'));
        }
    };

    const handleProjectRoleChange = async (projectId: string, userId: string, newRole: string, projectTenantId?: string) => {
        try {
            await updateProjectMemberRole(projectId, userId, newRole as ProjectRole, projectTenantId || tenantId);
            showSuccess(t('team.projects.toast.roleUpdated').replace('{role}', roleLabels[newRole] || newRole));
            // Note: Optimistic update or refresh might be needed, but subscription should handle it
        } catch (error: any) {
            console.error(error);
            showError(error.message || t('team.projects.toast.roleError'));
        }
    };

    const renderUserRow = (
        u: TeamMember,
        contextRole?: string,
        showRoleDropdown = false,
        onRemove?: () => void,
        onRoleChange?: (role: string) => void,
        roleOptions?: { label: string, value: string }[]
    ) => (
        <div key={u.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors rounded-lg group">
            <div
                className="w-10 h-10 rounded-full bg-center bg-cover bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0"
                style={{ backgroundImage: u.photoURL ? `url("${u.photoURL}")` : 'none' }}
            >
                {!u.photoURL && (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-text-subtle)] font-bold">
                        {(u.displayName || '?').charAt(0).toUpperCase()}
                    </div>
                )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--color-text-main)] truncate">{u.displayName || t('team.members.fallbackName')}</span>

                    {/* Workspace Owner Badge */}
                    {u.id === tenantId && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            {t('team.members.badges.workspaceOwner')}
                        </span>
                    )}

                    {/* Context Role (e.g. Project Role) */}
                    {contextRole && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400">
                            {roleLabels[contextRole] || contextRole}
                        </span>
                    )}

                    {/* Me Badge */}
                    {u.id === auth.currentUser?.uid && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">
                            {t('common.you')}
                        </span>
                    )}
                </div>
                {/* Email & Groups */}
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-subtle)] mt-1 flex-wrap">
                    <span className="truncate">{u.email || u.id}</span>
                    {u.groupIds && u.groupIds.map(gid => {
                        const grp = groups.find(g => g.id === gid);
                        if (!grp) return null;
                        return (
                            <span
                                key={gid}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                                style={{ backgroundColor: grp.color || '#9ca3af' }}
                            >
                                {grp.name}
                            </span>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Role Manager */}
                {showRoleDropdown && (onRoleChange || (can('canManageMembers') && u.id !== tenantId)) && (
                    <div className="w-32">
                        <Select
                            value={onRoleChange ? (contextRole || 'Viewer') : (u.role || 'Member')}
                            onChange={(e) => onRoleChange ? onRoleChange(e.target.value) : handleRoleChange(u.id, e.target.value)}
                            disabled={u.id === auth.currentUser?.uid && !onRoleChange} // Can't change own workspace role, but maybe project role? For now disable own project role too for safety? Actually Owners can demote themselves.
                        >
                            {roleOptions ? (
                                roleOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))
                            ) : (
                                <>
                                    <option value="Admin">{t('roles.admin')}</option>
                                    <option value="Member">{t('roles.member')}</option>
                                    <option value="Guest">{t('roles.guest')}</option>
                                </>
                            )}
                        </Select>
                    </div>
                )}
                {/* Show static role if logic prevents dropdown or not in dropdown mode */}
                {(!showRoleDropdown || (!onRoleChange && (!can('canManageMembers') || u.id === tenantId))) && !contextRole && (
                    <span className="text-xs font-medium text-[var(--color-text-muted)] border px-2 py-1 rounded">
                        {roleLabels[u.role || 'Member'] || u.role || t('roles.member')}
                    </span>
                )}

                {/* Remove Button */}
                {onRemove && u.id !== auth.currentUser?.uid && u.id !== tenantId && (
                    <button
                        onClick={onRemove}
                        className="text-[var(--color-text-subtle)] hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        title={t('team.members.actions.remove')}
                    >
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto p-6 flex flex-col gap-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[var(--color-primary)]">groups</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">{t('team.header.workspace')}</span>
                    </div>
                    <h1 className="h2 text-[var(--color-text-main)]">{t('team.header.title')}</h1>
                    <p className="text-[var(--color-text-muted)]">{t('team.header.subtitle')}</p>
                </div>
                <div>
                    {can('canManageMembers') && (
                        <Button
                            onClick={() => setShowInviteModal(true)}
                            variant="primary"
                            icon={<span className="material-symbols-outlined">person_add</span>}
                        >
                            {t('team.actions.inviteMember')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
                {[
                    { id: 'projects', label: t('team.tabs.projects'), icon: 'folder' },
                    { id: 'groups', label: t('team.tabs.groups'), icon: 'diversity_3' },
                    { id: 'members', label: t('team.tabs.members'), icon: 'group' },
                    ...((isAdmin || isOwner) ? [{ id: 'invites', label: t('team.tabs.invites'), icon: 'mail' }] : [])
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content: Projects */}
            {activeTab === 'projects' && (
                <div className="flex flex-col gap-8">
                    {projectGroups.map(group => (
                        <section key={group.project.id}>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
                                        <span className="material-symbols-outlined text-lg">folder</span>
                                    </div>
                                    <h3 className="text-base font-bold text-[var(--color-text-main)]">
                                        {group.project.title || t('team.projects.untitled')}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => navigate(`/project/${group.project.id}`)}
                                        icon={<span className="material-symbols-outlined">arrow_forward</span>}
                                    >
                                        {t('team.projects.goToProject')}
                                    </Button>
                                    <span className="text-xs font-medium bg-[var(--color-surface-paper)] px-2 py-0.5 rounded-full text-[var(--color-text-muted)] border border-[var(--color-surface-border)]">
                                        {t('team.projects.memberCount').replace('{count}', String(group.users.length))}
                                    </span>
                                </div>
                            </div>
                            <Card padding="none" className="flex flex-col gap-1 p-1">
                                {group.users.length > 0 ? (
                                    group.users.map(u => {
                                        const members = group.project.members || [];
                                        const memberRec = members.find((m: any) => (typeof m === 'object' ? m.userId : m) === u.id);
                                        const isRowUserProjectOwner = u.id === group.project.ownerId;
                                        const role = isRowUserProjectOwner ? 'Owner' : (typeof memberRec === 'object' ? memberRec.role : undefined);

                                        const isCurrentUserProjectOwner = group.project.ownerId === auth.currentUser?.uid;
                                        const canManageProject = isCurrentUserProjectOwner || isAdmin;
                                        const canEditThisMember = canManageProject && !isRowUserProjectOwner;

                                        return renderUserRow(
                                            u,
                                            role,
                                            canManageProject, // Show dropdown if I am manager
                                            (canEditThisMember && !isRowUserProjectOwner) ? () => handleRemoveFromProject(group.project.id, u.id, group.project.tenantId) : undefined,
                                            canEditThisMember ? (newRole) => handleProjectRoleChange(group.project.id, u.id, newRole, group.project.tenantId) : undefined,
                                            [
                                                { label: t('roles.owner'), value: 'Owner' },
                                                { label: t('roles.editor'), value: 'Editor' },
                                                { label: t('roles.viewer'), value: 'Viewer' }
                                            ]
                                        );
                                    })
                                ) : (
                                    <div className="p-4 text-sm text-[var(--color-text-muted)] italic">{t('team.projects.emptyMembers')}</div>
                                )}
                            </Card>
                        </section>
                    ))}

                    {workspaceUsers.length > 0 && (
                        <section>
                            <div className="flex items-center gap-3 mb-3 px-1">
                                <span className="material-symbols-outlined text-gray-400">domain</span>
                                <h3 className="text-base font-bold text-[var(--color-text-main)]">{t('team.projects.unassigned')}</h3>
                            </div>
                            <Card padding="none" className="flex flex-col gap-1 p-1">
                                {workspaceUsers.map(u => renderUserRow(
                                    u,
                                    undefined,
                                    false,
                                    can('canManageMembers') ? () => handleRemoveFromWorkspace(u.id) : undefined
                                ))}
                            </Card>
                        </section>
                    )}
                </div>
            )}

            {/* Content: Groups */}
            {activeTab === 'groups' && (
                <div className="flex flex-col gap-6">
                    {can('canManageGroups') && (
                        <div className="flex justify-end">
                            <Button
                                onClick={() => setShowGroupCreateModal(true)}
                                variant="outline"
                                icon={<span className="material-symbols-outlined">add</span>}
                            >
                                {t('team.groups.actions.create')}
                            </Button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {groups.map(group => {
                            const groupMembers = users.filter(u => group.memberIds?.includes(u.id));
                            const usersNotInGroup = users.filter(u => !group.memberIds?.includes(u.id));

                            return (
                                <Card key={group.id} className="flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: group.color }}
                                                />
                                                <h3 className="font-bold text-lg">{group.name}</h3>
                                            </div>
                                            {group.description && (
                                                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                                                    {group.description}
                                                </p>
                                            )}
                                        </div>
                                        {can('canManageGroups') && (
                                            <button
                                                onClick={() => handleDeleteGroup(group.id)}
                                                className="text-[var(--color-text-subtle)] hover:text-rose-500 transition-colors"
                                                title={t('team.groups.actions.delete')}
                                            >
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex-1 flex flex-col gap-3">
                                        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-2 flex justify-between items-center">
                                            <span>{t('team.groups.membersCount').replace('{count}', String(groupMembers.length))}</span>
                                        </div>

                                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                                            {groupMembers.length > 0 ? (
                                                groupMembers.map(m => (
                                                    <div key={m.id} className="flex items-center justify-between group/item p-1 hover:bg-[var(--color-surface-hover)] rounded">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-6 h-6 rounded-full bg-gray-200 bg-center bg-cover"
                                                                style={{ backgroundImage: m.photoURL ? `url(${m.photoURL})` : undefined }}
                                                            />
                                                            <span className="text-sm truncate max-w-[120px]">{m.displayName}</span>
                                                        </div>
                                                        {can('canManageGroups') && (
                                                            <button
                                                                onClick={() => handleRemoveMemberFromGroup(group.id, m.id)}
                                                                className="opacity-0 group-hover/item:opacity-100 text-rose-500 hover:text-rose-700 transition-opacity"
                                                            >
                                                                <span className="material-symbols-outlined text-base">remove_circle</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-[var(--color-text-subtle)] italic">{t('team.groups.emptyMembers')}</p>
                                            )}
                                        </div>

                                        {can('canManageGroups') && (
                                            <div className="mt-auto pt-4 flex gap-2">
                                                <div className="flex-1">
                                                    <Select
                                                        value={selectedUserForGroup[group.id] || ''}
                                                        onChange={(e) => setSelectedUserForGroup(p => ({ ...p, [group.id]: e.target.value }))}
                                                        placeholder={t('team.groups.addUserPlaceholder')}
                                                    >
                                                        <option value="" disabled>{t('team.groups.selectUser')}</option>
                                                        {usersNotInGroup.map(u => (
                                                            <option key={u.id} value={u.id}>{u.displayName}</option>
                                                        ))}
                                                    </Select>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    disabled={!selectedUserForGroup[group.id]}
                                                    onClick={() => handleAddMemberToGroup(group.id)}
                                                    icon={<span className="material-symbols-outlined">add</span>}
                                                >
                                                    {t('common.add')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                        {groups.length === 0 && (
                            <div className="col-span-full text-center p-8 text-[var(--color-text-muted)] border-2 border-dashed border-[var(--color-border)] rounded-xl">
                                <p>{t('team.groups.empty')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Content: Members */}
            {activeTab === 'members' && (
                <div className="flex flex-col gap-8">
                    {/* Workspace Members Section */}
                    <section>
                        <div className="flex items-center gap-3 mb-3 px-1">
                            <span className="material-symbols-outlined text-[var(--color-primary)]">badge</span>
                            <h3 className="text-base font-bold text-[var(--color-text-main)]">{t('team.members.workspaceTitle')}</h3>
                        </div>
                        <Card padding="none" className="flex flex-col gap-1 p-1">
                            {users.filter(u => u.role !== 'Guest').map(u => renderUserRow(
                                u,
                                undefined,
                                true,
                                can('canManageMembers') ? () => handleRemoveFromWorkspace(u.id) : undefined
                            ))}
                            {users.filter(u => u.role !== 'Guest').length === 0 && (
                                <div className="p-4 text-sm text-[var(--color-text-muted)] italic">{t('team.members.emptyWorkspace')}</div>
                            )}
                        </Card>
                    </section>

                    {/* Guests Section */}
                    <section>
                        <div className="flex items-center gap-3 mb-3 px-1">
                            <span className="material-symbols-outlined text-[var(--color-text-subtle)]">person_outline</span>
                            <h3 className="text-base font-bold text-[var(--color-text-main)]">{t('team.members.guestsTitle')}</h3>
                        </div>
                        <Card padding="none" className="flex flex-col gap-1 p-1">
                            {users.filter(u => u.role === 'Guest').map(u => renderUserRow(
                                u,
                                undefined,
                                true,
                                can('canManageMembers') ? () => handleRemoveFromWorkspace(u.id) : undefined
                            ))}
                            {users.filter(u => u.role === 'Guest').length === 0 && (
                                <div className="p-4 text-sm text-[var(--color-text-muted)] italic">{t('team.members.emptyGuests')}</div>
                            )}
                        </Card>
                    </section>
                </div>
            )}

            {/* Content: Invites */}
            {activeTab === 'invites' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="h4 text-[var(--color-text-main)]">{t('team.invites.title')}</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('team.invites.subtitle')}</p>
                        </div>
                        <Button
                            onClick={() => setShowInviteModal(true)}
                            icon={<span className="material-symbols-outlined">add_link</span>}
                        >
                            {t('team.invites.actions.create')}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {inviteLinks.map(link => {
                            const isWorkspace = link.type === 'workspace';
                            const accentColor = isWorkspace ? 'border-indigo-500' : 'border-amber-500';
                            const icon = isWorkspace ? 'domain' : 'folder_open';
                            const title = isWorkspace ? t('team.invites.workspaceTitle') : link.projectName;

                            return (
                                <Card
                                    key={link.id}
                                    padding="none"
                                    className={`relative group hover:shadow-md transition-shadow overflow-hidden border-t-4 ${accentColor}`}
                                >
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-lg ${isWorkspace ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}`}>
                                                    <span className="material-symbols-outlined">{icon}</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-[var(--color-text-main)] leading-tight mb-1">
                                                        {title}
                                                    </h4>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant={link.role === 'Admin' ? 'warning' : 'primary'} size="sm">
                                                            {roleLabels[link.role] || link.role}
                                                        </Badge>
                                                        {!isWorkspace && (
                                                            <span className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider font-bold">
                                                                {t('team.invites.projectBadge')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-[var(--color-text-subtle)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 -mr-2 -mt-2"
                                                onClick={() => handleRevokeLink(link)}
                                                title={t('team.invites.actions.revoke')}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-4">
                                            <div className="bg-[var(--color-surface-hover)] rounded-lg p-2">
                                                <span className="block text-[10px] uppercase font-bold text-[var(--color-text-subtle)] mb-1">
                                                    {t('team.invites.expires')}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                                                    <span className="material-symbols-outlined text-[14px]">event</span>
                                                    <span>{new Date(toMillis(link.expiresAt)).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                </div>
                                            </div>
                                            <div className="bg-[var(--color-surface-hover)] rounded-lg p-2">
                                                <span className="block text-[10px] uppercase font-bold text-[var(--color-text-subtle)] mb-1">
                                                    {t('team.invites.usage')}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                                                    <span className="material-symbols-outlined text-[14px]">group</span>
                                                    <span>{link.uses} / {link.maxUses || t('team.invites.unlimited')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-[var(--color-surface-border)]">
                                        {(() => {
                                            const url = link.type === 'workspace'
                                                ? `${window.location.origin}/join-workspace/${link.id}?tenantId=${tenantId}`
                                                : `${window.location.origin}/invite/${link.projectId}?tenantId=${tenantId}`;

                                            const finalUrl = link.type === 'workspace'
                                                ? url
                                                : url; // Logic simplified as variable above already handles it

                                            const isCopied = copiedLinkId === link.id;

                                            return (
                                                <div className="flex items-center gap-2 bg-[var(--color-surface-hover)] p-2 rounded text-xs font-mono text-[var(--color-text-subtle)] truncate relative group/link">
                                                    <span className="truncate flex-1">{finalUrl}</span>
                                                    <button
                                                        className={`font-bold ml-2 transition-all ${isCopied ? 'text-emerald-600 dark:text-emerald-400 opacity-100' : 'text-[var(--color-primary)] opacity-0 group-hover/link:opacity-100'}`}
                                                        onClick={() => handleCopy(link.id, finalUrl)}
                                                    >
                                                        {isCopied ? t('common.copied') : t('common.copy')}
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </Card>
                            );
                        })}
                        {inviteLinks.length === 0 && (
                            <div className="col-span-full py-12 text-center text-[var(--color-text-muted)] border-2 border-dashed border-[var(--color-surface-border)] rounded-xl">
                                <span className="material-symbols-outlined text-4xl opacity-50 mb-2">link_off</span>
                                <p>{t('team.invites.empty')}</p>
                                <Button variant="ghost" className="mt-2" onClick={() => setShowInviteModal(true)}>{t('team.invites.actions.createNow')}</Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            <InviteMemberModal
                isOpen={showInviteModal}
                onClose={() => {
                    setShowInviteModal(false);
                    // Refresh invitations if we were on the tab
                    if (activeTab === 'invites') {
                        getWorkspaceInviteLinks(tenantId).then(setInviteLinks);
                    }
                }}
                onGenerateLink={(role, maxUses, expiresIn) =>
                    generateWorkspaceInviteLink(role as WorkspaceRole, maxUses, expiresIn, tenantId)
                }
                projectTitle={t('team.header.workspace')}
                isWorkspace={true}
            />

            <GroupCreateModal
                isOpen={showGroupCreateModal}
                onClose={() => setShowGroupCreateModal(false)}
                onCreate={handleCreateGroup}
            />
        </div>
    );
};
