import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/firebase';
import { getActiveTenantId } from '../services/domain/authService';
import { subscribeTenantUsers } from '../services/domain/workspaceMembersService';
import { useLanguage } from '../context/LanguageContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { InviteToWorkspaceModal } from './workspace/InviteToWorkspaceModal';

interface TeamMenuMember {
    id: string;
    displayName?: string;
    email?: string;
    photoURL?: string;
    role?: string;
    agentFunction?: string;
    title?: string;
}

interface TopBarTeamMenuProps {
    tenantId?: string;
}

/**
 * Kompakte, topbar-optimierte Team-Anzeige: Button mit Dropdown, das die
 * Workspace-Mitglieder (inkl. AI-Agenten) mit Jobtitel listet.
 */
export const TopBarTeamMenu: React.FC<TopBarTeamMenuProps> = ({ tenantId }) => {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const { activeWorkspace } = useWorkspace();
    const canInvite = activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin';
    const [members, setMembers] = useState<TeamMenuMember[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const resolvedTenant = tenantId || getActiveTenantId() || '';
    const currentUserId = auth.currentUser?.uid;

    useEffect(() => {
        if (!resolvedTenant) return;
        const unsub = subscribeTenantUsers((data) => setMembers(data as TeamMenuMember[]), resolvedTenant);
        return () => unsub();
    }, [resolvedTenant]);

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const jobTitle = (m: TeamMenuMember) => m.agentFunction || m.title || m.role || '';

    const sorted = useMemo(() => {
        return [...members].sort((a, b) => {
            if (a.id === currentUserId) return -1;
            if (b.id === currentUserId) return 1;
            return (a.displayName || '').localeCompare(b.displayName || '');
        });
    }, [members, currentUserId]);

    const count = members.length;

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setOpen((v) => !v)}
                className={`topbar-icon-button ${open ? 'is-active' : ''}`}
                title={t('topbar.team')}
                aria-label={t('topbar.team')}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                {/* No count badge: it read like unread notifications. The count is in the menu. */}
                <span className="material-symbols-outlined">group</span>
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-72 max-h-[70vh] flex flex-col rounded-2xl pf-glass overflow-hidden z-50 animate-fade-in"
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-surface-border)]">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-[var(--color-primary)]">group</span>
                            <span className="text-sm font-bold text-[var(--color-text-main)]">{t('topbar.team')}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">{count}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto py-1">
                        {sorted.length === 0 ? (
                            <div className="px-4 py-6 text-center text-[12px] text-[var(--color-text-muted)]">{t('topbar.teamEmpty')}</div>
                        ) : (
                            sorted.map((m) => (
                                <div key={m.id} className="flex items-center gap-3 px-3 py-2 mx-1 rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors">
                                    <div
                                        className="w-8 h-8 rounded-full bg-[var(--color-surface-hover)] bg-cover bg-center shrink-0 border border-[var(--color-surface-border)]"
                                        style={{ backgroundImage: m.photoURL ? `url(${m.photoURL})` : undefined }}
                                    >
                                        {!m.photoURL && (
                                            <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-[var(--color-text-muted)]">
                                                {(m.displayName || '?')[0].toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-semibold text-[var(--color-text-main)] truncate">
                                            {m.displayName || 'Unknown'}
                                            {m.id === currentUserId && <span className="ml-1 text-[10px] font-medium text-[var(--color-text-muted)]">{t('topbar.teamYou')}</span>}
                                        </p>
                                        {jobTitle(m) && (
                                            <p className="text-[11px] text-[var(--color-text-muted)] truncate">{jobTitle(m)}</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="topbar-team-menu__foot">
                        {canInvite && (
                            <button type="button" className="topbar-team-menu__invite" onClick={() => { setOpen(false); setInviteOpen(true); }}>
                                <span className="material-symbols-outlined">person_add</span>
                                {t('topbar.teamInvite')}
                            </button>
                        )}
                        <Link to="/team" onClick={() => setOpen(false)} className="topbar-team-menu__all">
                            {t('topbar.teamViewAll')}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </Link>
                    </div>
                </div>
            )}
            {canInvite && <InviteToWorkspaceModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} projects={[]} />}
        </div>
    );
};
