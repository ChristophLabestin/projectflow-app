import React, { useState, useCallback } from 'react';

interface MediaAsset {
    id: string;
    url: string;
    thumbnailUrl?: string;
    name: string;
    type: 'image' | 'video';
    source: 'upload' | 'stock';
    createdAt?: any;
}

interface MediaLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (asset: MediaAsset) => void;
    projectId: string;
    existingAssets?: MediaAsset[];
}

type TabType = 'upload' | 'gallery' | 'stock';

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
    existingAssets = []
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('gallery');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<MediaAsset[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    // Combine existing assets with newly uploaded ones
    const allAssets = [...existingAssets, ...uploadedFiles];

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

        // Simulate upload - in production, upload to Firebase Storage
        const newAssets: MediaAsset[] = files.map((file, idx) => ({
            id: `upload-${Date.now()}-${idx}`,
            url: URL.createObjectURL(file),
            thumbnailUrl: URL.createObjectURL(file),
            name: file.name,
            type: file.type.startsWith('image/') ? 'image' : 'video',
            source: 'upload' as const,
            createdAt: new Date()
        }));

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        setUploadedFiles(prev => [...prev, ...newAssets]);
        setIsUploading(false);
        setActiveTab('gallery');
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFileUpload(Array.from(e.target.files));
        }
    };

    const filteredStockImages = STOCK_IMAGES.filter(img =>
        img.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
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
                        { id: 'gallery', label: 'My Images', icon: 'photo_library' },
                        { id: 'upload', label: 'Upload', icon: 'cloud_upload' },
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
                            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
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
                                            <span className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium hover:brightness-110 transition-all inline-flex items-center gap-2">
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
                            {allAssets.length === 0 ? (
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
                                        <button
                                            key={asset.id}
                                            onClick={() => {
                                                onSelect(asset);
                                                onClose();
                                            }}
                                            className="group relative aspect-video rounded-xl overflow-hidden border-2 border-transparent hover:border-[var(--color-primary)] transition-all"
                                        >
                                            <img
                                                src={asset.thumbnailUrl || asset.url}
                                                alt={asset.name}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                <span className="material-symbols-outlined text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity">
                                                    add_circle
                                                </span>
                                            </div>
                                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                                <p className="text-xs text-white truncate">{asset.name}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stock Photos Tab */}
                    {activeTab === 'stock' && (
                        <div className="h-full flex flex-col">
                            {/* Search */}
                            <div className="p-4 border-b border-[var(--color-surface-border)]">
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">search</span>
                                    <input
                                        type="text"
                                        placeholder="Search free stock photos..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm"
                                    />
                                </div>
                            </div>

                            {/* Stock Grid */}
                            <div className="flex-1 p-4 overflow-y-auto">
                                <div className="grid grid-cols-4 gap-4">
                                    {filteredStockImages.map(img => (
                                        <button
                                            key={img.id}
                                            onClick={() => {
                                                onSelect({
                                                    id: img.id,
                                                    url: img.url,
                                                    thumbnailUrl: img.thumbnailUrl,
                                                    name: img.name,
                                                    type: 'image',
                                                    source: 'stock'
                                                });
                                                onClose();
                                            }}
                                            className="group relative aspect-video rounded-xl overflow-hidden border-2 border-transparent hover:border-[var(--color-primary)] transition-all"
                                        >
                                            <img
                                                src={img.thumbnailUrl}
                                                alt={img.name}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                <span className="material-symbols-outlined text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity">
                                                    add_circle
                                                </span>
                                            </div>
                                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                                <p className="text-xs text-white truncate">{img.name}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-center text-[var(--color-text-muted)] mt-6">
                                    Free photos from Unsplash. For production, integrate with Unsplash API.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
