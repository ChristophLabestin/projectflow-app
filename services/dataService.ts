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
    onSnapshot,
    Timestamp,
    serverTimestamp,
    setDoc,
    collectionGroup,
    documentId,
    orderBy,
    limit,
    writeBatch,
    increment,
    Unsubscribe,
    arrayUnion,
    arrayRemove,
    runTransaction,
    deleteField
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { updateProfile, linkWithPopup, reauthenticateWithPopup } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth, functions, GithubAuthProvider, FacebookAuthProvider } from "./firebase";
import type { Task, Idea, Activity, Project, SubTask, TaskCategory, Issue, Mindmap, ProjectRole, ProjectMember, Comment as ProjectComment, WorkspaceGroup, WorkspaceRole, SocialCampaign, SocialPost, SocialAsset, SocialPostStatus, SocialPlatform, SocialIntegration, EmailBlock, EmailComponent, GeminiReport, Milestone, AIUsage, Member, User, TenantMembership, MarketingCampaign, AdCampaign, EmailCampaign, PersonalTask, ProjectNavPrefs, CaptionPreset, SocialStrategy } from '../types';
import { toMillis } from "../utils/time";
import {
    notifyTaskAssignment,
    notifyIssueAssignment,
    notifyComment,
    notifySubtaskAssignment,
    notifyProjectInvite,
    createNotification
} from './notificationService';
import { createGithubIssue, updateGithubIssue, addGithubIssueComment } from './githubService';

const TENANTS = "tenants";
const PROJECTS = "projects";
const USERS = "users";
const TASKS = "tasks";
const SUBTASKS = "subtasks";
export const ISSUES = "issues";
const IDEAS = "ideas";
const MINDMAPS = "mindmaps";
const ACTIVITIES = "activities";
const CATEGORIES = "taskCategories";
const COMMENTS = "comments";
const GEMINI_REPORTS = "geminiReports";
export const SOCIAL_CAMPAIGNS = "social_campaigns";
export const SOCIAL_POSTS = "social_posts";
export const SOCIAL_ASSETS = "social_assets";
export const CAPTION_PRESETS = "caption_presets";
export const SOCIAL_STRATEGY = "social_strategy";

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

export const resolveTenantId = (tenantId?: string) => {
    const user = auth.currentUser;
    const resolved = tenantId || getCachedTenantId() || user?.uid;
    if (!resolved) {
        throw new Error("User not authenticated");
    }
    return resolved;
};

const tenantDocRef = (tenantId: string) => doc(db, TENANTS, tenantId);

export const getTenantSecret = async (tenantId: string, secretName: string) => {
    const ref = doc(db, TENANTS, tenantId, "secrets", secretName);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
};

export const updateTenantSecret = async (tenantId: string, secretName: string, data: any) => {
    const ref = doc(db, TENANTS, tenantId, "secrets", secretName);
    await setDoc(ref, data, { merge: true });
};

// --- Top-level users collection (global user profiles) ---
const usersCollection = () => collection(db, USERS);
const userDocRef = (userId: string) => doc(db, USERS, userId);

// --- Tenant members collection (workspace membership) ---
const tenantMembersCollection = (tenantId: string) => collection(db, TENANTS, tenantId, 'members');
const tenantMemberDocRef = (tenantId: string, userId: string) => doc(db, TENANTS, tenantId, 'members', userId);

// --- Project collections ---
const projectsCollection = (tenantId: string) => collection(tenantDocRef(tenantId), PROJECTS);
const projectDocRef = (tenantId: string, projectId: string) => doc(tenantDocRef(tenantId), PROJECTS, projectId);
export const projectSubCollection = (tenantId: string, projectId: string, subCollectionName: string) => {
    return collection(db, 'tenants', tenantId, 'projects', projectId, subCollectionName);
};



export const ensureTenantAndUser = async (tenantId: string, role?: WorkspaceRole) => {
    const user = auth.currentUser;
    if (!user) return; // No user, nothing to do

    const isOwner = user.uid === tenantId;

    // 1. Ensure user exists in top-level users collection
    const globalUserRef = userDocRef(user.uid);
    const globalUserSnap = await getDoc(globalUserRef);

    await setDoc(globalUserRef, {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "User",
        photoURL: user.photoURL || "",
        updatedAt: serverTimestamp(),
        ...(!globalUserSnap.exists() ? { createdAt: serverTimestamp() } : {})
    }, { merge: true });

    // Initialize AI usage if not present (on global user doc)
    if (!globalUserSnap.exists() || !globalUserSnap.data()?.aiUsage) {
        await setDoc(globalUserRef, {
            aiUsage: {
                tokensUsed: 0,
                tokenLimit: 1000000,
                imagesUsed: 0,
                imageLimit: 50,
                lastReset: serverTimestamp()
            }
        }, { merge: true });
    }

    // 2. Only the owner can create a tenant document
    if (isOwner) {
        await setDoc(
            tenantDocRef(tenantId),
            {
                tenantId,
                name: user.displayName || "Workspace",
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    }

    // Check if tenant exists before writing membership
    const tenantDoc = await getDoc(tenantDocRef(tenantId));
    if (!tenantDoc.exists() && !isOwner) {
        console.warn(`ensureTenantAndUser: Tenant ${tenantId} does not exist and user is not owner. Skipping.`);
        return;
    }

    // 3. Add membership to tenants/{tenantId}/members/{userId}
    const memberRef = tenantMemberDocRef(tenantId, user.uid);
    const memberPayload: any = {
        uid: user.uid,
        joinedAt: serverTimestamp(),
    };

    // Set role if explicitly passed or if owner
    if (role) {
        memberPayload.role = role;
    } else if (isOwner) {
        memberPayload.role = 'Owner';
    } else {
        memberPayload.role = 'Member';
    }

    await setDoc(memberRef, memberPayload, { merge: true });
};

/**
 * Get user profile from top-level users collection
 * @param userId - The user ID to fetch
 * @param _tenantId - Deprecated, ignored. Kept for API compatibility.
 */
export const getUserProfile = async (userId: string, _tenantId?: string) => {
    const snap = await getDoc(userDocRef(userId));
    return snap.exists() ? snap.data() : null;
};

/**
 * Get user's membership data for a specific tenant
 */
export const getUserTenantMembership = async (userId: string, tenantId: string) => {
    const snap = await getDoc(tenantMemberDocRef(tenantId, userId));
    return snap.exists() ? snap.data() : null;
};

/**
 * Get all members of a workspace (combined profile + membership data)
 */
export const getWorkspaceMembers = async (tenantId?: string): Promise<Member[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const memberRefs = await getDocs(tenantMembersCollection(resolvedTenant));

    const members = await Promise.all(
        memberRefs.docs.map(async (memberDoc) => {
            const membership = memberDoc.data();
            const userSnap = await getDoc(userDocRef(memberDoc.id));
            const userData = userSnap.exists() ? userSnap.data() : {};
            return {
                ...userData,
                uid: memberDoc.id,
                role: membership.role,
                joinedAt: membership.joinedAt,
                groupIds: membership.groupIds,
                pinnedProjectId: membership.pinnedProjectId,
                githubToken: membership.githubToken,
            } as Member;
        })
    );
    return members;
};

/**
 * Update user profile data (global)
 */
export const updateUserData = async (userId: string, data: Partial<any>) => {
    await setDoc(userDocRef(userId), data, { merge: true });
};

/**
 * Update user's membership data for a specific tenant
 */
export const updateUserMembership = async (userId: string, tenantId: string, data: Partial<any>) => {
    await setDoc(tenantMemberDocRef(tenantId, userId), data, { merge: true });
};

export const linkWithGithub = async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    const provider = new GithubAuthProvider();
    provider.addScope('repo');
    provider.addScope('user');

    try {
        const result = await linkWithPopup(user, provider);
        const credential = GithubAuthProvider.credentialFromResult(result);
        if (!credential?.accessToken) {
            throw new Error("Failed to get GitHub access token");
        }
        return credential.accessToken;
    } catch (error: any) {
        console.error("GitHub link error", error);
        if (error.code === 'auth/credential-already-in-use') {
            throw new Error("This GitHub account is already linked to another user.");
        }
        throw error;
    }
};

export const getAIUsage = async (userId: string): Promise<AIUsage | null> => {
    try {
        const userRef = userDocRef(userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const data = snap.data() as User;
            // Monthly reset check
            if (data.aiUsage) {
                const lastReset = data.aiUsage.lastReset?.toDate?.() || new Date(data.aiUsage.lastReset);
                const now = new Date();
                if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
                    const resetUsage = {
                        ...data.aiUsage,
                        tokensUsed: 0,
                        imagesUsed: 0,
                        lastReset: serverTimestamp()
                    };
                    await updateDoc(userRef, { aiUsage: resetUsage });
                    return resetUsage;
                }
            }
            return data.aiUsage || null;
        }
    } catch (e) {
        console.warn("Failed to get CORA usage", e);
    }
    return null;
};

export const incrementAIUsage = async (userId: string, tokens: number) => {
    const userRef = userDocRef(userId);
    await updateDoc(userRef, {
        'aiUsage.tokensUsed': increment(tokens)
    });
};

export const incrementImageUsage = async (userId: string, count: number) => {
    const userRef = userDocRef(userId);
    await updateDoc(userRef, {
        'aiUsage.imagesUsed': increment(count)
    });
};

export const incrementIdeaAIUsage = async (ideaId: string, tokens: number, projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ideaRef = doc(projectSubCollection(resolvedTenant, projectId, IDEAS), ideaId);
    await updateDoc(ideaRef, {
        aiTokensUsed: increment(tokens)
    });
};

export const incrementCampaignAIUsage = async (campaignId: string, tokens: number, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const campaignRef = doc(db, SOCIAL_CAMPAIGNS, campaignId);
    await updateDoc(campaignRef, {
        aiTokensUsed: increment(tokens)
    });
};


export const deleteSocialCampaign = async (campaignId: string) => {
    const campaignRef = doc(db, SOCIAL_CAMPAIGNS, campaignId);
    await deleteDoc(campaignRef);
};

// --- User Project Navigation Preferences ---

export const getUserProjectNavPrefs = async (userId: string, projectId: string, tenantId?: string): Promise<ProjectNavPrefs | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(db, TENANTS, resolvedTenant, USERS, userId, 'projectNavPrefs', projectId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
        return snap.data() as ProjectNavPrefs;
    }
    return null;
};

export const setUserProjectNavPrefs = async (userId: string, projectId: string, prefs: ProjectNavPrefs, tenantId?: string): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(db, TENANTS, resolvedTenant, USERS, userId, 'projectNavPrefs', projectId);
    await setDoc(ref, prefs);
};

export const subscribeUserProjectNavPrefs = (
    userId: string,
    projectId: string,
    onUpdate: (prefs: ProjectNavPrefs | null) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(db, TENANTS, resolvedTenant, USERS, userId, 'projectNavPrefs', projectId);

    return onSnapshot(ref, (snapshot) => {
        if (snapshot.exists()) {
            onUpdate(snapshot.data() as ProjectNavPrefs);
        } else {
            onUpdate(null);
        }
    });
};

// --- User Status Preference ---

/**
 * Update the user's manual status preference (Online/Busy/Away/Auto)
 * This is stored in tenants/{tenantId}/users/{userId}/preferences/status
 */
export const updateUserStatusPreference = async (userId: string, status: 'online' | 'busy' | 'idle' | 'offline', tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(db, TENANTS, resolvedTenant, USERS, userId);
    await setDoc(ref, { statusPreference: status }, { merge: true });
};

/**
 * Subscribe to user's status preference
 */
export const subscribeUserStatusPreference = (userId: string, onUpdate: (status: 'online' | 'busy' | 'idle' | 'offline') => void, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(db, TENANTS, resolvedTenant, USERS, userId);
    return onSnapshot(ref, (snap) => {
        if (snap.exists()) {
            onUpdate(snap.data().statusPreference || 'auto');
        } else {
            onUpdate('auto');
        }
    });
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
    // If we have a tenantId, try direct lookup first
    if (projectId && tenantId) {
        const directRef = doc(projectSubCollection(tenantId, projectId, TASKS), taskId);
        const snap = await getDoc(directRef);
        if (snap.exists()) return snap;
    }

    // If only projectId, try to get project first to find its tenant
    if (projectId && !tenantId) {
        const project = await getProjectById(projectId);
        if (project?.tenantId) {
            const directRef = doc(projectSubCollection(project.tenantId, projectId, TASKS), taskId);
            const snap = await getDoc(directRef);
            if (snap.exists()) return snap;
        }
    }

    // Fallback: global collectionGroup search
    const cg = collectionGroup(db, TASKS);
    const snapshot = await getDocs(cg);
    const matchingDoc = snapshot.docs.find((d) => d.id === taskId);
    return matchingDoc || null;
};

const findIdeaDoc = async (ideaId: string, projectId?: string, tenantId?: string) => {
    if (projectId) {
        const resolvedTenant = resolveTenantId(tenantId);
        const ref = doc(projectSubCollection(resolvedTenant, projectId, IDEAS), ideaId);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap;
    }

    // Note: documentId() in collection group queries requires a full path, not just the ID.
    // So we iterate through results and find by ID instead.
    const cg = collectionGroup(db, IDEAS);
    const snapshot = await getDocs(cg);
    const matchingDoc = snapshot.docs.find((d) => d.id === ideaId);
    return matchingDoc || null;
};

export const getIdeaById = async (ideaId: string, projectId?: string, tenantId?: string): Promise<Idea | null> => {
    const docSnap = await findIdeaDoc(ideaId, projectId, tenantId);
    if (docSnap && docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as Idea;
    }
    return null;
};

export const subscribeToIdea = (ideaId: string, projectId: string, onUpdate: (idea: Idea) => void, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ideaRef = doc(projectSubCollection(resolvedTenant, projectId, IDEAS), ideaId);
    return onSnapshot(ideaRef, (snap) => {
        if (snap.exists()) {
            onUpdate({ ...snap.data(), id: snap.id } as Idea);
        }
    });
};



const findMindmapDoc = async (mindmapId: string, projectId?: string, tenantId?: string) => {
    if (projectId) {
        const resolvedTenant = resolveTenantId(tenantId);
        const ref = doc(projectSubCollection(resolvedTenant, projectId, MINDMAPS), mindmapId);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap;
    }

    // Note: documentId() in collection group queries requires a full path, not just the ID.
    const cg = collectionGroup(db, MINDMAPS);
    const snapshot = await getDocs(cg);
    const matchingDoc = snapshot.docs.find((d) => d.id === mindmapId);
    return matchingDoc || null;
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

    // Note: documentId() in collection group queries requires a full path, not just the ID.
    const cg = collectionGroup(db, SUBTASKS);
    const snapshot = await getDocs(cg);
    const matchingDoc = snapshot.docs.find((d) => d.id === subTaskId);
    return matchingDoc || null;
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
        target: payload.target || "Unknown",
        details: payload.details || "",
        relatedId: payload.relatedId || null,
        type: payload.type || "task",
        createdAt: serverTimestamp(),
    });
};

