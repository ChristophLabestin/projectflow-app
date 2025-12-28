import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const tasksIssuesSections: HelpCenterSectionIndex[] = [
    {
        id: 'task-lifecycle',
        title: 'Task lifecycle',
        summary: 'Move work from backlog to done with clear stages.',
        content: 'Tasks are the unit of execution. Keep titles outcome focused and update status as work moves.',
        keywords: ['tasks', 'workflow', 'execution']
    },
    {
        id: 'status-priority',
        title: 'Status and priority',
        summary: 'Signal urgency and progress consistently.',
        content: 'Status shows where work is; priority shows how important it is.',
        keywords: ['status', 'priority', 'urgency']
    },
    {
        id: 'issues-blockers',
        title: 'Issues and blockers',
        summary: 'Capture anything that can delay delivery.',
        content: 'Issues make risk visible so it can be resolved early.',
        keywords: ['issues', 'blockers', 'risk']
    },
    {
        id: 'ownership',
        title: 'Ownership and assignment',
        summary: 'Assign responsibility and keep accountability clear.',
        content: 'Assign owners or groups so work never gets stuck in limbo.',
        keywords: ['ownership', 'assignees']
    },
    {
        id: 'pinned-work',
        title: 'Pinned work',
        summary: 'Keep critical items visible across pages.',
        content: 'Pin tasks or issues to maintain focus while you navigate.',
        keywords: ['pinned', 'focus']
    }
];

const SectionHeader = ({
    eyebrow,
    title,
    icon
}: {
    eyebrow: string;
    title: string;
    icon: string;
}) => (
    <div className="flex items-start justify-between gap-4">
        <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                {eyebrow}
            </div>
            <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">{title}</h3>
        </div>
        <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">
            {icon}
        </span>
    </div>
);

const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 text-sm text-[var(--color-text-muted)] leading-relaxed">
        {children}
    </div>
);

const Callout = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
        <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            <div>{children}</div>
        </div>
    </div>
);

const StatusBadge = ({ label }: { label: string }) => (
    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border border-[var(--color-surface-border)]">
        {label}
    </span>
);

export const TasksIssuesPage = ({ sections, activeSectionId, onSectionSelect }: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-6">
                <div className="rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                        Tasks and Issues
                    </div>
                    <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                        Turn work into visible execution
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed">
                        Tasks capture what needs to happen. Issues capture what could stop it. When both are visible,
                        the team can prioritize, unblock, and deliver without guesswork.
                    </p>
                </div>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            In this guide
                        </div>
                        <div className="mt-3 space-y-2">
                            {sections.map(section => (
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
                        Keep task titles outcome focused and update status weekly. It is the fastest way to keep
                        delivery honest without meetings.
                    </div>
                </aside>
            </div>

            <section data-section-id="task-lifecycle" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Workflow" title="Task lifecycle" icon="checklist" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    A task should read like a mini outcome: a clear result that can be marked done. Avoid titles that
                    describe activity alone. Once created, move tasks through stages so everyone can read progress at
                    a glance.
                </p>
                <div className="flex flex-wrap gap-2">
                    <StatusBadge label="Backlog" />
                    <StatusBadge label="Open" />
                    <StatusBadge label="In Progress" />
                    <StatusBadge label="On Hold" />
                    <StatusBadge label="Blocked" />
                    <StatusBadge label="Done" />
                </div>
                <Card>
                    The most reliable signal is movement. If a task stays in the same status week after week, it is
                    either not prioritized or lacks ownership. Resolve one of those before creating more work.
                </Card>
            </section>

            <section data-section-id="status-priority" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Signals" title="Status and priority" icon="swap_vert" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[var(--color-text-muted)] leading-relaxed">
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Status answers "where is it?"
                        </div>
                        <p className="mt-3">
                            Status should change when work changes. Use "In Progress" only when someone is actively
                            working on the task. Use "Blocked" when progress depends on something external.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Priority answers "how important is it?"
                        </div>
                        <p className="mt-3">
                            Priority sets expectations. Reserve "Urgent" for work that must happen immediately and
                            keep the list small so it stays credible.
                        </p>
                    </div>
                </div>
                <Callout>
                    If everything is urgent, nothing is. Keep priority honest so people trust the signal.
                </Callout>
            </section>

            <section data-section-id="issues-blockers" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Risk" title="Issues and blockers" icon="report_problem" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Issues are blockers, bugs, or dependencies that can delay delivery. They should be created the
                    moment risk appears, not after it causes a delay. Link issues to affected tasks so impact is
                    visible and resolution can be tracked.
                </p>
                <div className="flex flex-wrap gap-2">
                    <StatusBadge label="Open" />
                    <StatusBadge label="In Progress" />
                    <StatusBadge label="Resolved" />
                    <StatusBadge label="Closed" />
                </div>
                <Card>
                    Resolve issues quickly by assigning ownership and documenting the next concrete action. This keeps
                    the issue list from turning into a backlog of unknowns.
                </Card>
            </section>

            <section data-section-id="ownership" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Accountability" title="Ownership and assignment" icon="group" />
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
                    <div className="text-sm text-[var(--color-text-muted)] leading-relaxed space-y-3">
                        <p>
                            Every task and issue should have an owner. Ownership is not about who does the work, it is
                            about who ensures the work gets done. When ownership is unclear, tasks stall and decisions
                            become slow.
                        </p>
                        <p>
                            Use comments for handoffs so new owners understand the current state. This makes transitions
                            smoother and prevents duplicate effort.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4 text-sm text-[var(--color-text-muted)] leading-relaxed">
                        A good handoff includes the current status, the last decision, and the next action. Anything
                        else can be discovered later.
                    </div>
                </div>
            </section>

            <section data-section-id="pinned-work" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Focus" title="Pinned work" icon="push_pin" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Pinned work keeps critical items visible across pages. It is ideal for high priority tasks,
                    active blockers, or leadership updates you do not want to lose track of.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        Pin the single most important item for the day. That focus keeps the team aligned and reduces
                        the chance of context switching.
                    </Card>
                    <Card>
                        Use pinned work as a lightweight personal queue. Unpin items once they are complete so the
                        list stays short and meaningful.
                    </Card>
                </div>
            </section>
        </div>
    );
};
