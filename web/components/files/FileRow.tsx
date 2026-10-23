import React from 'react';

import { InlineMenu } from '../work/InlineMenu';
import { useLanguage } from '../../context/LanguageContext';
import { formatBytes, type FileItem } from '../../services/filesService';
import { FileThumb } from './fileHooks';
import type { InlineMenuOption } from '../work/InlineMenu';

interface FileRowProps {
    file: FileItem;
    thumbUrl?: string;
    /** Extra meta, e.g. origin object or "from a comment". */
    context?: React.ReactNode;
    options: InlineMenuOption[];
    onAction: (value: string) => void;
    onOpen: () => void;
    layout?: 'row' | 'card';
}

/** One file as list row or grid card: thumb, name, meta and the actions menu. */
export const FileRow = ({ file, thumbUrl, context, options, onAction, onOpen, layout = 'row' }: FileRowProps) => {
    const { t, language } = useLanguage();
    const date = file.createdAt ? new Date(file.createdAt).toLocaleDateString(language, { dateStyle: 'medium' }) : '';
    return (
        <div className={`file-${layout}`} data-flip-key={file.id} data-status={file.status}>
            <button type="button" className={`file-${layout}__main`} onClick={onOpen} title={file.name}>
                <FileThumb file={file} url={thumbUrl} size={layout === 'card' ? 'lg' : 'sm'} />
                <span className={`file-${layout}__text`}>
                    <span className={`file-${layout}__name`}>
                        {file.name}
                        {file.version > 1 && <span className="file-badge">v{file.version}</span>}
                    </span>
                    <span className={`file-${layout}__meta`}>
                        {formatBytes(file.sizeBytes, language)}
                        {file.uploaderName && <> · {file.uploaderName}</>}
                        {date && <> · {date}</>}
                    </span>
                    {context && <span className={`file-${layout}__context`}>{context}</span>}
                </span>
            </button>
            {options.length > 0 && (
                <InlineMenu
                    label={t('files.action.menu').replace('{name}', file.name)}
                    triggerClassName={`file-${layout}__menu`}
                    trigger={<span className="material-symbols-outlined" aria-hidden="true">more_horiz</span>}
                    options={options}
                    onSelect={onAction}
                    width={220}
                />
            )}
        </div>
    );
};
