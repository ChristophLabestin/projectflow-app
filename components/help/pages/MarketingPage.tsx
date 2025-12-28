import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const marketingSections: HelpCenterSectionIndex[] = [
    { id: 'email-builder', title: 'Email builder', summary: 'Compose emails with modular blocks.', content: 'Build layouts and manage variables.', keywords: ['email', 'builder', 'blocks'] },
    { id: 'templates', title: 'Templates', summary: 'Pre-built email templates.', content: 'Start from templates and customize.', keywords: ['templates', 'layouts'] },
    { id: 'recipients', title: 'Recipients and segments', summary: 'Organize who receives campaigns.', content: 'Manage lists and targeting.', keywords: ['recipients', 'segments', 'lists'] },
    { id: 'variables', title: 'Variables and personalization', summary: 'Dynamic content.', content: 'Personalize with variables.', keywords: ['variables', 'personalization'] },
    { id: 'paid-ads', title: 'Paid ads', summary: 'Track ad initiatives.', content: 'Monitor spend and performance.', keywords: ['ads', 'paid', 'spend'] },
    { id: 'performance', title: 'Performance review', summary: 'Results after launch.', content: 'Review to improve next campaign.', keywords: ['performance', 'metrics'] }
];

const BlockCard = ({ icon, name, description }: { icon: string; name: string; description: string }) => (
    <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[20px] text-[var(--color-primary)]">{icon}</span>
        </div>
        <div><div className="text-sm font-bold text-[var(--color-text-main)]">{name}</div><p className="text-xs text-[var(--color-text-muted)] mt-1">{description}</p></div>
    </div>
);

const MetricCard = ({ label, description, icon, color }: { label: string; description: string; icon: string; color: string }) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5 text-center">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mx-auto`}><span className="material-symbols-outlined text-[24px] text-white">{icon}</span></div>
        <div className="text-sm font-bold text-[var(--color-text-main)] mt-3">{label}</div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">{description}</p>
    </div>
);

