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

// Permission System Types
export type ProjectRole = 'Owner' | 'Editor' | 'Viewer';

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
    createdAt?: any; // Firestore Timestamp
    tenantId?: string;
}

export interface Member {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    role: 'Owner' | 'Editor' | 'Viewer';
    joinedAt?: any;
    theme?: 'light' | 'dark' | 'system';
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
    description?: string;
    category?: IdeaGroup | IdeaGroup[];
    status?: TaskStatus;
    scheduledDate?: string; // Smart Schedule Date
    createdAt?: any;
    tenantId?: string; // For path resolution
}

export interface SubTask {
    id: string;
    taskId: string;
    projectId?: string;
    ownerId: string;
    title: string;
    isCompleted: boolean;
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
    scheduledDate?: string; // Smart Schedule Date
    createdAt: any;
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
    type: 'comment' | 'task' | 'file' | 'commit' | 'status' | 'priority' | 'report';
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

export type TaskStatus = 'Backlog' | 'Open' | 'In Progress' | 'Blocked' | 'Done';

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
