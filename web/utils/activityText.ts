/**
 * Activity entries are persisted with English `action` strings. Translate the
 * known templates at render time so a German UI does not show English text.
 * Unknown strings are returned unchanged.
 */
type Translate = (key: string) => string;

const RULES: Array<{ pattern: RegExp; key: string; vars?: string[] }> = [
    { pattern: /^Added task "(.*)" to initiative$/s, key: 'activity.text.addedTaskToInitiative', vars: ['title'] },
    { pattern: /^Added task "(.*)"$/s, key: 'activity.text.addedTask', vars: ['title'] },
    { pattern: /^Added subtask "(.*)"$/s, key: 'activity.text.addedSubtask', vars: ['title'] },
    { pattern: /^Completed task "(.*)"$/s, key: 'activity.text.completedTask', vars: ['title'] },
    { pattern: /^Reopened task "(.*)"$/s, key: 'activity.text.reopenedTask', vars: ['title'] },
    { pattern: /^Completed subtask "(.*)"$/s, key: 'activity.text.completedSubtask', vars: ['title'] },
    { pattern: /^Reopened subtask "(.*)"$/s, key: 'activity.text.reopenedSubtask', vars: ['title'] },
    { pattern: /^Updated task "(.*)"$/s, key: 'activity.text.updatedTask', vars: ['title'] },
    // Written by the onTaskWritten / onCommentCreated Cloud Functions.
    { pattern: /^Changed status of "(.*)" to (.*)$/s, key: 'activity.text.changedStatus', vars: ['title', 'value'] },
    { pattern: /^Changed priority of "(.*)" to (.*)$/s, key: 'activity.text.changedPriority', vars: ['title', 'value'] },
    { pattern: /^Assigned task "(.*)"$/s, key: 'activity.text.assignedTask', vars: ['title'] },
    { pattern: /^Changed due date of "(.*)"$/s, key: 'activity.text.changedDueDate', vars: ['title'] },
    { pattern: /^Commented on task "(.*)"$/s, key: 'activity.text.commentedTask', vars: ['title'] },
    { pattern: /^Commented on initiative "(.*)"$/s, key: 'activity.text.commentedInitiative', vars: ['title'] },
    { pattern: /^Commented on issue "(.*)"$/s, key: 'activity.text.commentedIssue', vars: ['title'] },
    { pattern: /^Commented on idea "(.*)"$/s, key: 'activity.text.commentedIdea', vars: ['title'] },
    { pattern: /^Deleted task "(.*)"$/s, key: 'activity.text.deletedTask', vars: ['title'] },
    { pattern: /^Deleted subtask "(.*)"$/s, key: 'activity.text.deletedSubtask', vars: ['title'] },
    { pattern: /^Created initiative "(.*)"$/s, key: 'activity.text.createdInitiative', vars: ['title'] },
    { pattern: /^Updated initiative "(.*)"$/s, key: 'activity.text.updatedInitiative', vars: ['title'] },
    { pattern: /^Deleted initiative "(.*)"$/s, key: 'activity.text.deletedInitiative', vars: ['title'] },
    { pattern: /^Created project "(.*)"$/s, key: 'activity.text.createdProject', vars: ['title'] },
    { pattern: /^Paused project "(.*)"$/s, key: 'activity.text.pausedProject', vars: ['title'] },
    { pattern: /^Resumed project "(.*)"$/s, key: 'activity.text.resumedProject', vars: ['title'] },
    { pattern: /^Canceled project "(.*)"$/s, key: 'activity.text.canceledProject', vars: ['title'] },
    { pattern: /^Created milestone "(.*)"$/s, key: 'activity.text.createdMilestone', vars: ['title'] },
    { pattern: /^Created campaign "(.*)"$/s, key: 'activity.text.createdCampaign', vars: ['title'] },
    { pattern: /^created task$/i, key: 'activity.text.createdTaskShort' },
    { pattern: /^updated project settings$/i, key: 'activity.text.updatedProjectSettings' },
    { pattern: /^Updated project reminders$/i, key: 'activity.text.updatedReminders' },
    { pattern: /^Generated project report$/i, key: 'activity.text.generatedReport' },
    { pattern: /^requested to join the project$/i, key: 'activity.text.requestedJoin' },
];

export const localizeActivityAction = (action: string | undefined | null, t: Translate): string => {
    if (!action) return '';
    for (const rule of RULES) {
        const match = rule.pattern.exec(action);
        if (!match) continue;
        const translated = t(rule.key);
        // Missing key: keep the original text rather than rendering the raw key.
        if (!translated || translated === rule.key) return action;
        return rule.vars
            ? rule.vars.reduce((text, name, index) => text.replace(`{${name}}`, match[index + 1] ?? ''), translated)
            : translated;
    }
    return action;
};
