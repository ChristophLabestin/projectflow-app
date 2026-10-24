// Forms — callables for signed-in members (brain/plans/forms-api-contract.md, forms-concept.md §8).
// Every write to forms, versions, public_forms and responses happens here or in forms-public.ts
// (Firestore rules deny client writes).
import * as functions from 'firebase-functions/v1';
import { FieldValue } from 'firebase-admin/firestore';

import {
    FORM_ASSET_KINDS,
    FORM_ASSET_MAX_BYTES,
    FORM_ASSET_TYPES,
    assetPrefix,
    cleanText,
    compact,
    defaultSchema,
    defaultSettings,
    defaultTheme,
    randomId,
    sanitizeActions,
    sanitizeOrigins,
    sanitizeSchema,
    sanitizeSettings,
    sanitizeTheme,
    signFormSession,
    verifyFormSession
} from './forms-helpers';
import {
    FORM_LIMITS,
    canCreateForms,
    canEditForm,
    canFillWorkspaceForm,
    canManageAllForms,
    formFeaturesUsed,
    validateFormSchema
} from './forms-logic';
import {
    FormFailure,
    REGION,
    assertOpen,
    buildPublicForm,
    countActiveForms,
    createUploadTarget,
    fileStorage,
    formRef,
    formsCol,
    getFormsSecret,
    guarded,
    isTenantLegalComplete,
    legalOf,
    loadAccess,
    loadFormByToken,
    loadQuota,
    minSessionAgeMs,
    newShareToken,
    publicFormRef,
    publicAssetUrl,
    requireAuth,
    requireId,
    storeSubmission,
    str,
    uploadsCol,
    MemberAccess
} from './forms-server';
import { consumeRateLimits } from './public-rate-limit';
import { db } from './init';
import { FAST_START } from './runtime-options';
import { assertTenantActive } from './tenant-status';

const call = (handler: (data: Record<string, any>, context: functions.https.CallableContext) => Promise<unknown>) =>
    functions.region(REGION).runWith(FAST_START).https.onCall((data, context) => guarded(() => handler((data || {}) as Record<string, any>, context)));

const setup = async (data: Record<string, any>, context: functions.https.CallableContext) => {
    const uid = requireAuth(context);
    const tenantId = requireId(data.tenantId, 'tenantId');
    await assertTenantActive(tenantId);
    const access = await loadAccess(tenantId, uid);
    return { uid, tenantId, access };
};

const loadForm = async (tenantId: string, formId: string) => {
    const snap = await formRef(tenantId, formId).get();
    if (!snap.exists) throw new FormFailure('form-not-found');
    return snap.data() || {};
};

const requireEdit = async (tenantId: string, formId: string, access: MemberAccess) => {
    const form = await loadForm(tenantId, formId);
    if (!canEditForm(form as any, access)) throw new FormFailure('permission-denied');
    return form;
};

const userLanguage = async (uid: string): Promise<'de' | 'en'> => {
    const snap = await db.doc(`users/${uid}`).get().catch(() => null);
    return str(snap && snap.get('language'), 10).toLowerCase().startsWith('en') ? 'en' : 'de';
};

const allowedAudience = (audience: unknown, quota: { workspaceAudience: boolean }): 'public' | 'workspace' => {
    if (audience === 'workspace') {
        if (!quota.workspaceAudience) throw new FormFailure('plan-form-feature', { feature: 'workspaceAudience' });
        return 'workspace';
    }
    return 'public';
};

const cleanTitle = (value: unknown) => {
    const title = cleanText(value, FORM_LIMITS.titleMax);
    if (!title) throw new FormFailure('invalid-argument', { field: 'title' });
    return title;
};

/** Settings keep `allowGuests` in sync with the top-level flag the rules/helpers read. */
const guestFlag = (patch: Record<string, any>, current: Record<string, any>): boolean => {
    if (typeof patch.allowGuests === 'boolean') return patch.allowGuests;
    if (patch.settings && typeof patch.settings.allowGuests === 'boolean') return patch.settings.allowGuests;
    return current.allowGuests === true;
};

// ---------------------------------------------------------------------------
// createForm / saveFormDraft
// ---------------------------------------------------------------------------

