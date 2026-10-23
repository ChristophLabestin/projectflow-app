// Scheduled nudges (contract C3): morning_briefing, task_due_today, day_close.
// Every 15 minutes each user is evaluated in their own time zone. A nudge becomes a normal
// notification doc (so push/email/prefs run through onNotificationCreated) and is recorded in
// users/{uid}/nudgeLog/{yyyy-mm-dd}. The notification doc id is deterministic as well, so two
// overlapping runs cannot send the same nudge twice.
//
// COST NOTE: the scan reads every users doc each tick (projected to a few fields). Fine for thousands of
// users; at larger scale bucket users by time zone (e.g. a `nudgeZone` field) and query per bucket.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { db } from './init';
import { resolveNotificationPrefs } from './notification-prefs';
import { createNotificationDoc, idPart } from './notification-writer';
import {
    buildBriefingCopy,
    buildDayCloseCopy,
    buildDueTodayCopy,
    computeDayStats,
    DayStats,
    DayTask,
    DEEP_LINKS,
    dueNudgeTypes,
    isOverdueCheckDue,
    MAX_OVERDUE_PER_RUN,
    NudgeCopy,
    nudgeDateKey,
    planOverdueNotifications,
    NudgeType,
    resolveNudgeLanguage
} from './nudge-logic';
import { Json } from './task-effects';

const PAGE_SIZE = 300;
const MAX_TASKS_PER_TENANT = 1000;
const SYSTEM_ACTOR = { id: 'system', name: 'ProjectFlow', photoURL: '' };

export interface NudgeRunStats {
    users: number;
    evaluated: number;
    sent: number;
    skipped: number;
}

const mapTask = (id: string, data: Json, refs: { taskId?: string; projectId?: string; tenantId?: string } = {}): DayTask => ({
    ...refs,
    id,
    title: typeof data.title === 'string' && data.title ? data.title : 'Untitled',
    dueDate: data.dueDate,
    scheduledDate: data.scheduledDate,
    status: data.status,
    priority: data.priority,
    isCompleted: data.isCompleted === true
});

/** Open tasks assigned to the user across all their workspaces, plus their personal tasks. */
const loadUserTasks = async (uid: string, tenantIds: string[]): Promise<DayTask[]> => {
    const out: DayTask[] = [];
    for (const tenantId of tenantIds) {
        const [assigned, personal] = await Promise.all([
            db.collectionGroup('tasks')
                .where('tenantId', '==', tenantId)
                .where('assigneeIds', 'array-contains', uid)
                .where('isCompleted', '==', false)
                .limit(MAX_TASKS_PER_TENANT)
                .get(),
            db.collection(`tenants/${tenantId}/users/${uid}/personalTasks`)
                .where('isCompleted', '==', false)
                .limit(MAX_TASKS_PER_TENANT)
                .get()
        ]);
        assigned.docs.forEach((doc) => out.push(mapTask(doc.ref.path, doc.data() as Json, {
            taskId: doc.id,
            projectId: doc.ref.parent.parent?.id,
            tenantId
        })));
        personal.docs.forEach((doc) => out.push(mapTask(doc.ref.path, doc.data() as Json)));
    }
    return out;
};

const loadTenantIds = async (uid: string): Promise<string[]> => {
    const memberships = await db.collectionGroup('members').where('uid', '==', uid).get();
    return memberships.docs
        .map((doc) => doc.ref.parent.parent)
        .filter((ref): ref is FirebaseFirestore.DocumentReference => !!ref && ref.parent.id === 'tenants')
        .map((ref) => ref.id);
};

const statsPayload = (stats: DayStats) => ({
    overdue: stats.overdue,
    dueToday: stats.dueToday,
    scheduledToday: stats.scheduledToday,
    stops: stats.stops,
    waiting: stats.waiting
});

/** Overdue pass: once per local day, one `task_overdue` per open task past its (local) due day, in the task's tenant. */
const sendOverdue = async (uid: string, tasks: DayTask[], nowMs: number, timeZone: string): Promise<number> => {
    const candidates = planOverdueNotifications(tasks, nowMs, timeZone, uid);
    const titles = new Map<string, string>();
    let created = 0;
    for (const candidate of candidates) {
        if (created >= MAX_OVERDUE_PER_RUN) break;
        const key = `${candidate.tenantId}/${candidate.projectId}`;
        if (!titles.has(key)) {
            const project = await db.doc(`tenants/${candidate.tenantId}/projects/${candidate.projectId}`).get();
            const title = project.data()?.title;
            titles.set(key, typeof title === 'string' ? title.trim() : '');
        }
        const projectTitle = titles.get(key) || '';
        const params: Record<string, string> = { taskTitle: candidate.title, dueDate: candidate.dueDate };
        if (projectTitle) params.projectTitle = projectTitle;
        const wrote = await createNotificationDoc({
            userId: uid,
            tenantId: candidate.tenantId,
            type: 'task_overdue',
            title: 'Task Overdue',
            message: `"${candidate.title}" was due on ${candidate.dueKey}`,
            projectId: candidate.projectId,
            taskId: candidate.taskId,
            extra: { params }
        }, SYSTEM_ACTOR, candidate.docId);
        if (wrote) created += 1;
    }
    return created;
};

