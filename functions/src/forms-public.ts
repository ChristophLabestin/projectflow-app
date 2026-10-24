// Forms — public HTTP endpoints (no sign-in; brain/plans/forms-api-contract.md, forms-concept.md §8).
// getPublicForm (GET), createPublicFormUpload (POST), submitPublicForm (POST). CORS like initiative-feedback.
import * as functions from 'firebase-functions/v1';
import { Timestamp } from 'firebase-admin/firestore';

import { corsMiddleware } from './corsConfig';
import {
    MAX_SUBMIT_BYTES,
    dailySalt,
    hashIp,
    safeObjectName,
    signFormSession,
    verifyFormSession
} from './forms-helpers';
import { fileKindAllows, FormField } from './forms-logic';
import {
    FormFailure,
    HTTP_STATUS,
    LoadedForm,
    REGION,
    assertOpen,
    buildPublicForm,
    createUploadTarget,
    fileStorage,
    getFormsSecret,
    loadFormByToken,
    minSessionAgeMs,
    sessionFilePath,
    storeSubmission,
    str,
    uploadsCol
} from './forms-server';
import { clientIp, consumeRateLimits } from './public-rate-limit';
import { isBlockedFileType, quotaAllows, sanitizeFileName } from './files-logic';

type Handler = (req: functions.https.Request) => Promise<Record<string, unknown> | { status: number; body: Record<string, unknown> }>;

const endpoint = (method: 'GET' | 'POST', handler: Handler) =>
    functions.region(REGION).https.onRequest((req, res) => corsMiddleware(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        if (req.method !== method) {
            res.status(405).json({ error: 'method-not-allowed' });
            return;
        }
        try {
            const result = await handler(req);
            if ('status' in result && 'body' in result && typeof result.status === 'number') {
                res.status(result.status).json(result.body);
            } else {
                res.status(200).json(result);
            }
        } catch (error) {
            if (error instanceof FormFailure) {
                res.status(HTTP_STATUS[error.code]).json({ error: error.code, ...(error.details || {}) });
                return;
            }
            functions.logger.error('forms public endpoint failed', error);
            res.status(500).json({ error: 'internal' });
        }
    }));

const bodyOf = (req: functions.https.Request): Record<string, any> => {
    let body: unknown = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            body = null;
        }
    }
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, any>) : {};
};

// ---------------------------------------------------------------------------
// getPublicForm
// ---------------------------------------------------------------------------

export const getPublicForm = endpoint('GET', async (req) => {
    const token = str(req.query && req.query.token, 80);
    const now = Date.now();
    const loaded = await loadFormByToken(token, now);
    const { index } = loaded;
    if (index.audience === 'workspace') {
        return { status: 'workspace', tenantId: loaded.tenantId, formId: loaded.formId, title: index.title || '', language: index.language || 'de' };
    }
    const form = buildPublicForm(index, loaded.tenant, loaded.quota);
    if (loaded.state !== 'open') {
        const status = loaded.state === 'limit' || loaded.state === 'limit-plan' ? 'limit' : loaded.state;
        return { status, title: form.title, theme: form.theme, language: form.language, legal: form.legal };
    }
    return { status: 'open', form, session: signFormSession(await getFormsSecret(), token, now) };
});

