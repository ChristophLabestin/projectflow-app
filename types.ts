export interface Tenant {
    id: string;
    name: string;
    description?: string;
    website?: string;
    contactEmail?: string;
    smtpConfig?: SMTPConfig;
    members?: Member[];
    createdAt?: any;
    updatedAt?: any;
    originIdeaId?: string;
}

export interface AIUsage {
    tokensUsed: number;
    tokenLimit: number;
    imagesUsed: number;
    imageLimit: number;
    lastReset: any; // Firestore Timestamp
    originIdeaId?: string;
}

// Permission System Types
export type ProjectRole = 'Owner' | 'Editor' | 'Viewer';
export type WorkspaceRole = 'Owner' | 'Admin' | 'Member' | 'Guest';

export interface ProjectMember {
    userId: string;
    role: ProjectRole;
    joinedAt: any; // Firestore Timestamp
    invitedBy: string; // User ID of inviter
    originIdeaId?: string;
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
    canManageGroups: boolean; // Create/edit/delete project groups
    originIdeaId?: string;
}

export interface WorkspacePermissions {
    canManageWorkspace: boolean; // Settings, billing
    canManageMembers: boolean; // Invite, remove, change roles
    canManageGroups: boolean; // Create/edit/delete groups
    canCreateProjects: boolean;
    canDeleteProjects: boolean;
    canViewAllProjects: boolean; // View private projects? Or just existence?
    originIdeaId?: string;
}

export interface WorkspaceGroup {
    id: string;
    tenantId: string;
    name: string;
    description?: string;
    memberIds: string[];
    color?: string;
    createdAt?: any;
    originIdeaId?: string;
}

export interface ProjectGroup {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    memberIds: string[];
    color?: string;
    createdAt?: any;
    updatedAt?: any;
    originIdeaId?: string;
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
    originIdeaId?: string;
}

export interface Project {
    id: string;
    title: string;
    description: string;
    progress: number;
    status: 'Active' | 'Brainstorming' | 'Completed' | 'Review' | 'On Hold' | 'Planning';
    projectState?: 'pre-release' | 'released' | 'not specified';
    dueDate?: string;
    startDate?: string;
    ownerId: string;
    coverImage?: string;
    squareIcon?: string;
    screenshots?: string[];
    priority?: string;
    isPrivate?: boolean;
    modules?: ProjectModule[];
    links?: { title: string; url: string; originIdeaId?: string; }[]; // Links shown in Overview
    externalResources?: { title: string; url: string; icon?: string; originIdeaId?: string; }[]; // Links shown in Sidebar
    members?: ProjectMember[]; // Team members with roles (replaces string[])
    memberIds?: string[]; // IDs of all members for collectionGroup queries
    createdAt?: any; // Firestore Timestamp
    updatedAt?: any; // Firestore Timestamp
    tenantId?: string;
    githubRepo?: string; // owner/repo
    githubToken?: string; // Personal Access Token
    githubIssueSync?: boolean; // Toggle for issue sync
    isPersonal?: boolean; // Hidden personal project
    visibilityGroupIds?: string[]; // IDs of groups that can view this project
    visibilityGroupId?: string; // @deprecated Use visibilityGroupIds instead
    originIdeaId?: string;
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
    pinnedProjectId?: string;
    privacySettings?: PrivacySettings;
    originIdeaId?: string;
    geminiConfig?: {
        apiKey: string;
        tokenLimit: number; // User-defined limit
    };
}

export type PrivacyScope = 'public' | 'members' | 'guests' | 'private';

export interface PrivacySettings {
    email: PrivacyScope;
    bio: PrivacyScope;
    skills: PrivacyScope;
    address: PrivacyScope;
    stats: PrivacyScope;
    originIdeaId?: string;
}

export interface ProjectNavPrefs {
    order: string[]; // Nav item IDs in order
    hidden: string[]; // Nav item IDs that are hidden
    originIdeaId?: string;
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
    originIdeaId?: string;
}

export type ProjectModule = 'tasks' | 'ideas' | 'mindmap' | 'activity' | 'issues' | 'milestones' | 'social' | 'marketing';

