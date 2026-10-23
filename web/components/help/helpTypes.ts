/**
 * Help center content model. Articles are plain data per language (`web/locales/help/articles-<lang>.ts`),
 * rendered by `HelpArticleView`. Inline text supports `**bold**`, `` `code` `` and `[label](/route)` links.
 * Keep the same article/section ids and block order in every language (parity test in `__tests__`).
 */

export type HelpCategoryId = 'basics' | 'work' | 'planning' | 'collaboration' | 'ai' | 'workspace';

export type HelpBlock =
    | { type: 'text'; text: string }
    | { type: 'steps'; items: string[] }
    | { type: 'list'; items: string[] }
    | { type: 'callout'; tone: 'tip' | 'note' | 'warning'; text: string }
    | { type: 'terms'; items: { term: string; text: string }[] }
    | { type: 'shortcuts'; items: { keys: string[]; label: string }[] };

export type HelpSection = {
    id: string;
    title: string;
    blocks: HelpBlock[];
    /** Extra search terms (synonyms, English terms in DE content). */
    keywords?: string[];
};

export type HelpArticle = {
    id: string;
    category: HelpCategoryId;
    /** Material Symbols name. */
    icon: string;
    title: string;
    summary: string;
    keywords?: string[];
    sections: HelpSection[];
};

export type HelpContent = {
    categories: Record<HelpCategoryId, string>;
    articles: HelpArticle[];
};
