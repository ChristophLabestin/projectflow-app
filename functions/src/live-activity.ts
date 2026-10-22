// Live Activity sync (contract C5): `users/{uid}.focusState` changes -> start / update / end pushes
// through FCM HTTP v1 (`apns.live_activity_token`, supported by firebase-admin >= 13.5).
//
// Device docs     users/{uid}/devices/{deviceId}          { fcmToken, liveActivityStartToken?, ... }
// Activity docs   users/{uid}/liveActivities/{activityId} { deviceId, pushToken, itemId, itemType }
//
// FCM needs the device's FCM registration token as the message target; the Live Activity token
// (push-to-start for `start`, the activity push token for `update` / `end`) goes in apns.liveActivityToken.
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { db } from './init';
import {
    buildAttributes,
    buildContentState,
    DeviceTarget,
    FocusSnapshot,
    focusChanged,
    LiveActivityDoc,
    LiveActivityOp,
    normalizeFocus,
    planLiveActivityOps
} from './focus-logic';
import { resolveNudgeLanguage } from './nudge-logic';
import { Json } from './task-effects';

const REGION = 'europe-west3';

/**
 * When a focus starts on the iPhone itself, the app starts the activity locally and registers its push
 * token a moment after the focusState write. Waiting briefly before a server `start` lets that
 * registration land, so the phone does not get a second activity for the same item.
 */
export const START_SETTLE_MS = 2500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const STARTED_ALERT = {
    de: 'Fokus gestartet',
    en: 'Focus started'
};

const loadActivities = async (uid: string): Promise<LiveActivityDoc[]> => {
    const snap = await db.collection(`users/${uid}/liveActivities`).get();
    return snap.docs.map((doc) => {
        const d = doc.data() as Json;
        return {
            id: doc.id,
            deviceId: typeof d.deviceId === 'string' ? d.deviceId : undefined,
            pushToken: typeof d.pushToken === 'string' ? d.pushToken : '',
            itemId: typeof d.itemId === 'string' ? d.itemId : undefined
        };
    });
};

const loadDevices = async (uid: string): Promise<Map<string, DeviceTarget>> => {
    const snap = await db.collection(`users/${uid}/devices`).get();
    const devices = new Map<string, DeviceTarget>();
    snap.docs.forEach((doc) => {
        const d = doc.data() as Json;
        if (typeof d.fcmToken === 'string' && d.fcmToken) {
            devices.set(doc.id, {
                deviceId: doc.id,
                fcmToken: d.fcmToken,
                liveActivityStartToken: typeof d.liveActivityStartToken === 'string' && d.liveActivityStartToken ? d.liveActivityStartToken : undefined
            });
        }
    });
    return devices;
};

/** Project name and next step shown in the activity (best effort). */
const loadExtras = async (uid: string, focus: FocusSnapshot): Promise<{ projectName?: string; nextStep?: string; tenantId: string }> => {
    let tenantId = focus.tenantId || '';
    if (!tenantId) {
        const user = await db.doc(`users/${uid}`).get();
        const lastTenantId = user.data()?.lastTenantId;
        tenantId = typeof lastTenantId === 'string' ? lastTenantId : '';
    }
    const extras: { projectName?: string; nextStep?: string; tenantId: string } = { tenantId };
    if (!tenantId || !focus.projectId) return extras;
    try {
        const [project, task] = await Promise.all([
            db.doc(`tenants/${tenantId}/projects/${focus.projectId}`).get(),
            focus.itemType === 'task'
                ? db.doc(`tenants/${tenantId}/projects/${focus.projectId}/tasks/${focus.itemId}`).get()
                : Promise.resolve(null)
        ]);
        const projectTitle = project.data()?.title;
        if (typeof projectTitle === 'string' && projectTitle) extras.projectName = projectTitle;
        const nextStep = task?.data()?.nextStep;
        if (typeof nextStep === 'string' && nextStep.trim()) extras.nextStep = nextStep.trim();
    } catch (error) {
        console.warn('onUserFocusChanged: extras lookup failed', error);
    }
    return extras;
};

