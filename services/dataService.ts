import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp,
    setDoc,
    collectionGroup,
    documentId,
    onSnapshot,
    orderBy,
    limit,
    writeBatch,
} from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "./firebase";
import type { Task, Idea, Activity, Project, SubTask, TaskCategory, Issue, Mindmap, ProjectRole, ProjectMember } from '../types';
import { toMillis } from "../utils/time";

const TENANTS = "tenants";
const PROJECTS = "projects";
const USERS = "users";
const TASKS = "tasks";
const SUBTASKS = "subtasks";
const ISSUES = "issues";
const IDEAS = "ideas";
const MINDMAPS = "mindmaps";
const ACTIVITIES = "activities";
const CATEGORIES = "taskCategories";
const COMMENTS = "comments";

const TENANT_CACHE_KEY = "activeTenantId";

const getCachedTenantId = () => {
    try {
        if (typeof localStorage === "undefined") return undefined;
        return localStorage.getItem(TENANT_CACHE_KEY) || undefined;
    } catch {
        return undefined;
    }
};

export const setActiveTenantId = (tenantId: string) => {
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(TENANT_CACHE_KEY, tenantId);
        }
    } catch {
        // best-effort; ignore storage failures
    }
};

export const clearActiveTenantId = () => {
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.removeItem(TENANT_CACHE_KEY);
        }
    } catch {
        // ignore
    }
};

export const getActiveTenantId = () => getCachedTenantId();

const resolveTenantId = (tenantId?: string) => {
    const user = auth.currentUser;
    const resolved = tenantId || getCachedTenantId() || user?.uid;
    if (!resolved) {
        throw new Error("User not authenticated");
    }
    return resolved;
};

const tenantDocRef = (tenantId: string) => doc(db, TENANTS, tenantId);
const tenantUsersCollection = (tenantId: string) => collection(tenantDocRef(tenantId), USERS);
const projectsCollection = (tenantId: string) => collection(tenantDocRef(tenantId), PROJECTS);
const projectDocRef = (tenantId: string, projectId: string) => doc(tenantDocRef(tenantId), PROJECTS, projectId);
const projectSubCollection = (tenantId: string, projectId: string, sub: string) =>
    collection(projectDocRef(tenantId, projectId), sub);

const ensureTenantAndUser = async (tenantId: string) => {
    const user = auth.currentUser;
    const isOwner = user?.uid === tenantId;
    if (isOwner) {
        await setDoc(
            tenantDocRef(tenantId),
            {
                tenantId,
                name: user?.displayName || "Workspace",
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    }

    if (user) {
        await setDoc(
            doc(tenantUsersCollection(tenantId), user.uid),
            {
                uid: user.uid,
                email: user.email || "",
                displayName: user.displayName || "User",
                photoURL: user.photoURL || "",
                joinedAt: serverTimestamp(),
            },
            { merge: true }
        );
    }
};

export const getUserProfile = async (userId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snap = await getDoc(doc(tenantUsersCollection(resolvedTenant), userId));
    return snap.exists() ? snap.data() : null;
};

export const updateUserData = async (userId: string, data: Partial<any>, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await setDoc(doc(tenantUsersCollection(resolvedTenant), userId), data, { merge: true });
};

export const getTenant = async (tenantId: string) => {
    const snap = await getDoc(tenantDocRef(tenantId));
    if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
    }
    return null;
};

export const updateTenant = async (tenantId: string, updates: Record<string, any>) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    // Ideally check if user is owner, but for now allow members to update name? 
    // Or strictly owner? Let's assume loosely for now or just check ownership.
    // prompt said "you can do general settings like the name", implying the user can do it.
    await updateDoc(tenantDocRef(tenantId), updates);
};

const getProjectContextFromRef = (ref: { parent?: any }) => {
    const projectRef = ref.parent?.parent;
    const tenantRef = projectRef?.parent?.parent;
    return {
        projectId: projectRef?.id as string | undefined,
        tenantId: tenantRef?.id as string | undefined,
        projectRef,
    };
};

