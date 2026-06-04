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
import { linkWithPopup } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth, functions, GithubAuthProvider } from "./firebase";
import { getTenantFileDownloadUrl, refreshFirebaseStorageUrl } from './fileStorageService';
import type { Task, Idea, Initiative, Activity, Project, ProjectOverviewTemplate, ProjectOverviewLayout, SubTask, TaskCategory, Issue, ProjectRole, ProjectMember, Comment as ProjectComment, WorkspaceGroup, WorkspaceRole, SocialCampaign, SocialPost, SocialAsset, SocialPostStatus, SocialPlatform, SocialIntegration, EmailBlock, GeminiReport, Milestone, AIUsage, Member, User, TenantMembership, MarketingCampaign, AdCampaign, EmailCampaign, PersonalTask, ProjectNavPrefs, CaptionPreset, SocialStrategy, APITokenPermission } from '../types';
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
import { isProjectIncludedInImportantSignals } from './healthService';
import {
    createWorkspaceApiToken,
    deleteWorkspaceApiToken,
    getWorkspaceSmtpConfig,
    listWorkspaceApiTokens,
    saveWorkspaceSmtpConfig
} from './domain/adminSettingsService';
import {
    ensureCategory,
    ensureTenantAndUser,
    findIdeaDoc,
    findInitiativeDoc,
    findIssueDoc,
    findSubtaskDoc,
    findTaskDoc,
    getCachedTenantId,
    getProjectContextFromRef,
    logActivity,
    projectDocRef,
    projectSubCollection,
    resolveTenantId,
    syncProjectProgress
} from './internal/workspaceDataCore';

// Legacy compatibility facade.
// Prefer focused modules under web/services/domain and avoid adding new exports here.

export {
    ensureCategory,
    ensureTenantAndUser,
    findIdeaDoc,
    findInitiativeDoc,
    findIssueDoc,
    findSubtaskDoc,
    findTaskDoc,
    getProjectContextFromRef,
    logActivity,
    projectDocRef,
    projectSubCollection,
    resolveTenantId,
    syncProjectProgress
};

const TENANTS = "tenants";
const PROJECTS = "projects";
const USERS = "users";
const TASKS = "tasks";
const SUBTASKS = "subtasks";
export const ISSUES = "issues";
const IDEAS = "ideas";
const ACTIVITIES = "activities";
const CATEGORIES = "taskCategories";
const COMMENTS = "comments";
const GEMINI_REPORTS = "geminiReports";
const PROJECT_TEMPLATES = "project_templates";
export const SOCIAL_CAMPAIGNS = "social_campaigns";
export const SOCIAL_POSTS = "social_posts";
export const SOCIAL_ASSETS = "social_assets";
export const CAPTION_PRESETS = "caption_presets";
export const SOCIAL_STRATEGY = "social_strategy";

const DEFAULT_PROJECT_OVERVIEW_LAYOUT: ProjectOverviewLayout = {
    layoutVersion: 3,
    templateId: 'core',
    cards: [
        { id: 'contract', enabled: true, span: 12, placement: 'primary' },
        { id: 'snapshot', enabled: true, span: 12, placement: 'primary' },
        { id: 'executionTasks', enabled: true, span: 12, placement: 'primary' },
        { id: 'executionFlows', enabled: true, span: 6, placement: 'primary' },
        { id: 'executionIssues', enabled: true, span: 6, placement: 'primary' },
        { id: 'updates', enabled: true, span: 12, placement: 'primary' },
        { id: 'resources', enabled: true, span: 12, placement: 'primary' },
        { id: 'planning', enabled: true, span: 3, placement: 'secondary' },
        { id: 'milestones', enabled: true, span: 3, placement: 'secondary' },
        { id: 'aiInsights', enabled: true, span: 3, placement: 'secondary' },
        { id: 'team', enabled: true, span: 3, placement: 'secondary' },
        { id: 'metadata', enabled: true, span: 3, placement: 'secondary' },
        { id: 'controls', enabled: true, span: 3, placement: 'secondary' }
    ]
};

const TENANT_CACHE_KEY = "activeTenantId";

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

const tenantDocRef = (tenantId: string) => doc(db, TENANTS, tenantId);

export const getTenantSecret = async (tenantId: string, secretName: string) => {
    if (secretName !== 'smtp') {
        throw new Error('Only the smtp secret is available through the compatibility facade.');
    }

    return getWorkspaceSmtpConfig(tenantId);
};

export const updateTenantSecret = async (tenantId: string, secretName: string, data: any) => {
    if (secretName !== 'smtp') {
        throw new Error('Only the smtp secret is available through the compatibility facade.');
    }

    await saveWorkspaceSmtpConfig(tenantId, data);
};

// --- Top-level users collection (global user profiles) ---
const usersCollection = () => collection(db, USERS);
const userDocRef = (userId: string) => doc(db, USERS, userId);

// --- Tenant members collection (workspace membership) ---
const tenantMembersCollection = (tenantId: string) => collection(db, TENANTS, tenantId, 'members');
const tenantMemberDocRef = (tenantId: string, userId: string) => doc(db, TENANTS, tenantId, 'members', userId);

// --- Project collections ---
const projectsCollection = (tenantId: string) => collection(tenantDocRef(tenantId), PROJECTS);

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
    const { getUserTenantMembership: getUserTenantMembershipDomain } = await import('./domain/workspaceMembersService');
    return getUserTenantMembershipDomain(userId, tenantId);
};

/**
 * Get all members of a workspace (combined profile + membership data)
 */
export const getWorkspaceMembers = async (tenantId?: string): Promise<Member[]> => {
    const { getWorkspaceMembers: getWorkspaceMembersDomain } = await import('./domain/workspaceMembersService');
    return getWorkspaceMembersDomain(tenantId);
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
    const { updateUserMembership: updateUserMembershipDomain } = await import('./domain/workspaceMembersService');
    return updateUserMembershipDomain(userId, tenantId, data);
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


export const deleteSocialCampaign = async (projectId: string, campaignId: string, tenantId?: string) => {
    const { deleteSocialCampaign: deleteSocialCampaignDomain } = await import('./domain/socialService');
    return deleteSocialCampaignDomain(projectId, campaignId, tenantId);
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

export const setWorkspaceFocusProject = async (tenantId: string, projectId: string | null) => {
    // If projectId is null, we are clearing the focus
    await updateDoc(tenantDocRef(tenantId), {
        focusProjectId: projectId || null
    });
};

export const getProjectOverviewTemplates = async (tenantId?: string): Promise<ProjectOverviewTemplate[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const templatesRef = collection(db, TENANTS, resolvedTenant, PROJECT_TEMPLATES);
    const templatesQuery = query(templatesRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(templatesQuery);
    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
    })) as ProjectOverviewTemplate[];
};

export const saveProjectOverviewTemplate = async (
    template: Omit<ProjectOverviewTemplate, 'id'> & { id?: string },
    tenantId?: string
): Promise<string> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const templatesRef = collection(db, TENANTS, resolvedTenant, PROJECT_TEMPLATES);
    const now = serverTimestamp();
    const userId = auth.currentUser?.uid || null;
    const payload = {
        name: template.name,
        description: template.description || '',
        baseLayout: template.baseLayout,
        baseSourceProjectId: template.baseSourceProjectId || null,
        variants: template.variants || [],
        autoApply: Boolean(template.autoApply),
        tenantId: resolvedTenant,
        updatedAt: now,
        ...(template.id ? {} : { createdAt: now, createdBy: userId })
    };

    if (template.id) {
        const docRef = doc(templatesRef, template.id);
        await setDoc(docRef, payload, { merge: true });
        return template.id;
    }

    const docRef = await addDoc(templatesRef, payload);
    return docRef.id;
};

