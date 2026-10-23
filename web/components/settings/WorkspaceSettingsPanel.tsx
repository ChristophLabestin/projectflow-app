import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import { Button } from '../common/Button/Button';
import { InviteToWorkspaceModal } from '../workspace/InviteToWorkspaceModal';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getTenant, updateTenant } from '../../services/domain/workspaceService';
import { getWorkspaceMembers } from '../../services/domain/workspaceMembersService';
import {
    deleteWorkspace,
    leaveWorkspace,
    listInvitations,
    transferWorkspaceOwnership
} from '../../services/domain/workspacesService';
import type { Member } from '../../types';
import { initialOf } from '../../utils/initials';

type Profile = { name: string; description: string; website: string; contactEmail: string };
type DangerAction = 'leave' | 'transfer' | 'delete' | null;
export type WorkspaceSettingsSection = 'workspace' | 'members' | 'danger';

/**
 * Workspace sections of the settings modal: profile, members and the
 * lifecycle actions (leave, transfer, delete). Editing controls follow the
 * caller's workspace role.
 */
export const WorkspaceSettingsPanel: React.FC<{ section: WorkspaceSettingsSection; onNavigate?: () => void }> = ({ section, onNavigate }) => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const workspace = useWorkspace();
    const active = workspace.activeWorkspace;
    const tenantId = workspace.activeWorkspaceId || '';
    const role = active?.role;
    const isOwner = role === 'Owner';
    const isAdmin = isOwner || role === 'Admin';

    const [profile, setProfile] = useState<Profile>({ name: '', description: '', website: '', contactEmail: '' });
    const [savedProfile, setSavedProfile] = useState<Profile | null>(null);
    const [saving, setSaving] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [pendingInvites, setPendingInvites] = useState(0);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [danger, setDanger] = useState<DangerAction>(null);

    useEffect(() => {
        if (!tenantId) return;
        getTenant(tenantId).then((tenant: any) => {
            const next = {
                name: tenant?.name || '',
                description: tenant?.description || '',
                website: tenant?.website || '',
                contactEmail: tenant?.contactEmail || ''
            };
            setProfile(next);
            setSavedProfile(next);
        }).catch((error) => console.error('Failed to load workspace', error));
        getWorkspaceMembers(tenantId).then(setMembers).catch(() => setMembers([]));
        if (isAdmin) {
            listInvitations(tenantId)
                .then((list) => setPendingInvites(list.filter((invite) => invite.status === 'pending').length))
                .catch(() => setPendingInvites(0));
        }
    }, [tenantId, isAdmin, inviteOpen]);

    const dirty = savedProfile !== null && JSON.stringify(profile) !== JSON.stringify(savedProfile);
    const counts = useMemo(() => ({
        admins: members.filter((member) => ['owner', 'admin'].includes(String(member.role || '').toLowerCase())).length,
        guests: members.filter((member) => String(member.role || '').toLowerCase() === 'guest').length
    }), [members]);

    const saveProfile = async () => {
        if (!profile.name.trim()) {
            showError(t('workspaceSettings.general.nameRequired'));
            return;
        }
        setSaving(true);
        try {
            const next = { ...profile, name: profile.name.trim() };
            await updateTenant(tenantId, { ...next, updatedAt: new Date() });
            setSavedProfile(next);
            setProfile(next);
            await workspace.refresh();
            showSuccess(t('workspaceSettings.general.saved'));
        } catch (error) {
            console.error(error);
            showError(t('workspaceSettings.errors.generic'));
        } finally {
            setSaving(false);
        }
    };

    if (!active) return null;

    const field = (key: keyof Profile, type = 'text', multiline = false) => (
        <label className="ws-settings__field">
            <span>{t(`workspaceSettings.general.${key}`)}</span>
            {multiline ? (
                <textarea
                    className="ws-settings__input ws-settings__input--area"
                    value={profile[key]}
                    onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
                    disabled={!isAdmin}
                    rows={3}
                    maxLength={500}
                />
            ) : (
                <input
                    className="ws-settings__input"
                    type={type}
                    value={profile[key]}
                    onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
                    disabled={!isAdmin}
                    maxLength={key === 'name' ? 80 : 200}
                />
            )}
        </label>
    );

    return (
        <div className="ws-settings ws-settings--panel">
            {section === 'workspace' && (
                <>
            <header className="ws-settings__head">
                <div className="ws-settings__badge" aria-hidden="true">{initialOf(active.name)}</div>
                <div>
                    <h1 className="ws-settings__title">{active.name}</h1>
                    <p className="ws-settings__subtitle">
                        {t('workspaceSettings.subtitle').replace('{role}', t(`workspace.role.${role}`))}
                    </p>
                </div>
            </header>

            {/* General */}
            <section className="ws-card">
                <header className="ws-card__head">
                    <h2>{t('workspaceSettings.general.title')}</h2>
                    {!isAdmin && <span className="ws-card__note">{t('workspaceSettings.readOnly')}</span>}
                </header>
                <div className="ws-settings__grid">
                    {field('name')}
                    {field('website', 'url')}
                    {field('contactEmail', 'email')}
                </div>
                {field('description', 'text', true)}
                {isAdmin && (
                    <footer className="ws-card__foot">
                        {dirty && <button type="button" className="ws-link" onClick={() => savedProfile && setProfile(savedProfile)}>{t('common.cancel')}</button>}
                        <Button variant="primary" isLoading={saving} disabled={!dirty} onClick={() => void saveProfile()}>
                            {t('workspaceSettings.general.save')}
                        </Button>
                    </footer>
                )}
            </section>

                </>
            )}
            {section === 'members' && (
                <>
            {/* Members */}
            <section className="ws-card">
                <header className="ws-card__head">
                    <h2>{t('workspaceSettings.members.title')}</h2>
                </header>
                <div className="ws-stats">
                    <div className="ws-stat"><strong>{members.length}</strong><span>{t('workspaceSettings.members.total')}</span></div>
                    <div className="ws-stat"><strong>{counts.admins}</strong><span>{t('workspaceSettings.members.admins')}</span></div>
                    <div className="ws-stat"><strong>{counts.guests}</strong><span>{t('workspaceSettings.members.guests')}</span></div>
                    {isAdmin && <div className="ws-stat"><strong>{pendingInvites}</strong><span>{t('workspaceSettings.members.pending')}</span></div>}
                </div>
                <footer className="ws-card__foot">
                    <Link to="/team" className="ws-link" onClick={onNavigate}>{t('workspaceSettings.members.manage')}</Link>
                    {isAdmin && !active?.isPersonal && (
                        <Button variant="primary" onClick={() => setInviteOpen(true)} icon={<span className="material-symbols-outlined">person_add</span>}>
                            {t('workspaceSettings.members.invite')}
                        </Button>
                    )}
                </footer>
            </section>

                </>
            )}
            {section === 'danger' && (
                <>
            {/* Danger zone */}
            <section className="ws-card ws-card--danger">
                <header className="ws-card__head">
                    <h2>{t('workspaceSettings.danger.title')}</h2>
                </header>
                <div className="ws-rows">
                    {!isOwner && (
                        <div className="ws-row ws-row--static">
                            <span className="ws-row__copy">
                                <strong>{t('workspaceSettings.danger.leave.title')}</strong>
                                <small>{t('workspaceSettings.danger.leave.hint')}</small>
                            </span>
                            <Button variant="secondary" onClick={() => setDanger('leave')}>{t('workspaceSettings.danger.leave.action')}</Button>
                        </div>
                    )}
                    {isOwner && (
                        <div className="ws-row ws-row--static">
                            <span className="ws-row__copy">
                                <strong>{t('workspaceSettings.danger.transfer.title')}</strong>
                                <small>{t('workspaceSettings.danger.transfer.hint')}</small>
                            </span>
                            <Button variant="secondary" onClick={() => setDanger('transfer')}>{t('workspaceSettings.danger.transfer.action')}</Button>
                        </div>
                    )}
                    {isOwner && (
                        <div className="ws-row ws-row--static">
                            <span className="ws-row__copy">
                                <strong>{t('workspaceSettings.danger.delete.title')}</strong>
                                <small>{t('workspaceSettings.danger.delete.hint')}</small>
                            </span>
                            <Button variant="danger" onClick={() => setDanger('delete')}>{t('workspaceSettings.danger.delete.action')}</Button>
                        </div>
                    )}
                </div>
            </section>

                </>
            )}

            {isAdmin && <InviteToWorkspaceModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} projects={[]} />}
            {danger && (
                <DangerDialog
                    action={danger}
                    workspaceName={active.name}
                    candidates={members.filter((member) => member.uid !== user?.uid && member.role !== 'Guest')}
                    onClose={() => setDanger(null)}
                    onLeave={async () => {
                        await leaveWorkspace(tenantId);
                        window.location.assign('/');
                    }}
                    onTransfer={async (uid) => {
                        await transferWorkspaceOwnership(tenantId, uid);
                        showSuccess(t('workspaceSettings.danger.transfer.done'));
                        await workspace.refresh();
                        window.location.reload();
                    }}
                    onDelete={async (confirmName) => {
                        await deleteWorkspace(tenantId, confirmName);
                        window.location.assign('/');
                    }}
                />
            )}
        </div>
    );
};

