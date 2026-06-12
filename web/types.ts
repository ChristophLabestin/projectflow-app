export interface Tenant {
    id: string;
    name: string;
    description?: string;
    website?: string;
    contactEmail?: string;
    smtpConfig?: SMTPConfig;
    members?: Member[];
    roles?: { [userId: string]: WorkspaceRole }; // Map for O(1) access in rules
    customRoles?: CustomRole[]; // Workspace-level custom roles (Discord-style)
    defaultRoleId?: string; // Default custom role ID for new members
    createdAt?: any;
    updatedAt?: any;
    AccessToModules?: string[];
    focusProjectId?: string; // ID of the manually focused project
}

export interface AIUsage {
    tokensUsed: number;
    tokenLimit: number;
    imagesUsed: number;
    imageLimit: number;
    lastReset: any; // Firestore Timestamp
}

// Permission System Types
export type ProjectRole = 'Owner' | 'Editor' | 'Viewer';
export type WorkspaceRole = 'Owner' | 'Admin' | 'Member' | 'Guest' | (string & {});

export type Permission =
    // Project
    | 'project.read'
    | 'project.update'
    | 'project.delete'
    | 'project.invite'
    | 'project.view_settings'
    // Tasks
    | 'task.create'
    | 'task.update'
    | 'task.delete'
    | 'task.view'
    | 'task.assign'
    | 'task.comment'
    // Groups
    | 'group.create'
    | 'group.update'
    | 'group.delete'
    // Roles
    | 'role.manage';

/**
 * Custom Role (Discord-style) - stored per-project
 */
export interface CustomRole {
    id: string;
    name: string;
    color: string; // Hex color for badges
    position: number; // For ordering (lower = higher priority). Owner is always -1
    permissions: Permission[];
    isDefault?: boolean; // Assign to new members automatically?
    createdAt: any; // Firestore Timestamp
    createdBy: string; // userId
}

// ROLE_PERMISSIONS moved to rolesService.ts

