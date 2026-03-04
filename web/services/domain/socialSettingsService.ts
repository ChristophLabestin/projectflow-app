import {
    addDoc,
    deleteDoc,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch,
    type Unsubscribe
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { auth, db, functions } from '../firebase';
import { projectSubCollection, resolveTenantId } from '../internal/workspaceDataCore';
import type { CaptionPreset, Idea, SocialIntegration, SocialPlatform, SocialStrategy } from '../../types';

const CAPTION_PRESETS = 'caption_presets';
const SOCIAL_STRATEGY = 'social_strategy';
const SOCIAL_INTEGRATIONS = 'social_integrations';
const SOCIAL_AUTH_TIMEOUT_MS = 120000;

export const createCaptionPreset = async (
    projectId: string,
    presetData: Omit<CaptionPreset, 'id' | 'createdAt' | 'createdBy'>,
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, CAPTION_PRESETS), {
        ...presetData,
        projectId,
        createdBy: user.uid,
        createdAt: serverTimestamp()
    });

    return docRef.id;
};

export const subscribeCaptionPresets = (
    projectId: string,
    onUpdate: (presets: CaptionPreset[]) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const presetsQuery = query(
        projectSubCollection(resolvedTenant, projectId, CAPTION_PRESETS),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(presetsQuery, (snapshot) => {
        onUpdate(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as CaptionPreset)));
    });
};

export const updateCaptionPreset = async (
    projectId: string,
    presetId: string,
    updates: Partial<CaptionPreset>,
    tenantId?: string
): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await updateDoc(doc(projectSubCollection(resolvedTenant, projectId, CAPTION_PRESETS), presetId), {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteCaptionPreset = async (
    projectId: string,
    presetId: string,
    tenantId?: string
): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(projectSubCollection(resolvedTenant, projectId, CAPTION_PRESETS), presetId));
};

export const subscribeIntegrations = (
    projectId: string,
    onUpdate: (integrations: SocialIntegration[]) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const integrationsQuery = query(projectSubCollection(resolvedTenant, projectId, SOCIAL_INTEGRATIONS));

    return onSnapshot(integrationsQuery, (snapshot) => {
        onUpdate(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as SocialIntegration)));
    });
};

const openCenteredAuthPopup = (authUrl: string, popupName: string) => {
    const width = 600;
    const height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const popup = window.open(authUrl, popupName, `width=${width},height=${height},top=${top},left=${left}`);

    if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
    }

    return popup;
};

const awaitSocialAuthPopup = ({
    popup,
    successType,
    timeoutMs = SOCIAL_AUTH_TIMEOUT_MS
}: {
    popup: Window;
    successType: string;
    timeoutMs?: number;
}) => new Promise<void>((resolve, reject) => {
    let completed = false;

    const cleanup = () => {
        window.removeEventListener('message', handleMessage);
        clearInterval(closePollTimer);
        clearTimeout(timeoutTimer);
    };

    const fail = (message: string) => {
        if (completed) return;
        completed = true;
        cleanup();
        reject(new Error(message));
    };

    const succeed = () => {
        if (completed) return;
        completed = true;
        cleanup();
        resolve();
    };

    const handleMessage = (event: MessageEvent) => {
        if (event.source !== popup) return;
        if (event.data?.type === successType) {
            succeed();
        }
    };

    const closePollTimer = window.setInterval(() => {
        if (popup.closed) {
            fail('Authentication popup was closed before completion.');
        }
    }, 500);

    const timeoutTimer = window.setTimeout(() => {
        fail('Authentication timed out. Please try again.');
    }, timeoutMs);

    window.addEventListener('message', handleMessage);
});

