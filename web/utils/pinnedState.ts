// Pure state transitions for pinned items and the focus state (users/{uid}
// fields `pinnedItems`, `focusItemId`, `focusState`). No React / Firebase
// imports: PinnedTasksContext applies these inside a Firestore transaction
// (read-modify-write) so concurrent devices (web, iOS) never overwrite each
// other's pins.

import type { PinnedItem } from '../context/PinnedTasksContext';
import type { UserFocusLastAction, UserFocusState, UserFocusStatus } from '../types';

export interface PinState {
    pinnedItems: PinnedItem[];
    focusItemId: string | null;
    focusState: UserFocusState | null;
}

export const EMPTY_PIN_STATE: PinState = { pinnedItems: [], focusItemId: null, focusState: null };

const compactRecord = <T extends Record<string, unknown>>(value: T): Partial<T> => (
    Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as Partial<T>
);

export const serializePinnedItem = (item: PinnedItem) => compactRecord({
    id: item.id,
    type: item.type,
    title: item.title,
    projectId: item.projectId,
    tenantId: item.tenantId,
    priority: item.priority,
    isCompleted: item.isCompleted
}) as PinnedItem;

export const isSupportedPinnedItem = (item: PinnedItem) => item.type !== 'issue';

export const serializeFocusState = (state: UserFocusState) => compactRecord({
    itemId: state.itemId,
    itemType: state.itemType,
    title: state.title,
    projectId: state.projectId,
    tenantId: state.tenantId,
    status: state.status,
    startedAt: state.startedAt,
    snoozedUntil: state.snoozedUntil,
    blockedAt: state.blockedAt,
    updatedAt: state.updatedAt,
    lastAction: state.lastAction
}) as UserFocusState;

export const buildFocusState = (
    current: UserFocusState | null,
    item: PinnedItem,
    status: UserFocusStatus,
    now: string,
    overrides: Partial<UserFocusState> = {}
): UserFocusState => ({
    itemId: item.id,
    itemType: item.type,
    title: item.title,
    projectId: item.projectId || undefined,
    tenantId: item.tenantId,
    status,
    startedAt: overrides.startedAt || (current?.itemId === item.id ? current?.startedAt : undefined) || now,
    updatedAt: now,
    lastAction: status === 'active' ? 'started' : status,
    ...overrides
});

/** Reads the three user-doc fields into a consistent state (focus must be a pinned item). */
export const readPinState = (data: Record<string, unknown> | undefined | null, now: string): PinState => {
    const pinnedItems = ((data?.pinnedItems || []) as PinnedItem[]).filter(isSupportedPinnedItem);
    const storedFocus = (data?.focusState || null) as UserFocusState | null;
    const rawFocusItemId = (data?.focusItemId as string | null | undefined) || storedFocus?.itemId || null;
    const focusItemId = pinnedItems.some((item) => item.id === rawFocusItemId) ? rawFocusItemId : null;
    let focusState: UserFocusState | null = null;
    if (focusItemId) {
        if (storedFocus && storedFocus.itemType !== 'issue') {
            focusState = storedFocus;
        } else {
            const item = pinnedItems.find((candidate) => candidate.id === focusItemId);
            focusState = item ? buildFocusState(null, item, 'active', now) : null;
        }
    }
    return { pinnedItems, focusItemId, focusState };
};

/** Fields written to users/{uid}. */
export const serializePinState = (state: PinState) => ({
    pinnedItems: state.pinnedItems.filter(isSupportedPinnedItem).map(serializePinnedItem),
    focusItemId: state.focusState?.itemType === 'issue' ? null : state.focusItemId,
    focusState: state.focusState && state.focusState.itemType !== 'issue' ? serializeFocusState(state.focusState) : null
});

export const pinItem = (state: PinState, item: PinnedItem): PinState => {
    if (!isSupportedPinnedItem(item) || state.pinnedItems.some((candidate) => candidate.id === item.id)) return state;
    return { ...state, pinnedItems: [...state.pinnedItems, item] };
};

export const unpinItem = (state: PinState, itemId: string): PinState => {
    const clearsFocus = state.focusItemId === itemId;
    return {
        pinnedItems: state.pinnedItems.filter((item) => item.id !== itemId),
        focusItemId: clearsFocus ? null : state.focusItemId,
        focusState: clearsFocus ? null : state.focusState
    };
};

/** Moves the listed ids to the front in the given order; ids not listed keep their relative order at the end. */
export const reorderPinnedItems = (state: PinState, orderedIds: string[]): PinState => {
    const byId = new Map(state.pinnedItems.map((item) => [item.id, item]));
    const ordered = orderedIds.map((id) => byId.get(id)).filter((item): item is PinnedItem => Boolean(item));
    const listed = new Set(ordered.map((item) => item.id));
    return { ...state, pinnedItems: [...ordered, ...state.pinnedItems.filter((item) => !listed.has(item.id))] };
};

export const setFocusItem = (state: PinState, itemId: string | null, now: string): PinState => {
    const item = itemId ? state.pinnedItems.find((candidate) => candidate.id === itemId) : undefined;
    return {
        ...state,
        focusItemId: itemId,
        focusState: item ? buildFocusState(state.focusState, item, 'active', now) : null
    };
};

export const startFocusItem = (state: PinState, item: PinnedItem, now: string): PinState => {
    if (!isSupportedPinnedItem(item)) return state;
    const pinnedItems = state.pinnedItems.some((candidate) => candidate.id === item.id)
        ? state.pinnedItems.map((candidate) => (candidate.id === item.id ? { ...candidate, ...item } : candidate))
        : [...state.pinnedItems, item];
    const focusState = buildFocusState(state.focusState, item, 'active', now, {
        lastAction: state.focusState?.itemId === item.id ? 'resumed' : 'started',
        snoozedUntil: undefined,
        blockedAt: undefined
    });
    return { pinnedItems, focusItemId: item.id, focusState };
};

/** Moves the current focus item to another status (snoozed / blocked / active). */
export const updateCurrentFocus = (
    state: PinState,
    status: UserFocusStatus,
    now: string,
    overrides: Partial<UserFocusState> = {}
): PinState => {
    const currentId = state.focusItemId || state.focusState?.itemId || null;
    const item = currentId ? state.pinnedItems.find((candidate) => candidate.id === currentId) : null;
    if (!item) return state;
    return {
        ...state,
        focusItemId: item.id,
        focusState: buildFocusState(state.focusState, item, status, now, overrides)
    };
};

export const clearFocus = (state: PinState, _lastAction: UserFocusLastAction = 'cleared'): PinState => ({
    ...state,
    focusItemId: null,
    focusState: null
});

/** Removes a completed item from the pins; clears the focus when it was the focused item. */
export const completeFocusItem = (state: PinState, itemId?: string): PinState => {
    const completedId = itemId || state.focusItemId || state.focusState?.itemId || null;
    if (!completedId) return state;
    const clearsFocus = state.focusItemId === completedId || state.focusState?.itemId === completedId;
    return {
        pinnedItems: state.pinnedItems.filter((item) => item.id !== completedId),
        focusItemId: clearsFocus ? null : state.focusItemId,
        focusState: clearsFocus ? null : state.focusState
    };
};