export interface ProjectMember {
    userId: string;
    role: ProjectRole | string; // Legacy ProjectRole or custom role ID
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
    canManageGroups: boolean; // Create/edit/delete project groups
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

export interface ProjectGroup {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    memberIds: string[];
    color?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface ProjectInviteLink {
    id: string; // Unique invite link ID
    projectId: string;
    role: ProjectRole | string; // Role assigned when joining
    createdBy: string; // User ID who created the link
    createdAt: any; // Firestore Timestamp
    expiresAt: any; // Firestore Timestamp
    maxUses?: number; // Max number of times link can be used (undefined = unlimited)
    uses: number; // Current number of uses
    isActive: boolean; // Can be disabled manually
}

export type ProjectOverviewCardId =
    | 'contract'
    | 'snapshot'
    | 'executionTasks'
    | 'updates'
    | 'resources'
    | 'planning'
    | 'milestones'
    | 'aiInsights'
    | 'team'
    | 'metadata'
    | 'controls';

export type ProjectOverviewCardPlacement = 'primary' | 'secondary';

export interface ProjectOverviewCardConfig {
    id: ProjectOverviewCardId;
    enabled: boolean;
    span: number;
    placement: ProjectOverviewCardPlacement;
}

export interface ProjectOverviewLayout {
    layoutVersion?: number;
    templateId: string;
    cards: ProjectOverviewCardConfig[];
}

export interface ProjectOverviewTemplateVariant {
    status: Project['status'];
    enabled: boolean;
    layout: ProjectOverviewLayout;
    sourceProjectId?: string;
}

export interface ProjectOverviewTemplate {
    id: string;
    name: string;
    description?: string;
    baseLayout: ProjectOverviewLayout;
    baseSourceProjectId?: string;
    variants: ProjectOverviewTemplateVariant[];
    autoApply: boolean;
    createdAt?: any;
    updatedAt?: any;
    createdBy?: string;
    tenantId?: string;
}

export type ProjectStatus = 'Active' | 'In Testing' | 'Backlog' | 'Brainstorming' | 'Canceled' | 'Completed' | 'Review' | 'On Hold' | 'Planning';
export type ProjectType = 'standard' | 'software' | 'creative';
export type ProjectCategory =
    | 'general'
    | 'software'
    | 'creative'
    | 'client_delivery'
    | 'operations'
    | 'marketing'
    | 'finance'
    | 'startup_company'
    | 'personal';
export type ProjectTemplateId =
    | 'blank'
    | 'software_release'
    | 'creative_project'
    | 'client_delivery'
    | 'startup_company_formation'
    | 'marketing_campaign'
    | 'internal_operations'
    | 'finance_setup';
export type CompanyProjectRole = 'product' | 'marketing' | 'finance' | 'legal' | 'operations' | 'funding' | 'research' | 'other';
export type StartupTrackId =
    | 'validation'
    | 'legal_formation'
    | 'finance_accounting'
    | 'compliance'
    | 'product_delivery'
    | 'marketing_sales'
    | 'funding'
    | 'operations';
export type StartupJurisdictionTemplateId = 'global_generic' | 'de_generic' | 'us_generic';
export type ProjectResourceType = 'general' | 'legal' | 'finance' | 'compliance' | 'advisor' | 'marketing' | 'operations' | 'funding';
export type ProjectResourceSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';
export type ProjectOperatingMode = 'explore' | 'build' | 'ship' | 'maintain';
export type ProjectCadence = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'ad-hoc';
export type ProjectDateConfidence = 'fixed' | 'target' | 'rough' | 'unknown';

export interface StartupSourceReference {
    id: string;
    labelKey: string;
    url: string;
    publisher: string;
    lastReviewedAt: string;
}

export interface StartupProfile {
    ventureName?: string;
    workingName?: string;
    jurisdictionCountry?: string;
    jurisdictionRegion?: string;
    jurisdictionTemplateId?: StartupJurisdictionTemplateId;
    jurisdictionSources?: StartupSourceReference[];
    jurisdictionSourcesReviewedAt?: string;
    advisorReviewRequired?: boolean;
    plannedLegalStructure?: string;
    formationStatus?: 'idea' | 'validating' | 'preparing' | 'filed' | 'registered' | 'operating';
    businessModel?: 'saas' | 'service' | 'marketplace' | 'commerce' | 'content' | 'hardware' | 'agency' | 'other';
    fundingRoute?: 'bootstrapped' | 'grant' | 'loan' | 'angel' | 'vc' | 'crowdfunding' | 'revenue_funded' | 'undecided';
    targetCustomer?: string;
    regulatedIndustryStatus?: 'yes' | 'no' | 'unknown';
    regulatedIndustry?: boolean;
    hasEmployeesPlanned?: boolean;
    hasCoFounders?: boolean;
    targetLaunchDate?: string;
    selectedTrackIds?: StartupTrackId[];
}

export interface StartupReadiness {
    legalStructureDecided?: boolean;
    founderAgreementReady?: boolean;
    ipAssignmentReady?: boolean;
    registrationSubmitted?: boolean;
    registrationConfirmed?: boolean;
    taxSetupReady?: boolean;
    bankAccountReady?: boolean;
    bookkeepingReady?: boolean;
    privacyDocsReady?: boolean;
    requiredPermitsKnown?: boolean;
    launchOfferReady?: boolean;
    firstChannelReady?: boolean;
}

export interface ProjectBrief {
    objective?: string;
    successCriteria?: string[];
    scope?: string;
    decisionOwner?: string;
    cadence?: ProjectCadence;
}

export interface ProjectOperatingModel {
    mode?: ProjectOperatingMode;
    cadence?: ProjectCadence;
    dateConfidence?: ProjectDateConfidence;
}

export interface ProjectRiskRegisterItem {
    id: string;
    title: string;
    mitigation?: string;
    severity: 'low' | 'medium' | 'high';
    status?: 'open' | 'watching' | 'resolved';
    createdAt?: any;
}

export interface ProjectHealthSnapshot {
    score?: number;
    status?: string;
    trend?: 'improving' | 'declining' | 'stable';
    capturedAt?: any;
    summary?: string;
}

export interface Project {
    id: string;
    title: string;
    description: string;
    progress: number;
    status: ProjectStatus;
    projectState?: 'pre-release' | 'released' | 'not specified';
    projectType?: ProjectType;
    projectCategory?: ProjectCategory;
    templateId?: ProjectTemplateId;
    companyProjectId?: string;
    companyProjectRole?: CompanyProjectRole;
    operatingMode?: ProjectOperatingMode;
    dateConfidence?: ProjectDateConfidence;
    brief?: ProjectBrief;
    operatingModel?: ProjectOperatingModel;
    riskRegister?: ProjectRiskRegisterItem[];
    healthSnapshot?: ProjectHealthSnapshot;
    startupProfile?: StartupProfile;
    startupReadiness?: StartupReadiness;
    dueDate?: string;
    startDate?: string;
    pausedAt?: string;
    pausedBy?: string;
    pausedFromStatus?: ProjectStatus;
    lastPauseStartedAt?: string;
    lastResumedAt?: string;
    canceledAt?: string;
    canceledBy?: string;
    canceledFromStatus?: ProjectStatus;
    lastCanceledAt?: string;
    ownerId: string;
    coverImage?: string;
    coverImageFileId?: string;
    squareIcon?: string;
    squareIconFileId?: string;
    screenshots?: string[];
    screenshotFileIds?: string[];
    priority?: string;
    isPrivate?: boolean;
    modules?: ProjectModule[];
    links?: { title: string; url: string; }[]; // Links shown in Overview
    externalResources?: ProjectExternalResource[]; // Links shown in Sidebar
    members?: ProjectMember[]; // Team members with roles (replaces string[])
    roles?: { [userId: string]: ProjectRole | string }; // Map for O(1) access in rules. Can be legacy ProjectRole or custom workspace role ID
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
    overviewLayout?: ProjectOverviewLayout;
}

export interface ProjectExternalResource {
    title: string;
    url: string;
    icon?: string;
    type?: ProjectResourceType;
    sensitivity?: ProjectResourceSensitivity;
    restrictedToRoleIds?: string[];
    advisorReviewRequired?: boolean;
    sourceTemplateId?: StartupJurisdictionTemplateId | string;
    sourceReferenceId?: string;
    lastReviewedAt?: string;
}

export type FocusItemType = 'task' | 'issue' | 'initiative' | 'personal-task';
export type UserFocusStatus = 'active' | 'snoozed' | 'blocked';
export type UserFocusLastAction = 'started' | 'resumed' | 'snoozed' | 'blocked' | 'completed' | 'cleared';

export interface UserFocusState {
    itemId: string;
    itemType: FocusItemType;
    title: string;
    projectId?: string;
    tenantId?: string;
    status: UserFocusStatus;
    startedAt?: string;
    snoozedUntil?: string;
    blockedAt?: string;
    updatedAt?: string;
    lastAction?: UserFocusLastAction;
}

/**
 * Top-level user profile stored at users/{userId}
 * Contains global user data that is shared across all workspaces
 */
export interface User {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    photoFileId?: string;
    photoFileTenantId?: string;
    coverURL?: string;
    coverFileId?: string;
    coverFileTenantId?: string;
    title?: string;
    bio?: string;
    address?: string;
    skills?: string[];
    aiUsage?: AIUsage;
    geminiConfig?: {
        apiKey: string;
        tokenLimit: number;
    };
    privacySettings?: PrivacySettings;
    pinnedItems?: Array<{
        id: string;
        type: FocusItemType;
        title: string;
        projectId?: string;
        tenantId?: string;
        priority?: string;
        isCompleted?: boolean;
    }>;
    focusItemId?: string | null;
    focusState?: UserFocusState | null;
    createdAt?: any;
    updatedAt?: any;
}

/**
 * Workspace membership stored at tenants/{tenantId}/members/{userId}
 * Contains workspace-specific data for a user's membership in a tenant
 */
export interface TenantMembership {
    uid: string;
    role: WorkspaceRole;
    joinedAt: any;
    groupIds?: string[];
    pinnedProjectId?: string;
    githubToken?: string; // Workspace-specific GitHub token
}

/**
 * Combined view of User + TenantMembership for UI display
 * Used when showing workspace members with their full profile info
 */
export interface Member extends User {
    role: WorkspaceRole;
    groupIds?: string[];
    joinedAt?: any;
    githubToken?: string;
    pinnedProjectId?: string;
}

export type PrivacyScope = 'public' | 'members' | 'guests' | 'private';

export interface PrivacySettings {
    email: PrivacyScope;
    bio: PrivacyScope;
    skills: PrivacyScope;
    address: PrivacyScope;
    stats: PrivacyScope;
}

export interface ProjectNavPrefs {
    order: string[]; // Nav item IDs in order
    hidden: string[]; // Nav item IDs that are hidden
}

export interface Comment {
    id: string;
    projectId: string;
    targetId: string; // ID of the Task, Issue, Idea, or Initiative
    targetType: 'task' | 'issue' | 'idea' | 'initiative';
    userId: string;
    userDisplayName: string;
    userPhotoURL?: string;
    content: string;
    createdAt: any;
}

export type ProjectModule = 'tasks' | 'initiatives' | 'activity' | 'milestones' | 'social' | 'marketing' | 'accounting' | 'sprints';

export interface Task {
    id: string;
    projectId: string;
    ownerId: string;
    title: string;
    isCompleted: boolean;
    dueDate?: string;
    startDate?: string;
    priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
    assignee?: string; // Legacy: Display Name or URL
    assigneeId?: string; // User UID
    assigneeIds?: string[]; // New: Multiple User UIDs
    assignedGroupIds?: string[]; // New: Assigned Groups
    description?: string;
    nextStep?: string;
    blockerNote?: string;
    reminderAt?: string;
    lastWorkbenchNote?: string;
    category?: IdeaGroup | IdeaGroup[];
    status?: TaskStatus;
    scheduledDate?: string; // Smart Schedule Date
    createdAt?: any;
    tenantId?: string; // For path resolution
    initiativeId?: string;
    legacyInitiativeRoot?: boolean;
    initiativeMigrationDismissed?: boolean;
    createdBy?: string;
    completedBy?: string; // User UID
    completedAt?: any; // Firestore Timestamp
    dependencies?: string[]; // IDs of tasks that block this task
    parentTaskId?: string; // Parent task in task-to-task hierarchy
    sprintId?: string; // Sprint ID
    feedbackSubmission?: InitiativeFeedbackSubmission;
    externalKey?: string;
    githubRepo?: string;
    githubIssueNumber?: number;
    githubIssueUrl?: string;
    githubIssueNodeId?: string;
    githubIssueState?: 'open' | 'closed';
    githubProjectV2Fields?: Record<string, unknown>;
    githubSyncedAt?: any;
    githubSyncError?: string;
    githubSyncDisabled?: boolean;
    templateId?: ProjectTemplateId;
    templateTrack?: StartupTrackId | string;
    templateSeedId?: string;
    sourceReferences?: StartupSourceReference[];
    source?: string;
    codexSessionId?: string;
    codexSessionExternalKey?: string;
    filesTouched?: string[];
    path?: string;
}

export type InitiativeStatus = TaskStatus | 'Planning';
export type InitiativeHealth = 'On Track' | 'At Risk' | 'Off Track';

export interface InitiativeFeedbackAttachment {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    downloadUrl: string;
}

export type InitiativeFeedbackFieldType = 'shortText' | 'longText' | 'email' | 'url' | 'select';
export type InitiativeFeedbackFieldRole = 'title' | 'description' | 'customerName' | 'customerEmail' | 'company' | 'sourceUrl' | 'general';

export interface InitiativeFeedbackFieldOption {
    id: string;
    label: string;
    value: string;
}

export interface InitiativeFeedbackField {
    id: string;
    type: InitiativeFeedbackFieldType;
    role?: InitiativeFeedbackFieldRole;
    label: string;
    placeholder?: string;
    helpText?: string;
    required?: boolean;
    enabled?: boolean;
    width?: 'full' | 'half';
    options?: InitiativeFeedbackFieldOption[];
    isDefault?: boolean;
}

export interface InitiativeFeedbackSubmittedField {
    fieldId: string;
    label: string;
    value: string;
    type: InitiativeFeedbackFieldType;
    role?: InitiativeFeedbackFieldRole;
}

export interface InitiativeFeedbackSubmission {
    source: 'public-form' | 'embedded-endpoint';
    submittedAt: any;
    customerName?: string;
    customerEmail?: string;
    company?: string;
    sourceUrl?: string;
    attachments?: InitiativeFeedbackAttachment[];
    fields?: InitiativeFeedbackSubmittedField[];
}

export interface InitiativeFeedbackFormSettings {
    enabled: boolean;
    token: string;
    title?: string;
    description?: string;
    submitLabel?: string;
    successMessage?: string;
    allowAttachments?: boolean;
    maxAttachments?: number;
    fields?: InitiativeFeedbackField[];
    updatedAt?: any;
    updatedBy?: string;
}

export interface Initiative {
    id: string;
    projectId: string;
    tenantId: string;
    ownerId: string;
    title: string;
    description?: string;
    status: InitiativeStatus;
    priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
    startDate?: string;
    dueDate?: string;
    createdBy?: string;
    assigneeIds?: string[];
    assignedGroupIds?: string[];
    externalKey?: string;
    source?: string;
    templateId?: ProjectTemplateId;
    templateTrack?: StartupTrackId | string;
    templateSeedId?: string;
    sourceReferences?: StartupSourceReference[];
    successMetric?: string;
    outcome?: string;
    health?: InitiativeHealth;
    color?: string; // Accent color (hex) to mark this initiative and its tasks
    feedbackForm?: InitiativeFeedbackFormSettings;
    createdAt?: any;
    updatedAt?: any;
    completedAt?: any;
}

export interface Sprint {
    id: string;
    projectId: string;
    name: string;
    goal?: string;
    startDate: string; // ISO
    endDate: string; // ISO
    status: 'Planning' | 'Active' | 'Completed' | 'Archived';
    createdAt: any;
    createdBy: string;
    updatedAt: any;
    autoStart?: boolean; // If true, sprint automatically becomes Active on startDate
    memberIds?: string[]; // IDs of users assigned to this sprint
    joinRequests?: string[]; // IDs of users requesting to join
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
}

export interface RiskWinAnalysis {
    successProbability: number; // 0-100
    marketFitScore: number; // 0-10
    technicalFeasibilityScore: number; // 0-10
    risks: { title: string; severity: 'Low' | 'Medium' | 'High'; mitigation?: string; }[];
    wins: { title: string; impact: 'Low' | 'Medium' | 'High'; }[];
    recommendation: string;
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
    type: 'comment' | 'task' | 'initiative' | 'file' | 'commit' | 'status' | 'priority' | 'report' | 'member' | 'codex';
    createdAt?: any;
}

export type CodexSessionStatus = 'running' | 'completed' | 'blocked' | 'partial';

export interface CodexSession {
    id: string;
    projectId: string;
    tenantId?: string;
    externalKey?: string;
    title: string;
    summary?: string;
    status: CodexSessionStatus;
    phase?: string;
    entity?: 'task' | 'initiative';
    linkedEntityType?: 'task' | 'initiative';
    linkedEntityId?: string;
    taskId?: string;
    initiativeId?: string;
    repoPath?: string;
    repoName?: string;
    branch?: string;
    commitSha?: string;
    filesTouched?: string[];
    validationStatus?: string;
    lastValidationStatus?: string;
    lastCheckpointSummary?: string;
    lastCheckpointAt?: any;
    actorLabel?: string;
    createdBy?: string;
    createdAt?: any;
    startedAt?: any;
    finishedAt?: any;
    updatedAt?: any;
}

export interface CodexFollowUp {
    id: string;
    projectId: string;
    tenantId?: string;
    title: string;
    description?: string;
    status?: 'open' | 'done' | 'dismissed' | string;
    priority?: 'Low' | 'Medium' | 'High' | 'Urgent' | string;
    taskId?: string;
    sessionId?: string;
    sessionExternalKey?: string;
    externalKey?: string;
    source?: string;
    filesTouched?: string[];
    actorLabel?: string;
    createdBy?: string;
    createdAt?: any;
    updatedAt?: any;
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

export type TaskStatus = 'Backlog' | 'Todo' | 'Open' | 'In Progress' | 'Review' | 'On Hold' | 'Blocked' | 'Done';

export interface TaskCategory {
    id: string;
    projectId: string;
    ownerId?: string;
    name: string;
    normalized?: string;
    color?: string; // Hex color string
    createdAt?: any;
}

export interface ProjectBlueprint {
    id: string;
    title: string;
    description: string;
    targetAudience: string;
    milestones: { title: string; description: string; }[];
    initialTasks: { title: string; priority: 'Low' | 'Medium' | 'High'; }[];
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
    linkedTaskIds?: string[];
    linkedInitiativeId?: string;
    riskRating?: 'Low' | 'Medium' | 'High';
    externalKey?: string;
    templateId?: ProjectTemplateId;
    templateTrack?: StartupTrackId | string;
    templateSeedId?: string;
    sourceReferences?: StartupSourceReference[];
    source?: string;
}

export interface ProjectRisk {
    risk: string;
    impact: 'Low' | 'Medium' | 'High';
    probability: 'Low' | 'Medium' | 'High';
    mitigation: string;
}

export type StudioTool = 'Architect' | 'Brainstormer' | 'RiskScout' | 'Strategist';

export type StudioMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    mode?: StudioTool | null;
};

export type StudioChatSession = {
    id: string;
    title: string;
    messages: StudioMessage[];
    createdAt: number;
    updatedAt: number;
    mode?: StudioTool | null;
    blueprint?: ProjectBlueprint | null;
};

// AI Search Types
export interface SearchResult {
    type: 'project' | 'initiative' | 'task' | 'issue' | 'idea' | 'answer' | 'help_page' | 'help_section';
    id?: string;
    title: string;
    description?: string;
    tenantId?: string;
    projectId?: string;
    projectTitle?: string;
    companyProjectId?: string;
    companyProjectTitle?: string;
    projectCategory?: ProjectCategory;
    templateId?: ProjectTemplateId;
    helpPageId?: string;
    helpSectionId?: string;
    helpPageTitle?: string;
    relevance?: number;
    status?: string;
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
    | 'project_join_request_denied'
    | 'diagnostic_test';

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
    initiativeId?: string;
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
    analysis?: CampaignAnalysis;
    lastRejectionReason?: string;
    approvedBy?: string;
    approvedAt?: any;
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
    managedFileId?: string;
    managedTenantId?: string;
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
    error?: string;
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
    }[];
    rejectionReason?: string; // Feedback if the post was rejected

