import { httpsCallable } from 'firebase/functions';

import { functions } from './firebase';

export type StorageProvider = 'firebase' | 's3' | 'googleDrive';

export type WorkspaceFileStorageConfig = {
    activeProvider: StorageProvider;
    resolvedProvider: StorageProvider;
    fallbackToFirebase: boolean;
    fallbackReason: string | null;
    providers: {
        firebase: {
            ready: boolean;
        };
        s3: {
            ready: boolean;
            endpoint: string;
            region: string;
            bucket: string;
            pathPrefix: string;
            forcePathStyle: boolean;
            hasAccessKeyId: boolean;
            hasSecretAccessKey: boolean;
            lastTestedAt?: unknown;
        };
        googleDrive: {
            ready: boolean;
            connected: boolean;
            folderId: string;
            folderName: string;
            email: string;
            scope: string;
            hasRefreshToken: boolean;
            tokenExpiryDate: number | null;
            lastTestedAt?: unknown;
            lastError?: string | null;
        };
    };
    updatedAt?: unknown;
    updatedBy?: string | null;
};

export interface FileUploadSessionInput {
    tenantId: string;
    module: string;
    entityType: string;
    entityId: string;
    projectId?: string;
    file: File;
}

export interface TenantFile {
    id: string;
    tenantId: string;
    module: string;
    entityType: string;
    entityId: string;
    projectId: string | null;
    provider: StorageProvider;
    requestedProvider: StorageProvider;
    fallbackToFirebase: boolean;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    status: 'ready' | 'deleted';
    downloadUrl: string;
    createdBy: string;
    createdAt?: unknown;
    updatedAt?: unknown;
}

type UploadTarget = {
    method: 'PUT' | 'POST';
    url: string;
    headers?: Record<string, string>;
};

type CreateUploadSessionResponse = {
    uploadDraftId: string;
    requestedProvider: StorageProvider;
    resolvedProvider: StorageProvider;
    fallbackToFirebase: boolean;
    uploadTarget: UploadTarget;
};

const call = async <TInput, TOutput>(name: string, payload: TInput): Promise<TOutput> => {
    const fn = httpsCallable<TInput, TOutput>(functions, name);
    const result = await fn(payload);
    return result.data;
};

const uploadToSignedTarget = async (target: UploadTarget, file: File) => {
    const response = await fetch(target.url, {
        method: target.method || 'PUT',
        headers: {
            ...(target.headers || {}),
        },
        body: file,
    });

    const responseBody = await response.text();
    if (!response.ok) {
        throw new Error(`Upload failed with HTTP ${response.status}. ${responseBody.slice(0, 200)}`);
    }

    let parsed: Record<string, unknown> | undefined;
    if (responseBody) {
        try {
            parsed = JSON.parse(responseBody) as Record<string, unknown>;
        } catch {
            parsed = undefined;
        }
    }

    return {
        status: response.status,
        responseBody,
        ...(parsed || {}),
    };
};

export const getWorkspaceFileStorageConfig = async (tenantId: string): Promise<WorkspaceFileStorageConfig | null> => {
    const result = await call<{ tenantId: string }, { config: WorkspaceFileStorageConfig | null }>(
        'getWorkspaceFileStorageConfig',
        { tenantId },
    );

    return result.config || null;
};

export const saveWorkspaceFileStorageConfig = async (
    tenantId: string,
    payload: {
        activeProvider: StorageProvider;
        s3Config?: {
            endpoint?: string;
            region?: string;
            bucket?: string;
            pathPrefix?: string;
            forcePathStyle?: boolean;
            accessKeyId?: string;
            secretAccessKey?: string;
        };
        googleDriveConfig?: {
            folderId?: string;
            folderName?: string;
        };
    },
): Promise<WorkspaceFileStorageConfig> => {
    const result = await call<
        {
            tenantId: string;
            activeProvider: StorageProvider;
            s3Config?: Record<string, unknown>;
            googleDriveConfig?: Record<string, unknown>;
        },
        { config: WorkspaceFileStorageConfig }
    >('saveWorkspaceFileStorageConfig', {
        tenantId,
        activeProvider: payload.activeProvider,
        s3Config: payload.s3Config,
        googleDriveConfig: payload.googleDriveConfig,
    });

    return result.config;
};

export const testWorkspaceFileStorageConnection = async (
    tenantId: string,
    provider: StorageProvider,
    s3Config?: {
        endpoint?: string;
        region?: string;
        bucket?: string;
        pathPrefix?: string;
        forcePathStyle?: boolean;
        accessKeyId?: string;
        secretAccessKey?: string;
    },
) => {
    return call<
        {
            tenantId: string;
            provider: StorageProvider;
            s3Config?: Record<string, unknown>;
        },
        { ok: boolean; provider: StorageProvider; message: string }
    >('testWorkspaceFileStorageConnection', {
        tenantId,
        provider,
        s3Config,
    });
};

export const getGoogleDriveStorageAuthUrl = async (tenantId: string) => {
    return call<{ tenantId: string }, { url: string }>('getGoogleDriveStorageAuthUrl', { tenantId });
};

export const disconnectGoogleDriveStorage = async (tenantId: string) => {
    return call<{ tenantId: string }, { config: WorkspaceFileStorageConfig }>('disconnectGoogleDriveStorage', { tenantId });
};

export const uploadTenantFile = async (input: FileUploadSessionInput): Promise<TenantFile> => {
    const session = await call<
        {
            tenantId: string;
            module: string;
            entityType: string;
            entityId: string;
            projectId?: string;
            fileName: string;
            mimeType: string;
            sizeBytes: number;
        },
        CreateUploadSessionResponse
    >('createTenantFileUploadSession', {
        tenantId: input.tenantId,
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId,
        fileName: input.file.name,
        mimeType: input.file.type || 'application/octet-stream',
        sizeBytes: input.file.size,
    });

    const providerResult = await uploadToSignedTarget(session.uploadTarget, input.file);

    const finalized = await call<
        {
            tenantId: string;
            uploadDraftId: string;
            providerResult: Record<string, unknown>;
        },
        { file: TenantFile }
    >('finalizeTenantFileUpload', {
        tenantId: input.tenantId,
        uploadDraftId: session.uploadDraftId,
        providerResult,
    });

    return finalized.file;
};

export const listTenantFiles = async (input: {
    tenantId: string;
    module?: string;
    projectId?: string;
    entityType?: string;
    entityId?: string;
    cursor?: string;
    limit?: number;
}): Promise<{ files: TenantFile[]; nextCursor: string | null }> => {
    return call<typeof input, { files: TenantFile[]; nextCursor: string | null }>('listTenantFiles', input);
};

export const getTenantFileDownloadUrl = async (input: { tenantId: string; fileId: string }) => {
    return call<typeof input, { fileId: string; downloadUrl: string; expiresInSeconds: number }>('getTenantFileDownloadUrl', input);
};

export const deleteTenantFile = async (input: { tenantId: string; fileId: string }) => {
    return call<typeof input, { success: boolean }>('deleteTenantFile', input);
};