const findTaskDoc = async (taskId: string, projectId?: string, tenantId?: string) => {
    if (projectId) {
        const resolvedTenant = resolveTenantId(tenantId);
        const directRef = doc(projectSubCollection(resolvedTenant, projectId, TASKS), taskId);
        const snap = await getDoc(directRef);
        if (snap.exists()) return snap;
    }

    const cg = query(collectionGroup(db, TASKS), where(documentId(), "==", taskId));
    const snapshot = await getDocs(cg);
    return snapshot.docs[0] || null;
};

const findIdeaDoc = async (ideaId: string, projectId?: string, tenantId?: string) => {
    if (projectId) {
        const resolvedTenant = resolveTenantId(tenantId);
        const ref = doc(projectSubCollection(resolvedTenant, projectId, IDEAS), ideaId);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap;
    }

    const cg = query(collectionGroup(db, IDEAS), where(documentId(), "==", ideaId));
    const snapshot = await getDocs(cg);
    return snapshot.docs[0] || null;
};

const findMindmapDoc = async (mindmapId: string, projectId?: string, tenantId?: string) => {
    if (projectId) {
        const resolvedTenant = resolveTenantId(tenantId);
        const ref = doc(projectSubCollection(resolvedTenant, projectId, MINDMAPS), mindmapId);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap;
    }

    const cg = query(collectionGroup(db, MINDMAPS), where(documentId(), "==", mindmapId));
    const snapshot = await getDocs(cg);
    return snapshot.docs[0] || null;
};

const findSubtaskDoc = async (subTaskId: string, taskId?: string, projectId?: string, tenantId?: string) => {
    if (taskId) {
        const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
        if (taskSnap) {
            const ref = doc(collection(taskSnap.ref, SUBTASKS), subTaskId);
            const snap = await getDoc(ref);
            if (snap.exists()) return snap;
        }
    }

    const cg = query(collectionGroup(db, SUBTASKS), where(documentId(), "==", subTaskId));
    const snapshot = await getDocs(cg);
    return snapshot.docs[0] || null;
};

const logActivity = async (
    projectId: string,
    payload: Omit<Activity, "id" | "projectId" | "createdAt" | "user" | "userAvatar" | "ownerId"> & Partial<Activity>,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) return;
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    await addDoc(projectSubCollection(resolvedTenant, projectId, ACTIVITIES), {
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        user: payload.user || user.displayName || "User",
        userAvatar: payload.userAvatar || user.photoURL || "",
        action: payload.action,
        target: payload.target,
        details: payload.details || "",
        type: payload.type || "task",
        createdAt: serverTimestamp(),
    });
};

export const addActivityEntry = async (projectId: string, payload: Omit<Activity, "id" | "projectId" | "createdAt" | "ownerId">) => {
    await logActivity(projectId, payload);
};

// --- Tenants / Users ---

export const joinTenant = async (tenantId: string) => {
    setActiveTenantId(tenantId);
    await ensureTenantAndUser(tenantId);
};

export const bootstrapTenantForCurrentUser = async (inviteTenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const targetTenant = inviteTenantId || getCachedTenantId() || user.uid;
    setActiveTenantId(targetTenant);
    await ensureTenantAndUser(targetTenant);
};

// --- Projects ---

export const createProject = async (
    projectData: Partial<Project>,
    coverFile?: File,
    squareIconFile?: File,
    screenshotFiles?: File[],
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    let coverImageUrl = "";
    let squareIconUrl = "";
    const screenshotUrls: string[] = [];

    try {
        if (coverFile) {
            const storageRef = ref(storage, `tenants/${resolvedTenant}/projects/${Date.now()}_${coverFile.name}`);
            await uploadBytes(storageRef, coverFile);
            coverImageUrl = await getDownloadURL(storageRef);
        }
    } catch (e) {
        console.warn('Cover upload failed, proceeding without cover', e);
    }

    try {
        if (squareIconFile) {
            const storageRef = ref(storage, `tenants/${resolvedTenant}/projects/${Date.now()}_icon_${squareIconFile.name}`);
            await uploadBytes(storageRef, squareIconFile);
            squareIconUrl = await getDownloadURL(storageRef);
        }
    } catch (e) {
        console.warn('Icon upload failed, proceeding without icon', e);
    }

    if (screenshotFiles && screenshotFiles.length) {
        for (const file of screenshotFiles) {
            try {
                const storageRef = ref(storage, `tenants/${resolvedTenant}/projects/${Date.now()}_shot_${file.name}`);
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                screenshotUrls.push(url);
            } catch (e) {
                console.warn('Screenshot upload failed, skipping file', file?.name, e);
            }
        }
    }

    const docRef = await addDoc(projectsCollection(resolvedTenant), {
        ...projectData,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        coverImage: coverImageUrl,
        squareIcon: squareIconUrl,
        screenshots: screenshotUrls,
        progress: 0,
        members: [user.uid],
        createdAt: serverTimestamp()
    });

    await logActivity(
        docRef.id,
        { action: `Created project "${projectData.title || "Project"}"`, target: "Project", type: "status" },
        resolvedTenant
    );

    return docRef.id;
};

