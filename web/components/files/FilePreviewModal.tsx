import React, { useEffect, useState } from 'react';

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { downloadFile, fileKind, formatBytes, getFileUrls, type FileItem } from '../../services/filesService';
import { FileThumb } from './fileHooks';

const TEXT_PREVIEW_BYTES = 256 * 1024;

interface FilePreviewModalProps {
    tenantId: string;
    file: FileItem | null;
    /** Sibling files for previous/next (arrow keys). */
    files?: FileItem[];
    onNavigate?: (file: FileItem) => void;
    onClose: () => void;
}

/** Inline preview for images, PDF, video, audio and text plus file facts and versions. */
export const FilePreviewModal = ({ tenantId, file, files = [], onNavigate, onClose }: FilePreviewModalProps) => {
    const { t, language } = useLanguage();
    const [url, setUrl] = useState<string | null>(null);
    const [text, setText] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const kind = file ? fileKind(file) : 'other';

    useEffect(() => {
        setUrl(null);
        setText(null);
        setError(false);
        if (!file) return undefined;
        let cancelled = false;
        void getFileUrls(tenantId, [file.id]).then(async (urls) => {
            if (cancelled) return;
            const next = urls[file.id] || null;
            if (!next) { setError(true); return; }
            setUrl(next);
            if (fileKind(file) === 'text') {
                const response = await fetch(next, { headers: { Range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` } });
                const body = await response.text();
                if (!cancelled) setText(body);
            }
        }).catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; };
    }, [tenantId, file?.id, file?.version]); // eslint-disable-line react-hooks/exhaustive-deps

    const index = file ? files.findIndex((entry) => entry.id === file.id) : -1;
    useEffect(() => {
        if (!file || !onNavigate || files.length < 2) return undefined;
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
            if (event.key === 'ArrowRight' && index < files.length - 1) onNavigate(files[index + 1]);
            if (event.key === 'ArrowLeft' && index > 0) onNavigate(files[index - 1]);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [file, files, index, onNavigate]);

    if (!file) return null;
    const dateFormat = (ms: number) => (ms ? new Date(ms).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' }) : '');

    const renderBody = () => {
        if (error) return <p className="file-preview__fallback">{t('files.preview.error')}</p>;
        if (!url) return <span className="file-preview__spinner material-symbols-outlined" aria-label={t('files.preview.loading')}>progress_activity</span>;
        if (kind === 'image') return <img className="file-preview__image motion-fade-in" src={url} alt={file.name} />;
        if (kind === 'pdf') return <iframe className="file-preview__frame" src={url} title={file.name} />;
        if (kind === 'video') return <video className="file-preview__media" src={url} controls />;
        if (kind === 'audio') return <audio className="file-preview__audio" src={url} controls />;
        if (kind === 'text') return <pre className="file-preview__text">{text ?? ''}</pre>;
        return (
            <div className="file-preview__fallback">
                <FileThumb file={file} size="lg" />
                <p>{t('files.preview.unsupported')}</p>
            </div>
        );
    };

    return (
        <Modal isOpen onClose={onClose} title={file.name} size="5xl" className="file-preview-modal">
            <div className="file-preview">
                <div className="file-preview__stage">
                    {renderBody()}
                    {onNavigate && files.length > 1 && (
                        <>
                            <button type="button" className="file-preview__nav file-preview__nav--prev" disabled={index <= 0} onClick={() => onNavigate(files[index - 1])} aria-label={t('files.preview.previous')}>
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <button type="button" className="file-preview__nav file-preview__nav--next" disabled={index >= files.length - 1} onClick={() => onNavigate(files[index + 1])} aria-label={t('files.preview.next')}>
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </>
                    )}
                </div>
                <aside className="file-preview__facts">
                    <dl>
                        <dt>{t('files.facts.size')}</dt><dd>{formatBytes(file.sizeBytes, language)}</dd>
                        <dt>{t('files.facts.type')}</dt><dd>{file.mimeType}</dd>
                        <dt>{t('files.facts.uploadedBy')}</dt><dd>{file.uploaderName || '—'}</dd>
                        <dt>{t('files.facts.uploadedAt')}</dt><dd>{dateFormat(file.createdAt)}</dd>
                        {file.folder && (<><dt>{t('files.facts.folder')}</dt><dd>{file.folder}</dd></>)}
                    </dl>
                    <Button variant="secondary" size="sm" onClick={() => void downloadFile(tenantId, file)}>
                        <span className="material-symbols-outlined" aria-hidden="true">download</span>
                        {t('files.action.download')}
                    </Button>
                    {file.versions.length > 0 && (
                        <div className="file-preview__versions">
                            <h4>{t('files.versions.title')}</h4>
                            <ul>
                                <li>
                                    <span>{t('files.versions.current').replace('{n}', String(file.version))}</span>
                                    <span className="file-preview__muted">{dateFormat(file.updatedAt)}</span>
                                </li>
                                {[...file.versions].reverse().map((version) => (
                                    <li key={version.version}>
                                        <button type="button" className="file-preview__version" onClick={() => void downloadFile(tenantId, { id: file.id, name: version.fileName || file.name }, version.version)}>
                                            {t('files.versions.label').replace('{n}', String(version.version))}
                                            <span className="material-symbols-outlined" aria-hidden="true">download</span>
                                        </button>
                                        <span className="file-preview__muted">{formatBytes(version.sizeBytes, language)} · {dateFormat(version.createdAt)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>
            </div>
        </Modal>
    );
};