export interface Task {
    id: string;
    projectId: string;
    ownerId: string;
    title: string;
    isCompleted: boolean;
    dueDate?: string;
    startDate?: string;
    priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
    effort?: 'Low' | 'Medium' | 'High';
    assignee?: string; // Legacy: Display Name or URL
    assigneeId?: string; // User UID
    assigneeIds?: string[]; // New: Multiple User UIDs
    assignedGroupIds?: string[]; // New: Assigned Groups
    description?: string;
    category?: IdeaGroup | IdeaGroup[];
    status?: TaskStatus;
    scheduledDate?: string; // Smart Schedule Date
    createdAt?: any;
    tenantId?: string; // For path resolution
    linkedIssueId?: string; // Linked issue (if converted from an issue)
    convertedIdeaId?: string; // Linked idea (if converted from an idea)
    createdBy?: string;
    completedBy?: string; // User UID
    completedAt?: any; // Firestore Timestamp
    originIdeaId?: string;
    dependencies?: string[]; // IDs of tasks that this task depends on
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
    completedBy?: string;
    completedAt?: any;
    originIdeaId?: string;
}

export interface PersonalTask {
    id: string;
    ownerId: string;
    title: string;
    isCompleted: boolean;
    dueDate?: string;
    priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
    description?: string;
    category?: IdeaGroup | IdeaGroup[];
    status?: TaskStatus;
    scheduledDate?: string;
    createdAt?: any;
    tenantId?: string;
    completedAt?: any;
    originIdeaId?: string;
}

export type IdeaStage =
    // Generic / Feature
    | 'Brainstorm' | 'Refining' | 'Concept' | 'Review' | 'Approved'
    // Marketing
    | 'Ideation' | 'Content' | 'Scheduled' | 'Live'
    // Moonshot
    | 'Feasibility' | 'Prototype' | 'Greenlight'
    // Optimization
    | 'Analysis' | 'Proposal' | 'Benchmark' | 'Implementation'
    // Product
    | 'Strategy' | 'Discovery' | 'Definition' | 'Development' | 'Launch'
    // Paid Ads
    | 'Brief' | 'Research' | 'Creative' | 'Targeting' | 'Budget' | 'Build' | 'Optimization'
    | string; // Keep string fallback for safety

export interface Idea {
    id: string;
    projectId?: string;
    ownerId?: string;
    title: string;
    description: string;
    type: IdeaGroup;
    stage: IdeaStage;
    mindmapId?: string;
    parentIdeaId?: string;
    votes: number;
    likedBy?: string[]; // User IDs
    dislikedBy?: string[]; // User IDs
    comments: number;
    impact?: 'Low' | 'Medium' | 'High';
    effort?: 'Low' | 'Medium' | 'High';
    generated?: boolean;
    tenantId?: string; // Optional: ID of the tenant where this project lives
    convertedTaskId?: string;
    convertedAt?: any;
    createdAt?: any;
    posX?: number;
    posY?: number;
    concept?: string; // Markdown content for the full concept
    aiSessionId?: string; // For persistent chat sessions
    approvedBy?: string;
    approvedAt?: any;
    analysis?: {
        strengths: string[];
        weaknesses: string[];
        opportunities: string[];
        threats: string[];
        originIdeaId?: string;
    };
    riskWinAnalysis?: RiskWinAnalysis;
    keywords?: string[];
    dismissedSuggestions?: string[];
    tags?: string[];
    requirements?: string; // JSON string for Discovery/Definition data
    devPlan?: string;     // JSON string for Development data
    launchPlan?: string;  // JSON string for Launch data
    convertedCampaignId?: string; // ID of the created marketing campaign
    campaignType?: 'email' | 'ad' | 'marketing' | 'social'; // Type of the created campaign
    socialType?: 'post' | 'campaign'; // Distinguish between single post and campaign
    marketingType?: 'paidAd' | 'emailMarketing'; // Distinguish between paid ads and email marketing
    lastRejectionReason?: string; // Feedback from rejection/change request
    originIdeaId?: string;
    assignedUserIds?: string[];
    aiTokensUsed?: number;
    // Structured Paid Ads Data
    adData?: {
        // Brief
        objective?: AdObjective | string;
        missionStatement?: string;
        targetKPIs?: string;
        competitors?: string;
        duration?: string;
        offer?: string;
        funnelStage?: 'Awareness' | 'Consideration' | 'Conversion' | 'Retention';
        landingPage?: string;
        conversionEvent?: string;
        brandGuardrails?: string;

        // Creative
        creative?: AdCreative;

        // Targeting
        targeting?: AdTargetAudience;

        // Budget
        budget?: {
            amount: number;
            type: 'Daily' | 'Lifetime';
            currency: string;
            startDate?: string;
            endDate?: string;
            bidStrategy?: string;
            pacing?: string;
            notes?: string;
        };

        // Research
        research?: {
            marketInsights?: string;
            competitorNotes?: string;
            customerPainPoints?: string;
            proofPoints?: string;
            angleIdeas?: string[];
        };

        // Build & QA
        setup?: {
            platforms?: AdPlatform[];
            campaignStructure?: string;
            trackingStatus?: 'Not Started' | 'In Progress' | 'Verified';
            utmScheme?: string;
            checklist?: string[];
            qaNotes?: string;
        };

        // Optimization
        optimization?: {
            hypotheses?: string[];
            scalingPlan?: string;
            reportingCadence?: string;
            guardrails?: string;
            learnings?: string;
        };

        // Review
        riskAnalysis?: RiskWinAnalysis;

        // Meta
        completeness: number; // 0-100
        lastSavedAt?: string;
    };
}

