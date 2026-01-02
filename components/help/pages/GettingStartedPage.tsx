import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const gettingStartedSections: HelpCenterSectionIndex[] = [
    {
        id: 'workspace-anatomy',
        title: 'Workspace anatomy',
        summary: 'Understand the visual layout and navigation structure.',
        content: 'Learn where every element lives: sidebar, header, breadcrumbs, content area, and quick actions.',
        keywords: ['layout', 'interface', 'navigation', 'sidebar', 'header']
    },
    {
        id: 'core-concepts',
        title: 'Core concepts',
        summary: 'Master the fundamental building blocks of ProjectFlow.',
        content: 'Workspaces, projects, modules, flows, tasks, and issues form the foundation of everything you do.',
        keywords: ['concepts', 'workspace', 'project', 'module', 'flow']
    },
    {
        id: 'first-five-minutes',
        title: 'Your first 5 minutes',
        summary: 'A timed action checklist for immediate productivity.',
        content: 'Complete these actions in order to be productive from your first session.',
        keywords: ['onboarding', 'getting started', 'first steps', 'quick start']
    },
    {
        id: 'navigation-mastery',
        title: 'Navigation mastery',
        summary: 'Move through the app with speed and precision.',
        content: 'Use sidebar, breadcrumbs, search, and shortcuts to navigate anywhere instantly.',
        keywords: ['navigation', 'search', 'breadcrumbs', 'shortcuts']
    },
    {
        id: 'keyboard-shortcuts',
        title: 'Keyboard shortcuts',
        summary: 'Complete reference for all keyboard shortcuts.',
        content: 'Master all keyboard shortcuts to work faster and stay in flow.',
        keywords: ['keyboard', 'shortcuts', 'hotkeys', 'commands']
    },
    {
        id: 'glossary',
        title: 'Glossary of terms',
        summary: 'Definitions for all ProjectFlow terminology.',
        content: 'Reference guide for every term and concept used in the application.',
        keywords: ['glossary', 'terms', 'definitions', 'vocabulary']
    }
];

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
                    ? 'bg-emerald-500 text-white'
                    : isActive
                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                }
            `}
        >
            {isCompleted ? (
                <span className="material-symbols-outlined text-[16px]">check</span>
            ) : (
                step
            )}
        </div>
        <span className={`text-sm font-medium ${isActive ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
            {title}
        </span>
    </div>
);

const AnatomyLabel = ({
    label,
    description,
    position
}: {
    label: string;
    description: string;
    position: string;
}) => (
    <div className={`absolute ${position} z-10`}>
        <div className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-3 shadow-lg max-w-[180px]">
            <div className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">{label}</div>
            <div className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-relaxed">{description}</div>
        </div>
    </div>
);

const Keycap = ({ children }: { children: React.ReactNode }) => (
    <span className="px-2 py-1 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] text-xs font-semibold text-[var(--color-text-main)] font-mono">
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
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5 space-y-3">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-[var(--color-primary)]">{icon}</span>
            </div>
            <div className="text-base font-bold text-[var(--color-text-main)]">{title}</div>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
        <div className="flex flex-wrap gap-2">
            {examples.map((ex, i) => (
                <span
                    key={i}
                    className="px-2 py-1 rounded-lg bg-[var(--color-surface-hover)] text-[10px] font-medium text-[var(--color-text-muted)]"
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
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/70 flex items-center justify-center text-white font-bold">
            {number}
        </div>
        <div className="flex-1 rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
            <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-[var(--color-text-main)]">{title}</div>
                <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[10px] font-medium text-[var(--color-text-muted)]">
                    ~{time}
                </span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mt-2 leading-relaxed">{description}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-primary)]">
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
    <div className="flex items-center justify-between py-3 border-b border-[var(--color-surface-border)] last:border-0">
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
                {keys.map((key, i) => (
                    <Keycap key={i}>{key}</Keycap>
                ))}
            </div>
            {context && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[10px] text-[var(--color-text-muted)]">
                    {context}
                </span>
            )}
        </div>
        <span className="text-sm text-[var(--color-text-muted)]">{action}</span>
    </div>
);

const GlossaryTerm = ({
    term,
    definition,
    relatedTerms
}: {
    term: string;
    definition: string;
    relatedTerms?: string[];
}) => (
    <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
        <div className="text-sm font-bold text-[var(--color-text-main)]">{term}</div>
        <p className="text-sm text-[var(--color-text-muted)] mt-2 leading-relaxed">{definition}</p>
        {relatedTerms && relatedTerms.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-[var(--color-text-subtle)]">Related:</span>
                {relatedTerms.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[10px] text-[var(--color-text-muted)]">
                        {t}
                    </span>
                ))}
            </div>
        )}
    </div>
);

