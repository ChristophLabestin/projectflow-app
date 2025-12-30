import type { HelpCenterTarget } from '../../context/HelpCenterContext';
import type { HelpCenterPageDefinition } from './helpCenterTypes';
import { GettingStartedPage, gettingStartedSections } from './pages/GettingStartedPage';
import { ProjectsPage, projectsSections } from './pages/ProjectsPage';
import { TasksIssuesPage, tasksIssuesSections } from './pages/TasksIssuesPage';
import { FlowsPage, flowsSections } from './pages/FlowsPage';
import { AIFeaturesPage, aiFeaturesSections } from './pages/AIFeaturesPage';
import { MediaLibraryPage, mediaLibrarySections } from './pages/MediaLibraryPage';
import { SocialStudioPage, socialStudioSections } from './pages/SocialStudioPage';
import { MarketingPage, marketingSections } from './pages/MarketingPage';
import { AccountSettingsPage, accountSettingsSections } from './pages/AccountSettingsPage';

export const helpCenterPages: HelpCenterPageDefinition[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        description: 'Learn the workspace model, navigation, and first steps.',
        category: 'Basics',
        keywords: ['navigation', 'workspace', 'shortcuts', 'overview'],
        sections: gettingStartedSections,
        component: GettingStartedPage
    },
    {
        id: 'projects',
        title: 'Projects',
        description: 'Plan, organize, and track delivery with project dashboards.',
        category: 'Workflows',
        keywords: ['projects', 'modules', 'milestones', 'overview'],
        sections: projectsSections,
        component: ProjectsPage
    },
    {
        id: 'tasks-issues',
        title: 'Tasks and Issues',
        description: 'Track execution, risks, and ownership across the team.',
        category: 'Workflows',
        keywords: ['tasks', 'issues', 'status', 'priority'],
        sections: tasksIssuesSections,
        component: TasksIssuesPage
    },
    {
        id: 'ideas-ai',
        title: 'Flows and CORA Studio',
        description: 'Develop flows into structured, execution-ready plans.',
        category: 'Workflows',
        keywords: ['flows', 'cora', 'ai', 'briefs', 'pipeline'],
        sections: flowsSections,
        component: FlowsPage
    },
    {
        id: 'ai-features',
        title: 'CORA Features',
        description: 'Discover CORA search, drafting, analysis, and media tools.',
        category: 'CORA Studio',
        keywords: ['cora', 'ai', 'studio', 'usage', 'limits'],
        sections: aiFeaturesSections,
        component: AIFeaturesPage
    },
    {
        id: 'media-library',
        title: 'Media Library',
        description: 'Upload, generate, and manage creative assets.',
        category: 'Assets',
        keywords: ['media', 'library', 'assets', 'uploads'],
        sections: mediaLibrarySections,
        component: MediaLibraryPage
    },
    {
        id: 'social-studio',
        title: 'Social Studio',
        description: 'Plan campaigns, create posts, and manage approvals.',
        category: 'Social Studio',
        keywords: ['social', 'campaigns', 'posts', 'calendar'],
        sections: socialStudioSections,
        component: SocialStudioPage
    },
    {
        id: 'marketing',
        title: 'Marketing',
        description: 'Build email, ad, and audience workflows.',
        category: 'Marketing',
        keywords: ['email', 'ads', 'recipients', 'campaigns'],
        sections: marketingSections,
        component: MarketingPage
    },
    {
        id: 'account-settings',
        title: 'Team and Settings',
        description: 'Manage access, profiles, and workspace configuration.',
        category: 'Account',
        keywords: ['team', 'roles', 'settings', 'profile'],
        sections: accountSettingsSections,
        component: AccountSettingsPage
    }
];

export const getHelpTargetForPath = (pathname: string): HelpCenterTarget => {
    const path = pathname.toLowerCase();

    if (path.includes('/social/review/')) {
        return { pageId: 'social-studio', sectionId: 'review-approval' };
    }
    if (path.includes('/social')) {
        return { pageId: 'social-studio' };
    }
    if (path.includes('/marketing')) {
        return { pageId: 'marketing' };
    }
    if (path.includes('/media')) {
        return { pageId: 'media-library' };
    }
    if (path.includes('/brainstorm')) {
        return { pageId: 'ai-features' };
    }
    if (path.includes('/flows') || path.includes('/ideas')) {
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
