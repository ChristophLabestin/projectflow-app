import React, { useEffect, useState, useRef } from 'react';
import { getProjectMembers, subscribeTenantUsers, getActiveTenantId } from '../services/dataService';
import { auth } from '../services/firebase';
import { Input } from './ui/Input';
import { useLanguage } from '../context/LanguageContext';
import './multi-assignee-selector.scss';

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
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();

    useEffect(() => {
        let unsubUsers: (() => void) | undefined;
        let mounted = true;

        const load = async () => {
            // 1. Fetch Project Member UIDs
            const memberIds = await getProjectMembers(projectId);

            // Ensure current user is in members list (e.g. owner might not be explicit member)
            if (auth.currentUser && !memberIds.includes(auth.currentUser.uid)) {
                memberIds.push(auth.currentUser.uid);
            }

            // Ensure all current assignees are in the list
            assigneeIds.forEach(id => {
                if (!memberIds.includes(id)) memberIds.push(id);
            });

            if (mounted) setMembers(memberIds);

            // 2. Get the project to determine its tenant
            const { getProjectById, getUserProfile } = await import('../services/dataService');
            const project = await getProjectById(projectId);
            const projectTenantId = project?.tenantId || getActiveTenantId() || auth.currentUser?.uid;

            // 3. Fetch all member profiles
            const memberProfiles: Record<string, any> = {};

            // Always add current user
            if (auth.currentUser) {
                memberProfiles[auth.currentUser.uid] = {
                    displayName: auth.currentUser.displayName || t('assignees.me'),
                    photoURL: auth.currentUser.photoURL,
                    email: auth.currentUser.email
                };
            }

            // Fetch each member's profile - try multiple sources
            await Promise.all(memberIds.map(async (uid) => {
                if (uid === auth.currentUser?.uid) return; // Already have current user
                if (memberProfiles[uid]) return; // Already fetched

                try {
                    // First try: Project's tenant users collection
                    if (projectTenantId) {
                        const profileFromProjectTenant = await getUserProfile(uid, projectTenantId);
                        if (profileFromProjectTenant) {
                            memberProfiles[uid] = {
                                displayName: profileFromProjectTenant.displayName || t('assignees.unknownUser'),
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
                            displayName: profileFromPersonalTenant.displayName || t('assignees.unknownUser'),
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
                                displayName: u.displayName || t('assignees.unknownUser'),
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
                console.error('Failed to fetch project groups', error);
            }
        };
        load();

        return () => {
            mounted = false;
            if (unsubUsers) unsubUsers();
        };
    }, [projectId, t]);

    // Handle clicking outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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

    const filteredGroups = groups.filter(group => group.name.toLowerCase().includes(search.toLowerCase()));


    if (loading) return <div className="assignee-select__loading" />;

    return (
        <div className="assignee-select" ref={wrapperRef}>
            {label && <label className="assignee-select__label">{label}</label>}

            <div className="assignee-select__control">
                {/* Trigger */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`assignee-select__trigger ${isOpen ? 'is-open' : ''}`}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                >
                    {assigneeIds.length === 0 ? (
                        <span className="assignee-select__placeholder">{t('assignees.unassigned')}</span>
                    ) : (
                        <div className="assignee-select__summary">
                            <div className="assignee-select__avatars">
                                {assigneeIds.slice(0, 4).map(uid => {
                                    const user = userMap[uid];
                                    return (
                                        <div key={uid} className="assignee-select__avatar" title={user?.displayName}>
                                            {user?.photoURL ? (
                                                <img src={user.photoURL} alt="" className="assignee-select__avatar-image" />
                                            ) : (
                                                <span className="assignee-select__avatar-fallback">
                                                    {user?.displayName?.slice(0, 1) || t('assignees.unknownUser').slice(0, 1)}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {assigneeIds.length > 4 && (
                                <span className="assignee-select__count">+{assigneeIds.length - 4}</span>
                            )}
                            {assigneeIds.length > 0 && assigneeIds.length <= 4 && (
                                <span className="assignee-select__name">
                                    {assigneeIds.length === 1 ? (userMap[assigneeIds[0]]?.displayName.split(' ')[0] || '') : ''}
                                </span>
                            )}
                        </div>
                    )}

                    {assignedGroupIds.length > 0 && (
                        <div className="assignee-select__group">
                            <span className="material-symbols-outlined">groups</span>
                            <span className="assignee-select__group-count">{assignedGroupIds.length}</span>
                        </div>
                    )}

                    <span className="material-symbols-outlined assignee-select__chevron">expand_more</span>
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <div className="assignee-select__dropdown">
                        <div className="assignee-select__search">
                            <Input
                                ref={(input) => {
                                    // Manual focus on mount with preventScroll
                                    if (input) {
                                        input.focus({ preventScroll: true });
                                    }
                                }}
                                type="text"
                                className="assignee-select__search-input"
                                icon="search"
                                placeholder={t('assignees.searchPlaceholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="assignee-select__list" role="listbox">
                            {filteredMembers.length === 0 ? (
                                <div className="assignee-select__empty">{t('assignees.noResults')}</div>
                            ) : (
                                filteredMembers.map(uid => {
                                    const user = userMap[uid];
                                    const isSelected = assigneeIds.includes(uid);
                                    return (
                                        <button
                                            key={uid}
                                            type="button"
                                            onClick={() => toggleSelection(uid)}
                                            className={`assignee-select__option ${isSelected ? 'is-selected' : ''}`}
                                            role="option"
                                            aria-selected={isSelected}
                                        >
                                            <span className={`assignee-select__checkbox ${isSelected ? 'is-checked' : ''}`}>
                                                {isSelected && <span className="material-symbols-outlined">check</span>}
                                            </span>

                                            <div className="assignee-select__avatar assignee-select__avatar--option">
                                                {user?.photoURL ? (
                                                    <img src={user.photoURL} alt="" className="assignee-select__avatar-image" />
                                                ) : (
                                                    <span className="assignee-select__avatar-fallback">
                                                        {user?.displayName?.slice(0, 1) || t('assignees.unknownUser').slice(0, 1)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="assignee-select__option-text">
                                                <span className="assignee-select__option-title">
                                                    {user ? user.displayName : t('assignees.unknownUser')}
                                                </span>
                                                <span className="assignee-select__option-meta">
                                                    {user?.email || t('assignees.noEmail')}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}

                            {onGroupChange && filteredGroups.length > 0 && (
                                <div className="assignee-select__section">
                                    <div className="assignee-select__section-title">{t('assignees.groupsLabel')}</div>
                                    {filteredGroups.map(group => {
                                        const isSelected = assignedGroupIds.includes(group.id);
                                        return (
                                            <button
                                                key={group.id}
                                                type="button"
                                                onClick={() => toggleGroupSelection(group.id)}
                                                className={`assignee-select__option ${isSelected ? 'is-selected' : ''}`}
                                                role="option"
                                                aria-selected={isSelected}
                                            >
                                                <span className={`assignee-select__checkbox ${isSelected ? 'is-checked' : ''}`}>
                                                    {isSelected && <span className="material-symbols-outlined">check</span>}
                                                </span>
                                                <div className="assignee-select__avatar assignee-select__avatar--group">
                                                    <span className="material-symbols-outlined">groups</span>
                                                </div>
                                                <div className="assignee-select__option-text">
                                                    <span className="assignee-select__option-title">{group.name}</span>
                                                    <span className="assignee-select__option-meta">
                                                        {t('projectGroups.count.members').replace('{count}', String(group.memberIds.length))}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

