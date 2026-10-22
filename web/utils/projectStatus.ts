const STATUS_KEYS: Record<string, string> = {
    Active: 'project.status.active',
    'In Testing': 'project.status.inTesting',
    Backlog: 'project.status.backlog',
    Planning: 'project.status.planning',
    'On Hold': 'project.status.onHold',
    Completed: 'project.status.completed',
    Canceled: 'project.status.canceled',
    Brainstorming: 'project.status.brainstorming',
    Review: 'project.status.review'
};

/** Localized label for a stored project status (statuses are persisted in English). */
export const translateProjectStatus = (t: (key: string) => string, status?: string | null): string => {
    if (!status) return '';
    const key = STATUS_KEYS[status];
    return key ? t(key) : status;
};
