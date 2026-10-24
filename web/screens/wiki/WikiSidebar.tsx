import React from 'react';
import { Link } from 'react-router-dom';
import { useFlipList } from '../../components/motion';
import type { WikiDocMeta, WikiPrefs } from '../../types/wiki';
import {
    ancestorsOf,
    buildTree,
    computeDrop,
    flattenTree,
    orderBetween,
    searchDocs,
    searchSnippet,
    sortByOrder,
    type WikiDropPosition,
} from '../../services/wiki/wikiContent';
import { WikiMenu } from './WikiMenu';
import type { WikiT } from './editor/host';

interface WikiSidebarProps {
    t: WikiT;
    title: string;
    docs: WikiDocMeta[];
    activeId: string | null;
    basePath: string;
    prefs: WikiPrefs;
    trashCount: number;
    isTrashView: boolean;
    onCreate: (parentId: string | null) => void;
    onOpenTemplates: (parentId: string | null) => void;
    onArchive: (doc: WikiDocMeta) => void;
    onToggleFavorite: (doc: WikiDocMeta) => void;
    onMove: (docId: string, parentId: string | null, order: number) => void;
    onNavigate: (doc: WikiDocMeta) => void;
    /** Rendered inside the app sidebar's context layer (SidebarPanelContext): no own card or header. */
    embedded?: boolean;
}

const collapsedKey = (basePath: string) => `projectflow.wiki.collapsed.${basePath}`;

const readCollapsed = (basePath: string): Set<string> => {
    try {
        return new Set(JSON.parse(window.localStorage.getItem(collapsedKey(basePath)) || '[]'));
    } catch {
        return new Set();
    }
};

export const DocGlyph: React.FC<{ doc: Pick<WikiDocMeta, 'icon'>; className?: string }> = ({ doc, className = '' }) => (
    doc.icon
        ? <span className={`wiki-glyph is-emoji ${className}`} aria-hidden>{doc.icon}</span>
        : <span className={`wiki-glyph material-symbols-outlined ${className}`} aria-hidden>description</span>
);

