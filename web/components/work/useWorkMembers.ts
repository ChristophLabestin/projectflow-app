import { useEffect, useState } from 'react';

import { subscribeWorkspaceMembers } from '../../services/domain/workspaceMembersService';
import type { WorkMember } from './workList';

/** Members of the active workspace, for assignee menus and avatars. */
export const useWorkMembers = (tenantId?: string) => {
    const [members, setMembers] = useState<WorkMember[]>([]);

    useEffect(() => {
        const unsubscribe = subscribeWorkspaceMembers((list) => {
            setMembers(list
                .map((member) => ({ uid: member.uid, displayName: member.displayName || member.email || '', photoURL: member.photoURL }))
                .sort((a, b) => a.displayName.localeCompare(b.displayName)));
        }, tenantId);
        return () => unsubscribe();
    }, [tenantId]);

    return members;
};
