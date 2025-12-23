import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { useState } from 'react';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { TemplateVariable } from '../../../types';
import { VariablePicker } from './VariablePicker';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    variables?: TemplateVariable[];
}

const MenuButton = ({
    isActive,
    onClick,
    icon,
    title
}: {
    isActive?: boolean,
    onClick: () => void,
    icon: string,
    title?: string
}) => (
    <button
        onClick={onClick}
        title={title}
        className={`size-7 flex items-center justify-center rounded transition-colors ${isActive
            ? 'bg-zinc-200 text-black dark:bg-zinc-700 dark:text-white'
            : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
    >
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
);

export const RichTextEditor = ({ value, onChange, variables }: RichTextEditorProps) => {
    const [pickerOpen, setPickerOpen] = useState(false);
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-500 underline',
                },
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[150px] px-4 py-3 text-sm'
            }
        }
    });

    if (!editor) {
        return null;
    }

    return (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20 focus-within:border-[var(--color-primary)]">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    icon="format_bold"
                    title="Bold"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    icon="format_italic"
                    title="Italic"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive('underline')}
                    icon="format_underlined"
                    title="Underline"
                />
                <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1 self-center" />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    isActive={editor.isActive('heading', { level: 1 })}
                    icon="format_h1"
                    title="Heading 1"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={editor.isActive('heading', { level: 2 })}
                    icon="format_h2"
                    title="Heading 2"
                />
                <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1 self-center" />
                <MenuButton
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    isActive={editor.isActive({ textAlign: 'left' })}
                    icon="format_align_left"
                    title="Align Left"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    isActive={editor.isActive({ textAlign: 'center' })}
                    icon="format_align_center"
                    title="Align Center"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    isActive={editor.isActive({ textAlign: 'right' })}
                    icon="format_align_right"
                    title="Align Right"
                />
                <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1 self-center" />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    icon="format_list_bulleted"
                    title="Bullet List"
                />
                <MenuButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    icon="format_list_numbered"
                    title="Ordered List"
                />
                {variables && variables.length > 0 && (
                    <>
                        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1 self-center" />
                        <MenuButton
                            onClick={() => setPickerOpen(true)}
                            icon="data_object"
                            title="Insert Variable"
                        />
                    </>
                )}
            </div>

            {pickerOpen && variables && (
                <VariablePicker
                    variables={variables}
                    isOpen={true}
                    onClose={() => setPickerOpen(false)}
                    onSelect={(v) => {
                        editor?.chain().focus().insertContent(`{{${v.name}}}`).run();
                        setPickerOpen(false); // Close explicitly just in case
                    }}
                />
            )}

            {/* Editor Area */}
            <EditorContent editor={editor} />
        </div>
    );
};
