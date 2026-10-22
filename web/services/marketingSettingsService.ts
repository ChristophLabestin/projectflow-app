import { MarketingSettings } from '../types';
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