export const addActivityEntry = async (projectId: string, payload: Omit<Activity, "id" | "projectId" | "createdAt" | "ownerId">) => {
    await logActivity(projectId, payload);
};

// --- Tenants / Users ---

export const joinTenant = async (tenantId: string, role: WorkspaceRole = 'Member') => {
    setActiveTenantId(tenantId);
    await ensureTenantAndUser(tenantId, role);
};

export const bootstrapTenantForCurrentUser = async (inviteTenantId?: string, ignoreCache = false) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // 1. Always ensure the user has their own personal tenant
    await ensureTenantAndUser(user.uid);

    // 2. Determine target tenant
    // If invited, use that.
    // If ignoreCache is TRUE, we skip getCachedTenantId() (critical for fresh registrations).
    // Otherwise, we check cache, then fallback to user.uid.
    const targetTenant = inviteTenantId || (!ignoreCache && getCachedTenantId()) || user.uid;

    // 3. If target is different (e.g. joined via invite), ensure we are added to that tenant too
    if (targetTenant !== user.uid) {
        await ensureTenantAndUser(targetTenant);
    }

    setActiveTenantId(targetTenant);
};

// --- Projects ---

export const createProject = async (
    projectData: Partial<Project>,
    coverFile?: File | string,
    squareIconFile?: File | string,
    screenshotFiles?: (File | string)[],
    initialMemberIds: string[] = [],
    tenantId?: string,
    visibilityGroupIds?: string[]
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    // 1. Create the project document first to get an ID
    const docRef = await addDoc(projectsCollection(resolvedTenant), {
        ...projectData,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        coverImage: "",
        squareIcon: "",
        screenshots: [],
        progress: 0,
        members: Array.from(new Set([user.uid, ...initialMemberIds])),
        memberIds: Array.from(new Set([user.uid, ...initialMemberIds])),
        visibilityGroupIds: visibilityGroupIds || [],
        visibilityGroupId: visibilityGroupIds?.[0] || null, // Backwards compatibility
        createdAt: serverTimestamp()
    });

    const projectId = docRef.id;
    let coverImageUrl = typeof coverFile === 'string' ? coverFile : "";
    let squareIconUrl = typeof squareIconFile === 'string' ? squareIconFile : "";
    const screenshotUrls: string[] = [];

    // 2. Upload assets to project-specific folder: tenants/{tid}/projects/{pid}/
    // We include _media_{projectId}_ in the filename for library discovery
    const timestamp = Date.now();
    const getStoragePath = (file: File, kind: string) =>
        `tenants/${resolvedTenant}/projects/${projectId}/${timestamp}_media_${projectId}_${kind}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

    try {
        if (coverFile && typeof coverFile !== 'string') {
            const storageRef = ref(storage, getStoragePath(coverFile, 'cover'));
            await uploadBytes(storageRef, coverFile);
            coverImageUrl = await getDownloadURL(storageRef);
        }
    } catch (e) {
        console.warn('Cover upload failed', e);
    }

    try {
        if (squareIconFile && typeof squareIconFile !== 'string') {
            const storageRef = ref(storage, getStoragePath(squareIconFile, 'icon'));
            await uploadBytes(storageRef, squareIconFile);
            squareIconUrl = await getDownloadURL(storageRef);
        }
    } catch (e) {
        console.warn('Icon upload failed', e);
    }

    if (screenshotFiles && screenshotFiles.length) {
        for (const file of screenshotFiles) {
            if (typeof file === 'string') {
                screenshotUrls.push(file);
                continue;
            }
            try {
                const storageRef = ref(storage, getStoragePath(file, 'screenshot'));
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                screenshotUrls.push(url);
            } catch (e) {
                console.warn('Screenshot upload failed', file?.name, e);
            }
        }
    }


    // 3. Update the project document with the final URLs
    await updateDoc(docRef, {
        coverImage: coverImageUrl || deleteField(),
        squareIcon: squareIconUrl || deleteField(),
        screenshots: screenshotUrls
    });

    await logActivity(
        projectId,
        { action: `Created project "${projectData.title || "Project"}"`, target: "Project", type: "status" },
        resolvedTenant
    );

    return projectId;
};

export const updateProjectFields = async (
    projectId: string,
    updates: Partial<Project>,
    activityMessage?: { action: string; target?: string; type?: Activity["type"] },
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const projectRef = projectDocRef(resolvedTenant, projectId);

    // Sanitize updates to remove undefined values which cause Firestore errors
    const sanitizedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, any>);

    await updateDoc(projectRef, sanitizedUpdates);
    if (activityMessage?.action) {
        await logActivity(
            projectId,
            { action: activityMessage.action, target: activityMessage.target || "Project", type: activityMessage.type || "status" },
            resolvedTenant
        );
    }
};

// --- Milestones ---

export const MILESTONES = "milestones";

export const createMilestone = async (
    projectId: string,
    milestoneData: Omit<Milestone, "id" | "createdAt" | "createdBy" | "tenantId" | "projectId">,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, MILESTONES), {
        ...milestoneData,
        projectId,
        tenantId: resolvedTenant,
        createdBy: user.uid,
        createdAt: serverTimestamp()
    });

    await logActivity(
        projectId,
        { action: `Created milestone "${milestoneData.title}"`, target: "Milestone", type: "status" },
        resolvedTenant
    );

    return docRef.id;
};

export const updateMilestone = async (
    projectId: string,
    milestoneId: string,
    updates: Partial<Milestone>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(projectSubCollection(resolvedTenant, projectId, MILESTONES), milestoneId);
    await updateDoc(ref, updates);
};

export const deleteMilestone = async (
    projectId: string,
    milestoneId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(projectSubCollection(resolvedTenant, projectId, MILESTONES), milestoneId);
    await deleteDoc(ref);
};

export const subscribeProjectMilestones = (
    projectId: string,
    onUpdate: (milestones: Milestone[]) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, MILESTONES),
        orderBy("dueDate", "asc")
    );

    return onSnapshot(q, (snapshot) => {
        const milestones = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Milestone));
        onUpdate(milestones);
    });
};

// --- Gemini Reports ---

export const saveGeminiReport = async (projectId: string, content: string, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    await addDoc(projectSubCollection(resolvedTenant, projectId, GEMINI_REPORTS), {
        projectId,
        content,
        createdBy: user.uid,
        userName: user.displayName || "User",
        createdAt: serverTimestamp()
    });

    await logActivity(
        projectId,
        { action: "Generated project report", target: "CORA Report", details: content, type: "report" },
        resolvedTenant
    );
};

export const getLatestGeminiReport = async (projectId: string, tenantId?: string): Promise<GeminiReport | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, GEMINI_REPORTS),
        orderBy("createdAt", "desc"),
        limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return {
        id: snap.docs[0].id,
        ...data
    } as GeminiReport;
};

// --- Email Components (Reusable Blocks) ---

export const EMAIL_COMPONENTS = "email_components";

export const saveEmailComponent = async (projectId: string, name: string, block: EmailBlock, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    // Clean block ID to ensure uniqueness on drag-out? No, we store the template structure.
    // When using it, we should regenerate IDs.

    await addDoc(projectSubCollection(resolvedTenant, projectId, EMAIL_COMPONENTS), {
        projectId,
        name,
        block, // Stores the entire JSON structure of the block (and children if recursive)
        createdBy: user.uid,
        createdAt: serverTimestamp()
    });
};

export const getEmailComponents = async (projectId: string, tenantId?: string): Promise<EmailComponent[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, EMAIL_COMPONENTS),
        orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as EmailComponent));
};

export const deleteEmailComponent = async (projectId: string, componentId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(projectSubCollection(resolvedTenant, projectId, EMAIL_COMPONENTS), componentId));
};


// --- Email Templates (Main Drafts/Templates) ---

export const EMAIL_TEMPLATES = "email_templates";

export const getProjectTemplates = async (projectId: string, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    const q = query(
        projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES),
        orderBy("updatedAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]; // Cast to any or EmailTemplate
};

export const saveEmailTemplateDraft = async (projectId: string, blocks: EmailBlock[], variables: TemplateVariable[], tenantId?: string, name?: string, status: 'draft' | 'published' = 'draft', templateId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    const docData = {
        projectId,
        name: name || 'Unnamed Template',
        blocks,
        variables,
        status: status,
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        // Only set createdAt if creating new
        ...(templateId ? {} : { createdAt: serverTimestamp() })
    };

    let savedTemplateId = templateId;

    if (templateId) {
        const docRef = doc(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), templateId);
        await setDoc(docRef, docData, { merge: true });
    } else {
        const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), docData);
        savedTemplateId = docRef.id;
    }

    // Save version snapshot
    if (savedTemplateId) {
        try {
            const templateRef = doc(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), savedTemplateId);
            const versionsRef = collection(templateRef, "versions");
            await addDoc(versionsRef, {
                ...docData,
                versionCreatedAt: serverTimestamp(),
                savedBy: user.uid
            });
        } catch (e) {
            console.error("Failed to save version snapshot", e);
            // Non-blocking error for version history
        }
    }

    return savedTemplateId;
};

export const getTemplateVersions = async (projectId: string, templateId: string, tenantId?: string): Promise<EmailTemplate[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const templateRef = doc(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), templateId);
    const versionsRef = collection(templateRef, "versions");
    const q = query(versionsRef, orderBy("versionCreatedAt", "desc"), limit(25));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        updatedAt: doc.data().versionCreatedAt || doc.data().updatedAt // Map version timestamp to updatedAt for UI consistency
    } as EmailTemplate));
};

export const getLatestEmailTemplateDraft = async (projectId: string, tenantId?: string): Promise<EmailTemplate | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES),
        orderBy("updatedAt", "desc"),
        limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as EmailTemplate;
};

export const getEmailTemplateDrafts = async (projectId: string, tenantId?: string): Promise<EmailTemplate[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES),
        orderBy("updatedAt", "desc"),
        limit(25)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailTemplate));
};

export const deleteEmailTemplate = async (projectId: string, templateId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    if (!resolvedTenant) throw new Error("Tenant ID required");
    await deleteDoc(doc(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), templateId));
};

export const getEmailTemplateById = async (projectId: string, templateId: string, tenantId?: string): Promise<EmailTemplate | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snap = await getDoc(doc(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), templateId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as EmailTemplate;
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
        where("memberIds", "array-contains", user.uid)
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

export const getAllMemberProjects = async (userId: string): Promise<Project[]> => {
    // Query all projects where the user is a member
    const q = query(
        collectionGroup(db, PROJECTS),
        where("memberIds", "array-contains", userId)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs
        .map(docSnap => ({
            id: docSnap.id,
            tenantId: getTenantIdFromRef(docSnap.ref), // Extract tenant from path
            ...docSnap.data()
        } as Project))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};


export const getUserGlobalActivities = async (tenantId?: string, limitCount = 20): Promise<Activity[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const resolvedTenant = resolveTenantId(tenantId);

    const q = query(
        collectionGroup(db, ACTIVITIES),
        where("tenantId", "==", resolvedTenant),
        orderBy("createdAt", "desc"),
        limit(limitCount)
    );

    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Activity));
    } catch (error) {
        console.error("Error fetching global activities:", error);
        return [];
    }
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
            joinedAt: new Date(),
            invitedBy: data.ownerId || 'System',
        };

        await updateDoc(projectRef, {
            members: [...members, newMember],
            memberIds: arrayUnion(user.uid)
        });

        // Check if user already exists in tenant members to preserve role
        const memberRef = tenantMemberDocRef(tenantId, user.uid);
        const memberSnap = await getDoc(memberRef);

        let targetRole: WorkspaceRole = 'Guest'; // Default for new project-only joins

        if (memberSnap.exists()) {
            const existing = memberSnap.data();
            targetRole = existing.role || 'Guest';
        }

        // Ensure user exists in global users collection
        await setDoc(
            userDocRef(user.uid),
            {
                uid: user.uid,
                email: user.email || "",
                displayName: user.displayName || "User",
                photoURL: user.photoURL || "",
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );

        // Add membership to tenant
        await setDoc(
            memberRef,
            {
                uid: user.uid,
                role: targetRole,
                joinedAt: memberSnap.exists() ? (memberSnap.data().joinedAt || serverTimestamp()) : serverTimestamp(),
            },
            { merge: true }
        );

        await logActivity(
            projectId,
            { action: `${user.displayName || "User"} joined the project`, target: "Team", type: "status", user: user.displayName || "User" },
            tenantId
        );

        // Notify project owner
        if (data.ownerId !== user.uid) {
            await notifyProjectInvite(data.ownerId, data.title || 'Project', projectId, tenantId);
        }
    }
};

export const getProjectMembers = async (projectId: string, tenantId?: string): Promise<string[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const project = await getProjectById(projectId, resolvedTenant);
    if (!project || !project.members) return [];

    // Handle mixed format: some elements might be strings, others might be ProjectMember objects
    return project.members
        .filter((m: any) => m !== null && m !== undefined)
        .map((member: string | ProjectMember) => {
            if (typeof member === 'string') {
                // Legacy format: plain UID string
                return member;
            }
            // New format: ProjectMember object
            return member.userId;
        });
};

/**
 * Get all project members that have a specific role
 */
export const getMembersWithRole = async (projectId: string, roleId: string, tenantId?: string): Promise<string[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const project = await getProjectById(projectId, resolvedTenant);
    if (!project?.roles) return [];

    return Object.entries(project.roles)
        .filter(([_, role]) => role === roleId)
        .map(([userId]) => userId);
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
    newRole: ProjectRole | string,
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
        { action: `Updated ${userId} 's role to ${newRole}`, target: "Team", type: "status" },
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
    console.log('Current members:', members);
    console.log('Removing userId:', userId);

    // Filter out the member - handle both legacy string[] and new ProjectMember[] formats
    const updatedMembers = members.filter(m => {
        const memberId = typeof m === 'string' ? m : m.userId;
        return memberId !== userId;
    });

    console.log('Updated members:', updatedMembers);

    await updateDoc(projectRef, {
        members: updatedMembers as any,
        memberIds: arrayRemove(userId),
        updatedAt: serverTimestamp()
    });

    console.log('Member removed successfully');
};

