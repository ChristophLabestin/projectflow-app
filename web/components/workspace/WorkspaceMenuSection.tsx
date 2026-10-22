import React, { useState } from 'react';

import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { TextInput } from '../common/Input/TextInput';
import { useLanguage } from '../../context/LanguageContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/UIContext';
import { acceptInvitation } from '../../services/domain/workspacesService';

const initials = (name: string) => name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'W';

/**
 * Workspace list for the sidebar switcher: switch, accept pending invitations
 * and create a new workspace. Rendered at the top of the switcher menu.
 */
export const WorkspaceMenuSection = () => {
    const { t } = useLanguage();
    const { showError } = useToast();
    const { workspaces, activeWorkspaceId, pendingInvitations, switchWorkspace, createWorkspace } = useWorkspace();
    const [isCreateOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);
    const createInFlightRef = useRef(false);

    const handleCreate = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!name.trim() || busyId === 'create' || createInFlightRef.current) return;
        createInFlightRef.current = true;
        setBusyId('create');
        try {
            const id = await createWorkspace(name);
            await switchWorkspace(id);
        } catch (error) {
            console.error(error);
            showError(t('workspace.create.error'));
            createInFlightRef.current = false;
            setBusyId(null);
        }
    };

    const handleAccept = async (tenantId: string, inviteId: string) => {
        setBusyId(inviteId);
        try {
            await acceptInvitation(tenantId, inviteId);
            await switchWorkspace(tenantId);
        } catch (error) {
            console.error(error);
            showError(t('workspace.accept.error'));
            setBusyId(null);
        }
    };

    return (
        <div className="snav-ws-group workspace-menu">
            <div className="snav-section">{t('workspace.menu.title')}</div>
            {workspaces.map((workspace) => {
                const active = workspace.id === activeWorkspaceId;
                return (
                    <button
                        key={workspace.id}
                        type="button"
                        className={`snav-ws-row ${active ? 'is-active' : ''}`}
                        onClick={() => { if (!active) void switchWorkspace(workspace.id); }}
                        aria-current={active ? 'true' : undefined}
                    >
                        <span className="workspace-menu__avatar" aria-hidden="true">{initials(workspace.name)}</span>
                        <span className="snav-ws-row__copy">
                            <span className="snav-ws-row__title">{workspace.name}</span>
                            <span className="snav-ws-row__meta">{t(`workspace.role.${workspace.role}`)}</span>
                        </span>
                        {active && <span className="material-symbols-outlined snav-ws-row__check">check</span>}
                    </button>
                );
            })}
            {pendingInvitations.map((invite) => (
                <div key={invite.id} className="snav-ws-row workspace-menu__invite">
                    <span className="workspace-menu__avatar workspace-menu__avatar--invite" aria-hidden="true">
                        <span className="material-symbols-outlined">mail</span>
                    </span>
                    <span className="snav-ws-row__copy">
                        <span className="snav-ws-row__title">{invite.tenantName}</span>
                        <span className="snav-ws-row__meta">{t('workspace.menu.invitedAs').replace('{role}', t(`workspace.role.${invite.role}`))}</span>
                    </span>
                    <button
                        type="button"
                        className="workspace-menu__accept"
                        disabled={busyId === invite.id}
                        onClick={() => void handleAccept(invite.tenantId, invite.id)}
                        aria-label={`${t('workspace.accept.cta')}: ${invite.tenantName}`}
                        title={t('workspace.accept.cta')}
                    >
                        <span className={`material-symbols-outlined ${busyId === invite.id ? 'workspace-gate__spin' : ''}`}>
                            {busyId === invite.id ? 'progress_activity' : 'check'}
                        </span>
                    </button>
                </div>
            ))}
            <button type="button" className="snav-ws-row workspace-menu__create" onClick={() => { setName(''); setCreateOpen(true); }}>
                <span className="workspace-menu__avatar workspace-menu__avatar--ghost" aria-hidden="true">
                    <span className="material-symbols-outlined">add</span>
                </span>
                <span className="snav-ws-row__title">{t('workspace.create.cta')}</span>
            </button>

            <Modal
                isOpen={isCreateOpen}
                onClose={() => setCreateOpen(false)}
                size="sm"
                title={t('workspace.create.title')}
                footer={(
                    <>
                        <Button variant="ghost" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
                        <Button variant="primary" disabled={!name.trim()} isLoading={busyId === 'create'} onClick={() => void handleCreate()}>
                            {t('workspace.create.submit')}
                        </Button>
                    </>
                )}
            >
                <form onSubmit={handleCreate} className="workspace-create">
                    <p className="workspace-create__hint">{t('workspace.create.hint')}</p>
                    <TextInput
                        label={t('workspace.create.name')}
                        autoFocus
                        value={name}
                        maxLength={60}
                        placeholder={t('workspace.create.placeholder')}
                        onChange={(event) => setName(event.target.value)}
                    />
                </form>
            </Modal>
        </div>
    );
};
