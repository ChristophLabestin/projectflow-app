/**
 * Snap: scale an image down before it goes to the model (long side ≤ 2000 px, JPEG). The original file
 * stays with the caller so it can be attached to the created task unchanged.
 */
const MAX_SIDE = 2000;
export const SNAP_MAX_BYTES = 20 * 1024 * 1024;

export const isSnapImage = (file: File | null | undefined): file is File =>
    Boolean(file && /^image\/(png|jpeg|webp|gif)$/.test(file.type) && file.size <= SNAP_MAX_BYTES);

export const snapImageFromClipboard = (data: DataTransfer | null): File | null => {
    if (!data) return null;
    for (const item of Array.from(data.items || [])) {
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (isSnapImage(file)) return file;
        }
    }
    return Array.from(data.files || []).find(isSnapImage) || null;
};

export const prepareSnapImage = async (file: File): Promise<string> => {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable.');
    // JPEG has no alpha: paint transparent screenshots on white.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.85);
};
