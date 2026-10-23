import React from 'react';
import { Extension, Node, mergeAttributes, type Editor, type Range } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import Mention from '@tiptap/extension-mention';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { WIKI_MENTION_NODE } from '../../../services/wiki/wikiContent';
import { SuggestionList, createSuggestionRender, type SuggestionItem, type SuggestionListHandle } from './suggestion';
import { getHost, type WikiEditorHost, type WikiMentionItem } from './host';

export { getHost } from './host';
export type { WikiEditorHost, WikiMentionItem, WikiT } from './host';
import { CalloutView, FileView, MentionChip, TaskListView, TocView } from './nodeViews';

export const WikiHost = Extension.create<{ host: WikiEditorHost | null }>({
    name: 'wikiHost',
    addOptions: () => ({ host: null }),
    addStorage() {
        return { host: this.options.host };
    },
});

// ---- Blocks -------------------------------------------------------------------

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger';

export const Callout = Node.create({
    name: 'wikiCallout',
    group: 'block',
    content: 'block+',
    defining: true,
    addAttributes() {
        return {
            tone: {
                default: 'info',
                parseHTML: (element: HTMLElement) => element.getAttribute('data-tone') || 'info',
                renderHTML: (attributes: { tone: string }) => ({ 'data-tone': attributes.tone }),
            },
        };
    },
    parseHTML: () => [{ tag: 'div[data-wiki-callout]' }],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-wiki-callout': '' }), 0],
    addNodeView: () => ReactNodeViewRenderer(CalloutView),
});

export const TaskListEmbed = Node.create({
    name: 'wikiTaskList',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes() {
        return {
            projectId: { default: null },
            status: { default: 'open' },
            assignee: { default: 'any' },
            due: { default: 'any' },
            limit: { default: 8 },
        };
    },
    parseHTML: () => [{ tag: 'div[data-wiki-task-list]' }],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-wiki-task-list': '' })],
    addNodeView: () => ReactNodeViewRenderer(TaskListView),
});

export const FileEmbed = Node.create({
    name: 'wikiFile',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes() {
        return {
            fileId: { default: null },
            name: { default: '' },
            size: { default: 0 },
            mimeType: { default: '' },
            url: { default: null },
        };
    },
    parseHTML: () => [{ tag: 'div[data-wiki-file]' }],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-wiki-file': '' })],
    addNodeView: () => ReactNodeViewRenderer(FileView),
});

export const TableOfContents = Node.create({
    name: 'wikiToc',
    group: 'block',
    atom: true,
    draggable: true,
    parseHTML: () => [{ tag: 'div[data-wiki-toc]' }],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-wiki-toc': '' })],
    addNodeView: () => ReactNodeViewRenderer(TocView),
});

// ---- Mentions -------------------------------------------------------------------

const MentionList = React.forwardRef<SuggestionListHandle, any>((props, ref) => (
    <SuggestionList ref={ref} items={props.items} command={props.command} emptyLabel={getHost(props.editor).t('wiki.editor.noMatches')} />
));
MentionList.displayName = 'MentionList';

export const WikiMention = Mention.extend({
    name: WIKI_MENTION_NODE,
    addAttributes() {
        return {
            ...this.parent?.(),
            kind: { default: 'user' },
            projectId: { default: null },
        };
    },
    parseHTML: () => [{ tag: 'span[data-wiki-mention]' }],
    renderHTML: ({ node, HTMLAttributes }) => [
        'span',
        mergeAttributes(HTMLAttributes, { 'data-wiki-mention': '', 'data-kind': node.attrs.kind }),
        `@${node.attrs.label || ''}`,
    ],
    renderText: ({ node }) => `@${node.attrs.label || ''}`,
    addNodeView: () => ReactNodeViewRenderer(MentionChip, { as: 'span' }),
}).configure({
    suggestion: {
        char: '@',
        items: ({ query, editor }) => getHost(editor).searchMentions(query),
        render: createSuggestionRender(MentionList),
        command: ({ editor, range, props }) => {
            const item = props as unknown as WikiMentionItem;
            editor.chain().focus().insertContentAt(range, [
                { type: WIKI_MENTION_NODE, attrs: { id: item.id, label: item.label, kind: item.kind, projectId: item.projectId || null } },
                { type: 'text', text: ' ' },
            ]).run();
        },
    },
});

// ---- Slash commands ------------------------------------------------------------------

interface SlashItem extends SuggestionItem {
    keywords: string[];
    run: (editor: Editor, range: Range) => void;
}

