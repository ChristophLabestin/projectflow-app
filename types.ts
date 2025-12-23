export interface Tenant {
    id: string;
    name: string;
    description?: string;
    website?: string;
    contactEmail?: string;
    members?: Member[];
    createdAt?: any;
    updatedAt?: any;
}

export interface AIUsage {
    tokensUsed: number;
    tokenLimit: number;
    lastReset: any; // Firestore Timestamp
}

// Permission System Types
export type ProjectRole = 'Owner' | 'Editor' | 'Viewer';
export type WorkspaceRole = 'Owner' | 'Admin' | 'Member' | 'Guest';

export interface ProjectMember {
    userId: string;
    role: ProjectRole;
    joinedAt: any; // Firestore Timestamp
    invitedBy: string; // User ID of inviter
}

export interface RoleCapabilities {
    canEdit: boolean; // Edit project settings
    canDelete: boolean; // Delete project
    canInvite: boolean; // Invite new members
    canManageTasks: boolean; // Create/edit/delete tasks
    canManageIdeas: boolean; // Create/edit/delete ideas
    canManageIssues: boolean; // Create/edit/delete issues
    canComment: boolean; // Add comments
    canView: boolean; // View project
}

export interface WorkspacePermissions {
    canManageWorkspace: boolean; // Settings, billing
    canManageMembers: boolean; // Invite, remove, change roles
    canManageGroups: boolean; // Create/edit/delete groups
    canCreateProjects: boolean;
    canDeleteProjects: boolean;
    canViewAllProjects: boolean; // View private projects? Or just existence?
}

export interface WorkspaceGroup {
    id: string;
    tenantId: string;
    name: string;
    description?: string;
    memberIds: string[];
    color?: string;
    createdAt?: any;
}

export interface ProjectInviteLink {
    id: string; // Unique invite link ID
    projectId: string;
    role: ProjectRole; // Role assigned when joining
    createdBy: string; // User ID who created the link
    createdAt: any; // Firestore Timestamp
    expiresAt: any; // Firestore Timestamp
    maxUses?: number; // Max number of times link can be used (undefined = unlimited)
    uses: number; // Current number of uses
    isActive: boolean; // Can be disabled manually
}

export interface Project {
    id: string;
    title: string;
    description: string;
    progress: number;
    status: 'Active' | 'Brainstorming' | 'Completed' | 'Review' | 'On Hold' | 'Planning';
    dueDate?: string;
    startDate?: string;
    ownerId: string;
    coverImage?: string;
    squareIcon?: string;
    screenshots?: string[];
    priority?: string;
    isPrivate?: boolean;
    modules?: ProjectModule[];
    links?: { title: string; url: string; }[]; // Links shown in Overview
    externalResources?: { title: string; url: string; icon?: string }[]; // Links shown in Sidebar
    members?: ProjectMember[]; // Team members with roles (replaces string[])
    memberIds?: string[]; // IDs of all members for collectionGroup queries
    createdAt?: any; // Firestore Timestamp
    tenantId?: string;
    githubRepo?: string; // owner/repo
    githubToken?: string; // Personal Access Token
    githubIssueSync?: boolean; // Toggle for issue sync
}

export interface Member {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    role: WorkspaceRole;
    groupIds?: string[]; // IDs of groups the user belongs to
    joinedAt?: any;
    aiUsage?: AIUsage;
    githubToken?: string;
}

export interface Comment {
    id: string;
    projectId: string;
    targetId: string; // ID of the Task, Issue, or Idea
    targetType: 'task' | 'issue' | 'idea';
    userId: string;
    userDisplayName: string;
    userPhotoURL?: string;
    content: string;
    createdAt: any;
}

export type ProjectModule = 'tasks' | 'ideas' | 'mindmap' | 'activity' | 'issues' | 'milestones' | 'social' | 'marketing';