export const updateProjectFields = async (
    projectId: string,
    updates: Partial<Project>,
    activityMessage?: { action: string; target?: string; type?: Activity["type"] },
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const projectRef = projectDocRef(resolvedTenant, projectId);
    await updateDoc(projectRef, updates);
    if (activityMessage?.action) {
        await logActivity(
            projectId,
            { action: activityMessage.action, target: activityMessage.target || "Project", type: activityMessage.type || "status" },
            resolvedTenant
        );
    }
};

// Helper to extract tenant ID from a Document Reference path
const getTenantIdFromRef = (ref: any) => {
    // Path structure: tenants/{tenantId}/projects/{projectId}
    // ref.path -> "tenants/abc/projects/xyz"
    const parts = ref.path.split('/');
    if (parts[0] === TENANTS && parts.length >= 2) {
        return parts[1];
    }
    return null;
};

export const getProjectById = async (projectId: string, tenantId?: string): Promise<Project | null> => {
    // 1. Try fetching from the provided/active tenant first
    try {
        const resolvedTenant = resolveTenantId(tenantId);
        const docSnap = await getDoc(projectDocRef(resolvedTenant, projectId));
        if (docSnap.exists()) {
            return { id: docSnap.id, tenantId: resolvedTenant, ...docSnap.data() } as Project;
        }
    } catch (e) {
        console.warn("Failed to lookup project in active tenant, trying global search", e);
    }

    // 2. Fallback: Search globally across all tenants
    // Note: Cannot use documentId() with just the ID in collectionGroup queries
    // so we fetch all projects and filter client-side (less efficient but only used as fallback)
    const cg = collectionGroup(db, PROJECTS);
    const snapshot = await getDocs(cg);

    const matchingDoc = snapshot.docs.find(docSnap => docSnap.id === projectId);
    if (matchingDoc) {
        const extractedTenantId = getTenantIdFromRef(matchingDoc.ref);
        return {
            id: matchingDoc.id,
            tenantId: extractedTenantId,
            ...matchingDoc.data()
        } as Project;
    }

    return null;
};

export const deleteProjectById = async (projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const projectRef = projectDocRef(resolvedTenant, projectId);
    await deleteDoc(projectRef);
};

