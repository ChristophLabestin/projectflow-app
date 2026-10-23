// File embedding for wiki pages. The `wikiFile` block stores a WikiFileRef; where the
// bytes live is the provider's business. Until the "Dateien" session ships its file model,
// the placeholder provider uploads through the existing tenant file service
// (createTenantFileUploadSession → tenants/{t}/files/{fileId}).
import { getTenantFileDownloadUrl, uploadTenantFile } from '../../services/fileStorageService';

export interface WikiFileRef {
    fileId: string | null;
    name: string;
    size: number;
    mimeType: string;
    /** Display/download URL; may be refreshed via resolve() when it expires. */
    url: string | null;
}

export interface WikiFileProvider {
    /** Opens the picker and uploads; resolves null when the user cancels. */
    pick: (options: { accept?: string }) => Promise<WikiFileRef | null>;
    /** Fresh URL for a stored file (signed URLs can expire). */
    resolve: (fileId: string) => Promise<string | null>;
}

const chooseFile = (accept?: string) => new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
});

export const createPlaceholderFileProvider = (ctx: { tenantId: string; projectId: string | null; docId: string }): WikiFileProvider => ({
    pick: async ({ accept }) => {
        const file = await chooseFile(accept);
        if (!file) return null;
        const stored = await uploadTenantFile({
            tenantId: ctx.tenantId,
            module: 'wiki',
            entityType: 'doc',
            entityId: ctx.docId,
            projectId: ctx.projectId || undefined,
            file,
        });
        return { fileId: stored.id, name: stored.fileName, size: stored.sizeBytes, mimeType: stored.mimeType, url: stored.downloadUrl };
    },
    resolve: async (fileId) => {
        const result = await getTenantFileDownloadUrl({ tenantId: ctx.tenantId, fileId }).catch(() => null);
        return result?.downloadUrl || null;
    },
});

export const formatBytes = (bytes: number) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

export const fileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'movie';
    if (mimeType.startsWith('audio/')) return 'music_note';
    if (mimeType.includes('pdf')) return 'picture_as_pdf';
    if (mimeType.includes('sheet') || mimeType.includes('csv') || mimeType.includes('excel')) return 'table_chart';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'folder_zip';
    return 'description';
};
