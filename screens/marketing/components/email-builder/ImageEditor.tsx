import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop/types';

interface ImageEditorProps {
    src: string;
    onSave: (newSrc: string) => void;
    onCancel: () => void;
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

export const ImageEditor: React.FC<ImageEditorProps> = ({ src, onSave, onCancel }) => {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [activeTab, setActiveTab] = useState<'crop' | 'filters'>('crop');
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid cross-origin issues on CodeSandbox
            image.src = url;
        });

    const getRadianAngle = (degreeValue: number) => {
        return (degreeValue * Math.PI) / 180;
    };

    const handleSave = async () => {
        setIsProcessing(true);
        try {
            const image = await createImage(src);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx || !croppedAreaPixels) return;

            const safeArea = Math.max(image.width, image.height) * 2;

            // set each dimensions to double largest dimension to allow for a safe area for the
            // image to rotate in without being clipped by canvas context
            canvas.width = safeArea;
            canvas.height = safeArea;

            // translate canvas context to a central location on image to allow rotating around the center.
            ctx.translate(safeArea / 2, safeArea / 2);
            ctx.rotate(getRadianAngle(rotation));
            ctx.translate(-safeArea / 2, -safeArea / 2);

            // Apply filters
            ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)`;

            // draw rotated image and store data.
            ctx.drawImage(
                image,
                safeArea / 2 - image.width * 0.5,
                safeArea / 2 - image.height * 0.5
            );

            const data = ctx.getImageData(0, 0, safeArea, safeArea);

            // set canvas width to final desired crop size - this will clear existing context
            canvas.width = croppedAreaPixels.width;
            canvas.height = croppedAreaPixels.height;

            // paste generated rotate image with correct offsets for x,y crop values.
            ctx.putImageData(
                data,
                Math.round(0 - safeArea / 2 + image.width * 0.5 - croppedAreaPixels.x),
                Math.round(0 - safeArea / 2 + image.height * 0.5 - croppedAreaPixels.y)
            );

            // As Base64 string
            const base64Image = canvas.toDataURL('image/jpeg', 0.9);
            onSave(base64Image);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="w-[1000px] h-[700px] max-w-[95vw] max-h-[90vh] bg-[var(--color-surface-card)] rounded-xl flex overflow-hidden shadow-2xl">
                {/* Canvas Area */}
                <div className="flex-1 relative bg-black">
                    <Cropper
                        image={src}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={undefined} // Free crop
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        onRotationChange={setRotation}
                        style={{
                            containerStyle: { filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)` }
                        }}
                    />
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
                                <div className="space-y-2">
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
                                        className="w-full accent-[var(--color-primary)]"
                                    />
                                </div>
                                <div className="space-y-2">
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
                            disabled={isProcessing}
                            className="flex-1 py-2.5 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:brightness-110 flex items-center justify-center gap-2"
                        >
                            {isProcessing && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