/**
 * Generate a shareable invite link for a project
 */
export const generateInviteLink = async (
    projectId: string,
    role: ProjectRole | string,
    maxUses?: number,
    expiresInHours: number = 24,
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);

    // Verify user has permission to invite
    const project = await getProjectById(projectId, resolvedTenant);
    if (!project) throw new Error("Project not found");
    if (project.ownerId !== user.uid) {
        throw new Error("Only the project owner can create invite links");
    }

    // Create invite link document
    const inviteLinksRef = collection(db, `tenants/${resolvedTenant}/projects/${projectId}/inviteLinks`);
    const inviteLink = {
        projectId,
        role,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
        maxUses: maxUses || null,
        uses: 0,
        isActive: true
    };

    const docRef = await addDoc(inviteLinksRef, inviteLink);

    // Generate URL
    const base = window.location.origin;
    return `${base}/join/${docRef.id}?projectId=${projectId}&tenantId=${resolvedTenant}`;
};

/**
 * Validate and use an invite link
 */
export const validateInviteLink = async (
    inviteLinkId: string,
    projectId: string,
    tenantId: string
): Promise<ProjectRole> => {
    const inviteLinkRef = doc(db, `tenants/${tenantId}/projects/${projectId}/inviteLinks`, inviteLinkId);
    const inviteLinkDoc = await getDoc(inviteLinkRef);

    if (!inviteLinkDoc.exists()) {
        throw new Error("Invalid invite link");
    }

    const linkData = inviteLinkDoc.data();

    // Check if link is active
    if (!linkData.isActive) {
        throw new Error("This invite link has been disabled");
    }

    // Check expiration
    const expiresAt = linkData.expiresAt?.toDate?.() || new Date(linkData.expiresAt);
    if (expiresAt < new Date()) {
        throw new Error("This invite link has expired");
    }

    // Check max uses
    if (linkData.maxUses && linkData.uses >= linkData.maxUses) {
        throw new Error("This invite link has reached its maximum number of uses");
    }

    return linkData.role as ProjectRole;
};

/**
 * Join a project using an invite link
 */
export const joinProjectViaLink = async (
    inviteLinkId: string,
    projectId: string,
    tenantId: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // Validate the link and get the role
    const role = await validateInviteLink(inviteLinkId, projectId, tenantId);

    // Add user to project
    const projectRef = doc(db, `tenants/${tenantId}/projects`, projectId);
    const projectDoc = await getDoc(projectRef);

    if (!projectDoc.exists()) {
        throw new Error("Project not found");
    }

    const data = projectDoc.data();
    const members = data.members || [];

    // Check if already a member
    // Support both legacy string[] and new ProjectMember[] formats
    const isMember = typeof members[0] === 'string'
        ? members.includes(user.uid)
        : (members as ProjectMember[]).some((m: any) => m.userId === user.uid);

    if (isMember) {
        throw new Error("You are already a member of this project");
    }

    const newMember: ProjectMember = {
        userId: user.uid,
        role,
        joinedAt: new Date(), // Cannot use serverTimestamp() inside arrays
        invitedBy: "link", // Special marker
    };

    await updateDoc(projectRef, {
        members: [...members, newMember],
        memberIds: arrayUnion(user.uid) // Also add to memberIds for efficient querying
    });

    // Also ensure the user is added to the tenant users list (as a viewer or basic user)
    // This is implicitly handled by ensureTenantAndUser but valid to reinforce here for metadata
    await setDoc(doc(db, `tenants/${tenantId}/users`, user.uid), {
        uid: user.uid,
        displayName: user.displayName || 'User',
        email: user.email,
        photoURL: user.photoURL,
        joinedAt: serverTimestamp(),
        lastActive: serverTimestamp()
    }, { merge: true });

    // Increment link usage
    const inviteLinkRef = doc(db, `tenants/${tenantId}/projects/${projectId}/inviteLinks`, inviteLinkId);
    await updateDoc(inviteLinkRef, {
        uses: increment(1)
    });

    await logActivity(
        projectId,
        { action: `${user.displayName || "User"} joined the project`, target: "Team", type: "status", user: user.displayName || "User" },
        tenantId
    );
};

// --- User Management ---

export const getUsersByIds = async (userIds: string[], tenantId?: string): Promise<Member[]> => {
    if (!userIds || userIds.length === 0) return [];

    // Chunk the IDs into groups of 10 to avoid query limits
    const chunks = [];
    for (let i = 0; i < userIds.length; i += 10) {
        chunks.push(userIds.slice(i, i + 10));
    }

    const members: Member[] = [];

    for (const chunk of chunks) {
        // Try global users collection first as it's the source of truth for profiles
        const q = query(collection(db, USERS), where(documentId(), "in", chunk));
        const snapshot = await getDocs(q);

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            members.push({
                uid: doc.id,
                email: data.email,
                displayName: data.displayName || 'Unknown User',
                photoURL: data.photoURL,
                // ... map other fields if needed
            } as Member);
        });
    }

    return members;
};

/**
 * Send an email invitation directly
 */
export const sendTeamInvitation = async (
    email: string,
    type: 'workspace' | 'project',
    targetId: string, // tenantId or projectId
    role: string,
    tenantId: string
): Promise<void> => {
    const sendInviteFn = httpsCallable(functions, 'sendInvitation');

    // If calling from existing "invite to project" UI, targetId is projectId.
    // If "invite to workspace", targetId is tenantId.

    await sendInviteFn({
        email,
        type,
        targetId,
        role,
        tenantId
    });
};

// --- Workspace Invites ---

/**
 * Generate a shareable invite link for a workspace
 */
export const generateWorkspaceInviteLink = async (
    role: WorkspaceRole = 'Member',
    maxUses?: number,
    expiresInHours: number = 24,
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);

    // Create invite link document in tenant root
    const inviteLinksRef = collection(db, `tenants/${resolvedTenant}/inviteLinks`);
    const inviteLink = {
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
        maxUses: maxUses || null,
        uses: 0,
        role, // Store role
        isActive: true
    };

    const docRef = await addDoc(inviteLinksRef, inviteLink);

    // Generate URL
    const base = window.location.origin;
    return `${base}/join-workspace/${docRef.id}?tenantId=${resolvedTenant}`;
};

/**
 * Validate and use a workspace invite link
 */
export const validateWorkspaceInviteLink = async (
    inviteLinkId: string,
    tenantId: string
): Promise<WorkspaceRole> => {
    const inviteLinkRef = doc(db, `tenants/${tenantId}/inviteLinks`, inviteLinkId);
    const inviteLinkDoc = await getDoc(inviteLinkRef);

    if (!inviteLinkDoc.exists()) {
        throw new Error("Invalid invite link");
    }

    const linkData = inviteLinkDoc.data();

    if (!linkData.isActive) throw new Error("This invite link has been disabled");

    const expiresAt = linkData.expiresAt?.toDate?.() || new Date(linkData.expiresAt);
    if (expiresAt < new Date()) throw new Error("This invite link has expired");

    if (linkData.maxUses && linkData.uses >= linkData.maxUses) {
        throw new Error("This invite link has reached its maximum number of uses");
    }

    return (linkData.role || 'Member') as WorkspaceRole;
};

/**
 * Join a workspace using an invite link
 */
export const joinWorkspaceViaLink = async (
    inviteLinkId: string,
    tenantId: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // Validate and get role
    const role = await validateWorkspaceInviteLink(inviteLinkId, tenantId);

    // Join with assigned role
    await joinTenant(tenantId, role);

    // Increment usage
    const inviteLinkRef = doc(db, `tenants/${tenantId}/inviteLinks`, inviteLinkId);
    await updateDoc(inviteLinkRef, {
        uses: increment(1)
    });
};

export const getWorkspaceInviteLinks = async (tenantId?: string): Promise<any[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const inviteLinksRef = collection(db, `tenants/${resolvedTenant}/inviteLinks`);

    // Fetch active links - Sorting client side to avoid index requirement
    const q = query(inviteLinksRef, where('isActive', '==', true));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const revokeWorkspaceInviteLink = async (inviteLinkId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const inviteLinkRef = doc(db, `tenants/${resolvedTenant}/inviteLinks`, inviteLinkId);
    await updateDoc(inviteLinkRef, { isActive: false });
};

export const getProjectInviteLinks = async (projectId: string, tenantId?: string): Promise<any[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const inviteLinksRef = collection(db, `tenants/${resolvedTenant}/projects/${projectId}/inviteLinks`);

    // Fetch active links - Sorting client side to avoid index requirement
    const q = query(inviteLinksRef, where('isActive', '==', true));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const revokeProjectInviteLink = async (projectId: string, inviteLinkId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const inviteLinkRef = doc(db, `tenants/${resolvedTenant}/projects/${projectId}/inviteLinks`, inviteLinkId);
    await updateDoc(inviteLinkRef, { isActive: false });
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
        .filter(p => !p.isPersonal)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const getOrCreatePersonalProject = async (tenantId?: string): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = tenantId || getCachedTenantId() || user.uid;
    await ensureTenantAndUser(resolvedTenant);

    // 1. Try to find existing personal project
    const q = query(
        projectsCollection(resolvedTenant),
        where("ownerId", "==", user.uid),
        where("isPersonal", "==", true)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        return snapshot.docs[0].id;
    }

    // 2. Create if not exists
    return await createProject({
        title: "Personal Tasks",
        description: "Private tasks not associated with a specific project",
        isPersonal: true,
        isPrivate: true,
        status: 'Active'
    }, undefined, undefined, undefined, [], resolvedTenant);
};

/**
 * Get all projects in the workspace (not just user-owned) for search purposes
 */
export const getAllWorkspaceProjects = async (tenantId?: string): Promise<Project[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const resolvedTenant = tenantId || getCachedTenantId() || user.uid;
    await ensureTenantAndUser(resolvedTenant);

    const snapshot = await getDocs(projectsCollection(resolvedTenant));
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Project))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

/**
 * Get all tasks across all projects in the workspace for search purposes
 */
export const getAllWorkspaceTasks = async (tenantId?: string): Promise<Task[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const resolvedTenant = tenantId || getCachedTenantId() || user.uid;
    await ensureTenantAndUser(resolvedTenant);

    // Get all projects first
    const projects = await getAllWorkspaceProjects(resolvedTenant);

    // Fetch tasks for all projects
    const taskPromises = projects.map(async p => {
        try {
            const projectTasks = await getProjectTasks(p.id, p.tenantId);
            return projectTasks.map(t => ({ ...t, tenantId: p.tenantId }));
        } catch (e) {
            console.warn(`Failed to fetch tasks for project ${p.id}`, e);
            return [];
        }
    });

    const results = await Promise.all(taskPromises);
    return results.flat();
};




/**
 * Get all issues across all projects in the workspace for search purposes
 */
export const getAllWorkspaceIssues = async (tenantId?: string): Promise<Issue[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const resolvedTenant = tenantId || getCachedTenantId() || user.uid;
    await ensureTenantAndUser(resolvedTenant);

    // Get all projects first
    const projects = await getAllWorkspaceProjects(resolvedTenant);

    const issuePromises = projects.map(async p => {
        try {
            const snapshot = await getDocs(projectSubCollection(resolvedTenant, p.id, ISSUES));
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                tenantId: p.tenantId, // Ensure tenantId is set
                projectId: p.id       // Ensure projectId is set
            } as Issue));
        } catch (e) {
            console.warn(`Failed to fetch issues for project ${p.id}`, e);
            return [];
        }
    });

    const results = await Promise.all(issuePromises);
    return results.flat();
};

/**
 * Get all ideas across all projects in the workspace for search purposes
 */
export const getAllWorkspaceIdeas = async (tenantId?: string): Promise<Idea[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const resolvedTenant = tenantId || getCachedTenantId() || user.uid;
    await ensureTenantAndUser(resolvedTenant);

    // Get all projects first
    const projects = await getAllWorkspaceProjects(resolvedTenant);

    const ideaPromises = projects.map(async p => {
        try {
            const snapshot = await getDocs(projectSubCollection(resolvedTenant, p.id, "ideas"));
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                tenantId: p.tenantId,
                projectId: p.id
            } as Idea));
        } catch (e) {
            console.warn(`Failed to fetch ideas for project ${p.id}`, e);
            return [];
        }
    });

    const results = await Promise.all(ideaPromises);
    return results.flat();
};

// --- Tasks ---

const ensureCategory = async (projectId: string, name?: string | string[], tenantId?: string, color?: string) => {
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
            color: color || '#64748b', // Default slate-500
            createdAt: serverTimestamp()
        });
    }
};

export const addProjectCategory = async (projectId: string, name: string, color: string, tenantId?: string) => {
    const user = auth.currentUser;
    const resolvedTenant = resolveTenantId(tenantId);
    const categoriesRef = projectSubCollection(resolvedTenant, projectId, CATEGORIES);

    // Check if exists
    const q = query(categoriesRef, where("normalized", "==", name.toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) throw new Error("Label already exists");

    await addDoc(categoriesRef, {
        projectId,
        tenantId: resolvedTenant,
        ownerId: user?.uid || "",
        name,
        normalized: name.toLowerCase(),
        color,
        createdAt: serverTimestamp()
    });
};

export const updateProjectCategory = async (projectId: string, categoryId: string, updates: Partial<Pick<TaskCategory, 'name' | 'color'>>, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const docRef = doc(projectSubCollection(resolvedTenant, projectId, CATEGORIES), categoryId);

    const data: any = { ...updates };
    if (updates.name) {
        data.normalized = updates.name.toLowerCase();
    }

    await updateDoc(docRef, data);
};

export const deleteProjectCategory = async (projectId: string, categoryId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(projectSubCollection(resolvedTenant, projectId, CATEGORIES), categoryId));
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
    extra?: Partial<Pick<Task, 'description' | 'category' | 'status' | 'assigneeId' | 'assigneeIds' | 'assignedGroupIds' | 'linkedIssueId' | 'convertedIdeaId' | 'startDate'>>,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const taskData: any = {
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        title,
        isCompleted: false,
        dueDate: dueDate || "",
        startDate: extra?.startDate || "",
        assignee: assignee || "",
        priority,
        description: extra?.description || "",
        category: extra?.category || [],
        status: extra?.status || "Open",
        assigneeId: extra?.assigneeId || (user.uid === assignee ? user.uid : null),
        assigneeIds: extra?.assigneeIds || (extra?.assigneeId ? [extra.assigneeId] : []),
        assignedGroupIds: extra?.assignedGroupIds || [],
        createdBy: user.uid,
        createdAt: serverTimestamp()
    };

    // Add linked issue if converting from an issue
    if (extra?.linkedIssueId) {
        taskData.linkedIssueId = extra.linkedIssueId;
    }

    // Add linked idea if converting from an idea
    if (extra?.convertedIdeaId) {
        taskData.convertedIdeaId = extra.convertedIdeaId;
    }

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, TASKS), taskData);
    await ensureCategory(projectId, extra?.category, resolvedTenant);
    await logActivity(projectId, { action: `Added task "${title}"`, target: "Tasks", type: "task", relatedId: docRef.id }, resolvedTenant);

    // Sync progress
    await syncProjectProgress(projectId, resolvedTenant);

    // Send notifications to assignees
    const assigneeIds = extra?.assigneeIds || (extra?.assigneeId ? [extra.assigneeId] : []);
    for (const assigneeId of assigneeIds) {
        if (assigneeId && assigneeId !== user.uid) {
            await notifyTaskAssignment(assigneeId, title, projectId, docRef.id, resolvedTenant);
        }
    }

    return docRef.id;
};

