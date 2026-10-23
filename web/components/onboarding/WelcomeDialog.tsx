import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';

import { Button } from '../common/Button/Button';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOnboarding } from '../../hooks/useOnboarding';
import { auth } from '../../services/firebase';
import { updateUserData } from '../../services/dataService';
import { createInvitation, renameWorkspace } from '../../services/domain/workspacesService';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseEmails = (value: string) => Array.from(new Set(
    value.split(/[\s,;]+/).map((entry) => entry.trim().toLowerCase()).filter(Boolean)
));

class ValidationError extends Error {}

type Step = 'name' | 'workspace' | 'done';

/**
 * First-run onboarding (shared contract with the iOS app): display name ->
 * workspace (owners only) -> done. Shows while `users/{uid}/private/onboarding`
 * has `welcomePending: true`; finishing it anywhere clears the flag everywhere.
 */
export const WelcomeDialog: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const workspace = useWorkspace();
    const { onboarding, update } = useOnboarding();
    const active = workspace.activeWorkspace;

    const [step, setStep] = useState<Step>('name');
    const [displayName, setDisplayName] = useState('');
    const [name, setName] = useState('');
    const [mode, setMode] = useState<'solo' | 'team'>('solo');
    const [emails, setEmails] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (active?.name) setName(active.name);
    }, [active?.name]);

    useEffect(() => {
        if (user?.displayName) setDisplayName((current) => current || user.displayName || '');
    }, [user?.displayName]);

    // Invitation links have their own screen; onboard the user afterwards.
    const onInviteRoute = location.pathname.startsWith('/invite/');
    const isOwner = active?.role === 'Owner';
    if (!onboarding?.welcomePending || onInviteRoute || !active) return null;

    const steps: Step[] = isOwner ? ['name', 'workspace', 'done'] : ['name', 'done'];
    const stepIndex = steps.indexOf(step);

    const parsedEmails = parseEmails(emails);
    const invalidEmails = parsedEmails.filter((email) => !EMAIL_PATTERN.test(email));

    const goBack = () => { setError(null); setStep(steps[Math.max(0, stepIndex - 1)]); };

    const saveName = async () => {
        const trimmed = displayName.trim();
        const current = auth.currentUser;
        if (trimmed && current && trimmed !== (current.displayName || '')) {
            await updateProfile(current, { displayName: trimmed });
            await updateUserData(current.uid, { displayName: trimmed });
            // Re-resolve members so the new name shows up across the app.
            await workspace.refresh();
        }
    };

    const saveWorkspace = async () => {
        if (mode === 'team' && invalidEmails.length) {
            throw new ValidationError(t('welcome.errors.invalidEmails').replace('{emails}', invalidEmails.join(', ')));
        }
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
    };

    const next = async () => {
        setBusy(true);
        setError(null);
        try {
            if (step === 'name') await saveName();
            if (step === 'workspace') await saveWorkspace();
            if (step === 'done') {
                await update({ welcomePending: false });
                navigate('/');
                return;
            }
            setStep(steps[stepIndex + 1]);
        } catch (saveError) {
            console.error(saveError);
            setError(saveError instanceof ValidationError ? saveError.message : t('welcome.errors.save'));
        } finally {
            setBusy(false);
        }
    };

    const firstName = displayName.trim().split(/\s+/)[0];
    const titleKey = { name: 'welcome.name.title', workspace: 'welcome.workspace.title', done: 'welcome.done.title' }[step];
    const subtitleKey = { name: 'welcome.name.subtitle', workspace: 'welcome.subtitle', done: 'welcome.done.subtitle' }[step];
    const icon = { name: 'waving_hand', workspace: 'workspaces', done: 'check_circle' }[step];
    const isLast = step === 'done';
    const nextLabel = isLast
        ? t('welcome.done.cta')
        : step === 'workspace' && mode === 'team' && parsedEmails.length
            ? (parsedEmails.length === 1
                ? t('welcome.inviteAndStartOne')
                : t('welcome.inviteAndStart').replace('{count}', String(parsedEmails.length)))
            : t('welcome.next');

    return createPortal(
        <div className="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <div className="welcome-dialog__panel">
                <div
                    className="welcome-dialog__steps"
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={steps.length}
                    aria-valuenow={stepIndex + 1}
                    aria-label={t('welcome.stepLabel').replace('{current}', String(stepIndex + 1)).replace('{total}', String(steps.length))}
                >
                    {steps.map((entry, index) => (
                        <span key={entry} className={`welcome-dialog__step ${index <= stepIndex ? 'is-done' : ''}`.trim()} />
                    ))}
                </div>
                <span className="welcome-dialog__badge material-symbols-outlined" aria-hidden="true">{icon}</span>
                <h1 id="welcome-title" className="welcome-dialog__title">
                    {step === 'done' && firstName
                        ? t('welcome.done.titleName').replace('{name}', firstName)
                        : t(titleKey)}
                </h1>
                <p className="welcome-dialog__subtitle">{t(subtitleKey)}</p>

                {step === 'name' && (
                    <label className="welcome-dialog__field">
                        <span className="welcome-dialog__label">{t('welcome.name.label')}</span>
                        <input
                            className="welcome-dialog__input"
                            value={displayName}
                            onChange={(event) => setDisplayName(event.target.value)}
                            onKeyDown={(event) => { if (event.key === 'Enter' && displayName.trim()) void next(); }}
                            placeholder={t('welcome.name.placeholder')}
                            maxLength={80}
                            autoFocus
                        />
                        <small className="welcome-dialog__hint">{t('welcome.name.hint')}</small>
                    </label>
                )}

                {step === 'workspace' && (
                    <>
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
                    </>
                )}

                {error && <p className="welcome-dialog__error" role="alert">{error}</p>}

                <footer className="welcome-dialog__foot">
                    {stepIndex > 0 && !isLast && (
                        <Button variant="ghost" onClick={goBack} disabled={busy}>{t('welcome.back')}</Button>
                    )}
                    <Button
                        variant="primary"
                        isLoading={busy}
                        disabled={step === 'name' && !displayName.trim() && !user?.displayName}
                        onClick={() => void next()}
                    >
                        {nextLabel}
                    </Button>
                </footer>
            </div>
        </div>,
        document.body
    );
};
