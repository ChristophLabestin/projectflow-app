import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const gettingStartedSections: HelpCenterSectionIndex[] = [
    {
        id: 'start-here',
        title: 'Start here',
        summary: 'A fast orientation to how the workspace, projects, and modules fit together.',
        content: 'Learn the core model: workspace, projects, and modules. Set a focus project and use the overview to guide what you do next.'
    },
    {
        id: 'before-you-begin',
        title: 'Before you begin',
        summary: 'A short checklist that makes everything else easier.',
        content: 'Confirm you are signed in, choose a project, and pin it so global actions stay consistent.'
    },
    {
        id: 'workspace-projects',
        title: 'Workspace and projects',
        summary: 'Understand where work lives and how it is organized.',
        content: 'A workspace is your organization. Projects are the initiatives inside it, each with their own modules and activity.'
    },
    {
        id: 'navigation-search',
        title: 'Navigation and search',
        summary: 'Move quickly with sidebar, breadcrumbs, and search.',
        content: 'Use the sidebar for module navigation, breadcrumbs for context, and the global search bar to jump to what you need.'
    },
    {
        id: 'first-session',
        title: 'Your first session',
        summary: 'A guided path to set up and start execution.',
        content: 'Create a project, set milestones, capture tasks, and check health to start moving.'
    },
    {
        id: 'shortcuts',
        title: 'Quick actions and shortcuts',
        summary: 'Global actions you can use from any page.',
        content: 'Use keyboard shortcuts to create tasks, flows, and issues quickly, and open Help with the question mark key.'
    },
    {
        id: 'stay-organized',
        title: 'Staying organized',
        summary: 'How to keep focus without losing context.',
        content: 'Use pinned items, clear statuses, and lightweight reviews to keep teams aligned.'
    }
];

const SectionCard = ({
    id,
    title,
    eyebrow,
    children,
    tone = 'bg-[var(--color-surface-bg)]'
}: {
    id: string;
    title: string;
    eyebrow?: string;
    children: React.ReactNode;
    tone?: string;
}) => (
    <section
        data-section-id={id}
        className={`help-section rounded-2xl border border-[var(--color-surface-border)] p-5 space-y-3 ${tone}`}
    >
        <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                {eyebrow || 'Guide'}
            </div>
            <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">
                info
            </span>
        </div>
        <h3 className="text-lg font-bold text-[var(--color-text-main)]">{title}</h3>
        <div className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            {children}
        </div>
    </section>
);

const Keycap = ({ children }: { children: React.ReactNode }) => (
    <span className="px-2 py-1 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] text-xs font-semibold text-[var(--color-text-main)]">
        {children}
    </span>
);

