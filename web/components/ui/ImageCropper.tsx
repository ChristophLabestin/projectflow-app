import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from './Button';
import { Modal } from './Modal';
import getCroppedImg from '../../utils/cropImage';

interface ImageCropperProps {
    imageSrc: string | null;
    aspectRatio: number; // e.g., 16/9 or 1
    onCropComplete: (croppedBlob: Blob) => void;
    onCancel: () => void;
    isOpen: boolean;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
    imageSrc,
    aspectRatio,
    onCropComplete,
    onCancel,
    isOpen,
}) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropAreaChange = useCallback((_: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        if (!imageSrc || !croppedAreaPixels) return;
        setIsProcessing(true);
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
            if (croppedImage) {
                onCropComplete(croppedImage);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title="Crop Image"
            size="lg"
            className="z-[60]" // Ensure it's above other modals (usually z-50)
            footer={
                <>
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleSave} isLoading={isProcessing}>Apply Crop</Button>
                </>
            }
        >
            <div className="relative w-full h-[400px] bg-black rounded-lg overflow-hidden">
                {imageSrc && (
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspectRatio}
                        onCropChange={onCropChange}
                        onCropComplete={onCropAreaChange}
                        onZoomChange={onZoomChange}
                    />
                )}
            </div>
            <div className="mt-4 flex items-center gap-4">
                <span className="text-sm text-muted">Zoom</span>
                <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1 bg-surface-border rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
                />
            </div>
        </Modal>
    );
};
