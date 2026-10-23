import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { FileAttachments } from '../../components/files/FileAttachments';
import { useMotionOnChange } from '../../components/motion';
import type { WikiDocMeta, WikiEditorPresence, WikiJsonNode, WikiPrefs } from '../../types/wiki';
import {
    WikiConflictError,
    clearWikiEditor,
    createWikiVersion,
    heartbeatWikiEditor,
    loadDocBody,
    maybeCreateAutosaveVersion,
    recordWikiVisit,
    saveWikiDocBody,
    saveWikiTemplate,
    subscribeBacklinks,
    subscribeWikiEditors,
    unlinkTaskFromDoc,
    updateWikiDocMeta,
} from '../../services/wiki/wikiService';
import { ancestorsOf, sortByOrder } from '../../services/wiki/wikiContent';
import { WikiEditor } from './editor/WikiEditor';
import type { WikiEditorHost, WikiMentionItem } from './editor/host';
import { collectHeadings, scrollToPos } from './editor/nodeViews';
import { useWikiData } from './WikiDataContext';
import { WikiMenu } from './WikiMenu';
import { DocGlyph } from './WikiSidebar';
import { createWikiFileProvider } from './wikiFiles';
import { IconPicker, WikiAiDialog, WikiLinkTaskDialog, WikiVersionsDrawer, type WikiAiMode } from './WikiDialogs';
import { useWikiT } from './useWikiT';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

const SAVE_DEBOUNCE_MS = 1500;
const VERSION_CHECK_MS = 10 * 60 * 1000;
const PRESENCE_BEAT_MS = 20_000;
const PRESENCE_FRESH_MS = 90_000;

interface WikiPageProps {
    meta: WikiDocMeta;
    docs: WikiDocMeta[];
    prefs: WikiPrefs;
    basePath: string;
    onArchive: (doc: WikiDocMeta) => void;
    onToggleFavorite: (doc: WikiDocMeta) => void;
    onCreateChild: (parentId: string) => void;
}

