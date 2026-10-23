/**
 * Help center copy (EN), lazy-loaded by `loadHelpTranslations` when the drawer opens.
 * Page bodies live in `./help/<page>-en.ts`; page meta (title/description/keywords) lives here.
 */
import gettingStartedEn from './help/getting-started-en';
import projectsEn from './help/projects-en';
import sprintsEn from './help/sprints-en';
import aiFeaturesEn from './help/ai-features-en';
import mediaLibraryEn from './help/media-library-en';
import marketingEn from './help/marketing-en';
import accountSettingsEn from './help/account-settings-en';

const enHelp: Record<string, string> = {
    'help.pages.gettingStarted.title': 'Getting Started',
    'help.pages.gettingStarted.description': 'Learn the workspace model, navigation, and first steps.',
    'help.pages.gettingStarted.keywords': 'navigation, workspace, shortcuts, overview',
    'help.pages.projects.title': 'Projects',
    'help.pages.projects.description': 'Plan, organize, and track delivery with project dashboards.',
    'help.pages.projects.keywords': 'projects, modules, milestones, overview',
    'help.pages.sprints.title': 'Sprints (Agile)',
    'help.pages.sprints.description': 'Iterative delivery with backlogs, sprints, and boards.',
    'help.pages.sprints.keywords': 'sprints, agile, scrum, backlog, kanban',
    'help.pages.aiFeatures.title': 'CORA Features',
    'help.pages.aiFeatures.description': 'Discover CORA search, drafting, analysis, and media tools.',
    'help.pages.aiFeatures.keywords': 'cora, ai, studio, usage, limits',
    'help.pages.mediaLibrary.title': 'Media Library',
    'help.pages.mediaLibrary.description': 'Upload, generate, and manage creative assets.',
    'help.pages.mediaLibrary.keywords': 'media, library, assets, uploads',
    'help.pages.marketing.title': 'Marketing',
    'help.pages.marketing.description': 'Connect and publish to your website blog.',
    'help.pages.marketing.keywords': 'blog, posts, publish',
    'help.pages.accountSettings.title': 'Team and Settings',
    'help.pages.accountSettings.description': 'Manage access, profiles, and workspace configuration.',
    'help.pages.accountSettings.keywords': 'team, roles, settings, profile',
    ...gettingStartedEn,
    ...projectsEn,
    ...sprintsEn,
    ...aiFeaturesEn,
    ...mediaLibraryEn,
    ...marketingEn,
    ...accountSettingsEn,
};

export default enHelp;
