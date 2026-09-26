import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '../components/common/Button/Button';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
    acceptInvitation,
    getInvitation,
    isInvitationUsable,
    type WorkspaceInvitation
} from '../services/domain/workspacesService';
import { refreshEmailVerification, sendVerificationEmail } from '../services/domain/emailVerification';

type InviteState = 'loading' | 'ready' | 'member' | 'invalid' | 'mismatch' | 'unverified' | 'error';

const ERROR_STATE: Record<string, InviteState> = {
    'invite-email-mismatch': 'mismatch',
    'invite-email-unverified': 'unverified',
    'invite-expired': 'invalid',
    'invite-used-up': 'invalid',
    'invite-not-pending': 'invalid'
};

export const AcceptInvite = () => {
    const { tenantId = '', inviteId = '' } = useParams();
    const { t } = useLanguage();
    const { user } = useAuth();
    const workspace = useWorkspace();
    const [invite, setInvite] = useState<WorkspaceInvitation | null>(null);
    const [state, setState] = useState<InviteState>('loading');
    const [isAccepting, setAccepting] = useState(false);
    const [verifyMailSent, setVerifyMailSent] = useState(false);
    const [verifyBusy, setVerifyBusy] = useState(false);
    const [verifyHint, setVerifyHint] = useState<string | null>(null);
    const returnTo = encodeURIComponent(`/invite/${tenantId}/${inviteId}`);
    const isMember = workspace.workspaces.some((entry) => entry.id === tenantId);

    useEffect(() => {
        if (!user) return;
        let alive = true;
        (async () => {
            try {
                const loaded = await getInvitation(tenantId, inviteId);
                if (!alive) return;
                setInvite(loaded);
                if (isMember) {
                    setState('member');
                } else if (!isInvitationUsable(loaded)) {
                    setState('invalid');
                } else if (loaded?.kind === 'email' && loaded.email && loaded.email !== (user.email || '').toLowerCase()) {
                    setState('mismatch');
                } else if (loaded?.kind === 'email' && !user.emailVerified) {
                    setState('unverified');
                } else {
                    setState('ready');
                }
            } catch (error) {
                console.error(error);
                if (alive) setState('invalid');
            }
        })();
        return () => { alive = false; };
    }, [user, tenantId, inviteId, isMember]);

    const handleAccept = async () => {
        setAccepting(true);
        try {
            await acceptInvitation(tenantId, inviteId);
            await workspace.switchWorkspace(tenantId);
        } catch (error: any) {
            console.error(error);
            // The SDK may append the HTTP status ("invite-expired [412]"); map on the code only.
            const code = String(error?.message || '').split(' ')[0];
            setState(ERROR_STATE[code] || 'error');
            setAccepting(false);
        }
    };

    const handleSendVerification = async () => {
        setVerifyBusy(true);
        setVerifyHint(null);
        try {
            await sendVerificationEmail(`/invite/${tenantId}/${inviteId}`);
            setVerifyMailSent(true);
        } catch (error) {
            console.error(error);
            setVerifyHint(t('auth.verify.sendFailed'));
        } finally {
            setVerifyBusy(false);
        }
    };

    const handleCheckVerification = async () => {
        setVerifyBusy(true);
        setVerifyHint(null);
        try {
            if (await refreshEmailVerification()) setState('ready');
            else setVerifyHint(t('auth.verify.stillPending'));
        } finally {
            setVerifyBusy(false);
        }
    };

    const renderBody = () => {
        if (!user) {
            return (
                <>
                    <h1 className="accept-invite__title">{t('workspace.accept.signedOutTitle')}</h1>
                    <p className="accept-invite__text">{t('workspace.accept.signedOutText')}</p>
                    <div className="accept-invite__actions">
                        <Link to={`/login?redirect=${returnTo}`}><Button variant="primary">{t('workspace.accept.signIn')}</Button></Link>
                        <Link to={`/register?redirect=${returnTo}`}><Button variant="secondary">{t('workspace.accept.register')}</Button></Link>
                    </div>
                </>
            );
        }
        if (state === 'loading') {
            return <p className="accept-invite__text">{t('workspace.accept.loading')}</p>;
        }
        if (state === 'member') {
            return (
                <>
                    <h1 className="accept-invite__title">{t('workspace.accept.memberTitle')}</h1>
                    <div className="accept-invite__actions">
                        <Button variant="primary" onClick={() => void workspace.switchWorkspace(tenantId)}>{t('workspace.accept.open')}</Button>
                    </div>
                </>
            );
        }
        if (state === 'invalid' || state === 'error' || !invite) {
            return (
                <>
                    <h1 className="accept-invite__title">{t(state === 'error' ? 'workspace.accept.errorTitle' : 'workspace.accept.invalidTitle')}</h1>
                    <p className="accept-invite__text">{t(state === 'error' ? 'workspace.accept.errorText' : 'workspace.accept.invalidText')}</p>
                    <div className="accept-invite__actions">
                        <Link to="/"><Button variant="secondary">{t('workspace.accept.home')}</Button></Link>
                    </div>
                </>
            );
        }
        if (state === 'unverified') {
            return (
                <>
                    <p className="accept-invite__eyebrow">{invite.tenantName}</p>
                    <h1 className="accept-invite__title">{t('workspace.accept.verifyTitle')}</h1>
                    <p className="accept-invite__text">
                        {(verifyMailSent ? t('auth.verify.sentText') : t('workspace.accept.verifyText')).replace('{email}', user.email || '')}
                    </p>
                    {verifyHint && <p className="accept-invite__text accept-invite__text--hint">{verifyHint}</p>}
                    <div className="accept-invite__actions">
                        {verifyMailSent ? (
                            <Button variant="primary" isLoading={verifyBusy} onClick={() => void handleCheckVerification()}>{t('auth.verify.check')}</Button>
                        ) : (
                            <Button variant="primary" isLoading={verifyBusy} onClick={() => void handleSendVerification()}>{t('auth.verify.send')}</Button>
                        )}
                        {verifyMailSent && (
                            <Button variant="ghost" disabled={verifyBusy} onClick={() => void handleSendVerification()}>{t('auth.verify.resend')}</Button>
                        )}
                    </div>
                </>
            );
        }
        if (state === 'mismatch') {
            return (
                <>
                    <h1 className="accept-invite__title">{t('workspace.accept.mismatchTitle')}</h1>
                    <p className="accept-invite__text">
                        {t('workspace.accept.mismatchText').replace('{email}', invite.email || '').replace('{current}', user.email || '')}
                    </p>
                </>
            );
        }
        return (
            <>
                <p className="accept-invite__eyebrow">{t('workspace.accept.eyebrow').replace('{name}', invite.invitedByName || '')}</p>
                <h1 className="accept-invite__title">{invite.tenantName}</h1>
                <p className="accept-invite__text">
                    {t('workspace.accept.roleText').replace('{role}', t(`workspace.role.${invite.role}`))}
                    {invite.projectIds.length > 0 && ` ${t('workspace.accept.projectsText').replace('{count}', String(invite.projectIds.length))}`}
                </p>
                <div className="accept-invite__actions">
                    <Button variant="primary" isLoading={isAccepting} onClick={() => void handleAccept()}>{t('workspace.accept.cta')}</Button>
                    <Link to="/"><Button variant="ghost">{t('workspace.accept.later')}</Button></Link>
                </div>
            </>
        );
    };

    return (
        <main className="accept-invite">
            <section className="accept-invite__card">
                <span className="material-symbols-outlined accept-invite__icon" aria-hidden="true">group_add</span>
                {renderBody()}
            </section>
        </main>
    );
};

export default AcceptInvite;
