import {
    addDoc,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
    type Unsubscribe
} from 'firebase/firestore';

import { auth } from '../firebase';
import { logActivity, projectSubCollection, resolveTenantId } from '../internal/workspaceDataCore';
import { getTenantFileDownloadUrl, refreshFirebaseStorageUrl } from '../fileStorageService';
import type { SocialAsset, SocialCampaign, SocialPost } from '../../types';

const SOCIAL_CAMPAIGNS = 'socialCampaigns';
const SOCIAL_POSTS = 'socialPosts';
const SOCIAL_ASSETS = 'socialAssets';

const hydrateSocialAssets = async (tenantId: string, assets?: SocialAsset[]): Promise<SocialAsset[]> => {
    if (!assets?.length) {
        return assets || [];
    }

    return Promise.all(assets.map(async (asset) => {
        try {
            if (asset.managedFileId) {
                const signed = await getTenantFileDownloadUrl({
                    tenantId: asset.managedTenantId || tenantId,
                    fileId: asset.managedFileId,
                });

                return {
                    ...asset,
                    url: signed.downloadUrl,
                };
            }

            return {
                ...asset,
                url: await refreshFirebaseStorageUrl(tenantId, asset.url),
            };
        } catch (error) {
            console.warn('Failed to refresh managed social asset URL', error);
            return asset;
        }
    }));
};

const hydrateSocialPost = async (tenantId: string, post: SocialPost): Promise<SocialPost> => ({
    ...post,
    assets: await hydrateSocialAssets(tenantId, post.assets),
});

export const getSocialCampaign = async (projectId: string, campaignId: string, tenantId?: string): Promise<SocialCampaign | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snap = await getDoc(doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_CAMPAIGNS), campaignId));

    if (!snap.exists()) {
        return null;
    }

    return { id: snap.id, ...snap.data() } as SocialCampaign;
};

export const createSocialCampaign = async (
    projectId: string,
    campaignData: Omit<SocialCampaign, 'id' | 'createdAt' | 'updatedAt'>,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, SOCIAL_CAMPAIGNS), {
        ...campaignData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return docRef.id;
};

export const subscribeCampaigns = (
    projectId: string,
    onUpdate: (campaigns: SocialCampaign[]) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const campaignQuery = query(
        projectSubCollection(resolvedTenant, projectId, SOCIAL_CAMPAIGNS),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(campaignQuery, (snapshot) => {
        onUpdate(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as SocialCampaign)));
    });
};

export const updateCampaign = async (
    projectId: string,
    campaignId: string,
    updates: Partial<SocialCampaign>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await updateDoc(doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_CAMPAIGNS), campaignId), {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteCampaign = async (
    projectId: string,
    campaignId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_CAMPAIGNS), campaignId));
};

export const deleteSocialCampaign = async (
    projectId: string,
    campaignId: string,
    tenantId?: string
) => deleteCampaign(projectId, campaignId, tenantId);

export const createSocialPost = async (
    projectId: string,
    postData: Omit<SocialPost, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS), {
        ...postData,
        projectId,
        tenantId: resolvedTenant,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    await logActivity(
        projectId,
        { action: `Created social post for ${postData.platform}`, target: 'Social Post', type: 'status' },
        resolvedTenant
    );

    return docRef.id;
};

export const subscribeSocialPosts = (
    projectId: string,
    onUpdate: (posts: SocialPost[]) => void,
    tenantId?: string,
    campaignId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const postsQuery = campaignId
        ? query(
            projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS),
            where('campaignId', '==', campaignId),
            orderBy('updatedAt', 'desc')
        )
        : query(
            projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS),
            orderBy('updatedAt', 'desc')
        );

    return onSnapshot(postsQuery, (snapshot) => {
        const posts = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as SocialPost));
        void Promise.all(posts.map((post) => hydrateSocialPost(resolvedTenant, post))).then(onUpdate);
    });
};

export const updateSocialPost = async (
    projectId: string,
    postId: string,
    updates: Partial<SocialPost>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await updateDoc(doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS), postId), {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteSocialPost = async (
    projectId: string,
    postId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS), postId));
};

export const getSocialPostById = async (
    projectId: string,
    postId: string,
    tenantId?: string
): Promise<SocialPost | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snap = await getDoc(doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS), postId));

    if (!snap.exists()) {
        return null;
    }

    return hydrateSocialPost(resolvedTenant, { id: snap.id, ...snap.data() } as SocialPost);
};

export const createSocialAsset = async (
    projectId: string,
    assetData: Omit<SocialAsset, 'id' | 'createdAt' | 'createdBy'>,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, SOCIAL_ASSETS), {
        ...assetData,
        projectId,
        tenantId: resolvedTenant,
        createdBy: user.uid,
        createdAt: serverTimestamp()
    });

    return docRef.id;
};

export const subscribeSocialAssets = (
    projectId: string,
    onUpdate: (assets: SocialAsset[]) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const assetsQuery = query(
        projectSubCollection(resolvedTenant, projectId, SOCIAL_ASSETS),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(assetsQuery, (snapshot) => {
        const assets = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as SocialAsset));
        void hydrateSocialAssets(resolvedTenant, assets).then(onUpdate);
    });
};

export const deleteSocialAsset = async (
    projectId: string,
    assetId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_ASSETS), assetId));
};
