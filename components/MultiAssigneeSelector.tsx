import React, { useEffect, useState, useRef } from 'react';
import { getProjectMembers, subscribeTenantUsers, getActiveTenantId } from '../services/dataService';
import { auth } from '../services/firebase';
import { Input } from './ui/Input';

interface MultiAssigneeSelectorProps {
    projectId: string;
    assigneeIds?: string[];
    assignedGroupIds?: string[];
    onChange: (ids: string[]) => void;
    onGroupChange?: (groupIds: string[]) => void;
    label?: string;
}

export const MultiAssigneeSelector: React.FC<MultiAssigneeSelectorProps> = ({ projectId, assigneeIds = [], assignedGroupIds = [], onChange, onGroupChange, label }) => {
    const [members, setMembers] = useState<string[]>([]);
    const [groups, setGroups] = useState<{ id: string, name: string, color?: string, memberIds: string[] }[]>([]);
    const [userMap, setUserMap] = useState<Record<string, { displayName: string, photoURL?: string, email?: string }>>({});
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [projectModules, setProjectModules] = useState<string[]>([]);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let unsubUsers: (() => void) | undefined;
        let mounted = true;

        const load = async () => {
            // 1. Fetch Project Member UIDs
            const m = await getProjectMembers(projectId);

            // Ensure current user is in members list (e.g. owner might not be explicit member)
            if (auth.currentUser && !m.includes(auth.currentUser.uid)) {
                m.push(auth.currentUser.uid);
            }

            // Ensure all current assignees are in the list
            assigneeIds.forEach(id => {
                if (!m.includes(id)) m.push(id);
            });

            if (mounted) setMembers(m);

            // 2. Get the project to determine its tenant
            const { getProjectById, getUserProfile } = await import('../services/dataService');
            const project = await getProjectById(projectId);
            if (project?.modules) setProjectModules(project.modules);
            const projectTenantId = project?.tenantId || getActiveTenantId() || auth.currentUser?.uid;

            // 3. Fetch all member profiles
            const memberProfiles: Record<string, any> = {};

            // Always add current user
            if (auth.currentUser) {
                memberProfiles[auth.currentUser.uid] = {
                    displayName: auth.currentUser.displayName || 'Me',
                    photoURL: auth.currentUser.photoURL,
                    email: auth.currentUser.email
                };
            }

            // Fetch each member's profile - try multiple sources
            await Promise.all(m.map(async (uid) => {
                if (uid === auth.currentUser?.uid) return; // Already have current user
                if (memberProfiles[uid]) return; // Already fetched

                try {
                    // First try: Project's tenant users collection
                    if (projectTenantId) {
                        const profileFromProjectTenant = await getUserProfile(uid, projectTenantId);
                        if (profileFromProjectTenant) {
                            memberProfiles[uid] = {
                                displayName: profileFromProjectTenant.displayName || 'User',
                                photoURL: profileFromProjectTenant.photoURL,
                                email: profileFromProjectTenant.email
                            };
                            return;
                        }
                    }

                    // Second try: User's personal tenant (uid = tenantId)
                    const profileFromPersonalTenant = await getUserProfile(uid, uid);
                    if (profileFromPersonalTenant) {
                        memberProfiles[uid] = {
                            displayName: profileFromPersonalTenant.displayName || 'User',
                            photoURL: profileFromPersonalTenant.photoURL,
                            email: profileFromPersonalTenant.email
                        };
                        return;
                    }

                    console.warn(`[MultiAssigneeSelector] No profile found for ${uid}`);
                } catch (err) {
                    console.warn(`Failed to load profile for ${uid}`, err);
                }
            }));

            // Update user map with fetched profiles
            if (mounted) {
                setUserMap({ ...memberProfiles });
                setLoading(false);
            }

            // 4. Also subscribe to project tenant users for real-time updates
            if (projectTenantId) {
                unsubUsers = subscribeTenantUsers((users) => {
                    if (!mounted) return;
                    const combinedMap = { ...memberProfiles };
                    users.forEach(u => {
                        if (!combinedMap[u.id] || !combinedMap[u.id].displayName) {
                            combinedMap[u.id] = {
                                displayName: u.displayName || 'User',
                                photoURL: u.photoURL,
                                email: u.email
                            };
                        }
                    });
                    setUserMap(combinedMap);
                }, projectTenantId);
            }

            // 5. Fetch Project Groups
            const { getProjectGroups } = await import('../services/projectGroupService');
            try {
                const projectGroups = await getProjectGroups(projectId);
                if (mounted) setGroups(projectGroups);
            } catch (error) {
                console.error("Failed to fetch project groups", error);
            }
        };
        load();

        return () => {
            mounted = false;
            if (unsubUsers) unsubUsers();
        };
    }, [projectId]);

    // Handle clicking outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleSelection = (uid: string) => {
        const newIds = assigneeIds.includes(uid)
            ? assigneeIds.filter(id => id !== uid)
            : [...assigneeIds, uid];
        onChange(newIds);
    };

    const toggleGroupSelection = (groupId: string) => {
        if (!onGroupChange) return;
        const newGroupIds = assignedGroupIds.includes(groupId)
            ? assignedGroupIds.filter(id => id !== groupId)
            : [...assignedGroupIds, groupId];
        onGroupChange(newGroupIds);
    };

    const filteredMembers = members.filter(uid => {
        const user = userMap[uid];
        const name = user?.displayName || user?.email || '';
        return name.toLowerCase().includes(search.toLowerCase());
    });

    const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));


    if (loading) return <div className="h-10 bg-gray-100 rounded animate-pulse" />;

    return (
        <div className="flex flex-col gap-1 w-full" ref={wrapperRef}>
            {label && <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1">{label}</label>}

            <div className="relative">
                {/* Trigger */}
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={`h-10 px-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between
                    bg-surface text-main
                    ${isOpen ? 'border-[var(--color-text-subtle)]' : 'border-surface hover:border-[var(--color-text-subtle)]'}
                    `}
                >
                    {assigneeIds.length === 0 ? (
                        <span className="text-sm text-subtle">Unassigned</span>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-2 overflow-hidden">
                                {assigneeIds.slice(0, 4).map(uid => {
                                    const user = userMap[uid];
                                    return (
                                        <div key={uid} className="inline-block size-6 rounded-full ring-2 ring-surface-bg bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden" title={user?.displayName}>
                                            {user?.photoURL ? (
                                                <img src={user.photoURL} alt="" className="size-full object-cover" />
                                            ) : (
                                                <span className="text-[9px] font-bold">{user?.displayName?.slice(0, 1) || 'U'}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {assigneeIds.length > 4 && (
                                <span className="text-xs font-medium text-muted">+{assigneeIds.length - 4}</span>
                            )}
                            {assigneeIds.length > 0 && assigneeIds.length <= 4 && (
                                <span className="text-xs text-muted ml-1">
                                    {assigneeIds.length === 1 ? userMap[assigneeIds[0]]?.displayName.split(' ')[0] : ''}
                                </span>
                            )}
                        </div>
                    )}

                    {assignedGroupIds.length > 0 && (
                        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-surface">
                            <span className="material-symbols-outlined text-[16px] text-indigo-500">groups</span>
                            <span className="text-xs font-medium text-main">{assignedGroupIds.length}</span>
                        </div>
                    )}

                    <span className="material-symbols-outlined text-[20px] text-subtle leading-none ml-auto">expand_more</span>
                </div>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 min-w-full w-72 bg-card border border-surface rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="p-2 border-b border-surface">
                            <div className="px-2 py-1.5 bg-surface rounded-lg">
                                <Input
                                    ref={(input) => {
                                        // Manual focus on mount with preventScroll
                                        if (input) {
                                            input.focus({ preventScroll: true });
                                        }
                                    }}
                                    type="text"
                                    className="border-none focus:ring-0 px-0 h-auto py-1 shadow-none bg-transparent"
                                    icon="search"
                                    placeholder="Search members..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-1">
                            {filteredMembers.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-subtle text-center">No members found</div>
                            ) : (
                                filteredMembers.map(uid => {
                                    const user = userMap[uid];
                                    const isSelected = assigneeIds.includes(uid);
                                    return (
                                        <div
                                            key={uid}
                                            onClick={() => toggleSelection(uid)}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-surface-hover'}`}
                                        >
                                            <div className={`size-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted'}`}>
                                                {isSelected && <span className="material-symbols-outlined text-[12px] text-white">check</span>}
                                            </div>

                                            <div className="size-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {user?.photoURL ? (
                                                    <img src={user.photoURL} alt="" className="size-full object-cover" />
                                                ) : (
                                                    <span className="text-xs font-bold">{user?.displayName?.slice(0, 1) || 'U'}</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-main'}`}>
                                                    {user ? user.displayName : 'Unknown User'}
                                                </span>
                                                <span className="text-[10px] text-muted truncate">
                                                    {user?.email || 'No email'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {onGroupChange && filteredGroups.length > 0 && (
                                <>
                                    <div className="px-2 py-1 text-xs font-bold text-muted uppercase mt-2">Groups</div>
                                    {filteredGroups.map(group => {
                                        const isSelected = assignedGroupIds.includes(group.id);
                                        return (
                                            <div
                                                key={group.id}
                                                onClick={() => toggleGroupSelection(group.id)}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-surface-hover'}`}
                                            >
                                                <div className={`size-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted'}`}>
                                                    {isSelected && <span className="material-symbols-outlined text-[12px] text-white">check</span>}
                                                </div>
                                                <div className="size-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 border border-indigo-200">
                                                    <span className="material-symbols-outlined text-[18px]">groups</span>
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-main'}`}>
                                                        {group.name}
                                                    </span>
                                                    <span className="text-[10px] text-muted truncate">
                                                        {group.memberIds.length} members
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};
