import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const flowsSections: HelpCenterSectionIndex[] = [
    {
        id: 'flow-types',
        title: 'Flow types',
        summary: 'Different flow types for different work.',
        content: 'Product flows, campaign flows, and custom flows for various use cases.',
        keywords: ['types', 'product', 'campaign', 'custom']
    },
    {
        id: 'stage-pipeline',
        title: 'Stage pipeline',
        summary: 'How flows progress through stages.',
        content: 'The visual pipeline from concept to approval.',
        keywords: ['stages', 'pipeline', 'progress', 'lifecycle']
    },
    {
        id: 'ai-studio-tools',
        title: 'CORA Studio tools',
        summary: 'CORA-powered analysis and generation.',
        content: 'All CORA tools available within flows.',
        keywords: ['cora', 'ai', 'studio', 'analysis', 'generation']
    },
    {
        id: 'flow-fields',
        title: 'Flow fields reference',
        summary: 'Complete field documentation for flows.',
        content: 'Every field available when creating flows.',
        keywords: ['fields', 'metadata', 'configuration']
    },
    {
        id: 'approval-workflow',
        title: 'Approval workflow',
        summary: 'Review and approval process.',
        content: 'How approval decisions work and what they trigger.',
        keywords: ['approval', 'review', 'decision', 'workflow']
    },
    {
        id: 'conversion-options',
        title: 'Conversion to execution',
        summary: 'Turn approved flows into action.',
        content: 'Converting flows to tasks, campaigns, and more.',
        keywords: ['conversion', 'tasks', 'campaigns', 'execution']
    }
];

/* ─────────────────────────────────────────────────────────────
   LAYOUT COMPONENTS - Pipeline/Funnel Style
───────────────────────────────────────────────────────────── */

