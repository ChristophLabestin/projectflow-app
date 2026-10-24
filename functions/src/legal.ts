import * as functions from 'firebase-functions/v1';
import { FAST_START } from './runtime-options';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldPath, FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';

import { db } from './init';
import { EMAIL_SECRETS, getSystemEmailTemplate, sendEmail } from './email';
import { FUNCTIONS_SERVICE_ACCOUNT } from './email-logic';
import {
    ACCEPTANCE_TYPES,
    AcceptedDocs,
    LEGAL_PLATFORMS,
    LEGAL_TYPES,
    LegalChangeType,
    LegalType,
    VersionMeta,
    buildLegalMail,
    currentEffective,
    evaluateGate,
    isLegalType,
    normalizeDraft,
    requiresAcceptanceTracking,
    resolveLang,
    shouldMailUser,
} from './legal-logic';

/**
 * Versioned legal documents (privacy, terms, imprint) with re-consent.
 * Data model + client contract: brain/plans/legal-consent-contract.md.
 *
 *   legal_documents/{type}                 public index: currentVersion + compact `versions` metadata
 *   legal_documents/{type}/versions/{n}    published, immutable content (public read)
 *   legal_documents/{type}/drafts/current  admin-only draft
 *   legal_acceptances/{uid}                per-user accepted versions (+ events/ audit trail)
 *   legal_mail_jobs/{type}_v{n}            batched, resumable mail job (+ recipients/ send log)
 */

const REGION = 'europe-west3';

const docRef = (firestore: Firestore, type: LegalType) => firestore.collection('legal_documents').doc(type);
const draftRef = (firestore: Firestore, type: LegalType) => docRef(firestore, type).collection('drafts').doc('current');


const toMs = (value: any): number => (value instanceof Timestamp ? value.toMillis() : typeof value?.toMillis === 'function' ? value.toMillis() : Number(value) || 0);

export const versionMetaFromDoc = (raw: any): VersionMeta => ({
    version: Number(raw?.version) || 0,
    changeType: raw?.changeType === 'requiresAcceptance' ? 'requiresAcceptance' : 'notifyOnly',
    effectiveAtMs: toMs(raw?.effectiveAt),
    publishedAtMs: toMs(raw?.publishedAt),
    summary: { de: raw?.summary?.de || '', en: raw?.summary?.en || '' },
    ...(Number.isInteger(raw?.machineGraceDays) ? { machineGraceDays: raw.machineGraceDays } : {}),
});

export const loadIndex = async (firestore: Firestore) => {
    const snaps = await firestore.getAll(...LEGAL_TYPES.map((type) => docRef(firestore, type)));
    return snaps.map((snap, index) => ({
        type: LEGAL_TYPES[index],
        versions: ((snap.data()?.versions as any[]) || []).map(versionMetaFromDoc),
    }));
};

// ---------------------------------------------------------------------------
// Admin: drafts + publish (used by adminApi in the admin console, functions/src/admin-console/modules/legal.ts)
// ---------------------------------------------------------------------------

/** Saves drafts/current (admin console, adminApi action legal.saveDraft). */
export const saveLegalDraftCore = async (firestore: Firestore, data: unknown, uid: string) => {
    let draft;
    try {
        draft = normalizeDraft(data);
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', (error as Error).message);
    }
    const index = await docRef(firestore, draft.type).get();
    await draftRef(firestore, draft.type).set({
        type: draft.type,
        title: draft.title,
        content: draft.content,
        summary: draft.summary,
        changeType: draft.changeType,
        effectiveAt: draft.effectiveAtMs == null ? null : Timestamp.fromMillis(draft.effectiveAtMs),
        notifyByEmail: draft.notifyByEmail,
        machineGraceDays: draft.machineGraceDays,
        baseVersion: index.data()?.currentVersion ?? null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
    });
    return { ok: true, type: draft.type };
};

export const deleteLegalDraftCore = async (firestore: Firestore, type: unknown) => {
    if (!isLegalType(type)) throw new functions.https.HttpsError('invalid-argument', 'type is invalid');
    await draftRef(firestore, type).delete();
    return { ok: true };
};



