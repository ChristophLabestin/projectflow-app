import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { storage, auth } from '../services/firebase';
import { ref, listAll, getDownloadURL, deleteObject, uploadBytes } from 'firebase/storage';
import { getAllWorkspaceProjects, getActiveTenantId } from '../services/dataService';
import { Project } from '../types';
import { useConfirm, useToast } from '../context/UIContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ImageEditor } from '../components/MediaLibrary/ImageEditor';

interface MediaAsset {
    id: string;
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

    const currentUser = auth.currentUser;

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;
            setLoading(true);

            try {
                const resolvedTenantId = getActiveTenantId() || currentUser.uid;

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
                setAssets(fetchedAssets);
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
            const resolvedTenantId = getActiveTenantId() || currentUser.uid;

            const uploadPromises = files.map(async (file) => {
                const timestamp = Date.now();
                const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                // Pattern: {timestamp}_media_{projectId}_{filename}
                const uniqueFileName = `${timestamp}_media_${targetProjectId}_${cleanFileName}`;

                // New logic: Use project subfolder if not uncategorized
                const folderPath = targetProjectId === 'uncategorized' ? '' : `${targetProjectId}/`;
                const path = `tenants/${resolvedTenantId}/projects/${folderPath}${uniqueFileName}`;

                const storageRef = ref(storage, path);

                // Upload file
                await uploadBytes(storageRef, file);

                // Get permanent download URL
                const downloadURL = await getDownloadURL(storageRef);

                return {
                    id: uniqueFileName,
                    url: downloadURL,
                    thumbnailUrl: downloadURL,
                    name: file.name,
                    projectId: targetProjectId === 'uncategorized' ? undefined : targetProjectId,
                    type: file.type.startsWith('image/') ? 'image' : 'video',
                    source: 'upload' as const,
                    createdAt: new Date()
                } as MediaAsset;
            });

            const newAssets = await Promise.all(uploadPromises);
            setAssets(prev => [...prev, ...newAssets]);
            showSuccess(`Successfully uploaded ${files.length} ${files.length === 1 ? 'file' : 'files'}.`);
        } catch (error) {
            console.error("Upload failed:", error);
            showError("Failed to upload media. Please try again.");
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
            "Delete Asset?",
            `Are you sure you want to delete "${asset.name}"? This action cannot be undone.`
        );
        if (!confirmed) return;

