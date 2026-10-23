// Display registry of the workspace activity stream (tenants/{t}/activity).
// Contract: brain/plans/activity-events-contract.md. Add new types here, in
// functions/src/activity-logic.ts (ACTIVITY_EVENT_TYPES) and as `activity.types.<type>` in
// web/locales/en.ts + de.ts. Unknown types fall back to the domain icon and a generic sentence.

export type ActivityDomain = 'task' | 'subtask' | 'comment' | 'project' | 'file' | 'doc' | 'automation';

export interface ActivityTypeDef {
    domain: ActivityDomain;
    icon: string;
}

export const ACTIVITY_TYPES: Record<string, ActivityTypeDef> = {
    'task.created': { domain: 'task', icon: 'add_task' },
    'task.status_changed': { domain: 'task', icon: 'swap_horiz' },
    'task.completed': { domain: 'task', icon: 'task_alt' },
    'task.reopened': { domain: 'task', icon: 'replay' },
    'task.assigned': { domain: 'task', icon: 'person_add' },
    'task.unassigned': { domain: 'task', icon: 'person_remove' },
    'task.due_changed': { domain: 'task', icon: 'event' },
    'task.priority_changed': { domain: 'task', icon: 'flag' },
    'task.renamed': { domain: 'task', icon: 'edit' },
    'task.deleted': { domain: 'task', icon: 'delete' },
    'subtask.created': { domain: 'subtask', icon: 'checklist' },
    'subtask.completed': { domain: 'subtask', icon: 'check_circle' },
    'comment.created': { domain: 'comment', icon: 'chat_bubble' },
    'project.created': { domain: 'project', icon: 'create_new_folder' },
    'project.status_changed': { domain: 'project', icon: 'swap_horiz' },
    'project.member_added': { domain: 'project', icon: 'group_add' },
    'project.member_removed': { domain: 'project', icon: 'group_remove' },
    'file.uploaded': { domain: 'file', icon: 'upload_file' },
    'file.version_added': { domain: 'file', icon: 'difference' },
    'file.moved': { domain: 'file', icon: 'drive_file_move' },
    'file.trashed': { domain: 'file', icon: 'delete' },
    'file.restored': { domain: 'file', icon: 'restore_from_trash' },
    'file.deleted': { domain: 'file', icon: 'delete_forever' },
    'doc.created': { domain: 'doc', icon: 'note_add' },
    'doc.updated': { domain: 'doc', icon: 'edit_note' },
    'automation.ran': { domain: 'automation', icon: 'bolt' },
    'automation.failed': { domain: 'automation', icon: 'error' },
};

export const ACTIVITY_DOMAIN_ICONS: Record<ActivityDomain, string> = {
    task: 'task_alt',
    subtask: 'checklist',
    comment: 'chat_bubble',
    project: 'layers',
    file: 'description',
    doc: 'article',
    automation: 'bolt',
};

/** Domains offered in the type filter (subtasks are grouped under tasks). */
export const ACTIVITY_FILTER_DOMAINS: ActivityDomain[] = ['task', 'comment', 'project', 'file', 'doc', 'automation'];

export const activityTypeDef = (type: string, domain?: string): ActivityTypeDef => {
    const known = ACTIVITY_TYPES[type];
    if (known) return known;
    const fallbackDomain = (domain || type.split('.')[0]) as ActivityDomain;
    return { domain: fallbackDomain, icon: ACTIVITY_DOMAIN_ICONS[fallbackDomain] || 'history' };
};
