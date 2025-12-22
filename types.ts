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

export type ProjectModule = 'tasks' | 'ideas' | 'mindmap' | 'activity' | 'issues';

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
