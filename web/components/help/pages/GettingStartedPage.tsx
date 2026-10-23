import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import type { HelpCenterPageProps, HelpCenterSectionsBuilder } from '../helpCenterTypes';
import { splitHelpKeywords } from '../helpCenterContent';

const P = 'help.gettingStarted';

const SECTION_IDS = [
    'workspace-anatomy',
    'core-concepts',
    'first-five-minutes',
    'navigation-mastery',
    'keyboard-shortcuts',
    'glossary'
] as const;

export const getGettingStartedSections: HelpCenterSectionsBuilder = t =>
    SECTION_IDS.map(id => ({
        id,
        title: t(`${P}.sections.${id}.title`),
        summary: t(`${P}.sections.${id}.summary`),
        content: t(`${P}.sections.${id}.content`),
        keywords: splitHelpKeywords(t(`${P}.sections.${id}.keywords`))
    }));

/* ─────────────────────────────────────────────────────────────
   LAYOUT COMPONENTS - Interactive Wizard Style
───────────────────────────────────────────────────────────── */

const ProgressStep = ({
    step,
    title,
    isActive,
    isCompleted
}: {
    step: number;
    title: string;
    isActive?: boolean;
    isCompleted?: boolean;
}) => (
    <div className="flex items-center gap-3">
        <div
            className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${isCompleted
                    ? 'bg-[var(--brand-green)] text-on-primary'
                    : isActive
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-hover text-muted'
                }
            `}
        >
            {isCompleted ? (
                <span className="material-symbols-outlined text-[16px]">check</span>
            ) : (
                step
            )}
        </div>
        <span className={`text-sm font-medium ${isActive ? 'text-main' : 'text-muted'}`}>
            {title}
        </span>
    </div>
);

const Keycap = ({ children }: { children: React.ReactNode }) => (
    <span className="px-2 py-1 rounded-lg border border-surface bg-card text-xs font-semibold text-main font-mono">
        {children}
    </span>
);

const ConceptCard = ({
    icon,
    title,
    description,
    examples
}: {
    icon: string;
    title: string;
    description: string;
    examples: string[];
}) => (
    <div className="rounded-2xl border border-surface bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
            </div>
            <div className="text-base font-bold text-main">{title}</div>
        </div>
        <p className="text-sm text-muted leading-relaxed">{description}</p>
        <div className="flex flex-wrap gap-2">
            {examples.map((ex, i) => (
                <span
                    key={i}
                    className="px-2 py-1 rounded-lg bg-surface-hover text-[10px] font-medium text-muted"
                >
                    {ex}
                </span>
            ))}
        </div>
    </div>
);

const ActionStep = ({
    number,
    title,
    description,
    time,
    action
}: {
    number: number;
    title: string;
    description: string;
    time: string;
    action: string;
}) => (
    <div className="flex gap-4 items-start">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/70 flex items-center justify-center text-on-primary font-bold">
            {number}
        </div>
        <div className="flex-1 rounded-2xl border border-surface bg-card p-4">
            <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-main">{title}</div>
                <span className="px-2 py-0.5 rounded-full bg-surface-hover text-[10px] font-medium text-muted">
                    ~{time}
                </span>
            </div>
            <p className="text-sm text-muted mt-2 leading-relaxed">{description}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                <span className="material-symbols-outlined text-[14px]">touch_app</span>
                {action}
            </div>
        </div>
    </div>
);

const ShortcutRow = ({
    keys,
    action,
    context
}: {
    keys: string[];
    action: string;
    context?: string;
}) => (
    <div className="flex items-center justify-between py-3 border-b border-surface last:border-0">
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
                {keys.map((key, i) => (
                    <Keycap key={i}>{key}</Keycap>
                ))}
            </div>
            {context && (
                <span className="px-2 py-0.5 rounded-full bg-surface-hover text-[10px] text-muted">
                    {context}
                </span>
            )}
        </div>
        <span className="text-sm text-muted">{action}</span>
    </div>
);

const GlossaryTerm = ({
    term,
    definition,
    relatedLabel,
    relatedTerms
}: {
    term: string;
    definition: string;
    relatedLabel: string;
    relatedTerms?: string[];
}) => (
    <div className="rounded-xl border border-surface bg-card p-4">
        <div className="text-sm font-bold text-main">{term}</div>
        <p className="text-sm text-muted mt-2 leading-relaxed">{definition}</p>
        {relatedTerms && relatedTerms.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-subtle">{relatedLabel}</span>
                {relatedTerms.map((rt, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-surface-hover text-[10px] text-muted">
                        {rt}
                    </span>
                ))}
            </div>
        )}
    </div>
);

const Callout = ({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) => {
    const styles = {
        tip: 'border-[rgba(var(--brand-amber-rgb),0.3)] bg-[rgba(var(--brand-amber-rgb),0.1)] text-[var(--brand-amber-text)]',
        warning: 'border-[rgba(var(--status-blocked-rgb),0.3)] bg-[rgba(var(--status-blocked-rgb),0.1)] text-[var(--color-status-blocked-text)]',
        info: 'border-[rgba(var(--brand-blue-rgb),0.3)] bg-[rgba(var(--brand-blue-rgb),0.1)] text-[var(--brand-blue-text)]'
    };
    const icons = { tip: 'lightbulb', warning: 'warning', info: 'info' };
    return (
        <div className={`rounded-2xl border p-4 text-[13px] ${styles[type]}`}>
            <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px]">{icons[type]}</span>
                <div>{children}</div>
            </div>
        </div>
    );
};

const SectionHeader = ({ id, icon, t }: { id: string; icon: string; t: (key: string) => string }) => (
    <div className="flex items-start justify-between">
        <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${P}.${id}.eyebrow`)}</div>
            <h3 className="text-xl font-bold text-main mt-2">{t(`${P}.${id}.title`)}</h3>
            <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">{t(`${P}.${id}.intro`)}</p>
        </div>
        <span className="material-symbols-outlined text-[20px] text-subtle">{icon}</span>
    </div>
);

