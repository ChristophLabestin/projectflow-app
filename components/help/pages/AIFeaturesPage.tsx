import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const aiFeaturesSections: HelpCenterSectionIndex[] = [
    {
        id: 'ai-overview',
        title: 'AI overview',
        summary: 'Where AI shows up across ProjectFlow.',
        content: 'AI tools assist with drafting, analysis, search, and media generation.',
        keywords: ['ai', 'overview', 'studio']
    },
    {
        id: 'ai-search',
        title: 'AI search and answers',
        summary: 'Ask questions using workspace context.',
        content: 'The AI search bar summarizes project and task data into answers you can act on.',
        keywords: ['search', 'answers', 'context']
    },
    {
        id: 'ai-drafting',
        title: 'Drafting and planning',
        summary: 'Generate drafts, descriptions, and plans.',
        content: 'AI can draft project descriptions, task details, and structured plans.',
        keywords: ['draft', 'planning', 'blueprint']
    },
    {
        id: 'ai-analysis',
        title: 'Analysis and strategy',
        summary: 'Run structured analysis on flows and campaigns.',
        content: 'AI can assist with SWOT, strategy, discovery, and risk analysis.',
        keywords: ['analysis', 'swot', 'risk']
    },
    {
        id: 'ai-social',
        title: 'Social AI tooling',
        summary: 'Generate campaign concepts, captions, and playbooks.',
        content: 'Social Studio uses AI for strategy, planning, and content ideas.',
        keywords: ['social', 'captions', 'hashtags']
    },
    {
        id: 'ai-media',
        title: 'AI images and media',
        summary: 'Create and refine visuals in the media library.',
        content: 'Generate images from prompts and rework existing assets.',
        keywords: ['images', 'media', 'generation']
    },
    {
        id: 'ai-usage-limits',
        title: 'Usage limits and quota',
        summary: 'Understand AI usage, quotas, and resets.',
        content: 'Usage limits shown in Settings reflect the monthly quota included in billing.',
        keywords: ['limits', 'quota', 'billing']
    },
    {
        id: 'ai-limitations',
        title: 'Limitations and best practices',
        summary: 'How to keep AI output reliable.',
        content: 'AI output needs review and works best with precise prompts.',
        keywords: ['limitations', 'quality', 'review']
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

export const AIFeaturesPage = ({ sections, activeSectionId, onSectionSelect }: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-6">
                <div className="rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                        AI Features
                    </div>
                    <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                        A guided layer for planning and execution
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed">
                        ProjectFlow AI supports ideation, planning, analysis, and content generation across the
                        workspace. Use it to accelerate drafting and decision-making, then refine outputs with your
                        team before finalizing.
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
                        AI works best when you provide clear context, constraints, and the outcome you want.
                    </div>
                </aside>
            </div>

            <section data-section-id="ai-overview" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Overview" title="AI overview" icon="auto_awesome" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    AI appears throughout ProjectFlow in places where drafting, analysis, or exploration is helpful.
                    You will see AI buttons in Flows, Social Studio, project creation, and the media library. These
                    tools are designed to accelerate a first pass, not replace final judgment.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Drafting</div>
                        <p className="mt-2">
                            Generate descriptions, outlines, and early content so teams can iterate quickly.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Analysis</div>
                        <p className="mt-2">
                            Run structured analysis like SWOT, strategy, or risk review inside flows and campaigns.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Media</div>
                        <p className="mt-2">
                            Generate and refine visuals in the media library for rapid creative iteration.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="ai-search" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Discover" title="AI search and answers" icon="search" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    The AI search bar can answer questions about projects, tasks, and issues by summarizing workspace
                    context. It is ideal for quick briefings, status checks, or spotting what needs attention next.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Use cases</div>
                        <p className="mt-2">
                            Ask "What is blocked this week?" or "Summarize project status" to get a fast, human-readable
                            response.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Context scope</div>
                        <p className="mt-2">
                            Answers are based on your workspace data. The quality of results improves when tasks and
                            statuses are kept current.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="ai-drafting" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Create" title="Drafting and planning" icon="edit" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    AI drafting tools are available in the project creation flow, task creation, and within Flows. Use
                    them to generate a starting point, then refine the output with your team's context.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Project setup</div>
                        <p className="mt-2">
                            Generate project descriptions and structured blueprints from a short prompt.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Tasks</div>
                        <p className="mt-2">
                            Draft task descriptions or refine task details when you need clarity quickly.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Flows</div>
                        <p className="mt-2">
                            Draft concept documents, positioning, and structured outlines in Flow stages.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="ai-analysis" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Analyze" title="Analysis and strategy" icon="analytics" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    AI analysis tools help teams evaluate risk, strategy, and readiness. Use them to supplement your
                    judgment, then validate the output with real data before committing.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Flows analysis</div>
                        <p className="mt-2">
                            Run SWOT, product strategy, discovery, development, and launch analysis inside Flow stages.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Campaign review</div>
                        <p className="mt-2">
                            Use AI risk and win analysis in Social Campaign reviews to quantify probability and risk.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="ai-social" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Social" title="Social AI tooling" icon="campaign" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Social Studio includes AI support for campaign strategy, content planning, and creative guidance.
                    Use it to brainstorm platform strategies, generate captions, and refine campaign concepts.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Strategy</div>
                        <p className="mt-2">
                            Generate channel strategies and audience alternatives to explore more options.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Content</div>
                        <p className="mt-2">
                            Create captions, hashtags, or scripts that match the platform and tone.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Planning</div>
                        <p className="mt-2">
                            Use AI to propose weekly plans or content concepts when starting from a blank slate.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="ai-media" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Media" title="AI images and media" icon="photo_library" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    The media library supports AI image generation and edits. This is useful for early creative
                    exploration, campaign moodboards, or quick mockups before design work begins.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Generate</div>
                        <p className="mt-2">
                            Use prompts to create new images. Iterate with variations to explore style.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Edit</div>
                        <p className="mt-2">
                            Rework existing images to adjust tone, composition, or details without starting from scratch.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="ai-usage-limits" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Usage" title="Usage limits and quota" icon="insights" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    You can view AI usage in Settings under Billing & Plans. The token and image counters show what has
                    been consumed this month, and usage resets at the start of each calendar month.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Monthly quota</div>
                        <p className="mt-2">
                            The limit shown in your account is not a hard limit. It is the monthly quota included in
                            your current billing plan.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Reset cadence</div>
                        <p className="mt-2">
                            Quotas reset monthly. If you consistently exceed your included quota, review your plan or
                            contact your workspace owner for adjustments.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="ai-limitations" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Quality" title="Limitations and best practices" icon="shield" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    AI output is probabilistic and can be wrong, incomplete, or inconsistent. Treat AI responses as a
                    first draft and verify facts before sharing or making decisions.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Improve results</div>
                        <p className="mt-2">
                            Provide specific context, constraints, and examples. Vague prompts lead to vague output.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Human review</div>
                        <p className="mt-2">
                            Validate AI output with your team before final approval, especially for external content.
                        </p>
                    </InfoCard>
                </div>
                <Callout>
                    The best results come from a feedback loop: generate, review, refine, and then finalize.
                </Callout>
            </section>
        </div>
    );
};