/**
 * Publishes drafts/current as the next version. Idempotent: the caller passes the version it
 * expects to replace (`baseVersion`); a retry after success finds no draft and returns the
 * version that was published instead of creating another one.
 */
export const publishLegalDraftCore = async (firestore: Firestore, type: LegalType, uid: string, baseVersion: number | null, nowMs = Date.now()) => {
    return firestore.runTransaction(async (tx) => {
        const [indexSnap, draftSnap] = await Promise.all([tx.get(docRef(firestore, type)), tx.get(draftRef(firestore, type))]);
        const currentVersion: number | null = indexSnap.data()?.currentVersion ?? null;
        if (!draftSnap.exists) {
            if (currentVersion != null && currentVersion > (baseVersion ?? 0)) {
                return { version: currentVersion, alreadyPublished: true };
            }
            throw new functions.https.HttpsError('failed-precondition', 'No draft to publish.');
        }
        if ((currentVersion ?? null) !== (baseVersion ?? null)) {
            throw new functions.https.HttpsError('aborted', 'A newer version was published meanwhile. Reload and review the draft.');
        }
        const draft = draftSnap.data() as any;
        const version = (currentVersion ?? 0) + 1;
        const effectiveAtMs = draft.effectiveAt ? Math.max(toMs(draft.effectiveAt), nowMs) : nowMs;
        const publishedAt = Timestamp.fromMillis(nowMs);
        const effectiveAt = Timestamp.fromMillis(effectiveAtMs);
        const changeType: LegalChangeType = type === 'imprint' ? 'notifyOnly' : draft.changeType;
        const notifyByEmail = type !== 'imprint' && (changeType === 'requiresAcceptance' || draft.notifyByEmail === true);
        const machineGraceDays = Number.isInteger(draft.machineGraceDays) ? draft.machineGraceDays : 14;

        tx.set(docRef(firestore, type).collection('versions').doc(String(version)), {
            type,
            version,
            status: 'published',
            title: draft.title,
            content: draft.content,
            summary: draft.summary,
            changeType,
            notifyByEmail,
            machineGraceDays,
            effectiveAt,
            publishedAt,
            publishedBy: uid,
        });
        tx.set(docRef(firestore, type), {
            type,
            acceptanceRequired: requiresAcceptanceTracking(type),
            currentVersion: version,
            title: draft.title,
            versions: FieldValue.arrayUnion({ version, changeType, effectiveAt, publishedAt, summary: draft.summary, machineGraceDays }),
            updatedAt: publishedAt,
        }, { merge: true });
        tx.delete(draftRef(firestore, type));
        if (notifyByEmail) {
            tx.set(firestore.collection('legal_mail_jobs').doc(`${type}_v${version}`), {
                type,
                version,
                changeType,
                summary: draft.summary,
                effectiveAt,
                sendAfter: effectiveAt,
                open: true,
                status: 'pending',
                cursor: null,
                leaseUntil: null,
                counts: { sent: 0, skipped: 0, failed: 0 },
                createdAt: publishedAt,
                createdBy: uid,
            });
        }
        return { version, alreadyPublished: false };
    });
};


/** Acceptance rate per published version + mail job progress, for the admin screen. */
export const legalAdminOverviewCore = async (firestore: Firestore) => {
    const db = firestore;
    const [index, usersCount] = await Promise.all([loadIndex(db), db.collection('users').count().get()]);
    const totalUsers = usersCount.data().count;
    const documents = [];
    for (const doc of index) {
        const versions = [];
        for (const meta of [...doc.versions].sort((a, b) => b.version - a.version)) {
            let accepted: number | null = null;
            if (requiresAcceptanceTracking(doc.type)) {
                const snap = await db.collection('legal_acceptances').where(`docs.${doc.type}.version`, '>=', meta.version).count().get();
                accepted = snap.data().count;
            }
            const job = await db.collection('legal_mail_jobs').doc(`${doc.type}_v${meta.version}`).get();
            const jobData = job.data();
            versions.push({
                version: meta.version,
                changeType: meta.changeType,
                effectiveAt: new Date(meta.effectiveAtMs).toISOString(),
                publishedAt: new Date(meta.publishedAtMs).toISOString(),
                accepted,
                mail: jobData ? { status: jobData.status, counts: jobData.counts } : null,
            });
        }
        documents.push({ type: doc.type, versions });
    }
    return { totalUsers, documents };
};


