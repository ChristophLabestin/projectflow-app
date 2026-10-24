// Platform newsletter + waitlist: Firestore operations (server only; rules deny all client access).
// Collections: platform_subscribers/{sha256(email)} (+ consent_log), platform_optin_tokens/{sha256(token)},
// platform_campaigns/{id} (+ sends). Contract: brain/plans/newsletter-contract.md
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../init';
import {
    CONSENT_TEXTS, OPTIN_MAIL, OPTIN_TTL_MS, aggregateStatus, confirmUrl, consentRecord, maskEmail, newToken, subscriberId, tokenId,
} from './logic';
import type { Lang, ListId, Source, SubscriberDoc } from './logic';

export const subscribers = () => db.collection('platform_subscribers');
export const optinTokens = () => db.collection('platform_optin_tokens');
export const campaigns = () => db.collection('platform_campaigns');

export type Evidence = { ip?: string; userAgent?: string; by?: string };
type LogAction = 'requested' | 'confirmed' | 'unsubscribed' | 'bounced' | 'imported' | 'deleted-token';

const logEntry = (list: ListId, action: LogAction, lang: Lang, evidence: Evidence, extra: Record<string, unknown> = {}) => ({
    list,
    action,
    at: FieldValue.serverTimestamp(),
    ip: evidence.ip || null,
    userAgent: (evidence.userAgent || '').slice(0, 300) || null,
    by: evidence.by || null,
    ...(action === 'requested' || action === 'confirmed' ? { ...consentRecord(list, lang), consentText: CONSENT_TEXTS[list][lang] } : {}),
    ...extra,
});

/** Runs `fn` with the merged lists map and writes status + aggregate in one go. */
const listUpdate = (doc: SubscriberDoc | undefined, list: ListId, patch: Record<string, unknown>) => {
    const lists = { ...(doc?.lists || {}), [list]: { ...(doc?.lists?.[list] || {}), ...patch } } as SubscriberDoc['lists'];
    return { lists, status: aggregateStatus(lists), updatedAt: FieldValue.serverTimestamp() };
};

export type OptinRequest = {
    email: string;
    list: ListId;
    lang: Lang;
    source: Source;
    name?: string;
    interest?: string;
    uid?: string | null;
    evidence: Evidence;
};

/**
 * Creates/updates the subscriber as pending on `list` and returns a fresh confirm token.
 * Already confirmed → `{ already: true }` (no mail; the public endpoint answers the same either way).
 */
export const requestOptin = async (req: OptinRequest): Promise<{ already: boolean; token?: string; id: string }> => {
    const id = subscriberId(req.email);
    const ref = subscribers().doc(id);
    const token = newToken();
    const already = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const doc = snap.data() as SubscriberDoc | undefined;
        if (doc?.lists?.[req.list]?.status === 'confirmed') {
            if (req.uid && !doc.uid) tx.set(ref, { uid: req.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            return true;
        }
        tx.set(ref, {
            email: req.email,
            lang: req.lang,
            ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp(), source: req.source }),
            ...(req.name ? { name: req.name } : {}),
            ...(req.interest ? { interest: req.interest } : {}),
            ...(req.uid ? { uid: req.uid } : {}),
            ...listUpdate(doc, req.list, {
                status: 'pending',
                source: req.source,
                requestedAt: FieldValue.serverTimestamp(),
                consentVersion: consentRecord(req.list, req.lang).consentVersion,
            }),
        }, { merge: true });
        tx.set(ref.collection('consent_log').doc(), logEntry(req.list, 'requested', req.lang, req.evidence, { source: req.source }));
        tx.set(optinTokens().doc(tokenId(token)), {
            subscriberId: id,
            list: req.list,
            lang: req.lang,
            purpose: 'confirm',
            createdAt: FieldValue.serverTimestamp(),
            expiresAt: Timestamp.fromMillis(Date.now() + OPTIN_TTL_MS),
        });
        return false;
    });
    return already ? { already, id } : { already, token, id };
};

