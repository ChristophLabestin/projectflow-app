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
    // Legacy ideas / issues
    | 'idea.create'
    | 'idea.update'
    | 'idea.delete'
    | 'idea.view'
    | 'issue.create'
    | 'issue.update'
    | 'issue.delete'
    | 'issue.view'
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
    displayName?: string;
    email?: string;
    photoURL?: string;
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

export type ProjectReminderLinkType = 'project' | 'task' | 'initiative';

export interface ProjectReminder {
    id: string;
    title: string;
    remindAt: string;
    linkedType?: ProjectReminderLinkType;
    linkedId?: string;
    linkedTitle?: string;
    isCompleted?: boolean;
    createdAt?: string;
    completedAt?: string;
    /** uid of the creator; set by the client on create (contract C2). */
    createdBy?: string;
    /** uid list that gets the reminder; defaults to [createdBy]. */
    recipientIds?: string[];
    /** "Also remind assignees": recipients ∪ task assignees at send time. */
    notifyAssignees?: boolean;
    /** ISO timestamp set by the server when the reminder was delivered. */
    sentAt?: string;
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
    defaultRoleId?: string; // Default custom role ID for new members
    createdAt?: any; // Firestore Timestamp
    updatedAt?: any; // Firestore Timestamp
    tenantId?: string;
    githubRepo?: string; // owner/repo
    githubIssueSync?: boolean; // Toggle for issue sync
    isPersonal?: boolean; // Hidden personal project
    visibilityGroupIds?: string[]; // IDs of groups that can view this project
    visibilityGroupId?: string; // @deprecated Use visibilityGroupIds instead
    overviewLayout?: ProjectOverviewLayout;
    intakeForm?: ProjectIntakeFormSettings;
    billingCustomer?: InvoiceParty; // Gespeicherte Kundenanschrift für Rechnungen (Kundenprojekte)
    reminders?: ProjectReminder[];
    /** Server-maintained: ISO instant of the earliest pending reminder (absent when none). Do not write from clients. */
    nextReminderAt?: string;
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

export type NotificationPrefCategory = 'assignments' | 'mentions' | 'comments' | 'due' | 'reminders';

/** users/{uid}.notificationPrefs (contract C3). All fields optional; the server applies defaults. */
export interface NotificationChannelPrefs {
    assignments?: boolean;
    mentions?: boolean;
    comments?: boolean;
    due?: boolean;
    reminders?: boolean;
}

export interface NotificationPrefs {
    /** IANA time zone, default 'Europe/Berlin'. */
    timezone?: string;
    push?: NotificationChannelPrefs;
    email?: NotificationChannelPrefs;
    /** time is 'HH:mm'; default off, '08:00'. */
    morningBriefing?: { enabled?: boolean; time?: string };
    /** time is 'HH:mm'; default off, '17:30'. */
    dayClose?: { enabled?: boolean; time?: string };
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
    language?: string; // Preferred UI language code (e.g. 'en', 'de')
    dateFormat?: string; // Preferred date format token
    theme?: 'light' | 'dark' | 'system';
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
    notificationPrefs?: NotificationPrefs;
    createdAt?: any;
    updatedAt?: any;
}

/**
 * Workspace membership stored at tenants/{tenantId}/members/{userId}
 * Contains workspace-specific data for a user's membership in a tenant
 */
export interface TenantMembership {
    uid: string;
    role: WorkspaceRole; // Primary/display role (Owner derived from tenant ownership)
    roleIds?: string[]; // Stacked custom role doc ids (Discord-style); Member is implicit
    joinedAt: any;
    groupIds?: string[];
    pinnedProjectId?: string;
}

/**
 * Combined view of User + TenantMembership for UI display
 * Used when showing workspace members with their full profile info
 */
export interface Member extends User {
    role: WorkspaceRole;
    roleIds?: string[]; // Stacked custom role doc ids
    groupIds?: string[];
    joinedAt?: any;
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
    targetId: string; // ID of the Task or Initiative
    targetType: 'task' | 'issue' | 'idea' | 'initiative';
    userId: string;
    userDisplayName: string;
    userPhotoURL?: string;
    content: string;
    /** Optional explicit mention ids (native clients); the server also parses `@Name` from `content`. */
    mentionedUserIds?: string[];
    updatedBy?: string; // uid of the writer (contract C1)
    createdAt: any;
}

export type ProjectModule = 'tasks' | 'initiatives' | 'activity' | 'milestones' | 'marketing' | 'accounting' | 'sprints';

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
    reminders?: ProjectReminder[];
    /** Server-maintained: ISO instant of the earliest pending reminder (absent when none). Do not write from clients. */
    nextReminderAt?: string;
    lastWorkbenchNote?: string;
    category?: IdeaGroup | IdeaGroup[];
    status?: TaskStatus;
    scheduledDate?: string; // Smart Schedule Date
    linkedIssueId?: string; // Legacy: issue this task was created from
    convertedIdeaId?: string; // Legacy lineage
    originIdeaId?: string; // Legacy lineage
    createdAt?: any;
    tenantId?: string; // For path resolution
    initiativeId?: string;
    legacyInitiativeRoot?: boolean;
    initiativeMigrationDismissed?: boolean;
    createdBy?: string;
    updatedBy?: string; // uid of the last writer (contract C1); the task triggers use it as the actor
    updatedAt?: any;
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

// --- Project Intake (external contributions) ---
export type ProjectIntakeFieldType = 'shortText' | 'longText' | 'email' | 'url' | 'select';
export type ProjectIntakeFieldRole = 'title' | 'description' | 'sourceUrl' | 'general';

export interface ProjectIntakeFieldOption {
    id: string;
    label: string;
    value: string;
}

export interface ProjectIntakeField {
    id: string;
    type: ProjectIntakeFieldType;
    role?: ProjectIntakeFieldRole;
    label: string;
    placeholder?: string;
    helpText?: string;
    required?: boolean;
    enabled?: boolean;
    width?: 'full' | 'half';
    options?: ProjectIntakeFieldOption[];
    isDefault?: boolean;
}

export interface ProjectIntakeCategory {
    id: string;
    label: string;
    icon?: string;
    description?: string;
    enabled?: boolean;
    fields: ProjectIntakeField[];
}

export interface ProjectIntakeFormSettings {
    enabled: boolean;
    token: string;
    title?: string;
    description?: string;
    submitLabel?: string;
    successMessage?: string;
    allowAttachments?: boolean;
    maxAttachments?: number;
    autoCreateTask?: boolean;
    categories?: ProjectIntakeCategory[];
    updatedAt?: any;
    updatedBy?: string;
}

export interface ProjectIntakeAttachment {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    downloadUrl: string;
}

export interface ProjectIntakeSubmittedField {
    fieldId: string;
    label: string;
    value: string;
    type: ProjectIntakeFieldType;
    role?: ProjectIntakeFieldRole;
}

export type ProjectSubmissionStatus = 'new' | 'reviewed' | 'accepted' | 'archived';

export interface ProjectSubmission {
    id: string;
    projectId: string;
    tenantId: string;
    categoryId: string;
    categoryLabel: string;
    status: ProjectSubmissionStatus;
    title: string;
    description?: string;
    submitter?: { name?: string; email?: string; company?: string };
    fields?: ProjectIntakeSubmittedField[];
    attachments?: ProjectIntakeAttachment[];
    linkedTaskId?: string;
    source?: 'public-form';
    submittedAt?: any;
    createdAt?: any;
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
    originIdeaId?: string; // Legacy lineage: flow/idea this initiative was created from
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
    updatedBy?: string; // uid of the last writer (contract C1)
    updatedAt?: any;
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
    type: 'comment' | 'task' | 'initiative' | 'file' | 'commit' | 'status' | 'priority' | 'report' | 'member' | 'codex' | 'issue';
    createdAt?: any;
    originIdeaId?: string; // Legacy lineage field
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
    originIdeaId?: string; // Legacy lineage
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
    | 'diagnostic_test'
    | 'reminder'
    | 'task_due_today'
    | 'morning_briefing'
    | 'day_close';

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
    reminderId?: string;
    /** In-app route to open (set for server nudges and reminders), e.g. `/tasks` or `/?mode=close`. */
    deepLink?: string;
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


export interface ApprovalEvent {
    id: string;
    type: 'submission' | 'approval' | 'rejection' | 'changes_requested';
    actorId: string;
    date: string;
    notes?: string;
    snapshot?: string; // Optional: JSON of the concept at that time
}

export interface PlannedPost {
    dayOffset: number;
    platform: string | string[];
    contentType: string;
    hook: string;
    visualDirection?: string;
}

// --- Online Marketing Module Types ---

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

// --- Recipient Management Types ---

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

// --- Marketing Settings (blog integration) ---

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

// ---------------------------------------------------------------------------
// Invoicing (Rechnungen) — German-compliant invoices for client projects
// ---------------------------------------------------------------------------

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'canceled';

export interface InvoiceLineItem {
    id: string;
    name: string;                 // Bezeichnung der Position
    description?: string;         // Beschreibung (unter dem Namen)
    quantity: number;             // Menge / Stück
    unit: string;                 // Einheit, i.d.R. 'h'
    unitPrice: number;            // Preis pro Einheit (netto)
    useFixedPrice?: boolean;      // true => fester Positionspreis statt Menge × Einzelpreis
    fixedPrice?: number;          // fester Positionspreis (netto)
}

export interface InvoiceParty {
    name: string;
    contactPerson?: string;       // Ansprechpartner, optional
    customerNumber?: string;      // Kundennummer, optional
    addressLine1?: string;
    addressLine2?: string;
    zip?: string;
    city?: string;
    country?: string;
    email?: string;
    vatId?: string;               // USt-IdNr des Kunden (optional)
}

export interface InvoiceIssuer {
    name: string;
    addressLine1?: string;
    zip?: string;
    city?: string;
    country?: string;
    email?: string;
    phone?: string;
    website?: string;
    taxNumber?: string;           // Steuernummer
    vatId?: string;               // USt-IdNr
}

export interface InvoiceBankDetails {
    accountHolder?: string;
    iban?: string;
    bic?: string;
    bankName?: string;
}

export interface InvoiceAppendixRow {
    id: string;
    date?: string;                // Datum der Einzelleistung
    description: string;          // Aufgabe / Leistung
    quantity: number;             // Menge
    unit: string;                 // Einheit
    amount?: number;              // Einzelbetrag netto (optional)
    note?: string;
}

export interface Invoice {
    id: string;
    projectId: string;
    tenantId?: string;
    number?: string;              // Rechnungsnummer (fortlaufend, erst bei Finalisierung)
    status: InvoiceStatus;
    issueDate: string;            // Rechnungsdatum (ISO yyyy-mm-dd)
    serviceDate?: string;         // Leistungsdatum / Beginn Leistungszeitraum
    serviceDateEnd?: string;      // Ende Leistungszeitraum (optional)
    dueDate?: string;             // Fälligkeit
    customer: InvoiceParty;
    items: InvoiceLineItem[];
    vatEnabled: boolean;          // false => Kleinunternehmer §19 UStG
    vatRate: number;              // z.B. 19
    currency: string;             // 'EUR'
    introText?: string;           // Einleitungstext
    notes?: string;               // Zahlungshinweise / Freitext
    appendixTitle?: string;       // Titel der Anlage (z. B. Leistungsnachweis)
    appendix?: InvoiceAppendixRow[]; // Einzelpositionen als Anlage (Folgeseite)
    effortEntryIds?: string[];    // IDs der Aufwand-Einträge, die in diese Rechnung übernommen wurden
    // Snapshots, damit die Rechnung stabil bleibt, auch wenn Einstellungen sich ändern
    issuer?: InvoiceIssuer;
    bank?: InvoiceBankDetails;
    logoUrl?: string;
    footerText?: string;          // konfigurierbarer Footer (überschreibt Einstellungen)
    createdAt?: any;
    updatedAt?: any;
}

export interface BillingSettings {
    issuer?: InvoiceIssuer;
    bank?: InvoiceBankDetails;
    logoUrl?: string;
    logoFileId?: string;
    footerText?: string;          // konfigurierbarer Footer (mehrzeilig)
    defaultVatRate?: number;      // Standard 19
    smallBusiness?: boolean;      // Kleinunternehmer-Standard
    defaultPaymentTermsDays?: number; // Standard 14
    defaultNotes?: string;
    invoiceNumberPrefix?: string; // z.B. 'RE-{YYYY}-' ({YYYY} => aktuelles Jahr)
    nextInvoiceNumber?: number;   // fortlaufender Zähler
    currency?: string;            // Standard EUR
}

// ---------------------------------------------------------------------------
// Effort log (Aufwand) — time/token tracking for client projects
// ---------------------------------------------------------------------------

export interface EffortEntry {
    id: string;
    projectId: string;
    tenantId?: string;
    date: string;                 // Datum (ISO yyyy-mm-dd)
    task: string;                 // Aufgabe
    durationValue: number;        // Dauer (Wert)
    durationUnit: string;         // Dauer (Einheit), i.d.R. 'h'
    tokenValue?: number;          // Token (Wert)
    tokenUnit?: string;           // Token (Einheit)
    note?: string;                // Notiz
    createdAt?: any;
    updatedAt?: any;
}
