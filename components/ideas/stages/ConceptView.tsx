import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { generateIdeaConceptAI } from '../../../services/geminiService';

interface ConceptViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
    chatHistoryRef?: { role: string; content: string }[];
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) return null;

    return (
        <div className="flex items-center gap-1 p-2 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] sticky top-0 z-10 backdrop-blur-sm bg-opacity-90">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`p-1.5 rounded hover:bg-[var(--color-surface-hover)] ${editor.isActive('bold') ? 'bg-[var(--color-surface-active)] text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]'}`}
                title="Bold"
            >
                <span className="material-symbols-outlined text-[18px]">format_bold</span>
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded hover:bg-[var(--color-surface-hover)] ${editor.isActive('italic') ? 'bg-[var(--color-surface-active)] text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]'}`}
                title="Italic"
            >
                <span className="material-symbols-outlined text-[18px]">format_italic</span>
            </button>
            <div className="w-px h-4 bg-[var(--color-surface-border)] mx-1" />
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-1.5 rounded hover:bg-[var(--color-surface-hover)] ${editor.isActive('heading', { level: 1 }) ? 'bg-[var(--color-surface-active)] text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]'}`}
                title="Heading 1"
            >
                <span className="material-symbols-outlined text-[18px]">format_h1</span>
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1.5 rounded hover:bg-[var(--color-surface-hover)] ${editor.isActive('heading', { level: 2 }) ? 'bg-[var(--color-surface-active)] text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]'}`}
                title="Heading 2"
            >
                <span className="material-symbols-outlined text-[18px]">format_h2</span>
            </button>
            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded hover:bg-[var(--color-surface-hover)] ${editor.isActive('bulletList') ? 'bg-[var(--color-surface-active)] text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]'}`}
                title="Bullet List"
            >
                <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded hover:bg-[var(--color-surface-hover)] ${editor.isActive('orderedList') ? 'bg-[var(--color-surface-active)] text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]'}`}
                title="Ordered List"
            >
                <span className="material-symbols-outlined text-[18px]">format_list_numbered</span>
            </button>
            <div className="w-px h-4 bg-[var(--color-surface-border)] mx-1" />
            <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-1.5 rounded hover:bg-[var(--color-surface-hover)] ${editor.isActive('blockquote') ? 'bg-[var(--color-surface-active)] text-[var(--color-primary)]' : 'text-[var(--color-text-subtle)]'}`}
                title="Quote"
            >
                <span className="material-symbols-outlined text-[18px]">format_quote</span>
            </button>
            <button
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                className={`p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-subtle)]`}
                title="Divider"
            >
                <span className="material-symbols-outlined text-[18px]">horizontal_rule</span>
            </button>
        </div>
    );
};

export const ConceptView: React.FC<ConceptViewProps> = ({ idea, onUpdate, chatHistoryRef }) => {
    const [generating, setGenerating] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Start writing your concept document or click "Draft with AI" to generate a starting point...',
            }),
        ],
        content: idea.concept || '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[500px] px-8 py-6',
            },
        },
        onUpdate: ({ editor }) => {
            onUpdate({ concept: editor.getHTML() });
        },
    });

    const handleGenerateConcept = async () => {
        if (!editor) return;
        setGenerating(true);
        try {
            const context = chatHistoryRef
                ? chatHistoryRef.map(m => `${m.role}: ${m.content}`).join('\n')
                : '';

            const htmlContent = await generateIdeaConceptAI(idea, context);
            editor.commands.setContent(htmlContent);
            onUpdate({ concept: htmlContent });
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };



    return (
        <div className="h-full flex flex-col bg-[var(--color-surface-paper)] rounded-2xl border border-[var(--color-surface-border)] overflow-hidden shadow-sm relative">

            {/* Toolbar Area */}
            <div className="flex items-center justify-between border-b border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] pr-4">
                <MenuBar editor={editor} />

                <div className="flex items-center gap-2">

                    {!idea.concept && (
                        <span className="text-xs text-[var(--color-text-muted)] animate-pulse hidden md:inline">
                            Ready?
                        </span>
                    )}
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={handleGenerateConcept}
                        loading={generating}
                        className="my-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 !text-white border-none shadow-sm"
                        icon={<span className="material-symbols-outlined">auto_awesome</span>}
                    >
                        Draft with AI
                    </Button>
                    <div className="w-px h-6 bg-[var(--color-surface-border)] mx-1" />
                    <Button
                        size="sm"
                        onClick={() => onUpdate({ stage: idea.type === 'Product' ? 'Launch' : 'Review' })}
                        className="bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:bg-[var(--color-text-main)]/90 shadow-sm border-none"
                    >
                        <span className="font-bold pl-1 mr-1">Advance</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* Editor */}
                <div className="flex-1 overflow-y-auto bg-[var(--color-surface-paper)] custom-scrollbar cursor-text relative" onClick={() => editor?.commands.focus()}>
                    <EditorContent editor={editor} className="h-full" />

                    {/* Loading Overlay */}
                    {generating && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-surface-paper)]/80 backdrop-blur-sm z-20 transition-all duration-300">
                            <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-white/50 dark:bg-black/20 shadow-xl border border-white/20">
                                <div className="relative">
                                    <span className="material-symbols-outlined text-5xl text-violet-500 animate-spin">progress_activity</span>
                                    <span className="material-symbols-outlined text-2xl text-fuchsia-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse">auto_awesome</span>
                                </div>
                                <p className="text-sm font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent animate-pulse">
                                    AI is drafting your concept...
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Empty State Overlay */}
                    {(!editor || editor.isEmpty) && !generating && (
                        <div className="absolute top-20 left-0 right-0 flex flex-col items-center justify-center opacity-10 pointer-events-none select-none">
                            <span className="material-symbols-outlined text-6xl mb-2">article</span>
                            <p className="font-serif text-xl italic">Product Requirements Document</p>
                        </div>
                    )}
                </div>



            </div>

            {/* Status Footer */}
            <div className="bg-[var(--color-surface-bg)] border-t border-[var(--color-surface-border)] px-4 py-1.5 flex justify-between items-center text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider font-semibold select-none z-10">
                <span>Markdown Supported</span>
                <span>{editor?.storage.characterCount?.words() || 0} words</span>
            </div>
        </div>
    );
};
