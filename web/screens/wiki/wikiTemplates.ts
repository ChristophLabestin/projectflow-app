import type { WikiJsonNode, WikiTemplate } from '../../types/wiki';
import type { WikiT } from './editor/host';

const text = (value: string): WikiJsonNode[] => (value ? [{ type: 'text', text: value }] : []);
const p = (value = ''): WikiJsonNode => ({ type: 'paragraph', content: text(value) });
const h = (level: 1 | 2 | 3, value: string): WikiJsonNode => ({ type: 'heading', attrs: { level }, content: text(value) });
const bullets = (items: string[]): WikiJsonNode => ({
    type: 'bulletList',
    content: items.map((item) => ({ type: 'listItem', content: [p(item)] })),
});
const checklist = (items: string[]): WikiJsonNode => ({
    type: 'taskList',
    content: items.map((item) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(item)] })),
});
const callout = (tone: string, value: string): WikiJsonNode => ({ type: 'wikiCallout', attrs: { tone }, content: [p(value)] });
const cell = (type: 'tableHeader' | 'tableCell', value: string): WikiJsonNode => ({ type, content: [p(value)] });
const table = (headers: string[], rows: number): WikiJsonNode => ({
    type: 'table',
    content: [
        { type: 'tableRow', content: headers.map((header) => cell('tableHeader', header)) },
        ...Array.from({ length: rows }, () => ({ type: 'tableRow', content: headers.map(() => cell('tableCell', '')) })),
    ],
});
const doc = (...content: WikiJsonNode[]): string => JSON.stringify({ type: 'doc', content });

/** Built-in templates, localized at render time. */
export const builtInTemplates = (t: WikiT): WikiTemplate[] => [
    {
        id: 'builtin:meeting',
        builtIn: true,
        icon: '🗓️',
        name: t('wiki.template.meeting'),
        description: t('wiki.template.meeting.desc'),
        data: doc(
            table([t('wiki.tpl.date'), t('wiki.tpl.attendees'), t('wiki.tpl.facilitator')], 1),
            h(2, t('wiki.tpl.agenda')),
            bullets(['']),
            h(2, t('wiki.tpl.notes')),
            p(),
            h(2, t('wiki.tpl.decisions')),
            bullets(['']),
            h(2, t('wiki.tpl.actionItems')),
            checklist(['']),
        ),
    },
    {
        id: 'builtin:brief',
        builtIn: true,
        icon: '🧭',
        name: t('wiki.template.brief'),
        description: t('wiki.template.brief.desc'),
        data: doc(
            callout('info', t('wiki.tpl.briefIntro')),
            { type: 'wikiToc' },
            h(2, t('wiki.tpl.problem')),
            p(),
            h(2, t('wiki.tpl.goals')),
            bullets(['']),
            h(2, t('wiki.tpl.nonGoals')),
            bullets(['']),
            h(2, t('wiki.tpl.solution')),
            p(),
            h(2, t('wiki.tpl.requirements')),
            table([t('wiki.tpl.requirement'), t('wiki.tpl.priority'), t('wiki.tpl.notes')], 3),
            h(2, t('wiki.tpl.milestones')),
            checklist(['']),
            h(2, t('wiki.tpl.openQuestions')),
            bullets(['']),
        ),
    },
    {
        id: 'builtin:retro',
        builtIn: true,
        icon: '🔁',
        name: t('wiki.template.retro'),
        description: t('wiki.template.retro.desc'),
        data: doc(
            p(t('wiki.tpl.retroIntro')),
            h(2, t('wiki.tpl.wentWell')),
            bullets(['']),
            h(2, t('wiki.tpl.toImprove')),
            bullets(['']),
            h(2, t('wiki.tpl.learned')),
            bullets(['']),
            h(2, t('wiki.tpl.actionItems')),
            checklist(['']),
        ),
    },
    {
        id: 'builtin:decision',
        builtIn: true,
        icon: '⚖️',
        name: t('wiki.template.decision'),
        description: t('wiki.template.decision.desc'),
        data: doc(
            callout('warning', t('wiki.tpl.decisionStatus')),
            h(2, t('wiki.tpl.context')),
            p(),
            h(2, t('wiki.tpl.options')),
            table([t('wiki.tpl.option'), t('wiki.tpl.pros'), t('wiki.tpl.cons')], 2),
            h(2, t('wiki.tpl.decision')),
            p(),
            h(2, t('wiki.tpl.consequences')),
            bullets(['']),
        ),
    },
    {
        id: 'builtin:onboarding',
        builtIn: true,
        icon: '👋',
        name: t('wiki.template.onboarding'),
        description: t('wiki.template.onboarding.desc'),
        data: doc(
            callout('success', t('wiki.tpl.welcome')),
            h(2, t('wiki.tpl.firstDay')),
            checklist([t('wiki.tpl.accounts'), t('wiki.tpl.meetTeam'), t('wiki.tpl.readDocs')]),
            h(2, t('wiki.tpl.firstWeek')),
            checklist(['']),
            h(2, t('wiki.tpl.people')),
            bullets(['']),
            h(2, t('wiki.tpl.links')),
            bullets(['']),
        ),
    },
];