export const createSubTask = async (
    projectId: string,
    taskId: string,
    title: string,
    assigneeId?: string,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);

    const taskRef = doc(projectSubCollection(resolvedTenant, projectId, TASKS), taskId);
    const subTasksRef = collection(taskRef, SUBTASKS);

    const subTaskData = {
        taskId,
        projectId,
        ownerId: user.uid,
        title,
        isCompleted: false,
        assigneeId: assigneeId || null,
        createdAt: serverTimestamp()
    };

    const docRef = await addDoc(subTasksRef, subTaskData);

    await logActivity(
        projectId,
        { action: `Added subtask "${title}"`, target: "Tasks", type: "task", relatedId: taskId },
        resolvedTenant
    );

    if (assigneeId && assigneeId !== user.uid) {
        await notifySubtaskAssignment(assigneeId, title, projectId, taskId, docRef.id, resolvedTenant);
    }

    return docRef.id;
};

/**
 * Sync project progress based on task completion
 */
export const syncProjectProgress = async (projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, TASKS));
    const tasks = snapshot.docs.map(d => d.data() as Task);

    if (tasks.length === 0) {
        await updateDoc(projectDocRef(resolvedTenant, projectId), { progress: 0 });
        return;
    }

    const completedCount = tasks.filter(t => t.isCompleted || t.status === 'Done').length;
    const progress = Math.round((completedCount / tasks.length) * 100);

    await updateDoc(projectDocRef(resolvedTenant, projectId), {
        progress,
        updatedAt: serverTimestamp() // Force update to trigger UI re-fetch if needed
    });
};

export const getTaskById = async (taskId: string, projectId?: string, tenantId?: string): Promise<Task | null> => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (taskSnap?.exists()) {
        const { tenantId: extractedTenantId, projectId: extractedProjectId } = getProjectContextFromRef(taskSnap.ref);
        return {
            id: taskSnap.id,
            tenantId: extractedTenantId,
            projectId: extractedProjectId,
            ...taskSnap.data()
        } as Task;
    }
    return null;
};

export const getProjectTasks = async (projectId: string, tenantId?: string): Promise<Task[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, TASKS));
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data(), path: docSnap.ref.path } as unknown as Task))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const getUserTasks = async (): Promise<Task[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    try {
        // Fetch accessible projects efficiently (Owned + Shared)
        // We reuse the existing functions which use filtered queries compatible with security rules.
        const [myProjects, sharedProjects] = await Promise.all([
            getUserProjects(),
            getSharedProjects()
        ]);

        // Deduplicate in case of overlap (though logically distinct usually)
        const allProjects = [...myProjects, ...sharedProjects];
        const uniqueProjects = Array.from(new Map(allProjects.map(p => [p.id, p])).values());

        const taskPromises = uniqueProjects.map(async p => {
            try {
                const projectTasks = await getProjectTasks(p.id, p.tenantId);
                return projectTasks.map(t => ({ ...t, tenantId: p.tenantId }));
            } catch (e) {
                console.warn(`Failed to fetch tasks for project ${p.id}`, e);
                return [];
            }
        });

        const results = await Promise.all(taskPromises);
        const allTasks = results.flat();

        // Client-side filtering for assignment (Business Logic)
        return allTasks.filter(t =>
            t.assigneeId === user.uid ||
            (t.assigneeIds && t.assigneeIds.includes(user.uid)) ||
            (t.ownerId === user.uid && !t.assigneeId && (!t.assigneeIds || t.assigneeIds.length === 0))
        );
    } catch (error) {
        console.error("getUserTasks failed", error);
        return [];
    }
};

export const getUnassignedTasks = async (): Promise<Task[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const tenantId = resolveTenantId();
    const projectsRef = projectsCollection(tenantId);
    let allProjects: Project[] = [];
    try {
        const snap = await getDocs(projectsRef);
        allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
    } catch (e) {
        console.warn("Failed to fetch projects for unassigned tasks", e);
    }

    const relevantProjects = allProjects.filter(p => p.memberIds?.includes(user.uid) || p.ownerId === user.uid);

    const taskPromises = relevantProjects.map(async p => {
        try {
            const projectTasks = await getProjectTasks(p.id, p.tenantId);
            return projectTasks.map(t => ({ ...t, tenantId: p.tenantId }));
        } catch (e) {
            return [];
        }
    });

    const results = await Promise.all(taskPromises);
    const allTasks = results.flat();

    // Unassigned means no assigneeId and no assigneeIds
    return allTasks.filter(t => !t.assigneeId && (!t.assigneeIds || t.assigneeIds.length === 0));
};

export const getUsersTasks = async (userIds: string[]): Promise<Task[]> => {
    if (!userIds || userIds.length === 0) return [];

    const tenantId = resolveTenantId();
    const projectsRef = projectsCollection(tenantId);
    let allProjects: Project[] = [];
    try {
        const snap = await getDocs(projectsRef);
        allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
    } catch (e) {
        console.warn("Failed to fetch projects for team tasks", e);
    }

    // We only care about projects where at least one of the target users is a member
    const relevantProjects = allProjects.filter(p =>
        p.ownerId && userIds.includes(p.ownerId) ||
        (p.memberIds && p.memberIds.some(uid => userIds.includes(uid)))
    );

    const taskPromises = relevantProjects.map(async p => {
        try {
            const projectTasks = await getProjectTasks(p.id, p.tenantId);
            return projectTasks.map(t => ({ ...t, tenantId: p.tenantId }));
        } catch (e) {
            return [];
        }
    });

    const results = await Promise.all(taskPromises);
    const allTasks = results.flat();

    // Filter to tasks assigned to ANY of the given user IDs
    return allTasks.filter(t =>
        (t.assigneeId && userIds.includes(t.assigneeId)) ||
        (t.assigneeIds && t.assigneeIds.some(uid => userIds.includes(uid)))
    );
};

export const updateTask = async (
    taskId: string,
    updates: Partial<Task>,
    projectId?: string,
    tenantId?: string,
    path?: string
) => {
    // Robustly find task doc, handling stale tenantId/projectId if needed
    // First try path if available
    if (path) {
        const ref = doc(db, path);
        await updateDoc(ref, updates);
        return;
    }

    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error("Task not found");

    await updateDoc(taskSnap.ref, updates);
};

export const toggleTaskStatus = async (taskId: string, currentStatus: boolean, projectId?: string, tenantId?: string) => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error("Task not found");

    const newStatus = !currentStatus;
    const user = auth.currentUser;
    const updateData: any = { isCompleted: newStatus };

    if (newStatus) {
        updateData.completedBy = user?.uid;
        updateData.completedAt = serverTimestamp();
    } else {
        updateData.completedBy = deleteField();
        updateData.completedAt = deleteField();
    }

    await updateDoc(taskSnap.ref, updateData);
    const data = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);
    await logActivity(
        data.projectId,
        { action: `${newStatus ? "Completed" : "Reopened"} task "${data.title}"`, target: "Tasks", type: "task", relatedId: taskId },
        resolvedTenant
    );
    await syncProjectProgress(data.projectId, resolvedTenant);

    // Sync linked issue status if this task was converted from an issue
    if (data.linkedIssueId) {
        try {
            const issueRef = doc(projectSubCollection(resolvedTenant, data.projectId, ISSUES), data.linkedIssueId);
            const newIssueStatus = newStatus ? 'Resolved' : 'Open';
            await updateDoc(issueRef, { status: newIssueStatus });
            await logActivity(
                data.projectId,
                { action: `Auto-${newStatus ? "resolved" : "reopened"} linked issue`, target: "Issues", type: "status" },
                resolvedTenant
            );
        } catch (e) {
            console.warn("Failed to sync linked issue status", e);
        }
    }
};

export const updateTaskFields = async (taskId: string, updates: Partial<Task>, projectId?: string, tenantId?: string) => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error("Task not found");
    const oldData = taskSnap.data() as Task;
    const sanitized: Record<string, any> = {};
    Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
            sanitized[key] = deleteField();
        } else if (value !== undefined) {
            sanitized[key] = value;
        }
    });

    if (sanitized.isCompleted !== undefined) {
        const user = auth.currentUser;
        if (sanitized.isCompleted === true) {
            sanitized.completedBy = user?.uid;
            sanitized.completedAt = serverTimestamp();
        } else {
            sanitized.completedBy = deleteField();
            sanitized.completedAt = deleteField();
        }
    }

    if (Object.keys(sanitized).length === 0) return;

    await updateDoc(taskSnap.ref, sanitized);
    const data = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);
    let action = `Updated task "${data.title}"`;
    if (sanitized.isCompleted === true) {
        action = `Completed task "${data.title}"`;
    } else if (sanitized.isCompleted === false) {
        action = `Reopened task "${data.title}"`;
    }

    await logActivity(
        data.projectId,
        { action, target: "Tasks", type: "task", relatedId: taskId },
        resolvedTenant
    );
    if (sanitized.category) {
        await ensureCategory(data.projectId, sanitized.category, resolvedTenant);
    }
    if (sanitized.isCompleted !== undefined || sanitized.status !== undefined) {
        await syncProjectProgress(data.projectId, resolvedTenant);
    }

    // Notify newly assigned users
    if (sanitized.assigneeIds) {
        const oldAssignees = oldData.assigneeIds || [];
        const newAssignees = sanitized.assigneeIds || [];
        const addedAssignees = newAssignees.filter((id: string) => !oldAssignees.includes(id));
        for (const assigneeId of addedAssignees) {
            await notifyTaskAssignment(assigneeId, data.title, data.projectId, taskId, resolvedTenant);
        }
    } else if (sanitized.assigneeId && sanitized.assigneeId !== oldData.assigneeId) {
        await notifyTaskAssignment(sanitized.assigneeId, data.title, data.projectId, taskId, resolvedTenant);
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
        { action: `Deleted task "${data.title}"`, target: "Tasks", type: "task", relatedId: taskId },
        resolvedTenant
    );
    await syncProjectProgress(data.projectId, resolvedTenant);
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
    await logActivity(task.projectId, { action: `Added subtask "${title}"`, target: task.title, type: "task", relatedId: taskId }, resolvedTenant);
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
    const user = auth.currentUser;
    const isNowCompleted = !currentStatus;

    await updateDoc(subSnap.ref, {
        isCompleted: isNowCompleted,
        completedBy: isNowCompleted ? user?.uid : deleteField(),
        completedAt: isNowCompleted ? serverTimestamp() : deleteField()
    });

    const data = subSnap.data() as SubTask | undefined;
    if (!data) return;
    const taskSnap = await findTaskDoc(data.taskId, projectId, tenantId);
    const parentTask = taskSnap?.data() as Task | undefined;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(subSnap.ref);
    if (parentTask) {
        await logActivity(
            parentTask.projectId,
            { action: `${!currentStatus ? "Completed" : "Reopened"} subtask "${data.title}"`, target: parentTask.title, type: "task", relatedId: data.taskId },
            resolvedTenant
        );
    }
};

export const deleteSubTask = async (subTaskId: string, taskId: string, projectId?: string, tenantId?: string) => {
    const subSnap = await findSubtaskDoc(subTaskId, taskId, projectId, tenantId);
    if (!subSnap) return;

    const data = subSnap.data() as SubTask;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(subSnap.ref);

    await deleteDoc(subSnap.ref);
    await logActivity(
        data.projectId,
        { action: `Deleted subtask "${data.title}"`, target: "Tasks", type: "task", relatedId: data.taskId }, // context might differ but this works
        resolvedTenant
    );
};

export const updateSubtaskFields = async (
    subTaskId: string,
    updates: Partial<SubTask>,
    taskId?: string,
    projectId?: string,
    tenantId?: string
) => {
    const subSnap = await findSubtaskDoc(subTaskId, taskId, projectId, tenantId);
    if (!subSnap) throw new Error("Subtask not found");
    const oldData = subSnap.data() as SubTask;
    await updateDoc(subSnap.ref, updates);

    // Notify if assignee changed
    if (updates.assigneeId && updates.assigneeId !== oldData.assigneeId) {
        const taskSnap = await findTaskDoc(oldData.taskId, projectId, tenantId);
        const task = taskSnap?.data() as Task | undefined;
        if (task) {
            await notifySubtaskAssignment(
                updates.assigneeId,
                oldData.title,
                task.title,
                task.projectId,
                oldData.taskId,
                tenantId
            );
        }
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
    if (!ideaSnap) throw new Error("Flow not found");
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
        .map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as Idea))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const getProjectIdeas = async (projectId: string, tenantId?: string): Promise<Idea[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, IDEAS));
    return snapshot.docs
        .map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as Idea))
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
        .slice(0, 100);
};

export const subscribeTaskActivity = (projectId: string, taskId: string, callback: (activities: Activity[]) => void, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, ACTIVITIES),
        where("relatedId", "==", taskId),
        orderBy("createdAt", "desc"),
        limit(20)
    );
    return onSnapshot(q, (snapshot) => {
        const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
        callback(activities);
    });
};

// --- Issues ---

