import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FocusItemType, Task, UserFocusLastAction, UserFocusState } from '../types';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, runTransaction, type DocumentData } from 'firebase/firestore';
import {
    EMPTY_PIN_STATE,
    clearFocus,
    completeFocusItem as completeFocusState,
    pinItem as pinState,
    readPinState,
    reorderPinnedItems as reorderState,
    serializePinState,
    setFocusItem as setFocusState_,
    startFocusItem as startFocusState,
    unpinItem as unpinState,
    updateCurrentFocus,
    type PinState
} from '../utils/pinnedState';

export interface PinnedItem {
    id: string;
    type: FocusItemType;
    title: string;
    projectId: string;
    tenantId?: string;
    // Cache some display info to avoid instant fetching slightly
    priority?: Task['priority'];
    isCompleted?: boolean;
}

interface PinnedTasksContextType {
    pinnedItems: PinnedItem[];
    focusItemId: string | null;
    focusItem: PinnedItem | null;
    focusState: UserFocusState | null;
    isModalOpen: boolean;
    toggleModal: () => void;
    pinItem: (item: PinnedItem) => void;
    unpinItem: (itemId: string) => void;
    /** Moves the listed ids to the front in the given order. */
    reorderPinnedItems: (orderedIds: string[]) => void;
    isPinned: (itemId: string) => boolean;
    setFocusItem: (itemId: string | null) => void;
    startFocusItem: (item: PinnedItem) => void;
    snoozeFocusItem: (minutes?: number) => void;
    blockFocusItem: () => void;
    completeFocusItem: (itemId?: string) => void;
    clearFocusItem: (lastAction?: UserFocusLastAction) => void;
    isLoading: boolean;
}

const PinnedTasksContext = createContext<PinnedTasksContextType | undefined>(undefined);

const userDocRef = (uid: string) => doc(db, 'users', uid);

/**
 * Pins and focus live on users/{uid} and are shared across devices: the doc is
 * subscribed in realtime, and every change is a read-modify-write transaction
 * (so a pin added on the phone is never overwritten by a stale web tab).
 * Local state is updated optimistically; snapshots are ignored while one of our
 * own writes is in flight and the committed result wins afterwards.
 */