/* ─────────────────────────────────────────────────────────────
   DATA (keys only; copy lives in locales/help/getting-started-*.ts)
───────────────────────────────────────────────────────────── */

type Tone = 'primary' | 'blue' | 'green' | 'amber';

const TONES: Record<Tone, { text: string; dot: string; box: string; card: string; iconBox: string }> = {
    primary: {
        text: 'text-primary',
        dot: 'bg-primary',
        box: 'border-primary/30 bg-primary/5',
        card: 'border-primary/20 bg-primary/5',
        iconBox: 'bg-primary/10'
    },
    blue: {
        text: 'text-[var(--brand-blue-text)]',
        dot: 'bg-[var(--brand-blue)]',
        box: 'border-[rgba(var(--brand-blue-rgb),0.3)] bg-[rgba(var(--brand-blue-rgb),0.05)]',
        card: 'border-[rgba(var(--brand-blue-rgb),0.2)] bg-[rgba(var(--brand-blue-rgb),0.05)]',
        iconBox: 'bg-[rgba(var(--brand-blue-rgb),0.1)]'
    },
    green: {
        text: 'text-[var(--brand-green-text)]',
        dot: 'bg-[var(--brand-green)]',
        box: 'border-[rgba(var(--brand-green-rgb),0.3)] bg-[rgba(var(--brand-green-rgb),0.05)]',
        card: 'border-[rgba(var(--brand-green-rgb),0.2)] bg-[rgba(var(--brand-green-rgb),0.05)]',
        iconBox: 'bg-[rgba(var(--brand-green-rgb),0.1)]'
    },
    amber: {
        text: 'text-[var(--brand-amber-text)]',
        dot: 'bg-[var(--brand-amber)]',
        box: 'border-[rgba(var(--brand-amber-rgb),0.3)] bg-[rgba(var(--brand-amber-rgb),0.05)]',
        card: 'border-[rgba(var(--brand-amber-rgb),0.2)] bg-[rgba(var(--brand-amber-rgb),0.05)]',
        iconBox: 'bg-[rgba(var(--brand-amber-rgb),0.1)]'
    }
};

const ANATOMY_REGIONS: { id: 'sidebar' | 'header' | 'content'; icon: string; tone: Tone }[] = [
    { id: 'sidebar', icon: 'menu', tone: 'primary' },
    { id: 'header', icon: 'web_asset', tone: 'blue' },
    { id: 'content', icon: 'view_quilt', tone: 'green' }
];