export const createForm = call(async (data, context) => {
    const { uid, tenantId, access } = await setup(data, context);
    if (!canCreateForms(access)) throw new FormFailure('permission-denied');
    const quota = await loadQuota(tenantId, access.tenant);
    // The builder sends its UI language (templates are written in it); else the profile language.
    const language = data.language === 'en' || data.language === 'de' ? data.language : await userLanguage(uid);
    const ref = formsCol(tenantId).doc();
    const audience = allowedAudience(data.audience, quota);
    const draft = data.draft !== undefined ? sanitizeSchema(data.draft) : defaultSchema(language);
    await ref.set(compact({
        title: cleanTitle(data.title),
        description: cleanText(data.description, FORM_LIMITS.helpMax),
        status: 'draft',
        ownerId: uid,
        editorIds: [],
        audience,
        anonymous: false,
        allowGuests: false,
        layout: 'classic',
        language,
        draft: draft.sections.length ? draft : defaultSchema(language),
        publishedVersion: null,
        shareToken: null,
        embed: { allowedOrigins: [] },
        theme: defaultTheme(),
        settings: { ...defaultSettings(uid), closesAt: null, maxResponses: null, onePerMember: false, allowGuests: false, consent: null, hideBranding: false },
        actions: {},
        counts: { responses: 0, spam: 0, lastResponseAt: null },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    }));
    return { formId: ref.id };
});

const PATCH_KEYS = ['title', 'description', 'draft', 'audience', 'anonymous', 'allowGuests', 'language', 'layout', 'theme', 'settings', 'embed', 'actions'];

export const saveFormDraft = call(async (data, context) => {
    const { tenantId, access } = await setup(data, context);
    const formId = requireId(data.formId, 'formId');
    const form = await requireEdit(tenantId, formId, access);
    const patch: Record<string, any> = data.patch && typeof data.patch === 'object' ? data.patch : {};
    const quota = await loadQuota(tenantId, access.tenant);
    const update: Record<string, any> = {};
    const has = (key: string) => PATCH_KEYS.indexOf(key) >= 0 && patch[key] !== undefined;

    if (has('title')) update.title = cleanTitle(patch.title);
    if (has('description')) update.description = cleanText(patch.description, FORM_LIMITS.helpMax);
    if (has('draft')) update.draft = sanitizeSchema(patch.draft);
    if (has('audience')) update.audience = allowedAudience(patch.audience, quota);
    if (has('anonymous')) update.anonymous = patch.anonymous === true;
    if (has('language')) update.language = patch.language === 'en' ? 'en' : 'de';
    if (has('layout')) update.layout = patch.layout === 'oneByOne' ? 'oneByOne' : 'classic';
    if (has('theme')) update.theme = sanitizeTheme(patch.theme, quota, { tenantId, formId }, form.theme);
    if (has('embed')) update.embed = { allowedOrigins: sanitizeOrigins(patch.embed && patch.embed.allowedOrigins) };
    if (has('actions')) {
        const actions = sanitizeActions(patch.actions);
        if (actions.createTask) {
            const project = await db.doc(`tenants/${tenantId}/projects/${actions.createTask.projectId}`).get();
            if (!project.exists) throw new FormFailure('invalid-argument', { field: 'actions.createTask.projectId' });
        }
        update.actions = actions;
    }
    if (has('settings') || has('allowGuests')) {
        const merged = sanitizeSettings(has('settings') ? patch.settings : {}, form.settings, quota);
        merged.allowGuests = guestFlag(patch, form);
        update.settings = merged;
        update.allowGuests = merged.allowGuests;
        // Notification recipients must be members of the workspace.
        if (has('settings') && patch.settings && Array.isArray(patch.settings.notifyMemberIds)) {
            const snaps = await db.getAll(...merged.notifyMemberIds.map((id: string) => db.doc(`tenants/${tenantId}/members/${id}`)));
            merged.notifyMemberIds = merged.notifyMemberIds.filter((_: string, i: number) => snaps[i].exists);
        }
    }
    update.updatedAt = FieldValue.serverTimestamp();
    await formRef(tenantId, formId).update(compact(update));
    return { updatedAt: Date.now() };
});

// ---------------------------------------------------------------------------
// publishForm / setFormStatus / regenerateFormLink
// ---------------------------------------------------------------------------

