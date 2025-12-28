import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const mediaLibrarySections: HelpCenterSectionIndex[] = [
    {
        id: 'media-overview',
        title: 'Media Library overview',
        summary: 'A single place for uploads, stock, and AI assets.',
        content: 'Manage all project media in one organized library.',
        keywords: ['media', 'library', 'assets']
    },
    {
        id: 'modal-entry',
        title: 'Using the Media Library modal',
        summary: 'Select, upload, and edit without leaving your workflow.',
        content: 'The modal lets you pick assets from anywhere in the app.',
        keywords: ['modal', 'picker', 'select']
    },
    {
        id: 'upload-gallery',
        title: 'Uploads and gallery',
        summary: 'Bring in files and keep them organized.',
        content: 'Upload files or browse existing assets in the gallery tab.',
        keywords: ['upload', 'gallery', 'files']
    },
    {
        id: 'stock-content',
        title: 'Stock content',
        summary: 'Search curated stock images.',
        content: 'Use stock search when you need high-quality visuals fast.',
        keywords: ['stock', 'unsplash', 'search']
    },
    {
        id: 'ai-media',
        title: 'AI image generation',
        summary: 'Generate or rework visuals with AI.',
        content: 'Create new assets or rework existing images directly in the modal.',
        keywords: ['ai', 'images', 'generation']
    },
    {
        id: 'editing-workflow',
        title: 'Editing and cropping',
        summary: 'Adjust images before you save or select.',
        content: 'Crop, edit, and finalize visuals without leaving the library.',
        keywords: ['edit', 'crop', 'image editor']
    },
    {
        id: 'best-practices',
        title: 'Best practices',
        summary: 'Keep the library tidy and reusable.',
        content: 'Use consistent naming and reuse assets across projects.',
        keywords: ['best practices', 'organization']
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

export const MediaLibraryPage = ({ sections, activeSectionId, onSectionSelect }: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-6">
                <div className="rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                        Media Library
                    </div>
                    <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                        Manage every asset in one place
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed">
                        The Media Library centralizes uploads, stock imagery, and AI-generated assets. You can open it
                        as a full page or use the modal picker anywhere you need to attach media.
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
                        Use the modal when you need to select a single image quickly. Use the full Media Library page
                        when you are organizing assets in bulk.
                    </div>
                </aside>
            </div>

            <section data-section-id="media-overview" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Overview" title="Media Library overview" icon="photo_library" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    The Media Library stores everything you upload or generate, including project covers, social
                    assets, marketing imagery, and AI creations. All assets are centralized so teams can reuse and
                    share visuals instead of uploading duplicates.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Uploads</div>
                        <p className="mt-2">
                            Drag and drop files or browse to upload images and videos.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Stock</div>
                        <p className="mt-2">
                            Search curated stock images for fast, high-quality visuals.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">AI</div>
                        <p className="mt-2">
                            Generate or rework images without leaving the library.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="modal-entry" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Modal" title="Using the Media Library modal" icon="open_in_full" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    The modal is the fastest way to attach media while you work. It appears in project settings,
                    social posts, email builder, and profile editors so you can select or upload assets without
                    navigating away.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Quick selection</div>
                        <p className="mt-2">
                            Open the modal, browse the gallery, and click any asset to attach it instantly.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Context aware</div>
                        <p className="mt-2">
                            The modal stays scoped to the active project or user so you see the right assets first.
                        </p>
                    </InfoCard>
                </div>
                <Callout>
                    Use the modal for quick pick-and-go tasks. Use the full page when you want to clean up or
                    reorganize your library.
                </Callout>
            </section>

            <section data-section-id="upload-gallery" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Library" title="Uploads and gallery" icon="cloud_upload" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Uploads are stored in the gallery so they can be reused across the project. Drag files into the
                    upload area, or use the file picker if you are on a restricted device.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Supported files</div>
                        <p className="mt-2">
                            The library supports common image formats and video files. Large assets may take longer to
                            upload depending on your connection.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Gallery view</div>
                        <p className="mt-2">
                            Gallery keeps assets visible in a grid for fast selection and visual scanning.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="stock-content" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Stock" title="Stock content" icon="collections" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Stock search is useful when you need strong visuals fast. Search by keyword, preview options, and
                    save selected images directly into your library for reuse.
                </p>
                <InfoCard>
                    Stock images are stored like uploads so you can reuse them across campaigns without repeating the
                    search.
                </InfoCard>
            </section>

            <section data-section-id="ai-media" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="AI" title="AI image generation" icon="auto_awesome" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    The AI tab lets you generate new images from prompts or rework an existing asset with a new style.
                    Use AI for exploration, then select the strongest result to keep in the library.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Generate</div>
                        <p className="mt-2">
                            Describe the scene, mood, and style. The more precise the prompt, the better the output.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Rework</div>
                        <p className="mt-2">
                            Select an existing image and apply a new style without rebuilding the entire asset.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="editing-workflow" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Editing" title="Editing and cropping" icon="crop" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    The built-in editor lets you crop and adjust visuals before saving or selecting them. Use it to
                    fit assets to the exact dimensions you need for a post, email, or cover.
                </p>
                <InfoCard>
                    If you are using a circular crop (for avatars or icons), the editor will guide you with the
                    correct shape so the final image looks clean.
                </InfoCard>
            </section>

            <section data-section-id="best-practices" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Guidance" title="Best practices" icon="check_circle" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        Use descriptive file names so teammates can find assets quickly.
                    </InfoCard>
                    <InfoCard>
                        Reuse strong assets across campaigns to keep a consistent visual identity.
                    </InfoCard>
                    <InfoCard>
                        Archive outdated assets to keep the gallery clean.
                    </InfoCard>
                    <InfoCard>
                        Use AI for exploration, then finalize with human review.
                    </InfoCard>
                </div>
            </section>
        </div>
    );
};