export interface LiveActivityMessageInput {
    kind: 'start' | 'update' | 'end';
    fcmToken: string;
    liveActivityToken: string;
    nowSeconds: number;
    focus?: FocusSnapshot | null;
    extras?: { projectName?: string; nextStep?: string; tenantId: string };
    language?: 'de' | 'en';
}

/** FCM message for one Live Activity push. Exported for tests. */
export const buildLiveActivityMessage = (input: LiveActivityMessageInput): admin.messaging.Message => {
    const aps: Record<string, unknown> = { timestamp: input.nowSeconds, event: input.kind };

    if (input.kind === 'end') {
        aps['dismissal-date'] = input.nowSeconds; // remove immediately
        // APNs requires a (final) content-state for every event, including `end`.
        aps['content-state'] = input.focus
            ? buildContentState(input.focus, input.extras, input.nowSeconds * 1000)
            : { title: '', status: 'active', startedAt: input.nowSeconds };
    } else if (input.focus) {
        aps['content-state'] = buildContentState(input.focus, input.extras, input.nowSeconds * 1000);
        if (input.kind === 'start') {
            aps['attributes-type'] = 'FocusActivityAttributes';
            aps.attributes = buildAttributes(input.focus, input.extras?.tenantId || '');
            aps.alert = {
                title: STARTED_ALERT[input.language || 'en'],
                body: input.focus.title
            };
        }
    }

    return {
        token: input.fcmToken,
        apns: {
            liveActivityToken: input.liveActivityToken,
            headers: { 'apns-priority': '10' },
            payload: { aps }
        }
    };
};

export const onUserFocusChanged = functions.region(REGION).firestore
    .document('users/{userId}')
    .onWrite(async (change, context) => {
        const uid = context.params.userId as string;
        const before = normalizeFocus(change.before.exists ? change.before.data()?.focusState : null);
        const after = normalizeFocus(change.after.exists ? change.after.data()?.focusState : null);
        if (!focusChanged(before, after)) return; // profile / token / pin writes end here

        const language = resolveNudgeLanguage(change.after.data()?.language);
        let [activities, devices] = await Promise.all([loadActivities(uid), loadDevices(uid)]);
        let ops = planLiveActivityOps(after, activities, Array.from(devices.values()));

        if (ops.some((op) => op.kind === 'start') && START_SETTLE_MS > 0) {
            await sleep(START_SETTLE_MS);
            [activities, devices] = await Promise.all([loadActivities(uid), loadDevices(uid)]);
            ops = planLiveActivityOps(after, activities, Array.from(devices.values()));
        }
        if (ops.length === 0) return;

        const extras = after ? await loadExtras(uid, after) : undefined;
        const nowSeconds = Math.floor(Date.now() / 1000);
        const deletions: Array<Promise<unknown>> = [];

        const send = async (op: LiveActivityOp) => {
            let fcmToken: string | undefined;
            let liveActivityToken: string;
            if (op.kind === 'start') {
                fcmToken = op.device.fcmToken;
                liveActivityToken = op.device.liveActivityStartToken || '';
            } else {
                fcmToken = op.activity.deviceId ? devices.get(op.activity.deviceId)?.fcmToken : undefined;
                liveActivityToken = op.activity.pushToken;
            }

            if (op.kind === 'end') {
                // The activity is gone for good: drop the doc whether or not the push could be sent.
                deletions.push(db.doc(`users/${uid}/liveActivities/${op.activity.id}`).delete());
            }
            if (!fcmToken || !liveActivityToken) {
                console.warn(`onUserFocusChanged: ${op.kind} skipped, missing token`, { uid });
                return;
            }

            try {
                await admin.messaging().send(buildLiveActivityMessage({
                    kind: op.kind,
                    fcmToken,
                    liveActivityToken,
                    nowSeconds,
                    focus: op.kind === 'end' ? before : after,
                    extras: op.kind === 'end' ? undefined : extras,
                    language
                }));
            } catch (error: any) {
                console.warn(`onUserFocusChanged: ${op.kind} push failed`, error?.code || error?.message);
                if (op.kind === 'update' && /unregistered|not-registered|invalid/i.test(String(error?.code || error?.message))) {
                    deletions.push(db.doc(`users/${uid}/liveActivities/${op.activity.id}`).delete());
                }
            }
        };

        await Promise.all(ops.map(send));
        await Promise.all(deletions);
    });
