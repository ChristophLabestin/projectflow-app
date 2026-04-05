import { httpsCallable } from 'firebase/functions';

import type {
    InitiativeFeedbackField,
    InitiativeFeedbackFormSettings,
} from '../types';
import { functions } from './firebase';

export interface SaveInitiativeFeedbackConfigInput {
    tenantId: string;
    projectId: string;
    initiativeId: string;
    enabled: boolean;
    title?: string;
    description?: string;
    submitLabel?: string;
    successMessage?: string;
    allowAttachments?: boolean;
    maxAttachments?: number;
    fields?: InitiativeFeedbackField[];
    regenerateToken?: boolean;
}

export interface PublicInitiativeFeedbackForm {
    token: string;
    projectTitle: string;
    initiativeTitle: string;
    title: string;
    description: string;
    submitLabel: string;
    successMessage: string;
    allowAttachments: boolean;
    maxAttachments: number;
    fields: InitiativeFeedbackField[];
    submitEndpoint: string;
}

export interface PublicInitiativeFeedbackAttachmentInput {
    fileName: string;
    mimeType: string;
    dataUrl: string;
}

export interface PublicInitiativeFeedbackSubmissionInput {
    token: string;
    title?: string;
    description?: string;
    customerName?: string;
    customerEmail?: string;
    company?: string;
    sourceUrl?: string;
    source?: 'public-form' | 'embedded-endpoint';
    fieldValues?: Record<string, string>;
    attachments?: PublicInitiativeFeedbackAttachmentInput[];
}

const getHttpFunctionBaseUrl = () => {
    const explicit = import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL;
    if (explicit) return explicit.replace(/\/$/, '');
    return `https://europe-west3-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`;
};

export const getInitiativeFeedbackSubmitEndpoint = () =>
    `${getHttpFunctionBaseUrl()}/submitInitiativeFeedback`;

export const getInitiativeFeedbackConfigEndpoint = () =>
    `${getHttpFunctionBaseUrl()}/getInitiativeFeedbackForm`;

export const saveInitiativeFeedbackConfig = async (input: SaveInitiativeFeedbackConfigInput) => {
    const fn = httpsCallable<
        SaveInitiativeFeedbackConfigInput,
        {
            success: boolean;
            feedbackForm: InitiativeFeedbackFormSettings;
            submitEndpoint: string;
            publicConfigEndpoint: string;
        }
    >(functions, 'saveInitiativeFeedbackConfig');

    const result = await fn(input);
    return result.data;
};

export const fetchPublicInitiativeFeedbackForm = async (token: string): Promise<PublicInitiativeFeedbackForm> => {
    const response = await fetch(`${getInitiativeFeedbackConfigEndpoint()}?token=${encodeURIComponent(token)}`);
    const payload = await response.json();

    if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load feedback form.');
    }

    return payload.form as PublicInitiativeFeedbackForm;
};

export const submitPublicInitiativeFeedback = async (input: PublicInitiativeFeedbackSubmissionInput) => {
    const response = await fetch(getInitiativeFeedbackSubmitEndpoint(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
    });

    const payload = await response.json();
    if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to submit feedback.');
    }

    return payload as { success: true; taskId: string; message: string };
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
