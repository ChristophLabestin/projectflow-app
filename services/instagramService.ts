
import { SocialPost, SocialAsset, SocialPlatform } from '../types';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

export interface InstagramAccount {
    id: string;
    name: string;
    instagram_business_account?: {
        id: string;
    };
}

export interface InstagramMedia {
    id: string;
    caption?: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    media_url: string;
    thumbnail_url?: string;
    permalink: string;
    timestamp: string;
    like_count?: number;
    comments_count?: number;
}

export const getInstagramAccounts = async (accessToken: string): Promise<InstagramAccount[]> => {
    try {
        const response = await fetch(`${GRAPH_API_BASE}/me/accounts?fields=name,instagram_business_account&access_token=${accessToken}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        return data.data || [];
    } catch (error) {
        console.error("Error fetching Instagram accounts:", error);
        throw error;
    }
};

export const getInstagramMedia = async (igAccountId: string, accessToken: string, limit = 20): Promise<InstagramMedia[]> => {
    try {
        const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
        const response = await fetch(
            `${GRAPH_API_BASE}/${igAccountId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`
        );
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        return data.data || [];
    } catch (error) {
        console.error("Error fetching Instagram media:", error);
        throw error;
    }
};

export const getInstagramProfile = async (igAccountId: string, accessToken: string) => {
    try {
        const fields = 'id,username,name,profile_picture_url,followers_count,follows_count,media_count';
        const response = await fetch(
            `${GRAPH_API_BASE}/${igAccountId}?fields=${fields}&access_token=${accessToken}`
        );
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        return data;
    } catch (error) {
        console.error("Error fetching Instagram profile:", error);
        throw error;
    }
};

export const publishInstagramPhoto = async (igAccountId: string, imageUrl: string, caption: string, accessToken: string) => {
    // 1. Create Media Container
    const containerResponse = await fetch(
        `${GRAPH_API_BASE}/${igAccountId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${accessToken}`,
        { method: 'POST' }
    );
    const containerData = await containerResponse.json();

    if (containerData.error || !containerData.id) {
        throw new Error(containerData.error?.message || 'Failed to create media container');
    }

    const creationId = containerData.id;

    // 2. Publish Media
    const publishResponse = await fetch(
        `${GRAPH_API_BASE}/${igAccountId}/media_publish?creation_id=${creationId}&access_token=${accessToken}`,
        { method: 'POST' }
    );
    const publishData = await publishResponse.json();

    if (publishData.error || !publishData.id) {
        throw new Error(publishData.error?.message || 'Failed to publish media');
    }

    return publishData.id;
};
