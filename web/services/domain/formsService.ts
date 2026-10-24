// Forms (brain/plans/forms-concept.md). Package 1: plan quota and workspace legal details.
// Forms themselves are written only through Cloud Functions (package 2).

import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';
import type { PublicForm } from '../forms/publicFormsApi';
import type { FormAudience, FormDoc, TenantLegal } from '../../types/forms';
import { formQuotaFor, type FormAnswers, type FormQuota, type FormSchema, type FormStatus } from '../../utils/formsLogic';

/** Live forms quota of a workspace (server enforces the same `formQuotaFor`). */
export const subscribeFormQuota = (tenantId: string, callback: (quota: FormQuota) => void) => {
    let entitlement: Record<string, any> | null | undefined;
    let tenant: Record<string, any> | null | undefined;
    const emit = () => {
        if (entitlement !== undefined && tenant !== undefined) callback(formQuotaFor(entitlement, tenant));
    };
    const offEnt = onSnapshot(doc(db, 'tenants', tenantId, 'entitlements', 'plan'),
        (snap) => { entitlement = snap.exists() ? snap.data() : null; emit(); },
        () => { entitlement = null; emit(); });
    const offTenant = onSnapshot(doc(db, 'tenants', tenantId),
        (snap) => { tenant = snap.exists() ? snap.data() : null; emit(); },
        () => { tenant = null; emit(); });
    return () => { offEnt(); offTenant(); };
};

const trimLegal = (legal: TenantLegal): TenantLegal => {
    const out: TenantLegal = {};
    (['controllerName', 'privacyPolicyUrl', 'imprintUrl', 'contactEmail'] as const).forEach((key) => {
        const value = (legal[key] || '').trim();
        if (value) out[key] = value;
    });
    return out;
};

/** Owner/Admin only (rules validate keys, lengths and https URLs). */
export const saveTenantLegal = (tenantId: string, legal: TenantLegal) =>
    updateDoc(doc(db, 'tenants', tenantId), { legal: trimLegal(legal) });

/** Public forms need a controller and a privacy policy (§10); the imprint is strongly recommended. */
export const isTenantLegalComplete = (legal: TenantLegal | null | undefined) =>
    !!legal && !!legal.controllerName?.trim() && !!legal.privacyPolicyUrl?.trim();

// ---------------------------------------------------------------------------
// Forms (package 2): reads via Firestore (rules: owner, editors, Owner/Admin), writes via callables
// (brain/plans/forms-api-contract.md).
// ---------------------------------------------------------------------------

const toMs = (value: any): number | null => {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
};

const toForm = (id: string, data: Record<string, any>): FormDoc => ({
    ...(data as FormDoc),
    id,
    editorIds: Array.isArray(data.editorIds) ? data.editorIds : [],
    createdAt: toMs(data.createdAt) || 0,
    updatedAt: toMs(data.updatedAt) || 0,
    draft: data.draft || { sections: [], fields: [] },
    settings: data.settings || {},
    counts: {
        responses: data.counts?.responses || 0,
        spam: data.counts?.spam || 0,
        lastResponseAt: toMs(data.counts?.lastResponseAt)
    }
});

/**
 * Forms I may edit: owned + shared with me; Owner/Admin see all. Rules only allow queries that are
 * constrained to the caller, so members run two queries and merge them.
 */
export const subscribeForms = (
    tenantId: string,
    uid: string,
    seeAll: boolean,
    callback: (forms: FormDoc[]) => void,
    onError?: (error: unknown) => void
) => {
    const base = collection(db, 'tenants', tenantId, 'forms');
    const sort = (list: FormDoc[]) => list.sort((a, b) => b.updatedAt - a.updatedAt);
    if (seeAll) {
        return onSnapshot(base, (snap) => callback(sort(snap.docs.map((entry) => toForm(entry.id, entry.data())))), onError);
    }
    let owned: FormDoc[] | null = null;
    let shared: FormDoc[] | null = null;
    const emit = () => {
        if (!owned || !shared) return;
        const byId = new Map<string, FormDoc>();
        [...owned, ...shared].forEach((form) => byId.set(form.id, form));
        callback(sort(Array.from(byId.values())));
    };
    const offOwned = onSnapshot(query(base, where('ownerId', '==', uid)),
        (snap) => { owned = snap.docs.map((entry) => toForm(entry.id, entry.data())); emit(); }, onError);
    const offShared = onSnapshot(query(base, where('editorIds', 'array-contains', uid)),
        (snap) => { shared = snap.docs.map((entry) => toForm(entry.id, entry.data())); emit(); }, onError);
    return () => { offOwned(); offShared(); };
};

