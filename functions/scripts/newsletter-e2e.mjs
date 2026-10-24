#!/usr/bin/env node
// E2E for the platform waitlist + newsletter against the emulators of scripts/dev-admin.sh:
//   AUTH_PORT=9861 FIRESTORE_PORT=8861 STORAGE_PORT=9862 FUNCTIONS_PORT=5861 ADMIN_DEV_SERVER=0 bash scripts/dev-admin.sh
//   AUTH_HOST=127.0.0.1:9861 FIRESTORE_HOST=127.0.0.1:8861 FUNCTIONS_URL=http://127.0.0.1:5861/demo-projectflow/europe-west3 \
//     node functions/scripts/newsletter-e2e.mjs
// Flow: waitlist signup → opt-in mail (dev_outbox) → confirm → newsletter add-on → newsletter signup → app toggle →
// campaign (test send, send now) → one-click unsubscribe → GDPR delete. Mails land in dev_outbox (no transport in the emulator).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const AUTH = process.env.AUTH_HOST || '127.0.0.1:9861';
const FIRESTORE = process.env.FIRESTORE_HOST || '127.0.0.1:8861';
const FUNCTIONS = process.env.FUNCTIONS_URL || 'http://127.0.0.1:5861/demo-projectflow/europe-west3';
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE;
admin.initializeApp({ projectId: 'demo-projectflow' });
const db = admin.firestore();

const results = [];
const check = async (label, fn) => {
    try { await fn(); results.push({ label, ok: true }); } catch (error) { results.push({ label, ok: false, error: error.message }); }
};

