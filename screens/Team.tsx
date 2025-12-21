import React, { useEffect, useMemo, useState } from 'react';
import { auth } from '../services/firebase';
import { getActiveTenantId, subscribeTenantUsers } from '../services/dataService';

type TeamUser = {
    id: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    joinedAt?: any;
};

export const Team = () => {
    const [users, setUsers] = useState<TeamUser[]>([]);
    const [copied, setCopied] = useState(false);
    const tenantId = useMemo(() => getActiveTenantId() || auth.currentUser?.uid || '', []);

    useEffect(() => {
        if (!tenantId) return;
        const unsub = subscribeTenantUsers(setUsers, tenantId);
        return () => unsub();
    }, [tenantId]);

    const inviteLink = useMemo(() => {
        if (!tenantId) return '';
        // Hash router compatible
        const base = window.location.href.split('#')[0];
        return `${base}#/invite/${tenantId}`;
    }, [tenantId]);

    const handleCopy = async () => {
        if (!inviteLink) return;
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch (e) {
            console.warn('Copy failed', e);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6 animate-fade-up">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <span className="app-pill w-fit">Workspace</span>
                    <h1 className="text-3xl font-display font-bold text-ink">Team</h1>
                    <p className="text-muted text-sm">Manage members in this workspace.</p>
                </div>
                <div className="app-panel flex items-center gap-2 px-3 py-2">
                    <input readOnly value={inviteLink} className="input-field w-64 px-3 py-2 text-sm" />
                    <button onClick={handleCopy} className="btn-primary px-3 py-2 text-sm font-bold">
                        {copied ? 'Copied!' : 'Copy Invite'}
                    </button>
                </div>
            </div>

            <div className="app-card">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Members</span>
                    <span className="text-xs text-gray-500">{users.length} people</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {users.map((u) => (
                        <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                            <div
                                className="w-10 h-10 rounded-full bg-center bg-cover bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                                style={{ backgroundImage: u.photoURL ? `url("${u.photoURL}")` : 'none' }}
                            />
                            <div className="flex flex-col">
                                <span className="font-semibold text-gray-900 dark:text-white">{u.displayName || 'Member'}</span>
                                <span className="text-xs text-gray-500">{u.email || u.id}</span>
                            </div>
                        </div>
                    ))}
                    {!users.length && (
                        <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                            No members yet. Share the invite link to add teammates.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
