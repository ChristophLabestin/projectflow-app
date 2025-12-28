import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const tasksIssuesSections: HelpCenterSectionIndex[] = [
    {
        id: 'task-fields',
        title: 'Task fields reference',
        summary: 'Complete documentation of every task field.',
        content: 'All fields available when creating or editing tasks with descriptions.',
        keywords: ['fields', 'metadata', 'configuration', 'task']
    },
    {
        id: 'status-workflow',
        title: 'Status workflow',
        summary: 'How tasks move through status stages.',
        content: 'The state machine behind task status with valid transitions.',
        keywords: ['status', 'workflow', 'kanban', 'transitions']
    },
    {
        id: 'priority-system',
        title: 'Priority system',
        summary: 'Understanding priority levels and usage.',
        content: 'How to use priority effectively to signal urgency.',
        keywords: ['priority', 'urgency', 'importance', 'levels']
    },
    {
        id: 'issues-blockers',
        title: 'Issues and blockers',
        summary: 'Tracking risks that could delay delivery.',
        content: 'How to log, categorize, and resolve issues.',
        keywords: ['issues', 'blockers', 'bugs', 'risks']
    },
    {
        id: 'checklists-subtasks',
        title: 'Checklists and subtasks',
        summary: 'Breaking work into smaller pieces.',
        content: 'Using checklists to track progress within tasks.',
        keywords: ['checklist', 'subtasks', 'progress', 'breakdown']
    },
    {
        id: 'comments-mentions',
        title: 'Comments and mentions',
        summary: 'Collaboration and communication on tasks.',
        content: 'How to use comments and @mentions effectively.',
        keywords: ['comments', 'mentions', 'notifications', 'collaboration']
    },
    {
        id: 'views-filters',
        title: 'Views and filters',
        summary: 'Organizing and finding tasks efficiently.',
        content: 'Board view, list view, filters, and saved views.',
        keywords: ['views', 'filters', 'board', 'list', 'kanban']
    },
    {
        id: 'bulk-actions',
        title: 'Bulk actions',
        summary: 'Working with multiple items at once.',
        content: 'Multi-select and batch operations for efficiency.',
        keywords: ['bulk', 'batch', 'multi-select', 'actions']
    }
];

/* ─────────────────────────────────────────────────────────────
   LAYOUT COMPONENTS - Kanban Inspired
───────────────────────────────────────────────────────────── */

const StatusColumn = ({
    status,
    color,
    count,
    description
}: {
    status: string;
    color: string;
    count: number;
    description: string;
}) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 min-w-[160px]">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-sm font-bold text-[var(--color-text-main)]">{status}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[10px] font-bold text-[var(--color-text-muted)]">
                {count}
            </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{description}</p>
    </div>
);

const TransitionArrow = () => (
    <div className="flex-shrink-0 flex items-center">
        <span className="material-symbols-outlined text-[var(--color-text-subtle)] text-[20px]">arrow_forward</span>
    </div>
);

const FieldRow = ({
    field,
    type,
    required,
    description
}: {
    field: string;
    type: string;
    required?: boolean;
    description: string;
}) => (
    <div className="flex items-start gap-4 py-3 border-b border-[var(--color-surface-border)] last:border-0">
        <div className="flex-shrink-0 w-[120px]">
            <span className="text-sm font-semibold text-[var(--color-text-main)]">{field}</span>
            {required && <span className="ml-1 text-rose-500 text-xs">*</span>}
        </div>
        <div className="flex-shrink-0 w-[80px]">
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[10px] font-medium text-[var(--color-text-muted)]">
                {type}
            </span>
        </div>
        <div className="flex-1 text-sm text-[var(--color-text-muted)]">{description}</div>
    </div>
);

const PriorityBadge = ({
    level,
    color,
    icon,
    usage
}: {
    level: string;
    color: string;
    icon: string;
    usage: string;
}) => (
    <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
        <div className="flex items-center gap-2 mb-2">
            <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
            <span className="text-sm font-bold text-[var(--color-text-main)]">{level}</span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{usage}</p>
    </div>
);