export const publishForm = call(async (data, context) => {
    const { uid, tenantId, access } = await setup(data, context);
    const formId = requireId(data.formId, 'formId');
    const form = await requireEdit(tenantId, formId, access);
    const schema = sanitizeSchema(form.draft);
    const issues = validateFormSchema(schema);
    if (issues.length) throw new FormFailure('form-invalid', { issues });

    const quota = await loadQuota(tenantId, access.tenant);
    const used = formFeaturesUsed(schema);
    if (used.uploads && !quota.uploads) throw new FormFailure('plan-form-feature', { feature: 'uploads' });
    if (used.logic && !quota.logic) throw new FormFailure('plan-form-feature', { feature: 'logic' });
    const audience = allowedAudience(form.audience, quota);
    if (audience === 'public' && !isTenantLegalComplete(access.tenant.legal)) throw new FormFailure('form-legal-missing');
    const wasActive = form.status === 'published' || form.status === 'paused';
    if (!wasActive && quota.activeForms !== null && (await countActiveForms(tenantId)) >= quota.activeForms) {
        throw new FormFailure('plan-form-limit', { limit: quota.activeForms });
    }

    let theme: Record<string, any> = sanitizeTheme(form.theme, quota, { tenantId, formId }, form.theme);
    if (theme.themeId) {
        const saved = await db.doc(`tenants/${tenantId}/form_themes/${theme.themeId}`).get();
        theme = sanitizeTheme(saved.exists ? saved.get('theme') : null, quota, { tenantId, formId }, null);
    }
    const settings = sanitizeSettings(form.settings, form.settings, quota);
    const embed = { allowedOrigins: sanitizeOrigins(form.embed && form.embed.allowedOrigins) };

    const ref = formRef(tenantId, formId);
    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const live = snap.data() || {};
        const version = (Number(live.publishedVersion) || 0) + 1;
        const token = str(live.shareToken, 80) || newShareToken();
        const stamp = FieldValue.serverTimestamp();
        tx.set(ref.collection('versions').doc(String(version)), compact({
            version,
            sections: schema.sections,
            fields: schema.fields,
            title: form.title,
            description: form.description || '',
            language: form.language || 'de',
            publishedBy: uid,
            publishedAt: stamp
        }));
        tx.set(publicFormRef(token), compact({
            tenantId,
            formId,
            status: 'published',
            version,
            title: form.title,
            description: form.description || '',
            language: form.language || 'de',
            layout: form.layout || 'classic',
            audience,
            schema,
            theme,
            settings: { confirmation: settings.confirmation, consent: settings.consent, hideBranding: settings.hideBranding },
            features: used,
            embed,
            legal: legalOf(access.tenant),
            publishedAt: stamp
        }));
        tx.update(ref, { status: 'published', publishedVersion: version, shareToken: token, settings, theme: form.theme && form.theme.themeId ? form.theme : theme, publishedAt: stamp, updatedAt: stamp });
        return { version, shareToken: token };
    });
    return { ...result, status: 'published' };
});

export const setFormStatus = call(async (data, context) => {
    const { tenantId, access } = await setup(data, context);
    const formId = requireId(data.formId, 'formId');
    const status = str(data.status, 20);
    if (['published', 'paused', 'closed'].indexOf(status) < 0) throw new FormFailure('invalid-argument', { field: 'status' });
    const form = await requireEdit(tenantId, formId, access);
    const token = str(form.shareToken, 80);
    if (!form.publishedVersion || !token) throw new FormFailure('form-not-published');
    if (status === 'published' && form.status !== 'published' && form.status !== 'paused') {
        const quota = await loadQuota(tenantId, access.tenant);
        if (quota.activeForms !== null && (await countActiveForms(tenantId)) >= quota.activeForms) {
            throw new FormFailure('plan-form-limit', { limit: quota.activeForms });
        }
    }
    const batch = db.batch();
    // updatedAt stays untouched: the builder compares it with publishedAt to offer "publish changes".
    batch.update(formRef(tenantId, formId), { status });
    batch.set(publicFormRef(token), { status }, { merge: true });
    await batch.commit();
    return { status };
});

export const regenerateFormLink = call(async (data, context) => {
    const { tenantId, access } = await setup(data, context);
    const formId = requireId(data.formId, 'formId');
    const form = await requireEdit(tenantId, formId, access);
    const oldToken = str(form.shareToken, 80);
    if (!form.publishedVersion || !oldToken) throw new FormFailure('form-not-published');
    const shareToken = newShareToken();
    await db.runTransaction(async (tx) => {
        const oldRef = publicFormRef(oldToken);
        const oldSnap = await tx.get(oldRef);
        if (oldSnap.exists) tx.set(publicFormRef(shareToken), oldSnap.data() || {});
        tx.delete(oldRef);
        tx.update(formRef(tenantId, formId), { shareToken });
    });
    return { shareToken };
});

// ---------------------------------------------------------------------------
// duplicateForm / deleteForm / setFormEditors
// ---------------------------------------------------------------------------