export interface Task {
    id: string;
    projectId: string;
    ownerId: string;
    title: string;
    isCompleted: boolean;
    dueDate?: string;
    priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
    assignee?: string; // Legacy: Display Name or URL
    assigneeId?: string; // User UID
    assigneeIds?: string[]; // New: Multiple User UIDs
    description?: string;
    category?: IdeaGroup | IdeaGroup[];
    status?: TaskStatus;
    scheduledDate?: string; // Smart Schedule Date
    createdAt?: any;
    tenantId?: string; // For path resolution
    linkedIssueId?: string; // Linked issue (if converted from an issue)
}

export interface SubTask {
    id: string;
    taskId: string;
    projectId?: string;
    ownerId: string;
    title: string;
    isCompleted: boolean;
    assigneeId?: string;
    createdAt?: any;
}

export interface Idea {
    id: string;
    projectId?: string;
    ownerId?: string;
    title: string;
    description: string;
    type: IdeaGroup;
    mindmapId?: string;
    parentIdeaId?: string;
    votes: number;
    comments: number;
    generated?: boolean;
    tenantId?: string; // Optional: ID of the tenant where this project lives
    convertedTaskId?: string;
    convertedAt?: any;
    createdAt?: any;
    posX?: number;
    posY?: number;
}

export interface Issue {
    id: string;
    projectId: string;
    tenantId: string;
    ownerId: string;
    title: string;
    description: string;
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    reporter: string; // User Name
    reporterId?: string; // User UID
    assignee?: string; // User Name
    assigneeId?: string; // User UID
    assigneeIds?: string[]; // New: Multiple User UIDs
    scheduledDate?: string; // Smart Schedule Date
    createdAt: any;
    linkedTaskId?: string; // Linked task (if converted to a task)
    githubIssueUrl?: string; // URL of the synced GitHub issue
    githubIssueNumber?: number; // Number of the synced GitHub issue
}

export interface Activity {
    id: string;
    projectId: string;
    ownerId: string;
    user: string;
    userAvatar?: string;
    action: string;
    target: string;
    details?: string;
    type: 'comment' | 'task' | 'file' | 'commit' | 'status' | 'priority' | 'report' | 'member';
    createdAt?: any;
}

export type IdeaGroup =
    | 'Feature'
    | 'Task'
    | 'Marketing'
    | 'Admin'
    | 'UI'
    | 'UX'
    | 'Architecture'
    | 'Research'
    | 'Operations'
    | 'Growth'
    | string;

export interface MindmapGrouping {
    group: string;
    reason?: string;
    ideaIds: string[];
}

export type TaskStatus = 'Backlog' | 'Open' | 'In Progress' | 'On Hold' | 'Blocked' | 'Done';

export interface TaskCategory {
    id: string;
    projectId: string;
    ownerId?: string;
    name: string;
    normalized?: string;
    createdAt?: any;
}

export interface Mindmap {
    id: string;
    projectId: string;
    ownerId?: string;
    name: string;
    createdAt?: any;
}
export interface ProjectBlueprint {
    id: string;
    title: string;
    description: string;
    targetAudience: string;
    milestones: { title: string; description: string }[];
    initialTasks: { title: string; priority: 'Low' | 'Medium' | 'High' }[];
    suggestedTechStack?: string[];
    createdAt: any;
}

export interface Milestone {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    dueDate?: string;
    status: 'Pending' | 'Achieved' | 'Missed';
    createdAt: any;
    createdBy: string;
    tenantId: string;
}

export interface ProjectRisk {
    risk: string;
    impact: 'Low' | 'Medium' | 'High';
    probability: 'Low' | 'Medium' | 'High';
    mitigation: string;
}

export type StudioTool = 'Architect' | 'Brainstormer' | 'RiskScout' | 'Strategist';

// AI Search Types
export interface SearchResult {
    type: 'project' | 'task' | 'answer';
    id?: string;
    title: string;
    description?: string;
    projectId?: string;
    projectTitle?: string;
    relevance?: number;
}

export interface AISearchAnswer {
    answer: string;
    relevantProjects: string[];
    relevantTasks: string[];
    confidence: 'Low' | 'Medium' | 'High';
}

