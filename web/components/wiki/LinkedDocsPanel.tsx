import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
    createWikiDoc,
    getAccessibleWikiDocs,
    linkTaskToDoc,
    subscribeDocsForTask,
    unlinkTaskFromDoc,
} from '../../services/wiki/wikiService';
import type { WikiDocMeta } from '../../types/wiki';
import './linked-docs-panel.scss';

const docHref = (doc: WikiDocMeta) =>
    doc.spaceType === 'project' && doc.projectId ? `/project/${doc.projectId}/wiki/${doc.id}` : `/wiki/${doc.id}`;

/** Task detail: wiki pages linked to (or mentioning) this task. */
export const LinkedDocsPanel: React.FC<{ projectId: string; taskId: string; taskTitle: string; tenantId?: string }> = ({ projectId, taskId, taskTitle, tenantId }) => {
    const { t } = useLanguage();
    const { showError } = useToast();
    const navigate = useNavigate();
    const { activeWorkspaceId, activeWorkspace } = useWorkspace();
    const resolvedTenant = tenantId || activeWorkspaceId || '';
    const isGuest = activeWorkspace?.role === 'Guest';
    const ref = `${projectId}/${taskId}`;
    const [docs, setDocs] = React.useState<WikiDocMeta[]>([]);
    const [picking, setPicking] = React.useState(false);
    const [candidates, setCandidates] = React.useState<WikiDocMeta[] | null>(null);
    const [query, setQuery] = React.useState('');

    React.useEffect(() => {
        if (!resolvedTenant) return undefined;
        return subscribeDocsForTask(resolvedTenant, projectId, taskId, isGuest, setDocs);
    }, [isGuest, projectId, resolvedTenant, taskId]);

    React.useEffect(() => {
        if (!picking || candidates || !resolvedTenant) return;
        getAccessibleWikiDocs(resolvedTenant, isGuest ? [projectId] : undefined).then(setCandidates).catch(() => setCandidates([]));
    }, [candidates, isGuest, picking, projectId, resolvedTenant]);

    const q = query.toLowerCase().trim();
    const options = (candidates || [])
        .filter((doc) => !docs.some((linked) => linked.id === doc.id))
        .filter((doc) => !q || doc.title.toLowerCase().includes(q))
        .sort((a, b) => Number(b.projectId === projectId) - Number(a.projectId === projectId) || (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 8);

    const createPage = async () => {
        try {
            const id = await createWikiDoc(resolvedTenant, {
                space: { type: 'project', projectId },
                title: taskTitle,
                order: Date.now(),
                linkedTaskRefs: [ref],
            });
            navigate(`/project/${projectId}/wiki/${id}`);
        } catch (error) {
            console.error('linked doc create failed', error);
            showError(t('taskDetail.docs.error'));
        }
    };

    return (
        <div className="linked-docs">
            <div className="linked-docs__head">
                <span className="task-detail__sidebar-label">{t('taskDetail.docs.title')}</span>
                <div className="linked-docs__actions">
                    <button type="button" className="linked-docs__btn" title={t('taskDetail.docs.link')} aria-label={t('taskDetail.docs.link')} onClick={() => setPicking((value) => !value)}>
                        <span className="material-symbols-outlined">add_link</span>
                    </button>
                    <button type="button" className="linked-docs__btn" title={t('taskDetail.docs.new')} aria-label={t('taskDetail.docs.new')} onClick={() => void createPage()}>
                        <span className="material-symbols-outlined">note_add</span>
                    </button>
                </div>
            </div>
            {picking && (
                <div className="linked-docs__picker">
                    <input autoFocus value={query} placeholder={t('taskDetail.docs.search')} onChange={(event) => setQuery(event.target.value)} />
                    {!candidates && <p className="linked-docs__empty">{t('common.loading', '…')}</p>}
                    {candidates && !options.length && <p className="linked-docs__empty">{t('taskDetail.docs.noMatches')}</p>}
                    {options.map((doc) => (
                        <button
                            key={doc.id}
                            type="button"
                            className="linked-docs__option"
                            onClick={async () => {
                                try {
                                    await linkTaskToDoc(resolvedTenant, doc.id, ref);
                                    setPicking(false);
                                    setQuery('');
                                } catch {
                                    showError(t('taskDetail.docs.error'));
                                }
                            }}
                        >
                            <span className="linked-docs__glyph">{doc.icon || <span className="material-symbols-outlined">description</span>}</span>
                            <span className="linked-docs__name">{doc.title || t('taskDetail.docs.untitled')}</span>
                        </button>
                    ))}
                </div>
            )}
            {!docs.length && !picking && <p className="linked-docs__empty">{t('taskDetail.docs.empty')}</p>}
            {docs.map((doc) => (
                <div key={doc.id} className="linked-docs__row">
                    <Link to={docHref(doc)} className="linked-docs__link">
                        <span className="linked-docs__glyph">{doc.icon || <span className="material-symbols-outlined">description</span>}</span>
                        <span className="linked-docs__name">{doc.title || t('taskDetail.docs.untitled')}</span>
                    </Link>
                    {doc.linkedTaskRefs.includes(ref) ? (
                        <button
                            type="button"
                            className="linked-docs__btn"
                            title={t('taskDetail.docs.unlink')}
                            aria-label={t('taskDetail.docs.unlink')}
                            onClick={() => void unlinkTaskFromDoc(resolvedTenant, doc, ref).catch(() => showError(t('taskDetail.docs.error')))}
                        >
                            <span className="material-symbols-outlined">link_off</span>
                        </button>
                    ) : <span className="linked-docs__mention" title={t('taskDetail.docs.mentioned')}>@</span>}
                </div>
            ))}
        </div>
    );
};
