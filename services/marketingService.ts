import {
    MarketingCampaign,
    AdCampaign,
    EmailCampaign,
    SocialCampaign,
    MarketingAudience,
    MarketingFunnelMetric,
    EmailTemplate
} from '../types';
import { db, auth } from './firebase';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    onSnapshot,
    query,
    where,
    getDocs,
    serverTimestamp,
    orderBy,
    getDoc
} from 'firebase/firestore';
import { createSocialPost, createSocialCampaign } from './dataService';
import { SocialPost } from '../types';

// --- Marketing Campaigns ---

export const createMarketingCampaign = async (campaign: Omit<MarketingCampaign, 'id' | 'createdAt'>) => {
    const colRef = collection(db, 'marketing_campaigns');
    const docRef = await addDoc(colRef, {
        ...campaign,
        createdAt: serverTimestamp()
    });
    return docRef.id;
};


export const subscribeMarketingCampaigns = (projectId: string, onUpdate: (data: MarketingCampaign[]) => void) => {
    const q = query(
        collection(db, 'marketing_campaigns'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const campaigns = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as MarketingCampaign));
        onUpdate(campaigns);
    });
};

// --- Ad Campaigns ---

export const createAdCampaign = async (campaign: Omit<AdCampaign, 'id'>) => {
    const colRef = collection(db, 'ad_campaigns');
    const docRef = await addDoc(colRef, {
        ...campaign,
        startDate: new Date().toISOString()
    });
    return docRef.id;
};

export const subscribeAdCampaigns = (projectId: string, onUpdate: (data: AdCampaign[]) => void) => {
    const q = query(
        collection(db, 'ad_campaigns'),
        where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
        const campaigns = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AdCampaign));
        onUpdate(campaigns);
    });
};

export const updateAdCampaignStatus = async (id: string, status: AdCampaign['status']) => {
    const ref = doc(db, 'ad_campaigns', id);
    await updateDoc(ref, { status });
};

// --- Email Campaigns ---

export const createEmailCampaign = async (campaign: Omit<EmailCampaign, 'id'>) => {
    const colRef = collection(db, 'email_campaigns');
    const docRef = await addDoc(colRef, {
        ...campaign,
        createdAt: serverTimestamp() // Track creation
    });
    return docRef.id;
};

export const updateEmailCampaign = async (id: string, updates: Partial<EmailCampaign>) => {
    const ref = doc(db, 'email_campaigns', id);

    // Logic: If updating template, check if campaign is scheduled or sent
    if (updates.templateId || updates.contentBlocks) {
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data() as EmailCampaign;
            if (['scheduled', 'sent'].includes(data.status)) {
                throw new Error("Cannot modify template of a scheduled or sent campaign.");
            }
        }
    }

    await updateDoc(ref, updates);
};

export const subscribeEmailCampaigns = (projectId: string, onUpdate: (data: EmailCampaign[]) => void) => {
    const q = query(
        collection(db, 'email_campaigns'),
        where('projectId', '==', projectId)
        // Add orderBy if needed, requires composite index
    );
    return onSnapshot(q, (snapshot) => {
        const campaigns = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as EmailCampaign));
        onUpdate(campaigns);
    });
};

export const updateEmailCampaignStatus = async (id: string, status: EmailCampaign['status']) => {
    const ref = doc(db, 'email_campaigns', id);
    await updateDoc(ref, { status });
};

// --- Audiences ---

export const subscribeAudiences = (projectId: string, onUpdate: (data: MarketingAudience[]) => void) => {
    // For now, mock or simple collection
    const q = query(
        collection(db, 'marketing_audiences'),
        where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
        const audiences = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as MarketingAudience));
        onUpdate(audiences);
    });
};

// --- Analytics ---

// --- Idea Conversion Utilities ---

export const createEmailCampaignFromIdea = async (
    projectId: string,
    idea: { id: string; concept?: string; title: string },
    user: { uid: string; displayName: string }
) => {
    let conceptData: any = {};
    try {
        if (idea.concept && idea.concept.startsWith('{')) {
            conceptData = JSON.parse(idea.concept);
        }
    } catch (e) {
        console.warn("Failed to parse idea concept for conversion", e);
    }

    const campaignData: Omit<EmailCampaign, 'id'> = {
        projectId,

        name: idea.title,
        subject: conceptData.emailSubjectLines?.[0] || 'Draft Subject', // Take first variant
        senderName: conceptData.emailSenderName || user.displayName,
        status: 'draft',
        contentBlocks: [], // Empty initially
        variableValues: {},
        stats: {
            sent: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            unsubscribed: 0
        },
        originIdeaId: idea.id
    };

    return await createEmailCampaign(campaignData);
};

