import {
    MarketingCampaign,
    AdCampaign,
    EmailCampaign,
    MarketingAudience,
    MarketingFunnelMetric,
    AdGroup,
    MarketingStrategyStatus
} from '../types';

// Mock Data Store
let mockMarketingCampaigns: MarketingCampaign[] = [
    {
        id: 'mc1',
        projectId: 'demo-project',
        name: 'Q1 Growth Push',
        description: 'Aggressive user acquisition for Q1',
        status: 'Active',
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        budgetTotal: 50000,
        budgetSpent: 12500,
        channels: ['Google Ads', 'Meta Ads', 'Email'],
        ownerId: 'user1',
        createdAt: new Date()
    }
];

let mockAdCampaigns: AdCampaign[] = [
    {
        id: 'ac1',
        projectId: 'demo-project',
        marketingCampaignId: 'mc1',
        platform: 'Google',
        name: 'Search - Brand Keywords',
        status: 'Enabled',
        budgetDaily: 100,
        spend: 4500,
        objective: 'Traffic',
        metrics: {
            impressions: 15000,
            clicks: 850,
            ctr: 5.6,
            cpc: 2.10,
            conversions: 120,
            costPerConversion: 15.5,
            roas: 4.2
        },
        startDate: '2024-01-05'
    },
    {
        id: 'ac2',
        projectId: 'demo-project',
        marketingCampaignId: 'mc1',
        platform: 'Meta',
        name: 'Retargeting - Site Visitors',
        status: 'Paused',
        budgetDaily: 50,
        spend: 1200,
        objective: 'Conversions',
        metrics: {
            impressions: 8000,
            clicks: 200,
            ctr: 2.5,
            cpc: 1.80,
            conversions: 15,
            costPerConversion: 45.0,
            roas: 1.5
        },
        startDate: '2024-01-10'
    }
];

let mockEmailCampaigns: EmailCampaign[] = [
    {
        id: 'ec1',
        projectId: 'demo-project',
        marketingCampaignId: 'mc1',
        name: 'Feb Newsletter',
        subject: 'Product Update: New Features!',
        senderName: 'Team ProjectFlow',
        status: 'Sent',
        sentAt: '2024-02-15T10:00:00Z',
        stats: {
            sent: 5000,
            opened: 2400,
            clicked: 850,
            bounced: 12,
            unsubscribed: 5
        }
    },
    {
        id: 'ec2',
        projectId: 'demo-project',
        name: 'March Promo',
        subject: 'Special Offer Inside',
        senderName: 'Team ProjectFlow',
        status: 'Draft',
        stats: { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }
    }
];

let mockAudiences: MarketingAudience[] = [
    { id: 'aud1', projectId: 'demo-project', name: 'All Users', count: 12500, source: 'CRM' },
    { id: 'aud2', projectId: 'demo-project', name: 'Leads (Lat 30 Days)', count: 450, source: 'Signups' }
];

let mockFunnel: MarketingFunnelMetric[] = [
    { stage: 'Awareness', value: 50000, change: 12 },
    { stage: 'Interest', value: 15000, change: 8 },
    { stage: 'Consideration', value: 5000, change: -2 },
    { stage: 'Conversion', value: 1200, change: 15 },
    { stage: 'Retention', value: 800, change: 5 }
];

// Mock Listeners
type Listener<T> = (data: T) => void;

function createMockSubscription<T>(
    initialData: T,
    selector: () => T
) {
    return (callback: Listener<T>) => {
        // Initial callback
        setTimeout(() => callback(selector()), 100);

        // Return unsubscribe
        return () => { };
    };
}

// Services

export const subscribeMarketingCampaigns = (projectId: string, onUpdate: Listener<MarketingCampaign[]>) => {
    // In a real app, this would use onSnapshot from Firestore
    return createMockSubscription([], () =>
        mockMarketingCampaigns.filter(c => c.projectId === projectId || c.projectId === 'demo-project')
    )(onUpdate);
};

export const subscribeAdCampaigns = (projectId: string, onUpdate: Listener<AdCampaign[]>) => {
    return createMockSubscription([], () =>
        mockAdCampaigns.filter(c => c.projectId === projectId || c.projectId === 'demo-project')
    )(onUpdate);
};

export const subscribeEmailCampaigns = (projectId: string, onUpdate: Listener<EmailCampaign[]>) => {
    return createMockSubscription([], () =>
        mockEmailCampaigns.filter(c => c.projectId === projectId || c.projectId === 'demo-project')
    )(onUpdate);
};

export const subscribeAudiences = (projectId: string, onUpdate: Listener<MarketingAudience[]>) => {
    return createMockSubscription([], () =>
        mockAudiences.filter(c => c.projectId === projectId || c.projectId === 'demo-project')
    )(onUpdate);
};

export const getFunnelMetrics = async (projectId: string): Promise<MarketingFunnelMetric[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockFunnel;
};

// CRUD Operations

export const createMarketingCampaign = async (campaign: Omit<MarketingCampaign, 'id' | 'createdAt'>) => {
    const newCampaign = {
        ...campaign,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date()
    };
    mockMarketingCampaigns = [...mockMarketingCampaigns, newCampaign];
    return newCampaign.id;
};

export const createAdCampaign = async (campaign: Omit<AdCampaign, 'id'>) => {
    const newCampaign = {
        ...campaign,
        id: Math.random().toString(36).substr(2, 9)
    };
    mockAdCampaigns = [...mockAdCampaigns, newCampaign];
    return newCampaign.id;
};

export const createEmailCampaign = async (campaign: Omit<EmailCampaign, 'id'>) => {
    const newCampaign = {
        ...campaign,
        id: Math.random().toString(36).substr(2, 9)
    };
    mockEmailCampaigns = [...mockEmailCampaigns, newCampaign];
    return newCampaign.id;
};

export const updateAdCampaignStatus = async (id: string, status: AdCampaign['status']) => {
    mockAdCampaigns = mockAdCampaigns.map(c => c.id === id ? { ...c, status } : c);
};

export const updateEmailCampaignStatus = async (id: string, status: EmailCampaign['status']) => {
    mockEmailCampaigns = mockEmailCampaigns.map(c => c.id === id ? { ...c, status } : c);
};
