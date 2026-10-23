import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'dashboard',
    category: 'basics',
    icon: 'space_dashboard',
    title: 'Dashboard',
    summary: 'Your plan for today and a pulse of how your projects are doing.',
    keywords: ['home', 'start page', 'today', 'plan', 'focus', 'pulse', 'overview', 'portfolio', 'momentum', 'overdue', 'waiting'],
    sections: [
        {
            id: 'what-is-it',
            title: 'What is the Dashboard?',
            keywords: ['home', 'start page', 'greeting'],
            blocks: [
                { type: 'text', text: 'The [Dashboard](/) is the first page you see. It greets you, shows your current focus and then scrolls through two stages: **Your plan for today** and the workspace pulse.' },
                { type: 'text', text: 'Use **View portfolio pulse** to jump to the pulse and **Back to today** to return.' },
            ],
        },
        {
            id: 'today',
            title: 'How do I use my plan for today?',
            keywords: ['today', 'plan', 'overdue', 'due', 'waiting', 'follow up', 'overnight', 'this week'],
            blocks: [
                { type: 'text', text: '**Your plan for today** lists the tasks that need you: overdue ones, tasks due today and tasks that are waiting on others. If nothing is scheduled, the Dashboard suggests a few tasks from your backlog.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Waiting on you', text: 'Tasks of other people that cannot move until you finish your task.' },
                        { term: 'Overnight', text: 'What changed since you were last here, for example a task that became overdue.' },
                        { term: 'This week', text: 'Dates coming up in the current week.' },
                    ],
                },
                {
                    type: 'steps',
                    items: [
                        'Pick a task from your plan.',
                        'Use **Mark done** to finish it or **For today** to schedule it for today.',
                        'Use **Task** to add a new one.',
                    ],
                },
            ],
        },
        {
            id: 'focus',
            title: 'What is my current focus?',
            keywords: ['focus', 'pinned task', 'resume', 'start focus'],
            blocks: [
                { type: 'text', text: 'Your focus is the task you are working on right now. The Dashboard offers **Start focus** to make a task your current focus and shows it at the top, so you can pick up where you left off.' },
            ],
        },
        {
            id: 'pulse',
            title: 'What does the workspace pulse show?',
            keywords: ['pulse', 'portfolio', 'momentum', 'workload', 'projects', 'health', 'deadline'],
            blocks: [
                { type: 'text', text: 'The pulse gives you a quick read on all projects in the workspace.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'The workspace in numbers', text: 'Active projects, open tasks, overdue tasks and tasks done this week.' },
                        { term: 'Where the work sits', text: 'How open tasks are spread across projects.' },
                        { term: 'Where to look', text: 'Projects that need attention, for example because of overdue or blocked tasks, little activity or a close deadline.' },
                        { term: 'Momentum', text: 'Tasks completed in the last 7 days, compared with the 7 days before.' },
                        { term: 'Next dates', text: 'Due dates and project deadlines in the next 14 days.' },
                        { term: 'Going well', text: 'Positive signals such as the project with the best run this week.' },
                    ],
                },
            ],
        },
    ],
};

export default article;
