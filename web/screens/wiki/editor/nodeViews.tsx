import React from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useNavigate } from 'react-router-dom';
import { useOptionalWikiData } from '../WikiDataContext';
import { FileEmbed as ManagedFile } from '../../../components/files/FileEmbed';
import { fileIcon, formatBytes } from '../wikiFiles';
import { getHost } from './host';
import type { CalloutTone } from './extensions';
import type { Task } from '../../../types';

const TONES: CalloutTone[] = ['info', 'success', 'warning', 'danger'];
const TONE_ICONS: Record<CalloutTone, string> = { info: 'info', success: 'check_circle', warning: 'warning', danger: 'report' };

export const CalloutView: React.FC<NodeViewProps> = ({ node, updateAttributes, editor }) => {
    const tone = (TONES.includes(node.attrs.tone) ? node.attrs.tone : 'info') as CalloutTone;
    const t = getHost(editor).t;
    return (
        <NodeViewWrapper className="wiki-callout" data-tone={tone}>
            <button
                type="button"
                className="wiki-callout__icon material-symbols-outlined"
                contentEditable={false}
                disabled={!editor.isEditable}
                title={t('wiki.callout.changeTone')}
                aria-label={t('wiki.callout.changeTone')}
                onClick={() => updateAttributes({ tone: TONES[(TONES.indexOf(tone) + 1) % TONES.length] })}
            >
                {TONE_ICONS[tone]}
            </button>
            <NodeViewContent className="wiki-callout__body" />
        </NodeViewWrapper>
    );
};

const isDone = (task: Task) => task.isCompleted || task.status === 'Done';

