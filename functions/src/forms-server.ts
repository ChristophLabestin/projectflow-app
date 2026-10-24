// Forms — shared server code of the callables (forms.ts) and the public HTTP endpoints (forms-public.ts):
// secret, access context, plan quota, public form snapshot, signed uploads and the submission store.
// Contract: brain/plans/forms-api-contract.md. Writes to forms collections happen only here.
import * as crypto from 'crypto';
import * as functions from 'firebase-functions/v1';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { compact, contentHash, hasTooManyLinks, safeObjectName, usageMonthId, respondentKey, SPAM_DUPLICATE_WINDOW_MS } from './forms-helpers';
import {
    FormAccessContext,
    FormAnswerError,
    FormFileRef,
    FormQuota,
    FormSchema,
    formQuotaFor,
    responseExpiry,
    validateSubmission
} from './forms-logic';
import { db } from './init';
import { isTenantSuspended } from './tenant-status';
import { memberRef } from './tenant-id';

export const REGION = 'europe-west3';

// ---------------------------------------------------------------------------
// Errors: one message code per failure, mapped to callable codes and HTTP statuses
// ---------------------------------------------------------------------------

export type FormErrorCode =
    | 'form-not-found' | 'form-invalid' | 'form-legal-missing' | 'form-not-published' | 'form-closed' | 'form-limit'
    | 'form-already-answered' | 'form-session-invalid' | 'form-invalid-answers' | 'form-upload-invalid' | 'rate-limited'
    | 'plan-form-limit' | 'plan-form-responses' | 'plan-form-feature' | 'plan-storage-limit' | 'plan-file-too-large'
    | 'permission-denied' | 'invalid-argument';

const CALLABLE_CODE: Record<FormErrorCode, functions.https.FunctionsErrorCode> = {
    'form-not-found': 'not-found',
    'form-invalid': 'invalid-argument',
    'form-legal-missing': 'failed-precondition',
    'form-not-published': 'failed-precondition',
    'form-closed': 'failed-precondition',
    'form-limit': 'failed-precondition',
    'form-already-answered': 'already-exists',
    'form-session-invalid': 'invalid-argument',
    'form-invalid-answers': 'invalid-argument',
    'form-upload-invalid': 'invalid-argument',
    'rate-limited': 'resource-exhausted',
    'plan-form-limit': 'resource-exhausted',
    'plan-form-responses': 'resource-exhausted',
    'plan-form-feature': 'failed-precondition',
    'plan-storage-limit': 'resource-exhausted',
    'plan-file-too-large': 'invalid-argument',
    'permission-denied': 'permission-denied',
    'invalid-argument': 'invalid-argument'
};

export const HTTP_STATUS: Record<FormErrorCode, number> = {
    'form-not-found': 404,
    'form-invalid': 400,
    'form-legal-missing': 409,
    'form-not-published': 409,
    'form-closed': 409,
    'form-limit': 409,
    'form-already-answered': 409,
    'form-session-invalid': 400,
    'form-invalid-answers': 400,
    'form-upload-invalid': 400,
    'rate-limited': 429,
    'plan-form-limit': 409,
    'plan-form-responses': 409,
    'plan-form-feature': 403,
    'plan-storage-limit': 409,
    'plan-file-too-large': 400,
    'permission-denied': 403,
    'invalid-argument': 400
};

export class FormFailure extends Error {
    constructor(public code: FormErrorCode, public details?: Record<string, unknown>) {
        super(code);
    }
}

/** Runs a callable body; form failures become `HttpsError(code, <message code>, details)`. */
export const guarded = async <T>(body: () => Promise<T>): Promise<T> => {
    try {
        return await body();
    } catch (error) {
        if (error instanceof FormFailure) throw new functions.https.HttpsError(CALLABLE_CODE[error.code], error.code, error.details);
        throw error;
    }
};

export const str = (value: unknown, max = 200): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export const requireAuth = (context: functions.https.CallableContext): string => {
    const uid = context.auth && context.auth.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    return uid;
};