// ---------------------------------------------------------------------------
// User: accept / decline
// ---------------------------------------------------------------------------

const parseClient = (data: any) => {
    const platform = LEGAL_PLATFORMS.includes(data?.platform) ? data.platform : null;
    if (!platform) throw new functions.https.HttpsError('invalid-argument', 'platform is invalid');
    const appVersion = typeof data?.appVersion === 'string' ? data.appVersion.slice(0, 40) : '';
    const items = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0 || items.length > ACCEPTANCE_TYPES.length) throw new functions.https.HttpsError('invalid-argument', 'items are invalid');
    const parsed = items.map((item: any) => {
        if (!isLegalType(item?.type) || !requiresAcceptanceTracking(item.type) || !Number.isInteger(item?.version)) {
            throw new functions.https.HttpsError('invalid-argument', 'item is invalid');
        }
        return { type: item.type as LegalType, version: item.version as number };
    });
    return { platform, appVersion, items: parsed as Array<{ type: LegalType; version: number }> };
};

/**
 * Records acceptance of the CURRENT effective version of each listed document. Any other
 * version is rejected (`failed-precondition`), so clients can only "accept what is current".
 * Notices (notifyOnly) are acknowledged through the same call.
 */
export const acceptLegalDocumentsCore = async (
    firestore: Firestore,
    uid: string,
    input: { platform: string; appVersion: string; items: Array<{ type: LegalType; version: number }> },
    nowMs = Date.now(),
) => {
    const index = await loadIndex(firestore);
    const ref = firestore.collection('legal_acceptances').doc(uid);
    return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const accepted = (snap.data()?.docs || {}) as AcceptedDocs;
        const gate = evaluateGate(index, accepted, nowMs);
        const at = Timestamp.fromMillis(nowMs);
        const update: Record<string, any> = { uid, updatedAt: at };
        for (const item of input.items) {
            const doc = index.find((entry) => entry.type === item.type);
            const current = doc ? currentEffective(doc.versions, nowMs) : null;
            if (!current || current.version !== item.version) {
                throw new functions.https.HttpsError('failed-precondition', `Version ${item.version} of ${item.type} is not the current version.`);
            }
            const decision = gate.notices.some((notice) => notice.type === item.type) ? 'acknowledged' : 'accepted';
            update[`docs.${item.type}`] = { version: item.version, acceptedAt: at, platform: input.platform, appVersion: input.appVersion, decision };
            tx.create(ref.collection('events').doc(), {
                type: item.type, version: item.version, decision, platform: input.platform, appVersion: input.appVersion, at,
            });
        }
        if (snap.exists) tx.update(ref, update);
        else {
            const docs: Record<string, any> = {};
            for (const [key, value] of Object.entries(update)) {
                if (key.startsWith('docs.')) docs[key.slice(5)] = value;
            }
            tx.set(ref, { uid, updatedAt: at, docs });
        }
        const acceptedAfter: Record<string, number> = {};
        for (const type of ACCEPTANCE_TYPES) {
            const fromUpdate = update[`docs.${type}`]?.version;
            acceptedAfter[type] = fromUpdate ?? accepted[type]?.version ?? 0;
        }
        return { ok: true, accepted: acceptedAfter };
    });
};

export const acceptLegalDocuments = functions.region(REGION).runWith(FAST_START).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    return acceptLegalDocumentsCore(db, context.auth.uid, parseClient(data));
});

/** Logs that the user declined (audit only — the app stays locked until they accept). */
export const declineLegalDocuments = functions.region(REGION).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    const input = parseClient(data);
    const ref = db.collection('legal_acceptances').doc(context.auth.uid);
    const batch = db.batch();
    const at = Timestamp.now();
    for (const item of input.items) {
        batch.create(ref.collection('events').doc(), {
            type: item.type, version: item.version, decision: 'declined', platform: input.platform, appVersion: input.appVersion, at,
        });
    }
    await batch.commit();
    return { ok: true };
});

