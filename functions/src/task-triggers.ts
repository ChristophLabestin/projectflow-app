// Firestore triggers that own the side effects of task / subtask / comment writes (contract C1)
// and the server-maintained `nextReminderAt` (contract C2).
//
// Loop safety: the triggers write back to the doc that fired them. Every patch is computed from the
// written state and skipped when nothing differs; a patch is stamped with `systemWriteAt`, and a write
// whose `systemWriteAt` changed (our own patch, seed / backfill scripts, reminder delivery) never
// produces activity entries, notifications or a progress sync. Notification and activity docs use
// deterministic ids derived from the event id, so a retried trigger does not duplicate them.
import * as functions from 'firebase-functions/v1';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './init';
import { Actor, createActivityDoc, createNotificationDoc, getActor, idPart } from './notification-writer';
import { computeNextReminderAt } from './reminder-logic';
import {
    addedItems,
    applyConsistency,
    computeProgress,
    effectiveAssignees,
    findMentionedTargets,
    isDone,
    isSystemWrite,
    Json,
    MentionTarget,
    plainSnippet,
    planCommentRecipients,
    planCompletionConsistency,
    planSubtaskActivities,
    planSubtaskNotifications,
    planTaskActivities,
    planTaskNotifications,
    resolveActorId
} from './task-effects';

const REGION = 'europe-west3';
const TASK_PATH = 'tenants/{tenantId}/projects/{projectId}/tasks/{taskId}';
const SUBTASK_PATH = 'tenants/{tenantId}/projects/{projectId}/tasks/{taskId}/subtasks/{subtaskId}';
const COMMENT_PATH = 'tenants/{tenantId}/projects/{projectId}/comments/{commentId}';
const PROJECT_PATH = 'tenants/{tenantId}/projects/{projectId}';

const FAILED_PRECONDITION = 9;
const NOT_FOUND = 5;
const MAX_MENTION_IDS = 25;

const toData = (snapshot: FirebaseFirestore.DocumentSnapshot): Json | null =>
    snapshot.exists ? ((snapshot.data() || {}) as Json) : null;

// ---------------------------------------------------------------------------
// Project progress
// ---------------------------------------------------------------------------

/**
 * Recompute `progress` (% of tasks done; done = isCompleted || status Done, as the web client counted).
 * Uses count aggregations (1 read per 1000 index entries) and only writes when the value changed.
 */
