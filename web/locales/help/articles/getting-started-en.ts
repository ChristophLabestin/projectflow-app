import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'getting-started',
    category: 'basics',
    icon: 'explore',
    title: 'Getting started',
    summary: 'Find your way around ProjectFlow and set up your first project in a few minutes.',
    keywords: ['start', 'onboarding', 'first steps', 'quick start', 'introduction', 'basics', 'overview', 'navigation', 'sidebar', 'workspace'],
    sections: [
        {
            id: 'layout',
            title: 'How is the app laid out?',
            keywords: ['sidebar', 'top bar', 'navigation', 'menu', 'layout'],
            blocks: [
                { type: 'text', text: 'The **sidebar** on the left is your main navigation. It leads to **Dashboard**, **My Tasks**, **Calendar** and **Projects**. Depending on your access, **Finance** and **Media** appear there too, sometimes behind **More**.' },
                { type: 'text', text: 'Open a project and the sidebar adds that project\'s areas, for example **Overview**, **Initiatives** and **Tasks**. The top bar holds search, **Pinned Tasks**, notifications, the team menu and the **Help Center**.' },
            ],
        },
        {
            id: 'concepts',
            title: 'What are workspaces, projects and tasks?',
            keywords: ['concepts', 'glossary', 'terms', 'workspace', 'project', 'task', 'initiative', 'milestone'],
            blocks: [
                {
                    type: 'terms',
                    items: [
                        { term: 'Workspace', text: 'Your team\'s home. It holds all projects, members and settings. You can belong to several workspaces and switch between them in the sidebar.' },
                        { term: 'Project', text: 'A body of work with a goal, a status and a team.' },
                        { term: 'Task', text: 'A single piece of work with a status, priority, due date and assignees.' },
                        { term: 'Initiative', text: 'A bigger effort inside a project that groups related tasks.' },
                        { term: 'Milestone', text: 'An important date or checkpoint in a project.' },
                    ],
                },
            ],
        },
        {
            id: 'first-steps',
            title: 'What should I do first?',
            keywords: ['first project', 'create project', 'add tasks', 'invite', 'team'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Open **Projects** and create your first project, or press ⌘/Ctrl + K and choose **Create project**.',
                        'Add a few tasks. On **My Tasks**, type a title in the quick add field and press Enter.',
                        'Invite your team from the team menu in the top bar with **Invite**.',
                        'Open the [Dashboard](/) to see your plan for today.',
                    ],
                },
                { type: 'callout', tone: 'tip', text: 'You do not need to set everything up at once. A project with a few tasks is enough to start.' },
            ],
        },
        {
            id: 'find-things',
            title: 'How do I find things quickly?',
            keywords: ['search', 'shortcuts', 'command palette', 'jump'],
            blocks: [
                { type: 'text', text: 'Press ⌘/Ctrl + K or `/` to open search. It finds projects, tasks, pages and actions, and it also searches the Help Center.' },
                { type: 'text', text: 'Press `?` anywhere (outside a text field) to open this Help Center. See "Search and shortcuts" for all keys.' },
            ],
        },
        {
            id: 'workspaces',
            title: 'How do I switch workspaces?',
            keywords: ['multiple workspaces', 'switch', 'invitation', 'invite link'],
            blocks: [
                { type: 'text', text: 'Use the workspace switcher in the sidebar to change between your workspaces. If someone invites you, open the invitation link and accept it to join their workspace.' },
            ],
        },
    ],
};

export default article;