export interface RiskWinAnalysis {
    successProbability: number; // 0-100
    marketFitScore: number; // 0-10
    technicalFeasibilityScore: number; // 0-10
    risks: { title: string; severity: 'Low' | 'Medium' | 'High'; mitigation?: string; originIdeaId?: string; }[];
    wins: { title: string; impact: 'Low' | 'Medium' | 'High'; originIdeaId?: string; }[];
    recommendation: string;
    originIdeaId?: string;
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
    assignedGroupIds?: string[]; // New: Assigned Groups
    scheduledDate?: string; // Smart Schedule Date (legacy, prefer dueDate)
    startDate?: string; // Start date for the issue
    dueDate?: string; // Due date for the issue
    createdAt: any;
    linkedTaskId?: string; // Linked task (if converted to a task)
    githubIssueUrl?: string; // URL of the synced GitHub issue
    githubIssueNumber?: number; // Number of the synced GitHub issue
    createdBy?: string;
    completedBy?: string; // User UID
    completedAt?: any; // Firestore Timestamp
    originIdeaId?: string;
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
    relatedId?: string;
    type: 'comment' | 'task' | 'file' | 'commit' | 'status' | 'priority' | 'report' | 'member' | 'issue';
    createdAt?: any;
    originIdeaId?: string;
}

export type IdeaGroup =
    | 'Feature'
    | 'Product'
    | 'Task'
    | 'Marketing'
    | 'PaidAds'
    | 'Social'
    | 'Moonshot'
    | 'Optimization'
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
    originIdeaId?: string;
}

export type TaskStatus = 'Backlog' | 'Todo' | 'Open' | 'In Progress' | 'Review' | 'On Hold' | 'Blocked' | 'Done';

export interface TaskCategory {
    id: string;
    projectId: string;
    ownerId?: string;
    name: string;
    normalized?: string;
    color?: string; // Hex color string
    createdAt?: any;
    originIdeaId?: string;
}

export interface Mindmap {
    id: string;
    projectId: string;
    ownerId?: string;
    name: string;
    createdAt?: any;
    originIdeaId?: string;
}
export interface ProjectBlueprint {
    id: string;
    title: string;
    description: string;
    targetAudience: string;
    milestones: { title: string; description: string; originIdeaId?: string; }[];
    initialTasks: { title: string; priority: 'Low' | 'Medium' | 'High'; originIdeaId?: string; }[];
    suggestedTechStack?: string[];
    createdAt: any;
    originIdeaId?: string;
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
    linkedTaskIds?: string[];
    linkedInitiativeId?: string;
    riskRating?: 'Low' | 'Medium' | 'High';
    originIdeaId?: string;
}

export interface ProjectRisk {
    risk: string;
    impact: 'Low' | 'Medium' | 'High';
    probability: 'Low' | 'Medium' | 'High';
    mitigation: string;
    originIdeaId?: string;
}

export type StudioTool = 'Architect' | 'Brainstormer' | 'RiskScout' | 'Strategist';

// AI Search Types
export interface SearchResult {
    type: 'project' | 'task' | 'issue' | 'idea' | 'answer' | 'help_page' | 'help_section';
    id?: string;
    title: string;
    description?: string;
    projectId?: string;
    projectTitle?: string;
    helpPageId?: string;
    helpSectionId?: string;
    helpPageTitle?: string;
    relevance?: number;
    status?: string;
    originIdeaId?: string;
}

export interface AISearchAnswer {
    answer: string;
    relevantProjects: string[];
    relevantTasks: string[];
    confidence: 'Low' | 'Medium' | 'High';
    originIdeaId?: string;
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
    originIdeaId?: string;
}

export interface GeminiReport {
    id: string;
    projectId: string;
    content: string;
    createdAt: any;
    createdBy: string;
    userName: string;
    originIdeaId?: string;
}

