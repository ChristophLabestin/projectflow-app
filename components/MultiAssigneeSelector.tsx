import React, { useEffect, useState, useRef } from 'react';
import { getProjectMembers, subscribeTenantUsers, getActiveTenantId } from '../services/dataService';
import { auth } from '../services/firebase';
import { Input } from './ui/Input';

interface MultiAssigneeSelectorProps {
    projectId: string;
    assigneeIds?: string[];
    onChange: (ids: string[]) => void;
    label?: string;
}

export const MultiAssigneeSelector: React.FC<MultiAssigneeSelectorProps> = ({ projectId, assigneeIds = [], onChange, label }) => {
    const [members, setMembers] = useState<string[]>([]);
    const [userMap, setUserMap] = useState<Record<string, { displayName: string, photoURL?: string, email?: string }>>({});
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
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

            console.log('[MultiAssigneeSelector] Members:', m);
            if (mounted) setMembers(m);

            // 2. Get the project to determine its tenant
            const { getProjectById, getUserProfile } = await import('../services/dataService');
            const project = await getProjectById(projectId);
            const projectTenantId = project?.tenantId || getActiveTenantId() || auth.currentUser?.uid;
            console.log('[MultiAssigneeSelector] Project tenantId:', projectTenantId);

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
                            console.log(`[MultiAssigneeSelector] Found ${uid} in project tenant`);
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
                        console.log(`[MultiAssigneeSelector] Found ${uid} in personal tenant`);
                        memberProfiles[uid] = {
                            displayName: profileFromPersonalTenant.displayName || 'User',
                            photoURL: profileFromPersonalTenant.photoURL,
                            email: profileFromPersonalTenant.email
                        };
                        return;
                    }

                    console.log(`[MultiAssigneeSelector] No profile found for ${uid}`);
                } catch (err) {
                    console.warn(`Failed to load profile for ${uid}`, err);
                }
            }));

            // Update user map with fetched profiles
            console.log('[MultiAssigneeSelector] Final memberProfiles:', memberProfiles);
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

    const filteredMembers = members.filter(uid => {
        const user = userMap[uid];
        const name = user?.displayName || user?.email || '';
        return name.toLowerCase().includes(search.toLowerCase());
    });

    if (loading) return <div className="h-10 bg-gray-100 rounded animate-pulse" />;

    return (
        <div className="flex flex-col gap-1 w-full" ref={wrapperRef}>
            {label && <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">{label}</label>}

            <div className="relative">
                {/* Trigger */}
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={`h-10 px-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between
                    bg-[var(--color-surface-bg)] text-[var(--color-text-main)]
                    ${isOpen ? 'border-[var(--color-text-subtle)]' : 'border-[var(--color-surface-border)] hover:border-[var(--color-text-subtle)]'}
                    `}
                >
                    {assigneeIds.length === 0 ? (
                        <span className="text-sm text-[var(--color-text-subtle)]">Unassigned</span>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-2 overflow-hidden">
                                {assigneeIds.slice(0, 4).map(uid => {
                                    const user = userMap[uid];
                                    return (
                                        <div key={uid} className="inline-block size-6 rounded-full ring-2 ring-[var(--color-surface-bg)] bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden" title={user?.displayName}>
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
                                <span className="text-xs font-medium text-[var(--color-text-muted)]">+{assigneeIds.length - 4}</span>
                            )}
                            {assigneeIds.length > 0 && assigneeIds.length <= 4 && (
                                <span className="text-xs text-[var(--color-text-muted)] ml-1">
                                    {assigneeIds.length === 1 ? userMap[assigneeIds[0]]?.displayName.split(' ')[0] : ''}
                                </span>
                            )}
                        </div>
                    )}
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)] leading-none">expand_more</span>
                </div>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute z-50 top-full mt-2 left-0 w-full bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="p-2 border-b border-[var(--color-surface-border)]">
                            <div className="px-2 py-1.5 bg-[var(--color-surface-bg)] rounded-lg">
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
                                <div className="px-4 py-3 text-sm text-[var(--color-text-subtle)] text-center">No members found</div>
                            ) : (
                                filteredMembers.map(uid => {
                                    const user = userMap[uid];
                                    const isSelected = assigneeIds.includes(uid);
                                    return (
                                        <div
                                            key={uid}
                                            onClick={() => toggleSelection(uid)}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-[var(--color-primary)]/10' : 'hover:bg-[var(--color-surface-hover)]'}`}
                                        >
                                            <div className={`size-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-text-muted)]'}`}>
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
                                                <span className={`text-sm font-medium truncate ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}>
                                                    {user ? user.displayName : 'Unknown User'}
                                                </span>
                                                <span className="text-[10px] text-[var(--color-text-muted)] truncate">
                                                    {user?.email || 'No email'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