const ID_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
export const requireId = (value: unknown, name: string): string => {
    const text = str(value, 128);
    if (!ID_SEGMENT.test(text)) throw new FormFailure(name === 'formId' ? 'form-not-found' : 'invalid-argument');
    return text;
};

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
export const newShareToken = () => crypto.randomBytes(24).toString('base64url');

// ---------------------------------------------------------------------------
// Server secret (platform_secrets/forms, server-only): signs session tokens and derives the daily IP salt
// ---------------------------------------------------------------------------

let cachedSecret: string | null = null;

export const getFormsSecret = async (): Promise<string> => {
    if (cachedSecret) return cachedSecret;
    const ref = db.doc('platform_secrets/forms');
    const snap = await ref.get();
    let secret = snap.exists ? str(snap.get('secret'), 200) : '';
    if (!secret) {
        const created = crypto.randomBytes(32).toString('hex');
        try {
            await ref.create({ secret: created, createdAt: FieldValue.serverTimestamp() });
            secret = created;
        } catch {
            // Lost the race with another instance: use the stored secret.
            secret = str((await ref.get()).get('secret'), 200);
        }
    }
    if (!secret) throw new Error('forms secret unavailable');
    cachedSecret = secret;
    return secret;
};

/** Test hook (unit tests only). */
export const resetFormsSecretCache = () => {
    cachedSecret = null;
};

// ---------------------------------------------------------------------------
// Document refs
// ---------------------------------------------------------------------------

export const formsCol = (tenantId: string) => db.collection('tenants').doc(tenantId).collection('forms');
export const formRef = (tenantId: string, formId: string) => formsCol(tenantId).doc(formId);
export const publicFormRef = (token: string) => db.collection('public_forms').doc(token);
export const uploadsCol = (tenantId: string) => db.collection('tenants').doc(tenantId).collection('form_uploads');

// ---------------------------------------------------------------------------
// Access and quota
// ---------------------------------------------------------------------------

export interface MemberAccess extends FormAccessContext {
    tenant: Record<string, any>;
}

/** Membership role plus permission nodes of the custom roles assigned to the member. */
export const loadAccess = async (tenantId: string, uid: string): Promise<MemberAccess> => {
    const [memberSnap, tenantSnap] = await Promise.all([memberRef(tenantId, uid).get(), db.doc(`tenants/${tenantId}`).get()]);
    if (!memberSnap.exists || !tenantSnap.exists) throw new FormFailure('permission-denied');
    const member = memberSnap.data() || {};
    const role = str(member.role) || 'Member';
    const roleIds: string[] = Array.isArray(member.roleIds) ? member.roleIds.filter((entry: unknown): entry is string => typeof entry === 'string') : [];
    if (roleIds.indexOf(role) < 0) roleIds.push(role);
    const tenant = tenantSnap.data() || {};
    const permissions: string[] = [];
    (Array.isArray(tenant.customRoles) ? tenant.customRoles : []).forEach((customRole: Record<string, any>) => {
        if (!customRole || roleIds.indexOf(str(customRole.id)) < 0) return;
        (Array.isArray(customRole.permissions) ? customRole.permissions : []).forEach((node: unknown) => {
            if (typeof node === 'string' && permissions.indexOf(node) < 0) permissions.push(node);
        });
    });
    return { uid, role, permissions, tenant };
};

export const loadQuota = async (tenantId: string, tenant?: Record<string, any>): Promise<FormQuota> => {
    const [entitlement, tenantSnap] = await Promise.all([
        db.doc(`tenants/${tenantId}/entitlements/plan`).get(),
        tenant ? Promise.resolve(null) : db.doc(`tenants/${tenantId}`).get()
    ]);
    return formQuotaFor(entitlement.exists ? entitlement.data() : null, tenant || (tenantSnap ? tenantSnap.data() : null));
};

export const countActiveForms = async (tenantId: string): Promise<number> => {
    const snap = await formsCol(tenantId).where('status', 'in', ['published', 'paused']).count().get();
    return snap.data().count;
};

export const isTenantLegalComplete = (legal: Record<string, any> | null | undefined) =>
    !!legal && !!str(legal.controllerName) && !!str(legal.privacyPolicyUrl);

