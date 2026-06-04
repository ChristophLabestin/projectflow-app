import { useEffect, useState } from 'react';
import type { Project } from '../../../../types';
import { getUserProfile } from '../../../../services/domain/usersService';

export type OverviewMember = {
    id: string;
    displayName: string;
    photoURL?: string;
};

const memberIdsOf = (project: Project | null): string[] => {
    if (!project) return [];
    const ids = new Set<string>();
    if (project.ownerId) ids.add(project.ownerId);
    for (const m of project.members || []) {
        ids.add(typeof m === 'string' ? m : m.userId);
    }
    for (const id of project.memberIds || []) ids.add(id);
    return Array.from(ids);
};

/** Loads member profiles for assignee chips/labels/avatars in the overview. */
export const useProjectMembers = (project: Project | null): OverviewMember[] => {
    const [members, setMembers] = useState<OverviewMember[]>([]);
    const tenantId = project?.tenantId;
    const idsKey = memberIdsOf(project).sort().join(',');

    useEffect(() => {
        let active = true;
        const ids = idsKey ? idsKey.split(',') : [];
        if (!ids.length) {
            setMembers([]);
            return;
        }
        const load = async () => {
            try {
                const profiles = await Promise.all(ids.map(async (id) => {
                    try {
                        const profile = await getUserProfile(id, tenantId);
                        return {
                            id,
                            displayName: (profile as any)?.displayName || (profile as any)?.email || id,
                            photoURL: (profile as any)?.photoURL
                        } as OverviewMember;
                    } catch {
                        return { id, displayName: id } as OverviewMember;
                    }
                }));
                if (active) setMembers(profiles);
            } catch {
                if (active) setMembers([]);
            }
        };
        void load();
        return () => { active = false; };
    }, [idsKey, tenantId]);

    return members;
};