const HIERARCHY = ['workspace', 'projects', 'modules', 'items'];
const HIERARCHY_OPACITY = ['bg-primary', 'bg-primary/80', 'bg-primary/60', 'bg-primary/40'];

const CONCEPTS: { id: string; icon: string; examples: number }[] = [
    { id: 'workspace', icon: 'business', examples: 3 },
    { id: 'project', icon: 'folder', examples: 3 },
    { id: 'module', icon: 'category', examples: 4 },
    { id: 'flow', icon: 'flow_chart', examples: 3 },
    { id: 'task', icon: 'checklist', examples: 3 },
    { id: 'issue', icon: 'report_problem', examples: 4 }
];

const ACTION_STEPS: { id: string; time: string }[] = [
    { id: 'profile', time: '30s' },
    { id: 'project', time: '1 min' },
    { id: 'pin', time: '10s' },
    { id: 'task', time: '1 min' },
    { id: 'overview', time: '1 min' }
];

const NAV_SYSTEMS: { id: string; icon: string; tone: Tone }[] = [
    { id: 'sidebar', icon: 'menu', tone: 'primary' },
    { id: 'breadcrumbs', icon: 'chevron_right', tone: 'blue' },
    { id: 'search', icon: 'search', tone: 'green' },
    { id: 'shortcuts', icon: 'keyboard', tone: 'amber' }
];

type ShortcutDef = { id: string; keys: string[]; context?: string };

const SHORTCUT_GROUPS: { id: string; rows: ShortcutDef[] }[] = [
    {
        id: 'global',
        rows: [
            { id: 'newTask', keys: ['Alt', 'T'] },
            { id: 'newFlow', keys: ['Alt', 'I'] },
            { id: 'logIssue', keys: ['Alt', 'B'] },
            { id: 'help', keys: ['?'] },
            { id: 'search', keys: ['/'] },
            { id: 'close', keys: ['Esc'] }
        ]
    },
    {
        id: 'navigation',
        rows: [
            { id: 'dashboard', keys: ['G', 'H'] },
            { id: 'projects', keys: ['G', 'P'] },
            { id: 'tasks', keys: ['G', 'T'] },
            { id: 'overview', keys: ['G', 'O'], context: 'inProject' },
            { id: 'prev', keys: ['['] },
            { id: 'next', keys: [']'] }
        ]
    },
    {
        id: 'editing',
        rows: [
            { id: 'edit', keys: ['E'], context: 'detailView' },
            { id: 'save', keys: ['Cmd', 'Enter'] },
            { id: 'saveNew', keys: ['Cmd', 'Shift', 'Enter'] },
            { id: 'link', keys: ['Cmd', 'K'], context: 'inEditor' },
            { id: 'bold', keys: ['Cmd', 'B'], context: 'inEditor' }
        ]
    },
    {
        id: 'selection',
        rows: [
            { id: 'toggle', keys: ['X'], context: 'listView' },
            { id: 'extend', keys: ['Shift', '↑/↓'], context: 'listView' },
            { id: 'all', keys: ['Cmd', 'A'], context: 'listView' },
            { id: 'delete', keys: ['Delete'], context: 'withSelection' },
            { id: 'move', keys: ['M'], context: 'withSelection' }
        ]
    }
];

const GLOSSARY: { id: string; related: string[] }[] = [
    { id: 'workspace', related: ['project', 'team'] },
    { id: 'project', related: ['module', 'milestone'] },
    { id: 'module', related: ['project', 'task', 'flow'] },
    { id: 'flow', related: ['stage', 'conversion'] },
    { id: 'stage', related: ['flow', 'approval'] },
    { id: 'task', related: ['status', 'priority', 'assignee'] },
    { id: 'issue', related: ['blocker', 'task'] },
    { id: 'milestone', related: ['project', 'timeline'] },
    { id: 'health', related: ['workload', 'overview'] },
    { id: 'pinned', related: ['project', 'shortcut'] },
    { id: 'assignee', related: ['task', 'issue', 'owner'] },
    { id: 'conversion', related: ['flow', 'task', 'campaign'] }
];

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE COMPONENT
───────────────────────────────────────────────────────────── */

