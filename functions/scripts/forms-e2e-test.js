// End-to-end check of Forms package 2 against throw-away emulators (never production).
//
//   cd functions && npm run test:forms
//
// Callables (create/save/publish/status/duplicate/delete/editors/assets/member fill) and the public HTTP
// endpoints (getPublicForm, createPublicFormUpload, submitPublicForm): permissions, plan gates, legal gate,
// check chain (session age, honeypot, validation, hidden answers, spam heuristic, rate limit), uploads.
const assert = require('node:assert/strict');

process.env.GCLOUD_PROJECT = 'demo-projectflow';
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-projectflow' });
const db = admin.firestore();

const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9955'}`;
const FUNCTIONS = 'http://127.0.0.1:5955/demo-projectflow/europe-west3';
const MIN_AGE_MS = Number(process.env.FORMS_MIN_SESSION_MS || 1500);

const T = 'ws-forms'; // team plan, legal complete
const T2 = 'ws-nolegal'; // team plan, no legal details
const T3 = 'ws-free'; // free plan, legal complete

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const check = async (label, fn) => {
    try {
        await fn();
        results.push({ label, ok: true });
    } catch (error) {
        results.push({ label, ok: false, error: String(error.message).split('\n')[0] });
    }
};

const signUp = async (email) => {
    const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'secret-123', returnSecureToken: true })
    });
    const body = await res.json();
    return { uid: body.localId, token: body.idToken };
};

