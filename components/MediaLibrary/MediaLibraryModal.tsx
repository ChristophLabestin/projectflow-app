import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { storage, auth } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { useConfirm, useToast } from '../../context/UIContext';
import { ImageEditor } from './ImageEditor';

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
    projectId: string;
    tenantId?: string;
    existingAssets?: MediaAsset[];
    deferredUpload?: boolean;
}

type TabType = 'upload' | 'gallery' | 'stock' | 'ai';

const STOCK_IMAGES = [
    { id: 'stock-1', url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800', name: 'Business Meeting', thumbnailUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=300' },
    { id: 'stock-2', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800', name: 'Analytics Dashboard', thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=300' },
    { id: 'stock-3', url: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800', name: 'Team Collaboration', thumbnailUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=300' },
    { id: 'stock-4', url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800', name: 'Modern Office', thumbnailUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=300' },
    { id: 'stock-5', url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800', name: 'Creative Team', thumbnailUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=300' },
    { id: 'stock-6', url: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800', name: 'Technology', thumbnailUrl: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=300' },
    { id: 'stock-7', url: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800', name: 'Data Visualization', thumbnailUrl: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=300' },
    { id: 'stock-8', url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800', name: 'Startup Office', thumbnailUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=300' },
];

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
    isOpen,
    onClose,
    onSelect,
    projectId,
    tenantId,
    existingAssets = [],
    deferredUpload = false,
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

    // Fetch existing assets from Storage
    useEffect(() => {
        if (!isOpen || !projectId) return;

        const fetchExistingAssets = async () => {
            setIsLoading(true);
            const resolvedTenantId = tenantId || auth.currentUser?.uid;
            if (!resolvedTenantId || deferredUpload) return;

            try {
                // 1. Fetch from Root (legacy/uncategorized)
                const rootRef = ref(storage, `tenants/${tenantId}/projects`);
                const rootResult = await listAll(rootRef);
                const rootItems = rootResult.items.filter(item => item.name.includes('_media_'));

                // 2. Fetch from Project Subfolder
                let projectItems: any[] = [];
                try {
                    const projectRef = ref(storage, `tenants/${tenantId}/projects/${projectId}`);
                    const projectResult = await listAll(projectRef);
                    projectItems = projectResult.items.filter(item => item.name.includes('_media_'));
                } catch (e) {
                    // Folder might not exist yet for new projects, that's fine
                }

                const allItems = [...rootItems, ...projectItems];

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
                        type: 'image',
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
    const allAssets = deferredUpload
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
                // New Pattern: {timestamp}_media_{projectId}_{filename}
                const uniqueFileName = `${timestamp}_media_${projectId}_${cleanFileName}`;
                const folderPath = projectId && projectId !== 'uncategorized' ? `${projectId}/` : '';
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
            // Search for the asset in both root and project subfolder
            // Since we don't store the full path in the DB/State (just id as filename),
            // we check both common locations.
            let storageRef = ref(storage, `tenants/${resolvedTenantId}/projects/${editingImage.id}`);

            if (projectId && projectId !== 'uncategorized') {
                const projectScopedRef = ref(storage, `tenants/${resolvedTenantId}/projects/${projectId}/${editingImage.id}`);
                // Simple heuristic: if the asset belongs to this project, it's likely in the subfolder
                if (editingImage.projectId === projectId) {
                    storageRef = projectScopedRef;
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
        setIsGenerating(true);

        try {
            // Simulate AI delay
            await new Promise(resolve => setTimeout(resolve, 2500));

            // Mock generative results using placeholder service or similar
            const mockResults = [
                `https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&q=80&sig=${Math.random()}`,
                `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80&sig=${Math.random()}`,
                `https://images.unsplash.com/photo-1620121692029-d088224efc74?w=800&q=80&sig=${Math.random()}`,
                `https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80&sig=${Math.random()}`
            ];

            setGeneratedImages(mockResults);
        } catch (error) {
            console.error("AI Generation failed:", error);
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
        } catch (error) {
            console.error("Failed to save AI image:", error);
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
            const storageRef = ref(storage, `tenants/${resolvedTenantId}/projects/${asset.id}`);
            await deleteObject(storageRef);

            // Update UI
            setUploadedFiles(prev => prev.filter(f => f.id !== asset.id));
            showSuccess(`"${asset.name}" has been deleted.`);
        } catch (error) {
            console.error("Delete failed:", error);
            showError("Failed to delete image.");
        }
    };

    const filteredStockImages = STOCK_IMAGES.filter(img =>
        img.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
                // Close when clicking backdrop
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl w-[900px] max-w-[95vw] h-[700px] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[var(--color-surface-border)]">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white">perm_media</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--color-text-main)]">Media Library</h2>
                            <p className="text-xs text-[var(--color-text-muted)]">Select or upload images for your email</p>
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
                        { id: 'gallery', label: 'Project Images', icon: 'photo_library' },
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
                <div className="flex-1 overflow-hidden">
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
                                            <img
                                                src={asset.thumbnailUrl || asset.url}
                                                alt={asset.name}
                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            />
                                            {/* Selection Overlay */}
                                            <div
                                                className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors cursor-pointer"
                                                onClick={() => {
                                                    onSelect(asset);
                                                    onClose();
                                                }}
                                            />

                                            {/* Action Buttons */}
                                            <div className="absolute top-2 right-2 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
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

                    {/* Nano Banana AI Tab */}
                    {activeTab === 'ai' && (
                        <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
                            <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-4">
                                <div className="size-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center animate-bounce-slow">
                                    <span className="material-symbols-outlined text-4xl text-amber-500">auto_awesome</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Nano Banana AI</h3>
                                    <p className="text-sm text-[var(--color-text-muted)]">Generate custom images using text prompts and presets.</p>
                                </div>
                            </div>

                            <div className="max-w-3xl mx-auto w-full space-y-6">
                                {/* Prompt Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Describe the image you want</label>
                                    <div className="relative">
                                        <textarea
                                            value={aiPrompt}
                                            onChange={e => setAiPrompt(e.target.value)}
                                            placeholder="e.g. A vibrant watercolor of a project management workspace with floating task cards..."
                                            className="w-full h-32 p-4 rounded-2xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm resize-none"
                                        />
                                        <button
                                            onClick={handleGenerateAI}
                                            disabled={!aiPrompt || isGenerating}
                                            className="absolute bottom-4 right-4 px-6 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:brightness-110 flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:shadow-none transition-all"
                                        >
                                            {isGenerating ? (
                                                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-[20px]">bolt</span>
                                            )}
                                            {isGenerating ? 'Generating...' : 'Generate'}
                                        </button>
                                    </div>
                                </div>

                                {/* Style Presets */}
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Style Presets</label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {['Photographic', 'Digital Art', 'Minimalist', '3D Render', 'Sketch', 'Abstract', 'Cinematic', 'Pixel Art'].map(style => (
                                            <button
                                                key={style}
                                                onClick={() => setSelectedStyle(style)}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${selectedStyle === style
                                                    ? 'bg-amber-500/10 border-amber-500 text-amber-600'
                                                    : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-amber-500/30'
                                                    }`}
                                            >
                                                {style}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Results */}
                                {generatedImages.length > 0 && (
                                    <div className="pt-6 border-t border-[var(--color-surface-border)] space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold">Generated Results</h4>
                                            <button
                                                onClick={() => setGeneratedImages([])}
                                                className="text-xs text-zinc-400 hover:text-zinc-600"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            {generatedImages.map((url, i) => (
                                                <div key={i} className="group relative aspect-video rounded-2xl overflow-hidden border border-[var(--color-surface-border)] shadow-sm">
                                                    <img src={url} alt="Generated" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                                                        <button
                                                            onClick={() => handleSaveAIImage(url)}
                                                            className="px-4 py-2 bg-white text-black rounded-lg text-xs font-bold hover:scale-105 transition-transform flex items-center gap-1.5"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">add</span>
                                                            Save to Gallery
                                                        </button>
                                                        <button
                                                            onClick={() => { onSelect({ id: `ai-${Date.now()}`, url, name: 'AI Image', type: 'image', source: 'upload' }); onClose(); }}
                                                            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:scale-105 transition-transform flex items-center gap-1.5"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">check</span>
                                                            Use Now
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
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
                />
            )}
        </div>,
        document.body
    );
};
