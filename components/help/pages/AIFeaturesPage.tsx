import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const aiFeaturesSections: HelpCenterSectionIndex[] = [
    { id: 'ai-capabilities', title: 'CORA capabilities matrix', summary: 'Complete catalog of all CORA features.', content: 'Every CORA capability organized by module.', keywords: ['capabilities', 'features', 'catalog'] },
    { id: 'ai-locations', title: 'CORA by module', summary: 'Where CORA appears in each module.', content: 'Find CORA tools across the application.', keywords: ['modules', 'tools'] },
    { id: 'prompt-engineering', title: 'Prompt engineering', summary: 'Get better results with better prompts.', content: 'Tips for effective CORA prompting.', keywords: ['prompts', 'tips'] },
    { id: 'image-generation', title: 'Image generation', summary: 'Create images with CORA.', content: 'Guide to CORA image creation.', keywords: ['images', 'generation'] },
    { id: 'token-usage', title: 'Token usage', summary: 'Understanding limits.', content: 'How tokens work and quotas.', keywords: ['tokens', 'quota'] },
    { id: 'quality-validation', title: 'Quality validation', summary: 'Review CORA output.', content: 'Best practices for validating CORA content.', keywords: ['quality', 'validation'] }
];

const CapabilityCard = ({ icon, name, description, location }: { icon: string; name: string; description: string; location: string }) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5 space-y-3">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-white">{icon}</span>
            </div>
            <div><div className="text-sm font-bold text-[var(--color-text-main)]">{name}</div><div className="text-[10px] text-[var(--color-text-muted)]">{location}</div></div>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
    </div>
);

