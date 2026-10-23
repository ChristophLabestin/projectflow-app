import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'sprints',
    category: 'planning',
    icon: 'directions_run',
    title: 'Sprints',
    summary: 'Plan time-boxed cycles, pull tasks from the backlog and close them out cleanly.',
    keywords: ['sprint', 'planning', 'backlog', 'iteration', 'scrum', 'time box', 'goal', 'velocity'],
    sections: [
        {
            id: 'what-is',
            title: 'What is a sprint?',
            keywords: ['iteration', 'time box'],
            blocks: [
                { type: 'text', text: 'A sprint is a short, time-boxed cycle with a goal. You pick the tasks you want to finish in it and work through them. Open **Sprints** in the project navigation.' },
                { type: 'text', text: 'The page has three views: **Current sprint**, **Planning** and **History**. Only one sprint can run at a time.' },
                { type: 'callout', tone: 'note', text: 'Sprints are a project module. If you do not see **Sprints**, the module is switched off or not part of your plan.' },
            ],
        },
        {
            id: 'plan',
            title: 'Plan a sprint',
            keywords: ['create sprint', 'new sprint', 'backlog', 'drag'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Open **Sprints** and click **New sprint** (or **Plan a sprint**).',
                        'Enter a **Name**, a **Goal**, and the **Start** and **End** dates.',
                        'Click **Create sprint**.',
                        'Go to **Planning**. The **Backlog** lists open tasks without a sprint.',
                        'Drag tasks into the sprint, or use **Move to…** on a task.',
                    ],
                },
                { type: 'text', text: 'Use **Back to backlog** to take a task out of a sprint again.' },
            ],
        },
        {
            id: 'run',
            title: 'Run the current sprint',
            keywords: ['start sprint', 'progress', 'board', 'pace'],
            blocks: [
                { type: 'text', text: 'Click **Start** on a planned sprint. If another sprint is still running, complete it first.' },
                { type: 'text', text: '**Current sprint** shows the goal, the days left, **Work done** and **Time used**, and whether you are **On track** or **Behind plan**. The tasks are grouped into **To do**, **In progress**, **Review** and **Done**.' },
            ],
        },
        {
            id: 'complete',
            title: 'Complete a sprint',
            keywords: ['finish', 'close', 'unfinished tasks', 'history'],
            blocks: [
                { type: 'steps', items: [
                    'Open **Current sprint** and choose **Complete sprint**.',
                    'If tasks are not done, pick where they go: into the next sprint or **Back to the backlog**.',
                    'Confirm. The sprint moves to **History**, which shows how many tasks were done.',
                ] },
            ],
        },
        {
            id: 'manage',
            title: 'Edit, team and delete',
            keywords: ['sprint team', 'members', 'remove'],
            blocks: [
                { type: 'text', text: 'Open **Sprint actions** to **Edit sprint**, manage the **Sprint team** or **Delete sprint**. Members can request to join and requests can be approved with **Approve request** or declined with **Reject request**.' },
                { type: 'callout', tone: 'tip', text: 'Deleting a sprint keeps its tasks in the project. They go back to the backlog.' },
            ],
        },
    ],
};

export default article;