export const toMillis = (value: unknown): number | null => {
    if (value && typeof (value as Timestamp).toMillis === 'function') return (value as Timestamp).toMillis();
    return typeof value === 'number' ? value : null;
};

// ---------------------------------------------------------------------------
// Storage helpers (file-storage.ts is loaded lazily: it pulls in the S3/Drive SDKs)
// ---------------------------------------------------------------------------

type FileStorageModule = typeof import('./file-storage');
let fileStorageModule: FileStorageModule | null = null;
export const fileStorage = (): FileStorageModule => {
    if (!fileStorageModule) fileStorageModule = require('./file-storage') as FileStorageModule;
    return fileStorageModule;
};

const emulatorStorageHost = () => (process.env.FUNCTIONS_EMULATOR === 'true' ? str(process.env.FIREBASE_STORAGE_EMULATOR_HOST) : '');

/** Public URL of an object under `public/forms/**` (readable by anyone per storage.rules). */
export const publicAssetUrl = (path: string): string => {
    const bucket = fileStorage().fileBucket().name;
    const host = emulatorStorageHost();
    return `${host ? `http://${host}` : 'https://firebasestorage.googleapis.com'}/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`;
};

export interface UploadTarget {
    method: 'PUT' | 'POST';
    url: string;
    headers: Record<string, string>;
}

/**
 * Upload target for one object in the default bucket. Mirrors file-storage: signed V4 PUT in production
 * (15 min), plain POST to the Storage emulator locally (it cannot verify signatures).
 */
export const createUploadTarget = async (objectKey: string, contentType: string, sizeBytes: number): Promise<UploadTarget> => {
    const bucket = fileStorage().fileBucket();
    const host = emulatorStorageHost();
    if (host) {
        return {
            method: 'POST',
            url: `http://${host}/upload/storage/v1/b/${encodeURIComponent(bucket.name)}/o?uploadType=media&name=${encodeURIComponent(objectKey)}`,
            headers: { 'Content-Type': contentType, Authorization: 'Bearer owner' }
        };
    }
    const lengthRange = process.env.GCS_SIGN_LENGTH_RANGE === 'true' ? `0,${Math.max(0, Math.floor(sizeBytes))}` : null;
    const [url] = await bucket.file(objectKey).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + fileStorage().STORAGE_SIGNED_URL_TTL_MS,
        contentType,
        ...(lengthRange ? { extensionHeaders: { 'x-goog-content-length-range': lengthRange } } : {})
    });
    return {
        method: 'PUT',
        url,
        headers: { 'Content-Type': contentType, ...(lengthRange ? { 'x-goog-content-length-range': lengthRange } : {}) }
    };
};

// ---------------------------------------------------------------------------
// Public form snapshot
// ---------------------------------------------------------------------------

const resolveThemeAssets = (theme: Record<string, any>): Record<string, any> => {
    const out = JSON.parse(JSON.stringify(theme || {}));
    if (typeof out.logoPath === 'string' && out.logoPath) out.logoPath = publicAssetUrl(out.logoPath);
    if (typeof out.coverPath === 'string' && out.coverPath) out.coverPath = publicAssetUrl(out.coverPath);
    if (out.background && typeof out.background.imagePath === 'string' && out.background.imagePath) {
        out.background.imagePath = publicAssetUrl(out.background.imagePath);
    }
    return out;
};

export const legalOf = (tenant: Record<string, any> | null | undefined) => {
    const legal = (tenant && tenant.legal) || {};
    return { controllerName: str(legal.controllerName), privacyPolicyUrl: str(legal.privacyPolicyUrl, 500), imprintUrl: str(legal.imprintUrl, 500) };
};