const PipelineStage = ({
    stage,
    title,
    description,
    isActive
}: {
    stage: number;
    title: string;
    description: string;
    isActive?: boolean;
}) => (
    <div className={`flex-1 rounded-2xl border p-4 transition-all ${isActive
        ? 'border-primary bg-primary/10'
        : 'border-surface bg-card'
        }`}>
        <div className="flex items-center gap-3 mb-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isActive
                ? 'bg-primary text-on-primary'
                : 'bg-surface-hover text-muted'
                }`}>
                {stage}
            </div>
            <span className={`text-sm font-bold ${isActive ? 'text-primary' : 'text-main'}`}>
                {title}
            </span>
        </div>
        <p className="text-xs text-muted leading-relaxed">{description}</p>
    </div>
);

const FlowTypeCard = ({
    icon,
    type,
    description,
    stages,
    color
}: {
    icon: string;
    type: string;
    description: string;
    stages: string[];
    color: string;
}) => (
    <div className="rounded-2xl border border-surface bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-[24px] text-white">{icon}</span>
            </div>
            <div>
                <div className="text-base font-bold text-main">{type}</div>
                <div className="text-xs text-muted">{stages.length} stages</div>
            </div>
        </div>
        <p className="text-sm text-muted leading-relaxed">{description}</p>
        <div className="flex flex-wrap gap-2">
            {stages.map((s, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-surface-hover text-[10px] font-medium text-muted">
                    {i + 1}. {s}
                </span>
            ))}
        </div>
    </div>
);

const AIToolCard = ({
    icon,
    name,
    description,
    outputs
}: {
    icon: string;
    name: string;
    description: string;
    outputs: string[];
}) => (
    <div className="rounded-2xl border border-surface bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-white">{icon}</span>
            </div>
            <span className="text-sm font-bold text-main">{name}</span>
        </div>
        <p className="text-sm text-muted leading-relaxed">{description}</p>
        <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Outputs</div>
            <div className="flex flex-wrap gap-2">
                {outputs.map((o, i) => (
                    <span key={i} className="px-2 py-1 rounded-lg bg-purple-100 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {o}
                    </span>
                ))}
            </div>
        </div>
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
    <div className="flex items-start gap-4 py-3 border-b border-surface last:border-0">
        <div className="flex-shrink-0 w-[120px]">
            <span className="text-sm font-semibold text-main">{field}</span>
            {required && <span className="ml-1 text-rose-500 text-xs">*</span>}
        </div>
        <div className="flex-shrink-0 w-[80px]">
            <span className="px-2 py-0.5 rounded-full bg-surface-hover text-[10px] font-medium text-muted">
                {type}
            </span>
        </div>
        <div className="flex-1 text-sm text-muted">{description}</div>
    </div>
);

const ConversionPath = ({
    from,
    to,
    description,
    icon
}: {
    from: string;
    to: string;
    description: string;
    icon: string;
}) => (
    <div className="rounded-xl border border-surface bg-card p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
        <div className="flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-main">
                <span>{from}</span>
                <span className="material-symbols-outlined text-[14px] text-subtle">arrow_forward</span>
                <span>{to}</span>
            </div>
            <p className="text-xs text-muted mt-1">{description}</p>
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

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE COMPONENT
───────────────────────────────────────────────────────────── */

export const FlowsPage = (_props: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            {/* Hero with Pipeline Preview */}
            <div className="rounded-[28px] border border-surface bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">
                    Flows and CORA Studio
                </div>
                <h2 className="text-3xl font-bold text-main mt-3">
                    Shape Strategy Before Execution
                </h2>
                <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">
                    Flows capture intent, research, and decisions so execution teams can move fast. They progress through
                    stages, get enhanced by CORA, and convert into actionable work.
                </p>

                {/* Pipeline Preview */}
                <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-2">
                    <PipelineStage stage={1} title="Concept" description="Initial flow capture" />
                    <span className="material-symbols-outlined text-subtle">chevron_right</span>
                    <PipelineStage stage={2} title="Strategy" description="Define approach" isActive />
                    <span className="material-symbols-outlined text-subtle">chevron_right</span>
                    <PipelineStage stage={3} title="Planning" description="Detail the plan" />
                    <span className="material-symbols-outlined text-subtle">chevron_right</span>
                    <PipelineStage stage={4} title="Review" description="Get approval" />
                </div>
            </div>

            {/* SECTION: Flow Types */}
            <section data-section-id="flow-types" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Categories</div>
                        <h3 className="text-xl font-bold text-main mt-2">Flow Types</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            Different flow types for different kinds of strategic work. Each type has tailored stages and CORA tools.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">category</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FlowTypeCard
                        icon="inventory_2"
                        type="Product Flow"
                        description="For new features, enhancements, or product initiatives. Covers discovery through launch planning."
                        stages={['Discovery', 'Strategy', 'Development', 'Launch']}
                        color="bg-sky-500"
                    />
                    <FlowTypeCard
                        icon="campaign"
                        type="Social Campaign Flow"
                        description="For social media campaigns. Covers concept through content planning and approval."
                        stages={['Concept', 'Strategy', 'Planning', 'Review', 'Submit']}
                        color="bg-pink-500"
                    />
                    <FlowTypeCard
                        icon="rocket_launch"
                        type="Launch Flow"
                        description="For launches and announcements. Coordinate timing, messaging, and channels."
                        stages={['Brief', 'Planning', 'Assets', 'Review']}
                        color="bg-orange-500"
                    />
                    <FlowTypeCard
                        icon="extension"
                        type="Custom Flow"
                        description="Define your own stages for unique workflows. Full flexibility for any use case."
                        stages={['Customizable', 'Stages', '...', 'Approval']}
                        color="bg-slate-500"
                    />
                </div>
            </section>

            {/* SECTION: Stage Pipeline */}
            <section data-section-id="stage-pipeline" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Lifecycle</div>
                        <h3 className="text-xl font-bold text-main mt-2">Stage Pipeline</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            Flows progress through stages, each with specific purpose and outputs. Understanding the pipeline helps you create better strategy.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">timeline</span>
                </div>

                {/* Stage Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-surface bg-surface p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-white text-sm font-bold">1</div>
                            <span className="text-sm font-bold text-main">Concept / Discovery</span>
                        </div>
                        <p className="text-sm text-muted leading-relaxed mb-3">
                            Capture the initial flow concept, problem statement, and opportunity. Document early assumptions and constraints.
                        </p>
                        <div className="text-xs text-subtle">
                            <strong>Key outputs:</strong> Problem statement, target audience, success criteria
                        </div>
                    </div>

                    <div className="rounded-2xl border border-surface bg-surface p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white text-sm font-bold">2</div>
                            <span className="text-sm font-bold text-main">Strategy</span>
                        </div>
                        <p className="text-sm text-muted leading-relaxed mb-3">
                            Define the approach, positioning, and key decisions. Use CORA analysis to validate assumptions.
                        </p>
                        <div className="text-xs text-subtle">
                            <strong>Key outputs:</strong> Strategic direction, positioning, channel strategy
                        </div>
                    </div>

                    <div className="rounded-2xl border border-surface bg-surface p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-bold">3</div>
                            <span className="text-sm font-bold text-main">Planning</span>
                        </div>
                        <p className="text-sm text-muted leading-relaxed mb-3">
                            Detail the execution path, timelines, resources, and KPIs. Break strategy into actionable phases.
                        </p>
                        <div className="text-xs text-subtle">
                            <strong>Key outputs:</strong> Timeline, phases, KPIs, resource requirements
                        </div>
                    </div>

                    <div className="rounded-2xl border border-surface bg-surface p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">4</div>
                            <span className="text-sm font-bold text-main">Review / Approval</span>
                        </div>
                        <p className="text-sm text-muted leading-relaxed mb-3">
                            Submit for stakeholder review. Get approval to proceed or iterate based on feedback.
                        </p>
                        <div className="text-xs text-subtle">
                            <strong>Key outputs:</strong> Approval decision, feedback notes, conversion trigger
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION: CORA Studio Tools */}
            <section data-section-id="ai-studio-tools" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Powered by CORA</div>
                        <h3 className="text-xl font-bold text-main mt-2">CORA Studio Tools</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            CORA Studio provides analysis, generation, and validation tools within each flow stage. Use them to accelerate thinking and surface blind spots.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">auto_awesome</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AIToolCard
                        icon="analytics"
                        name="SWOT Analysis"
                        description="Generate comprehensive strengths, weaknesses, opportunities, and threats analysis."
                        outputs={['Strengths', 'Weaknesses', 'Opportunities', 'Threats']}
                    />
                    <AIToolCard
                        icon="architecture"
                        name="Blueprint"
                        description="Create structured execution plans with phases, milestones, and dependencies."
                        outputs={['Phases', 'Milestones', 'Timeline', 'Dependencies']}
                    />
                    <AIToolCard
                        icon="warning"
                        name="Risk Analysis"
                        description="Identify potential risks and mitigation strategies before they become problems."
                        outputs={['Risk factors', 'Probability', 'Impact', 'Mitigations']}
                    />
                    <AIToolCard
                        icon="explore"
                        name="Discovery"
                        description="Explore the problem space and generate insights about audience and market."
                        outputs={['Market insights', 'User needs', 'Opportunities']}
                    />
                    <AIToolCard
                        icon="strategy"
                        name="Strategy"
                        description="Generate strategic approaches and positioning recommendations."
                        outputs={['Positioning', 'Differentiators', 'Channels']}
                    />
                    <AIToolCard
                        icon="rocket_launch"
                        name="Launch Planning"
                        description="Create comprehensive launch timelines and coordination plans."
                        outputs={['Timeline', 'Channels', 'Messaging', 'Metrics']}
                    />
                </div>

                <Callout type="tip">
                    CORA outputs are starting points. Always validate with your team's expertise and real data before making final decisions.
                </Callout>
            </section>

            {/* SECTION: Flow Fields Reference */}
            <section data-section-id="flow-fields" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Reference</div>
                        <h3 className="text-xl font-bold text-main mt-2">Flow Fields Reference</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            Complete documentation of every field available when creating or editing a flow.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">list_alt</span>
                </div>

                <div className="rounded-2xl border border-surface bg-surface p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
                        Core Fields
                    </div>
                    <div className="space-y-0">
                        <FieldRow field="Title" type="Text" required description="Short, descriptive name for the flow. Should capture the main initiative." />
                        <FieldRow field="Type" type="Select" required description="Flow type determines available stages. Options: Product, Campaign, Launch, Custom." />
                        <FieldRow field="Description" type="Rich Text" description="Detailed context, objectives, and background information." />
                        <FieldRow field="Stage" type="Select" description="Current stage in the pipeline. Advances as work progresses." />
                        <FieldRow field="Owner" type="User" description="Person responsible for driving this flow to completion." />
                        <FieldRow field="Target Audience" type="Text" description="Who this flow is designed for. Critical for strategy development." />
                        <FieldRow field="Success Metrics" type="Text" description="How you'll measure if this flow achieves its goals." />
                        <FieldRow field="Tags" type="Multi-select" description="Labels for categorization and filtering." />
                        <FieldRow field="CORA Tokens Used" type="Number" description="Tracked CORA usage for this flow. Auto-calculated." />
                    </div>
                </div>
            </section>

            {/* SECTION: Approval Workflow */}
            <section data-section-id="approval-workflow" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Decisions</div>
                        <h3 className="text-xl font-bold text-main mt-2">Approval Workflow</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            The review stage is a decision gate. Understand the approval options and what each triggers.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">fact_check</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[24px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                            <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">Approve</span>
                        </div>
                        <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed mb-3">
                            Flow is ready for execution. Strategy is sound, plan is realistic, and resources are available.
                        </p>
                        <div className="text-xs text-emerald-700 dark:text-emerald-300">
                            <strong>Triggers:</strong> Flow moves to Approved, conversion becomes available
                        </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800/40 dark:bg-amber-900/20">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[24px] text-amber-600 dark:text-amber-400">edit</span>
                            <span className="text-base font-bold text-amber-700 dark:text-amber-300">Request Changes</span>
                        </div>
                        <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed mb-3">
                            Flow needs iteration. Strategy has gaps, assumptions need validation, or plan needs refinement.
                        </p>
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                            <strong>Triggers:</strong> Flow returns to previous stage with feedback notes
                        </div>
                    </div>

                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-800/40 dark:bg-rose-900/20">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[24px] text-rose-600 dark:text-rose-400">cancel</span>
                            <span className="text-base font-bold text-rose-700 dark:text-rose-300">Reject</span>
                        </div>
                        <p className="text-sm text-rose-800 dark:text-rose-200 leading-relaxed mb-3">
                            Flow should not proceed. Fundamental issues with concept, timing, or strategic fit.
                        </p>
                        <div className="text-xs text-rose-700 dark:text-rose-300">
                            <strong>Triggers:</strong> Flow moves to Rejected status, archived from active view
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION: Conversion Options */}
            <section data-section-id="conversion-options" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Execution</div>
                        <h3 className="text-xl font-bold text-main mt-2">Conversion to Execution</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            Once approved, flows can convert into executable items while maintaining traceability to their strategic origin.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">swap_horiz</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ConversionPath
                        from="Product Flow"
                        to="Tasks"
                        description="Convert into individual tasks with ownership and deadlines. Great for feature implementation."
                        icon="checklist"
                    />
                    <ConversionPath
                        from="Campaign Flow"
                        to="Social Campaign"
                        description="Create a full social campaign with phases, content calendar, and post scheduling."
                        icon="campaign"
                    />
                    <ConversionPath
                        from="Any Flow"
                        to="Project"
                        description="Spin off a new project from the flow for larger initiatives that need their own space."
                        icon="folder"
                    />
                    <ConversionPath
                        from="Any Flow"
                        to="Milestone"
                        description="Create a project milestone to track this flow's delivery as a key checkpoint."
                        icon="flag"
                    />
                </div>

                <Callout type="info">
                    Conversion maintains a link back to the original flow. You can always trace execution items back to the strategy that created them.
                </Callout>
            </section>
        </div>
    );
};
