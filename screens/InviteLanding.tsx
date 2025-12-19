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
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-background-dark px-6">
            <div className="max-w-md w-full bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 rounded-2xl shadow-lg p-8 space-y-4">
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Join this Team</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                    You have been invited to join workspace <span className="font-semibold text-black dark:text-white">{tenantId}</span>.
                </p>
                {status && <div className="text-sm text-gray-500">{status}</div>}
                {!auth.currentUser && (
                    <button
                        onClick={handleAccept}
                        className="w-full h-11 rounded-lg bg-black text-white dark:bg-white dark:text-black font-bold text-sm"
                    >
                        Accept & Continue
                    </button>
                )}
                {auth.currentUser && (
                    <p className="text-sm text-gray-500">You are signed in. Attempting to join automatically...</p>
                )}
            </div>
        </div>
    );
};