export const buildPublicForm = (index: Record<string, any>, tenant: Record<string, any>, quota: FormQuota) => {
    const settings = index.settings || {};
    return {
        title: index.title || '',
        description: index.description || '',
        language: index.language || 'de',
        layout: index.layout || 'classic',
        schema: index.schema as FormSchema,
        version: index.version,
        theme: resolveThemeAssets(index.theme),
        settings: {
            confirmation: settings.confirmation || {},
            consent: settings.consent || null,
            hideBranding: settings.hideBranding === true && quota.removeBranding
        },
        legal: index.legal && typeof index.legal === 'object' ? index.legal : legalOf(tenant),
        uploadsEnabled: !!(index.features && index.features.uploads) && quota.uploads
    };
};

// ---------------------------------------------------------------------------
// Form state (shared by getPublicForm, getFormForMember and the submit chain)
// ---------------------------------------------------------------------------

export type FormState = 'open' | 'paused' | 'closed' | 'limit' | 'limit-plan';

export interface LoadedForm {
    token: string;
    index: Record<string, any>;
    tenantId: string;
    formId: string;
    form: Record<string, any>;
    tenant: Record<string, any>;
    quota: FormQuota;
    state: FormState;
}

const tenantCache = new Map<string, { at: number; tenant: Record<string, any>; quota: FormQuota }>();
const TENANT_CACHE_MS = 30000;

const cachedTenant = async (tenantId: string, fresh: boolean) => {
    const hit = tenantCache.get(tenantId);
    if (!fresh && hit && Date.now() - hit.at < TENANT_CACHE_MS) return hit;
    const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
    const tenant = tenantSnap.data() || {};
    const entry = { at: Date.now(), tenant, quota: await loadQuota(tenantId, tenant) };
    tenantCache.set(tenantId, entry);
    if (tenantCache.size > 500) tenantCache.clear();
    return entry;
};

export const stateOf = (form: Record<string, any>, indexStatus: string, quota: FormQuota, usedResponses: number, now: number): FormState => {
    const settings = form.settings || {};
    if (form.status === 'paused' || indexStatus === 'paused') return 'paused';
    if (form.status !== 'published' || indexStatus !== 'published') return 'closed';
    if (typeof settings.closesAt === 'number' && settings.closesAt > 0 && now >= settings.closesAt) return 'closed';
    const max = typeof settings.maxResponses === 'number' ? settings.maxResponses : null;
    if (max !== null && ((form.counts && form.counts.responses) || 0) >= max) return 'limit';
    if (usedResponses >= quota.responsesPerMonth) return 'limit-plan';
    return 'open';
};

export const loadFormByToken = async (token: string, now: number, options: { freshTenant?: boolean } = {}): Promise<LoadedForm> => {
    if (!TOKEN_PATTERN.test(token)) throw new FormFailure('form-not-found');
    const indexSnap = await publicFormRef(token).get();
    if (!indexSnap.exists) throw new FormFailure('form-not-found');
    const index = indexSnap.data() || {};
    const tenantId = str(index.tenantId, 128);
    const formId = str(index.formId, 128);
    if (!tenantId || !formId || (await isTenantSuspended(tenantId))) throw new FormFailure('form-not-found');
    const [formSnap, tenantEntry, usageSnap] = await Promise.all([
        formRef(tenantId, formId).get(),
        cachedTenant(tenantId, options.freshTenant === true),
        db.doc(`tenants/${tenantId}/forms_usage/${usageMonthId(now)}`).get()
    ]);
    if (!formSnap.exists || formSnap.get('shareToken') !== token) throw new FormFailure('form-not-found');
    const form = formSnap.data() || {};
    const used = Number(usageSnap.exists ? usageSnap.get('responses') : 0) || 0;
    const state = stateOf(form, str(index.status), tenantEntry.quota, used, now);
    return { token, index, tenantId, formId, form, tenant: tenantEntry.tenant, quota: tenantEntry.quota, state };
};

/** Throws the 409 failure matching a non-open state. */
export const assertOpen = (loaded: LoadedForm) => {
    if (loaded.state === 'limit') throw new FormFailure('form-limit');
    if (loaded.state === 'limit-plan') throw new FormFailure('plan-form-responses');
    if (loaded.state !== 'open') throw new FormFailure('form-closed');
};

// ---------------------------------------------------------------------------
// Storing a submission
// ---------------------------------------------------------------------------

