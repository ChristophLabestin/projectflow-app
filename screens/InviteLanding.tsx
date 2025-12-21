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
        navigate('/login', { state: { inviteTenantId: tenantId } });
    };

    if (!tenantId) {
        return <div className="p-8 text-center">Invalid invite link.</div>;
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="app-panel max-w-md w-full p-8 space-y-4 animate-fade-up">
                <span className="app-pill w-fit">Invitation</span>
                <h1 className="text-2xl font-display font-bold text-ink">Join this Team</h1>
                <p className="text-muted text-sm">
                    You have been invited to join workspace <span className="font-semibold text-ink">{tenantId}</span>.
                </p>
                {status && <div className="text-sm text-muted">{status}</div>}
                {!auth.currentUser && (
                    <button onClick={handleAccept} className="w-full h-11 btn-primary font-bold text-sm">
                        Accept & Continue
                    </button>
                )}
                {auth.currentUser && (
                    <p className="text-sm text-muted">You are signed in. Attempting to join automatically...</p>
                )}
            </div>
        </div>
    );
};
