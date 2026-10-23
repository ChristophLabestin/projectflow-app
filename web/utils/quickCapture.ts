/**
 * Parser for the desktop Quick Capture field:
 *   "Angebot schicken #website !hoch morgen"
 *   → title "Angebot schicken", project query "website", priority High, due tomorrow.
 * Tokens: `#project` (fuzzy, resolved by the caller), `!`/`!!`/`!!!` or `!low|!niedrig|!high|!hoch|!urgent|!dringend`,
 * due words `today|heute`, `tomorrow|morgen`, `übermorgen`.
 */

export type CapturePriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface ParsedCapture {
    title: string;
    projectQuery: string | null;
    priority: CapturePriority | null;
    /** Days from today (0 = today) or null. */
    dueInDays: number | null;
}

const PRIORITY_WORDS: Record<string, CapturePriority> = {
    low: 'Low', niedrig: 'Low',
    medium: 'Medium', mittel: 'Medium',
    high: 'High', hoch: 'High',
    urgent: 'Urgent', dringend: 'Urgent'
};

const DUE_WORDS: Record<string, number> = {
    today: 0, heute: 0,
    tomorrow: 1, morgen: 1,
    'übermorgen': 2, uebermorgen: 2
};

export const normalizeSearch = (value: string) => value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const parseCapture = (input: string): ParsedCapture => {
    let projectQuery: string | null = null;
    let priority: CapturePriority | null = null;
    let dueInDays: number | null = null;

    const words = input.split(/\s+/).filter(Boolean);
    const kept = words.filter((word) => {
        if (word.startsWith('#') && word.length > 1) {
            projectQuery = word.slice(1);
            return false;
        }
        if (/^!{1,3}$/.test(word)) {
            priority = word.length === 3 ? 'Urgent' : word.length === 2 ? 'High' : 'Medium';
            return false;
        }
        if (word.startsWith('!') && PRIORITY_WORDS[word.slice(1).toLowerCase()]) {
            priority = PRIORITY_WORDS[word.slice(1).toLowerCase()];
            return false;
        }
        const due = DUE_WORDS[word.toLowerCase()];
        if (due !== undefined && dueInDays === null) {
            dueInDays = due;
            return false;
        }
        return true;
    });

    return { title: kept.join(' ').trim(), projectQuery, priority, dueInDays };
};

/** The `#query` currently being typed at the end of the input (for the project picker), or null. */
export const activeProjectToken = (input: string): string | null => {
    const match = /(?:^|\s)#([^\s#]*)$/.exec(input);
    return match ? match[1] : null;
};

/** Ranks projects for a query: prefix match first, then word-prefix, then substring. */
export const rankProjects = <T extends { title: string }>(projects: T[], query: string, limit = 6): T[] => {
    const q = normalizeSearch(query);
    if (!q) return projects.slice(0, limit);
    const scored = projects.flatMap((project) => {
        const title = normalizeSearch(project.title);
        const score = title.startsWith(q) ? 0
            : title.split(/[\s\-_/]+/).some((part) => part.startsWith(q)) ? 1
                : title.includes(q) ? 2
                    : -1;
        return score < 0 ? [] : [{ project, score }];
    });
    return scored.sort((a, b) => a.score - b.score || a.project.title.localeCompare(b.project.title)).slice(0, limit).map(({ project }) => project);
};

/** Replaces the trailing `#query` with `#<slug>` of the chosen project. */
export const completeProjectToken = (input: string, projectTitle: string) => {
    const slug = projectTitle.trim().split(/\s+/)[0] || projectTitle;
    return input.replace(/(^|\s)#[^\s#]*$/, `$1#${slug} `);
};
