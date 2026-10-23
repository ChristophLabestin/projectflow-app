import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { InlineMenuOption } from '../work/InlineMenu';
import { useConfirm, useToast } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';
import { auth } from '../../services/firebase';
import {
    downloadFile,
    fileDeepLink,
    fileOriginPath,
    purgeFile,
    restoreFile,
    trashFile,
    updateFile,
    uploadFileVersion,
    type FileItem,
    type FileParent,
} from '../../services/filesService';
import { FilePreviewModal } from './FilePreviewModal';

export type FileAction = 'preview' | 'download' | 'copyLink' | 'open' | 'rename' | 'version' | 'move' | 'trash' | 'restore' | 'purge';

export interface FileActionContext {
    tenantId: string;
    /** Workspace role of the viewer (Owner/Admin manage every file). */
    role?: string | null;
    /** Projects the viewer can see: names for "move" and owner ids for manage rights. */
    projects?: { id: string; title: string; ownerId?: string }[];
    /** Files the preview can page through. */
    files?: FileItem[];
}

/**
 * Menu options plus the handlers and modals behind them (preview, rename, move, new version,
 * trash/restore, permanent delete through the shared confirmation dialog). Render `modals` once.
 */
export const useFileActions = ({ tenantId, role, projects = [], files = [] }: FileActionContext) => {
    const { t } = useLanguage();
    const confirm = useConfirm();
    const { showError, showSuccess } = useToast();
    const navigate = useNavigate();
    const uid = auth.currentUser?.uid;

    const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
    const [renameFile, setRenameFile] = useState<FileItem | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [moveFile, setMoveFile] = useState<FileItem | null>(null);
    const [moveTarget, setMoveTarget] = useState('');
    const [moveFolder, setMoveFolder] = useState('');
    const [busy, setBusy] = useState(false);
    const versionInput = useRef<HTMLInputElement>(null);
    const versionTarget = useRef<FileItem | null>(null);

    const canManage = useCallback((file: FileItem) => {
        if (file.legacy) return false;
        if (role === 'Owner' || role === 'Admin') return true;
        if (file.createdBy === uid) return true;
        return Boolean(file.projectId && projects.find((project) => project.id === file.projectId)?.ownerId === uid);
    }, [projects, role, uid]);

    const canPurge = useCallback((file: FileItem) => (
        !file.legacy && (role === 'Owner' || role === 'Admin' || file.createdBy === uid)
    ), [role, uid]);

    const optionsFor = useCallback((file: FileItem): InlineMenuOption[] => {
        const icon = (name: string) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
        if (file.status === 'trashed') {
            return [
                ...(canManage(file) ? [{ value: 'restore', label: t('files.action.restore'), leading: icon('restore_from_trash') }] : []),
                ...(canPurge(file) ? [{ value: 'purge', label: t('files.action.purge'), leading: icon('delete_forever'), dividerBefore: true }] : []),
            ];
        }
        const origin = fileOriginPath(file);
        return [
            { value: 'preview', label: t('files.action.preview'), leading: icon('visibility') },
            { value: 'download', label: t('files.action.download'), leading: icon('download') },
            { value: 'copyLink', label: t('files.action.copyLink'), leading: icon('link') },
            ...(origin ? [{ value: 'open', label: t('files.action.openOrigin'), leading: icon('open_in_new') }] : []),
            ...(canManage(file) ? [
                { value: 'rename', label: t('files.action.rename'), leading: icon('edit'), dividerBefore: true },
                { value: 'version', label: t('files.action.newVersion'), leading: icon('upload_file') },
                { value: 'move', label: t('files.action.move'), leading: icon('drive_file_move') },
                { value: 'trash', label: t('files.action.trash'), leading: icon('delete'), dividerBefore: true },
            ] : []),
        ];
    }, [canManage, canPurge, t]);

    const run = useCallback(async (job: () => Promise<unknown>, success?: string) => {
        setBusy(true);
        try {
            await job();
            if (success) showSuccess(success);
            return true;
        } catch (error) {
            console.error(error);
            showError(t('files.error.action'));
            return false;
        } finally {
            setBusy(false);
        }
    }, [showError, showSuccess, t]);

    const handleAction = useCallback(async (file: FileItem, action: FileAction | string) => {
        switch (action) {
            case 'preview':
                setPreviewFile(file);
                break;
            case 'download':
                await run(() => downloadFile(tenantId, file));
                break;
            case 'copyLink':
                await run(() => navigator.clipboard.writeText(fileDeepLink(file.id)), t('files.toast.linkCopied'));
                break;
            case 'open': {
                const path = fileOriginPath(file);
                if (path) navigate(path);
                break;
            }
            case 'rename':
                setRenameValue(file.name);
                setRenameFile(file);
                break;
            case 'version':
                versionTarget.current = file;
                versionInput.current?.click();
                break;
            case 'move':
                setMoveTarget(file.parent.type === 'project' || file.parent.type === 'workspace' ? (file.projectId || 'workspace') : 'keep');
                setMoveFolder(file.folder);
                setMoveFile(file);
                break;
            case 'trash':
                await run(() => trashFile(tenantId, file.id), t('files.toast.trashed'));
                break;
            case 'restore':
                await run(() => restoreFile(tenantId, file.id), t('files.toast.restored'));
                break;
            case 'purge': {
                const ok = await confirm({
                    title: t('files.confirm.purge.title'),
                    message: t('files.confirm.purge.message').replace('{name}', file.name),
                    confirmText: t('files.action.purge'),
                    variant: 'danger',
                });
                if (ok) await run(() => purgeFile(tenantId, file.id), t('files.toast.purged'));
                break;
            }
            default:
                break;
        }
    }, [confirm, navigate, run, t, tenantId]);

    const submitRename = async () => {
        if (!renameFile || !renameValue.trim()) return;
        const ok = await run(() => updateFile(tenantId, renameFile.id, { name: renameValue.trim() }));
        if (ok) setRenameFile(null);
    };

    const submitMove = async () => {
        if (!moveFile) return;
        const changes: { folder: string; parent?: FileParent } = { folder: moveFolder };
        if (moveTarget === 'workspace') {
            changes.parent = { type: 'workspace', id: 'workspace', projectId: null };
        } else if (moveTarget !== 'keep' && moveTarget !== moveFile.projectId) {
            const project = projects.find((entry) => entry.id === moveTarget);
            changes.parent = { type: 'project', id: moveTarget, projectId: moveTarget, title: project?.title || '' };
        } else if (moveTarget === moveFile.projectId && moveFile.parent.type !== 'project') {
            changes.parent = { type: 'project', id: moveTarget, projectId: moveTarget, title: projects.find((entry) => entry.id === moveTarget)?.title || '' };
        }
        const ok = await run(() => updateFile(tenantId, moveFile.id, changes), t('files.toast.moved'));
        if (ok) setMoveFile(null);
    };

    const modals = (
        <>
            <input
                ref={versionInput}
                type="file"
                hidden
                onChange={(event) => {
                    const picked = event.target.files?.[0];
                    const target = versionTarget.current;
                    event.target.value = '';
                    if (picked && target) void run(() => uploadFileVersion(tenantId, target.id, picked), t('files.toast.versionAdded'));
                }}
            />
            <FilePreviewModal
                tenantId={tenantId}
                file={previewFile ? (files.find((entry) => entry.id === previewFile.id) || previewFile) : null}
                files={files.filter((entry) => entry.status === 'ready')}
                onNavigate={setPreviewFile}
                onClose={() => setPreviewFile(null)}
            />
            <Modal
                isOpen={Boolean(renameFile)}
                onClose={() => setRenameFile(null)}
                title={t('files.rename.title')}
                size="sm"
                footer={(
                    <>
                        <Button variant="ghost" onClick={() => setRenameFile(null)}>{t('common.cancel')}</Button>
                        <Button onClick={() => void submitRename()} isLoading={busy} disabled={!renameValue.trim()}>{t('common.save')}</Button>
                    </>
                )}
            >
                <form onSubmit={(event) => { event.preventDefault(); void submitRename(); }}>
                    <Input label={t('files.rename.label')} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus />
                </form>
            </Modal>
            <Modal
                isOpen={Boolean(moveFile)}
                onClose={() => setMoveFile(null)}
                title={t('files.move.title')}
                size="sm"
                footer={(
                    <>
                        <Button variant="ghost" onClick={() => setMoveFile(null)}>{t('common.cancel')}</Button>
                        <Button onClick={() => void submitMove()} isLoading={busy}>{t('files.action.move')}</Button>
                    </>
                )}
            >
                <div className="file-move">
                    <label className="file-move__field">
                        <span>{t('files.move.target')}</span>
                        <select className="file-move__select" value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
                            {moveFile && moveFile.parent.type !== 'project' && moveFile.parent.type !== 'workspace' && (
                                <option value="keep">{t('files.move.keep')}</option>
                            )}
                            {role !== 'Guest' && <option value="workspace">{t('files.scope.workspace')}</option>}
                            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                        </select>
                    </label>
                    <Input label={t('files.move.folder')} placeholder={t('files.move.folderPlaceholder')} value={moveFolder} onChange={(event) => setMoveFolder(event.target.value)} />
                    {moveTarget !== 'keep' && moveFile && moveTarget !== (moveFile.projectId || 'workspace') && (
                        <p className="file-move__hint">{t('files.move.accessHint')}</p>
                    )}
                </div>
            </Modal>
        </>
    );

    return { optionsFor, handleAction, modals, canManage, openPreview: setPreviewFile };
};
