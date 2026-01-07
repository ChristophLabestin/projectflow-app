import { SocialPlatform, SocialPostFormat } from '../../types';

export type FlowTone = 'primary' | 'neutral' | 'warning' | 'success' | 'danger';

export interface PipelineStageConfig {
    id: string;
    title: string;
    icon: string;
    tone: FlowTone;
}

export const PIPELINE_CONFIGS: Record<string, PipelineStageConfig[]> = {
    'Feature': [
        { id: 'Brainstorm', title: 'Brainstorm', icon: 'psychology', tone: 'neutral' },
        { id: 'Refining', title: 'Refining', icon: 'tune', tone: 'primary' },
        { id: 'Concept', title: 'Concept', icon: 'architecture', tone: 'primary' },
        { id: 'Review', title: 'In Review', icon: 'rate_review', tone: 'warning' },
        { id: 'Approved', title: 'Approved', icon: 'verified', tone: 'success' },
    ],
    'Product': [
        { id: 'Discovery', title: 'Discovery', icon: 'explore', tone: 'neutral' },
        { id: 'Definition', title: 'Definition', icon: 'article', tone: 'primary' },
        { id: 'Development', title: 'Development', icon: 'construction', tone: 'primary' },
        { id: 'Concept', title: 'Concept', icon: 'architecture', tone: 'primary' },
        { id: 'Launch', title: 'Launch', icon: 'rocket', tone: 'success' },
    ],
    'Marketing': [
        { id: 'Strategy', title: 'Strategy', icon: 'ads_click', tone: 'primary' },
        { id: 'Planning', title: 'Planning', icon: 'calendar_month', tone: 'neutral' },
        { id: 'Execution', title: 'Execution', icon: 'bolt', tone: 'primary' },
        { id: 'Analysis', title: 'Analysis', icon: 'analytics', tone: 'success' },
    ],
    'Social': [
        { id: 'Brainstorm', title: 'Brainstorm', icon: 'psychology', tone: 'neutral' },
        { id: 'Strategy', title: 'Strategy', icon: 'ads_click', tone: 'primary' },
        { id: 'CreativeLab', title: 'Creative Lab', icon: 'experiment', tone: 'primary' },
        { id: 'Studio', title: 'Content Studio', icon: 'movie_edit', tone: 'primary' },
        { id: 'Distribution', title: 'Distribution', icon: 'analytics', tone: 'success' },
    ],
    'SocialCampaign': [
        { id: 'Concept', title: 'Concept', icon: 'lightbulb', tone: 'primary' },
        { id: 'Strategy', title: 'Strategy', icon: 'ads_click', tone: 'primary' },
        { id: 'Planning', title: 'Planning', icon: 'calendar_month', tone: 'neutral' },
        { id: 'Submit', title: 'Submit', icon: 'send', tone: 'warning' },
        { id: 'Approved', title: 'Live / Integrated', icon: 'check_circle', tone: 'success' },
        { id: 'Rejected', title: 'Rejected', icon: 'cancel', tone: 'danger' },
    ],
    'Moonshot': [
        { id: 'Feasibility', title: 'Feasibility', icon: 'science', tone: 'neutral' },
        { id: 'Prototype', title: 'Prototype', icon: 'precision_manufacturing', tone: 'primary' },
        { id: 'Greenlight', title: 'Greenlight', icon: 'check_circle', tone: 'success' },
    ],
    'Optimization': [
        { id: 'Analysis', title: 'Analysis', icon: 'analytics', tone: 'neutral' },
        { id: 'Proposal', title: 'Proposal', icon: 'description', tone: 'primary' },
        { id: 'Benchmark', title: 'Benchmark', icon: 'speed', tone: 'primary' },
        { id: 'Implementation', title: 'Implementation', icon: 'code', tone: 'success' },
    ],
    'PaidAds': [
        { id: 'Brief', title: 'Brief', icon: 'description', tone: 'neutral' },
        { id: 'Research', title: 'Research', icon: 'insights', tone: 'primary' },
        { id: 'Creative', title: 'Creative', icon: 'palette', tone: 'primary' },
        { id: 'Targeting', title: 'Targeting', icon: 'target', tone: 'primary' },
        { id: 'Budget', title: 'Budget', icon: 'payments', tone: 'primary' },
        { id: 'Build', title: 'Build & QA', icon: 'fact_check', tone: 'primary' },
        { id: 'Review', title: 'Review', icon: 'rate_review', tone: 'warning' },
        { id: 'Live', title: 'Live', icon: 'bolt', tone: 'success' },
        { id: 'Optimization', title: 'Optimization', icon: 'auto_graph', tone: 'primary' },
    ],
};

export const OVERVIEW_COLUMNS: PipelineStageConfig[] = [
    { id: 'Feature', title: 'Feature Pipeline', icon: 'extension', tone: 'primary' },
    { id: 'Product', title: 'Product Launch', icon: 'rocket_launch', tone: 'neutral' },
    { id: 'Marketing', title: 'Marketing', icon: 'campaign', tone: 'primary' },
    { id: 'Social', title: 'Social Media', icon: 'share', tone: 'primary' },
    { id: 'Moonshot', title: 'Moonshot', icon: 'science', tone: 'neutral' },
    { id: 'Optimization', title: 'Optimization', icon: 'speed', tone: 'neutral' },
];

export const TYPE_TONES: Record<string, FlowTone> = {
    Feature: 'primary',
    Product: 'primary',
    Marketing: 'primary',
    Social: 'primary',
    Moonshot: 'primary',
    Optimization: 'primary',
    PaidAds: 'primary',
    default: 'neutral'
};

export const PLATFORM_FORMATS: Record<SocialPlatform, SocialPostFormat[]> = {
    'Instagram': ['Post', 'Story', 'Reel'],
    'Facebook': ['Text', 'Post', 'Reel', 'Story'],
    'LinkedIn': ['Text', 'Post', 'Carousel'],
    'TikTok': ['Video'],
    'X': ['Text', 'Post'],
    'YouTube': ['Video', 'Short'],
};
