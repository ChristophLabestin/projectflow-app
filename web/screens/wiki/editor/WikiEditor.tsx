import React from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import type { WikiJsonNode } from '../../../types/wiki';
import {
    Callout,
    FileEmbed,
    SlashCommands,
    TableOfContents,
    TaskListEmbed,
    WikiHost,
    WikiMention,
} from './extensions';
import type { WikiEditorHost } from './host';

interface WikiEditorProps {
    initialJson: WikiJsonNode;
    editable: boolean;
    host: WikiEditorHost;
    onChange?: (editor: Editor) => void;
    onReady?: (editor: Editor) => void;
    onSaveShortcut?: () => void;
    onImproveSelection?: (text: string) => void;
}

const MenuButton: React.FC<{ icon: string; label: string; active?: boolean; onClick: () => void; danger?: boolean }> = ({ icon, label, active, onClick, danger }) => (
    <button
        type="button"
        className={`wiki-bubble__btn${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}`}
        aria-label={label}
        title={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
    >
        <span className="material-symbols-outlined">{icon}</span>
    </button>
);

const LinkEditor: React.FC<{ editor: Editor; t: WikiEditorHost['t']; onDone: () => void }> = ({ editor, t, onDone }) => {
    const [value, setValue] = React.useState<string>(editor.getAttributes('link').href || '');
    const apply = () => {
        const href = value.trim();
        const chain = editor.chain().focus().extendMarkRange('link');
        if (!href) chain.unsetLink().run();
        else chain.setLink({ href: /^(https?:|mailto:|\/)/.test(href) ? href : `https://${href}` }).run();
        onDone();
    };
    return (
        <form className="wiki-bubble__link" onSubmit={(event) => { event.preventDefault(); apply(); }}>
            <input
                autoFocus
                value={value}
                placeholder={t('wiki.editor.linkPlaceholder')}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') onDone(); }}
            />
            <button type="submit" className="wiki-bubble__btn" aria-label={t('wiki.common.apply')}>
                <span className="material-symbols-outlined">check</span>
            </button>
        </form>
    );
};

export const WikiEditor: React.FC<WikiEditorProps> = ({ initialJson, editable, host, onChange, onReady, onSaveShortcut, onImproveSelection }) => {
    const hostRef = React.useRef(host);
    hostRef.current = host;
    const saveRef = React.useRef(onSaveShortcut);
    saveRef.current = onSaveShortcut;
    const [linkMode, setLinkMode] = React.useState(false);
    const { t } = host;

    const editor = useEditor({
        editable,
        content: initialJson as any,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } },
            }),
            Placeholder.configure({
                includeChildren: false,
                placeholder: ({ node }) => {
                    if (node.type.name === 'heading') return hostRef.current.t('wiki.editor.headingPlaceholder');
                    if (node.type.name === 'detailsSummary') return hostRef.current.t('wiki.editor.togglePlaceholder');
                    return hostRef.current.t('wiki.editor.placeholder');
                },
            }),
            Image.configure({ HTMLAttributes: { class: 'wiki-image' } }),
            TaskList,
            TaskItem.configure({ nested: true }),
            TableKit.configure({ table: { resizable: true } }),
            Details.configure({ persist: true, HTMLAttributes: { class: 'wiki-details' } }),
            DetailsSummary,
            DetailsContent,
            Callout,
            TaskListEmbed,
            FileEmbed,
            TableOfContents,
            WikiMention,
            SlashCommands,
            WikiHost.configure({
                host: {
                    get t() { return hostRef.current.t; },
                    pickImage: () => hostRef.current.pickImage(),
                    pickFile: () => hostRef.current.pickFile(),
                    searchMentions: (query: string) => hostRef.current.searchMentions(query),
                    get defaultProjectId() { return hostRef.current.defaultProjectId; },
                } as WikiEditorHost,
            }),
        ],
        editorProps: {
            attributes: { class: 'wiki-prose', spellcheck: 'true' },
            handleKeyDown: (_view, event) => {
                if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
                    event.preventDefault();
                    saveRef.current?.();
                    return true;
                }
                return false;
            },
        },
        onUpdate: ({ editor: current }) => onChange?.(current as Editor),
        onCreate: ({ editor: current }) => onReady?.(current as Editor),
    }, []);

    React.useEffect(() => {
        if (editor && editor.isEditable !== editable) editor.setEditable(editable);
    }, [editable, editor]);

    if (!editor) return <div className="wiki-prose wiki-prose--loading" />;

    return (
        <>
            {editable && (
                <BubbleMenu
                    editor={editor}
                    pluginKey="wikiTextMenu"
                    shouldShow={({ editor: current, state }) => {
                        if (!current.isEditable || state.selection.empty) return false;
                        if (current.isActive('image') || current.isActive('codeBlock')) return false;
                        return !(state.selection as any).node;
                    }}
                    options={{ placement: 'top', offset: 8, onHide: () => setLinkMode(false) }}
                    className="wiki-bubble"
                >
                    {linkMode ? <LinkEditor editor={editor} t={t} onDone={() => setLinkMode(false)} /> : (
                        <>
                            <MenuButton icon="format_bold" label={t('wiki.format.bold')} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
                            <MenuButton icon="format_italic" label={t('wiki.format.italic')} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
                            <MenuButton icon="format_strikethrough" label={t('wiki.format.strike')} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
                            <MenuButton icon="code" label={t('wiki.format.code')} active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} />
                            <MenuButton icon="link" label={t('wiki.format.link')} active={editor.isActive('link')} onClick={() => setLinkMode(true)} />
                            <span className="wiki-bubble__sep" />
                            <MenuButton icon="format_h2" label={t('wiki.slash.h2')} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
                            <MenuButton icon="checklist" label={t('wiki.slash.checklist')} active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} />
                            {onImproveSelection && (
                                <>
                                    <span className="wiki-bubble__sep" />
                                    <button
                                        type="button"
                                        className="wiki-bubble__ai"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                            const { from, to } = editor.state.selection;
                                            onImproveSelection(editor.state.doc.textBetween(from, to, '\n'));
                                        }}
                                    >
                                        <span className="material-symbols-outlined">auto_awesome</span>
                                        {t('wiki.ai.improveShort')}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </BubbleMenu>
            )}
            {editable && (
                <BubbleMenu
                    editor={editor}
                    pluginKey="wikiTableMenu"
                    shouldShow={({ editor: current, state }) => current.isEditable && state.selection.empty && current.isActive('table')}
                    options={{ placement: 'top-start', offset: 8 }}
                    className="wiki-bubble"
                >
                    <MenuButton icon="add_row_below" label={t('wiki.table.addRow')} onClick={() => editor.chain().focus().addRowAfter().run()} />
                    <MenuButton icon="add_column_right" label={t('wiki.table.addColumn')} onClick={() => editor.chain().focus().addColumnAfter().run()} />
                    <MenuButton icon="table_rows" label={t('wiki.table.toggleHeader')} onClick={() => editor.chain().focus().toggleHeaderRow().run()} />
                    <span className="wiki-bubble__sep" />
                    <MenuButton icon="variable_remove" label={t('wiki.table.deleteRow')} onClick={() => editor.chain().focus().deleteRow().run()} />
                    <MenuButton icon="view_column" label={t('wiki.table.deleteColumn')} onClick={() => editor.chain().focus().deleteColumn().run()} />
                    <MenuButton icon="delete" label={t('wiki.table.delete')} danger onClick={() => editor.chain().focus().deleteTable().run()} />
                </BubbleMenu>
            )}
            <EditorContent editor={editor} className="wiki-editor" />
        </>
    );
};