export const syncProjectProgress = async (tenantId: string, projectId: string): Promise<void> => {
    const projectRef = db.doc(`tenants/${tenantId}/projects/${projectId}`);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) return;

    const tasks = db.collection(`tenants/${tenantId}/projects/${projectId}/tasks`);
    const count = async (query: FirebaseFirestore.Query) => (await query.count().get()).data().count;
    const [total, completed, statusDone, both] = await Promise.all([
        count(tasks),
        count(tasks.where('isCompleted', '==', true)),
        count(tasks.where('status', '==', 'Done')),
        count(tasks.where('status', '==', 'Done').where('isCompleted', '==', true))
    ]);
    const progress = computeProgress(total, completed + statusDone - both);
    if (projectSnap.data()?.progress === progress) return;

    try {
        await projectRef.update({ progress, updatedAt: FieldValue.serverTimestamp() });
    } catch (error: any) {
        if (error?.code !== NOT_FOUND) throw error; // project deleted meanwhile
    }
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const onTaskWritten = functions.region(REGION).firestore
    .document(TASK_PATH)
    .onWrite(async (change, context) => {
        const { tenantId, projectId, taskId } = context.params as Record<string, string>;
        const before = toData(change.before);
        const after = toData(change.after);

        // Deleted: only the progress sync. The deleting client does not leave a trace on the doc,
        // so the "Deleted task" activity stays a client-side write.
        if (!after) {
            await syncProjectProgress(tenantId, projectId);
            return;
        }

        const systemWrite = isSystemWrite(before, after);
        const actorId = resolveActorId(before, after, ['createdBy']);

        // 1. Self-healing patch: completion consistency, tenantId/projectId, nextReminderAt.
        const { plan, done, wasDone } = planCompletionConsistency(before, after);
        const final = applyConsistency(after, plan);
        const patch: Record<string, unknown> = {};
        if (plan.status !== undefined) patch.status = plan.status;
        if (plan.isCompleted !== undefined) patch.isCompleted = plan.isCompleted;
        if (plan.stampCompletedAt) patch.completedAt = FieldValue.serverTimestamp();
        if (plan.stampCompletedBy && actorId) patch.completedBy = actorId;
        if (plan.clearCompleted) {
            patch.completedAt = FieldValue.delete();
            patch.completedBy = FieldValue.delete();
        }
        if (!after.tenantId) patch.tenantId = tenantId;
        if (!after.projectId) patch.projectId = projectId;

        const nextReminderAt = computeNextReminderAt(final.reminders, { suppress: isDone(final) });
        if (nextReminderAt !== (typeof after.nextReminderAt === 'string' ? after.nextReminderAt : undefined)) {
            patch.nextReminderAt = nextReminderAt === undefined ? FieldValue.delete() : nextReminderAt;
        }

        if (Object.keys(patch).length > 0) {
            patch.systemWriteAt = FieldValue.serverTimestamp();
            try {
                // Precondition: if a newer write landed meanwhile, its own invocation reconciles.
                await change.after.ref.update(patch, { lastUpdateTime: change.after.updateTime });
            } catch (error: any) {
                if (error?.code !== FAILED_PRECONDITION && error?.code !== NOT_FOUND) throw error;
                console.log(`onTaskWritten: skipped patch for ${taskId} (${error.code})`);
            }
        }

        if (systemWrite) return;

        // 2. Side effects of a real write.
        const actors = new Map<string, Actor>();
        const actor = await getActor(actorId, actors);
        const eventId = idPart(context.eventId || `${taskId}-${Date.now()}`);

        const added = addedItems(effectiveAssignees(before), effectiveAssignees(final));
        await Promise.all(added.map((uid) => getActor(uid, actors)));
        const names = (uid: string) => actors.get(uid)?.name || uid;

        const activities = planTaskActivities(before, final, taskId, names);
        for (const [index, activity] of activities.entries()) {
            await createActivityDoc(tenantId, projectId, actor, activity, `${eventId}-a${index}`);
        }

        const notifications = planTaskNotifications(before, final, actorId, actor.name);
        for (const notification of notifications) {
            await createNotificationDoc({
                userId: notification.userId,
                tenantId,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                projectId,
                taskId
            }, actor, `${eventId}-${notification.type}-${idPart(notification.userId)}`);
        }

        // 3. Project progress after create / completion changes.
        if (!before || done !== wasDone) {
            await syncProjectProgress(tenantId, projectId);
        }
    });

// ---------------------------------------------------------------------------
// Subtasks
// ---------------------------------------------------------------------------

export const onSubtaskWritten = functions.region(REGION).firestore
    .document(SUBTASK_PATH)
    .onWrite(async (change, context) => {
        const { tenantId, projectId, taskId } = context.params as Record<string, string>;
        const before = toData(change.before);
        const after = toData(change.after);
        // Deleted subtasks: the deleting client logs the activity (nothing on the doc says who).
        if (!after) return;
        if (isSystemWrite(before, after)) return;

        const parentSnap = await db.doc(`tenants/${tenantId}/projects/${projectId}/tasks/${taskId}`).get();
        const parent = toData(parentSnap);
        if (!parent) return;
        const parentTitle = typeof parent.title === 'string' && parent.title ? parent.title : 'Task';

        const actorId = resolveActorId(before, after, ['createdBy']);
        const actor = await getActor(actorId);
        const eventId = idPart(context.eventId || `${taskId}-${Date.now()}`);

        const activities = planSubtaskActivities(before, after, parentTitle, taskId);
        for (const [index, activity] of activities.entries()) {
            await createActivityDoc(tenantId, projectId, actor, activity, `${eventId}-a${index}`);
        }

        for (const notification of planSubtaskNotifications(before, after, parentTitle, actorId)) {
            await createNotificationDoc({
                userId: notification.userId,
                tenantId,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                projectId,
                taskId
            }, actor, `${eventId}-${notification.type}-${idPart(notification.userId)}`);
        }
    });

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

