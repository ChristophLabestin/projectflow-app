import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const projectsSections: HelpCenterSectionIndex[] = [
    {
        id: 'project-fields',
        title: 'Project fields reference',
        summary: 'Complete documentation of every project field and setting.',
        content: 'All fields available when creating or editing projects, with descriptions and usage guidelines.',
        keywords: ['fields', 'settings', 'metadata', 'configuration']
    },
    {
        id: 'status-priority',
        title: 'Status and priority',
        summary: 'Understanding project status and priority levels.',
        content: 'How to use status and priority to communicate project state and importance.',
        keywords: ['status', 'priority', 'urgency', 'progress']
    },
    {
        id: 'health-signals',
        title: 'Health and signals',
        summary: 'How project health is calculated and what signals mean.',
        content: 'The formula behind health scores and how to interpret warning signals.',
        keywords: ['health', 'score', 'risk', 'signals', 'warning']
    },
    {
        id: 'modules-catalog',
        title: 'Modules catalog',
        summary: 'Complete list of available project modules.',
        content: 'Every module you can enable with descriptions and use cases.',
        keywords: ['modules', 'tasks', 'flows', 'issues', 'milestones']
    },
    {
        id: 'visibility-access',
        title: 'Visibility and access',
        summary: 'Control who can see and edit your project.',
        content: 'Group visibility, team roles, and sharing options.',
        keywords: ['visibility', 'access', 'permissions', 'sharing', 'groups']
    },
    {
        id: 'project-overview',
        title: 'Project overview page',
        summary: 'Your command center for project status.',
        content: 'How to use the overview dashboard effectively.',
        keywords: ['overview', 'dashboard', 'summary', 'hub']
    },
    {
        id: 'activity-tracking',
        title: 'Activity and history',
        summary: 'Track changes and understand project history.',
        content: 'Activity logs, change tracking, and audit trails.',
        keywords: ['activity', 'history', 'changes', 'audit', 'log']
    }
];

/* ─────────────────────────────────────────────────────────────
   LAYOUT COMPONENTS - Dashboard Style
───────────────────────────────────────────────────────────── */

const MetricCard = ({
    label,
    value,
    icon,
    color
}: {
    label: string;
    value: string;
    icon: string;
    color: 'blue' | 'green' | 'amber' | 'rose' | 'purple';
}) => {
    const colors = {
        blue: 'bg-sky-500/10 text-sky-500 border-sky-200 dark:border-sky-800/40',
        green: 'bg-emerald-500/10 text-emerald-500 border-emerald-200 dark:border-emerald-800/40',
        amber: 'bg-amber-500/10 text-amber-500 border-amber-200 dark:border-amber-800/40',
        rose: 'bg-rose-500/10 text-rose-500 border-rose-200 dark:border-rose-800/40',
        purple: 'bg-purple-500/10 text-purple-500 border-purple-200 dark:border-purple-800/40'
    };
    return (
        <div className={`rounded-2xl border p-4 ${colors[color]}`}>
            <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-[24px]">{icon}</span>
                <span className="text-2xl font-bold">{value}</span>
            </div>
            <div className="text-xs font-medium mt-2 opacity-80">{label}</div>
        </div>
    );
};

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
        <div className="flex-shrink-0 w-[140px]">
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