const slashItems = (editor: Editor): SlashItem[] => {
    const host = getHost(editor);
    const { t } = host;
    const block = t('wiki.slash.group.blocks');
    const lists = t('wiki.slash.group.lists');
    const media = t('wiki.slash.group.media');
    const smart = t('wiki.slash.group.smart');
    const item = (key: string, group: string, icon: string, keywords: string[], run: SlashItem['run']): SlashItem => ({
        key, group, icon, keywords, run, title: t(`wiki.slash.${key}`), subtitle: t(`wiki.slash.${key}.hint`),
    });
    return [
        item('text', block, 'notes', ['paragraph', 'text', 'absatz'], (e, r) => e.chain().focus().deleteRange(r).setParagraph().run()),
        item('h1', block, 'format_h1', ['heading', 'title', 'überschrift'], (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run()),
        item('h2', block, 'format_h2', ['heading', 'überschrift'], (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run()),
        item('h3', block, 'format_h3', ['heading', 'überschrift'], (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run()),
        item('callout', block, 'lightbulb', ['callout', 'info', 'hinweis', 'note', 'warning'], (e, r) =>
            e.chain().focus().deleteRange(r).insertContent({ type: 'wikiCallout', attrs: { tone: 'info' }, content: [{ type: 'paragraph' }] }).run()),
        item('toggle', block, 'expand_circle_right', ['toggle', 'details', 'aufklappen', 'collapse'], (e, r) =>
            e.chain().focus().deleteRange(r).setDetails().run()),
        item('quote', block, 'format_quote', ['quote', 'zitat', 'blockquote'], (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run()),
        item('code', block, 'code_blocks', ['code', 'snippet'], (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run()),
        item('divider', block, 'horizontal_rule', ['divider', 'line', 'trenner', 'hr'], (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run()),
        item('table', block, 'table', ['table', 'tabelle', 'grid'], (e, r) =>
            e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()),
        item('bullet', lists, 'format_list_bulleted', ['list', 'bullet', 'liste'], (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run()),
        item('numbered', lists, 'format_list_numbered', ['list', 'numbered', 'ordered', 'nummer'], (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run()),
        item('checklist', lists, 'checklist', ['todo', 'check', 'task', 'checkliste'], (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run()),
        item('image', media, 'image', ['image', 'bild', 'photo', 'picture'], (e, r) => {
            e.chain().focus().deleteRange(r).run();
            void host.pickImage().then((image) => {
                if (image) e.chain().focus().setImage({ src: image.src, alt: image.alt }).run();
            });
        }),
        item('file', media, 'attach_file', ['file', 'datei', 'attachment', 'anhang', 'pdf'], (e, r) =>
            e.chain().focus().deleteRange(r).insertContent({ type: 'wikiFile' }).run()),
        item('tasks', smart, 'task_alt', ['tasks', 'aufgaben', 'filter', 'list'], (e, r) =>
            e.chain().focus().deleteRange(r).insertContent({ type: 'wikiTaskList', attrs: { projectId: host.defaultProjectId } }).run()),
        item('toc', smart, 'toc', ['toc', 'contents', 'inhalt', 'verzeichnis'], (e, r) =>
            e.chain().focus().deleteRange(r).insertContent({ type: 'wikiToc' }).run()),
        item('mention', smart, 'alternate_email', ['mention', 'link', 'page', 'seite', 'person', 'erwähnen'], (e, r) =>
            e.chain().focus().deleteRange(r).insertContent('@').run()),
    ];
};

const SlashList = React.forwardRef<SuggestionListHandle, any>((props, ref) => (
    <SuggestionList ref={ref} items={props.items} command={props.command} emptyLabel={getHost(props.editor).t('wiki.editor.noMatches')} />
));
SlashList.displayName = 'SlashList';

export const SlashCommands = Extension.create({
    name: 'wikiSlash',
    addProseMirrorPlugins() {
        return [
            Suggestion<SlashItem>({
                editor: this.editor,
                char: '/',
                pluginKey: new PluginKey('wikiSlash'),
                allow: ({ state, range }) => {
                    const $from = state.doc.resolve(range.from);
                    return $from.parent.type.name !== 'codeBlock';
                },
                items: ({ query, editor }) => {
                    const q = query.toLowerCase().trim();
                    const all = slashItems(editor);
                    if (!q) return all;
                    return all.filter((entry) =>
                        entry.title.toLowerCase().includes(q) || entry.keywords.some((keyword) => keyword.startsWith(q)));
                },
                command: ({ editor, range, props }) => props.run(editor, range),
                render: createSuggestionRender(SlashList),
            }),
        ];
    },
});
