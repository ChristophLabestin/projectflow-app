import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const projectsSections: HelpCenterSectionIndex[] = [
    {
        id: 'project-setup',
        title: 'Set up a project',
        summary: 'Create a project with clear outcomes, metadata, and ownership.',
        content: 'Set a title, description, status, priority, and key dates so the team shares context.',
        keywords: ['setup', 'metadata', 'status']
    },
    {
        id: 'overview-hub',
        title: 'Project overview hub',
        summary: 'The live dashboard for health, workload, activity, and deadlines.',
        content: 'Use the overview as the source of truth for project status and next actions.',
        keywords: ['overview', 'dashboard', 'snapshot']
    },
    {
        id: 'health-workload',
        title: 'Health and workload',
        summary: 'Signals that show risk, momentum, and capacity.',
        content: 'Health blends tasks, milestones, issues, and activity to surface risks early.',
        keywords: ['health', 'workload', 'risk']
    },
    {
        id: 'modules-navigation',
        title: 'Modules and navigation',
        summary: 'Enable only what the project needs and keep navigation focused.',
        content: 'Modules define the workspaces inside a project, and counts show activity at a glance.',
        keywords: ['modules', 'navigation', 'flows']
    },
    {
        id: 'milestones-outcomes',
        title: 'Milestones and outcomes',
        summary: 'Keep delivery visible with clear checkpoints.',
        content: 'Milestones anchor the timeline and align tasks with outcomes.',
        keywords: ['milestones', 'outcomes', 'planning']
    },
    {
        id: 'activity-details',
        title: 'Activity and details',
        summary: 'Track updates and keep project metadata current.',
        content: 'Activity shows what changed and who did it. Details keep timelines and priorities accurate.',
        keywords: ['activity', 'details', 'timeline']
    },
    {
        id: 'weekly-review',
        title: 'Weekly review routine',
        summary: 'A repeatable cadence to keep projects healthy.',
        content: 'Review health, update milestones, and confirm priorities every week.',
        keywords: ['review', 'cadence', 'planning']
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

const StepCard = ({
    label,
    title,
    children
}: {
    label: string;
    title: string;
    children: React.ReactNode;
}) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
        <div className="text-sm font-semibold text-[var(--color-text-main)] mt-2">{title}</div>
        <div className="text-sm text-[var(--color-text-muted)] mt-2 leading-relaxed">{children}</div>
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

export const ProjectsPage = ({ sections, activeSectionId, onSectionSelect }: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-6">
                <div className="rounded-[28px] border border-[var(--color-surface-border)] bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                        Projects
                    </div>
                    <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                        Build clarity around outcomes
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed">
                        Projects are the center of execution. Each one is a focused workspace with its own modules,
                        milestones, and activity history. When you open a project, the navigation shifts so everything
                        you see is already scoped to that initiative.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            Overview signals
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            Modules
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            Milestones
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            Weekly review
                        </span>
                    </div>
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
                        Projects stay healthy when the overview, milestones, and tasks are updated together. Treat the
                        overview like a weekly check-in, not a dashboard you only open at the end.
                    </div>
                </aside>
            </div>

            <div className="flex flex-wrap gap-2 lg:hidden">
                {sections.map(section => (
                    <button
                        key={section.id}
                        onClick={() => onSectionSelect(section.id)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${activeSectionId === section.id
                            ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] border-[var(--color-primary)]'
                            : 'bg-[var(--color-surface-bg)] text-[var(--color-text-muted)] border-[var(--color-surface-border)] hover:text-[var(--color-text-main)]'
                            }`}
                    >
                        {section.title}
                    </button>
                ))}
            </div>

            <section data-section-id="project-setup" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Foundation" title="Set up a project" icon="settings" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    A project should read like a short brief: what you are delivering, why it matters, and when it is
                    due. Start by writing an outcome-focused title and a short description that frames the scope.
                    Then set status, priority, and dates so the timeline is obvious to anyone who joins later.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StepCard label="Step 1" title="Define the outcome">
                        Write a title that describes the result, not the activity. This makes progress measurable and
                        keeps the team aligned on why the work exists.
                    </StepCard>
                    <StepCard label="Step 2" title="Set timeline and priority">
                        Add a start date and due date early. Priority tells the team how this project competes with
                        other work in the workspace.
                    </StepCard>
                    <StepCard label="Step 3" title="Confirm ownership">
                        Make sure the owner and core contributors are clear. Ownership helps decisions move without
                        waiting for a meeting.
                    </StepCard>
                    <StepCard label="Step 4" title="Enable only the modules you need">
                        Turn on Tasks, Flows, Issues, Milestones, or other modules based on how the project will be
                        delivered. You can always add more later.
                    </StepCard>
                </div>
                <Callout>
                    Pin the project once it is created. Pinned projects keep global actions like task creation and
                    quick shortcuts aligned with the work you are actually focused on.
                </Callout>
            </section>

            <section data-section-id="overview-hub" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Dashboard" title="Project overview hub" icon="grid_view" />
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
                    <div className="space-y-4 text-sm text-[var(--color-text-muted)] leading-relaxed">
                        <p>
                            The overview is your command center. It brings health, workload, activity, and upcoming
                            deadlines into one place so you can see the project state without digging through tabs.
                        </p>
                        <p>
                            Use it as the first screen you open during planning. If a metric looks off, you already
                            have the next click: jump to tasks, issues, or milestones from the same view.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Snapshot map
                        </div>
                        <div className="space-y-3 text-sm text-[var(--color-text-muted)]">
                            <div>
                                <div className="text-xs font-semibold text-[var(--color-text-main)]">Health</div>
                                <div>Shows risk level based on tasks, milestones, issues, and activity.</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-[var(--color-text-main)]">Workload</div>
                                <div>Summarizes open and urgent tasks so you can spot overload.</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-[var(--color-text-main)]">Activity</div>
                                <div>Highlights recent changes, comments, and progress.</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-[var(--color-text-main)]">Upcoming</div>
                                <div>Surfaces deadlines so they are visible before they hit.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section data-section-id="health-workload" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Signals" title="Health and workload" icon="health_and_safety" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Health is a composite signal. It blends open tasks, unresolved issues, milestone progress, and
                    recent activity into a single view of risk. Workload complements it by showing how much is open
                    and how much is urgent, so you can balance capacity.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Health signals
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed">
                            A healthy project has steady activity and milestones moving forward. A warning usually
                            means tasks are stuck or issues are piling up. A critical state means delivery is at risk
                            and needs immediate attention.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Workload cues
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed">
                            Open task count tells you volume, while urgent tasks show where the pressure is. If urgent
                            work keeps climbing, adjust scope or reassign capacity before timelines slip.
                        </p>
                    </div>
                </div>
                <Callout>
                    When health drops, open the issues list first. A single blocked dependency often explains the
                    entire signal and is the fastest place to recover.
                </Callout>
            </section>

            <section data-section-id="modules-navigation" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Structure" title="Modules and navigation" icon="category" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Modules are the working areas inside a project. Keep only the modules that support delivery so the
                    sidebar remains focused. You can reorder and hide modules per project to match how your team
                    operates.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Core modules
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                            Tasks, Flows (formerly Ideas), Issues, and Milestones are common across most projects.
                            These modules represent execution, strategy, risks, and delivery checkpoints.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Specialized modules
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                            Mindmap, Social Studio, and Marketing are best when the project needs structured ideation,
                            campaign planning, or content production. Hide them if you do not use them regularly.
                        </p>
                    </div>
                </div>
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Module counts in the sidebar are early warnings. A sudden spike in issues or tasks is usually a
                    sign that scope or requirements changed.
                </div>
            </section>

            <section data-section-id="milestones-outcomes" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Delivery" title="Milestones and outcomes" icon="outlined_flag" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Milestones are outcome checkpoints that keep delivery visible. They are most effective when they
                    describe a clear result, have a realistic date, and are owned by someone who can move the work.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                        <div className="text-xs font-bold uppercase tracking-wider">Good milestone</div>
                        <p className="mt-2 leading-relaxed">
                            "Beta launch ready for 50 testers by Oct 15." It is outcome-based, time-bound, and clearly
                            measurable.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200">
                        <div className="text-xs font-bold uppercase tracking-wider">Weak milestone</div>
                        <p className="mt-2 leading-relaxed">
                            "Work on onboarding." It is vague and does not tell the team what success looks like.
                        </p>
                    </div>
                </div>
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4 text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Review milestones during weekly planning. If a milestone is at risk, link the tasks and issues
                    that need attention so the team can respond quickly.
                </div>
            </section>

            <section data-section-id="activity-details" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Context" title="Activity and details" icon="history" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[var(--color-text-muted)]">
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Activity log
                        </div>
                        <p className="mt-3 leading-relaxed">
                            Activity shows who changed what and when. Use it to understand recent decisions, confirm
                            momentum, and prepare updates for stakeholders.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Project details
                        </div>
                        <p className="mt-3 leading-relaxed">
                            Details is where you keep status, priority, and dates accurate. When these fields are
                            current, every report and dashboard reflects reality without extra work.
                        </p>
                    </div>
                </div>
            </section>

            <section data-section-id="weekly-review" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Cadence" title="Weekly review routine" icon="event" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    A simple weekly routine keeps projects healthy without heavy process. The goal is to refresh the
                    overview signals and make sure the team agrees on what changes next.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StepCard label="Monday" title="Review health and workload">
                        Start with the overview. If health has dropped, inspect tasks and issues to find the cause.
                    </StepCard>
                    <StepCard label="Midweek" title="Validate milestones">
                        Check milestone status and confirm the team still has the capacity to hit the dates.
                    </StepCard>
                    <StepCard label="Thursday" title="Resolve blockers">
                        Focus on the top two blockers and ensure owners and next steps are clear.
                    </StepCard>
                    <StepCard label="Friday" title="Summarize activity">
                        Use the activity log to capture what moved and what needs attention next week.
                    </StepCard>
                </div>
            </section>
        </div>
    );
};