const TARGET_COLLECTIONS: Record<string, string> = {
    task: 'tasks',
    issue: 'issues',
    idea: 'ideas',
    initiative: 'initiatives'
};

const memberIdsOf = (project: Json): string[] => {
    const ids = new Set<string>();
    const push = (value: unknown) => {
        if (typeof value === 'string' && value.trim() && !value.includes('/')) ids.add(value.trim());
    };
    (Array.isArray(project.members) ? project.members : []).forEach((member: unknown) => {
        push(typeof member === 'string' ? member : (member as Json | null)?.userId);
    });
    (Array.isArray(project.memberIds) ? project.memberIds : []).forEach(push);
    push(project.ownerId);
    return Array.from(ids).slice(0, 200);
};

/** Users, project groups and workspace roles that `@Name` can refer to (same sources as the web editor). */
const loadMentionTargets = async (tenantId: string, projectId: string, project: Json): Promise<MentionTarget[]> => {
    const targets: MentionTarget[] = [];

    const memberIds = memberIdsOf(project);
    if (memberIds.length > 0) {
        const profiles = await db.getAll(...memberIds.map((uid) => db.doc(`users/${uid}`)));
        profiles.forEach((snap, index) => {
            const data = (snap.data() || {}) as Json;
            const name = (typeof data.displayName === 'string' && data.displayName.trim())
                || (typeof data.email === 'string' && data.email ? data.email.split('@')[0] : '');
            if (name) targets.push({ id: memberIds[index], name, type: 'user' });
        });
    }

    try {
        const groups = await db.collection(`tenants/${tenantId}/projects/${projectId}/project_groups`).get();
        groups.docs.forEach((doc) => {
            const data = doc.data() as Json;
            if (typeof data.name === 'string' && data.name) {
                targets.push({ id: doc.id, name: data.name, type: 'group', memberIds: Array.isArray(data.memberIds) ? data.memberIds : [] });
            }
        });
    } catch (error) {
        console.warn('loadMentionTargets: groups failed', error);
    }

    try {
        const tenant = toData(await db.doc(`tenants/${tenantId}`).get());
        const roles = project.roles && typeof project.roles === 'object' ? (project.roles as Json) : {};
        const customRoles: Json[] = Array.isArray(tenant?.customRoles) ? tenant.customRoles : [];
        customRoles.forEach((role: Json) => {
            if (typeof role?.id === 'string' && typeof role?.name === 'string' && role.name) {
                const members = Object.entries(roles).filter(([, roleId]) => roleId === role.id).map(([uid]) => uid);
                targets.push({ id: role.id, name: role.name, type: 'role', memberIds: members });
            }
        });
    } catch (error) {
        console.warn('loadMentionTargets: roles failed', error);
    }
    return targets;
};

/** Explicit `mentionedUserIds` from a native client, limited to members of the workspace. */
const validateExplicitMentions = async (tenantId: string, raw: unknown): Promise<string[]> => {
    if (!Array.isArray(raw)) return [];
    const ids = Array.from(new Set(raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0 && !id.includes('/')).map((id) => id.trim())))
        .slice(0, MAX_MENTION_IDS);
    if (ids.length === 0) return [];
    const snaps = await db.getAll(...ids.map((uid) => db.doc(`tenants/${tenantId}/members/${uid}`)));
    return ids.filter((_, index) => snaps[index].exists);
};