/** Sends the double-opt-in mail for a token from requestOptin. */
export const sendOptinMail = async (email: string, list: ListId, lang: Lang, token: string, siteBase?: string) => {
    const { sendEmail, getSystemEmailTemplate } = await import('../email');
    const t = OPTIN_MAIL[list][lang];
    const html = getSystemEmailTemplate(t.title, t.body, confirmUrl(token, lang, siteBase), t.button, lang);
    return sendEmail(email, t.subject, html, { type: list === 'waitlist' ? 'waitlist' : 'newsletter-optin' });
};

export type ConfirmResult = {
    result: 'confirmed' | 'already' | 'expired' | 'invalid';
    list?: ListId;
    lang?: Lang;
    email?: string;
    /** Waitlist confirmations: token for the separate "also subscribe to the newsletter" consent. */
    newsletterToken?: string;
    newsletterStatus?: string;
};

/** Confirms a double-opt-in token (button click on the landing confirm page). */
export const confirmOptin = async (token: string, evidence: Evidence): Promise<ConfirmResult> => {
    if (!token || token.length > 200) return { result: 'invalid' };
    const tokenRef = optinTokens().doc(tokenId(token));
    return db.runTransaction(async (tx) => {
        const tokenSnap = await tx.get(tokenRef);
        const t = tokenSnap.data();
        if (!tokenSnap.exists || !t || t.purpose !== 'confirm') return { result: 'invalid' } as ConfirmResult;
        const list = t.list as ListId;
        const lang = (t.lang || 'en') as Lang;
        if (t.expiresAt?.toMillis?.() < Date.now()) return { result: 'expired', list, lang } as ConfirmResult;
        const ref = subscribers().doc(String(t.subscriberId));
        const snap = await tx.get(ref);
        const doc = snap.data() as SubscriberDoc | undefined;
        if (!doc) return { result: 'invalid' } as ConfirmResult;
        const status = doc.lists?.[list]?.status;
        let result: ConfirmResult['result'] = 'already';
        if (status === 'pending' && !t.usedAt) {
            result = 'confirmed';
            tx.set(ref, listUpdate(doc, list, { status: 'confirmed', confirmedAt: FieldValue.serverTimestamp() }), { merge: true });
            tx.set(ref.collection('consent_log').doc(), logEntry(list, 'confirmed', lang, evidence));
            tx.update(tokenRef, { usedAt: FieldValue.serverTimestamp() });
        }
        const out: ConfirmResult = { result, list, lang, email: maskEmail(doc.email) };
        const newsletterStatus = doc.lists?.newsletter?.status;
        out.newsletterStatus = newsletterStatus || 'none';
        if (list === 'waitlist' && newsletterStatus !== 'confirmed' && (result === 'confirmed' || status === 'confirmed')) {
            const upgrade = newToken();
            tx.set(optinTokens().doc(tokenId(upgrade)), {
                subscriberId: ref.id,
                list: 'newsletter',
                lang,
                purpose: 'addNewsletter',
                createdAt: FieldValue.serverTimestamp(),
                expiresAt: Timestamp.fromMillis(Date.now() + 2 * 3_600_000),
            });
            out.newsletterToken = upgrade;
        }
        return out;
    });
};

/**
 * Newsletter consent given on the confirm page right after a waitlist confirmation. The address was just
 * verified by that click, so no second mail; logged as its own consent (via: 'waitlist-confirm').
 */
export const addNewsletterFromWaitlist = async (token: string, lang: Lang, evidence: Evidence): Promise<'confirmed' | 'already' | 'invalid'> => {
    if (!token || token.length > 200) return 'invalid';
    const tokenRef = optinTokens().doc(tokenId(token));
    return db.runTransaction(async (tx) => {
        const tokenSnap = await tx.get(tokenRef);
        const t = tokenSnap.data();
        if (!t || t.purpose !== 'addNewsletter' || t.expiresAt?.toMillis?.() < Date.now()) return 'invalid';
        const ref = subscribers().doc(String(t.subscriberId));
        const snap = await tx.get(ref);
        const doc = snap.data() as SubscriberDoc | undefined;
        if (!doc || doc.lists?.waitlist?.status !== 'confirmed') return 'invalid';
        tx.delete(tokenRef);
        if (doc.lists?.newsletter?.status === 'confirmed') return 'already';
        tx.set(ref, listUpdate(doc, 'newsletter', {
            status: 'confirmed',
            source: doc.lists?.waitlist?.source || 'landing',
            requestedAt: FieldValue.serverTimestamp(),
            confirmedAt: FieldValue.serverTimestamp(),
            consentVersion: consentRecord('newsletter', lang).consentVersion,
        }), { merge: true });
        tx.set(ref.collection('consent_log').doc(), logEntry('newsletter', 'confirmed', lang, evidence, { via: 'waitlist-confirm' }));
        return 'confirmed';
    });
};

