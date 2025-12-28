import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const flowsSections: HelpCenterSectionIndex[] = [
    {
        id: 'flows-overview',
        title: 'Flows overview',
        summary: 'Flows capture ideas and strategy before execution.',
        content: 'Flows organize creative and strategic thinking so it can become actionable work.',
        keywords: ['flows', 'strategy', 'context']
    },
    {
        id: 'flow-stages',
        title: 'Flow stages',
        summary: 'Move from concept to approval with structure.',
        content: 'Stages help you gather context, plan direction, and confirm readiness.',
        keywords: ['stages', 'alignment', 'planning']
    },
    {
        id: 'ai-studio',
        title: 'AI Studio',
        summary: 'Use AI to expand, analyze, and refine.',
        content: 'AI Studio supports briefs, analysis, and creative exploration.',
        keywords: ['ai', 'analysis', 'briefs']
    },
    {
        id: 'conversion',
        title: 'Conversion to execution',
        summary: 'Turn approved work into tasks or campaigns.',
        content: 'Conversions maintain traceability from strategy to execution.',
        keywords: ['conversion', 'tasks', 'campaigns']
    },
    {
        id: 'review-feedback',
        title: 'Review and feedback',
        summary: 'Keep iteration clear before approval.',
        content: 'Use review steps to request changes and track decisions.',
        keywords: ['review', 'feedback', 'approval']
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

const InfoCard = ({ children }: { children: React.ReactNode }) => (
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

export const FlowsPage = ({ sections, activeSectionId, onSectionSelect }: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-6">
                <div className="rounded-[28px] border border-[var(--color-surface-border)] bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                        Flows and AI Studio
                    </div>
                    <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                        Shape strategy before execution
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed">
                        Flows (formerly Ideas) are the strategic layer between raw inspiration and delivery. They
                        capture intent, research, and decisions so execution teams can move fast without re-litigating
                        the why.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            Strategy
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            AI Studio
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            Conversion
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
                        Flows are most effective when assumptions are explicit and decisions are easy to trace later.
                    </div>
                </aside>
            </div>

            <section data-section-id="flows-overview" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Foundation" title="Flows overview" icon="emoji_objects" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    A Flow gathers the intent behind a project, campaign, or product change. It holds context that
                    tasks alone cannot capture, such as target audience, messaging, constraints, and the definition
                    of success. When a Flow is strong, the team can execute without guesswork.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Outcome</div>
                        <p className="mt-2">
                            Describe the result you want, not just the activity you plan to do.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Audience</div>
                        <p className="mt-2">
                            Identify who the work is for and why it matters to them.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Success</div>
                        <p className="mt-2">
                            Define how you will know this Flow worked, even if results come later.
                        </p>
                    </InfoCard>
                </div>
                <Callout>
                    A Flow is not a task list. It is the story behind the work so the task list makes sense later.
                </Callout>
            </section>

            <section data-section-id="flow-stages" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Structure" title="Flow stages" icon="timeline" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Stages turn a raw concept into an executable plan. Use them to gather context, test assumptions,
                    and align on direction before you commit delivery time.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StepCard label="Stage 1" title="Explore the problem">
                        Capture the opportunity, constraints, and the reason this matters now. This is where you
                        document early assumptions instead of hiding them.
                    </StepCard>
                    <StepCard label="Stage 2" title="Define the direction">
                        Summarize the target audience, positioning, and the strategic approach. Keep it concise so it
                        can be reviewed quickly.
                    </StepCard>
                    <StepCard label="Stage 3" title="Plan the execution path">
                        Outline what needs to happen, the timeline shape, and the risks that could slow delivery.
                    </StepCard>
                    <StepCard label="Stage 4" title="Align and approve">
                        Use review to request changes or approve the plan. Approval signals the work is ready to
                        convert into execution.
                    </StepCard>
                </div>
            </section>

            <section data-section-id="ai-studio" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Acceleration" title="AI Studio" icon="auto_awesome" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    AI Studio helps expand briefs, generate alternatives, and surface risks. It works best when your
                    inputs are specific and grounded in real constraints.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Strong inputs</div>
                        <p className="mt-2">
                            Provide audience, tone, goals, and constraints. The more grounded the input, the more
                            useful the output.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Validation</div>
                        <p className="mt-2">
                            Treat AI output as a draft. Validate facts, adjust tone, and align with your strategy
                            before sharing.
                        </p>
                    </InfoCard>
                </div>
                <Callout>
                    AI is best for exploration and framing. Final decisions should come from your team and goals.
                </Callout>
            </section>

            <section data-section-id="conversion" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Delivery" title="Conversion to execution" icon="swap_horiz" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Conversion turns a Flow into execution modules without losing context. It keeps the origin link so
                    teams can trace tasks, campaigns, or assets back to the strategy that created them.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Tasks</div>
                        <p className="mt-2">
                            Convert when you are ready to break work into ownership and deadlines.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Campaigns</div>
                        <p className="mt-2">
                            Social or marketing flows can become campaigns with phases and planned content.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Traceability</div>
                        <p className="mt-2">
                            Conversion preserves the source so review decisions remain visible later.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="review-feedback" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Alignment" title="Review and feedback" icon="fact_check" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Reviews are a decision gate. Use them to request changes when assumptions are weak, or approve
                    when the Flow is ready for execution. Keep feedback specific so the next iteration is clear.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[var(--color-text-muted)]">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                        <div className="text-xs font-bold uppercase tracking-wider">Approve when</div>
                        <p className="mt-2 leading-relaxed">
                            The outcome is clear, the audience is defined, and the execution path is realistic for the
                            timeline.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200">
                        <div className="text-xs font-bold uppercase tracking-wider">Request changes when</div>
                        <p className="mt-2 leading-relaxed">
                            Key assumptions are missing, risks are unresolved, or the plan is too vague to execute.
                        </p>
                    </div>
                </div>
                <Callout>
                    A good review comment includes the missing context and a suggestion for what to clarify next.
                </Callout>
            </section>
        </div>
    );
};
