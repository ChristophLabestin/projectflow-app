import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const sprintsSections: HelpCenterSectionIndex[] = [
    {
        id: 'sprinter-overview',
        title: 'Sprints overview',
        summary: 'Understanding the Agile Sprint workflow in ProjectFlow.',
        content: 'How to use sprints to break down project work into manageable time-boxed iterations.',
        keywords: ['agile', 'scrum', 'iterations', 'timebox']
    },
    {
        id: 'backlog-planning',
        title: 'Backlog & planning',
        summary: 'Organizing your backlog and planning future sprints.',
        content: 'Prioritize work, assign tasks to sprints, and set sprint goals.',
        keywords: ['backlog', 'planning', 'prioritization', 'drag and drop']
    },
    {
        id: 'active-sprint',
        title: 'Active sprint execution',
        summary: 'Running the active sprint and tracking progress.',
        content: 'Using the board view, updating task status, and completing the sprint.',
        keywords: ['execution', 'kanban', 'board', 'complete', 'status']
    }
];

export const SprintsPage = (_props: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            {/* Hero Section */}
            <div className="rounded-[28px] border border-surface bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">
                    Agile Execution
                </div>
                <h2 className="text-3xl font-bold text-main mt-3">
                    Sprints & Iterations
                </h2>
                <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">
                    Sprints help teams focus on a set amount of work for a specific period (usually 1-2 weeks).
                    Move tasks from the backlog to a sprint, track progress on the active board, and deliver value iteratively.
                </p>
                <div className="flex items-center gap-4 mt-6">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                        <span className="material-symbols-outlined text-sm">directions_run</span>
                        Agile Workflow
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                        <span className="material-symbols-outlined text-sm">view_kanban</span>
                        Kanban Board
                    </div>
                </div>
            </div>

            {/* SECTION: Overview */}
            <section data-section-id="sprint-overview" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Workflow</div>
                        <h3 className="text-xl font-bold text-main mt-2">The Sprint Lifecycle</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            A sprint goes through three main stages: Planning, Active, and Completed.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">sync</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-slate-500">edit_calendar</span>
                            <span className="text-sm font-bold text-main">1. Planning</span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed">
                            Create a sprint (e.g., "Sprint 4") and set dates. Drag tasks from the backlog into this sprint. The sprint is not yet live.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-emerald-500">play_circle</span>
                            <span className="text-sm font-bold text-main">2. Active</span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed">
                            Click "Start Sprint" to make it active. This locks the scope (soft lock) and activates the Kanban board view for the team.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-sky-500">check_circle</span>
                            <span className="text-sm font-bold text-main">3. Completed</span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed">
                            When the end date is reached, complete the sprint. Remaining tasks can be moved to the backlog or the next sprint.
                        </p>
                    </div>
                </div>
            </section>

            {/* SECTION: Backlog Management */}
            <section data-section-id="backlog-planning" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Organization</div>
                        <h3 className="text-xl font-bold text-main mt-2">Backlog & Planning</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            The Sprints view is split into two columns: the Backlog (left) and your Sprints (right).
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">list_alt</span>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[16px] text-primary">drag_indicator</span>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-main">Drag and Drop</div>
                            <p className="text-xs text-muted mt-1">
                                Simply drag tasks from the backlog list onto any sprint card to assign them. You can also drag tasks between sprints.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[16px] text-amber-500">sort</span>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-main">Smart Sorting</div>
                            <p className="text-xs text-muted mt-1">
                                The backlog automatically sorts tasks by Due Date, bubbling urgent items to the top so you don't miss them.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION: Active Sprint */}
            <section data-section-id="active-sprint" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Focus</div>
                        <h3 className="text-xl font-bold text-main mt-2">Active Sprint Board</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            Once a sprint is started, the view switches to a focused Kanban board showing only that sprint's tasks.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">view_kanban</span>
                </div>

                <div className="rounded-2xl border border-surface bg-card p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
                        Board Features
                    </div>
                    <ul className="space-y-3">
                        <li className="flex items-center gap-3 text-sm text-main">
                            <span className="material-symbols-outlined text-[18px] text-subtle">check</span>
                            <span>Drag cards between columns (To Do → In Progress → Done) to update status.</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm text-main">
                            <span className="material-symbols-outlined text-[18px] text-subtle">check</span>
                            <span>See assignee avatars and due dates directly on the cards.</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm text-main">
                            <span className="material-symbols-outlined text-[18px] text-subtle">check</span>
                            <span>Use "Complete Sprint" at the top right when the cycle is finished.</span>
                        </li>
                    </ul>
                </div>
            </section>
        </div>
    );
};