const StatusBadge = ({
    status,
    color,
    description
}: {
    status: string;
    color: string;
    description: string;
}) => (
    <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
        <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${color}`} />
            <span className="text-sm font-bold text-[var(--color-text-main)]">{status}</span>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mt-2 leading-relaxed">{description}</p>
    </div>
);

const HealthGauge = ({
    level,
    color,
    label,
    triggers
}: {
    level: number;
    color: string;
    label: string;
    triggers: string[];
}) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
        <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-[var(--color-text-main)]">{label}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${color}`}>{level}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
            <div className={`h-full rounded-full ${color.replace('text-', 'bg-').replace('bg-', 'bg-')}`} style={{ width: `${level}%` }} />
        </div>
        <div className="mt-4 text-xs text-[var(--color-text-muted)]">
            <div className="font-semibold mb-2">Triggered by:</div>
            <ul className="space-y-1">
                {triggers.map((t, i) => (
                    <li key={i} className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-[var(--color-text-subtle)]" />
                        {t}
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

const ModuleCard = ({
    icon,
    name,
    description,
    features
}: {
    icon: string;
    name: string;
    description: string;
    features: string[];
}) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5 space-y-3">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-[var(--color-primary)]">{icon}</span>
            </div>
            <div>
                <div className="text-sm font-bold text-[var(--color-text-main)]">{name}</div>
            </div>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
        <div className="flex flex-wrap gap-2">
            {features.map((f, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-[var(--color-surface-hover)] text-[10px] font-medium text-[var(--color-text-muted)]">
                    {f}
                </span>
            ))}
        </div>
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

const OverviewCard = ({
    icon,
    title,
    items
}: {
    icon: string;
    title: string;
    items: { label: string; description: string }[];
}) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
        <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] text-[var(--color-primary)]">{icon}</span>
            <span className="text-sm font-bold text-[var(--color-text-main)]">{title}</span>
        </div>
        <div className="space-y-3">
            {items.map((item, i) => (
                <div key={i}>
                    <div className="text-xs font-semibold text-[var(--color-text-main)]">{item.label}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">{item.description}</div>
                </div>
            ))}
        </div>
    </div>
);

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE COMPONENT
───────────────────────────────────────────────────────────── */

export const ProjectsPage = (_props: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            {/* Hero Section */}
            <div className="rounded-[28px] border border-[var(--color-surface-border)] bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                    Projects
                </div>
                <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                    The Center of Execution
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed max-w-2xl">
                    Projects are focused initiatives with their own modules, timelines, teams, and health signals.
                    This guide covers every field, setting, and feature available to help you organize and track delivery.
                </p>

                {/* Quick Stats Preview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <MetricCard label="Active Tasks" value="24" icon="checklist" color="blue" />
                    <MetricCard label="Open Issues" value="3" icon="report_problem" color="amber" />
                    <MetricCard label="Milestones" value="5" icon="flag" color="green" />
                    <MetricCard label="Team Size" value="8" icon="group" color="purple" />
                </div>
            </div>

            {/* SECTION: Project Fields Reference */}
            <section data-section-id="project-fields" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Reference</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Project Fields Reference</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Complete documentation of every field available when creating or editing a project.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">list_alt</span>
                </div>

                {/* Core Fields Table */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                        Core Fields
                    </div>
                    <div className="space-y-0">
                        <FieldRow field="Title" type="Text" required description="The project name. Should describe the outcome, not the activity. Max 100 characters." />
                        <FieldRow field="Description" type="Rich Text" description="Detailed context about the project's purpose, scope, and goals. Supports markdown formatting." />
                        <FieldRow field="Status" type="Select" required description="Current state of the project. Options: Planning, Active, On Hold, Completed, Archived." />
                        <FieldRow field="Priority" type="Select" description="Importance relative to other projects. Options: None, Low, Medium, High, Critical." />
                        <FieldRow field="Owner" type="User" description="Primary responsible person who makes decisions and ensures progress." />
                        <FieldRow field="Start Date" type="Date" description="When work on this project begins. Used for timeline visualization." />
                        <FieldRow field="Due Date" type="Date" description="Target completion date. Triggers overdue warnings when passed." />
                        <FieldRow field="Tags" type="Multi-select" description="Labels for categorization and filtering. Can be custom-defined per workspace." />
                    </div>
                </div>

                {/* Settings Fields Table */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                        Settings & Configuration
                    </div>
                    <div className="space-y-0">
                        <FieldRow field="Cover Image" type="Image" description="Visual header for the project. Displayed on project cards and overview page." />
                        <FieldRow field="Color" type="Color" description="Accent color for visual identification in lists and calendars." />
                        <FieldRow field="Visibility" type="Select" description="Who can see this project. Options: Workspace, Specific Groups, Team Only." />
                        <FieldRow field="Enabled Modules" type="Multi-select" description="Which modules are active. Disabled modules are hidden from navigation." />
                        <FieldRow field="Team Members" type="Users" description="People assigned to work on this project. Controls access and visibility." />
                        <FieldRow field="GitHub Repo" type="URL" description="Linked repository for development tracking and PR integration." />
                    </div>
                </div>
            </section>

            {/* SECTION: Status and Priority */}
            <section data-section-id="status-priority" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Signals</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Status and Priority</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Status tells you where a project is in its lifecycle. Priority tells you how important it is relative to other work.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">tune</span>
                </div>

                {/* Status Options */}
                <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Project Statuses</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <StatusBadge
                            status="Planning"
                            color="bg-slate-400"
                            description="Project is being scoped and defined. Work hasn't started yet."
                        />
                        <StatusBadge
                            status="Active"
                            color="bg-emerald-500"
                            description="Project is in progress with ongoing work and deliverables."
                        />
                        <StatusBadge
                            status="On Hold"
                            color="bg-amber-500"
                            description="Work is paused due to blockers, dependencies, or reprioritization."
                        />
                        <StatusBadge
                            status="Completed"
                            color="bg-sky-500"
                            description="All objectives achieved. Project delivered successfully."
                        />
                        <StatusBadge
                            status="Archived"
                            color="bg-slate-300"
                            description="Project is closed and no longer active. Hidden from default views."
                        />
                    </div>
                </div>

                {/* Priority Options */}
                <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Priority Levels</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatusBadge status="None" color="bg-slate-300" description="No priority set. Default for new projects." />
                        <StatusBadge status="Low" color="bg-slate-400" description="Can be deferred. Complete when resources allow." />
                        <StatusBadge status="Medium" color="bg-amber-400" description="Normal priority. Should be completed on schedule." />
                        <StatusBadge status="High" color="bg-orange-500" description="Important work. Takes precedence over lower priorities." />
                        <StatusBadge status="Critical" color="bg-rose-500" description="Must complete immediately. Blocks other work." />
                    </div>
                </div>

                <Callout type="tip">
                    Keep priority honest. If everything is critical, nothing is. Reserve high priorities for work that truly demands immediate attention.
                </Callout>
            </section>

            {/* SECTION: Health and Signals */}
            <section data-section-id="health-signals" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Analytics</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Health and Signals</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Project health is a composite score calculated from multiple factors. Understanding these signals helps you identify risks early.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">health_and_safety</span>
                </div>

                {/* Health Score Formula */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                        Health Score Formula
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="px-3 py-1.5 rounded-lg bg-sky-100 text-sky-700 font-medium dark:bg-sky-900/30 dark:text-sky-300">Task Progress (25%)</span>
                        <span className="text-[var(--color-text-subtle)]">+</span>
                        <span className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 font-medium dark:bg-rose-900/30 dark:text-rose-300">Issue Count (25%)</span>
                        <span className="text-[var(--color-text-subtle)]">+</span>
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-medium dark:bg-emerald-900/30 dark:text-emerald-300">Milestone Health (25%)</span>
                        <span className="text-[var(--color-text-subtle)]">+</span>
                        <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 font-medium dark:bg-amber-900/30 dark:text-amber-300">Activity Recency (25%)</span>
                    </div>
                </div>

                {/* Health Levels */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <HealthGauge
                        level={85}
                        color="text-emerald-500"
                        label="Healthy"
                        triggers={[
                            'Tasks completing on schedule',
                            'Few or no open issues',
                            'Milestones on track',
                            'Recent activity in last 3 days'
                        ]}
                    />
                    <HealthGauge
                        level={55}
                        color="text-amber-500"
                        label="Warning"
                        triggers={[
                            'Tasks overdue or stuck',
                            'Multiple open issues',
                            'Milestone at risk',
                            'No activity in past week'
                        ]}
                    />
                    <HealthGauge
                        level={25}
                        color="text-rose-500"
                        label="Critical"
                        triggers={[
                            'Many overdue tasks',
                            'Blocking issues unresolved',
                            'Milestone missed',
                            'No activity in 2+ weeks'
                        ]}
                    />
                </div>

                <Callout type="warning">
                    When health drops to critical, focus on resolving blockers first. Often a single blocked dependency explains the entire health decline.
                </Callout>
            </section>

            {/* SECTION: Modules Catalog */}
            <section data-section-id="modules-catalog" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Structure</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Modules Catalog</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Modules are the feature areas within a project. Enable only what you need to keep navigation focused.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">category</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ModuleCard
                        icon="checklist"
                        name="Tasks"
                        description="Track actionable work items with ownership, deadlines, and progress. The core execution module."
                        features={['Kanban board', 'List view', 'Filters', 'Bulk actions', 'Checklists']}
                    />
                    <ModuleCard
                        icon="report_problem"
                        name="Issues"
                        description="Log blockers, bugs, and risks that could delay delivery. Keep risks visible and assigned."
                        features={['Priority levels', 'Resolution tracking', 'Link to tasks']}
                    />
                    <ModuleCard
                        icon="flow_chart"
                        name="Flows"
                        description="Strategic work that progresses through stages. Captures intent before execution."
                        features={['Stage pipeline', 'CORA Studio', 'Approvals', 'Conversion']}
                    />
                    <ModuleCard
                        icon="flag"
                        name="Milestones"
                        description="Delivery checkpoints with target dates. Visual timeline for major outcomes."
                        features={['Timeline view', 'Progress tracking', 'Risk indicators']}
                    />
                    <ModuleCard
                        icon="hub"
                        name="Mindmap"
                        description="Visual brainstorming and flow organization. Connect concepts and explore relationships."
                        features={['Node connections', 'Drag and drop', 'Export']}
                    />
                    <ModuleCard
                        icon="campaign"
                        name="Social Studio"
                        description="Plan and manage social media campaigns. Strategy, content creation, and scheduling."
                        features={['Campaign planning', 'Post drafting', 'Calendar', 'Approvals']}
                    />
                    <ModuleCard
                        icon="mail"
                        name="Marketing"
                        description="Email campaigns, recipient management, and paid ad tracking."
                        features={['Email builder', 'Segments', 'Performance tracking']}
                    />
                    <ModuleCard
                        icon="photo_library"
                        name="Media"
                        description="Centralized asset library for all project visuals and creative files."
                        features={['Upload', 'Stock search', 'CORA generation', 'Editor']}
                    />
                </div>
            </section>

            {/* SECTION: Visibility and Access */}
            <section data-section-id="visibility-access" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Security</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Visibility and Access</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Control who can see and interact with your project through visibility settings and team roles.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">visibility</span>
                </div>

                {/* Visibility Levels */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-[var(--color-primary)]">public</span>
                            <span className="text-sm font-bold text-[var(--color-text-main)]">Workspace</span>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                            Visible to everyone in the workspace. Best for company-wide initiatives or public projects.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-amber-500">groups</span>
                            <span className="text-sm font-bold text-[var(--color-text-main)]">Specific Groups</span>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                            Visible only to selected groups. Use for department-specific or cross-functional projects.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-rose-500">lock</span>
                            <span className="text-sm font-bold text-[var(--color-text-main)]">Team Only</span>
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                            Visible only to assigned team members. Best for sensitive or confidential projects.
                        </p>
                    </div>
                </div>

                {/* Team Roles */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                        Project Team Roles
                    </div>
                    <div className="space-y-0">
                        <FieldRow field="Owner" type="Full" description="Full control including settings, team management, and deletion. Usually one person." />
                        <FieldRow field="Admin" type="Full" description="Can edit all content and manage settings. Cannot delete project or transfer ownership." />
                        <FieldRow field="Member" type="Edit" description="Can create and edit tasks, issues, flows. Cannot change project settings." />
                        <FieldRow field="Viewer" type="Read" description="Can view all content but cannot make changes. Good for stakeholders and observers." />
                    </div>
                </div>
            </section>

            {/* SECTION: Project Overview Page */}
            <section data-section-id="project-overview" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Dashboard</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Project Overview Page</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            The overview is your command center. It brings health, workload, activity, and deadlines into one view.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">dashboard</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <OverviewCard
                        icon="health_and_safety"
                        title="Health Card"
                        items={[
                            { label: 'Score', description: 'Composite health percentage with color indicator' },
                            { label: 'Trend', description: 'Whether health is improving or declining' },
                            { label: 'Top Issue', description: 'Primary factor affecting health' }
                        ]}
                    />
                    <OverviewCard
                        icon="work"
                        title="Workload Card"
                        items={[
                            { label: 'Open Tasks', description: 'Count of tasks not yet completed' },
                            { label: 'Urgent Tasks', description: 'High priority items needing attention' },
                            { label: 'Overdue', description: 'Tasks past their due date' }
                        ]}
                    />
                    <OverviewCard
                        icon="flag"
                        title="Milestones Card"
                        items={[
                            { label: 'Upcoming', description: 'Next milestones on timeline' },
                            { label: 'At Risk', description: 'Milestones that may slip' },
                            { label: 'Completed', description: 'Milestones achieved' }
                        ]}
                    />
                    <OverviewCard
                        icon="history"
                        title="Activity Card"
                        items={[
                            { label: 'Recent', description: 'Latest changes and updates' },
                            { label: 'Contributors', description: 'Who has been active' },
                            { label: 'Velocity', description: 'Rate of progress' }
                        ]}
                    />
                    <OverviewCard
                        icon="report_problem"
                        title="Issues Card"
                        items={[
                            { label: 'Open Count', description: 'Unresolved issues' },
                            { label: 'Blockers', description: 'Critical blocking issues' },
                            { label: 'Resolution Rate', description: 'How fast issues get resolved' }
                        ]}
                    />
                    <OverviewCard
                        icon="flow_chart"
                        title="Flows Card"
                        items={[
                            { label: 'In Progress', description: 'Flows being developed' },
                            { label: 'Pending Review', description: 'Awaiting approval' },
                            { label: 'Ready', description: 'Approved and ready for conversion' }
                        ]}
                    />
                </div>
            </section>

            {/* SECTION: Activity and History */}
            <section data-section-id="activity-tracking" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Audit</div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Activity and History</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">
                            Every change is logged so you can understand what happened and when.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">history</span>
                </div>

                {/* Activity Types */}
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">
                        Tracked Activities
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">add_circle</span>
                            Items created
                        </div>
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined text-[16px] text-sky-500">edit</span>
                            Fields updated
                        </div>
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                            Status changes
                        </div>
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined text-[16px] text-amber-500">comment</span>
                            Comments added
                        </div>
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined text-[16px] text-purple-500">person_add</span>
                            Assignments changed
                        </div>
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined text-[16px] text-rose-500">delete</span>
                            Items archived/deleted
                        </div>
                    </div>
                </div>

                <Callout type="info">
                    Activity logs are retained for at least 90 days. Use them to prepare status updates, investigate issues, or understand project history.
                </Callout>
            </section>
        </div>
    );
};
