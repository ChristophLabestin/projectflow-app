import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { joinProjectViaLink } from '../services/dataService';
import { auth } from '../services/firebase';

export const JoinProjectViaLink = () => {
    const { inviteLinkId } = useParams<{ inviteLinkId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const hasJoined = useRef(false);

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
                setError('Invalid invite link');
                setStatus('error');
                return;
            }

            const projectIdParam = searchParams.get('projectId');
            const tenantIdParam = searchParams.get('tenantId');

            if (!projectIdParam || !tenantIdParam) {
                setError('Invalid invite link - missing parameters');
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
                    setError(err.message || 'Failed to join project');
                    setStatus('error');
                }
            }
        };

        handleJoin();
    }, [inviteLinkId, searchParams, navigate]);

    return (
        <div className="invite-page">
            <div className="invite-card">
                {status === 'loading' && (
                    <>
                        <div className="invite-status-icon loading">
                            <span className="material-symbols-outlined animate-spin">
                                progress_activity
                            </span>
                        </div>
                        <h2 className="invite-title mb-2">
                            Joining Project...
                        </h2>
                        <p className="invite-text">
                            Please wait while we add you to the project.
                        </p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="invite-status-icon success">
                            <span className="material-symbols-outlined">
                                check_circle
                            </span>
                        </div>
                        <h2 className="invite-title mb-2">
                            Successfully Joined!
                        </h2>
                        <p className="invite-text mb-4">
                            You've been added to the project. Redirecting...
                        </p>
                        <div className="invite-progress-bar">
                            <div className="bar" />
                        </div>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="invite-status-icon error">
                            <span className="material-symbols-outlined">
                                error
                            </span>
                        </div>
                        <h2 className="invite-title mb-2">
                            Unable to Join
                        </h2>
                        <p className="invite-text mb-6">
                            {error}
                        </p>
                        <div className="invite-actions">
                            <button
                                onClick={() => navigate('/projects')}
                                className="btn-invite-primary"
                            >
                                Go to Projects
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="btn-invite-secondary"
                            >
                                Try Again
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