const IssueTypeCard = ({
    type,
    icon,
    color,
    description,
    examples
}: {
    type: string;
    icon: string;
    color: string;
    description: string;
    examples: string[];
}) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5 space-y-3">
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-[20px] text-white">{icon}</span>
            </div>
            <span className="text-sm font-bold text-[var(--color-text-main)]">{type}</span>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
        <div className="flex flex-wrap gap-2">
            {examples.map((ex, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-[var(--color-surface-hover)] text-[10px] font-medium text-[var(--color-text-muted)]">
                    {ex}
                </span>
            ))}
        </div>
    </div>
);

const ViewCard = ({
    icon,
    name,
    description,
    bestFor
}: {
    icon: string;
    name: string;
    description: string;
    bestFor: string;
}) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
        <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-[var(--color-primary)]">{icon}</span>
            </div>
            <span className="text-sm font-bold text-[var(--color-text-main)]">{name}</span>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-primary)]">
            <span className="material-symbols-outlined text-[14px]">recommend</span>
            {bestFor}
        </div>
    </div>
);

const FilterChip = ({ label, icon }: { label: string; icon: string }) => (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-card)]">
        <span className="material-symbols-outlined text-[14px] text-[var(--color-text-muted)]">{icon}</span>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">{label}</span>
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

const BulkActionCard = ({
    icon,
    action,
    description,
    shortcut
}: {
    icon: string;
    action: string;
    description: string;
    shortcut?: string;
}) => (
    <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-[18px] text-[var(--color-primary)]">{icon}</span>
        <div className="flex-1">
            <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--color-text-main)]">{action}</span>
                {shortcut && (
                    <span className="px-2 py-0.5 rounded-lg bg-[var(--color-surface-hover)] text-[10px] font-mono text-[var(--color-text-muted)]">
                        {shortcut}
                    </span>
                )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{description}</p>
        </div>
    </div>
);

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE COMPONENT
───────────────────────────────────────────────────────────── */

