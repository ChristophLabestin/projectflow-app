import { db, auth } from './firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { Sprint } from '../types';

// Helper to get collection ref (tenant-aware if needed, but for now sprints are subcollection of projects or root collection with projectId)
// Assuming root collection 'sprints' akin to 'tasks' or subcollection.
// given the other services, we usually use root collections with projectId queries or subcollections.
// Let's check dataService. But for now, let's assume `projects/{projectId}/sprints` is a good structure for sprints as they are strictly project-scoped.
// OR `tenants/{tenantId}/projects/{projectId}/sprints`
// Let's stick to the pattern used in `dataService.ts`. Looking at `subscribeProjectTasks`, it seems to use `collection(db, 'projects', projectId, 'tasks')` or similar? 
// Wait, `subscribeProjectTasks` was: `const q = query(collection(db, path), ...)` where path is calculated. 
// Let's look at `subscribeProjectTasks` in `dataService` to be sure. 
// Actually, `dataService` is not visible right now. But `getProjectById` uses `projects` collection.
// Let's use `tenants/{tenantId}/projects/{projectId}/sprints` if tenant is available, else `projects/{projectId}/sprints`.

// However, to be safe and consistent, we'll implement it accepting the tenantId like other services.

const getSprintsRef = (projectId: string, tenantId?: string) => {
    if (tenantId) {
        return collection(db, 'tenants', tenantId, 'projects', projectId, 'sprints');
    }
    return collection(db, 'projects', projectId, 'sprints');
};

export const createSprint = async (projectId: string, data: Partial<Sprint>, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated");
    }

    const sprintData = {
        ...data,
        projectId,
        status: 'Planning',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
    };

    const ref = getSprintsRef(projectId, tenantId);
    return await addDoc(ref, sprintData);
};

export const updateSprint = async (projectId: string, sprintId: string, data: Partial<Sprint>, tenantId?: string) => {
    const ref = getSprintsRef(projectId, tenantId);
    const docRef = doc(ref, sprintId);
    return await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
};

export const deleteSprint = async (projectId: string, sprintId: string, tenantId?: string) => {
    const ref = getSprintsRef(projectId, tenantId);
    const docRef = doc(ref, sprintId);
    return await deleteDoc(docRef);
};

export const subscribeProjectSprints = (projectId: string, callback: (sprints: Sprint[]) => void, tenantId?: string) => {
    const ref = getSprintsRef(projectId, tenantId);
    const q = query(ref, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const sprints = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sprint));
        callback(sprints);
    });
};

export const startSprint = async (projectId: string, sprintId: string, startDate: string, endDate: string, tenantId?: string) => {
    // Ideally check if there is already an active sprint, but we'll let the UI handle that warning or enforce it here.
    // Enforcing:
    const ref = getSprintsRef(projectId, tenantId);
    const q = query(ref, where('status', '==', 'Active'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        throw new Error("There is already an active sprint.");
    }

    return updateSprint(projectId, sprintId, {
        status: 'Active',
        startDate,
        endDate
    }, tenantId);
};

export const completeSprint = async (projectId: string, sprintId: string, tenantId?: string) => {
    // 1. Mark sprint as completed
    await updateSprint(projectId, sprintId, { status: 'Completed' }, tenantId);

    // 2. Handle remaining open tasks? 
    // Usually this logic is complex (move to backlog, move to next sprint).
    // For now, we will leave them in the sprint (so they show up as "not done" in reports) OR we can unassign them.
    // The prompt asked for "full freedom", keeping it simple: leaving them assigned allows for historical accuracy of what was PLANNED vs DONE.
    // Typically you'd move incomplete tasks to the backlog or next sprint.
    // Let's implement a helper to move incomplete tasks to Backlog.

    // We need to query tasks for this sprint. We'd need to use `dataService` or access tasks collection directly.
    // To decouple, we'll let the UI or a specialized business logic function handle the task moving, 
    // or we assume `completeSprint` just updates the status. 
    // Let's just update status for now.
    return;
};

// --- Member Management ---

export const addSprintMember = async (projectId: string, sprintId: string, userId: string, tenantId?: string) => {
    const ref = getSprintsRef(projectId, tenantId);
    const docRef = doc(ref, sprintId);
    // Use Firestore arrayUnion if possible, but we don't import it yet.
    // Importing arrayUnion, arrayRemove from 'firebase/firestore'
    const { arrayUnion, arrayRemove } = await import('firebase/firestore');

    return await updateDoc(docRef, {
        memberIds: arrayUnion(userId),
        joinRequests: arrayRemove(userId) // Remove from requests if they are being added
    });
};

export const removeSprintMember = async (projectId: string, sprintId: string, userId: string, tenantId?: string) => {
    const ref = getSprintsRef(projectId, tenantId);
    const docRef = doc(ref, sprintId);
    const { arrayRemove } = await import('firebase/firestore');

    return await updateDoc(docRef, {
        memberIds: arrayRemove(userId)
    });
};

export const requestToJoinSprint = async (projectId: string, sprintId: string, userId: string, tenantId?: string) => {
    const ref = getSprintsRef(projectId, tenantId);
    const docRef = doc(ref, sprintId);
    const { arrayUnion } = await import('firebase/firestore');

    return await updateDoc(docRef, {
        joinRequests: arrayUnion(userId)
    });
};

export const rejectJoinRequest = async (projectId: string, sprintId: string, userId: string, tenantId?: string) => {
    const ref = getSprintsRef(projectId, tenantId);
    const docRef = doc(ref, sprintId);
    const { arrayRemove } = await import('firebase/firestore');

    return await updateDoc(docRef, {
        joinRequests: arrayRemove(userId)
    });
};