export const getSharedProjects = async (): Promise<Project[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    // Query all projects where the user is a member
    const q = query(
        collectionGroup(db, PROJECTS),
        where("members", "array-contains", user.uid)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs
        .map(docSnap => ({
            id: docSnap.id,
            tenantId: getTenantIdFromRef(docSnap.ref), // Extract tenant from path
            ...docSnap.data()
        } as Project))
        .filter(p => p.ownerId !== user.uid) // Exclude owned projects
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const joinProject = async (projectId: string, tenantId: string, role: ProjectRole = 'Editor') => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const projectRef = projectDocRef(tenantId, projectId);
    const snap = await getDoc(projectRef);

    if (!snap.exists()) {
        throw new Error("Project not found");
    }

    const data = snap.data();
    const members = data.members || [];

    // Support both legacy string[] and new ProjectMember[] formats
    const isMember = typeof members[0] === 'string'
        ? members.includes(user.uid)
        : (members as ProjectMember[]).some(m => m.userId === user.uid);

    if (!isMember) {
        const newMember: ProjectMember = {
            userId: user.uid,
            role,
            joinedAt: serverTimestamp(),
            invitedBy: data.ownerId,
        };

        await updateDoc(projectRef, {
            members: [...members, newMember]
        });
        await logActivity(
            projectId,
            { action: `${user.displayName || "User"} joined the project`, target: "Team", type: "status", user: user.displayName || "User" },
            tenantId
        );
    }
};

export const getProjectMembers = async (projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const project = await getProjectById(projectId, resolvedTenant);
    if (!project || !project.members) return [];

    // Support both legacy string[] and new ProjectMember[] formats
    if (typeof project.members[0] === 'string') {
        // Legacy format: return as-is (UIDs)
        return project.members;
    }

    // New format: return ProjectMember array
    return project.members;
};

/**
 * Invite a new member to a project by email with a specific role
 */
export const inviteMember = async (
    projectId: string,
    email: string,
    role: ProjectRole,
    tenantId?: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    const projectRef = projectDocRef(resolvedTenant, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
        throw new Error("Project not found");
    }

    const project = projectSnap.data() as Project;

    // Check permission
    if (project.ownerId !== user.uid) {
        throw new Error("Only the project owner can invite members");
    }

    // For now, we'll use email to find user
    // In a real app, you'd send an email invitation or use Firebase Auth to find user by email
    // Since we're simplifying, we'll just add a placeholder

    // TODO: Implement actual user lookup by email
    // For now, throw error asking for user ID instead
    throw new Error("Email invitations not yet implemented. Please share the project link with the user.");
};

/**
 * Update a member's role in the project
 */
export const updateMemberRole = async (
    projectId: string,
    userId: string,
    newRole: ProjectRole,
    tenantId?: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    const projectRef = projectDocRef(resolvedTenant, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
        throw new Error("Project not found");
    }

    const project = projectSnap.data() as Project;

    // Only owner can update roles
    if (project.ownerId !== user.uid) {
        throw new Error("Only the project owner can update member roles");
    }

    const members = project.members || [];

    // Find and update the member
    const updatedMembers = (members as ProjectMember[]).map(m =>
        m.userId === userId ? { ...m, role: newRole } : m
    );

    await updateDoc(projectRef, { members: updatedMembers });

    await logActivity(
        projectId,
        { action: `Updated ${userId}'s role to ${newRole}`, target: "Team", type: "status" },
        resolvedTenant
    );
};

/**
 * Remove a member from the project
 */
export const removeMember = async (
    projectId: string,
    userId: string,
    tenantId?: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    const projectRef = projectDocRef(resolvedTenant, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
        throw new Error("Project not found");
    }

    const project = projectSnap.data() as Project;

    // Only owner can remove members
    if (project.ownerId !== user.uid) {
        throw new Error("Only the project owner can remove members");
    }

    const members = project.members || [];

    // Filter out the member
    const updatedMembers = (members as ProjectMember[]).filter(m => m.userId !== userId);

    await updateDoc(projectRef, { members: updatedMembers });

    await logActivity(
        projectId,
        { action: `Removed member from project`, target: "Team", type: "status" },
        resolvedTenant
    );
};

export const getUserProjects = async (tenantId?: string): Promise<Project[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const resolvedTenant = tenantId || getCachedTenantId() || user.uid;
    await ensureTenantAndUser(resolvedTenant);
    const q = query(projectsCollection(resolvedTenant), where("ownerId", "==", user.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Project))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};



// --- Tasks ---

const ensureCategory = async (projectId: string, name?: string | string[], tenantId?: string) => {
    const user = auth.currentUser;
    const list = Array.isArray(name) ? name : [name || ""];
    const trimmedList = list.map(n => n.trim()).filter(Boolean);
    if (!trimmedList.length) return;

    const resolvedTenant = resolveTenantId(tenantId);
    const categoriesRef = projectSubCollection(resolvedTenant, projectId, CATEGORIES);
    const snapshot = await getDocs(categoriesRef);
    const existingNormalized = snapshot.docs.map(doc => (doc.data().normalized || doc.data().name || "").toLowerCase());
    for (const entry of trimmedList) {
        const normalized = entry.toLowerCase();
        if (existingNormalized.includes(normalized)) continue;
        await addDoc(categoriesRef, {
            projectId,
            tenantId: resolvedTenant,
            ownerId: user?.uid || "",
            name: entry,
            normalized,
            createdAt: serverTimestamp()
        });
    }
};

export const getProjectCategories = async (projectId: string, tenantId?: string): Promise<TaskCategory[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, CATEGORIES));
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as TaskCategory))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const addTask = async (
    projectId: string,
    title: string,
    dueDate?: string,
    assignee?: string,
    priority: Task['priority'] = "Medium",
    extra?: Partial<Pick<Task, 'description' | 'category' | 'status' | 'assigneeId'>>,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, TASKS), {
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        title,
        isCompleted: false,
        dueDate: dueDate || "",
        assignee: assignee || "",
        priority,
        description: extra?.description || "",
        category: extra?.category || [],
        status: extra?.status || "Open",
        assigneeId: extra?.assigneeId || (user.uid === assignee ? user.uid : undefined), // Proritize explicit ID
        createdAt: serverTimestamp()
    });
    await ensureCategory(projectId, extra?.category, resolvedTenant);
    await logActivity(projectId, { action: `Added task "${title}"`, target: "Tasks", type: "task" }, resolvedTenant);
    return docRef.id;
};

