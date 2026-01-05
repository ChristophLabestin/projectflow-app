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
                // Join as Guest first to prevent default 'Member' role
                await joinTenant(tenantId, 'Guest');

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
        <div className="invite-page">
            <div className="invite-card fade-up">
                <div className="invite-header">
                    <span className="invite-pill pulse">Checking Access...</span>
                    <h1 className="invite-title">Join Project</h1>
                </div>
                <p className="invite-text">
                    You have been invited to collaborate on a project in workspace <strong>{tenantId}</strong>.
                </p>
                {status && <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">{status}</div>}

                {!auth.currentUser && (
                    <div className="pt-4">
                        <button onClick={handleAccept} className="btn-invite-primary">
                            Log In to Accept
                        </button>
                    </div>
                )}
                {auth.currentUser && !status && (
                    <p className="invite-text">You are signed in. We are adding you to the team...</p>
                )}
            </div>
        </div>
    );
};
