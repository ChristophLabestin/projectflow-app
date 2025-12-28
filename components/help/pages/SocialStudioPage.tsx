import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const socialStudioSections: HelpCenterSectionIndex[] = [
    { id: 'campaign-pipeline', title: 'Campaign pipeline', summary: 'How campaigns progress through stages.', content: 'From concept to active campaign.', keywords: ['pipeline', 'stages', 'lifecycle'] },
    { id: 'campaign-strategy', title: 'Campaign strategy', summary: 'Define audience and channel direction.', content: 'Strategy connects creative to channels.', keywords: ['strategy', 'audience', 'channels'] },
    { id: 'platform-reference', title: 'Platform reference', summary: 'Supported platforms and features.', content: 'All supported social platforms.', keywords: ['platforms', 'instagram', 'twitter'] },
    { id: 'phases-kpis', title: 'Phases and KPIs', summary: 'Organize campaigns into phases.', content: 'Launch, growth, sustain phases.', keywords: ['phases', 'kpis', 'metrics'] },
    { id: 'posts-scheduling', title: 'Posts and scheduling', summary: 'Draft and schedule content.', content: 'Create posts and manage calendar.', keywords: ['posts', 'calendar', 'schedule'] },
    { id: 'review-approval', title: 'Review and approval', summary: 'Approve or request changes.', content: 'Review workflow for campaigns.', keywords: ['review', 'approval', 'workflow'] }
];

const StageCard = ({ stage, title, color, description, isActive }: { stage: number; title: string; color: string; description: string; isActive?: boolean }) => (
    <div className={`rounded-2xl border p-4 transition-all ${isActive ? `border-${color} bg-${color}/10` : 'border-[var(--color-surface-border)] bg-[var(--color-surface-card)]'}`}>
        <div className="flex items-center gap-3 mb-2">
            <div className={`w-8 h-8 rounded-full ${isActive ? color : 'bg-[var(--color-surface-hover)]'} flex items-center justify-center text-sm font-bold ${isActive ? 'text-white' : 'text-[var(--color-text-muted)]'}`}>{stage}</div>
            <span className="text-sm font-bold text-[var(--color-text-main)]">{title}</span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{description}</p>
    </div>
);

const PlatformCard = ({ icon, name, color, features }: { icon: string; name: string; color: string; features: string[] }) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
        <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}><span className="material-symbols-outlined text-[20px] text-white">{icon}</span></div>
            <span className="text-sm font-bold text-[var(--color-text-main)]">{name}</span>
        </div>
        <div className="flex flex-wrap gap-2">{features.map((f, i) => <span key={i} className="px-2 py-1 rounded-lg bg-[var(--color-surface-hover)] text-[10px] font-medium text-[var(--color-text-muted)]">{f}</span>)}</div>
    </div>
);

const PhaseCard = ({ name, description, icon, color }: { name: string; description: string; icon: string; color: string }) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5 text-center">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mx-auto`}><span className="material-symbols-outlined text-[24px] text-white">{icon}</span></div>
        <div className="text-sm font-bold text-[var(--color-text-main)] mt-3">{name}</div>
        <p className="text-xs text-[var(--color-text-muted)] mt-2 leading-relaxed">{description}</p>
    </div>
);

