// Workspace insights (/insights): daily precomputation, on-demand refresh and the AI weekly report.
// Concept: brain/plans/activity-insights-concept.md. Docs are server-written (firestore.rules).
import * as functions from 'firebase-functions/v1';
import { assertTenantActive } from './tenant-status';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from './init';
import { generateServerText } from './ai-service';
import { computeInsights, insightsDigest, InsightsSnapshot, InsightTask, toInsightTask } from './insights-logic';

const REGION = 'europe-west3';
const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
const REPORT_EVENT_LIMIT = 200;

const isArchived = (data: FirebaseFirestore.DocumentData): boolean =>
    data.archived === true || data.isArchived === true || data.status === 'Archived';

/** Compute and store `insights_daily/{day}` + `insights_daily/latest` for one workspace. */
export const computeTenantInsights = async (tenantId: string, nowMs = Date.now()): Promise<InsightsSnapshot> => {
    const tenantRef = db.doc(`tenants/${tenantId}`);
    const projectsSnap = await tenantRef.collection('projects').get();
    const projects = projectsSnap.docs
        .filter((doc) => !isArchived(doc.data()))
        .map((doc) => ({ id: doc.id, title: String(doc.data().title || ''), status: String(doc.data().status || '') }));

    const tasks: InsightTask[] = [];
    for (const project of projects) {
        const snap = await tenantRef.collection(`projects/${project.id}/tasks`).get();
        snap.docs.forEach((doc) => tasks.push(toInsightTask(project.id, doc.data())));
    }

    const activity: Record<string, number> = {};
    const since = Timestamp.fromMillis(nowMs - 7 * DAY_MS);
    await Promise.all(projects.map(async (project) => {
        const count = await tenantRef.collection('activity')
            .where('projectId', '==', project.id)
            .where('createdAt', '>=', since)
            .count().get();
        activity[project.id] = count.data().count;
    }));

    const snapshot = computeInsights(projects, tasks, activity, nowMs);
    const doc = { ...snapshot, tenantId, computedAt: FieldValue.serverTimestamp() };
    const batch = db.batch();
    batch.set(tenantRef.collection('insights_daily').doc(snapshot.day), doc);
    batch.set(tenantRef.collection('insights_daily').doc('latest'), doc);
    await batch.commit();
    return snapshot;
};

export const computeWorkspaceInsights = onSchedule(
    { schedule: '30 3 * * *', region: REGION, timeZone: 'Europe/Berlin', timeoutSeconds: 540, memory: '512MiB' },
    async () => {
        const tenants = await db.collection('tenants').get();
        for (const tenant of tenants.docs) {
            if (tenant.get('suspendedAt') != null) continue; // suspended in the admin console
            try {
                await computeTenantInsights(tenant.id);
            } catch (error) {
                console.error('computeWorkspaceInsights failed', tenant.id, error);
            }
        }
    }
);

const requireFullMember = async (tenantId: unknown, context: functions.https.CallableContext) => {
    await assertTenantActive(tenantId);
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    if (typeof tenantId !== 'string' || !tenantId.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }
    const member = await db.doc(`tenants/${tenantId.trim()}/members/${uid}`).get();
    const role = member.exists ? String(member.data()?.role || 'Member') : '';
    if (!['Owner', 'Admin', 'Member'].includes(role)) {
        throw new functions.https.HttpsError('permission-denied', 'Insights are available to workspace members.');
    }
    return { uid, tenantId: tenantId.trim() };
};

/** Recompute now (first visit, "refresh"); at most once per 10 minutes per workspace. */
export const refreshWorkspaceInsights = functions.region(REGION).runWith({ timeoutSeconds: 300, memory: '512MB' })
    .https.onCall(async (data, context) => {
        const { tenantId } = await requireFullMember(data?.tenantId, context);
        const latest = await db.doc(`tenants/${tenantId}/insights_daily/latest`).get();
        const computedAt = latest.data()?.computedAt as Timestamp | undefined;
        if (computedAt && Date.now() - computedAt.toMillis() < REFRESH_COOLDOWN_MS) {
            return { refreshed: false };
        }
        await computeTenantInsights(tenantId);
        return { refreshed: true };
    });

const isoWeekId = (ms: number): string => {
    const date = new Date(ms);
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - day + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

/** AI weekly report (progress, risks, next steps) stored in `insights_reports/{isoWeek}-{lang}`. */
export const generateWeeklyInsightsReport = functions.region(REGION)
    .runWith({ secrets: ['OPENAI_API_KEY'], timeoutSeconds: 120, memory: '512MB' })
    .https.onCall(async (data, context) => {
        const { uid, tenantId } = await requireFullMember(data?.tenantId, context);
        const language = data?.language === 'de' ? 'de' : 'en';

        let snapshot = (await db.doc(`tenants/${tenantId}/insights_daily/latest`).get()).data() as InsightsSnapshot | undefined;
        if (!snapshot?.projects) snapshot = await computeTenantInsights(tenantId);

        const events = await db.collection(`tenants/${tenantId}/activity`)
            .where('createdAt', '>=', Timestamp.fromMillis(Date.now() - 7 * DAY_MS))
            .orderBy('createdAt', 'desc')
            .limit(REPORT_EVENT_LIMIT)
            .get();
        const eventLines = events.docs.map((doc) => {
            const e = doc.data();
            return `${e.type} | ${e.projectTitle || ''} | ${e.object?.title || ''} | ${e.actor?.name || ''}`;
        });

        const instructions = [
            'You write a concise weekly status report for a project management workspace.',
            `Write in ${language === 'de' ? 'German (informal "du" is not needed, neutral tone)' : 'English'}.`,
            'Use Markdown with exactly three sections: "Progress", "Risks", "Next steps" (translated headings).',
            'Max 250 words. Use bullet points. Name projects and tasks concretely. Do not invent facts beyond the data.',
            'If there is little data, say so briefly.'
        ].join('\n');
        const input = `Project metrics (current week vs. last week):\n${insightsDigest(snapshot) || '(no projects)'}\n\n`
            + `Activity events of the last 7 days (type | project | object | actor):\n${eventLines.join('\n') || '(none)'}`;

        const markdown = await generateServerText(uid, instructions, input);
        if (!markdown) throw new functions.https.HttpsError('internal', 'The report could not be generated.');

        const week = isoWeekId(Date.now());
        await db.doc(`tenants/${tenantId}/insights_reports/${week}-${language}`).set({
            tenantId,
            week,
            language,
            markdown,
            createdBy: uid,
            createdAt: FieldValue.serverTimestamp()
        });
        return { week, markdown };
    });