// ---------------------------------------------------------------------------
// Public read endpoint: GET /api/legal[/<type>]?lang=de|en&version=n
// ---------------------------------------------------------------------------

export const legalDocument = functions.region(REGION).runWith(FAST_START).https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'method-not-allowed' });
        return;
    }
    const segments = req.path.split('/').filter(Boolean);
    const type = segments[segments.length - 1];
    const lang = resolveLang(req.query.lang);
    try {
        if (!isLegalType(type)) {
            const index = await loadIndex(db);
            res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
            res.json({
                documents: index.map((doc) => {
                    const current = currentEffective(doc.versions, Date.now());
                    return { type: doc.type, version: current?.version ?? null, effectiveAt: current ? new Date(current.effectiveAtMs).toISOString() : null };
                }),
            });
            return;
        }
        const requested = Number(req.query.version);
        let version: number | null = Number.isInteger(requested) && requested > 0 ? requested : null;
        const indexSnap = await docRef(db, type).get();
        const versions = ((indexSnap.data()?.versions as any[]) || []).map(versionMetaFromDoc);
        if (version == null) version = currentEffective(versions, Date.now())?.version ?? null;
        if (version == null) {
            res.status(404).json({ error: 'not-found' });
            return;
        }
        const snap = await docRef(db, type).collection('versions').doc(String(version)).get();
        if (!snap.exists) {
            res.status(404).json({ error: 'not-found' });
            return;
        }
        const data = snap.data() as any;
        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.json({
            type,
            version,
            lang,
            changeType: data.changeType,
            effectiveAt: new Date(toMs(data.effectiveAt)).toISOString(),
            publishedAt: new Date(toMs(data.publishedAt)).toISOString(),
            title: data.title?.[lang] || '',
            summary: data.summary?.[lang] || '',
            markdown: data.content?.[lang] || '',
            versions: versions
                .filter((v) => v.effectiveAtMs <= Date.now() || v.version === version)
                .map((v) => ({ version: v.version, effectiveAt: new Date(v.effectiveAtMs).toISOString(), changeType: v.changeType })),
        });
    } catch (error) {
        console.error('legalDocument failed', error);
        res.status(500).json({ error: 'internal' });
    }
});

// ---------------------------------------------------------------------------
// Mail jobs: batched, rate-limited, resumable, no double send
// ---------------------------------------------------------------------------

export type MailSender = (to: string, subject: string, html: string) => Promise<unknown>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const defaultSender: MailSender = async (to, subject, html) => {
    if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.LEGAL_MAIL_DRY_RUN === 'true') {
        console.log(`[legal-mail:dry-run] to=${to} subject="${subject}" bytes=${html.length}`);
        return { dryRun: true };
    }
    return sendEmail(to, subject, html, { type: 'legal' });
};

/**
 * Processes one mail job until done or until the time budget runs out (cursor is persisted per
 * batch, a lease prevents parallel runs). Every recipient gets a `recipients/{uid}` log doc that
 * is created BEFORE sending; an existing doc means "already handled" so retries never double send.
 */
