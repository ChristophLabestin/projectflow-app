import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TabIndicator, useFlipList } from '../motion';
import { WorkMenuChip } from '../work/WorkMenuChip';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { useLanguage } from '../../context/LanguageContext';
import { fileKind, uploadFiles, type FileItem, type FileKind, type FileParent } from '../../services/filesService';
import { FileRow } from './FileRow';
import { useFileDrop, useThumbnailUrls } from './fileHooks';
import { useFileActions } from './useFileActions';
import { useUploadFeedback } from './FileAttachments';

type SortKey = 'newest' | 'oldest' | 'name' | 'size';
type RangeKey = 'all' | '7d' | '30d' | '365d';
type ObjectKey = 'all' | 'task' | 'initiative' | 'project' | 'comment' | 'doc' | 'workspace';
const KIND_FILTERS: Array<FileKind | 'all'> = ['all', 'image', 'pdf', 'document', 'sheet', 'slides', 'video', 'audio', 'text', 'archive', 'other'];
const RANGE_DAYS: Record<RangeKey, number> = { all: 0, '7d': 7, '30d': 30, '365d': 365 };

interface FilesBrowserProps {
    tenantId: string;
    role?: string | null;
    files: FileItem[];
    loading?: boolean;
    projects: { id: string; title: string; ownerId?: string }[];
    /** Fixed project (project tab): hides the project filter. */
    scopeProjectId?: string;
    /** Where new uploads land; omit to hide uploading. */
    uploadParent?: FileParent | null;
    initialKind?: FileKind | 'all';
    /** Open this file's preview once it is loaded (deep link). */
    focusFileId?: string | null;
    headerActions?: React.ReactNode;
}