export const createIssue = async (projectId: string, issue: Partial<Issue>, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const issueData: any = {
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        title: issue.title || "Untitled Issue",
        description: issue.description || "",
        status: issue.status || "Open",
        priority: issue.priority || "Medium",
        reporter: user.displayName || "User",
        assignee: issue.assignee || "",
        assigneeId: issue.assigneeId || null,
        assigneeIds: issue.assigneeIds || (issue.assigneeId ? [issue.assigneeId] : []),
        assignedGroupIds: issue.assignedGroupIds || [],
        reporterId: user.uid,
        createdBy: user.uid,
        createdAt: serverTimestamp()
    };

    // GitHub Sync
    try {
        const project = await getProjectById(projectId, resolvedTenant);
        if (project?.githubIssueSync && project.githubRepo) {
            // Get token: project-level or user-level
            let githubToken = project.githubToken;
            if (!githubToken && user.uid) {
                const profile = await getUserProfile(user.uid, resolvedTenant);
                githubToken = profile?.githubToken;
            }

            if (githubToken) {
                const ghIssue = await createGithubIssue(
                    project.githubRepo,
                    githubToken,
                    issueData.title,
                    issueData.description || "Created via ProjectFlow"
                );
                issueData.githubIssueUrl = ghIssue.url;
                issueData.githubIssueNumber = ghIssue.number;
            }
        }
    } catch (e) {
        console.warn("GitHub issue sync failed", e);
    }

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, ISSUES), issueData);

    await logActivity(projectId, { action: `Reported issue "${issue.title}"`, target: "Issues", type: "report" }, resolvedTenant);

    return docRef.id;
};

const findIssueDoc = async (issueId: string, projectId?: string, tenantId?: string, path?: string) => {
    if (path) {
        const ref = doc(db, path);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap;
    }

    if (projectId) {
        const resolvedTenant = resolveTenantId(tenantId);
        const ref = doc(projectSubCollection(resolvedTenant, projectId, ISSUES), issueId);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap;
    }

    // Fallback: global collectionGroup search
    const cg = collectionGroup(db, ISSUES);
    const snapshot = await getDocs(cg);
    return snapshot.docs.find(d => d.id === issueId) || null;
};

export const getProjectIssues = async (projectId: string, tenantId?: string): Promise<Issue[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, ISSUES));
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Issue))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const getIssueById = async (issueId: string, projectId?: string, tenantId?: string): Promise<Issue | null> => {
    const issueSnap = await findIssueDoc(issueId, projectId, tenantId);
    if (issueSnap?.exists()) {
        const { tenantId: extractedTenantId, projectId: extractedProjectId } = getProjectContextFromRef(issueSnap.ref);
        return {
            id: issueSnap.id,
            tenantId: extractedTenantId,
            projectId: extractedProjectId,
            ...issueSnap.data()
        } as Issue;
    }
    return null;
};


export const updateIssue = async (issueId: string, updates: Partial<Issue>, projectId: string, tenantId?: string, path?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    let issueData: Issue | null = null;
    let issueRef: any = null;

    if (updates.status) {
        const user = auth.currentUser;
        if (updates.status === 'Resolved' || updates.status === 'Closed') {
            (updates as any).completedBy = user?.uid;
            (updates as any).completedAt = serverTimestamp();
        } else if (updates.status === 'Open' || updates.status === 'In Progress') {
            (updates as any).completedBy = deleteField();
            (updates as any).completedAt = deleteField();
        }
    }

    // First try path if available
    if (path) {
        issueRef = doc(db, path);
        const snap = await getDoc(issueRef);
        if (snap.exists()) {
            issueData = { id: snap.id, ...snap.data() } as Issue;
        }
        await updateDoc(issueRef, updates);
    } else {
        const issueSnap = await findIssueDoc(issueId, projectId, tenantId);
        if (!issueSnap) throw new Error("Issue not found or access denied");
        issueData = { id: issueSnap.id, ...issueSnap.data() } as Issue;
        issueRef = issueSnap.ref;
        await updateDoc(issueRef, updates);
    }

    if (issueData) {
        let action = `Updated issue "${issueData.title}"`;
        if (updates.status === 'Resolved' || updates.status === 'Closed') {
            action = `Resolved issue "${issueData.title}"`;
        } else if ((updates.status === 'Open' || updates.status === 'In Progress') &&
            (issueData.status === 'Resolved' || issueData.status === 'Closed')) {
            action = `Reopened issue "${issueData.title}"`;
        }

        await logActivity(
            projectId,
            { action, target: "Issues", type: "issue" },
            resolvedTenant
        );
    }

    // GitHub Sync (Status, Title, Description)
    if (issueData?.githubIssueNumber && (updates.status || updates.title || updates.description)) {
        try {
            const project = await getProjectById(projectId, resolvedTenant);
            if (project?.githubIssueSync && project.githubRepo) {
                const user = auth.currentUser;
                let githubToken = project.githubToken;
                if (!githubToken && user?.uid) {
                    const profile = await getUserProfile(user.uid, resolvedTenant);
                    githubToken = profile?.githubToken;
                }

                if (githubToken) {
                    const githubUpdates: any = {};
                    if (updates.status) {
                        githubUpdates.state = (updates.status === 'Resolved' || updates.status === 'Closed') ? 'closed' : 'open';
                    }
                    if (updates.title) {
                        githubUpdates.title = updates.title;
                    }
                    if (updates.description) {
                        githubUpdates.body = updates.description;
                    }

                    if (Object.keys(githubUpdates).length > 0) {
                        await updateGithubIssue(project.githubRepo, githubToken, issueData.githubIssueNumber, githubUpdates);
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to sync changes to GitHub", e);
        }
    }

    // Sync linked task status if this issue has a linked task
    if (issueData?.linkedTaskId && updates.status) {
        const isClosing = updates.status === 'Resolved' || updates.status === 'Closed';
        const isReopening = updates.status === 'Open' || updates.status === 'In Progress';

        if (isClosing || isReopening) {
            try {
                const taskRef = doc(projectSubCollection(resolvedTenant, projectId, TASKS), issueData.linkedTaskId);
                const taskSnap = await getDoc(taskRef);
                if (taskSnap.exists()) {
                    const taskData = taskSnap.data() as Task;
                    // Only update if status differs to avoid infinite loops
                    const shouldComplete = isClosing && !taskData.isCompleted;
                    const shouldReopen = isReopening && taskData.isCompleted;

                    if (shouldComplete || shouldReopen) {
                        await updateDoc(taskRef, {
                            isCompleted: isClosing,
                            status: isClosing ? 'Done' : 'Open'
                        });
                        await logActivity(
                            projectId,
                            { action: `Auto-${isClosing ? "completed" : "reopened"} linked task`, target: "Tasks", type: "task" },
                            resolvedTenant
                        );
                        await syncProjectProgress(projectId, resolvedTenant);
                    }
                }
            } catch (e) {
                console.warn("Failed to sync linked task status", e);
            }
        }
    }
};

export const deleteIssue = async (issueId: string, projectId: string, tenantId?: string, path?: string) => {
    const issueSnap = await findIssueDoc(issueId, projectId, tenantId, path);
    if (!issueSnap) return;
    const issueData = issueSnap.data() as Issue;

    // GitHub Sync: Close issue on delete
    if (issueData?.githubIssueNumber) {
        try {
            const resolvedTenant = resolveTenantId(tenantId);
            const project = await getProjectById(projectId, resolvedTenant);
            if (project?.githubIssueSync && project.githubRepo) {
                const user = auth.currentUser;
                let githubToken = project.githubToken;
                if (!githubToken && user?.uid) {
                    const profile = await getUserProfile(user.uid, resolvedTenant);
                    githubToken = profile?.githubToken;
                }

                if (githubToken) {
                    await updateGithubIssue(project.githubRepo, githubToken, issueData.githubIssueNumber, { state: 'closed' });
                }
            }
        } catch (e) {
            console.warn("Failed to close GitHub issue on delete", e);
        }
    }

    await deleteDoc(issueSnap.ref);
};

export const subscribeProjectIssues = (
    projectId: string,
    callback: (issues: Issue[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    // Don't call ensureTenantAndUser here - this is a read operation
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
    // Don't call ensureTenantAndUser here - this is a read operation
    return onSnapshot(projectSubCollection(resolvedTenant, projectId, TASKS), (snap) => {
        const items = snap.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Task))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        callback(items);
    });
};


// --- Presence ---

export const updatePresence = async (projectId: string, state: 'online' | 'idle' | 'offline', tenantId?: string) => {
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
            tenantId: resolvedTenant, // Add tenant ID for cross-reference
            lastChanged: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error("Failed to update presence", e);
    }
};


export const updateUserProfile = async (data: {
    displayName?: string,
    photoURL?: string,
    coverURL?: string,
    title?: string,
    bio?: string,
    address?: string,
    skills?: string[],
    privacySettings?: PrivacySettings,
    file?: File,
    coverFile?: File
}) => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user");

    let photoURL = data.photoURL || user.photoURL;
    let coverURL = data.coverURL;

    // Use tenant-scoped path if available to ensure we satisfy existing storage rules
    const tenantId = getCachedTenantId();

    if (data.file) {
        const path = tenantId
            ? `tenants/${tenantId}/users/${user.uid}/avatar_${Date.now()}`
            : `users/${user.uid}/avatar_${Date.now()}`;

        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, data.file);
        photoURL = await getDownloadURL(storageRef);
    }

    if (data.coverFile) {
        const path = tenantId
            ? `tenants/${tenantId}/users/${user.uid}/cover_${Date.now()}`
            : `users/${user.uid}/cover_${Date.now()}`;

        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, data.coverFile);
        coverURL = await getDownloadURL(storageRef);
    }

    if (data.displayName || photoURL) {
        await updateProfile(user, {
            displayName: data.displayName || user.displayName,
            photoURL: photoURL
        });
    }

    // Update global user profile
    const globalUserRef = userDocRef(user.uid);
    const updateData: any = {
        displayName: data.displayName || user.displayName,
        photoURL: photoURL,
        title: data.title ?? '',
        bio: data.bio ?? '',
        email: user.email,
        address: data.address ?? '',
        skills: data.skills ?? [],
        privacySettings: data.privacySettings || {},
        updatedAt: serverTimestamp()
    };
    if (coverURL) updateData.coverURL = coverURL;

    await setDoc(globalUserRef, updateData, { merge: true });

    return { photoURL, coverURL };
};

export const getUserProfileStats = async (uid: string, tenantId?: string) => {
    const tid = tenantId || getActiveTenantId();
    if (!tid) return { projects: 0, teams: 1 }; // Default to 1 team (current one)

    // Count projects where user is a member
    const projectsSnap = await getDocs(query(projectsCollection(tid), where('members', 'array_contains', uid)));
    // Note: This only counts projects in the current tenant. 
    // For a truly global count, we'd need to iterate all tenants or have a global index.

    // In this app, "Teams" usually corresponds to Tenants.
    // For now, let's fetch projects from the current tenant.
    const projectCount = projectsSnap.size;

    return {
        projects: projectCount,
        teams: 1 // Placeholder for multi-tenant count
    };
};