const ModuleAICard = ({ icon, module, features, color }: { icon: string; module: string; features: string[]; color: string }) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
        <div className="flex items-center gap-3 mb-3"><div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}><span className="material-symbols-outlined text-[20px] text-white">{icon}</span></div><span className="text-base font-bold text-[var(--color-text-main)]">{module}</span></div>
        <div className="space-y-2">{features.map((f, i) => <div key={i} className="text-sm text-[var(--color-text-muted)] flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />{f}</div>)}</div>
    </div>
);

const Callout = ({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) => {
    const styles = { tip: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200', warning: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200', info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/40 dark:bg-sky-900/20 dark:text-sky-200' };
    const icons = { tip: 'lightbulb', warning: 'warning', info: 'info' };
    return <div className={`rounded-2xl border p-4 text-[13px] ${styles[type]}`}><div className="flex items-start gap-2"><span className="material-symbols-outlined text-[18px]">{icons[type]}</span><div>{children}</div></div></div>;
};

export const AIFeaturesPage = (_props: HelpCenterPageProps) => (
    <div className="px-6 py-6 space-y-10">
        <div className="rounded-[28px] border border-[var(--color-surface-border)] bg-gradient-to-br from-purple-500/10 via-[var(--color-surface-card)] to-pink-500/10 p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">CORA Features</div>
            <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">Intelligent Acceleration</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed max-w-2xl">ProjectFlow CORA accelerates drafting, analysis, and creative work across the platform.</p>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] p-3 text-center"><div className="text-2xl font-bold text-[var(--color-primary)]">12+</div><div className="text-xs text-[var(--color-text-muted)]">CORA Tools</div></div>
                <div className="rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] p-3 text-center"><div className="text-2xl font-bold text-purple-500">6</div><div className="text-xs text-[var(--color-text-muted)]">Modules with CORA</div></div>
                <div className="rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] p-3 text-center"><div className="text-2xl font-bold text-pink-500">∞</div><div className="text-xs text-[var(--color-text-muted)]">Image Styles</div></div>
                <div className="rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] p-3 text-center"><div className="text-2xl font-bold text-amber-500">24/7</div><div className="text-xs text-[var(--color-text-muted)]">Availability</div></div>
            </div>
        </div>

        <section data-section-id="ai-capabilities" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Catalog</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">CORA Capabilities Matrix</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <CapabilityCard icon="analytics" name="SWOT Analysis" description="Generate comprehensive strengths, weaknesses, opportunities, and threats." location="Flows → CORA Studio" />
                <CapabilityCard icon="architecture" name="Blueprint" description="Create structured execution plans with phases and timelines." location="Flows → CORA Studio" />
                <CapabilityCard icon="warning" name="Risk Analysis" description="Identify potential risks with probability and mitigations." location="Flows, Campaigns" />
                <CapabilityCard icon="search" name="CORA Search" description="Ask questions and get summarized answers from your data." location="Global Search" />
                <CapabilityCard icon="image" name="Image Generation" description="Create images from text prompts with various styles." location="Media Library" />
                <CapabilityCard icon="campaign" name="Campaign Strategy" description="Generate channel strategies and audience targeting." location="Social Studio" />
            </div>
        </section>

        <section data-section-id="ai-locations" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Context</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">CORA by Module</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ModuleAICard icon="flow_chart" module="Flows" color="bg-sky-500" features={['SWOT Analysis', 'Blueprint Generation', 'Risk Analysis', 'Discovery & Strategy']} />
                <ModuleAICard icon="campaign" module="Social Studio" color="bg-pink-500" features={['Campaign Strategy', 'Caption Generator', 'Hashtag Suggestions', 'Win/Risk Analysis']} />
                <ModuleAICard icon="photo_library" module="Media Library" color="bg-purple-500" features={['Image Generation', 'Style Transfer', 'Image Variations']} />
                <ModuleAICard icon="search" module="Global Search" color="bg-emerald-500" features={['CORA Answers', 'Context Search']} />
            </div>
        </section>

        <section data-section-id="prompt-engineering" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Best Practices</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Prompt Engineering</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/20"><div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">✓ Do</div><ul className="space-y-2 text-sm text-emerald-800 dark:text-emerald-200"><li>Be specific about context and audience</li><li>Define output format and constraints</li><li>Include examples when helpful</li><li>Iterate based on results</li></ul></div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800/40 dark:bg-rose-900/20"><div className="text-xs font-bold text-rose-700 dark:text-rose-300 mb-2">✗ Avoid</div><ul className="space-y-2 text-sm text-rose-800 dark:text-rose-200"><li>Vague, one-word prompts</li><li>Missing context about your needs</li><li>Expecting perfect first outputs</li><li>Using output without review</li></ul></div>
            </div>
            <Callout type="tip">Strong prompts include: subject, context, format, constraints, and examples.</Callout>
        </section>

        <section data-section-id="image-generation" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">CORA Visuals</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Image Generation</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Prompt Structure</div><div className="space-y-2 text-sm text-[var(--color-text-muted)]"><div><span className="font-semibold text-[var(--color-text-main)]">Subject:</span> What is the main subject?</div><div><span className="font-semibold text-[var(--color-text-main)]">Style:</span> Photo, illustration, 3D render, etc.</div><div><span className="font-semibold text-[var(--color-text-main)]">Mood:</span> Bright, moody, professional, playful</div><div><span className="font-semibold text-[var(--color-text-main)]">Details:</span> Lighting, colors, composition</div></div></div>
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Available Sizes</div><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-[var(--color-text-main)]">1:1 Square</span><span className="text-[var(--color-text-muted)]">1024×1024</span></div><div className="flex justify-between"><span className="text-[var(--color-text-main)]">16:9 Landscape</span><span className="text-[var(--color-text-muted)]">1792×1024</span></div><div className="flex justify-between"><span className="text-[var(--color-text-main)]">9:16 Portrait</span><span className="text-[var(--color-text-muted)]">1024×1792</span></div></div></div>
            </div>
        </section>

        <section data-section-id="token-usage" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Limits</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Token Usage and Quotas</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Typical Consumption</div><div className="space-y-2 text-sm">{[['SWOT Analysis', '~2K'], ['Blueprint', '~3K'], ['Caption', '~500'], ['CORA Search', '~1K'], ['Image', '1 credit']].map(([a, t]) => <div key={a} className="flex justify-between"><span className="text-[var(--color-text-main)]">{a}</span><span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-bold">{t}</span></div>)}</div></div>
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Quota Info</div><div className="space-y-3 text-sm text-[var(--color-text-muted)]"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">refresh</span>Resets monthly on the 1st</div><div className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">settings</span>View in Settings → Billing</div><div className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">warning</span>Warnings at 80% and 90%</div></div></div>
            </div>
        </section>

        <section data-section-id="quality-validation" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Review</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Quality Validation</h3></div>
            <div className="space-y-3">{[['Check factual accuracy', 'Verify claims, statistics, and details'], ['Cross-reference data', 'Validate against your actual project data'], ['Review tone', 'Adjust to match your brand voice'], ['Get team input', 'Share drafts for multiple perspectives'], ['Iterate', 'Refine based on expertise']].map(([t, d], i) => <div key={i} className="flex items-start gap-3"><div className="w-7 h-7 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-primary-text)] text-sm font-bold flex-shrink-0">{i + 1}</div><div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-3 flex-1"><div className="text-sm font-semibold text-[var(--color-text-main)]">{t}</div><div className="text-xs text-[var(--color-text-muted)] mt-1">{d}</div></div></div>)}</div>
            <Callout type="warning">Never publish CORA content without human review. CORA is a drafting tool, not a replacement for judgment.</Callout>
        </section>
    </div>
);
