import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { joinWorkspaceViaLink } from '../services/dataService';
import { auth } from '../services/firebase';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/common/Button/Button';
import { StatusCard } from '../components/common/StatusCard/StatusCard';
import './join-link.scss';

export const JoinWorkspaceViaLink = () => {
    const { inviteLinkId } = useParams<{ inviteLinkId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const hasJoined = useRef(false);
    const { t } = useLanguage();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const handleJoin = async () => {
            if (hasJoined.current) return;

            if (!auth.currentUser) {
                // Redirect to login with return URL
                const returnUrl = window.location.href;
                navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
                return;
            }

            hasJoined.current = true;

            if (!inviteLinkId) {
                setError(t('joinWorkspaceLink.error.invalidLink'));
                setStatus('error');
                return;
            }

            const tenantIdParam = searchParams.get('tenantId');

            if (!tenantIdParam) {
                setError(t('joinWorkspaceLink.error.missingParams'));
                setStatus('error');
                return;
            }

            try {
                setStatus('loading');
                await joinWorkspaceViaLink(inviteLinkId, tenantIdParam);
                setStatus('success');

                // Redirect to dashboard after 1.5 seconds
                setTimeout(() => {
                    navigate('/');
                }, 1500);
            } catch (err: any) {
                console.error('Failed to join workspace:', err);
                // If error says "already in workspace" (or similar), treat as success or redirect
                // joinTenant handles upsert so usually it doesn't fail if already in. 
                // However, validateInviteLink might fail if maxUses check races.
                // Assuming idempotency for now.
                setError(err.message || t('joinWorkspaceLink.error.joinFailed'));
                setStatus('error');
            }
        };

        handleJoin();
    }, [inviteLinkId, searchParams, navigate, t]);

    return (
        <div className="join-link">
            {status === 'loading' && (
                <StatusCard
                    className="join-link__card"
                    tone="info"
                    icon={<span className="material-symbols-outlined status-card__spin">progress_activity</span>}
                    title={t('joinWorkspaceLink.loading.title')}
                    message={t('joinWorkspaceLink.loading.message')}
                />
            )}

            {status === 'success' && (
                <StatusCard
                    className="join-link__card"
                    tone="success"
                    icon={<span className="material-symbols-outlined">check_circle</span>}
                    title={t('joinWorkspaceLink.success.title')}
                    message={t('joinWorkspaceLink.success.message')}
                >
                    <div className="status-card__progress">
                        <div className="status-card__progress-bar" />
                    </div>
                </StatusCard>
            )}

            {status === 'error' && (
                <StatusCard
                    className="join-link__card"
                    tone="error"
                    icon={<span className="material-symbols-outlined">error</span>}
                    title={t('joinWorkspaceLink.error.title')}
                    message={error}
                >
                    <div className="join-link__actions">
                        <Button
                            onClick={() => navigate('/')}
                            className="join-link__button"
                        >
                            {t('joinWorkspaceLink.actions.dashboard')}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => window.location.reload()}
                            className="join-link__button"
                        >
                            {t('joinWorkspaceLink.actions.retry')}
                        </Button>
                    </div>
                </StatusCard>
            )}
        </div>
    );
};
