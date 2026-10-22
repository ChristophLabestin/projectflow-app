// Pure Live Activity logic (contract C5). No Firebase imports.
import { Json, toMillis } from './task-effects';

export type FocusStatus = 'active' | 'snoozed' | 'blocked';

export interface FocusSnapshot {
    itemId: string;
    itemType: string;
    title: string;
    projectId?: string;
    tenantId?: string;
    status: FocusStatus;
    startedAt?: string;
    snoozedUntil?: string;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * `users/{uid}.focusState` -> the part Live Activities care about.
 * null when there is no focus, it was completed/cleared, or it is an issue (web does not persist those).
 */
export const normalizeFocus = (raw: unknown): FocusSnapshot | null => {
    if (!raw || typeof raw !== 'object') return null;
    const state = raw as Json;
    const itemId = text(state.itemId);
    if (!itemId) return null;
    if (state.lastAction === 'completed' || state.lastAction === 'cleared') return null;
    const itemType = text(state.itemType) || 'task';
    if (itemType === 'issue') return null;
    const status: FocusStatus = state.status === 'snoozed' || state.status === 'blocked' ? state.status : 'active';
    return {
        itemId,
        itemType,
        title: text(state.title) || 'Focus',
        projectId: text(state.projectId) || undefined,
        tenantId: text(state.tenantId) || undefined,
        status,
        startedAt: text(state.startedAt) || undefined,
        snoozedUntil: text(state.snoozedUntil) || undefined
    };
};

/** True when something a Live Activity shows (or its identity) differs. */
export const focusChanged = (before: FocusSnapshot | null, after: FocusSnapshot | null): boolean => {
    if (!before || !after) return before !== after;
    const key = (f: FocusSnapshot) => JSON.stringify([f.itemId, f.itemType, f.title, f.projectId || '', f.tenantId || '', f.status, f.startedAt || '', f.snoozedUntil || '']);
    return key(before) !== key(after);
};

export interface ContentState {
    title: string;
    projectName?: string;
    nextStep?: string;
    status: FocusStatus;
    startedAt: number; // epoch seconds
    snoozedUntil?: number; // epoch seconds
}

export interface LiveActivityAttributes {
    itemId: string;
    itemType: string;
    tenantId: string;
    projectId?: string;
}

const seconds = (value: unknown): number | null => {
    const millis = toMillis(value);
    return millis === null ? null : Math.floor(millis / 1000);
};

/** Swift `FocusActivityAttributes.ContentState` as JSON. */
export const buildContentState = (
    focus: FocusSnapshot,
    extras: { projectName?: string; nextStep?: string } = {},
    nowMs: number = Date.now()
): ContentState => {
    const state: ContentState = {
        title: focus.title,
        status: focus.status,
        startedAt: seconds(focus.startedAt) ?? Math.floor(nowMs / 1000)
    };
    if (extras.projectName) state.projectName = extras.projectName;
    if (extras.nextStep) state.nextStep = extras.nextStep;
    const snoozedUntil = seconds(focus.snoozedUntil);
    if (snoozedUntil !== null && focus.status === 'snoozed') state.snoozedUntil = snoozedUntil;
    return state;
};

/** Swift `FocusActivityAttributes` as JSON (static for the activity's lifetime). */
export const buildAttributes = (focus: FocusSnapshot, fallbackTenantId = ''): LiveActivityAttributes => {
    const attributes: LiveActivityAttributes = {
        itemId: focus.itemId,
        itemType: focus.itemType,
        tenantId: focus.tenantId || fallbackTenantId
    };
    if (focus.projectId) attributes.projectId = focus.projectId;
    return attributes;
};

export interface LiveActivityDoc {
    id: string;
    deviceId?: string;
    pushToken: string;
    itemId?: string;
}

export interface DeviceTarget {
    deviceId: string;
    fcmToken: string;
    liveActivityStartToken?: string;
}

export type LiveActivityOp =
    | { kind: 'end'; activity: LiveActivityDoc }
    | { kind: 'update'; activity: LiveActivityDoc }
    | { kind: 'start'; device: DeviceTarget };

/**
 * Which pushes a focus change needs.
 * - no focus anymore -> `end` every activity
 * - same item -> `update` its activities
 * - a different item than the running activity -> `end` the old one and `start` the new one
 *   (the activity attributes are fixed at start, so an update would keep the old itemId)
 * - no activity for the item -> `start` on every device with a push-to-start token (contract C5)
 */
export const planLiveActivityOps = (
    after: FocusSnapshot | null,
    activities: LiveActivityDoc[],
    devices: DeviceTarget[]
): LiveActivityOp[] => {
    if (!after) return activities.filter((a) => a.pushToken).map((activity) => ({ kind: 'end' as const, activity }));

    const ops: LiveActivityOp[] = [];
    const sameItem = activities.filter((a) => a.pushToken && (!a.itemId || a.itemId === after.itemId));
    const otherItem = activities.filter((a) => a.pushToken && a.itemId && a.itemId !== after.itemId);

    otherItem.forEach((activity) => ops.push({ kind: 'end', activity }));
    sameItem.forEach((activity) => ops.push({ kind: 'update', activity }));

    if (sameItem.length === 0) {
        devices
            .filter((d) => d.fcmToken && d.liveActivityStartToken)
            .forEach((device) => ops.push({ kind: 'start', device }));
    }
    return ops;
};
