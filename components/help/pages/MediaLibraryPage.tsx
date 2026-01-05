import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const mediaLibrarySections: HelpCenterSectionIndex[] = [
    { id: 'file-types', title: 'Supported file types', summary: 'Complete list of formats and limits.', content: 'All supported file types with size limits.', keywords: ['files', 'formats', 'types'] },
    { id: 'upload-methods', title: 'Upload methods', summary: 'Ways to add media.', content: 'Drag & drop, file picker, URL import, CORA generation.', keywords: ['upload', 'import'] },
    { id: 'image-editor', title: 'Image editor', summary: 'Edit images in-app.', content: 'Crop, resize, rotate, and adjust images.', keywords: ['editor', 'crop', 'resize'] },
    { id: 'stock-search', title: 'Stock photo search', summary: 'Find royalty-free images.', content: 'Search and use stock photos.', keywords: ['stock', 'photos', 'search'] },
    { id: 'ai-generation', title: 'CORA image generation', summary: 'Create with CORA.', content: 'Generate images from prompts.', keywords: ['cora', 'ai', 'generation', 'create'] },
    { id: 'organization', title: 'Organization', summary: 'Keep assets organized.', content: 'Naming, folders, and tagging best practices.', keywords: ['organize', 'folders', 'tags'] }
];

const FileTypeCard = ({ ext, icon, limit, description }: { ext: string; icon: string; limit: string; description: string }) => (
    <div className="rounded-xl border border-surface bg-card p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
        </div>
        <div className="flex-1">
            <div className="flex items-center gap-2"><span className="text-sm font-bold text-main">{ext}</span><span className="px-2 py-0.5 rounded-full bg-surface-hover text-[10px] text-muted">{limit}</span></div>
            <p className="text-xs text-muted mt-1">{description}</p>
        </div>
    </div>
);

