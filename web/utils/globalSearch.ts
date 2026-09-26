// Pure matching logic for the global search (⌘K). No network, no AI — the
// component loads the workspace index once and runs every keystroke here.

export type SearchScope = 'all' | 'projects' | 'tasks' | 'initiatives' | 'commands' | 'help';

export type TaskFilter = 'open' | 'done' | 'overdue' | 'today' | 'mine';
export type PriorityFilter = 'urgent' | 'high' | 'medium' | 'low';

export interface ParsedQuery {
    raw: string;
    /** Scope forced by a leading prefix (">", "#", "!", "?"), if any. */
    prefixScope?: SearchScope;
    terms: string[];
    taskFilters: TaskFilter[];
    priority?: PriorityFilter;
    /** True when the query carries filters that only make sense for tasks. */
    hasTaskFilters: boolean;
}

export const SCOPE_PREFIXES: Record<string, SearchScope> = {
    '>': 'commands',
    '#': 'projects',
    '!': 'tasks',
    '?': 'help',
};

const TASK_FILTERS: TaskFilter[] = ['open', 'done', 'overdue', 'today', 'mine'];
const PRIORITY_FILTERS: PriorityFilter[] = ['urgent', 'high', 'medium', 'low'];

/** Lower-case and strip diacritics so "Übersicht" matches "ubersicht". */
export const normalize = (value: string): string =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const parseQuery = (input: string): ParsedQuery => {
    let rest = input.trimStart();
    let prefixScope: SearchScope | undefined;
    const first = rest.charAt(0);
    if (SCOPE_PREFIXES[first]) {
        prefixScope = SCOPE_PREFIXES[first];
        rest = rest.slice(1);
    }

    const terms: string[] = [];
    const taskFilters: TaskFilter[] = [];
    let priority: PriorityFilter | undefined;

    rest.split(/\s+/).filter(Boolean).forEach((word) => {
        const lower = normalize(word);
        const [key, value] = lower.split(':');
        if (value && key === 'is' && (TASK_FILTERS as string[]).includes(value)) {
            taskFilters.push(value as TaskFilter);
            return;
        }
        if (value && (key === 'prio' || key === 'priority') && (PRIORITY_FILTERS as string[]).includes(value)) {
            priority = value as PriorityFilter;
            return;
        }
        terms.push(lower);
    });

    return {
        raw: input,
        prefixScope,
        terms,
        taskFilters,
        priority,
        hasTaskFilters: taskFilters.length > 0 || Boolean(priority),
    };
};

/** True if every char of `needle` appears in order in `haystack`. */
const isSubsequence = (needle: string, haystack: string) => {
    let i = 0;
    for (let j = 0; j < haystack.length && i < needle.length; j += 1) {
        if (haystack[j] === needle[i]) i += 1;
    }
    return i === needle.length;
};

const WORD_BOUNDARY = /[\s\-_/.,:;()[\]]/;

/**
 * Score one term against the primary text (title). Returns 0 when it doesn't
 * match. Start-of-title beats start-of-word beats substring beats fuzzy.
 */
const scoreTerm = (term: string, text: string): number => {
    const index = text.indexOf(term);
    if (index === 0) return 4;
    if (index > 0) return WORD_BOUNDARY.test(text[index - 1]) ? 3 : 1.5;
    if (term.length >= 3 && isSubsequence(term, text)) return 0.5;
    return 0;
};

/**
 * Score a candidate: every term must match either the title or one of the
 * secondary texts (description, project name, keywords). Returns 0 for no match.
 */
export const scoreCandidate = (terms: string[], title: string, secondary: string[] = []): number => {
    if (terms.length === 0) return 1;
    const normTitle = normalize(title);
    const normSecondary = secondary.filter(Boolean).map(normalize);
    let score = 0;

    for (const term of terms) {
        const titleScore = scoreTerm(term, normTitle);
        if (titleScore > 0) {
            score += titleScore;
            continue;
        }
        if (normSecondary.some((text) => text.includes(term))) {
            score += 0.75;
            continue;
        }
        return 0;
    }

    if (normTitle === terms.join(' ')) score += 3;
    return score;
};

/** Character ranges in `text` that match any term (for <mark> highlighting). */
export const highlightRanges = (text: string, terms: string[]): Array<[number, number]> => {
    if (!text || terms.length === 0) return [];
    // Normalise char by char so indices stay aligned with the original string.
    const norm = text.split('').map((ch) => normalize(ch).charAt(0) || ch).join('');
    const ranges: Array<[number, number]> = [];
    terms.forEach((term) => {
        if (!term) return;
        let from = 0;
        let index = norm.indexOf(term, from);
        while (index !== -1) {
            ranges.push([index, index + term.length]);
            from = index + term.length;
            index = norm.indexOf(term, from);
        }
    });
    ranges.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    ranges.forEach((range) => {
        const last = merged[merged.length - 1];
        if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
        else merged.push([...range] as [number, number]);
    });
    return merged;
};

export const todayIso = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};
