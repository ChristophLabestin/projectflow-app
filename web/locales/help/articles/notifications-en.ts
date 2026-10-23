import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'notifications',
    category: 'collaboration',
    icon: 'notifications',
    title: 'Notifications',
    summary: 'Stay on top of assignments, mentions and due dates, and choose what reaches you by push or email.',
    keywords: ['notifications', 'bell', 'unread', 'mentions', 'push', 'email', 'briefing', 'reminders', 'alerts', 'inbox'],
    sections: [
        {
            id: 'bell',
            title: 'Check new notifications',
            keywords: ['bell', 'popover', 'unread', 'sidebar'],
            blocks: [
                { type: 'text', text: 'The bell in the sidebar shows how many notifications are unread. Click it to see the latest ones, filter by **All** or **Unread**, or use **Mark all read**.' },
                { type: 'text', text: 'Click a notification to jump to the task or item it is about. **View all notifications** opens the full [Notifications](/notifications) page.' },
            ],
        },
        {
            id: 'page',
            title: 'Work through the Notifications page',
            keywords: ['mark as read', 'delete', 'clear all', 'other workspaces', 'earlier'],
            blocks: [
                { type: 'text', text: 'The page groups notifications into **Today**, **Yesterday** and **Earlier**. Use the filter to switch between **All** and **Unread**.' },
                { type: 'list', items: [
                    '**Mark as read** / **Mark as unread** on a single notification.',
                    '**Delete notification** removes one entry.',
                    '**Clear all** deletes every notification after you confirm. This cannot be undone.',
                ] },
                { type: 'text', text: 'If you have unread notifications in other workspaces, they appear under **Unread in other workspaces** so you do not miss them.' },
            ],
        },
        {
            id: 'settings',
            title: 'Choose what reaches you',
            keywords: ['settings', 'push', 'email', 'morning briefing', 'day close', 'time zone', 'preferences'],
            blocks: [
                { type: 'text', text: 'Click the bell, then **Notification settings**. This opens the **Notifications** tab of your personal settings.' },
                { type: 'terms', items: [
                    { term: 'Assignments', text: 'Tasks and subtasks that are assigned to you.' },
                    { term: 'Mentions', text: 'Someone mentions you in a comment.' },
                    { term: 'Comments', text: 'New comments on tasks you are involved in.' },
                    { term: 'Due dates', text: 'A summary of what is due today.' },
                    { term: 'Reminders', text: 'Reminders you set, or that include you.' },
                ] },
                { type: 'text', text: 'For each category, switch **Push** and **Email** on or off. Under **Daily rhythm** you can turn on a **Morning briefing** and a **Day close** nudge, set the time and choose your **Time zone**.' },
                { type: 'callout', tone: 'note', text: 'The notification list in ProjectFlow always keeps everything. The switches only control push and email.' },
            ],
        },
        {
            id: 'web-push',
            title: 'Fix push notifications in the browser',
            keywords: ['web push', 'browser', 'permission', 'test', 'delivery', 'not working', 'diagnostics'],
            blocks: [
                { type: 'text', text: 'The Notifications page has a **Notification delivery health** card that checks whether this browser can receive push.' },
                { type: 'steps', items: [
                    'Click **Enable web push** and allow notifications when your browser asks.',
                    'Click **Send test** to queue a test notification.',
                    'If something shows **Needs setup** or **Denied**, check your browser\'s site permissions, then click **Refresh**.',
                ] },
                { type: 'text', text: '**Recent delivery attempts** lists what was sent by push or email and whether it was sent, failed or skipped.' },
            ],
        },
    ],
};

export default article;