// ---------------------------------------------------------------------------
// createPublicFormUpload
// ---------------------------------------------------------------------------

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export const createPublicFormUpload = endpoint('POST', async (req) => {
    const body = bodyOf(req);
    const token = str(body.token, 80);
    const now = Date.now();
    const loaded = await loadFormByToken(token, now);
    assertOpen(loaded);
    const secret = await getFormsSecret();
    const check = verifyFormSession(secret, body.session, token, now);
    if (!check.ok) throw new FormFailure('form-session-invalid');

    const ip = hashIp(dailySalt(secret, now), clientIp(req as any));
    if (!(await consumeRateLimits([{ scope: 'formupl_hour', key: `${token}|${ip}`, max: 20, windowMs: 3600000 }]))) {
        throw new FormFailure('rate-limited');
    }

    const field = ((loaded.index.schema && loaded.index.schema.fields) || []).find((entry: FormField) => entry.id === str(body.fieldId, 60));
    if (!field || field.type !== 'fileUpload') throw new FormFailure('form-upload-invalid');
    if (!loaded.quota.uploads) throw new FormFailure('plan-form-feature', { feature: 'uploads' });

    const name = sanitizeFileName(body.name);
    const contentType = str(body.contentType, 100).toLowerCase();
    const size = Number(body.size);
    if (!name || !contentType || !isFinite(size) || size < 1 || Math.floor(size) !== size) throw new FormFailure('form-upload-invalid');
    if (isBlockedFileType(name, contentType) || !fileKindAllows(field.fileKinds, contentType, name)) throw new FormFailure('form-upload-invalid');
    if (typeof field.maxFileBytes === 'number' && size > field.maxFileBytes) throw new FormFailure('form-upload-invalid');

    const usage = await fileStorage().getWorkspaceFileUsage(loaded.tenantId);
    if (size > usage.maxFileBytes) throw new FormFailure('plan-file-too-large', { maxBytes: usage.maxFileBytes });
    if (!quotaAllows(usage.usedBytes, usage.quotaBytes, size)) throw new FormFailure('plan-storage-limit');

    const ref = uploadsCol(loaded.tenantId).doc();
    const objectPath = sessionFilePath(loaded.tenantId, loaded.formId, ref.id, name);
    const target = await createUploadTarget(objectPath, contentType, size);
    await ref.set({
        formId: loaded.formId,
        token,
        sessionNonce: check.nonce,
        fieldId: field.id,
        name,
        size,
        contentType,
        objectPath,
        status: 'pending',
        createdAt: Timestamp.fromMillis(now),
        expireAt: Timestamp.fromMillis(now + PENDING_TTL_MS)
    });
    return { fileId: ref.id, uploadUrl: target.url, method: target.method, headers: target.headers, name: safeObjectName(name) };
});

// ---------------------------------------------------------------------------
// submitPublicForm
// ---------------------------------------------------------------------------

const submitSize = (req: functions.https.Request): number => {
    const raw = (req as any).rawBody;
    if (raw && typeof raw.length === 'number') return raw.length;
    return Number(req.headers['content-length']) || 0;
};

export const submitPublicForm = endpoint('POST', async (req) => {
    if (submitSize(req) > MAX_SUBMIT_BYTES) return { status: 413, body: { error: 'payload-too-large' } };
    const body = bodyOf(req);
    const token = str(body.token, 80);
    const now = Date.now();

    // 1. Form must exist, be public and accept responses (closing date, response cap, plan).
    const loaded: LoadedForm = await loadFormByToken(token, now, { freshTenant: true });
    if (loaded.index.audience === 'workspace') throw new FormFailure('form-not-found');
    assertOpen(loaded);

    // 2. Session: signed, 3 s to 24 h old.
    const secret = await getFormsSecret();
    const check = verifyFormSession(secret, body.session, token, now, { minAgeMs: minSessionAgeMs() });
    if (!check.ok) throw new FormFailure('form-session-invalid');

    // Honeypot: bots fill it. Silent success, nothing stored.
    if (typeof body.website === 'string' && body.website.trim()) return { ok: true, confirmation: {} };

    // 3. Rate limits (IP only as a daily-salted hash inside the limit key).
    const ip = hashIp(dailySalt(secret, now), clientIp(req as any));
    const allowed = await consumeRateLimits([
        { scope: 'formsub_min', key: `${token}|${ip}`, max: 5, windowMs: 60000 },
        { scope: 'formsub_hour', key: `${token}|${ip}`, max: 30, windowMs: 3600000 },
        { scope: 'formsub_form', key: token, max: 600, windowMs: 3600000 },
        { scope: 'formsub_tenant', key: loaded.tenantId, max: 3000, windowMs: 3600000 }
    ]);
    if (!allowed) throw new FormFailure('rate-limited');

    // 4. Validation, uploads, spam heuristic, write.
    if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) {
        throw new FormFailure('form-invalid-answers', { fieldErrors: [] });
    }
    const durationMs = Math.max(0, Math.min(Number(body.durationMs) || 0, 86400000));
    const source = body.source === 'embed' ? 'embed' : 'link';
    const stored = await storeSubmission({ loaded, rawAnswers: body.answers, source, durationMs, nonce: check.nonce, now });
    return { ok: true, confirmation: stored.confirmation };
});
