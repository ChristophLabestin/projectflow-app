import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { AnimatedNumber } from '../components/motion';
import { FilesBrowser } from '../components/files/FilesBrowser';
import { useLanguage } from '../context/LanguageContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { getUserProjects } from '../services/dataService';
import {
    formatBytes,
    getWorkspaceFileQuota,
    subscribeProjectFiles,
    subscribeWorkspaceFiles,
    type FileItem,
    type FileKind,
    type WorkspaceFileQuota,
} from '../services/filesService';
import './files-page.scss';

type ProjectRef = { id: string; title: string; ownerId?: string };

const QuotaMeter = ({ quota }: { quota: WorkspaceFileQuota }) => {
    const { t, language } = useLanguage();
    const ratio = quota.quotaBytes ? Math.min(1, quota.usedBytes / quota.quotaBytes) : 0;
    const percent = Math.round(ratio * 100);
    return (
        <div className="files-quota" data-level={ratio > 0.9 ? 'critical' : ratio > 0.75 ? 'warning' : 'ok'}>
            <div className="files-quota__label">
                <span>{t('files.quota.label')}</span>
                <span className="files-quota__value">
                    {formatBytes(quota.usedBytes, language)} / {formatBytes(quota.quotaBytes, language)}
                    {' · '}<AnimatedNumber value={percent} />%
                </span>
            </div>
            <div className="files-quota__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('files.quota.label')}>
                <span className="files-quota__bar motion-grow-x" style={{ width: `${Math.max(ratio * 100, ratio ? 1 : 0)}%` }} />
            </div>
        </div>
    );
};

/** `/files` (all files the user may see) and `/project/:id/files` (one project). */
export const FilesPage = () => {
    const { t } = useLanguage();
    const { id: projectId } = useParams<{ id?: string }>();
    const [searchParams] = useSearchParams();
    const { activeWorkspaceId, activeWorkspace } = useWorkspace();
    const tenantId = activeWorkspaceId || '';
    const role = activeWorkspace?.role || null;
    const isGuest = role === 'Guest';
    const [projects, setProjects] = useState<ProjectRef[] | null>(null);
    const [files, setFiles] = useState<FileItem[] | null>(null);
    const [quota, setQuota] = useState<WorkspaceFileQuota | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!tenantId) return;
        let cancelled = false;
        void getUserProjects(tenantId)
            .then((list) => { if (!cancelled) setProjects(list.map((project) => ({ id: project.id, title: project.title, ownerId: project.ownerId }))); })
            .catch(() => { if (!cancelled) setProjects([]); });
        return () => { cancelled = true; };
    }, [tenantId]);

    const projectIdsKey = (projects || []).map((project) => project.id).join(',');
    useEffect(() => {
        if (!tenantId || projects === null) return undefined;
        setFiles(null);
        if (projectId) return subscribeProjectFiles(tenantId, projectId, setFiles);
        return subscribeWorkspaceFiles(
            { tenantId, isGuest, projectIds: projectIdsKey ? projectIdsKey.split(',') : [] },
            setFiles,
            () => setError(true),
        );
    }, [tenantId, projectId, isGuest, projectIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // Quota refreshes whenever the number or size of files changes.
    const usageKey = files ? `${files.length}:${files.reduce((sum, file) => sum + file.sizeBytes, 0)}` : '';
    useEffect(() => {
        if (!tenantId || projectId || !usageKey) return;
        void getWorkspaceFileQuota(tenantId).then(setQuota).catch(() => setQuota(null));
    }, [tenantId, projectId, usageKey]);

    const project = projectId ? projects?.find((entry) => entry.id === projectId) : undefined;
    const uploadParent = useMemo(() => {
        if (projectId) return { type: 'project' as const, id: projectId, projectId, title: project?.title || '' };
        return isGuest ? null : { type: 'workspace' as const, id: 'workspace', projectId: null };
    }, [isGuest, project?.title, projectId]);

    const kindParam = searchParams.get('type');
    const initialKind = (kindParam || 'all') as FileKind | 'all';

    return (
        <div className="files-page motion-route-enter">
            <header className="files-page__header">
                <div>
                    <h1 className="files-page__title">{projectId ? t('files.projectTitle') : t('files.title')}</h1>
                    <p className="files-page__subtitle">{projectId ? t('files.projectSubtitle') : t('files.subtitle')}</p>
                </div>
                {quota && !projectId && <QuotaMeter quota={quota} />}
            </header>
            {error && <p className="files-page__error" role="alert">{t('files.error.load')}</p>}
            {tenantId && (
                <FilesBrowser
                    tenantId={tenantId}
                    role={role}
                    files={files || []}
                    loading={files === null}
                    projects={projects || []}
                    scopeProjectId={projectId}
                    uploadParent={uploadParent}
                    initialKind={initialKind}
                    focusFileId={searchParams.get('file')}
                />
            )}
        </div>
    );
};

export default FilesPage;