export const TasksIssuesPage = (_props: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            {/* Hero Section with Kanban Preview */}
            <div className="rounded-[28px] border border-[var(--color-surface-border)] bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                    Tasks and Issues
                </div>
                <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                    Turn Work into Visible Execution
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed max-w-2xl">
                    Tasks capture what needs to happen. Issues capture what could stop it. This guide covers every field,
                    status, workflow, and feature to help you execute with clarity.
                </p>

                {/* Quick Kanban Preview */}
                <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-2">
                    <StatusColumn status="Backlog" color="bg-slate-400" count={12} description="Waiting to start" />
                    <TransitionArrow />
                    <StatusColumn status="Open" color="bg-sky-500" count={5} description="Ready for work" />
                    <TransitionArrow />
                    <StatusColumn status="In Progress" color="bg-amber-500" count={3} description="Being worked on" />
                    <TransitionArrow />
                    <StatusColumn status="Done" color="bg-emerald-500" count={28} description="Completed" />
                </div>
            </div>

            {/* SECTION: Task Fields Reference */}
            <section data-section-id="task-fields" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Reference</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Task Fields Reference</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Complete documentation of every field available when creating or editing a task.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">checklist</span>
                </div>

                {/* Core Fields */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                        Core Fields
                    </div>
                    <div className="space-y-0">
                        <FieldRow field="Title" type="Text" required description="Short, action-oriented name. Should describe the outcome, not the activity." />
                        <FieldRow field="Description" type="Rich Text" description="Detailed context, acceptance criteria, links, and any relevant notes." />
                        <FieldRow field="Status" type="Select" required description="Current stage in the workflow. Options: Backlog, Open, In Progress, On Hold, Blocked, Done." />
                        <FieldRow field="Priority" type="Select" description="Urgency level. Options: None, Low, Medium, High, Urgent." />
                        <FieldRow field="Assignee" type="User" description="Person responsible for completing this task. Can be reassigned." />
                        <FieldRow field="Due Date" type="Date" description="Target completion date. Triggers overdue warning when passed." />
                    </div>
                </div>

                {/* Extended Fields */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                        Extended Fields
                    </div>
                    <div className="space-y-0">
                        <FieldRow field="Effort" type="Number" description="Story points or time estimate. Used for capacity planning and velocity." />
                        <FieldRow field="Tags" type="Multi-select" description="Labels for categorization. Custom tags defined at workspace level." />
                        <FieldRow field="Milestone" type="Reference" description="Link to a project milestone this task contributes to." />
                        <FieldRow field="Checklist" type="List" description="Subtasks or acceptance criteria. Progress shows as percentage." />
                        <FieldRow field="Attachments" type="Files" description="Supporting files, images, or documents attached to the task." />
                        <FieldRow field="Parent Task" type="Reference" description="For subtasks, the parent task this belongs to." />
                        <FieldRow field="Linked Issues" type="References" description="Related issues that block or affect this task." />
                    </div>
                </div>
            </section>

            {/* SECTION: Status Workflow */}
            <section data-section-id="status-workflow" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Workflow</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Status Workflow</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Tasks move through statuses as work progresses. Understanding the flow helps teams stay aligned.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">timeline</span>
                </div>

                {/* Status Flow Diagram */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                        Status Flow
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatusColumn status="Backlog" color="bg-slate-400" count={0} description="Captured but not ready to start. Low priority queue." />
                        <StatusColumn status="Open" color="bg-sky-500" count={0} description="Ready to be picked up. All prerequisites met." />
                        <StatusColumn status="In Progress" color="bg-amber-500" count={0} description="Someone is actively working on this right now." />
                        <StatusColumn status="On Hold" color="bg-purple-500" count={0} description="Paused temporarily. Waiting on decision or dependency." />
                        <StatusColumn status="Blocked" color="bg-rose-500" count={0} description="Cannot proceed. Requires external resolution." />
                        <StatusColumn status="Done" color="bg-emerald-500" count={0} description="Completed and verified. Meets acceptance criteria." />
                    </div>
                </div>

                {/* Transition Rules */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-3">
                            ✓ Good Status Hygiene
                        </div>
                        <ul className="space-y-2 text-sm text-emerald-800 dark:text-emerald-200">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Update status the moment work changes
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Use "In Progress" only when actively working
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Move stuck tasks to "On Hold" with a note
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Verify completion before marking "Done"
                            </li>
                        </ul>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800/40 dark:bg-rose-900/20">
                        <div className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-3">
                            ✗ Anti-Patterns
                        </div>
                        <ul className="space-y-2 text-sm text-rose-800 dark:text-rose-200">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Leaving tasks "In Progress" for weeks
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Skipping "Blocked" when there's a real blocker
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Marking "Done" without verification
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Having 10+ items "In Progress" at once
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* SECTION: Priority System */}
            <section data-section-id="priority-system" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Urgency</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Priority System</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Priority communicates urgency. Use it consistently so team members trust the signal.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">priority_high</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <PriorityBadge
                        level="None"
                        color="text-slate-400"
                        icon="remove"
                        usage="Default state. No specific urgency. Complete when capacity allows."
                    />
                    <PriorityBadge
                        level="Low"
                        color="text-slate-500"
                        icon="arrow_downward"
                        usage="Nice to have. Can be deferred if higher priorities need attention."
                    />
                    <PriorityBadge
                        level="Medium"
                        color="text-amber-500"
                        icon="drag_handle"
                        usage="Standard priority. Should complete on schedule but not before higher priorities."
                    />
                    <PriorityBadge
                        level="High"
                        color="text-orange-500"
                        icon="arrow_upward"
                        usage="Important work. Takes precedence over medium/low. Should complete soon."
                    />
                    <PriorityBadge
                        level="Urgent"
                        color="text-rose-500"
                        icon="priority_high"
                        usage="Drop everything. Must complete immediately. Reserve for true emergencies."
                    />
                </div>

                <Callout type="warning">
                    If everything is urgent, nothing is. Keep the urgent list small (1-2 items max) so it stays credible.
                </Callout>
            </section>

            {/* SECTION: Issues and Blockers */}
            <section data-section-id="issues-blockers" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Risk</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Issues and Blockers</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Issues are blockers, bugs, or risks that can delay delivery. Track them separately for visibility.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">report_problem</span>
                </div>

                {/* Issue Types */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <IssueTypeCard
                        type="Bug"
                        icon="bug_report"
                        color="bg-rose-500"
                        description="Something isn't working as expected. Defect in existing functionality."
                        examples={['Broken feature', 'UI glitch', 'Data error']}
                    />
                    <IssueTypeCard
                        type="Blocker"
                        icon="block"
                        color="bg-orange-500"
                        description="Prevents other work from proceeding. Critical path impediment."
                        examples={['Waiting approval', 'Missing access', 'Technical debt']}
                    />
                    <IssueTypeCard
                        type="Dependency"
                        icon="link"
                        color="bg-purple-500"
                        description="Requires something from another team or external source."
                        examples={['API from team B', 'Vendor response', 'Content from client']}
                    />
                    <IssueTypeCard
                        type="Risk"
                        icon="warning"
                        color="bg-amber-500"
                        description="Potential problem that could occur. Proactive risk tracking."
                        examples={['Scope creep', 'Timeline pressure', 'Resource gap']}
                    />
                </div>

                {/* Issue Status Flow */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                        Issue Lifecycle
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <StatusColumn status="Open" color="bg-rose-500" count={0} description="Reported, needs investigation" />
                        <TransitionArrow />
                        <StatusColumn status="In Progress" color="bg-amber-500" count={0} description="Being actively resolved" />
                        <TransitionArrow />
                        <StatusColumn status="Resolved" color="bg-sky-500" count={0} description="Fix applied, needs verification" />
                        <TransitionArrow />
                        <StatusColumn status="Closed" color="bg-emerald-500" count={0} description="Verified and complete" />
                    </div>
                </div>
            </section>

            {/* SECTION: Checklists and Subtasks */}
            <section data-section-id="checklists-subtasks" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Breakdown</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Checklists and Subtasks</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Break large tasks into smaller pieces. Track progress as you complete each step.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">task_alt</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Checklist Demo */}
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                            Example Checklist
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[18px] text-emerald-500">check_box</span>
                                <span className="text-sm text-[var(--color-text-muted)] line-through">Research requirements</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[18px] text-emerald-500">check_box</span>
                                <span className="text-sm text-[var(--color-text-muted)] line-through">Create initial design</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">check_box_outline_blank</span>
                                <span className="text-sm text-[var(--color-text-main)]">Implement functionality</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">check_box_outline_blank</span>
                                <span className="text-sm text-[var(--color-text-main)]">Write tests</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">check_box_outline_blank</span>
                                <span className="text-sm text-[var(--color-text-main)]">Code review</span>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
                                <div className="h-full w-[40%] bg-emerald-500 rounded-full" />
                            </div>
                            <span className="text-xs font-bold text-[var(--color-text-muted)]">40%</span>
                        </div>
                    </div>

                    {/* Best Practices */}
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                            Best Practices
                        </div>
                        <div className="space-y-4 text-sm text-[var(--color-text-muted)]">
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>
                                <span>Keep checklist items small and completable in one session</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>
                                <span>Use checklists for acceptance criteria on larger tasks</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>
                                <span>If an item needs its own assignee or due date, make it a subtask</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>
                                <span>Check items off as you complete them to show progress</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION: Comments and Mentions */}
            <section data-section-id="comments-mentions" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Collaboration</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Comments and Mentions</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Communicate directly on tasks. Use @mentions to notify specific people.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">chat</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Mention Syntax */}
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                            Mention Syntax
                        </div>
                        <div className="space-y-4">
                            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3">
                                <code className="text-sm text-[var(--color-primary)]">@username</code>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">Notify a specific person</p>
                            </div>
                            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3">
                                <code className="text-sm text-[var(--color-primary)]">@team</code>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">Notify the entire project team</p>
                            </div>
                            <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3">
                                <code className="text-sm text-[var(--color-primary)]">@assignee</code>
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">Notify whoever is assigned to this task</p>
                            </div>
                        </div>
                    </div>

                    {/* Notification Behavior */}
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                            Notification Behavior
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">notifications</span>
                                In-app notification for all mentions
                            </div>
                            <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-[16px] text-sky-500">mail</span>
                                Email notification (if enabled in settings)
                            </div>
                            <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-[16px] text-amber-500">schedule</span>
                                Batched if user has digest mode on
                            </div>
                        </div>
                    </div>
                </div>

                <Callout type="tip">
                    Good comment hygiene: Include current status, last decision, and next action. This helps handoffs go smoothly.
                </Callout>
            </section>

            {/* SECTION: Views and Filters */}
            <section data-section-id="views-filters" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Organization</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Views and Filters</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Organize tasks the way you work. Switch views and apply filters to focus on what matters.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">view_agenda</span>
                </div>

                {/* View Types */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ViewCard
                        icon="view_kanban"
                        name="Board View"
                        description="Kanban-style columns organized by status. Drag cards between columns to update status."
                        bestFor="Visual workflow management, daily standups"
                    />
                    <ViewCard
                        icon="view_list"
                        name="List View"
                        description="Traditional table with sortable columns. See all task details at a glance."
                        bestFor="Bulk editing, sorting, detailed analysis"
                    />
                </div>

                {/* Available Filters */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                        Available Filters
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <FilterChip label="Status" icon="toggle_on" />
                        <FilterChip label="Priority" icon="priority_high" />
                        <FilterChip label="Assignee" icon="person" />
                        <FilterChip label="Due Date" icon="calendar_today" />
                        <FilterChip label="Tags" icon="label" />
                        <FilterChip label="Milestone" icon="flag" />
                        <FilterChip label="Created By" icon="person_add" />
                        <FilterChip label="Updated" icon="update" />
                        <FilterChip label="Has Checklist" icon="checklist" />
                        <FilterChip label="Overdue" icon="warning" />
                    </div>
                </div>

                {/* Saved Views */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                        Saved Views
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                        Create saved views to quickly switch between different filter combinations. Views are personal by default
                        but can be shared with the team.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/10 text-sm font-medium text-[var(--color-primary)]">
                            My Tasks
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-hover)] text-sm font-medium text-[var(--color-text-muted)]">
                            Urgent This Week
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-hover)] text-sm font-medium text-[var(--color-text-muted)]">
                            Blocked Items
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-hover)] text-sm font-medium text-[var(--color-text-muted)]">
                            + New View
                        </span>
                    </div>
                </div>
            </section>

            {/* SECTION: Bulk Actions */}
            <section data-section-id="bulk-actions" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Efficiency</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Bulk Actions</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Work with multiple items at once. Select, update, and manage in batches.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">select_all</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <BulkActionCard
                        icon="checklist"
                        action="Change Status"
                        description="Set all selected items to the same status at once."
                        shortcut="S"
                    />
                    <BulkActionCard
                        icon="priority_high"
                        action="Change Priority"
                        description="Update priority for multiple items simultaneously."
                        shortcut="P"
                    />
                    <BulkActionCard
                        icon="person"
                        action="Reassign"
                        description="Change the assignee for all selected tasks."
                        shortcut="A"
                    />
                    <BulkActionCard
                        icon="calendar_today"
                        action="Set Due Date"
                        description="Apply the same due date to multiple items."
                        shortcut="D"
                    />
                    <BulkActionCard
                        icon="label"
                        action="Add Tags"
                        description="Tag multiple items with the same labels."
                        shortcut="T"
                    />
                    <BulkActionCard
                        icon="delete"
                        action="Archive/Delete"
                        description="Remove multiple items from view or delete them."
                        shortcut="Del"
                    />
                </div>

                <Callout type="info">
                    Select items by clicking the checkbox, or use Shift+Click to select a range. Press X to toggle selection on the focused item.
                </Callout>
            </section>
        </div>
    );
};
