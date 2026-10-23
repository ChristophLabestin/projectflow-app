import type { HelpArticle, HelpBlock, HelpContent } from './helpTypes';

export type HelpSearchResult = {
    key: string;
    articleId: string;
    sectionId?: string;
    title: string;
    /** Article title for section hits. */
    context?: string;
    snippet: string;
    icon: string;
};

/** Strips inline markup (`**bold**`, `` `code` ``, `[label](/route)`) to plain text. */
export const stripHelpMarkup = (value: string) =>
    value
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1');

export const blockToText = (block: HelpBlock): string => {
    switch (block.type) {
        case 'text':
        case 'callout':
            return block.text;
        case 'steps':
        case 'list':
            return block.items.join(' ');
        case 'terms':
            return block.items.map(item => `${item.term} ${item.text}`).join(' ');
        case 'shortcuts':
            return block.items.map(item => `${item.keys.join(' ')} ${item.label}`).join(' ');
    }
};

const normalize = (value: string) =>
    stripHelpMarkup(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const snippetAround = (text: string, terms: string[], length = 140) => {
    const plain = stripHelpMarkup(text).replace(/\s+/g, ' ').trim();
    const lower = normalize(plain);
    const hit = terms.map(term => lower.indexOf(term)).filter(index => index >= 0).sort((a, b) => a - b)[0] ?? 0;
    const start = Math.max(0, hit - 40);
    const slice = plain.slice(start, start + length);
    return `${start > 0 ? '…' : ''}${slice}${start + length < plain.length ? '…' : ''}`;
};

/**
 * Ranks articles and sections by how many query terms they contain, weighting titles and keywords over body text.
 * Every term has to match somewhere in the entry.
 */
export const searchHelp = (content: HelpContent, query: string, limit = 20): HelpSearchResult[] => {
    const terms = normalize(query).split(/\s+/).filter(term => term.length > 1);
    if (!terms.length) return [];

    const scored: { score: number; result: HelpSearchResult }[] = [];
    const score = (title: string, keywords: string, body: string) => {
        const t = normalize(title);
        const k = normalize(keywords);
        const b = normalize(body);
        let total = 0;
        for (const term of terms) {
            const value = (t.includes(term) ? 6 : 0) + (k.includes(term) ? 4 : 0) + (b.includes(term) ? 1 : 0);
            if (!value) return 0;
            total += value;
        }
        return total;
    };

    content.articles.forEach((article: HelpArticle) => {
        const articleScore = score(article.title, (article.keywords || []).join(' '), article.summary);
        if (articleScore) {
            scored.push({
                score: articleScore + 2,
                result: { key: article.id, articleId: article.id, title: article.title, snippet: article.summary, icon: article.icon }
            });
        }
        article.sections.forEach(section => {
            const body = section.blocks.map(blockToText).join(' ');
            const sectionScore = score(section.title, (section.keywords || []).join(' '), body);
            if (!sectionScore) return;
            scored.push({
                score: sectionScore,
                result: {
                    key: `${article.id}:${section.id}`,
                    articleId: article.id,
                    sectionId: section.id,
                    title: section.title,
                    context: article.title,
                    snippet: snippetAround(body, terms),
                    icon: article.icon
                }
            });
        });
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(entry => entry.result);
};