export const PinnedTasksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pins, setPins] = useState<PinState>(EMPTY_PIN_STATE);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const stateRef = useRef<PinState>(EMPTY_PIN_STATE);
    const lastSnapshotRef = useRef<DocumentData | undefined>(undefined);
    const pendingWritesRef = useRef(0);

    const applyState = useCallback((next: PinState) => {
        stateRef.current = next;
        setPins(next);
    }, []);

    // Realtime subscription to users/{uid} (focus + pins, across devices).
    useEffect(() => {
        let unsubscribeDoc: (() => void) | null = null;

        const stopDoc = () => {
            if (unsubscribeDoc) unsubscribeDoc();
            unsubscribeDoc = null;
        };

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            stopDoc();
            lastSnapshotRef.current = undefined;
            if (!user) {
                applyState(EMPTY_PIN_STATE);
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            unsubscribeDoc = onSnapshot(
                userDocRef(user.uid),
                (snapshot) => {
                    lastSnapshotRef.current = snapshot.data();
                    if (pendingWritesRef.current > 0) return;
                    applyState(readPinState(snapshot.data(), new Date().toISOString()));
                    setIsLoading(false);
                },
                (error) => {
                    console.error('Failed to subscribe to pinned items', error);
                    setIsLoading(false);
                }
            );
        });

        return () => {
            unsubscribeAuth();
            stopDoc();
        };
    }, [applyState]);

    // Optimistic update + transactional read-modify-write of users/{uid}.
    const mutate = useCallback((transition: (state: PinState) => PinState) => {
        const user = auth.currentUser;
        if (!user) return;

        const optimistic = transition(stateRef.current);
        if (optimistic === stateRef.current) return;
        applyState(optimistic);

        pendingWritesRef.current += 1;
        const ref = userDocRef(user.uid);
        runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(ref);
            const next = transition(readPinState(snapshot.data(), new Date().toISOString()));
            if (snapshot.exists()) transaction.update(ref, serializePinState(next));
            else transaction.set(ref, serializePinState(next), { merge: true });
            return next;
        })
            .then((committed) => {
                pendingWritesRef.current -= 1;
                if (pendingWritesRef.current === 0) applyState(committed);
            })
            .catch((error) => {
                console.error('Failed to save pinned items to Firebase', error);
                pendingWritesRef.current -= 1;
                if (pendingWritesRef.current === 0) {
                    applyState(readPinState(lastSnapshotRef.current, new Date().toISOString()));
                }
            });
    }, [applyState]);

    const pinItem = useCallback((item: PinnedItem) => {
        mutate((state) => pinState(state, item));
    }, [mutate]);

    const unpinItem = useCallback((itemId: string) => {
        mutate((state) => unpinState(state, itemId));
    }, [mutate]);

    const reorderPinnedItems = useCallback((orderedIds: string[]) => {
        mutate((state) => reorderState(state, orderedIds));
    }, [mutate]);

    const setFocusItem = useCallback((itemId: string | null) => {
        const now = new Date().toISOString();
        mutate((state) => setFocusState_(state, itemId, now));
    }, [mutate]);

    const startFocusItem = useCallback((item: PinnedItem) => {
        const now = new Date().toISOString();
        mutate((state) => startFocusState(state, item, now));
    }, [mutate]);

    const snoozeFocusItem = useCallback((minutes = 60) => {
        const nowMs = Date.now();
        const now = new Date(nowMs).toISOString();
        const snoozedUntil = new Date(nowMs + minutes * 60 * 1000).toISOString();
        mutate((state) => updateCurrentFocus(state, 'snoozed', now, {
            snoozedUntil,
            blockedAt: undefined,
            lastAction: 'snoozed'
        }));
    }, [mutate]);

    const blockFocusItem = useCallback(() => {
        const now = new Date().toISOString();
        mutate((state) => updateCurrentFocus(state, 'blocked', now, {
            blockedAt: now,
            snoozedUntil: undefined,
            lastAction: 'blocked'
        }));
    }, [mutate]);

    const clearFocusItem = useCallback((lastAction: UserFocusLastAction = 'cleared') => {
        mutate((state) => clearFocus(state, lastAction));
    }, [mutate]);

    const completeFocusItem = useCallback((itemId?: string) => {
        mutate((state) => completeFocusState(state, itemId));
    }, [mutate]);

    const { pinnedItems, focusItemId, focusState } = pins;

    const isPinned = useCallback((itemId: string) => {
        return pinnedItems.some(i => i.id === itemId);
    }, [pinnedItems]);

    const toggleModal = useCallback(() => setIsModalOpen(prev => !prev), []);
    const focusItem = useMemo(() => {
        const resolvedId = focusItemId || focusState?.itemId || null;
        if (!resolvedId) return null;
        const pinned = pinnedItems.find((item) => item.id === resolvedId);
        if (pinned) return pinned;
        if (focusState?.itemId && focusState.title && focusState.itemType) {
            return {
                id: focusState.itemId,
                type: focusState.itemType,
                title: focusState.title,
                projectId: focusState.projectId || '',
                tenantId: focusState.tenantId
            } satisfies PinnedItem;
        }
        return null;
    }, [focusItemId, focusState, pinnedItems]);

    // Keyboard Shortcut Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Command + Shift + F to toggle modal
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyF') {
                e.preventDefault();
                toggleModal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleModal]);

    return (
        <PinnedTasksContext.Provider value={{
            pinnedItems,
            focusItemId,
            focusItem,
            focusState,
            isModalOpen,
            toggleModal,
            pinItem,
            unpinItem,
            reorderPinnedItems,
            isPinned,
            setFocusItem,
            startFocusItem,
            snoozeFocusItem,
            blockFocusItem,
            completeFocusItem,
            clearFocusItem,
            isLoading
        }}>
            {children}
        </PinnedTasksContext.Provider>
    );
};

export const usePinnedTasks = () => {
    const context = useContext(PinnedTasksContext);
    if (context === undefined) {
        throw new Error('usePinnedTasks must be used within a PinnedTasksProvider');
    }
    return context;
};
