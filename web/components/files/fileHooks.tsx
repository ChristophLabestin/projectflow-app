import React, { useCallback, useEffect, useRef, useState } from 'react';

import { FILE_KIND_ICONS, fileKind, getFileUrls, type FileItem } from '../../services/filesService';

/** Pasted screenshots arrive as "image.png"; give them a dated, unique name. */
const renamePasted = (file: File, index: number) => {
    if (file.name && file.name !== 'image.png') return file;
    const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '.');
    const ext = file.type.split('/')[1] || 'png';
    return new File([file], `Screenshot ${stamp}${index ? `-${index + 1}` : ''}.${ext}`, { type: file.type });
};

/**
 * Drag & drop, clipboard paste and the file picker for one target. Spread `dropProps` on the
 * drop area, put `onPaste` on whatever receives focus (or the area) and render `input` once.
 */
export const useFileDrop = (onFiles: (files: File[]) => void, disabled = false) => {
    const [isDragging, setDragging] = useState(false);
    const depth = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const hasFiles = (event: React.DragEvent) => Array.from(event.dataTransfer?.types || []).includes('Files');

    const dropProps = {
        onDragEnter: (event: React.DragEvent) => {
            if (disabled || !hasFiles(event)) return;
            event.preventDefault();
            depth.current += 1;
            setDragging(true);
        },
        onDragOver: (event: React.DragEvent) => {
            if (disabled || !hasFiles(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        },
        onDragLeave: (event: React.DragEvent) => {
            if (disabled || !hasFiles(event)) return;
            depth.current = Math.max(0, depth.current - 1);
            if (!depth.current) setDragging(false);
        },
        onDrop: (event: React.DragEvent) => {
            if (disabled || !hasFiles(event)) return;
            event.preventDefault();
            depth.current = 0;
            setDragging(false);
            const files = Array.from(event.dataTransfer.files || []);
            if (files.length) onFiles(files);
        },
    };

    const onPaste = useCallback((event: React.ClipboardEvent) => {
        if (disabled) return;
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.length) return;
        event.preventDefault();
        onFiles(files.map(renamePasted));
    }, [disabled, onFiles]);

    const openPicker = useCallback(() => inputRef.current?.click(), []);

    const input = (
        <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = '';
                if (files.length) onFiles(files);
            }}
        />
    );

    return { isDragging, dropProps, onPaste, openPicker, input };
};

/** Short-lived view URLs for image thumbnails (batched, cached in filesService). */
export const useThumbnailUrls = (tenantId: string | null | undefined, files: FileItem[]) => {
    const [urls, setUrls] = useState<Record<string, string>>({});
    const key = files.filter((file) => fileKind(file) === 'image').map((file) => `${file.id}:${file.version}`).join(',');

    useEffect(() => {
        if (!tenantId || !key) return undefined;
        let cancelled = false;
        const ids = key.split(',').map((entry) => entry.split(':')[0]);
        void getFileUrls(tenantId, ids)
            .then((next) => { if (!cancelled) setUrls((prev) => ({ ...prev, ...next })); })
            .catch((error) => console.warn('Thumbnail urls failed', error));
        return () => { cancelled = true; };
    }, [tenantId, key]);

    return urls;
};

export const FileThumb = ({ file, url, size = 'md' }: { file: FileItem; url?: string; size?: 'sm' | 'md' | 'lg' }) => {
    const kind = fileKind(file);
    const [failed, setFailed] = useState(false);
    return (
        <span className={`file-thumb file-thumb--${size} file-thumb--${kind}`} aria-hidden="true">
            {kind === 'image' && url && !failed
                ? <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
                : <span className="material-symbols-outlined">{FILE_KIND_ICONS[kind]}</span>}
        </span>
    );
};