export const connectIntegration = async (
    projectId: string,
    platform: SocialPlatform,
    existingAccessToken?: string,
    tenantId?: string
) => {
    void existingAccessToken;
    const resolvedTenant = resolveTenantId(tenantId);

    try {
        if (platform === 'Instagram' || platform === 'Facebook') {
            const getAuthUrlFn = httpsCallable(functions, 'getFacebookAuthUrl');
            const response = await getAuthUrlFn({ projectId, tenantId: resolvedTenant }) as any;
            const authUrl = response.data.url;
            const popup = openCenteredAuthPopup(authUrl, 'facebook_auth');

            await awaitSocialAuthPopup({
                popup,
                successType: 'FACEBOOK_CONNECTED'
            });

            await new Promise((resolve) => setTimeout(resolve, 1000));

            const integrationsRef = projectSubCollection(resolvedTenant, projectId, SOCIAL_INTEGRATIONS);
            const pendingQuery = query(
                integrationsRef,
                where('platform', '==', 'FacebookData'),
                where('status', '==', 'PendingSetup'),
                orderBy('connectedAt', 'desc'),
                limit(1)
            );
            const snapshot = await getDocs(pendingQuery);

            if (snapshot.empty) {
                throw new Error('Connection successful, but failed to retrieve integration data. Please try again.');
            }

            const pendingDoc = snapshot.docs[0];
            const pendingData = pendingDoc.data();
            const accessToken = pendingData.accessToken;
            const { getInstagramAccounts, getInstagramProfile } = await import('../instagramService');
            const accounts = await getInstagramAccounts(accessToken);

            let integrationData: Record<string, any> = {};

            if (platform === 'Instagram') {
                const instagramAccounts = accounts.filter((account) => account.instagram_business_account);
                if (instagramAccounts.length === 0) {
                    await deleteDoc(pendingDoc.ref);
                    throw new Error('No Instagram Business accounts found linked to your Facebook Pages. Please make sure your Instagram account is a Business account and linked to a Facebook Page.');
                }

                const selectedAccount = instagramAccounts[0];
                const igBusinessId = selectedAccount.instagram_business_account!.id;
                const pageId = selectedAccount.id;
                const profile = await getInstagramProfile(igBusinessId, accessToken);

                integrationData = {
                    platform: 'Instagram',
                    username: profile.username || pendingData.username,
                    profilePictureUrl: profile.profile_picture_url || pendingData.profilePictureUrl,
                    instagramBusinessAccountId: igBusinessId,
                    facebookPageId: pageId,
                    accessToken,
                    status: 'Connected',
                    authUserId: pendingData.authUserId,
                    connectedAt: pendingData.connectedAt
                };
            } else {
                if (accounts.length === 0) {
                    await deleteDoc(pendingDoc.ref);
                    throw new Error('No Facebook Pages found.');
                }

                const selectedAccount = accounts[0];
                integrationData = {
                    platform: 'Facebook',
                    username: selectedAccount.name,
                    profilePictureUrl: selectedAccount.picture?.data?.url || pendingData.profilePictureUrl,
                    facebookPageId: selectedAccount.id,
                    pageAccessToken: selectedAccount.access_token,
                    accessToken,
                    status: 'Connected',
                    authUserId: pendingData.authUserId,
                    connectedAt: pendingData.connectedAt
                };
            }

            await updateDoc(pendingDoc.ref, integrationData);
            return;
        }

        if (platform === 'TikTok') {
            const getAuthUrlFn = httpsCallable(functions, 'getTikTokAuthUrl');
            const response = await getAuthUrlFn({ projectId, tenantId: resolvedTenant }) as any;
            const popup = openCenteredAuthPopup(response.data.url, 'tiktok_auth');
            await awaitSocialAuthPopup({ popup, successType: 'TIKTOK_CONNECTED' });
            return;
        }

        if (platform === 'YouTube') {
            const getAuthUrlFn = httpsCallable(functions, 'getYouTubeAuthUrl');
            const response = await getAuthUrlFn({ projectId, tenantId: resolvedTenant }) as any;
            const popup = openCenteredAuthPopup(response.data.url, 'youtube_auth');
            await awaitSocialAuthPopup({ popup, successType: 'YOUTUBE_CONNECTED' });
            return;
        }
    } catch (error) {
        console.error('Social Auth failed:', error);
        throw error;
    }

    if (platform === 'Facebook' || platform === 'Instagram') {
        return;
    }

    const mockUsernames: Record<string, string> = {
        Instagram: '@projectflow_ig',
        Facebook: 'ProjectFlow Page',
        LinkedIn: 'ProjectFlow Company',
        X: '@projectflow_app',
        TikTok: '@projectflow_tok'
    };

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await addDoc(projectSubCollection(resolvedTenant, projectId, SOCIAL_INTEGRATIONS), {
        projectId,
        platform,
        username: mockUsernames[platform] || 'Connected User',
        status: 'Connected',
        connectedAt: new Date().toISOString(),
        isMock: true
    });
};

export const disconnectIntegration = async (
    projectId: string,
    integrationId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_INTEGRATIONS), integrationId));
};

export const subscribeSocialStrategy = (
    projectId: string,
    onUpdate: (strategy: SocialStrategy | null) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const strategyRef = doc(db, 'tenants', resolvedTenant, 'projects', projectId, SOCIAL_STRATEGY, 'default');

    return onSnapshot(strategyRef, (snapshot) => {
        if (snapshot.exists()) {
            onUpdate({ id: snapshot.id, ...snapshot.data() } as SocialStrategy);
            return;
        }
        onUpdate(null);
    });
};

export const updateSocialStrategy = async (
    projectId: string,
    updates: Partial<SocialStrategy>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const strategyRef = doc(db, 'tenants', resolvedTenant, 'projects', projectId, SOCIAL_STRATEGY, 'default');

    await setDoc(strategyRef, {
        ...updates,
        projectId,
        updatedAt: serverTimestamp()
    }, { merge: true });
};

export const syncSocialStrategyPlatforms = async (
    projectId: string,
    platformToRemove: SocialPlatform,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ideasRef = projectSubCollection(resolvedTenant, projectId, 'ideas');
    const ideasQuery = query(ideasRef, where('type', '==', 'Marketing'), where('campaignType', '==', 'social'));
    const snapshot = await getDocs(ideasQuery);
    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as Idea;
        try {
            const concept = JSON.parse(data.concept || '{}');
            if (Array.isArray(concept.channels) && concept.channels.includes(platformToRemove)) {
                const newChannels = concept.channels.filter((channel: string) => channel !== platformToRemove);
                batch.update(docSnap.ref, {
                    concept: JSON.stringify({ ...concept, channels: newChannels }),
                    updatedAt: serverTimestamp()
                });
                count += 1;
            }
        } catch (error) {
            console.error('Failed to parse concept for flow', docSnap.id, error);
        }
    });

    if (count > 0) {
        await batch.commit();
    }
};
