import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../context/LanguageContext';
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
    const { t } = useLanguage();
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
            <div className="w-[1100px] h-[800px] max-w-[95vw] max-h-[90vh] bg-card rounded-xl flex overflow-hidden shadow-2xl">
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
                                alt={t('imageEditor.cropAlt')}
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
                <div className="w-80 bg-surface-paper border-l border-surface flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-surface flex justify-between items-center">
                        <h3 className="font-bold">{t('imageEditor.title')}</h3>
                        <button onClick={onCancel} className="text-muted hover:text-main">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-surface">
                        <button
                            onClick={() => setActiveTab('crop')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'crop'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted hover:text-main'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">crop_rotate</span>
                                {t('imageEditor.tab.crop')}
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('filters')}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'filters'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted hover:text-main'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">tune</span>
                                {t('imageEditor.tab.filters')}
                            </div>
                        </button>
                    </div>

                    {/* Controls */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {activeTab === 'crop' && (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-muted uppercase tracking-wider">{t('imageEditor.aspectRatio')}</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {ASPECT_RATIOS.map((ratio) => (
                                            <button
                                                key={ratio.label === 'Free' ? t('imageEditor.free') : ratio.label}
                                                onClick={() => setAspect(ratio.value)}
                                                className={`py-2 text-[10px] font-bold border rounded-lg transition-all ${aspect === ratio.value
                                                    ? 'bg-primary border-primary text-on-primary'
                                                    : 'bg-surface-card text-muted border-surface hover:border-primary/50'
                                                    }`}
                                            >
                                                {ratio.label === 'Free' ? t('imageEditor.free') : ratio.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-surface">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-bold text-muted">{t('imageEditor.zoom')}</label>
                                        <span className="text-xs text-subtle">{zoom.toFixed(1)}x</span>
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

                                <div className="space-y-2 pt-4 border-t border-surface">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-bold text-muted">{t('imageEditor.rotation')}</label>
                                        <span className="text-xs text-subtle">{rotation}°</span>
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
                                                className="flex-1 py-1 text-xs border border-surface rounded hover:bg-surface-hover"
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
                                    className="w-full py-2 text-xs font-medium text-muted border border-surface rounded hover:bg-surface-hover transition-colors flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                    {t('imageEditor.resetCrop')}
                                </button>
                            </div>
                        )}

                        {activeTab === 'filters' && (
                            <div className="space-y-6">
                                {[
                                    { key: 'brightness', label: t('imageEditor.filter.brightness'), min: 0, max: 200, unit: '%' },
                                    { key: 'contrast', label: t('imageEditor.filter.contrast'), min: 0, max: 200, unit: '%' },
                                    { key: 'saturate', label: t('imageEditor.filter.saturation'), min: 0, max: 200, unit: '%' },
                                    { key: 'grayscale', label: t('imageEditor.filter.grayscale'), min: 0, max: 100, unit: '%' },
                                    { key: 'sepia', label: t('imageEditor.filter.sepia'), min: 0, max: 100, unit: '%' },
                                ].map((filter) => (
                                    <div key={filter.key} className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-bold text-muted">{filter.label}</label>
                                            <span className="text-xs text-subtle">
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
                                    className="w-full py-2 text-xs font-medium text-primary border border-primary rounded hover:bg-primary/5"
                                >
                                    {t('imageEditor.resetFilters')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-surface flex gap-2">
                        <button
                            onClick={() => handleSave('new')}
                            disabled={isProcessing || !completedCrop}
                            className="flex-1 py-2.5 bg-primary text-on-primary rounded-lg font-medium hover:brightness-110 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isProcessing && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                            {t('imageEditor.save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
