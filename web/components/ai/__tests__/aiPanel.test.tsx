import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { contextFromPath } from '../../../context/AiPanelContext';
import { AiMessageText } from '../AiMessageText';

const render = (text: string) => renderToStaticMarkup(<MemoryRouter><AiMessageText text={text} /></MemoryRouter>);

describe('contextFromPath', () => {
    it('recognises task, project and app surfaces', () => {
        expect(contextFromPath('/project/p1/tasks/t9')).toMatchObject({ surface: 'task', projectId: 'p1', entity: { kind: 'task', id: 't9', projectId: 'p1' } });
        expect(contextFromPath('/project/p1')).toMatchObject({ surface: 'project', entity: { kind: 'project', id: 'p1' } });
        expect(contextFromPath('/project/p1/tasks').surface).toBe('list');
        expect(contextFromPath('/').surface).toBe('dashboard');
        expect(contextFromPath('/calendar').surface).toBe('calendar');
        expect(contextFromPath('/somewhere').surface).toBe('other');
    });
});

describe('AiMessageText', () => {
    it('links ProjectFlow objects and keeps markup minimal', () => {
        const html = render('**Overdue:**\n- [Fix login](pf://task/p1/t1) today\n- see [Website](pf://project/p2)');
        expect(html).toContain('<strong>Overdue:</strong>');
        expect(html).toContain('href="/project/p1/tasks/t1"');
        expect(html).toContain('href="/project/p2"');
        expect(html).toContain('<ul>');
    });

    it('never renders external links, images or raw HTML', () => {
        const html = render('Click [here](https://evil.example/x?d=1) ![img](https://evil.example/p.png) <img src=x onerror=alert(1)> [bad](pf://task/../../x)');
        expect(html).not.toContain('evil.example');
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<a href="pf');
        expect(html).toContain('here');
        expect(html).toContain('&lt;img');
    });
});