export type NotificationType =
    | 'task_assigned'
    | 'task_updated'
    | 'task_completed'
    | 'issue_assigned'
    | 'issue_updated'
    | 'project_invite'
    | 'workspace_invite'
    | 'comment_mention'
    | 'comment_added'
    | 'project_shared'
    | 'subtask_assigned'
    | 'project_join_request'
    | 'project_join_request_accepted'
    | 'project_join_request_denied';

export interface Notification {
    id: string;
    type: NotificationType;
    userId: string; // Recipient
    title: string;
    message: string;
    read: boolean;
    createdAt: any; // Firestore Timestamp
    // Context data for navigation
    projectId?: string;
    taskId?: string;
    issueId?: string;
    commentId?: string;
    inviteId?: string;
    // Actor info
    actorId?: string;
    actorName?: string;
    actorPhotoURL?: string;
    tenantId?: string;
}

export interface GeminiReport {
    id: string;
    projectId: string;
    content: string;
    createdAt: any;
    createdBy: string;
    userName: string;
}

// --- Social Media Module Types ---

export type SocialPlatform = 'Instagram' | 'Facebook' | 'LinkedIn' | 'TikTok' | 'X';
export type SocialPostStatus = 'Draft' | 'In Review' | 'Approved' | 'Scheduled' | 'Publishing' | 'Published' | 'Failed' | 'Needs Manual Publish' | 'Archived';
export type SocialPostFormat = 'Image' | 'Video' | 'Carousel' | 'Story' | 'Reel';

export interface SocialCampaign {
    id: string;
    projectId: string;
    name: string;
    goal?: string;
    startDate?: string; // ISO Date
    endDate?: string;   // ISO Date
    targetAudience?: string;
    toneOfVoice?: string;
    status: 'Planning' | 'Active' | 'Completed' | 'Paused';
    ownerId: string;
    createdAt: any;
    updatedAt: any;
    color?: string; // For calendar visualization
}

export interface SocialAsset {
    id: string;
    projectId: string;
    campaignId?: string;
    url: string;
    storagePath: string; // Firebase Storage path
    type: 'image' | 'video';
    filename: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
    tags?: string[];
    createdAt: any;
    createdBy: string;
}


export interface SocialIntegration {
    id: string;
    projectId: string;
    platform: SocialPlatform;
    username: string;
    avatarUrl?: string;
    status: 'Connected' | 'Expired' | 'Disconnected';
    accessToken?: string; // Should be kept secure/server-side in real app
    connectedAt: string;
    expiresAt?: string;
}

export interface SocialPost {
    id: string;
    projectId: string;
    campaignId?: string;
    platform: SocialPlatform;
    content: {
        caption: string;
        hashtags: string[];
        mentions?: string[];
        location?: string;
        linkInBio?: string;
    };
    assets: SocialAsset[]; // Ordered list of assets for this post
    format: SocialPostFormat;
    status: SocialPostStatus;
    scheduledFor?: string; // ISO string
    publishedAt?: string; // ISO string
    publishedUrl?: string; // New field
    createdBy: string;
    createdAt: any;
    updatedAt: any;

    // Approval Workflow
    approvals?: {
        required: boolean;
        status: 'Pending' | 'Approved' | 'Rejected';
        approvedBy?: string;
        approvedAt?: any;
    }[];

    // Publishing Metadata
    externalId?: string; // ID from the platform (e.g. IG Media ID)
    error?: string; // Last error message if failed
}

// --- Online Marketing Module Types ---

export type MarketingStrategyStatus = 'Planning' | 'Active' | 'Completed' | 'Paused';
export type MarketingChannel = 'Google Ads' | 'Meta Ads' | 'LinkedIn Ads' | 'Email' | 'SEO' | 'Content';

export interface MarketingCampaign {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    status: MarketingStrategyStatus;
    startDate?: string;
    endDate?: string;
    budgetTotal?: number;
    budgetSpent?: number;
    channels: MarketingChannel[];
    ownerId: string;
    createdAt: any;
}

