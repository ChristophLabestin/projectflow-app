import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageEditorProps {
    src: string;
    onSave: (dataUrl: string) => void;
    onSaveReplace?: (dataUrl: string) => void;
    onCancel: () => void;
    circularCrop?: boolean;
}

interface FilterState {
    brightness: number;
    contrast: number;
    saturate: number;
    grayscale: number;
    sepia: number;
}

const DEFAULT_FILTERS: FilterState = {
    brightness: 100,
    contrast: 100,
    saturate: 100,
    grayscale: 0,
    sepia: 0,
};

function centerAspectCrop(
    mediaWidth: number,
    mediaHeight: number,
    aspect: number | undefined,
) {
    const effectiveAspect = aspect || 4 / 3;
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            effectiveAspect,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    );
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ src, onSave, onCancel, onSaveReplace, circularCrop }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [activeTab, setActiveTab] = useState<'crop' | 'filters'>('crop');
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aspect, setAspect] = useState<number | undefined>(4 / 3);

    const ASPECT_RATIOS = [
        { label: 'Free', value: undefined },
        { label: '1:1', value: 1 / 1 },
        { label: '4:3', value: 4 / 3 },
        { label: '16:9', value: 16 / 9 },
        { label: '3:2', value: 3 / 2 },
        { label: '2:3', value: 2 / 3 },
        { label: '3:4', value: 3 / 4 },
        { label: '9:16', value: 9 / 16 },
    ];

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height, aspect));
    }

    useEffect(() => {
        if (imgRef.current) {
            const { width, height } = imgRef.current;
            setCrop(centerAspectCrop(width, height, aspect));
        }
    }, [aspect]);

    const handleSave = async (mode: 'new' | 'replace') => {
        if (!imgRef.current || !completedCrop) return;
        setIsProcessing(true);

        try {
            const image = imgRef.current;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) return;

            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;

            canvas.width = completedCrop.width * scaleX;
            canvas.height = completedCrop.height * scaleY;

            // Apply filters
            ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)`;

            // Draw image
            ctx.drawImage(
                image,
                completedCrop.x * scaleX,
                completedCrop.y * scaleY,
                completedCrop.width * scaleX,
                completedCrop.height * scaleY,
                0,
                0,
                completedCrop.width * scaleX,
                completedCrop.height * scaleY
            );

            // As Base64 string
            const dataUrl = canvas.toDataURL('image/png');
            if (mode === 'replace' && onSaveReplace) {
                onSaveReplace(dataUrl);
            } else {
                onSave(dataUrl);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="w-[1100px] h-[800px] max-w-[95vw] max-h-[90vh] bg-[var(--color-surface-card)] rounded-xl flex overflow-hidden shadow-2xl">
                {/* Canvas Area */}
                <div className="flex-1 relative bg-black flex items-center justify-center p-8 overflow-hidden">
                    <div className="relative max-h-full max-w-full">
                        <ReactCrop
                            crop={crop}
                            onChange={(c) => setCrop(c)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={aspect}
                            className="max-h-full max-w-full"
                            circularCrop={circularCrop}
                        >
                            <img
                                ref={imgRef}
                                alt="Crop me"
                                src={src}
                                style={{
                                    transform: `rotate(${rotation}deg) scale(${zoom})`,
                                    filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)`,
                                    maxHeight: '70vh',
                                    maxWidth: '100%',
                                }}
                                onLoad={onImageLoad}
                                crossOrigin="anonymous"
                            />
                        </ReactCrop>
                    </div>
                </div>

                {/* Controls Sidebar */}
                <div className="w-80 bg-[var(--color-surface-paper)] border-l border-[var(--color-surface-border)] flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-[var(--color-surface-border)] flex justify-between items-center">
                        <h3 className="font-bold">Edit Image</h3>
                        <button onClick={onCancel} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-[var(--color-surface-border)]">
                        <button
                            onClick={() => setActiveTab('crop')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'crop'
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">crop_rotate</span>
                                Crop & Rotate
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('filters')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'filters'
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">tune</span>
                                Filters
                            </div>
                        </button>
                    </div>

                    {/* Controls */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {activeTab === 'crop' && (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Aspect Ratio</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {ASPECT_RATIOS.map((ratio) => (
                                            <button
                                                key={ratio.label}
                                                onClick={() => setAspect(ratio.value)}
                                                className={`py-2 text-[10px] font-bold border rounded-lg transition-all ${aspect === ratio.value
                                                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-primary-text)]'
                                                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-[var(--color-primary)]/50'
                                                    }`}
                                            >
                                                {ratio.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-bold text-zinc-500">Zoom</label>
                                        <span className="text-xs text-zinc-400">{zoom.toFixed(1)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        value={zoom}
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="w-full accent-[var(--color-primary)] mb-4"
                                    />
                                </div>

                                <div className="space-y-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-bold text-zinc-500">Rotation</label>
                                        <span className="text-xs text-zinc-400">{rotation}°</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={360}
                                        value={rotation}
                                        onChange={(e) => setRotation(Number(e.target.value))}
                                        className="w-full accent-[var(--color-primary)]"
                                    />
                                    <div className="flex gap-2 mt-2">
                                        {[0, 90, 180, 270].map(deg => (
                                            <button
                                                key={deg}
                                                onClick={() => setRotation(deg)}
                                                className="flex-1 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                            >
                                                {deg}°
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (imgRef.current) {
                                            setCrop(centerAspectCrop(imgRef.current.width, imgRef.current.height, undefined));
                                        }
                                        setZoom(1);
                                        setRotation(0);
                                        setAspect(undefined);
                                    }}
                                    className="w-full py-2 text-xs font-medium text-[var(--color-text-muted)] border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                    Reset Crop & Orientation
                                </button>
                            </div>
                        )}

                        {activeTab === 'filters' && (
                            <div className="space-y-6">
                                {[
                                    { key: 'brightness', label: 'Brightness', min: 0, max: 200, unit: '%' },
                                    { key: 'contrast', label: 'Contrast', min: 0, max: 200, unit: '%' },
                                    { key: 'saturate', label: 'Saturation', min: 0, max: 200, unit: '%' },
                                    { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, unit: '%' },
                                    { key: 'sepia', label: 'Sepia', min: 0, max: 100, unit: '%' },
                                ].map((filter) => (
                                    <div key={filter.key} className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-bold text-zinc-500">{filter.label}</label>
                                            <span className="text-xs text-zinc-400">
                                                {filters[filter.key as keyof FilterState]}{filter.unit}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={filter.min}
                                            max={filter.max}
                                            value={filters[filter.key as keyof FilterState]}
                                            onChange={(e) => setFilters(prev => ({ ...prev, [filter.key]: Number(e.target.value) }))}
                                            className="w-full accent-[var(--color-primary)]"
                                        />
                                    </div>
                                ))}
                                <button
                                    onClick={() => setFilters(DEFAULT_FILTERS)}
                                    className="w-full py-2 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded hover:bg-[var(--color-primary)]/5"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-[var(--color-surface-border)] flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isProcessing || !completedCrop}
                            className="flex-1 py-2.5 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-lg font-medium hover:brightness-110 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isProcessing && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