const post = async (fn, body, headers = {}) => {
    const res = await fetch(`${FUNCTIONS}/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => ({})) };
};
const signIn = async (email, password) => {
    const res = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const body = await res.json();
    if (!body.idToken) throw new Error(`sign-in failed for ${email}`);
    return body.idToken;
};
const callable = async (name, idToken, data) => {
    const res = await fetch(`${FUNCTIONS}/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` }, body: JSON.stringify({ data }) });
    const body = await res.json();
    if (body.error) throw new Error(`${name}: ${body.error.message} ${JSON.stringify(body.error.details || '')}`);
    return body.result;
};
let adminToken; let sessionId;
const adminCall = (action, params = {}) => callable('adminApi', adminToken, { action, params, sessionId });

const outbox = async (to, since) => {
    const snap = await db.collection('dev_outbox').where('to', '==', to).get();
    return snap.docs.map((d) => d.data()).filter((m) => m.createdAt.toMillis() >= since).sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
};
const tokenFrom = (mail) => {
    const m = mail.html.match(/[?&]t=([A-Za-z0-9_%-]+)/);
    assert.ok(m, 'confirm link in mail');
    return decodeURIComponent(m[1]);
};
const subscriber = async (email) => {
    const snap = await db.collection('platform_subscribers').where('email', '==', email).get();
    return snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null;
};

const stamp = Date.now();
const W = `wait-${stamp}@projectflow.test`;
const N = `news-${stamp}@projectflow.test`;
const BOT = `bot-${stamp}@projectflow.test`;
const t0 = Date.now() - 1000;
const human = { startedAt: Date.now() - 10_000, website: '' };

await check('waitlist signup creates a pending entry and sends the opt-in mail', async () => {
    const r = await post('requestWaitlist', { email: W.toUpperCase(), name: 'Wanda Wait', interest: 'Agentur', lang: 'de', ...human }, { 'x-forwarded-for': '203.0.113.7' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const sub = await subscriber(W);
    assert.equal(sub?.lists?.waitlist?.status, 'pending');
    assert.equal(sub.lang, 'de');
    const log = await db.collection('platform_subscribers').doc(sub.id).collection('consent_log').get();
    const entry = log.docs[0].data();
    assert.equal(entry.action, 'requested');
    assert.equal(entry.ip, '203.0.113.7');
    assert.ok(entry.consentText && entry.consentVersion.startsWith('waitlist-'));
    const mails = await outbox(W, t0);
    assert.equal(mails.length, 1);
    assert.equal(mails[0].type, 'waitlist');
    assert.match(mails[0].html, /\/bestaetigen\?t=/);
});

await check('honeypot and too-fast submits are accepted silently but not stored', async () => {
    const a = await post('requestWaitlist', { email: BOT, lang: 'en', website: 'spam', startedAt: Date.now() - 10_000 });
    const b = await post('requestNewsletterSignup', { email: BOT, lang: 'en', startedAt: Date.now() });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(await subscriber(BOT), null);
    assert.equal((await outbox(BOT, t0)).length, 0);
});

await check('invalid email is rejected', async () => {
    const r = await post('requestWaitlist', { email: 'nope', ...human });
    assert.equal(r.status, 400);
});

let newsletterToken;
await check('confirm link confirms the waitlist and offers the newsletter separately', async () => {
    const [mail] = await outbox(W, t0);
    const r = await post('confirmOptin', { action: 'confirm', token: tokenFrom(mail) });
    assert.equal(r.body.result, 'confirmed', JSON.stringify(r.body));
    assert.equal(r.body.list, 'waitlist');
    assert.ok(r.body.newsletterToken);
    newsletterToken = r.body.newsletterToken;
    const sub = await subscriber(W);
    assert.equal(sub.lists.waitlist.status, 'confirmed');
    assert.equal(sub.lists.newsletter, undefined);
    const again = await post('confirmOptin', { action: 'confirm', token: tokenFrom(mail) });
    assert.equal(again.body.result, 'already');
});

await check('invalid confirm token is refused', async () => {
    const r = await post('confirmOptin', { action: 'confirm', token: 'not-a-token' });
    assert.equal(r.status, 400);
    assert.equal(r.body.result, 'invalid');
});

await check('newsletter add-on after waitlist confirmation is its own logged consent', async () => {
    const r = await post('confirmOptin', { action: 'addNewsletter', token: newsletterToken, lang: 'de' });
    assert.equal(r.body.result, 'confirmed', JSON.stringify(r.body));
    const sub = await subscriber(W);
    assert.equal(sub.lists.newsletter.status, 'confirmed');
    const log = await db.collection('platform_subscribers').doc(sub.id).collection('consent_log').where('list', '==', 'newsletter').get();
    assert.equal(log.docs[0].get('via'), 'waitlist-confirm');
    const reuse = await post('confirmOptin', { action: 'addNewsletter', token: newsletterToken, lang: 'de' });
    assert.equal(reuse.body.result, 'invalid');
});

await check('newsletter signup needs the confirm click (double opt-in)', async () => {
    const r = await post('requestNewsletterSignup', { email: N, name: 'Nora News', lang: 'en', ...human });
    assert.equal(r.status, 200);
    assert.equal((await subscriber(N)).lists.newsletter.status, 'pending');
    const [mail] = await outbox(N, t0);
    assert.equal(mail.type, 'newsletter-optin');
    assert.match(mail.html, /\/en\/confirm\?t=/);
    const c = await post('confirmOptin', { action: 'confirm', token: tokenFrom(mail) });
    assert.equal(c.body.result, 'confirmed');
    assert.equal(c.body.newsletterToken, undefined);
    assert.equal((await subscriber(N)).lists.newsletter.status, 'confirmed');
});

await check('signup rate limit per address (3/h)', async () => {
    const email = `rate-${stamp}@projectflow.test`;
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await post('requestNewsletterSignup', { email, lang: 'en', ...human })).status);
    assert.deepEqual(codes, [200, 200, 200, 429]);
});

await check('app toggle: subscribe sends opt-in, unsubscribe withdraws', async () => {
    const userToken = await signIn('outsider@projectflow.test', 'pf-outsider-e2e');
    const before = await callable('platformNewsletterPreference', userToken, { action: 'get' });
    assert.ok(['none', 'unsubscribed', 'pending'].includes(before.status));
    const sub = await callable('platformNewsletterPreference', userToken, { action: 'subscribe', lang: 'de' });
    assert.equal(sub.status, 'pending');
    const doc = await subscriber('outsider@projectflow.test');
    assert.equal(doc.source === 'app' || doc.lists.newsletter.source === 'app', true);
    assert.ok(doc.uid);
    const [mail] = (await outbox('outsider@projectflow.test', t0)).slice(-1);
    assert.equal(mail.type, 'newsletter-optin');
    const off = await callable('platformNewsletterPreference', userToken, { action: 'unsubscribe' });
    assert.equal(off.status, 'unsubscribed');
});

adminToken = await signIn('demo@projectflow.test', 'projectflow-demo');
sessionId = (await callable('adminApi', adminToken, { action: 'session.start', params: {} })).sessionId;

await check('normal users cannot call newsletter admin actions', async () => {
    const userToken = await signIn('outsider@projectflow.test', 'pf-outsider-e2e');
    await assert.rejects(callable('adminApi', userToken, { action: 'newsletter.overview', params: {}, sessionId: 'x' }));
});

await check('admin overview counts lists', async () => {
    const o = await adminCall('newsletter.overview');
    assert.ok(o.counts.newsletter.confirmed >= 2, JSON.stringify(o.counts));
    assert.ok(o.counts.waitlist.confirmed >= 1);
    const list = await adminCall('newsletter.subscribers.list', { list: 'newsletter', status: 'confirmed', query: `-${stamp}@` });
    assert.equal(list.items.length, 2);
    const detail = await adminCall('newsletter.subscribers.get', { id: list.items[0].id });
    assert.ok(detail.consentLog.length >= 2);
});

let campaignId;
await check('campaign draft, preview, test send', async () => {
    const saved = await adminCall('newsletter.campaigns.save', {
        title: `E2E ${stamp}`,
        defaultLang: 'de',
        variants: {
            de: { subject: 'Hallo {{name|du}}', preheader: 'Neu in ProjectFlow', markdown: '# Neuigkeiten\n\nHallo {{name|du}}, **das** ist neu.\n\n[[Ansehen]](https://app.getprojectflow.com/)' },
            en: { subject: 'Hello {{name|there}}', preheader: 'New in ProjectFlow', markdown: '# News\n\nHi {{name|there}}.' },
        },
        audience: { list: 'newsletter' },
    });
    campaignId = saved.id;
    const preview = await adminCall('newsletter.campaigns.preview', { id: campaignId, lang: 'de' });
    assert.match(preview.html, /<h1[^>]*>Neuigkeiten<\/h1>/);
    const count = await adminCall('newsletter.audience.count', { audience: { list: 'newsletter' } });
    assert.ok(count.total >= 2);
    const test = await adminCall('newsletter.campaigns.test', { id: campaignId, emails: [`tester-${stamp}@projectflow.test`] });
    assert.equal(test.results.length, 2);
    const mails = await outbox(`tester-${stamp}@projectflow.test`, t0);
    assert.ok(mails.every((m) => m.subject.startsWith('[Test] ')));
});

await check('send now delivers to the confirmed audience only, with List-Unsubscribe', async () => {
    // Keep the run to this campaign's subscribers: the emulator may contain more confirmed addresses from earlier runs.
    const r = await adminCall('newsletter.campaigns.schedule', { id: campaignId });
    assert.equal(r.status, 'sent', JSON.stringify(r));
    const c = (await adminCall('newsletter.campaigns.get', { id: campaignId })).campaign;
    assert.equal(c.stats.sent, c.stats.recipients);
    const [wMail] = (await outbox(W, t0)).filter((m) => m.type === 'newsletter');
    const [nMail] = (await outbox(N, t0)).filter((m) => m.type === 'newsletter');
    assert.equal(wMail.subject, 'Hallo Wanda Wait');
    assert.equal(nMail.subject, 'Hello Nora News');
    assert.equal(wMail.tags.campaign, campaignId);
    const header = wMail.headers.find((h) => h.Name === 'List-Unsubscribe');
    assert.ok(header && wMail.headers.some((h) => h.Name === 'List-Unsubscribe-Post'));
    assert.equal((await outbox('outsider@projectflow.test', t0)).filter((m) => m.type === 'newsletter').length, 0, 'unsubscribed app user gets nothing');
    await assert.rejects(adminCall('newsletter.campaigns.save', { id: campaignId, variants: { de: { subject: 'x', markdown: 'y' } } }));
});

await check('one-click unsubscribe from the campaign mail', async () => {
    const [wMail] = (await outbox(W, t0)).filter((m) => m.type === 'newsletter');
    const url = wMail.headers.find((h) => h.Name === 'List-Unsubscribe').Value.match(/<([^>]+)>/)[1]
        .replace(/^https:\/\/europe-west3-demo-projectflow\.cloudfunctions\.net/, FUNCTIONS);
    const get = await fetch(url);
    assert.equal(get.status, 200);
    assert.equal((await subscriber(W)).lists.newsletter.status, 'confirmed', 'GET must not unsubscribe');
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
    assert.equal(res.status, 200);
    const sub = await subscriber(W);
    assert.equal(sub.lists.newsletter.status, 'unsubscribed');
    assert.equal(sub.lists.waitlist.status, 'confirmed', 'other list untouched');
    const c = (await adminCall('newsletter.campaigns.get', { id: campaignId })).campaign;
    assert.equal(c.stats.unsubscribed, 1);
});

await check('GDPR delete removes subscriber and consent log', async () => {
    const sub = await subscriber(N);
    await adminCall('newsletter.subscribers.delete', { id: sub.id });
    assert.equal(await subscriber(N), null);
    const log = await db.collection('platform_subscribers').doc(sub.id).collection('consent_log').get();
    assert.equal(log.size, 0);
});

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.label}${r.ok ? '' : ` — ${r.error}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
