import React from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { auth } from '../../services/firebase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useSidebarPanel } from '../../context/SidebarPanelContext';
import { useConfirm, useToast } from '../../context/UIContext';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { Button } from '../../components/ui/Button';
import type { WikiDocMeta, WikiPrefs, WikiSpace, WikiTemplate } from '../../types/wiki';
import {
    archiveWikiDoc,
    createWikiDoc,
    deleteWikiDocPermanently,
    deleteWikiTemplate,
    moveWikiDoc,
    restoreWikiDoc,
    setWikiFavorite,
    subscribeWikiDocs,
    subscribeWikiPrefs,
    subscribeWikiTemplates,
} from '../../services/wiki/wikiService';
import { orderBetween, parseDocJson, sortByOrder } from '../../services/wiki/wikiContent';
import { WikiDataProvider } from './WikiDataContext';
import { DocGlyph, WikiSidebar } from './WikiSidebar';
import { WikiPage } from './WikiPage';
import { WikiTemplatePicker } from './WikiDialogs';
import { builtInTemplates } from './wikiTemplates';
import { useWikiT } from './useWikiT';
import './wiki.scss';

const EMPTY_PREFS: WikiPrefs = { favorites: [], recent: [] };

const formatWhen = (at: number | null) => (at ? new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

export const WikiScreen: React.FC = () => {
    const t = useWikiT();
    const { id: projectId, docId } = useParams<{ id?: string; docId?: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { showError, showSuccess } = useToast();
    const { activeWorkspaceId, activeWorkspace } = useWorkspace();
    const tenantId = activeWorkspaceId || '';
    const uid = auth.currentUser?.uid || '';
    const role = activeWorkspace?.role;
    const isGuest = role === 'Guest';
    const isAdmin = role === 'Owner' || role === 'Admin';

    const space = React.useMemo<WikiSpace>(
        () => (projectId ? { type: 'project', projectId } : { type: 'workspace', projectId: null }),
        [projectId],
    );
    const basePath = projectId ? `/project/${projectId}/wiki` : '/wiki';
    const view = new URLSearchParams(location.search).get('view');

    const [docs, setDocs] = React.useState<WikiDocMeta[] | null>(null);
    const [denied, setDenied] = React.useState(false);
    const [prefs, setPrefs] = React.useState<WikiPrefs>(EMPTY_PREFS);
    const [customTemplates, setCustomTemplates] = React.useState<WikiTemplate[]>([]);
    const [templateParent, setTemplateParent] = React.useState<string | null | undefined>(undefined);

    const blocked = !projectId && isGuest;

    React.useEffect(() => {
        if (!tenantId || blocked) return undefined;
        setDocs(null);
        setDenied(false);
        return subscribeWikiDocs(tenantId, space, setDocs, (error) => {
            console.error('wiki subscription failed', error);
            setDenied(true);
            setDocs([]);
        });
    }, [blocked, space, tenantId]);

    React.useEffect(() => {
        if (!tenantId || !uid) return undefined;
        return subscribeWikiPrefs(tenantId, uid, setPrefs);
    }, [tenantId, uid]);

    React.useEffect(() => {
        if (!tenantId || isGuest) return undefined;
        return subscribeWikiTemplates(tenantId, setCustomTemplates);
    }, [isGuest, tenantId]);

    const templates = React.useMemo(() => [...builtInTemplates(t), ...customTemplates], [customTemplates, t]);
    const allDocs = docs || [];
    const liveDocs = React.useMemo(() => allDocs.filter((doc) => !doc.archivedAt), [allDocs]);
    const trash = React.useMemo(() => {
        const archivedIds = new Set(allDocs.filter((doc) => doc.archivedAt).map((doc) => doc.id));
        return allDocs
            .filter((doc) => doc.archivedAt && !(doc.parentId && archivedIds.has(doc.parentId)))
            .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
    }, [allDocs]);
    const active = docId ? allDocs.find((doc) => doc.id === docId) || null : null;

    const createPage = React.useCallback(async (parentId: string | null, template?: WikiTemplate | null) => {
        if (!tenantId) return;
        const siblings = liveDocs.filter((doc) => (doc.parentId || null) === parentId).sort(sortByOrder);
        try {
            const id = await createWikiDoc(tenantId, {
                space,
                title: template && !template.builtIn ? template.name : '',
                parentId,
                order: orderBetween(siblings[siblings.length - 1]?.order, null),
                icon: template?.icon && template.id !== 'blank' ? template.icon : null,
                content: template ? parseDocJson(template.data) : undefined,
            });
            navigate(`${basePath}/${id}`, { state: { created: true } });
        } catch (error) {
            console.error('wiki create failed', error);
            showError(t('wiki.error.generic'));
        }
    }, [basePath, liveDocs, navigate, showError, space, t, tenantId]);

    const archive = React.useCallback(async (doc: WikiDocMeta) => {
        const hasChildren = liveDocs.some((entry) => entry.parentId === doc.id);
        if (hasChildren) {
            const ok = await confirm({
                title: t('wiki.trash.confirmTitle'),
                message: t('wiki.trash.confirmChildren'),
                confirmText: t('wiki.action.moveToTrash'),
                variant: 'danger',
            });
            if (!ok) return;
        }
        try {
            const ids = await archiveWikiDoc(tenantId, allDocs, doc.id);
            showSuccess(t('wiki.toast.archived'));
            if (docId && ids.includes(docId)) navigate(doc.parentId ? `${basePath}/${doc.parentId}` : basePath);
        } catch (error) {
            console.error('wiki archive failed', error);
            showError(t('wiki.error.generic'));
        }
    }, [allDocs, basePath, confirm, docId, liveDocs, navigate, showError, showSuccess, t, tenantId]);

    const toggleFavorite = React.useCallback((doc: WikiDocMeta) => {
        void setWikiFavorite(tenantId, doc.id, !prefs.favorites.includes(doc.id)).catch(() => showError(t('wiki.error.generic')));
    }, [prefs.favorites, showError, t, tenantId]);

    const move = React.useCallback((id: string, parentId: string | null, order: number) => {
        setDocs((current) => current?.map((doc) => (doc.id === id ? { ...doc, parentId, order } : doc)) || current);
        void moveWikiDoc(tenantId, id, parentId, order).catch(() => showError(t('wiki.error.generic')));
    }, [showError, t, tenantId]);

    // Workspace wiki: the page tree lives in the app sidebar's context layer, like a project's modules.
    // Project wikis keep it in the page (the sidebar already shows the project there).
    const sidebarSlot = useSidebarPanel(!projectId && !blocked ? {
        key: 'wiki',
        title: t('wiki.space.workspace'),
        icon: 'menu_book',
        href: '/wiki',
        actions: [{ icon: 'edit_square', label: t('wiki.action.newPage'), onSelect: () => void createPage(null) }],
    } : null);

    if (!tenantId) return null;

    if (blocked) {
        return (
            <div className="wiki wiki--blocked">
                <EmptyState icon={<span className="material-symbols-outlined">lock</span>} title={t('wiki.guest.title')} message={t('wiki.guest.message')} />
            </div>
        );
    }

    const spaceTitle = projectId ? t('wiki.space.project') : t('wiki.space.workspace');

    const recentlyEdited = [...liveDocs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 6);
    const recentlyViewed = prefs.recent
        .map((entry) => liveDocs.find((doc) => doc.id === entry.docId))
        .filter((doc): doc is WikiDocMeta => Boolean(doc))
        .slice(0, 5);

    const renderMain = () => {
        if (denied) {
            return <EmptyState icon={<span className="material-symbols-outlined">lock</span>} title={t('wiki.denied.title')} message={t('wiki.denied.message')} />;
        }
        if (!docs) {
            return <div className="wiki-skeleton wiki-skeleton--page" aria-busy="true"><span /><span /><span /><span /></div>;
        }
        if (view === 'trash') {
            return (
                <div className="wiki-home">
                    <header className="wiki-home__head">
                        <h1>{t('wiki.nav.trash')}</h1>
                        <p>{t('wiki.trash.hint')}</p>
                    </header>
                    {!trash.length && <p className="wiki-rail__empty">{t('wiki.trash.empty')}</p>}
                    <div className="wiki-list">
                        {trash.map((doc) => {
                            const canDelete = isAdmin || doc.createdBy === uid;
                            return (
                                <div key={doc.id} className="wiki-list__row">
                                    <DocGlyph doc={doc} />
                                    <div className="wiki-list__text">
                                        <span className="wiki-list__title">{doc.title || t('wiki.untitled')}</span>
                                        <span className="wiki-list__meta">{t('wiki.trash.archivedAt', { date: formatWhen(doc.archivedAt) })}</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="wiki-chip-btn"
                                        onClick={() => void restoreWikiDoc(tenantId, allDocs, doc.id)
                                            .then(() => showSuccess(t('wiki.toast.restoredPage')))
                                            .catch(() => showError(t('wiki.error.generic')))}
                                    >
                                        {t('wiki.trash.restore')}
                                    </button>
                                    <button
                                        type="button"
                                        className="wiki-icon-btn"
                                        disabled={!canDelete}
                                        aria-label={t('wiki.trash.deleteForever')}
                                        title={canDelete ? t('wiki.trash.deleteForever') : t('wiki.trash.deleteNotAllowed')}
                                        onClick={async () => {
                                            const ok = await confirm({
                                                title: t('wiki.trash.deleteForever'),
                                                message: t('wiki.trash.deleteConfirm', { title: doc.title || t('wiki.untitled') }),
                                                confirmText: t('wiki.trash.deleteForever'),
                                                variant: 'danger',
                                            });
                                            if (!ok) return;
                                            try {
                                                await deleteWikiDocPermanently(tenantId, allDocs, doc.id);
                                                showSuccess(t('wiki.toast.deleted'));
                                            } catch (error) {
                                                console.error('wiki delete failed', error);
                                                showError(t('wiki.error.generic'));
                                            }
                                        }}
                                    >
                                        <span className="material-symbols-outlined">delete_forever</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        if (docId) {
            if (!active) {
                return <EmptyState icon={<span className="material-symbols-outlined">search_off</span>} title={t('wiki.missing.title')} message={t('wiki.missing.message')} actions={<Button onClick={() => navigate(basePath)}>{t('wiki.missing.back')}</Button>} />;
            }
            if (active.archivedAt) {
                return (
                    <EmptyState
                        icon={<span className="material-symbols-outlined">delete</span>}
                        title={t('wiki.archived.title')}
                        message={t('wiki.archived.message')}
                        actions={<Button onClick={() => void restoreWikiDoc(tenantId, allDocs, active.id).catch(() => showError(t('wiki.error.generic')))}>{t('wiki.trash.restore')}</Button>}
                    />
                );
            }
            return (
                <WikiPage
                    meta={active}
                    docs={allDocs}
                    prefs={prefs}
                    basePath={basePath}
                    onArchive={archive}
                    onToggleFavorite={toggleFavorite}
                    onCreateChild={(parentId) => void createPage(parentId)}
                />
            );
        }
        return (
            <div className="wiki-home">
                <header className="wiki-home__head">
                    <span className="wiki-home__eyebrow material-symbols-outlined">menu_book</span>
                    <h1>{spaceTitle}</h1>
                    <p>{projectId ? t('wiki.home.projectLead') : t('wiki.home.workspaceLead')}</p>
                    <div className="wiki-home__actions">
                        <Button icon={<span className="material-symbols-outlined">edit_square</span>} onClick={() => void createPage(null)}>{t('wiki.action.newPage')}</Button>
                        <Button variant="secondary" icon={<span className="material-symbols-outlined">dashboard_customize</span>} onClick={() => setTemplateParent(null)}>{t('wiki.action.fromTemplate')}</Button>
                    </div>
                </header>

                <section className="wiki-home__section">
                    <h2 className="wiki-rail__label">{t('wiki.home.startWith')}</h2>
                    <div className="wiki-home__templates">
                        {templates.filter((template) => template.builtIn).map((template) => (
                            <button key={template.id} type="button" className="wiki-home__template" onClick={() => void createPage(null, template)}>
                                <span className="wiki-template__icon">{template.icon}</span>
                                <span className="wiki-template__name">{template.name}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {recentlyViewed.length > 0 && (
                    <section className="wiki-home__section">
                        <h2 className="wiki-rail__label">{t('wiki.home.recentViewed')}</h2>
                        <div className="wiki-home__chips">
                            {recentlyViewed.map((doc) => (
                                <Link key={doc.id} to={`${basePath}/${doc.id}`} className="wiki-home__chip"><DocGlyph doc={doc} />{doc.title || t('wiki.untitled')}</Link>
                            ))}
                        </div>
                    </section>
                )}

                <section className="wiki-home__section">
                    <h2 className="wiki-rail__label">{t('wiki.home.recentEdited')}</h2>
                    {!recentlyEdited.length && <p className="wiki-rail__empty">{t('wiki.home.empty')}</p>}
                    <div className="wiki-home__cards motion-stagger">
                        {recentlyEdited.map((doc) => (
                            <Link key={doc.id} to={`${basePath}/${doc.id}`} className="wiki-card">
                                <span className="wiki-card__title"><DocGlyph doc={doc} />{doc.title || t('wiki.untitled')}</span>
                                <span className="wiki-card__excerpt">{doc.excerpt || t('wiki.home.noContent')}</span>
                                <span className="wiki-card__meta">{doc.updatedByName ? `${doc.updatedByName} · ` : ''}{formatWhen(doc.updatedAt)}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        );
    };

    return (
        <WikiDataProvider tenantId={tenantId} space={space} isGuest={isGuest} uid={uid} spaceDocs={allDocs}>
            <div className="wiki-shell">
            <div className={`wiki${sidebarSlot ? ' wiki--nav-in-sidebar' : ''}`}>
                {(() => {
                    const tree = (
                <WikiSidebar
                    embedded={Boolean(sidebarSlot)}
                    t={t}
                    title={spaceTitle}
                    docs={allDocs}
                    activeId={docId || null}
                    basePath={basePath}
                    prefs={prefs}
                    trashCount={trash.length}
                    isTrashView={view === 'trash'}
                    onCreate={(parentId) => void createPage(parentId)}
                    onOpenTemplates={(parentId) => setTemplateParent(parentId)}
                    onArchive={(doc) => void archive(doc)}
                    onToggleFavorite={toggleFavorite}
                    onMove={move}
                    onNavigate={() => undefined}
                />
                    );
                    return sidebarSlot ? createPortal(tree, sidebarSlot) : tree;
                })()}
                <main className="wiki-main">{renderMain()}</main>
            </div>
            </div>
            <WikiTemplatePicker
                open={templateParent !== undefined}
                onClose={() => setTemplateParent(undefined)}
                templates={templates}
                canManage={!isGuest}
                onPick={(template) => {
                    const parentId = templateParent ?? null;
                    setTemplateParent(undefined);
                    void createPage(parentId, template);
                }}
                onDelete={async (template) => {
                    const ok = await confirm({ title: t('wiki.template.delete'), message: t('wiki.template.deleteConfirm', { name: template.name }), variant: 'danger', confirmText: t('wiki.template.delete') });
                    if (ok) await deleteWikiTemplate(tenantId, template.id).catch(() => showError(t('wiki.error.generic')));
                }}
            />
        </WikiDataProvider>
    );
};

export default WikiScreen;