export const duplicateForm = call(async (data, context) => {
    const { uid, tenantId, access } = await setup(data, context);
    const formId = requireId(data.formId, 'formId');
    const form = await requireEdit(tenantId, formId, access);
    if (!canCreateForms(access)) throw new FormFailure('permission-denied');
    const language = form.language === 'en' ? 'en' : 'de';
    const ref = formsCol(tenantId).doc();
    // Theme assets live per form: copy them into the new form's folder.
    const theme: Record<string, any> = JSON.parse(JSON.stringify(form.theme || defaultTheme()));
    const copyAsset = async (path: unknown): Promise<string> => {
        if (typeof path !== 'string' || !path.startsWith(assetPrefix(tenantId, formId))) return '';
        const target = `${assetPrefix(tenantId, ref.id)}${path.slice(assetPrefix(tenantId, formId).length)}`;
        try {
            await fileStorage().fileBucket().file(path).copy(target);
            return target;
        } catch {
            return '';
        }
    };
    for (const key of ['logoPath', 'coverPath']) {
        if (theme[key]) {
            const copied = await copyAsset(theme[key]);
            if (copied) theme[key] = copied;
            else delete theme[key];
        }
    }
    if (theme.background && theme.background.imagePath) {
        const copied = await copyAsset(theme.background.imagePath);
        if (copied) theme.background.imagePath = copied;
        else theme.background = { type: 'color', color: defaultTheme().background.color };
    }
    const settings = { ...(form.settings || defaultSettings(uid)), notifyMemberIds: [uid] };
    await ref.set(compact({
        title: `${form.title} ${language === 'de' ? '(Kopie)' : '(Copy)'}`.slice(0, FORM_LIMITS.titleMax),
        description: form.description || '',
        status: 'draft',
        ownerId: uid,
        editorIds: [],
        audience: form.audience || 'public',
        anonymous: form.anonymous === true,
        allowGuests: form.allowGuests === true,
        layout: form.layout || 'classic',
        language,
        draft: form.draft,
        publishedVersion: null,
        shareToken: null,
        embed: form.embed || { allowedOrigins: [] },
        theme,
        settings,
        actions: form.actions || {},
        counts: { responses: 0, spam: 0, lastResponseAt: null },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    }));
    return { formId: ref.id };
});

export const deleteForm = call(async (data, context) => {
    const { uid, tenantId, access } = await setup(data, context);
    const formId = requireId(data.formId, 'formId');
    const form = await loadForm(tenantId, formId);
    if (form.ownerId !== uid && !canManageAllForms(access)) throw new FormFailure('permission-denied');

    const { fileBucket, filesCollectionRef } = fileStorage();
    const bucket = (() => {
        try {
            return fileBucket();
        } catch {
            return null;
        }
    })();
    const removeObject = async (path: unknown) => {
        if (bucket && typeof path === 'string' && path) await bucket.file(path).delete({ ignoreNotFound: true }).catch(() => undefined);
    };

    // Files of responses (records + objects) and pending uploads.
    const files = await filesCollectionRef(tenantId).where('formId', '==', formId).get();
    for (const doc of files.docs) {
        await removeObject(doc.get('providerRef.firebasePath'));
        await doc.ref.delete();
    }
    const pending = await uploadsCol(tenantId).where('formId', '==', formId).get();
    for (const doc of pending.docs) {
        await removeObject(doc.get('objectPath'));
        await doc.ref.delete();
    }
    if (bucket) await bucket.deleteFiles({ prefix: `public/forms/${tenantId}/${formId}/`, force: true }).catch(() => undefined);

    const token = str(form.shareToken, 80);
    if (token) await publicFormRef(token).delete();
    await db.recursiveDelete(formRef(tenantId, formId));
    return { ok: true };
});

