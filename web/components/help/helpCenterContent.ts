import type { HelpCenterTarget } from '../../context/HelpCenterContext';
import type { HelpCenterPageDefinition, HelpT } from './helpCenterTypes';
import { GettingStartedPage, getGettingStartedSections } from './pages/GettingStartedPage';
import { ProjectsPage, getProjectsSections } from './pages/ProjectsPage';
import { SprintsPage, getSprintsSections } from './pages/SprintsPage';
import { AIFeaturesPage, getAiFeaturesSections } from './pages/AIFeaturesPage';
import { MediaLibraryPage, getMediaLibrarySections } from './pages/MediaLibraryPage';
import { MarketingPage, getMarketingSections } from './pages/MarketingPage';
import { AccountSettingsPage, getAccountSettingsSections } from './pages/AccountSettingsPage';

export const splitHelpKeywords = (value: string) =>
    value.split(',').map(keyword => keyword.trim()).filter(Boolean);

/** Page index for the drawer; titles, descriptions and keywords come from `web/locales/help/*`. */
export const getHelpCenterPages = (t: HelpT): HelpCenterPageDefinition[] => [
    {
        id: 'getting-started',
        title: t('help.pages.gettingStarted.title'),
        description: t('help.pages.gettingStarted.description'),
        category: 'Basics',
        keywords: splitHelpKeywords(t('help.pages.gettingStarted.keywords')),
        sections: getGettingStartedSections(t),
        component: GettingStartedPage
    },
    {
        id: 'projects',
        title: t('help.pages.projects.title'),
        description: t('help.pages.projects.description'),
        category: 'Workflows',
        keywords: splitHelpKeywords(t('help.pages.projects.keywords')),
        sections: getProjectsSections(t),
        component: ProjectsPage
    },
    {
        id: 'sprints',
        title: t('help.pages.sprints.title'),
        description: t('help.pages.sprints.description'),
        category: 'Workflows',
        keywords: splitHelpKeywords(t('help.pages.sprints.keywords')),
        sections: getSprintsSections(t),
        component: SprintsPage
    },
    {
        id: 'ai-features',
        title: t('help.pages.aiFeatures.title'),
        description: t('help.pages.aiFeatures.description'),
        category: 'CORA Studio',
        keywords: splitHelpKeywords(t('help.pages.aiFeatures.keywords')),
        sections: getAiFeaturesSections(t),
        component: AIFeaturesPage
    },
    {
        id: 'media-library',
        title: t('help.pages.mediaLibrary.title'),
        description: t('help.pages.mediaLibrary.description'),
        category: 'Assets',
        keywords: splitHelpKeywords(t('help.pages.mediaLibrary.keywords')),
        sections: getMediaLibrarySections(t),
        component: MediaLibraryPage
    },
    {
        id: 'marketing',
        title: t('help.pages.marketing.title'),
        description: t('help.pages.marketing.description'),
        category: 'Marketing',
        keywords: splitHelpKeywords(t('help.pages.marketing.keywords')),
        sections: getMarketingSections(t),
        component: MarketingPage
    },
    {
        id: 'account-settings',
        title: t('help.pages.accountSettings.title'),
        description: t('help.pages.accountSettings.description'),
        category: 'Account',
        keywords: splitHelpKeywords(t('help.pages.accountSettings.keywords')),
        sections: getAccountSettingsSections(t),
        component: AccountSettingsPage
    }
];

export const getHelpTargetForPath = (pathname: string): HelpCenterTarget => {
    const path = pathname.toLowerCase();

    if (path.includes('/marketing')) {
        return { pageId: 'marketing' };
    }
    if (path.includes('/media')) {
        return { pageId: 'media-library' };
    }
    if (path.includes('/brainstorm')) {
        return { pageId: 'ai-features' };
    }
    if (path.includes('/tasks')) {
        return { pageId: 'projects' };
    }
    if (path.includes('/team') || path.includes('/settings') || path.includes('/profile')) {
        return { pageId: 'account-settings' };
    }
    if (path.includes('/project/') || path.includes('/projects')) {
        if (path.includes('/sprints')) {
            return { pageId: 'sprints' };
        }
        return { pageId: 'projects' };
    }

    return { pageId: 'getting-started' };
};
