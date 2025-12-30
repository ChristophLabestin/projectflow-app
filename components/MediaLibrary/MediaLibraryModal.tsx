import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { storage, auth } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { useConfirm, useToast } from '../../context/UIContext';

import { ImageEditor } from './ImageEditor';
import { generateAIImage, editAIImage } from '../../services/aiSearchService';
import { getAIUsage } from '../../services/dataService';
import { AIUsage } from '../../types';
import { searchStockImages, getCuratedPhotos, triggerDownload, UnsplashImage } from '../../services/unsplashService';

interface MediaAsset {
    id: string;
    url: string;
    thumbnailUrl?: string;
    name: string;
    type: 'image' | 'video';
    source: 'upload' | 'stock' | 'local_file';
    createdAt?: any;
    file?: File; // For deferred uploads
}

interface MediaLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect?: (asset: MediaAsset) => void;
    projectId: string; // Used for project assets, or 'uncategorized'
    tenantId?: string;
    collectionType?: 'project' | 'user'; // Defaults to 'project'
    userId?: string; // Required if collectionType is 'user'
    existingAssets?: MediaAsset[];
    deferredUpload?: boolean;
    circularCrop?: boolean;
}

type TabType = 'upload' | 'gallery' | 'stock' | 'ai';


export const MediaLibrary: React.FC<MediaLibraryProps> = ({
    isOpen,
    onClose,
    onSelect,
    projectId,
    tenantId,
    collectionType = 'project',
    userId,
    existingAssets = [],
    deferredUpload = false,
    circularCrop = false,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('gallery');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<MediaAsset[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();

    // Editing State
    const [editingImage, setEditingImage] = useState<MediaAsset | null>(null);

    // AI Generation State
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [selectedStyle, setSelectedStyle] = useState('Photographic');
    const [aiView, setAiView] = useState<'input' | 'loading' | 'results' | 'picking_reference'>('input');
    const [aiUsage, setAiUsage] = useState<AIUsage | null>(null);
    const [aiMode, setAiMode] = useState<'generate' | 'rework'>('generate');
    const [referenceImage, setReferenceImage] = useState<MediaAsset | null>(null);

    // Stock Image State
    const [stockImages, setStockImages] = useState<UnsplashImage[]>([]);
    const [isStockLoading, setIsStockLoading] = useState(false);
    const [stockError, setStockError] = useState<string | null>(null);

    // Initial Load for Stock Tab
    useEffect(() => {
        if (activeTab === 'stock' && stockImages.length === 0) {
            loadStockImages();
        }
    }, [activeTab]);

    const loadStockImages = async (query?: string) => {
        setIsStockLoading(true);
        setStockError(null);
        try {
            if (query) {
                const results = await searchStockImages(query);
                setStockImages(results.results);
            } else {
                const results = await getCuratedPhotos();
                setStockImages(results);
            }
        } catch (error: any) {
            console.error("Failed to load stock images", error);
            if (error.message?.includes("Missing Unsplash API Key")) {
                setStockError("Setup Required: Please add VITE_UNSPLASH_ACCESS_KEY to your .env file.");
            } else {
                setStockError("Failed to load images. Please try again later.");
            }
        } finally {
            setIsStockLoading(false);
        }
    };

    const handleSearchStock = (e: React.FormEvent) => {
        e.preventDefault();
        loadStockImages(searchQuery);
    };

    const handleSaveStockImage = async (image: UnsplashImage) => {
        setIsUploading(true);
        try {
            // Track download as per Unsplash API guidelines
            await triggerDownload(image.links.download_location);

            // Fetch the image data
            const response = await fetch(image.urls.regular);
            const blob = await response.blob();
            const file = new File([blob], `${image.id}_unsplash.jpg`, { type: 'image/jpeg' });

            // Upload via existing handler
            await handleFileUpload([file]);
            showSuccess("Stock image saved to library");
        } catch (error) {
            console.error("Failed to save stock image:", error);
            showError("Failed to save stock image");
        } finally {
            setIsUploading(false);
        }
    };

    // Fetch AI Usage
    useEffect(() => {
        if (!isOpen) return;
        const fetchUsage = async () => {
            const user = auth.currentUser;
            if (user) {
                const usage = await getAIUsage(user.uid);
                setAiUsage(usage);
            }
        };
        fetchUsage();
    }, [isOpen, generatedImages]); // Refresh when images are generated

    // Fetch existing assets from Storage
    useEffect(() => {
        if (!isOpen || !projectId) return;

        const fetchExistingAssets = async () => {
            setIsLoading(true);
            const resolvedTenantId = tenantId || auth.currentUser?.uid;
            const resolvedUserId = userId || auth.currentUser?.uid;

            if (!resolvedTenantId || deferredUpload) return;

            try {
                let allItems: any[] = [];

                if (collectionType === 'user') {
                    // Fetch from user-specific folder
                    if (!resolvedUserId) return;
                    try {
                        const userRef = ref(storage, `tenants/${resolvedTenantId}/users/${resolvedUserId}`);
                        const userResult = await listAll(userRef);
                        allItems = userResult.items.filter(item => item.name.includes('_media_'));
                    } catch (e) {
                        console.log("User media folder doesn't exist yet");
                    }
                } else {
                    // 1. Fetch from Project Root (legacy/uncategorized)
                    const rootRef = ref(storage, `tenants/${resolvedTenantId}/projects`);
                    const rootResult = await listAll(rootRef);
                    const rootItems = rootResult.items.filter(item => item.name.includes('_media_'));

                    // 2. Fetch from Project Subfolder
                    let projectItems: any[] = [];
                    try {
                        const projectRef = ref(storage, `tenants/${resolvedTenantId}/projects/${projectId}`);
                        const projectResult = await listAll(projectRef);
                        projectItems = projectResult.items.filter(item => item.name.includes('_media_'));
                    } catch (e) {
                        // Folder might not exist yet for new projects, that's fine
                    }

                    allItems = [...rootItems, ...projectItems];
                }

                const assetPromises = allItems.map(async (item) => {
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
                        type: (item.name.toLowerCase().endsWith('.mp4') ||
                            item.name.toLowerCase().endsWith('.webm') ||
                            item.name.toLowerCase().endsWith('.mov')) ? 'video' : 'image',
                        source: 'upload',
                        createdAt: new Date()
                    } as MediaAsset;
                });

                const assets = await Promise.all(assetPromises);
                setUploadedFiles(assets);
            } catch (error) {
                console.error("Error listing assets:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchExistingAssets();
    }, [isOpen, projectId, tenantId]);

    // Combine existing assets with newly uploaded ones, filtered by current project or uncategorized
    // For deferred upload, show all local uploaded files regardless of project ID filtering (since they are fresh)
    const allAssets = deferredUpload || collectionType === 'user'
        ? uploadedFiles
        : [...existingAssets, ...uploadedFiles].filter(asset =>
            asset.projectId === projectId || !asset.projectId || asset.projectId === 'uncategorized'
        );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files).filter(file =>
            file.type.startsWith('image/') || file.type.startsWith('video/')
        );

        handleFileUpload(files);
    }, []);

    const handleFileUpload = async (files: File[]) => {
        setIsUploading(true);

        // Resolve tenant ID - use provided, or fall back to current user
        const resolvedTenantId = tenantId || auth.currentUser?.uid;
        const resolvedUserId = userId || auth.currentUser?.uid;

        if (!resolvedTenantId && !deferredUpload) {
            showError('Authentication required');
            setIsUploading(false);
            return;
        }

        if (deferredUpload) {
            const newAssets = files.map((file) => {
                const timestamp = Date.now();
                const uniqueId = `${timestamp}_local_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const objectUrl = URL.createObjectURL(file);

                return {
                    id: uniqueId,
                    url: objectUrl,
                    thumbnailUrl: objectUrl,
                    name: file.name,
                    projectId: projectId,
                    type: file.type.startsWith('image/') ? 'image' : 'video',
                    source: 'local_file' as const,
                    createdAt: new Date(),
                    file: file
                } as MediaAsset;
            });

            setUploadedFiles(prev => [...prev, ...newAssets]);
            // If single selection mode implicitly (usually is for wizard), could select immediately? 
            // But following standard flow: add to library view, then user selects.
            setActiveTab('gallery');
            setIsUploading(false);
            return;
        }

        try {
            const uploadPromises = files.map(async (file) => {
                const timestamp = Date.now();
                const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                // New Pattern: {timestamp}_media_{projectId/userId}_{filename}
                const contextId = collectionType === 'user' ? (resolvedUserId || 'user') : projectId;
                const uniqueFileName = `${timestamp}_media_${contextId}_${cleanFileName}`;

                let path = '';
                if (collectionType === 'user' && resolvedUserId) {
                    path = `tenants/${resolvedTenantId}/users/${resolvedUserId}/${uniqueFileName}`;
                } else {
                    const folderPath = projectId && projectId !== 'uncategorized' ? `${projectId}/` : '';
                    path = `tenants/${resolvedTenantId}/projects/${folderPath}${uniqueFileName}`;
                }

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
                    projectId: projectId,
                    type: file.type.startsWith('image/') ? 'image' : 'video',
                    source: 'upload' as const,
                    createdAt: new Date()
                } as MediaAsset;
            });

            const newAssets = await Promise.all(uploadPromises);
            setUploadedFiles(prev => [...prev, ...newAssets]);
            setActiveTab('gallery');
        } catch (error) {
            console.error("Upload failed:", error);
            showError("Failed to upload image. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFileUpload(Array.from(e.target.files));
        }
    };

    const handleSaveEditedImage = async (base64Data: string) => {
        if (!editingImage) return;
        setIsUploading(true);

        try {
            // Convert base64 to blob
            const response = await fetch(base64Data);
            const blob = await response.blob();
            const file = new File([blob], `edited_${editingImage.name}`, { type: 'image/jpeg' });

            await handleFileUpload([file]);
            setEditingImage(null);
            showSuccess("Edited image saved as new.");
        } catch (error) {
            console.error("Save edited image failed:", error);
            showError("Failed to save edited image.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveReplace = async (dataUrl: string) => {
        if (!editingImage) return;
        setIsUploading(true);
        try {
            // Search for the asset in its respective location
            let storageRef;
            const resolvedUserId = userId || auth.currentUser?.uid;

            if (collectionType === 'user' && resolvedUserId) {
                storageRef = ref(storage, `tenants/${resolvedTenantId}/users/${resolvedUserId}/${editingImage.id}`);
            } else {
                storageRef = ref(storage, `tenants/${resolvedTenantId}/projects/${editingImage.id}`);

                if (projectId && projectId !== 'uncategorized') {
                    const projectScopedRef = ref(storage, `tenants/${resolvedTenantId}/projects/${projectId}/${editingImage.id}`);
                    // Simple heuristic: if the asset belongs to this project, it's likely in the subfolder
                    if (editingImage.projectId === projectId) {
                        storageRef = projectScopedRef;
                    }
                }
            }

            const response = await fetch(dataUrl);
            const blob = await response.blob();

            await uploadBytes(storageRef, blob);
            const newUrl = await getDownloadURL(storageRef);

            // Force cache bust for the local state by appending timestamp
            const finalUrl = `${newUrl}${newUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

            setUploadedFiles(prev => prev.map(f =>
                f.id === editingImage.id ? { ...f, url: finalUrl, thumbnailUrl: finalUrl } : f
            ));

            showSuccess("Image replaced successfully.");
            setEditingImage(null);
        } catch (error) {
            console.error("Replace failed:", error);
            showError("Failed to replace image.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleGenerateAI = async () => {
        if (!aiPrompt) return;
        if (aiMode === 'rework' && !referenceImage) {
            showError("Please select an image to rework.");
            return;
        }
        setIsGenerating(true);
        setAiView('loading');

        try {
            // Enhanced prompt with style
            const styleSuffix = selectedStyle && selectedStyle !== 'Photographic' ? `, ${selectedStyle} style` : '';
            const finalPrompt = (aiPrompt + styleSuffix).trim();

            let images: string[];

            if (aiMode === 'rework' && referenceImage) {
                // Edit mode - use the reference image
                images = await editAIImage(
                    finalPrompt,
                    referenceImage.url,
                    selectedStyle === 'Photographic' ? 'default' : 'style'
                );
            } else {
                // Generate mode - text to image
                images = await generateAIImage(finalPrompt);
            }

            setGeneratedImages(images);
            setAiView('results');
        } catch (error: any) {
            console.error("CORA generation failed:", error);
            const msg = error?.message || "Failed to generate images. Please try again.";
            // User-friendly error for API key issues
            if (msg.includes("API key")) {
                showError("Google API Key missing or invalid.");
            } else if (msg.includes("limit")) {
                showError("CORA usage limit reached.");
            } else {
                showError(msg);
            }
            // Go back to input on error so they can try again
            setAiView('input');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveAIImage = async (url: string) => {
        setIsUploading(true);
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const file = new File([blob], `ai_gen_${Date.now()}.jpg`, { type: 'image/jpeg' });

            await handleFileUpload([file]);
            showSuccess("Image saved to library");
        } catch (error) {
            console.error("Failed to save CORA image:", error);
            showError("Failed to save image");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteImage = async (asset: MediaAsset) => {
        const confirmed = await confirm(
            "Delete Image?",
            `Are you sure you want to delete "${asset.name}"? This action cannot be undone.`
        );
        if (!confirmed) return;

        const resolvedTenantId = tenantId || auth.currentUser?.uid;
        if (!resolvedTenantId) return;

        try {
            // Delete from Storage
            const resolvedUserId = userId || auth.currentUser?.uid;
            let path = '';

            if (collectionType === 'user' && resolvedUserId) {
                path = `tenants/${resolvedTenantId}/users/${resolvedUserId}/${asset.id}`;
            } else {
                // Heuristic for project assets (check subfolder if projectId matches)
                const folderPath = asset.projectId && asset.projectId !== 'uncategorized' ? `${asset.projectId}/` : '';
                path = `tenants/${resolvedTenantId}/projects/${folderPath}${asset.id}`;
            }

            const storageRef = ref(storage, path);
            await deleteObject(storageRef);

            // Update UI
            setUploadedFiles(prev => prev.filter(f => f.id !== asset.id));
            showSuccess(`"${asset.name}" has been deleted.`);
        } catch (error) {
            console.error("Delete failed:", error);
            showError("Failed to delete image.");
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
                // Close when clicking backdrop
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl w-[1200px] max-w-[95vw] h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[var(--color-surface-border)]">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white">perm_media</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--color-text-main)]">Media Library</h2>
                            <p className="text-xs text-[var(--color-text-muted)]">
                                {collectionType === 'user' ? 'Select or upload personal images' : 'Select or upload images for your project'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="size-10 rounded-xl hover:bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--color-surface-border)] px-5">
                    {[
                        { id: 'gallery', label: collectionType === 'user' ? 'Personal Images' : 'Project Images', icon: 'photo_library' },
                        { id: 'upload', label: 'Upload', icon: 'cloud_upload' },
                        { id: 'ai', label: 'Nano Banana', icon: 'auto_awesome', color: 'text-amber-500' },
                        { id: 'stock', label: 'Stock Photos', icon: 'image_search' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${activeTab === tab.id
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                }`}
                        >
                            <span className={`material-symbols-outlined text-[18px] ${tab.color || ''}`}>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 relative overflow-hidden">
                    {/* Global Uploading Overlay */}
                    {isUploading && (
                        <div className="absolute inset-0 z-50 bg-white/60 dark:bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
                            <div className="size-16 rounded-2xl bg-white dark:bg-zinc-800 shadow-xl flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-4xl text-[var(--color-primary)] animate-spin">progress_activity</span>
                            </div>
                            <p className="text-sm font-bold text-[var(--color-text-main)]">Uploading your files...</p>
                        </div>
                    )}

                    {/* Upload Tab */}
                    {activeTab === 'upload' && (
                        <div className="h-full p-6">
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all ${isDragging
                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                    : 'border-zinc-300 dark:border-zinc-700 hover:border-[var(--color-primary)]/50'
                                    }`}
                            >
                                {isUploading ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <span className="material-symbols-outlined text-5xl text-[var(--color-primary)] animate-spin">progress_activity</span>
                                        <p className="text-sm text-[var(--color-text-muted)]">Uploading...</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="size-20 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                                            <span className="material-symbols-outlined text-4xl text-violet-600 dark:text-violet-400">cloud_upload</span>
                                        </div>
                                        <h3 className="text-lg font-semibold text-[var(--color-text-main)] mb-1">
                                            Drop files here to upload
                                        </h3>
                                        <p className="text-sm text-[var(--color-text-muted)] mb-6">
                                            or click to browse your computer
                                        </p>
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*,video/*"
                                                onChange={handleFileInputChange}
                                                className="hidden"
                                            />
                                            <span className="px-6 py-3 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-xl font-medium hover:brightness-110 transition-all inline-flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[18px]">folder_open</span>
                                                Browse Files
                                            </span>
                                        </label>
                                        <p className="text-xs text-zinc-400 mt-4">
                                            Supports: PNG, JPG, GIF, MP4 (max 10MB)
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Gallery Tab */}
                    {activeTab === 'gallery' && (
                        <div className="h-full p-6 overflow-y-auto">
                            {isLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <span className="material-symbols-outlined text-4xl text-[var(--color-primary)] animate-spin">progress_activity</span>
                                    <p className="text-sm text-[var(--color-text-muted)] mt-2">Loading library...</p>
                                </div>
                            ) : allAssets.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <div className="size-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-4xl text-zinc-400">photo_library</span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-[var(--color-text-main)] mb-1">No images yet</h3>
                                    <p className="text-sm text-[var(--color-text-muted)] mb-4">Upload images to see them here</p>
                                    <button
                                        onClick={() => setActiveTab('upload')}
                                        className="px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 rounded-lg transition-colors"
                                    >
                                        Upload Images
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-4">
                                    {allAssets.map(asset => (
                                        <div
                                            key={asset.id}
                                            className="group relative aspect-video rounded-xl overflow-hidden border-2 border-transparent hover:border-[var(--color-primary)] transition-all bg-zinc-100 dark:bg-zinc-800"
                                        >
                                            {asset.type === 'video' ? (
                                                <video
                                                    src={asset.url}
                                                    className="w-full h-full object-cover"
                                                    muted
                                                    playsInline
                                                    onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
                                                    onMouseLeave={e => {
                                                        const v = e.currentTarget as HTMLVideoElement;
                                                        v.pause();
                                                        v.currentTime = 0;
                                                    }}
                                                />
                                            ) : (
                                                <img
                                                    src={asset.thumbnailUrl || asset.url}
                                                    alt={asset.name}
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                />
                                            )}
                                            {/* Selection Overlay */}
                                            <div
                                                className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors cursor-pointer"
                                                onClick={() => {
                                                    if (onSelect) {
                                                        onSelect(asset);
                                                        onClose();
                                                    }
                                                }}
                                            />

                                            {/* Action Buttons */}
                                            <div className="absolute top-2 right-2 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(asset.url);
                                                        showSuccess("Link copied to clipboard");
                                                    }}
                                                    className="size-8 rounded-lg bg-white shadow-lg text-zinc-600 hover:text-[var(--color-primary)] flex items-center justify-center transition-colors"
                                                    title="Copy Link"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">link</span>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingImage(asset);
                                                    }}
                                                    className="size-8 rounded-lg bg-white shadow-lg text-zinc-600 hover:text-[var(--color-primary)] flex items-center justify-center transition-colors"
                                                    title="Edit Image"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteImage(asset);
                                                    }}
                                                    className="size-8 rounded-lg bg-white shadow-lg text-zinc-600 hover:text-red-500 flex items-center justify-center transition-colors"
                                                    title="Delete Image"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>

                                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                                                <p className="text-[10px] text-white truncate font-medium">{asset.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="h-full flex overflow-hidden">
                            {/* LEFT SIDEBAR - CONTROLS */}
                            <div className="w-[380px] border-r border-[var(--color-surface-border)] bg-zinc-50 dark:bg-black/20 flex flex-col p-6 overflow-y-auto shrink-0">
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="size-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                                        <span className="material-symbols-outlined text-white text-xl">auto_awesome</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[var(--color-text-main)] leading-tight">Nano Banana</h3>
                                        <p className="text-xs text-[var(--color-text-muted)]">Design Studio</p>
                                    </div>
                                </div>

                                {/* Mode Switcher */}
                                <div className="p-1 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex text-sm font-medium mb-6">
                                    <button
                                        onClick={() => { setAiMode('generate'); setReferenceImage(null); setAiView('input'); }}
                                        className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${aiMode === 'generate'
                                            ? 'bg-white dark:bg-zinc-700 text-[var(--color-text-main)] shadow-sm'
                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                                        Generate
                                    </button>
                                    <button
                                        onClick={() => { setAiMode('rework'); setAiView('input'); }}
                                        className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${aiMode === 'rework'
                                            ? 'bg-white dark:bg-zinc-700 text-[var(--color-text-main)] shadow-sm'
                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
                                        Rework
                                    </button>
                                </div>

                                {/* Rework: Reference Image Selector */}
                                {aiMode === 'rework' && (
                                    <div className="space-y-2 mb-6 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Source Image</label>
                                        {referenceImage ? (
                                            <div className="relative group rounded-xl overflow-hidden border border-[var(--color-surface-border)] bg-white dark:bg-zinc-800">
                                                <div className="aspect-video w-full bg-zinc-100 dark:bg-zinc-700">
                                                    <img src={referenceImage.thumbnailUrl || referenceImage.url} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button onClick={() => setReferenceImage(null)} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-lg text-xs font-bold transition-colors">
                                                        Change Image
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => setAiView('picking_reference')}
                                                className={`h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer p-4 text-center ${aiView === 'picking_reference'
                                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10 text-amber-600'
                                                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/5 hover:text-amber-500'
                                                    }`}
                                            >
                                                <span className="material-symbols-outlined mb-2 text-2xl">add_a_photo</span>
                                                <span className="text-xs font-medium">Select Reference Image</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Prompt Input */}
                                <div className="space-y-2 mb-6 flex-1">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Prompt</label>
                                    <textarea
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                        placeholder={aiMode === 'rework' ? "Describe how to transform the image..." : "Describe the image you want to see..."}
                                        className="w-full h-32 p-3 rounded-xl bg-white dark:bg-zinc-800 border border-[var(--color-surface-border)] focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-sm resize-none transition-all placeholder:text-zinc-400"
                                    />
                                </div>

                                {/* Style Selector */}
                                <div className="space-y-2 mb-6">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Style</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Photographic', 'Digital Art', 'Cinematic', '3D Render', 'Sketch', 'Abstract'].map(style => (
                                            <button
                                                key={style}
                                                onClick={() => setSelectedStyle(style)}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all truncate ${selectedStyle === style
                                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/50'
                                                    : 'bg-white dark:bg-zinc-800 border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:bg-zinc-50 dark:hover:bg-zinc-700'
                                                    }`}
                                            >
                                                {style}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Generate Button */}
                                <div className="mt-auto space-y-3">
                                    {aiUsage && (
                                        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] px-1">
                                            <span>Monthly Quota</span>
                                            <span className="font-medium text-[var(--color-text-main)]">{Math.max(0, (aiUsage.imageLimit || 50) - (aiUsage.imagesUsed || 0))} remaining</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleGenerateAI}
                                        disabled={!aiPrompt || (aiMode === 'rework' && !referenceImage) || isGenerating}
                                        className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-bold hover:brightness-110 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                                    >
                                        {isGenerating ? (
                                            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-[20px]">{aiMode === 'rework' ? 'auto_fix_high' : 'bolt'}</span>
                                        )}
                                        {isGenerating ? 'Designing...' : (aiMode === 'rework' ? 'Rework Image' : 'Generate')}
                                    </button>
                                </div>
                            </div>

                            {/* RIGHT CANVAS - PREVIEW & RESULTS */}
                            <div className="flex-1 bg-white/50 dark:bg-black/40 relative flex flex-col overflow-hidden">
                                {/* Dot Pattern Background */}
                                <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                                {/* Loading State */}
                                {aiView === 'loading' && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/80 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
                                        <div className="relative mx-auto size-24 mb-6">
                                            <div className="absolute inset-0 rounded-full border-4 border-amber-100 dark:border-amber-900/30"></div>
                                            <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-4xl text-amber-500 animate-pulse">auto_awesome</span>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-bold text-[var(--color-text-main)] animate-pulse">Creating your masterpiece...</h3>
                                        <p className="text-sm text-[var(--color-text-muted)] mt-2">This usually takes about 10-15 seconds</p>
                                    </div>
                                )}

                                {/* Default / Empty State */}
                                {aiView === 'input' && (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="size-24 rounded-3xl bg-amber-50 dark:bg-amber-900/10 flex items-center justify-center mb-6 shadow-sm rotate-3">
                                            <span className="material-symbols-outlined text-6xl text-amber-500/80">auto_awesome</span>
                                        </div>
                                        <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-3">Ready to Create</h2>
                                        <p className="text-[var(--color-text-muted)] max-w-sm leading-relaxed">
                                            {aiMode === 'generate'
                                                ? 'Describe your vision in the prompt box to generate high-quality unique assets.'
                                                : 'Select an image and describe how you want to transform it.'}
                                        </p>
                                    </div>
                                )}

                                {/* Picking Reference State */}
                                {aiView === 'picking_reference' && (
                                    <div className="absolute inset-0 z-20 bg-[var(--color-surface-card)] flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="p-4 border-b border-[var(--color-surface-border)] flex items-center justify-between bg-white dark:bg-zinc-900/50">
                                            <h3 className="font-bold text-[var(--color-text-main)]">Select Reference Image</h3>
                                            <button onClick={() => setAiView('input')} className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                                Cancel
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4">
                                            <div className="grid grid-cols-4 gap-4">
                                                {allAssets.filter(a => a.type === 'image').map(asset => (
                                                    <div
                                                        key={asset.id}
                                                        onClick={() => { setReferenceImage(asset); setAiView('input'); }}
                                                        className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-amber-500 transition-all shadow-sm"
                                                    >
                                                        <img src={asset.thumbnailUrl || asset.url} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                                    </div>
                                                ))}
                                                {allAssets.filter(a => a.type === 'image').length === 0 && (
                                                    <div className="col-span-4 text-center py-12 text-[var(--color-text-muted)]">
                                                        No images found. Switch to the Gallery tab to upload some.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Results State */}
                                {aiView === 'results' && (
                                    <div className="h-full flex flex-col">
                                        <div className="p-4 border-b border-[var(--color-surface-border)] flex items-center justify-between bg-white/50 dark:bg-black/20 backdrop-blur-sm z-10">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-amber-500">check_circle</span>
                                                <span className="font-bold text-[var(--color-text-main)]">Generation Complete</span>
                                            </div>
                                            <button
                                                onClick={() => setAiView('input')}
                                                className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                Back to Edit
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
                                            <div className={`grid gap-8 w-full max-w-4xl ${generatedImages.length === 1 ? 'grid-cols-1 max-w-xl' : 'grid-cols-2'}`}>
                                                {generatedImages.map((url, i) => (
                                                    <div key={i} className="group relative aspect-square rounded-2xl overflow-hidden shadow-2xl bg-zinc-900 ring-4 ring-white dark:ring-zinc-800 animate-in zoom-in-95 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                                                        <img src={url} alt="Generated" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-6">
                                                            <div className="flex gap-3">
                                                                <button
                                                                    onClick={() => handleSaveAIImage(url)}
                                                                    className="flex-1 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors shadow-lg flex items-center justify-center gap-2"
                                                                >
                                                                    <span className="material-symbols-outlined text-[20px]">save_alt</span>
                                                                    Save
                                                                </button>
                                                                <button
                                                                    onClick={() => window.open(url, '_blank')}
                                                                    className="size-12 rounded-xl bg-white/20 backdrop-blur text-white hover:bg-white/30 flex items-center justify-center transition-colors"
                                                                    title="Open Fullscreen"
                                                                >
                                                                    <span className="material-symbols-outlined">open_in_new</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {/* Stock Tab */}
                    {activeTab === 'stock' && (
                        <div className="h-full flex flex-col p-6">
                            {/* Search Bar */}
                            <form onSubmit={handleSearchStock} className="flex gap-3 mb-6">
                                <div className="relative flex-1">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">search</span>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search high-resolution photos from Unsplash..."
                                        className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all placeholder:text-zinc-500"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isStockLoading}
                                    className="px-6 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-[var(--color-primary)]/20 transition-all flex items-center gap-2"
                                >
                                    {isStockLoading ? (
                                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                    ) : (
                                        <span className="material-symbols-outlined">search</span>
                                    )}
                                    Search
                                </button>
                            </form>

                            {/* Content Area */}
                            <div className="flex-1 overflow-y-auto min-h-0">
                                {isStockLoading ? (
                                    <div className="h-full flex flex-col items-center justify-center">
                                        <span className="material-symbols-outlined text-4xl text-[var(--color-primary)] animate-spin">progress_activity</span>
                                        <p className="text-sm text-[var(--color-text-muted)] mt-2">Connecting to Unsplash...</p>
                                    </div>
                                ) : stockError ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                        <div className="size-16 rounded-2xl bg-red-50 dark:bg-red-900/10 flex items-center justify-center mb-4">
                                            <span className="material-symbols-outlined text-3xl text-red-500">error</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-1">Could not load images</h3>
                                        <p className="text-sm text-[var(--color-text-muted)] max-w-md">{stockError}</p>
                                        <button
                                            onClick={() => loadStockImages(searchQuery)}
                                            className="mt-4 px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 rounded-lg transition-colors"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                ) : stockImages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                        <span className="material-symbols-outlined text-4xl text-zinc-300 mb-2">image_search</span>
                                        <p className="text-[var(--color-text-muted)]">No images found for "{searchQuery}"</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-4 pb-4">
                                        {stockImages.map(image => (
                                            <div key={image.id} className="group relative aspect-video rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-sm border border-transparent hover:border-[var(--color-primary)] transition-all">
                                                <img
                                                    src={image.urls.small}
                                                    alt={image.alt_description || "Stock Image"}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />

                                                {/* Author Credit */}
                                                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <p className="text-[10px] text-white truncate">
                                                        by <span className="font-bold">{image.user.name}</span> on Unsplash
                                                    </p>
                                                </div>

                                                {/* Action Overlay */}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-[1px]">
                                                    <button
                                                        onClick={() => handleSaveStockImage(image)}
                                                        className="px-4 py-2 bg-white text-black rounded-lg text-xs font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">save_alt</span>
                                                        Save to Library
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Unsplash Attribution */}
                                {!stockError && !isStockLoading && stockImages.length > 0 && (
                                    <div className="py-4 text-center">
                                        <a href="https://unsplash.com/?utm_source=projectflow&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
                                            Photos provided by Unsplash
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Editor Overlay */}
            {editingImage && (
                <ImageEditor
                    src={editingImage.url}
                    onSave={handleSaveEditedImage}
                    onSaveReplace={handleSaveReplace}
                    onCancel={() => setEditingImage(null)}
                    circularCrop={circularCrop}
                />
            )}
        </div >,
        document.body
    );
};