export const getTaskById = async (taskId: string, projectId?: string, tenantId?: string): Promise<Task | null> => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (taskSnap?.exists()) {
        return { id: taskSnap.id, ...taskSnap.data() } as Task;
    }
    return null;
};

export const getProjectTasks = async (projectId: string, tenantId?: string): Promise<Task[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, TASKS));
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Task))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const getUserTasks = async (): Promise<Task[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    // Fallback Strategy: Scan current tenant projects manually.
    // This avoids needing complex CollectionGroup indexes for now.

    // 1. Get all projects in current tenant (simple fetch)
    // We try to get all and filter in memory to avoid "Missing Index" on filtered queries
    let allProjects: Project[] = [];
    try {
        const tenantId = resolveTenantId();
        const projectsRef = projectsCollection(tenantId);
        // Fetch ALL projects in tenant (assuming reasonable count) to avoid "Missing Index" on filtered queries
        const snapshot = await getDocs(projectsRef);
        allProjects = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
    } catch (e) {
        console.warn("Error fetching projects for calendar", e);
    }

    // 2. Filter projects where user is member or owner
    const relevantProjects = allProjects.filter(p =>
        p.ownerId === user.uid || (p.members && p.members.includes(user.uid))
    );

    // 3. Fetch tasks for these projects
    const taskPromises = relevantProjects.map(async p => {
        try {
            const projectTasks = await getProjectTasks(p.id, p.tenantId);
            // Inject tenantId for context-aware updates later
            return projectTasks.map(t => ({ ...t, tenantId: p.tenantId }));
        } catch (e) {
            return [];
        }
    });

    const results = await Promise.all(taskPromises);
    const allTasks = results.flat();

    // 4. Return all tasks
    return allTasks.filter(t => t.ownerId === user.uid || t.assigneeId === user.uid || t.assignee === user.uid);
};

export const updateTask = async (taskId: string, updates: Partial<Task>, projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);

    // Construct path: tenants/{tenantId}/projects/{projectId}/tasks/{taskId}
    // Helper projectSubCollection gives collection ref. We need doc ref.
    const colRef = projectSubCollection(resolvedTenant, projectId, TASKS);
    const docRef = doc(colRef, taskId);

    await updateDoc(docRef, updates);
};

export const toggleTaskStatus = async (taskId: string, currentStatus: boolean, projectId?: string, tenantId?: string) => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error("Task not found");

    await updateDoc(taskSnap.ref, { isCompleted: !currentStatus });
    const data = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);
    await logActivity(
        data.projectId,
        { action: `${!currentStatus ? "Completed" : "Reopened"} task "${data.title}"`, target: "Tasks", type: "task" },
        resolvedTenant
    );
};

