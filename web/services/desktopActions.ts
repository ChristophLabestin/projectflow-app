/**
 * Actions the desktop shell triggers outside the normal UI (tray, Touch Bar, media key, notification buttons,
 * file drops). Kept free of React so DesktopBridge, the Quick Access pop-out and the day window share them.
 */
import { addComment } from './dataService';
import { uploadTenantFile } from './fileStorageService';
import { updateInitiative } from './domain/initiativesService';
import { togglePersonalTaskStatus } from './domain/personalTasksService';
import { updateTaskFields } from './domain/tasksService';
import { getCachedTenantId } from './internal/workspaceDataCore';
import type { FocusItemType } from '../types';

export interface DesktopActionItem {
    id: string;
    type: FocusItemType;
    projectId?: string;
    tenantId?: string;
}

/** Marks the item done in its own collection (same semantics as "Complete" in Quick Access). */
export const completeItem = async (item: DesktopActionItem) => {
    if (item.type === 'task' && item.projectId) {
        await updateTaskFields(item.id, { status: 'Done', isCompleted: true }, item.projectId, item.tenantId);
    } else if (item.type === 'personal-task') {
        await togglePersonalTaskStatus(item.id, false, item.tenantId);
    } else if (item.type === 'initiative' && item.projectId) {
        await updateInitiative(item.id, { status: 'Done' }, item.projectId, item.tenantId);
    }
};

/** Attachments need a project (uploads and comments live in the project); personal tasks have none. */
export const canAttachToItem = (item: DesktopActionItem | null | undefined): item is DesktopActionItem & { projectId: string } => (
    Boolean(item && item.projectId && (item.type === 'task' || item.type === 'initiative'))
);

/**
 * Uploads files into the workspace storage and posts one comment with the file links on the item,
 * so teammates see them in the item's discussion. Returns the number of uploaded files.
 */
export const attachFilesToItem = async (files: File[], item: DesktopActionItem & { projectId: string }) => {
    const tenantId = item.tenantId || getCachedTenantId();
    if (!tenantId || !files.length) return 0;
    const uploaded = [];
    for (const file of files) {
        const result = await uploadTenantFile({
            tenantId,
            module: 'project',
            entityType: item.type === 'initiative' ? 'initiative-attachment' : 'task-attachment',
            entityId: item.id,
            projectId: item.projectId,
            file
        });
        uploaded.push(`📎 ${file.name}: ${result.downloadUrl}`);
    }
    await addComment(item.projectId, item.id, item.type === 'initiative' ? 'initiative' : 'task', uploaded.join('\n'), tenantId);
    return uploaded.length;
};

/** Shell → web file payload (bytes over IPC) to File objects. */
export const filesFromPayload = (value: unknown): File[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        const file = entry as { name?: unknown; type?: unknown; bytes?: unknown };
        if (typeof file.name !== 'string' || !(file.bytes instanceof Uint8Array)) return [];
        return [new File([file.bytes as Uint8Array<ArrayBuffer>], file.name, { type: typeof file.type === 'string' ? file.type : '' })];
    });
};
