// Scheduled reminder delivery (contract C2).
// Every 5 minutes: collection groups `tasks` and `projects` where `nextReminderAt <= now`; one
// `reminder` notification doc per recipient (the push/email fan-out is done by onNotificationCreated),
// `sentAt` on the reminder, and `nextReminderAt` recomputed.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { isTenantSuspended } from './tenant-status';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './init';
import { copyText, resolveNudgeLanguage } from './nudge-logic';
import { Actor, createNotificationDoc, getActor, idPart } from './notification-writer';
import { classifyReminder, computeNextReminderAt, planReminderRecipients, ReminderLike, ReminderOwnerKind } from './reminder-logic';
import { isDone, Json } from './task-effects';

const BATCH_SIZE = 200;
const MAX_ATTEMPTS = 3;
const FAILED_PRECONDITION = 9;

export interface DeliveryStats {
    scanned: number;
    delivered: number;
    notifications: number;
    skippedStale: number;
}

/** `tenants/{t}/projects/{p}/tasks/{id}` or `tenants/{t}/projects/{p}`; anything else is ignored. */
const parseOwnerPath = (path: string, kind: ReminderOwnerKind): { tenantId: string; projectId: string; taskId?: string } | null => {
    const parts = path.split('/');
    if (parts[0] !== 'tenants' || parts[2] !== 'projects') return null;
    if (kind === 'project' && parts.length === 4) return { tenantId: parts[1], projectId: parts[3] };
    if (kind === 'task' && parts.length === 6 && parts[4] === 'tasks') return { tenantId: parts[1], projectId: parts[3], taskId: parts[5] };
    return null;
};

const filterMembers = async (tenantId: string, userIds: string[]): Promise<string[]> => {
    const ids = userIds.filter((id) => id && !id.includes('/'));
    if (ids.length === 0) return [];
    const snaps = await db.getAll(...ids.map((uid) => db.doc(`tenants/${tenantId}/members/${uid}`)));
    return ids.filter((_, index) => snaps[index].exists);
};

const processDoc = async (
    docSnap: FirebaseFirestore.QueryDocumentSnapshot,
    kind: ReminderOwnerKind,
    nowMs: number,
    stats: DeliveryStats
): Promise<void> => {
    const location = parseOwnerPath(docSnap.ref.path, kind);
    if (!location) return;
    const { tenantId, projectId, taskId } = location;
    const actors = new Map<string, Actor>();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const snap = attempt === 0 ? docSnap : await docSnap.ref.get();
        if (!snap.exists) return;
        const data = (snap.data() || {}) as Json;
        const reminders: ReminderLike[] = Array.isArray(data.reminders) ? data.reminders : [];
        const suppress = kind === 'task' && isDone(data);
        const title = typeof data.title === 'string' && data.title ? data.title : '';
        const nowIso = new Date(nowMs).toISOString();

        const updated = [...reminders];
        let changed = false;
        let sentHere = 0;

        for (const [index, reminder] of reminders.entries()) {
            if (suppress) break; // done tasks do not remind; nextReminderAt is simply cleared below
            const disposition = classifyReminder(reminder, nowMs);
            if (disposition === 'skip-stale') {
                updated[index] = { ...reminder, sentAt: nowIso };
                changed = true;
                stats.skippedStale += 1;
                continue;
            }
            if (disposition !== 'send') continue;

            const recipients = await filterMembers(tenantId, planReminderRecipients(reminder, kind, data));
            const creator = reminder.createdBy ? await getActor(reminder.createdBy, actors) : null;
            for (const userId of recipients) {
                const userSnap = await db.doc(`users/${userId}`).get();
                const lang = resolveNudgeLanguage(userSnap.data()?.language);
                const reminderTitle = (reminder.title || '').trim() || copyText(lang, 'reminder.fallbackTitle');
                const created = await createNotificationDoc({
                    userId,
                    tenantId,
                    type: 'reminder',
                    title: reminderTitle,
                    message: title ? copyText(lang, kind === 'task' ? 'reminder.task' : 'reminder.project', { title }) : reminderTitle,
                    projectId,
                    taskId,
                    deepLink: taskId ? `/project/${projectId}/tasks/${taskId}` : `/project/${projectId}`,
                    extra: { reminderId: reminder.id || String(index) }
                }, creator, `reminder-${idPart(snap.id)}-${idPart(String(reminder.id || index))}-${idPart(userId)}`);
                if (created) stats.notifications += 1;
            }
            updated[index] = { ...reminder, sentAt: nowIso };
            changed = true;
            sentHere += 1;
        }

        const next = computeNextReminderAt(updated, { suppress });
        const currentNext = typeof data.nextReminderAt === 'string' ? data.nextReminderAt : undefined;
        if (!changed && next === currentNext) return;

        const update: Record<string, unknown> = {
            nextReminderAt: next === undefined ? FieldValue.delete() : next
        };
        if (changed) update.reminders = updated;
        if (kind === 'task') update.systemWriteAt = FieldValue.serverTimestamp(); // no activity/notification side effects

        try {
            await docSnap.ref.update(update, { lastUpdateTime: snap.updateTime });
            stats.delivered += sentHere;
            return;
        } catch (error: any) {
            if (error?.code !== FAILED_PRECONDITION) throw error;
            // Edited meanwhile: retry on fresh data. Notification ids are deterministic, so nothing is sent twice.
        }
    }
};

export const runDeliverReminders = async (nowMs: number = Date.now()): Promise<DeliveryStats> => {
    const stats: DeliveryStats = { scanned: 0, delivered: 0, notifications: 0, skippedStale: 0 };
    const nowIso = new Date(nowMs).toISOString();

    for (const [group, kind] of [['tasks', 'task'], ['projects', 'project']] as Array<[string, ReminderOwnerKind]>) {
        const snapshot = await db.collectionGroup(group).where('nextReminderAt', '<=', nowIso).limit(BATCH_SIZE).get();
        for (const docSnap of snapshot.docs) {
            stats.scanned += 1;
            // Suspended workspaces (admin console) get no reminders until they are released.
            if (await isTenantSuspended(docSnap.ref.path.split('/')[1])) continue;
            try {
                await processDoc(docSnap, kind, nowMs, stats);
            } catch (error) {
                console.error(`deliverReminders: failed for ${docSnap.ref.path}`, error);
            }
        }
    }
    return stats;
};

export const deliverReminders = onSchedule(
    { schedule: 'every 5 minutes', region: 'europe-west3', timeoutSeconds: 300, memory: '512MiB' },
    async () => {
        const stats = await runDeliverReminders();
        console.log('deliverReminders', JSON.stringify(stats));
    }
);
