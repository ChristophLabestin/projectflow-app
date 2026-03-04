import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth } from '../services/firebase';
import { joinTenant, setActiveTenantId } from '../services/dataService';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/common/Button/Button';
import { Card } from '../components/common/Card/Card';
import { Badge } from '../components/common/Badge/Badge';
import './invite-landing.scss';

export const InviteLanding = () => {
    const { tenantId } = useParams<{ tenantId: string }>();
    const navigate = useNavigate();
    const { t, inviteLandingTranslationsReady, loadInviteLandingTranslations } = useLanguage();
    const [status, setStatus] = useState<{ tone: 'info' | 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        void loadInviteLandingTranslations();
    }, [loadInviteLandingTranslations]);

    useEffect(() => {
        const tryAutoJoin = async () => {
            if (!tenantId || !auth.currentUser || !inviteLandingTranslationsReady) return;
            try {
                setStatus({ tone: 'info', message: t('inviteLanding.status.joining') });
                await joinTenant(tenantId);
                setStatus({ tone: 'success', message: t('inviteLanding.status.joined') });
                navigate('/');
            } catch (e) {
                console.error(e);
                setStatus({ tone: 'error', message: t('inviteLanding.status.failed') });
            }
        };
        tryAutoJoin();
    }, [tenantId, navigate, inviteLandingTranslationsReady, t]);

    const handleAccept = () => {
        if (!tenantId) return;
        setActiveTenantId(tenantId);
        const returnUrl = window.location.pathname + window.location.search;
        navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`, { state: { inviteTenantId: tenantId } });
    };

    if (!tenantId) {
        return (
            <div className="invite-landing">
                {inviteLandingTranslationsReady ? t('inviteLanding.error.invalidLink') : 'Invalid invite link.'}
            </div>
        );
    }

    if (!inviteLandingTranslationsReady) {
        return (
            <div className="invite-landing">
                <Card className="invite-landing__card">
                    <h1 className="invite-landing__title">Loading invitation...</h1>
                    <p className="invite-landing__description">Please wait while we prepare your workspace invite.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="invite-landing">
            <Card className="invite-landing__card">
                <Badge variant="neutral" className="invite-landing__badge">
                    {t('inviteLanding.badge')}
                </Badge>
                <h1 className="invite-landing__title">{t('inviteLanding.title')}</h1>
                <p className="invite-landing__description">
                    {t('inviteLanding.description').replace('{tenantId}', tenantId)}
                </p>
                {status && (
                    <p className={`invite-landing__status invite-landing__status--${status.tone}`}>
                        {status.message}
                    </p>
                )}
                {!auth.currentUser && (
                    <Button onClick={handleAccept} className="invite-landing__action">
                        {t('inviteLanding.actions.accept')}
                    </Button>
                )}
                {auth.currentUser && (
                    <p className="invite-landing__hint">{t('inviteLanding.signedIn')}</p>
                )}
            </Card>
        </div>
    );
};
