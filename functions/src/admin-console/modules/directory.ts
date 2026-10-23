import * as admin from 'firebase-admin';
import type { UserRecord } from 'firebase-admin/auth';

/** Auth user directory, cached per instance (listUsers pages through every account). */
export type DirectoryUser = {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    createdAt: number;
    lastSignInAt: number | null;
    lastActiveAt: number | null;
    providers: string[];
    mfa: string[];
    disabled: boolean;
    emailVerified: boolean;
    platformAdmin: boolean;
    reviewAccount: boolean;
};

const CACHE_MS = 60_000;
let cache: { at: number; users: DirectoryUser[] } | null = null;

const ms = (value?: string | null) => (value ? Date.parse(value) || null : null);

export const toDirectoryUser = (u: UserRecord): DirectoryUser => ({
    uid: u.uid,
    email: (u.email || '').toLowerCase(),
    displayName: u.displayName || '',
    photoURL: u.photoURL || '',
    createdAt: ms(u.metadata.creationTime) ?? 0,
    lastSignInAt: ms(u.metadata.lastSignInTime),
    lastActiveAt: ms(u.metadata.lastRefreshTime) ?? ms(u.metadata.lastSignInTime),
    providers: u.providerData.map((p) => p.providerId),
    mfa: (u.multiFactor?.enrolledFactors || []).map((f) => f.factorId),
    disabled: u.disabled,
    emailVerified: u.emailVerified,
    platformAdmin: u.customClaims?.platformAdmin === true,
    reviewAccount: u.customClaims?.reviewAccount === true,
});

export const listDirectory = async (fresh = false): Promise<DirectoryUser[]> => {
    if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.users;
    const users: DirectoryUser[] = [];
    let pageToken: string | undefined;
    do {
        const page = await admin.auth().listUsers(1000, pageToken);
        page.users.forEach((u) => users.push(toDirectoryUser(u)));
        pageToken = page.pageToken;
    } while (pageToken && users.length < 50_000);
    cache = { at: Date.now(), users };
    return users;
};

export const invalidateDirectory = () => { cache = null; };

/**
 * Apple App Review demo account (functions/scripts/create-review-account.mjs): Auth claim `reviewAccount`,
 * `users/{uid}.isReviewAccount`, `tenants/{id}.isReviewAccount`. It never counts in KPIs, lists or insights.
 */
export const listRealUsers = async (fresh = false) => (await listDirectory(fresh)).filter((u) => !u.reviewAccount);

let reviewTenants: { at: number; ids: Set<string> } | null = null;
export const reviewTenantIds = async (db: FirebaseFirestore.Firestore): Promise<Set<string>> => {
    if (reviewTenants && Date.now() - reviewTenants.at < CACHE_MS) return reviewTenants.ids;
    const snap = await db.collection('tenants').where('isReviewAccount', '==', true).select().get();
    reviewTenants = { at: Date.now(), ids: new Set(snap.docs.map((d) => d.id)) };
    return reviewTenants.ids;
};