export const onCommentCreated = functions.region(REGION).firestore
    .document(COMMENT_PATH)
    .onCreate(async (snapshot, context) => {
        const { tenantId, projectId, commentId } = context.params as Record<string, string>;
        const comment = (snapshot.data() || {}) as Json;
        if (isSystemWrite(null, comment)) return;

        const authorId = resolveActorId(null, comment, ['userId']);
        const targetType = typeof comment.targetType === 'string' && TARGET_COLLECTIONS[comment.targetType] ? comment.targetType : 'task';
        const targetId = typeof comment.targetId === 'string' ? comment.targetId : '';
        if (!authorId || !targetId) return;

        const [targetSnap, projectSnap] = await Promise.all([
            db.doc(`tenants/${tenantId}/projects/${projectId}/${TARGET_COLLECTIONS[targetType]}/${targetId}`).get(),
            db.doc(`tenants/${tenantId}/projects/${projectId}`).get()
        ]);
        const target = toData(targetSnap);
        const project = toData(projectSnap);
        if (!target || !project) return;

        const content = typeof comment.content === 'string' ? comment.content : '';
        const targetTitle = typeof target.title === 'string' && target.title ? target.title : targetType.charAt(0).toUpperCase() + targetType.slice(1);
        const actors = new Map<string, Actor>();
        const author = await getActor(authorId, actors);
        const eventId = idPart(context.eventId || commentId);

        await createActivityDoc(tenantId, projectId, author, {
            action: `Commented on ${targetType} "${targetTitle}"`,
            target: 'Tasks',
            type: 'comment',
            relatedId: targetId,
            details: plainSnippet(content)
        }, `${eventId}-a0`);

        // Mentions: `@Name` in the text (same matching as the web editor) + optional explicit ids.
        const mentioned = new Set<string>(await validateExplicitMentions(tenantId, comment.mentionedUserIds));
        if (content.includes('@')) {
            const targets = await loadMentionTargets(tenantId, projectId, project);
            for (const hit of findMentionedTargets(content, targets)) {
                if (hit.type === 'user') mentioned.add(hit.id);
                else (hit.memberIds || []).forEach((uid) => mentioned.add(uid));
            }
        }

        const recipients = planCommentRecipients({
            authorId,
            targetType,
            mentionedUserIds: Array.from(mentioned),
            assigneeIds: effectiveAssignees(target),
            creatorId: typeof target.createdBy === 'string' ? target.createdBy : (typeof target.ownerId === 'string' ? target.ownerId : ''),
            ownerId: typeof target.ownerId === 'string' ? target.ownerId : ''
        });

        const refs = {
            projectId,
            taskId: targetType === 'task' ? targetId : undefined,
            initiativeId: targetType === 'initiative' ? targetId : undefined,
            issueId: targetType === 'issue' ? targetId : undefined,
            commentId
        };

        for (const userId of recipients.mentions) {
            await createNotificationDoc({
                userId,
                tenantId,
                type: 'comment_mention',
                title: 'New Mention',
                message: `You were mentioned in a comment on ${targetType} "${targetTitle}"`,
                ...refs
            }, author, `${eventId}-comment_mention-${idPart(userId)}`);
        }
        for (const userId of recipients.comments) {
            await createNotificationDoc({
                userId,
                tenantId,
                type: 'comment_added',
                title: 'New Comment',
                message: `New comment on ${targetType} "${targetTitle}"`,
                ...refs
            }, author, `${eventId}-comment_added-${idPart(userId)}`);
        }
    });

// ---------------------------------------------------------------------------
// Projects: nextReminderAt only (progress is written by the task trigger)
// ---------------------------------------------------------------------------

export const onProjectWritten = functions.region(REGION).firestore
    .document(PROJECT_PATH)
    .onWrite(async (change) => {
        const after = toData(change.after);
        if (!after) return;

        const next = computeNextReminderAt(after.reminders);
        const current = typeof after.nextReminderAt === 'string' ? after.nextReminderAt : undefined;
        if (next === current) return; // loop guard: converges after one write

        try {
            await change.after.ref.update(
                { nextReminderAt: next === undefined ? FieldValue.delete() : next },
                { lastUpdateTime: change.after.updateTime }
            );
        } catch (error: any) {
            if (error?.code !== FAILED_PRECONDITION && error?.code !== NOT_FOUND) throw error;
        }
    });
