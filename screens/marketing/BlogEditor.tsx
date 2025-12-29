import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Typography from '@tiptap/extension-typography';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { useNavigate, useParams } from 'react-router-dom';
import { MediaLibrary } from '../../components/MediaLibrary/MediaLibraryModal';
import { publishBlogPost } from '../../services/blogService';
import { useUI } from '../../context/UIContext';
import './editorStyles.css';

const MenuBar = ({ editor, onImageClick }: { editor: any, onImageClick: () => void }) => {
    if (!editor) return null;

    const buttons = [
        { icon: 'format_bold', action: () => editor.chain().focus().toggleBold().run(), isActive: editor.isActive('bold'), label: 'Bold' },
        { icon: 'format_italic', action: () => editor.chain().focus().toggleItalic().run(), isActive: editor.isActive('italic'), label: 'Italic' },
        { icon: 'format_underlined', action: () => editor.chain().focus().toggleUnderline().run(), isActive: editor.isActive('underline'), label: 'Underline' },
        { type: 'separator' },
        { icon: 'format_h1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: editor.isActive('heading', { level: 1 }), label: 'H1' },
        { icon: 'format_h2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: editor.isActive('heading', { level: 2 }), label: 'H2' },
        { icon: 'format_h3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: editor.isActive('heading', { level: 3 }), label: 'H3' },
        { type: 'separator' },
        { icon: 'format_list_bulleted', action: () => editor.chain().focus().toggleBulletList().run(), isActive: editor.isActive('bulletList'), label: 'Bullet List' },
        { icon: 'format_list_numbered', action: () => editor.chain().focus().toggleOrderedList().run(), isActive: editor.isActive('orderedList'), label: 'Ordered List' },
        { icon: 'format_quote', action: () => editor.chain().focus().toggleBlockquote().run(), isActive: editor.isActive('blockquote'), label: 'Blockquote' },
        { type: 'separator' },
        { icon: 'image', action: onImageClick, isActive: false, label: 'Insert Image' },
        { icon: 'table', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), isActive: false, label: 'Insert Table' },
        { type: 'separator' },
        { icon: 'format_align_left', action: () => editor.chain().focus().setTextAlign('left').run(), isActive: editor.isActive({ textAlign: 'left' }), label: 'Align Left' },
        { icon: 'format_align_center', action: () => editor.chain().focus().setTextAlign('center').run(), isActive: editor.isActive({ textAlign: 'center' }), label: 'Align Center' },
        { icon: 'format_align_right', action: () => editor.chain().focus().setTextAlign('right').run(), isActive: editor.isActive({ textAlign: 'right' }), label: 'Align Right' },
    ];

    return (
        <div className="flex items-center gap-1 p-2 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] overflow-x-auto no-scrollbar">
            {buttons.map((btn: any, index) => (
                btn.type === 'separator' ? (
                    <div key={index} className="w-px h-6 bg-[var(--color-surface-border)] mx-1 shrink-0" />
                ) : (
                    <button
                        key={index}
                        onClick={btn.action}
                        className={`p-1.5 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors flex items-center justify-center shrink-0 ${btn.isActive ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
                            }`}
                        title={btn.label}
                    >
                        <span className="material-symbols-outlined text-[20px]">{btn.icon}</span>
                    </button>
                )
            ))}
        </div>
    );
};

const BlogEditor = () => {
    const navigate = useNavigate();
    const { id: projectId } = useParams<{ id: string }>();
    const [title, setTitle] = useState('');
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
    const [mediaPickerMode, setMediaPickerMode] = useState<'cover' | 'content'>('cover');
    const [isPublishing, setIsPublishing] = useState(false);
    const { showSuccess, showError } = useUI();

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3, 4, 5, 6],
                },
            }),
            Placeholder.configure({
                placeholder: 'Write something amazing...',
            }),
            Underline,
            Image,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            Typography,
            Link.configure({
                openOnClick: false,
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[500px] p-4 max-w-none text-[var(--color-text-main)]',
            },
        },
    });

    const handleOpenMediaPicker = (mode: 'cover' | 'content') => {
        setMediaPickerMode(mode);
        setIsMediaPickerOpen(true);
    };

    const handleMediaSelect = (url: string) => {
        if (mediaPickerMode === 'cover') {
            setCoverImage(url);
        } else {
            editor?.chain().focus().setImage({ src: url }).run();
        }
        setIsMediaPickerOpen(false);
    };

    const handleSave = async () => {
        if (!projectId) return;

        setIsPublishing(true);
        try {
            const postData = {
                title,
                content: editor?.getHTML(),
                excerpt: editor?.getText().slice(0, 150) + '...',
                coverImage,
                status: 'published',
                publishedAt: new Date().toISOString()
            };

            await publishBlogPost(projectId, postData);
            showSuccess('Blog post published successfully!');
            navigate('../blog');
        } catch (error) {
            console.error('Failed to publish', error);
            showError('Failed to publish blog post. Check your settings and endpoint.');
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <>
            <div className="h-[calc(100vh-140px)] flex flex-col gap-4">

                {/* Top Bar Actions */}
                <div className="flex items-center justify-between shrink-0">
                    <button
                        onClick={() => navigate('../blog')}
                        className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span>Back to Blogs</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <button className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">
                            Save as Draft
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isPublishing}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isPublishing && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                            {isPublishing ? 'Publishing...' : 'Publish Post'}
                        </button>
                    </div>
                </div>

                {/* Main Split View Area */}
                <div className="flex-1 min-h-0 flex gap-6">

                    {/* LEFT: Editor Side */}
                    <div className="flex-1 flex flex-col bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl overflow-hidden shadow-sm">
                        {/* Meta Data Inputs */}
                        <div className="p-6 border-b border-[var(--color-surface-border)] space-y-4 bg-white/50 dark:bg-black/20">
                            <input
                                type="text"
                                placeholder="Post Title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-[var(--color-text-muted)]/50 text-[var(--color-text-main)]"
                            />
                            {/* Cover Image Selection */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleOpenMediaPicker('cover')}
                                    className="flex items-center gap-2 text-sm text-[var(--color-primary)] font-medium hover:underline"
                                >
                                    <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                                    {coverImage ? 'Change Cover Image' : 'Add Cover Image'}
                                </button>
                                {coverImage && (
                                    <button
                                        onClick={() => setCoverImage(null)}
                                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Toolbar */}
                        <MenuBar editor={editor} onImageClick={() => handleOpenMediaPicker('content')} />

                        {/* Editor Content Area */}
                        <div className="flex-1 overflow-y-auto bg-[var(--color-surface-card)] cursor-text" onClick={() => editor?.chain().focus().run()}>
                            <EditorContent editor={editor} className="h-full" />
                        </div>
                    </div>


                    {/* RIGHT: Preview Side */}
                    <div className="flex-1 flex flex-col bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl overflow-hidden shadow-sm relative">
                        <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full bg-black/5 text-xs font-semibold uppercase tracking-wider text-black/50 pointer-events-none dark:bg-white/10 dark:text-white/50">
                            Live Preview
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            {/* Preview Container - simulating final blog styles */}
                            <article className="max-w-2xl mx-auto prose prose-slate dark:prose-invert lg:prose-lg">

                                {coverImage && (
                                    <div className="rounded-xl overflow-hidden mb-8 aspect-video w-full bg-[var(--color-surface-hover)]">
                                        <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                                    </div>
                                )}

                                <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-text-main)] mb-4 leading-tight">
                                    {title || <span className="text-[var(--color-text-muted)]/30">Untitled Post</span>}
                                </h1>

                                {/* Render Editor HTML Content */}
                                <div
                                    className="ProseMirror"
                                    dangerouslySetInnerHTML={{ __html: editor?.getHTML() || '' }}
                                />
                            </article>
                        </div>
                    </div>

                </div>
            </div>

            <MediaLibrary
                isOpen={isMediaPickerOpen}
                onClose={() => setIsMediaPickerOpen(false)}
                onSelect={(asset) => handleMediaSelect(asset.url)}
                projectId={projectId || ''}
            />
        </>
    );
};

export { BlogEditor };
