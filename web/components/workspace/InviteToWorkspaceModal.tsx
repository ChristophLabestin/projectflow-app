import React, { useEffect, useMemo, useState } from 'react';

import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { TextInput } from '../common/Input/TextInput';
import { useLanguage } from '../../context/LanguageContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/UIContext';
import {
    buildInviteUrl,
    createInvitation,
    type InvitableRole,
    type InvitationKind
} from '../../services/domain/workspacesService';
import type { Project } from '../../types';

interface InviteToWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
    /** Preselects these projects (e.g. when inviting from a project). */
    initialProjectIds?: string[];
    initialRole?: InvitableRole;
    onCreated?: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const InviteToWorkspaceModal = ({
    isOpen,
    onClose,
    projects,
    initialProjectIds = [],
    initialRole = 'Member',
    onCreated
}: InviteToWorkspaceModalProps) => {
    const { t } = useLanguage();
    const { activeWorkspace } = useWorkspace();
    const { showError, showSuccess } = useToast();
    const [kind, setKind] = useState<InvitationKind>('email');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<InvitableRole>(initialRole);
    const [projectIds, setProjectIds] = useState<string[]>(initialProjectIds);
    const [isSaving, setIsSaving] = useState(false);
    const [link, setLink] = useState('');
    const [copied, setCopied] = useState(false);

    const initialKey = initialProjectIds.join(',');
    useEffect(() => {
        if (!isOpen) return;
        setKind('email');
        setEmail('');
        setRole(initialRole);
        setProjectIds(initialKey ? initialKey.split(',') : []);
        setLink('');
        setCopied(false);
    }, [isOpen, initialRole, initialKey]);

    const isOwner = activeWorkspace?.role === 'Owner';
    const roles: { value: InvitableRole; label: string; hint: string }[] = useMemo(() => [
        { value: 'Member', label: t('workspace.role.Member'), hint: t('workspace.invite.roleHint.Member') },
        { value: 'Guest', label: t('workspace.role.Guest'), hint: t('workspace.invite.roleHint.Guest') },
        ...(isOwner ? [{ value: 'Admin' as InvitableRole, label: t('workspace.role.Admin'), hint: t('workspace.invite.roleHint.Admin') }] : [])
    ], [isOwner, t]);

    const sortedProjects = useMemo(
        () => [...projects].filter((project) => !project.isPersonal).sort((a, b) => a.title.localeCompare(b.title)),
        [projects]
    );

    const emailValid = EMAIL_PATTERN.test(email.trim());
    const needsProject = role === 'Guest' && projectIds.length === 0;
    const canSubmit = !isSaving && !needsProject && (kind === 'link' || emailValid);

    const toggleProject = (projectId: string) => {
        setProjectIds((current) => (
            current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId]
        ));
    };

    const handleSubmit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!canSubmit || !activeWorkspace) return;
        setIsSaving(true);
        try {
            const invitation = await createInvitation({
                tenantId: activeWorkspace.id,
                tenantName: activeWorkspace.name,
                kind,
                email: kind === 'email' ? email : undefined,
                role,
                projectIds
            });
            const url = buildInviteUrl(activeWorkspace.id, invitation.id);
            setLink(url);
            onCreated?.();
            if (kind === 'email') {
                showSuccess(t('workspace.invite.toast.sent').replace('{email}', invitation.email || ''));
            }
        } catch (error) {
            console.error(error);
            showError(t('workspace.invite.toast.error'));
        } finally {
            setIsSaving(false);
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            title={t('workspace.invite.title').replace('{workspace}', activeWorkspace?.name || '')}
            footer={link ? (
                <Button variant="primary" onClick={onClose}>{t('workspace.invite.done')}</Button>
            ) : (
                <>
                    <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                    <Button variant="primary" onClick={() => void handleSubmit()} disabled={!canSubmit} isLoading={isSaving}>
                        {kind === 'email' ? t('workspace.invite.sendEmail') : t('workspace.invite.createLink')}
                    </Button>
                </>
            )}
        >
            {link ? (
                <div className="invite-modal__result">
                    <p className="invite-modal__hint">
                        {kind === 'email' ? t('workspace.invite.result.email') : t('workspace.invite.result.link')}
                    </p>
                    <div className="invite-modal__link">
                        <code className="invite-modal__link-text">{link}</code>
                        <Button variant="secondary" size="sm" onClick={() => void copyLink()}
                            icon={<span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>}>
                            {copied ? t('workspace.invite.copied') : t('workspace.invite.copy')}
                        </Button>
                    </div>
                </div>
            ) : (
                <form className="invite-modal" onSubmit={handleSubmit}>
                    <div className="invite-modal__segments" role="tablist">
                        {(['email', 'link'] as InvitationKind[]).map((option) => (
                            <button
                                key={option}
                                type="button"
                                role="tab"
                                aria-selected={kind === option}
                                className={`invite-modal__segment ${kind === option ? 'is-active' : ''}`}
                                onClick={() => setKind(option)}
                            >
                                <span className="material-symbols-outlined">{option === 'email' ? 'mail' : 'link'}</span>
                                {t(`workspace.invite.kind.${option}`)}
                            </button>
                        ))}
                    </div>

                    {kind === 'email' ? (
                        <TextInput
                            label={t('workspace.invite.email')}
                            type="email"
                            autoFocus
                            value={email}
                            placeholder={t('workspace.invite.emailPlaceholder')}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    ) : (
                        <p className="invite-modal__hint">{t('workspace.invite.linkHint')}</p>
                    )}

                    <fieldset className="invite-modal__roles">
                        <legend className="invite-modal__label">{t('workspace.invite.role')}</legend>
                        {roles.map((option) => (
                            <label key={option.value} className={`invite-modal__role ${role === option.value ? 'is-active' : ''}`}>
                                <input
                                    type="radio"
                                    name="invite-role"
                                    value={option.value}
                                    checked={role === option.value}
                                    onChange={() => setRole(option.value)}
                                />
                                <span className="invite-modal__role-name">{option.label}</span>
                                <span className="invite-modal__role-hint">{option.hint}</span>
                            </label>
                        ))}
                    </fieldset>

                    {sortedProjects.length > 0 && (
                        <div className="invite-modal__projects">
                            <span className="invite-modal__label">
                                {role === 'Guest' ? t('workspace.invite.projectsRequired') : t('workspace.invite.projectsOptional')}
                            </span>
                            <div className="invite-modal__project-list">
                                {sortedProjects.map((project) => (
                                    <label key={project.id} className="invite-modal__project">
                                        <input
                                            type="checkbox"
                                            checked={projectIds.includes(project.id)}
                                            onChange={() => toggleProject(project.id)}
                                        />
                                        <span>{project.title}</span>
                                    </label>
                                ))}
                            </div>
                            {needsProject && <p className="invite-modal__error">{t('workspace.invite.guestNeedsProject')}</p>}
                        </div>
                    )}
                </form>
            )}
        </Modal>
    );
};
