import { describe, expect, it } from 'vitest';
import { activeProjectToken, completeProjectToken, parseCapture, rankProjects } from '../quickCapture';

describe('parseCapture', () => {
    it('extracts project, priority and due date', () => {
        expect(parseCapture('Angebot schicken #website !hoch morgen')).toEqual({
            title: 'Angebot schicken', projectQuery: 'website', priority: 'High', dueInDays: 1
        });
    });

    it('supports bang shorthands and English words', () => {
        expect(parseCapture('Fix login !!! today')).toMatchObject({ title: 'Fix login', priority: 'Urgent', dueInDays: 0 });
        expect(parseCapture('Call Anna !!')).toMatchObject({ priority: 'High', projectQuery: null, dueInDays: null });
    });

    it('keeps unknown tokens in the title', () => {
        expect(parseCapture('Read #')).toMatchObject({ title: 'Read #', projectQuery: null });
        expect(parseCapture('Plan !maybe')).toMatchObject({ title: 'Plan !maybe', priority: null });
    });
});

describe('project picker helpers', () => {
    const projects = [{ title: 'Website Relaunch' }, { title: 'Mobile App v2' }, { title: 'Büro Umzug' }];

    it('finds the token being typed', () => {
        expect(activeProjectToken('Task #web')).toBe('web');
        expect(activeProjectToken('Task #web more')).toBeNull();
    });

    it('ranks prefix and word matches, ignoring diacritics', () => {
        expect(rankProjects(projects, 'app').map((p) => p.title)).toEqual(['Mobile App v2']);
        expect(rankProjects(projects, 'buro').map((p) => p.title)).toEqual(['Büro Umzug']);
    });

    it('completes the token with the project slug', () => {
        expect(completeProjectToken('Task #web', 'Website Relaunch')).toBe('Task #Website ');
    });
});