export const deleteProjectOverviewTemplate = async (templateId: string, tenantId?: string): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(db, TENANTS, resolvedTenant, PROJECT_TEMPLATES, templateId));
};

export const getIdeaById = async (ideaId: string, projectId?: string, tenantId?: string): Promise<Idea | null> => {
    void ideaId;
    void projectId;
    void tenantId;
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
    const { createProject: createProjectDomain } = await import('./domain/projectAdminService');
    return createProjectDomain(
        projectData,
        coverFile,
        squareIconFile,
        screenshotFiles,
        initialMemberIds,
        tenantId,
        visibilityGroupIds
    );
};

export const updateProjectFields = async (
    projectId: string,
    updates: Partial<Project>,
    activityMessage?: { action: string; target?: string; type?: Activity["type"] },
    tenantId?: string
) => {
    const { updateProjectFields: updateProjectFieldsDomain } = await import('./domain/projectAdminService');
    return updateProjectFieldsDomain(projectId, updates, activityMessage, tenantId);
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
    const { updateMilestone: updateMilestoneDomain } = await import('./domain/projectMetaService');
    return updateMilestoneDomain(projectId, milestoneId, updates, tenantId);
};

export const deleteMilestone = async (
    projectId: string,
    milestoneId: string,
    tenantId?: string
) => {
    const { deleteMilestone: deleteMilestoneDomain } = await import('./domain/projectMetaService');
    return deleteMilestoneDomain(projectId, milestoneId, tenantId);
};

export const subscribeProjectMilestones = (
    projectId: string,
    onUpdate: (milestones: Milestone[]) => void,
    tenantId?: string
): Unsubscribe => {
    let isCancelled = false;
    let unsubscribe: Unsubscribe = () => undefined;

    void import('./domain/projectMetaService').then(({ subscribeProjectMilestones: subscribeProjectMilestonesDomain }) => {
        if (isCancelled) {
            return;
        }
        unsubscribe = subscribeProjectMilestonesDomain(projectId, onUpdate, tenantId);
    });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
};

// --- Health Snapshots ---
// Store daily health score snapshots for historical tracking

export const HEALTH_SNAPSHOTS = "healthSnapshots";

export interface HealthSnapshot {
    id?: string;
    projectId: string;
    tenantId: string;
    score: number;
    status: string;
    trend: string;
    date: string; // YYYY-MM-DD format for easy querying
    timestamp: any; // Firestore timestamp for creation time
}

/**
 * Save a health snapshot for a project (typically called once per day)
 * Uses date as document ID to prevent duplicates
 */
export const saveHealthSnapshot = async (
    projectId: string,
    score: number,
    status: string,
    trend: string,
    tenantId?: string
): Promise<void> => {
    const { saveHealthSnapshot: saveHealthSnapshotDomain } = await import('./domain/projectInsightsService');
    return saveHealthSnapshotDomain(projectId, score, status, trend, tenantId);
};

/**
 * Get a specific health snapshot by date
 */
export const getHealthSnapshot = async (
    projectId: string,
    date: string,
    tenantId?: string
): Promise<HealthSnapshot | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snapshotRef = doc(projectSubCollection(resolvedTenant, projectId, HEALTH_SNAPSHOTS), date);
    const snap = await getDoc(snapshotRef);
    if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as HealthSnapshot;
    }
    return null;
};

/**
 * Subscribe to health snapshots for a project (last 30 days)
 */
export const subscribeHealthSnapshots = (
    projectId: string,
    onUpdate: (snapshots: HealthSnapshot[]) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        projectSubCollection(resolvedTenant, projectId, HEALTH_SNAPSHOTS),
        orderBy("date", "desc"),
        limit(30)
    );

    return onSnapshot(q, (snapshot) => {
        const snapshots = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as HealthSnapshot));
        onUpdate(snapshots);
    });
};

/**
 * Calculate health delta vs last week
 * Returns the difference in score from 7 days ago, or null if no data
 */
export const getHealthDelta = async (
    projectId: string,
    currentScore: number,
    tenantId?: string
): Promise<number | null> => {
    const { getHealthDelta: getHealthDeltaDomain } = await import('./domain/projectInsightsService');
    return getHealthDeltaDomain(projectId, currentScore, tenantId);
};

export const saveGeminiReport = async (projectId: string, content: string, tenantId?: string) => {
    const { saveGeminiReport: saveGeminiReportDomain } = await import('./domain/projectInsightsService');
    return saveGeminiReportDomain(projectId, content, tenantId);
};

export const getLatestGeminiReport = async (projectId: string, tenantId?: string): Promise<GeminiReport | null> => {
    const { getLatestGeminiReport: getLatestGeminiReportDomain } = await import('./domain/projectInsightsService');
    return getLatestGeminiReportDomain(projectId, tenantId);
};

// --- Email Templates (Main Drafts/Templates) ---

export const EMAIL_TEMPLATES = "email_templates";

export const getProjectTemplates = async (projectId: string, tenantId?: string) => {
    const { getProjectTemplates: getProjectTemplatesDomain } = await import('./domain/marketingTemplatesService');
    return getProjectTemplatesDomain(projectId, tenantId);
};

export const saveEmailTemplateDraft = async (projectId: string, blocks: EmailBlock[], variables: TemplateVariable[], tenantId?: string, name?: string, status: 'draft' | 'published' = 'draft', templateId?: string) => {
    const { saveEmailTemplateDraft: saveEmailTemplateDraftDomain } = await import('./domain/marketingTemplatesService');
    return saveEmailTemplateDraftDomain(projectId, blocks, variables, tenantId, name, status, templateId);
};

export const getTemplateVersions = async (projectId: string, templateId: string, tenantId?: string): Promise<EmailTemplate[]> => {
    const { getTemplateVersions: getTemplateVersionsDomain } = await import('./domain/marketingTemplatesService');
    return getTemplateVersionsDomain(projectId, templateId, tenantId);
};

export const getLatestEmailTemplateDraft = async (projectId: string, tenantId?: string): Promise<EmailTemplate | null> => {
    const { getLatestEmailTemplateDraft: getLatestEmailTemplateDraftDomain } = await import('./domain/marketingTemplatesService');
    return getLatestEmailTemplateDraftDomain(projectId, tenantId);
};

export const getEmailTemplateDrafts = async (projectId: string, tenantId?: string): Promise<EmailTemplate[]> => {
    const { getEmailTemplateDrafts: getEmailTemplateDraftsDomain } = await import('./domain/marketingTemplatesService');
    return getEmailTemplateDraftsDomain(projectId, tenantId);
};

export const deleteEmailTemplate = async (projectId: string, templateId: string, tenantId?: string) => {
    const { deleteEmailTemplate: deleteEmailTemplateDomain } = await import('./domain/marketingTemplatesService');
    return deleteEmailTemplateDomain(projectId, templateId, tenantId);
};

