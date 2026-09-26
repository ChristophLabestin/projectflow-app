import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';

import { Button } from '../common/Button/Button';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useUIState } from '../../context/UIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOnboarding } from '../../hooks/useOnboarding';
import { createInvitation, renameWorkspace } from '../../services/domain/workspacesService';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseEmails = (value: string) => Array.from(new Set(
    value.split(/[\s,;]+/).map((entry) => entry.trim().toLowerCase()).filter(Boolean)
));

/**
 * One-screen welcome after the first sign-in: confirm the workspace name, say
 * whether you work alone or with a team (and invite them right away), then go
 * straight to the first project.
 */
export const WelcomeDialog: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const location = useLocation();
    const workspace = useWorkspace();
    const { openProjectCreateModal } = useUIState();
    const { onboarding, update } = useOnboarding();
    const active = workspace.activeWorkspace;

    const [name, setName] = useState('');
    const [mode, setMode] = useState<'solo' | 'team'>('solo');
    const [emails, setEmails] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (active?.name) setName(active.name);
    }, [active?.name]);

    // Invitation links have their own screen; welcome the user afterwards.
    const onInviteRoute = location.pathname.startsWith('/invite/');
    const isOwner = active?.role === 'Owner';
    if (!onboarding?.welcomePending || onInviteRoute || !active || !isOwner) return null;

    const parsedEmails = parseEmails(emails);
    const invalidEmails = parsedEmails.filter((email) => !EMAIL_PATTERN.test(email));

    const finish = async (next: 'project' | 'later') => {
        if (mode === 'team' && invalidEmails.length) {
            setError(t('welcome.errors.invalidEmails').replace('{emails}', invalidEmails.join(', ')));
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const trimmed = name.trim();
            if (trimmed && trimmed !== active.name) {
                await renameWorkspace(active.id, trimmed);
                await workspace.refresh();
            }
            if (mode === 'team') {
                for (const email of parsedEmails) {
                    await createInvitation({ tenantId: active.id, tenantName: trimmed || active.name, kind: 'email', email, role: 'Member' });
                }
            }
            await update({ welcomePending: false });
            if (next === 'project') openProjectCreateModal();
        } catch (saveError) {
            console.error(saveError);
            setError(t('welcome.errors.save'));
            setBusy(false);
        }
    };

    const firstName = (user?.displayName || '').trim().split(/\s+/)[0];

    return createPortal(
        <div className="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <div className="welcome-dialog__panel">
                <span className="welcome-dialog__badge material-symbols-outlined" aria-hidden="true">waving_hand</span>
                <h1 id="welcome-title" className="welcome-dialog__title">
                    {firstName ? t('welcome.title').replace('{name}', firstName) : t('welcome.titleNoName')}
                </h1>
                <p className="welcome-dialog__subtitle">{t('welcome.subtitle')}</p>

                <label className="welcome-dialog__field">
                    <span className="welcome-dialog__label">{t('welcome.workspaceLabel')}</span>
                    <input
                        className="welcome-dialog__input"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={80}
                    />
                    <small className="welcome-dialog__hint">{t('welcome.workspaceHint')}</small>
                </label>

                <div className="welcome-dialog__field">
                    <span className="welcome-dialog__label">{t('welcome.modeLabel')}</span>
                    <div className="welcome-dialog__modes" role="radiogroup" aria-label={t('welcome.modeLabel')}>
                        {(['solo', 'team'] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={mode === option}
                                className={`welcome-dialog__mode ${mode === option ? 'is-active' : ''}`.trim()}
                                onClick={() => setMode(option)}
                            >
                                <span className="material-symbols-outlined" aria-hidden="true">{option === 'solo' ? 'person' : 'groups'}</span>
                                <span className="welcome-dialog__mode-copy">
                                    <strong>{t(`welcome.mode.${option}`)}</strong>
                                    <small>{t(`welcome.mode.${option}Hint`)}</small>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {mode === 'team' && (
                    <label className="welcome-dialog__field">
                        <span className="welcome-dialog__label">{t('welcome.inviteLabel')}</span>
                        <textarea
                            className="welcome-dialog__input welcome-dialog__input--area"
                            value={emails}
                            onChange={(event) => setEmails(event.target.value)}
                            placeholder={t('welcome.invitePlaceholder')}
                            rows={3}
                        />
                        <small className="welcome-dialog__hint">{t('welcome.inviteHint')}</small>
                    </label>
                )}

                {error && <p className="welcome-dialog__error" role="alert">{error}</p>}

                <footer className="welcome-dialog__foot">
                    <button type="button" className="welcome-dialog__later" disabled={busy} onClick={() => void finish('later')}>
                        {t('welcome.later')}
                    </button>
                    <Button variant="primary" isLoading={busy} onClick={() => void finish('project')}>
                        {mode === 'team' && parsedEmails.length
                            ? (parsedEmails.length === 1
                                ? t('welcome.inviteAndStartOne')
                                : t('welcome.inviteAndStart').replace('{count}', String(parsedEmails.length)))
                            : t('welcome.start')}
                    </Button>
                </footer>
            </div>
        </div>,
        document.body
    );
};
