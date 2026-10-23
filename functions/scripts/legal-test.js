/* Emulator test for legal documents: publish (idempotent), accept-current-only, mail job dedupe.
 * Run: npm run build && npm run test:legal  (Firestore emulator on port 8821) */
const assert = require('assert');
process.env.GCLOUD_PROJECT = 'demo-projectflow';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8821';
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-projectflow' });
const db = admin.firestore();
const { publishLegalDraftCore, acceptLegalDocumentsCore, runLegalMailJob } = require('../lib/legal');
const { checkMachineLegalConsent } = require('../lib/legal-machine-access');
const { checkApiTokenUsable } = require('../lib/authUtils');

const draft = (changeType, extra = {}) => ({
    type: 'terms', title: { de: 'AGB', en: 'Terms' }, content: { de: '# AGB', en: '# Terms' },
    summary: { de: 'Neu', en: 'New' }, changeType, notifyByEmail: changeType === 'requiresAcceptance', effectiveAt: null, ...extra,
});
const putDraft = (data) => db.doc('legal_documents/terms/drafts/current').set(data);
const expectCode = async (promise, code) => {
    await assert.rejects(promise, (error) => { assert.equal(error.code, code); return true; });
};

(async () => {
    const NOW = Date.now();
    for (const [uid, email, language] of [['u1', 'one@test.de', 'de'], ['u2', 'two@test.de', 'en'], ['u3', null, 'en']]) {
        await db.doc(`users/${uid}`).set({ uid, ...(email ? { email } : {}), language });
    }

    // v1 publish; retry with the same baseVersion is a no-op.
    await putDraft(draft('requiresAcceptance'));
    const first = await publishLegalDraftCore(db, 'terms', 'admin', null, NOW);
    assert.deepEqual(first, { version: 1, alreadyPublished: false });
    assert.deepEqual(await publishLegalDraftCore(db, 'terms', 'admin', null, NOW), { version: 1, alreadyPublished: true });
    const index = (await db.doc('legal_documents/terms').get()).data();
    assert.equal(index.currentVersion, 1);
    assert.equal(index.versions.length, 1);
    assert.equal((await db.doc('legal_documents/terms/versions/1').get()).data().content.en, '# Terms');

    // Stale base version is rejected.
    await putDraft(draft('notifyOnly'));
    await expectCode(publishLegalDraftCore(db, 'terms', 'admin', null, NOW), 'aborted');
    await db.doc('legal_documents/terms/drafts/current').delete();

    // Accept: only the current effective version.
    await expectCode(acceptLegalDocumentsCore(db, 'u1', { platform: 'web', appVersion: '1', items: [{ type: 'terms', version: 2 }] }, NOW), 'failed-precondition');
    const accepted = await acceptLegalDocumentsCore(db, 'u1', { platform: 'desktop', appVersion: '0.4.0', items: [{ type: 'terms', version: 1 }] }, NOW);
    assert.equal(accepted.accepted.terms, 1);
    const record = (await db.doc('legal_acceptances/u1').get()).data();
    assert.equal(record.docs.terms.platform, 'desktop');
    assert.equal(record.docs.terms.decision, 'accepted');
    assert.equal((await db.collection('legal_acceptances/u1/events').get()).size, 1);

    // Mail job: u1 already accepted v1, u3 has no address → only u2 is mailed; a rerun sends nothing.
    const sent = [];
    const send = async (to, subject) => { sent.push({ to, subject }); };
    const run1 = await runLegalMailJob(db, 'terms_v1', { send, nowMs: NOW, delayMs: 0, batchSize: 2 });
    assert.equal(run1.done, true);
    assert.deepEqual(sent, [{ to: 'two@test.de', subject: 'Update: Terms of Service' }]);
    const job = (await db.doc('legal_mail_jobs/terms_v1').get()).data();
    assert.equal(job.status, 'done');
    assert.equal(job.open, false);
    assert.equal(job.counts.sent, 1);
    assert.equal((await db.doc('legal_mail_jobs/terms_v1/recipients/u2').get()).data().status, 'sent');
    await db.doc('legal_mail_jobs/terms_v1').update({ open: true, cursor: null }); // simulate a retry from scratch
    await runLegalMailJob(db, 'terms_v1', { send, nowMs: NOW, delayMs: 0 });
    assert.equal(sent.length, 1, 'no double send on retry');

    // Future effectiveAt: job waits; accept of the not-yet-effective version is rejected.
    await putDraft({ ...draft('requiresAcceptance'), effectiveAt: admin.firestore.Timestamp.fromMillis(NOW + 86400000) });
    assert.equal((await publishLegalDraftCore(db, 'terms', 'admin', 1, NOW)).version, 2);
    const early = await runLegalMailJob(db, 'terms_v2', { send, nowMs: NOW, delayMs: 0 });
    assert.equal(early.skippedRun, true);
    await expectCode(acceptLegalDocumentsCore(db, 'u1', { platform: 'web', appVersion: '1', items: [{ type: 'terms', version: 2 }] }, NOW), 'failed-precondition');
    const due = await runLegalMailJob(db, 'terms_v2', { send, nowMs: NOW + 2 * 86400000, delayMs: 0 });
    assert.equal(due.done, true);
    assert.deepEqual(sent.slice(1).map((m) => m.subject).sort(), ['Aktualisierung: Nutzungsbedingungen', 'Update: Terms of Service']);

    // notifyOnly without mail creates no job.
    await putDraft(draft('notifyOnly', { notifyByEmail: false }));
    assert.equal((await publishLegalDraftCore(db, 'terms', 'admin', 2, NOW + 3 * 86400000)).version, 3);
    assert.equal((await db.doc('legal_mail_jobs/terms_v3').get()).exists, false);

    // Machine access: u2 never accepted terms; blocked only after the 14-day grace period.
    const DAY = 86400000;
    assert.equal((await checkMachineLegalConsent('u2', NOW + 5 * DAY)).ok, true);
    const blocked = await checkMachineLegalConsent('u2', NOW + 20 * DAY);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.status, 403);
    assert.match(blocked.error, /app\.getprojectflow\.com/);
    const usable = await checkApiTokenUsable({ createdBy: 'u2' }, 't1', {
        getMemberRole: async () => 'Member', now: () => new Date(NOW), checkConsent: (uid) => checkMachineLegalConsent(uid, NOW + 20 * DAY),
    });
    assert.deepEqual([usable.ok, usable.status], [false, 403]);

    console.log('legal-test: all assertions passed');
    process.exit(0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
