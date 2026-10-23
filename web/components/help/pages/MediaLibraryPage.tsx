import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import type { HelpCenterPageProps, HelpCenterSectionsBuilder } from '../helpCenterTypes';
import { splitHelpKeywords } from '../helpCenterContent';

const SECTION_IDS = ['file-types', 'upload-methods', 'image-editor', 'stock-search', 'ai-generation', 'organization'] as const;

export const getMediaLibrarySections: HelpCenterSectionsBuilder = t =>
    SECTION_IDS.map(id => ({
        id,
        title: t(`help.mediaLibrary.sections.${id}.title`),
        summary: t(`help.mediaLibrary.sections.${id}.summary`),
        content: t(`help.mediaLibrary.sections.${id}.content`),
        keywords: splitHelpKeywords(t(`help.mediaLibrary.sections.${id}.keywords`))
    }));

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
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mx-auto`}><span className="material-symbols-outlined text-[24px] text-on-primary">{icon}</span></div>
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
    const styles = {
        tip: 'border-[rgba(var(--brand-amber-rgb),0.3)] bg-[rgba(var(--brand-amber-rgb),0.1)] text-[var(--brand-amber-text)]',
        warning: 'border-[rgba(var(--status-blocked-rgb),0.3)] bg-[rgba(var(--status-blocked-rgb),0.1)] text-[var(--color-status-blocked-text)]',
        info: 'border-[rgba(var(--brand-blue-rgb),0.3)] bg-[rgba(var(--brand-blue-rgb),0.1)] text-[var(--brand-blue-text)]'
    };
    const icons = { tip: 'lightbulb', warning: 'warning', info: 'info' };
    return <div className={`rounded-2xl border p-4 text-[13px] ${styles[type]}`}><div className="flex items-start gap-2"><span className="material-symbols-outlined text-[18px]">{icons[type]}</span><div>{children}</div></div></div>;
};

const HERO_TAGS = ['images', 'videos', 'documents', 'stock', 'cora'];
const FILE_TYPES = [
    { id: 'jpg', ext: 'JPG / JPEG', icon: 'image', limit: 25 },
    { id: 'png', ext: 'PNG', icon: 'image', limit: 25 },
    { id: 'webp', ext: 'WEBP', icon: 'image', limit: 25 },
    { id: 'gif', ext: 'GIF', icon: 'gif_box', limit: 10 },
    { id: 'svg', ext: 'SVG', icon: 'shapes', limit: 5 },
    { id: 'mp4', ext: 'MP4', icon: 'movie', limit: 100 },
    { id: 'pdf', ext: 'PDF', icon: 'description', limit: 50 },
    { id: 'heic', ext: 'HEIC', icon: 'image', limit: 25 }
];
const UPLOADS = [
    { id: 'dragDrop', icon: 'upload_file', color: 'bg-[var(--brand-blue)]' },
    { id: 'picker', icon: 'folder_open', color: 'bg-[var(--brand-green)]' },
    { id: 'stock', icon: 'image_search', color: 'bg-[var(--brand-amber)]' },
    { id: 'cora', icon: 'auto_awesome', color: 'bg-[var(--brand-violet)]' }
];
const TOOLS = [
    { id: 'crop', icon: 'crop' },
    { id: 'resize', icon: 'aspect_ratio' },
    { id: 'rotate', icon: 'rotate_right' },
    { id: 'adjust', icon: 'tune' }
];
const PRESETS = ['square', 'landscape', 'portrait', 'standard', 'original'];
const SEARCH_TIPS = ['keywords', 'mood', 'color', 'filters'];
const LICENSES = [
    { id: 'royaltyFree', icon: 'verified', tone: 'text-[var(--brand-green-text)]' },
    { id: 'commercial', icon: 'verified', tone: 'text-[var(--brand-green-text)]' },
    { id: 'attribution', icon: 'verified', tone: 'text-[var(--brand-green-text)]' },
    { id: 'modelRelease', icon: 'info', tone: 'text-[var(--brand-amber-text)]' }
];
const PROMPT_PARTS = ['subject', 'style', 'mood', 'details'];
const ORGANIZE = [
    { id: 'naming', icon: 'drive_file_rename_outline', box: 'bg-[rgba(var(--brand-blue-rgb),0.1)]', tone: 'text-[var(--brand-blue-text)]' },
    { id: 'tagging', icon: 'label', box: 'bg-[rgba(var(--brand-amber-rgb),0.1)]', tone: 'text-[var(--brand-amber-text)]' },
    { id: 'cleanup', icon: 'delete_sweep', box: 'bg-[rgba(var(--brand-green-rgb),0.1)]', tone: 'text-[var(--brand-green-text)]' }
];

export const MediaLibraryPage = (_props: HelpCenterPageProps) => {
    const { t } = useLanguage();
    const p = 'help.mediaLibrary.';
    return (
        <div className="px-6 py-6 space-y-10">
            <div className="rounded-[28px] border border-surface bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}hero.eyebrow`)}</div>
                <h2 className="text-3xl font-bold text-main mt-3">{t(`${p}hero.title`)}</h2>
                <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">{t(`${p}hero.description`)}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                    {HERO_TAGS.map(tag => <span key={tag} className="px-3 py-1 rounded-full text-[10px] font-semibold bg-surface-hover text-muted">{t(`${p}hero.tags.${tag}`)}</span>)}
                </div>
            </div>

            <section data-section-id="file-types" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}fileTypes.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}fileTypes.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {FILE_TYPES.map(f => (
                        <FileTypeCard key={f.id} ext={f.ext} icon={f.icon} limit={t(`${p}fileTypes.maxSize`).replace('{size}', String(f.limit))} description={t(`${p}fileTypes.${f.id}`)} />
                    ))}
                </div>
            </section>

            <section data-section-id="upload-methods" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}upload.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}upload.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {UPLOADS.map(u => (
                        <UploadCard key={u.id} icon={u.icon} method={t(`${p}upload.${u.id}.name`)} description={t(`${p}upload.${u.id}.description`)} color={u.color} />
                    ))}
                </div>
            </section>

            <section data-section-id="image-editor" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}editor.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}editor.title`)}</h3><p className="text-sm text-muted mt-2 max-w-xl">{t(`${p}editor.description`)}</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}editor.toolsTitle`)}</div>
                        {TOOLS.map(tool => <EditorTool key={tool.id} icon={tool.icon} name={t(`${p}editor.tools.${tool.id}.name`)} description={t(`${p}editor.tools.${tool.id}.description`)} />)}
                    </div>
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}editor.presetsTitle`)}</div>
                        <div className="space-y-2">{PRESETS.map(r => <div key={r} className="flex justify-between text-sm py-2 border-b border-surface last:border-0"><span className="font-medium text-main">{t(`${p}editor.presets.${r}.ratio`)}</span><span className="text-muted">{t(`${p}editor.presets.${r}.description`)}</span></div>)}</div>
                    </div>
                </div>
            </section>

            <section data-section-id="stock-search" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}stock.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}stock.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-surface bg-surface p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}stock.tipsTitle`)}</div>
                        <div className="space-y-3 text-sm text-muted">
                            {SEARCH_TIPS.map(tip => <div key={tip} className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-primary">check</span>{t(`${p}stock.tips.${tip}`)}</div>)}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-surface bg-surface p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}stock.licenseTitle`)}</div>
                        <div className="space-y-3 text-sm text-muted">
                            {LICENSES.map(l => <div key={l.id} className="flex items-center gap-2"><span className={`material-symbols-outlined text-[16px] ${l.tone}`}>{l.icon}</span>{t(`${p}stock.license.${l.id}`)}</div>)}
                        </div>
                    </div>
                </div>
            </section>

            <section data-section-id="ai-generation" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}generation.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}generation.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}generation.structureTitle`)}</div>
                        <div className="space-y-2 text-sm text-muted">
                            {PROMPT_PARTS.map(part => <div key={part}><span className="font-semibold text-main">{t(`${p}generation.structure.${part}.label`)}</span> {t(`${p}generation.structure.${part}.description`)}</div>)}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}generation.exampleTitle`)}</div>
                        <div className="rounded-xl bg-surface p-3 text-sm text-main italic border border-surface">{t(`${p}generation.example`)}</div>
                    </div>
                </div>
                <Callout type="tip">{t(`${p}generation.tip`)}</Callout>
            </section>

            <section data-section-id="organization" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}organization.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}organization.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {ORGANIZE.map(o => (
                        <div key={o.id} className="rounded-2xl border border-surface bg-surface p-5">
                            <div className={`w-10 h-10 rounded-xl ${o.box} flex items-center justify-center mb-3`}><span className={`material-symbols-outlined text-[20px] ${o.tone}`}>{o.icon}</span></div>
                            <div className="text-sm font-bold text-main">{t(`${p}organization.${o.id}.title`)}</div>
                            <p className="text-xs text-muted mt-2">{t(`${p}organization.${o.id}.description`)}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