const Callout = ({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) => {
    const styles = { tip: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200', warning: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200', info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/40 dark:bg-sky-900/20 dark:text-sky-200' };
    const icons = { tip: 'lightbulb', warning: 'warning', info: 'info' };
    return <div className={`rounded-2xl border p-4 text-[13px] ${styles[type]}`}><div className="flex items-start gap-2"><span className="material-symbols-outlined text-[18px]">{icons[type]}</span><div>{children}</div></div></div>;
};

export const SocialStudioPage = (_props: HelpCenterPageProps) => (
    <div className="px-6 py-6 space-y-10">
        <div className="rounded-[28px] border border-[var(--color-surface-border)] bg-gradient-to-br from-pink-500/10 via-[var(--color-surface-card)] to-purple-500/10 p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Social Studio</div>
            <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">Plan, Create, and Review Campaigns</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed max-w-2xl">Social Studio connects strategy, creative, and publishing. Build campaigns with structured phases, draft posts, and keep approvals centralized.</p>
            <div className="mt-6 flex flex-wrap gap-2">
                {['Strategy', 'Calendar', 'Approval', 'Analytics'].map(t => <span key={t} className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">{t}</span>)}
            </div>
        </div>

        <section data-section-id="campaign-pipeline" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Lifecycle</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Campaign Pipeline</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Campaigns progress through stages from initial flow to active execution.</p></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StageCard stage={1} title="Concept" description="Initial flow capture" color="bg-slate-500" />
                <StageCard stage={2} title="Strategy" description="Define approach" color="bg-sky-500" isActive />
                <StageCard stage={3} title="Planning" description="Detail phases & KPIs" color="bg-amber-500" />
                <StageCard stage={4} title="Review" description="Get approval" color="bg-purple-500" />
                <StageCard stage={5} title="Approved" description="Ready for launch" color="bg-emerald-500" />
                <StageCard stage={6} title="Active" description="Live campaign" color="bg-pink-500" />
            </div>
        </section>

        <section data-section-id="campaign-strategy" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Foundation</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Campaign Strategy</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Strategy defines the core flow, audience, and tone across all channels.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Core Flow</div><p className="text-sm text-[var(--color-text-muted)]">The core message you want your audience to remember.</p></div>
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Hook</div><p className="text-sm text-[var(--color-text-muted)]">The opening angle that earns attention and signals relevance.</p></div>
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Audience</div><p className="text-sm text-[var(--color-text-muted)]">Who you want to reach and what they value most.</p></div>
            </div>
            <Callout type="tip">A campaign without a clear hook usually turns into posts with no shared purpose.</Callout>
        </section>

        <section data-section-id="platform-reference" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Channels</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Platform Reference</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">All supported platforms and their content types.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <PlatformCard icon="photo_camera" name="Instagram" color="bg-gradient-to-br from-purple-500 to-pink-500" features={['Posts', 'Stories', 'Reels', 'Carousel']} />
                <PlatformCard icon="alternate_email" name="X (Twitter)" color="bg-slate-800" features={['Tweets', 'Threads', 'Polls']} />
                <PlatformCard icon="smart_display" name="TikTok" color="bg-slate-900" features={['Videos', 'Duets']} />
                <PlatformCard icon="business_center" name="LinkedIn" color="bg-sky-700" features={['Posts', 'Articles', 'Carousels']} />
                <PlatformCard icon="thumb_up" name="Facebook" color="bg-blue-600" features={['Posts', 'Stories', 'Reels']} />
                <PlatformCard icon="play_circle" name="YouTube" color="bg-red-600" features={['Videos', 'Shorts', 'Community']} />
            </div>
        </section>

        <section data-section-id="phases-kpis" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Planning</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Phases and KPIs</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Organize campaigns into phases with clear goals.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PhaseCard name="Launch" description="Initial push to build awareness and momentum." icon="rocket_launch" color="bg-sky-500" />
                <PhaseCard name="Growth" description="Sustain engagement and expand reach progressively." icon="trending_up" color="bg-emerald-500" />
                <PhaseCard name="Sustain" description="Maintain presence and reinforce key messages." icon="loop" color="bg-amber-500" />
            </div>
            <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Common KPIs</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {[['Reach', 'Total unique views'], ['Engagement', 'Likes, comments, shares'], ['Clicks', 'Link or CTA clicks'], ['Conversions', 'Signups, purchases']].map(([k, d]) => <div key={k}><div className="font-semibold text-[var(--color-text-main)]">{k}</div><div className="text-xs text-[var(--color-text-muted)]">{d}</div></div>)}
                </div>
            </div>
        </section>

        <section data-section-id="posts-scheduling" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Execution</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Posts and Scheduling</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Create posts and manage the content calendar.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5"><div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-[18px] text-[var(--color-primary)]">edit</span><span className="text-sm font-bold text-[var(--color-text-main)]">Draft</span></div><p className="text-xs text-[var(--color-text-muted)]">Create posts with clear format so they can be reviewed faster.</p></div>
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5"><div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-[18px] text-amber-500">calendar_today</span><span className="text-sm font-bold text-[var(--color-text-main)]">Schedule</span></div><p className="text-xs text-[var(--color-text-muted)]">Place posts on calendar to confirm cadence and avoid overlaps.</p></div>
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5"><div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-[18px] text-emerald-500">visibility</span><span className="text-sm font-bold text-[var(--color-text-main)]">Preview</span></div><p className="text-xs text-[var(--color-text-muted)]">Validate copy, assets, and timing before post goes live.</p></div>
            </div>
        </section>

        <section data-section-id="review-approval" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Alignment</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Review and Approval</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Quality gate before campaigns go live.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800/40 dark:bg-emerald-900/20"><div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-2">Approve when</div><ul className="space-y-2 text-sm text-emerald-800 dark:text-emerald-200"><li>Strategy is consistent with brand</li><li>Phases are realistic</li><li>Content plan aligns to goals</li><li>KPIs are measurable</li></ul></div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-800/40 dark:bg-rose-900/20"><div className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-2">Request changes when</div><ul className="space-y-2 text-sm text-rose-800 dark:text-rose-200"><li>Audience is unclear</li><li>KPIs are missing</li><li>Cadence is not feasible</li><li>Assets are not ready</li></ul></div>
            </div>
            <Callout type="info">Use review notes to capture what needs adjustment so creators know exactly what to fix.</Callout>
        </section>
    </div>
);
