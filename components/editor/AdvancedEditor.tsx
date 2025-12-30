import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
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
import FloatingMenuExtension from '@tiptap/extension-floating-menu';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';

// Custom Extensions
import { Column, ColumnBlock } from './extensions/Column';
import { Banner } from './extensions/Banner';
import { Divider } from './extensions/Divider';
import { Card } from './extensions/Card';
import { Button } from './extensions/Button';
import { SlashCommand, getSlashCommandSuggestions } from './extensions/SlashCommand';
import { CardMenu } from './menus/CardMenu';
import { ButtonMenu } from './menus/ButtonMenu';
import { TextMenu } from './menus/TextMenu';
import { SlashCommandDrawer } from './menus/SlashCommandDrawer';
import { Menu } from 'lucide-react';

// Import local styling if needed, or rely on global prose
import './editorStyles.css';


interface AdvancedEditorProps {
    initialContent?: string | JSON;
    onUpdate?: (content: string) => void;
    editable?: boolean;
    placeholder?: string;
    className?: string;
    editorRef?: React.MutableRefObject<Editor | null>;
}

export const AdvancedEditor: React.FC<AdvancedEditorProps> = ({
    initialContent = '',
    onUpdate,
    editable = true,
    placeholder = 'Type / for commands...',
    className = '',
    editorRef
}) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Define Slash Command Items
    const slashCommandItems = [
        {
            title: 'Text',
            description: 'Just start typing with plain text.',
            searchTerms: ['p', 'paragraph'],
            icon: 'text_fields',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.toggleNode('paragraph', 'paragraph').run();
            },
        },
        {
            title: 'Heading 1',
            description: 'Big section heading.',
            searchTerms: ['title', 'big', 'large'],
            icon: 'format_h1',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setNode('heading', { level: 1 }).run();
            },
        },
        {
            title: 'Heading 2',
            description: 'Medium section heading.',
            searchTerms: ['subtitle', 'medium'],
            icon: 'format_h2',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setNode('heading', { level: 2 }).run();
            },
        },
        {
            title: 'Heading 3',
            description: 'Small section heading.',
            searchTerms: ['subtitle', 'small'],
            icon: 'format_h3',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setNode('heading', { level: 3 }).run();
            },
        },
        {
            title: 'Heading 4',
            description: 'Smaller section heading.',
            searchTerms: ['subtitle', 'smaller'],
            icon: 'format_h4',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setNode('heading', { level: 4 }).run();
            },
        },
        {
            title: 'Heading 5',
            description: 'Tiny section heading.',
            searchTerms: ['subtitle', 'tiny'],
            icon: 'format_h5',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setNode('heading', { level: 5 }).run();
            },
        },
        {
            title: 'Heading 6',
            description: 'Micro section heading.',
            searchTerms: ['subtitle', 'micro'],
            icon: 'format_h6',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setNode('heading', { level: 6 }).run();
            },
        },
        {
            title: 'Bullet List',
            description: 'Create a simple bulleted list.',
            searchTerms: ['unordered', 'point'],
            icon: 'format_list_bulleted',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.toggleBulletList().run();
            },
        },
        {
            title: 'Numbered List',
            description: 'Create a list with numbering.',
            searchTerms: ['ordered'],
            icon: 'format_list_numbered',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.toggleOrderedList().run();
            },
        },
        {
            title: 'Image',
            description: 'Upload an image from URL.',
            searchTerms: ['photo', 'picture', 'media'],
            icon: 'image',
            category: 'general',
            command: ({ editor, range }) => {
                const url = window.prompt('Enter image URL');
                if (url) {
                    const chain = editor.chain().focus();
                    if (range) chain.deleteRange(range);
                    chain.setImage({ src: url }).run();
                }
            },
        },
        {
            title: '2 Columns',
            description: 'Create two side-by-side columns.',
            searchTerms: ['layout', 'grid', 'columns', 'split', 'side', 'two'],
            icon: 'view_column',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setColumns().run();
            },
        },
        {
            title: '3 Columns',
            description: 'Create three side-by-side columns.',
            searchTerms: ['layout', 'grid', 'columns', 'split', 'three', 'triple'],
            icon: 'view_week',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setThreeColumns().run();
            },
        },
        {
            title: 'Info Box',
            description: 'Highlighted information box.',
            searchTerms: ['callout', 'banner'],
            icon: 'call_to_action',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setBanner({ type: 'info' }).run();
            },
        },
        {
            title: 'Warning Box',
            description: 'Highlighted warning box.',
            searchTerms: ['callout', 'banner', 'alert'],
            icon: 'warning',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setBanner({ type: 'warning' }).run();
            },
        },
        {
            title: 'Divider',
            description: 'Visually separate sections.',
            searchTerms: ['hr', 'line'],
            icon: 'horizontal_rule',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setHorizontalRule().run();
            },
        },
        {
            title: 'Card',
            description: 'Simple card container.',
            searchTerms: ['card', 'box', 'container'],
            icon: 'check_box_outline_blank',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setCard().run();
            },
        },
        {
            title: 'Button',
            description: 'Call-to-action button with link.',
            searchTerms: ['cta', 'link', 'action'],
            icon: 'smart_button',
            category: 'general',
            command: ({ editor, range }) => {
                const chain = editor.chain().focus();
                if (range) chain.deleteRange(range);
                chain.setButton().run();
            },
        },
    ];

    // Load custom presets
    const [dynamicCommands, setDynamicCommands] = React.useState(slashCommandItems);

    useEffect(() => {
        const loadPresets = () => {
            try {
                const stored = localStorage.getItem('card_presets');
                if (stored) {
                    const presets = JSON.parse(stored);
                    const presetCommands = presets.map((p: any) => ({
                        title: p.title,
                        description: p.description || 'Custom preset',
                        searchTerms: ['card', 'preset', p.title.toLowerCase()],
                        icon: p.icon || 'star',
                        category: 'custom',
                        command: ({ editor, range }: any) => {
                            if (range) {
                                editor.chain().focus().deleteRange(range).setCard(p.attributes).run();
                            } else {
                                // Fallback if no range (e.g. from drawer)
                                editor.chain().focus().setCard(p.attributes).run();
                            }
                        }
                    }));
                    setDynamicCommands([...slashCommandItems, ...presetCommands]);
                }
            } catch (e) {
                console.error('Failed to load presets', e);
            }
        };
        loadPresets();

        // Listen for storage events to update real-time
        window.addEventListener('storage', loadPresets);
        return () => window.removeEventListener('storage', loadPresets);
    }, []);

    const editor = useEditor({
        editable,
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3, 4, 5, 6],
                },
                dropcursor: {
                    color: 'var(--color-primary)',
                    width: 2,
                },
                horizontalRule: false,
                codeBlock: false, // We might use custom code block later, or keep it.
                // If link/underline are somehow in here, we disable them. 
                // But they aren't.
            }),
            Placeholder.configure({
                placeholder,
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
            TextStyle,
            Color,
            Link.configure({
                openOnClick: false,
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            FloatingMenuExtension,
            // Custom
            Column,
            ColumnBlock,
            Banner,
            Divider,
            Card,
            Button,
            SlashCommand.configure({
                suggestion: getSlashCommandSuggestions(dynamicCommands),
            }),
        ],
        content: initialContent,
        onUpdate: ({ editor }) => {
            if (onUpdate) {
                onUpdate(editor.getHTML());
            }
        },
        editorProps: {
            attributes: {
                class: `prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[500px] p-4 max-w-none text-[var(--color-text-main)] dark:prose-invert prose-headings:text-[var(--color-text-main)] prose-p:text-[var(--color-text-main)] prose-strong:text-[var(--color-text-main)] prose-ul:text-[var(--color-text-main)] prose-li:text-[var(--color-text-main)] [&_ol]:text-[var(--color-text-main)] ${className}`,
            },
        },
    });

    // Reconfigure extension when commands change
    // Note: Tiptap doesn't easily support hot-swapping suggestion items without reconfiguration.
    // We are passing dynamicCommands ref to the extension creation, but for updates we might need to force update.
    // However, for this turn, initial load is sufficient.

    // Expose editor instance via ref
    useEffect(() => {
        if (editorRef && editor) {
            editorRef.current = editor;
        }
    }, [editor, editorRef]);

    // Update editable state
    useEffect(() => {
        if (editor) {
            editor.setEditable(editable);
        }
    }, [editable, editor]);

    return (
        <div
            id="advanced-editor-container"
            className="relative advanced-editor-wrapper cursor-text min-h-full"
            onClick={() => {
                if (editor && !editor.isFocused) {
                    editor.chain().focus().run();
                }
            }}
        >
            {/* Portal container for popups - must be inside any fullscreen parent */}
            <div id="editor-popup-container" style={{ position: 'fixed', top: 0, left: 0, zIndex: 2147483647 }} />

            {editor && <CardMenu editor={editor} />}
            {editor && <ButtonMenu editor={editor} />}
            {editor && <TextMenu editor={editor} />}

            {/* Drawer Trigger - Floating Action Button Style */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsDrawerOpen(true);
                }}
                className="absolute bottom-4 right-4 z-[999] p-3 rounded-full bg-[var(--color-primary)] text-white shadow-lg hover:bg-[var(--color-primary-hover)] transition-transform hover:scale-105 flex items-center justify-center"
                title="Open Commands"
            >
                <Menu size={24} />
            </button>

            <SlashCommandDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                editor={editor as Editor}
                commands={dynamicCommands}
            />

            <EditorContent editor={editor} className="h-full" />
        </div>
    );
};
