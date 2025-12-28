import type { HelpCenterTarget } from '../../context/HelpCenterContext';

export interface HelpCenterSection {
    id: string;
    title: string;
    summary?: string;
    bullets?: string[];
    steps?: string[];
    keywords?: string[];
}

export interface HelpCenterPage {
    id: string;
    title: string;
    description: string;
    category: string;
    sections: HelpCenterSection[];
    keywords?: string[];
}

// Add or extend pages here to keep help content modular and easy to grow.
export const helpCenterPages: HelpCenterPage[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        description: 'Core navigation and global actions for daily work.',
        category: 'Basics',
        keywords: ['navigation', 'search', 'shortcuts', 'overview'],
        sections: [
            {
                id: 'navigation',
                title: 'Navigation Basics',
                summary: 'Move through workspaces and modules with clear context.',
                bullets: [
                    'Use the sidebar to access workspace modules and shortcuts.',
                    'Breadcrumbs show where you are and let you move back quickly.',
                    'Pinned project keeps your focus anchored across pages.'
                ],
                keywords: ['sidebar', 'breadcrumbs', 'project']
            },
            {
                id: 'quick-actions',
                title: 'Quick Actions',
                summary: 'Create tasks, ideas, and issues without leaving your flow.',
                bullets: [
                    'Open global create modals from anywhere in the app.',
                    'Use keyboard shortcuts: Alt+T for tasks, Alt+I for ideas, Alt+B for issues.',
                    'Pin items to keep the most important work close.'
                ],
                keywords: ['create', 'modal', 'pin']
            },
            {
                id: 'search-and-help',
                title: 'Search and Help',
                summary: 'Find content fast and jump to the right guide.',
                bullets: [
                    'Use the top search bar to locate tasks, ideas, and content.',
                    'Use the help search to jump directly to a section.',
                    'Open help on any page to match the current workflow.'
                ],
                keywords: ['search', 'help']
            }
        ]
    },
    {
        id: 'projects',
        title: 'Projects',
        description: 'Create a focused workspace with modules, milestones, and health signals.',
        category: 'Workflows',
        keywords: ['projects', 'modules', 'milestones', 'overview', 'health'],
        sections: [
            {
                id: 'project-lifecycle',
                title: 'Project Lifecycle',
                summary: 'Set up a project once, then iterate continuously.',
                steps: [
                    'Create the project and add a clear title and description.',
                    'Set status, priority, start date, and due date in Project Details.',
                    'Enable the modules your team actually uses.',
                    'Add milestones and assign owners to key work.',
                    'Review health and workload each week.'
                ],
                bullets: [
                    'Use short titles that describe outcomes, not tasks.',
                    'Statuses reflect the current state, not just progress.',
                    'Projects stay healthy when milestones and tasks align.'
                ],
                keywords: ['setup', 'status', 'priority']
            },
            {
                id: 'project-overview',
                title: 'Project Overview',
                summary: 'The overview page is your live project dashboard.',
                bullets: [
                    'Snapshot cards surface health, workload, activity, and upcoming work.',
                    'Health and activity point to risks and team momentum.',
                    'Use the overview to decide what to fix first.'
                ],
                keywords: ['overview', 'snapshot', 'dashboard']
            },
            {
                id: 'project-health',
                title: 'Project Health',
                summary: 'Health is calculated from tasks, milestones, issues, and activity.',
                bullets: [
                    'Healthy projects have moving tasks and clear milestones.',
                    'Risks appear when deadlines slip or blockers stack.',
                    'Use the health detail view to see the strongest signals.'
                ],
                keywords: ['health', 'risk', 'signals']
            },
            {
                id: 'workload-deadlines',
                title: 'Workload and Deadlines',
                summary: 'Balance capacity with the next commitments.',
                bullets: [
                    'Track open tasks and urgent work from the overview.',
                    'Upcoming deadlines highlight tasks with the nearest due dates.',
                    'Use priority to control what gets done first.'
                ],
                keywords: ['workload', 'deadlines', 'priority']
            },
            {
                id: 'modules',
                title: 'Modules and Navigation',
                summary: 'Each project shows only the modules you enable.',
                bullets: [
                    'Modules include Tasks, Flows (Ideas), Issues, Mindmap, Milestones, Social, Marketing, and Activity.',
                    'Module counts help spot demand spikes at a glance.',
                    'Navigation stays scoped to the current project.'
                ],
                keywords: ['tasks', 'flows', 'issues', 'mindmap', 'social', 'marketing', 'activity']
            },
            {
                id: 'navigation-preferences',
                title: 'Navigation Preferences',
                summary: 'Tune the project nav to match how your team works.',
                bullets: [
                    'Hide modules your team does not use.',
                    'Keep high-frequency modules at the top of the list.',
                    'Preferences apply per project for each user.'
                ],
                keywords: ['navigation', 'preferences', 'modules']
            },
            {
                id: 'milestones',
                title: 'Milestones and Outcomes',
                summary: 'Milestones turn work into clear checkpoints.',
                bullets: [
                    'Set milestone names that describe the outcome.',
                    'Use statuses to show if a milestone is on track.',
                    'Review pending milestones during weekly planning.'
                ],
                keywords: ['milestones', 'outcomes', 'planning']
            },
            {
                id: 'activity',
                title: 'Project Activity',
                summary: 'Activity shows what changed and who did it.',
                bullets: [
                    'Track comments, status changes, and key updates.',
                    'Use activity history to review progress at reviews.',
                    'High activity with low health usually means blockers.'
                ],
                keywords: ['activity', 'history', 'comments']
            },
            {
                id: 'details-metadata',
                title: 'Project Details',
                summary: 'The Details tab is the source of truth for metadata.',
                bullets: [
                    'Maintain title, description, status, and priority.',
                    'Record start and due dates for timeline clarity.',
                    'Keep metadata current to reduce confusion.'
                ],
                keywords: ['details', 'metadata', 'dates']
            },
            {
                id: 'resources-links',
                title: 'Resources and Links',
                summary: 'External resources keep essential links visible.',
                bullets: [
                    'Add design docs, shared folders, or reference links.',
                    'Resources appear in the project sidebar.',
                    'Use consistent naming so teammates find links fast.'
                ],
                keywords: ['resources', 'links', 'sidebar']
            }
        ]
    },
    {
        id: 'tasks-issues',
        title: 'Tasks and Issues',
        description: 'Track execution, blockers, and deliverables.',
        category: 'Workflows',
        keywords: ['tasks', 'issues', 'status', 'priority'],
        sections: [
            {
                id: 'task-flow',
                title: 'Task Flow',
                summary: 'Tasks represent work items from backlog to done.',
                bullets: [
                    'Create tasks from project or personal views.',
                    'Use status and priority to triage effort.',
                    'Assign owners or groups for accountability.'
                ],
                keywords: ['tasks', 'status', 'priority', 'assignee']
            },
            {
                id: 'issue-tracking',
                title: 'Issue Tracking',
                summary: 'Issues capture bugs, risks, and blockers.',
                bullets: [
                    'Track resolution status and ownership.',
                    'Link issues to related tasks or ideas.',
                    'Close or resolve when validated.'
                ],
                keywords: ['issues', 'bugs', 'blocking']
            },
            {
                id: 'pinned-work',
                title: 'Pinned Work',
                summary: 'Keep active items in view across pages.',
                bullets: [
                    'Pin tasks or issues to the global panel.',
                    'Use focus mode to keep one item front and center.',
                    'Jump back to pinned work from any screen.'
                ],
                keywords: ['pinned', 'focus', 'panel']
            }
        ]
    },
    {
        id: 'ideas-ai',
        title: 'Ideas and AI Studio',
        description: 'Develop concepts into plans and outputs.',
        category: 'Workflows',
        keywords: ['ideas', 'ai', 'brainstorm', 'analysis'],
        sections: [
            {
                id: 'idea-stages',
                title: 'Idea Stages',
                summary: 'Move from concept to action with clear stages.',
                bullets: [
                    'Capture concepts, research, and positioning.',
                    'Use AI Studio to expand briefs and assets.',
                    'Store insights in structured sections.'
                ],
                keywords: ['stages', 'concept', 'brief']
            },
            {
                id: 'conversions',
                title: 'Convert Ideas',
                summary: 'Turn approved ideas into execution.',
                bullets: [
                    'Convert ideas into tasks for project delivery.',
                    'Send social ideas into campaign planning.',
                    'Track origin links for traceability.'
                ],
                keywords: ['convert', 'campaign', 'tasks']
            },
            {
                id: 'risk-analysis',
                title: 'Risk and Win Analysis',
                summary: 'Use AI analysis to judge feasibility and impact.',
                bullets: [
                    'Generate risk and win signals during review.',
                    'Use scores to guide prioritization.',
                    'Iterate before approval to improve outcomes.'
                ],
                keywords: ['risk', 'win', 'analysis']
            }
        ]
    },
    {
        id: 'social-studio',
        title: 'Social Studio',
        description: 'Plan campaigns, create content, and review approvals.',
        category: 'Social Studio',
        keywords: ['social', 'campaigns', 'posts', 'calendar'],
        sections: [
            {
                id: 'campaigns',
                title: 'Campaign Planning',
                summary: 'Campaigns organize strategy, phases, and content.',
                bullets: [
                    'Define big idea, hook, and visual direction.',
                    'Plan phases with durations and KPIs.',
                    'Align channels and audience segments.'
                ],
                keywords: ['phases', 'kpis', 'audience']
            },
            {
                id: 'campaign-review',
                title: 'Campaign Review',
                summary: 'Review pages help approve or request changes.',
                bullets: [
                    'Check strategic intent, channels, and timeline.',
                    'Refresh AI analysis for risk and win insights.',
                    'Approve to create a live campaign or request changes.'
                ],
                keywords: ['review', 'approval', 'changes']
            },
            {
                id: 'posts',
                title: 'Posts and Scheduling',
                summary: 'Draft posts and manage cadence across channels.',
                bullets: [
                    'Create posts inside campaigns or from the social hub.',
                    'Use the calendar to plan weekly output.',
                    'Keep format and platform details consistent.'
                ],
                keywords: ['posts', 'calendar', 'schedule']
            },
            {
                id: 'assets',
                title: 'Assets',
                summary: 'Store media and reuse creative across campaigns.',
                bullets: [
                    'Upload and organize assets by project.',
                    'Reuse assets when drafting posts.',
                    'Keep creative sources centralized.'
                ],
                keywords: ['media', 'library', 'creative']
            }
        ]
    },
    {
        id: 'marketing',
        title: 'Marketing',
        description: 'Build emails, ads, and campaign plans.',
        category: 'Marketing',
        keywords: ['email', 'ads', 'recipients'],
        sections: [
            {
                id: 'email-builder',
                title: 'Email Builder',
                summary: 'Compose email campaigns with reusable blocks.',
                bullets: [
                    'Create drafts and edit layouts in the builder.',
                    'Manage blocks, variables, and previews.',
                    'Store templates for faster launches.'
                ],
                keywords: ['email', 'builder', 'templates']
            },
            {
                id: 'recipients',
                title: 'Recipients',
                summary: 'Organize audiences and segments.',
                bullets: [
                    'Import lists for campaigns.',
                    'Maintain data quality with updates.',
                    'Segment recipients for targeting.'
                ],
                keywords: ['audience', 'segments', 'lists']
            },
            {
                id: 'paid-ads',
                title: 'Paid Ads',
                summary: 'Track ad initiatives and outcomes.',
                bullets: [
                    'Monitor ad status and goals.',
                    'Track spend, performance, and notes.',
                    'Review results in campaign summaries.'
                ],
                keywords: ['ads', 'spend', 'performance']
            }
        ]
    },
    {
        id: 'account-settings',
        title: 'Team and Settings',
        description: 'Manage access, profiles, and workspace setup.',
        category: 'Account',
        keywords: ['team', 'roles', 'settings'],
        sections: [
            {
                id: 'team-roles',
                title: 'Team Roles',
                summary: 'Control access for workspace and projects.',
                bullets: [
                    'Owners and admins manage settings and billing.',
                    'Members and guests collaborate with scoped access.',
                    'Use groups to organize teams.'
                ],
                keywords: ['roles', 'permissions', 'groups']
            },
            {
                id: 'profile',
                title: 'Profile Settings',
                summary: 'Update your personal details and visibility.',
                bullets: [
                    'Set avatar, bio, and skill visibility.',
                    'Update notification preferences.',
                    'Review account info from the profile page.'
                ],
                keywords: ['profile', 'notifications']
            },
            {
                id: 'workspace-settings',
                title: 'Workspace Settings',
                summary: 'Configure branding, integrations, and policies.',
                bullets: [
                    'Manage integrations like GitHub.',
                    'Adjust privacy and security controls.',
                    'Review workspace details and preferences.'
                ],
                keywords: ['workspace', 'integrations', 'security']
            }
        ]
    }
];

export const getHelpTargetForPath = (pathname: string): HelpCenterTarget => {
    const path = pathname.toLowerCase();

    if (path.includes('/social/review/')) {
        return { pageId: 'social-studio', sectionId: 'campaign-review' };
    }
    if (path.includes('/social')) {
        return { pageId: 'social-studio' };
    }
    if (path.includes('/marketing')) {
        return { pageId: 'marketing' };
    }
    if (path.includes('/ideas') || path.includes('/brainstorm')) {
        return { pageId: 'ideas-ai' };
    }
    if (path.includes('/tasks') || path.includes('/issues')) {
        return { pageId: 'tasks-issues' };
    }
    if (path.includes('/team') || path.includes('/settings') || path.includes('/profile')) {
        return { pageId: 'account-settings' };
    }
    if (path.includes('/project/') || path.includes('/projects')) {
        return { pageId: 'projects' };
    }

    return { pageId: 'getting-started' };
};