/** Withdraws consent for one list. Returns false if the subscriber/list does not exist. */
export const unsubscribe = async (id: string, list: ListId, evidence: Evidence & { via: string; campaignId?: string }): Promise<boolean> => {
    const ref = subscribers().doc(id);
    const changed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const doc = snap.data() as SubscriberDoc | undefined;
        const current = doc?.lists?.[list]?.status;
        if (!doc || !current) return null;
        if (current === 'unsubscribed') return false;
        tx.set(ref, listUpdate(doc, list, { status: 'unsubscribed', unsubscribedAt: FieldValue.serverTimestamp() }), { merge: true });
        tx.set(ref.collection('consent_log').doc(), logEntry(list, 'unsubscribed', doc.lang || 'en', evidence, { via: evidence.via, campaignId: evidence.campaignId || null }));
        return true;
    });
    if (changed && evidence.campaignId) {
        await campaigns().doc(evidence.campaignId).set({ stats: { unsubscribed: FieldValue.increment(1) } }, { merge: true }).catch(() => undefined);
    }
    return changed !== null;
};

/** Hard bounce / complaint from SES: every pending or confirmed list → bounced. */
export const markBounced = async (email: string, reason: string) => {
    const ref = subscribers().doc(subscriberId(email));
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const doc = snap.data() as SubscriberDoc | undefined;
        if (!doc?.lists) return;
        let lists = doc.lists;
        let touched = false;
        for (const [list, m] of Object.entries(doc.lists) as [ListId, any][]) {
            if (m?.status !== 'confirmed' && m?.status !== 'pending') continue;
            lists = { ...lists, [list]: { ...m, status: 'bounced', bouncedAt: FieldValue.serverTimestamp() } };
            tx.set(ref.collection('consent_log').doc(), logEntry(list, 'bounced', doc.lang || 'en', { by: 'ses' }, { reason }));
            touched = true;
        }
        if (touched) tx.set(ref, { lists, status: aggregateStatus(lists), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
};

const deleteQuery = async (query: FirebaseFirestore.Query) => {
    for (;;) {
        const snap = await query.limit(400).get();
        if (snap.empty) return;
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
};

/** GDPR erasure: subscriber, consent log and open tokens. */
export const deleteSubscriber = async (id: string) => {
    const ref = subscribers().doc(id);
    await deleteQuery(ref.collection('consent_log'));
    await deleteQuery(optinTokens().where('subscriberId', '==', id));
    await ref.delete();
};

/** Deletes subscribers that never confirmed anything (older than the retention) and expired tokens. */
export const cleanupPending = async (olderThanMs: number) => {
    const cutoff = Timestamp.fromMillis(Date.now() - olderThanMs);
    let removed = 0;
    const snap = await subscribers().where('status', '==', 'pending').where('updatedAt', '<', cutoff).limit(300).get();
    for (const doc of snap.docs) {
        const d = doc.data() as SubscriberDoc;
        if (Object.values(d.lists || {}).some((m) => m?.status && m.status !== 'pending')) continue;
        await deleteSubscriber(doc.id);
        removed += 1;
    }
    const tokens = await optinTokens().where('expiresAt', '<', Timestamp.now()).limit(400).get();
    if (!tokens.empty) {
        const batch = db.batch();
        tokens.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
    return { removed, tokens: tokens.size };
};