const UploadCard = ({ icon, method, description, color }: { icon: string; method: string; description: string; color: string }) => (
    <div className="rounded-2xl border border-surface bg-card p-5 text-center">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mx-auto`}><span className="material-symbols-outlined text-[24px] text-white">{icon}</span></div>
        <div className="text-sm font-bold text-main mt-3">{method}</div>
        <p className="text-xs text-muted mt-2 leading-relaxed">{description}</p>
    </div>
);

const EditorTool = ({ icon, name, description }: { icon: string; name: string; description: string }) => (
    <div className="flex items-center gap-3 py-3 border-b border-surface last:border-0">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
        <div><div className="text-sm font-medium text-main">{name}</div><div className="text-xs text-muted">{description}</div></div>
    </div>
);

const Callout = ({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) => {
    const styles = { tip: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200', warning: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200', info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/40 dark:bg-sky-900/20 dark:text-sky-200' };
    const icons = { tip: 'lightbulb', warning: 'warning', info: 'info' };
    return <div className={`rounded-2xl border p-4 text-[13px] ${styles[type]}`}><div className="flex items-start gap-2"><span className="material-symbols-outlined text-[18px]">{icons[type]}</span><div>{children}</div></div></div>;
};

export const MediaLibraryPage = (_props: HelpCenterPageProps) => (
    <div className="px-6 py-6 space-y-10">
        <div className="rounded-[28px] border border-surface bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Media Library</div>
            <h2 className="text-3xl font-bold text-main mt-3">Your Visual Asset Hub</h2>
            <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">Store, organize, and create visual assets. Upload files, search stock photos, generate images with CORA, and edit directly in the app.</p>
            <div className="mt-6 flex flex-wrap gap-2">
                {['Images', 'Videos', 'Documents', 'Stock', 'CORA Generated'].map(t => <span key={t} className="px-3 py-1 rounded-full text-[10px] font-semibold bg-surface-hover text-muted">{t}</span>)}
            </div>
        </div>

        <section data-section-id="file-types" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Formats</div><h3 className="text-xl font-bold text-main mt-2">Supported File Types</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FileTypeCard ext="JPG / JPEG" icon="image" limit="Max 25MB" description="Standard photo format, best for photos and complex images." />
                <FileTypeCard ext="PNG" icon="image" limit="Max 25MB" description="Lossless format, ideal for graphics with transparency." />
                <FileTypeCard ext="WEBP" icon="image" limit="Max 25MB" description="Modern format with excellent compression and quality." />
                <FileTypeCard ext="GIF" icon="gif_box" limit="Max 10MB" description="Animated images and simple graphics." />
                <FileTypeCard ext="SVG" icon="shapes" limit="Max 5MB" description="Vector graphics that scale without quality loss." />
                <FileTypeCard ext="MP4" icon="movie" limit="Max 100MB" description="Standard video format for recordings and clips." />
                <FileTypeCard ext="PDF" icon="description" limit="Max 50MB" description="Documents, presentations, and printable materials." />
                <FileTypeCard ext="HEIC" icon="image" limit="Max 25MB" description="Apple's high-efficiency image format." />
            </div>
        </section>

        <section data-section-id="upload-methods" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Add Media</div><h3 className="text-xl font-bold text-main mt-2">Upload Methods</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <UploadCard icon="upload_file" method="Drag & Drop" description="Drop files directly onto the library to upload instantly." color="bg-sky-500" />
                <UploadCard icon="folder_open" method="File Picker" description="Click upload button to browse and select files." color="bg-emerald-500" />
                <UploadCard icon="image_search" method="Stock Search" description="Search and add royalty-free stock photos." color="bg-amber-500" />
                <UploadCard icon="auto_awesome" method="CORA Generate" description="Create new images from text prompts using CORA." color="bg-purple-500" />
            </div>
        </section>

        <section data-section-id="image-editor" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Edit</div><h3 className="text-xl font-bold text-main mt-2">Image Editor</h3><p className="text-sm text-muted mt-2 max-w-xl">Edit images directly without external software.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-surface bg-card p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Tools</div>
                    <EditorTool icon="crop" name="Crop" description="Select and keep a portion of the image" />
                    <EditorTool icon="aspect_ratio" name="Resize" description="Change dimensions with locked or free aspect ratio" />
                    <EditorTool icon="rotate_right" name="Rotate" description="Rotate 90° or flip horizontally/vertically" />
                    <EditorTool icon="tune" name="Adjust" description="Brightness, contrast, and saturation controls" />
                </div>
                <div className="rounded-2xl border border-surface bg-card p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Aspect Presets</div>
                    <div className="space-y-2">{[['1:1', 'Square - Social posts, avatars'], ['16:9', 'Landscape - Video thumbnails, headers'], ['9:16', 'Portrait - Stories, vertical video'], ['4:3', 'Standard - Presentations, photos'], ['Original', 'Keep source aspect ratio']].map(([r, d]) => <div key={r} className="flex justify-between text-sm py-2 border-b border-surface last:border-0"><span className="font-medium text-main">{r}</span><span className="text-muted">{d}</span></div>)}</div>
                </div>
            </div>
        </section>

        <section data-section-id="stock-search" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Stock</div><h3 className="text-xl font-bold text-main mt-2">Stock Photo Search</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-surface bg-surface p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Search Tips</div>
                    <div className="space-y-3 text-sm text-muted">
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-primary">check</span>Use descriptive keywords: "team meeting office modern"</div>
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-primary">check</span>Add mood or style: "bright", "minimal", "professional"</div>
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-primary">check</span>Specify color when needed: "blue background"</div>
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-primary">check</span>Use filters to narrow by orientation</div>
                    </div>
                </div>
                <div className="rounded-2xl border border-surface bg-surface p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">License Info</div>
                    <div className="space-y-3 text-sm text-muted">
                        <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-emerald-500">verified</span>All stock photos are royalty-free</div>
                        <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-emerald-500">verified</span>Commercial use permitted</div>
                        <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-emerald-500">verified</span>No attribution required</div>
                        <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-amber-500">info</span>Check model release for recognizable faces</div>
                    </div>
                </div>
            </div>
        </section>

        <section data-section-id="ai-generation" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Create</div><h3 className="text-xl font-bold text-main mt-2">CORA Image Generation</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-surface bg-card p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Prompt Structure</div>
                    <div className="space-y-2 text-sm text-muted">
                        <div><span className="font-semibold text-main">Subject:</span> What to generate</div>
                        <div><span className="font-semibold text-main">Style:</span> Photo, illustration, 3D, etc.</div>
                        <div><span className="font-semibold text-main">Mood:</span> Bright, moody, professional</div>
                        <div><span className="font-semibold text-main">Details:</span> Lighting, colors, composition</div>
                    </div>
                </div>
                <div className="rounded-2xl border border-surface bg-card p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Example Prompt</div>
                    <div className="rounded-xl bg-surface p-3 text-sm text-main italic border border-surface">"Professional photo of a diverse team collaborating around a modern conference table, bright natural lighting, glass office building, shallow depth of field, 16:9 aspect ratio"</div>
                </div>
            </div>
            <Callout type="tip">Start simple and add details. It's easier to refine a working prompt than to debug a complex one.</Callout>
        </section>

        <section data-section-id="organization" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">Manage</div><h3 className="text-xl font-bold text-main mt-2">Organization Best Practices</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-surface bg-surface p-5">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center mb-3"><span className="material-symbols-outlined text-[20px] text-sky-500">drive_file_rename_outline</span></div>
                    <div className="text-sm font-bold text-main">Naming</div>
                    <p className="text-xs text-muted mt-2">Use descriptive names: project-hero-image.jpg beats IMG_4521.jpg</p>
                </div>
                <div className="rounded-2xl border border-surface bg-surface p-5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3"><span className="material-symbols-outlined text-[20px] text-amber-500">label</span></div>
                    <div className="text-sm font-bold text-main">Tagging</div>
                    <p className="text-xs text-muted mt-2">Add tags for quick filtering: campaign, product, team, event</p>
                </div>
                <div className="rounded-2xl border border-surface bg-surface p-5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3"><span className="material-symbols-outlined text-[20px] text-emerald-500">delete_sweep</span></div>
                    <div className="text-sm font-bold text-main">Cleanup</div>
                    <p className="text-xs text-muted mt-2">Regularly archive unused assets to keep library browsable</p>
                </div>
            </div>
        </section>
    </div>
);