    // Lineage
    originPostId?: string; // ID of the concept post this draft was created from

    // Publishing Metadata
    externalId?: string; // ID from the platform (e.g. IG Media ID)
    error?: string; // Last error message if failed
    platforms?: SocialPlatform[]; // For concepts/flows that target multiple platforms
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
    };
    metrics?: AdMetrics;
    createdAt: any;
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
    }>;
    format: 'Single Image' | 'Carousel' | 'Video' | 'Collection' | 'Stories';
    status: 'Active' | 'Paused' | 'Disapproved' | 'Pending Review';
    metrics?: AdMetrics;
    socialAssetIds?: string[]; // Links to SocialAsset for reuse
    createdAt: any;
}

export interface AdPerformanceSnapshot {
    id: string;
    adCampaignId: string;
    projectId: string;
    date: string;
    metrics: AdMetrics;
    spend: number;
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
    change?: number;
}

// --- Paid Ads Builder (dedicated model, replaces legacy Idea-based draft) ---
export type PaidAdStatus = 'Draft' | 'InReview' | 'Approved' | 'Live' | 'Rejected' | 'Archived';

export interface AdData {
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
}

export interface PaidAd {
    id: string;
    projectId?: string;
    tenantId?: string;
    ownerId?: string;
    title: string;
    description?: string;
    status: PaidAdStatus;
    adData?: AdData;
    convertedCampaignId?: string; // ID of the published AdCampaign, once launched
    assignedUserIds?: string[];
    aiTokensUsed?: number;
    aiSessionId?: string;
    createdAt?: any;
    createdBy?: string;
    updatedAt?: any;
}