export const getEmailTemplateById = async (projectId: string, templateId: string, tenantId?: string): Promise<EmailTemplate | null> => {
    const { getEmailTemplateById: getEmailTemplateByIdDomain } = await import('./domain/marketingTemplatesService');
    return getEmailTemplateByIdDomain(projectId, templateId, tenantId);
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

type ProjectHydrationOptions = {
    hydrateAssets?: boolean;
    includeScreenshots?: boolean;
};

const hydrateProjectAssetUrls = async (
    project: Project,
    options: ProjectHydrationOptions = {}
): Promise<Project> => {
    if (options.hydrateAssets === false) {
        return project;
    }

    const tenantId = project.tenantId || '';
    if (!tenantId) return project;

    const next = { ...project };

    if (project.coverImageFileId) {
        try {
            const signed = await getTenantFileDownloadUrl({ tenantId, fileId: project.coverImageFileId });
            next.coverImage = signed.downloadUrl;
        } catch (error) {
            console.warn('Failed to hydrate project cover image URL', error);
        }
    } else if (project.coverImage) {
        try {
            next.coverImage = await refreshFirebaseStorageUrl(tenantId, project.coverImage);
        } catch (error) {
            console.warn('Failed to recover project cover image URL', error);
        }
    }

    if (project.squareIconFileId) {
        try {
            const signed = await getTenantFileDownloadUrl({ tenantId, fileId: project.squareIconFileId });
            next.squareIcon = signed.downloadUrl;
        } catch (error) {
            console.warn('Failed to hydrate project square icon URL', error);
        }
    } else if (project.squareIcon) {
        try {
            next.squareIcon = await refreshFirebaseStorageUrl(tenantId, project.squareIcon);
        } catch (error) {
            console.warn('Failed to recover project square icon URL', error);
        }
    }

    const shouldHydrateScreenshots = options.includeScreenshots !== false;

    if (shouldHydrateScreenshots && Array.isArray(project.screenshotFileIds) && project.screenshotFileIds.length > 0) {
        const screenshotUrls = await Promise.all(project.screenshotFileIds.map(async (fileId) => {
            try {
                const signed = await getTenantFileDownloadUrl({ tenantId, fileId });
                return signed.downloadUrl;
            } catch (error) {
                console.warn('Failed to hydrate project screenshot URL', error);
                return '';
            }
        }));
        next.screenshots = screenshotUrls.filter(Boolean);
    } else if (shouldHydrateScreenshots && Array.isArray(project.screenshots) && project.screenshots.length > 0) {
        const screenshotUrls = await Promise.all(project.screenshots.map(async (url) => {
            try {
                return await refreshFirebaseStorageUrl(tenantId, url);
            } catch (error) {
                console.warn('Failed to recover project screenshot URL', error);
                return url;
            }
        }));
        next.screenshots = screenshotUrls.filter(Boolean);
    }

    return next;
};

export const getProjectById = async (projectId: string, tenantId?: string): Promise<Project | null> => {
    const { getProjectById: getProjectByIdDomain } = await import('./domain/projectsService');
    return getProjectByIdDomain(projectId, tenantId);
};

export const deleteProjectById = async (projectId: string, tenantId?: string) => {
    const { deleteProjectById: deleteProjectByIdDomain } = await import('./domain/projectAdminService');
    return deleteProjectByIdDomain(projectId, tenantId);
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

    const projects = snapshot.docs
        .map(docSnap => ({
            id: docSnap.id,
            tenantId: getTenantIdFromRef(docSnap.ref), // Extract tenant from path
            ...docSnap.data()
        } as Project))
        .filter(p => p.ownerId !== user.uid) // Exclude owned projects
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    return Promise.all(projects.map((project) => hydrateProjectAssetUrls(project)));
};

export const getAllMemberProjects = async (userId: string): Promise<Project[]> => {
    const { getAllMemberProjects: getAllMemberProjectsDomain } = await import('./domain/profileService');
    return getAllMemberProjectsDomain(userId);
};


export const getUserGlobalActivities = async (tenantId?: string, limitCount = 20): Promise<Activity[]> => {
    const { getUserGlobalActivities: getUserGlobalActivitiesDomain } = await import('./domain/profileService');
    return getUserGlobalActivitiesDomain(tenantId, limitCount);
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

    // Filter out the member - handle both legacy string[] and new ProjectMember[] formats
    const updatedMembers = members.filter(m => {
        const memberId = typeof m === 'string' ? m : m.userId;
        return memberId !== userId;
    });

    await updateDoc(projectRef, {
        members: updatedMembers as any,
        memberIds: arrayRemove(userId),
        updatedAt: serverTimestamp()
    });
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
    const { generateInviteLink: generateInviteLinkDomain } = await import('./domain/projectAdminService');
    return generateInviteLinkDomain(projectId, role, maxUses, expiresInHours, tenantId);
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
    const { joinProjectViaLink: joinProjectViaLinkDomain } = await import('./domain/inviteLinksService');
    return joinProjectViaLinkDomain(inviteLinkId, projectId, tenantId);
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
    const { sendTeamInvitation: sendTeamInvitationDomain } = await import('./domain/projectAdminService');
    return sendTeamInvitationDomain(email, type, targetId, role, tenantId);
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
    const { generateWorkspaceInviteLink: generateWorkspaceInviteLinkDomain } = await import('./domain/inviteLinksService');
    return generateWorkspaceInviteLinkDomain(role, maxUses, expiresInHours, tenantId);
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
    const { joinWorkspaceViaLink: joinWorkspaceViaLinkDomain } = await import('./domain/inviteLinksService');
    return joinWorkspaceViaLinkDomain(inviteLinkId, tenantId);
};

export const getWorkspaceInviteLinks = async (tenantId?: string): Promise<any[]> => {
    const { getWorkspaceInviteLinks: getWorkspaceInviteLinksDomain } = await import('./domain/inviteLinksService');
    return getWorkspaceInviteLinksDomain(tenantId);
};

export const revokeWorkspaceInviteLink = async (inviteLinkId: string, tenantId?: string) => {
    const { revokeWorkspaceInviteLink: revokeWorkspaceInviteLinkDomain } = await import('./domain/inviteLinksService');
    return revokeWorkspaceInviteLinkDomain(inviteLinkId, tenantId);
};

export const getProjectInviteLinks = async (projectId: string, tenantId?: string): Promise<any[]> => {
    const { getProjectInviteLinks: getProjectInviteLinksDomain } = await import('./domain/inviteLinksService');
    return getProjectInviteLinksDomain(projectId, tenantId);
};

export const revokeProjectInviteLink = async (projectId: string, inviteLinkId: string, tenantId?: string) => {
    const { revokeProjectInviteLink: revokeProjectInviteLinkDomain } = await import('./domain/inviteLinksService');
    return revokeProjectInviteLinkDomain(projectId, inviteLinkId, tenantId);
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
export const getAllWorkspaceProjects = async (
    tenantId?: string,
    hydrationOptions?: ProjectHydrationOptions
): Promise<Project[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const resolvedTenant = tenantId || getCachedTenantId() || user.uid;
    await ensureTenantAndUser(resolvedTenant);

    const snapshot = await getDocs(projectsCollection(resolvedTenant));
    const projects = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Project))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    return Promise.all(projects.map((project) => hydrateProjectAssetUrls({ ...project, tenantId: resolvedTenant }, hydrationOptions)));
};

const cloneOverviewLayout = (layout: ProjectOverviewLayout): ProjectOverviewLayout => ({
    layoutVersion: layout.layoutVersion,
    templateId: layout.templateId,
    cards: layout.cards.map((card) => ({ ...card }))
});

