import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { storage, auth } from '../services/firebase';
import { ref, listAll, getDownloadURL, deleteObject, uploadBytes } from 'firebase/storage';
import { getAllWorkspaceProjects } from '../services/dataService';
import { getActiveTenantId } from '../services/domain/authService';
import { Project } from '../types';
import { useConfirm, useToast } from '../context/UIContext';
import { Button } from '../components/ui/Button';
import { ImageEditor } from '../components/MediaLibrary/ImageEditor';
import { downloadFile } from '../utils/download';
import { deleteTenantFile, listTenantFiles, uploadTenantFile } from '../services/fileStorageService';

interface MediaAsset {
    id: string;
    managedFileId?: string;
    url: string;
    thumbnailUrl?: string;
    name: string;
    projectId?: string;
    type: 'image' | 'video';
    source: 'upload' | 'stock';
    createdAt?: any;
}

export const MediaLibraryPage: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [assets, setAssets] = useState<MediaAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadTargetProjectId, setUploadTargetProjectId] = useState<string>('uncategorized');
    const [editingImage, setEditingImage] = useState<MediaAsset | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();
    const { t } = useLanguage();

    const currentUser = auth.currentUser;

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;
            setLoading(true);

            try {
                const resolvedTenantId = getActiveTenantId();

                // 1. Fetch Projects
                const allProjects = await getAllWorkspaceProjects(resolvedTenantId);
                const myProjects = allProjects.filter(p =>
                    p.ownerId === currentUser.uid || (p.memberIds || []).includes(currentUser.uid)
                );
                setProjects(myProjects);

                // 2. Fetch Assets Recursively
                const rootProjectsRef = ref(storage, `tenants/${resolvedTenantId}/projects`);
                const rootResult = await listAll(rootProjectsRef);

                // Fetch from root (legacy/uncategorized)
                const rootItems = rootResult.items.filter(item => item.name.includes('_media_'));

                // Fetch from subfolders (prefixes)
                const folderPromises = rootResult.prefixes.map(prefix => listAll(prefix));
                const folderResults = await Promise.all(folderPromises);
                const folderItems = folderResults.flatMap(res => res.items.filter(item => item.name.includes('_media_')));

                const allLibraryItems = [...rootItems, ...folderItems];

                const assetPromises = allLibraryItems.map(async (item) => {
                    const url = await getDownloadURL(item);
                    const nameParts = item.name.split('_media_');
                    const metadata = nameParts[1]?.split('_');
                    const extractedProjectId = metadata?.[0];
                    const originalName = metadata?.slice(1).join('_') || item.name;

                    return {
                        id: item.name,
                        url: url,
                        thumbnailUrl: url,
                        name: originalName,
                        projectId: extractedProjectId,
                        type: 'image',
                        source: 'upload',
                        createdAt: new Date()
                    } as MediaAsset;
                });

                const fetchedAssets = await Promise.all(assetPromises);
                let managedAssets: MediaAsset[] = [];
                try {
                    const managed = await listTenantFiles({
                        tenantId: resolvedTenantId,
                        module: 'media',
                        limit: 300,
                    });
                    managedAssets = managed.files.map((file) => ({
                        id: file.id,
                        managedFileId: file.id,
                        url: file.downloadUrl,
                        thumbnailUrl: file.downloadUrl,
                        name: file.fileName,
                        projectId: file.projectId || undefined,
                        type: file.mimeType.startsWith('video/') ? 'video' : 'image',
                        source: 'upload',
                        createdAt: file.createdAt || new Date(),
                    }));
                } catch (managedError) {
                    console.error('Failed to load managed media assets', managedError);
                }

                setAssets([...fetchedAssets, ...managedAssets]);
            } catch (error) {
                console.error("Failed to fetch media library data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser]);

    const handleFileUpload = async (files: File[], targetProjectId: string = 'uncategorized') => {
        if (!currentUser) return;
        setIsUploading(true);

        try {
            const resolvedTenantId = getActiveTenantId();

            const uploadPromises = files.map(async (file) => {
                const uploaded = await uploadTenantFile({
                    tenantId: resolvedTenantId,
                    module: 'media',
                    entityType: 'mediaAsset',
                    entityId: targetProjectId,
                    projectId: targetProjectId === 'uncategorized' ? undefined : targetProjectId,
                    file,
                });

                return {
                    id: uploaded.id,
                    managedFileId: uploaded.id,
                    url: uploaded.downloadUrl,
                    thumbnailUrl: uploaded.downloadUrl,
                    name: uploaded.fileName,
                    projectId: targetProjectId === 'uncategorized' ? undefined : targetProjectId,
                    type: uploaded.mimeType.startsWith('image/') ? 'image' : 'video',
                    source: 'upload' as const,
                    createdAt: uploaded.createdAt || new Date()
                } as MediaAsset;
            });

            const newAssets = await Promise.all(uploadPromises);
            setAssets(prev => [...prev, ...newAssets]);
            showSuccess(t('mediaPage.toast.uploaded').replace('{count}', String(files.length)));
        } catch (error) {
            console.error("Upload failed:", error);
            showError(t('mediaPage.toast.uploadFailed'));
        } finally {
            setIsUploading(false);
        }
    };

    const triggerUpload = (pid: string = 'uncategorized') => {
        setUploadTargetProjectId(pid);
        fileInputRef.current?.click();
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(Array.from(e.target.files), uploadTargetProjectId);
        }
    };

    const groupedAssets = useMemo(() => {
        const groups: Record<string, { project: Project | null; assets: MediaAsset[] }> = {};

        assets.forEach(asset => {
            const pid = asset.projectId || 'uncategorized';
            if (!groups[pid]) {
                const project = projects.find(p => p.id === pid) || null;
                groups[pid] = { project, assets: [] };
            }
            groups[pid].assets.push(asset);
        });

        return Object.entries(groups).sort((a, b) => {
            if (a[0] === 'uncategorized') return 1;
            if (b[0] === 'uncategorized') return -1;
            return 0;
        });
    }, [assets, projects]);

    const handleDelete = async (asset: MediaAsset) => {
        const confirmed = await confirm(
            t('mediaPage.delete.title'),
            t('mediaPage.delete.message').replace('{name}', asset.name)
        );
        if (!confirmed) return;

        try {
            const resolvedTenantId = getActiveTenantId();
            if (!resolvedTenantId) {
                throw new Error('No tenant context');
            }

            if (asset.managedFileId) {
                await deleteTenantFile({ tenantId: resolvedTenantId, fileId: asset.managedFileId });
            } else {
                const storageRef = ref(storage, `tenants/${resolvedTenantId}/projects/${asset.id}`);
                await deleteObject(storageRef);
            }
            setAssets(prev => prev.filter(a => a.id !== asset.id));
            showSuccess(t('mediaPage.toast.deleted').replace('{name}', asset.name));
        } catch (error) {
            console.error("Delete failed:", error);
            showError(t('mediaPage.toast.deleteFailed'));
        }
    };

    const handleSaveAsNew = async (dataUrl: string) => {
        if (!editingImage) return;
        setLoading(true); // Reuse loading state for overlay effect
        try {
            const resolvedTenantId = getActiveTenantId();
            if (!resolvedTenantId) {
                throw new Error('No tenant context');
            }

            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `edited_${editingImage.name}`, { type: 'image/jpeg' });
            const uploaded = await uploadTenantFile({
                tenantId: resolvedTenantId,
                module: 'media',
                entityType: 'mediaAsset',
                entityId: editingImage.projectId || 'uncategorized',
                projectId: editingImage.projectId || undefined,
                file,
            });

            const newAsset: MediaAsset = {
                id: uploaded.id,
                managedFileId: uploaded.id,
                url: uploaded.downloadUrl,
                thumbnailUrl: uploaded.downloadUrl,
                name: uploaded.fileName,
                projectId: editingImage.projectId,
                type: 'image',
                source: 'upload',
                createdAt: uploaded.createdAt || new Date()
            };

            setAssets(prev => [...prev, newAsset]);
            showSuccess(t('mediaPage.toast.editedSaved'));
            setEditingImage(null);
        } catch (error) {
            console.error("Save as new failed:", error);
            showError(t('mediaPage.toast.editedFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReplace = async (dataUrl: string) => {
        if (!editingImage) return;
        setLoading(true);
        try {
            const resolvedTenantId = getActiveTenantId();
            if (!resolvedTenantId) {
                throw new Error('No tenant context');
            }

            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `edited_${editingImage.name}`, { type: 'image/jpeg' });

            if (editingImage.managedFileId) {
                const uploaded = await uploadTenantFile({
                    tenantId: resolvedTenantId,
                    module: 'media',
                    entityType: 'mediaAsset',
                    entityId: editingImage.projectId || 'uncategorized',
                    projectId: editingImage.projectId || undefined,
                    file,
                });
                await deleteTenantFile({ tenantId: resolvedTenantId, fileId: editingImage.managedFileId });

                setAssets(prev => prev.map(a =>
                    a.id === editingImage.id
                        ? {
                            ...a,
                            id: uploaded.id,
                            managedFileId: uploaded.id,
                            url: uploaded.downloadUrl,
                            thumbnailUrl: uploaded.downloadUrl,
                            name: uploaded.fileName,
                        }
                        : a
                ));

                showSuccess(t('mediaPage.toast.replaced'));
                setEditingImage(null);
                return;
            }

            const storageRef = ref(storage, `tenants/${resolvedTenantId}/projects/${editingImage.id}`);
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            // Force cache bust
            const finalUrl = `${downloadURL}${downloadURL.includes('?') ? '&' : '?'}t=${Date.now()}`;

            setAssets(prev => prev.map(a =>
                a.id === editingImage.id ? { ...a, url: finalUrl, thumbnailUrl: finalUrl } : a
            ));

            showSuccess(t('mediaPage.toast.replaced'));
            setEditingImage(null);
        } catch (error) {
            console.error("Replace failed:", error);
            showError(t('mediaPage.toast.replaceFailed'));
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
                <p className="text-muted font-medium">{t('mediaPage.loading')}</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-primary font-black tracking-widest text-xs uppercase">
                        <span className="h-px w-8 bg-primary/30" />
                        {t('mediaPage.eyebrow')}
                    </div>
                    <h1 className="text-4xl font-black text-main tracking-tight">{t('mediaPage.title')}</h1>
                    <p className="text-muted max-w-lg font-medium">
                        {t('mediaPage.subtitle')}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {isUploading && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-surface-hover rounded-xl border border-surface animate-pulse">
                            <span className="material-symbols-outlined text-[18px] animate-spin text-primary">progress_activity</span>
                            <span className="text-xs font-bold text-muted">{t('mediaPage.uploading')}</span>
                        </div>
                    )}
                    <Button
                        variant="primary"
                        onClick={() => triggerUpload('uncategorized')}
                        disabled={isUploading}
                        className="bg-primary hover:brightness-110 shadow-lg shadow-[var(--color-primary)]/20"
                    >
                        <span className="material-symbols-outlined text-[20px] mr-2">upload</span>
                        {t('mediaPage.upload')}
                    </Button>
                </div>
            </div>

            <input
                type="file"
                multiple
                accept="image/*,video/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileInputChange}
            />

            {assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center bg-card rounded-3xl border-2 border-dashed border-surface">
                    <div className="size-20 rounded-2xl bg-surface-hover flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-4xl text-muted">perm_media</span>
                    </div>
                    <h3 className="text-xl font-bold text-main mb-2">{t('mediaPage.empty.title')}</h3>
                    <p className="text-muted max-w-sm font-medium">
                        {t('mediaPage.empty.description')}
                    </p>
                </div>
            ) : (
                <div className="space-y-12">
                    {groupedAssets.map(([pid, group]) => (
                        <section key={pid} className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className={`size-10 rounded-xl flex items-center justify-center shadow-lg overflow-hidden border border-surface
                                    ${group.project?.squareIcon ? 'bg-surface' : 'bg-surface-card'}
                                `}>
                                    {group.project?.squareIcon ? (
                                        <img
                                            src={group.project.squareIcon}
                                            alt={group.project.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className={`material-symbols-outlined text-[20px] 
                                            ${pid === 'uncategorized' ? '' : ''} 
                                            text-muted
                                        `}>
                                            {pid === 'uncategorized' ? 'folder_open' : 'folder'}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <Link to={`/project/${pid}`} className="hover:underline decoration-[var(--color-primary)]">
                                        <h2 className="text-xl font-bold text-main hover:text-primary transition-colors">
                                            {group.project?.title || t('mediaPage.uncategorized')}
                                        </h2>
                                    </Link>
                                    <p className="text-xs text-muted font-bold uppercase tracking-wider">
                                        {group.assets.length} {group.assets.length === 1 ? t('mediaPage.asset.one') : t('mediaPage.asset.other')}
                                    </p>
                                </div>
                                <div className="flex-1 h-px bg-gradient-to-r from-[var(--color-surface-border)]/50 to-transparent" />
                                <button
                                    onClick={() => triggerUpload(pid)}
                                    disabled={isUploading}
                                    title={t('mediaPage.uploadTo').replace('{name}', group.project?.title || t('mediaPage.eyebrow'))}
                                    className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-30"
                                >
                                    <span className="material-symbols-outlined text-[22px]">cloud_upload</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                {group.assets.map((asset) => (
                                    <div key={asset.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-card border border-surface hover:border-primary transition-all shadow-sm hover:shadow-xl">
                                        <img
                                            src={asset.url}
                                            alt={asset.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />

                                        {/* Overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                                            <div className="flex gap-2">
                                                <button aria-label={t('mediaPage.copyLink')}
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(asset.url);
                                                        showSuccess(t('mediaPage.linkCopied'));
                                                    }}
                                                    className="size-10 rounded-xl bg-surface-card text-muted flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                    title={t('mediaPage.copyLink')}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">link</span>
                                                </button>
                                                <button aria-label={t('mediaPage.download')}
                                                    onClick={() => downloadFile(asset.url, asset.name)}
                                                    className="size-10 rounded-xl bg-surface-card text-muted flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                    title={t('mediaPage.download')}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">download</span>
                                                </button>
                                                <button aria-label={t('common.edit')}
                                                    onClick={() => setEditingImage(asset)}
                                                    className="size-10 rounded-xl bg-surface-card text-main flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                    title={t('common.edit')}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                                <button aria-label={t('common.delete')}
                                                    onClick={() => handleDelete(asset)}
                                                    className="size-10 rounded-xl bg-surface-card text-error flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                    title={t('common.delete')}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Footer Info */}
                                        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                                            <p className="text-[10px] text-white font-bold truncate tracking-tight">{asset.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )
            }

            {/* Editor Overlay */}
            {
                editingImage && (
                    <ImageEditor
                        src={editingImage.url}
                        onSave={handleSaveAsNew}
                        onSaveReplace={handleSaveReplace}
                        onCancel={() => setEditingImage(null)}
                    />
                )
            }
        </div >
    );
};
