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
import { Button } from '../ui/Button';
import { downloadFile } from '../../utils/download';
import { useLanguage } from '../../context/LanguageContext';


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
    storagePath?: string;
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
    storagePath,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('gallery');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<MediaAsset[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();
    const { t } = useLanguage();
    const aiStyles = [
        { value: 'Photographic', label: t('mediaLibrary.ai.styles.photographic') },
        { value: 'Digital Art', label: t('mediaLibrary.ai.styles.digitalArt') },
        { value: 'Cinematic', label: t('mediaLibrary.ai.styles.cinematic') },
        { value: '3D Render', label: t('mediaLibrary.ai.styles.render3d') },
        { value: 'Sketch', label: t('mediaLibrary.ai.styles.sketch') },
        { value: 'Abstract', label: t('mediaLibrary.ai.styles.abstract') },
    ];

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
                setStockError(t('mediaLibrary.stock.errors.missingKey'));
            } else {
                setStockError(t('mediaLibrary.stock.errors.generic'));
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
            showSuccess(t('mediaLibrary.stock.saveSuccess'));
        } catch (error) {
            console.error("Failed to save stock image:", error);
            showError(t('mediaLibrary.stock.saveFailed'));
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

                if (storagePath) {
                    // Custom path override
                    const customRef = ref(storage, storagePath);
                    const customResult = await listAll(customRef);
                    allItems = customResult.items; // Assuming flat structure for now or filter if needed
                } else if (collectionType === 'user') {
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
            showError(t('mediaLibrary.upload.authRequired'));
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
                if (storagePath) {
                    path = `${storagePath}/${uniqueFileName}`;
                } else if (collectionType === 'user' && resolvedUserId) {
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
            showError(t('mediaLibrary.upload.failed'));
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
            showSuccess(t('mediaLibrary.edit.saveNewSuccess'));
        } catch (error) {
            console.error("Save edited image failed:", error);
            showError(t('mediaLibrary.edit.saveNewFailed'));
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

            showSuccess(t('mediaLibrary.edit.replaceSuccess'));
            setEditingImage(null);
        } catch (error) {
            console.error("Replace failed:", error);
            showError(t('mediaLibrary.edit.replaceFailed'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleGenerateAI = async () => {
        if (!aiPrompt) return;
        if (aiMode === 'rework' && !referenceImage) {
            showError(t('mediaLibrary.ai.errors.missingReference'));
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
            const msg = error?.message || t('mediaLibrary.ai.errors.generateFailed');
            // User-friendly error for API key issues
            if (msg.includes("API key")) {
                showError(t('mediaLibrary.ai.errors.missingKey'));
            } else if (msg.includes("limit")) {
                showError(t('mediaLibrary.ai.errors.limitReached'));
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
            showSuccess(t('mediaLibrary.ai.saveSuccess'));
        } catch (error) {
            console.error("Failed to save CORA image:", error);
            showError(t('mediaLibrary.ai.saveFailed'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteImage = async (asset: MediaAsset) => {
        const confirmed = await confirm(
            t('mediaLibrary.gallery.delete.title'),
            t('mediaLibrary.gallery.delete.body').replace('{name}', asset.name)
        );
        if (!confirmed) return;

        const resolvedTenantId = tenantId || auth.currentUser?.uid;
        if (!resolvedTenantId) return;

        try {
            // Delete from Storage
            const resolvedUserId = userId || auth.currentUser?.uid;
            let path = '';

            if (storagePath) {
                path = `${storagePath}/${asset.id}`;
            } else if (collectionType === 'user' && resolvedUserId) {
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
            showSuccess(t('mediaLibrary.gallery.delete.success').replace('{name}', asset.name));
        } catch (error) {
            console.error("Delete failed:", error);
            showError(t('mediaLibrary.gallery.delete.failed'));
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="media-library__overlay"
            onClick={(e) => {
                // Close when clicking backdrop
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="media-library">
                {/* Header */}
                <div className="media-library__header">
                    <div className="media-library__header-main">
                        <div className="media-library__brand">
                            <span className="material-symbols-outlined">perm_media</span>
                        </div>
                        <div>
                            <h2 className="media-library__title">{t('mediaLibrary.title')}</h2>
                            <p className="media-library__subtitle">
                                {collectionType === 'user'
                                    ? t('mediaLibrary.subtitle.user')
                                    : t('mediaLibrary.subtitle.project')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="media-library__close"
                        title={t('mediaLibrary.actions.close')}
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="media-library__tabs">
                    {[
                        {
                            id: 'gallery',
                            label: collectionType === 'user'
                                ? t('mediaLibrary.tabs.gallery.user')
                                : t('mediaLibrary.tabs.gallery.project'),
                            icon: 'photo_library'
                        },
                        { id: 'upload', label: t('mediaLibrary.tabs.upload'), icon: 'cloud_upload' },
                        { id: 'ai', label: t('mediaLibrary.tabs.ai'), icon: 'auto_awesome', accent: true },
                        { id: 'stock', label: t('mediaLibrary.tabs.stock'), icon: 'image_search' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`media-library__tab ${activeTab === tab.id ? 'is-active' : ''}`}
                        >
                            <span className={`material-symbols-outlined media-library__tab-icon ${tab.accent ? 'is-accent' : ''}`}>
                                {tab.icon}
                            </span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="media-library__content">
                    {/* Global Uploading Overlay */}
                    {isUploading && (
                        <div className="media-library__uploading">
                            <div className="media-library__uploading-card">
                                <span className="material-symbols-outlined">progress_activity</span>
                            </div>
                            <p className="media-library__uploading-text">{t('mediaLibrary.upload.overlay')}</p>
                        </div>
                    )}

                    {/* Upload Tab */}
                    {activeTab === 'upload' && (
                        <div className="media-library__panel media-library__panel--upload">
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`media-library__dropzone ${isDragging ? 'is-dragging' : ''}`}
                            >
                                {isUploading ? (
                                    <div className="media-library__dropzone-loading">
                                        <span className="material-symbols-outlined">progress_activity</span>
                                        <p>{t('mediaLibrary.upload.loading')}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="media-library__dropzone-icon">
                                            <span className="material-symbols-outlined">cloud_upload</span>
                                        </div>
                                        <h3 className="media-library__dropzone-title">
                                            {t('mediaLibrary.upload.title')}
                                        </h3>
                                        <p className="media-library__dropzone-subtitle">
                                            {t('mediaLibrary.upload.subtitle')}
                                        </p>
                                        <label className="media-library__file-label">
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*,video/*"
                                                onChange={handleFileInputChange}
                                                className="media-library__file-input"
                                            />
                                            <span className="media-library__file-button">
                                                <span className="material-symbols-outlined">folder_open</span>
                                                {t('mediaLibrary.upload.browse')}
                                            </span>
                                        </label>
                                        <p className="media-library__support-hint">
                                            {t('mediaLibrary.upload.supports')}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Gallery Tab */}
                    {activeTab === 'gallery' && (
                        <div className="media-library__panel media-library__panel--gallery">
                            {isLoading ? (
                                <div className="media-library__state">
                                    <span className="material-symbols-outlined">progress_activity</span>
                                    <p>{t('mediaLibrary.gallery.loading')}</p>
                                </div>
                            ) : allAssets.length === 0 ? (
                                <div className="media-library__empty">
                                    <div className="media-library__empty-icon">
                                        <span className="material-symbols-outlined">photo_library</span>
                                    </div>
                                    <h3 className="media-library__empty-title">{t('mediaLibrary.gallery.empty.title')}</h3>
                                    <p className="media-library__empty-text">{t('mediaLibrary.gallery.empty.body')}</p>
                                    <button
                                        onClick={() => setActiveTab('upload')}
                                        className="media-library__empty-action"
                                    >
                                        {t('mediaLibrary.gallery.empty.action')}
                                    </button>
                                </div>
                            ) : (
                                <div className="media-library__grid media-library__grid--assets">
                                    {allAssets.map(asset => (
                                        <div
                                            key={asset.id}
                                            className="media-library__asset"
                                        >
                                            {asset.type === 'video' ? (
                                                <video
                                                    src={asset.url}
                                                    className="media-library__asset-media"
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
                                                    className="media-library__asset-media"
                                                />
                                            )}
                                            {/* Selection Overlay */}
                                            <div
                                                className="media-library__asset-overlay"
                                                onClick={() => {
                                                    if (onSelect) {
                                                        onSelect(asset);
                                                        onClose();
                                                    }
                                                }}
                                            />

                                            {/* Action Buttons */}
                                            <div className="media-library__asset-actions">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(asset.url);
                                                        showSuccess(t('mediaLibrary.gallery.actions.copySuccess'));
                                                    }}
                                                    className="media-library__asset-action"
                                                    title={t('mediaLibrary.gallery.actions.copy')}
                                                >
                                                    <span className="material-symbols-outlined">link</span>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        downloadFile(asset.url, asset.name);
                                                    }}
                                                    className="media-library__asset-action"
                                                    title={t('mediaLibrary.gallery.actions.download')}
                                                >
                                                    <span className="material-symbols-outlined">download</span>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingImage(asset);
                                                    }}
                                                    className="media-library__asset-action"
                                                    title={t('mediaLibrary.gallery.actions.edit')}
                                                >
                                                    <span className="material-symbols-outlined">edit</span>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteImage(asset);
                                                    }}
                                                    className="media-library__asset-action is-danger"
                                                    title={t('mediaLibrary.gallery.actions.delete')}
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>

                                            <div className="media-library__asset-caption">
                                                <p>{asset.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="media-library__panel media-library__panel--ai">
                            {/* LEFT SIDEBAR - CONTROLS */}
                            <div className="media-library__ai-sidebar">
                                {/* Header */}
                                <div className="media-library__ai-header">
                                    <div className="media-library__ai-badge">
                                        <span className="material-symbols-outlined">auto_awesome</span>
                                    </div>
                                    <div>
                                        <h3 className="media-library__ai-title">{t('mediaLibrary.ai.title')}</h3>
                                        <p className="media-library__ai-subtitle">{t('mediaLibrary.ai.subtitle')}</p>
                                    </div>
                                </div>

                                {/* Mode Switcher */}
                                <div className="media-library__ai-mode">
                                    <button
                                        onClick={() => { setAiMode('generate'); setReferenceImage(null); setAiView('input'); }}
                                        className={`media-library__ai-mode-button ${aiMode === 'generate' ? 'is-active' : ''}`}
                                        aria-pressed={aiMode === 'generate'}
                                    >
                                        <span className="material-symbols-outlined">add_photo_alternate</span>
                                        {t('mediaLibrary.ai.mode.generate')}
                                    </button>
                                    <button
                                        onClick={() => { setAiMode('rework'); setAiView('input'); }}
                                        className={`media-library__ai-mode-button ${aiMode === 'rework' ? 'is-active' : ''}`}
                                        aria-pressed={aiMode === 'rework'}
                                    >
                                        <span className="material-symbols-outlined">auto_fix_high</span>
                                        {t('mediaLibrary.ai.mode.rework')}
                                    </button>
                                </div>

                                {/* Rework: Reference Image Selector */}
                                {aiMode === 'rework' && (
                                    <div className="media-library__ai-section">
                                        <label className="media-library__label">{t('mediaLibrary.ai.source.label')}</label>
                                        {referenceImage ? (
                                            <div className="media-library__reference">
                                                <div className="media-library__reference-media">
                                                    <img src={referenceImage.thumbnailUrl || referenceImage.url} alt={t('mediaLibrary.ai.source.previewAlt')} />
                                                </div>
                                                <div className="media-library__reference-overlay">
                                                    <button onClick={() => setReferenceImage(null)} className="media-library__reference-action">
                                                        {t('mediaLibrary.ai.source.change')}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => setAiView('picking_reference')}
                                                className={`media-library__reference-picker ${aiView === 'picking_reference' ? 'is-active' : ''}`}
                                            >
                                                <span className="material-symbols-outlined">add_a_photo</span>
                                                <span>{t('mediaLibrary.ai.source.pick')}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Prompt Input */}
                                <div className="media-library__ai-section is-flex">
                                    <label className="media-library__label">{t('mediaLibrary.ai.prompt.label')}</label>
                                    <textarea
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                        placeholder={aiMode === 'rework'
                                            ? t('mediaLibrary.ai.prompt.placeholder.rework')
                                            : t('mediaLibrary.ai.prompt.placeholder.generate')}
                                        className="media-library__textarea"
                                    />
                                </div>

                                {/* Style Selector */}
                                <div className="media-library__ai-section">
                                    <label className="media-library__label">{t('mediaLibrary.ai.style.label')}</label>
                                    <div className="media-library__style-grid">
                                        {aiStyles.map(style => (
                                            <button
                                                key={style.value}
                                                onClick={() => setSelectedStyle(style.value)}
                                                className={`media-library__style-button ${selectedStyle === style.value ? 'is-active' : ''}`}
                                            >
                                                {style.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Generate Button */}
                                <div className="media-library__ai-footer">
                                    {aiUsage && (
                                        <div className="media-library__quota">
                                            <span>{t('mediaLibrary.ai.quota.label')}</span>
                                            <span>
                                                {t('mediaLibrary.ai.quota.remaining').replace(
                                                    '{count}',
                                                    String(Math.max(0, (aiUsage.imageLimit || 50) - (aiUsage.imagesUsed || 0)))
                                                )}
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleGenerateAI}
                                        disabled={!aiPrompt || (aiMode === 'rework' && !referenceImage) || isGenerating}
                                        className="media-library__primary-action"
                                    >
                                        {isGenerating ? (
                                            <span className="material-symbols-outlined media-library__primary-icon is-loading">progress_activity</span>
                                        ) : (
                                            <span className="material-symbols-outlined media-library__primary-icon">{aiMode === 'rework' ? 'auto_fix_high' : 'bolt'}</span>
                                        )}
                                        {isGenerating
                                            ? t('mediaLibrary.ai.generate.loading')
                                            : aiMode === 'rework'
                                                ? t('mediaLibrary.ai.generate.rework')
                                                : t('mediaLibrary.ai.generate.generate')}
                                    </button>
                                </div>
                            </div>

                            {/* RIGHT CANVAS - PREVIEW & RESULTS */}
                            <div className="media-library__ai-canvas">
                                {/* Dot Pattern Background */}
                                <div className="media-library__ai-pattern" />

                                {/* Loading State */}
                                {aiView === 'loading' && (
                                    <div className="media-library__ai-loading">
                                        <div className="media-library__ai-loading-spinner">
                                            <div className="media-library__ai-loading-ring" />
                                            <div className="media-library__ai-loading-ring is-active" />
                                            <div className="media-library__ai-loading-icon">
                                                <span className="material-symbols-outlined">auto_awesome</span>
                                            </div>
                                        </div>
                                        <h3>{t('mediaLibrary.ai.loading.title')}</h3>
                                        <p>{t('mediaLibrary.ai.loading.subtitle')}</p>
                                    </div>
                                )}

                                {/* Default / Empty State */}
                                {aiView === 'input' && (
                                    <div className="media-library__ai-empty">
                                        <div className="media-library__ai-empty-icon">
                                            <span className="material-symbols-outlined">auto_awesome</span>
                                        </div>
                                        <h2>{t('mediaLibrary.ai.empty.title')}</h2>
                                        <p>
                                            {aiMode === 'generate'
                                                ? t('mediaLibrary.ai.empty.body.generate')
                                                : t('mediaLibrary.ai.empty.body.rework')}
                                        </p>
                                    </div>
                                )}

                                {/* Picking Reference State */}
                                {aiView === 'picking_reference' && (
                                    <div className="media-library__ai-reference">
                                        <div className="media-library__ai-reference-header">
                                            <h3>{t('mediaLibrary.ai.reference.title')}</h3>
                                            <button onClick={() => setAiView('input')} className="media-library__ai-secondary">
                                                {t('mediaLibrary.ai.reference.cancel')}
                                            </button>
                                        </div>
                                        <div className="media-library__ai-reference-body">
                                            <div className="media-library__ai-reference-grid">
                                                {allAssets.filter(a => a.type === 'image').map(asset => (
                                                    <div
                                                        key={asset.id}
                                                        onClick={() => { setReferenceImage(asset); setAiView('input'); }}
                                                        className="media-library__ai-reference-item"
                                                    >
                                                        <img src={asset.thumbnailUrl || asset.url} alt={asset.name} />
                                                        <div className="media-library__ai-reference-overlay" />
                                                    </div>
                                                ))}
                                                {allAssets.filter(a => a.type === 'image').length === 0 && (
                                                    <div className="media-library__ai-reference-empty">
                                                        {t('mediaLibrary.ai.reference.empty')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Results State */}
                                {aiView === 'results' && (
                                    <div className="media-library__ai-results">
                                        <div className="media-library__ai-results-header">
                                            <div className="media-library__ai-results-title">
                                                <span className="material-symbols-outlined">check_circle</span>
                                                <span>{t('mediaLibrary.ai.results.title')}</span>
                                            </div>
                                            <button
                                                onClick={() => setAiView('input')}
                                                className="media-library__ai-secondary"
                                            >
                                                {t('mediaLibrary.ai.results.back')}
                                            </button>
                                        </div>
                                        <div className="media-library__ai-results-body">
                                            <div className={`media-library__ai-results-grid ${generatedImages.length === 1 ? 'is-single' : ''}`}>
                                                {generatedImages.map((url, i) => (
                                                    <div
                                                        key={i}
                                                        className="media-library__ai-result"
                                                        style={{ animationDelay: `${i * 100}ms` }}
                                                    >
                                                        <img src={url} alt={t('mediaLibrary.ai.results.generatedAlt')} />
                                                        <div className="media-library__ai-result-overlay">
                                                            <div className="media-library__ai-result-actions">
                                                                <button
                                                                    onClick={() => handleSaveAIImage(url)}
                                                                    className="media-library__ai-save"
                                                                >
                                                                    <span className="material-symbols-outlined">save_alt</span>
                                                                    {t('mediaLibrary.ai.results.save')}
                                                                </button>
                                                                <button
                                                                    onClick={() => window.open(url, '_blank')}
                                                                    className="media-library__ai-open"
                                                                    title={t('mediaLibrary.ai.results.open')}
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
                        <div className="media-library__panel media-library__panel--stock">
                            {/* Search Bar */}
                            <form onSubmit={handleSearchStock} className="media-library__stock-search">
                                <div className="media-library__stock-search-field">
                                    <span className="material-symbols-outlined">search</span>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={t('mediaLibrary.stock.search.placeholder')}
                                        className="media-library__stock-input"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isStockLoading}
                                    className="media-library__stock-button"
                                >
                                    {isStockLoading ? (
                                        <span className="material-symbols-outlined">progress_activity</span>
                                    ) : (
                                        <span className="material-symbols-outlined">search</span>
                                    )}
                                    {t('mediaLibrary.stock.search.button')}
                                </Button>
                            </form>

                            {/* Content Area */}
                            <div className="media-library__stock-content">
                                {isStockLoading ? (
                                    <div className="media-library__state">
                                        <span className="material-symbols-outlined">progress_activity</span>
                                        <p>{t('mediaLibrary.stock.loading')}</p>
                                    </div>
                                ) : stockError ? (
                                    <div className="media-library__error">
                                        <div className="media-library__error-icon">
                                            <span className="material-symbols-outlined">error</span>
                                        </div>
                                        <h3>{t('mediaLibrary.stock.errors.title')}</h3>
                                        <p>{stockError}</p>
                                        <button
                                            onClick={() => loadStockImages(searchQuery)}
                                            className="media-library__error-action"
                                        >
                                            {t('mediaLibrary.stock.errors.retry')}
                                        </button>
                                    </div>
                                ) : stockImages.length === 0 ? (
                                    <div className="media-library__state is-empty">
                                        <span className="material-symbols-outlined">image_search</span>
                                        <p>
                                            {t('mediaLibrary.stock.empty').replace('{query}', searchQuery)}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="media-library__grid media-library__grid--stock">
                                        {stockImages.map(image => (
                                            <div key={image.id} className="media-library__stock-card">
                                                <img
                                                    src={image.urls.small}
                                                    alt={image.alt_description || t('mediaLibrary.stock.alt')}
                                                    className="media-library__stock-image"
                                                />

                                                {/* Author Credit */}
                                                <div className="media-library__stock-credit">
                                                    <p>
                                                        {t('mediaLibrary.stock.credit').replace('{name}', image.user.name)}
                                                    </p>
                                                </div>

                                                {/* Action Overlay */}
                                                <div className="media-library__stock-overlay">
                                                    <button
                                                        onClick={() => handleSaveStockImage(image)}
                                                        className="media-library__stock-action"
                                                    >
                                                        <span className="material-symbols-outlined">save_alt</span>
                                                        {t('mediaLibrary.stock.save')}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Unsplash Attribution */}
                                {!stockError && !isStockLoading && stockImages.length > 0 && (
                                    <div className="media-library__stock-attribution">
                                        <a href="https://unsplash.com/?utm_source=projectflow&utm_medium=referral" target="_blank" rel="noopener noreferrer">
                                            {t('mediaLibrary.stock.attribution')}
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
