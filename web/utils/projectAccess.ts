import type { Project } from '../types';

const readMemberId = (entry: unknown): string | null => {
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        if (typeof record.userId === 'string') return record.userId;
        if (typeof record.uid === 'string') return record.uid;
        if (typeof record.id === 'string') return record.id;
    }
    return null;
};

export const getProjectMemberIds = (project: Project): string[] => {
    const ids = new Set<string>();

    if (Array.isArray(project.memberIds)) {
        project.memberIds.forEach((id) => {
            if (typeof id === 'string' && id.trim()) {
                ids.add(id);
            }
        });
    }

    if (Array.isArray(project.members)) {
        project.members.forEach((member) => {
            const memberId = readMemberId(member);
            if (memberId) {
                ids.add(memberId);
            }
        });
    }

    return Array.from(ids);
};

export const isProjectMember = (project: Project, userId: string): boolean => {
    if (!userId) return false;
    if (project.ownerId === userId) return true;
    return getProjectMemberIds(project).includes(userId);
};

export const canUserAccessProject = (project: Project, userId: string): boolean => {
    if (!userId) return false;
    if (!project.isPrivate) return true;
    return isProjectMember(project, userId);
};
