import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('../../../services/aiActions', () => ({ AI_DATA_CHANGED_EVENT: 'x', applyAiProposal: vi.fn(), undoAiProposal: vi.fn() }));

const { AiActionCard } = await import('../AiActionCard');

describe('AiActionCard', () => {
    it('shows the full new value that will be written (security review 2026-10-24)', () => {
        const long = `${'Schritt '.repeat(120)}ENDE`;
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <AiActionCard proposal={{ id: 'p1', tool: 'create_task', target: { projectId: 'p', projectTitle: 'P' }, changes: [{ field: 'title', to: 'Kurz' }, { field: 'description', to: long }] }} />
            </MemoryRouter>
        );
        expect(html).toContain('ENDE');
        expect(html).not.toContain('…');
        expect(html).toContain('ai.card.showAll');
        expect(html).toContain('Kurz');
    });
});
