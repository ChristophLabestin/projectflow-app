import React, { Suspense, lazy, useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { multiFactor } from 'firebase/auth';

import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useUIState } from '../../context/UIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOnboarding } from '../../hooks/useOnboarding';
import { auth, db } from '../../services/firebase';
import { listInvitations } from '../../services/domain/workspacesService';
import { needsEmailVerification, refreshEmailVerification, sendVerificationEmail } from '../../services/domain/emailVerification';
import { useWorkMembers } from '../work/useWorkMembers';
import { InviteToWorkspaceModal } from '../workspace/InviteToWorkspaceModal';
import type { Project } from '../../types';

const SettingsModal = lazy(() => import('../SettingsModal').then((module) => ({ default: module.SettingsModal })));

type StepId = 'verify' | 'project' | 'tasks' | 'invite' | 'secure';

type GettingStartedCardProps = {
    projects: Project[];
    taskCount: number;
};

/**
 * First-run checklist on the dashboard. Every step is derived from real data,
 * so it ticks itself off; the card disappears once everything is done or the
 * user dismisses it. Only accounts created with onboarding enabled see it.
 */
export const GettingStartedCard: React.FC<GettingStartedCardProps> = ({ projects, taskCount }) => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const workspace = useWorkspace();
    const { openProjectCreateModal, openTaskCreateModal } = useUIState();
    const { onboarding, update } = useOnboarding();
    const tenantId = workspace.activeWorkspaceId || undefined;
    const members = useWorkMembers(tenantId);

    const [pendingInvites, setPendingInvites] = useState(0);
    const [secured, setSecured] = useState(false);
    const [unverified, setUnverified] = useState(needsEmailVerification());
    const [verifyState, setVerifyState] = useState<'idle' | 'sent' | 'busy' | 'pending'>('idle');
    const [inviteOpen, setInviteOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const isAdmin = workspace.activeWorkspace?.role === 'Owner' || workspace.activeWorkspace?.role === 'Admin';

    useEffect(() => {
        if (!tenantId || !isAdmin) return;
        listInvitations(tenantId)
            .then((list) => setPendingInvites(list.filter((invite) => invite.status === 'pending').length))
            .catch(() => setPendingInvites(0));
    }, [tenantId, isAdmin, inviteOpen]);

    useEffect(() => {
        const current = auth.currentUser;
        if (!current) return;
        const hasMfa = multiFactor(current).enrolledFactors.length > 0;
        if (hasMfa) { setSecured(true); return; }
        getDocs(collection(db, 'users', current.uid, 'passkeys'))
            .then((snap) => setSecured(!snap.empty))
            .catch(() => setSecured(false));
    }, [settingsOpen]);

    if (!onboarding || onboarding.checklistDismissed || !user) return null;

    const steps: { id: StepId; done: boolean; show: boolean }[] = [
        { id: 'verify', done: !unverified, show: user.providerData.some((provider) => provider.providerId === 'password') },
        { id: 'project', done: projects.length > 0, show: true },
        { id: 'tasks', done: taskCount >= 3, show: true },
        { id: 'invite', done: members.length > 1 || pendingInvites > 0, show: isAdmin },
        { id: 'secure', done: secured, show: true }
    ];
    const visible = steps.filter((step) => step.show);
    const doneCount = visible.filter((step) => step.done).length;
    if (doneCount === visible.length) return null;

    const nextId = visible.find((step) => !step.done)?.id;

    const runAction = async (id: StepId) => {
        if (id === 'project') openProjectCreateModal();
        else if (id === 'tasks') openTaskCreateModal(projects[0]?.id, { allowProjectSelect: true });
        else if (id === 'invite') setInviteOpen(true);
        else if (id === 'secure') setSettingsOpen(true);
        else if (id === 'verify') {
            if (verifyState === 'sent' || verifyState === 'pending') {
                setVerifyState('busy');
                const verified = await refreshEmailVerification().catch(() => false);
                setUnverified(!verified);
                setVerifyState(verified ? 'idle' : 'pending');
            } else {
                setVerifyState('busy');
                await sendVerificationEmail('/').catch(() => undefined);
                setVerifyState('sent');
            }
        }
    };

    const actionLabel = (id: StepId) => {
        if (id === 'verify') {
            return verifyState === 'sent' || verifyState === 'pending' ? t('auth.verify.check') : t('gettingStarted.verify.action');
        }
        return t(`gettingStarted.${id}.action`);
    };

    return (
        <section className="getting-started" aria-labelledby="getting-started-title">
            <header className="getting-started__head">
                <div>
                    <h2 id="getting-started-title" className="getting-started__title">{t('gettingStarted.title')}</h2>
                    <p className="getting-started__progress">
                        {t('gettingStarted.progress').replace('{done}', String(doneCount)).replace('{total}', String(visible.length))}
                    </p>
                </div>
                <button type="button" className="getting-started__dismiss" onClick={() => void update({ checklistDismissed: true })}>
                    {t('gettingStarted.dismiss')}
                </button>
            </header>
            <div className="getting-started__bar" aria-hidden="true">
                <span style={{ width: `${Math.round((doneCount / visible.length) * 100)}%` }} />
            </div>
            <ol className="getting-started__list">
                {visible.map((step) => (
                    <li key={step.id} className={`getting-started__step ${step.done ? 'is-done' : ''} ${step.id === nextId ? 'is-next' : ''}`.trim()}>
                        <span className="getting-started__check material-symbols-outlined" aria-hidden="true">
                            {step.done ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className="getting-started__copy">
                            <strong>{t(`gettingStarted.${step.id}.title`)}</strong>
                            <small>
                                {step.id === 'verify' && verifyState === 'pending'
                                    ? t('auth.verify.stillPending')
                                    : step.id === 'verify' && verifyState === 'sent'
                                        ? t('auth.verify.sentText').replace('{email}', user.email || '')
                                        : t(`gettingStarted.${step.id}.hint`)}
                            </small>
                        </span>
                        {!step.done && (
                            <button
                                type="button"
                                className={`getting-started__action ${step.id === nextId ? 'is-primary' : ''}`.trim()}
                                disabled={verifyState === 'busy' && step.id === 'verify'}
                                onClick={() => void runAction(step.id)}
                            >
                                {actionLabel(step.id)}
                            </button>
                        )}
                    </li>
                ))}
            </ol>

            <InviteToWorkspaceModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} projects={projects} />
            {settingsOpen && (
                <Suspense fallback={null}>
                    <SettingsModal isOpen onClose={() => setSettingsOpen(false)} initialTab="security" />
                </Suspense>
            )}
        </section>
    );
};
