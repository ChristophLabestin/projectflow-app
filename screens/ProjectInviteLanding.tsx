import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { auth } from '../services/firebase';
import { joinTenant, joinProject, setActiveTenantId } from '../services/dataService';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/common/Button/Button';
import { Card } from '../components/common/Card/Card';
import { Badge } from '../components/common/Badge/Badge';
import './invite-landing.scss';

export const ProjectInviteLanding = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams] = useSearchParams();
    const tenantId = searchParams.get('tenantId');
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [status, setStatus] = useState<{ tone: 'info' | 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        const tryJoin = async () => {
            if (!projectId || !tenantId || !auth.currentUser) return;
            try {
                setStatus({ tone: 'info', message: t('projectInvite.status.joinWorkspace') });
                // Join as Guest first to prevent default 'Member' role
                await joinTenant(tenantId, 'Guest');

                setStatus({ tone: 'info', message: t('projectInvite.status.joinProject') });
                await joinProject(projectId, tenantId);

                setStatus({ tone: 'success', message: t('projectInvite.status.success') });
                navigate(`/project/${projectId}`);
            } catch (e: any) {
                console.error(e);
                setStatus({
                    tone: 'error',
                    message: t('projectInvite.status.failed').replace('{error}', e.message || t('projectInvite.status.failedFallback')),
                });
            }
        };
        tryJoin();
    }, [projectId, tenantId, navigate, t]);

    const handleAccept = () => {
        if (!tenantId) return;
        setActiveTenantId(tenantId);
        const returnUrl = window.location.pathname + window.location.search;
        navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`, { state: { from: returnUrl, inviteTenantId: tenantId } });
    };

    if (!projectId || !tenantId) {
        return <div className="invite-landing">{t('projectInvite.error.invalidLink')}</div>;
    }

    return (
        <div className="invite-landing">
            <Card className="invite-landing__card">
                <Badge variant="neutral" className="invite-landing__badge">
                    {t('projectInvite.badge')}
                </Badge>
                <h1 className="invite-landing__title">{t('projectInvite.title')}</h1>
                <p className="invite-landing__description">
                    {t('projectInvite.description').replace('{tenantId}', tenantId)}
                </p>
                {status && (
                    <p className={`invite-landing__status invite-landing__status--${status.tone}`}>
                        {status.message}
                    </p>
                )}

                {!auth.currentUser && (
                    <Button onClick={handleAccept} className="invite-landing__action">
                        {t('projectInvite.actions.login')}
                    </Button>
                )}
                {auth.currentUser && !status && (
                    <p className="invite-landing__hint">{t('projectInvite.signedIn')}</p>
                )}
            </Card>
        </div>
    );
};
