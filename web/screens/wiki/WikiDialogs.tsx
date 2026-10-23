import React from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../../components/common/Modal/Modal';
import { Button } from '../../components/ui/Button';
import { usePresence } from '../../components/motion';
import { useToast } from '../../context/UIContext';
import { addTask } from '../../services/dataService';
import { extractWikiTasks, improveWikiText, summarizeWikiPage, type WikiAiTask } from '../../services/wiki/wikiAi';
import { parseDocJson } from '../../services/wiki/wikiContent';
import { linkTaskToDoc, listWikiVersions } from '../../services/wiki/wikiService';
import type { WikiDocMeta, WikiJsonNode, WikiTemplate, WikiVersion } from '../../types/wiki';
import { WikiEditor } from './editor/WikiEditor';
import type { WikiEditorHost, WikiT } from './editor/host';
import { useWikiData } from './WikiDataContext';
import { useWikiT } from './useWikiT';

// ---- Icon picker -------------------------------------------------------------------

const EMOJIS = ['📄', '📘', '📒', '🧭', '🗓️', '✅', '🚀', '💡', '🎯', '📌', '🔁', '⚖️', '👋', '🛠️', '🧪', '📊', '🔒', '🎨', '🧩', '📣', '🤝', '🏁', '⚠️', '❓', '⭐', '🔥', '🌱', '📦', '🧠', '💬'];

