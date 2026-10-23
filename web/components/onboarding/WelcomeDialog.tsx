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
import { getProjectTemplateDefinition } from '../../config/projectTemplates';
import { SURVEY_OPTIONS, suggestTemplateId, type SurveyQuestion } from '../../utils/onboardingSurvey';
import { createInvitation, renameWorkspace } from '../../services/domain/workspacesService';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseEmails = (value: string) => Array.from(new Set(
    value.split(/[\s,;]+/).map((entry) => entry.trim().toLowerCase()).filter(Boolean)
));

class ValidationError extends Error {}

type Step = 'name' | 'about' | 'team' | 'how' | 'done';
type Answers = { role?: string; useCases: string[]; teamSize?: string; industry?: string; source?: string; previousTool?: string };
const SURVEY_STEPS: Step[] = ['about', 'team', 'how'];
const STEP_QUESTIONS: Partial<Record<Step, SurveyQuestion[]>> = {
    about: ['role', 'useCases'],
    team: ['teamSize', 'industry'],
    how: ['source', 'previousTool'],
};

/**
 * First-run onboarding (shared contract with the iOS app): display name ->
 * about you -> your team (+ workspace for owners) -> how you found us -> done.
 * Survey questions are optional and written once as `survey` when the last
 * survey screen is left. Shows while `users/{uid}/private/onboarding`
 * has `welcomePending: true`; finishing it anywhere clears the flag everywhere.
 */
export const WelcomeDialog: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const workspace = useWorkspace();
    const { onboarding, update, saveSurvey } = useOnboarding();
    const active = workspace.activeWorkspace;

    const [step, setStep] = useState<Step>('name');
    const [displayName, setDisplayName] = useState('');
    const [name, setName] = useState('');
    const [answers, setAnswers] = useState<Answers>({ useCases: [] });
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

    const steps: Step[] = ['name', 'about', 'team', 'how', 'done'];
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

    const withTeam = isOwner && Boolean(answers.teamSize) && answers.teamSize !== 'solo';

    const saveWorkspace = async (skipInvites = false) => {
        if (!isOwner) return;
        const invite = withTeam && !skipInvites;
        if (invite && invalidEmails.length) {
            throw new ValidationError(t('welcome.errors.invalidEmails').replace('{emails}', invalidEmails.join(', ')));
        }
        const trimmed = name.trim();
        if (trimmed && trimmed !== active.name) {
            await renameWorkspace(active.id, trimmed);
            await workspace.refresh();
        }
        if (invite) {
            for (const email of parsedEmails) {
                await createInvitation({ tenantId: active.id, tenantName: trimmed || active.name, kind: 'email', email, role: 'Member' });
            }
        }
    };

    const setSingle = (question: Exclude<SurveyQuestion, 'useCases'>, value: string) =>
        setAnswers((current) => ({ ...current, [question]: current[question] === value ? undefined : value }));

    const toggleUseCase = (value: string) =>
        setAnswers((current) => ({
            ...current,
            useCases: current.useCases.includes(value) ? current.useCases.filter((entry) => entry !== value) : [...current.useCases, value],
        }));

    const finishSurvey = (final: Answers) => {
        const survey: Parameters<typeof saveSurvey>[0] = {};
        if (final.role) survey.role = final.role;
        if (final.useCases.length) survey.useCases = final.useCases;
        if (final.teamSize) survey.teamSize = final.teamSize;
        if (final.industry) survey.industry = final.industry;
        if (final.source) survey.source = final.source;
        if (final.previousTool) survey.previousTool = final.previousTool;
        return saveSurvey(survey);
    };

    const next = async (skip = false) => {
        setBusy(true);
        setError(null);
        try {
            let current = answers;
            if (skip) {
                // Skipping clears this screen's answers only.
                current = { ...answers };
                for (const question of STEP_QUESTIONS[step] || []) {
                    if (question === 'useCases') current.useCases = [];
                    else delete current[question];
                }
                setAnswers(current);
            }
            if (step === 'name') await saveName();
            if (step === 'team') await saveWorkspace(skip);
            if (step === 'how') await finishSurvey(current);
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

    const chips = (question: SurveyQuestion) => (
        <div className="welcome-dialog__chips" role={question === 'useCases' ? 'group' : 'radiogroup'} aria-label={t(`onboardingSurvey.${question}.label`)}>
            {SURVEY_OPTIONS[question].map((option) => {
                const selected = question === 'useCases' ? answers.useCases.includes(option) : answers[question] === option;
                return (
                    <button
                        key={option}
                        type="button"
                        role={question === 'useCases' ? 'checkbox' : 'radio'}
                        aria-checked={selected}
                        className={`welcome-dialog__chip ${selected ? 'is-active' : ''}`.trim()}
                        onClick={() => (question === 'useCases' ? toggleUseCase(option) : setSingle(question, option))}
                    >
                        {t(`onboardingSurvey.${question}.${option}`)}
                    </button>
                );
            })}
        </div>
    );

    const question = (key: SurveyQuestion) => (
        <div className="welcome-dialog__field">
            <span className="welcome-dialog__label">{t(`onboardingSurvey.${key}.label`)}</span>
            {key === 'useCases' && <small className="welcome-dialog__hint">{t('onboardingSurvey.useCases.hint')}</small>}
            {chips(key)}
        </div>
    );

    const suggestedTemplateId = suggestTemplateId(answers.useCases);

    const firstName = displayName.trim().split(/\s+/)[0];
    const titleKey = {
        name: 'welcome.name.title', about: 'welcome.about.title', team: 'welcome.team.title', how: 'welcome.how.title', done: 'welcome.done.title',
    }[step];
    const subtitleKey = {
        name: 'welcome.name.subtitle', about: 'welcome.about.subtitle', team: 'welcome.team.subtitle', how: 'welcome.how.subtitle', done: 'welcome.done.subtitle',
    }[step];
    const icon = { name: 'waving_hand', about: 'person', team: 'groups', how: 'explore', done: 'check_circle' }[step];
    const isLast = step === 'done';
    const nextLabel = isLast
        ? t('welcome.done.cta')
        : step === 'team' && withTeam && parsedEmails.length
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

                {step === 'about' && <>{question('role')}{question('useCases')}</>}

                {step === 'team' && (
                    <>
                        {isOwner && (
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
                        )}
                        {question('teamSize')}
                        {question('industry')}
                        {withTeam && (
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

                {step === 'how' && <>{question('source')}{question('previousTool')}</>}

                {step === 'done' && suggestedTemplateId && (
                    <p className="welcome-dialog__suggestion">
                        <span className="material-symbols-outlined" aria-hidden="true">{getProjectTemplateDefinition(suggestedTemplateId).icon}</span>
                        <span>{t('welcome.done.template').replace('{template}', t(getProjectTemplateDefinition(suggestedTemplateId).labelKey))}</span>
                    </p>
                )}

                {error && <p className="welcome-dialog__error" role="alert">{error}</p>}

                <footer className="welcome-dialog__foot">
                    {stepIndex > 0 && !isLast && (
                        <Button variant="ghost" onClick={goBack} disabled={busy}>{t('welcome.back')}</Button>
                    )}
                    {SURVEY_STEPS.includes(step) && (
                        <Button variant="ghost" onClick={() => void next(true)} disabled={busy}>{t('welcome.skip')}</Button>
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