const relativeTime = (t: ReturnType<typeof useWikiT>, at: number | null) => {
    if (!at) return '';
    const minutes = Math.round((Date.now() - at) / 60_000);
    if (minutes < 1) return t('wiki.time.now');
    if (minutes < 60) return t('wiki.time.minutes', { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t('wiki.time.hours', { count: hours });
    return new Date(at).toLocaleDateString();
};

export const WikiPage: React.FC<WikiPageProps> = ({ meta, docs, prefs, basePath, onArchive, onToggleFavorite, onCreateChild }) => {
    const t = useWikiT();
    const { language } = useLanguage();
    const { showError, showSuccess } = useToast();
    const navigate = useNavigate();
    const data = useWikiData();
    const { activeWorkspace } = useWorkspace();
    const { tenantId, isGuest, uid, space } = data;

    const [loaded, setLoaded] = React.useState<{ docId: string; json: WikiJsonNode } | null>(null);
    const [title, setTitle] = React.useState(meta.title);
    const [saveState, setSaveState] = React.useState<SaveState>('idle');
    const [conflict, setConflict] = React.useState<WikiDocMeta | null>(null);
    const [editors, setEditors] = React.useState<WikiEditorPresence[]>([]);
    const [backlinks, setBacklinks] = React.useState<WikiDocMeta[]>([]);
    const [headings, setHeadings] = React.useState<{ level: number; text: string; pos: number }[]>([]);
    const [, setTick] = React.useState(0);
    const [versionsOpen, setVersionsOpen] = React.useState(false);
    const [linkOpen, setLinkOpen] = React.useState(false);
    const [ai, setAi] = React.useState<{ mode: WikiAiMode; text: string; range?: { from: number; to: number } } | null>(null);

    const editorRef = React.useRef<Editor | null>(null);
    const baseRevRef = React.useRef(meta.bodyRev);
    const metaRef = React.useRef(meta);
    metaRef.current = meta;
    const titleRef = React.useRef(meta.title);
    const dirtyRef = React.useRef(false);
    const savingRef = React.useRef(false);
    const pendingRef = React.useRef(false);
    const timerRef = React.useRef<number | null>(null);
    const conflictRef = React.useRef<WikiDocMeta | null>(null);
    const lastVersionCheckRef = React.useRef(0);
    const lastBeatRef = React.useRef(0);
    const titleFocusedRef = React.useRef(false);
    const contentRef = React.useRef<HTMLDivElement>(null);
    useMotionOnChange(contentRef, meta.id, 'rise');

    const fileProvider = React.useMemo(
        () => createWikiFileProvider({ tenantId, projectId: meta.projectId, docId: meta.id, title: metaRef.current.title }),
        [meta.id, meta.projectId, tenantId],
    );

    // ---- Load -------------------------------------------------------------------
    React.useEffect(() => {
        let cancelled = false;
        setLoaded(null);
        setConflict(null);
        conflictRef.current = null;
        setSaveState('idle');
        setTitle(metaRef.current.title);
        titleRef.current = metaRef.current.title;
        dirtyRef.current = false;
        loadDocBody(tenantId, meta.id).then(({ json }) => {
            if (cancelled) return;
            baseRevRef.current = metaRef.current.bodyRev;
            setLoaded({ docId: meta.id, json });
        }).catch((error) => {
            console.error('wiki load failed', error);
            if (!cancelled) showError(t('wiki.error.load'));
        });
        void recordWikiVisit(tenantId, meta.id, prefs).catch(() => undefined);
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meta.id, tenantId]);

    // ---- Save -------------------------------------------------------------------
    const save = React.useCallback(async (force = false) => {
        const editor = editorRef.current;
        if (!editor || (conflictRef.current && !force)) return;
        if (savingRef.current) {
            pendingRef.current = true;
            return;
        }
        if (timerRef.current) window.clearTimeout(timerRef.current);
        savingRef.current = true;
        dirtyRef.current = false;
        setSaveState('saving');
        const json = editor.getJSON() as WikiJsonNode;
        const currentTitle = titleRef.current.trim();
        try {
            baseRevRef.current = await saveWikiDocBody(tenantId, metaRef.current.id, {
                title: currentTitle, json, expectedRev: baseRevRef.current, force,
            });
            setSaveState(dirtyRef.current ? 'dirty' : 'saved');
            if (Date.now() - lastVersionCheckRef.current > VERSION_CHECK_MS) {
                lastVersionCheckRef.current = Date.now();
                void maybeCreateAutosaveVersion(tenantId, metaRef.current.id, JSON.stringify(json), currentTitle).catch(() => undefined);
            }
        } catch (error) {
            dirtyRef.current = true;
            if (error instanceof WikiConflictError) {
                conflictRef.current = error.remote;
                setConflict(error.remote);
                setSaveState('conflict');
            } else {
                console.error('wiki save failed', error);
                setSaveState('error');
                timerRef.current = window.setTimeout(() => void save(), 5000);
            }
        } finally {
            savingRef.current = false;
            if (pendingRef.current) {
                pendingRef.current = false;
                void save();
            }
        }
    }, [tenantId]);

    const scheduleSave = React.useCallback(() => {
        dirtyRef.current = true;
        setSaveState((state) => (state === 'conflict' ? state : 'dirty'));
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
        if (Date.now() - lastBeatRef.current > PRESENCE_BEAT_MS) {
            lastBeatRef.current = Date.now();
            void heartbeatWikiEditor(tenantId, metaRef.current.id).catch(() => undefined);
        }
    }, [save, tenantId]);

    // Flush on page switch/unmount; warn before closing the tab with unsaved edits.
    React.useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (dirtyRef.current || savingRef.current) {
                void save();
                event.preventDefault();
            }
        };
        window.addEventListener('beforeunload', beforeUnload);
        const docId = meta.id;
        return () => {
            window.removeEventListener('beforeunload', beforeUnload);
            if (timerRef.current) window.clearTimeout(timerRef.current);
            if (dirtyRef.current && !conflictRef.current) void save();
            if (lastBeatRef.current) void clearWikiEditor(tenantId, docId);
            lastBeatRef.current = 0;
        };
    }, [meta.id, save, tenantId]);

    // Someone else saved and I have nothing pending: pull their version in quietly.
    React.useEffect(() => {
        if (!loaded || meta.bodyRev <= baseRevRef.current || dirtyRef.current || savingRef.current) return;
        let cancelled = false;
        loadDocBody(tenantId, meta.id).then(({ json }) => {
            if (cancelled || dirtyRef.current || savingRef.current) return;
            baseRevRef.current = metaRef.current.bodyRev;
            editorRef.current?.commands.setContent(json as any, { emitUpdate: false });
            setHeadings(editorRef.current ? collectHeadings(editorRef.current) : []);
        }).catch(() => undefined);
        if (!titleFocusedRef.current) {
            setTitle(meta.title);
            titleRef.current = meta.title;
        }
        return () => { cancelled = true; };
    }, [loaded, meta.bodyRev, meta.id, meta.title, tenantId]);

    // ---- Presence & backlinks ---------------------------------------------------------
    React.useEffect(() => subscribeWikiEditors(tenantId, meta.id, setEditors), [meta.id, tenantId]);
    React.useEffect(() => {
        const timer = window.setInterval(() => setTick((value) => value + 1), 20_000);
        return () => window.clearInterval(timer);
    }, []);
    React.useEffect(() => subscribeBacklinks(tenantId, meta, isGuest, setBacklinks),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isGuest, meta.id, tenantId]);
    const others = editors.filter((editor) => editor.uid !== uid && Date.now() - editor.at < PRESENCE_FRESH_MS);

    // ---- Conflict resolution ----------------------------------------------------------
    const resolveConflict = async (keepMine: boolean) => {
        const editor = editorRef.current;
        if (!editor) return;
        try {
            if (keepMine) {
                // Their version goes into the history first, then mine wins.
                const theirs = await loadDocBody(tenantId, meta.id);
                await createWikiVersion(tenantId, meta.id, { raw: theirs.raw, title: metaRef.current.title, reason: 'conflict' });
                conflictRef.current = null;
                setConflict(null);
                await save(true);
            } else {
                await createWikiVersion(tenantId, meta.id, { raw: JSON.stringify(editor.getJSON()), title: titleRef.current, reason: 'conflict' });
                const theirs = await loadDocBody(tenantId, meta.id);
                conflictRef.current = null;
                setConflict(null);
                dirtyRef.current = false;
                baseRevRef.current = metaRef.current.bodyRev;
                editor.commands.setContent(theirs.json as any, { emitUpdate: false });
                setTitle(metaRef.current.title);
                titleRef.current = metaRef.current.title;
                setSaveState('saved');
            }
        } catch (error) {
            console.error('wiki conflict resolution failed', error);
            showError(t('wiki.error.save'));
        }
    };

    // ---- Editor host ------------------------------------------------------------------
    const searchMentions = React.useCallback(async (query: string): Promise<WikiMentionItem[]> => {
        const lookups = await data.ensureLookups();
        const q = query.toLowerCase().trim();
        const match = (value: string | undefined) => !q || (value || '').toLowerCase().includes(q);
        const pages = [...new Map([...data.spaceDocs, ...lookups.docs].map((doc) => [doc.id, doc])).values()]
            .filter((doc) => !doc.archivedAt && doc.id !== meta.id && match(doc.title))
            .slice(0, 5)
            .map<WikiMentionItem>((doc) => ({ key: `doc:${doc.id}`, kind: 'doc', id: doc.id, label: doc.title || t('wiki.untitled'), title: doc.title || t('wiki.untitled'), icon: 'description', group: t('wiki.mention.pages') }));
        const people = lookups.members.filter((member) => match(member.displayName) || match(member.email)).slice(0, 4)
            .map<WikiMentionItem>((member) => ({ key: `user:${member.uid}`, kind: 'user', id: member.uid, label: member.displayName || member.email, title: member.displayName || member.email, subtitle: member.email, icon: 'person', group: t('wiki.mention.people') }));
        const tasks = lookups.tasks
            .filter((task) => match(task.title))
            .sort((a, b) => Number(b.projectId === meta.projectId) - Number(a.projectId === meta.projectId))
            .slice(0, 5)
            .map<WikiMentionItem>((task) => ({
                key: `task:${task.id}`, kind: 'task', id: task.id, projectId: task.projectId, label: task.title, title: task.title,
                subtitle: lookups.projects.find((project) => project.id === task.projectId)?.title, icon: 'task_alt', group: t('wiki.mention.tasks'),
            }));
        const projects = lookups.projects.filter((project) => match(project.title)).slice(0, 3)
            .map<WikiMentionItem>((project) => ({ key: `project:${project.id}`, kind: 'project', id: project.id, label: project.title, title: project.title, icon: 'layers', group: t('wiki.mention.projects') }));
        return [...people, ...pages, ...tasks, ...projects];
    }, [data, meta.id, meta.projectId, t]);

    const host = React.useMemo<WikiEditorHost>(() => ({
        t,
        pickImage: async () => {
            try {
                return await fileProvider.pick({ accept: 'image/*' });
            } catch (error) {
                console.error('wiki image upload failed', error);
                showError(t('wiki.file.error'));
                return null;
            }
        },
        pickFile: () => fileProvider.pick({}),
        searchMentions,
        defaultProjectId: space.type === 'project' ? space.projectId : null,
    }), [fileProvider, searchMentions, showError, space.projectId, space.type, t]);

    // ---- Derived --------------------------------------------------------------------------
    const ancestors = ancestorsOf(docs, meta.id);
    const children = docs.filter((doc) => doc.parentId === meta.id && !doc.archivedAt).sort(sortByOrder);
    const favorite = prefs.favorites.includes(meta.id);
    const lookups = data.lookups;
    const linkedTasks = meta.taskRefs.map((ref) => {
        const [projectId, taskId] = ref.split('/');
        const task = lookups?.tasks.find((entry) => entry.id === taskId);
        return { ref, projectId, taskId, task, explicit: meta.linkedTaskRefs.includes(ref) };
    });

    const saveLabel = {
        idle: '',
        dirty: t('wiki.save.dirty'),
        saving: t('wiki.save.saving'),
        saved: t('wiki.save.saved'),
        error: t('wiki.save.error'),
        conflict: t('wiki.save.conflict'),
    }[saveState];

    const openAi = (mode: WikiAiMode) => {
        const editor = editorRef.current;
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        if (mode === 'improve') {
            if (empty) {
                showError(t('wiki.ai.selectFirst'));
                return;
            }
            setAi({ mode, text: editor.state.doc.textBetween(from, to, '\n'), range: { from, to } });
            return;
        }
        setAi({ mode, text: editor.getText({ blockSeparator: '\n' }) });
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${basePath}/${meta.id}`);
            showSuccess(t('wiki.toast.linkCopied'));
        } catch {
            showError(t('wiki.error.generic'));
        }
    };

    const saveAsTemplate = async () => {
        const editor = editorRef.current;
        if (!editor) return;
        try {
            await saveWikiTemplate(tenantId, {
                name: titleRef.current.trim() || t('wiki.untitled'),
                description: meta.excerpt.slice(0, 120),
                icon: meta.icon || '📄',
                data: JSON.stringify(editor.getJSON()),
            });
            showSuccess(t('wiki.toast.templateSaved'));
        } catch (error) {
            console.error('wiki template save failed', error);
            showError(t('wiki.error.generic'));
        }
    };

    return (
        <div className="wiki-page" ref={contentRef}>
            <div className="wiki-page__bar">
                <nav className="wiki-crumbs" aria-label={t('wiki.nav.breadcrumbs')}>
                    <Link to={basePath} className="wiki-crumbs__item">{space.type === 'project' ? t('wiki.space.project') : t('wiki.space.workspace')}</Link>
                    {ancestors.map((doc) => (
                        <React.Fragment key={doc.id}>
                            <span className="wiki-crumbs__sep material-symbols-outlined">chevron_right</span>
                            <Link to={`${basePath}/${doc.id}`} className="wiki-crumbs__item"><DocGlyph doc={doc} />{doc.title || t('wiki.untitled')}</Link>
                        </React.Fragment>
                    ))}
                </nav>
                <div className="wiki-page__status">
                    {others.length > 0 && (
                        <div className="wiki-presence" title={others.map((editor) => editor.name).join(', ')}>
                            <div className="wiki-presence__avatars">
                                {others.slice(0, 3).map((editor) => (
                                    editor.photoURL
                                        ? <img key={editor.uid} src={editor.photoURL} alt="" />
                                        : <span key={editor.uid}>{(editor.name || '?').slice(0, 1).toUpperCase()}</span>
                                ))}
                            </div>
                            <span>{others.length === 1 ? t('wiki.presence.one', { name: others[0].name }) : t('wiki.presence.many', { count: others.length })}</span>
                        </div>
                    )}
                    {saveLabel && <span className={`wiki-save is-${saveState}`} aria-live="polite">{saveLabel}</span>}
                    <button
                        type="button"
                        className={`wiki-icon-btn${favorite ? ' is-on' : ''}`}
                        aria-pressed={favorite}
                        aria-label={favorite ? t('wiki.action.unfavorite') : t('wiki.action.favorite')}
                        title={favorite ? t('wiki.action.unfavorite') : t('wiki.action.favorite')}
                        onClick={() => onToggleFavorite(meta)}
                    >
                        <span className="material-symbols-outlined">{favorite ? 'star' : 'star_outline'}</span>
                    </button>
                    <WikiMenu
                        icon="auto_awesome"
                        label={t('wiki.ai.menu')}
                        text={t('wiki.ai.short')}
                        items={[
                            { key: 'sum', icon: 'summarize', label: t('wiki.ai.summarize'), onSelect: () => openAi('summarize') },
                            { key: 'tasks', icon: 'add_task', label: t('wiki.ai.tasks'), onSelect: () => openAi('tasks') },
                            { key: 'improve', icon: 'spellcheck', label: t('wiki.ai.improve'), hint: t('wiki.ai.improveHint'), onSelect: () => openAi('improve') },
                        ]}
                    />
                    <WikiMenu
                        label={t('wiki.nav.pageActions')}
                        items={[
                            { key: 'versions', icon: 'history', label: t('wiki.action.versions'), onSelect: () => setVersionsOpen(true) },
                            { key: 'link', icon: 'add_link', label: t('wiki.action.linkTask'), onSelect: () => setLinkOpen(true) },
                            { key: 'sub', icon: 'note_add', label: t('wiki.action.addSubpage'), onSelect: () => onCreateChild(meta.id) },
                            { key: 'copy', icon: 'link', label: t('wiki.action.copyLink'), onSelect: () => void copyLink() },
                            { key: 'tpl', icon: 'dashboard_customize', label: t('wiki.action.saveTemplate'), hidden: isGuest, onSelect: () => void saveAsTemplate() },
                            { key: 'trash', icon: 'delete', label: t('wiki.action.moveToTrash'), danger: true, onSelect: () => onArchive(meta) },
                        ]}
                    />
                </div>
            </div>

            {conflict && (
                <div className="wiki-conflict" role="alert">
                    <span className="material-symbols-outlined">sync_problem</span>
                    <p>{t('wiki.conflict.message', { name: conflict.updatedByName || t('wiki.someone') })}</p>
                    <button type="button" className="wiki-chip-btn" onClick={() => void resolveConflict(false)}>{t('wiki.conflict.reload')}</button>
                    <button type="button" className="wiki-chip-btn is-primary" onClick={() => void resolveConflict(true)}>{t('wiki.conflict.keepMine')}</button>
                </div>
            )}

            <div className="wiki-page__layout">
                <article className="wiki-doc">
                    <header className="wiki-doc__head">
                        <IconPicker
                            t={t}
                            value={meta.icon}
                            onChange={(icon) => void updateWikiDocMeta(tenantId, meta.id, { icon }).catch(() => showError(t('wiki.error.generic')))}
                        />
                        <textarea
                            className="wiki-doc__title"
                            rows={1}
                            value={title}
                            placeholder={t('wiki.untitled')}
                            aria-label={t('wiki.titleLabel')}
                            onFocus={() => { titleFocusedRef.current = true; }}
                            onBlur={() => { titleFocusedRef.current = false; }}
                            onChange={(event) => {
                                const value = event.target.value.replace(/\n/g, ' ');
                                setTitle(value);
                                titleRef.current = value;
                                scheduleSave();
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    // commands.focus() waits a frame; focus synchronously so fast typing lands in the body.
                                    const editor = editorRef.current;
                                    if (editor) {
                                        editor.view.focus();
                                        editor.commands.setTextSelection(1);
                                    }
                                }
                            }}
                            ref={(element) => {
                                if (!element) return;
                                element.style.height = 'auto';
                                element.style.height = `${element.scrollHeight}px`;
                            }}
                        />
                        <p className="wiki-doc__meta">
                            {meta.updatedAt && t('wiki.meta.updated', { name: meta.updatedByName || t('wiki.someone'), time: relativeTime(t, meta.updatedAt) })}
                        </p>
                    </header>

                    {loaded?.docId === meta.id ? (
                        <WikiEditor
                            key={meta.id}
                            initialJson={loaded.json}
                            editable={!conflict}
                            host={host}
                            onReady={(editor) => {
                                editorRef.current = editor;
                                setHeadings(collectHeadings(editor));
                            }}
                            onChange={(editor) => {
                                scheduleSave();
                                setHeadings(collectHeadings(editor));
                            }}
                            onSaveShortcut={() => {
                                void save();
                                const editor = editorRef.current;
                                if (editor) {
                                    void createWikiVersion(tenantId, meta.id, { raw: JSON.stringify(editor.getJSON()), title: titleRef.current, reason: 'manual' })
                                        .then(() => showSuccess(t('wiki.toast.versionSaved')))
                                        .catch(() => undefined);
                                }
                            }}
                            onImproveSelection={(text) => {
                                const editor = editorRef.current;
                                if (!editor) return;
                                const { from, to } = editor.state.selection;
                                setAi({ mode: 'improve', text, range: { from, to } });
                            }}
                        />
                    ) : (
                        <div className="wiki-skeleton" aria-busy="true">
                            <span /><span /><span />
                        </div>
                    )}

                    <section className="wiki-attachments">
                        <FileAttachments
                            tenantId={tenantId}
                            parent={{ type: 'doc', id: meta.id, projectId: meta.projectId, title: meta.title || t('wiki.untitled') }}
                            role={activeWorkspace?.role || null}
                            title={t('wiki.rail.files')}
                        />
                    </section>

                    <section className="wiki-children">
                        {children.length > 0 && <h2 className="wiki-rail__label">{t('wiki.rail.subpages')}</h2>}
                        {children.map((doc) => (
                            <Link key={doc.id} to={`${basePath}/${doc.id}`} className="wiki-children__item">
                                <DocGlyph doc={doc} />
                                <span>{doc.title || t('wiki.untitled')}</span>
                            </Link>
                        ))}
                        <button type="button" className="wiki-children__add" onClick={() => onCreateChild(meta.id)}>
                            <span className="material-symbols-outlined">add</span>
                            {t('wiki.action.addSubpage')}
                        </button>
                    </section>
                </article>

                <aside className="wiki-rail">
                    {headings.length > 1 && (
                        <section className="wiki-rail__section">
                            <h2 className="wiki-rail__label">{t('wiki.rail.contents')}</h2>
                            {headings.map((heading) => (
                                <button
                                    key={heading.pos}
                                    type="button"
                                    className="wiki-rail__toc"
                                    data-level={heading.level}
                                    onClick={() => editorRef.current && scrollToPos(editorRef.current, heading.pos)}
                                >
                                    {heading.text || t('wiki.toc.untitled')}
                                </button>
                            ))}
                        </section>
                    )}
                    <section className="wiki-rail__section">
                        <div className="wiki-rail__head">
                            <h2 className="wiki-rail__label">{t('wiki.rail.tasks')}</h2>
                            <button type="button" className="wiki-icon-btn is-small" aria-label={t('wiki.action.linkTask')} title={t('wiki.action.linkTask')} onClick={() => setLinkOpen(true)}>
                                <span className="material-symbols-outlined">add</span>
                            </button>
                        </div>
                        {!linkedTasks.length && <p className="wiki-rail__empty">{t('wiki.rail.tasksEmpty')}</p>}
                        {linkedTasks.map(({ ref, projectId, taskId, task, explicit }) => {
                            const done = task?.isCompleted || task?.status === 'Done';
                            return (
                                <div key={ref} className={`wiki-rail__task${done ? ' is-done' : ''}`}>
                                    <button type="button" className="wiki-rail__link" onClick={() => navigate(`/project/${projectId}/tasks/${taskId}`)}>
                                        <span className="material-symbols-outlined">{done ? 'check_circle' : 'radio_button_unchecked'}</span>
                                        <span>{task?.title || t('wiki.rail.taskUnavailable')}</span>
                                    </button>
                                    {explicit ? (
                                        <button
                                            type="button"
                                            className="wiki-icon-btn is-small"
                                            aria-label={t('wiki.action.unlinkTask')}
                                            title={t('wiki.action.unlinkTask')}
                                            onClick={() => void unlinkTaskFromDoc(tenantId, meta, ref).catch(() => showError(t('wiki.error.generic')))}
                                        >
                                            <span className="material-symbols-outlined">link_off</span>
                                        </button>
                                    ) : <span className="wiki-rail__badge" title={t('wiki.rail.mentioned')}>@</span>}
                                </div>
                            );
                        })}
                    </section>
                    <section className="wiki-rail__section">
                        <h2 className="wiki-rail__label">{t('wiki.rail.backlinks')}</h2>
                        {!backlinks.length && <p className="wiki-rail__empty">{t('wiki.rail.backlinksEmpty')}</p>}
                        {backlinks.map((doc) => (
                            <Link key={doc.id} to={data.docHref(doc)} className="wiki-rail__link">
                                <DocGlyph doc={doc} />
                                <span>{doc.title || t('wiki.untitled')}</span>
                            </Link>
                        ))}
                    </section>
                </aside>
            </div>

            <WikiVersionsDrawer
                open={versionsOpen}
                onClose={() => setVersionsOpen(false)}
                tenantId={tenantId}
                docId={meta.id}
                host={host}
                onRestore={async (json, versionTitle) => {
                    const editor = editorRef.current;
                    if (!editor) return;
                    await createWikiVersion(tenantId, meta.id, { raw: JSON.stringify(editor.getJSON()), title: titleRef.current, reason: 'before-restore' });
                    editor.commands.setContent(json as any, { emitUpdate: false });
                    if (versionTitle) {
                        setTitle(versionTitle);
                        titleRef.current = versionTitle;
                    }
                    conflictRef.current = null;
                    setConflict(null);
                    await save(true);
                    await createWikiVersion(tenantId, meta.id, { raw: JSON.stringify(json), title: titleRef.current, reason: 'restore' });
                    setHeadings(collectHeadings(editor));
                    setVersionsOpen(false);
                    showSuccess(t('wiki.toast.restored'));
                }}
            />
            <WikiLinkTaskDialog open={linkOpen} onClose={() => setLinkOpen(false)} meta={meta} />
            {ai && (
                <WikiAiDialog
                    mode={ai.mode}
                    sourceText={ai.text}
                    title={titleRef.current}
                    language={language}
                    meta={meta}
                    onClose={() => setAi(null)}
                    onInsertSummary={(lines) => {
                        editorRef.current?.chain().focus().insertContentAt(0, {
                            type: 'wikiCallout',
                            attrs: { tone: 'info' },
                            content: [
                                { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: t('wiki.ai.summaryHeading') }] },
                                { type: 'bulletList', content: lines.map((line) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: line }] }] })) },
                            ],
                        }).run();
                    }}
                    onReplaceText={(value) => {
                        const editor = editorRef.current;
                        if (!editor || !ai.range) return;
                        const paragraphs = value.split(/\n+/).filter(Boolean).map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }));
                        editor.chain().focus().insertContentAt(ai.range, paragraphs.length === 1 ? paragraphs[0].content : paragraphs).run();
                    }}
                />
            )}
        </div>
    );
};
