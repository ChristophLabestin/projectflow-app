import { httpsCallable } from 'firebase/functions';
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    type Unsubscribe,
} from 'firebase/firestore';

import type {
    ProjectIntakeCategory,
    ProjectIntakeFormSettings,
    ProjectSubmission,
    ProjectSubmissionStatus,
} from '../types';
import { db, functions } from './firebase';
import { resolveTenantId } from './internal/workspaceDataCore';
import { addTask } from './dataService';

const TENANTS = 'tenants';
const PROJECTS = 'projects';
const SUBMISSIONS = 'submissions';

export interface SaveProjectIntakeConfigInput {
    tenantId: string;
    projectId: string;
    enabled: boolean;
    title?: string;
    description?: string;
    submitLabel?: string;
    successMessage?: string;
    allowAttachments?: boolean;
    maxAttachments?: number;
    autoCreateTask?: boolean;
    categories?: ProjectIntakeCategory[];
    regenerateToken?: boolean;
}

export interface PublicProjectIntakeForm {
    token: string;
    projectTitle: string;
    title: string;
    description: string;
    submitLabel: string;
    successMessage: string;
    allowAttachments: boolean;
    maxAttachments: number;
    categories: ProjectIntakeCategory[];
    submitEndpoint: string;
}

export interface PublicProjectIntakeAttachmentInput {
    fileName: string;
    mimeType: string;
    dataUrl: string;
}

export interface PublicProjectIntakeSubmissionInput {
    token: string;
    categoryId: string;
    customerName?: string;
    customerEmail?: string;
    company?: string;
    fieldValues?: Record<string, string>;
    attachments?: PublicProjectIntakeAttachmentInput[];
}

const getHttpFunctionBaseUrl = () => {
    const explicit = import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL;
    if (explicit) return explicit.replace(/\/$/, '');
    return `https://europe-west3-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`;
};

export const getProjectIntakeSubmitEndpoint = () => `${getHttpFunctionBaseUrl()}/submitProjectIntake`;
export const getProjectIntakeConfigEndpoint = () => `${getHttpFunctionBaseUrl()}/getProjectIntakeForm`;

export const getPublicProjectIntakeUrl = (token: string) =>
    `${window.location.origin}/feedback/project/${token}`;

export const saveProjectIntakeConfig = async (input: SaveProjectIntakeConfigInput) => {
    const fn = httpsCallable<
        SaveProjectIntakeConfigInput,
        {
            success: boolean;
            intakeForm: ProjectIntakeFormSettings;
            submitEndpoint: string;
            publicConfigEndpoint: string;
        }
    >(functions, 'saveProjectIntakeConfig');

    const result = await fn(input);
    return result.data;
};

export const fetchPublicProjectIntakeForm = async (token: string): Promise<PublicProjectIntakeForm> => {
    const response = await fetch(`${getProjectIntakeConfigEndpoint()}?token=${encodeURIComponent(token)}`);
    const payload = await response.json();

    if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load intake form.');
    }

    return payload.form as PublicProjectIntakeForm;
};

export const submitPublicProjectIntake = async (input: PublicProjectIntakeSubmissionInput) => {
    const response = await fetch(getProjectIntakeSubmitEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });

    const payload = await response.json();
    if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to submit.');
    }

    return payload as { success: true; submissionId: string; taskId?: string; message: string };
};

export const fileToDataUrl = (file: File): Promise<string> => (
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
                return;
            }
            reject(new Error('Failed to read file.'));
        };
        reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
        reader.readAsDataURL(file);
    })
);

// --- Inbox (authenticated team side) ---

const submissionsCollection = (tenantId: string, projectId: string) =>
    collection(db, TENANTS, resolveTenantId(tenantId), PROJECTS, projectId, SUBMISSIONS);

export const subscribeProjectSubmissions = (
    tenantId: string,
    projectId: string,
    onUpdate: (submissions: ProjectSubmission[]) => void,
    onError?: (error: Error) => void,
): Unsubscribe => {
    const q = query(submissionsCollection(tenantId, projectId), orderBy('createdAt', 'desc'));
    return onSnapshot(
        q,
        (snapshot) => {
            const submissions = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            })) as ProjectSubmission[];
            onUpdate(submissions);
        },
        (error) => {
            console.error('subscribeProjectSubmissions failed', error);
            onError?.(error as Error);
        },
    );
};

export const updateProjectSubmissionStatus = async (
    tenantId: string,
    projectId: string,
    submissionId: string,
    status: ProjectSubmissionStatus,
): Promise<void> => {
    const ref = doc(db, TENANTS, resolveTenantId(tenantId), PROJECTS, projectId, SUBMISSIONS, submissionId);
    await updateDoc(ref, { status });
};

export const deleteProjectSubmission = async (
    tenantId: string,
    projectId: string,
    submissionId: string,
): Promise<void> => {
    const ref = doc(db, TENANTS, resolveTenantId(tenantId), PROJECTS, projectId, SUBMISSIONS, submissionId);
    await deleteDoc(ref);
};

/** Create a task from a submission and link it back. Returns the new task id. */
export const convertSubmissionToTask = async (
    submission: ProjectSubmission,
    tenantId: string,
): Promise<string> => {
    const metaLines: string[] = [];
    if (submission.description) metaLines.push(submission.description);

    const detailLines: string[] = [];
    if (submission.categoryLabel) detailLines.push(`Type: ${submission.categoryLabel}`);
    if (submission.submitter?.name) detailLines.push(`Name: ${submission.submitter.name}`);
    if (submission.submitter?.email) detailLines.push(`Email: ${submission.submitter.email}`);
    if (submission.submitter?.company) detailLines.push(`Company: ${submission.submitter.company}`);
    if (detailLines.length > 0) {
        metaLines.push('', 'Submission Details', ...detailLines.map((line) => `- ${line}`));
    }

    const extraFields = (submission.fields || []).filter((field) => field.role === 'general' || field.role === 'sourceUrl');
    if (extraFields.length > 0) {
        metaLines.push('', 'Responses', ...extraFields.map((field) => `- ${field.label}: ${field.value}`));
    }

    if ((submission.attachments || []).length > 0) {
        metaLines.push('', 'Attachments', ...(submission.attachments || []).map((a) => `- ${a.fileName}: ${a.downloadUrl}`));
    }

    const taskId = await addTask(
        submission.projectId,
        `${submission.categoryLabel}: ${submission.title}`.slice(0, 160),
        undefined,
        undefined,
        'Medium',
        {
            description: metaLines.join('\n').trim(),
            category: ['External Intake'],
            status: 'Open',
        },
        tenantId,
    );

    if (taskId) {
        const ref = doc(db, TENANTS, resolveTenantId(tenantId), PROJECTS, submission.projectId, SUBMISSIONS, submission.id);
        await updateDoc(ref, { linkedTaskId: taskId, status: 'accepted' });
    }

    return taskId;
};
