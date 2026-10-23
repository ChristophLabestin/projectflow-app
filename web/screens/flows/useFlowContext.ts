// Shared data for the Flows screens: members, projects, role and name lookups.
import { useEffect, useMemo, useState } from 'react';

import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { subscribeWorkspaceMembers } from '../../services/domain/workspaceMembersService';
import { subscribeTenantProjects } from '../../services/domain/projectsService';
import type { FlowNameLookup } from '../../components/flows/flowText';

export const useFlowContext = () => {
    const { activeWorkspaceId: tenantId, activeWorkspace } = useWorkspace();
    const { user } = useAuth();
    const role = activeWorkspace?.role || null;
    const [members, setMembers] = useState<{ uid: string; name: string; role?: string }[]>([]);
    const [projects, setProjects] = useState<{ id: string; title: string; ownerId?: string }[]>([]);

    useEffect(() => {
        if (!tenantId || role === 'Guest') return undefined;
        return subscribeWorkspaceMembers((list) => setMembers(list
            .filter((member) => member.role !== 'Guest')
            .map((member) => ({ uid: member.uid, name: member.displayName || member.email || member.uid, role: member.role }))
            .sort((a, b) => a.name.localeCompare(b.name))), tenantId);
    }, [tenantId, role]);

    useEffect(() => {
        if (!tenantId || role === 'Guest') return undefined;
        return subscribeTenantProjects((list) => setProjects(list
            .map((project) => ({ id: project.id, title: project.title || project.id, ownerId: project.ownerId }))
            .sort((a, b) => a.title.localeCompare(b.title))), tenantId);
    }, [tenantId, role]);

    const names: FlowNameLookup = useMemo(() => {
        const people = new Map(members.map((member) => [member.uid, member.name]));
        const titles = new Map(projects.map((project) => [project.id, project.title]));
        return { person: (uid) => people.get(uid) || uid, project: (id) => titles.get(id) || id };
    }, [members, projects]);

    const isAdmin = role === 'Owner' || role === 'Admin';
    /** Mirrors `canManageAutomation` on the server (member policy assumed on; the server has the last word). */
    const canManage = (scope: 'workspace' | 'project') => isAdmin || (role === 'Member' && scope === 'project');

    return { tenantId, uid: user?.uid || '', role, isAdmin, isGuest: role === 'Guest', members, projects, names, canManage };
};