const isOverviewLayoutAtDefault = (layout?: ProjectOverviewLayout): boolean => {
    if (!layout) return true;
    if (layout.templateId !== DEFAULT_PROJECT_OVERVIEW_LAYOUT.templateId) return false;
    if (!Array.isArray(layout.cards)) return false;
    if (layout.cards.length !== DEFAULT_PROJECT_OVERVIEW_LAYOUT.cards.length) return false;

    for (let i = 0; i < DEFAULT_PROJECT_OVERVIEW_LAYOUT.cards.length; i += 1) {
        const currentCard = layout.cards[i];
        const defaultCard = DEFAULT_PROJECT_OVERVIEW_LAYOUT.cards[i];
        if (currentCard.id !== defaultCard.id) return false;
        if (currentCard.enabled !== defaultCard.enabled) return false;
        if (currentCard.span !== defaultCard.span) return false;
        if (currentCard.placement !== defaultCard.placement) return false;
    }

    return true;
};

export const createDefaultProjectOverviewLayout = (): ProjectOverviewLayout => (
    cloneOverviewLayout(DEFAULT_PROJECT_OVERVIEW_LAYOUT)
);

/**
 * One-time migration utility used during rollout:
 * reset all existing workspace overview layouts back to core defaults.
 */
export const resetWorkspaceOverviewLayoutsToDefault = async (
    tenantId?: string
): Promise<Array<{ id: string; overviewLayout: ProjectOverviewLayout }>> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const snapshot = await getDocs(projectsCollection(resolvedTenant));
    const projectsToReset = snapshot.docs
        .map((projectDoc) => ({ projectDoc, projectData: projectDoc.data() as Project }))
        .filter(({ projectData }) => !isOverviewLayoutAtDefault(projectData.overviewLayout))
        .map(({ projectDoc }) => projectDoc);

    if (projectsToReset.length === 0) {
        return [];
    }

    const changedProjects: Array<{ id: string; overviewLayout: ProjectOverviewLayout }> = [];
    let batch = writeBatch(db);
    let ops = 0;

    const commitBatch = async () => {
        if (ops === 0) return;
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
    };

    for (const projectDoc of projectsToReset) {
        const defaultLayout = createDefaultProjectOverviewLayout();
        batch.update(projectDoc.ref, {
            overviewLayout: defaultLayout,
            updatedAt: serverTimestamp()
        });
        ops += 1;
        changedProjects.push({ id: projectDoc.id, overviewLayout: defaultLayout });
        if (ops >= 400) {
            await commitBatch();
        }
    }

    await commitBatch();

    return changedProjects;
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
    const projects = (await getAllWorkspaceProjects(resolvedTenant)).filter(isProjectIncludedInImportantSignals);

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
    const { getProjectCategories: getProjectCategoriesDomain } = await import('./domain/projectMetaService');
    return getProjectCategoriesDomain(projectId, tenantId);
};

export const createInitiative = async (
    projectId: string,
    title: string,
    payload?: Partial<Initiative>,
    tenantId?: string
) => {
    const { createInitiative: createInitiativeDomain } = await import('./domain/initiativesService');
    return createInitiativeDomain(projectId, title, payload, tenantId);
};

export const getInitiativeById = async (
    initiativeId: string,
    projectId?: string,
    tenantId?: string
): Promise<Initiative | null> => {
    const { getInitiativeById: getInitiativeByIdDomain } = await import('./domain/initiativesService');
    return getInitiativeByIdDomain(initiativeId, projectId, tenantId);
};

export const getProjectInitiatives = async (
    projectId: string,
    tenantId?: string
): Promise<Initiative[]> => {
    const { getProjectInitiatives: getProjectInitiativesDomain } = await import('./domain/initiativesService');
    return getProjectInitiativesDomain(projectId, tenantId);
};

export const updateInitiative = async (
    initiativeId: string,
    updates: Partial<Initiative>,
    projectId?: string,
    tenantId?: string
) => {
    const { updateInitiative: updateInitiativeDomain } = await import('./domain/initiativesService');
    return updateInitiativeDomain(initiativeId, updates, projectId, tenantId);
};

export const deleteInitiative = async (
    initiativeId: string,
    projectId?: string,
    tenantId?: string
) => {
    const { deleteInitiative: deleteInitiativeDomain } = await import('./domain/initiativesService');
    return deleteInitiativeDomain(initiativeId, projectId, tenantId);
};

export const getInitiativeTasks = async (
    projectId: string,
    initiativeId: string,
    tenantId?: string
): Promise<Task[]> => {
    const { getInitiativeTasks: getInitiativeTasksDomain } = await import('./domain/initiativesService');
    return getInitiativeTasksDomain(projectId, initiativeId, tenantId);
};

export const updateTaskInitiative = async (
    taskId: string,
    initiativeId: string | null,
    projectId?: string,
    tenantId?: string
) => {
    const { updateTaskInitiative: updateTaskInitiativeDomain } = await import('./domain/initiativesService');
    return updateTaskInitiativeDomain(taskId, initiativeId, projectId, tenantId);
};

export const createInitiativeTask = async (
    projectId: string,
    initiativeId: string,
    title: string,
    options?: Partial<Task> & { dueDate?: string },
    tenantId?: string
) => {
    const { createInitiativeTask: createInitiativeTaskDomain } = await import('./domain/initiativesService');
    return createInitiativeTaskDomain(projectId, initiativeId, title, options, tenantId);
};

export const ensureProjectInitiativesMigrated = async (projectId: string, tenantId?: string) => {
    const { ensureProjectInitiativesMigrated: ensureProjectInitiativesMigratedDomain } = await import('./domain/initiativesService');
    return ensureProjectInitiativesMigratedDomain(projectId, tenantId);
};

export const addTask = async (
    projectId: string,
    title: string,
    dueDate?: string,
    assignee?: string,
    priority: Task['priority'] = "Medium",
    extra?: Partial<Pick<Task, 'description' | 'category' | 'status' | 'assigneeId' | 'assigneeIds' | 'assignedGroupIds' | 'linkedIssueId' | 'convertedIdeaId' | 'initiativeId' | 'legacyInitiativeRoot' | 'startDate'>>,
    tenantId?: string
) => {
    const { addTask: addTaskDomain } = await import('./domain/tasksService');
    return addTaskDomain(projectId, title, dueDate, assignee, priority, extra, tenantId);
};

export const createSubTask = async (
    projectId: string,
    taskId: string,
    title: string,
    assigneeId?: string,
    tenantId?: string
) => {
    const { createSubTask: createSubTaskDomain } = await import('./domain/tasksService');
    return createSubTaskDomain(projectId, taskId, title, assigneeId, tenantId);
};

export const getTaskById = async (taskId: string, projectId?: string, tenantId?: string): Promise<Task | null> => {
    const { getTaskById: getTaskByIdDomain } = await import('./domain/tasksService');
    return getTaskByIdDomain(taskId, projectId, tenantId);
};

export const getProjectTasks = async (projectId: string, tenantId?: string): Promise<Task[]> => {
    const { getProjectTasks: getProjectTasksDomain } = await import('./domain/tasksService');
    return getProjectTasksDomain(projectId, tenantId);
};