const processUser = async (uid: string, data: Json, nowMs: number, runStats: NudgeRunStats): Promise<void> => {
    const prefs = resolveNotificationPrefs(data.notificationPrefs);
    const tokens = Array.isArray(data.fcmTokens)
        ? data.fcmTokens.filter((token: unknown) => typeof token === 'string' && token.trim().length > 0)
        : [];

    const dueTypes = dueNudgeTypes(nowMs, { prefs, hasPushToken: tokens.length > 0 });
    const overdueDue = isOverdueCheckDue(nowMs, prefs);
    if (dueTypes.length === 0 && !overdueDue) return;

    const dateKey = nudgeDateKey(nowMs, prefs.timezone);
    const logRef = db.doc(`users/${uid}/nudgeLog/${dateKey}`);
    const log = ((await logRef.get()).data() || {}) as Json;
    const handled = new Set<string>([...(Array.isArray(log.sent) ? log.sent : []), ...(Array.isArray(log.skipped) ? log.skipped : [])]);
    const todo = dueTypes.filter((type) => !handled.has(type));
    const overdueTodo = overdueDue && log.overdueChecked !== true;
    if (todo.length === 0 && !overdueTodo) return;
    runStats.evaluated += 1;

    const tenantIds = await loadTenantIds(uid);
    if (tenantIds.length === 0) return;
    const primaryTenant = typeof data.lastTenantId === 'string' && tenantIds.includes(data.lastTenantId) ? data.lastTenantId : tenantIds[0];

    const lang = resolveNudgeLanguage(data.language);
    const tasks = await loadUserTasks(uid, tenantIds);
    const dayStats = computeDayStats(tasks, nowMs, prefs.timezone);

    const sent: NudgeType[] = [];
    const skipped: NudgeType[] = [];
    for (const type of todo) {
        let copy: NudgeCopy | null = null;
        if (type === 'morning_briefing') copy = buildBriefingCopy(lang, dayStats);
        else if (type === 'task_due_today') copy = buildDueTodayCopy(lang, dayStats);
        else if (type === 'day_close') {
            const briefedStops = typeof log.briefingStops === 'number' ? log.briefingStops : 0;
            // "Had a plan today": something is still open, or the morning briefing listed stops.
            copy = dayStats.stops > 0 || briefedStops > 0 ? buildDayCloseCopy(lang, dayStats) : null;
        }

        if (!copy) {
            skipped.push(type);
            continue;
        }
        await createNotificationDoc({
            userId: uid,
            tenantId: primaryTenant,
            type,
            title: copy.title,
            message: copy.message,
            deepLink: DEEP_LINKS[type],
            extra: { nudgeDate: dateKey, nudgeStats: statsPayload(dayStats) }
        }, SYSTEM_ACTOR, `nudge-${type}-${dateKey}-${idPart(uid)}`);
        sent.push(type);
    }

    const update: Json = { date: dateKey, timezone: prefs.timezone, updatedAt: FieldValue.serverTimestamp() };
    if (sent.length > 0) update.sent = FieldValue.arrayUnion(...sent);
    if (skipped.length > 0) update.skipped = FieldValue.arrayUnion(...skipped);
    if (sent.includes('morning_briefing')) update.briefingStops = dayStats.stops;

    if (overdueTodo) {
        runStats.sent += await sendOverdue(uid, tasks, nowMs, prefs.timezone);
        update.overdueChecked = true;
    }
    await logRef.set(update, { merge: true });

    runStats.sent += sent.length;
    runStats.skipped += skipped.length;
};

export const runSendNudges = async (nowMs: number = Date.now(), onlyUserId?: string): Promise<NudgeRunStats> => {
    const stats: NudgeRunStats = { users: 0, evaluated: 0, sent: 0, skipped: 0 };
    const fields = ['notificationPrefs', 'language', 'fcmTokens', 'lastTenantId'];

    if (onlyUserId) {
        const snap = await db.doc(`users/${onlyUserId}`).get();
        if (snap.exists) {
            stats.users += 1;
            await processUser(snap.id, (snap.data() || {}) as Json, nowMs, stats);
        }
        return stats;
    }

    let cursor: string | null = null;
    for (;;) {
        let query = db.collection('users').orderBy(FieldPath.documentId()).select(...fields).limit(PAGE_SIZE);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        if (page.empty) break;
        for (const doc of page.docs) {
            stats.users += 1;
            try {
                await processUser(doc.id, (doc.data() || {}) as Json, nowMs, stats);
            } catch (error) {
                console.error(`sendNudges: failed for user ${doc.id}`, error);
            }
        }
        cursor = page.docs[page.docs.length - 1].id;
        if (page.size < PAGE_SIZE) break;
    }
    return stats;
};

export const sendNudges = onSchedule(
    { schedule: 'every 15 minutes', region: 'europe-west3', timeoutSeconds: 300, memory: '512MiB' },
    async () => {
        const stats = await runSendNudges();
        console.log('sendNudges', JSON.stringify(stats));
    }
);
