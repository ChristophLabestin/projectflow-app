import { db } from './init';
import { loadIndex } from './legal';
import { APP_URL, AcceptedDocs, legalDocName, machineAccessBlock } from './legal-logic';

/**
 * Legal consent for machine access (/mcp and /api with `pfo_` / `pfp_` / workspace tokens).
 * After the grace period (`machineGraceDays`, default 14 days after effectiveAt) a token whose
 * user has not accepted the current `requiresAcceptance` version is rejected with 403.
 * Contract: brain/plans/legal-consent-contract.md.
 */

export type MachineConsentResult = { ok: true } | { ok: false; status: 403; code: 'legal-consent-required'; error: string };

const INDEX_TTL_MS = 5 * 60 * 1000;
const OK_TTL_MS = 5 * 60 * 1000;
let indexCache: { at: number; value: Awaited<ReturnType<typeof loadIndex>> } | null = null;
const okCache = new Map<string, number>();

const getIndex = async (nowMs: number) => {
    if (!indexCache || nowMs - indexCache.at > INDEX_TTL_MS) indexCache = { at: nowMs, value: await loadIndex(db) };
    return indexCache.value;
};

export const legalConsentRequiredMessage = (type: Parameters<typeof legalDocName>[0], version: number) =>
    `Please accept the updated ${legalDocName(type, 'en')} (version ${version}) in ProjectFlow before using the API: ${APP_URL}`;

export const checkMachineLegalConsent = async (uid: string, nowMs = Date.now()): Promise<MachineConsentResult> => {
    if (!uid) return { ok: true };
    const cachedUntil = okCache.get(uid);
    if (cachedUntil && cachedUntil > nowMs) return { ok: true };
    try {
        const [index, acceptance] = await Promise.all([getIndex(nowMs), db.doc(`legal_acceptances/${uid}`).get()]);
        const block = machineAccessBlock(index, (acceptance.data()?.docs || {}) as AcceptedDocs, nowMs);
        if (!block) {
            if (okCache.size > 5000) okCache.clear();
            okCache.set(uid, nowMs + OK_TTL_MS);
            return { ok: true };
        }
        return { ok: false, status: 403, code: 'legal-consent-required', error: legalConsentRequiredMessage(block.type, block.version) };
    } catch (error) {
        // Fail open like the app gate: a lookup error must not take down every integration.
        console.error('checkMachineLegalConsent failed', error);
        return { ok: true };
    }
};
