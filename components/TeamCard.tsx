import React, { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import { subscribeProject, subscribeProjectPresence, getProjectMembers } from '../services/dataService';
import { auth } from '../services/firebase';
import { UserHoverCard } from './ui/UserHoverCard';

interface TeamCardProps {
    projectId: string;
    tenantId?: string;
    onInvite?: () => void;
}

export const TeamCard: React.FC<TeamCardProps> = ({ projectId, tenantId, onInvite }) => {
    const [memberIds, setMemberIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeUsers, setActiveUsers] = useState<Record<string, any>>({});

    useEffect(() => {
        let mounted = true;

        // 1. Subscribe to members list changes (e.g. new joins)
        const unsubProject = subscribeProject(projectId, (proj) => {
            if (mounted && proj?.members) {
                setMemberIds(proj.members);
                setLoading(false);
            }
        }, tenantId);

        // 2. Subscribe to realtime presence
        const unsubPresence = subscribeProjectPresence(projectId, (users) => {
            if (mounted) {
                const map: Record<string, any> = {};
                users.forEach(u => map[u.uid] = u);
                setActiveUsers(map);
            }
        }, tenantId);

        return () => {
            mounted = false;
            unsubProject();
            unsubPresence();
        };
    }, [projectId, tenantId]);

    // In a real app we would fetch full user details. 
    // For now we just show a count or placeholders if we can't fetch details.
    // If we had a generic user fetcher, we'd use it.

    // We can show the current user at least?
    // And maybe just a count for others.

    if (loading) return <Card padding="sm" className="h-24 animate-pulse bg-gray-100 dark:bg-gray-800" />;

    return (
        <Card padding="md" className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h3 className="h4">Project Team</h3>
                <button
                    onClick={onInvite}
                    className="p-2 -mr-2 rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-primary)] transition-colors"
                    title="Invite Member"
                >
                    <span className="material-symbols-outlined">person_add</span>
                </button>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex -space-x-3 p-1">
                    {memberIds.slice(0, 5).map((uid, i) => {
                        const onlineUser = activeUsers[uid];
                        // Fallback mock details if we only have UID and no presence info yet
                        const userDetails = onlineUser || {
                            uid,
                            displayName: uid === auth.currentUser?.uid ? 'Me' : 'User',
                            isOnline: false
                        };

                        return (
                            <UserHoverCard key={uid} user={userDetails}>
                                <div
                                    className={`relative inline-block size-10 rounded-full ring-2 ring-[var(--color-surface-card)] bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 bg-cover bg-center cursor-pointer transition-transform hover:scale-105 ${userDetails.isOnline ? 'ring-emerald-100' : ''}`}
                                >
                                    {uid === auth.currentUser?.uid ? (
                                        auth.currentUser?.photoURL ? (
                                            <img src={auth.currentUser.photoURL} alt="Me" className="w-full h-full rounded-full" />
                                        ) : (
                                            "ME"
                                        )
                                    ) : (
                                        onlineUser?.photoURL ? (
                                            <img src={onlineUser.photoURL} alt={onlineUser.displayName} className="w-full h-full rounded-full" />
                                        ) : (
                                            <span className="material-symbols-outlined text-[16px]">person</span>
                                        )
                                    )}
                                    {userDetails.isOnline && (
                                        <span className="absolute bottom-0 right-0 size-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                                    )}
                                </div>
                            </UserHoverCard>
                        );
                    })}
                    {memberIds.length > 5 && (
                        <div className="inline-block size-10 rounded-full ring-2 ring-[var(--color-surface-card)] bg-[var(--color-surface-hover)] flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)]">
                            +{memberIds.length - 5}
                        </div>
                    )}
                </div>
                {memberIds.length === 0 && (
                    <p className="text-sm text-[var(--color-text-subtle)]">No members yet.</p>
                )}
            </div>

            <p className="text-xs text-[var(--color-text-subtle)]">
                {memberIds.length} member{memberIds.length !== 1 ? 's' : ''} working on this project.
            </p>
        </Card>
    );
};
