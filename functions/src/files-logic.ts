// Pure rules for the workspace file manager (brain/plans/files-concept.md). No Firebase imports,
// so scripts/unit/files-logic.test.js can exercise them directly against lib/.

export const FILE_PARENT_TYPES = ['task', 'initiative', 'project', 'comment', 'doc', 'workspace'] as const;
export type FileParentType = typeof FILE_PARENT_TYPES[number];

export type FileParent = {
    type: FileParentType;
    id: string;
    projectId: string | null;
    rootType: FileParentType;
    rootId: string;
    title: string;
};

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const DEFAULT_WORKSPACE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;
export const MAX_FILE_NAME_LENGTH = 180;
export const MAX_FOLDER_LENGTH = 200;
export const MAX_TAGS = 20;

// Executables, installers, scripts and active content (stored XSS) are never accepted.
const BLOCKED_EXTENSIONS = new Set([
    'exe', 'msi', 'msp', 'bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'msc', 'hta', 'lnk', 'reg', 'inf',
    'vbs', 'vbe', 'js', 'jse', 'mjs', 'cjs', 'wsf', 'wsh', 'ps1', 'psm1', 'psd1',
    'sh', 'bash', 'zsh', 'csh', 'ksh', 'command', 'run', 'bin',
    'app', 'dmg', 'pkg', 'mpkg', 'deb', 'rpm', 'apk', 'ipa', 'xapk', 'appimage',
    'jar', 'class', 'dll', 'so', 'dylib', 'sys', 'drv', 'ocx',
    'html', 'htm', 'xhtml', 'shtml', 'svg', 'svgz', 'xml', 'xsl', 'swf',
]);

const BLOCKED_MIME_PATTERNS = [
    /^text\/html/i,
    /^application\/xhtml/i,
    /^image\/svg/i,
    /javascript/i,
    /ecmascript/i,
    /^application\/x-(msdownload|msdos-program|msi|sh|csh|executable|elf|mach-binary|apple-diskimage|java-archive|shockwave-flash|bat)/i,
    /^application\/vnd\.microsoft\.portable-executable/i,
    /^application\/vnd\.android\.package-archive/i,
    /^application\/java-archive/i,
    /^text\/xml/i,
    /^application\/xml/i,
];

export const fileExtension = (fileName: string) => {
    const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
    return match ? match[1].toLowerCase() : '';
};

export const isBlockedFileType = (fileName: string, mimeType: string) => {
    if (BLOCKED_EXTENSIONS.has(fileExtension(fileName))) return true;
    const mime = (mimeType || '').trim();
    return BLOCKED_MIME_PATTERNS.some((pattern) => pattern.test(mime));
};

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Display name: no path separators or control characters, bounded length, keeps the extension. */
export const sanitizeFileName = (value: unknown) => {
    const cleaned = str(value)
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/[\\/]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
    if (cleaned.length <= MAX_FILE_NAME_LENGTH) return cleaned;
    const ext = fileExtension(cleaned);
    const keep = MAX_FILE_NAME_LENGTH - (ext ? ext.length + 1 : 0);
    return ext ? `${cleaned.slice(0, keep)}.${ext}` : cleaned.slice(0, MAX_FILE_NAME_LENGTH);
};