// Scores shown in the social campaign concept review (replaces legacy Idea.riskWinAnalysis)
export interface CampaignAnalysis {
    successProbability?: number; // 0-100
    marketFitScore?: number; // 0-10
    technicalFeasibilityScore?: number; // 0-10
    recommendation?: string;
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
        socialLinks?: { platform: 'twitter' | 'facebook' | 'linkedin' | 'instagram'; url: string; }[]; // For 'social' type
        menuLinks?: { label: string; url: string; }[]; // For 'menu' type
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
    type: 'text' | 'date' | 'number' | 'url' | 'image' | 'richtext';
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

// --- Recipient Management Types ---

export interface RecipientColumn {
    id: string;
    projectId: string;
    label: string; // Display name
    key: string; // Key in customFields or match to standard field
    type: 'text' | 'number' | 'date' | 'boolean' | 'tag'; // Basic validation hint
    isSystem: boolean; // true if standard (firstName, email), false if custom
    createdAt: any;
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
}

export interface SMTPConfig {
    host: string;
    port: number;
    user: string;
    pass: string; // Should be encrypted in real app, simplistic for now
    useCustom: boolean;
    secure?: boolean;
    fromEmail?: string;
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
}

export interface GroupColumn {
    id: string;
    projectId: string;
    label: string;
    key: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'tag';
    isSystem: boolean;
    createdAt: any;
}

// --- Marketing Settings ---

export type SMTPSource = 'projectflow' | 'workspace' | 'project';

export interface ApiEndpoint {
    path: string; // relative to baseUrl, e.g. "/posts" or "/posts/:id"
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    bodyStructure?: string; // Optional JSON template for body
}

export interface ApiResourceConfig {
    baseUrl: string;
    headers: string; // JSON string of headers
    dataModel?: string; // TypeScript interface or JSON schema defining the post structure
    supportedLanguages?: string[]; // e.g. ['en', 'de'] - detected from dataModel if it has a language field
    resources: {
        [resourceName: string]: { // e.g. 'posts', 'categories'
            endpoints: {
                list?: ApiEndpoint;   // GET /posts
                create?: ApiEndpoint; // POST /posts
                update?: ApiEndpoint; // PUT /posts/:id
                delete?: ApiEndpoint; // DELETE /posts/:id
                get?: ApiEndpoint;    // GET /posts/:id
            };
            fieldMapping?: Record<string, string>; // Optional JSON path mapping
        }
    }
}

export interface MarketingSettings {
    id: string;
    projectId: string;
    smtpSource: SMTPSource;
    smtpConfig?: SMTPConfig; // Project-specific SMTP (only if source is 'project')
    smtpVerified?: boolean; // Whether project SMTP has been tested successfully
    apiIntegration?: ApiResourceConfig;
    /** @deprecated Use apiIntegration instead */
    blogIntegration?: {
        endpoint?: string;
        getEndpoint?: string; // URL to fetch posts
        dataModel?: string; // TypeScript interface or JSON
        headers?: string; // JSON string of headers
    };
    updatedAt: any;
}

export type TransactionType = 'income' | 'expense';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type FinanceCalcPeriod = 'monthly';

export type FinanceScenarioPreset = 'software' | 'generic';

export interface Transaction {
    id: string;
    tenantId: string;
    userId: string;
    projectId?: string;
    type: TransactionType;
    date: any;
    category: string;
    amount: number;
    notes?: string;
    isRecurring?: boolean;
    recurringId?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface RecurringTransaction {
    id: string;
    tenantId: string;
    userId: string;
    projectId?: string;
    type: TransactionType;
    frequency: RecurringFrequency;
    startDate: any;
    endDate?: any;
    category: string;
    amount: number;
    notes?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceCostItem {
    id: string;
    label: string;
    amount: number; // direct cost amount (fallback)
    quantityPerUnit?: number; // optional usage quantity per scenario unit (e.g. 200 generations per user)
    unitCost?: number; // optional cost per usage (e.g. $0.00013 per generation)
    tokensPerUsage?: number; // optional token usage per usage/call (e.g. 1500 tokens per generation)
}

export interface FinanceScenario {
    id: string;
    tenantId: string;
    userId: string;
    projectId?: string;
    name: string;
    preset: FinanceScenarioPreset;
    period: FinanceCalcPeriod;
    unitLabel: string;
    plannedUnits: number;
    pricePerUnit: number;
    tokenQuotaPerUnit?: number;
    discountPercent?: number;
    salesCommissionPercent?: number;
    targetProfitPercentOnCost: number;
    fixedCostItems: FinanceCostItem[];
    variableCostItemsPerUnit: FinanceCostItem[];
    notes?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceScenarioResult {
    fixedCostsTotal: number;
    variableCostPerUnit: number;
    variableCostsTotal: number;
    tokenQuotaPerUnit: number;
    tokenQuotaTotal: number;
    tokensUsedPerUnit: number;
    tokensUsedTotal: number;
    tokensRemainingPerUnit: number;
    tokensRemainingTotal: number;
    isTokenQuotaExceededPerUnit: boolean;
    isTokenQuotaExceededTotal: boolean;
    totalCostPerUnit: number;
    totalCosts: number;
    netRevenuePerUnit: number;
    netRevenueTotal: number;
    revenuePerUnit: number;
    revenueTotal: number;
    contributionPerUnit: number;
    contributionTotal: number;
    contributionMarginPercent: number;
    operatingProfitTotal: number;
    profitPercentOnCost: number;
    suggestedPricePerUnit: number;
    breakEvenUnits: number | null;
    breakEvenRevenue: number | null;
    hasBreakEven: boolean;
}

export type FinanceSchemaVersion = 1 | 2;

export type FinanceAccountCategory =
    | 'asset'
    | 'liability'
    | 'equity'
    | 'revenue'
    | 'expense'
    | 'off_balance';

export type FinanceAccountBalanceSide = 'debit' | 'credit';

export interface FinanceAccount {
    id: string;
    tenantId: string;
    accountNo: string;
    name: string;
    category: FinanceAccountCategory;
    normalBalance: FinanceAccountBalanceSide;
    datevAccountNo?: string;
    taxCodeId?: string;
    isActive: boolean;
    allowManualPosting?: boolean;
    notes?: string;
    createdAt?: any;
    updatedAt?: any;
}

export type FinanceFiscalYearStatus = 'open' | 'closed';

export interface FinanceFiscalYear {
    id: string;
    tenantId: string;
    year: number;
    startDate: any;
    endDate: any;
    status: FinanceFiscalYearStatus;
    createdAt?: any;
    updatedAt?: any;
}

export type FinancePeriodStatus = 'open' | 'soft_closed' | 'closed';

export interface FinancePeriod {
    id: string; // YYYY-MM
    tenantId: string;
    fiscalYearId: string;
    monthKey: string; // YYYY-MM
    startDate: any;
    endDate: any;
    status: FinancePeriodStatus;
    closedBy?: string;
    closedAt?: any;
    notes?: string;
    createdAt?: any;
    updatedAt?: any;
}

export type FinanceJournalSourceType =
    | 'manual'
    | 'invoice'
    | 'credit_note'
    | 'bill'
    | 'payment'
    | 'bank_import'
    | 'reconciliation'
    | 'migration'
    | 'depreciation'
    | 'tax'
    | 'close';

export type FinanceJournalEntryStatus = 'posted' | 'voided';

export interface FinanceJournalEntry {
    id: string;
    tenantId: string;
    entryNumber: string;
    postingDate: any;
    periodKey: string; // YYYY-MM
    description: string;
    sourceType: FinanceJournalSourceType;
    sourceId?: string;
    sourceRefNo?: string;
    projectId?: string;
    currencyCode: string;
    totalDebit: number;
    totalCredit: number;
    status: FinanceJournalEntryStatus;
    idempotencyKey: string;
    postedBy: string;
    postedAt?: any;
    voidedAt?: any;
    voidedBy?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceJournalLine {
    id: string;
    tenantId: string;
    entryId: string;
    lineNo: number;
    accountId: string;
    description?: string;
    debit: number;
    credit: number;
    taxCodeId?: string;
    projectId?: string;
    customerId?: string;
    vendorId?: string;
    currencyCode: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceCounterpartyAddress {
    line1?: string;
    line2?: string;
    postalCode?: string;
    city?: string;
    countryCode?: string;
}

export interface FinanceCustomer {
    id: string;
    tenantId: string;
    customerNo: string;
    name: string;
    email?: string;
    vatId?: string;
    paymentTermsDays?: number;
    defaultRevenueAccountId?: string;
    address?: FinanceCounterpartyAddress;
    isActive: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceVendor {
    id: string;
    tenantId: string;
    vendorNo: string;
    name: string;
    email?: string;
    vatId?: string;
    paymentTermsDays?: number;
    defaultExpenseAccountId?: string;
    address?: FinanceCounterpartyAddress;
    isActive: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export type FinanceInvoiceUploadDocumentType = 'pdf' | 'xml';
export type FinanceInvoiceExtractionConfidence = 'low' | 'medium' | 'high';

export interface FinanceExtractedInvoiceDraft {
    documentType: FinanceInvoiceUploadDocumentType;
    documentId?: string;
    documentVersionId?: string;
    fileName?: string;
    vendorName: string;
    vendorEmail: string;
    vendorVatId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    currencyCode: string;
    lineDescription: string;
    quantity: number;
    unitCost: number;
    taxRatePercent: number;
    netAmount: number;
    taxAmount: number;
    grossAmount: number;
    confidence: FinanceInvoiceExtractionConfidence;
    isLikelyRecurring: boolean;
    recurringHint: string;
    notes: string;
    fieldConfidenceMap?: Record<string, FinanceInvoiceExtractionConfidence>;
    warnings?: string[];
    model?: string;
}

export interface FinanceInvoiceLine {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    netAmount: number;
    taxCodeId?: string;
    taxRatePercent?: number;
    taxAmount?: number;
    accountId?: string;
    projectId?: string;
}

export type FinanceInvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'voided';

export interface FinanceInvoice {
    id: string;
    tenantId: string;
    invoiceNo: string;
    customerId: string;
    projectId?: string;
    issueDate: any;
    dueDate: any;
    currencyCode: string;
    status: FinanceInvoiceStatus;
    lines: FinanceInvoiceLine[];
    notes?: string;
    netAmount: number;
    taxAmount: number;
    grossAmount: number;
    paidAmount: number;
    openAmount: number;
    journalEntryId?: string;
    sourceDocumentId?: string;
    sourceDocumentVersionId?: string;
    sourceDocumentFileId?: string;
    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceCreditNoteLine {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    netAmount: number;
    taxCodeId?: string;
    taxRatePercent?: number;
    taxAmount?: number;
    accountId?: string;
    projectId?: string;
}

export type FinanceCreditNoteStatus = 'draft' | 'issued' | 'applied' | 'voided';

export interface FinanceCreditNote {
    id: string;
    tenantId: string;
    creditNoteNo: string;
    customerId: string;
    invoiceId?: string;
    projectId?: string;
    issueDate: any;
    currencyCode: string;
    status: FinanceCreditNoteStatus;
    lines: FinanceCreditNoteLine[];
    netAmount: number;
    taxAmount: number;
    grossAmount: number;
    journalEntryId?: string;
    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceBillLine {
    id: string;
    description: string;
    quantity: number;
    unitCost: number;
    netAmount: number;
    taxCodeId?: string;
    taxRatePercent?: number;
    taxAmount?: number;
    accountId?: string;
    projectId?: string;
}

export type FinanceBillStatus = 'draft' | 'posted' | 'partially_paid' | 'paid' | 'voided';

export interface FinanceBill {
    id: string;
    tenantId: string;
    billNo: string;
    vendorId: string;
    projectId?: string;
    billDate: any;
    dueDate: any;
    currencyCode: string;
    status: FinanceBillStatus;
    lines: FinanceBillLine[];
    notes?: string;
    sourceDocumentFileId?: string;
    netAmount: number;
    taxAmount: number;
    grossAmount: number;
    paidAmount: number;
    openAmount: number;
    journalEntryId?: string;
    sourceDocumentId?: string;
    sourceDocumentVersionId?: string;
    sourceDocumentFileId?: string;
    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export type FinancePaymentDirection = 'incoming' | 'outgoing';

export type FinancePaymentStatus = 'recorded' | 'allocated' | 'partially_allocated' | 'voided';

export interface FinancePayment {
    id: string;
    tenantId: string;
    paymentNo: string;
    direction: FinancePaymentDirection;
    paymentDate: any;
    amount: number;
    currencyCode: string;
    bankAccountId?: string;
    customerId?: string;
    vendorId?: string;
    projectId?: string;
    notes?: string;
    status: FinancePaymentStatus;
    allocatedAmount: number;
    unallocatedAmount: number;
    journalEntryId?: string;
    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export type FinancePaymentTargetType = 'invoice' | 'bill';

export interface FinancePaymentAllocation {
    id: string;
    tenantId: string;
    paymentId: string;
    targetType: FinancePaymentTargetType;
    targetId: string;
    amount: number;
    currencyCode: string;
    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceSubscription {
    id: string;
    tenantId: string;
    customerId: string;
    projectId?: string;
    planName: string;
    unitLabel: string;
    unitPrice: number;
    quantity: number;
    billingFrequency: 'monthly' | 'yearly';
    status: 'active' | 'paused' | 'canceled';
    nextBillingDate?: any;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceSubscriptionEvent {
    id: string;
    tenantId: string;
    subscriptionId: string;
    type: 'created' | 'changed' | 'paused' | 'resumed' | 'canceled' | 'invoiced';
    payload?: Record<string, unknown>;
    createdBy: string;
    createdAt?: any;
}

export interface FinanceBankAccount {
    id: string;
    tenantId: string;
    name: string;
    iban?: string;
    bic?: string;
    accountNo?: string;
    currencyCode: string;
    isActive: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceBankTransaction {
    id: string;
    tenantId: string;
    bankAccountId?: string;
    bookingDate: any;
    valueDate?: any;
    amount: number;
    currencyCode: string;
    description?: string;
    counterparty?: string;
    externalReference?: string;
    projectId?: string;
    reconciled: boolean;
    reconciliationId?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceReconciliation {
    id: string;
    tenantId: string;
    bankAccountId?: string;
    periodKey: string;
    matchedTransactionIds: string[];
    unmatchedTransactionIds: string[];
    notes?: string;
    confirmedBy: string;
    confirmedAt?: any;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceAsset {
    id: string;
    tenantId: string;
    name: string;
    assetNo?: string;
    acquisitionDate: any;
    acquisitionCost: number;
    usefulLifeMonths: number;
    residualValue?: number;
    depreciationMethod: 'straight_line';
    expenseAccountId?: string;
    assetAccountId?: string;
    isActive: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceDepreciationSchedule {
    id: string;
    tenantId: string;
    assetId: string;
    periodKey: string;
    depreciationAmount: number;
    postedEntryId?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceBudget {
    id: string;
    tenantId: string;
    periodKey: string;
    accountId?: string;
    projectId?: string;
    amount: number;
    notes?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceForecast {
    id: string;
    tenantId: string;
    periodKey: string;
    accountId?: string;
    projectId?: string;
    amount: number;
    confidence?: number;
    notes?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceTaxCode {
    id: string;
    tenantId: string;
    code: string;
    label: string;
    ratePercent: number;
    kind: 'output' | 'input' | 'none';
    datevKey?: string;
    isActive: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceTaxPeriod {
    id: string;
    tenantId: string;
    periodKey: string;
    status: 'open' | 'filed' | 'locked';
    filedAt?: any;
    filedBy?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceTaxReport {
    id: string;
    tenantId: string;
    periodKey: string;
    outputTax: number;
    inputTax: number;
    payableTax: number;
    currencyCode: string;
    generatedAt?: any;
    generatedBy?: string;
}

export type FinanceExportType = 'datev' | 'csv' | 'custom';

export type FinanceExportStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface FinanceExportJob {
    id: string;
    tenantId: string;
    type: FinanceExportType;
    periodKey: string;
    status: FinanceExportStatus;
    fileName?: string;
    fileUrl?: string;
    payloadPreview?: string;
    errorMessage?: string;
    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export type FinanceDocumentStatus = 'active' | 'deleted';

export interface FinanceDocument {
    id: string;
    tenantId: string;
    projectId?: string;
    linkedEntityType?: 'bill' | 'invoice' | 'transaction' | 'vendor' | 'customer' | 'other';
    linkedEntityId?: string;
    title: string;
    documentType: FinanceInvoiceUploadDocumentType | 'other';
    status: FinanceDocumentStatus;
    latestVersionNo: number;
    latestVersionId?: string;
    createdBy: string;
    deletedBy?: string;
    deletedAt?: any;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceDocumentVersion {
    id: string;
    tenantId: string;
    documentId: string;
    versionNo: number;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    checksumSha256: string;
    extraction?: FinanceExtractedInvoiceDraft;
    extractionWarnings?: string[];
    uploadedBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceRecurringTemplate {
    id: string;
    tenantId: string;
    projectId?: string;
    vendorId?: string;
    customerId?: string;
    type: 'bill' | 'invoice';
    cadence: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    nextRunAt: any;
    endAt?: any;
    autoPost: boolean;
    isActive: boolean;
    currencyCode: string;
    notes?: string;
    sourceDocumentId?: string;
    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export type FinanceAllocationBasis = 'revenue_share' | 'cost_share' | 'unit_share' | 'token_share' | 'fixed_percent';

export interface FinanceAllocationRule {
    id: string;
    tenantId: string;
    name: string;
    sourceAccountId?: string;
    projectId?: string;
    basis: FinanceAllocationBasis;
    percent?: number;
    isActive: boolean;
    notes?: string;
    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceProjectProfitabilitySnapshot extends FinanceProjectProfitabilityRow {
    periodKeyFrom?: string;
    periodKeyTo?: string;
    contributionOne?: number;
    contributionTwo?: number;
    generatedAt?: any;
}

export type FinanceSyncProvider = 'stripe' | 'paddle' | 'datev' | 'lexoffice' | 'custom';
export type FinanceSyncDirection = 'import' | 'export' | 'bidirectional';
export type FinanceSyncStatus = 'active' | 'paused' | 'disabled';

export interface FinanceSyncConnection {
    id: string;
    tenantId: string;
    provider: FinanceSyncProvider;
    direction: FinanceSyncDirection;
    status: FinanceSyncStatus;
    name: string;
    configRef?: string;
    lastRunAt?: any;
    lastRunStatus?: 'success' | 'partial' | 'failed';
    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceSyncRun {
    id: string;
    tenantId: string;
    connectionId: string;
    provider: FinanceSyncProvider;
    status: 'queued' | 'running' | 'completed' | 'failed';
    mode: 'full' | 'delta';
    idempotencyKey: string;
    startedAt?: any;
    finishedAt?: any;
    processedCount?: number;
    successCount?: number;
    failureCount?: number;
    errorMessage?: string;
    triggeredBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceProjectProfitabilityRow {
    projectId: string;
    projectName: string;
    revenue: number;
    directCosts: number;
    aiCosts: number;
    overheadAllocated: number;
    grossProfit: number;
    netProfit: number;
    marginPercent: number;
}

export interface FinanceTrialBalanceRow {
    accountId: string;
    accountNo?: string;
    accountName: string;
    debit: number;
    credit: number;
    balance: number;
}

export interface FinancePnlRow {
    accountId: string;
    accountNo?: string;
    accountName: string;
    category: 'revenue' | 'expense';
    amount: number;
}

export interface FinanceBalanceSheetRow {
    accountId: string;
    accountNo?: string;
    accountName: string;
    category: 'asset' | 'liability' | 'equity';
    amount: number;
}

export interface FinanceReportBundle {
    trialBalance: FinanceTrialBalanceRow[];
    pnl: FinancePnlRow[];
    balanceSheet: FinanceBalanceSheetRow[];
    projectProfitability: FinanceProjectProfitabilityRow[];
}

export type FinanceOperationType =
    | 'bank_import'
    | 'reconciliation_suggest'
    | 'reconciliation_confirm'
    | 'tax_build_report'
    | 'reports_build_bundle'
    | 'export_datev'
    | 'period_close'
    | 'period_reopen'
    | 'sync_run';

export type FinanceOperationRisk = 'low' | 'medium' | 'high';

export type FinanceOperationStatus =
    | 'queued'
    | 'validating'
    | 'awaiting_confirmation'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'canceled';

export interface FinanceOperationStep {
    name: string;
    status: FinanceOperationStatus;
    error?: string;
    startedAt?: any;
    finishedAt?: any;
}

export interface FinanceOperationArtifact {
    type: 'json' | 'csv' | 'report' | 'warning' | 'other';
    name: string;
    url?: string;
    payloadPreview?: string;
}

export interface FinanceOperationRun {
    id: string;
    tenantId: string;
    operationType: FinanceOperationType;
    status: FinanceOperationStatus;
    risk: FinanceOperationRisk;
    payload: Record<string, unknown>;
    payloadHash: string;
    idempotencyKey: string;
    steps: FinanceOperationStep[];
    warnings: string[];
    artifacts: FinanceOperationArtifact[];
    resultSummary?: string;
    error?: string;
    requestedBy: string;
    confirmedBy?: string;
    createdAt?: any;
    updatedAt?: any;
    startedAt?: any;
    finishedAt?: any;
}

export interface FinanceOperationBlockingCheck {
    key: string;
    count: number;
    blocking: boolean;
    message: string;
}

export interface FinanceOperationPreview {
    operationType: FinanceOperationType;
    canExecute: boolean;
    blockingChecks: FinanceOperationBlockingCheck[];
    warnings: string[];
    estimatedImpact: Record<string, number | string | boolean>;
    requiresConfirmation: boolean;
    risk: FinanceOperationRisk;
}

export interface FinanceOperationTemplate {
    id: string;
    tenantId: string;
    name: string;
    operationType: FinanceOperationType;
    defaultPayload: Record<string, unknown>;
    isShared: boolean;
    createdBy: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceOperationApproval {
    id: string;
    tenantId: string;
    runId: string;
    operationType: FinanceOperationType;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    requestedBy: string;
    approvedBy?: string;
    reason?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface FinanceOperationRecommendation {
    operationType: FinanceOperationType;
    suggestedPayload: Record<string, unknown>;
    confidence: number;
    rationale: string;
    risk: FinanceOperationRisk;
    whyNow: string;
}

export interface FinanceV2Settings {
    id: string;
    tenantId: string;
    financeSchemaVersion: 2;
    countryCode: string;
    currencyCode: string;
    fiscalYearStartMonth: number; // 1-12
    softCloseEnabled: boolean;
    defaultUnitLabel: string;
    defaultScenarioPreset: FinanceScenarioPreset;
    defaultRevenueAccountId?: string;
    defaultExpenseAccountId?: string;
    defaultReceivableAccountId?: string;
    defaultPayableAccountId?: string;
    defaultCashAccountId?: string;
    documentRetentionDays?: number;
    documentStorageRegion?: string;
    defaultDiscountPolicy?: 'none' | 'campaign' | 'always';
    defaultCommissionPolicy?: 'none' | 'sales_team';
    profitabilityCostBuckets?: string[];
    operationRunRetentionDays?: number;
    requireHighRiskDualConfirm?: boolean;
    aiOpsAssistantEnabled?: boolean;
    createdAt?: any;
    updatedAt?: any;
}

// --- API Token Types ---

export type APITokenPermission =
    | 'newsletter:write'
    | 'recipients:read'
    | 'projects:read'
    | 'projects:write'
    | 'projects:delete'
    | 'initiatives:read'
    | 'initiatives:write'
    | 'initiatives:delete'
    | 'tasks:read'
    | 'tasks:write'
    | 'tasks:delete';

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
}