const call = async (name, user, data) => {
    const res = await fetch(`${FUNCTIONS}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
        body: JSON.stringify({ data })
    });
    const body = await res.json();
    if (body.error) {
        const error = new Error(body.error.message);
        error.status = body.error.status;
        error.details = body.error.details;
        throw error;
    }
    return body.result;
};

const expectError = async (promise, status, message) => {
    try {
        await promise;
    } catch (error) {
        assert.equal(error.status, status, `${error.status}: ${error.message}`);
        if (message) assert.equal(error.message, message);
        return error;
    }
    throw new Error(`expected ${status}`);
};

const http = async (name, { method = 'POST', body, query = '' } = {}) => {
    const res = await fetch(`${FUNCTIONS}/${name}${query}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
};

const getForm = (token) => http('getPublicForm', { method: 'GET', query: `?token=${encodeURIComponent(token)}` });
const submit = (token, session, answers, extra = {}) =>
    http('submitPublicForm', { body: { token, session, answers, website: '', durationMs: 4200, source: 'link', ...extra } });

const draftSchema = () => ({
    sections: [{ id: 's1', title: 'Allgemein' }],
    fields: [
        { id: 'name', sectionId: 's1', type: 'shortText', label: 'Name', required: true },
        { id: 'mail', sectionId: 's1', type: 'email', label: 'E-Mail', isRespondentEmail: true },
        { id: 'topic', sectionId: 's1', type: 'singleChoice', label: 'Thema', required: true, options: [{ id: 'a', label: 'Allgemein' }, { id: 'b', label: 'Bug' }] },
        { id: 'bug', sectionId: 's1', type: 'longText', label: 'Fehlerbeschreibung', required: true, showIf: { mode: 'all', rules: [{ fieldId: 'topic', op: 'equals', value: 'b' }] } }
    ]
});

const responses = async (tenantId, formId) => (await db.collection(`tenants/${tenantId}/forms/${formId}/responses`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

(async () => {
    const owner = await signUp('owner@example.test');
    const anna = await signUp('anna@example.test');
    const bob = await signUp('bob@example.test');
    const guest = await signUp('guest@example.test');
    const outsider = await signUp('out@example.test');

    for (const [tenantId, name] of [[T, 'Forms Test'], [T2, 'No Legal'], [T3, 'Free Test']]) {
        await db.doc(`tenants/${tenantId}`).set({
            tenantId, name, ownerId: owner.uid,
            ...(tenantId === T2 ? {} : { legal: { controllerName: 'Muster GmbH', privacyPolicyUrl: 'https://example.com/privacy', imprintUrl: 'https://example.com/imprint' } })
        });
        await db.doc(`tenants/${tenantId}/entitlements/plan`).set({ plan: tenantId === T3 ? 'free' : 'team' });
        await db.doc(`tenants/${tenantId}/members/${owner.uid}`).set({ uid: owner.uid, role: 'Owner', displayName: 'Olga' });
        await db.doc(`tenants/${tenantId}/members/${anna.uid}`).set({ uid: anna.uid, role: 'Member', displayName: 'Anna' });
        await db.doc(`tenants/${tenantId}/members/${bob.uid}`).set({ uid: bob.uid, role: 'Member', displayName: 'Bob' });
        await db.doc(`tenants/${tenantId}/members/${guest.uid}`).set({ uid: guest.uid, role: 'Guest', displayName: 'Gast' });
    }
    await db.doc(`users/${anna.uid}`).set({ uid: anna.uid, language: 'en' });

    let formId;
    let token;

    // --- Permissions on create / edit -------------------------------------------------------------------
    await check('guest and outsider cannot create forms, member can (defaults applied)', async () => {
        await expectError(call('createForm', guest, { tenantId: T, title: 'Nope' }), 'PERMISSION_DENIED');
        await expectError(call('createForm', outsider, { tenantId: T, title: 'Nope' }), 'PERMISSION_DENIED');
        await expectError(call('createForm', null, { tenantId: T, title: 'Nope' }), 'UNAUTHENTICATED');
        await expectError(call('createForm', anna, { tenantId: T, title: '   ' }), 'INVALID_ARGUMENT');
        ({ formId } = await call('createForm', anna, { tenantId: T, title: 'Kontakt' }));
        const form = (await db.doc(`tenants/${T}/forms/${formId}`).get()).data();
        assert.equal(form.status, 'draft');
        assert.equal(form.ownerId, anna.uid);
        assert.equal(form.audience, 'public');
        assert.equal(form.language, 'en');
        assert.equal(form.layout, 'classic');
        assert.equal(form.theme.preset, 'projectflow-light');
        assert.equal(form.settings.retentionMonths, 12);
        assert.deepEqual(form.settings.notifyMemberIds, [anna.uid]);
        assert.deepEqual(form.counts, { responses: 0, spam: 0, lastResponseAt: null });
        assert.equal(form.draft.sections.length, 1);
        assert.equal(form.draft.fields.length, 1);
        assert.equal(form.publishedVersion, null);
    });

    await check('member cannot edit someone else\'s form; owner/admin can; editor can after setFormEditors', async () => {
        await expectError(call('saveFormDraft', bob, { tenantId: T, formId, patch: { title: 'Hijack' } }), 'PERMISSION_DENIED');
        await expectError(call('publishForm', bob, { tenantId: T, formId }), 'PERMISSION_DENIED');
        await expectError(call('setFormStatus', bob, { tenantId: T, formId, status: 'paused' }), 'PERMISSION_DENIED');
        await expectError(call('deleteForm', bob, { tenantId: T, formId }), 'PERMISSION_DENIED');
        await expectError(call('saveFormDraft', guest, { tenantId: T, formId, patch: { title: 'x' } }), 'PERMISSION_DENIED');
        await expectError(call('saveFormDraft', outsider, { tenantId: T, formId, patch: { title: 'x' } }), 'PERMISSION_DENIED');
        await call('saveFormDraft', owner, { tenantId: T, formId, patch: { description: 'by admin' } });
        await expectError(call('setFormEditors', bob, { tenantId: T, formId, editorIds: [bob.uid] }), 'PERMISSION_DENIED');
        await expectError(call('setFormEditors', anna, { tenantId: T, formId, editorIds: [guest.uid] }), 'INVALID_ARGUMENT');
        await call('setFormEditors', anna, { tenantId: T, formId, editorIds: [bob.uid, anna.uid] });
        assert.deepEqual((await db.doc(`tenants/${T}/forms/${formId}`).get()).get('editorIds'), [bob.uid]);
        await call('saveFormDraft', bob, { tenantId: T, formId, patch: { title: 'Kontakt (Bob)' } });
        await expectError(call('setFormEditors', bob, { tenantId: T, formId, editorIds: [], ownerId: bob.uid }), 'PERMISSION_DENIED');
        await call('setFormEditors', anna, { tenantId: T, formId, editorIds: [bob.uid] });
    });

    await check('saveFormDraft normalizes: unknown keys, bad colors, plan-gated fields', async () => {
        await call('saveFormDraft', anna, {
            tenantId: T, formId,
            patch: {
                title: 'Kontakt', draft: { ...draftSchema(), evil: 'x', fields: [...draftSchema().fields, { id: 'zz', sectionId: 's1', type: 'bogus', label: 'x' }] },
                theme: { preset: 'forest', accent: 'red', font: 'comic' }, settings: { hideBranding: true, retentionMonths: 3, notifyMemberIds: [anna.uid, 'ghost'] },
                embed: { allowedOrigins: ['https://example.org/x', 'http://evil.example'] }, status: 'published', ownerId: bob.uid, unknown: 1
            }
        });
        const form = (await db.doc(`tenants/${T}/forms/${formId}`).get()).data();
        assert.equal(form.draft.fields.length, 4);
        assert.equal(form.draft.evil, undefined);
        assert.equal(form.theme.accent, '#4f46e5');
        assert.equal(form.theme.font, 'plus-jakarta-sans');
        assert.equal(form.theme.preset, 'forest');
        assert.equal(form.settings.hideBranding, true); // team plan may hide branding
        assert.equal(form.settings.retentionMonths, 3);
        assert.deepEqual(form.settings.notifyMemberIds, [anna.uid]);
        assert.deepEqual(form.embed.allowedOrigins, ['https://example.org']);
        assert.equal(form.status, 'draft');
        assert.equal(form.ownerId, anna.uid);
    });

    // --- Publish -----------------------------------------------------------------------------------------
    await check('publishForm: legal details missing -> form-legal-missing', async () => {
        const { formId: other } = await call('createForm', anna, { tenantId: T2, title: 'Ohne Legal' });
        await expectError(call('publishForm', anna, { tenantId: T2, formId: other }), 'FAILED_PRECONDITION', 'form-legal-missing');
        await db.doc(`tenants/${T2}`).update({ legal: { controllerName: 'X GmbH', privacyPolicyUrl: 'https://example.com/p' } });
        const published = await call('publishForm', anna, { tenantId: T2, formId: other });
        assert.equal(published.version, 1);
    });

    await check('publishForm: invalid schema -> form-invalid with issues', async () => {
        const { formId: bad } = await call('createForm', anna, {
            tenantId: T, title: 'Kaputt',
            draft: { sections: [{ id: 's' }], fields: [{ id: 'f', sectionId: 's', type: 'shortText', label: '' }] }
        });
        const error = await expectError(call('publishForm', anna, { tenantId: T, formId: bad }), 'INVALID_ARGUMENT', 'form-invalid');
        assert.ok(error.details.issues.some((issue) => issue.code === 'missingLabel' && issue.targetId === 'f'));
        await call('deleteForm', anna, { tenantId: T, formId: bad });
    });

    await check('publishForm: writes version, public index and returns token', async () => {
        const result = await call('publishForm', anna, { tenantId: T, formId });
        assert.equal(result.version, 1);
        assert.equal(result.status, 'published');
        assert.ok(result.shareToken.length >= 24);
        token = result.shareToken;
        assert.ok((await db.doc(`tenants/${T}/forms/${formId}/versions/1`).get()).exists);
        const index = (await db.doc(`public_forms/${token}`).get()).data();
        assert.equal(index.tenantId, T);
        assert.equal(index.status, 'published');
        assert.equal(index.schema.fields.length, 4);
        const form = (await db.doc(`tenants/${T}/forms/${formId}`).get()).data();
        assert.equal(form.status, 'published');
        assert.equal(form.publishedVersion, 1);
        assert.equal(form.shareToken, token);
    });

    // --- Public read -------------------------------------------------------------------------------------
    let session;
    await check('getPublicForm: open form with session, legal and resolved theme; unknown token 404', async () => {
        const res = await getForm(token);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'open');
        assert.equal(res.body.form.title, 'Kontakt');
        assert.equal(res.body.form.version, 1);
        assert.equal(res.body.form.schema.fields.length, 4);
        assert.equal(res.body.form.legal.controllerName, 'Muster GmbH');
        assert.equal(res.body.form.uploadsEnabled, false);
        assert.equal(res.body.form.settings.hideBranding, true);
        assert.match(res.body.session, /^[\w-]+\.[\w-]+$/);
        session = res.body.session;
        assert.equal((await getForm('does-not-exist-token-123456')).status, 404);
        assert.equal((await http('getPublicForm', { method: 'POST', body: {} })).status, 405);
    });

    // Draft edits after publishing do not change the public version until republished.
    await check('draft edits stay private until republished (version 2)', async () => {
        await call('saveFormDraft', anna, { tenantId: T, formId, patch: { draft: { ...draftSchema(), fields: [...draftSchema().fields, { id: 'extra', sectionId: 's1', type: 'shortText', label: 'Extra' }] } } });
        assert.equal((await getForm(token)).body.form.schema.fields.length, 4);
        const again = await call('publishForm', anna, { tenantId: T, formId });
        assert.equal(again.version, 2);
        assert.equal(again.shareToken, token);
        assert.equal((await getForm(token)).body.form.schema.fields.length, 5);
        assert.equal((await getForm(token)).body.form.version, 2);
    });

    // --- Submissions -------------------------------------------------------------------------------------
    const valid = { name: 'Max Muster', mail: 'Max@Example.com', topic: { selected: ['a'] } };

    await check('submitPublicForm: session younger than the minimum is rejected', async () => {
        const fresh = (await getForm(token)).body.session;
        const res = await submit(token, fresh, valid);
        assert.equal(res.status, 400);
        assert.equal(res.body.error, 'form-session-invalid');
        assert.equal((await submit(token, 'garbage', valid)).body.error, 'form-session-invalid');
        const tampered = `${fresh.split('.')[0]}.${'A'.repeat(43)}`;
        assert.equal((await submit(token, tampered, valid)).body.error, 'form-session-invalid');
        assert.equal((await responses(T, formId)).length, 0);
    });

    await sleep(MIN_AGE_MS + 300);

    await check('submitPublicForm: valid answers are stored, counted, email extracted', async () => {
        const res = await submit(token, session, valid);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.ok, true);
        const list = await responses(T, formId);
        assert.equal(list.length, 1);
        const response = list[0];
        assert.equal(response.status, 'new');
        assert.equal(response.version, 2);
        assert.equal(response.answers.name, 'Max Muster');
        assert.equal(response.answers.mail, 'max@example.com');
        assert.deepEqual(response.answers.topic, { selected: ['a'] });
        assert.equal(response.respondent.email, 'max@example.com');
        assert.equal(response.respondent.uid, undefined);
        assert.equal(response.meta.source, 'link');
        assert.ok(response.expireAt, 'retention (3 months) sets expireAt');
        assert.ok(JSON.stringify(response).indexOf('127.0.0.1') < 0, 'no IP in response');
        const form = (await db.doc(`tenants/${T}/forms/${formId}`).get()).data();
        assert.equal(form.counts.responses, 1);
        const usage = await db.collection(`tenants/${T}/forms_usage`).get();
        assert.equal(usage.docs[0].get('responses'), 1);
    });

    await check('submitPublicForm: answers of hidden fields are dropped', async () => {
        const res = await submit(token, session, { ...valid, name: 'Hidden Test', bug: 'should never be stored' });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const stored = (await responses(T, formId)).find((r) => r.answers.name === 'Hidden Test');
        assert.ok(stored);
        assert.equal(stored.answers.bug, undefined);
        const shown = await submit(token, session, { name: 'Bug Test', topic: { selected: ['b'] }, bug: 'Es stuerzt ab' });
        assert.equal(shown.status, 200);
        assert.equal((await responses(T, formId)).find((r) => r.answers.name === 'Bug Test').answers.bug, 'Es stuerzt ab');
    });

    await check('submitPublicForm: honeypot answers 200 but stores nothing', async () => {
        const before = (await responses(T, formId)).length;
        const res = await submit(token, session, valid, { website: 'http://spam.example' });
        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);
        assert.equal((await responses(T, formId)).length, before);
    });

    await check('submitPublicForm: invalid answers -> 400 with fieldErrors', async () => {
        const res = await submit(token, session, { mail: 'not-an-email', topic: { selected: ['zzz'] } });
        assert.equal(res.status, 400);
        assert.equal(res.body.error, 'form-invalid-answers');
        const codes = Object.fromEntries(res.body.fieldErrors.map((e) => [e.fieldId, e.code]));
        assert.equal(codes.name, 'required');
        assert.equal(codes.mail, 'invalidEmail');
        assert.equal(codes.topic, 'invalidOption');
        assert.equal((await submit(token, session, 'nope')).status, 400);
    });

    await check('submitPublicForm: rate limit per token+ip (5/min) -> 429', async () => {
        // Four calls (valid, hidden, shown, invalid) plus the non-honeypot ones above are already counted.
        let limited = false;
        for (let i = 0; i < 4 && !limited; i++) {
            const res = await submit(token, session, { ...valid, name: `Flood ${i}` });
            if (res.status === 429) {
                limited = true;
                assert.equal(res.body.error, 'rate-limited');
            }
        }
        assert.ok(limited, 'expected a 429');
    });

    // --- Spam heuristic (own form: own rate-limit budget) ---------------------------------------------------
    await check('spam heuristic: more than 3 links and duplicate content become status spam', async () => {
        const { formId: spamForm } = await call('createForm', anna, { tenantId: T, title: 'Spam', draft: { sections: [{ id: 's' }], fields: [{ id: 'msg', sectionId: 's', type: 'longText', label: 'Nachricht' }] } });
        const { shareToken } = await call('publishForm', anna, { tenantId: T, formId: spamForm });
        const { body } = await getForm(shareToken);
        await sleep(MIN_AGE_MS + 300);
        const links = 'a https://1.de https://2.de https://3.de https://4.de';
        assert.equal((await submit(shareToken, body.session, { msg: links })).status, 200);
        assert.equal((await submit(shareToken, body.session, { msg: 'Hallo Welt' })).status, 200);
        assert.equal((await submit(shareToken, body.session, { msg: 'Hallo Welt' })).status, 200);
        const list = await responses(T, spamForm);
        assert.equal(list.length, 3);
        assert.equal(list.filter((r) => r.status === 'spam').length, 2);
        const form = (await db.doc(`tenants/${T}/forms/${spamForm}`).get()).data();
        assert.equal(form.counts.responses, 1);
        assert.equal(form.counts.spam, 2);
    });

    // --- Status, response cap, closing date --------------------------------------------------------------
    await check('paused -> 409 form-closed and public status paused; reactivated works again', async () => {
        const { formId: f2 } = await call('createForm', anna, { tenantId: T, title: 'Pause', draft: { sections: [{ id: 's' }], fields: [{ id: 'x', sectionId: 's', type: 'shortText', label: 'X' }] } });
        await expectError(call('setFormStatus', anna, { tenantId: T, formId: f2, status: 'published' }), 'FAILED_PRECONDITION', 'form-not-published');
        const { shareToken } = await call('publishForm', anna, { tenantId: T, formId: f2 });
        const { body } = await getForm(shareToken);
        await sleep(MIN_AGE_MS + 300);
        await call('setFormStatus', anna, { tenantId: T, formId: f2, status: 'paused' });
        const res = await submit(shareToken, body.session, { x: 'hi' });
        assert.equal(res.status, 409);
        assert.equal(res.body.error, 'form-closed');
        const view = await getForm(shareToken);
        assert.equal(view.body.status, 'paused');
        assert.equal(view.body.title, 'Pause');
        assert.equal(view.body.legal.controllerName, 'Muster GmbH');
        assert.equal((await db.doc(`public_forms/${shareToken}`).get()).get('status'), 'paused');
        await call('setFormStatus', anna, { tenantId: T, formId: f2, status: 'published' });
        assert.equal((await submit(shareToken, body.session, { x: 'hi' })).status, 200);
        await call('setFormStatus', anna, { tenantId: T, formId: f2, status: 'closed' });
        assert.equal((await getForm(shareToken)).body.status, 'closed');
        assert.equal((await submit(shareToken, body.session, { x: 'hi' })).body.error, 'form-closed');
    });

    await check('maxResponses -> form-limit (409); closesAt in the past -> form-closed', async () => {
        const { formId: f3 } = await call('createForm', anna, { tenantId: T, title: 'Limit', draft: { sections: [{ id: 's' }], fields: [{ id: 'x', sectionId: 's', type: 'shortText', label: 'X' }] } });
        await call('saveFormDraft', anna, { tenantId: T, formId: f3, patch: { settings: { maxResponses: 1 } } });
        const { shareToken } = await call('publishForm', anna, { tenantId: T, formId: f3 });
        const { body } = await getForm(shareToken);
        await sleep(MIN_AGE_MS + 300);
        assert.equal((await submit(shareToken, body.session, { x: 'one' })).status, 200);
        const res = await submit(shareToken, body.session, { x: 'two' });
        assert.equal(res.status, 409);
        assert.equal(res.body.error, 'form-limit');
        assert.equal((await getForm(shareToken)).body.status, 'limit');
        await call('saveFormDraft', anna, { tenantId: T, formId: f3, patch: { settings: { maxResponses: null, closesAt: Date.now() - 1000 } } });
        const closed = await submit(shareToken, body.session, { x: 'three' });
        assert.equal(closed.body.error, 'form-closed');
    });

    // --- Link management, duplicate, delete -------------------------------------------------------------
    await check('regenerateFormLink moves the public index; duplicateForm copies as draft; deleteForm cleans up', async () => {
        const { shareToken } = await call('regenerateFormLink', anna, { tenantId: T, formId });
        assert.notEqual(shareToken, token);
        assert.equal((await getForm(token)).status, 404);
        assert.equal((await getForm(shareToken)).body.status, 'open');
        assert.equal((await db.doc(`public_forms/${token}`).get()).exists, false);
        await expectError(call('regenerateFormLink', bob, { tenantId: T, formId: 'nope' }), 'NOT_FOUND', 'form-not-found');
        token = shareToken;

        const copy = await call('duplicateForm', bob, { tenantId: T, formId });
        const dupe = (await db.doc(`tenants/${T}/forms/${copy.formId}`).get()).data();
        assert.equal(dupe.title, 'Kontakt (Copy)');
        assert.equal(dupe.status, 'draft');
        assert.equal(dupe.ownerId, bob.uid);
        assert.equal(dupe.shareToken, null);
        assert.deepEqual(dupe.counts, { responses: 0, spam: 0, lastResponseAt: null });
        assert.deepEqual(dupe.editorIds, []);
        assert.equal((await responses(T, copy.formId)).length, 0);

        await expectError(call('deleteForm', bob, { tenantId: T, formId }), 'PERMISSION_DENIED'); // editors cannot delete
        await call('deleteForm', anna, { tenantId: T, formId });
        assert.equal((await db.doc(`tenants/${T}/forms/${formId}`).get()).exists, false);
        assert.equal((await responses(T, formId)).length, 0);
        assert.equal((await db.doc(`tenants/${T}/forms/${formId}/versions/1`).get()).exists, false);
        assert.equal((await getForm(token)).status, 404);
        await call('deleteForm', owner, { tenantId: T, formId: copy.formId }); // admin/owner may delete any form
    });

    // --- Plan gates --------------------------------------------------------------------------------------
    await check('free plan: workspace audience, uploads, logic and the 3 active forms are gated; theme reduced to preset', async () => {
        await expectError(call('createForm', anna, { tenantId: T3, title: 'W', audience: 'workspace' }), 'FAILED_PRECONDITION', 'plan-form-feature');
        const { formId: f } = await call('createForm', anna, { tenantId: T3, title: 'Free' });
        await call('saveFormDraft', anna, { tenantId: T3, formId: f, patch: { theme: { preset: 'ocean', accent: '#ff0000', font: 'inter' }, settings: { hideBranding: true } } });
        const doc = (await db.doc(`tenants/${T3}/forms/${f}`).get()).data();
        assert.deepEqual(doc.theme, { preset: 'ocean' });
        assert.equal(doc.settings.hideBranding, false);
        await expectError(call('createFormAssetUpload', anna, { tenantId: T3, formId: f, kind: 'logo', contentType: 'image/png', size: 1000 }), 'FAILED_PRECONDITION', 'plan-form-feature');
        const upload = { id: 'file', sectionId: 's', type: 'fileUpload', label: 'Datei' };
        await call('saveFormDraft', anna, { tenantId: T3, formId: f, patch: { draft: { sections: [{ id: 's' }], fields: [upload] } } });
        const err = await expectError(call('publishForm', anna, { tenantId: T3, formId: f }), 'FAILED_PRECONDITION', 'plan-form-feature');
        assert.equal(err.details.feature, 'uploads');
        const logic = { id: 'b', sectionId: 's', type: 'shortText', label: 'B', showIf: { mode: 'all', rules: [{ fieldId: 'a', op: 'answered' }] } };
        await call('saveFormDraft', anna, { tenantId: T3, formId: f, patch: { draft: { sections: [{ id: 's' }], fields: [{ id: 'a', sectionId: 's', type: 'shortText', label: 'A' }, logic] } } });
        assert.equal((await expectError(call('publishForm', anna, { tenantId: T3, formId: f }), 'FAILED_PRECONDITION', 'plan-form-feature')).details.feature, 'logic');
        await call('saveFormDraft', anna, { tenantId: T3, formId: f, patch: { draft: { sections: [{ id: 's' }], fields: [{ id: 'a', sectionId: 's', type: 'shortText', label: 'A' }] } } });
        await call('publishForm', anna, { tenantId: T3, formId: f });
        for (let i = 0; i < 2; i++) {
            const { formId: more } = await call('createForm', anna, { tenantId: T3, title: `F${i}` });
            await call('publishForm', anna, { tenantId: T3, formId: more });
        }
        const { formId: fourth } = await call('createForm', anna, { tenantId: T3, title: 'Vierte' });
        await expectError(call('publishForm', anna, { tenantId: T3, formId: fourth }), 'RESOURCE_EXHAUSTED', 'plan-form-limit');
        // Re-publishing an active form does not count against the limit.
        assert.equal((await call('publishForm', anna, { tenantId: T3, formId: f })).version, 2);
    });

    // --- Workspace audience and member fill ----------------------------------------------------------------
    await check('workspace forms: public endpoint redirects to the app; members fill via getFormForMember/submitFormAsMember', async () => {
        const { formId: wf } = await call('createForm', anna, {
            tenantId: T, title: 'Intern', audience: 'workspace',
            draft: { sections: [{ id: 's' }], fields: [{ id: 'x', sectionId: 's', type: 'shortText', label: 'X', required: true }] }
        });
        await call('saveFormDraft', anna, { tenantId: T, formId: wf, patch: { settings: { onePerMember: true } } });
        const { shareToken } = await call('publishForm', anna, { tenantId: T, formId: wf });
        const view = await getForm(shareToken);
        assert.equal(view.status, 200);
        assert.equal(view.body.status, 'workspace');
        assert.equal(view.body.tenantId, T);
        assert.equal(view.body.formId, wf);
        assert.equal(view.body.session, undefined);
        assert.equal((await submit(shareToken, 'x.y', { x: 'a' })).status, 404);

        await expectError(call('getFormForMember', guest, { tenantId: T, formId: wf }), 'PERMISSION_DENIED');
        await expectError(call('getFormForMember', outsider, { tenantId: T, formId: wf }), 'PERMISSION_DENIED');
        const got = await call('getFormForMember', bob, { tenantId: T, formId: wf });
        assert.equal(got.form.title, 'Intern');
        const byToken = await call('getFormForMember', bob, { token: shareToken });
        assert.equal(byToken.formId, wf);
        await sleep(MIN_AGE_MS + 300);
        await expectError(call('submitFormAsMember', bob, { tenantId: T, formId: wf, session: 'bad', answers: { x: 'a' }, durationMs: 100, source: 'app' }), 'INVALID_ARGUMENT', 'form-session-invalid');
        await expectError(call('submitFormAsMember', bob, { tenantId: T, formId: wf, session: got.session, answers: {}, durationMs: 100, source: 'app' }), 'INVALID_ARGUMENT', 'form-invalid-answers');
        const done = await call('submitFormAsMember', bob, { tenantId: T, formId: wf, session: got.session, answers: { x: 'hallo' }, durationMs: 4000, source: 'ios' });
        assert.ok(done.responseId);
        const list = await responses(T, wf);
        assert.equal(list.length, 1);
        assert.equal(list[0].respondent.uid, bob.uid);
        assert.equal(list[0].meta.source, 'ios');
        await expectError(call('submitFormAsMember', bob, { tenantId: T, formId: wf, session: got.session, answers: { x: 'nochmal' }, durationMs: 4000, source: 'app' }), 'ALREADY_EXISTS', 'form-already-answered');

        // Anonymous forms keep no uid.
        await call('saveFormDraft', anna, { tenantId: T, formId: wf, patch: { anonymous: true, settings: { onePerMember: false } } });
        const anon = await call('getFormForMember', anna, { tenantId: T, formId: wf });
        await sleep(MIN_AGE_MS + 300);
        await call('submitFormAsMember', anna, { tenantId: T, formId: wf, session: anon.session, answers: { x: 'anonym' }, durationMs: 4000, source: 'app' });
        assert.equal((await responses(T, wf)).find((r) => r.answers.x === 'anonym').respondent.uid, undefined);

        // Guests only when the form allows it.
        await call('saveFormDraft', anna, { tenantId: T, formId: wf, patch: { allowGuests: true } });
        assert.ok((await call('getFormForMember', guest, { tenantId: T, formId: wf })).session);
    });

    // --- Uploads -------------------------------------------------------------------------------------------
    await check('assets: createFormAssetUpload validates, uploads to the storage emulator and the public URL serves it', async () => {
        const { formId: af } = await call('createForm', anna, { tenantId: T, title: 'Assets' });
        await expectError(call('createFormAssetUpload', anna, { tenantId: T, formId: af, kind: 'logo', contentType: 'image/svg+xml', size: 10 }), 'INVALID_ARGUMENT', 'form-upload-invalid');
        await expectError(call('createFormAssetUpload', anna, { tenantId: T, formId: af, kind: 'logo', contentType: 'image/png', size: 6 * 1024 * 1024 }), 'INVALID_ARGUMENT', 'plan-file-too-large');
        await expectError(call('createFormAssetUpload', bob, { tenantId: T, formId: af, kind: 'logo', contentType: 'image/png', size: 100 }), 'PERMISSION_DENIED');
        const target = await call('createFormAssetUpload', anna, { tenantId: T, formId: af, kind: 'logo', contentType: 'image/png', size: 8 });
        assert.match(target.path, new RegExp(`^public/forms/${T}/${af}/assets/logo-[A-Za-z0-9]+\\.png$`));
        const put = await fetch(target.uploadUrl, { method: target.method, headers: target.headers, body: Buffer.from('PNGDATA!') });
        assert.ok(put.ok, `asset upload failed: ${put.status}`);
        const read = await fetch(target.publicUrl);
        assert.equal(read.status, 200);
        assert.equal(await read.text(), 'PNGDATA!');
        await call('saveFormDraft', anna, { tenantId: T, formId: af, patch: { theme: { preset: 'paper', logoPath: target.path, coverPath: 'public/forms/other/x/assets/c.png' } } });
        const theme = (await db.doc(`tenants/${T}/forms/${af}`).get()).get('theme');
        assert.equal(theme.logoPath, target.path);
        assert.equal(theme.coverPath, undefined);
        await call('deleteForm', anna, { tenantId: T, formId: af });
    });

    await check('file upload field: pending upload -> object -> submit stores a files record; foreign sessions are rejected', async () => {
        const { formId: uf } = await call('createForm', anna, {
            tenantId: T, title: 'Upload',
            draft: { sections: [{ id: 's' }], fields: [{ id: 'doc', sectionId: 's', type: 'fileUpload', label: 'Datei', required: true, maxFiles: 2, fileKinds: ['pdf', 'image'] }] }
        });
        const { shareToken } = await call('publishForm', anna, { tenantId: T, formId: uf });
        const open = await getForm(shareToken);
        assert.equal(open.body.form.uploadsEnabled, true);
        const other = await getForm(shareToken);
        const request = (session, extra = {}) => http('createPublicFormUpload', { body: { token: shareToken, session, fieldId: 'doc', name: 'Lebenslauf.pdf', size: 12, contentType: 'application/pdf', ...extra } });

        assert.equal((await request('bad.session')).body.error, 'form-session-invalid');
        assert.equal((await request(open.body.session, { fieldId: 'nope' })).body.error, 'form-upload-invalid');
        assert.equal((await request(open.body.session, { name: 'run.exe', contentType: 'application/x-msdownload' })).body.error, 'form-upload-invalid');
        assert.equal((await request(open.body.session, { name: 'a.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).body.error, 'form-upload-invalid');

        const created = await request(open.body.session);
        assert.equal(created.status, 200, JSON.stringify(created.body));
        const { fileId, uploadUrl, headers, method } = created.body;
        const pending = (await db.doc(`tenants/${T}/form_uploads/${fileId}`).get()).data();
        assert.equal(pending.status, 'pending');
        assert.equal(pending.fieldId, 'doc');
        assert.ok(pending.expireAt);
        await sleep(MIN_AGE_MS + 300);

        // Object not uploaded yet -> rejected.
        const answers = (id) => ({ doc: [{ fileId: id, name: 'fake.pdf', size: 1, contentType: 'application/pdf' }] });
        const early = await submit(shareToken, open.body.session, answers(fileId));
        assert.equal(early.status, 400);
        assert.equal(early.body.error, 'form-upload-invalid');

        const put = await fetch(uploadUrl, { method, headers, body: Buffer.from('%PDF-1.4 abc') });
        assert.ok(put.ok, `upload failed: ${put.status}`);
        // Another session cannot claim the upload.
        const stolen = await submit(shareToken, other.body.session, answers(fileId));
        assert.equal(stolen.body.error, 'form-upload-invalid');
        assert.equal((await submit(shareToken, open.body.session, answers('unknown-id'))).body.error, 'form-upload-invalid');

        const ok = await submit(shareToken, open.body.session, answers(fileId));
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        const [response] = await responses(T, uf);
        assert.equal(response.answers.doc.length, 1);
        assert.equal(response.answers.doc[0].fileId, fileId);
        assert.equal(response.answers.doc[0].name, 'Lebenslauf.pdf'); // from the pending record, not the client
        assert.equal(response.answers.doc[0].size, 12);
        const record = (await db.doc(`tenants/${T}/files/${fileId}`).get()).data();
        assert.equal(record.module, 'forms');
        assert.equal(record.listed, false);
        assert.equal(record.formId, uf);
        assert.equal(record.entityId, response.id);
        assert.equal((await db.doc(`tenants/${T}/form_uploads/${fileId}`).get()).exists, false);

        // Deleting the form removes the file record and the object.
        await call('deleteForm', anna, { tenantId: T, formId: uf });
        assert.equal((await db.doc(`tenants/${T}/files/${fileId}`).get()).exists, false);
    });

    // --- Server-only data ----------------------------------------------------------------------------------
    await check('server secret exists and stays server-only', async () => {
        const secret = await db.doc('platform_secrets/forms').get();
        assert.ok(secret.exists);
        assert.equal(String(secret.get('secret')).length, 64);
    });

    const failed = results.filter((r) => !r.ok);
    results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok ? '' : ` — ${r.error}`}`));
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    process.exit(failed.length ? 1 : 0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
