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
