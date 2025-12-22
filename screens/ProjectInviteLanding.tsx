import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { auth } from '../services/firebase';
import { joinTenant, joinProject, setActiveTenantId } from '../services/dataService';

export const ProjectInviteLanding = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams] = useSearchParams();
    const tenantId = searchParams.get('tenantId');
    const navigate = useNavigate();
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        const tryJoin = async () => {
            if (!projectId || !tenantId || !auth.currentUser) return;
            try {
                setStatus('Joining workspace...');
                await joinTenant(tenantId);

                setStatus('Joining project team...');
                await joinProject(projectId, tenantId);

                setStatus('Success! Redirecting...');
                navigate(`/project/${projectId}`);
            } catch (e: any) {
                console.error(e);
                setStatus(`Failed to join: ${e.message}`);
            }
        };
        tryJoin();
    }, [projectId, tenantId, navigate]);

    const handleAccept = () => {
        if (!tenantId) return;
        setActiveTenantId(tenantId);
        const returnUrl = window.location.pathname + window.location.search;
        navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`, { state: { from: returnUrl, inviteTenantId: tenantId } });
    };

    if (!projectId || !tenantId) {
        return <div className="p-8 text-center">Invalid project invite link.</div>;
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="app-panel max-w-md w-full p-8 space-y-4 animate-fade-up">
                <span className="app-pill w-fit animate-pulse">Checking Access...</span>
                <h1 className="text-2xl font-display font-bold text-ink">Join Project</h1>
                <p className="text-muted text-sm">
                    You have been invited to collaborate on a project in workspace <span className="font-semibold text-ink">{tenantId}</span>.
                </p>
                {status && <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">{status}</div>}

                {!auth.currentUser && (
                    <div className="pt-4">
                        <button onClick={handleAccept} className="w-full h-11 btn-primary font-bold text-sm">
                            Log In to Accept
                        </button>
                    </div>
                )}
                {auth.currentUser && !status && (
                    <p className="text-sm text-muted">You are signed in. We are adding you to the team...</p>
                )}
            </div>
        </div>
    );
};
