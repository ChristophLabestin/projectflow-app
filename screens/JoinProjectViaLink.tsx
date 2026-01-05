import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { joinProjectViaLink } from '../services/dataService';
import { auth } from '../services/firebase';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/common/Button/Button';
import { StatusCard } from '../components/common/StatusCard/StatusCard';
import './join-link.scss';

export const JoinProjectViaLink = () => {
    const { inviteLinkId } = useParams<{ inviteLinkId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const hasJoined = useRef(false);
    const { t } = useLanguage();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = useState<string>('');
    const [projectId, setProjectId] = useState<string>('');

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
                setError(t('joinProjectLink.error.invalidLink'));
                setStatus('error');
                return;
            }

            const projectIdParam = searchParams.get('projectId');
            const tenantIdParam = searchParams.get('tenantId');

            if (!projectIdParam || !tenantIdParam) {
                setError(t('joinProjectLink.error.missingParams'));
                setStatus('error');
                return;
            }

            try {
                setStatus('loading');
                await joinProjectViaLink(inviteLinkId, projectIdParam, tenantIdParam);
                setProjectId(projectIdParam);
                setStatus('success');

                // Redirect to project after 1.5 seconds
                setTimeout(() => {
                    navigate(`/project/${projectIdParam}`);
                }, 1500);
            } catch (err: any) {
                console.error('Failed to join project:', err);
                // If error says "already a member", treat as success or redirect
                if (err.message && err.message.includes('already a member')) {
                    setProjectId(projectIdParam);
                    setStatus('success');
                    setTimeout(() => {
                        navigate(`/project/${projectIdParam}`);
                    }, 1500);
                } else {
                    setError(err.message || t('joinProjectLink.error.joinFailed'));
                    setStatus('error');
                }
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
                    title={t('joinProjectLink.loading.title')}
                    message={t('joinProjectLink.loading.message')}
                />
            )}

            {status === 'success' && (
                <StatusCard
                    className="join-link__card"
                    tone="success"
                    icon={<span className="material-symbols-outlined">check_circle</span>}
                    title={t('joinProjectLink.success.title')}
                    message={t('joinProjectLink.success.message')}
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
                    title={t('joinProjectLink.error.title')}
                    message={error}
                >
                    <div className="join-link__actions">
                        <Button
                            onClick={() => navigate('/projects')}
                            className="join-link__button"
                        >
                            {t('joinProjectLink.actions.projects')}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => window.location.reload()}
                            className="join-link__button"
                        >
                            {t('joinProjectLink.actions.retry')}
                        </Button>
                    </div>
                </StatusCard>
            )}
        </div>
    );
};