export const IconPicker: React.FC<{ t: WikiT; value: string | null; onChange: (icon: string | null) => void }> = ({ t, value, onChange }) => {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    const { mounted, exiting } = usePresence(open);
    React.useEffect(() => {
        if (!open) return undefined;
        const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);
    return (
        <div className="wiki-icon-picker" ref={ref}>
            <button
                type="button"
                className={`wiki-icon-picker__trigger${value ? ' has-icon' : ''}`}
                aria-label={value ? t('wiki.icon.change') : t('wiki.icon.add')}
                onClick={() => setOpen((current) => !current)}
            >
                {value || <><span className="material-symbols-outlined">add_reaction</span>{t('wiki.icon.add')}</>}
            </button>
            {mounted && (
                <div className={`wiki-icon-picker__panel${exiting ? ' is-exiting' : ''}`} role="dialog" aria-label={t('wiki.icon.add')}>
                    <div className="wiki-icon-picker__grid">
                        {EMOJIS.map((emoji) => (
                            <button key={emoji} type="button" className={emoji === value ? 'is-active' : ''} onClick={() => { onChange(emoji); setOpen(false); }}>
                                {emoji}
                            </button>
                        ))}
                    </div>
                    {value && (
                        <button type="button" className="wiki-chip-btn" onClick={() => { onChange(null); setOpen(false); }}>{t('wiki.icon.remove')}</button>
                    )}
                </div>
            )}
        </div>
    );
};

// ---- Versions ------------------------------------------------------------------------

const REASON_KEYS: Record<WikiVersion['reason'], string> = {
    autosave: 'wiki.versions.autosave',
    manual: 'wiki.versions.manual',
    restore: 'wiki.versions.restore',
    'before-restore': 'wiki.versions.beforeRestore',
    conflict: 'wiki.versions.conflict',
};

export const WikiVersionsDrawer: React.FC<{
    open: boolean;
    onClose: () => void;
    tenantId: string;
    docId: string;
    host: WikiEditorHost;
    onRestore: (json: WikiJsonNode, title: string) => Promise<void>;
}> = ({ open, onClose, tenantId, docId, host, onRestore }) => {
    const t = useWikiT();
    const { showError } = useToast();
    const { mounted, exiting } = usePresence(open);
    const [versions, setVersions] = React.useState<WikiVersion[] | null>(null);
    const [selected, setSelected] = React.useState<WikiVersion | null>(null);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        setVersions(null);
        setSelected(null);
        listWikiVersions(tenantId, docId).then((list) => {
            setVersions(list);
            setSelected(list.find((version) => version.data) || null);
        }).catch(() => setVersions([]));
    }, [docId, open, tenantId]);

    React.useEffect(() => {
        if (!open) return undefined;
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose, open]);

    if (!mounted) return null;
    return createPortal(
        <div className={`wiki-drawer-layer${exiting ? ' is-exiting' : ''}`}>
            <button type="button" className="wiki-drawer-layer__scrim" aria-label={t('wiki.common.close')} onClick={onClose} />
            <aside className="wiki-drawer" role="dialog" aria-label={t('wiki.versions.title')}>
                <header className="wiki-drawer__head">
                    <h2>{t('wiki.versions.title')}</h2>
                    <button type="button" className="wiki-icon-btn" aria-label={t('wiki.common.close')} onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>
                <div className="wiki-drawer__body">
                    <div className="wiki-versions">
                        {!versions && <p className="wiki-rail__empty">{t('wiki.common.loading')}</p>}
                        {versions && !versions.length && <p className="wiki-rail__empty">{t('wiki.versions.empty')}</p>}
                        {versions?.map((version) => (
                            <button
                                key={version.id}
                                type="button"
                                disabled={!version.data}
                                className={`wiki-versions__item${selected?.id === version.id ? ' is-active' : ''}`}
                                onClick={() => setSelected(version)}
                            >
                                <span className="wiki-versions__when">{version.createdAt ? new Date(version.createdAt).toLocaleString() : '…'}</span>
                                <span className="wiki-versions__who">{version.createdByName || t('wiki.someone')} · {t(REASON_KEYS[version.reason] || REASON_KEYS.autosave)}</span>
                                {!version.data && <span className="wiki-versions__who">{t('wiki.versions.tooLarge')}</span>}
                            </button>
                        ))}
                    </div>
                    <div className="wiki-versions__preview">
                        {selected?.data ? (
                            <>
                                <h3 className="wiki-versions__title">{selected.title || t('wiki.untitled')}</h3>
                                <div className="wiki-versions__doc">
                                    <WikiEditor key={selected.id} initialJson={parseDocJson(selected.data)} editable={false} host={host} />
                                </div>
                            </>
                        ) : <p className="wiki-rail__empty">{t('wiki.versions.pick')}</p>}
                    </div>
                </div>
                <footer className="wiki-drawer__foot">
                    <Button variant="ghost" onClick={onClose}>{t('wiki.common.cancel')}</Button>
                    <Button
                        disabled={!selected?.data || busy}
                        isLoading={busy}
                        onClick={async () => {
                            if (!selected?.data) return;
                            setBusy(true);
                            try {
                                await onRestore(parseDocJson(selected.data), selected.title);
                            } catch (error) {
                                console.error('wiki restore failed', error);
                                showError(t('wiki.error.generic'));
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        {t('wiki.versions.restoreAction')}
                    </Button>
                </footer>
            </aside>
        </div>,
        document.body,
    );
};

// ---- Link task ------------------------------------------------------------------------

export const WikiLinkTaskDialog: React.FC<{ open: boolean; onClose: () => void; meta: WikiDocMeta }> = ({ open, onClose, meta }) => {
    const t = useWikiT();
    const { showError, showSuccess } = useToast();
    const data = useWikiData();
    const [query, setQuery] = React.useState('');
    React.useEffect(() => {
        if (open) {
            setQuery('');
            void data.ensureLookups();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
    const q = query.toLowerCase().trim();
    const tasks = (data.lookups?.tasks || [])
        .filter((task) => !meta.linkedTaskRefs.includes(`${task.projectId}/${task.id}`))
        .filter((task) => !meta.projectId || task.projectId === meta.projectId || !q || task.title.toLowerCase().includes(q))
        .filter((task) => !q || task.title.toLowerCase().includes(q))
        .sort((a, b) => Number(b.projectId === meta.projectId) - Number(a.projectId === meta.projectId))
        .slice(0, 12);
    return (
        <Modal isOpen={open} onClose={onClose} title={t('wiki.action.linkTask')} size="md">
            <div className="wiki-dialog">
                <input
                    className="wiki-dialog__search"
                    autoFocus
                    value={query}
                    placeholder={t('wiki.link.search')}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <div className="wiki-dialog__list">
                    {!data.lookups && <p className="wiki-rail__empty">{t('wiki.common.loading')}</p>}
                    {data.lookups && !tasks.length && <p className="wiki-rail__empty">{t('wiki.link.empty')}</p>}
                    {tasks.map((task) => (
                        <button
                            key={task.id}
                            type="button"
                            className="wiki-dialog__row"
                            onClick={async () => {
                                try {
                                    await linkTaskToDoc(data.tenantId, meta.id, `${task.projectId}/${task.id}`);
                                    showSuccess(t('wiki.toast.taskLinked'));
                                    onClose();
                                } catch {
                                    showError(t('wiki.error.generic'));
                                }
                            }}
                        >
                            <span className="material-symbols-outlined">{task.isCompleted ? 'check_circle' : 'radio_button_unchecked'}</span>
                            <span className="wiki-dialog__row-title">{task.title}</span>
                            <span className="wiki-dialog__row-meta">{data.lookups?.projects.find((p) => p.id === task.projectId)?.title}</span>
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

// ---- AI ---------------------------------------------------------------------------------

export type WikiAiMode = 'summarize' | 'improve' | 'tasks';

export const WikiAiDialog: React.FC<{
    mode: WikiAiMode;
    sourceText: string;
    title: string;
    language: string;
    meta: WikiDocMeta;
    onClose: () => void;
    onInsertSummary: (lines: string[]) => void;
    onReplaceText: (value: string) => void;
}> = ({ mode, sourceText, title, language, meta, onClose, onInsertSummary, onReplaceText }) => {
    const t = useWikiT();
    const { showError, showSuccess } = useToast();
    const data = useWikiData();
    const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
    const [result, setResult] = React.useState('');
    const [tasks, setTasks] = React.useState<(WikiAiTask & { selected: boolean })[]>([]);
    const [projectId, setProjectId] = React.useState<string>(meta.projectId || '');
    const [creating, setCreating] = React.useState(false);

    const run = React.useCallback(async () => {
        setState('loading');
        try {
            if (!sourceText.trim()) throw new Error('empty');
            if (mode === 'summarize') setResult(await summarizeWikiPage(title, sourceText, language));
            if (mode === 'improve') setResult(await improveWikiText(sourceText, language));
            if (mode === 'tasks') setTasks((await extractWikiTasks(title, sourceText, language)).map((task) => ({ ...task, selected: true })));
            setState('ready');
        } catch (error) {
            console.error('wiki ai failed', error);
            setState('error');
        }
    }, [language, mode, sourceText, title]);

    React.useEffect(() => { void run(); }, [run]);
    React.useEffect(() => {
        if (mode !== 'tasks') return;
        void data.ensureLookups().then((lookups) => {
            setProjectId((current) => current || lookups.projects[0]?.id || '');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    const lines = result.split('\n').map((line) => line.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
    const selected = tasks.filter((task) => task.selected);

    const createTasks = async () => {
        if (!projectId || !selected.length) return;
        setCreating(true);
        try {
            for (const task of selected) {
                const taskId = await addTask(projectId, task.title, undefined, undefined, task.priority || 'Medium', task.description ? { description: task.description } : undefined, data.tenantId);
                if (taskId) await linkTaskToDoc(data.tenantId, meta.id, `${projectId}/${taskId}`);
            }
            void data.ensureLookups(true);
            showSuccess(t('wiki.ai.tasksCreated', { count: selected.length }));
            onClose();
        } catch (error) {
            console.error('wiki ai task creation failed', error);
            showError(t('wiki.error.generic'));
        } finally {
            setCreating(false);
        }
    };

    const titles: Record<WikiAiMode, string> = {
        summarize: t('wiki.ai.summarize'),
        improve: t('wiki.ai.improve'),
        tasks: t('wiki.ai.tasks'),
    };

    let footer: React.ReactNode = <Button variant="ghost" onClick={onClose}>{t('wiki.common.close')}</Button>;
    if (state === 'ready' && mode === 'summarize') {
        footer = (
            <>
                <Button variant="ghost" onClick={onClose}>{t('wiki.common.discard')}</Button>
                <Button onClick={() => { onInsertSummary(lines); onClose(); }}>{t('wiki.ai.insertSummary')}</Button>
            </>
        );
    }
    if (state === 'ready' && mode === 'improve') {
        footer = (
            <>
                <Button variant="ghost" onClick={onClose}>{t('wiki.common.discard')}</Button>
                <Button onClick={() => { onReplaceText(result); onClose(); }}>{t('wiki.ai.replace')}</Button>
            </>
        );
    }
    if (state === 'ready' && mode === 'tasks' && tasks.length) {
        footer = (
            <>
                <Button variant="ghost" onClick={onClose}>{t('wiki.common.discard')}</Button>
                <Button disabled={!selected.length || !projectId || creating} isLoading={creating} onClick={createTasks}>
                    {t('wiki.ai.createTasks', { count: selected.length })}
                </Button>
            </>
        );
    }

    return (
        <Modal isOpen onClose={onClose} title={titles[mode]} size="lg" footer={footer}>
            <div className="wiki-ai">
                <p className="wiki-ai__note"><span className="material-symbols-outlined">auto_awesome</span>{t('wiki.ai.confirmNote')}</p>
                {state === 'loading' && (
                    <div className="wiki-skeleton" aria-busy="true"><span /><span /><span /></div>
                )}
                {state === 'error' && (
                    <div className="wiki-ai__error">
                        <p>{t('wiki.ai.error')}</p>
                        <Button variant="secondary" size="sm" onClick={() => void run()}>{t('wiki.common.retry')}</Button>
                    </div>
                )}
                {state === 'ready' && mode === 'summarize' && (
                    <ul className="wiki-ai__summary">{lines.map((line, index) => <li key={index}>{line}</li>)}</ul>
                )}
                {state === 'ready' && mode === 'improve' && (
                    <div className="wiki-ai__compare">
                        <div><h4>{t('wiki.ai.original')}</h4><p>{sourceText}</p></div>
                        <div className="is-new"><h4>{t('wiki.ai.suggestion')}</h4><p>{result}</p></div>
                    </div>
                )}
                {state === 'ready' && mode === 'tasks' && (
                    tasks.length ? (
                        <>
                            <label className="wiki-ai__project">
                                <span>{t('wiki.ai.targetProject')}</span>
                                <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                                    {(data.lookups?.projects || []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                                </select>
                            </label>
                            <ul className="wiki-ai__tasks">
                                {tasks.map((task, index) => (
                                    <li key={index}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={task.selected}
                                                onChange={() => setTasks((current) => current.map((entry, i) => (i === index ? { ...entry, selected: !entry.selected } : entry)))}
                                            />
                                            <span className="wiki-ai__task-title">{task.title}</span>
                                            {task.priority && task.priority !== 'Medium' && <span className="wiki-ai__task-prio">{task.priority}</span>}
                                        </label>
                                        {task.description && <p>{task.description}</p>}
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : <p className="wiki-rail__empty">{t('wiki.ai.noTasks')}</p>
                )}
            </div>
        </Modal>
    );
};

// ---- Templates ------------------------------------------------------------------------------

export const WikiTemplatePicker: React.FC<{
    open: boolean;
    onClose: () => void;
    templates: WikiTemplate[];
    canManage: boolean;
    onPick: (template: WikiTemplate | null) => void;
    onDelete: (template: WikiTemplate) => void;
}> = ({ open, onClose, templates, canManage, onPick, onDelete }) => {
    const t = useWikiT();
    const builtIn = templates.filter((template) => template.builtIn);
    const custom = templates.filter((template) => !template.builtIn);
    const card = (template: WikiTemplate) => (
        <div key={template.id} className="wiki-template">
            <button type="button" className="wiki-template__main" onClick={() => onPick(template)}>
                <span className="wiki-template__icon">{template.icon}</span>
                <span className="wiki-template__name">{template.name}</span>
                <span className="wiki-template__desc">{template.description}</span>
            </button>
            {!template.builtIn && canManage && (
                <button type="button" className="wiki-icon-btn is-small wiki-template__delete" aria-label={t('wiki.template.delete')} title={t('wiki.template.delete')} onClick={() => onDelete(template)}>
                    <span className="material-symbols-outlined">delete</span>
                </button>
            )}
        </div>
    );
    return (
        <Modal isOpen={open} onClose={onClose} title={t('wiki.template.title')} size="lg">
            <div className="wiki-templates">
                <div className="wiki-templates__grid">
                    <div className="wiki-template">
                        <button type="button" className="wiki-template__main" onClick={() => onPick(null)}>
                            <span className="wiki-template__icon material-symbols-outlined">note_add</span>
                            <span className="wiki-template__name">{t('wiki.template.blank')}</span>
                            <span className="wiki-template__desc">{t('wiki.template.blank.desc')}</span>
                        </button>
                    </div>
                    {builtIn.map(card)}
                </div>
                <h3 className="wiki-rail__label">{t('wiki.template.custom')}</h3>
                {custom.length ? <div className="wiki-templates__grid">{custom.map(card)}</div> : <p className="wiki-rail__empty">{t('wiki.template.customEmpty')}</p>}
            </div>
        </Modal>
    );
};