export interface StoreInput {
    loaded: LoadedForm;
    rawAnswers: Record<string, unknown>;
    source: 'link' | 'embed' | 'app' | 'ios';
    durationMs: number;
    nonce: string;
    uid?: string;
    now: number;
}

const sessionFilePath = (tenantId: string, formId: string, fileId: string, name: string) =>
    `tenants/${tenantId}/files/forms/${formId}/${fileId}/${safeObjectName(name)}`;

export { sessionFilePath };

export const storeSubmission = async (input: StoreInput): Promise<{ responseId: string; confirmation: Record<string, string>; status: 'new' | 'spam' }> => {
    const { loaded, now } = input;
    const { tenantId, formId, token } = loaded;
    const schema = loaded.index.schema as FormSchema;

    const result = validateSubmission(schema, input.rawAnswers as any);
    if (!result.ok) throw new FormFailure('form-invalid-answers', { fieldErrors: result.errors });
    const answers = result.answers;

    // Uploads: every file ref must match a pending upload of this session and field, and the object must exist.
    const uploadErrors: FormAnswerError[] = [];
    const fileClaims: { fieldId: string; ref: FormFileRef }[] = [];
    schema.fields.forEach((field) => {
        const value = answers[field.id];
        if (field.type === 'fileUpload' && Array.isArray(value)) value.forEach((ref) => fileClaims.push({ fieldId: field.id, ref }));
    });
    const seenIds: Record<string, true> = {};
    const verified: { fileId: string; pending: Record<string, any>; size: number }[] = [];
    if (fileClaims.length) {
        const pendingRefs = fileClaims.map((claim) => uploadsCol(tenantId).doc(claim.ref.fileId.length <= 128 && ID_SEGMENT.test(claim.ref.fileId) ? claim.ref.fileId : '_invalid_'));
        const snaps = await db.getAll(...pendingRefs);
        const bucket = fileStorage().fileBucket();
        for (let i = 0; i < fileClaims.length; i++) {
            const claim = fileClaims[i];
            const snap = snaps[i];
            const pending = snap.exists ? snap.data() || {} : null;
            const ok = !!pending && !seenIds[claim.ref.fileId] && pending.status === 'pending' && pending.token === token &&
                pending.sessionNonce === input.nonce && pending.fieldId === claim.fieldId && pending.formId === formId;
            seenIds[claim.ref.fileId] = true;
            if (!ok || !pending) {
                uploadErrors.push({ fieldId: claim.fieldId, code: 'invalidType' });
                continue;
            }
            let size = 0;
            try {
                const [meta] = await bucket.file(str(pending.objectPath, 400)).getMetadata();
                size = Number(meta.size) || 0;
            } catch {
                size = 0;
            }
            if (size <= 0 || size > Number(pending.size)) {
                uploadErrors.push({ fieldId: claim.fieldId, code: 'invalidType' });
                continue;
            }
            // Name, type and size come from the pending record, never from the client.
            claim.ref.name = str(pending.name, 200);
            claim.ref.contentType = str(pending.contentType, 100);
            claim.ref.size = size;
            verified.push({ fileId: claim.ref.fileId, pending, size });
        }
    }
    if (uploadErrors.length) throw new FormFailure('form-upload-invalid', { fieldErrors: uploadErrors });

    // Respondent email: the answer of the field marked isRespondentEmail.
    const emailField = schema.fields.find((field) => field.isRespondentEmail === true);
    const emailAnswer = emailField ? answers[emailField.id] : undefined;
    const respondent: Record<string, string> = {};
    if (typeof emailAnswer === 'string' && emailAnswer) respondent.email = emailAnswer;

    const secret = await getFormsSecret();
    const settings = loaded.form.settings || {};
    const anonymous = loaded.form.anonymous === true;
    if (input.uid && !anonymous) respondent.uid = input.uid;

    const hash = contentHash(answers);
    const linkSpam = hasTooManyLinks(schema, answers);
    const responseRef = formRef(tenantId, formId).collection('responses').doc();
    const hashRef = formRef(tenantId, formId).collection('submission_hashes').doc(hash);
    const usageRef = db.doc(`tenants/${tenantId}/forms_usage/${usageMonthId(now)}`);
    const once = !!input.uid && settings.onePerMember === true;
    const respondentRef = once ? formRef(tenantId, formId).collection('respondents').doc(respondentKey(secret, formId, input.uid as string)) : null;
    const expiry = responseExpiry(now, settings.retentionMonths === undefined ? 12 : settings.retentionMonths);

    const status = await db.runTransaction(async (tx) => {
        const reads = await Promise.all([
            tx.get(formRef(tenantId, formId)),
            tx.get(usageRef),
            tx.get(hashRef),
            respondentRef ? tx.get(respondentRef) : Promise.resolve(null)
        ]);
        const [formSnap, usageSnap, hashSnap, respondentSnap] = reads;
        const live = formSnap.data() || {};
        if (!formSnap.exists || live.status !== 'published') throw new FormFailure('form-closed');
        if (respondentSnap && respondentSnap.exists) throw new FormFailure('form-already-answered');
        const duplicate = hashSnap.exists && now - (Number(hashSnap.get('at')) || 0) < SPAM_DUPLICATE_WINDOW_MS;
        const spam = linkSpam || duplicate;
        if (!spam) {
            const liveSettings = live.settings || {};
            const liveCount = (live.counts && live.counts.responses) || 0;
            if (typeof liveSettings.maxResponses === 'number' && liveCount >= liveSettings.maxResponses) throw new FormFailure('form-limit');
            if ((Number(usageSnap.exists ? usageSnap.get('responses') : 0) || 0) >= loaded.quota.responsesPerMonth) throw new FormFailure('plan-form-responses');
        }
        const submittedAt = Timestamp.fromMillis(now);
        tx.set(responseRef, compact({
            version: loaded.index.version,
            submittedAt,
            status: spam ? 'spam' : 'new',
            answers,
            respondent,
            meta: { source: input.source, locale: loaded.index.language || 'de', durationMs: input.durationMs },
            expireAt: expiry === null ? undefined : Timestamp.fromMillis(expiry)
        }));
        tx.update(formRef(tenantId, formId), spam
            ? { 'counts.spam': FieldValue.increment(1) }
            : { 'counts.responses': FieldValue.increment(1), 'counts.lastResponseAt': submittedAt });
        if (!spam) tx.set(usageRef, { responses: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        tx.set(hashRef, { at: now, expireAt: Timestamp.fromMillis(now + 60 * 60 * 1000) });
        if (respondentRef) tx.set(respondentRef, { at: submittedAt });
        verified.forEach(({ fileId, pending, size }) => {
            tx.set(fileStorage().filesCollectionRef(tenantId).doc(fileId), {
                tenantId,
                module: 'forms',
                entityType: 'form-response',
                entityId: responseRef.id,
                formId,
                projectId: null,
                provider: 'firebase',
                requestedProvider: 'firebase',
                fallbackToFirebase: false,
                fileName: pending.name,
                mimeType: pending.contentType,
                sizeBytes: size,
                status: 'ready',
                providerRef: { firebasePath: pending.objectPath },
                createdBy: input.uid || 'public-form',
                listed: false,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });
            tx.delete(uploadsCol(tenantId).doc(fileId));
        });
        return spam ? 'spam' : 'new';
    });

    const confirmation = (loaded.index.settings && loaded.index.settings.confirmation) || {};
    return { responseId: responseRef.id, confirmation: { ...(confirmation.text ? { text: confirmation.text } : {}), ...(confirmation.redirectUrl ? { redirectUrl: confirmation.redirectUrl } : {}) }, status };
};

/** Minimum session age before a submission is accepted (3 s). Only the emulator may lower it, for tests. */
export const minSessionAgeMs = (): number => {
    const override = Number(process.env.FORMS_MIN_SESSION_MS);
    if (process.env.FUNCTIONS_EMULATOR === 'true' && isFinite(override) && override >= 0 && process.env.FORMS_MIN_SESSION_MS !== undefined && process.env.FORMS_MIN_SESSION_MS !== '') return override;
    return 3000;
};