// Paid Ads
export interface AdCampaign {
    id: string;
    projectId: string;
    marketingCampaignId?: string;
    platform: 'Google' | 'Meta' | 'LinkedIn' | 'Other';
    name: string;
    status: 'Enabled' | 'Paused' | 'Ended';
    budgetDaily?: number;
    budgetTotal?: number;
    spend: number;
    objective: 'Traffic' | 'Leads' | 'Sales' | 'Brand Awareness';
    metrics: {
        impressions: number;
        clicks: number;
        ctr: number;
        cpc: number;
        conversions: number;
        costPerConversion: number;
        roas: number;
    };
    startDate: string;
    endDate?: string;
}

export interface AdGroup {
    id: string;
    adCampaignId: string;
    name: string;
    status: 'Enabled' | 'Paused';
    keywords?: string[];
    targeting?: string;
}

export interface AdCreative {
    id: string;
    adGroupId: string;
    headline: string;
    description: string;
    assetUrl?: string;
    previewUrl?: string;
    format: 'Text' | 'Image' | 'Video' | 'Carousel';
    status: 'Active' | 'Disapproved' | 'Paused';
}

// Email Marketing
export interface EmailCampaign {
    id: string;
    projectId: string;
    marketingCampaignId?: string;
    name: string;
    subject: string;
    preheader?: string;
    senderName: string;
    contentHtml?: string;
    audienceId?: string;
    status: 'Draft' | 'Scheduled' | 'Sent';
    scheduledAt?: string;
    sentAt?: string;
    stats: {
        sent: number;
        opened: number;
        clicked: number;
        bounced: number;
        unsubscribed: number;
    };
}

export interface MarketingAudience {
    id: string;
    projectId: string;
    name: string;
    count: number;
    filters?: string;
    source: 'Import' | 'Signups' | 'CRM';
}

// Strategy
export interface MarketingFunnelMetric {
    stage: 'Awareness' | 'Interest' | 'Consideration' | 'Conversion' | 'Retention';
    value: number;
// --- Email Builder Types ---

// --- Email Builder Types ---

export type EmailBlockType = 'text' | 'image' | 'button' | 'spacer' | 'divider' | 'social' | 'video' | 'columns' | 'header' | 'list' | 'quote' | 'html' | 'menu' | 'flex' | 'solid' | 'div';

export interface EmailBlockStyle {
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    backgroundColor?: string;
    color?: string;
    fontSize?: number;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right';
    borderRadius?: number;
    borderWidth?: number;
    borderColor?: string;
    borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
    gap?: number; // For columns gap
    width?: string; // e.g. '100%' or 'auto'
    height?: number;
    fontFamily?: string;
    // Flex Container Styles
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
    justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
    alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    gridSpan?: number;
}

export interface EmailBlock {
    id: string;
    type: EmailBlockType;
    name?: string; // Custom user-defined name
    content: {
        text?: string; // For text/button
        src?: string; // For image/video thumbnail
        alt?: string; // For image
        url?: string; // For button/image/video link
        width?: string; // specialized width
        columns?: EmailBlock[][]; // For 'columns' type: Array of arrays of blocks
        socialLinks?: { platform: 'twitter' | 'facebook' | 'linkedin' | 'instagram'; url: string }[]; // For 'social' type
        menuLinks?: { label: string; url: string }[]; // For 'menu' type
        videoUrl?: string; // For 'video' type: YouTube/Vimeo URL
        children?: EmailBlock[]; // For 'flex' type: Flat list of children
    };
    styles: EmailBlockStyle;
}
export interface TemplateVariable {
    id: string;
    name: string;
    label: string;
    defaultValue?: string;
    type: 'text' | 'date' | 'number' | 'url';
}

export interface EmailTemplate {
    id: string;
    projectId: string;
    name: string;
    blocks: EmailBlock[];
    status: 'draft' | 'published';
    thumbnail?: string;
    createdAt: any;
    updatedAt: any;
    lastAutoSaved?: any;
    variables?: TemplateVariable[];
}

export interface EmailComponent {
    id: string;
    projectId: string;
    name: string;
    block: EmailBlock;
    createdAt: any;
    createdBy: string;
}