/** Folder path like `Verträge/2026`; '' = root. */
export const sanitizeFolder = (value: unknown) => str(value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/')
    .slice(0, MAX_FOLDER_LENGTH);

export const sanitizeTags = (value: unknown) => {
    if (!Array.isArray(value)) return [] as string[];
    const tags = value.map((entry) => str(entry).slice(0, 40)).filter(Boolean);
    return Array.from(new Set(tags)).slice(0, MAX_TAGS);
};

/**
 * Normalises a client-supplied parent. Project-scoped parents need a projectId; `workspace`
 * parents never carry one. Comments are rooted at their task/initiative (rootType/rootId).
 */
export const normalizeParent = (raw: unknown): FileParent | null => {
    const input = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
    const type = str(input.type) as FileParentType;
    if (!FILE_PARENT_TYPES.includes(type)) return null;

    const projectId = type === 'workspace' ? null : (str(input.projectId) || null);
    const id = type === 'workspace' ? 'workspace' : str(input.id);
    if (!id) return null;
    if (['task', 'initiative', 'project', 'comment'].includes(type) && !projectId) return null;
    if (type === 'project' && id !== projectId) return null;

    let rootType: FileParentType = type;
    let rootId = id;
    if (type === 'comment') {
        rootType = str(input.rootType) as FileParentType;
        rootId = str(input.rootId);
        if (!['task', 'initiative', 'doc'].includes(rootType) || !rootId) return null;
    }

    return { type, id, projectId, rootType, rootId, title: str(input.title).slice(0, 200) };
};

export type FileAccessContext = {
    isMember: boolean;
    role: string;
    /** Project doc for project-scoped files; null if missing (or workspace scope). */
    project?: { ownerId?: string; memberIds?: string[] } | null;
    uid: string;
};

/** Mirrors firestore.rules: non-guests see everything, guests only projects they belong to. */
export const canReadScope = (ctx: FileAccessContext, projectId: string | null) => {
    if (!ctx.isMember) return false;
    if (!projectId) return ctx.role !== 'Guest';
    if (!ctx.project) return false;
    if (ctx.role !== 'Guest') return true;
    return ctx.project.ownerId === ctx.uid || (ctx.project.memberIds || []).includes(ctx.uid);
};

/** Rename, move, trash, new version: uploader, project owner or workspace Owner/Admin. */
export const canManageFile = (ctx: FileAccessContext, file: { createdBy?: string; projectId?: string | null }) => {
    if (!canReadScope(ctx, file.projectId || null)) return false;
    if (ctx.role === 'Owner' || ctx.role === 'Admin') return true;
    if (file.createdBy && file.createdBy === ctx.uid) return true;
    return Boolean(file.projectId && ctx.project?.ownerId === ctx.uid);
};

/** Permanent deletion: uploader or workspace Owner/Admin. */
export const canPurgeFile = (ctx: FileAccessContext, file: { createdBy?: string; projectId?: string | null }) => {
    if (!canReadScope(ctx, file.projectId || null)) return false;
    return ctx.role === 'Owner' || ctx.role === 'Admin' || Boolean(file.createdBy && file.createdBy === ctx.uid);
};

export const quotaAllows = (usedBytes: number, quotaBytes: number, incomingBytes: number) =>
    usedBytes + incomingBytes <= quotaBytes;

/** Plan storage (entitlements/plan, billing contract §7); a platform-admin override wins. */
export const resolveQuotaBytes = (plan: Record<string, unknown> | undefined) => {
    for (const key of ['storageQuotaOverrideBytes', 'storageQuotaBytes']) {
        const value = Number(plan?.[key]);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return DEFAULT_WORKSPACE_QUOTA_BYTES;
};

/** Max size per file by plan (50 MB; Team/Organization 250 MB). */
export const resolveMaxFileBytes = (plan: Record<string, unknown> | undefined) => {
    const value = Number(plan?.maxFileBytes);
    return Number.isFinite(value) && value > 0 ? value : MAX_FILE_BYTES;
};

export const LEGACY_ATTACHMENT_TYPES = ['task-attachment', 'initiative-attachment'];

/**
 * File-manager fields for pre-file-manager rows: media library assets (workspace scope) and
 * desktop task/initiative attachments. Covers, icons, avatars etc. stay system assets (null).
 * `module` is kept so the media picker (listTenantFiles module 'media') keeps finding its assets.
 */
export const legacyFileFields = (
    row: Record<string, unknown>,
    extra: { uploaderName?: string; parentTitle?: string } = {},
) => {
    if (row.listed === true || row.module === 'files') return null;
    const entityType = str(row.entityType);
    const entityId = str(row.entityId);
    const projectId = str(row.projectId) || null;
    let parent: FileParent;
    if (row.module === 'media') {
        parent = projectId
            ? { type: 'project', id: projectId, projectId, rootType: 'project', rootId: projectId, title: '' }
            : { type: 'workspace', id: 'workspace', projectId: null, rootType: 'workspace', rootId: 'workspace', title: '' };
    } else if (LEGACY_ATTACHMENT_TYPES.includes(entityType) && entityId && projectId) {
        const type: FileParentType = entityType === 'task-attachment' ? 'task' : 'initiative';
        parent = { type, id: entityId, projectId, rootType: type, rootId: entityId, title: (extra.parentTitle || '').slice(0, 200) };
    } else {
        return null;
    }
    const name = sanitizeFileName(row.name || row.fileName) || 'file';
    return {
        listed: true,
        parent,
        name,
        nameLower: name.toLowerCase(),
        folder: sanitizeFolder(row.folder),
        tags: sanitizeTags(row.tags),
        version: Number(row.version) || 1,
        versions: Array.isArray(row.versions) ? row.versions : [],
        versionBytes: Number(row.versionBytes) || 0,
        uploaderName: str(row.uploaderName) || extra.uploaderName || '',
        trashedAt: null,
        trashedBy: null,
    };
};
