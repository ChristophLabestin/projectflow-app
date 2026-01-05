import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { auth } from '../services/firebase';
import {
    getActiveTenantId,
    subscribeTenantUsers,
    subscribeTenantProjects,
    removeUserFromWorkspace,
    getSharedProjects,
    revokeWorkspaceInviteLink,
    revokeProjectInviteLink,
    updateUserRole,
    getWorkspaceInviteLinks,
    getProjectInviteLinks,
    getUserProfile,
    generateWorkspaceInviteLink,
    sendTeamInvitation
} from '../services/dataService';
import { getWorkspaceRoles } from '../services/rolesService';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { Project, WorkspaceRole, Member, CustomRole } from '../types';
import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { useConfirm, useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

// --- Types ---
interface TeamMember extends Member {
    id: string;
    role: WorkspaceRole;
}

interface InviteLink {
    id: string;
    email?: string;
    role: WorkspaceRole;
    type: 'workspace' | 'project';
    projectId?: string;
    projectName?: string;
    createdAt?: any;
}

type Tab = 'members' | 'projects' | 'invites';

export const Team = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const confirm = useConfirm();
    const { showError, showSuccess } = useToast();
    const { can, isOwner } = useWorkspacePermissions();
    const tenantId = useMemo(() => getActiveTenantId() || auth.currentUser?.uid || '', []);

    // --- State ---
    const [activeTab, setActiveTab] = useState<Tab>('members');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [users, setUsers] = useState<TeamMember[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
    const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');

    // --- Data Fetching ---
    useEffect(() => {
        if (!tenantId) return;

        const unsubUsers = subscribeTenantUsers((data) => {
            const mapped = data.map(d => ({
                ...d,
                uid: d.id,
                role: d.role || 'Member'
            })) as TeamMember[];
            setUsers(mapped);
        }, tenantId);

        const unsubProjects = subscribeTenantProjects(setProjects, tenantId);
        getSharedProjects().then(setSharedProjects).catch(console.error);
        getWorkspaceRoles(tenantId).then(setCustomRoles).catch(console.error);

        const fetchInvites = async () => {
            try {
                const [wsInvites, projInvites] = await Promise.all([
                    getWorkspaceInviteLinks(tenantId),
                    getProjectInviteLinks(tenantId)
                ]);

                const allInvites: InviteLink[] = [
                    ...wsInvites.map((i: any) => ({ ...i, type: 'workspace' as const })),
                    ...projInvites.map((i: any) => ({ ...i, type: 'project' as const }))
                ];
                setInviteLinks(allInvites);
            } catch (e) {
                console.error("Failed to fetch invites", e);
            }
        };
        fetchInvites();

        return () => {
            unsubUsers();
            unsubProjects();
        };
    }, [tenantId]);

    // --- Helpers ---
    const getRoleDetails = (roleId?: string) => {
        const id = roleId || 'Member';
        const custom = customRoles.find(r => r.id === id);
        if (custom) {
            return { label: custom.name, color: custom.color };
        }
        // Fallback or Legacy
        let label = id;
        let color = '#3b82f6';
        if (id === 'Owner') { label = t('roles.owner') || 'Owner'; color = '#f59e0b'; }
        else if (id === 'Admin') { label = t('roles.admin') || 'Admin'; color = '#ef4444'; }
        else if (id === 'Guest') { label = t('roles.guest') || 'Guest'; color = '#6b7280'; }
        else if (id === 'Member') { label = t('roles.member') || 'Member'; }

        return { label, color };
    };

    const getUserDetails = (userId: string) => users.find(u => u.id === userId);

    // --- Derived Data ---
    const listItems = useMemo(() => {
        let items: any[] = [];
        const q = searchQuery.toLowerCase();

        if (activeTab === 'members') {
            items = users.filter(u =>
                (u.displayName || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q)
            ).sort((a, b) => {
                // Owner first
                if (a.role === 'Owner') return -1;
                if (b.role === 'Owner') return 1;
                return (a.displayName || '').localeCompare(b.displayName || '');
            });
        } else if (activeTab === 'projects') {
            items = [...projects, ...sharedProjects].filter(p =>
                p.title.toLowerCase().includes(q)
            );
        } else {
            // Invites
            items = inviteLinks; // Simple for invites
        }
        return items;
    }, [activeTab, users, projects, sharedProjects, inviteLinks, searchQuery]);

    // Auto-select first item on tab change or search if nothing selected
    useEffect(() => {
        // If the currently selected ID is not in the new list, select the first one
        // OR if nothing is selected yet
        if (listItems.length > 0) {
            const exists = listItems.find(i => i.id === selectedId);
            if (!exists) {
                setSelectedId(listItems[0].id);
            }
        } else {
            setSelectedId(null);
        }
    }, [listItems, activeTab]);


    // --- Handlers ---
    const handleRoleChange = async (userId: string, newRole: string) => {
        if (!can('canManageMembers')) return;
        try {
            await updateUserRole(userId, newRole as WorkspaceRole, tenantId);
            showSuccess(t('team.members.toast.roleUpdated'));
        } catch (error) {
            console.error(error);
            showError(t('team.members.errors.updateRole'));
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!await confirm(t('team.members.confirmRemove.title'), t('team.members.confirmRemove.message'))) return;
        try {
            await removeUserFromWorkspace(userId, tenantId);
            showSuccess(t('team.members.toast.removed'));
            // Selection will auto-update via effect
        } catch (error: any) {
            showError(error.message || t('team.members.toast.removeError'));
        }
    };

    const handleRevokeInvite = async (link: InviteLink) => {
        try {
            if (link.type === 'workspace') await revokeWorkspaceInviteLink(link.id, tenantId);
            else await revokeProjectInviteLink(link.projectId!, link.id, tenantId);
            setInviteLinks(prev => prev.filter(l => l.id !== link.id));
            showSuccess('Invitation revoked');
        } catch (e) {
            showError('Failed to revoke invitation');
        }
    };

    // --- Selection Details ---
    const selectedItem = useMemo(() => {
        if (!selectedId) return null;
        return listItems.find(i => i.id === selectedId);
    }, [selectedId, listItems]);


    // --- Renderers ---

    // 1. Sidebar List Item
    const renderListItem = (item: any) => {
        const isSelected = selectedId === item.id;

        if (activeTab === 'members') {
            const member = item as TeamMember;
            return (
                <div
                    key={member.id}
                    onClick={() => setSelectedId(member.id)}
                    className={`
                        group relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-300
                        ${isSelected
                            ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] font-bold shadow-sm'
                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]/40 hover:text-[var(--color-text-main)]'}
                    `}
                >
                    {isSelected && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-[var(--color-primary)] rounded-r-full shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.6)]" />
                    )}

                    <div
                        className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 bg-cover bg-center shrink-0 border border-[var(--color-surface-border)]"
                        style={{ backgroundImage: member.photoURL ? `url(${member.photoURL})` : undefined }}
                    >
                        {!member.photoURL && <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)]">{(member.displayName || '?')[0].toUpperCase()}</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[14px]/none font-semibold truncate tracking-tight">{member.displayName || 'Unknown'}</p>
                        <p className="text-[12px] text-[var(--color-text-muted)] opacity-60 truncate mt-1 font-medium">{member.email}</p>
                    </div>
                </div>
            );
        }

        if (activeTab === 'projects') {
            const project = item as Project;
            return (
                <div
                    key={project.id}
                    onClick={() => setSelectedId(project.id)}
                    className={`
                        group relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-300
                        ${isSelected
                            ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] font-bold shadow-sm'
                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]/40 hover:text-[var(--color-text-main)]'}
                    `}
                >
                    {isSelected && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-[var(--color-primary)] rounded-r-full shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.6)]" />
                    )}

                    <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold shrink-0 border border-[var(--color-primary)]/10 text-sm">
                        {project.squareIcon ? <img src={project.squareIcon} className="w-full h-full object-cover rounded-lg" /> : project.title[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[14px]/none font-semibold truncate tracking-tight">{project.title}</p>
                    </div>
                </div>
            );
        }

        if (activeTab === 'invites') {
            const link = item as InviteLink;
            return (
                <div
                    key={link.id}
                    onClick={() => setSelectedId(link.id)}
                    className={`
                        group relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-300
                        ${isSelected
                            ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] font-bold shadow-sm'
                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]/40 hover:text-[var(--color-text-main)]'}
                    `}
                >
                    {isSelected && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-[var(--color-primary)] rounded-r-full shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.6)]" />
                    )}

                    <div className="w-9 h-9 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-muted)] shrink-0 border border-[var(--color-surface-border)]">
                        <span className="material-symbols-outlined text-[18px]">mail</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[14px]/none font-semibold truncate tracking-tight">{link.email || 'Pending Invite'}</p>
                        <p className="text-[12px] text-[var(--color-text-muted)] opacity-60 truncate mt-1 font-medium">{link.id}</p>
                    </div>
                </div>
            );
        }
        return null;
    };


    // 2. Detail Views
    const renderDetailView = () => {
        if (!selectedItem) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] opacity-50">
                    <span className="material-symbols-outlined text-6xl mb-4">person_search</span>
                    <p className="text-lg">Select an item to view details</p>
                </div>
            );
        }

        if (activeTab === 'members') {
            const member = selectedItem as TeamMember;
            const role = getRoleDetails(member.role);
            const memberProjects = [...projects, ...sharedProjects].filter(p =>
                p.ownerId === member.id || (p.members || []).some((m: any) => (typeof m === 'string' ? m : m.userId) === member.id)
            );
            const isMe = member.id === auth.currentUser?.uid;

            return (
                <div className="h-full flex flex-col overflow-y-auto animate-fade-in p-8 gap-8">
                    {/* Hero Section */}
                    <Card padding="lg" className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-[var(--color-primary)]/[0.03] to-transparent">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
                            <div
                                className="w-32 h-32 rounded-full bg-[var(--color-surface-hover)] bg-cover bg-center shrink-0 border-4 border-white dark:border-[var(--color-surface-border)] shadow-sm"
                                style={{ backgroundImage: member.photoURL ? `url(${member.photoURL})` : undefined }}
                            >
                                {!member.photoURL && <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-[var(--color-text-muted)] opacity-30">{(member.displayName || '?')[0].toUpperCase()}</div>}
                            </div>

                            <div className="flex-1 text-center md:text-left pt-2">
                                <h2 className="text-3xl font-bold text-[var(--color-text-main)] tracking-tight mb-3">
                                    {member.displayName}
                                </h2>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                    {can('canManageMembers') && !isMe ? (
                                        <div className="relative group">
                                            <select
                                                value={member.role}
                                                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-[var(--color-surface-hover)] text-[13px] font-bold border border-[var(--color-surface-border)] cursor-pointer hover:border-[var(--color-primary)] transition-all outline-none"
                                                style={{ color: role.color }}
                                            >
                                                {/* If current role is legacy, show it as an option so it's not hidden/lost, but only if not in customRoles */}
                                                {!customRoles.find(cr => cr.id === member.role) && (
                                                    <option value={member.role}>{role.label} (Legacy)</option>
                                                )}
                                                {customRoles.map(cr => (
                                                    <option key={cr.id} value={cr.id}>{cr.name}</option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined text-[16px] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">expand_more</span>
                                        </div>
                                    ) : (
                                        <Badge variant="primary" className="py-1">
                                            {role.label}
                                        </Badge>
                                    )}
                                    <span className="text-[14px] text-[var(--color-text-muted)] font-medium">{member.email}</span>
                                </div>

                                <div className="mt-8 flex flex-wrap gap-4">
                                    {can('canManageMembers') && !isMe && (
                                        <button
                                            onClick={() => handleRemoveMember(member.id)}
                                            className="px-5 py-2 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-xl text-[12px] font-bold uppercase tracking-wider hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-colors border border-rose-100 dark:border-rose-900/20"
                                        >
                                            Remove from Team
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <Card className="flex flex-col gap-1 items-center justify-center text-center p-6">
                            <span className="material-symbols-outlined text-[24px] text-blue-500 mb-2">layers</span>
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] opacity-50">Projects</span>
                            <span className="text-2xl font-bold text-[var(--color-text-main)] leading-none">{memberProjects.length}</span>
                        </Card>
                        <Card className="flex flex-col gap-1 items-center justify-center text-center p-6">
                            <span className="material-symbols-outlined text-[24px] text-emerald-500 mb-2">check_circle</span>
                            <span className="text-11px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] opacity-50">Status</span>
                            <span className="text-2xl font-bold text-emerald-500 leading-none">Active</span>
                        </Card>
                        <Card className="flex flex-col gap-1 items-center justify-center text-center p-6">
                            <span className="material-symbols-outlined text-[24px] text-amber-500 mb-2">calendar_today</span>
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] opacity-50">Joined</span>
                            <span className="text-2xl font-bold text-[var(--color-text-main)] leading-none">2024</span>
                        </Card>
                    </div>

                    {/* Projects Section */}
                    <div>
                        <div className="flex items-center gap-4 mb-6 px-1">
                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">Assigned Projects</h3>
                            <div className="flex-1 h-px bg-[var(--color-surface-border)]/50" />
                        </div>

                        {memberProjects.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {memberProjects.map(p => (
                                    <Card
                                        key={p.id}
                                        hoverable
                                        onClick={() => navigate(`/project/${p.id}`)}
                                        className="group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="size-12 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-xl font-bold border border-[var(--color-primary)]/10">
                                                {p.squareIcon ? <img src={p.squareIcon} className="w-full h-full object-cover rounded-xl" /> : p.title[0]}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-[var(--color-text-main)] truncate text-[15px]">{p.title}</h4>
                                                <span className="text-xs text-[var(--color-text-muted)] font-medium">{p.status || 'Active'}</span>
                                            </div>
                                            <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card className="p-12 text-center border-dashed">
                                <p className="text-[var(--color-text-muted)] font-medium">No projects assigned to this member.</p>
                            </Card>
                        )}
                    </div>
                </div>
            );
        }

        if (activeTab === 'projects') {
            const project = selectedItem as Project;
            const members = (project.members || []).map((m: any) => {
                const uid = typeof m === 'string' ? m : m.userId;
                return getUserDetails(uid) || { id: uid, displayName: 'User', photoURL: null, email: '' };
            });

            return (
                <div className="h-full flex flex-col overflow-y-auto animate-fade-in p-8 gap-8">
                    {/* Project Hero Card */}
                    <Card padding="lg" className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-[var(--color-primary)]/[0.03] to-transparent">
                        <div className="relative flex flex-col md:flex-row items-center md:items-end gap-10 z-10">
                            <div className="w-32 h-32 rounded-3xl bg-[var(--color-surface-hover)] text-[var(--color-primary)] flex items-center justify-center text-5xl font-bold shadow-sm border-4 border-white dark:border-[var(--color-surface-border)] shrink-0">
                                {project.squareIcon ? <img src={project.squareIcon} className="w-full h-full object-cover rounded-3xl" /> : project.title[0]}
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h2 className="text-3xl font-bold text-[var(--color-text-main)] tracking-tight mb-3">{project.title}</h2>
                                <p className="text-[15px] text-[var(--color-text-muted)] font-medium leading-relaxed max-w-2xl mb-6">{project.description || t('common.noDescription')}</p>
                                <div className="flex justify-center md:justify-start">
                                    <Button
                                        onClick={() => navigate(`/project/${project.id}`)}
                                        className="rounded-xl px-6 py-2.5 font-bold text-[13px]"
                                    >
                                        Open Dashboard
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <div className="flex-1">
                        <div className="flex items-center gap-4 mb-8 px-1">
                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">Active Team ({members.length})</h3>
                            <div className="flex-1 h-px bg-[var(--color-surface-border)]/50" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {members.map((m: any) => (
                                <Card key={m.id} padding="sm" className="group flex items-center gap-4">
                                    <div
                                        className="w-12 h-12 rounded-full bg-[var(--color-surface-hover)] bg-cover bg-center shrink-0 border border-[var(--color-surface-border)]"
                                        style={{ backgroundImage: m.photoURL ? `url(${m.photoURL})` : undefined }}
                                    >
                                        {!m.photoURL && <div className="w-full h-full flex items-center justify-center text-lg font-bold text-[var(--color-text-subtle)]">{(m.displayName || '?')[0]}</div>}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[14px] font-bold text-[var(--color-text-main)] truncate">{m.displayName}</p>
                                        <p className="text-[12px] font-medium text-[var(--color-text-muted)] opacity-60 truncate">{m.email}</p>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        if (activeTab === 'invites') {
            const link = selectedItem as InviteLink;
            const role = getRoleDetails(link.role);
            return (
                <div className="h-full flex flex-col items-center justify-center animate-fade-in p-12 text-center gap-8">
                    <Card padding="lg" className="max-w-xl w-full flex flex-col items-center shadow-xl border-dashed">
                        <div className="w-24 h-24 rounded-3xl bg-blue-50 dark:bg-blue-900/10 text-blue-500 flex items-center justify-center mb-6 shadow-sm border border-blue-100 dark:border-blue-900/20">
                            <span className="material-symbols-outlined text-4xl">mail</span>
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-2 tracking-tight">Pending Invitation</h2>
                        <p className="text-[15px] text-[var(--color-text-muted)] font-medium mb-8 leading-relaxed">
                            An invitation is pending for <strong className="text-[var(--color-text-main)]">{link.email || 'this user'}</strong> to join as a <Badge variant="primary" size="sm" style={{ color: role.color }}>{role.label}</Badge>.
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-4">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/join/${link.id}`);
                                    showSuccess('Copied link');
                                }}
                                className="rounded-xl px-6 py-2.5 font-bold text-[13px]"
                            >
                                <span className="material-symbols-outlined mr-2 text-[18px]">content_copy</span>
                                Copy Link
                            </Button>
                            <Button
                                variant="danger"
                                onClick={() => handleRevokeInvite(link)}
                                className="rounded-xl px-6 py-2.5 font-bold text-[13px]"
                            >
                                Revoke Invite
                            </Button>
                        </div>
                    </Card>
                </div>
            );
        }

    };

    return (
        <div className="h-[calc(100vh-64px)] flex overflow-hidden bg-[var(--color-surface-paper)]">
            {/* --- Left Sidebar (30% / 280px standard) --- */}
            <div className="w-full md:w-[280px] shrink-0 flex flex-col bg-[var(--color-surface-card)] border-r border-[var(--color-surface-border)]">
                {/* Header */}
                <div className="p-4 pt-6">
                    <div className="flex items-center justify-between mb-6 px-1">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-[22px] text-[var(--color-primary)]">group</span>
                            <h1 className="text-xl font-bold text-[var(--color-text-main)] tracking-tight">{t('nav.team')}</h1>
                        </div>
                        {can('canManageMembers') && (
                            <button
                                onClick={() => setShowInviteModal(true)}
                                className="size-8 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-text)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--color-primary)]/15"
                                title="Add Member"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                            </button>
                        )}
                    </div>

                    {/* Tab Switcher - Sidebar Theme-Style Pill */}
                    <div className="flex p-0.5 bg-[var(--color-surface-hover)] rounded-full border border-[var(--color-surface-border)] mb-6">
                        {(['members', 'projects', 'invites'] as Tab[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-1.5 rounded-full text-[11px] font-bold transition-all ${activeTab === tab
                                    ? 'bg-white dark:bg-slate-700 text-[var(--color-text-main)] shadow-sm'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                    }`}
                            >
                                {t(`team.tabs.${tab}` as any) || tab}
                            </button>
                        ))}
                    </div>

                    {/* Search - Nav-Style */}
                    <div className="relative group px-1">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('common.search') || "Search..."}
                            className="w-full bg-[var(--color-surface-hover)]/40 hover:bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] rounded-xl pl-10 pr-4 py-2 text-[13px] font-medium focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                        />
                    </div>
                </div>

                {/* List Items */}
                <div className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
                    {listItems.length > 0 ? (
                        listItems.map(renderListItem)
                    ) : (
                        <div className="p-8 text-center text-[var(--color-text-muted)] text-xs opacity-50">
                            No results found
                        </div>
                    )}
                </div>
            </div>

            {/* --- Main Stage (70%) --- */}
            <div className="hidden md:block flex-1 bg-[var(--color-surface-paper)] overflow-hidden relative">
                {renderDetailView()}
            </div>

            <InviteMemberModal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                isWorkspace={true}
                customRoles={customRoles}
                onGenerateLink={async (role: WorkspaceRole, maxUses?: number, expiresInHours?: number) => {
                    return await generateWorkspaceInviteLink(role, maxUses, expiresInHours, tenantId);
                }}
                onSendEmail={async (email, role) => {
                    await sendTeamInvitation(email, 'workspace', tenantId, role, tenantId);
                }}
            />
        </div>
    );
};
