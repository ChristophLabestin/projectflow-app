import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension, InputRule } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, className }) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: placeholder || 'Write something...',
            }),
            Extension.create({
                name: 'arrowReplacement',
                addInputRules() {
                    return [
                        new InputRule({
                            find: /-->$/,
                            replace: '→',
                        }),
                    ];
                },
            }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose focus:outline-none min-h-[150px] max-w-none text-[var(--color-text-main)] prose-headings:text-[var(--color-text-main)] prose-p:text-[var(--color-text-main)] prose-strong:text-[var(--color-text-main)] prose-ul:text-[var(--color-text-main)] prose-li:text-[var(--color-text-main)] [&_ol]:text-[var(--color-text-main)]',
            },
        },
    });

    // Update editor content when value changes externally
    React.useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value);
        }
    }, [value, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className={`border border-[var(--color-surface-border)] rounded-lg overflow-hidden bg-[var(--color-bg-base)] transition-colors focus-within:border-[var(--color-primary)] ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] overflow-x-auto">
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    icon="format_bold"
                    tooltip="Bold"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    icon="format_italic"
                    tooltip="Italic"
                />
                <div className="w-px h-4 bg-[var(--color-surface-border)] mx-1" />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={editor.isActive('heading', { level: 2 })}
                    icon="format_h2" // Mapping needed or Use Text
                    label="H2"
                    tooltip="Heading 2"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    isActive={editor.isActive('heading', { level: 3 })}
                    icon="format_h3" // Mapping needed or Use Text
                    label="H3"
                    tooltip="Heading 3"
                />
                <div className="w-px h-4 bg-[var(--color-surface-border)] mx-1" />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    icon="format_list_bulleted"
                    tooltip="Bullet List"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    icon="format_list_numbered"
                    tooltip="Ordered List"
                />
            </div>

            {/* Editor Area */}
            <div className="p-4 cursor-text" onClick={() => editor.chain().focus().run()}>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

interface MenuButtonProps {
    onClick: () => void;
    isActive: boolean;
    icon?: string;
    label?: string;
    tooltip?: string;
}

const MenuButton: React.FC<MenuButtonProps> = ({ onClick, isActive, icon, label, tooltip }) => (
    <button
        type="button"
        onClick={onClick}
        className={`p-1.5 rounded text-sm font-medium transition-colors flex items-center justify-center min-w-[28px] ${isActive
            ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'
            }`}
        title={tooltip}
    >
        {icon ? <span className="material-symbols-outlined text-[18px]">{icon}</span> : label}
    </button>
);
