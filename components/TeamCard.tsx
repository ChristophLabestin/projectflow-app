import React, { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { subscribeProject, subscribeProjectPresence, removeMember, getUserProfile, requestJoinProject } from '../services/dataService';
import { auth } from '../services/firebase';
import { UserHoverCard } from './ui/UserHoverCard';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
import { Project, ProjectMember, EmailTemplate } from '../types';
import { useToast } from '../context/UIContext';

interface TeamCardProps {
    projectId: string;
    tenantId?: string;
    onInvite?: () => void;
}

export const TeamCard: React.FC<TeamCardProps> = ({ projectId, tenantId, onInvite }) => {
    const [project, setProject] = useState<Project | null>(null);
    const [members, setMembers] = useState<(ProjectMember | string)[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeUsers, setActiveUsers] = useState<Record<string, any>>({});
    const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinSent, setJoinSent] = useState(false);
    const [removingMember, setRemovingMember] = useState<string | null>(null);
    const [memberToKick, setMemberToKick] = useState<string | null>(null);
    const [showLeaveModal, setShowLeaveModal] = useState(false);

    const { isOwner } = useProjectPermissions(project);
    const { showError } = useToast();
    const currentUserId = auth.currentUser?.uid;
    const isMember = members.some(m => (typeof m === 'string' ? m : m.userId) === currentUserId) || project?.ownerId === currentUserId;

    const handleJoin = async () => {
        if (!currentUserId || !project) return;
        setJoinLoading(true);
        try {
            await requestJoinProject(project.id, tenantId);
            setJoinSent(true);
        } catch (error) {
            console.error(error);
            showError('Failed to send join request');
        } finally {
            setJoinLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;

        // Subscribe to project changes
        const unsubProject = subscribeProject(projectId, (proj) => {
            if (mounted && proj) {
                setProject(proj);
                setMembers(proj.members || []);
                setLoading(false);
            }
        }, tenantId);

        // Subscribe to realtime presence
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

    // Fetch profiles for members who are not online (activeUsers)
    useEffect(() => {
        const fetchMissingProfiles = async () => {
            const memberIds = members.map(m => typeof m === 'string' ? m : m.userId);
            const missingIds = memberIds.filter(id => !activeUsers[id] && !userProfiles[id]);

            if (missingIds.length === 0) return;

            const newProfiles: Record<string, any> = {};
            await Promise.all(missingIds.map(async (uid) => {
                try {
                    const profile = await getUserProfile(uid, tenantId);
                    if (profile) newProfiles[uid] = profile;
                } catch (e) {
                    console.warn(`Failed to fetch profile for ${uid}`, e);
                }
            }));

            setUserProfiles(prev => ({ ...prev, ...newProfiles }));
        };

        fetchMissingProfiles();
    }, [members, activeUsers, tenantId]);


    const handleRemoveMember = (userId: string) => {
        setMemberToKick(userId);
    };

    const confirmKickMember = async () => {
        if (!memberToKick || !project) return;
        setRemovingMember(memberToKick);
        setMemberToKick(null);
        try {
            await removeMember(project.id, memberToKick, tenantId);
        } catch (error) {
            console.error(error);
            showError('Failed to remove member');
        } finally {
            setRemovingMember(null);
        }
    };

    const handleLeaveProject = () => {
        setShowLeaveModal(true);
    };

    const confirmLeaveProject = async () => {
        if (!project || !currentUserId) return;
        setRemovingMember(currentUserId);
        setShowLeaveModal(false);
        try {
            await removeMember(project.id, currentUserId, tenantId);
        } catch (error) {
            console.error(error);
            showError('Failed to leave project');
        } finally {
            setRemovingMember(null);
        }
    };

    const getMemberId = (member: ProjectMember | string): string => {
        return typeof member === 'string' ? member : member.userId;
    };

    const getMemberRole = (member: ProjectMember | string): string | undefined => {
        return typeof member === 'string' ? undefined : member.role;
    };

    const activeMemberCount = Object.keys(activeUsers).length;

    return (
        <>
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="h4">Project Team</h3>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                            {members.length} member{members.length !== 1 ? 's' : ''} · {activeMemberCount} active
                        </p>
                    </div>
                    {!loading && (
                        isMember ? (
                            onInvite && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={onInvite} icon={<span className="material-symbols-outlined">person_add</span>}>
                                        Invite
                                    </Button>
                                    {!isOwner && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleLeaveProject}
                                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10"
                                        >
                                            Leave
                                        </Button>
                                    )}
                                </div>
                            )
                        ) : (
                            <Button
                                size="sm"
                                variant="primary"
                                onClick={handleJoin}
                                isLoading={joinLoading}
                                disabled={joinSent}
                                icon={<span className="material-symbols-outlined">{joinSent ? 'check' : 'group_add'}</span>}
                            >
                                {joinSent ? 'Request Sent' : 'Join Project'}
                            </Button>
                        )
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin">progress_activity</span>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {members.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No team members yet.</p>
                        ) : (
                            members.map((member, idx) => {
                                const memberId = getMemberId(member);
                                const memberRole = getMemberRole(member);
                                const isCurrentUser = memberId === currentUserId;
                                const canRemove = isOwner && !isCurrentUser && project?.ownerId !== memberId;

                                // Combine data sources: Active user data > Fetched profile > Fallback
                                const onlineData = activeUsers[memberId];
                                const profileData = userProfiles[memberId];
                                const isOnline = !!onlineData?.isOnline;

                                const displayName = onlineData?.displayName || profileData?.displayName || memberId;
                                const photoURL = onlineData?.photoURL || profileData?.photoURL;

                                // Construct user object for UserHoverCard
                                const userForCard = {
                                    uid: memberId,
                                    displayName: displayName === memberId && isCurrentUser ? 'You' : displayName,
                                    photoURL,
                                    isOnline
                                };

                                return (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors group"
                                    >
                                        <div className="relative">
                                            <UserHoverCard user={userForCard}>
                                                {photoURL ? (
                                                    <img
                                                        src={photoURL}
                                                        alt={displayName}
                                                        className={`size-10 rounded-full object-cover cursor-pointer border-2 ${isOnline ? 'border-emerald-500' : 'border-[var(--color-surface-border)]'}`}
                                                    />
                                                ) : (
                                                    <div className={`size-10 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer border-2 ${isOnline ? 'border-emerald-500' : 'border-transparent'}`}
                                                        style={{ backgroundColor: 'var(--color-primary)' }}>
                                                        {(displayName || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </UserHoverCard>
                                            {isOnline && (
                                                <div className="absolute bottom-0 right-0 size-3.5 rounded-full bg-emerald-500 border-2 border-[var(--color-surface-paper)]" title="Online" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-[var(--color-text-main)] truncate">
                                                    {isCurrentUser ? `${displayName} (You)` : displayName}
                                                </p>
                                                {memberRole && (
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${memberRole === 'Owner'
                                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                        : memberRole === 'Editor'
                                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                                                        }`}>
                                                        {memberRole}
                                                    </span>
                                                )}
                                                {project?.ownerId === memberId && !memberRole && (
                                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                        Owner
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[var(--color-text-subtle)] flex items-center gap-1">
                                                {isOnline ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Online now</span>
                                                ) : (
                                                    <span>Offline</span>
                                                )}
                                            </p>
                                        </div>
                                        {canRemove && (
                                            <button
                                                onClick={() => handleRemoveMember(memberId)}
                                                disabled={removingMember === memberId}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 disabled:opacity-50"
                                                title="Remove member"
                                            >
                                                {removingMember === memberId ? (
                                                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                                ) : (
                                                    <span className="material-symbols-outlined text-[18px]">person_remove</span>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </Card>

            {/* Kick Modal */}
            <Modal
                isOpen={!!memberToKick}
                onClose={() => setMemberToKick(null)}
                title="Remove Member"
            >
                <div className="space-y-4">
                    <p className="text-[var(--color-text-main)]">
                        Are you sure you want to remove this member from the project? They will lose access to all project resources.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setMemberToKick(null)}>Cancel</Button>
                        <Button variant="primary" onClick={confirmKickMember} className="bg-rose-600 hover:bg-rose-700 text-white">
                            Remove
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Leave Modal */}
            <Modal
                isOpen={showLeaveModal}
                onClose={() => setShowLeaveModal(false)}
                title="Leave Project"
            >
                <div className="space-y-4">
                    <p className="text-[var(--color-text-main)]">
                        Are you sure you want to leave <strong>{project?.title}</strong>? You will no longer have access to this project.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setShowLeaveModal(false)}>Cancel</Button>
                        <Button variant="primary" onClick={confirmLeaveProject} className="bg-rose-600 hover:bg-rose-700 text-white">
                            Leave Project
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};
