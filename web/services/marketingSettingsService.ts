import { MarketingSettings, SMTPConfig, SMTPSource, Tenant } from '../types';
import { db } from './firebase';
import { resolveTenantId, projectSubCollection } from './dataService';
import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';

// Collection Name
const MARKETING_SETTINGS = 'marketing_settings';
const SETTINGS_DOC_ID = 'config'; // Single document per project

// Helper to get settings doc ref
const settingsDoc = (tenantId: string, projectId: string) =>
    doc(projectSubCollection(tenantId, projectId, MARKETING_SETTINGS), SETTINGS_DOC_ID);

// --- Marketing Settings ---

export const getMarketingSettings = async (projectId: string, tenantId?: string): Promise<MarketingSettings | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = settingsDoc(resolvedTenant, projectId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as MarketingSettings;
    }
    return null;
};

export const subscribeMarketingSettings = (
    projectId: string,
    onUpdate: (settings: MarketingSettings | null) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = settingsDoc(resolvedTenant, projectId);

    return onSnapshot(ref, (snap) => {
        if (snap.exists()) {
            onUpdate({ id: snap.id, ...snap.data() } as MarketingSettings);
        } else {
            onUpdate(null);
        }
    });
};

export const updateMarketingSettings = async (
    projectId: string,
    settings: Partial<Omit<MarketingSettings, 'id' | 'projectId' | 'updatedAt'>>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = settingsDoc(resolvedTenant, projectId);

    await setDoc(ref, {
        ...settings,
        projectId,
        updatedAt: serverTimestamp()
    }, { merge: true });
};

// --- Effective SMTP Resolution ---

/**
 * Returns the appropriate SMTP config based on priority:
 * 1. Project SMTP (if smtpSource === 'project')
 * 2. Workspace SMTP (if smtpSource === 'workspace')
 * 3. null for ProjectFlow default (handled by server)
 */
export const getEffectiveSMTPConfig = async (
    projectId: string,
    workspaceSMTP?: SMTPConfig,
    tenantId?: string
): Promise<{ source: SMTPSource; config: SMTPConfig | null }> => {
    const settings = await getMarketingSettings(projectId, tenantId);

    // If no settings or using projectflow default
    if (!settings || settings.smtpSource === 'projectflow') {
        return { source: 'projectflow', config: null };
    }

    // If using project-specific SMTP
    if (settings.smtpSource === 'project' && settings.smtpConfig) {
        return { source: 'project', config: settings.smtpConfig };
    }

    // If using workspace SMTP
    if (settings.smtpSource === 'workspace' && workspaceSMTP) {
        return { source: 'workspace', config: workspaceSMTP };
    }

    // Fallback to projectflow default
    return { source: 'projectflow', config: null };
};