export const MentionChip: React.FC<NodeViewProps> = ({ node }) => {
    const data = useOptionalWikiData();
    const navigate = useNavigate();
    const { kind, id, label, projectId } = node.attrs as { kind: string; id: string; label: string; projectId: string | null };
    const lookups = data?.lookups;

    let text = label;
    let icon = 'alternate_email';
    let href: string | null = null;
    let state: 'done' | 'missing' | null = null;
    let avatar: string | null = null;

    if (kind === 'user') {
        const member = lookups?.members.find((m) => m.uid === id);
        text = member?.displayName || label;
        avatar = member?.photoURL || null;
        icon = 'person';
    } else if (kind === 'task') {
        const task = lookups?.tasks.find((entry) => entry.id === id);
        text = task?.title || label;
        icon = task && isDone(task) ? 'task_alt' : 'radio_button_unchecked';
        href = `/project/${task?.projectId || projectId}/tasks/${id}`;
        if (task && isDone(task)) state = 'done';
        if (lookups && !task) state = 'missing';
    } else if (kind === 'project') {
        const project = lookups?.projects.find((entry) => entry.id === id);
        text = project?.title || label;
        icon = 'layers';
        href = `/project/${id}`;
    } else if (kind === 'doc') {
        const doc = data?.findDoc(id);
        text = doc?.title || label;
        icon = doc?.icon ? '' : 'description';
        href = doc ? data!.docHref(doc) : null;
        if (doc?.archivedAt || (lookups && !doc)) state = 'missing';
        if (doc?.icon) text = `${doc.icon} ${text}`;
    }

    return (
        <NodeViewWrapper
            as="span"
            className={`wiki-mention wiki-mention--${kind}${state ? ` is-${state}` : ''}${href ? ' is-link' : ''}`}
            data-wiki-mention=""
            onClick={(event: React.MouseEvent) => {
                if (!href) return;
                event.preventDefault();
                navigate(href);
            }}
        >
            {avatar
                ? <img className="wiki-mention__avatar" src={avatar} alt="" />
                : icon && <span className="wiki-mention__icon material-symbols-outlined">{icon}</span>}
            <span className="wiki-mention__label">{text || label}</span>
        </NodeViewWrapper>
    );
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const inDaysIso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export const filterEmbeddedTasks = (
    tasks: Task[],
    attrs: { projectId: string | null; status: string; assignee: string; due: string; limit: number },
    uid: string,
): { items: Task[]; total: number } => {
    const today = todayIso();
    const week = inDaysIso(7);
    const filtered = tasks.filter((task) => {
        if (attrs.projectId && task.projectId !== attrs.projectId) return false;
        if (attrs.status === 'open' && isDone(task)) return false;
        if (attrs.status === 'done' && !isDone(task)) return false;
        if (attrs.assignee === 'me' && !(task.assigneeIds || []).includes(uid) && task.assigneeId !== uid) return false;
        const due = (task.dueDate || '').slice(0, 10);
        if (attrs.due === 'overdue' && !(due && due < today && !isDone(task))) return false;
        if (attrs.due === 'week' && !(due && due >= today && due <= week)) return false;
        return true;
    }).sort((a, b) => ((a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : (a.dueDate || '9999') > (b.dueDate || '9999') ? 1 : a.title.localeCompare(b.title)));
    return { items: filtered.slice(0, Number(attrs.limit) || 8), total: filtered.length };
};

export const TaskListView: React.FC<NodeViewProps> = ({ node, updateAttributes, editor, selected }) => {
    const data = useOptionalWikiData();
    const navigate = useNavigate();
    const t = getHost(editor).t;
    const attrs = node.attrs as { projectId: string | null; status: string; assignee: string; due: string; limit: number };
    const [refreshing, setRefreshing] = React.useState(false);
    const lookups = data?.lookups;
    const { items, total } = React.useMemo(
        () => filterEmbeddedTasks(lookups?.tasks || [], attrs, data?.uid || ''),
        [attrs, data?.uid, lookups?.tasks],
    );
    const projects = lookups?.projects || [];
    const editable = editor.isEditable;

    const select = (key: keyof typeof attrs, options: [string, string][]) => (
        <select
            className="wiki-tasks__select"
            value={String(attrs[key] ?? '')}
            disabled={!editable}
            onChange={(event) => updateAttributes({ [key]: event.target.value || null })}
        >
            {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
    );

    return (
        <NodeViewWrapper className={`wiki-tasks${selected ? ' is-selected' : ''}`} contentEditable={false} data-drag-handle="">
            <div className="wiki-tasks__head">
                <span className="material-symbols-outlined wiki-tasks__glyph">task_alt</span>
                <div className="wiki-tasks__filters">
                    {select('projectId', [['', t('wiki.tasks.allProjects')], ...projects.map((p) => [p.id, p.title] as [string, string])])}
                    {select('status', [['open', t('wiki.tasks.status.open')], ['done', t('wiki.tasks.status.done')], ['all', t('wiki.tasks.status.all')]])}
                    {select('assignee', [['any', t('wiki.tasks.assignee.any')], ['me', t('wiki.tasks.assignee.me')]])}
                    {select('due', [['any', t('wiki.tasks.due.any')], ['overdue', t('wiki.tasks.due.overdue')], ['week', t('wiki.tasks.due.week')]])}
                </div>
                <button
                    type="button"
                    className={`wiki-icon-btn${refreshing ? ' is-spinning' : ''}`}
                    aria-label={t('wiki.tasks.refresh')}
                    title={t('wiki.tasks.refresh')}
                    onClick={async () => {
                        setRefreshing(true);
                        await data?.ensureLookups(true).finally(() => setRefreshing(false));
                    }}
                >
                    <span className="material-symbols-outlined">refresh</span>
                </button>
            </div>
            {!lookups && <div className="wiki-tasks__empty">{t('wiki.common.loading')}</div>}
            {lookups && !items.length && <div className="wiki-tasks__empty">{t('wiki.tasks.empty')}</div>}
            <ul className="wiki-tasks__list">
                {items.map((task) => {
                    const done = isDone(task);
                    const overdue = !done && task.dueDate && task.dueDate.slice(0, 10) < todayIso();
                    const project = projects.find((p) => p.id === task.projectId);
                    return (
                        <li key={task.id}>
                            <button type="button" className={`wiki-tasks__row${done ? ' is-done' : ''}`} onClick={() => navigate(`/project/${task.projectId}/tasks/${task.id}`)}>
                                <span className="material-symbols-outlined wiki-tasks__check">{done ? 'check_circle' : 'radio_button_unchecked'}</span>
                                <span className="wiki-tasks__title">{task.title}</span>
                                {!attrs.projectId && project && <span className="wiki-tasks__meta">{project.title}</span>}
                                {task.dueDate && <span className={`wiki-tasks__meta${overdue ? ' is-overdue' : ''}`}>{task.dueDate.slice(0, 10)}</span>}
                            </button>
                        </li>
                    );
                })}
            </ul>
            {total > items.length && <div className="wiki-tasks__more">{t('wiki.tasks.more', { count: total - items.length })}</div>}
        </NodeViewWrapper>
    );
};

export const FileView: React.FC<NodeViewProps> = ({ node, updateAttributes, editor, deleteNode, selected }) => {
    const host = getHost(editor);
    const { t } = host;
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const { url, name, size, mimeType } = node.attrs as { url: string | null; name: string; size: number; mimeType: string };

    const pick = async () => {
        setBusy(true);
        setError(null);
        try {
            const ref = await host.pickFile();
            if (ref) updateAttributes(ref);
        } catch (err) {
            console.error('wiki file upload failed', err);
            setError(t('wiki.file.error'));
        } finally {
            setBusy(false);
        }
    };

    const fileId = node.attrs.fileId as string | null;
    const tenantId = useOptionalWikiData()?.tenantId;
    if (fileId && tenantId) {
        return (
            <NodeViewWrapper className={`wiki-file is-managed${selected ? ' is-selected' : ''}`} contentEditable={false} data-drag-handle="">
                <div className="wiki-file__managed"><ManagedFile tenantId={tenantId} fileId={fileId} /></div>
                {editor.isEditable && (
                    <button type="button" className="wiki-icon-btn wiki-file__remove" aria-label={t('wiki.common.remove')} title={t('wiki.common.remove')} onClick={() => deleteNode()}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                )}
            </NodeViewWrapper>
        );
    }

    if (!url) {
        return (
            <NodeViewWrapper className={`wiki-file is-empty${selected ? ' is-selected' : ''}`} contentEditable={false} data-drag-handle="">
                <span className="material-symbols-outlined wiki-file__icon">attach_file</span>
                <div className="wiki-file__text">
                    <span className="wiki-file__name">{busy ? t('wiki.file.uploading') : t('wiki.file.empty')}</span>
                    {error && <span className="wiki-file__error">{error}</span>}
                </div>
                {editor.isEditable && (
                    <div className="wiki-file__actions">
                        <button type="button" className="wiki-chip-btn" disabled={busy} onClick={pick}>{t('wiki.file.choose')}</button>
                        <button type="button" className="wiki-icon-btn" aria-label={t('wiki.common.remove')} onClick={() => deleteNode()}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                )}
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper className={`wiki-file${selected ? ' is-selected' : ''}`} contentEditable={false} data-drag-handle="">
            <span className="material-symbols-outlined wiki-file__icon">{fileIcon(mimeType || '')}</span>
            <div className="wiki-file__text">
                <a className="wiki-file__name" href={url} target="_blank" rel="noreferrer">{name}</a>
                <span className="wiki-file__meta">{[formatBytes(size), mimeType].filter(Boolean).join(' · ')}</span>
            </div>
            <div className="wiki-file__actions">
                <a className="wiki-icon-btn" href={url} target="_blank" rel="noreferrer" aria-label={t('wiki.file.open')} title={t('wiki.file.open')}>
                    <span className="material-symbols-outlined">open_in_new</span>
                </a>
                {editor.isEditable && (
                    <button type="button" className="wiki-icon-btn" aria-label={t('wiki.common.remove')} onClick={() => deleteNode()}>
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                )}
            </div>
        </NodeViewWrapper>
    );
};

interface HeadingEntry { level: number; text: string; pos: number }

export const collectHeadings = (editor: NodeViewProps['editor']): HeadingEntry[] => {
    const headings: HeadingEntry[] = [];
    editor.state.doc.descendants((child, pos) => {
        if (child.type.name === 'heading') {
            headings.push({ level: child.attrs.level, text: child.textContent, pos });
            return false;
        }
        return true;
    });
    return headings;
};

export const scrollToPos = (editor: NodeViewProps['editor'], pos: number) => {
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    dom?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export const TocView: React.FC<NodeViewProps> = ({ editor, selected }) => {
    const t = getHost(editor).t;
    const [headings, setHeadings] = React.useState<HeadingEntry[]>(() => collectHeadings(editor));
    React.useEffect(() => {
        const update = () => setHeadings(collectHeadings(editor));
        editor.on('update', update);
        return () => { editor.off('update', update); };
    }, [editor]);
    return (
        <NodeViewWrapper className={`wiki-toc${selected ? ' is-selected' : ''}`} contentEditable={false} data-drag-handle="">
            <div className="wiki-toc__title">{t('wiki.toc.title')}</div>
            {!headings.length && <div className="wiki-toc__empty">{t('wiki.toc.empty')}</div>}
            {headings.map((heading) => (
                <button
                    key={heading.pos}
                    type="button"
                    className="wiki-toc__item"
                    data-level={heading.level}
                    onClick={() => scrollToPos(editor, heading.pos)}
                >
                    {heading.text || t('wiki.toc.untitled')}
                </button>
            ))}
        </NodeViewWrapper>
    );
};
