import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'tasks',
    category: 'work',
    icon: 'task_alt',
    title: 'Tasks',
    summary: 'Create, organize and finish tasks, on your own list and inside projects.',
    keywords: ['task', 'todo', 'my tasks', 'quick add', 'status', 'priority', 'due date', 'assignee', 'subtasks', 'board', 'list', 'bulk', 'group', 'filter', 'reminder', 'blocked'],
    sections: [
        {
            id: 'where',
            title: 'Where do I find my tasks?',
            keywords: ['my tasks', 'project tasks', 'overview', 'list'],
            blocks: [
                { type: 'text', text: '[My Tasks](/tasks) shows all tasks assigned to you across projects, grouped by due date: **Overdue**, **Today**, **Next 7 days**, **Later** and **No date**. A short summary at the top tells you how many are overdue, due today or due this week.' },
                { type: 'text', text: 'Inside a project, open **Tasks** in the sidebar to see that project\'s tasks.' },
            ],
        },
        {
            id: 'create',
            title: 'How do I create a task?',
            keywords: ['new task', 'add task', 'quick add', 'detailed task'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'On **My Tasks**, click the quick add field ("Add a task and press Enter…").',
                        'Type a title and press Enter.',
                        'For more fields, use **Detailed task** instead.',
                    ],
                },
                { type: 'text', text: 'You can also press ⌘/Ctrl + K and choose **Create task**. Press `N` to jump to the quick add field.' },
            ],
        },
        {
            id: 'update',
            title: 'How do I change a task?',
            keywords: ['status', 'priority', 'due date', 'assignee', 'complete', 'done', 'edit'],
            blocks: [
                { type: 'text', text: 'In a list row you can mark a task done, or change its **Status**, **Priority**, **Due date** and **Assignees** directly. Click the task to open its detail page for everything else.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Status', text: 'Backlog, Todo, Open, In progress, Review, On hold, Blocked or Done.' },
                        { term: 'Priority', text: 'Low, Medium, High or Urgent.' },
                    ],
                },
                { type: 'text', text: 'On the detail page you can add **Subtasks**, comment in the **Discussion**, set a **Reminder** and use **Mark blocked** to note what is blocking the task.' },
            ],
        },
        {
            id: 'views',
            title: 'How do I filter, group and switch views?',
            keywords: ['filter', 'search', 'group by', 'board', 'list', 'cards', 'completed', 'view'],
            blocks: [
                { type: 'text', text: 'Use **Search tasks**, **All projects** and **Any priority** to filter. Turn on **Completed** to include finished tasks.' },
                { type: 'text', text: 'Switch **View** between **List** and **Board** on My Tasks. In a project, you can switch between **List** and **Cards** and use **Group by** to group by **Due date**, **Status** or **Assignee**.' },
            ],
        },
        {
            id: 'bulk',
            title: 'How do I change many tasks at once?',
            keywords: ['bulk', 'multi select', 'select', 'delete', 'move to initiative'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Focus a task row and press `X`, or use the **Select** button, to select it. Press ⇧ X to select a range.',
                        'Use the bar that appears: **Set status**, **Set priority**, **Set due date**, **Assign to**, **Move to initiative** or **Delete**.',
                        'Press Esc or **Clear selection** when you are done.',
                    ],
                },
                { type: 'callout', tone: 'warning', text: 'Delete removes the selected tasks. Check your selection before you confirm.' },
            ],
        },
    ],
};

export default article;