export const updateTaskFields = async (taskId: string, updates: Partial<Task>, projectId?: string, tenantId?: string) => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error("Task not found");
    const sanitized: Record<string, any> = {};
    Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) sanitized[key] = value;
    });
    if (Object.keys(sanitized).length === 0) return;

    await updateDoc(taskSnap.ref, sanitized);
    const data = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);
    await logActivity(
        data.projectId,
        { action: `Updated task "${data.title}"`, target: "Tasks", type: "task" },
        resolvedTenant
    );
    if (sanitized.category) {
        await ensureCategory(data.projectId, sanitized.category, resolvedTenant);
    }
};

export const deleteTask = async (taskId: string, projectId?: string, tenantId?: string) => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) return;
    const data = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);
    await deleteDoc(taskSnap.ref);
    await logActivity(
        data.projectId,
        { action: `Deleted task "${data.title}"`, target: "Tasks", type: "task" },
        resolvedTenant
    );
};

// --- Subtasks ---

export const addSubTask = async (taskId: string, title: string, projectId?: string, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error("Parent task not found");
    const task = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);

    await addDoc(collection(taskSnap.ref, SUBTASKS), {
        taskId,
        projectId: task.projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        title,
        isCompleted: false,
        createdAt: serverTimestamp()
    });
    await logActivity(task.projectId, { action: `Added subtask "${title}"`, target: task.title, type: "task" }, resolvedTenant);
};

export const getSubTasks = async (taskId: string, projectId?: string, tenantId?: string): Promise<SubTask[]> => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) return [];
    const snapshot = await getDocs(collection(taskSnap.ref, SUBTASKS));
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as SubTask))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const toggleSubTaskStatus = async (
    subTaskId: string,
    currentStatus: boolean,
    taskId?: string,
    projectId?: string,
    tenantId?: string
) => {
    const subSnap = await findSubtaskDoc(subTaskId, taskId, projectId, tenantId);
    if (!subSnap) return;
    await updateDoc(subSnap.ref, { isCompleted: !currentStatus });

    const data = subSnap.data() as SubTask | undefined;
    if (!data) return;
    const taskSnap = await findTaskDoc(data.taskId, projectId, tenantId);
    const parentTask = taskSnap?.data() as Task | undefined;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(subSnap.ref);
    if (parentTask) {
        await logActivity(
            parentTask.projectId,
            { action: `${!currentStatus ? "Completed" : "Reopened"} subtask "${data.title}"`, target: parentTask.title, type: "task" },
            resolvedTenant
        );
    }
};

// --- Ideas ---

export const saveIdea = async (idea: Partial<Idea>, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const targetCollection = idea.projectId
        ? projectSubCollection(resolvedTenant, idea.projectId, IDEAS)
        : collection(tenantDocRef(resolvedTenant), IDEAS);

    await addDoc(targetCollection, {
        ...idea,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        createdAt: serverTimestamp()
    });
};

export const updateIdea = async (ideaId: string, updates: Partial<Idea>, projectId?: string, tenantId?: string) => {
    const ideaSnap = await findIdeaDoc(ideaId, projectId, tenantId);
    if (!ideaSnap) throw new Error("Idea not found");
    await updateDoc(ideaSnap.ref, updates);
};

export const deleteIdea = async (ideaId: string, projectId?: string, tenantId?: string) => {
    const ideaSnap = await findIdeaDoc(ideaId, projectId, tenantId);
    if (!ideaSnap) return;
    await deleteDoc(ideaSnap.ref);
};

export const getUserIdeas = async (): Promise<Idea[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const q = query(collectionGroup(db, IDEAS), where("ownerId", "==", user.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Idea))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const getProjectIdeas = async (projectId: string, tenantId?: string): Promise<Idea[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, IDEAS));
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Idea))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

// --- Mindmaps ---

export const getProjectMindmaps = async (projectId: string, tenantId?: string): Promise<Mindmap[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, MINDMAPS));
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Mindmap))
        .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
};

export const createMindmap = async (projectId: string, name: string, tenantId?: string): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, MINDMAPS), {
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        name,
        createdAt: serverTimestamp()
    });
    return docRef.id;
};