// --- Social Media Module Types ---

export type SocialPlatform = 'Instagram' | 'Facebook' | 'LinkedIn' | 'TikTok' | 'X' | 'YouTube';
export type SocialPostStatus = 'Draft' | 'In Review' | 'Approved' | 'Scheduled' | 'Publishing' | 'Published' | 'Failed' | 'Needs Manual Publish' | 'Archived';
export type SocialPostFormat = 'Text' | 'Post' | 'Image' | 'Video' | 'Carousel' | 'Story' | 'Reel' | 'Short';

export interface ApprovalEvent {
    id: string;
    type: 'submission' | 'approval' | 'rejection' | 'changes_requested';
    actorId: string;
    date: string;
    notes?: string;
    snapshot?: string; // Optional: JSON of the concept at that time
}

export interface SocialCampaign {
    id: string;
    projectId: string;
    name: string;
    goal?: string;
    startDate?: string; // ISO Date
    endDate?: string;   // ISO Date
    targetAudience?: string;
    toneOfVoice?: string;
    status: 'Backlog' | 'Planning' | 'Concept' | 'Active' | 'Completed' | 'Paused' | 'Archived' | 'Rejected' | 'PendingReview' | 'ChangesRequested';
    ownerId: string;
    createdAt: any;
    updatedAt: any;
    color?: string; // For calendar visualization
    description?: string;
    platforms?: SocialPlatform[];
    tags?: string[];
    originIdeaId?: string;
    assignedUserIds?: string[];
    approvalHistory?: ApprovalEvent[];
    aiTokensUsed?: number;
    // Enhanced Strategy Fields
    bigIdea?: string;
    hook?: string;
    visualDirection?: string;
    mood?: string;
    phases?: CampaignPhase[];
    kpis?: CampaignKPI[];
    audienceSegments?: string[];
    channelStrategy?: CampaignChannelStrategy[];
    risks?: { title: string; severity: string; mitigation: string }[];
    wins?: { title: string; impact: string }[];
    plannedContent?: PlannedPost[];
}

export interface PlannedPost {
    dayOffset: number;
    platform: string | string[];
    contentType: string;
    hook: string;
    visualDirection?: string;
}

export interface CampaignPhase {
    id: string;
    name: string;
    durationValue: number;
    durationUnit: 'Days' | 'Weeks' | 'Months';
    focus: string;
}

export interface CampaignKPI {
    id?: string;
    metric: string;
    target: string;
}

export interface CampaignChannelStrategy {
    id: string; // Platform name
    role: string;
    frequencyValue?: number;
    frequencyUnit?: string;
    format?: SocialPostFormat;
    phaseFrequencies?: {
        phaseId: string;
        frequencyValue?: number;
        frequencyUnit: string;
        format?: SocialPostFormat;
    }[];
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
    originIdeaId?: string;
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
    originIdeaId?: string;
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
        originIdeaId?: string;
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

    // Concept / YouTube Specific
    isConcept?: boolean;
    videoConcept?: {
        title: string;
        thumbnailIdea: string;
        scriptOutline: string;
        thumbnailUrl?: string;
    };

    // Approval Workflow
    approvals?: {
        required: boolean;
        status: 'Pending' | 'Approved' | 'Rejected';
        approvedBy?: string;
        approvedAt?: any;
        originIdeaId?: string;
    }[];
    rejectionReason?: string; // Feedback if the post was rejected

    // Lineage
    originPostId?: string; // ID of the concept post this draft was created from

    // Publishing Metadata
    externalId?: string; // ID from the platform (e.g. IG Media ID)
    error?: string; // Last error message if failed
    platforms?: SocialPlatform[]; // For concepts/flows that target multiple platforms
    originIdeaId?: string;
}

// Caption Presets for reusable social media captions
export interface CaptionPreset {
    id: string;
    projectId: string;
    name: string;
    content: string;  // The preset caption text
    platform: SocialPlatform | 'All';  // Platform-specific or universal
    hashtags?: string[];  // Optional pre-filled hashtags
    category?: string;  // User-defined category like "Promotional", "Engagement", etc.
    createdAt: any;
    createdBy: string;
    updatedAt?: any;
}

export interface SocialStrategy {
    id?: string;
    projectId: string;
    defaultPlatforms: SocialPlatform[];
    preferredTone: string;
    brandPillars: string;
    hashtagLimits?: Record<string, number>;
    updatedAt: any;
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
    originIdeaId?: string;
}

