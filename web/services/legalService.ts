import { collection, doc, getDoc, getDocs, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from './firebase';
import {
    LEGAL_TYPES,
    type AcceptedDocs,
    type LegalChangeType,
    type LegalPlatform,
    type LegalType,
    type Localized,
    type VersionMeta,
    timestampToMs,
    versionMetaFromRaw,
} from '../utils/legalConsent';

/** Data access for versioned legal documents (contract: brain/plans/legal-consent-contract.md). */

export type LegalIndexEntry = { type: LegalType; currentVersion: number | null; title: Localized | null; versions: VersionMeta[] };

export type LegalVersion = {
    type: LegalType;
    version: number;
    title: Localized;
    content: Localized;
    summary: Localized;
    changeType: LegalChangeType;
    effectiveAtMs: number;
    publishedAtMs: number;
};

export type LegalDraft = {
    type: LegalType;
    title: Localized;
    content: Localized;
    summary: Localized;
    changeType: LegalChangeType;
    effectiveAtMs: number | null;
    notifyByEmail: boolean;
    machineGraceDays: number;
    baseVersion: number | null;
    updatedAtMs: number;
};

const localized = (value: any): Localized => ({ de: value?.de || '', en: value?.en || '' });

const indexEntry = (type: LegalType, data: any): LegalIndexEntry => ({
    type,
    currentVersion: typeof data?.currentVersion === 'number' ? data.currentVersion : null,
    title: data?.title ? localized(data.title) : null,
    versions: ((data?.versions as any[]) || []).map(versionMetaFromRaw).sort((a, b) => a.version - b.version),
});

/** Live index of all legal documents (3 small public docs). */
export const subscribeLegalIndex = (onChange: (entries: LegalIndexEntry[]) => void, onError?: (error: Error) => void): Unsubscribe => {
    const entries = new Map<LegalType, LegalIndexEntry>();
    const unsubscribers = LEGAL_TYPES.map((type) => onSnapshot(
        doc(db, 'legal_documents', type),
        (snap) => {
            entries.set(type, indexEntry(type, snap.data()));
            if (entries.size === LEGAL_TYPES.length) onChange(LEGAL_TYPES.map((key) => entries.get(key)!));
        },
        (error) => onError?.(error),
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};

export const fetchLegalIndexEntry = async (type: LegalType): Promise<LegalIndexEntry> => {
    const snap = await getDoc(doc(db, 'legal_documents', type));
    return indexEntry(type, snap.data());
};

export const fetchLegalVersion = async (type: LegalType, version: number): Promise<LegalVersion | null> => {
    const snap = await getDoc(doc(db, 'legal_documents', type, 'versions', String(version)));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        type,
        version,
        title: localized(data.title),
        content: localized(data.content),
        summary: localized(data.summary),
        changeType: data.changeType === 'requiresAcceptance' ? 'requiresAcceptance' : 'notifyOnly',
        effectiveAtMs: timestampToMs(data.effectiveAt),
        publishedAtMs: timestampToMs(data.publishedAt),
    };
};

/** The signed-in user's accepted versions (readable by the owner only). */
export const subscribeMyLegalAcceptance = (
    uid: string,
    onChange: (accepted: AcceptedDocs) => void,
    onError?: (error: Error) => void,
): Unsubscribe => onSnapshot(
    doc(db, 'legal_acceptances', uid),
    (snap) => onChange((snap.data()?.docs || {}) as AcceptedDocs),
    (error) => onError?.(error),
);

type ConsentPayload = { items: Array<{ type: LegalType; version: number }>; platform: LegalPlatform; appVersion: string };

export const acceptLegalDocuments = async (payload: ConsentPayload) => {
    const result = await httpsCallable<ConsentPayload, { ok: boolean; accepted: Record<string, number> }>(functions, 'acceptLegalDocuments')(payload);
    return result.data;
};

export const declineLegalDocuments = async (payload: ConsentPayload) => {
    await httpsCallable<ConsentPayload, { ok: boolean }>(functions, 'declineLegalDocuments')(payload);
};
