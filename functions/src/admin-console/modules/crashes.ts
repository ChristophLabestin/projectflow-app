import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { HandlerMap } from '../types';
import { AdminInputError, int, str, toMs } from '../types';

const STATUSES = ['open', 'resolved', 'ignored'] as const;
const DAY = 86_400_000;

export const dayKeys = (days: number, now = Date.now()) =>
    Array.from({ length: days }, (_, i) => new Date(now - (days - 1 - i) * DAY).toISOString().slice(0, 10));

const issueOut = (id: string, d: FirebaseFirestore.DocumentData) => ({
    id,
    platform: d.platform,
    type: d.type,
    message: d.message,
    culprit: d.culprit || '',
    mechanism: d.mechanism || '',
    status: d.status || 'open',
    count: Number(d.count || 0),
    firstSeen: toMs(d.firstSeen),
    lastSeen: toMs(d.lastSeen),
    lastRelease: d.lastRelease || '',
    releases: Array.isArray(d.releases) ? d.releases : [],
    environments: Array.isArray(d.environments) ? d.environments : [],
    resolvedRelease: d.resolvedRelease || null,
    note: d.note || '',
    statusChangedAt: toMs(d.statusChangedAt),
});

export const crashHandlers: HandlerMap = {
    /** Issues + per-issue daily trend and affected installs over `days` (events are capped at 100/issue/day). */
    'crashes.list': {
        audit: 'none',
        run: async ({ db }, params) => {
            const days = int(params?.days, 14, 1, 90);
            const since = Date.now() - days * DAY;
            const [issuesSnap, eventsSnap] = await Promise.all([
                db.collection('crashIssues').orderBy('lastSeen', 'desc').limit(500).get(),
                db.collectionGroup('crashEvents').where('receivedAt', '>=', Timestamp.fromMillis(since)).select('receivedAt', 'installId', 'platform').get(),
            ]);
            const keys = dayKeys(days);
            const index = new Map(keys.map((k, i) => [k, i]));
            const perIssue = new Map<string, { series: number[]; installs: Set<string> }>();
            const totals = { web: keys.map(() => 0), ios: keys.map(() => 0) };
            const installs = new Set<string>();
            eventsSnap.forEach((doc) => {
                const issueId = doc.ref.parent.parent?.id;
                const at = toMs(doc.get('receivedAt'));
                if (!issueId || !at) return;
                const i = index.get(new Date(at).toISOString().slice(0, 10));
                if (i === undefined) return;
                const entry = perIssue.get(issueId) ?? { series: keys.map(() => 0), installs: new Set<string>() };
                entry.series[i] += 1;
                const install = doc.get('installId');
                if (install) { entry.installs.add(install); installs.add(install); }
                perIssue.set(issueId, entry);
                const platform = doc.get('platform') === 'ios' ? 'ios' : 'web';
                totals[platform][i] += 1;
            });
            return {
                days: keys,
                totals,
                affectedInstalls: installs.size,
                issues: issuesSnap.docs.map((doc) => {
                    const trend = perIssue.get(doc.id);
                    return { ...issueOut(doc.id, doc.data()), trend: trend?.series ?? keys.map(() => 0), installs: trend?.installs.size ?? 0 };
                }),
            };
        },
    },

    'crashes.get': {
        audit: 'none',
        run: async ({ db }, params) => {
            const id = str(params?.id, 64);
            if (!id) throw new AdminInputError('id is required');
            const ref = db.collection('crashIssues').doc(id);
            const [issue, events] = await Promise.all([ref.get(), ref.collection('crashEvents').orderBy('receivedAt', 'desc').limit(100).get()]);
            if (!issue.exists) throw new AdminInputError('Issue not found');
            const keys = dayKeys(30);
            const series = keys.map(() => 0);
            const byRelease: Record<string, number> = {};
            const byDevice: Record<string, number> = {};
            const installs = new Set<string>();
            const out = events.docs.map((doc) => {
                const d = doc.data();
                const at = toMs(d.receivedAt) ?? 0;
                const i = keys.indexOf(new Date(at).toISOString().slice(0, 10));
                if (i >= 0) series[i] += 1;
                byRelease[d.release || '?'] = (byRelease[d.release || '?'] || 0) + 1;
                const device = [d.device?.os, d.device?.osVersion, d.device?.browser || d.device?.model].filter(Boolean).join(' ');
                byDevice[device || '?'] = (byDevice[device || '?'] || 0) + 1;
                if (d.installId) installs.add(d.installId);
                return {
                    id: doc.id,
                    receivedAt: at,
                    timestamp: d.timestamp ?? null,
                    release: d.release,
                    build: d.build ?? null,
                    environment: d.environment,
                    installId: d.installId,
                    device: d.device || {},
                    mechanism: d.mechanism,
                    handled: d.handled === true,
                    type: d.type,
                    message: d.message,
                    route: d.route ?? null,
                    frames: d.frames || [],
                    symbolicatedFrames: d.symbolicatedFrames ?? null,
                };
            });
            return { issue: issueOut(issue.id, issue.data()!), events: out, days: keys, series, byRelease, byDevice, installs: installs.size };
        },
    },

    'crashes.setStatus': {
        audit: 'mutation',
        target: (p) => `crashIssues/${str(p?.id, 64)}`,
        summary: (p) => `status → ${p?.status}${p?.note ? ` (${str(p.note, 80)})` : ''}`,
        run: async ({ db, uid }, params) => {
            const id = str(params?.id, 64);
            const status = params?.status;
            if (!id || !STATUSES.includes(status)) throw new AdminInputError('id/status invalid');
            const ref = db.collection('crashIssues').doc(id);
            const snap = await ref.get();
            if (!snap.exists) throw new AdminInputError('Issue not found');
            await ref.update({
                status,
                statusChangedAt: FieldValue.serverTimestamp(),
                statusChangedBy: uid,
                resolvedRelease: status === 'resolved' ? snap.get('lastRelease') ?? null : null,
                ...(typeof params?.note === 'string' ? { note: str(params.note, 1000) } : {}),
            });
            return { ok: true };
        },
    },
};