export const createAdCampaignFromIdea = async (
    projectId: string,
    idea: { id: string; concept?: string; title: string }
) => {
    let conceptData: any = {};
    try {
        if (idea.concept && idea.concept.startsWith('{')) {
            conceptData = JSON.parse(idea.concept);
        }
    } catch (e) {
        console.warn("Failed to parse idea concept for conversion", e);
    }

    const campaignData: Omit<AdCampaign, 'id'> = {
        projectId,
        name: conceptData.adPlatform ? `${idea.title} - ${conceptData.adPlatform}` : idea.title,
        platform: (conceptData.adPlatform?.split(' ')[0] as any) || 'Google',
        status: 'Paused', // Default to paused
        budgetDaily: Number(conceptData.dailyBudget) || 0,
        budgetTotal: 0,
        spend: 0,
        objective: 'Traffic', // Default
        metrics: {
            impressions: 0,
            clicks: 0,
            ctr: 0,
            cpc: 0,
            conversions: 0,
            costPerConversion: 0,
            roas: 0
        },
        startDate: conceptData.timelineStart || new Date().toISOString(),
        endDate: conceptData.timelineEnd,
        originIdeaId: idea.id
    };

    return await createAdCampaign(campaignData);
};

export const createSocialPostFromIdea = async (
    projectId: string,
    idea: { id: string; concept?: string; title: string }
) => {
    let conceptData: any = {};
    try {
        if (idea.concept && idea.concept.startsWith('{')) {
            conceptData = JSON.parse(idea.concept);
        }
    } catch (e) {
        console.warn("Failed to parse idea concept for conversion", e);
    }

    // Map fields from SocialDraftingView/SocialIdeationView
    // Typically: content, hashtags in conceptData
    const postData: any = {
        projectId,
        platform: conceptData.platform || 'Instagram',
        format: conceptData.postFormat || 'Image',
        content: {
            caption: conceptData.postCaption || idea.title + '\n\n' + (idea.concept?.slice(0, 100) || ''),
            hashtags: conceptData.hashtags || [],
            originIdeaId: idea.id
        },
        assets: [], // Would need asset mapping if we had file uploads in idea
        status: 'Draft',
        originIdeaId: idea.id
    };

    return await createSocialPost(projectId, postData);
};

export const createSocialCampaignFromIdea = async (
    projectId: string,
    idea: { id: string; concept?: string; title: string },
    user: { uid: string }
) => {
    let conceptData: any = {};
    try {
        if (idea.concept && idea.concept.startsWith('{')) {
            conceptData = JSON.parse(idea.concept);
        }
    } catch (e) {
        console.warn("Failed to parse idea concept for conversion", e);
    }

    const campaignData: Omit<SocialCampaign, 'id' | 'createdAt' | 'updatedAt'> = {
        projectId,
        name: idea.title,
        goal: conceptData.goal || 'Engagement',
        startDate: conceptData.timelineStart || new Date().toISOString(),
        endDate: conceptData.timelineEnd,
        status: 'Planning',
        ownerId: user.uid,
        color: '#E1306C', // Default generic color
        originIdeaId: idea.id,
        // targetAudience and toneOfVoice are mapped if available
        targetAudience: conceptData.targetAudience,
        toneOfVoice: conceptData.tone
    };

    return await createSocialCampaign(projectId, campaignData);
};

// --- Analytics ---

export const getFunnelMetrics = async (projectId: string): Promise<MarketingFunnelMetric[]> => {
    try {
        const adQ = query(collection(db, 'ad_campaigns'), where('projectId', '==', projectId));
        const emailQ = query(collection(db, 'email_campaigns'), where('projectId', '==', projectId));

        const [adSnaps, emailSnaps] = await Promise.all([getDocs(adQ), getDocs(emailQ)]);

        const ads = adSnaps.docs.map(d => d.data() as AdCampaign);
        const emails = emailSnaps.docs.map(d => d.data() as EmailCampaign);

        // Aggregation Logic
        // Awareness: Ad Impressions + Emails Sent
        const awareness = ads.reduce((sum, ad) => sum + (ad.metrics?.impressions || 0), 0) +
            emails.reduce((sum, email) => sum + (email.stats?.sent || 0), 0);

        // Interest: Ad Clicks + Email Opens
        const interest = ads.reduce((sum, ad) => sum + (ad.metrics?.clicks || 0), 0) +
            emails.reduce((sum, email) => sum + (email.stats?.opened || 0), 0);

        // Consideration: Email Clicks (High intent)
        const consideration = emails.reduce((sum, email) => sum + (email.stats?.clicked || 0), 0);

        // Conversion: Ad Conversions
        const conversion = ads.reduce((sum, ad) => sum + (ad.metrics?.conversions || 0), 0);

        return [
            { stage: 'Awareness', value: awareness, change: 0 }, // Change tracking requires historical data snapshots, skipping for now
            { stage: 'Interest', value: interest, change: 0 },
            { stage: 'Consideration', value: consideration, change: 0 },
            { stage: 'Conversion', value: conversion, change: 0 },
            { stage: 'Retention', value: 0, change: 0 } // Requires retention data
        ];
    } catch (error) {
        console.error("Failed to fetch funnel metrics", error);
        return [];
    }
};
