import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '../../services/firebase';
import { useLanguage } from '../../context/LanguageContext';
import { fileKind, formatBytes, getFileUrls, toFileItem, type FileItem } from '../../services/filesService';
import { FilePreviewModal } from './FilePreviewModal';
import { FileThumb } from './fileHooks';

/**
 * Embeds one stored file by id (wiki/doc content keeps only `fileId`, never a URL). Images render
 * inline, everything else as a card that opens the preview. Missing access shows a neutral stub.
 */
export const FileEmbed = ({ tenantId, fileId }: { tenantId: string; fileId: string }) => {
    const { t, language } = useLanguage();
    const [file, setFile] = useState<FileItem | null | undefined>(undefined);
    const [url, setUrl] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => onSnapshot(
        doc(db, 'tenants', tenantId, 'files', fileId),
        (snap) => setFile(snap.exists() ? toFileItem(snap.id, snap.data()) : null),
        () => setFile(null),
    ), [tenantId, fileId]);

    useEffect(() => {
        if (!file || file.status !== 'ready' || fileKind(file) !== 'image') return undefined;
        let cancelled = false;
        void getFileUrls(tenantId, [file.id]).then((urls) => { if (!cancelled) setUrl(urls[file.id] || null); }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [tenantId, file?.id, file?.version, file?.status]); // eslint-disable-line react-hooks/exhaustive-deps

    if (file === undefined) return <span className="file-embed file-embed--loading" aria-busy="true" />;
    if (!file || file.status !== 'ready') {
        return <span className="file-embed file-embed--missing">{t('files.embed.unavailable')}</span>;
    }

    return (
        <>
            {fileKind(file) === 'image' && url ? (
                <button type="button" className="file-embed file-embed--image" onClick={() => setPreviewOpen(true)}>
                    <img src={url} alt={file.name} loading="lazy" />
                </button>
            ) : (
                <button type="button" className="file-embed file-embed--card" onClick={() => setPreviewOpen(true)}>
                    <FileThumb file={file} size="md" />
                    <span className="file-embed__text">
                        <span className="file-embed__name">{file.name}</span>
                        <span className="file-embed__meta">{formatBytes(file.sizeBytes, language)}</span>
                    </span>
                </button>
            )}
            {previewOpen && <FilePreviewModal tenantId={tenantId} file={file} onClose={() => setPreviewOpen(false)} />}
        </>
    );
};
