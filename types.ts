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
    createdAt?: any; // Firestore Timestamp
}

export interface Task {
    id: string;
    projectId: string;
    ownerId: string;
    title: string;
    isCompleted: boolean;
    dueDate?: string;
    priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
    assignee?: string; // URL or Name
    description?: string;
    category?: IdeaGroup | IdeaGroup[];
    status?: TaskStatus;
    createdAt?: any;
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
    convertedTaskId?: string;
    convertedAt?: any;
    createdAt?: any;
    posX?: number;
    posY?: number;
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