export const WikiSidebar: React.FC<WikiSidebarProps> = ({
    t, title, docs, activeId, basePath, prefs, trashCount, isTrashView,
    onCreate, onOpenTemplates, onArchive, onToggleFavorite, onMove, onNavigate, embedded = false,
}) => {
    const [collapsed, setCollapsed] = React.useState<Set<string>>(() => readCollapsed(basePath));
    const [queryText, setQueryText] = React.useState('');
    const [dragId, setDragId] = React.useState<string | null>(null);
    const [dropHint, setDropHint] = React.useState<{ id: string; position: WikiDropPosition } | null>(null);
    const listRef = React.useRef<HTMLDivElement>(null);
    useFlipList(listRef, { disabled: Boolean(queryText) });

    React.useEffect(() => setCollapsed(readCollapsed(basePath)), [basePath]);

    // Keep the active page visible: expand its ancestors.
    React.useEffect(() => {
        if (!activeId) return;
        const chain = ancestorsOf(docs, activeId).map((doc) => doc.id);
        if (!chain.some((id) => collapsed.has(id))) return;
        setCollapsed((current) => {
            const next = new Set(current);
            chain.forEach((id) => next.delete(id));
            return next;
        });
    }, [activeId, collapsed, docs]);

    const toggle = (id: string) => setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id); else next.add(id);
        try { window.localStorage.setItem(collapsedKey(basePath), JSON.stringify([...next])); } catch { /* storage unavailable */ }
        return next;
    });

    const tree = React.useMemo(() => buildTree(docs), [docs]);
    const rows = React.useMemo(() => flattenTree(tree, collapsed), [collapsed, tree]);
    const childCount = React.useMemo(() => {
        const counts = new Map<string, number>();
        docs.forEach((doc) => { if (doc.parentId && !doc.archivedAt) counts.set(doc.parentId, (counts.get(doc.parentId) || 0) + 1); });
        return counts;
    }, [docs]);
    const live = React.useMemo(() => docs.filter((doc) => !doc.archivedAt), [docs]);
    const favorites = React.useMemo(
        () => prefs.favorites.map((id) => live.find((doc) => doc.id === id)).filter((doc): doc is WikiDocMeta => Boolean(doc)),
        [live, prefs.favorites],
    );
    const results = React.useMemo(() => (queryText.trim() ? searchDocs(docs, queryText) : []), [docs, queryText]);

    const onDragOver = (event: React.DragEvent, doc: WikiDocMeta) => {
        if (!dragId || dragId === doc.id) return;
        event.preventDefault();
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const y = (event.clientY - rect.top) / rect.height;
        const position: WikiDropPosition = y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
        if (dropHint?.id !== doc.id || dropHint.position !== position) setDropHint({ id: doc.id, position });
    };

    const onDrop = (event: React.DragEvent, doc: WikiDocMeta) => {
        event.preventDefault();
        const id = dragId;
        const position = dropHint?.position || 'after';
        setDragId(null);
        setDropHint(null);
        if (!id) return;
        const target = computeDrop(docs, id, doc.id, position);
        if (!target) return;
        if (position === 'inside' && collapsed.has(doc.id)) toggle(doc.id);
        onMove(id, target.parentId, target.order);
    };

    const onDropRoot = (event: React.DragEvent) => {
        event.preventDefault();
        const id = dragId;
        setDragId(null);
        setDropHint(null);
        if (!id) return;
        const roots = live.filter((doc) => !doc.parentId && doc.id !== id).sort(sortByOrder);
        onMove(id, null, orderBetween(roots[roots.length - 1]?.order, null));
    };

    const renderRow = (doc: WikiDocMeta, depth: number, flipKey?: string) => {
        const hasChildren = (childCount.get(doc.id) || 0) > 0;
        const isCollapsed = collapsed.has(doc.id);
        const favorite = prefs.favorites.includes(doc.id);
        const hint = dropHint?.id === doc.id ? dropHint.position : null;
        return (
            <div
                key={flipKey || doc.id}
                data-flip-key={flipKey}
                className={`wiki-tree__row${doc.id === activeId ? ' is-active' : ''}${dragId === doc.id ? ' is-dragging' : ''}${hint ? ` drop-${hint}` : ''}`}
                style={{ '--wiki-depth': depth } as React.CSSProperties}
                draggable={!flipKey?.startsWith('fav:')}
                onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', doc.id);
                    setDragId(doc.id);
                }}
                onDragEnd={() => { setDragId(null); setDropHint(null); }}
                onDragOver={(event) => onDragOver(event, doc)}
                onDragLeave={() => { if (dropHint?.id === doc.id) setDropHint(null); }}
                onDrop={(event) => onDrop(event, doc)}
            >
                <button
                    type="button"
                    className={`wiki-tree__toggle${hasChildren ? '' : ' is-leaf'}${isCollapsed ? '' : ' is-open'}`}
                    aria-label={isCollapsed ? t('wiki.nav.expand') : t('wiki.nav.collapse')}
                    tabIndex={hasChildren ? 0 : -1}
                    onClick={() => hasChildren && toggle(doc.id)}
                >
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>
                <Link
                    to={`${basePath}/${doc.id}`}
                    className="wiki-tree__link"
                    onClick={() => onNavigate(doc)}
                    draggable={false}
                >
                    <DocGlyph doc={doc} />
                    <span className="wiki-tree__title">{doc.title || t('wiki.untitled')}</span>
                </Link>
                <div className="wiki-tree__actions">
                    <WikiMenu
                        label={t('wiki.nav.pageActions')}
                        items={[
                            { key: 'fav', icon: favorite ? 'star' : 'star_outline', label: favorite ? t('wiki.action.unfavorite') : t('wiki.action.favorite'), onSelect: () => onToggleFavorite(doc) },
                            { key: 'sub', icon: 'add', label: t('wiki.action.addSubpage'), onSelect: () => onCreate(doc.id) },
                            { key: 'tpl', icon: 'dashboard_customize', label: t('wiki.action.subpageFromTemplate'), onSelect: () => onOpenTemplates(doc.id) },
                            { key: 'trash', icon: 'delete', label: t('wiki.action.moveToTrash'), danger: true, onSelect: () => onArchive(doc) },
                        ]}
                    />
                    <button type="button" className="wiki-icon-btn" aria-label={t('wiki.action.addSubpage')} title={t('wiki.action.addSubpage')} onClick={() => onCreate(doc.id)}>
                        <span className="material-symbols-outlined">add</span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <aside className={`wiki-nav${embedded ? ' wiki-nav--embedded' : ''}`} aria-label={title}>
            {!embedded && <div className="wiki-nav__head">
                <Link to={basePath} className="wiki-nav__title">
                    <span className="material-symbols-outlined">menu_book</span>
                    <span>{title}</span>
                </Link>
                <button type="button" className="wiki-icon-btn" aria-label={t('wiki.action.newPage')} title={t('wiki.action.newPage')} onClick={() => onCreate(null)}>
                    <span className="material-symbols-outlined">edit_square</span>
                </button>
            </div>}

            <label className="wiki-nav__search">
                <span className="material-symbols-outlined">search</span>
                <input
                    value={queryText}
                    placeholder={t('wiki.nav.search')}
                    onChange={(event) => setQueryText(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Escape') setQueryText(''); }}
                />
                {queryText && (
                    <button type="button" className="wiki-icon-btn is-small" aria-label={t('wiki.common.clear')} onClick={() => setQueryText('')}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                )}
            </label>

            <div className="wiki-nav__scroll">
                {queryText.trim() ? (
                    <div className="wiki-nav__results">
                        {!results.length && <p className="wiki-nav__empty">{t('wiki.nav.noResults')}</p>}
                        {results.map((doc) => (
                            <Link key={doc.id} to={`${basePath}/${doc.id}`} className="wiki-result" onClick={() => onNavigate(doc)}>
                                <span className="wiki-result__title"><DocGlyph doc={doc} />{doc.title || t('wiki.untitled')}</span>
                                <span className="wiki-result__snippet">{searchSnippet(doc, queryText)}</span>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <>
                        {favorites.length > 0 && (
                            <section className="wiki-nav__section">
                                <h3 className="wiki-nav__label">{t('wiki.nav.favorites')}</h3>
                                {favorites.map((doc) => renderRow(doc, 0, `fav:${doc.id}`))}
                            </section>
                        )}
                        <section className="wiki-nav__section">
                            <h3
                                className={`wiki-nav__label${dragId ? ' is-drop-root' : ''}`}
                                onDragOver={(event) => { if (dragId) event.preventDefault(); }}
                                onDrop={onDropRoot}
                            >
                                {t('wiki.nav.pages')}
                                {dragId && <span className="wiki-nav__drop-hint">{t('wiki.nav.dropRoot')}</span>}
                            </h3>
                            <div className="wiki-tree" ref={listRef}>
                                {rows.map((node) => renderRow(node.doc, node.depth, node.doc.id))}
                            </div>
                            {!rows.length && (
                                <button type="button" className="wiki-nav__empty-cta" onClick={() => onCreate(null)}>
                                    <span className="material-symbols-outlined">add</span>
                                    {t('wiki.nav.firstPage')}
                                </button>
                            )}
                        </section>
                    </>
                )}
            </div>

            <div className="wiki-nav__foot">
                <button type="button" className="wiki-nav__foot-btn" onClick={() => onOpenTemplates(null)}>
                    <span className="material-symbols-outlined">dashboard_customize</span>
                    {t('wiki.nav.templates')}
                </button>
                <Link to={`${basePath}?view=trash`} className={`wiki-nav__foot-btn${isTrashView ? ' is-active' : ''}`}>
                    <span className="material-symbols-outlined">delete</span>
                    {t('wiki.nav.trash')}
                    {trashCount > 0 && <span className="wiki-nav__count">{trashCount}</span>}
                </Link>
            </div>
        </aside>
    );
};