// Paid Ads - Platform Types
export type AdPlatform = 'Google' | 'Meta' | 'LinkedIn' | 'TikTok' | 'Other';
export type AdCampaignStatus = 'Draft' | 'Pending' | 'Enabled' | 'Paused' | 'Ended' | 'Rejected';
export type AdObjective = 'Traffic' | 'Leads' | 'Sales' | 'Brand Awareness' | 'Engagement' | 'App Installs' | 'Video Views';
export type AdCallToAction = 'Learn More' | 'Shop Now' | 'Sign Up' | 'Contact Us' | 'Download' | 'Get Quote' | 'Watch More' | 'Apply Now';

export interface AdTargetAudience {
    locations?: string[];
    ageMin?: number;
    ageMax?: number;
    genders?: ('Male' | 'Female' | 'All')[];
    interests?: string[];
    behaviors?: string[];
    customAudiences?: string[]; // Note: kept as string[] based on original but UI might treat as string, check existing usage
    lookalikes?: string[];
    languages?: string[];
    excludedAudiences?: string;
    placements?: string[];
    originIdeaId?: string;
}

export interface AdCreative {
    headline1?: string;
    headline2?: string;
    primaryText?: string;
    description?: string;
    cta?: AdCallToAction | string;
    visualConcept?: string;
    visualAssetUrl?: string;
    variations?: string[];
}

export interface AdMetrics {
    impressions: number;
    reach?: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm?: number;
    conversions: number;
    conversionRate?: number;
    costPerConversion: number;
    roas: number;
    engagements?: number;
    videoViews?: number;
    frequency?: number;
    originIdeaId?: string;
}

export interface AdCampaign {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    platform: AdPlatform;
    status: AdCampaignStatus;

    // Budget & Schedule
    budgetType: 'Daily' | 'Lifetime';
    budgetDaily?: number;
    budgetTotal?: number;
    spend: number;
    startDate: string;
    endDate?: string;

    // Campaign Configuration
    objective: AdObjective;
    targetAudience?: AdTargetAudience;
    placements?: string[]; // e.g., 'Feed', 'Stories', 'Search', 'Display'

    // Performance Metrics
    metrics: AdMetrics;

    // Integration Links
    originIdeaId?: string;           // Flow pipeline link
    linkedSocialPostIds?: string[];   // Boosted/linked social posts
    marketingCampaignId?: string;     // Parent marketing campaign

    // Metadata
    createdAt: any;
    updatedAt?: any;
    createdBy?: string;
}

export interface AdSet {
    id: string;
    adCampaignId: string;
    projectId: string;
    name: string;
    status: 'Enabled' | 'Paused';
    budgetDaily?: number;
    targeting?: AdTargetAudience;
    placements?: string[];
    schedule?: {
        startTime: string;
        endTime: string;
        days: string[];
        originIdeaId?: string;
    };
    metrics?: AdMetrics;
    createdAt: any;
    originIdeaId?: string;
}

export interface AdCreative {
    id: string;
    adSetId: string;
    projectId: string;
    name: string;
    headline: string;
    description: string;
    primaryText?: string;
    callToAction: AdCallToAction;
    destinationUrl: string;
    assets: Array<{
        type: 'image' | 'video';
        url: string;
        storagePath?: string;
        aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9';
        originIdeaId?: string;
    }>;
    format: 'Single Image' | 'Carousel' | 'Video' | 'Collection' | 'Stories';
    status: 'Active' | 'Paused' | 'Disapproved' | 'Pending Review';
    metrics?: AdMetrics;
    socialAssetIds?: string[]; // Links to SocialAsset for reuse
    createdAt: any;
    originIdeaId?: string;
}

export interface AdPerformanceSnapshot {
    id: string;
    adCampaignId: string;
    projectId: string;
    date: string;
    metrics: AdMetrics;
    spend: number;
    originIdeaId?: string;
}

// Email Marketing
export interface EmailCampaign {
    id: string;
    projectId: string;
    marketingCampaignId?: string;
    name: string;
    subject: string;
    senderName: string;
    status: 'draft' | 'in_review' | 'ready' | 'scheduled' | 'sent';
    sentAt?: string;
    contentBlocks?: EmailBlock[];
    variableValues?: Record<string, string>;
    templateId?: string;
    stats: {
        sent: number;
        opened: number;
        clicked: number;
        bounced: number;
        unsubscribed: number;
        originIdeaId?: string;
    };
    originIdeaId?: string;
}

