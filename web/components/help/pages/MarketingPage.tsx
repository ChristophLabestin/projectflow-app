import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const marketingSections: HelpCenterSectionIndex[] = [
    { id: 'blog-connection', title: 'Blog connection', summary: 'Connect the project to your website blog API.', content: 'Configure the blog endpoint in Marketing settings.', keywords: ['blog', 'api', 'connection', 'settings'] },
    { id: 'blog-posts', title: 'Blog posts', summary: 'Write, translate, and publish posts.', content: 'Use the editor, templates, and categories to publish posts.', keywords: ['blog', 'posts', 'editor', 'publish'] }
];

const StepBlock = ({ step, title, children }: { step: string; title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-surface bg-card p-5">
        <div className="flex items-center justify-between mb-3"><span className="text-sm font-bold text-main">{title}</span><span className="px-2 py-0.5 rounded-full bg-surface-hover text-[10px] font-bold text-muted">{step}</span></div>
        <p className="text-sm text-muted leading-relaxed">{children}</p>
    </div>
);

export const MarketingPage = (_props: HelpCenterPageProps) => (
    <div className="px-6 py-6 space-y-10">
        <div className="rounded-[28px] border border-surface bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Marketing</div>
            <h2 className="text-3xl font-bold text-main mt-3">Publish to Your Blog</h2>
            <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">The Marketing module manages the blog of your website: connect the blog API once, then write, translate, and publish posts from the project.</p>
        </div>

        <section data-section-id="blog-connection" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Setup</div><h3 className="text-xl font-bold text-main mt-2">Blog Connection</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StepBlock step="Step 1" title="Open Marketing Settings">Go to Marketing → Settings in the project.</StepBlock>
                <StepBlock step="Step 2" title="Connect the API">Use the connection wizard to enter the blog endpoint and authentication.</StepBlock>
            </div>
        </section>

        <section data-section-id="blog-posts" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Write</div><h3 className="text-xl font-bold text-main mt-2">Blog Posts</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StepBlock step="Draft" title="Write">Compose posts in the editor, start from a template, or let CORA draft one.</StepBlock>
                <StepBlock step="Organize" title="Categorize">Manage categories directly from the editor.</StepBlock>
                <StepBlock step="Publish" title="Publish">Publish or update the post on the connected blog.</StepBlock>
            </div>
        </section>
    </div>
);
