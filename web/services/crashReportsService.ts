import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
    type QueryConstraint,
    type Timestamp,
} from 'firebase/firestore';

import { auth, db } from './firebase';

/** Crash issues/events written by the `crashIngest` function (functions/src/crash-reports.ts); platform admins only. */

export type CrashPlatform = 'web' | 'ios';
export type CrashStatus = 'open' | 'resolved' | 'ignored';

export type CrashFrame = {
    function?: string;
    file?: string;
    line?: number;
    column?: number;
    image?: string;
    uuid?: string;
    offset?: number;
    address?: string;
    inApp?: boolean;
};

export type CrashIssue = {
    id: string;
    platform: CrashPlatform;
    type: string;
    message: string;
    culprit: string;
    mechanism: string;
    count: number;
    status: CrashStatus;
    firstSeen: number;
    lastSeen: number;
    lastRelease: string;
    releases: string[];
    environments: string[];
    lastEnvironment: string;
    resolvedRelease?: string;
};

export type CrashEvent = {
    id: string;
    timestamp: number;
    mechanism: string;
    handled: boolean;
    type: string;
    message: string;
    frames: CrashFrame[];
    symbolicatedFrames?: CrashFrame[];
    images: { name: string; uuid: string; loadAddress: string; arch?: string }[];
    route?: string;
    environment: string;
    release: string;
    build: string | null;
    installId: string;
    device: { os: string; osVersion: string; model?: string; locale?: string; browser?: string };
};

const millis = (value: unknown): number => (value as Timestamp | undefined)?.toMillis?.() ?? 0;

const toIssue = (id: string, data: Record<string, any>): CrashIssue => ({
    id,
    platform: data.platform,
    type: data.type ?? '',
    message: data.message ?? '',
    culprit: data.symbolicatedCulprit ?? data.culprit ?? '',
    mechanism: data.mechanism ?? '',
    count: Number(data.count ?? 0),
    status: data.status ?? 'open',
    firstSeen: millis(data.firstSeen),
    lastSeen: millis(data.lastSeen),
    lastRelease: data.lastRelease ?? '',
    releases: data.releases ?? [],
    environments: data.environments ?? [],
    lastEnvironment: data.lastEnvironment ?? '',
    resolvedRelease: data.resolvedRelease,
});

export const listCrashIssues = async (filters: { platform?: CrashPlatform; status?: CrashStatus }): Promise<CrashIssue[]> => {
    const constraints: QueryConstraint[] = [];
    if (filters.platform) constraints.push(where('platform', '==', filters.platform));
    if (filters.status) constraints.push(where('status', '==', filters.status));
    const snapshot = await getDocs(query(collection(db, 'crashIssues'), ...constraints, orderBy('lastSeen', 'desc'), limit(200)));
    return snapshot.docs.map((d) => toIssue(d.id, d.data()));
};

export const getCrashIssue = async (issueId: string): Promise<CrashIssue | null> => {
    const snapshot = await getDoc(doc(db, 'crashIssues', issueId));
    return snapshot.exists() ? toIssue(snapshot.id, snapshot.data()) : null;
};

export const listCrashEvents = async (issueId: string): Promise<CrashEvent[]> => {
    const snapshot = await getDocs(query(collection(db, 'crashIssues', issueId, 'crashEvents'), orderBy('receivedAt', 'desc'), limit(50)));
    return snapshot.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            timestamp: Number(data.timestamp ?? 0),
            mechanism: data.mechanism ?? '',
            handled: data.handled === true,
            type: data.type ?? '',
            message: data.message ?? '',
            frames: data.frames ?? [],
            symbolicatedFrames: data.symbolicatedFrames,
            images: data.images ?? [],
            route: data.route,
            environment: data.environment ?? '',
            release: data.release ?? '',
            build: data.build ?? null,
            installId: data.installId ?? '',
            device: data.device ?? { os: '', osVersion: '' },
        };
    });
};

/** Resolving remembers the release, so the issue reopens when it comes back in a newer one (crashIngest). */
export const setCrashIssueStatus = async (issue: CrashIssue, status: CrashStatus): Promise<void> => {
    await updateDoc(doc(db, 'crashIssues', issue.id), {
        status,
        statusChangedAt: serverTimestamp(),
        statusChangedBy: auth.currentUser?.uid ?? null,
        resolvedRelease: status === 'resolved' ? issue.lastRelease : null,
    });
};