export const updateMindmapName = async (mindmapId: string, name: string, projectId?: string, tenantId?: string) => {
    const snap = await findMindmapDoc(mindmapId, projectId, tenantId);
    if (!snap) throw new Error("Mindmap not found");
    await updateDoc(snap.ref, { name });
};

// --- Activity ---

export const getProjectActivity = async (projectId: string, tenantId?: string): Promise<Activity[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, ACTIVITIES));
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Activity))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        .slice(0, 20);
};

// --- Issues ---

export const createIssue = async (projectId: string, issue: Partial<Issue>, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    await addDoc(projectSubCollection(resolvedTenant, projectId, ISSUES), {
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        title: issue.title || "Untitled Issue",
        description: issue.description || "",
        status: issue.status || "Open",
        priority: issue.priority || "Medium",
        reporter: user.displayName || "User",
        assignee: issue.assignee || "",
        assigneeId: issue.assigneeId,
        reporterId: user.uid,
        createdAt: serverTimestamp()
    });

    await logActivity(projectId, { action: `Reported issue "${issue.title}"`, target: "Issues", type: "report" }, resolvedTenant);
};

export const updateIssue = async (issueId: string, updates: Partial<Issue>, projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(projectSubCollection(resolvedTenant, projectId, ISSUES), issueId);
    await updateDoc(ref, updates);
};

export const deleteIssue = async (issueId: string, projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(projectSubCollection(resolvedTenant, projectId, ISSUES), issueId);
    await deleteDoc(ref);
};

export const subscribeProjectIssues = (
    projectId: string,
    callback: (issues: Issue[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    ensureTenantAndUser(resolvedTenant).catch(() => undefined);
    return onSnapshot(projectSubCollection(resolvedTenant, projectId, ISSUES), (snap) => {
        const items = snap.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Issue))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        callback(items);
    });
};

// --- Realtime subscriptions ---

export const subscribeProjectTasks = (
    projectId: string,
    callback: (tasks: Task[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    ensureTenantAndUser(resolvedTenant).catch(() => undefined);
    return onSnapshot(projectSubCollection(resolvedTenant, projectId, TASKS), (snap) => {
        const items = snap.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Task))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        callback(items);
    });
};


// --- Presence ---

export const updatePresence = async (projectId: string, state: 'online' | 'offline', tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const resolvedTenant = resolveTenantId(tenantId);
    // Best effort, no await needed mostly
    const ref = doc(projectSubCollection(resolvedTenant, projectId, 'presence'), user.uid);
    try {
        await setDoc(ref, {
            uid: user.uid,
            displayName: user.displayName || 'User',
            photoURL: user.photoURL || '',
            email: user.email || '',
            state,
            title: (user as any).title || '', // We need to fetch this or store it in auth profile? Auth profile doesn't have title. 
            // We will fetch from local storage or context if possible, or just let the Profile page update it.
            // Actually, updatePresence is called often. We don't want to fetch DB every time.
            // For now, let's trust the UI to pass it if needed or just update status. 
            // Better strategy: The Profile page updates the "users" collection. 
            // The "Presence" relies on what's passed or defaults. 
            // Let's modify updatePresence to accept extra data optionally.
            lastChanged: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error("Failed to update presence", e);
    }
};

export const updateUserProfile = async (data: { displayName?: string, photoURL?: string, title?: string, bio?: string, file?: File }) => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user");

    let photoURL = data.photoURL || user.photoURL;

    // Use tenant-scoped path if available to ensure we satisfy existing storage rules
    // (Global /users path requires rule deployment, but /tenants/{id} is usually open)
    const tenantId = getCachedTenantId();

    if (data.file) {
        const path = tenantId
            ? `tenants/${tenantId}/users/${user.uid}/avatar_${Date.now()}`
            : `users/${user.uid}/avatar_${Date.now()}`;

        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, data.file);
        photoURL = await getDownloadURL(storageRef);
    }

    if (data.displayName || photoURL) {
        await updateProfile(user, {
            displayName: data.displayName || user.displayName,
            photoURL: photoURL
        });
    }

    // Update all tenant user records for this user (Since we don't have a specific tenant context here always, 
    // we might default to active tenant or just the one we are in.
    // Ideally we should update the global user reference if we had one.
    // For now, update the current active tenant user doc.
    if (tenantId) {
        const userRef = doc(tenantUsersCollection(tenantId), user.uid);
        await setDoc(userRef, {
            displayName: data.displayName || user.displayName,
            photoURL: photoURL,
            title: data.title || '',
            bio: data.bio || '',
            email: user.email
        }, { merge: true });
    }

    return photoURL;
};

