import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { auth } from '../services/firebase';
import { getActiveTenantId } from '../services/domain/authService';
import { removeUserFromWorkspace, setMemberRoleIds, subscribeTenantUsers, updateUserRole } from '../services/domain/workspaceMembersService';
import { getSharedProjects, subscribeTenantProjects } from '../services/domain/projectsService';
import { getProjectTasks } from '../services/domain/tasksService';
import { subscribeTenantRoles } from '../services/dataService';
import { buildInviteUrl, listInvitations, revokeInvitation, type WorkspaceInvitation } from '../services/domain/workspacesService';
import { InviteToWorkspaceModal } from '../components/workspace/InviteToWorkspaceModal';
import { useWorkspace } from '../context/WorkspaceContext';
import { Project, WorkspaceRole, Member, CustomRole, Task } from '../types';
import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { useConfirm, useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';
import { initialOf } from '../utils/initials';
import './team.scss';

const SettingsModal = lazy(() => import('../components/SettingsModal').then((module) => ({ default: module.SettingsModal })));

// Member erbt bereits von User (displayName/email/photoURL/role). Wir ergänzen nur id + Agent-Felder.
type TeamMember = Member & {
    id: string;
    title?: string;
    isAgent?: boolean;
    agentKey?: string;
    agentFunction?: string;
    agentProject?: string;
};

type ViewMode = 'department' | 'project' | 'all' | 'invites';

// Depth-System: Tiefe über Helligkeit + Schatten, niemals Borders.
const SURFACE_CARD = 'var(--color-surface-card)';
const SURFACE_HOVER = 'var(--color-surface-hover)';
const SURFACE_HOVER_LIGHT = 'var(--color-surface-hover-light, var(--color-surface-hover))';

export const Team = () => {
    const navigate = useNavigate();
    const { t, teamTranslationsReady, loadTeamTranslations } = useLanguage();
    const confirm = useConfirm();
    const { showError, showSuccess } = useToast();
    const { can } = useWorkspacePermissions();
    const tenantId = useMemo(() => getActiveTenantId() || '', []);
    const { activeWorkspace } = useWorkspace();
    const isWorkspaceAdmin = activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin';
    const currentUserId = auth.currentUser?.uid;

    useEffect(() => { void loadTeamTranslations(); }, [loadTeamTranslations]);

    const [view, setView] = useState<ViewMode>('department');
    const [rolesOpen, setRolesOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [users, setUsers] = useState<TeamMember[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
    const [inviteLinks, setInviteLinks] = useState<WorkspaceInvitation[]>([]);
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selTasks, setSelTasks] = useState<{ loading: boolean; tasks: Task[] }>({ loading: false, tasks: [] });

    useEffect(() => {
        if (!tenantId) return;
        const unsubUsers = subscribeTenantUsers((data) => {
            setUsers(data.map(d => ({ ...d, uid: d.id, role: d.role || 'Member' })) as TeamMember[]);
        }, tenantId);
        const unsubProjects = subscribeTenantProjects(setProjects, tenantId);
        getSharedProjects().then(setSharedProjects).catch(console.error);
        const unsubRoles = subscribeTenantRoles((firestoreRoles) => {
            setCustomRoles(firestoreRoles.filter(r => !r.isSystem).map(r => ({
                id: r.id, name: r.name, color: r.color || 'var(--color-text-muted)', position: r.position,
                permissions: [], isDefault: false, createdAt: r.createdAt, createdBy: r.createdBy || ''
            })) as CustomRole[]);
        }, tenantId);
        return () => { unsubUsers(); unsubProjects(); unsubRoles(); };
    }, [tenantId]);

    const loadInvitations = React.useCallback(async () => {
        if (!tenantId || !isWorkspaceAdmin) return;
        try { setInviteLinks(await listInvitations(tenantId)); }
        catch (e) { console.error('Failed to fetch invitations', e); }
    }, [tenantId, isWorkspaceAdmin]);

    useEffect(() => { void loadInvitations(); }, [loadInvitations]);

    const allProjects = useMemo(() => {
        const map = new Map<string, Project>();
        [...projects, ...sharedProjects].forEach(p => map.set(p.id, p));
        return [...map.values()];
    }, [projects, sharedProjects]);

    const isAgent = (m: TeamMember) => m.isAgent === true || !!m.agentKey;
    const jobTitle = (m: TeamMember) => m.agentFunction || m.title || '';

    const getRoleDetails = (roleId?: string) => {
        const id = roleId || 'Member';
        const custom = customRoles.find(r => r.id === id);
        if (custom) return { label: custom.name, color: custom.color };
        let label = id, color = 'var(--color-text-muted)';
        if (id === 'Owner') { label = t('roles.owner') || 'Owner'; color = 'var(--color-warning)'; }
        else if (id === 'Admin') { label = t('roles.admin') || 'Admin'; color = 'var(--color-error)'; }
        else if (id === 'Guest') { label = t('roles.guest') || 'Guest'; }
        else if (id === 'Member') { label = t('roles.member') || 'Member'; }
        return { label, color };
    };

    // Departments are the workspace's custom roles. Members without one are grouped under
    // "No department" (never by base role); without any custom role the grouping is hidden.
    const departmentOf = (m: TeamMember): { name: string; color: string; custom: boolean } => {
        const rid = (m.roleIds || [])[0];
        const cr = customRoles.find(r => r.id === rid);
        if (cr) return { name: cr.name, color: cr.color, custom: true };
        return { name: t('team.v2.noDepartment'), color: 'var(--color-text-subtle)', custom: false };
    };
    const hasDepartments = users.some((m) => departmentOf(m).custom);
    const activeView: ViewMode = view === 'department' && !hasDepartments ? 'all' : view;

    const memberInProject = (p: Project, uid: string) =>
        p.ownerId === uid
        || (p.members || []).some((x: any) => (typeof x === 'string' ? x : x?.userId) === uid)
        || (p.memberIds || []).includes(uid);

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return users.filter(u =>
            (u.displayName || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.agentFunction || '').toLowerCase().includes(q)
        );
    }, [users, searchQuery]);

    const sortMembers = (a: TeamMember, b: TeamMember) => {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
    };

    const byDepartment = useMemo(() => {
        const map = new Map<string, { color: string; members: TeamMember[] }>();
        filtered.forEach(m => {
            const d = departmentOf(m);
            if (!map.has(d.name)) map.set(d.name, { color: d.color, members: [] });
            map.get(d.name)!.members.push(m);
        });
        return [...map.entries()]
            .map(([name, v]) => ({ name, color: v.color, members: [...v.members].sort(sortMembers) }))
            .sort((a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name));
    }, [filtered, customRoles]);

    const byProject = useMemo(() => {
        const sections = allProjects.map(p => ({
            project: p,
            members: filtered.filter(m => m.agentProject === p.title || memberInProject(p, m.id)).sort(sortMembers)
        })).filter(s => s.members.length > 0).sort((a, b) => b.members.length - a.members.length);
        const companyWide = filtered.filter(m => isAgent(m) && !m.agentProject
            && !allProjects.some(p => memberInProject(p, m.id))).sort(sortMembers);
        const people = filtered.filter(m => !isAgent(m)).sort(sortMembers);
        return { sections, companyWide, people };
    }, [filtered, allProjects]);

    const stats = useMemo(() => {
        const agents = users.filter(isAgent).length;
        const departments = new Set(users.map(u => departmentOf(u)).filter(d => d.custom).map(d => d.name)).size;
        return { agents, humans: users.length - agents, departments, projects: byProject.sections.length };
    }, [users, byProject, customRoles]);

    const selected = useMemo(() => users.find(u => u.id === selectedId) || null, [users, selectedId]);
    const selectedProject = useMemo(() => {
        if (!selected) return null;
        if (selected.agentProject) return allProjects.find(p => p.title === selected.agentProject) || null;
        return allProjects.find(p => memberInProject(p, selected.id)) || null;
    }, [selected, allProjects]);

    useEffect(() => {
        setSelTasks({ loading: false, tasks: [] });
        if (!selected || !selectedProject) return;
        let alive = true;
        setSelTasks({ loading: true, tasks: [] });
        getProjectTasks(selectedProject.id, tenantId).then(all => {
            if (!alive) return;
            const mine = all.filter(tk => tk.assigneeId === selected.id || (tk.assigneeIds || []).includes(selected.id));
            setSelTasks({ loading: false, tasks: mine });
        }).catch(() => { if (alive) setSelTasks({ loading: false, tasks: [] }); });
        return () => { alive = false; };
    }, [selected?.id, selectedProject?.id, tenantId]);

    const handleToggleRole = async (userId: string, roleId: string, currentRoleIds: string[]) => {
        if (!can('canManageMembers')) return;
        const next = currentRoleIds.includes(roleId) ? currentRoleIds.filter(id => id !== roleId) : [...currentRoleIds, roleId];
        try { await setMemberRoleIds(userId, next, tenantId); showSuccess(t('team.members.toast.roleUpdated')); }
        catch (e) { console.error(e); showError(t('team.members.errors.updateRole')); }
    };
    const handleRemoveMember = async (userId: string) => {
        if (!await confirm(t('team.members.confirmRemove.title'), t('team.members.confirmRemove.message'))) return;
        try { await removeUserFromWorkspace(userId, tenantId); showSuccess(t('team.members.toast.removed')); setSelectedId(null); }
        catch (e: any) { showError(e.message || t('team.members.toast.removeError')); }
    };
    const handleRevokeInvite = async (invite: WorkspaceInvitation) => {
        try {
            await revokeInvitation(tenantId, invite.id);
            setInviteLinks(prev => prev.filter(l => l.id !== invite.id));
            showSuccess(t('team.v2.invites.revoked'));
        } catch { showError(t('team.v2.invites.revokeError')); }
    };
    const handleCopyInvite = async (invite: WorkspaceInvitation) => {
        try {
            await navigator.clipboard.writeText(buildInviteUrl(tenantId, invite.id));
            showSuccess(t('team.v2.invites.copied'));
        } catch { /* clipboard unavailable */ }
    };
    const handleBaseRole = async (userId: string, role: WorkspaceRole) => {
        try { await updateUserRole(userId, role, tenantId); showSuccess(t('team.v2.detail.roleUpdated')); }
        catch (e) { console.error(e); showError(t('team.members.errors.updateRole')); }
    };
    const assignableRoles: WorkspaceRole[] = activeWorkspace?.role === 'Owner' ? ['Admin', 'Member', 'Guest'] : ['Member', 'Guest'];

    if (!teamTranslationsReady) return <div className="p-10 text-center text-[var(--color-text-muted)]">{t('team.v2.loading')}</div>;

    // --- Agent-Karte (Depth via Helligkeit + Schatten, keine Borders) ---
    const AgentCard = (m: TeamMember) => {
        const dept = departmentOf(m);
        const isMe = m.id === currentUserId;
        const isSel = selectedId === m.id;
        return (
            <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className="group relative text-left rounded-[16px] p-4 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                    background: isSel ? 'var(--sunken-bg)' : SURFACE_CARD,
                    boxShadow: isSel ? 'var(--sunken-shadow)' : 'var(--shadow-sm)'
                }}
            >
                {isSel && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full" style={{ background: 'var(--color-primary)' }} />}
                <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-full bg-cover bg-center" style={{ backgroundColor: SURFACE_HOVER, backgroundImage: m.photoURL ? `url(${m.photoURL})` : undefined }}>
                            {!m.photoURL && <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[var(--color-text-muted)]">{initialOf(m.displayName)}</div>}
                        </div>
                        {isAgent(m) && (
                            <span className="absolute -bottom-1 -right-1 px-1 h-[15px] rounded-full text-[9px] font-black flex items-center justify-center"
                                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-text)' }} title={t('team.v2.agentBadge')}>AI</span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-[var(--color-text-main)] truncate">
                            {m.displayName || t('team.v2.unknown')}{isMe && <span className="ml-1 text-[10px] font-medium text-[var(--color-text-subtle)]">{t('team.v2.you')}</span>}
                        </p>
                        <p className="text-[12px] text-[var(--color-text-muted)] truncate mt-0.5">{jobTitle(m) || m.email}</p>
                        <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: `color-mix(in srgb, ${dept.color} 14%, transparent)`, color: dept.color }}>
                            {dept.name}
                        </span>
                    </div>
                </div>
            </button>
        );
    };

    const Section = ({ title, color, members }: { title: string; color?: string; members: TeamMember[] }) => (
        <section className="mb-9">
            <div className="flex items-center gap-2.5 mb-4">
                {color && <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />}
                <h3 className="text-[13px] font-black uppercase tracking-wider text-[var(--color-text-main)]">{title}</h3>
                <span className="min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-bold text-[var(--color-text-muted)] flex items-center justify-center" style={{ background: SURFACE_CARD }}>{members.length}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3">
                {members.map(AgentCard)}
            </div>
        </section>
    );

    const segItems: [ViewMode, string][] = [
        ...(hasDepartments ? [['department', t('team.v2.view.department')] as [ViewMode, string]] : []),
        ['project', t('team.v2.view.project')],
        ['all', t('team.v2.view.all')],
        ...(isWorkspaceAdmin ? [['invites', t('team.v2.view.invites')] as [ViewMode, string]] : [])
    ];

    return (
        <div className="h-full w-full flex overflow-hidden" style={{ background: 'var(--color-surface-bg)' }}>
            {/* Hauptbereich */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Kopf */}
                <div className="px-4 sm:px-8 pt-7 pb-5">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-[26px] font-bold text-[var(--color-text-main)] tracking-tight leading-none">{t('nav.team')}</h1>
                            <p className="text-[12.5px] text-[var(--color-text-muted)] mt-2">
                                {t(`team.v2.${stats.agents > 0 ? 'stats' : 'statsNoAgents'}${stats.departments > 0 ? '' : 'NoDepartments'}`)
                                    .replace('{agents}', String(stats.agents))
                                    .replace('{humans}', String(stats.humans))
                                    .replace('{departments}', String(stats.departments))
                                    .replace('{projects}', String(stats.projects))}
                            </p>
                        </div>
                        {isWorkspaceAdmin && !activeWorkspace?.isPersonal && (
                            <Button onClick={() => setShowInviteModal(true)} className="rounded-[12px] px-4 py-2 text-[13px] font-bold">
                                <span className="material-symbols-outlined mr-1.5 text-[18px]">person_add</span>{t('team.v2.invite')}
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-3 mt-5 flex-wrap">
                        <div className="flex p-1 rounded-full max-w-full overflow-x-auto" style={{ background: SURFACE_CARD }}>
                            {segItems.map(([v, label]) => (
                                <button key={v} onClick={() => setView(v)}
                                    className="px-4 py-1.5 rounded-full text-[12.5px] font-bold whitespace-nowrap shrink-0 transition-all"
                                    style={activeView === v
                                        ? { background: 'var(--color-primary)', color: 'var(--color-primary-text)' }
                                        : { color: 'var(--color-text-muted)' }}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        {activeView !== 'invites' && (
                            <div className="relative flex-1 min-w-[200px] max-w-sm">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] text-[18px]">search</span>
                                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('common.search')}
                                    className="w-full rounded-full pl-9 pr-3 py-2 text-[13px] text-[var(--color-text-main)] placeholder:text-[var(--color-text-subtle)] outline-none focus:!bg-[var(--sunken-bg)] focus:shadow-[var(--sunken-shadow)] transition-[background-color,box-shadow]"
                                    style={{ background: SURFACE_CARD }} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Inhalt */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-10">
                    {activeView === 'department' && byDepartment.map(d => <Section key={d.name} title={d.name} color={d.color} members={d.members} />)}
                    {activeView === 'all' && !hasDepartments && isWorkspaceAdmin && users.length > 0 && (
                        <div className="team-departments-hint">
                            <span className="material-symbols-outlined" aria-hidden="true">account_tree</span>
                            <p>
                                <strong>{t('team.v2.departmentsHint.title')}</strong>
                                <span>{t('team.v2.departmentsHint.body')}</span>
                            </p>
                            <Button variant="secondary" size="sm" onClick={() => setRolesOpen(true)}>{t('team.v2.departmentsHint.action')}</Button>
                        </div>
                    )}
                    {activeView === 'all' && <Section title={t('team.v2.allMembers')} members={[...filtered].sort(sortMembers)} />}
                    {activeView === 'project' && (
                        <>
                            {byProject.sections.map(s => <Section key={s.project.id} title={s.project.title} members={s.members} />)}
                            {byProject.companyWide.length > 0 && <Section title={t('team.v2.companyWide')} members={byProject.companyWide} />}
                            {byProject.people.length > 0 && <Section title={t('team.v2.people')} members={byProject.people} />}
                        </>
                    )}
                    {activeView === 'invites' && (
                        <div className="max-w-2xl">
                            <h3 className="text-[13px] font-black uppercase tracking-wider text-[var(--color-text-main)] mb-4">{t('team.v2.invites.title').replace('{count}', String(inviteLinks.length))}</h3>
                            {inviteLinks.length === 0 ? (
                                <div className="p-10 text-center rounded-[16px]" style={{ background: SURFACE_CARD, boxShadow: 'var(--shadow-sm)' }}>
                                    <p className="text-[var(--color-text-muted)] text-sm">{t('team.v2.invites.empty')}</p>
                                </div>
                            ) : inviteLinks.map(invite => (
                                <div key={invite.id} className="flex items-center gap-3 p-3.5 mb-2.5 rounded-[14px]" style={{ background: SURFACE_CARD, boxShadow: 'var(--shadow-sm)' }}>
                                    <span className="material-symbols-outlined w-9 h-9 flex items-center justify-center rounded-full text-[var(--color-text-muted)]" style={{ background: SURFACE_HOVER }}>{invite.kind === 'email' ? 'mail' : 'link'}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-semibold text-[var(--color-text-main)] truncate">{invite.email || t('team.v2.invites.link')}</p>
                                        <p className="text-[11px] text-[var(--color-text-muted)]">
                                            {t(`workspace.role.${invite.role}`)} · {invite.projectIds?.length
                                                ? t('team.v2.invites.scopeProjects').replace('{count}', String(invite.projectIds.length))
                                                : t('team.v2.invites.scopeWorkspace')}
                                        </p>
                                    </div>
                                    <Button variant="ghost" onClick={() => void handleCopyInvite(invite)} className="rounded-[10px] px-3 py-1.5 text-[12px]">{t('team.v2.invites.copy')}</Button>
                                    <Button variant="danger" onClick={() => void handleRevokeInvite(invite)} className="rounded-[10px] px-3 py-1.5 text-[12px]">{t('team.v2.invites.revoke')}</Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail-Panel: höhere Ebene = hellere Surface + Schatten, kein Border */}
            {selected && (
                <aside className="fixed inset-y-0 right-0 z-40 flex w-full sm:w-[380px] lg:static lg:z-10 shrink-0 flex-col overflow-y-auto" style={{ background: SURFACE_CARD, boxShadow: 'var(--shadow-lg)' }}>
                    <div className="p-7">
                        <button onClick={() => setSelectedId(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] text-[12px] mb-5 inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">close</span>{t('team.v2.close')}
                        </button>

                        <div className="flex flex-col items-center text-center">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full bg-cover bg-center" style={{ backgroundColor: SURFACE_HOVER, backgroundImage: selected.photoURL ? `url(${selected.photoURL})` : undefined }}>
                                    {!selected.photoURL && <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-[var(--color-text-subtle)]">{initialOf(selected.displayName)}</div>}
                                </div>
                                {isAgent(selected) && <span className="absolute bottom-0 right-0 px-1.5 h-5 rounded-full text-[10px] font-black flex items-center justify-center" style={{ background: 'var(--color-primary)', color: 'var(--color-primary-text)' }}>AI</span>}
                            </div>
                            <h2 className="text-xl font-bold text-[var(--color-text-main)] mt-3">{selected.displayName}</h2>
                            {jobTitle(selected) && <p className="text-[13px] font-semibold text-[var(--color-text-muted)] mt-0.5">{jobTitle(selected)}</p>}
                            {selected.email && <p className="text-[12px] text-[var(--color-text-subtle)] mt-1">{selected.email}</p>}
                            <span className="inline-flex items-center mt-3 px-2.5 py-1 rounded-full text-[11px] font-bold"
                                style={{ background: `color-mix(in srgb, ${departmentOf(selected).color} 14%, transparent)`, color: departmentOf(selected).color }}>
                                {departmentOf(selected).name}
                            </span>
                        </div>

                        {!isAgent(selected) && (
                            <div className="mt-6">
                                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-subtle)] mb-2.5">{t('team.v2.detail.access')}</p>
                                {selected.role === 'Owner' || !isWorkspaceAdmin || selected.id === currentUserId || (selected.role === 'Admin' && activeWorkspace?.role !== 'Owner') ? (
                                    <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: SURFACE_HOVER, color: 'var(--color-text-main)' }}>
                                        {t(`workspace.role.${selected.role || 'Member'}`)}
                                    </span>
                                ) : (
                                    <div className="flex p-1 rounded-full w-fit" style={{ background: SURFACE_HOVER }} role="radiogroup" aria-label={t('team.v2.detail.access')}>
                                        {assignableRoles.map(role => (
                                            <button key={role} type="button" role="radio" aria-checked={selected.role === role}
                                                onClick={() => { if (selected.role !== role) void handleBaseRole(selected.id, role); }}
                                                className="px-3 py-1 rounded-full text-[11.5px] font-bold transition-all"
                                                style={selected.role === role
                                                    ? { background: 'var(--color-primary)', color: 'var(--color-primary-text)' }
                                                    : { color: 'var(--color-text-muted)' }}>
                                                {t(`workspace.role.${role}`)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {customRoles.length > 0 && selected.role !== 'Owner' && (
                            <div className="mt-6">
                                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-subtle)] mb-2.5">{t('team.v2.detail.roles')}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {customRoles.map(cr => {
                                        const assigned = (selected.roleIds || []).includes(cr.id);
                                        const canManage = can('canManageMembers');
                                        return (
                                            <button key={cr.id} type="button" disabled={!canManage}
                                                onClick={() => handleToggleRole(selected.id, cr.id, selected.roleIds || [])}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${canManage ? 'hover:opacity-90 cursor-pointer' : 'cursor-default opacity-80'}`}
                                                style={assigned ? { background: cr.color, color: 'var(--color-absolute-white)' } : { background: SURFACE_HOVER, color: 'var(--color-text-muted)' }}>
                                                <span className="material-symbols-outlined text-[13px]">{assigned ? 'check' : 'add'}</span>{cr.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {selectedProject && (
                            <div className="mt-6">
                                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-subtle)] mb-2.5">{t('team.v2.detail.project')}</p>
                                <button onClick={() => navigate(`/project/${selectedProject.id}`)}
                                    className="w-full flex items-center gap-3 p-3 rounded-[14px] transition-colors text-left hover:brightness-95"
                                    style={{ background: SURFACE_HOVER }}>
                                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center font-bold" style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}>{selectedProject.title[0]}</div>
                                    <span className="text-[13px] font-semibold text-[var(--color-text-main)] truncate flex-1">{selectedProject.title}</span>
                                    <span className="material-symbols-outlined text-[18px] text-[var(--color-text-muted)]">arrow_forward</span>
                                </button>
                            </div>
                        )}

                        <div className="mt-6">
                            <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-text-subtle)] mb-2.5">
                                {t('team.v2.detail.tasks')}{!selTasks.loading && selectedProject ? ` (${selTasks.tasks.length})` : ''}
                            </p>
                            {!selectedProject ? (
                                <p className="text-[12px] text-[var(--color-text-muted)]">{t('team.v2.detail.noProject')}</p>
                            ) : selTasks.loading ? (
                                <p className="text-[12px] text-[var(--color-text-muted)]">{t('team.v2.detail.loading')}</p>
                            ) : selTasks.tasks.length === 0 ? (
                                <p className="text-[12px] text-[var(--color-text-muted)]">{t('team.v2.detail.noTasks')}</p>
                            ) : (
                                <div className="rounded-[14px] p-1.5" style={{ background: SURFACE_HOVER }}>
                                    {selTasks.tasks.slice(0, 8).map(tk => (
                                        <button key={tk.id} onClick={() => navigate(`/project/${selectedProject.id}`)}
                                            className="w-full text-left flex items-center gap-2 p-2 rounded-[10px] transition-colors hover:brightness-95" style={{ background: 'transparent' }}>
                                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tk.isCompleted ? 'var(--color-success)' : 'var(--color-primary)' }} />
                                            <span className="text-[12px] text-[var(--color-text-main)] truncate flex-1">{tk.title}</span>
                                            {tk.status && <span className="text-[10px] text-[var(--color-text-subtle)]">{tk.status}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {isAgent(selected) && selectedProject && (
                            <div className="mt-6 p-3.5 rounded-[14px]" style={{ background: SURFACE_HOVER }}>
                                <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
                                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">forum</span>
                                    {t('team.v2.detail.agentBriefing').replace('{name}', selected.displayName?.split(' ')[0] || '')}
                                </p>
                            </div>
                        )}

                        {isWorkspaceAdmin && selected.id !== currentUserId && !isAgent(selected) && selected.role !== 'Owner' && (
                            <button onClick={() => handleRemoveMember(selected.id)}
                                className="mt-7 w-full px-4 py-2.5 rounded-[12px] text-[12px] font-bold transition-all hover:brightness-95"
                                style={{ background: 'color-mix(in srgb, var(--color-error) 12%, transparent)', color: 'var(--color-error)' }}>
                                {t('team.v2.detail.remove')}
                            </button>
                        )}
                    </div>
                </aside>
            )}

            <InviteToWorkspaceModal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                projects={allProjects}
                onCreated={() => void loadInvitations()}
            />
            {rolesOpen && (
                <Suspense fallback={null}>
                    <SettingsModal isOpen initialTab="roles" onClose={() => setRolesOpen(false)} />
                </Suspense>
            )}
        </div>
    );
};
