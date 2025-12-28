import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const socialStudioSections: HelpCenterSectionIndex[] = [
    {
        id: 'campaign-strategy',
        title: 'Campaign strategy',
        summary: 'Define the big idea, audience, and channel direction.',
        content: 'Campaigns connect creative strategy to channels and output.',
        keywords: ['campaigns', 'strategy', 'audience']
    },
    {
        id: 'planning-timeline',
        title: 'Planning and timeline',
        summary: 'Organize phases, KPIs, and content cadence.',
        content: 'Timeline planning turns strategy into an executable schedule.',
        keywords: ['timeline', 'phases', 'kpis']
    },
    {
        id: 'review-approval',
        title: 'Review and approval',
        summary: 'Use review flows to approve or request changes.',
        content: 'Review ensures ideas are consistent with brand and goals.',
        keywords: ['review', 'approval', 'quality']
    },
    {
        id: 'posts-scheduling',
        title: 'Posts and scheduling',
        summary: 'Draft posts and align them to the calendar.',
        content: 'Posts inherit campaign context so messaging stays consistent.',
        keywords: ['posts', 'calendar', 'schedule']
    },
    {
        id: 'assets-management',
        title: 'Assets and creative',
        summary: 'Centralize creative assets across campaigns.',
        content: 'Assets keep media reusable and consistent.',
        keywords: ['assets', 'creative', 'library']
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

export const SocialStudioPage = ({ sections, activeSectionId, onSectionSelect }: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-6">
                <div className="rounded-[26px] border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                        Social Studio
                    </div>
                    <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                        Plan, create, and review campaigns
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed">
                        Social Studio connects strategy, creative, and publishing. Build campaigns with structured
                        phases, draft posts inside those campaigns, and keep approvals centralized so execution stays
                        aligned with the original idea.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            Strategy
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            Calendar
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            Approval
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
                        Keep campaign intent close to execution. If strategy and content live apart, alignment breaks
                        fast.
                    </div>
                </aside>
            </div>

            <section data-section-id="campaign-strategy" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Foundation" title="Campaign strategy" icon="campaign" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Strategy defines the big idea, the audience you are speaking to, and the tone you want to carry
                    across all channels. When this is clear, the creative work becomes consistent and faster to
                    evaluate.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Big idea</div>
                        <p className="mt-2">
                            The core message you want your audience to remember.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Hook</div>
                        <p className="mt-2">
                            The opening angle that earns attention and signals relevance.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Audience</div>
                        <p className="mt-2">
                            Who you want to reach and what they value most.
                        </p>
                    </InfoCard>
                </div>
                <Callout>
                    A campaign without a clear hook usually turns into a collection of posts with no shared purpose.
                </Callout>
            </section>

            <section data-section-id="planning-timeline" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Planning" title="Planning and timeline" icon="calendar_today" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Planning translates strategy into a timeline. Use phases to break the campaign into coherent arcs,
                    then attach KPIs and content cadence so the team knows what success looks like each week.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Phases</div>
                        <p className="mt-2">
                            Group content into segments like launch, growth, and sustain. Each phase can have its own
                            focus and KPIs.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Cadence</div>
                        <p className="mt-2">
                            Plan how many posts go live each week per channel to avoid spikes and quiet gaps.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="review-approval" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Alignment" title="Review and approval" icon="fact_check" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Review is your quality gate. It ensures the campaign matches brand, messaging, and delivery goals
                    before anything goes live. Approve when the plan is clear, or request changes when assumptions are
                    weak or missing.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[var(--color-text-muted)]">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                        <div className="text-xs font-bold uppercase tracking-wider">Approve when</div>
                        <p className="mt-2 leading-relaxed">
                            Strategy is consistent, phases are realistic, and the content plan aligns to goals.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200">
                        <div className="text-xs font-bold uppercase tracking-wider">Request changes when</div>
                        <p className="mt-2 leading-relaxed">
                            The audience is unclear, KPIs are missing, or the cadence is not feasible.
                        </p>
                    </div>
                </div>
                <Callout>
                    Use the review notes to capture what needs adjustment so creators know exactly what to fix next.
                </Callout>
            </section>

            <section data-section-id="posts-scheduling" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Execution" title="Posts and scheduling" icon="edit_square" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Posts inherit campaign strategy so tone and messaging stay consistent. Draft posts inside the
                    campaign to keep context close, then use the calendar to balance volume across platforms.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Draft</div>
                        <p className="mt-2">
                            Create posts with clear format and goal so they can be reviewed faster.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Schedule</div>
                        <p className="mt-2">
                            Place posts on the calendar to confirm cadence and avoid overlaps.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Review</div>
                        <p className="mt-2">
                            Validate copy, assets, and timing before the post goes live.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="assets-management" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Creative" title="Assets and creative" icon="photo_library" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Assets keep creative consistent across the campaign. Upload once, organize by theme or usage, and
                    reuse them across posts to reduce production time and maintain a cohesive visual style.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Library hygiene</div>
                        <p className="mt-2">
                            Use clear naming and tags so teammates can find assets without searching through folders.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Reuse</div>
                        <p className="mt-2">
                            Reuse the strongest creative across channels, adjusting format but keeping the core visual.
                        </p>
                    </InfoCard>
                </div>
            </section>
        </div>
    );
};