const StepBlock = ({ step, title, children }: { step: string; title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
        <div className="flex items-center justify-between mb-3"><span className="text-sm font-bold text-[var(--color-text-main)]">{title}</span><span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[10px] font-bold text-[var(--color-text-muted)]">{step}</span></div>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{children}</p>
    </div>
);

const Callout = ({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) => {
    const styles = { tip: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200', warning: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200', info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/40 dark:bg-sky-900/20 dark:text-sky-200' };
    const icons = { tip: 'lightbulb', warning: 'warning', info: 'info' };
    return <div className={`rounded-2xl border p-4 text-[13px] ${styles[type]}`}><div className="flex items-start gap-2"><span className="material-symbols-outlined text-[18px]">{icons[type]}</span><div>{children}</div></div></div>;
};

export const MarketingPage = (_props: HelpCenterPageProps) => (
    <div className="px-6 py-6 space-y-10">
        <div className="rounded-[28px] border border-[var(--color-surface-border)] bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Marketing</div>
            <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">Build Campaigns with a Clear Funnel</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed max-w-2xl">Marketing tools help you plan, produce, and measure outreach. Use the builder for email, manage recipients centrally, and track paid ad performance.</p>
        </div>

        <section data-section-id="email-builder" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Create</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Email Builder</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Build emails with modular blocks for consistent layouts.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <BlockCard icon="title" name="Header" description="Logo, nav links, and top content" />
                <BlockCard icon="article" name="Text" description="Paragraphs with rich formatting" />
                <BlockCard icon="image" name="Image" description="Single or multi-column images" />
                <BlockCard icon="smart_button" name="CTA Button" description="Call-to-action buttons" />
                <BlockCard icon="view_column" name="Columns" description="Multi-column layouts" />
                <BlockCard icon="format_quote" name="Quote" description="Testimonials and pull quotes" />
                <BlockCard icon="horizontal_rule" name="Divider" description="Visual section separators" />
                <BlockCard icon="call_to_action" name="Footer" description="Unsubscribe and legal text" />
            </div>
        </section>

        <section data-section-id="templates" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Start Fast</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Templates</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Pre-built templates for common use cases.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[['Newsletter', 'Regular updates with multiple sections', 'newspaper'], ['Announcement', 'Single-purpose launch or news', 'campaign'], ['Promotional', 'Sales, offers, and discounts', 'sell'], ['Welcome', 'Onboarding new subscribers', 'waving_hand'], ['Event', 'Invitations and reminders', 'event'], ['Digest', 'Weekly or monthly roundups', 'summarize']].map(([n, d, i]) => <div key={n} className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4"><div className="flex items-center gap-3"><span className="material-symbols-outlined text-[20px] text-[var(--color-primary)]">{i}</span><span className="text-sm font-bold text-[var(--color-text-main)]">{n}</span></div><p className="text-xs text-[var(--color-text-muted)] mt-2">{d}</p></div>)}
            </div>
        </section>

        <section data-section-id="recipients" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Audience</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Recipients and Segments</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Organize who receives each campaign.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StepBlock step="Step 1" title="Import or Add Recipients">Upload a CSV, connect an integration, or add contacts manually.</StepBlock>
                <StepBlock step="Step 2" title="Clean and Validate">Remove duplicates, fix formatting, verify email validity.</StepBlock>
                <StepBlock step="Step 3" title="Create Segments">Group by behavior, location, lifecycle stage, or custom fields.</StepBlock>
                <StepBlock step="Step 4" title="Target Campaigns">Select segments when creating a campaign. Save for reuse.</StepBlock>
            </div>
        </section>

        <section data-section-id="variables" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Personalize</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Variables and Personalization</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Variable Syntax</div>
                    <div className="space-y-2 text-sm">{[['{{first_name}}', 'Recipient first name'], ['{{company}}', 'Company name'], ['{{unsubscribe_url}}', 'Unsubscribe link'], ['{{current_year}}', 'Dynamic year']].map(([v, d]) => <div key={v} className="flex justify-between py-2 border-b border-[var(--color-surface-border)] last:border-0"><code className="text-[var(--color-primary)] text-xs">{v}</code><span className="text-[var(--color-text-muted)]">{d}</span></div>)}</div>
                </div>
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Best Practices</div>
                    <div className="space-y-3 text-sm text-[var(--color-text-muted)]">
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>Always set fallback values for missing data</div>
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>Test with sample recipients before sending</div>
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>Preview how variables render on mobile</div>
                    </div>
                </div>
            </div>
        </section>

        <section data-section-id="paid-ads" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Advertising</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Paid Ads Tracking</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Track ad initiatives and outcomes.</p></div>
            <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Ad Fields</div>
                <div className="space-y-2">{[['Platform', 'Google, Meta, LinkedIn, TikTok, etc.'], ['Budget', 'Allocated spend for this initiative'], ['Spend', 'Actual spend to date'], ['Goal', 'Target outcome (clicks, signups, sales)'], ['Status', 'Active, Paused, Completed'], ['Notes', 'Learnings and observations']].map(([f, d]) => <div key={f} className="flex justify-between py-2 border-b border-[var(--color-surface-border)] last:border-0"><span className="text-sm font-medium text-[var(--color-text-main)]">{f}</span><span className="text-sm text-[var(--color-text-muted)]">{d}</span></div>)}</div>
            </div>
        </section>

        <section data-section-id="performance" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Measure</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Performance Review</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Keep results visible after launch.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard label="Open Rate" description="% who opened the email" icon="visibility" color="bg-sky-500" />
                <MetricCard label="Click Rate" description="% who clicked a link" icon="touch_app" color="bg-emerald-500" />
                <MetricCard label="Conversion" description="% who completed goal" icon="check_circle" color="bg-purple-500" />
                <MetricCard label="Unsubscribe" description="% who opted out" icon="unsubscribe" color="bg-rose-500" />
            </div>
            <Callout type="info">Review results and document learnings. Performance reviews feed the next campaign so you improve over time.</Callout>
        </section>
    </div>
);