export const GettingStartedPage = (_props: HelpCenterPageProps) => {
    const { t } = useLanguage();

    return (
        <div className="px-6 py-6 space-y-10">
            {/* Hero Section with Journey Map */}
            <div className="rounded-[28px] border border-surface bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">
                    {t(`${P}.hero.eyebrow`)}
                </div>
                <h2 className="text-3xl font-bold text-main mt-3">
                    {t(`${P}.hero.title`)}
                </h2>
                <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">
                    {t(`${P}.hero.intro`)}
                </p>

                {/* Journey Progress */}
                <div className="mt-6 flex flex-wrap gap-6">
                    <ProgressStep step={1} title={t(`${P}.hero.steps.layout`)} isCompleted />
                    <ProgressStep step={2} title={t(`${P}.hero.steps.concepts`)} isActive />
                    <ProgressStep step={3} title={t(`${P}.hero.steps.actions`)} />
                    <ProgressStep step={4} title={t(`${P}.hero.steps.navigation`)} />
                    <ProgressStep step={5} title={t(`${P}.hero.steps.settings`)} />
                </div>
            </div>

            {/* SECTION: Workspace Anatomy */}
            <section data-section-id="workspace-anatomy" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <SectionHeader id="anatomy" icon="dashboard" t={t} />

                {/* Visual Diagram */}
                <div className="relative rounded-2xl border-2 border-dashed border-surface bg-card p-4 min-h-[320px]">
                    <div className={`absolute left-4 top-4 bottom-4 w-[180px] rounded-xl border ${TONES.primary.box} flex flex-col items-center justify-center`}>
                        <span className="material-symbols-outlined text-[32px] text-primary/50">menu</span>
                        <span className="text-xs font-bold text-primary mt-2 uppercase">{t(`${P}.anatomy.diagram.sidebar`)}</span>
                    </div>
                    <div className={`absolute left-[200px] right-4 top-4 h-[52px] rounded-xl border ${TONES.blue.box} flex items-center justify-center`}>
                        <span className={`text-xs font-bold uppercase ${TONES.blue.text}`}>{t(`${P}.anatomy.diagram.header`)}</span>
                    </div>
                    <div className={`absolute left-[200px] right-4 top-[72px] bottom-4 rounded-xl border ${TONES.green.box} flex items-center justify-center`}>
                        <span className={`text-xs font-bold uppercase ${TONES.green.text}`}>{t(`${P}.anatomy.diagram.content`)}</span>
                    </div>
                </div>

                {/* Region Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {ANATOMY_REGIONS.map(region => (
                        <div key={region.id} className={`rounded-2xl border p-4 ${TONES[region.tone].card}`}>
                            <div className={`flex items-center gap-2 ${TONES[region.tone].text}`}>
                                <span className="material-symbols-outlined text-[18px]">{region.icon}</span>
                                <span className="text-sm font-bold">{t(`${P}.anatomy.${region.id}.label`)}</span>
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-muted">
                                {[1, 2, 3, 4].map(n => (
                                    <li key={n} className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${TONES[region.tone].dot}`} />
                                        {t(`${P}.anatomy.${region.id}.item${n}`)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            {/* SECTION: Core Concepts */}
            <section data-section-id="core-concepts" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <SectionHeader id="concepts" icon="hub" t={t} />

                {/* Hierarchy Diagram */}
                <div className="rounded-2xl border border-surface bg-surface p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-4">{t(`${P}.concepts.hierarchy`)}</div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {HIERARCHY.map((id, i) => (
                            <React.Fragment key={id}>
                                {i > 0 && <span className="material-symbols-outlined text-subtle">arrow_forward</span>}
                                <div className={`px-4 py-2 rounded-xl ${HIERARCHY_OPACITY[i]} text-on-primary font-bold text-sm`}>
                                    {t(`${P}.concepts.hierarchyItems.${id}`)}
                                </div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Concept Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {CONCEPTS.map(concept => (
                        <ConceptCard
                            key={concept.id}
                            icon={concept.icon}
                            title={t(`${P}.concepts.${concept.id}.title`)}
                            description={t(`${P}.concepts.${concept.id}.description`)}
                            examples={Array.from({ length: concept.examples }, (_, i) =>
                                t(`${P}.concepts.${concept.id}.example${i + 1}`)
                            )}
                        />
                    ))}
                </div>

                <Callout type="tip">{t(`${P}.concepts.tip`)}</Callout>
            </section>

            {/* SECTION: First 5 Minutes */}
            <section data-section-id="first-five-minutes" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${P}.firstFive.eyebrow`)}</div>
                        <h3 className="text-xl font-bold text-main mt-2">{t(`${P}.firstFive.title`)}</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            {t(`${P}.firstFive.intro`)}
                        </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full border text-sm font-semibold ${TONES.green.text} bg-[rgba(var(--brand-green-rgb),0.1)] border-[rgba(var(--brand-green-rgb),0.3)]`}>
                        {t(`${P}.firstFive.badge`)}
                    </div>
                </div>

                <div className="space-y-4">
                    {ACTION_STEPS.map((step, i) => (
                        <ActionStep
                            key={step.id}
                            number={i + 1}
                            title={t(`${P}.firstFive.${step.id}.title`)}
                            description={t(`${P}.firstFive.${step.id}.description`)}
                            time={step.time}
                            action={t(`${P}.firstFive.${step.id}.action`)}
                        />
                    ))}
                </div>

                <Callout type="info">{t(`${P}.firstFive.info`)}</Callout>
            </section>

            {/* SECTION: Navigation Mastery */}
            <section data-section-id="navigation-mastery" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <SectionHeader id="navigation" icon="explore" t={t} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {NAV_SYSTEMS.map(nav => (
                        <div key={nav.id} className="rounded-2xl border border-surface bg-surface p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${TONES[nav.tone].iconBox}`}>
                                    <span className={`material-symbols-outlined text-[20px] ${TONES[nav.tone].text}`}>{nav.icon}</span>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-main">{t(`${P}.navigation.${nav.id}.title`)}</div>
                                    <div className="text-xs text-muted">{t(`${P}.navigation.${nav.id}.subtitle`)}</div>
                                </div>
                            </div>
                            <p className="text-sm text-muted leading-relaxed">{t(`${P}.navigation.${nav.id}.description`)}</p>
                            <div className={`text-xs font-medium ${TONES[nav.tone].text}`}>{t(`${P}.navigation.${nav.id}.bestFor`)}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* SECTION: Keyboard Shortcuts */}
            <section data-section-id="keyboard-shortcuts" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <SectionHeader id="shortcuts" icon="keyboard" t={t} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {SHORTCUT_GROUPS.map(group => (
                        <div key={group.id} className="rounded-2xl border border-surface bg-card p-5">
                            <div className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
                                {t(`${P}.shortcuts.groups.${group.id}`)}
                            </div>
                            <div className="divide-y divide-[var(--color-surface-border)]">
                                {group.rows.map(row => (
                                    <ShortcutRow
                                        key={row.id}
                                        keys={row.keys}
                                        action={t(`${P}.shortcuts.${group.id}.${row.id}`)}
                                        context={row.context ? t(`${P}.shortcuts.contexts.${row.context}`) : undefined}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <Callout type="tip">
                    {t(`${P}.shortcuts.tipBefore`)} <Keycap>?</Keycap> {t(`${P}.shortcuts.tipAfter`)}
                </Callout>
            </section>

            {/* SECTION: Glossary */}
            <section data-section-id="glossary" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <SectionHeader id="glossary" icon="dictionary" t={t} />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {GLOSSARY.map(entry => (
                        <GlossaryTerm
                            key={entry.id}
                            term={t(`${P}.glossary.${entry.id}.term`)}
                            definition={t(`${P}.glossary.${entry.id}.definition`)}
                            relatedLabel={t(`${P}.glossary.related`)}
                            relatedTerms={entry.related.map(r => t(`${P}.glossary.rel.${r}`))}
                        />
                    ))}
                </div>
            </section>

            {/* Final CTA */}
            <div className="rounded-2xl border border-surface bg-card p-5">
                <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[20px] text-primary">rocket_launch</span>
                    <div>
                        <div className="text-sm font-bold text-main">{t(`${P}.cta.title`)}</div>
                        <p className="text-sm text-muted mt-1 leading-relaxed">
                            {t(`${P}.cta.body`)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
