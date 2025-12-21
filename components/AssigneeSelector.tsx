import React, { useEffect, useState } from 'react';
import { getProjectMembers, subscribeTenantUsers, getActiveTenantId } from '../services/dataService';
import { auth } from '../services/firebase';

interface AssigneeSelectorProps {
    projectId: string;
    value?: string; // User UID
    onChange: (uid: string, displayName?: string) => void;
    label?: string;
}

export const AssigneeSelector: React.FC<AssigneeSelectorProps> = ({ projectId, value, onChange, label = "Assignee" }) => {
    const [members, setMembers] = useState<string[]>([]);
    const [userMap, setUserMap] = useState<Record<string, { displayName: string, photoURL?: string }>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            // 1. Fetch Project Member UIDs
            const m = await getProjectMembers(projectId);
            setMembers(m);

            // 2. Fetch Tenant Users to resolve names (best effort)
            const tenantId = getActiveTenantId() || auth.currentUser?.uid;
            if (tenantId) {
                const unsub = subscribeTenantUsers((users) => {
                    const map: Record<string, any> = {};
                    users.forEach(u => map[u.id] = u);
                    // Ensure current user is in map
                    if (auth.currentUser) {
                        map[auth.currentUser.uid] = {
                            displayName: auth.currentUser.displayName || 'Me',
                            photoURL: auth.currentUser.photoURL
                        };
                    }
                    setUserMap(map);
                    setLoading(false);
                }, tenantId);
                return () => unsub();
            } else {
                setLoading(false);
            }
        };
        load();
    }, [projectId]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const uid = e.target.value;
        const user = userMap[uid];
        onChange(uid, user?.displayName || 'Unknown');
    };

    if (loading) return <div className="h-10 bg-gray-100 rounded animate-pulse" />;

    return (
        <div className="flex flex-col gap-1">
            {label && <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">{label}</label>}
            <div className="relative">
                <select
                    value={value || ''}
                    onChange={handleChange}
                    className="w-full h-10 pl-3 pr-8 rounded-xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] appearance-none cursor-pointer"
                >
                    <option value="">Unassigned</option>
                    {members.map(uid => {
                        const user = userMap[uid];
                        return (
                            <option key={uid} value={uid}>
                                {user ? user.displayName : `User ${uid.slice(0, 5)}...`}
                            </option>
                        );
                    })}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]">
                    <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </div>
            </div>
        </div>
    );
};