const Callout = ({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) => {
    const styles = {
        tip: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200',
        warning: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200',
        info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/40 dark:bg-sky-900/20 dark:text-sky-200'
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

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE COMPONENT
───────────────────────────────────────────────────────────── */

export const GettingStartedPage = (_props: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            {/* Hero Section with Journey Map */}
            <div className="rounded-[28px] border border-[var(--color-surface-border)] bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                    Getting Started
                </div>
                <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                    Welcome to ProjectFlow
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed max-w-2xl">
                    This comprehensive guide will take you from first login to confident daily use. Learn the workspace model,
                    master navigation, and establish habits that keep your team aligned and projects moving.
                </p>

                {/* Journey Progress */}
                <div className="mt-6 flex flex-wrap gap-6">
                    <ProgressStep step={1} title="Understand the Layout" isCompleted />
                    <ProgressStep step={2} title="Learn Core Concepts" isActive />
                    <ProgressStep step={3} title="Complete First Actions" />
                    <ProgressStep step={4} title="Master Navigation" />
                    <ProgressStep step={5} title="Customize Settings" />
                </div>
            </div>

            {/* SECTION: Workspace Anatomy */}
            <section data-section-id="workspace-anatomy" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Interface</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Workspace Anatomy</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Every screen in ProjectFlow follows a consistent layout. Understanding these regions helps you navigate
                            faster and find features without hunting.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">dashboard</span>
                </div>

                {/* Visual Diagram */}
                <div className="relative rounded-2xl border-2 border-dashed border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 min-h-[320px]">
                    {/* Sidebar Region */}
                    <div className="absolute left-4 top-4 bottom-4 w-[180px] rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-[32px] text-[var(--color-primary)]/50">menu</span>
                        <span className="text-xs font-bold text-[var(--color-primary)] mt-2">SIDEBAR</span>
                    </div>

                    {/* Header Region */}
                    <div className="absolute left-[200px] right-4 top-4 h-[52px] rounded-xl border border-sky-400/30 bg-sky-400/5 flex items-center justify-center">
                        <span className="text-xs font-bold text-sky-500">HEADER</span>
                    </div>

                    {/* Content Region */}
                    <div className="absolute left-[200px] right-4 top-[72px] bottom-4 rounded-xl border border-emerald-400/30 bg-emerald-400/5 flex items-center justify-center">
                        <span className="text-xs font-bold text-emerald-500">CONTENT AREA</span>
                    </div>
                </div>

                {/* Region Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4">
                        <div className="flex items-center gap-2 text-[var(--color-primary)]">
                            <span className="material-symbols-outlined text-[18px]">menu</span>
                            <span className="text-sm font-bold">Sidebar</span>
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                                Workspace navigation
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                                Project modules
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                                Quick actions
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                                Module counts
                            </li>
                        </ul>
                    </div>
                    <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
                        <div className="flex items-center gap-2 text-sky-500">
                            <span className="material-symbols-outlined text-[18px]">web_asset</span>
                            <span className="text-sm font-bold">Header</span>
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                Breadcrumb navigation
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                Global search
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                Notifications
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                User menu
                            </li>
                        </ul>
                    </div>
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                        <div className="flex items-center gap-2 text-emerald-500">
                            <span className="material-symbols-outlined text-[18px]">view_quilt</span>
                            <span className="text-sm font-bold">Content Area</span>
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Page content
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Lists and cards
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Detail panels
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Forms and modals
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* SECTION: Core Concepts */}
            <section data-section-id="core-concepts" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Foundation</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Core Concepts</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            These are the fundamental building blocks you'll work with every day. Understanding how they
                            relate to each other is key to organizing work effectively.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">hub</span>
                </div>

                {/* Hierarchy Diagram */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Hierarchy</div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-text)] font-bold text-sm">Workspace</div>
                        <span className="material-symbols-outlined text-[var(--color-text-subtle)]">arrow_forward</span>
                        <div className="px-4 py-2 rounded-xl bg-[var(--color-primary)]/80 text-[var(--color-primary-text)] font-bold text-sm">Projects</div>
                        <span className="material-symbols-outlined text-[var(--color-text-subtle)]">arrow_forward</span>
                        <div className="px-4 py-2 rounded-xl bg-[var(--color-primary)]/60 text-[var(--color-primary-text)] font-bold text-sm">Modules</div>
                        <span className="material-symbols-outlined text-[var(--color-text-subtle)]">arrow_forward</span>
                        <div className="px-4 py-2 rounded-xl bg-[var(--color-primary)]/40 text-[var(--color-primary-text)] font-bold text-sm">Items</div>
                    </div>
                </div>

                {/* Concept Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ConceptCard
                        icon="business"
                        title="Workspace"
                        description="Your organization's home. Contains all projects, team members, and global settings. You belong to one workspace."
                        examples={['Company', 'Organization', 'Team']}
                    />
                    <ConceptCard
                        icon="folder"
                        title="Project"
                        description="A focused initiative with its own timeline, team, and deliverables. Projects contain modules and have their own settings."
                        examples={['Product Launch', 'Q4 Campaign', 'Website Redesign']}
                    />
                    <ConceptCard
                        icon="category"
                        title="Module"
                        description="A feature area within a project. Each module handles a specific type of work. You can enable only what you need."
                        examples={['Tasks', 'Issues', 'Flows', 'Milestones']}
                    />
                    <ConceptCard
                        icon="flow_chart"
                        title="Flow"
                        description="Strategic work that goes through stages before becoming executable. Captures intent, research, and decisions."
                        examples={['Product Brief', 'Campaign Concept', 'Feature Spec']}
                    />
                    <ConceptCard
                        icon="checklist"
                        title="Task"
                        description="An actionable item with clear ownership and deadline. The unit of execution that moves projects forward."
                        examples={['Design mockup', 'Review PR', 'Write copy']}
                    />
                    <ConceptCard
                        icon="report_problem"
                        title="Issue"
                        description="A blocker, bug, or risk that could delay delivery. Issues are resolved through investigation and action."
                        examples={['Bug', 'Dependency', 'Blocker', 'Risk']}
                    />
                </div>

                <Callout type="tip">
                    Think of Flows as the "why" and "what", while Tasks are the "how". Flows capture strategy; Tasks capture execution.
                </Callout>
            </section>

            {/* SECTION: First 5 Minutes */}
            <section data-section-id="first-five-minutes" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Quick Start</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Your First 5 Minutes</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Complete these actions in order to become productive immediately. Each step builds on the previous one.
                        </p>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold dark:bg-emerald-900/30 dark:text-emerald-300">
                        ~5 min
                    </div>
                </div>

                <div className="space-y-4">
                    <ActionStep
                        number={1}
                        title="Confirm your profile"
                        description="Upload a photo, add your name and role, and set your notification preferences so teammates can identify you."
                        time="30s"
                        action="Click your avatar dropdown → Profile"
                    />
                    <ActionStep
                        number={2}
                        title="Open or create a project"
                        description="Select an existing project from the sidebar or create a new one. Give it a clear, outcome-focused title."
                        time="1 min"
                        action="Sidebar → Projects → Select or Create"
                    />
                    <ActionStep
                        number={3}
                        title="Pin your focus project"
                        description="Pin the project you'll be working on most. This keeps global shortcuts and quick actions targeted correctly."
                        time="10s"
                        action="Project header → Pin button"
                    />
                    <ActionStep
                        number={4}
                        title="Create your first task"
                        description="Log a task with a clear outcome. Assign yourself and set a due date so it appears in your personal view."
                        time="1 min"
                        action="Alt+T or Tasks module → + New Task"
                    />
                    <ActionStep
                        number={5}
                        title="Review the project overview"
                        description="Check the overview page to understand project health, workload, and upcoming deadlines at a glance."
                        time="1 min"
                        action="Sidebar → Project → Overview"
                    />
                </div>

                <Callout type="info">
                    Don't worry about getting everything perfect. You can always update settings and reorganize later.
                    The goal is momentum, not perfection.
                </Callout>
            </section>

            {/* SECTION: Navigation Mastery */}
            <section data-section-id="navigation-mastery" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Movement</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Navigation Mastery</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Learn the four navigation systems and when to use each one for maximum speed.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">explore</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[20px] text-[var(--color-primary)]">menu</span>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-[var(--color-text-main)]">Sidebar</div>
                                <div className="text-xs text-[var(--color-text-muted)]">Primary navigation</div>
                            </div>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                            The sidebar is context-aware. At workspace level, it shows global pages. Inside a project, it shows project modules.
                        </p>
                        <div className="text-xs text-[var(--color-primary)] font-medium">Best for: Switching between modules and projects</div>
                    </div>

                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[20px] text-sky-500">chevron_right</span>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-[var(--color-text-main)]">Breadcrumbs</div>
                                <div className="text-xs text-[var(--color-text-muted)]">Location awareness</div>
                            </div>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                            Breadcrumbs show exactly where you are and let you jump back to any parent level with one click.
                        </p>
                        <div className="text-xs text-sky-500 font-medium">Best for: Going back up the hierarchy</div>
                    </div>

                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[20px] text-emerald-500">search</span>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-[var(--color-text-main)]">Global Search</div>
                                <div className="text-xs text-[var(--color-text-muted)]">Find anything</div>
                            </div>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                            Search instantly finds tasks, projects, flows, and people. Type anywhere and results appear immediately.
                        </p>
                        <div className="text-xs text-emerald-500 font-medium">Best for: Jumping directly to any item</div>
                    </div>

                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[20px] text-amber-500">keyboard</span>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-[var(--color-text-main)]">Keyboard Shortcuts</div>
                                <div className="text-xs text-[var(--color-text-muted)]">Power user mode</div>
                            </div>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                            Shortcuts let you create items, navigate, and trigger actions without reaching for the mouse.
                        </p>
                        <div className="text-xs text-amber-500 font-medium">Best for: Staying in flow while working</div>
                    </div>
                </div>
            </section>

            {/* SECTION: Keyboard Shortcuts */}
            <section data-section-id="keyboard-shortcuts" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Hotkeys</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Keyboard Shortcuts</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Complete reference for all keyboard shortcuts. These work from anywhere in the app when a project is pinned.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">keyboard</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Global Shortcuts */}
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                            Global Actions
                        </div>
                        <div className="divide-y divide-[var(--color-surface-border)]">
                            <ShortcutRow keys={['Alt', 'T']} action="Create new task" />
                            <ShortcutRow keys={['Alt', 'I']} action="Start new flow" />
                            <ShortcutRow keys={['Alt', 'B']} action="Log issue/blocker" />
                            <ShortcutRow keys={['?']} action="Open help center" />
                            <ShortcutRow keys={['/']} action="Focus search bar" />
                            <ShortcutRow keys={['Esc']} action="Close modal/panel" />
                        </div>
                    </div>

                    {/* Navigation Shortcuts */}
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                            Navigation
                        </div>
                        <div className="divide-y divide-[var(--color-surface-border)]">
                            <ShortcutRow keys={['G', 'H']} action="Go to Dashboard" />
                            <ShortcutRow keys={['G', 'P']} action="Go to Projects" />
                            <ShortcutRow keys={['G', 'T']} action="Go to Tasks" />
                            <ShortcutRow keys={['G', 'O']} action="Go to Overview" context="In project" />
                            <ShortcutRow keys={['[']} action="Previous item in list" />
                            <ShortcutRow keys={[']']} action="Next item in list" />
                        </div>
                    </div>

                    {/* Editing Shortcuts */}
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                            Editing
                        </div>
                        <div className="divide-y divide-[var(--color-surface-border)]">
                            <ShortcutRow keys={['E']} action="Edit current item" context="Detail view" />
                            <ShortcutRow keys={['Cmd', 'Enter']} action="Save and close" />
                            <ShortcutRow keys={['Cmd', 'Shift', 'Enter']} action="Save and create new" />
                            <ShortcutRow keys={['Cmd', 'K']} action="Insert link" context="In editor" />
                            <ShortcutRow keys={['Cmd', 'B']} action="Bold text" context="In editor" />
                        </div>
                    </div>

                    {/* Selection Shortcuts */}
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                            Selection & Actions
                        </div>
                        <div className="divide-y divide-[var(--color-surface-border)]">
                            <ShortcutRow keys={['X']} action="Toggle selection" context="List view" />
                            <ShortcutRow keys={['Shift', '↑/↓']} action="Extend selection" context="List view" />
                            <ShortcutRow keys={['Cmd', 'A']} action="Select all" context="List view" />
                            <ShortcutRow keys={['Delete']} action="Delete selected" context="With selection" />
                            <ShortcutRow keys={['M']} action="Move to..." context="With selection" />
                        </div>
                    </div>
                </div>

                <Callout type="tip">
                    Press <Keycap>?</Keycap> anytime to see all available shortcuts for your current context.
                </Callout>
            </section>

            {/* SECTION: Glossary */}
            <section data-section-id="glossary" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Reference</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Glossary of Terms</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Quick definitions for all terminology used throughout ProjectFlow.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">dictionary</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <GlossaryTerm
                        term="Workspace"
                        definition="The top-level container for your organization. Contains all projects, team members, and settings."
                        relatedTerms={['Project', 'Team']}
                    />
                    <GlossaryTerm
                        term="Project"
                        definition="A focused initiative with its own timeline, modules, and team. The main unit of organized work."
                        relatedTerms={['Module', 'Milestone']}
                    />
                    <GlossaryTerm
                        term="Module"
                        definition="A feature area within a project (Tasks, Flows, Issues, etc.). Can be enabled or disabled per project."
                        relatedTerms={['Project', 'Task', 'Flow']}
                    />
                    <GlossaryTerm
                        term="Flow"
                        definition="Strategic work that progresses through stages. Captures intent and decisions before execution begins."
                        relatedTerms={['Stage', 'Conversion']}
                    />
                    <GlossaryTerm
                        term="Stage"
                        definition="A phase in a Flow's lifecycle. Each stage has specific requirements and outputs before moving forward."
                        relatedTerms={['Flow', 'Approval']}
                    />
                    <GlossaryTerm
                        term="Task"
                        definition="An actionable work item with ownership and deadline. The smallest unit of trackable execution."
                        relatedTerms={['Status', 'Priority', 'Assignee']}
                    />
                    <GlossaryTerm
                        term="Issue"
                        definition="A blocker, bug, or risk that could delay delivery. Tracked separately to ensure visibility."
                        relatedTerms={['Blocker', 'Task']}
                    />
                    <GlossaryTerm
                        term="Milestone"
                        definition="A delivery checkpoint with a target date. Used to track progress toward major outcomes."
                        relatedTerms={['Project', 'Timeline']}
                    />
                    <GlossaryTerm
                        term="Health"
                        definition="A composite signal showing project risk based on tasks, issues, milestones, and activity."
                        relatedTerms={['Workload', 'Overview']}
                    />
                    <GlossaryTerm
                        term="Pinned"
                        definition="A project or item marked as primary focus. Keeps shortcuts and quick actions targeting the right context."
                        relatedTerms={['Project', 'Shortcut']}
                    />
                    <GlossaryTerm
                        term="Assignee"
                        definition="The person responsible for completing a task or resolving an issue. Ownership drives accountability."
                        relatedTerms={['Task', 'Issue', 'Owner']}
                    />
                    <GlossaryTerm
                        term="Conversion"
                        definition="Turning a Flow into executable items (tasks, campaigns) while maintaining traceability to the source."
                        relatedTerms={['Flow', 'Task', 'Campaign']}
                    />
                </div>
            </section>

            {/* Final CTA */}
            <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-primary)]">rocket_launch</span>
                    <div>
                        <div className="text-sm font-bold text-[var(--color-text-main)]">You're ready to go!</div>
                        <p className="text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed">
                            Explore the other help pages to learn about specific features like Projects, Tasks, Flows, and CORA tools.
                            Use the Help button anytime to get context-aware guidance for the page you're on.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
