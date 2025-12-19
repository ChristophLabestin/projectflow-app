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
    onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "./firebase";
import { Project, Task, Idea, SubTask, Activity, TaskCategory, Mindmap } from "../types";
import { toMillis } from "../utils/time";

const TENANTS = "tenants";
const PROJECTS = "projects";
const USERS = "users";
const TASKS = "tasks";
const SUBTASKS = "subtasks";
const IDEAS = "ideas";
const MINDMAPS = "mindmaps";
const ACTIVITIES = "activities";
const CATEGORIES = "taskCategories";

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

export const deleteProjectById = async (projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const projectRef = projectDocRef(resolvedTenant, projectId);
    await deleteDoc(projectRef);
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

export const getProjectById = async (projectId: string, tenantId?: string): Promise<Project | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const docSnap = await getDoc(projectDocRef(resolvedTenant, projectId));
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Project;
    }
    return null;
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
    extra?: Partial<Pick<Task, 'description' | 'category' | 'status'>>,
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

    const q = query(collectionGroup(db, TASKS), where("ownerId", "==", user.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Task));
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
