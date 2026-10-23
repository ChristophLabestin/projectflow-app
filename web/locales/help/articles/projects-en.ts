import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'projects',
    category: 'work',
    icon: 'folder',
    title: 'Projects',
    summary: 'Create projects, pick the modules you need and run client work with effort and invoices.',
    keywords: ['project', 'create project', 'template', 'modules', 'status', 'import', 'client', 'portfolio'],
    sections: [
        {
            id: 'overview',
            title: 'What is a project?',
            keywords: ['portfolio', 'list'],
            blocks: [
                { type: 'text', text: 'A project holds the tasks, milestones and team for one piece of work. Open [Projects](/projects) to see all of them, grouped by what needs attention first.' },
                { type: 'text', text: 'Each card shows open and overdue work and the next milestone. Use **Search projects** to find one quickly.' },
            ],
        },
        {
            id: 'create-project',
            title: 'Create a project',
            keywords: ['new project', 'wizard', 'template'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Open [Projects](/projects) and click **Create Project**.',
                        'On **Type**, choose a template, for example **General Project**, **Software Release** or **Client Delivery**.',
                        'Fill in the following steps. A name is all you need to start.',
                        'On **Modules**, switch on the tools this project needs.',
                        'Click **Create Project**.',
                    ],
                },
                { type: 'text', text: 'Want to start from existing data? Use **Import** and upload a JSON file to create several projects at once. Saved setups live under **Templates**.' },
            ],
        },
        {
            id: 'modules',
            title: 'Modules and project navigation',
            keywords: ['sprints', 'marketing', 'accounting', 'activity'],
            blocks: [
                { type: 'text', text: 'Modules decide which pages appear in the project navigation. Available modules are:' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Tasks', text: 'Day-to-day work items.' },
                        { term: 'Initiatives', text: 'Larger outcomes that group tasks.' },
                        { term: 'Milestones', text: 'Deadlines and delivery moments.' },
                        { term: 'Sprints', text: 'Short planning cycles.' },
                        { term: 'Marketing', text: 'Project blog and posts.' },
                        { term: 'Accounting', text: 'Planning, expenses and accounting work.' },
                        { term: 'Activity', text: 'A readable log of what happened.' },
                    ],
                },
                { type: 'callout', tone: 'note', text: 'Some modules, such as Sprints, can show **Not available in your plan**. They only work when your workspace has access.' },
            ],
        },
        {
            id: 'status',
            title: 'Project status',
            keywords: ['health', 'on hold', 'completed'],
            blocks: [
                { type: 'text', text: 'A project is **Active**, **In testing**, **In review**, **Planning**, **Brainstorming**, **Backlog**, **On hold**, **Completed** or **Canceled**. The list groups projects by this status, with projects that need attention on top.' },
                { type: 'text', text: 'The project overview also shows a health rating, from **Excellent** down to **Critical**. It takes the status into account and lowers the rating for things like overdue or blocked work.' },
            ],
        },
        {
            id: 'client-projects',
            title: 'Client projects: effort and invoices',
            keywords: ['effort', 'invoice', 'client', 'billing', 'Aufwand', 'Rechnung', 'customer'],
            blocks: [
                { type: 'text', text: 'Projects created from the **Client Delivery** template are client projects. They appear under **Client projects** and get two extra pages in the project navigation: **Effort** and **Invoices**.' },
                {
                    type: 'steps',
                    items: [
                        'Open **Effort** and click **Row** to log the date, task, duration and an optional note. You can also use **Import markdown**.',
                        'Open **Invoices** and click **New invoice**.',
                        'In the invoice, use **Import effort** to turn logged effort into line items.',
                        'Download the finished invoice with **PDF**.',
                    ],
                },
                { type: 'callout', tone: 'warning', text: 'A finalized invoice is locked and can no longer be changed or deleted. Corrections need a cancellation or correction invoice. Effort included in a finalized invoice is locked too.' },
            ],
        },
    ],
};

export default article;