        try {
            const resolvedTenantId = getActiveTenantId() || currentUser?.uid;
            const storageRef = ref(storage, `tenants/${resolvedTenantId}/projects/${asset.id}`);
            await deleteObject(storageRef);
            setAssets(prev => prev.filter(a => a.id !== asset.id));
            showSuccess(`"${asset.name}" has been deleted.`);
        } catch (error) {
            console.error("Delete failed:", error);
            showError("Failed to delete asset.");
        }
    };

    const handleSaveAsNew = async (dataUrl: string) => {
        if (!editingImage) return;
        setLoading(true); // Reuse loading state for overlay effect
        try {
            const resolvedTenantId = getActiveTenantId() || currentUser?.uid;
            const timestamp = Date.now();
            const uniqueFileName = `${timestamp}_media_${editingImage.projectId || 'uncategorized'}_edited_${editingImage.name}`;
            const storageRef = ref(storage, `tenants/${resolvedTenantId}/projects/${uniqueFileName}`);

            const response = await fetch(dataUrl);
            const blob = await response.blob();
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            const newAsset: MediaAsset = {
                id: uniqueFileName,
                url: downloadURL,
                thumbnailUrl: downloadURL,
                name: `Edited ${editingImage.name}`,
                projectId: editingImage.projectId,
                type: 'image',
                source: 'upload',
                createdAt: new Date()
            };

            setAssets(prev => [...prev, newAsset]);
            showSuccess("Edited image saved as new.");
            setEditingImage(null);
        } catch (error) {
            console.error("Save as new failed:", error);
            showError("Failed to save edited image.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReplace = async (dataUrl: string) => {
        if (!editingImage) return;
        setLoading(true);
        try {
            const resolvedTenantId = getActiveTenantId() || currentUser?.uid;
            const storageRef = ref(storage, `tenants/${resolvedTenantId}/projects/${editingImage.id}`);

            const response = await fetch(dataUrl);
            const blob = await response.blob();
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            // Force cache bust
            const finalUrl = `${downloadURL}${downloadURL.includes('?') ? '&' : '?'}t=${Date.now()}`;

            setAssets(prev => prev.map(a =>
                a.id === editingImage.id ? { ...a, url: finalUrl, thumbnailUrl: finalUrl } : a
            ));

            showSuccess("Image replaced successfully.");
            setEditingImage(null);
        } catch (error) {
            console.error("Replace failed:", error);
            showError("Failed to replace image.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <span className="material-symbols-outlined text-4xl animate-spin text-[var(--color-primary)]">progress_activity</span>
                <p className="text-[var(--color-text-muted)] font-medium">Loading your media library...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[var(--color-primary)] font-black tracking-widest text-xs uppercase">
                        <span className="h-px w-8 bg-[var(--color-primary)]/30" />
                        Workspace
                    </div>
                    <h1 className="text-4xl font-black text-[var(--color-text-main)] tracking-tight">Media Library</h1>
                    <p className="text-[var(--color-text-muted)] max-w-lg font-medium">
                        All your project assets in one place, synchronized and ready for use.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {isUploading && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-surface-border)] animate-pulse">
                            <span className="material-symbols-outlined text-[18px] animate-spin text-[var(--color-primary)]">progress_activity</span>
                            <span className="text-xs font-bold text-[var(--color-text-muted)]">Uploading...</span>
                        </div>
                    )}
                    <Button
                        variant="primary"
                        onClick={() => triggerUpload('uncategorized')}
                        disabled={isUploading}
                        className="bg-[var(--color-primary)] hover:brightness-110 shadow-lg shadow-[var(--color-primary)]/20"
                    >
                        <span className="material-symbols-outlined text-[20px] mr-2">upload</span>
                        Upload Media
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
                <div className="flex flex-col items-center justify-center py-32 text-center bg-[var(--color-surface-card)] rounded-3xl border-2 border-dashed border-[var(--color-surface-border)]">
                    <div className="size-20 rounded-2xl bg-[var(--color-surface-hover)] flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-4xl text-[var(--color-text-muted)]">perm_media</span>
                    </div>
                    <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">Your library is empty</h3>
                    <p className="text-[var(--color-text-muted)] max-w-sm font-medium">
                        Images you upload in your projects or generate with AI will appear here.
                    </p>
                </div>
            ) : (
                <div className="space-y-12">
                    {groupedAssets.map(([pid, group]) => (
                        <section key={pid} className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className={`size-10 rounded-xl flex items-center justify-center shadow-lg overflow-hidden border border-[var(--color-surface-border)]
                                    ${group.project?.squareIcon ? 'bg-[var(--color-surface-bg)]' : 'bg-[var(--color-surface-card)] dark:bg-white'}
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
                                            text-zinc-500 dark:text-black
                                        `}>
                                            {pid === 'uncategorized' ? 'folder_open' : 'folder'}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <Link to={`/project/${pid}`} className="hover:underline decoration-[var(--color-primary)]">
                                        <h2 className="text-xl font-bold text-[var(--color-text-main)] hover:text-[var(--color-primary)] transition-colors">
                                            {group.project?.title || 'Uncategorized Workspace Assets'}
                                        </h2>
                                    </Link>
                                    <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">
                                        {group.assets.length} {group.assets.length === 1 ? 'Asset' : 'Assets'}
                                    </p>
                                </div>
                                <div className="flex-1 h-px bg-gradient-to-r from-[var(--color-surface-border)]/50 to-transparent" />
                                <button
                                    onClick={() => triggerUpload(pid)}
                                    disabled={isUploading}
                                    title={`Upload to ${group.project?.title || 'Workspace'}`}
                                    className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all disabled:opacity-30"
                                >
                                    <span className="material-symbols-outlined text-[22px]">cloud_upload</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                {group.assets.map((asset) => (
                                    <div key={asset.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] hover:border-[var(--color-primary)] transition-all shadow-sm hover:shadow-xl">
                                        <img
                                            src={asset.url}
                                            alt={asset.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />

                                        {/* Overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingImage(asset)}
                                                    className="size-10 rounded-xl bg-white text-zinc-800 flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                    title="Edit"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(asset)}
                                                    className="size-10 rounded-xl bg-white text-red-600 flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                    title="Delete"
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
