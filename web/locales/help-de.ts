/**
 * Help center copy (DE), lazy-loaded by `loadHelpTranslations` when the drawer opens.
 * Page bodies live in `./help/<page>-de.ts`; page meta (title/description/keywords) lives here.
 */
import gettingStartedDe from './help/getting-started-de';
import projectsDe from './help/projects-de';
import sprintsDe from './help/sprints-de';
import aiFeaturesDe from './help/ai-features-de';
import mediaLibraryDe from './help/media-library-de';
import marketingDe from './help/marketing-de';
import accountSettingsDe from './help/account-settings-de';

const deHelp: Record<string, string> = {
    'help.pages.gettingStarted.title': 'Erste Schritte',
    'help.pages.gettingStarted.description': 'Lerne das Workspace-Modell, die Navigation und die ersten Schritte kennen.',
    'help.pages.gettingStarted.keywords': 'navigation, workspace, arbeitsbereich, tastenkürzel, shortcuts, überblick',
    'help.pages.projects.title': 'Projekte',
    'help.pages.projects.description': 'Plane, organisiere und verfolge die Umsetzung mit Projekt-Dashboards.',
    'help.pages.projects.keywords': 'projekte, module, meilensteine, übersicht',
    'help.pages.sprints.title': 'Sprints (Agile)',
    'help.pages.sprints.description': 'Iterativ liefern mit Backlog, Sprints und Boards.',
    'help.pages.sprints.keywords': 'sprints, agile, scrum, backlog, kanban',
    'help.pages.aiFeatures.title': 'CORA-Funktionen',
    'help.pages.aiFeatures.description': 'Entdecke CORA für Suche, Entwürfe, Analysen und Medien.',
    'help.pages.aiFeatures.keywords': 'cora, ki, ai, studio, nutzung, limits',
    'help.pages.mediaLibrary.title': 'Medienbibliothek',
    'help.pages.mediaLibrary.description': 'Lade kreative Assets hoch, generiere und verwalte sie.',
    'help.pages.mediaLibrary.keywords': 'medien, medienbibliothek, assets, uploads, dateien',
    'help.pages.marketing.title': 'Marketing',
    'help.pages.marketing.description': 'Verbinde deinen Website-Blog und veröffentliche Beiträge.',
    'help.pages.marketing.keywords': 'blog, beiträge, veröffentlichen',
    'help.pages.accountSettings.title': 'Team und Einstellungen',
    'help.pages.accountSettings.description': 'Verwalte Zugriffe, Profile und die Konfiguration deines Workspaces.',
    'help.pages.accountSettings.keywords': 'team, rollen, einstellungen, profil, zugriff',
    ...gettingStartedDe,
    ...projectsDe,
    ...sprintsDe,
    ...aiFeaturesDe,
    ...mediaLibraryDe,
    ...marketingDe,
    ...accountSettingsDe,
};

export default deHelp;