export const getUserTasks = async (): Promise<Task[]> => {
    const { getUserTasks: getUserTasksDomain } = await import('./domain/tasksService');
    return getUserTasksDomain();
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

    const relevantProjects = allProjects
        .filter(isProjectIncludedInImportantSignals)
        .filter(p => p.memberIds?.includes(user.uid) || p.ownerId === user.uid);

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
    const relevantProjects = allProjects
        .filter(isProjectIncludedInImportantSignals)
        .filter(p =>
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
    const { updateTask: updateTaskDomain } = await import('./domain/tasksService');
    return updateTaskDomain(taskId, updates, projectId, tenantId, path);
};

export const toggleTaskStatus = async (taskId: string, currentStatus: boolean, projectId?: string, tenantId?: string) => {
    const { toggleTaskStatus: toggleTaskStatusDomain } = await import('./domain/tasksService');
    return toggleTaskStatusDomain(taskId, currentStatus, projectId, tenantId);
};

export const updateTaskFields = async (taskId: string, updates: Partial<Task>, projectId?: string, tenantId?: string) => {
    const { updateTaskFields: updateTaskFieldsDomain } = await import('./domain/tasksService');
    return updateTaskFieldsDomain(taskId, updates, projectId, tenantId);
};

export const deleteTask = async (taskId: string, projectId?: string, tenantId?: string) => {
    const { deleteTask: deleteTaskDomain } = await import('./domain/tasksService');
    return deleteTaskDomain(taskId, projectId, tenantId);
};

// --- Subtasks ---

export const addSubTask = async (taskId: string, title: string, projectId?: string, tenantId?: string) => {
    const { addSubTask: addSubTaskDomain } = await import('./domain/tasksService');
    return addSubTaskDomain(taskId, title, projectId, tenantId);
};

export const getSubTasks = async (taskId: string, projectId?: string, tenantId?: string): Promise<SubTask[]> => {
    const { getSubTasks: getSubTasksDomain } = await import('./domain/tasksService');
    return getSubTasksDomain(taskId, projectId, tenantId);
};

export const toggleSubTaskStatus = async (
    subTaskId: string,
    currentStatus: boolean,
    taskId?: string,
    projectId?: string,
    tenantId?: string
) => {
    const { toggleSubTaskStatus: toggleSubTaskStatusDomain } = await import('./domain/tasksService');
    return toggleSubTaskStatusDomain(subTaskId, currentStatus, taskId, projectId, tenantId);
};

export const deleteSubTask = async (subTaskId: string, taskId: string, projectId?: string, tenantId?: string) => {
    const { deleteSubTask: deleteSubTaskDomain } = await import('./domain/tasksService');
    return deleteSubTaskDomain(subTaskId, taskId, projectId, tenantId);
};

export const updateSubtaskFields = async (
    subTaskId: string,
    updates: Partial<SubTask>,
    taskId?: string,
    projectId?: string,
    tenantId?: string
) => {
    const { updateSubtaskFields: updateSubtaskFieldsDomain } = await import('./domain/tasksService');
    return updateSubtaskFieldsDomain(subTaskId, updates, taskId, projectId, tenantId);
};

// --- Ideas ---

export const saveIdea = async (idea: Partial<Idea>, tenantId?: string) => {
    void idea;
    void tenantId;
    throw new Error('Ideas are removed in PM-core mode.');
};

export const updateIdea = async (ideaId: string, updates: Partial<Idea>, projectId?: string, tenantId?: string) => {
    void ideaId;
    void updates;
    void projectId;
    void tenantId;
    throw new Error('Ideas are removed in PM-core mode.');
};

export const deleteIdea = async (ideaId: string, projectId?: string, tenantId?: string) => {
    void ideaId;
    void projectId;
    void tenantId;
    throw new Error('Ideas are removed in PM-core mode.');
};

export const getUserIdeas = async (): Promise<Idea[]> => {
    return [];
};

export const getProjectIdeas = async (projectId: string, tenantId?: string): Promise<Idea[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, IDEAS));
    return snapshot.docs
        .map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as Idea))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

// --- Activity ---

export const getProjectActivity = async (projectId: string, tenantId?: string): Promise<Activity[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const snapshot = await getDocs(query(
        projectSubCollection(resolvedTenant, projectId, ACTIVITIES),
        orderBy('createdAt', 'desc'),
        limit(100)
    ));
    return snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Activity))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const subscribeTaskActivity = (projectId: string, taskId: string, callback: (activities: Activity[]) => void, tenantId?: string) => {
    let isCancelled = false;
    let unsubscribe: Unsubscribe = () => undefined;

    void import('./domain/tasksService').then(({ subscribeTaskActivity: subscribeTaskActivityDomain }) => {
        if (isCancelled) {
            return;
        }
        unsubscribe = subscribeTaskActivityDomain(projectId, taskId, callback, tenantId);
    });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
};

// --- Issues ---

export const createIssue = async (projectId: string, issue: Partial<Issue>, tenantId?: string) => {
    void projectId;
    void issue;
    void tenantId;
    throw new Error('Issues are removed in PM-core mode.');
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
    void issueId;
    void projectId;
    void tenantId;
    return null;
};


export const updateIssue = async (issueId: string, updates: Partial<Issue>, projectId: string, tenantId?: string, path?: string) => {
    void issueId;
    void updates;
    void projectId;
    void tenantId;
    void path;
    throw new Error('Issues are removed in PM-core mode.');
};

export const deleteIssue = async (issueId: string, projectId: string, tenantId?: string, path?: string) => {
    void issueId;
    void projectId;
    void tenantId;
    void path;
    throw new Error('Issues are removed in PM-core mode.');
};

export const subscribeProjectIssues = (
    projectId: string,
    callback: (issues: Issue[]) => void,
    tenantId?: string
) => {
    void projectId;
    void tenantId;
    callback([]);
    return () => undefined;
};

// --- Realtime subscriptions ---

export const subscribeProjectTasks = (
    projectId: string,
    callback: (tasks: Task[]) => void,
    tenantId?: string
) => {
    let unsubscribe: Unsubscribe = () => undefined;
    let isCancelled = false;

    import('./domain/tasksService')
        .then(({ subscribeProjectTasks: subscribeProjectTasksDomain }) => {
            if (isCancelled) {
                return;
            }
            unsubscribe = subscribeProjectTasksDomain(projectId, callback, tenantId);
        })
        .catch((error) => {
            console.error('Failed to subscribe project tasks', error);
        });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
};

export const subscribeProjectInitiatives = (
    projectId: string,
    callback: (initiatives: Initiative[]) => void,
    tenantId?: string
) => {
    let unsubscribe: Unsubscribe = () => undefined;
    let isCancelled = false;

    import('./domain/initiativesService')
        .then(({ subscribeProjectInitiatives: subscribeProjectInitiativesDomain }) => {
            if (isCancelled) {
                return;
            }
            unsubscribe = subscribeProjectInitiativesDomain(projectId, callback, tenantId);
        })
        .catch((error) => {
            console.error('Failed to subscribe project initiatives', error);
        });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
};

export const subscribeInitiativeTasks = (
    projectId: string,
    initiativeId: string,
    callback: (tasks: Task[]) => void,
    tenantId?: string
) => {
    let unsubscribe: Unsubscribe = () => undefined;
    let isCancelled = false;

    import('./domain/initiativesService')
        .then(({ subscribeInitiativeTasks: subscribeInitiativeTasksDomain }) => {
            if (isCancelled) {
                return;
            }
            unsubscribe = subscribeInitiativeTasksDomain(projectId, initiativeId, callback, tenantId);
        })
        .catch((error) => {
            console.error('Failed to subscribe initiative tasks', error);
        });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
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
    const { updateUserProfile: updateUserProfileDomain } = await import('./domain/usersService');
    return updateUserProfileDomain(data);
};

