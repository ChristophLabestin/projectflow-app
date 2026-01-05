import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth } from '../services/firebase';
import { joinTenant, setActiveTenantId } from '../services/dataService';

export const InviteLanding = () => {
    const { tenantId } = useParams<{ tenantId: string }>();
    const navigate = useNavigate();
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        const tryAutoJoin = async () => {
            if (!tenantId || !auth.currentUser) return;
            try {
                setStatus('Joining workspace...');
                await joinTenant(tenantId);
                setStatus('Joined! Redirecting...');
                navigate('/');
            } catch (e) {
                console.error(e);
                setStatus('Could not join automatically. Try again.');
            }
        };
        tryAutoJoin();
    }, [tenantId, navigate]);

    const handleAccept = () => {
        if (!tenantId) return;
        setActiveTenantId(tenantId);
        const returnUrl = window.location.pathname + window.location.search;
        navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`, { state: { inviteTenantId: tenantId } });
    };

    if (!tenantId) {
        return <div className="p-8 text-center">Invalid invite link.</div>;
    }

    return (
        <div className="invite-page">
            <div className="invite-card fade-up">
                <div className="invite-header">
                    <span className="invite-pill">Invitation</span>
                    <h1 className="invite-title">Join this Team</h1>
                </div>
                <p className="invite-text">
                    You have been invited to join workspace <strong>{tenantId}</strong>.
                </p>
                {status && <div className="text-sm text-[var(--color-text-muted)]">{status}</div>}
                {!auth.currentUser && (
                    <button onClick={handleAccept} className="btn-invite-primary">
                        Accept & Continue
                    </button>
                )}
                {auth.currentUser && (
                    <p className="invite-text">You are signed in. Attempting to join automatically...</p>
                )}
            </div>
        </div>
    );
};
