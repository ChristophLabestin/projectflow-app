import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'initiatives',
    category: 'work',
    icon: 'rocket_launch',
    title: 'Initiatives',
    summary: 'Group related tasks under one outcome and track progress and risk together.',
    keywords: ['initiative', 'outcome', 'epic', 'goal', 'feedback form', 'focus', 'health'],
    sections: [
        {
            id: 'what-is',
            title: 'What is an initiative?',
            keywords: ['epic', 'outcome'],
            blocks: [
                { type: 'text', text: 'An initiative groups related tasks under a shared outcome, so you can track progress and risk together. Open **Initiatives** in the project navigation to see them.' },
                { type: 'text', text: 'The list shows how many initiatives are active, at risk or blocked. Use the search, the status filter and the grid or list view to find what you need.' },
            ],
        },
        {
            id: 'create',
            title: 'Create an initiative',
            keywords: ['new initiative', 'add'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Open the project and go to **Initiatives**.',
                        'Click **Create initiative**.',
                        'Enter a **Title** and, if you like, a **Description**, **Status**, **Priority**, **Start date** and **Due date**.',
                        'Add a **Success metric** or **Outcome** to describe what done looks like.',
                        'Confirm to create it.',
                    ],
                },
            ],
        },
        {
            id: 'work',
            title: 'Add and manage work',
            keywords: ['tasks', 'attach', 'detach', 'focus'],
            blocks: [
                { type: 'text', text: 'On the initiative page, the **Work** section lists its tasks. Use **Create task** for a new one or **Attach task** to link an existing task.' },
                { type: 'text', text: 'Click **Detach** to remove a task from the initiative. The task stays in the project. Use **Set as focus** to mark the task that matters most right now as **Current focus**.' },
            ],
        },
        {
            id: 'status-health',
            title: 'Status and health',
            keywords: ['at risk', 'off track', 'on track'],
            blocks: [
                { type: 'text', text: 'Each initiative has a status:' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Planning', text: 'Not started yet, still being shaped.' },
                        { term: 'Open', text: 'Ready to be worked on.' },
                        { term: 'In Progress', text: 'Work is underway.' },
                        { term: 'Review', text: 'Waiting for a check.' },
                        { term: 'On Hold', text: 'Paused for now.' },
                        { term: 'Blocked', text: 'Something is in the way.' },
                        { term: 'Done', text: 'The outcome is reached.' },
                    ],
                },
                { type: 'text', text: 'A health indicator shows **On Track**, **At Risk** or **Off Track**. Milestones can be linked to an initiative, see the Milestones article.' },
            ],
        },
        {
            id: 'feedback-form',
            title: 'Collect feedback with a public form',
            keywords: ['intake form', 'customer feedback', 'public link', 'form'],
            blocks: [
                { type: 'text', text: 'An initiative can have an **Intake form**. People without an account can open its hosted link and submit feedback, optionally with screenshots. Each submission becomes a task in the initiative.' },
                { type: 'text', text: 'Use **Edit** on the intake form to set the title, the fields and whether images are allowed. The form shows **Live** when it is on and **Off** when it is not. Copy the **Hosted form link** to share it.' },
                { type: 'callout', tone: 'tip', text: 'If a link leaks, use **Regenerate token** to create a new one.' },
            ],
        },
    ],
};

export default article;