export const runLegalMailJob = async (
    firestore: Firestore,
    jobId: string,
    options: { send?: MailSender; nowMs?: number; budgetMs?: number; batchSize?: number; delayMs?: number } = {},
) => {
    const send = options.send || defaultSender;
    const nowMs = options.nowMs ?? Date.now();
    const budgetMs = options.budgetMs ?? 8 * 60 * 1000;
    const batchSize = options.batchSize ?? 100;
    const delayMs = options.delayMs ?? Number(process.env.LEGAL_MAIL_DELAY_MS || 300);
    const jobRef = firestore.collection('legal_mail_jobs').doc(jobId);

    const job = await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(jobRef);
        const data = snap.data();
        if (!data || data.open !== true) return null;
        if (toMs(data.sendAfter) > nowMs) return null;
        if (data.leaseUntil && toMs(data.leaseUntil) > nowMs) return null;
        tx.update(jobRef, { status: 'running', leaseUntil: Timestamp.fromMillis(nowMs + budgetMs + 60_000), startedAt: data.startedAt || Timestamp.fromMillis(nowMs) });
        return data;
    });
    if (!job) return { processed: 0, done: false, skippedRun: true };

    const type = job.type as LegalType;
    const mailInput = {
        type, version: job.version as number, changeType: job.changeType as LegalChangeType,
        summary: job.summary, effectiveAtMs: toMs(job.effectiveAt),
    };
    const started = Date.now();
    let cursor: string | null = job.cursor || null;
    let processed = 0;
    let done = false;

    while (Date.now() - started < budgetMs) {
        let query = firestore.collection('users').orderBy(FieldPath.documentId()).limit(batchSize);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        if (page.empty) { done = true; break; }
        const acceptances = await firestore.getAll(...page.docs.map((user) => firestore.collection('legal_acceptances').doc(user.id)));
        const counts = { sent: 0, skipped: 0, failed: 0 };
        for (let i = 0; i < page.docs.length; i += 1) {
            const user = page.docs[i];
            const profile = user.data();
            const acceptedVersion = Number(acceptances[i].data()?.docs?.[type]?.version) || 0;
            const logRef = jobRef.collection('recipients').doc(user.id);
            if (!shouldMailUser(profile, acceptedVersion, mailInput.version)) continue;
            try {
                await logRef.create({ status: 'sending', at: FieldValue.serverTimestamp() });
            } catch {
                counts.skipped += 1; // already handled by an earlier run
                continue;
            }
            const lang = resolveLang(profile.language);
            const mail = buildLegalMail(mailInput, lang);
            try {
                await send(profile.email, mail.subject, getSystemEmailTemplate(mail.title, mail.bodyHtml, mail.actionLink, mail.actionText, lang));
                await logRef.update({ status: 'sent', lang, at: FieldValue.serverTimestamp() });
                counts.sent += 1;
            } catch (error) {
                await logRef.update({ status: 'failed', error: String((error as Error)?.message || error).slice(0, 300) });
                counts.failed += 1;
            }
            processed += 1;
            if (delayMs > 0) await sleep(delayMs);
        }
        cursor = page.docs[page.docs.length - 1].id;
        await jobRef.update({
            cursor,
            'counts.sent': FieldValue.increment(counts.sent),
            'counts.skipped': FieldValue.increment(counts.skipped),
            'counts.failed': FieldValue.increment(counts.failed),
        });
        if (page.size < batchSize) { done = true; break; }
    }

    await jobRef.update(done
        ? { status: 'done', open: false, leaseUntil: null, completedAt: FieldValue.serverTimestamp() }
        : { leaseUntil: null });
    return { processed, done, skippedRun: false };
};

const runDueJobs = async () => {
    const jobs = await db.collection('legal_mail_jobs').where('open', '==', true).get();
    for (const job of jobs.docs) {
        try {
            const result = await runLegalMailJob(db, job.id);
            console.log('legal mail job', job.id, JSON.stringify(result));
        } catch (error) {
            console.error('legal mail job failed', job.id, error);
        }
    }
};

/** Starts a job right after publish when it is already due. */
export const onLegalMailJobCreated = functions.region(REGION).runWith({ timeoutSeconds: 540, secrets: EMAIL_SECRETS })
    .firestore.document('legal_mail_jobs/{jobId}')
    .onCreate(async (snap) => {
        const result = await runLegalMailJob(db, snap.id);
        console.log('legal mail job', snap.id, JSON.stringify(result));
    });

/** Picks up future-dated (effectiveAt) and unfinished jobs. */
export const processLegalMailJobs = onSchedule(
    { schedule: 'every 15 minutes', region: REGION, timeoutSeconds: 540, memory: '256MiB', secrets: EMAIL_SECRETS, serviceAccount: FUNCTIONS_SERVICE_ACCOUNT },
    async () => { await runDueJobs(); },
);
