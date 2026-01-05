import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { TextInput } from '../Input/TextInput';
import { Search, UploadCloud, Sparkles, Globe, Loader2 } from 'lucide-react';
import { signInAnonymously } from 'firebase/auth';
import type { Asset } from '../../../services/storage/types';
import { useStorage } from '../../../hooks/useStorage';
import { auth } from '../../../config/firebase';
import './media-library.scss';

export interface MediaLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (assets: Asset[]) => void;
    title?: string;
    allowMultiSelect?: boolean;
}

type Tab = 'browse' | 'upload' | 'ai' | 'unsplash';

export const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    title = 'Media Library',
    allowMultiSelect = false
}) => {
    const storage = useStorage();
    const [activeTab, setActiveTab] = useState<Tab>('browse');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    // Used to clear the input after upload so the same file can be selected again if needed
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch assets on mount or when tab switches to 'browse'
    useEffect(() => {
        const init = async () => {
            if (isOpen && activeTab === 'browse') {
                try {
                    if (!auth.currentUser) {
                        await signInAnonymously(auth);
                    }
                    loadAssets();
                } catch (e) {
                    console.error("Auth/Load failed", e);
                }
            }
        };
        init();
    }, [isOpen, activeTab]);

    const loadAssets = async () => {
        setIsLoading(true);
        try {
            const items = await storage.listAssets('media');
            setAssets(items);
        } catch (error) {
            console.error("Failed to load assets:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const processUpload = async (files: FileList) => {
        setIsUploading(true);
        try {
            if (!auth.currentUser) await signInAnonymously(auth);

            for (let i = 0; i < files.length; i++) {
                await storage.uploadFile(files[i], 'media');
            }
            setActiveTab('browse');
            loadAssets();
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Upload failed. Please try again.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        await processUpload(files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;
        await processUpload(files);
    };

    const handleAssetClick = (id: string) => {
        const newSelected = new Set(allowMultiSelect ? selectedIds : []);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            if (!allowMultiSelect) newSelected.clear();
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleConfirm = () => {
        const selectedAssets = assets.filter(a => selectedIds.has(a.id));
        onSelect(selectedAssets);
        onClose();
    };

    const filteredAssets = assets.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderTabs = () => (
        <div className="media-library__tabs">
            <button
                className={`media-library__tab ${activeTab === 'browse' ? 'media-library__tab--active' : ''}`}
                onClick={() => setActiveTab('browse')}
            >
                Browse
            </button>
            <button
                className={`media-library__tab ${activeTab === 'upload' ? 'media-library__tab--active' : ''}`}
                onClick={() => setActiveTab('upload')}
            >
                Upload
            </button>
            <button
                className={`media-library__tab ${activeTab === 'ai' ? 'media-library__tab--active' : ''}`}
                onClick={() => setActiveTab('ai')}
            >
                AI Gen
            </button>
            <button
                className={`media-library__tab ${activeTab === 'unsplash' ? 'media-library__tab--active' : ''}`}
                onClick={() => setActiveTab('unsplash')}
            >
                Unsplash
            </button>
        </div>
    );

    const renderBrowse = () => (
        <>
            <div className="media-toolbar">
                <TextInput
                    placeholder="Search assets..."
                    rightElement={<Search size={16} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <Loader2 className="animate-spin" size={32} color="var(--color-primary)" />
                </div>
            ) : filteredAssets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    No media found.
                </div>
            ) : (
                <div className="media-grid">
                    {filteredAssets.map(asset => (
                        <div
                            key={asset.id}
                            className={`media-grid__item ${selectedIds.has(asset.id) ? 'media-grid__item--selected' : ''}`}
                            onClick={() => handleAssetClick(asset.id)}
                            title={asset.name}
                        >
                            <img src={asset.url} alt={asset.name} loading="lazy" />
                        </div>
                    ))}
                </div>
            )}
        </>
    );

    const renderUpload = () => (
        <label
            className={`media-upload ${isDragging ? 'media-upload--dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input
                type="file"
                ref={fileInputRef}
                style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}
                multiple
                accept="image/*"
                onChange={handleFileUpload}
            />
            {isUploading ? (
                <div style={{ textAlign: 'center' }}>
                    <Loader2 className="animate-spin" size={48} color="var(--color-primary)" />
                    <p style={{ marginTop: '12px' }}>Uploading...</p>
                </div>
            ) : (
                <>
                    <UploadCloud className="media-upload__icon" />
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontWeight: 500, color: 'var(--color-text-main)' }}>
                            {isDragging ? "Drop files now" : "Click to upload files or drag and drop"}
                        </p>
                        <p style={{ fontSize: '0.8rem' }}>SVG, PNG, JPG or GIF</p>
                    </div>
                </>
            )}
        </label>
    );

    const renderAI = () => (
        <div className="media-ai">
            <div style={{ display: 'flex', gap: '8px' }}>
                <TextInput
                    placeholder="Describe the image you want to generate..."
                    style={{ flex: 1 }}
                />
                <Button variant="primary">
                    <Sparkles size={16} style={{ marginRight: '8px' }} />
                    Generate
                </Button>
            </div>
            <div className="media-ai__preview">
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    Generated images will appear here
                </p>
            </div>
        </div>
    );

    const renderUnsplash = () => (
        <>
            <div className="media-toolbar">
                <TextInput
                    placeholder="Search Unsplash..."
                    rightElement={<Search size={16} />}
                />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--color-text-muted)' }}>
                <div style={{ textAlign: 'center', opacity: 0.7 }}>
                    <Globe size={48} style={{ marginBottom: '12px' }} />
                    <p>Search specifically on Unsplash</p>
                </div>
            </div>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="lg"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={selectedIds.size === 0 && activeTab === 'browse'}>
                        Insert Selected
                    </Button>
                </>
            }
        >
            <div className="media-library">
                {renderTabs()}
                <div className="media-library__content">
                    {activeTab === 'browse' && renderBrowse()}
                    {activeTab === 'upload' && renderUpload()}
                    {activeTab === 'ai' && renderAI()}
                    {activeTab === 'unsplash' && renderUnsplash()}
                </div>
            </div>
        </Modal>
    );
};