export const getUserProfileStats = async (uid: string, tenantId?: string) => {
    const { getUserProfileStats: getUserProfileStatsDomain } = await import('./domain/profileService');
    return getUserProfileStatsDomain(uid, tenantId);
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
    let unsubscribe: Unsubscribe = () => undefined;
    let isCancelled = false;

    void import('./domain/workspaceMembersService').then(({ subscribeWorkspaceMembers: subscribeWorkspaceMembersDomain }) => {
        if (isCancelled) {
            return;
        }
        unsubscribe = subscribeWorkspaceMembersDomain(callback, tenantId);
    });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
};

export const subscribeProject = (
    projectId: string,
    callback: (project: Project | null) => void,
    tenantId?: string
) => {
    let unsubscribe: Unsubscribe = () => undefined;
    let isCancelled = false;

    void import('./domain/projectsService').then(({ subscribeProject: subscribeProjectDomain }) => {
        if (isCancelled) {
            return;
        }
        unsubscribe = subscribeProjectDomain(projectId, callback, tenantId);
    }).catch((error) => {
        console.error('Failed to subscribe project', error);
        callback(null);
    });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
};

export const subscribeProjectIdeas = (
    projectId: string,
    callback: (ideas: Idea[]) => void,
    tenantId?: string
) => {
    void projectId;
    void tenantId;
    callback([]);
    return () => undefined;
};

export const subscribeProjectActivity = (
    projectId: string,
    callback: (activity: Activity[]) => void,
    tenantId?: string
) => {
    let unsubscribe: Unsubscribe = () => undefined;
    let isCancelled = false;

    void import('./domain/activityService').then(({ subscribeProjectActivity: subscribeProjectActivityDomain }) => {
        if (isCancelled) {
            return;
        }
        unsubscribe = subscribeProjectActivityDomain(projectId, callback, tenantId);
    });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
};

export const subscribeTenantUsers = (
    callback: (users: { id: string; email?: string; displayName?: string; photoURL?: string; joinedAt?: any; role?: WorkspaceRole; groupIds?: string[] }[]) => void,
    tenantId?: string
) => {
    let isCancelled = false;
    let unsubscribe: Unsubscribe = () => undefined;

    void import('./domain/workspaceMembersService').then(({ subscribeTenantUsers: subscribeTenantUsersDomain }) => {
        if (isCancelled) {
            return;
        }
        unsubscribe = subscribeTenantUsersDomain(callback, tenantId);
    });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
};

// --- Comments ---