/** List/grid of files with search, filters, sorting, trash and actions. Used by /files and the project tab. */
export const FilesBrowser = ({
    tenantId,
    role,
    files,
    loading,
    projects,
    scopeProjectId,
    uploadParent,
    initialKind = 'all',
    focusFileId,
    headerActions,
}: FilesBrowserProps) => {
    const { t } = useLanguage();
    const reportFailures = useUploadFeedback();
    const [search, setSearch] = useState('');
    const [kind, setKind] = useState<FileKind | 'all'>(initialKind);
    const [projectFilter, setProjectFilter] = useState('all');
    const [uploader, setUploader] = useState('all');
    const [range, setRange] = useState<RangeKey>('all');
    const [objectType, setObjectType] = useState<ObjectKey>('all');
    const [sort, setSort] = useState<SortKey>('newest');
    const [layout, setLayout] = useState<'list' | 'grid'>(() => (localStorage.getItem('pf-files-layout') === 'grid' ? 'grid' : 'list'));
    const [trash, setTrash] = useState(false);
    const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => setKind(initialKind), [initialKind]);
    useEffect(() => { localStorage.setItem('pf-files-layout', layout); }, [layout]);

    const projectName = useCallback((id: string | null) => (
        id ? (projects.find((project) => project.id === id)?.title || t('files.scope.unknownProject')) : t('files.scope.workspace')
    ), [projects, t]);

    const uploaders = useMemo(() => {
        const map = new Map<string, string>();
        files.forEach((file) => { if (file.createdBy && !map.has(file.createdBy)) map.set(file.createdBy, file.uploaderName || t('files.unknownUploader')); });
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [files, t]);

    const trashedCount = useMemo(() => files.filter((file) => file.status === 'trashed').length, [files]);

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        const since = RANGE_DAYS[range] ? Date.now() - RANGE_DAYS[range] * 86400000 : 0;
        const list = files.filter((file) => {
            if ((file.status === 'trashed') !== trash) return false;
            if (scopeProjectId && file.projectId !== scopeProjectId) return false;
            if (kind !== 'all' && fileKind(file) !== kind) return false;
            if (projectFilter !== 'all' && (file.projectId || 'workspace') !== projectFilter) return false;
            if (uploader !== 'all' && file.createdBy !== uploader) return false;
            if (objectType !== 'all' && file.parent.type !== objectType) return false;
            if (since && file.createdAt < since) return false;
            if (needle) {
                const haystack = `${file.name} ${file.folder} ${file.tags.join(' ')} ${file.parent.title || ''} ${file.uploaderName}`.toLowerCase();
                if (!haystack.includes(needle)) return false;
            }
            return true;
        });
        const sorted = [...list];
        if (sort === 'oldest') sorted.sort((a, b) => a.createdAt - b.createdAt);
        else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
        else if (sort === 'size') sorted.sort((a, b) => b.sizeBytes - a.sizeBytes);
        else sorted.sort((a, b) => b.createdAt - a.createdAt);
        return sorted;
    }, [files, kind, objectType, projectFilter, range, scopeProjectId, search, sort, trash, uploader]);

    useFlipList(listRef);
    const thumbs = useThumbnailUrls(tenantId, visible.slice(0, 120));
    const actions = useFileActions({ tenantId, role, projects, files: visible });

    const focused = useRef<string | null>(null);
    useEffect(() => {
        if (!focusFileId || focused.current === focusFileId) return;
        const file = files.find((entry) => entry.id === focusFileId);
        if (file) {
            focused.current = focusFileId;
            actions.openPreview(file);
        }
    }, [actions, files, focusFileId]);

    const handleUpload = useCallback(async (picked: File[]) => {
        if (!uploadParent) return;
        setUploading({ done: 0, total: picked.length });
        const failures = await uploadFiles({ tenantId, parent: uploadParent, files: picked, onProgress: (done, total) => setUploading({ done, total }) });
        setUploading(null);
        reportFailures(failures);
    }, [reportFailures, tenantId, uploadParent]);
    const drop = useFileDrop((picked) => void handleUpload(picked), !uploadParent || trash || Boolean(uploading));

    const activeFilters = [kind !== 'all', projectFilter !== 'all', uploader !== 'all', range !== 'all', objectType !== 'all'].filter(Boolean).length;
    const resetFilters = () => { setKind('all'); setProjectFilter('all'); setUploader('all'); setRange('all'); setObjectType('all'); setSearch(''); };

    const originLabel = (file: FileItem) => {
        const parts: string[] = [];
        if (!scopeProjectId) parts.push(projectName(file.projectId));
        if (file.parent.type !== 'project' && file.parent.type !== 'workspace') {
            parts.push(`${t(`files.object.${file.parent.type}`)}${file.parent.title ? `: ${file.parent.title}` : ''}`);
        }
        if (file.folder) parts.push(file.folder);
        return parts.join(' · ');
    };

    const kindOptions = KIND_FILTERS.map((value) => ({ value, label: t(`files.kind.${value}`) }));
    const objectOptions = (['all', 'task', 'initiative', 'comment', 'project', 'doc', 'workspace'] as ObjectKey[]).map((value) => ({ value, label: t(`files.object.${value}`) }));
    const rangeOptions = (Object.keys(RANGE_DAYS) as RangeKey[]).map((value) => ({ value, label: t(`files.range.${value}`) }));
    const sortOptions = (['newest', 'oldest', 'name', 'size'] as SortKey[]).map((value) => ({ value, label: t(`files.sort.${value}`) }));
    const projectOptions = [
        { value: 'all', label: t('files.filter.allProjects') },
        ...(role !== 'Guest' ? [{ value: 'workspace', label: t('files.scope.workspace') }] : []),
        ...projects.map((project) => ({ value: project.id, label: project.title })),
    ];
    const uploaderOptions = [{ value: 'all', label: t('files.filter.allUploaders') }, ...uploaders.map(([value, label]) => ({ value, label }))];

    return (
        <div className="files-browser" data-dragging={drop.isDragging ? 'true' : 'false'} {...drop.dropProps} onPaste={drop.onPaste}>
            <div className="files-browser__toolbar">
                <label className="files-browser__search">
                    <span className="material-symbols-outlined" aria-hidden="true">search</span>
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('files.search.placeholder')}
                        aria-label={t('files.search.placeholder')}
                    />
                </label>
                <div className="files-browser__toolbar-actions">
                    <div className="motion-tabs files-browser__layout" role="tablist" aria-label={t('files.layout.label')}>
                        <TabIndicator activeKey={layout} />
                        {(['list', 'grid'] as const).map((value) => (
                            <button
                                key={value}
                                type="button"
                                role="tab"
                                data-tab-key={value}
                                aria-selected={layout === value}
                                className={layout === value ? 'is-active' : ''}
                                onClick={() => setLayout(value)}
                                aria-label={t(`files.layout.${value}`)}
                                title={t(`files.layout.${value}`)}
                            >
                                <span className="material-symbols-outlined" aria-hidden="true">{value === 'list' ? 'view_list' : 'grid_view'}</span>
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className={`files-browser__trash ${trash ? 'is-active' : ''}`}
                        onClick={() => setTrash((value) => !value)}
                        aria-pressed={trash}
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">{trash ? 'arrow_back' : 'delete'}</span>
                        {trash ? t('files.trash.back') : t('files.trash.open')}
                        {!trash && trashedCount > 0 && <span className="file-badge">{trashedCount}</span>}
                    </button>
                    {headerActions}
                    {uploadParent && !trash && (
                        <button type="button" className="files-browser__upload" onClick={drop.openPicker} disabled={Boolean(uploading)}>
                            <span className="material-symbols-outlined" aria-hidden="true">upload</span>
                            {t('files.upload.button')}
                        </button>
                    )}
                </div>
            </div>

            <div className="files-browser__filters">
                <WorkMenuChip label={t('files.filter.type')} icon="category" prefix={t('files.filter.type')} valueLabel={t(`files.kind.${kind}`)} active={kind !== 'all'} options={kindOptions} value={kind} onSelect={(value) => setKind(value as FileKind | 'all')} />
                {!scopeProjectId && (
                    <WorkMenuChip label={t('files.filter.project')} icon="layers" prefix={t('files.filter.project')} valueLabel={projectOptions.find((option) => option.value === projectFilter)?.label || ''} active={projectFilter !== 'all'} options={projectOptions} value={projectFilter} onSelect={setProjectFilter} width={260} />
                )}
                <WorkMenuChip label={t('files.filter.object')} icon="link" prefix={t('files.filter.object')} valueLabel={t(`files.object.${objectType}`)} active={objectType !== 'all'} options={objectOptions} value={objectType} onSelect={(value) => setObjectType(value as ObjectKey)} />
                <WorkMenuChip label={t('files.filter.uploader')} icon="person" prefix={t('files.filter.uploader')} valueLabel={uploaderOptions.find((option) => option.value === uploader)?.label || ''} active={uploader !== 'all'} options={uploaderOptions} value={uploader} onSelect={setUploader} width={240} />
                <WorkMenuChip label={t('files.filter.range')} icon="calendar_today" prefix={t('files.filter.range')} valueLabel={t(`files.range.${range}`)} active={range !== 'all'} options={rangeOptions} value={range} onSelect={(value) => setRange(value as RangeKey)} />
                <WorkMenuChip label={t('files.sort.label')} icon="sort" prefix={t('files.sort.label')} valueLabel={t(`files.sort.${sort}`)} options={sortOptions} value={sort} onSelect={(value) => setSort(value as SortKey)} />
                {(activeFilters > 0 || search) && (
                    <button type="button" className="files-browser__reset" onClick={resetFilters}>{t('files.filter.reset')}</button>
                )}
            </div>

            {uploading && (
                <div className="file-attachments__progress motion-fade-in" role="status">
                    <span className="material-symbols-outlined file-attachments__spin" aria-hidden="true">progress_activity</span>
                    {t('files.upload.progress').replace('{done}', String(uploading.done)).replace('{total}', String(uploading.total))}
                </div>
            )}
            {trash && <p className="files-browser__hint">{t('files.trash.hint')}</p>}

            {loading ? (
                <div className="files-browser__loading" aria-busy="true">
                    {Array.from({ length: 4 }).map((_, index) => <span key={index} className="files-browser__skeleton" />)}
                </div>
            ) : visible.length === 0 ? (
                <EmptyState
                    icon={<span className="material-symbols-outlined">{trash ? 'delete' : 'folder_open'}</span>}
                    title={trash ? t('files.empty.trash') : (activeFilters || search ? t('files.empty.filtered') : t('files.empty.title'))}
                    message={trash || activeFilters || search ? undefined : (uploadParent ? t('files.empty.messageUpload') : t('files.empty.message'))}
                />
            ) : (
                <div ref={listRef} className={`files-browser__items files-browser__items--${layout}`}>
                    {visible.map((file) => (
                        <FileRow
                            key={file.id}
                            file={file}
                            layout={layout === 'grid' ? 'card' : 'row'}
                            thumbUrl={thumbs[file.id]}
                            context={originLabel(file)}
                            options={actions.optionsFor(file)}
                            onAction={(value) => void actions.handleAction(file, value)}
                            onOpen={() => void actions.handleAction(file, file.status === 'trashed' ? 'restore' : 'preview')}
                        />
                    ))}
                </div>
            )}

            {drop.isDragging && (
                <div className="file-attachments__drop files-browser__drop motion-pop-in" aria-hidden="true">
                    <span className="material-symbols-outlined">file_upload</span>
                    {t('files.attachments.drop')}
                </div>
            )}
            {drop.input}
            {actions.modals}
        </div>
    );
};
