import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const marketingSections: HelpCenterSectionIndex[] = [
    {
        id: 'email-builder',
        title: 'Email builder',
        summary: 'Compose emails with modular blocks.',
        content: 'Build layouts, manage variables, and preview campaigns.'
    },
    {
        id: 'recipients',
        title: 'Recipients and segments',
        summary: 'Organize who receives each campaign.',
        content: 'Maintain lists, segments, and targeting logic.'
    },
    {
        id: 'paid-ads',
        title: 'Paid ads',
        summary: 'Track ad initiatives and outcomes.',
        content: 'Monitor goals, spend, and performance.'
    },
    {
        id: 'performance',
        title: 'Performance review',
        summary: 'Keep results visible after launch.',
        content: 'Review results to improve the next campaign.'
    }
];

const StepBlock = ({
    id,
    title,
    children,
    step
}: {
    id: string;
    title: string;
    children: React.ReactNode;
    step: string;
}) => (
    <section
        data-section-id={id}
        className="help-section rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5"
    >
        <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[var(--color-text-main)]">{title}</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                {step}
            </span>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mt-2 leading-relaxed">{children}</p>
    </section>
);

export const MarketingPage = ({ sections, activeSectionId, onSectionSelect }: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-8">
            <div className="rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                    Marketing
                </div>
                <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                    Build campaigns with a clear funnel
                </h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-2 leading-relaxed">
                    Marketing tools help you plan, produce, and measure outreach. Use the builder for email, manage
                    recipients centrally, and track paid ad performance in one place.
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <StepBlock id="email-builder" title="Email builder" step="Step 1">
                    Build emails using structured blocks so layout stays consistent. Variables let you personalize
                    content without rewriting every section. Preview before launch to confirm the experience.
                </StepBlock>
                <StepBlock id="recipients" title="Recipients and segments" step="Step 2">
                    Keep recipient lists clean and organized. Segments help you target messaging based on behavior,
                    region, or lifecycle stage so campaigns stay relevant.
                </StepBlock>
                <StepBlock id="paid-ads" title="Paid ads" step="Step 3">
                    Track paid initiatives with clear goals and budgets. Use outcomes and notes to understand what
                    worked and where spend should shift next.
                </StepBlock>
                <StepBlock id="performance" title="Performance review" step="Step 4">
                    After launch, review results and document learnings. Performance reviews feed the next campaign so
                    you improve over time, not just by instinct.
                </StepBlock>
            </div>
        </div>
    );
};