const DangerDialog: React.FC<{
    action: Exclude<DangerAction, null>;
    workspaceName: string;
    candidates: Member[];
    onClose: () => void;
    onLeave: () => Promise<void>;
    onTransfer: (uid: string) => Promise<void>;
    onDelete: (confirmName: string) => Promise<void>;
}> = ({ action, workspaceName, candidates, onClose, onLeave, onTransfer, onDelete }) => {
    const { t } = useLanguage();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmName, setConfirmName] = useState('');
    const [target, setTarget] = useState(candidates[0]?.uid || '');

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onClose]);

    const disabled = busy
        || (action === 'delete' && confirmName.trim() !== workspaceName.trim())
        || (action === 'transfer' && !target);

    const confirm = async () => {
        setBusy(true);
        setError(null);
        try {
            if (action === 'leave') await onLeave();
            else if (action === 'transfer') await onTransfer(target);
            else await onDelete(confirmName.trim());
        } catch (err: any) {
            console.error(err);
            setError(t('workspaceSettings.errors.generic'));
            setBusy(false);
        }
    };

    return createPortal(
        <div className="ws-dialog" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
            <div className="ws-dialog__panel">
                <h2 className="ws-dialog__title">{t(`workspaceSettings.danger.${action}.confirmTitle`).replace('{name}', workspaceName)}</h2>
                <p className="ws-dialog__text">{t(`workspaceSettings.danger.${action}.confirmText`).replace('{name}', workspaceName)}</p>

                {action === 'transfer' && (
                    candidates.length ? (
                        <label className="ws-settings__field">
                            <span>{t('workspaceSettings.danger.transfer.to')}</span>
                            <select className="ws-settings__input" value={target} onChange={(event) => setTarget(event.target.value)}>
                                {candidates.map((member) => (
                                    <option key={member.uid} value={member.uid}>{member.displayName || member.email} · {t(`workspace.role.${member.role}`)}</option>
                                ))}
                            </select>
                        </label>
                    ) : <p className="ws-dialog__text ws-dialog__text--warn">{t('workspaceSettings.danger.transfer.noCandidates')}</p>
                )}

                {action === 'delete' && (
                    <label className="ws-settings__field">
                        <span>{t('workspaceSettings.danger.delete.typeName').replace('{name}', workspaceName)}</span>
                        <input className="ws-settings__input" value={confirmName} onChange={(event) => setConfirmName(event.target.value)} autoFocus />
                    </label>
                )}

                {error && <p className="ws-dialog__text ws-dialog__text--warn" role="alert">{error}</p>}

                <footer className="ws-card__foot">
                    <button type="button" className="ws-link" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
                    <Button variant={action === 'transfer' ? 'primary' : 'danger'} isLoading={busy} disabled={disabled} onClick={() => void confirm()}>
                        {t(`workspaceSettings.danger.${action}.action`)}
                    </Button>
                </footer>
            </div>
        </div>,
        document.body
    );
};
