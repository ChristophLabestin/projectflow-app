// Public form endpoints (brain/plans/forms-api-contract.md). Plain fetch, no Firebase SDK, so the lean
// /f/:token entry stays small. Respondents are never signed in here.

import type { FormLanguage, FormLayout, FormTheme, TenantLegal } from '../../types/forms';
import type { FormAnswerError, FormAnswers, FormFileRef, FormSchema } from '../../utils/formsLogic';

const env = import.meta.env;
const useEmulators = env.VITE_USE_FIREBASE_EMULATORS === 'true';
const projectId = useEmulators ? env.VITE_EMULATOR_PROJECT_ID || 'demo-projectflow' : env.VITE_FIREBASE_PROJECT_ID;

export const formsFunctionsBase = (): string => {
    if (useEmulators) return `http://127.0.0.1:${env.VITE_EMULATOR_FUNCTIONS_PORT || 5001}/${projectId}/europe-west3`;
    if (env.VITE_CLOUD_FUNCTIONS_BASE_URL) return String(env.VITE_CLOUD_FUNCTIONS_BASE_URL).replace(/\/$/, '');
    return `https://europe-west3-${projectId}.cloudfunctions.net`;
};

/** Public URL of a form asset (`public/forms/**`, publicly readable in storage.rules). Absolute URLs pass through. */
export const formAssetUrl = (path: string): string => {
    if (/^https?:\/\//.test(path)) return path;
    const bucket = env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
    const host = useEmulators ? `http://127.0.0.1:${env.VITE_EMULATOR_STORAGE_PORT || 9199}` : 'https://firebasestorage.googleapis.com';
    return `${host}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
};

export interface PublicForm {
    title: string;
    description?: string;
    language: FormLanguage;
    layout: FormLayout;
    schema: FormSchema;
    version: number;
    theme: FormTheme;
    settings: { confirmation?: { text?: string; redirectUrl?: string }; consent?: { text: string; url?: string } | null; hideBranding?: boolean };
    legal: TenantLegal;
    uploadsEnabled: boolean;
}

export type PublicFormLoad =
    | { status: 'open'; form: PublicForm; session: string }
    | { status: 'paused' | 'closed' | 'limit'; title?: string; theme?: FormTheme; language?: FormLanguage; legal?: TenantLegal }
    | { status: 'workspace'; tenantId: string; formId: string; title?: string; language?: FormLanguage }
    | { status: 'not-found' }
    | { status: 'error' };

export const loadPublicForm = async (token: string): Promise<PublicFormLoad> => {
    try {
        const response = await fetch(`${formsFunctionsBase()}/getPublicForm?token=${encodeURIComponent(token)}`);
        if (response.status === 404) return { status: 'not-found' };
        if (!response.ok) return { status: 'error' };
        return (await response.json()) as PublicFormLoad;
    } catch {
        return { status: 'error' };
    }
};

export interface PublicSubmitResult {
    ok: boolean;
    confirmation?: { text?: string; redirectUrl?: string };
    error?: string;
    fieldErrors?: FormAnswerError[];
}

export const submitPublicForm = async (input: {
    token: string;
    session: string;
    answers: FormAnswers;
    website: string;
    durationMs: number;
    source: 'link' | 'embed';
}): Promise<PublicSubmitResult> => {
    try {
        const response = await fetch(`${formsFunctionsBase()}/submitPublicForm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });
        const body = await response.json().catch(() => ({}));
        if (response.ok && body.ok) return { ok: true, confirmation: body.confirmation };
        return { ok: false, error: body.error || (response.status === 429 ? 'rate-limited' : 'submit-failed'), fieldErrors: body.fieldErrors };
    } catch {
        return { ok: false, error: 'submit-failed' };
    }
};

/** Signed upload: ask for a PUT URL, then send the bytes straight to Storage. */
export const uploadPublicFormFile = async (token: string, session: string, fieldId: string, file: File): Promise<FormFileRef> => {
    const contentType = file.type || 'application/octet-stream';
    const response = await fetch(`${formsFunctionsBase()}/createPublicFormUpload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, session, fieldId, name: file.name, size: file.size, contentType })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.uploadUrl || !body.fileId) throw new Error(body.error || 'form-upload-invalid');
    // Production: signed V4 PUT; emulator: POST to the Storage emulator (`method` from the server).
    const put = await fetch(body.uploadUrl, { method: body.method || 'PUT', headers: { 'Content-Type': contentType, ...(body.headers || {}) }, body: file });
    if (!put.ok) throw new Error('form-upload-failed');
    return { fileId: body.fileId, name: file.name, size: file.size, contentType };
};
