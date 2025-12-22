import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { joinWorkspaceViaLink } from '../services/dataService';
import { auth } from '../services/firebase';

export const JoinWorkspaceViaLink = () => {
    const { inviteLinkId } = useParams<{ inviteLinkId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const hasJoined = useRef(false);

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
                setError('Invalid invite link');
                setStatus('error');
                return;
            }

            const tenantIdParam = searchParams.get('tenantId');

            if (!tenantIdParam) {
                setError('Invalid invite link - missing parameters');
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
                setError(err.message || 'Failed to join workspace');
                setStatus('error');
            }
        };

        handleJoin();
    }, [inviteLinkId, searchParams, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-bg)] p-4">
            <div className="max-w-md w-full">
                {status === 'loading' && (
                    <div className="bg-[var(--color-surface-paper)] rounded-2xl shadow-xl p-8 text-center">
                        <div className="size-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl text-blue-600 dark:text-blue-400 animate-spin">
                                progress_activity
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">
                            Joining Workspace...
                        </h2>
                        <p className="text-[var(--color-text-muted)]">
                            Please wait while we add you to the workspace.
                        </p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="bg-[var(--color-surface-paper)] rounded-2xl shadow-xl p-8 text-center">
                        <div className="size-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl text-emerald-600 dark:text-emerald-400">
                                check_circle
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">
                            Successfully Joined!
                        </h2>
                        <p className="text-[var(--color-text-muted)] mb-4">
                            You've been added to the workspace. Redirecting...
                        </p>
                        <div className="h-1 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 animate-pulse" style={{ width: '100%' }} />
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="bg-[var(--color-surface-paper)] rounded-2xl shadow-xl p-8 text-center">
                        <div className="size-16 mx-auto mb-4 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl text-rose-600 dark:text-rose-400">
                                error
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">
                            Unable to Join
                        </h2>
                        <p className="text-[var(--color-text-muted)] mb-6">
                            {error}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => navigate('/')}
                                className="px-6 py-2 rounded-lg bg-[var(--color-primary)] text-white font-semibold hover:opacity-90 transition-opacity"
                            >
                                Go to Dashboard
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 rounded-lg border border-[var(--color-surface-border)] text-[var(--color-text-main)] font-semibold hover:bg-[var(--color-surface-hover)] transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
