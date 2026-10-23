import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'calendar',
    category: 'planning',
    icon: 'event',
    title: 'Calendar',
    summary: 'See your tasks by day, drag them to plan your week and let Smart Schedule fill the gaps.',
    keywords: ['calendar', 'schedule', 'plan', 'week', 'month', 'drag', 'due date', 'smart schedule', 'unscheduled'],
    sections: [
        {
            id: 'overview',
            title: 'What the calendar shows',
            keywords: ['week', 'month', 'view', 'due date', 'scheduled'],
            blocks: [
                { type: 'text', text: 'The [Calendar](/calendar) shows your unfinished tasks on the day they are scheduled. If a task has no scheduled day, its due date is used instead. Done tasks are hidden.' },
                { type: 'text', text: 'Switch between **Week** and **Month** at the top and use the arrows to move through time. On phones the week view shows a day strip with the agenda of the selected day.' },
                { type: 'text', text: 'Click a task to open it. Hover over it for a quick preview with status, date and assignee.' },
            ],
        },
        {
            id: 'plan-tasks',
            title: 'Plan tasks by dragging',
            keywords: ['drag', 'drop', 'reschedule', 'move', 'unscheduled', 'inbox'],
            blocks: [
                { type: 'steps', items: [
                    'Open the **Unscheduled** panel next to the calendar. It lists tasks without a date.',
                    'Drag a task onto a day. It is scheduled for that day.',
                    'To move it, drag it to another day. To take it off the calendar, drag it back to **Unscheduled** or use the **Unschedule** button on the task.',
                ] },
                { type: 'callout', tone: 'note', text: 'When you drag an unassigned task from **Unscheduled** onto a day, it is assigned to you.' },
            ],
        },
        {
            id: 'smart-schedule',
            title: 'Let Smart Schedule plan for you',
            keywords: ['smart schedule', 'optimize', 'auto schedule', 'overdue', 'assign'],
            blocks: [
                { type: 'text', text: '**Smart Schedule** proposes dates for unscheduled and overdue tasks, for you and your co-assignees. Nothing changes until you confirm.' },
                { type: 'steps', items: [
                    'Click **Smart Schedule**.',
                    'In **Optimized Schedule**, review each proposed change. Tick or untick tasks, or use **Select All** / **Deselect All**.',
                    'Click **Start Schedule** to apply the selected changes, or **Cancel** to discard them.',
                ] },
                { type: 'text', text: 'If everything is already in good shape, you see "No schedule changes needed!".' },
            ],
        },
        {
            id: 'clean-up',
            title: 'Clean up the calendar',
            keywords: ['unschedule', 'clear', 'reset', 'future'],
            blocks: [
                { type: 'text', text: 'Two actions in the **Unscheduled** panel help when your plan is out of date:' },
                { type: 'list', items: [
                    '**Unschedule all future items (tomorrow onwards)** removes the scheduled day from all unfinished tasks from tomorrow on.',
                    '**Clear unassigned tasks from calendar** moves scheduled tasks that have no assignee back to **Unscheduled**.',
                ] },
                { type: 'callout', tone: 'tip', text: 'Unscheduling only removes the scheduled day. Tasks, due dates and assignees stay as they are.' },
            ],
        },
    ],
};

export default article;
