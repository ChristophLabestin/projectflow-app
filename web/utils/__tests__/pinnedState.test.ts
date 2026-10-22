import { describe, expect, it } from 'vitest';

import {
    EMPTY_PIN_STATE,
    completeFocusItem,
    pinItem,
    readPinState,
    reorderPinnedItems,
    serializePinState,
    startFocusItem,
    unpinItem,
    updateCurrentFocus
} from '../pinnedState';
import type { PinnedItem } from '../../context/PinnedTasksContext';

const NOW = '2026-10-22T10:00:00.000Z';
const item = (id: string, extra: Partial<PinnedItem> = {}): PinnedItem => ({ id, type: 'task', title: `Task ${id}`, projectId: 'p1', ...extra });

describe('pinned state transitions', () => {
    it('pins once and keeps the order', () => {
        let state = pinItem(EMPTY_PIN_STATE, item('a'));
        state = pinItem(state, item('b'));
        expect(pinItem(state, item('a'))).toBe(state);
        expect(state.pinnedItems.map((pinned) => pinned.id)).toEqual(['a', 'b']);
    });

    it('does not pin unsupported item types', () => {
        expect(pinItem(EMPTY_PIN_STATE, item('x', { type: 'issue' }))).toBe(EMPTY_PIN_STATE);
    });

    it('reorders the listed ids first and keeps unknown ones at the end', () => {
        let state = EMPTY_PIN_STATE;
        ['a', 'b', 'c', 'd'].forEach((id) => { state = pinItem(state, item(id)); });
        const next = reorderPinnedItems(state, ['c', 'missing', 'a']);
        expect(next.pinnedItems.map((pinned) => pinned.id)).toEqual(['c', 'a', 'b', 'd']);
    });

    it('starts, snoozes and resumes a focus without losing startedAt', () => {
        let state = startFocusItem(EMPTY_PIN_STATE, item('a'), NOW);
        expect(state.focusItemId).toBe('a');
        expect(state.focusState).toMatchObject({ status: 'active', lastAction: 'started', startedAt: NOW });

        state = updateCurrentFocus(state, 'snoozed', '2026-10-22T10:30:00.000Z', { snoozedUntil: '2026-10-22T11:30:00.000Z', lastAction: 'snoozed' });
        expect(state.focusState).toMatchObject({ status: 'snoozed', startedAt: NOW, snoozedUntil: '2026-10-22T11:30:00.000Z' });

        state = startFocusItem(state, item('a'), '2026-10-22T12:00:00.000Z');
        expect(state.focusState).toMatchObject({ status: 'active', lastAction: 'resumed', startedAt: NOW });
        expect(state.focusState?.snoozedUntil).toBeUndefined();
    });

    it('clears the focus when the focused item is unpinned or completed', () => {
        const focused = startFocusItem(EMPTY_PIN_STATE, item('a'), NOW);
        expect(unpinItem(focused, 'a')).toMatchObject({ pinnedItems: [], focusItemId: null, focusState: null });
        expect(completeFocusItem(focused)).toMatchObject({ pinnedItems: [], focusItemId: null, focusState: null });

        const other = pinItem(focused, item('b'));
        expect(completeFocusItem(other, 'b')).toMatchObject({ focusItemId: 'a' });
    });

    it('reads a user doc consistently and serializes without undefined values', () => {
        const state = readPinState({
            pinnedItems: [item('a'), item('x', { type: 'issue' })],
            focusItemId: 'a',
            focusState: { itemId: 'a', itemType: 'task', title: 'Task a', status: 'active', startedAt: NOW }
        }, NOW);
        expect(state.pinnedItems.map((pinned) => pinned.id)).toEqual(['a']);
        expect(state.focusState?.status).toBe('active');

        const written = serializePinState(state);
        expect(Object.values(written.focusState || {}).every((value) => value !== undefined)).toBe(true);

        // A focus id that is not pinned anymore is dropped.
        expect(readPinState({ pinnedItems: [], focusItemId: 'gone', focusState: { itemId: 'gone', itemType: 'task', title: 'x', status: 'active' } }, NOW))
            .toMatchObject({ focusItemId: null, focusState: null });
    });
});