export interface MarketingAudience {
    id: string;
    projectId: string;
    name: string;
    count: number;
    filters?: string;
    source: 'Import' | 'Signups' | 'CRM';
    originIdeaId?: string;
}

// Strategy
export interface MarketingFunnelMetric {
    stage: 'Awareness' | 'Interest' | 'Consideration' | 'Conversion' | 'Retention';
    value: number;
    change?: number;
    originIdeaId?: string;
}

// --- Email Builder Types ---

export type EmailBlockType = 'text' | 'richtext' | 'image' | 'button' | 'spacer' | 'divider' | 'social' | 'video' | 'columns' | 'header' | 'list' | 'quote' | 'html' | 'menu' | 'flex' | 'solid' | 'div';

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
    originIdeaId?: string;
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
        socialLinks?: { platform: 'twitter' | 'facebook' | 'linkedin' | 'instagram'; url: string; originIdeaId?: string; }[]; // For 'social' type
        menuLinks?: { label: string; url: string; originIdeaId?: string; }[]; // For 'menu' type
        videoUrl?: string; // For 'video' type: YouTube/Vimeo URL
        children?: EmailBlock[]; // For 'flex' type: Flat list of children
        originIdeaId?: string;
    };
    styles: EmailBlockStyle;
    originIdeaId?: string;
}
export interface TemplateVariable {
    id: string;
    name: string;
    label: string;
    defaultValue?: string;
    type: 'text' | 'date' | 'number' | 'url' | 'image' | 'richtext';
    originIdeaId?: string;
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
    originIdeaId?: string;
}

export interface EmailComponent {
    id: string;
    projectId: string;
    name: string;
    block: EmailBlock;
    createdAt: any;
    createdBy: string;
    originIdeaId?: string;
}

// --- Recipient Management Types ---

export interface RecipientColumn {
    id: string;
    projectId: string;
    label: string; // Display name
    key: string; // Key in customFields or match to standard field
    type: 'text' | 'number' | 'date' | 'boolean' | 'tag'; // Basic validation hint
    isSystem: boolean; // true if standard (firstName, email), false if custom
    createdAt: any;
    originIdeaId?: string;
}

export interface Recipient {
    id: string;
    projectId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    status: 'Subscribed' | 'Unsubscribed' | 'Bounced';
    tags?: string[];
    groupIds?: string[]; // IDs of groups this recipient belongs to
    customFields?: Record<string, any>; // Flexible storage for CSV extras
    source?: 'Manual' | 'Import' | 'External' | 'Signup Form';
    externalId?: string; // If from external DB
    createdAt: any;
    updatedAt: any;
    originIdeaId?: string;
}

export interface SMTPConfig {
    host: string;
    port: number;
    user: string;
    pass: string; // Should be encrypted in real app, simplistic for now
    useCustom: boolean;
    secure?: boolean;
    fromEmail?: string;
    originIdeaId?: string;
}

// --- Recipient Groups ---

export interface RecipientGroup {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    color?: string; // For visual distinction
    customFields?: Record<string, any>;
    createdAt: any;
    updatedAt: any;
    originIdeaId?: string;
}

export interface GroupColumn {
    id: string;
    projectId: string;
    label: string;
    key: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'tag';
    isSystem: boolean;
    createdAt: any;
    originIdeaId?: string;
}

// --- Marketing Settings ---

export type SMTPSource = 'projectflow' | 'workspace' | 'project';

export interface MarketingSettings {
    id: string;
    projectId: string;
    smtpSource: SMTPSource;
    smtpConfig?: SMTPConfig; // Project-specific SMTP (only if source is 'project')
    smtpVerified?: boolean; // Whether project SMTP has been tested successfully
    blogIntegration?: {
        endpoint?: string;
        getEndpoint?: string; // URL to fetch posts
        dataModel?: string; // TypeScript interface or JSON
        headers?: string; // JSON string of headers
    };
    updatedAt: any;
    originIdeaId?: string;
}

// --- API Token Types ---

export type APITokenPermission = 'newsletter:write' | 'recipients:read';

export interface APIToken {
    id: string;
    tenantId: string;
    name: string;              // User-friendly label
    tokenHash: string;         // SHA-256 hash of token (plain text not stored)
    tokenPrefix: string;       // First 8 chars for identification (e.g., "pfat_abc")
    projectScope?: string;     // Optional: limit to specific project
    permissions: APITokenPermission[];
    createdAt: any;
    lastUsedAt?: any;
    expiresAt?: any;           // Optional expiration
    originIdeaId?: string;
}