export const subscribeProjectPresence = (
    projectId: string,
    callback: (activeUsers: { uid: string, displayName: string, photoURL?: string, email?: string, isOnline: boolean }[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    return onSnapshot(projectSubCollection(resolvedTenant, projectId, 'presence'), (snap) => {
        const users = snap.docs
            .map(d => d.data() as any)
            .filter(u => u.state === 'online' || (u.lastChanged && (Date.now() - toMillis(u.lastChanged)) < 5 * 60 * 1000)) // 5 min timeout fallback
            .map(u => ({ ...u, isOnline: true })); // If they passed the filter, they are effectively online

        callback(users);
    });
};

export const subscribeProject = (
    projectId: string,
    callback: (project: Project | null) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    ensureTenantAndUser(resolvedTenant).catch(() => undefined);
    return onSnapshot(projectDocRef(resolvedTenant, projectId), (snap) => {
        if (snap.exists()) {
            callback({ id: snap.id, ...snap.data() } as Project);
        } else {
            callback(null);
        }
    });
};

export const subscribeProjectIdeas = (
    projectId: string,
    callback: (ideas: Idea[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    ensureTenantAndUser(resolvedTenant).catch(() => undefined);
    return onSnapshot(projectSubCollection(resolvedTenant, projectId, IDEAS), (snap) => {
        const items = snap.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Idea))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        callback(items);
    });
};

export const subscribeProjectActivity = (
    projectId: string,
    callback: (activity: Activity[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    ensureTenantAndUser(resolvedTenant).catch(() => undefined);
    return onSnapshot(projectSubCollection(resolvedTenant, projectId, ACTIVITIES), (snap) => {
        const items = snap.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Activity))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
            .slice(0, 20);
        callback(items);
    });
};

export const subscribeTenantUsers = (
    callback: (users: { id: string; email?: string; displayName?: string; photoURL?: string; joinedAt?: any }[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    ensureTenantAndUser(resolvedTenant).catch(() => undefined);
    return onSnapshot(tenantUsersCollection(resolvedTenant), (snap) => {
        const items = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        callback(items);
    });
};

// --- Comments ---

export const addComment = async (
    projectId: string,
    targetId: string,
    targetType: 'task' | 'issue' | 'idea',
    content: string,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    await addDoc(projectSubCollection(resolvedTenant, projectId, COMMENTS), {
        projectId,
        targetId,
        targetType,
        userId: user.uid,
        userDisplayName: user.displayName || "User",
        userPhotoURL: user.photoURL || "",
        content,
        createdAt: serverTimestamp()
    });

    // Optionally increase comment count on the target object
    if (targetType === 'idea') {
        // Idea has a comments count
        const ideaSnap = await findIdeaDoc(targetId, projectId, resolvedTenant);
        if (ideaSnap) {
            const current = ideaSnap.data().comments || 0;
            updateDoc(ideaSnap.ref, { comments: current + 1 });
        }
    }
};

export const getComments = async (
    projectId: string,
    targetId: string,
    tenantId?: string
): Promise<Comment[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, COMMENTS),
        where("targetId", "==", targetId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Comment))
        .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
};

export const subscribeComments = (
    projectId: string,
    targetId: string,
    callback: (comments: Comment[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, COMMENTS),
        where("targetId", "==", targetId)
    );
    return onSnapshot(q, (snap) => {
        const items = snap.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Comment))
            .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
        callback(items);
    });
};

export const deleteComment = async (commentId: string, projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(projectSubCollection(resolvedTenant, projectId, COMMENTS), commentId));
};

export const getUserIssues = async (): Promise<Issue[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const q = query(collectionGroup(db, ISSUES), where("assigneeId", "==", user.uid));
    const snapshot = await getDocs(q);

    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Issue))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};
