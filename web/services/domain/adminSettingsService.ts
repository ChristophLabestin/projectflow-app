import { httpsCallable } from 'firebase/functions';

import { functions } from '../firebase';
import type { APITokenPermission } from '../../types';

export type WorkspaceSmtpConfig = {
    host: string;
    port: number;
    user: string;
    pass: string;
    useCustom: boolean;
    fromEmail: string;
    verified?: boolean;
};

export type WorkspaceApiToken = {
    id: string;
    name: string;
    tokenPrefix: string;
    permissions: string[];
    projectScope?: string | null;
    createdAt?: unknown;
    lastUsedAt?: unknown;
    expiresAt?: unknown;
};

export type WorkspaceFinancialConfig = {
    endpoint: string;
    months: number;
    linkedProjectId: string | null;
    hasToken: boolean;
    updatedAt?: unknown;
};

type FinancialBreakdownEntry = {
    aiUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
};

export type FinancialModelBreakdownEntry = FinancialBreakdownEntry & {
    model?: string;
};

export type FinancialFunctionBreakdownEntry = FinancialBreakdownEntry & {
    function?: string;
};

export type WorkspaceFinancialUsageMonth = {
    monthKey: string;
    byModel: FinancialModelBreakdownEntry[];
    byFunction: FinancialFunctionBreakdownEntry[];
};

export type WorkspaceFinancialUsage = {
    endpoint: string;
    linkedProjectId: string | null;
    requestedMonths: number;
    isConfigured?: boolean;
    totals: {
        aiUsd: number;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    months: WorkspaceFinancialUsageMonth[];
};

export type WorkspaceFileStorageProvider = 'firebase' | 's3' | 'googleDrive';

export type WorkspaceFileStorageConfig = {
    activeProvider: WorkspaceFileStorageProvider;
    resolvedProvider: WorkspaceFileStorageProvider;
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

export const getWorkspaceSmtpConfig = async (tenantId: string): Promise<WorkspaceSmtpConfig | null> => {
    const fn = httpsCallable(functions, 'getWorkspaceSmtpConfig');
    const result = await fn({ tenantId }) as { data: { smtpConfig: WorkspaceSmtpConfig | null } };
    return result.data.smtpConfig || null;
};

export const saveWorkspaceSmtpConfig = async (tenantId: string, smtpConfig: WorkspaceSmtpConfig) => {
    const fn = httpsCallable(functions, 'saveWorkspaceSmtpConfig');
    await fn({ tenantId, smtpConfig });
};

export const listWorkspaceApiTokens = async (tenantId: string): Promise<WorkspaceApiToken[]> => {
    const fn = httpsCallable(functions, 'listWorkspaceApiTokens');
    const result = await fn({ tenantId }) as { data: { tokens: WorkspaceApiToken[] } };
    return result.data.tokens || [];
};

export const createWorkspaceApiToken = async (
    tenantId: string,
    name: string,
    permissions: APITokenPermission[],
    projectScope?: string,
    expiresAt?: Date
): Promise<{ id: string; token: string }> => {
    const fn = httpsCallable(functions, 'createWorkspaceApiToken');
    const result = await fn({
        tenantId,
        name,
        permissions,
        projectScope,
        expiresAt: expiresAt ? expiresAt.toISOString() : null
    }) as { data: { id: string; token: string } };

    return result.data;
};

export const deleteWorkspaceApiToken = async (tenantId: string, tokenId: string) => {
    const fn = httpsCallable(functions, 'deleteWorkspaceApiToken');
    await fn({ tenantId, tokenId });
};

export const getWorkspaceFinancialConfig = async (tenantId: string): Promise<WorkspaceFinancialConfig | null> => {
    const fn = httpsCallable(functions, 'getWorkspaceFinancialConfig');
    const result = await fn({ tenantId }) as { data: { config: WorkspaceFinancialConfig | null } };
    return result.data.config || null;
};

export const saveWorkspaceFinancialConfig = async (
    tenantId: string,
    config: {
        endpoint: string;
        token?: string;
        months: number;
        linkedProjectId?: string | null;
    }
): Promise<WorkspaceFinancialConfig> => {
    const fn = httpsCallable(functions, 'saveWorkspaceFinancialConfig');
    const result = await fn({
        tenantId,
        endpoint: config.endpoint,
        token: config.token || '',
        months: config.months,
        linkedProjectId: config.linkedProjectId || null
    }) as { data: { config: WorkspaceFinancialConfig } };
    return result.data.config;
};

export const fetchWorkspaceFinancialUsage = async (
    tenantId: string,
    options?: { months?: number; monthKey?: string }
): Promise<WorkspaceFinancialUsage> => {
    const fn = httpsCallable(functions, 'fetchWorkspaceFinancialUsage');
    const result = await fn({
        tenantId,
        months: options?.months,
        monthKey: options?.monthKey
    }) as { data: WorkspaceFinancialUsage };

    return result.data;
};

export const getWorkspaceFileStorageConfig = async (tenantId: string): Promise<WorkspaceFileStorageConfig | null> => {
    const fn = httpsCallable(functions, 'getWorkspaceFileStorageConfig');
    const result = await fn({ tenantId }) as { data: { config: WorkspaceFileStorageConfig | null } };
    return result.data.config || null;
};

export const saveWorkspaceFileStorageConfig = async (
    tenantId: string,
    config: {
        activeProvider: WorkspaceFileStorageProvider;
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
    const fn = httpsCallable(functions, 'saveWorkspaceFileStorageConfig');
    const result = await fn({
        tenantId,
        activeProvider: config.activeProvider,
        s3Config: config.s3Config || {},
        googleDriveConfig: config.googleDriveConfig || {},
    }) as { data: { config: WorkspaceFileStorageConfig } };

    return result.data.config;
};

export const testWorkspaceFileStorageConnection = async (
    tenantId: string,
    provider: WorkspaceFileStorageProvider,
    s3Config?: {
        endpoint?: string;
        region?: string;
        bucket?: string;
        pathPrefix?: string;
        forcePathStyle?: boolean;
        accessKeyId?: string;
        secretAccessKey?: string;
    },
): Promise<{ ok: boolean; provider: WorkspaceFileStorageProvider; message: string }> => {
    const fn = httpsCallable(functions, 'testWorkspaceFileStorageConnection');
    const result = await fn({
        tenantId,
        provider,
        s3Config: s3Config || {},
    }) as { data: { ok: boolean; provider: WorkspaceFileStorageProvider; message: string } };

    return result.data;
};

export const getGoogleDriveStorageAuthUrl = async (tenantId: string): Promise<{ url: string }> => {
    const fn = httpsCallable(functions, 'getGoogleDriveStorageAuthUrl');
    const result = await fn({ tenantId }) as { data: { url: string } };
    return result.data;
};

export const disconnectGoogleDriveStorage = async (tenantId: string): Promise<WorkspaceFileStorageConfig> => {
    const fn = httpsCallable(functions, 'disconnectGoogleDriveStorage');
    const result = await fn({ tenantId }) as { data: { config: WorkspaceFileStorageConfig } };
    return result.data.config;
};