export const subscribeProjectPresence = (
    projectId: string,
    callback: (activeUsers: { uid: string, displayName: string, photoURL?: string, email?: string, state?: 'online' | 'idle' | 'busy' | 'offline', isOnline: boolean, isIdle?: boolean, isBusy?: boolean, lastChanged?: any }[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const OFFLINE_TIMEOUT = 2 * 60 * 1000; // 2 minutes - reduced from 5 minutes

    return onSnapshot(projectSubCollection(resolvedTenant, projectId, 'presence'), (snap) => {
        const now = Date.now();
        const users = snap.docs
            .map(d => d.data() as any)
            .filter(u => {
                // Include users who are online/idle/busy, or were active within timeout window
                const lastChangedMs = u.lastChanged ? toMillis(u.lastChanged) : 0;
                const timeSinceUpdate = now - lastChangedMs;
                return (u.state === 'online' || u.state === 'idle' || u.state === 'busy') && timeSinceUpdate < OFFLINE_TIMEOUT;
            })
            .map(u => ({
                ...u,
                isOnline: u.state === 'online',
                isIdle: u.state === 'idle',
                isBusy: u.state === 'busy'
            }));

        callback(users);
    });
};

// --- Workspace Presence ---

/**
 * Update the current user's presence at the workspace level (not project-specific)
 * This is stored in tenants/{tenantId}/presence/{userId}
 */
export const updateWorkspacePresence = async (state: 'online' | 'idle' | 'busy' | 'offline', tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const resolvedTenant = resolveTenantId(tenantId);

    const ref = doc(db, 'tenants', resolvedTenant, 'presence', user.uid);
    try {
        await setDoc(ref, {
            uid: user.uid,
            displayName: user.displayName || 'User',
            photoURL: user.photoURL || '',
            email: user.email || '',
            state,
            lastChanged: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error("Failed to update workspace presence", e);
    }
};

/**
 * Subscribe to all workspace members' presence
 * Returns only users who are online, idle, or busy within the timeout window
 */
export const subscribeWorkspacePresence = (
    callback: (activeUsers: { uid: string, displayName: string, photoURL?: string, email?: string, state?: 'online' | 'idle' | 'busy' | 'offline', isOnline: boolean, isIdle?: boolean, isBusy?: boolean, lastChanged?: any }[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const OFFLINE_TIMEOUT = 2 * 60 * 1000; // 2 minutes

    const presenceCollection = collection(db, 'tenants', resolvedTenant, 'presence');

    return onSnapshot(presenceCollection, (snap) => {
        const now = Date.now();
        const users = snap.docs
            .map(d => d.data() as any)
            .filter(u => {
                const lastChangedMs = u.lastChanged ? toMillis(u.lastChanged) : 0;
                const timeSinceUpdate = now - lastChangedMs;
                return (u.state === 'online' || u.state === 'idle' || u.state === 'busy') && timeSinceUpdate < OFFLINE_TIMEOUT;
            })
            .map(u => ({
                ...u,
                isOnline: u.state === 'online',
                isIdle: u.state === 'idle',
                isBusy: u.state === 'busy'
            }));

        callback(users);
    });
};

/**
 * Get all workspace members (distinct from project guests)
 * These are users who have been added to the tenant's members collection
 */
export const subscribeWorkspaceMembers = (
    callback: (members: { uid: string, displayName: string, photoURL?: string, email?: string, role?: string }[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);

    return onSnapshot(tenantMembersCollection(resolvedTenant), async (snap) => {
        const memberPromises = snap.docs.map(async (memberDoc) => {
            const membership = memberDoc.data();
            const userSnap = await getDoc(userDocRef(memberDoc.id));
            const userData = userSnap.exists() ? userSnap.data() : {};
            return {
                uid: memberDoc.id,
                displayName: userData.displayName || 'Unknown User',
                photoURL: userData.photoURL,
                email: userData.email,
                role: membership.role,
            };
        });
        const members = await Promise.all(memberPromises);
        callback(members);
    });
};

export const subscribeProject = (
    projectId: string,
    callback: (project: Project | null) => void,
    tenantId?: string
) => {
    // If tenantId is provided, subscribe directly
    if (tenantId) {
        ensureTenantAndUser(tenantId).catch(() => undefined);
        return onSnapshot(projectDocRef(tenantId, projectId), (snap) => {
            if (snap.exists()) {
                callback({ id: snap.id, tenantId, ...snap.data() } as Project);
            } else {
                callback(null);
            }
        });
    }

    // Otherwise, find the project first to get its tenant
    let unsubscribe: (() => void) | undefined;

    getProjectById(projectId).then((project) => {
        if (!project) {
            callback(null);
            return;
        }

        const projectTenantId = project.tenantId || resolveTenantId();
        ensureTenantAndUser(projectTenantId).catch(() => undefined);

        unsubscribe = onSnapshot(projectDocRef(projectTenantId, projectId), (snap) => {
            if (snap.exists()) {
                callback({ id: snap.id, tenantId: projectTenantId, ...snap.data() } as Project);
            } else {
                callback(null);
            }
        });
    }).catch((err) => {
        console.error("Failed to find project for subscription", err);
        callback(null);
    });

    return () => {
        if (unsubscribe) unsubscribe();
    };
};

export const subscribeProjectIdeas = (
    projectId: string,
    callback: (ideas: Idea[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    // Don't call ensureTenantAndUser here - this is a read operation
    return onSnapshot(projectSubCollection(resolvedTenant, projectId, IDEAS), (snap) => {
        const items = snap.docs
            .map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as Idea))
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
    // Don't call ensureTenantAndUser here - this is a read operation
    return onSnapshot(projectSubCollection(resolvedTenant, projectId, ACTIVITIES), (snap) => {
        const items = snap.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Activity))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
            .slice(0, 20);
        callback(items);
    });
};

export const subscribeTenantUsers = (
    callback: (users: { id: string; email?: string; displayName?: string; photoURL?: string; joinedAt?: any; role?: WorkspaceRole; groupIds?: string[] }[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    // Don't call ensureTenantAndUser here - this is a read operation and shouldn't create data
    return onSnapshot(tenantMembersCollection(resolvedTenant), async (snap) => {
        const userPromises = snap.docs.map(async (memberDoc) => {
            const membership = memberDoc.data();
            const userSnap = await getDoc(userDocRef(memberDoc.id));
            const userData = userSnap.exists() ? userSnap.data() : {};
            return {
                id: memberDoc.id,
                email: userData.email,
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                joinedAt: membership.joinedAt,
                role: membership.role,
                groupIds: membership.groupIds,
            };
        });
        const items = await Promise.all(userPromises);
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

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, COMMENTS), {
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

    // GitHub Comment Sync
    if (targetType === 'issue') {
        try {
            const issue = await getIssueById(targetId, projectId, resolvedTenant);
            if (issue?.githubIssueNumber) {
                const project = await getProjectById(projectId, resolvedTenant);
                if (project?.githubIssueSync && project.githubRepo) {
                    let githubToken = project.githubToken;
                    if (!githubToken && user.uid) {
                        const profile = await getUserProfile(user.uid, resolvedTenant);
                        githubToken = profile?.githubToken;
                    }

                    if (githubToken) {
                        await addGithubIssueComment(
                            project.githubRepo,
                            githubToken,
                            issue.githubIssueNumber,
                            `${content}\n\n— *Shared from ProjectFlow by ${user.displayName || 'User'}*`
                        );
                    }
                }
            }
        } catch (e) {
            console.warn("Failed to sync comment to GitHub", e);
        }
    }

    // Notify the owner of the target item
    let targetTitle = '';
    let ownerId = '';

    if (targetType === 'task') {
        const taskSnap = await findTaskDoc(targetId, projectId, resolvedTenant);
        if (taskSnap) {
            const task = taskSnap.data() as Task;
            targetTitle = task.title;
            ownerId = task.ownerId;
        }
    } else if (targetType === 'issue') {
        const issueSnap = await findIssueDoc(targetId, projectId, resolvedTenant);
        if (issueSnap) {
            const issue = issueSnap.data() as Issue;
            targetTitle = issue.title;
            ownerId = issue.ownerId;
        }
    } else if (targetType === 'idea') {
        const ideaSnap = await findIdeaDoc(targetId, projectId, resolvedTenant);
        if (ideaSnap) {
            const idea = ideaSnap.data() as Idea;
            targetTitle = idea.title;
            ownerId = idea.ownerId || '';
        }
    }

    // Send notification to owner (if not the commenter)
    if (ownerId && ownerId !== user.uid) {
        await notifyComment(
            ownerId,
            targetTitle,
            targetType,
            projectId,
            targetId,
            docRef.id,
            resolvedTenant
        );
    }
    return docRef.id;
};

export const getComments = async (
    projectId: string,
    targetId: string,
    tenantId?: string
): Promise<ProjectComment[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, COMMENTS),
        where("targetId", "==", targetId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ProjectComment))
        .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
};

export const subscribeComments = (
    projectId: string,
    targetId: string,
    callback: (comments: ProjectComment[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, COMMENTS),
        where("targetId", "==", targetId)
    );
    return onSnapshot(q, (snap) => {
        const items = snap.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ProjectComment))
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

    const assignedToMe = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const pathParts = docSnap.ref.path.split('/');
        const derivedTenantId = pathParts.length >= 2 && pathParts[0] === 'tenants' ? pathParts[1] : undefined;
        const derivedProjectId = pathParts.length >= 4 && pathParts[2] === 'projects' ? pathParts[3] : undefined;

        return {
            id: docSnap.id,
            ...data,
            tenantId: data.tenantId || derivedTenantId,
            projectId: data.projectId || derivedProjectId,
            path: docSnap.ref.path
        } as unknown as Issue;
    });

    // Also check assigneeIds array if it exists (for multiple assignees)
    const q2 = query(collectionGroup(db, ISSUES), where("assigneeIds", "array-contains", user.uid));
    const snapshot2 = await getDocs(q2);
    const assignedViaArray = snapshot2.docs.map(docSnap => {
        const data = docSnap.data();
        const pathParts = docSnap.ref.path.split('/');
        const derivedTenantId = pathParts.length >= 2 && pathParts[0] === 'tenants' ? pathParts[1] : undefined;
        const derivedProjectId = pathParts.length >= 4 && pathParts[2] === 'projects' ? pathParts[3] : undefined;

        return {
            id: docSnap.id,
            ...data,
            tenantId: data.tenantId || derivedTenantId,
            projectId: data.projectId || derivedProjectId,
            path: docSnap.ref.path
        } as unknown as Issue;
    });

    // Merge and deduplicate
    const allIssues = [...assignedToMe];
    assignedViaArray.forEach(issue => {
        if (!allIssues.find(i => i.id === issue.id)) {
            allIssues.push(issue);
        }
    });

    return allIssues.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const subscribeTenantProjects = (
    callback: (projects: Project[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    ensureTenantAndUser(resolvedTenant).catch(() => undefined);
    return onSnapshot(projectsCollection(resolvedTenant), (snap) => {
        const items = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Project));
        callback(items);
    });
};

// --- Workspace Groups & Permissions ---

export const updateUserRole = async (
    targetUserId: string,
    newRole: WorkspaceRole,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const userRef = doc(db, `tenants/${resolvedTenant}/users`, targetUserId);
    await updateDoc(userRef, { role: newRole });
};

export const subscribeWorkspaceGroups = (
    callback: (groups: WorkspaceGroup[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    return onSnapshot(collection(db, `tenants/${resolvedTenant}/groups`), (snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkspaceGroup));
        callback(items);
    });
};

export const getWorkspaceGroups = async (tenantId?: string): Promise<WorkspaceGroup[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snap = await getDocs(collection(db, `tenants/${resolvedTenant}/groups`));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkspaceGroup));
};

export const createWorkspaceGroup = async (
    name: string,
    color?: string,
    description?: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await addDoc(collection(db, `tenants/${resolvedTenant}/groups`), {
        tenantId: resolvedTenant,
        name,
        color: color || '#3b82f6', // Default blue
        description: description || '',
        memberIds: [],
        createdAt: serverTimestamp()
    });
};

export const updateWorkspaceGroup = async (
    groupId: string,
    data: Partial<WorkspaceGroup>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await updateDoc(doc(db, `tenants/${resolvedTenant}/groups`, groupId), data);
};

export const deleteWorkspaceGroup = async (
    groupId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(db, `tenants/${resolvedTenant}/groups`, groupId));
};

export const addUserToGroup = async (
    userId: string,
    groupId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);

    // Update Group
    const groupRef = doc(db, `tenants/${resolvedTenant}/groups`, groupId);
    await updateDoc(groupRef, {
        memberIds: arrayUnion(userId)
    });

    // Update User
    const userRef = doc(db, `tenants/${resolvedTenant}/users`, userId);
    await updateDoc(userRef, {
        groupIds: arrayUnion(groupId)
    });
};

export const removeUserFromGroup = async (
    userId: string,
    groupId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);

    // Update Group
    const groupRef = doc(db, `tenants/${resolvedTenant}/groups`, groupId);
    await updateDoc(groupRef, {
        memberIds: arrayRemove(userId)
    });

    // Update User
    const userRef = doc(db, `tenants/${resolvedTenant}/users`, userId);
    await updateDoc(userRef, {
        groupIds: arrayRemove(groupId)
    });
};

/**
 * Remove a user from the workspace completely.
 * This removes them from all workspace groups and deletes their user document in the tenant.
 */
export const removeUserFromWorkspace = async (userId: string, tenantId: string) => {
    // 1. Get user to find groups
    const userRef = doc(db, `tenants/${tenantId}/users/${userId}`);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();
        const groupIds = userData.groupIds || [];

        // 2. Remove from all groups
        for (const groupId of groupIds) {
            await removeUserFromGroup(userId, groupId, tenantId);
        }
    }

    // 3. Delete user document from tenant
    await deleteDoc(userRef);
};

export const addProjectMember = async (
    projectId: string,
    userId: string,
    role: ProjectRole = 'Viewer',
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const projectRef = projectDocRef(resolvedTenant, projectId);

    // We need to fetch user details to add full ProjectMember object
    const userProfile = await getUserProfile(userId, resolvedTenant);

    const user = auth.currentUser;
    const newMember: ProjectMember = {
        userId,
        role,
        joinedAt: Timestamp.now(),
        invitedBy: user?.uid || 'system',
        displayName: userProfile?.displayName || 'Unknown',
        email: userProfile?.email || '',
        photoURL: userProfile?.photoURL || ''
    };

    await updateDoc(projectRef, {
        members: arrayUnion(newMember),
        memberIds: arrayUnion(userId)
    });

    try {
        await logActivity(
            projectId,
            { action: `added ${userProfile?.displayName || 'a member'} to the team`, target: 'Team', type: 'member' },
            resolvedTenant
        );
    } catch (e) {
        console.warn('Failed to log activity', e);
    }
};

export const requestJoinProject = async (projectId: string, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Must be logged in");

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const project = await getProjectById(projectId, resolvedTenant);
    if (!project) throw new Error("Project not found");

    if (project.members?.some(m => m.userId === user.uid) || project.ownerId === user.uid) {
        throw new Error("Already a member");
    }

    // Create a notification for the owner
    // We use createNotification helper which handles valid tenant checks
    await createNotification({
        type: 'project_join_request',
        userId: project.ownerId,
        title: 'Project Join Request',
        message: `${user.displayName || 'A user'} requested to join ${project.title}`,
        projectId: project.id,
        tenantId: resolvedTenant // Tenant-scoped for the owner
    });

    await logActivity(
        projectId,
        { action: 'requested to join the project', target: 'Team', type: 'member' },
        resolvedTenant
    );
};

export const respondToJoinRequest = async (
    notificationId: string,
    projectId: string,
    requesterId: string,
    accept: boolean,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const user = auth.currentUser;

    // 1. Update the original notification to accepted/denied status to prevent re-use
    // We update type so UI can show "Accepted" or "Denied" state
    await updateDoc(doc(db, 'tenants', resolvedTenant, 'notifications', notificationId), {
        type: accept ? 'project_join_request_accepted' : 'project_join_request_denied',
        read: true
    });

    if (accept) {
        // 2. Add member to project
        await addProjectMember(projectId, requesterId, 'Editor', resolvedTenant);

        // 3. Notify the requester
        const project = await getProjectById(projectId, resolvedTenant);
        await createNotification({
            type: 'project_shared', // Re-using shared type for now, or could create specific 'request_approved'
            userId: requesterId,
            title: 'Request Approved',
            message: `Your request to join ${project?.title || 'a project'} was approved.`,
            projectId: projectId,
            actorId: user?.uid,
            // tenantId: resolvedTenant // OMITTED to make it GLOBAL so user sees it anywhere
        });
    } else {
        // Notify denial
        const project = await getProjectById(projectId, resolvedTenant);
        await createNotification({
            type: 'project_shared', // Using generic type, message explains it
            userId: requesterId,
            title: 'Request Denied',
            message: `Your request to join ${project?.title || 'a project'} was denied.`,
            projectId: projectId,
            actorId: user?.uid,
            // tenantId: resolvedTenant // OMITTED to make it GLOBAL
        });
    }
};

export const updateProjectMemberRole = async (
    projectId: string,
    userId: string,
    newRole: ProjectRole,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const projectRef = projectDocRef(resolvedTenant, projectId);

    await runTransaction(db, async (transaction) => {
        const projectDoc = await transaction.get(projectRef);
        if (!projectDoc.exists()) throw new Error("Project not found");

        const data = projectDoc.data() as Project;
        const members = data.members || [];
        const memberIndex = members.findIndex(m => (typeof m === 'string' ? m : m.userId) === userId);

        if (memberIndex === -1) throw new Error("Member not found in project");

        const member = members[memberIndex];
        let newMemberObj: ProjectMember;

        if (typeof member === 'string') {
            // Upgrade legacy string member to object
            newMemberObj = {
                userId: member,
                role: newRole,
                joinedAt: Timestamp.now(),
                invitedBy: 'system',
                displayName: 'Member', // Placeholder, ideally fetch or update later
                email: '',
                photoURL: ''
            };
        } else {
            newMemberObj = {
                ...member,
                role: newRole
            };
        }

        // Clone and update
        const updatedMembers = [...members];
        updatedMembers[memberIndex] = newMemberObj;

        transaction.update(projectRef, { members: updatedMembers });
    });
};

// --- Social Media Module Services ---

// Campaigns
export const createCampaign = async (
    projectId: string,
    campaignData: Omit<SocialCampaign, "id" | "createdAt" | "updatedAt" | "tenantId" | "ownerId">,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, SOCIAL_CAMPAIGNS), {
        ...campaignData,
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    await logActivity(
        projectId,
        { action: `Created campaign "${campaignData.name}"`, target: "Campaign", type: "status" },
        resolvedTenant
    );

    return docRef.id;
};

export const getCampaignById = async (
    projectId: string,
    campaignId: string,
    tenantId?: string
): Promise<SocialCampaign | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_CAMPAIGNS), campaignId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as SocialCampaign;
    }
    return null;
};