export const subscribeForm = (tenantId: string, formId: string, callback: (form: FormDoc | null) => void, onError?: (error: unknown) => void) =>
    onSnapshot(doc(db, 'tenants', tenantId, 'forms', formId),
        (snap) => callback(snap.exists() ? toForm(snap.id, snap.data()) : null), onError);

/** The published snapshot (to tell whether the draft has unpublished changes). */
export const getFormVersion = async (tenantId: string, formId: string, version: number) => {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'forms', formId, 'versions', String(version)));
    return snap.exists() ? (snap.data() as { schema?: FormSchema; title?: string; description?: string }) : null;
};

export const subscribeFormsUsage = (tenantId: string, callback: (responses: number) => void) => {
    const month = new Date().toISOString().slice(0, 7);
    return onSnapshot(doc(db, 'tenants', tenantId, 'forms_usage', month),
        (snap) => callback(Number(snap.data()?.responses) || 0), () => callback(0));
};

const callForms = async <T,>(name: string, data: Record<string, unknown>): Promise<T> => {
    const fn = httpsCallable<Record<string, unknown>, T>(functions, name);
    return (await fn(data)).data;
};

export type FormDraftPatch = Partial<Pick<FormDoc,
    'title' | 'description' | 'draft' | 'audience' | 'anonymous' | 'language' | 'layout' | 'theme' | 'settings' | 'embed' | 'actions'>> & { allowGuests?: boolean };

export const createForm = (tenantId: string, input: { title: string; description?: string; draft?: FormSchema; audience?: FormAudience; language?: 'de' | 'en' }) =>
    callForms<{ formId: string }>('createForm', { tenantId, ...input });

export const saveFormDraft = (tenantId: string, formId: string, patch: FormDraftPatch) =>
    callForms<{ updatedAt: number }>('saveFormDraft', { tenantId, formId, patch });

export const publishForm = (tenantId: string, formId: string) =>
    callForms<{ version: number; shareToken: string; status: FormStatus }>('publishForm', { tenantId, formId });

export const setFormStatus = (tenantId: string, formId: string, status: 'published' | 'paused' | 'closed') =>
    callForms<{ status: FormStatus }>('setFormStatus', { tenantId, formId, status });

export const regenerateFormLink = (tenantId: string, formId: string) =>
    callForms<{ shareToken: string }>('regenerateFormLink', { tenantId, formId });

export const duplicateForm = (tenantId: string, formId: string) =>
    callForms<{ formId: string }>('duplicateForm', { tenantId, formId });

export const deleteForm = (tenantId: string, formId: string) =>
    callForms<{ ok: boolean }>('deleteForm', { tenantId, formId });

export const setFormEditors = (tenantId: string, formId: string, editorIds: string[], ownerId?: string) =>
    callForms<{ ok: boolean }>('setFormEditors', { tenantId, formId, editorIds, ...(ownerId ? { ownerId } : {}) });

/** Logo, cover or background image: signed upload to the public asset path, returns the stored path. */
export const uploadFormAsset = async (tenantId: string, formId: string, kind: 'logo' | 'cover' | 'background', file: File) => {
    const result = await callForms<{ uploadUrl: string; path: string; publicUrl: string; method?: string; headers?: Record<string, string> }>(
        'createFormAssetUpload', { tenantId, formId, kind, contentType: file.type, size: file.size });
    const put = await fetch(result.uploadUrl, { method: result.method || 'PUT', headers: { 'Content-Type': file.type, ...(result.headers || {}) }, body: file });
    if (!put.ok) throw new Error('form-asset-upload-failed');
    return result.path;
};

export interface MemberFormLoad {
    status: 'open';
    form: PublicForm;
    session: string;
    tenantId: string;
    formId: string;
    token?: string;
}

export const getFormForMember = (input: { tenantId: string; formId: string } | { token: string }) =>
    callForms<MemberFormLoad>('getFormForMember', input as Record<string, unknown>);

export const submitFormAsMember = (input: { tenantId: string; formId: string; session: string; answers: FormAnswers; durationMs: number }) =>
    callForms<{ responseId: string; confirmation?: { text?: string; redirectUrl?: string } }>('submitFormAsMember', { ...input, source: 'app' });

/** Error code of a callable error (the message carries the contract code, e.g. `plan-form-limit`). */
export const formErrorCode = (error: unknown): string => {
    const message = (error as { message?: string })?.message || '';
    // The SDK may prefix the service and append the HTTP status ("form-legal-missing [400]").
    const match = message.match(/\b[a-z]+(?:-[a-z]+)+\b/);
    return match ? match[0] : 'unknown';
};