export const addComment = async (
    projectId: string,
    targetId: string,
    targetType: 'task' | 'issue' | 'idea' | 'initiative',
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
    } else if (targetType === 'initiative') {
        const initiativeSnap = await findInitiativeDoc(targetId, projectId, resolvedTenant);
        if (initiativeSnap) {
            const initiative = initiativeSnap.data() as Initiative;
            targetTitle = initiative.title;
            ownerId = initiative.ownerId || '';
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
    return [];
};

export const subscribeTenantProjects = (
    callback: (projects: Project[]) => void,
    tenantId?: string
) => {
    let unsubscribe = () => undefined;
    let isCancelled = false;

    void import('./domain/projectsService')
        .then(({ subscribeTenantProjects: subscribeTenantProjectsDomain }) => {
            if (isCancelled) {
                return;
            }
            unsubscribe = subscribeTenantProjectsDomain(callback, tenantId);
        })
        .catch((error) => {
            console.error('Failed to subscribe to tenant projects', error);
            callback([]);
        });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
};

// --- Workspace Groups & Permissions ---

export const updateUserRole = async (
    targetUserId: string,
    newRole: WorkspaceRole,
    tenantId?: string
) => {
    const { updateUserRole: updateUserRoleDomain } = await import('./domain/workspaceMembersService');
    return updateUserRoleDomain(targetUserId, newRole, tenantId);
};

export const subscribeWorkspaceGroups = (
    callback: (groups: WorkspaceGroup[]) => void,
    tenantId?: string
) => {
    let unsubscribe = () => undefined;
    let isCancelled = false;

    void import('./domain/workspaceGroupsService')
        .then(({ subscribeWorkspaceGroups: subscribeWorkspaceGroupsDomain }) => {
            if (isCancelled) {
                return;
            }
            unsubscribe = subscribeWorkspaceGroupsDomain(callback, tenantId);
        })
        .catch((error) => {
            console.error('Failed to subscribe to workspace groups', error);
            callback([]);
        });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
};

export const getWorkspaceGroups = async (tenantId?: string): Promise<WorkspaceGroup[]> => {
    const { getWorkspaceGroups: getWorkspaceGroupsDomain } = await import('./domain/workspaceGroupsService');
    return getWorkspaceGroupsDomain(tenantId);
};

export const createWorkspaceGroup = async (
    name: string,
    color?: string,
    description?: string,
    tenantId?: string
) => {
    const { createWorkspaceGroup: createWorkspaceGroupDomain } = await import('./domain/workspaceGroupsService');
    return createWorkspaceGroupDomain(name, color, description, tenantId);
};

export const updateWorkspaceGroup = async (
    groupId: string,
    data: Partial<WorkspaceGroup>,
    tenantId?: string
) => {
    const { updateWorkspaceGroup: updateWorkspaceGroupDomain } = await import('./domain/workspaceGroupsService');
    return updateWorkspaceGroupDomain(groupId, data, tenantId);
};

export const deleteWorkspaceGroup = async (
    groupId: string,
    tenantId?: string
) => {
    const { deleteWorkspaceGroup: deleteWorkspaceGroupDomain } = await import('./domain/workspaceGroupsService');
    return deleteWorkspaceGroupDomain(groupId, tenantId);
};

export const addUserToGroup = async (
    userId: string,
    groupId: string,
    tenantId?: string
) => {
    const { addUserToGroup: addUserToGroupDomain } = await import('./domain/workspaceGroupsService');
    return addUserToGroupDomain(userId, groupId, tenantId);
};

export const removeUserFromGroup = async (
    userId: string,
    groupId: string,
    tenantId?: string
) => {
    const { removeUserFromGroup: removeUserFromGroupDomain } = await import('./domain/workspaceGroupsService');
    return removeUserFromGroupDomain(userId, groupId, tenantId);
};

/**
 * Remove a user from the workspace completely.
 * This removes them from all workspace groups and deletes their user document in the tenant.
 */
export const removeUserFromWorkspace = async (userId: string, tenantId: string) => {
    const { removeUserFromWorkspace: removeUserFromWorkspaceDomain } = await import('./domain/workspaceMembersService');
    return removeUserFromWorkspaceDomain(userId, tenantId);
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
    const { getSocialCampaign: getSocialCampaignDomain } = await import('./domain/socialService');
    return getSocialCampaignDomain(projectId, campaignId, tenantId);
};


export const createSocialCampaign = async (
    projectId: string,
    campaignData: Omit<SocialCampaign, 'id' | 'createdAt' | 'updatedAt'>,
    tenantId?: string
) => {
    const { createSocialCampaign: createSocialCampaignDomain } = await import('./domain/socialService');
    return createSocialCampaignDomain(projectId, campaignData, tenantId);
};

export const subscribeCampaigns = (
    projectId: string,
    onUpdate: (campaigns: SocialCampaign[]) => void,
    tenantId?: string
): Unsubscribe => {
    let unsubscribe: Unsubscribe = () => undefined;
    let disposed = false;

    import('./domain/socialService').then(({ subscribeCampaigns: subscribeCampaignsDomain }) => {
        const nextUnsubscribe = subscribeCampaignsDomain(projectId, onUpdate, tenantId);
        if (disposed) {
            nextUnsubscribe();
            return;
        }
        unsubscribe = nextUnsubscribe;
    });

    return () => {
        disposed = true;
        unsubscribe();
    };
};

export const updateCampaign = async (
    projectId: string,
    campaignId: string,
    updates: Partial<SocialCampaign>,
    tenantId?: string
) => {
    const { updateCampaign: updateCampaignDomain } = await import('./domain/socialService');
    return updateCampaignDomain(projectId, campaignId, updates, tenantId);
};

export const deleteCampaign = async (
    projectId: string,
    campaignId: string,
    tenantId?: string
) => {
    const { deleteCampaign: deleteCampaignDomain } = await import('./domain/socialService');
    return deleteCampaignDomain(projectId, campaignId, tenantId);
};

// Social Posts
export const createSocialPost = async (
    projectId: string,
    postData: Omit<SocialPost, "id" | "createdAt" | "updatedAt" | "createdBy">,
    tenantId?: string
) => {
    const { createSocialPost: createSocialPostDomain } = await import('./domain/socialService');
    return createSocialPostDomain(projectId, postData, tenantId);
};

export const subscribeSocialPosts = (
    projectId: string,
    onUpdate: (posts: SocialPost[]) => void,
    tenantId?: string,
    campaignId?: string
): Unsubscribe => {
    let unsubscribe: Unsubscribe = () => undefined;
    let disposed = false;

    import('./domain/socialService').then(({ subscribeSocialPosts: subscribeSocialPostsDomain }) => {
        const nextUnsubscribe = subscribeSocialPostsDomain(projectId, onUpdate, tenantId, campaignId);
        if (disposed) {
            nextUnsubscribe();
            return;
        }
        unsubscribe = nextUnsubscribe;
    });

    return () => {
        disposed = true;
        unsubscribe();
    };
};

export const updateSocialPost = async (
    projectId: string,
    postId: string,
    updates: Partial<SocialPost>,
    tenantId?: string
) => {
    const { updateSocialPost: updateSocialPostDomain } = await import('./domain/socialService');
    return updateSocialPostDomain(projectId, postId, updates, tenantId);
};

export const deleteSocialPost = async (
    projectId: string,
    postId: string,
    tenantId?: string
) => {
    const { deleteSocialPost: deleteSocialPostDomain } = await import('./domain/socialService');
    return deleteSocialPostDomain(projectId, postId, tenantId);
};

export const getSocialPostById = async (
    projectId: string,
    postId: string,
    tenantId?: string
): Promise<SocialPost | null> => {
    const { getSocialPostById: getSocialPostByIdDomain } = await import('./domain/socialService');
    return getSocialPostByIdDomain(projectId, postId, tenantId);
};

// Assets
export const createSocialAsset = async (
    projectId: string,
    assetData: Omit<SocialAsset, "id" | "createdAt" | "createdBy">,
    tenantId?: string
) => {
    const { createSocialAsset: createSocialAssetDomain } = await import('./domain/socialService');
    return createSocialAssetDomain(projectId, assetData, tenantId);
};

export const subscribeSocialAssets = (
    projectId: string,
    onUpdate: (assets: SocialAsset[]) => void,
    tenantId?: string
): Unsubscribe => {
    let unsubscribe: Unsubscribe = () => undefined;
    let disposed = false;

    import('./domain/socialService').then(({ subscribeSocialAssets: subscribeSocialAssetsDomain }) => {
        const nextUnsubscribe = subscribeSocialAssetsDomain(projectId, onUpdate, tenantId);
        if (disposed) {
            nextUnsubscribe();
            return;
        }
        unsubscribe = nextUnsubscribe;
    });

    return () => {
        disposed = true;
        unsubscribe();
    };
};

export const deleteSocialAsset = async (projectId: string, assetId: string, tenantId?: string) => {
    const { deleteSocialAsset: deleteSocialAssetDomain } = await import('./domain/socialService');
    return deleteSocialAssetDomain(projectId, assetId, tenantId);
};

// Social Integrations
export const SOCIAL_INTEGRATIONS = 'social_integrations';

// --- Caption Presets ---

export const createCaptionPreset = async (
    projectId: string,
    presetData: Omit<CaptionPreset, "id" | "createdAt" | "createdBy">,
    tenantId?: string
): Promise<string> => {
    const { createCaptionPreset: createCaptionPresetDomain } = await import('./domain/socialSettingsService');
    return createCaptionPresetDomain(projectId, presetData, tenantId);
};

export const subscribeCaptionPresets = (
    projectId: string,
    onUpdate: (presets: CaptionPreset[]) => void,
    tenantId?: string
): Unsubscribe => {
    let unsubscribe: Unsubscribe = () => undefined;
    let disposed = false;

    import('./domain/socialSettingsService').then(({ subscribeCaptionPresets: subscribeCaptionPresetsDomain }) => {
        const nextUnsubscribe = subscribeCaptionPresetsDomain(projectId, onUpdate, tenantId);
        if (disposed) {
            nextUnsubscribe();
            return;
        }
        unsubscribe = nextUnsubscribe;
    });

    return () => {
        disposed = true;
        unsubscribe();
    };
};

export const updateCaptionPreset = async (
    projectId: string,
    presetId: string,
    updates: Partial<CaptionPreset>,
    tenantId?: string
): Promise<void> => {
    const { updateCaptionPreset: updateCaptionPresetDomain } = await import('./domain/socialSettingsService');
    return updateCaptionPresetDomain(projectId, presetId, updates, tenantId);
};

export const deleteCaptionPreset = async (
    projectId: string,
    presetId: string,
    tenantId?: string
): Promise<void> => {
    const { deleteCaptionPreset: deleteCaptionPresetDomain } = await import('./domain/socialSettingsService');
    return deleteCaptionPresetDomain(projectId, presetId, tenantId);
};

export const subscribeIntegrations = (
    projectId: string,
    onUpdate: (integrations: SocialIntegration[]) => void,
    tenantId?: string
) => {
    let unsubscribe: Unsubscribe = () => undefined;
    let disposed = false;

    import('./domain/socialSettingsService').then(({ subscribeIntegrations: subscribeIntegrationsDomain }) => {
        const nextUnsubscribe = subscribeIntegrationsDomain(projectId, onUpdate, tenantId);
        if (disposed) {
            nextUnsubscribe();
            return;
        }
        unsubscribe = nextUnsubscribe;
    });

    return () => {
        disposed = true;
        unsubscribe();
    };
};

export const connectIntegration = async (projectId: string, platform: SocialPlatform, existingAccessToken?: string, tenantId?: string) => {
    const { connectIntegration: connectIntegrationDomain } = await import('./domain/socialSettingsService');
    return connectIntegrationDomain(projectId, platform, existingAccessToken, tenantId);
};

export const disconnectIntegration = async (projectId: string, integrationId: string, tenantId?: string) => {
    const { disconnectIntegration: disconnectIntegrationDomain } = await import('./domain/socialSettingsService');
    return disconnectIntegrationDomain(projectId, integrationId, tenantId);
};

// --- Personal Task Compatibility Facade ---

export const addPersonalTask = async (
    title: string,
    dueDate?: string,
    priority: PersonalTask['priority'] = 'Medium',
    extra?: Partial<Pick<PersonalTask, 'description' | 'scheduledDate'>>,
    tenantId?: string
): Promise<string> => {
    const { addPersonalTask: addPersonalTaskDomain } = await import('./domain/personalTasksService');
    return addPersonalTaskDomain(title, dueDate, priority, extra, tenantId);
};

export const getPersonalTasks = async (tenantId?: string): Promise<PersonalTask[]> => {
    const { getPersonalTasks: getPersonalTasksDomain } = await import('./domain/personalTasksService');
    return getPersonalTasksDomain(tenantId);
};

export const updatePersonalTask = async (
    taskId: string,
    updates: Partial<PersonalTask>,
    tenantId?: string
): Promise<void> => {
    const { updatePersonalTask: updatePersonalTaskDomain } = await import('./domain/personalTasksService');
    return updatePersonalTaskDomain(taskId, updates, tenantId);
};

export const deletePersonalTask = async (taskId: string, tenantId?: string): Promise<void> => {
    const { deletePersonalTask: deletePersonalTaskDomain } = await import('./domain/personalTasksService');
    return deletePersonalTaskDomain(taskId, tenantId);
};

export const togglePersonalTaskStatus = async (
    taskId: string,
    currentStatus: boolean,
    tenantId?: string
): Promise<void> => {
    const { togglePersonalTaskStatus: togglePersonalTaskStatusDomain } = await import('./domain/personalTasksService');
    return togglePersonalTaskStatusDomain(taskId, currentStatus, tenantId);
};

/**
 * Move a personal task to a project (converts it to a regular task)
 */
export const movePersonalTaskToProject = async (
    personalTaskId: string,
    targetProjectId: string,
    tenantId?: string
): Promise<string> => {
    const { movePersonalTaskToProject: movePersonalTaskToProjectDomain } = await import('./domain/personalTasksService');
    return movePersonalTaskToProjectDomain(personalTaskId, targetProjectId, tenantId);
};

/**
 * Get a single personal task by ID
 */
export const getPersonalTaskById = async (
    taskId: string,
    tenantId?: string
): Promise<PersonalTask | null> => {
    const { getPersonalTaskById: getPersonalTaskByIdDomain } = await import('./domain/personalTasksService');
    return getPersonalTaskByIdDomain(taskId, tenantId);
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
    permissions: APITokenPermission[],
    projectScope?: string,
    expiresAt?: Date,
    tenantId?: string
): Promise<{ token: string; id: string }> => {
    const resolvedTenant = resolveTenantId(tenantId);
    return createWorkspaceApiToken(resolvedTenant, name, permissions, projectScope, expiresAt);
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
    return listWorkspaceApiTokens(resolvedTenant);
};

/**
 * Delete an API token
 */
export const deleteAPIToken = async (tokenId: string, tenantId?: string): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteWorkspaceApiToken(resolvedTenant, tokenId);
};

