import {
    MarketingCampaign,
    AdCampaign,
    EmailCampaign,
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
