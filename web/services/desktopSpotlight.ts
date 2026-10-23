import { loadDesktopSearchItems } from './desktopSearch';

export interface SpotlightEntry {
    id: string;
    title: string;
    subtitle?: string;
    keywords?: string[];
}

/**
 * Items for the macOS Spotlight index (desktop app): active projects, my open project tasks and my open
 * personal tasks of the active workspace. The id is the in-app path the shell opens on click.
 */
export const buildSpotlightEntries = async (tenantId: string, labels: { project: string; personalTask: string }): Promise<SpotlightEntry[]> => (
    (await loadDesktopSearchItems(tenantId)).map((item) => ({
        id: item.path,
        title: item.title,
        subtitle: item.kind === 'project' ? labels.project : item.kind === 'personal-task' ? labels.personalTask : item.context,
        keywords: ['ProjectFlow']
    }))
);
