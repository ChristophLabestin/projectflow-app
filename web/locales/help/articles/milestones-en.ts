import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'milestones',
    category: 'planning',
    icon: 'flag',
    title: 'Milestones',
    summary: 'Mark key deadlines and delivery moments on your project roadmap.',
    keywords: ['milestone', 'roadmap', 'deadline', 'delivery', 'due date', 'achieved', 'timeline'],
    sections: [
        {
            id: 'what-is',
            title: 'What is a milestone?',
            keywords: ['roadmap', 'deadline'],
            blocks: [
                { type: 'text', text: 'A milestone marks a deadline, a gate or a delivery moment in a project, for example an MVP release. Open **Milestones** in the project navigation to see the roadmap.' },
                { type: 'text', text: 'The page shows a timeline with the next milestone first, your progress, and how many milestones you have achieved. The Milestones module must be switched on for the project.' },
            ],
        },
        {
            id: 'create',
            title: 'Create a milestone',
            keywords: ['new milestone', 'add'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Open **Milestones** in the project.',
                        'Click **New milestone**.',
                        'Enter a **Title** and pick a **Due date**. A **Description** is optional.',
                        'Optionally use **Link initiative** and **Link tasks**.',
                        'Click **Create milestone**.',
                    ],
                },
                { type: 'callout', tone: 'tip', text: 'Linked tasks without a due date inherit the date of the milestone.' },
            ],
        },
        {
            id: 'status',
            title: 'Track and complete a milestone',
            keywords: ['achieve', 'missed', 'pending', 'mark incomplete'],
            blocks: [
                { type: 'text', text: 'A milestone is **Pending**, **Achieved** or **Missed**. Open one to see its due date, the linked initiative and the linked tasks with their subtask counts.' },
                { type: 'text', text: 'When the work is done, choose **Achieve milestone**. Changed your mind? Use **Mark incomplete** to set it back to open. Milestones can also carry a risk label from **Low risk** to **High risk**.' },
            ],
        },
        {
            id: 'edit-delete',
            title: 'Edit or delete a milestone',
            keywords: ['remove', 'change date'],
            blocks: [
                { type: 'text', text: 'Choose **Edit milestone** to change the title, date, links or status. **Delete milestone** removes it after a confirmation.' },
                { type: 'text', text: 'Upcoming milestones also appear on project cards in [Projects](/projects) as the next milestone.' },
            ],
        },
    ],
};

export default article;