export const getSocialCampaign = async (projectId: string, campaignId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const docRef = doc(db, 'tenants', resolvedTenant, 'projects', projectId, SOCIAL_CAMPAIGNS, campaignId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as SocialCampaign;
    }
    return null;
};


export const createSocialCampaign = async (
    projectId: string,
    campaignData: Omit<SocialCampaign, 'id' | 'createdAt' | 'updatedAt'>,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, SOCIAL_CAMPAIGNS), {
        ...campaignData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return docRef.id;
};

export const subscribeCampaigns = (
    projectId: string,
    onUpdate: (campaigns: SocialCampaign[]) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, SOCIAL_CAMPAIGNS),
        orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
        const campaigns = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as SocialCampaign));
        onUpdate(campaigns);
    });
};

export const updateCampaign = async (
    projectId: string,
    campaignId: string,
    updates: Partial<SocialCampaign>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_CAMPAIGNS), campaignId);
    await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteCampaign = async (
    projectId: string,
    campaignId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_CAMPAIGNS), campaignId);
    await deleteDoc(ref);
};

// Social Posts
export const createSocialPost = async (
    projectId: string,
    postData: Omit<SocialPost, "id" | "createdAt" | "updatedAt" | "createdBy">,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS), {
        ...postData,
        projectId,
        tenantId: resolvedTenant,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    await logActivity(
        projectId,
        { action: `Created social post for ${postData.platform}`, target: "Social Post", type: "status" },
        resolvedTenant
    );

    return docRef.id;
};

export const subscribeSocialPosts = (
    projectId: string,
    onUpdate: (posts: SocialPost[]) => void,
    tenantId?: string,
    campaignId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);

    let q = query(
        projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS),
        orderBy("updatedAt", "desc")
    );

    if (campaignId) {
        q = query(
            projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS),
            where("campaignId", "==", campaignId),
            orderBy("updatedAt", "desc")
        );
    }

    return onSnapshot(q, (snapshot) => {
        const posts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as SocialPost));
        onUpdate(posts);
    });
};

export const updateSocialPost = async (
    projectId: string,
    postId: string,
    updates: Partial<SocialPost>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS), postId);
    await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteSocialPost = async (
    projectId: string,
    postId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS), postId);
    await deleteDoc(ref);
};

export const getSocialPostById = async (
    projectId: string,
    postId: string,
    tenantId?: string
): Promise<SocialPost | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_POSTS), postId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as SocialPost;
    }
    return null;
};

// Assets
export const createSocialAsset = async (
    projectId: string,
    assetData: Omit<SocialAsset, "id" | "createdAt" | "createdBy">,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, SOCIAL_ASSETS), {
        ...assetData,
        projectId,
        tenantId: resolvedTenant,
        createdBy: user.uid,
        createdAt: serverTimestamp()
    });

    return docRef.id;
};

export const subscribeSocialAssets = (
    projectId: string,
    onUpdate: (assets: SocialAsset[]) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, SOCIAL_ASSETS),
        orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
        const assets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as SocialAsset));
        onUpdate(assets);
    });
};

export const deleteSocialAsset = async (projectId: string, assetId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const assetRef = doc(projectSubCollection(resolvedTenant, projectId, SOCIAL_ASSETS), assetId);
    await deleteDoc(assetRef);
};

// Social Integrations
export const SOCIAL_INTEGRATIONS = 'social_integrations';

// --- Caption Presets ---

export const createCaptionPreset = async (
    projectId: string,
    presetData: Omit<CaptionPreset, "id" | "createdAt" | "createdBy">,
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, CAPTION_PRESETS), {
        ...presetData,
        projectId,
        createdBy: user.uid,
        createdAt: serverTimestamp()
    });

    return docRef.id;
};

export const subscribeCaptionPresets = (
    projectId: string,
    onUpdate: (presets: CaptionPreset[]) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, CAPTION_PRESETS),
        orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
        const presets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as CaptionPreset));
        onUpdate(presets);
    });
};

export const updateCaptionPreset = async (
    projectId: string,
    presetId: string,
    updates: Partial<CaptionPreset>,
    tenantId?: string
): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const presetRef = doc(projectSubCollection(resolvedTenant, projectId, CAPTION_PRESETS), presetId);
    await updateDoc(presetRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteCaptionPreset = async (
    projectId: string,
    presetId: string,
    tenantId?: string
): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const presetRef = doc(projectSubCollection(resolvedTenant, projectId, CAPTION_PRESETS), presetId);
    await deleteDoc(presetRef);
};

export const subscribeIntegrations = (
    projectId: string,
    onUpdate: (integrations: SocialIntegration[]) => void
) => {
    const tenantId = resolveTenantId();
    const q = query(
        projectSubCollection(tenantId, projectId, SOCIAL_INTEGRATIONS)
    );
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialIntegration));
        onUpdate(data);
    });
};

export const linkWithFacebook = async (): Promise<{ accessToken: string, user: any }> => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    const provider = new FacebookAuthProvider();
    // Permissions needed for Instagram Graph API
    provider.addScope('business_management'); // Often needed for Business Manager owned pages
    provider.addScope('pages_show_list');
    provider.addScope('pages_read_engagement');
    provider.addScope('instagram_basic');
    provider.addScope('instagram_content_publish');
    provider.addScope('public_profile');

    // Force the dialog to show again so user can select pages they might have missed
    provider.setCustomParameters({
        auth_type: 'rerequest'
    });

    try {
        // Check if already linked
        const isLinked = user.providerData.some(p => p.providerId === 'facebook.com');

        let result;
        if (isLinked) {
            result = await reauthenticateWithPopup(user, provider);
        } else {
            result = await linkWithPopup(user, provider);
        }

        const credential = FacebookAuthProvider.credentialFromResult(result);
        if (!credential?.accessToken) {
            throw new Error("Failed to get Facebook access token");
        }
        return { accessToken: credential.accessToken, user: result.user };
    } catch (error: any) {
        console.error("Facebook link error", error);

        // Case 1: The provider is ALREADY linked to the CURRENT user.
        // We just need to re-authenticate to get a fresh token.
        if (error.code === 'auth/provider-already-linked') {
            const reauthResult = await reauthenticateWithPopup(user, provider);
            const credential = FacebookAuthProvider.credentialFromResult(reauthResult);
            if (!credential?.accessToken) {
                throw new Error("Failed to refresh Facebook access token");
            }
            return { accessToken: credential.accessToken, user: reauthResult.user };
        }

        // Case 2: The Facebook account is already linked to ANOTHER Firebase user.
        if (error.code === 'auth/credential-already-in-use') {
            throw new Error("This Facebook account is already connected to another user in the system.");
        }

        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error("Authentication cancelled.");
        }
        throw error;
    }
};

export const connectIntegration = async (projectId: string, platform: SocialPlatform, existingAccessToken?: string) => {
    const tenantId = resolveTenantId();

    try {
        if (platform === 'Instagram' || platform === 'Facebook') {

            // 1. Initiate Headless Auth
            const getAuthUrlFn = httpsCallable(functions, 'getFacebookAuthUrl');
            const response = await getAuthUrlFn({ projectId, tenantId }) as any;
            const authUrl = response.data.url;

            const width = 600;
            const height = 700;
            const left = (window.screen.width / 2) - (width / 2);
            const top = (window.screen.height / 2) - (height / 2);

            const popup = window.open(authUrl, 'facebook_auth', `width=${width},height=${height},top=${top},left=${left}`);

            if (!popup) {
                throw new Error("Popup blocked. Please allow popups for this site.");
            }

            // 2. Wait for completion message
            await new Promise<void>((resolve, reject) => {
                const handleMessage = (event: MessageEvent) => {
                    if (event.data?.type === 'FACEBOOK_CONNECTED') {
                        window.removeEventListener('message', handleMessage);
                        resolve();
                    }
                };
                window.addEventListener('message', handleMessage);

                // Poll check if popup closed without finishing
                const timer = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(timer);
                        window.removeEventListener('message', handleMessage);
                        // We don't reject here because sometimes it closes fast, but if we didn't get message it's a cancel.
                        // Ideally we rely on user action or checking DB.
                    }
                }, 1000);
            });

            // 3. Find the 'PendingSetup' integration
            // We wait a brief moment for Firestore to sync
            await new Promise(r => setTimeout(r, 1000));

            const integrationsRef = projectSubCollection(tenantId, projectId, SOCIAL_INTEGRATIONS);
            const q = query(
                integrationsRef,
                where('platform', '==', 'FacebookData'),
                where('status', '==', 'PendingSetup'),
                orderBy('connectedAt', 'desc'),
                limit(1)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                throw new Error("Connection successful, but failed to retrieve integration data. Please try again.");
            }

            const pendingDoc = snapshot.docs[0];
            const pendingData = pendingDoc.data();
            const accessToken = pendingData.accessToken;

            // 4. Fetch Accounts using the new token
            // Dynamic import
            const { getInstagramAccounts, getInstagramProfile } = await import('./instagramService');
            const accounts = await getInstagramAccounts(accessToken);

            let integrationData: any = {};

            if (platform === 'Instagram') {
                const instagramAccounts = accounts.filter(acc => acc.instagram_business_account);

                if (instagramAccounts.length === 0) {
                    // Clean up pending doc
                    await deleteDoc(pendingDoc.ref);
                    throw new Error("No Instagram Business accounts found linked to your Facebook Pages. Please make sure your Instagram account is a Business account and linked to a Facebook Page.");
                }

                // Auto-select first for MVP
                const selectedAccount = instagramAccounts[0];
                const igBusinessId = selectedAccount.instagram_business_account!.id;
                const pageId = selectedAccount.id;

                const profile = await getInstagramProfile(igBusinessId, accessToken);

                integrationData = {
                    platform: 'Instagram',
                    username: profile.username || pendingData.username,
                    profilePictureUrl: profile.profile_picture_url || pendingData.profilePictureUrl,
                    instagramBusinessAccountId: igBusinessId,
                    facebookPageId: pageId,
                    accessToken: accessToken,
                    status: 'Connected',
                    // Keep original fields
                    authUserId: pendingData.authUserId,
                    connectedAt: pendingData.connectedAt
                };

            } else {
                // Facebook Page
                if (accounts.length === 0) {
                    await deleteDoc(pendingDoc.ref);
                    throw new Error("No Facebook Pages found.");
                }

                const selectedAccount = accounts[0];

                integrationData = {
                    platform: 'Facebook',
                    username: selectedAccount.name,
                    profilePictureUrl: selectedAccount.picture?.data?.url || pendingData.profilePictureUrl,
                    facebookPageId: selectedAccount.id,
                    pageAccessToken: selectedAccount.access_token, // Page-specific token
                    accessToken: accessToken, // User-level token back up
                    status: 'Connected',
                    authUserId: pendingData.authUserId,
                    connectedAt: pendingData.connectedAt
                };
            }

            // 5. Update the Pending Doc to be the Real Doc
            await updateDoc(pendingDoc.ref, integrationData);
            return;
        }

        if (platform === 'TikTok') {
            try {
                const getAuthUrlFn = httpsCallable(functions, 'getTikTokAuthUrl');
                const response = await getAuthUrlFn({ projectId, tenantId }) as any;
                const authUrl = response.data.url;

                // Open popup
                const width = 600;
                const height = 700;
                const left = (window.screen.width / 2) - (width / 2);
                const top = (window.screen.height / 2) - (height / 2);

                window.open(authUrl, 'tiktok_auth', `width=${width},height=${height},top=${top},left=${left}`);

                // Await message
                await new Promise<void>((resolve, reject) => {
                    const handleMessage = (event: MessageEvent) => {
                        if (event.data?.type === 'TIKTOK_CONNECTED') {
                            window.removeEventListener('message', handleMessage);
                            resolve();
                        }
                    };
                    window.addEventListener('message', handleMessage);
                    // TODO: Add timeout
                });
                return;
            } catch (e: any) {
                console.error("TikTok Connect Failed", e);
                throw new Error("Failed to initiate TikTok connection: " + e.message);
            }
        }

        if (platform === 'YouTube') {
            try {
                const getAuthUrlFn = httpsCallable(functions, 'getYouTubeAuthUrl');
                const response = await getAuthUrlFn({ projectId, tenantId }) as any;
                const authUrl = response.data.url;

                const width = 600;
                const height = 700;
                const left = (window.screen.width / 2) - (width / 2);
                const top = (window.screen.height / 2) - (height / 2);

                window.open(authUrl, 'youtube_auth', `width=${width},height=${height},top=${top},left=${left}`);

                await new Promise<void>((resolve, reject) => {
                    const handleMessage = (event: MessageEvent) => {
                        if (event.data?.type === 'YOUTUBE_CONNECTED') {
                            window.removeEventListener('message', handleMessage);
                            resolve();
                        }
                    };
                    window.addEventListener('message', handleMessage);
                });
                return;
            } catch (e: any) {
                console.error("YouTube Connect Failed", e);
                throw new Error("Failed to initiate YouTube connection: " + e.message);
            }
        }
    } catch (error) {
        console.error("Social Auth failed:", error);
        throw error;
    }

    // Fallback only for non-meta platforms or if explicitly requested (not implemented here)
    if (['Facebook', 'Instagram'].includes(platform)) return;

    // Mock implementation for others OR fallback
    const mockUsernames: Record<string, string> = {
        'Instagram': '@projectflow_ig',
        'Facebook': 'ProjectFlow Page',
        'LinkedIn': 'ProjectFlow Company',
        'X': '@projectflow_app',
        'TikTok': '@projectflow_tok'
    };

    // Simulate OAuth Delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    await addDoc(projectSubCollection(tenantId, projectId, SOCIAL_INTEGRATIONS), {
        projectId,
        platform,
        username: mockUsernames[platform] || 'Connected User',
        status: 'Connected',
        connectedAt: new Date().toISOString(),
        isMock: true
    });
};

export const disconnectIntegration = async (projectId: string, integrationId: string) => {
    const tenantId = resolveTenantId();
    await deleteDoc(doc(projectSubCollection(tenantId, projectId, SOCIAL_INTEGRATIONS), integrationId));
};

// --- Personal Tasks (Standalone, not tied to projects) ---

