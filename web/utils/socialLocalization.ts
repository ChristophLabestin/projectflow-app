import { SocialPostFormat, SocialPostStatus, SocialCampaign } from '../types';

type Translator = (key: string, fallback?: string) => string;

const postStatusKeyMap: Record<SocialPostStatus, string> = {
    Draft: 'draft',
    'In Review': 'inReview',
    Approved: 'approved',
    Scheduled: 'scheduled',
    Publishing: 'publishing',
    Published: 'published',
    Failed: 'failed',
    'Needs Manual Publish': 'needsManualPublish',
    Archived: 'archived',
};

const postFormatKeyMap: Record<SocialPostFormat, string> = {
    Text: 'text',
    Post: 'post',
    Image: 'image',
    Video: 'video',
    Carousel: 'carousel',
    Story: 'story',
    Reel: 'reel',
    Short: 'short',
};

const campaignStatusKeyMap: Record<SocialCampaign['status'], string> = {
    Backlog: 'backlog',
    Planning: 'planning',
    Concept: 'concept',
    Active: 'active',
    Completed: 'completed',
    Paused: 'paused',
    Archived: 'archived',
    Rejected: 'rejected',
    PendingReview: 'pendingReview',
    ChangesRequested: 'changesRequested',
};

const ideaStageKeyMap: Record<string, string> = {
    Ideation: 'ideation',
    Drafting: 'drafting',
    PendingReview: 'pendingReview',
    Review: 'review',
    Approved: 'approved',
    Concept: 'concept',
};

export const getSocialPostStatusLabel = (status: SocialPostStatus, t: Translator) => {
    const key = postStatusKeyMap[status];
    return t(`social.post.status.${key}`, status);
};

export const getSocialPostFormatLabel = (format: SocialPostFormat, t: Translator) => {
    const key = postFormatKeyMap[format];
    return t(`social.post.format.${key}`, format);
};

export const getSocialCampaignStatusLabel = (status: SocialCampaign['status'], t: Translator) => {
    const key = campaignStatusKeyMap[status];
    return t(`social.campaign.status.${key}`, status);
};

export const getSocialIdeaStageLabel = (stage: string, t: Translator) => {
    const key = ideaStageKeyMap[stage];
    if (!key) return stage;
    return t(`social.flow.stage.${key}`, stage);
};