export const setFormEditors = call(async (data, context) => {
    const { uid, tenantId, access } = await setup(data, context);
    const formId = requireId(data.formId, 'formId');
    const form = await requireEdit(tenantId, formId, access);
    const isOwnerOrManager = form.ownerId === uid || canManageAllForms(access);
    const ownerId = data.ownerId === undefined ? form.ownerId : str(data.ownerId, 128);
    if (ownerId !== form.ownerId && !isOwnerOrManager) throw new FormFailure('permission-denied');
    const requested: string[] = Array.isArray(data.editorIds) ? data.editorIds.filter((id: unknown): id is string => typeof id === 'string').map((id: string) => id.trim()) : [];
    const editorIds = Array.from(new Set<string>(requested)).filter((id) => /^[A-Za-z0-9_-]{1,128}$/.test(id) && id !== ownerId).slice(0, 50);
    const ids = Array.from(new Set<string>([...editorIds, ownerId]));
    const snaps = await db.getAll(...ids.map((id) => db.doc(`tenants/${tenantId}/members/${id}`)));
    const fullMember = (id: string) => {
        const snap = snaps[ids.indexOf(id)];
        return snap.exists && str(snap.get('role')) !== 'Guest';
    };
    if (!fullMember(ownerId) || editorIds.some((id) => !fullMember(id))) throw new FormFailure('invalid-argument', { field: 'editorIds' });
    await formRef(tenantId, formId).update({ editorIds, ownerId, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true };
});

// ---------------------------------------------------------------------------
// createFormAssetUpload
// ---------------------------------------------------------------------------

export const createFormAssetUpload = call(async (data, context) => {
    const { tenantId, access } = await setup(data, context);
    const formId = requireId(data.formId, 'formId');
    await requireEdit(tenantId, formId, access);
    const kind = str(data.kind, 20);
    const contentType = str(data.contentType, 60).toLowerCase();
    const size = Number(data.size);
    if ((FORM_ASSET_KINDS as readonly string[]).indexOf(kind) < 0 || !FORM_ASSET_TYPES[contentType]) throw new FormFailure('form-upload-invalid');
    if (!isFinite(size) || size < 1) throw new FormFailure('form-upload-invalid');
    if (size > FORM_ASSET_MAX_BYTES) throw new FormFailure('plan-file-too-large', { maxBytes: FORM_ASSET_MAX_BYTES });
    const quota = await loadQuota(tenantId, access.tenant);
    if (!quota.fullTheme) throw new FormFailure('plan-form-feature', { feature: 'fullTheme' });
    const path = `${assetPrefix(tenantId, formId)}${kind}-${randomId(8)}.${FORM_ASSET_TYPES[contentType]}`;
    const target = await createUploadTarget(path, contentType, Math.floor(size));
    return { uploadUrl: target.url, method: target.method, path, publicUrl: publicAssetUrl(path), headers: target.headers };
});

// ---------------------------------------------------------------------------
// getFormForMember / submitFormAsMember
// ---------------------------------------------------------------------------

const memberForm = async (data: Record<string, any>, uid: string, now: number) => {
    let token = str(data.token, 80);
    let tenantId = '';
    if (!token) {
        tenantId = requireId(data.tenantId, 'tenantId');
        const form = await loadForm(tenantId, requireId(data.formId, 'formId'));
        token = str(form.shareToken, 80);
        if (!token) throw new FormFailure('form-not-published');
    }
    const loaded = await loadFormByToken(token, now, { freshTenant: true });
    if (tenantId && loaded.tenantId !== tenantId) throw new FormFailure('form-not-found');
    await assertTenantActive(loaded.tenantId);
    const access = await loadAccess(loaded.tenantId, uid);
    if (!canFillWorkspaceForm({ allowGuests: loaded.form.allowGuests === true }, access)) throw new FormFailure('permission-denied');
    return loaded;
};

export const getFormForMember = call(async (data, context) => {
    const uid = requireAuth(context);
    const now = Date.now();
    const loaded = await memberForm(data, uid, now);
    assertOpen(loaded);
    const session = signFormSession(await getFormsSecret(), loaded.token, now);
    return {
        status: 'open',
        tenantId: loaded.tenantId,
        formId: loaded.formId,
        token: loaded.token,
        form: buildPublicForm(loaded.index, loaded.tenant, loaded.quota),
        session
    };
});

export const submitFormAsMember = call(async (data, context) => {
    const uid = requireAuth(context);
    const now = Date.now();
    const source = data.source === 'ios' ? 'ios' : 'app';
    const loaded = await memberForm(data, uid, now);
    assertOpen(loaded);
    const check = verifyFormSession(await getFormsSecret(), data.session, loaded.token, now, { minAgeMs: minSessionAgeMs() });
    if (!check.ok) throw new FormFailure('form-session-invalid');
    const allowed = await consumeRateLimits([
        { scope: 'formmem_min', key: `${loaded.token}|${uid}`, max: 10, windowMs: 60000 },
        { scope: 'formmem_hour', key: `${loaded.token}|${uid}`, max: 60, windowMs: 3600000 },
        { scope: 'formsub_form', key: loaded.token, max: 600, windowMs: 3600000 },
        { scope: 'formsub_tenant', key: loaded.tenantId, max: 3000, windowMs: 3600000 }
    ]);
    if (!allowed) throw new FormFailure('rate-limited');
    const answers = data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers) ? data.answers : null;
    if (!answers) throw new FormFailure('form-invalid-answers', { fieldErrors: [] });
    const durationMs = Math.max(0, Math.min(Number(data.durationMs) || 0, 86400000));
    const stored = await storeSubmission({ loaded, rawAnswers: answers, source, durationMs, nonce: check.nonce, uid, now });
    return { responseId: stored.responseId, confirmation: stored.confirmation };
});