const PERSONAL_TASKS = "personalTasks";

const personalTasksCollection = (tenantId: string, userId: string) =>
    collection(db, `tenants/${tenantId}/users/${userId}/${PERSONAL_TASKS}`);

const personalTaskDocRef = (tenantId: string, userId: string, taskId: string) =>
    doc(db, `tenants/${tenantId}/users/${userId}/${PERSONAL_TASKS}`, taskId);

export const addPersonalTask = async (
    title: string,
    dueDate?: string,
    priority: PersonalTask['priority'] = 'Medium',
    extra?: Partial<Pick<PersonalTask, 'description' | 'scheduledDate'>>,
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    // Build task data without undefined values (Firestore rejects undefined)
    const taskData: Record<string, any> = {
        ownerId: user.uid,
        title,
        isCompleted: false,
        priority,
        description: extra?.description || "",
        createdAt: serverTimestamp(),
        tenantId: resolvedTenant
    };

    // Only add optional fields if they have values
    if (dueDate) taskData.dueDate = dueDate;
    if (extra?.scheduledDate) taskData.scheduledDate = extra.scheduledDate;

    const docRef = await addDoc(personalTasksCollection(resolvedTenant, user.uid), taskData);
    return docRef.id;
};

export const getPersonalTasks = async (tenantId?: string): Promise<PersonalTask[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const snapshot = await getDocs(personalTasksCollection(resolvedTenant, user.uid));
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PersonalTask))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const updatePersonalTask = async (
    taskId: string,
    updates: Partial<PersonalTask>,
    tenantId?: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    const taskRef = personalTaskDocRef(resolvedTenant, user.uid, taskId);

    const sanitized: any = { ...updates };
    // Handle completedAt logic
    if (sanitized.isCompleted !== undefined) {
        if (sanitized.isCompleted === true) {
            sanitized.completedAt = serverTimestamp();
        } else if (sanitized.isCompleted === false) {
            sanitized.completedAt = deleteField();
        }
    }

    await updateDoc(taskRef, sanitized);
};

export const deletePersonalTask = async (taskId: string, tenantId?: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    const taskRef = personalTaskDocRef(resolvedTenant, user.uid, taskId);
    await deleteDoc(taskRef);
};

export const togglePersonalTaskStatus = async (
    taskId: string,
    currentStatus: boolean,
    tenantId?: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    const taskRef = personalTaskDocRef(resolvedTenant, user.uid, taskId);

    const newStatus = !currentStatus;
    const updates: any = { isCompleted: newStatus };

    if (newStatus) {
        updates.completedAt = serverTimestamp();
    } else {
        updates.completedAt = deleteField();
    }

    await updateDoc(taskRef, updates);
};

/**
 * Move a personal task to a project (converts it to a regular task)
 */
export const movePersonalTaskToProject = async (
    personalTaskId: string,
    targetProjectId: string,
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);

    // 1. Get the personal task data
    const personalTaskRef = personalTaskDocRef(resolvedTenant, user.uid, personalTaskId);
    const personalTaskSnap = await getDoc(personalTaskRef);

    if (!personalTaskSnap.exists()) {
        throw new Error("Personal task not found");
    }

    const personalTaskData = personalTaskSnap.data() as PersonalTask;

    // 2. Create a new task in the target project
    const newTaskId = await addTask(
        targetProjectId,
        personalTaskData.title,
        personalTaskData.dueDate,
        undefined, // assignee
        personalTaskData.priority || 'Medium',
        {
            description: personalTaskData.description,
            category: personalTaskData.category,
            status: personalTaskData.status || 'Open'
        },
        resolvedTenant
    );

    // 3. If the personal task was completed, mark the new task as completed
    if (personalTaskData.isCompleted) {
        await toggleTaskStatus(newTaskId, false, targetProjectId, resolvedTenant);
    }

    // 4. Delete the personal task
    await deleteDoc(personalTaskRef);

    return newTaskId;
};

/**
 * Get a single personal task by ID
 */
export const getPersonalTaskById = async (
    taskId: string,
    tenantId?: string
): Promise<PersonalTask | null> => {
    const user = auth.currentUser;
    if (!user) return null;

    const resolvedTenant = resolveTenantId(tenantId);
    const taskRef = personalTaskDocRef(resolvedTenant, user.uid, taskId);
    const taskSnap = await getDoc(taskRef);

    if (!taskSnap.exists()) return null;

    return { id: taskSnap.id, ...taskSnap.data() } as PersonalTask;
};

// --- API Tokens ---

const API_TOKENS = "api_tokens";

/**
 * Generate a cryptographically secure token
 */
const generateSecureToken = (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const base64 = btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    return `pfat_${base64}`;
};

/**
 * Hash a token using SHA-256
 */
const hashToken = async (token: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Create a new API token. Returns the plain-text token (only shown once).
 */
export const createAPIToken = async (
    name: string,
    permissions: ('newsletter:write' | 'recipients:read')[],
    projectScope?: string,
    expiresAt?: Date,
    tenantId?: string
): Promise<{ token: string; id: string }> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const resolvedTenant = resolveTenantId(tenantId);
    const plainToken = generateSecureToken();
    const tokenHash = await hashToken(plainToken);
    const tokenPrefix = plainToken.substring(0, 12); // "pfat_xxxxxxx" first 12 chars

    const tokenData = {
        tenantId: resolvedTenant,
        name,
        tokenHash,
        tokenPrefix,
        projectScope: projectScope || null,
        permissions,
        createdAt: serverTimestamp(),
        lastUsedAt: null,
        expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
        createdBy: user.uid
    };

    // Store in tenant's secrets subcollection for API tokens
    const tokensRef = collection(db, TENANTS, resolvedTenant, API_TOKENS);
    const docRef = await addDoc(tokensRef, tokenData);

    return { token: plainToken, id: docRef.id };
};

/**
 * Get all API tokens for the current tenant (without exposing hashes)
 */
export const getAPITokens = async (tenantId?: string): Promise<{
    id: string;
    name: string;
    tokenPrefix: string;
    permissions: string[];
    projectScope?: string;
    createdAt: any;
    lastUsedAt?: any;
    expiresAt?: any;
}[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const tokensRef = collection(db, TENANTS, resolvedTenant, API_TOKENS);
    const q = query(tokensRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            tokenPrefix: data.tokenPrefix,
            permissions: data.permissions,
            projectScope: data.projectScope,
            createdAt: data.createdAt,
            lastUsedAt: data.lastUsedAt,
            expiresAt: data.expiresAt
        };
    });
};

/**
 * Delete an API token
 */
export const deleteAPIToken = async (tokenId: string, tenantId?: string): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const tokenRef = doc(db, TENANTS, resolvedTenant, API_TOKENS, tokenId);
    await deleteDoc(tokenRef);
};

/**
 * Validate an API token (used by Cloud Functions)
 * This is a client-side version for testing - the real validation happens in Cloud Functions
 */
export const validateAPITokenLocally = async (
    plainToken: string,
    requiredPermission: 'newsletter:write' | 'recipients:read',
    tenantId: string
): Promise<{ valid: boolean; tokenData?: any; error?: string }> => {
    try {
        const tokenHash = await hashToken(plainToken);
        const tokensRef = collection(db, TENANTS, tenantId, API_TOKENS);
        const q = query(tokensRef, where("tokenHash", "==", tokenHash));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { valid: false, error: "Invalid token" };
        }

        const tokenDoc = snapshot.docs[0];
        const tokenData = tokenDoc.data();

        // Check expiration
        if (tokenData.expiresAt) {
            const expiresAt = tokenData.expiresAt.toDate();
            if (new Date() > expiresAt) {
                return { valid: false, error: "Token expired" };
            }
        }

        // Check permissions
        if (!tokenData.permissions.includes(requiredPermission)) {
            return { valid: false, error: "Insufficient permissions" };
        }

        return { valid: true, tokenData };
    } catch (error: any) {
        return { valid: false, error: error.message };
    }
};

// --- Idea Interactions (Likes & Comments) ---

export const toggleIdeaLike = async (ideaId: string, projectId: string, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);
    const ideaRef = doc(projectSubCollection(resolvedTenant, projectId, IDEAS), ideaId);

    const ideaDoc = await getDoc(ideaRef);
    if (!ideaDoc.exists()) return;

    const data = ideaDoc.data();
    const likedBy = data.likedBy || [];
    const dislikedBy = data.dislikedBy || [];
    const isLiked = likedBy.includes(user.uid);

    if (isLiked) {
        // Untoggle like
        await updateDoc(ideaRef, {
            votes: increment(-1),
            likedBy: arrayRemove(user.uid)
        });
    } else {
        // Toggle like (and remove dislike if present)
        const batch = writeBatch(db);
        batch.update(ideaRef, {
            votes: increment(1),
            likedBy: arrayUnion(user.uid),
            dislikedBy: arrayRemove(user.uid) // Remove from dislikes if they dislike it
        });
        await batch.commit();

        // Notify owner if it's not self
        if (data.ownerId && data.ownerId !== user.uid) {
            // await createNotification(...) // Optional: Add notification later
        }
    }
};

export const toggleIdeaDislike = async (ideaId: string, projectId: string, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);
    const ideaRef = doc(projectSubCollection(resolvedTenant, projectId, IDEAS), ideaId);

    const ideaDoc = await getDoc(ideaRef);
    if (!ideaDoc.exists()) return;

    const data = ideaDoc.data();
    const likedBy = data.likedBy || [];
    const dislikedBy = data.dislikedBy || [];
    const isDisliked = dislikedBy.includes(user.uid);

    if (isDisliked) {
        // Untoggle dislike
        await updateDoc(ideaRef, {
            dislikedBy: arrayRemove(user.uid)
        });
    } else {
        // Toggle dislike (and remove like if present)
        const batch = writeBatch(db);
        // We probably don't decrement votes for dislikes unless we want a net score.
        // Let's assume votes = number of likes for now, or net score.
        // Prompt didn't specify, but usually dislikes don't affect "votes" count if votes implies positive support,
        // UNLESS it's a reddit style score.
        // Existing `votes: number`. Let's assume it tracks LIKES count primarily.
        // If we remove a like to add a dislike, we must decrement votes.

        let voteChange = 0;
        if (likedBy.includes(user.uid)) {
            voteChange = -1;
        }

        batch.update(ideaRef, {
            votes: increment(voteChange),
            dislikedBy: arrayUnion(user.uid),
            likedBy: arrayRemove(user.uid)
        });
        await batch.commit();
    }
};

/**
 * Add a comment to an idea.
 * Stored in project subcollection 'comments' with targetId = ideaId
 */
export const addIdeaComment = async (projectId: string, ideaId: string, content: string, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    // 1. Create Comment
    const commentData: Omit<ProjectComment, "id"> = {
        projectId,
        targetId: ideaId,
        targetType: 'idea',
        userId: user.uid,
        userDisplayName: user.displayName || 'User',
        userPhotoURL: user.photoURL || '',
        content,
        createdAt: serverTimestamp()
    };

    await addDoc(projectSubCollection(resolvedTenant, projectId, COMMENTS), commentData);

    // 2. Update Idea comment count
    const ideaRef = doc(projectSubCollection(resolvedTenant, projectId, IDEAS), ideaId);
    await updateDoc(ideaRef, {
        comments: increment(1)
    });

    // 3. Notify owner
    const ideaDoc = await getDoc(ideaRef);
    if (ideaDoc.exists()) {
        const idea = ideaDoc.data();
        if (idea.ownerId && idea.ownerId !== user.uid) {
            await notifyComment(
                idea.ownerId,
                projectId,
                `New comment on idea: ${idea.title}`,
                content,
                ideaId, // using ideaId as context
                'idea'
            );
        }
    }
};

export const getIdeaComments = async (projectId: string, ideaId: string, tenantId?: string): Promise<ProjectComment[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, COMMENTS),
        where("targetId", "==", ideaId),
        orderBy("createdAt", "asc") // Oldest first
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as ProjectComment));
};

// --- Social Strategy ---

export const subscribeSocialStrategy = (projectId: string, onUpdate: (strategy: SocialStrategy | null) => void) => {
    const tenantId = resolveTenantId();
    const strategyRef = doc(db, 'tenants', tenantId, 'projects', projectId, SOCIAL_STRATEGY, 'default');

    return onSnapshot(strategyRef, (snap) => {
        if (snap.exists()) {
            onUpdate({ id: snap.id, ...snap.data() } as SocialStrategy);
        } else {
            onUpdate(null);
        }
    });
};

export const updateSocialStrategy = async (projectId: string, updates: Partial<SocialStrategy>) => {
    const tenantId = resolveTenantId();
    const strategyRef = doc(db, 'tenants', tenantId, 'projects', projectId, SOCIAL_STRATEGY, 'default');

    await setDoc(strategyRef, {
        ...updates,
        projectId,
        updatedAt: serverTimestamp()
    }, { merge: true });
};

export const syncSocialStrategyPlatforms = async (projectId: string, platformToRemove: SocialPlatform) => {
    const tenantId = resolveTenantId();
    const ideasRef = collection(db, 'tenants', tenantId, 'projects', projectId, 'ideas');
    const q = query(ideasRef, where('type', '==', 'Marketing'), where('campaignType', '==', 'social'));

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as Idea;
        try {
            const concept = JSON.parse(data.concept || '{}');
            if (concept.channels && Array.isArray(concept.channels) && concept.channels.includes(platformToRemove)) {
                const newChannels = concept.channels.filter((c: string) => c !== platformToRemove);
                batch.update(docSnap.ref, {
                    concept: JSON.stringify({ ...concept, channels: newChannels }),
                    updatedAt: serverTimestamp()
                });
                count++;
            }
        } catch (e) {
            console.error("Failed to parse concept for flow", docSnap.id, e);
        }
    });

    if (count > 0) {
        await batch.commit();
    }
};

// --- Onboarding Persistence ---

/**
 * Updates a specific onboarding tour status for a user.
 * Uses strict object structure to ensure Firestore merges nested maps correctly 
 * rather than creating dot-notation field keys.
 */
export const updateUserOnboardingStatus = async (
    userId: string,
    tourKey: string,
    status: 'completed' | 'skipped'
) => {
    const userRef = userDocRef(userId);

    await updateDoc(userRef, {
        [`preferences.onboarding.${tourKey}`]: {
            status,
            completedAt: new Date().toISOString()
        }
    });
};

export const resetUserOnboarding = async (userId: string) => {
    const userRef = userDocRef(userId);

    // To delete the whole map or reset it
    await updateDoc(userRef, {
        'preferences.onboarding': deleteField()
    });
};
