import React, { useState, useId } from 'react';
import { EmailBlock, TemplateVariable } from '../../../types';
import { RichTextEditor } from './RichTextEditor';
import { RichTextModal } from './RichTextModal';
import { VariablePicker } from './VariablePicker';
import { MediaLibrary } from '../../../../components/MediaLibrary/MediaLibraryModal';
import { ImageEditor } from '../../../../components/MediaLibrary/ImageEditor';
import {
    SettingsGroup,
    ControlRow,
    ScrubbableInput,
    SegmentedControl,
    ColorPicker,
    SpacingControl,
    TypographyControl,
    SizeControl,
    BorderControl,
    BackgroundControl,
    LayoutControl,
    ShadowControl,
} from './StyleControls';

// --- Compact Pro Settings Input ---
const SettingsInput = ({ label, value, onChange, placeholder = '', type = 'text', variables, icon }: any) => {
    const [pickerOpen, setPickerOpen] = useState(false);
    const inputId = useId();
    return (
        <div className="flex flex-col gap-1 group/input">
            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-1.5">
                    {icon && <span className="material-symbols-outlined text-[12px] opacity-40">{icon}</span>}
                    <label htmlFor={inputId} className="text-[9px] font-black text-muted uppercase tracking-widest group-focus-within/input:text-primary transition-colors">
                        {label}
                    </label>
                </div>
                {variables && variables.length > 0 && type === 'text' && (
                    <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="text-[8px] font-black text-primary opacity-0 group-hover/input:opacity-100 focus:opacity-100 transition-opacity uppercase tracking-widest px-1.5 py-0.5 rounded hover:bg-primary/10"
                    >
                        {'{ }'}
                    </button>
                )}
            </div>
            <div className="relative flex items-center bg-surface-sunken rounded border border-surface group-hover/input:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary/50 transition-all shadow-sm">
                <input
                    id={inputId}
                    type={type}
                    value={value ?? ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-2 py-1.5 text-[10px] font-mono bg-transparent border-none outline-none appearance-none text-main placeholder:opacity-30"
                />
            </div>
            {pickerOpen && variables && (
                <VariablePicker
                    variables={variables}
                    isOpen={true}
                    onClose={() => setPickerOpen(false)}
                    onSelect={(v) => onChange((value || '') + `{{${v.name}}}`)}
                />
            )}
        </div>
    );
};

export const PropertiesPanel = ({ block, parentType, columnCount, onChange, onSaveAsComponent, projectId, tenantId, variables }: { block: EmailBlock, parentType?: string, columnCount?: number, onChange: (updates: Partial<EmailBlock>) => void, onSaveAsComponent: (name: string) => void, projectId: string, tenantId?: string, variables?: TemplateVariable[] }) => {

    const updateContent = (k: string, v: any) => onChange({ content: { ...block.content, [k]: v } });
    const updateStyle = (k: string, v: any) => onChange({ styles: { ...block.styles, [k]: v } });
    const updateStyles = (updates: Record<string, any>) => onChange({ styles: { ...block.styles, ...updates } });


    const [isSaving, setIsSaving] = useState(false);
    const [compName, setCompName] = useState("");
    const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
    const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
    const [isRichTextModalOpen, setIsRichTextModalOpen] = useState(false);

    // Block type to icon map
    const typeIcons: Record<string, string> = {
        text: 'notes', richtext: 'article', header: 'title', button: 'smart_button', image: 'image',
        spacer: 'keyboard_double_arrow_down', divider: 'horizontal_rule', video: 'movie',
        columns: 'view_column', flex: 'view_agenda', social: 'share', menu: 'menu',
        quote: 'format_quote', solid: 'square', div: 'crop_square', html: 'code',
    };

    return (
        <div className="flex flex-col h-full bg-surface-paper font-sans border-l border-surface shadow-2xl w-[320px]">

            {/* Header / Dynamic Identity */}
            <header className="shrink-0 sticky top-0 z-20 px-4 py-5 border-b border-surface bg-surface-paper/80 backdrop-blur-md">
                <div className="flex items-center gap-3.5">
                    <div className="relative shrink-0">
                        <div className="size-10 rounded-xl bg-surface-sunken border border-surface flex items-center justify-center shadow-inner group-hover:shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] transition-all overflow-hidden">
                            <span className="material-symbols-outlined text-primary text-xl animate-in fade-in zoom-in duration-300">{typeIcons[block.type] || 'widgets'}</span>
                        </div>
                        <div className="absolute -bottom-1 -right-1 size-4 rounded-full bg-primary text-on-primary flex items-center justify-center border-2 border-[var(--color-surface-paper)] shadow-sm">
                            <span className="material-symbols-outlined text-[10px] font-black">bolt</span>
                        </div>
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-[12px] font-black text-main uppercase tracking-[0.1em] truncate drop-shadow-sm">{block.name || block.type}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest">{block.type}</span>
                            <span className="text-[8px] text-muted font-bold uppercase tracking-widest">Modified recently</span>
                        </div>
                    </div>
                </div>
            </header>


            {/* Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar" role="tabpanel">
                <div className="space-y-0 pb-32">
                    <SettingsGroup title="General" defaultOpen={true}>
                        <SettingsInput
                            label="Element ID"
                            icon="fingerprint"
                            value={block.name || ''}
                            onChange={(v: string) => onChange({ name: v })}
                            placeholder={block.type}
                        />
                    </SettingsGroup>

                    {/* Simple Text */}
                    {block.type === 'text' && (
                        <SettingsGroup title="Content" defaultOpen={true}>
                            <div className="space-y-3">
                                <textarea
                                    value={block.content.text || ''}
                                    onChange={(e) => updateContent('text', e.target.value)}
                                    placeholder="Enter your text here..."
                                    className="w-full min-h-[100px] px-3 py-2 text-sm rounded-lg bg-surface-sunken border border-surface focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-y transition-all"
                                />
                                <div className="flex gap-2">
                                    <SegmentedControl
                                        label="Align"
                                        value={block.styles.textAlign || 'left'}
                                        onChange={(v) => updateStyle('textAlign', v)}
                                        options={[
                                            { value: 'left', icon: 'format_align_left', ariaLabel: 'Left' },
                                            { value: 'center', icon: 'format_align_center', ariaLabel: 'Center' },
                                            { value: 'right', icon: 'format_align_right', ariaLabel: 'Right' },
                                        ]}
                                    />
                                    <div className="flex flex-col gap-1.5 w-full">
                                        <div className="text-[11px] text-muted font-medium">Style</div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => updateStyle('fontWeight', block.styles.fontWeight === 'bold' ? 'normal' : 'bold')}
                                                title="Bold"
                                                className={`flex-1 flex items-center justify-center py-1.5 rounded border text-[10px] font-black transition-all ${block.styles.fontWeight === 'bold' ? 'bg-primary/10 border-primary text-primary' : 'border-surface text-muted hover:border-primary/30'}`}
                                            >
                                                <span className="material-symbols-outlined text-[16px]">format_bold</span>
                                            </button>
                                            <button
                                                onClick={() => updateStyle('fontStyle', block.styles.fontStyle === 'italic' ? 'normal' : 'italic')}
                                                title="Italic"
                                                className={`flex-1 flex items-center justify-center py-1.5 rounded border text-[10px] font-black transition-all ${block.styles.fontStyle === 'italic' ? 'bg-primary/10 border-primary text-primary' : 'border-surface text-muted hover:border-primary/30'}`}
                                            >
                                                <span className="material-symbols-outlined text-[16px]">format_italic</span>
                                            </button>
                                            <button
                                                onClick={() => updateStyle('textDecoration', block.styles.textDecoration === 'underline' ? 'none' : 'underline')}
                                                title="Underline"
                                                className={`flex-1 flex items-center justify-center py-1.5 rounded border text-[10px] font-black transition-all ${block.styles.textDecoration === 'underline' ? 'bg-primary/10 border-primary text-primary' : 'border-surface text-muted hover:border-primary/30'}`}
                                            >
                                                <span className="material-symbols-outlined text-[16px]">format_underlined</span>
                                            </button>
                                            <button
                                                onClick={() => updateStyle('textTransform', block.styles.textTransform === 'uppercase' ? 'none' : 'uppercase')}
                                                title="Uppercase"
                                                className={`flex-1 flex items-center justify-center py-1.5 rounded border text-[10px] font-black transition-all ${block.styles.textTransform === 'uppercase' ? 'bg-primary/10 border-primary text-primary' : 'border-surface text-muted hover:border-primary/30'}`}
                                            >
                                                <span className="material-symbols-outlined text-[16px]">abc</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </SettingsGroup>
                    )}

                    {/* Rich Text */}
                    {block.type === 'richtext' && (
                        <SettingsGroup title="Content" defaultOpen={true}>
                            <div className="space-y-3">
                                <div className="p-3 bg-surface-sunken rounded-lg border border-surface">
                                    <div
                                        className="prose prose-sm max-w-none text-sm line-clamp-3 opacity-70"
                                        dangerouslySetInnerHTML={{ __html: block.content.text || '<p>No content yet...</p>' }}
                                    />
                                </div>
                                <button
                                    onClick={() => setIsRichTextModalOpen(true)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-on-primary font-bold text-sm rounded-lg hover:opacity-90 transition-all shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-lg">edit_note</span>
                                    Open Rich Text Editor
                                </button>
                            </div>
                        </SettingsGroup>
                    )}

                    {/* Header */}
                    {block.type === 'header' && (
                        <SettingsGroup title="Header" defaultOpen={true}>
                            <div className="space-y-4">
                                <SettingsInput label="Heading" icon="title" value={block.content.text} onChange={(v: string) => updateContent('text', v)} placeholder="headline..." variables={variables} />
                                <SegmentedControl
                                    label="Level"
                                    value={block.styles.fontSize}
                                    onChange={(v) => updateStyle('fontSize', v)}
                                    options={[
                                        { value: 48, text: 'H1', ariaLabel: 'H1' },
                                        { value: 36, text: 'H2', ariaLabel: 'H2' },
                                        { value: 24, text: 'H3', ariaLabel: 'H3' },
                                        { value: 18, text: 'H4', ariaLabel: 'H4' },
                                    ]}
                                />
                            </div>
                        </SettingsGroup>
                    )}

                    {/* Button */}
                    {block.type === 'button' && (
                        <SettingsGroup title="Label & Link" defaultOpen={true}>
                            <div className="space-y-4">
                                <SettingsInput label="Label" icon="smart_button" value={block.content.text} onChange={(v: string) => updateContent('text', v)} placeholder="Call to Action" variables={variables} />
                                <SettingsInput label="Link" icon="link" value={block.content.url} onChange={(v: string) => updateContent('url', v)} placeholder="https://..." variables={variables} />
                            </div>
                        </SettingsGroup>
                    )}

                    {/* Image */}
                    {block.type === 'image' && (
                        <SettingsGroup title="Image Asset" defaultOpen={true}>
                            <div className="space-y-4">
                                {block.content.src ? (
                                    <div className="p-1 bg-surface-sunken rounded-lg border border-surface">
                                        <div className="relative group rounded border border-surface bg-black/5 overflow-hidden">
                                            <img src={block.content.src} alt={block.content.alt || 'Preview'} className="w-full h-32 object-contain" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 backdrop-blur-[2px]">
                                                <button onClick={() => setIsImageEditorOpen(true)} className="size-8 bg-white text-black rounded-full hover:scale-110 transition-transform flex items-center justify-center shadow-lg"><span className="material-symbols-outlined text-sm">edit</span></button>
                                                <button onClick={() => setIsMediaLibraryOpen(true)} className="size-8 bg-white text-black rounded-full hover:scale-110 transition-transform flex items-center justify-center shadow-lg"><span className="material-symbols-outlined text-sm">sync_alt</span></button>
                                                <button onClick={() => updateContent('src', '')} className="size-8 bg-red-500 text-white rounded-full hover:scale-110 transition-transform flex items-center justify-center shadow-lg"><span className="material-symbols-outlined text-sm">delete</span></button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => setIsMediaLibraryOpen(true)} className="w-full py-6 border-2 border-dashed border-surface rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-1.5 group">
                                        <span className="material-symbols-outlined text-2xl text-muted group-hover:text-primary transition-colors">add_photo_alternate</span>
                                        <span className="text-[9px] text-muted font-bold uppercase tracking-widest">Open Assets</span>
                                    </button>
                                )}
                                <SettingsInput label="Source" icon="image" value={block.content.src} onChange={(v: string) => updateContent('src', v)} placeholder="https://..." variables={variables} />
                                <SettingsInput label="Description" icon="info" value={block.content.alt} onChange={(v: string) => updateContent('alt', v)} placeholder="Alt text" />
                            </div>
                        </SettingsGroup>
                    )}

                    {/* Columns / Grid */}
                    {block.type === 'columns' && (
                        <SettingsGroup title="Grid Layout" defaultOpen={true}>
                            <div className="space-y-4">
                                <SegmentedControl
                                    label="Columns"
                                    value={block.content.columns?.length || 2}
                                    onChange={(n) => {
                                        const current = block.content.columns || [[], []];
                                        let next = [...current];
                                        while (next.length < n) next.push([]);
                                        updateContent('columns', next.slice(0, n));
                                    }}
                                    options={[1, 2, 3, 4].map(n => ({ value: n, text: `${n} COL`, ariaLabel: `${n} col` }))}
                                />
                                <ScrubbableInput
                                    label="Gutter"
                                    icon="grid_4x4"
                                    value={block.styles.gap ?? 16}
                                    onChange={(v) => updateStyle('gap', v)}
                                    max={100}
                                    unit="px"
                                />
                            </div>
                        </SettingsGroup>
                    )}

                    {/* Social Links */}
                    {block.type === 'social' && (
                        <SettingsGroup title="Social Networks" defaultOpen={true}>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[9px] font-black text-muted uppercase tracking-widest">Networks</label>
                                    <button onClick={() => updateContent('socialLinks', [...(block.content.socialLinks || []), { platform: 'twitter', url: '' }])} className="text-[9px] font-black text-primary hover:underline uppercase tracking-widest">+ Add</button>
                                </div>
                                <div className="space-y-2">
                                    {(block.content.socialLinks || []).map((link: any, idx: number) => (
                                        <div key={idx} className="flex gap-1.5 items-center px-2 py-1.5 bg-surface-sunken rounded border border-surface group">
                                            <select value={link.platform} onChange={e => { const n = [...(block.content.socialLinks || [])]; n[idx] = { ...n[idx], platform: e.target.value }; updateContent('socialLinks', n); }} className="w-12 text-[10px] font-bold bg-transparent outline-none appearance-none cursor-pointer uppercase">
                                                <option value="twitter">X</option><option value="facebook">FB</option><option value="linkedin">IN</option><option value="instagram">IG</option>
                                            </select>
                                            <input value={link.url} onChange={e => { const n = [...(block.content.socialLinks || [])]; n[idx] = { ...n[idx], url: e.target.value }; updateContent('socialLinks', n); }} className="flex-1 text-[10px] bg-transparent outline-none truncate" placeholder="Profile URL" />
                                            <button onClick={() => updateContent('socialLinks', (block.content.socialLinks || []).filter((_: any, i: number) => i !== idx))} className="size-5 flex items-center justify-center text-muted hover:text-red-500"><span className="material-symbols-outlined text-sm">close</span></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </SettingsGroup>
                    )}

                    {/* Menu Links */}
                    {block.type === 'menu' && (
                        <SettingsGroup title="Navigation Menu" defaultOpen={true}>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[9px] font-black text-muted uppercase tracking-widest">Navigation</label>
                                    <button onClick={() => updateContent('menuLinks', [...(block.content.menuLinks || []), { label: 'Item', url: '#' }])} className="text-[9px] font-black text-primary hover:underline uppercase tracking-widest">+ Add</button>
                                </div>
                                <div className="space-y-2">
                                    {(block.content.menuLinks || []).map((link: any, idx: number) => (
                                        <div key={idx} className="space-y-1 p-2 bg-surface-sunken rounded border border-surface">
                                            <div className="flex items-center justify-between gap-2">
                                                <input value={link.label} onChange={e => { const n = [...(block.content.menuLinks || [])]; n[idx] = { ...n[idx], label: e.target.value }; updateContent('menuLinks', n); }} className="flex-1 font-bold text-[10px] bg-transparent outline-none uppercase" placeholder="LABEL" />
                                                <button onClick={() => updateContent('menuLinks', (block.content.menuLinks || []).filter((_: any, i: number) => i !== idx))} className="size-4 flex items-center justify-center text-muted hover:text-red-500"><span className="material-symbols-outlined text-[14px]">delete</span></button>
                                            </div>
                                            <input value={link.url} onChange={e => { const n = [...(block.content.menuLinks || [])]; n[idx] = { ...n[idx], url: e.target.value }; updateContent('menuLinks', n); }} className="w-full text-[9px] text-muted bg-transparent outline-none" placeholder="Target URL" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </SettingsGroup>
                    )}

                    {/* Divider */}
                    {block.type === 'divider' && (
                        <SettingsGroup title="Divider Style" defaultOpen={true}>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <ScrubbableInput label="Height" icon="line_weight" value={block.styles.borderWidth ?? 1} onChange={(v) => updateStyle('borderWidth', v)} min={1} max={20} />
                                    <ScrubbableInput label="Width" icon="straighten" value={block.styles.width ?? '100%'} onChange={(v) => updateStyle('width', v)} unit="%" />
                                </div>
                                <ColorPicker label="Line Color" value={block.styles.borderColor || '#e5e5e5'} onChange={(v) => updateStyle('borderColor', v)} />
                            </div>
                        </SettingsGroup>
                    )}

                    {/* Quote */}
                    {block.type === 'quote' && (
                        <SettingsGroup title="Quote Content" defaultOpen={true}>
                            <div className="space-y-2">
                                <label className="px-1 text-[9px] font-black text-muted uppercase tracking-widest">Quote Text</label>
                                <textarea className="w-full px-3 py-2 rounded bg-surface-sunken border border-surface text-[11px] resize-none focus:outline-none focus:border-primary/50 transition-all font-medium leading-relaxed" rows={4} placeholder="Enter your quote..." value={block.content.text || ''} onChange={e => updateContent('text', e.target.value)} />
                            </div>
                        </SettingsGroup>
                    )}

                    {/* Video */}
                    {block.type === 'video' && (
                        <SettingsGroup title="Video Embed" defaultOpen={true}>
                            <div className="space-y-4">
                                <SettingsInput label="Video URL" icon="movie" value={block.content.videoUrl} onChange={(v: string) => updateContent('videoUrl', v)} placeholder="YouTube/Vimeo URL" />
                                <SettingsInput label="Cover Image" icon="image" value={block.content.src} onChange={(v: string) => updateContent('src', v)} placeholder="Thumbnail URL" />
                            </div>
                        </SettingsGroup>
                    )}

                    {/* Spacer */}
                    {block.type === 'spacer' && (
                        <SettingsGroup title="Spacer Height" defaultOpen={true}>
                            <ScrubbableInput label="Space" icon="height" value={block.styles.height ?? 40} onChange={(v) => updateStyle('height', v)} min={0} max={400} />
                        </SettingsGroup>
                    )}
                    <div className="h-px bg-surface-border my-4" />
                    {/* Define Visibility Map */}
                    {(() => {
                        const visibility: Record<string, string[]> = {
                            text: ['typography', 'spacing', 'size', 'background', 'border'],
                            richtext: ['typography', 'spacing', 'size', 'background', 'border'],
                            header: ['typography', 'spacing', 'size', 'background', 'border'],
                            list: ['typography', 'spacing', 'size', 'background', 'border'],
                            button: ['typography', 'spacing', 'size', 'background', 'border', 'effects'],
                            image: ['size', 'spacing', 'border', 'effects'],
                            video: ['size', 'spacing', 'border', 'effects'],
                            quote: ['typography', 'spacing', 'size', 'background', 'border'],
                            menu: ['typography', 'spacing', 'background'],
                            social: ['typography', 'spacing', 'background'],
                            divider: ['spacing', 'background'], // Size/Border handled in Content tab
                            spacer: ['background'], // Size handled in Content tab
                            columns: ['layout', 'spacing', 'background', 'border', 'effects'],
                            flex: ['layout', 'spacing', 'size', 'background', 'border', 'effects'],
                            div: ['layout', 'spacing', 'size', 'background', 'border', 'effects'],
                            solid: ['size', 'spacing', 'background', 'border', 'effects'],
                            html: ['size', 'spacing', 'background', 'border'],
                        };

                        const visibleSections = visibility[block.type] || ['spacing', 'background', 'border'];
                        const show = (section: string) => visibleSections.includes(section);

                        return (
                            <>
                                {show('layout') && (
                                    <SettingsGroup title="Layout" defaultOpen={true}>
                                        <LayoutControl styles={block.styles} onChange={updateStyle} />
                                    </SettingsGroup>
                                )}

                                {show('spacing') && (
                                    <SettingsGroup title="Spacing" defaultOpen={true}>
                                        <SpacingControl styles={block.styles} onChange={updateStyle} onBulkChange={updateStyles} />
                                    </SettingsGroup>
                                )}

                                {show('size') && (
                                    <SettingsGroup title="Size" defaultOpen={true}>
                                        <SizeControl styles={block.styles} onChange={updateStyle} />
                                        {parentType === 'columns' && (
                                            <div className="mt-4 pt-4 border-t border-surface">
                                                <ScrubbableInput
                                                    label="Grid Span"
                                                    icon="grid_view"
                                                    value={block.styles.gridSpan ?? (columnCount ? Math.floor(12 / columnCount) : 1)}
                                                    onChange={(v) => updateStyle('gridSpan', v)}
                                                    min={1}
                                                    max={12}
                                                    unit="col"
                                                />
                                                <p className="mt-1.5 px-1 text-[8px] text-muted font-medium leading-tight italic">
                                                    Occupies {block.styles.gridSpan ?? (columnCount ? Math.floor(12 / columnCount) : 1)}/12 of the row width.
                                                    {columnCount && ` (Default is ${Math.floor(12 / columnCount)})`}
                                                </p>
                                            </div>
                                        )}
                                    </SettingsGroup>
                                )}

                                {show('typography') && (
                                    <SettingsGroup title="Typography" defaultOpen={['text', 'header', 'list', 'button', 'menu', 'quote', 'social'].includes(block.type)}>
                                        <TypographyControl styles={block.styles} onChange={updateStyle} />
                                    </SettingsGroup>
                                )}

                                {show('background') && (
                                    <SettingsGroup title="Backgrounds" defaultOpen={false}>
                                        <BackgroundControl styles={block.styles} onChange={updateStyle} />
                                    </SettingsGroup>
                                )}

                                {show('border') && (
                                    <SettingsGroup title="Borders" defaultOpen={false}>
                                        <BorderControl styles={block.styles} onChange={updateStyle} />
                                    </SettingsGroup>
                                )}

                                {show('effects') && (
                                    <SettingsGroup title="Effects & Shadows" defaultOpen={false}>
                                        <ShadowControl styles={block.styles} onChange={updateStyle} />
                                    </SettingsGroup>
                                )}
                            </>
                        );
                    })()}
                    {/* End Style */}
                </div>
            </main>

            {/* Footer */}
            <footer className="shrink-0 p-4 border-t border-surface bg-surface-sunken/50">
                {!isSaving ? (
                    <button onClick={() => setIsSaving(true)} className="w-full flex items-center justify-center gap-2 py-2 rounded border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-all shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">bookmark</span>
                        Save Component
                    </button>
                ) : (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2 duration-300">
                        <input autoFocus value={compName} onChange={e => setCompName(e.target.value)} placeholder="Unique Name..." className="w-full px-3 py-1.5 text-[10px] font-bold rounded bg-white dark:bg-zinc-800 border border-surface outline-none focus:border-primary uppercase" />
                        <div className="flex gap-2">
                            <button onClick={() => setIsSaving(false)} className="flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest text-muted hover:bg-black/5 dark:hover:bg-white/5 rounded transition">Cancel</button>
                            <button onClick={() => { if (compName) { onSaveAsComponent(compName); setIsSaving(false); setCompName(''); } }} disabled={!compName} className="flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest bg-primary text-on-primary rounded shadow-lg shadow-[var(--color-primary)]/20 disabled:opacity-30">Confirm</button>
                        </div>
                    </div>
                )}
            </footer>

            {/* Modals */}
            <MediaLibrary isOpen={isMediaLibraryOpen} onClose={() => setIsMediaLibraryOpen(false)} onSelect={(asset) => { updateContent('src', asset.url); if (!block.content.alt) updateContent('alt', asset.name); }} projectId={projectId} tenantId={tenantId} />
            {isImageEditorOpen && block.content.src && (
                <ImageEditor src={block.content.src} onCancel={() => setIsImageEditorOpen(false)} onSave={(newSrc) => { updateContent('src', newSrc); setIsImageEditorOpen(false); }} />
            )}
            {block.type === 'richtext' && (
                <RichTextModal
                    isOpen={isRichTextModalOpen}
                    initialContent={block.content.text || ''}
                    onSave={(content) => updateContent('text', content)}
                    onClose={() => setIsRichTextModalOpen(false)}
                    variables={variables}
                />
            )}
        </div>
    );
};