/**
 * Validate an API token (used by Cloud Functions)
 * This is a client-side version for testing - the real validation happens in Cloud Functions
 */
export const validateAPITokenLocally = async (
    plainToken: string,
    requiredPermission: APITokenPermission,
    tenantId: string
): Promise<{ valid: boolean; tokenData?: any; error?: string }> => {
    void plainToken;
    void requiredPermission;
    void tenantId;

    return {
        valid: false,
        error: 'Client-side API token validation is no longer supported. Use the backend validation path.'
    };
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

export const subscribeSocialStrategy = (
    projectId: string,
    onUpdate: (strategy: SocialStrategy | null) => void,
    tenantId?: string
) => {
    let unsubscribe: Unsubscribe = () => undefined;
    let disposed = false;

    import('./domain/socialSettingsService').then(({ subscribeSocialStrategy: subscribeSocialStrategyDomain }) => {
        const nextUnsubscribe = subscribeSocialStrategyDomain(projectId, onUpdate, tenantId);
        if (disposed) {
            nextUnsubscribe();
            return;
        }
        unsubscribe = nextUnsubscribe;
    });

    return () => {
        disposed = true;
        unsubscribe();
    };
};

export const updateSocialStrategy = async (projectId: string, updates: Partial<SocialStrategy>, tenantId?: string) => {
    const { updateSocialStrategy: updateSocialStrategyDomain } = await import('./domain/socialSettingsService');
    return updateSocialStrategyDomain(projectId, updates, tenantId);
};

export const syncSocialStrategyPlatforms = async (projectId: string, platformToRemove: SocialPlatform, tenantId?: string) => {
    const { syncSocialStrategyPlatforms: syncSocialStrategyPlatformsDomain } = await import('./domain/socialSettingsService');
    return syncSocialStrategyPlatformsDomain(projectId, platformToRemove, tenantId);
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

// =============================================================================
// ROLES (Permission System)
// =============================================================================

const ROLES = "roles";

const rolesCollection = (tenantId: string) => collection(db, TENANTS, tenantId, ROLES);

export interface FirestoreRole {
    id: string;
    name: string;
    color?: string;
    description?: string;
    position: number;
    isSystem: boolean;
    systemKey?: string;
    permissions: {
        allow: string[];
        deny: string[];
    };
    createdAt?: any;
    updatedAt?: any;
    createdBy?: string;
}

export const getTenantRoles = async (tenantId?: string): Promise<FirestoreRole[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(rolesCollection(resolvedTenant), orderBy("position", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreRole));
};

export const subscribeTenantRoles = (
    onUpdate: (roles: FirestoreRole[]) => void,
    tenantId?: string
): Unsubscribe => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(rolesCollection(resolvedTenant), orderBy("position", "desc"));

    return onSnapshot(q, (snapshot) => {
        const roles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreRole));
        onUpdate(roles);
    });
};

export const createTenantRole = async (
    roleData: Omit<FirestoreRole, "id" | "createdAt" | "updatedAt" | "createdBy">,
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const resolvedTenant = resolveTenantId(tenantId);

    const docRef = await addDoc(rolesCollection(resolvedTenant), {
        ...roleData,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return docRef.id;
};

export const updateTenantRole = async (
    roleId: string,
    updates: Partial<Omit<FirestoreRole, "id" | "createdAt" | "createdBy">>,
    tenantId?: string
): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const roleRef = doc(rolesCollection(resolvedTenant), roleId);
    await updateDoc(roleRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteTenantRole = async (roleId: string, tenantId?: string): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const roleRef = doc(rolesCollection(resolvedTenant), roleId);
    await deleteDoc(roleRef);
};

export const initializeSystemRoles = async (tenantId?: string): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const existingRoles = await getTenantRoles(resolvedTenant);

    // Only initialize if no roles exist
    if (existingRoles.length > 0) return;

    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // Create system roles with the SYSTEM_ROLE_DEFAULTS from permissionService
    // We defer to RoleManagement component for actual defaults to avoid circular imports
    console.log("System roles should be initialized via RoleManagement component");
};
