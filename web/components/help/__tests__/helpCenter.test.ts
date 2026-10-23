import { describe, expect, it } from 'vitest';
import en from '../../../locales/help/articles-en';
import de from '../../../locales/help/articles-de';
import { parseHelpInline } from '../HelpInline';
import { searchHelp, stripHelpMarkup } from '../helpSearch';
import { getHelpContextForPath } from '../helpRouting';
import type { HelpBlock, HelpContent } from '../helpTypes';

const blockShape = (block: HelpBlock) => {
    switch (block.type) {
        case 'text':
            return 'text';
        case 'callout':
            return `callout:${block.tone}`;
        default:
            return `${block.type}:${block.items.length}`;
    }
};

const shape = (content: HelpContent) => content.articles.map(article => ({
    id: article.id,
    category: article.category,
    icon: article.icon,
    sections: article.sections.map(section => ({ id: section.id, blocks: section.blocks.map(blockShape) }))
}));

const allText = (content: HelpContent) => content.articles.flatMap(article => [
    article.title,
    article.summary,
    ...article.sections.flatMap(section => [section.title, ...section.blocks.map(block => JSON.stringify(block))])
]);

describe('help content', () => {
    it('has the same articles, sections and block structure in EN and DE', () => {
        expect(shape(de)).toEqual(shape(en));
    });

    it('uses unique article ids and unique section ids per article', () => {
        const ids = en.articles.map(article => article.id);
        expect(new Set(ids).size).toBe(ids.length);
        en.articles.forEach(article => {
            const sectionIds = article.sections.map(section => section.id);
            expect(new Set(sectionIds).size, article.id).toBe(sectionIds.length);
        });
    });

    it('has a category label for every used category', () => {
        [en, de].forEach(content => {
            content.articles.forEach(article => expect(content.categories[article.category]).toBeTruthy());
        });
    });

    it('only links to in-app routes without placeholders', () => {
        [en, de].forEach(content => {
            allText(content).forEach(text => {
                for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
                    expect(match[1]).toMatch(/^(\/[a-z0-9/-]*|https:\/\/)/);
                    expect(match[1]).not.toContain(':');
                }
            });
        });
    });

    it('never mentions retired concepts', () => {
        const retired = /\b(flows?|issues?|social)\b/i;
        en.articles.forEach(article => {
            allText({ categories: en.categories, articles: [article] }).forEach(text => {
                expect(text, article.id).not.toMatch(retired);
            });
        });
    });

    it('resolves every routed article and section', () => {
        ['/', '/tasks', '/projects', '/project/x/tasks', '/project/x/initiatives', '/project/x/milestones',
            '/project/x/sprints', '/project/x/marketing/blog', '/project/x/effort', '/calendar', '/finance/cockpit',
            '/media', '/team', '/notifications', '/profile', '/download', '/brainstorm', '/unknown'].forEach(path => {
            const target = getHelpContextForPath(path);
            const article = en.articles.find(item => item.id === target.articleId);
            expect(article, path).toBeTruthy();
            if (target.sectionId) {
                expect(article?.sections.some(section => section.id === target.sectionId), path).toBe(true);
            }
        });
    });
});

describe('parseHelpInline', () => {
    it('splits bold, code and links', () => {
        expect(parseHelpInline('Open **Settings**, press `?` or go to [Tasks](/tasks).')).toEqual([
            { kind: 'text', value: 'Open ' },
            { kind: 'strong', value: 'Settings' },
            { kind: 'text', value: ', press ' },
            { kind: 'code', value: '?' },
            { kind: 'text', value: ' or go to ' },
            { kind: 'link', value: 'Tasks', href: '/tasks' },
            { kind: 'text', value: '.' }
        ]);
    });

    it('strips markup for search text', () => {
        expect(stripHelpMarkup('**A** `b` [c](/d)')).toBe('A b c');
    });
});

describe('searchHelp', () => {
    const content: HelpContent = {
        categories: { basics: 'Basics', work: 'Work', planning: 'Planning', collaboration: 'Team', cora: 'CORA', workspace: 'Workspace' },
        articles: [{
            id: 'tasks', category: 'work', icon: 'task_alt', title: 'Aufgaben', summary: 'Arbeit erfassen.', keywords: ['tasks'],
            sections: [{ id: 'quick-add', title: 'Schnell erfassen', blocks: [{ type: 'text', text: 'Drücke `N` für Quick Add.' }] }]
        }]
    };

    it('ranks title hits and needs every term', () => {
        expect(searchHelp(content, 'aufgaben')[0].articleId).toBe('tasks');
        expect(searchHelp(content, 'quick add').map(result => result.sectionId)).toEqual(['quick-add']);
        expect(searchHelp(content, 'quick nothing')).toEqual([]);
    });

    it('ignores accents and case', () => {
        expect(searchHelp(content, 'DRUCKE').length).toBe(1);
    });
});
