import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFlipList } from '../motion';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { subscribeParentFiles, uploadFiles, type FileItem, type FileParent, type UploadFailure } from '../../services/filesService';
import { FileRow } from './FileRow';
import { useFileDrop, useThumbnailUrls } from './fileHooks';
import { useFileActions } from './useFileActions';

interface FileAttachmentsProps {
    tenantId: string;
    /** Object the files hang on. Comments are attached through CommentSection, not here. */
    parent: FileParent;
    role?: string | null;
    projects?: { id: string; title: string; ownerId?: string }[];
    title?: string;
    /** Also list files of comments on this object (task detail). */
    includeCommentFiles?: boolean;
    readOnly?: boolean;
    onCountChange?: (count: number) => void;
}

export const useUploadFeedback = () => {
    const { t } = useLanguage();
    const { showError } = useToast();
    return useCallback((failures: UploadFailure[]) => {
        if (!failures.length) return;
        const reason = failures[0].reason;
        const names = failures.map((failure) => failure.file.name).join(', ');
        showError(t(`files.error.${reason}`).replace('{names}', names));
    }, [showError, t]);
};

/**
 * Attachment panel for one object (task, project, initiative, wiki doc): drop, paste or pick
 * files, then preview, download and manage them. Wiki usage: parent `{ type: 'doc', id, projectId }`.
 */
export const FileAttachments = ({
    tenantId,
    parent,
    role,
    projects,
    title,
    includeCommentFiles = true,
    readOnly = false,
    onCountChange,
}: FileAttachmentsProps) => {
    const { t } = useLanguage();
    const reportFailures = useUploadFeedback();
    const [files, setFiles] = useState<FileItem[]>([]);
    const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const rootId = parent.rootId || parent.id;

    useEffect(() => subscribeParentFiles({ tenantId, projectId: parent.projectId, rootId }, setFiles), [tenantId, parent.projectId, rootId]);

    const visible = useMemo(() => files.filter((file) => (
        file.status === 'ready' && (includeCommentFiles || file.parent.type !== 'comment')
    )), [files, includeCommentFiles]);

    useEffect(() => { onCountChange?.(visible.length); }, [visible.length, onCountChange]);
    useFlipList(listRef);

    const thumbs = useThumbnailUrls(tenantId, visible);
    const actions = useFileActions({ tenantId, role, projects, files: visible });

    const handleFiles = useCallback(async (picked: File[]) => {
        setUploading({ done: 0, total: picked.length });
        const failures = await uploadFiles({
            tenantId,
            parent: { ...parent, rootType: parent.rootType || parent.type, rootId },
            files: picked,
            onProgress: (done, total) => setUploading({ done, total }),
        });
        setUploading(null);
        reportFailures(failures);
    }, [parent, reportFailures, rootId, tenantId]);

    const drop = useFileDrop((picked) => void handleFiles(picked), readOnly || Boolean(uploading));

    return (
        <section
            className="file-attachments"
            data-dragging={drop.isDragging ? 'true' : 'false'}
            {...drop.dropProps}
            onPaste={drop.onPaste}
        >
            <header className="file-attachments__header">
                <h3 className="file-attachments__title">
                    <span className="material-symbols-outlined" aria-hidden="true">attach_file</span>
                    {title || t('files.attachments.title')}
                    {visible.length > 0 && <span className="file-attachments__count">{visible.length}</span>}
                </h3>
                {!readOnly && (
                    <button type="button" className="file-attachments__add" onClick={drop.openPicker} disabled={Boolean(uploading)}>
                        <span className="material-symbols-outlined" aria-hidden="true">add</span>
                        {t('files.attachments.add')}
                    </button>
                )}
            </header>

            {uploading && (
                <div className="file-attachments__progress motion-fade-in" role="status">
                    <span className="material-symbols-outlined file-attachments__spin" aria-hidden="true">progress_activity</span>
                    {t('files.upload.progress').replace('{done}', String(uploading.done)).replace('{total}', String(uploading.total))}
                </div>
            )}

            <div ref={listRef} className="file-attachments__list">
                {visible.map((file) => (
                    <FileRow
                        key={file.id}
                        file={file}
                        thumbUrl={thumbs[file.id]}
                        context={file.parent.type === 'comment' ? t('files.attachments.fromComment') : undefined}
                        options={actions.optionsFor(file)}
                        onAction={(value) => void actions.handleAction(file, value)}
                        onOpen={() => void actions.handleAction(file, 'preview')}
                    />
                ))}
            </div>

            {!readOnly && !visible.length && !uploading && (
                <button type="button" className="file-attachments__empty" onClick={drop.openPicker}>
                    <span className="material-symbols-outlined" aria-hidden="true">upload</span>
                    {t('files.attachments.empty')}
                </button>
            )}

            {drop.isDragging && (
                <div className="file-attachments__drop motion-pop-in" aria-hidden="true">
                    <span className="material-symbols-outlined">file_upload</span>
                    {t('files.attachments.drop')}
                </div>
            )}
            {drop.input}
            {actions.modals}
        </section>
    );
};