export const GettingStartedPage = ({ sections, activeSectionId, onSectionSelect }: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-8">
            <div className="rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                    Getting Started
                </div>
                <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                    Welcome to ProjectFlow
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-2 leading-relaxed">
                    This guide is your first stop. It explains how work is organized, how to move around quickly,
                    and how to begin a project without guessing. Think of the workspace as your organization and
                    projects as focused initiatives with their own modules, timelines, and health signals.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                        Navigation
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                        First project
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                        Shortcuts
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-6">
                <div className="space-y-6">
                    <SectionCard id="start-here" title="Start here" eyebrow="Overview">
                        ProjectFlow is designed for clarity. Every project has a dedicated overview so you can see
                        health, workload, and upcoming deadlines in one place. Start by choosing a project, then use
                        the overview to decide what should move next.
                    </SectionCard>

                    <SectionCard id="before-you-begin" title="Before you begin" eyebrow="Checklist">
                        Make sure you are signed in and that the right project is selected. Pin the project so global
                        actions like task creation always go to the correct context. If you are joining a team, open
                        the Team page to confirm your role and group access.
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
                            <div className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                                <div>
                                    Pinning a project keeps your shortcuts consistent and prevents accidental task
                                    creation in the wrong place.
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard id="workspace-projects" title="Workspace and projects" eyebrow="Core concepts">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
                                <div className="text-xs font-semibold text-[var(--color-text-main)]">Workspace</div>
                                <p className="text-sm text-[var(--color-text-muted)] mt-2">
                                    The workspace is your organization. It holds all projects, teams, and shared
                                    settings. Workspace-level pages like Dashboard, Calendar, and Team are always
                                    available from the sidebar.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
                                <div className="text-xs font-semibold text-[var(--color-text-main)]">Project</div>
                                <p className="text-sm text-[var(--color-text-muted)] mt-2">
                                    Projects are focused initiatives. Each project has its own modules, milestones,
                                    issues, and activity history. Project context changes the navigation and what you
                                    see in the header.
                                </p>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard id="navigation-search" title="Navigation and search" eyebrow="Orientation">
                        The sidebar is your main navigation, and it changes when you enter a project. Breadcrumbs show
                        exactly where you are. The global search bar helps you jump to tasks, ideas, or content without
                        switching screens. Use Help to open this guide at any time.
                    </SectionCard>

                    <SectionCard id="first-session" title="Your first session" eyebrow="Start a project">
                        <div className="space-y-3">
                            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
                                <div className="text-xs font-bold text-[var(--color-text-main)]">1. Create or pick a project</div>
                                <p className="text-sm text-[var(--color-text-muted)] mt-2">
                                    Use the sidebar to create a new project or open an existing one. Add a clear title
                                    and description so your team shares the same outcome.
                                </p>
                            </div>
                            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
                                <div className="text-xs font-bold text-[var(--color-text-main)]">2. Add milestones</div>
                                <p className="text-sm text-[var(--color-text-muted)] mt-2">
                                    Milestones anchor the timeline. Add a few checkpoints with dates and owners to
                                    keep delivery visible.
                                </p>
                            </div>
                            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
                                <div className="text-xs font-bold text-[var(--color-text-main)]">3. Capture tasks and issues</div>
                                <p className="text-sm text-[var(--color-text-muted)] mt-2">
                                    Break work into tasks and log blockers as issues. This turns ideas into executable
                                    steps and prevents silent risks.
                                </p>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard id="shortcuts" title="Quick actions and shortcuts" eyebrow="Speed">
                        Use shortcuts to keep momentum without leaving the screen you are on. These actions are
                        available anywhere in the app when a project is pinned.
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3 flex items-center gap-3">
                                <Keycap>Alt + T</Keycap>
                                <span className="text-sm text-[var(--color-text-muted)]">Create a task instantly</span>
                            </div>
                            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3 flex items-center gap-3">
                                <Keycap>Alt + I</Keycap>
                                <span className="text-sm text-[var(--color-text-muted)]">Start a new Flow</span>
                            </div>
                            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3 flex items-center gap-3">
                                <Keycap>Alt + B</Keycap>
                                <span className="text-sm text-[var(--color-text-muted)]">Log an issue or blocker</span>
                            </div>
                            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3 flex items-center gap-3">
                                <Keycap>?</Keycap>
                                <span className="text-sm text-[var(--color-text-muted)]">Open the Help Center</span>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard id="stay-organized" title="Staying organized" eyebrow="Habits">
                        Consistency is more important than complexity. Review the project overview weekly, keep task
                        statuses honest, and pin the most important item so it stays visible across pages. Small
                        routines prevent large surprises.
                    </SectionCard>
                </div>

                <aside className="hidden lg:block">
                    <div className="sticky top-6 space-y-4">
                        <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                On this page
                            </div>
                            <div className="mt-3 space-y-2">
                                {sections.map((section) => (
                                    <button
                                        key={section.id}
                                        onClick={() => onSectionSelect(section.id)}
                                        className={`w-full text-left text-sm font-medium transition-colors ${activeSectionId === section.id
                                            ? 'text-[var(--color-primary)]'
                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                            }`}
                                    >
                                        {section.title}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4 text-sm text-[var(--color-text-muted)]">
                            <div className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                <div>
                                    Want help with a specific screen? Use the Help button in the top bar to open this
                                    guide already focused on the page you are viewing.
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};
